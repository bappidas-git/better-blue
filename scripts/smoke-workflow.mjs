#!/usr/bin/env node
// BetterBlue order/payment workflow smoke test — `npm run smoke:workflow`
// (Prompt 17).
//
// Drives the escrow lifecycle end to end against the running mock API and
// asserts on what actually landed in the database: the payment, the order, the
// ledger rows, the commission record, and the money math against the *live*
// platform settings.
//
//   npm run seed && npm run api        (one terminal)
//   npm run smoke:workflow             (another)
//
// Like `smoke-api.mjs`, this file is deliberately dependency-free and does not
// import the app: `src/services/` resolves the `@/` alias through Vite, which
// plain Node has no way to do. It therefore **mirrors** the sequences in
// `src/services/paymentService.js` and `src/services/orderService.js` using the
// same constants and the same money helpers (both are alias-free and imported
// below, so the rounding and the description strings are the real ones). If the
// service and this file ever disagree about a *sequence*, the service is right
// and this file is the one to fix.
//
// **This test writes real records** — payments, transactions, commissions,
// orders, notifications. It is destructive to the seeded dataset by design, so
// it never runs twice against the same seed: it prints a reseed instruction at
// the end, and `npm run seed` restores everything.
//
// Usage: node scripts/smoke-workflow.mjs [--base http://localhost:4000]

import {
  ORDER_STATUS,
  PAYMENT_STATUS,
  PROPOSAL_STATUS,
  REQUEST_STATUS,
  TRANSACTION_TYPE,
} from '../src/constants/statuses.js'
import {
  REFUND_CONTEXT,
  transactionDescription,
} from '../src/constants/transactionTemplates.js'
import { applyRate, round2, subtractMoney } from '../src/utils/money.js'

const args = process.argv.slice(2)
const baseIndex = args.indexOf('--base')
const BASE_URL = (baseIndex >= 0 ? args[baseIndex + 1] : null) ?? 'http://localhost:4000'

/** The dummy provider's cards, mirrored from `dummyPaymentProvider.js`. */
const CARD = {
  SUCCESS: { brand: 'visa', last4: '4242', number: '4242424242424242' },
  DECLINED: { brand: 'visa', last4: '0002', number: '4000000000000002' },
}

const CURRENCY = 'USD'

const results = []
let currentGroup = ''
const created = { orders: [], payments: [], transactions: [], commissions: [] }

const group = (name) => {
  currentGroup = name
  console.log(`\n${name}`)
}

function record(ok, label, detail) {
  results.push({ ok, group: currentGroup, label, detail })
  console.log(`${ok ? '  ✔' : '  ✖'} ${label}${detail ? ` — ${detail}` : ''}`)
}

/** Asserts a condition, recording pass or fail rather than throwing. */
function check(label, condition, detail) {
  record(Boolean(condition), label, condition ? undefined : detail)
  return Boolean(condition)
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * One request, with a single retry on a dropped socket — `json-server --watch`
 * reloads whenever it rewrites `db.json`, closing keep-alive sockets mid-flight
 * (the same allowance `smoke-api.mjs` makes).
 */
async function request(path, init, attempt = 1) {
  let response
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...init,
    })
  } catch (error) {
    if (attempt < 3) {
      await sleep(400)
      return request(path, init, attempt + 1)
    }
    throw error
  }

  const text = await response.text()
  let body = null
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = text
  }
  return { status: response.status, headers: response.headers, body }
}

const get = async (path) => (await request(path)).body

async function post(collection, payload) {
  const { status, body } = await request(collection, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  if (status !== 201) throw new Error(`POST ${collection} answered ${status}`)
  return body
}

async function patch(path, body) {
  const response = await request(path, { method: 'PATCH', body: JSON.stringify(body) })
  if (response.status !== 200) throw new Error(`PATCH ${path} answered ${response.status}`)
  return response.body
}

/** Client-side id in the app's format (`utils/id.js`), tagged as smoke data. */
let idSequence = 0
function generateId(prefix) {
  idSequence += 1
  return `${prefix}_smoke${Date.now().toString(36)}${String(idSequence).padStart(2, '0')}`
}

const nowIso = () => new Date().toISOString()

/* -------------------------------------------------------------------------- */
/* The workflow, mirroring src/services                                       */
/* -------------------------------------------------------------------------- */

/** `paymentService.computeCommission` — settings default, category override wins. */
function commissionRate(settings, categoryId) {
  const override = categoryId ? settings?.commission?.categoryOverrides?.[categoryId] : undefined
  return Number(override ?? settings?.commission?.defaultRate ?? 0.2)
}

/** The dummy provider's outcome rules, by card digits. */
const cardSucceeds = (card) => !card.number.endsWith('0002') && !card.number.endsWith('9995')

/**
 * Ledger types that move a BetterBlue balance and therefore carry a
 * `balanceAfter` (contract §6.13) — a buyer's `charge` settles against a card
 * and carries `null`.
 */
const BALANCE_BEARING_TYPES = new Set([
  TRANSACTION_TYPE.RELEASE,
  TRANSACTION_TYPE.COMMISSION,
  TRANSACTION_TYPE.PAYOUT,
  TRANSACTION_TYPE.AFFILIATE_COMMISSION,
])

/** The newest balance on a member's ledger, as `writeTransaction` reads it. */
async function latestBalanceOf(userId) {
  const rows = await get(
    `/transactions?userId=${userId}&_sort=createdAt&_order=desc&_page=1&_limit=5`
  )
  const latest = (rows ?? []).find((row) => Number.isFinite(Number(row.balanceAfter)))
  return latest ? Number(latest.balanceAfter) : 0
}

async function writeTransaction({ type, userId, amount, orderId, paymentId, context }) {
  const signed = round2(amount)
  const balanceAfter = BALANCE_BEARING_TYPES.has(type)
    ? round2((await latestBalanceOf(userId)) + signed)
    : null

  const row = await post('/transactions', {
    id: generateId('txn'),
    type,
    ...(orderId ? { orderId } : {}),
    ...(paymentId ? { paymentId } : {}),
    userId,
    amount: signed,
    currency: CURRENCY,
    description: transactionDescription(type, context ?? {}),
    balanceAfter,
    createdAt: nowIso(),
  })
  created.transactions.push(row.id)
  return row
}

/** `paymentService.initiateOrderPayment` (contract §7 operation 2). */
async function initiateOrderPayment(order, card) {
  const payment = await post('/payments', {
    id: generateId('pay'),
    orderId: order.id,
    buyerId: order.buyerId,
    amount: round2(order.price),
    currency: CURRENCY,
    provider: 'dummy',
    method: { brand: card.brand, last4: card.last4 },
    status: PAYMENT_STATUS.INITIATED,
    providerRef: null,
    heldAt: null,
    releasedAt: null,
    refundedAt: null,
    createdAt: nowIso(),
  })
  created.payments.push(payment.id)

  await patch(`/payments/${payment.id}`, {
    status: PAYMENT_STATUS.PROCESSING,
    providerRef: `dummy_ch_${payment.id}`,
  })

  if (!cardSucceeds(card)) {
    return patch(`/payments/${payment.id}`, {
      status: PAYMENT_STATUS.FAILED,
      failureReason: 'The card was declined by the issuing bank. No funds were taken.',
    })
  }

  const heldAt = nowIso()
  const held = await patch(`/payments/${payment.id}`, { status: PAYMENT_STATUS.HELD, heldAt })

  await patch(`/orders/${order.id}`, { status: ORDER_STATUS.IN_PROGRESS, activatedAt: heldAt })

  await writeTransaction({
    type: TRANSACTION_TYPE.CHARGE,
    userId: order.buyerId,
    amount: -order.price,
    orderId: order.id,
    paymentId: payment.id,
    context: { title: order.title },
  })

  return held
}

/** The shared settlement half of release and partial refund. */
async function settleEscrow({ order, payment, baseAmount, rate }) {
  await writeTransaction({
    type: TRANSACTION_TYPE.RELEASE,
    userId: order.creatorId,
    amount: baseAmount,
    orderId: order.id,
    paymentId: payment.id,
    context: { title: order.title },
  })

  const commissionAmount = applyRate(baseAmount, rate)
  const commission = await post('/commissions', {
    id: generateId('com'),
    orderId: order.id,
    rate,
    baseAmount,
    amount: commissionAmount,
    currency: CURRENCY,
    createdAt: nowIso(),
  })
  created.commissions.push(commission.id)

  await writeTransaction({
    type: TRANSACTION_TYPE.COMMISSION,
    userId: order.creatorId,
    amount: -commissionAmount,
    orderId: order.id,
    paymentId: payment.id,
    context: { title: order.title, rate },
  })

  return { commission, creatorEarnings: subtractMoney(baseAmount, commissionAmount) }
}

/** `paymentService.releasePayment` (contract §7 operation 3). */
async function releasePayment(order, payment, rate) {
  const baseAmount = subtractMoney(payment.amount, payment.refundedAmount ?? 0)
  const released = await patch(`/payments/${payment.id}`, {
    status: PAYMENT_STATUS.RELEASED,
    releasedAt: nowIso(),
  })
  const settlement = await settleEscrow({ order, payment, baseAmount, rate })
  return { payment: released, ...settlement, baseAmount }
}

/** `paymentService.refundPayment` (contract §7 operation 4). */
async function refundPayment(order, payment, { amount, rate }) {
  const requested = round2(amount ?? payment.amount)
  const isFull = requested >= payment.amount
  const refundedAt = nowIso()

  const refunded = await patch(`/payments/${payment.id}`, {
    status: isFull ? PAYMENT_STATUS.REFUNDED : PAYMENT_STATUS.PARTIALLY_REFUNDED,
    refundedAt,
    refundedAmount: requested,
    ...(isFull ? {} : { releasedAt: refundedAt }),
  })

  await writeTransaction({
    type: isFull ? TRANSACTION_TYPE.REFUND : TRANSACTION_TYPE.PARTIAL_REFUND,
    userId: order.buyerId,
    amount: requested,
    orderId: order.id,
    paymentId: payment.id,
    context: { title: order.title, context: REFUND_CONTEXT.DISPUTE },
  })

  let settlement = null
  if (!isFull) {
    settlement = await settleEscrow({
      order,
      payment,
      baseAmount: subtractMoney(payment.amount, requested),
      rate,
    })
  }

  return { payment: refunded, settlement }
}

/** `orderService.acceptProposal` (contract §7 operation 1), trimmed to what the test needs. */
async function acceptProposal(proposal, contentRequest, rate) {
  const respondedAt = nowIso()
  await patch(`/proposals/${proposal.id}`, {
    status: PROPOSAL_STATUS.ACCEPTED,
    respondedAt,
  })

  const commissionAmount = applyRate(proposal.price, rate)
  const order = await post('/orders', {
    id: generateId('ord'),
    requestId: contentRequest.id,
    proposalId: proposal.id,
    buyerId: contentRequest.buyerId,
    creatorId: proposal.creatorId,
    title: contentRequest.title,
    categoryId: contentRequest.categoryId,
    contentType: contentRequest.contentType,
    price: proposal.price,
    currency: CURRENCY,
    commissionRate: rate,
    commissionAmount,
    creatorEarnings: subtractMoney(proposal.price, commissionAmount),
    revisionsIncluded: proposal.revisionsIncluded ?? 0,
    revisionsUsed: 0,
    deliveryDays: proposal.deliveryDays ?? null,
    deliveryDueAt: null,
    status: ORDER_STATUS.PENDING_PAYMENT,
    activatedAt: null,
    deliveredAt: null,
    completedAt: null,
    cancelledAt: null,
    createdAt: respondedAt,
  })
  created.orders.push(order.id)

  await patch(`/contentRequests/${contentRequest.id}`, {
    status: REQUEST_STATUS.AWARDED,
    awardedProposalId: proposal.id,
  })

  return order
}

/* -------------------------------------------------------------------------- */
/* Scenario setup                                                             */
/* -------------------------------------------------------------------------- */

/** An order sitting at `pending_payment`, from the seeds or freshly awarded. */
async function findOrCreatePendingOrder(settings) {
  const seeded = await get(`/orders?status=${ORDER_STATUS.PENDING_PAYMENT}&_page=1&_limit=1`)
  if (Array.isArray(seeded) && seeded.length > 0) {
    const order = seeded[0]
    const existing = await get(`/payments?orderId=${order.id}&_page=1&_limit=20`)
    const funded = (existing ?? []).some((payment) =>
      [
        PAYMENT_STATUS.HELD,
        PAYMENT_STATUS.RELEASED,
        PAYMENT_STATUS.REFUNDED,
        PAYMENT_STATUS.PARTIALLY_REFUNDED,
      ].includes(payment.status)
    )
    if (!funded) return { order, source: 'seeded' }
  }

  // No unfunded order left (a second run in the same seed) — award one, exactly
  // as `orderService.acceptProposal` does.
  const openRequests = await get(`/contentRequests?status=${REQUEST_STATUS.OPEN}&_page=1&_limit=20`)
  for (const contentRequest of openRequests ?? []) {
    // eslint-disable-next-line no-await-in-loop -- one brief at a time until a proposal turns up.
    const proposals = await get(
      `/proposals?requestId=${contentRequest.id}&status=${PROPOSAL_STATUS.SUBMITTED}&_page=1&_limit=1`
    )
    if (proposals?.length) {
      const rate = commissionRate(settings, contentRequest.categoryId)
      // eslint-disable-next-line no-await-in-loop -- as above.
      const order = await acceptProposal(proposals[0], contentRequest, rate)
      return { order, source: 'acceptProposal' }
    }
  }

  return { order: null, source: 'none' }
}

/** A seeded order whose escrow is held, excluding ones this run already used. */
async function findHeldOrder(usedOrderIds) {
  const held = await get(`/payments?status=${PAYMENT_STATUS.HELD}&_page=1&_limit=50`)
  for (const payment of held ?? []) {
    if (usedOrderIds.has(payment.orderId)) continue
    // eslint-disable-next-line no-await-in-loop -- one candidate at a time.
    const order = await get(`/orders/${payment.orderId}`)
    if (order?.id) return { order, payment }
  }
  return null
}

/* -------------------------------------------------------------------------- */
/* Checks                                                                     */
/* -------------------------------------------------------------------------- */

async function checkReachable() {
  group('Reachability')
  try {
    const { status } = await request('/platformSettings')
    return check(`API answers at ${BASE_URL}`, status === 200, `status ${status}`)
  } catch (error) {
    record(false, `API answers at ${BASE_URL}`, error.message)
    console.error(
      `\n  The mock API is not reachable. Start it with:\n\n    npm run api\n\n` +
        `  (or pass --base <url> if it runs somewhere else)\n`
    )
    return false
  }
}

/** 1 — fund an order with a good card, then release it. */
async function checkSuccessAndRelease(settings, usedOrderIds) {
  group('Fund an order (successful card)')

  const { order, source } = await findOrCreatePendingOrder(settings)
  if (!check('a pending_payment order is available', Boolean(order), 'run `npm run seed` first')) {
    return
  }
  usedOrderIds.add(order.id)
  record(true, `using ${order.id} (${source})`, `${order.title}`)

  const payment = await initiateOrderPayment(order, CARD.SUCCESS)
  check('payment reaches held', payment.status === PAYMENT_STATUS.HELD, `got ${payment.status}`)
  check('heldAt is stamped', Boolean(payment.heldAt), 'heldAt is null')
  check(
    'the escrow equals the order price',
    payment.amount === round2(order.price),
    `payment ${payment.amount} vs order ${order.price}`
  )

  const funded = await get(`/orders/${order.id}`)
  check(
    'the order moves to in_progress',
    funded.status === ORDER_STATUS.IN_PROGRESS,
    `got ${funded.status}`
  )
  check('activatedAt is stamped', Boolean(funded.activatedAt), 'activatedAt is null')

  const ledger = await get(`/transactions?orderId=${order.id}&_page=1&_limit=20`)
  const charge = (ledger ?? []).find((row) => row.type === TRANSACTION_TYPE.CHARGE)
  check('a charge row was written', Boolean(charge), 'no charge transaction')
  check(
    'the charge is negative for the buyer',
    charge?.userId === order.buyerId && charge?.amount === round2(-order.price),
    `got ${charge?.amount} for ${charge?.userId}`
  )
  check(
    'the charge description comes from the template map',
    charge?.description === transactionDescription(TRANSACTION_TYPE.CHARGE, { title: order.title }),
    charge?.description
  )

  /* --- release ---------------------------------------------------------- */

  group('Release the escrow')

  const rate = Number(funded.commissionRate ?? commissionRate(settings, funded.categoryId))
  const release = await releasePayment(funded, payment, rate)

  check(
    'the payment is released',
    release.payment.status === PAYMENT_STATUS.RELEASED,
    `got ${release.payment.status}`
  )

  const settled = await get(`/transactions?orderId=${order.id}&_page=1&_limit=20`)
  const releaseRow = (settled ?? []).find((row) => row.type === TRANSACTION_TYPE.RELEASE)
  const commissionRow = (settled ?? []).find((row) => row.type === TRANSACTION_TYPE.COMMISSION)

  check(
    'a release row credits the creator with the settled base',
    releaseRow?.userId === funded.creatorId && releaseRow?.amount === round2(funded.price),
    `got ${releaseRow?.amount} for ${releaseRow?.userId}`
  )
  check(
    'a commission row debits the fee from the creator',
    commissionRow?.userId === funded.creatorId &&
      commissionRow?.amount === round2(-applyRate(funded.price, rate)),
    `got ${commissionRow?.amount}, expected ${round2(-applyRate(funded.price, rate))}`
  )

  const commissions = await get(`/commissions?orderId=${order.id}&_page=1&_limit=5`)
  const commission = (commissions ?? [])[0]
  check('exactly one commission record exists', commissions?.length === 1, `found ${commissions?.length}`)
  check(
    `the fee matches the live settings rate (${rate})`,
    commission?.rate === rate && commission?.amount === applyRate(funded.price, rate),
    `record says rate ${commission?.rate}, amount ${commission?.amount}`
  )
  check(
    'baseAmount is what actually settled',
    commission?.baseAmount === round2(funded.price),
    `got ${commission?.baseAmount}`
  )
  check(
    'release − commission equals the order’s creatorEarnings',
    subtractMoney(releaseRow?.amount ?? 0, commission?.amount ?? 0) ===
      round2(funded.creatorEarnings),
    `ledger nets ${subtractMoney(releaseRow?.amount ?? 0, commission?.amount ?? 0)} vs ` +
      `order ${funded.creatorEarnings}`
  )
  check(
    'the ledger holds exactly three rows for the order',
    settled?.length === 3,
    `found ${settled?.length} (charge, release, commission expected)`
  )
  check(
    'balanceAfter is carried on the creator’s rows and null on the buyer’s charge',
    Number.isFinite(Number(releaseRow?.balanceAfter)) &&
      Number.isFinite(Number(commissionRow?.balanceAfter)) &&
      charge?.balanceAfter === null,
    `release ${releaseRow?.balanceAfter}, commission ${commissionRow?.balanceAfter}, ` +
      `charge ${charge?.balanceAfter}`
  )
  check(
    'the commission row lands one fee below the release row',
    subtractMoney(releaseRow?.balanceAfter ?? 0, commissionRow?.balanceAfter ?? 0) ===
      applyRate(funded.price, rate),
    `${releaseRow?.balanceAfter} → ${commissionRow?.balanceAfter}`
  )
}

/** 2 — a declined card leaves the order alone. */
async function checkDecline(settings, usedOrderIds) {
  group('Declined card')

  const { order, source } = await findOrCreatePendingOrder(settings)
  if (!check('a second pending_payment order is available', Boolean(order), 'no open brief with a proposal left to award')) {
    return
  }
  usedOrderIds.add(order.id)
  record(true, `using ${order.id} (${source})`, `${order.title}`)

  const payment = await initiateOrderPayment(order, CARD.DECLINED)
  check('the payment fails', payment.status === PAYMENT_STATUS.FAILED, `got ${payment.status}`)
  check('a failure reason is stored', Boolean(payment.failureReason), 'failureReason is empty')
  check('nothing was held', payment.heldAt === null, `heldAt is ${payment.heldAt}`)

  const untouched = await get(`/orders/${order.id}`)
  check(
    'the order is still pending_payment',
    untouched.status === ORDER_STATUS.PENDING_PAYMENT,
    `got ${untouched.status}`
  )

  const ledger = await get(`/transactions?orderId=${order.id}&_page=1&_limit=20`)
  check('no ledger row was written', (ledger ?? []).length === 0, `found ${ledger?.length} rows`)
}

/** 3 — a partial refund on another held order settles the remainder. */
async function checkRefund(settings, usedOrderIds) {
  group('Partial refund on a held order')

  const candidate = await findHeldOrder(usedOrderIds)
  if (!check('a held order is available', Boolean(candidate), 'run `npm run seed` first')) return

  const { order, payment } = candidate
  usedOrderIds.add(order.id)
  record(true, `using ${order.id}`, `${order.title} — ${payment.amount} held`)

  const rate = Number(order.commissionRate ?? commissionRate(settings, order.categoryId))
  const refundAmount = round2(payment.amount / 4)
  const retained = subtractMoney(payment.amount, refundAmount)

  const { payment: refunded, settlement } = await refundPayment(order, payment, {
    amount: refundAmount,
    rate,
  })

  check(
    'the payment is partially_refunded',
    refunded.status === PAYMENT_STATUS.PARTIALLY_REFUNDED,
    `got ${refunded.status}`
  )
  check(
    'refundedAmount is stored',
    refunded.refundedAmount === refundAmount,
    `got ${refunded.refundedAmount}`
  )
  check(
    'the payment carries both refundedAt and releasedAt',
    Boolean(refunded.refundedAt) && Boolean(refunded.releasedAt),
    `refundedAt ${refunded.refundedAt}, releasedAt ${refunded.releasedAt}`
  )

  const ledger = await get(`/transactions?orderId=${order.id}&_page=1&_limit=20`)
  const partial = (ledger ?? []).find((row) => row.type === TRANSACTION_TYPE.PARTIAL_REFUND)
  const releaseRow = (ledger ?? []).find((row) => row.type === TRANSACTION_TYPE.RELEASE)

  check(
    'a partial_refund row credits the buyer',
    partial?.userId === order.buyerId && partial?.amount === refundAmount,
    `got ${partial?.amount} for ${partial?.userId}`
  )
  check(
    'the release covers only the retained amount',
    releaseRow?.amount === retained,
    `got ${releaseRow?.amount}, expected ${retained}`
  )

  const commissions = await get(`/commissions?orderId=${order.id}&_page=1&_limit=5`)
  const commission = (commissions ?? [])[0]
  check(
    'commission is charged on the creator-kept portion only',
    commission?.baseAmount === retained && commission?.amount === applyRate(retained, rate),
    `record says base ${commission?.baseAmount}, amount ${commission?.amount}, ` +
      `expected ${retained} / ${applyRate(retained, rate)}`
  )
  check(
    'the creator nets the retained amount less that fee',
    settlement?.creatorEarnings === subtractMoney(retained, applyRate(retained, rate)),
    `got ${settlement?.creatorEarnings}`
  )
}

/* -------------------------------------------------------------------------- */
/* Run                                                                        */
/* -------------------------------------------------------------------------- */

console.log(`BetterBlue workflow smoke test — ${BASE_URL}`)

const reachable = await checkReachable()

if (reachable) {
  const settings = await get('/platformSettings')
  const usedOrderIds = new Set()

  try {
    await checkSuccessAndRelease(settings, usedOrderIds)
    await checkDecline(settings, usedOrderIds)
    await checkRefund(settings, usedOrderIds)
  } catch (error) {
    record(false, 'the run completed', error.message)
  }

  group('Cleanup')
  console.log(
    `  This run wrote ${created.orders.length} order(s), ${created.payments.length} payment(s), ` +
      `${created.transactions.length} ledger row(s) and ${created.commissions.length} commission(s), ` +
      `and moved seeded records.\n` +
      `  Nothing is rolled back — restore the dataset with:\n\n    npm run seed\n`
  )
}

const failed = results.filter((result) => !result.ok)

console.log(`${'-'.repeat(60)}`)
if (failed.length === 0) {
  console.log(`✔ ${results.length} checks passed. Run \`npm run seed\` before the next run.\n`)
  process.exit(0)
}

console.log(`✖ ${failed.length} of ${results.length} checks failed:\n`)
failed.forEach((failure, index) => {
  console.log(
    `  ${String(index + 1).padStart(3, ' ')}. [${failure.group}] ${failure.label}` +
      `${failure.detail ? `\n       ${failure.detail}` : ''}`
  )
})
console.log('\n  Run `npm run seed` to restore the dataset before investigating.\n')
process.exit(1)
