#!/usr/bin/env node
// BetterBlue API smoke test — `npm run smoke:api` (Prompt 07).
//
// Exercises the mock API the way `src/services/` does, so a broken JSON Server,
// a stale `db.json`, or a regression in the REST behaviour the list adapter
// depends on is caught in one command instead of on a blank page.
//
// It is deliberately dependency-free and does **not** import the app: plain
// Node 18 `fetch` against the running server, using the same query spellings
// `services/api/listAdapter.js` builds. If the two ever disagree, this file is
// the one that is wrong.
//
// Requires `npm run api` in another terminal. Reads are non-destructive; the
// single write round-trip creates a clearly-marked scratch record and removes
// it again, leaving the seeded data untouched — the run ends by checking
// `server/db.json` itself, not just the server's memory.
//
// One cosmetic residue is unavoidable: any write makes JSON Server rewrite
// `db.json`, and it does not end the file with a newline while `npm run seed`
// does. The records are identical; `npm run seed` restores the byte.
//
// Usage: node scripts/smoke-api.mjs [--base http://localhost:4000]

const args = process.argv.slice(2)
const baseIndex = args.indexOf('--base')
const BASE_URL = (baseIndex >= 0 ? args[baseIndex + 1] : null) ?? 'http://localhost:4000'

/** Scratch record id — namespaced so it is obvious in `db.json` if left behind. */
const SCRATCH_ID = 'tkt_smoke_scratch'
const SCRATCH_PATH = '/supportTickets'

const results = []
let currentGroup = ''

const group = (name) => {
  currentGroup = name
  console.log(`\n${name}`)
}

function record(ok, label, detail) {
  results.push({ ok, group: currentGroup, label, detail })
  const mark = ok ? '  ✔' : '  ✖'
  console.log(`${mark} ${label}${detail ? ` — ${detail}` : ''}`)
}

/** Asserts a condition, recording pass or fail rather than throwing. */
function check(label, condition, detail) {
  record(Boolean(condition), label, condition ? undefined : detail)
  return Boolean(condition)
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * One request, with a single retry on a dropped socket.
 *
 * `json-server --watch` reloads whenever `db.json` changes — including when it
 * wrote the file itself — and the reload closes keep-alive sockets mid-flight.
 * That is a property of the dev server, not a failure of the API, so a
 * transport error is retried once. An HTTP error status is never retried.
 */
async function request(path, init, attempt = 1) {
  let response
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...init,
    })
  } catch (error) {
    if (attempt < 2) {
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

/** Best-effort scratch cleanup — never reports, never throws. */
async function removeScratch() {
  try {
    await request(`${SCRATCH_PATH}/${SCRATCH_ID}`, { method: 'DELETE' })

    // MOCK-DELETE: the cascade bug (contract §1.7) throws *before* lowdb
    // persists, so the row is gone from memory but still sitting in db.json —
    // a restart would resurrect it. Any subsequent write flushes the whole
    // (correct) state to disk, so a no-op PATCH on a seeded row is what
    // actually leaves the file as we found it.
    const seeded = await request(`${SCRATCH_PATH}/tkt_001`)
    if (seeded.status === 200) {
      await request(`${SCRATCH_PATH}/tkt_001`, {
        method: 'PATCH',
        body: JSON.stringify({ status: seeded.body.status }),
      })
    }
  } catch {
    // The DELETE answers 500 by design and the record may not exist at all;
    // either way there is nothing more to do here.
  }
}

/* --- 1. Reachability ------------------------------------------------------ */

async function checkReachable() {
  group('Reachability')
  try {
    const { status } = await request('/categories?_page=1&_limit=1')
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

/* --- 2. Lists: filter, sort, paginate ------------------------------------- */

// One row per collection the app lists, each with a filter that must match
// something in the seeded data. `expectMin` guards against a query that
// "passes" by returning nothing at all.
const LIST_CASES = [
  {
    label: 'creatorProfiles — availability + array membership + range',
    path: '/creatorProfiles',
    query: 'availability=true&categories_like=cat_food_beverage&startingPrice_gte=100&_sort=ratingAvg&_order=desc',
    expectMin: 1,
    assert: (items) =>
      items.every((item) => item.availability === true) ||
      'a returned profile is not available',
  },
  {
    label: 'contentRequests — status filter + search',
    path: '/contentRequests',
    query: 'status=open&_sort=publishedAt&_order=desc',
    expectMin: 1,
    assert: (items) =>
      items.every((item) => item.status === 'open') || 'a returned brief is not open',
  },
  {
    label: 'orders — repeated status params (OR)',
    path: '/orders',
    query: 'status=in_progress&status=delivered&_sort=createdAt&_order=desc',
    expectMin: 1,
    assert: (items) =>
      items.every((item) => ['in_progress', 'delivered'].includes(item.status)) ||
      'a returned order is outside the requested statuses',
  },
  {
    label: 'proposals — foreign-key filter',
    path: '/proposals',
    query: 'requestId=req_001&_sort=createdAt&_order=desc',
    expectMin: 1,
    assert: (items) =>
      items.every((item) => item.requestId === 'req_001') ||
      'a returned proposal belongs to another brief',
  },
  {
    label: 'notifications — boolean filter',
    path: '/notifications',
    query: 'read=false&_sort=createdAt&_order=desc',
    expectMin: 1,
    assert: (items) =>
      items.every((item) => item.read === false) || 'a returned notification is already read',
  },
  {
    label: 'portfolioItems — status filter + tag membership',
    path: '/portfolioItems',
    query: 'status=published&_sort=publishedAt&_order=desc',
    expectMin: 1,
    assert: (items) =>
      items.every((item) => item.status === 'published') ||
      'a returned portfolio item is not published',
  },
]

async function checkLists() {
  group('Lists (filter · sort · pagination · X-Total-Count)')

  for (const testCase of LIST_CASES) {
    const limit = 3
    const url = `${testCase.path}?${testCase.query}&_page=1&_limit=${limit}`
    // eslint-disable-next-line no-await-in-loop -- sequential keeps the output readable.
    const { status, headers, body } = await request(url)

    if (!check(`${testCase.label}: 200`, status === 200, `status ${status}`)) continue
    if (!check(`${testCase.label}: array body`, Array.isArray(body), typeof body)) continue

    const total = headers.get('X-Total-Count')
    check(
      `${testCase.label}: X-Total-Count present`,
      total !== null && Number.isFinite(Number(total)),
      // The header is the only source of `total` for the whole app — every
      // paginator breaks silently without it (contract §4.3).
      'header missing — the list adapter cannot compute `total`'
    )
    check(
      `${testCase.label}: matches seeded data`,
      Number(total) >= testCase.expectMin,
      `expected at least ${testCase.expectMin}, got ${total}`
    )
    check(
      `${testCase.label}: honours _limit`,
      body.length <= limit,
      `asked for ${limit}, got ${body.length}`
    )

    const assertion = testCase.assert(body)
    check(`${testCase.label}: filter applied`, assertion === true, assertion)
  }
}

async function checkPagination() {
  group('Pagination')

  const first = await request('/proposals?_page=1&_limit=5&_sort=id&_order=asc')
  const second = await request('/proposals?_page=2&_limit=5&_sort=id&_order=asc')

  const total = Number(first.headers.get('X-Total-Count'))
  check('page 1 returns a full page', first.body?.length === 5, `got ${first.body?.length}`)
  check('page 2 returns a full page', second.body?.length === 5, `got ${second.body?.length}`)
  check(
    'pages do not overlap',
    first.body?.[0]?.id !== second.body?.[0]?.id,
    `both pages start at ${first.body?.[0]?.id}`
  )
  check('total exceeds one page', total > 5, `total ${total}`)

  // Without `_page`/`_limit` the header disappears — the reason the adapter
  // always sends both (contract §4.3, finding 1).
  const bare = await request('/categories')
  check(
    'X-Total-Count is absent without _page/_limit',
    bare.headers.get('X-Total-Count') === null,
    'header appeared — the adapter note in listAdapter.js is now out of date'
  )
}

/* --- 3. Item reads and 404 ------------------------------------------------ */

async function checkItemReads() {
  group('Item reads')

  const order = await request('/orders/ord_002')
  check('GET /orders/ord_002 → 200', order.status === 200, `status ${order.status}`)
  check(
    'order carries its money fields',
    typeof order.body?.price === 'number' && typeof order.body?.commissionRate === 'number',
    'price or commissionRate missing'
  )

  const missing = await request('/orders/ord_does_not_exist')
  check('unknown id → 404', missing.status === 404, `status ${missing.status}`)
}

/* --- 4. Settings singleton ------------------------------------------------ */

async function checkSettings() {
  group('Settings singleton')

  const { status, body } = await request('/platformSettings')
  if (!check('GET /platformSettings → 200', status === 200, `status ${status}`)) return

  check('not a collection', !Array.isArray(body), 'returned an array')
  check(
    'commission.defaultRate is a rate',
    typeof body?.commission?.defaultRate === 'number' &&
      body.commission.defaultRate > 0 &&
      body.commission.defaultRate < 1,
    `got ${body?.commission?.defaultRate}`
  )
  check(
    'general.payoutMinAmount is set',
    typeof body?.general?.payoutMinAmount === 'number',
    `got ${body?.general?.payoutMinAmount}`
  )
  check('features flags are present', typeof body?.features === 'object' && body.features !== null)
}

/* --- 5. Write round-trip on a scratch record ------------------------------ */

async function checkWriteRoundTrip() {
  group('Write round-trip (scratch record)')

  // Clear anything a previous interrupted run left behind.
  await removeScratch()

  const created = await request(SCRATCH_PATH, {
    method: 'POST',
    body: JSON.stringify({
      id: SCRATCH_ID,
      name: 'Smoke Test',
      email: 'smoke@betterblue.test',
      subject: 'Automated smoke test — safe to delete',
      body: 'Created by npm run smoke:api and removed again in the same run.',
      status: 'open',
      replies: [],
      createdAt: new Date().toISOString(),
    }),
  })

  check('POST creates the record', created.status === 201, `status ${created.status}`)
  check(
    'the client-generated id is kept',
    created.body?.id === SCRATCH_ID,
    // If JSON Server ever stopped honouring a supplied id, every create in the
    // app would silently get a prefix-less one (contract §1.4).
    `got ${created.body?.id}`
  )

  const patched = await request(`${SCRATCH_PATH}/${SCRATCH_ID}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'resolved' }),
  })
  check('PATCH updates the record', patched.status === 200, `status ${patched.status}`)
  check('PATCH is partial', patched.body?.status === 'resolved' && patched.body?.name === 'Smoke Test',
    'a field outside the patch was lost')

  const found = await request(`${SCRATCH_PATH}?id=${SCRATCH_ID}`)
  check('the record is listable', found.body?.length === 1, `found ${found.body?.length ?? 0}`)

  // MOCK-DELETE: JSON Server's cascade pass walks `platformSettings`, which has
  // no ids, and throws — so a *successful* delete still answers 500 (contract
  // §1.7). What matters is that the record is gone.
  const removed = await request(`${SCRATCH_PATH}/${SCRATCH_ID}`, { method: 'DELETE' })
  const gone = await request(`${SCRATCH_PATH}/${SCRATCH_ID}`)
  check(
    'DELETE removes the scratch record',
    gone.status === 404,
    `still present after DELETE (status ${removed.status})`
  )

  const tickets = await request(`${SCRATCH_PATH}?_page=1&_limit=100`)
  check(
    'seeded tickets are intact',
    Array.isArray(tickets.body) && tickets.body.every((ticket) => ticket.id !== SCRATCH_ID),
    'the scratch record survived — run `npm run seed` to restore db.json'
  )
}

/* --- 6. The seed file on disk --------------------------------------------- */

async function checkSeedFileClean() {
  group('Seed file')

  // The API can report a clean state while `db.json` still holds the scratch
  // row (see `removeScratch`), and a restart would bring it back — so the file
  // itself is checked, not just the server's memory. Skipped when the API is
  // not the local one this repo generates.
  const { readFile } = await import('node:fs/promises')
  const { fileURLToPath } = await import('node:url')
  const { dirname, resolve } = await import('node:path')
  const dbPath = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'server', 'db.json')

  // lowdb persists *after* answering: the flushing PATCH in `removeScratch`
  // returns roughly 60ms before the bytes land, so reading once here catches
  // the pre-flush file and fails a run that actually cleaned up. Re-read until
  // the write shows up, and only then judge the contents.
  let db
  const deadline = Date.now() + 3000
  for (;;) {
    try {
      db = JSON.parse(await readFile(dbPath, 'utf8'))
    } catch {
      // Also covers reading mid-write, when the file is not yet valid JSON.
      db = null
    }
    if (db && !JSON.stringify(db).includes(SCRATCH_ID)) break
    if (Date.now() >= deadline) break
    await sleep(100)
  }

  if (!db) {
    console.log('  · server/db.json not readable from here — skipped')
    return
  }

  check(
    'server/db.json holds no scratch record',
    !JSON.stringify(db).includes(SCRATCH_ID),
    'run `npm run seed` to restore it'
  )
  // Bumped to 27 by Storefront V2-03, which added `feedReplies`. The number is
  // a tripwire for a truncated or half-written file, so it moves whenever a
  // collection is legitimately added — and only then.
  check(
    'server/db.json still has all 27 collections',
    Object.keys(db).length === 27,
    `found ${Object.keys(db).length}`
  )
}

/* --- Run ------------------------------------------------------------------ */

console.log(`BetterBlue API smoke test — ${BASE_URL}`)

const reachable = await checkReachable()

if (reachable) {
  try {
    await checkLists()
    await checkPagination()
    await checkItemReads()
    await checkSettings()
    await checkWriteRoundTrip()
  } catch (error) {
    record(false, 'the run completed', error.message)
  } finally {
    // Whatever happened above, the seeds must be left exactly as they were.
    await removeScratch()
  }
  await checkSeedFileClean()
}

const failed = results.filter((result) => !result.ok)

console.log(`\n${'-'.repeat(60)}`)
if (failed.length === 0) {
  console.log(`✔ ${results.length} checks passed.\n`)
  process.exit(0)
}

console.log(`✖ ${failed.length} of ${results.length} checks failed:\n`)
failed.forEach((failure, index) => {
  console.log(
    `  ${String(index + 1).padStart(3, ' ')}. [${failure.group}] ${failure.label}` +
      `${failure.detail ? `\n       ${failure.detail}` : ''}`
  )
})
console.log('')
process.exit(1)
