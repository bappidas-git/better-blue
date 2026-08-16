// Seed: `orders`, `deliveries`, `revisions` — the funded engagements
// (Prompt 05 §4.3).
//
// The fourteen scenario orders cover **every** ORDER_STATUS: one waiting on
// payment, two in progress, two delivered and awaiting review, two with
// changes requested, three completed (one of them after a partial refund, one
// after a dispute closed in the creator's favour), one cancelled before it was
// funded, two disputed, and one refunded in full.
//
// Every order's clock starts from the accepted proposal's `respondedAt`, so
// nothing here can predate the offer that created it. Money follows 00 §9:
//   commissionAmount = round(price × commissionRate, 2)
//   creatorEarnings  = price − commissionAmount
// `finance.js` builds the payment, commission, and transaction chain on top of
// these numbers, and `seed-db.js` re-derives all of it during validation.

import {
  DELIVERY_STATUS,
  ORDER_STATUS,
  CONTENT_TYPE,
} from '../../src/constants/statuses.js'
import { imageUrl, IMAGE_SIZES } from '../../src/constants/images.js'
import {
  CURRENCY,
  MEDIA_TYPE,
  addDays,
  addHours,
  daysAgo,
  pick,
  round2,
  seqId,
} from '../seed-utils.js'
import { buyerId, creatorId } from './users.js'
import { HISTORY_ENGAGEMENTS, requestByKey } from './requests.js'
import { acceptedProposalFor } from './proposals.js'
import { commissionRateFor } from './settings.js'

/* -------------------------------------------------------------------------- */
/* Scenario orders                                                            */
/* -------------------------------------------------------------------------- */

/**
 * One entry per scenario order, keyed by the request it came from. Timings are
 * expressed in days before the seed anchor so the whole story stays readable.
 */
const SCENARIO_ORDERS = [
  {
    requestKey: 'awarded_nimbus_app',
    buyer: 'nimbus',
    creator: 'liam',
    status: ORDER_STATUS.PENDING_PAYMENT,
    fundedAfterHours: null,
    deliveries: [],
  },
  {
    requestKey: 'awarded_cocoa_gift',
    buyer: 'cocoa',
    creator: 'ava',
    status: ORDER_STATUS.IN_PROGRESS,
    fundedAfterHours: 5,
    deliveries: [],
  },
  {
    requestKey: 'awarded_nimbus_equipment',
    buyer: 'nimbus',
    creator: 'diego',
    status: ORDER_STATUS.IN_PROGRESS,
    fundedAfterHours: 3,
    deliveries: [],
  },
  {
    requestKey: 'awarded_bloom_texture',
    buyer: 'bloom',
    creator: 'zoe',
    status: ORDER_STATUS.DELIVERED,
    fundedAfterHours: 2,
    deliveries: [
      {
        submittedDaysAgo: 4,
        status: DELIVERY_STATUS.SUBMITTED,
        fileCount: 3,
        message:
          'All eight shades delivered: swatches on four skin tones, one macro frame per shade, and the colour chart reference from the shoot. Shot to neutral white balance with no warming applied, so the shade values should drop straight into your product pages.',
      },
    ],
  },
  {
    // Prompt 34 §9: the **convertible referral** order. `delivered` and waiting
    // on the buyer, and the only order this buyer has — so accepting it is the
    // referred account's first completed order, which is exactly what
    // `affiliateService.processConversion` converts on. Sign in as
    // priya.raman@fernwoodbakery.test, accept, and the whole affiliate pipeline
    // runs for real.
    requestKey: 'awarded_fernwood_pastry',
    buyer: 'fernwood',
    creator: 'yuki',
    status: ORDER_STATUS.DELIVERED,
    fundedAfterHours: 3,
    deliveries: [
      {
        submittedDaysAgo: 1,
        status: DELIVERY_STATUS.SUBMITTED,
        fileCount: 3,
        message:
          'All twelve items delivered, overhead and 45 degrees on each, plus three wider counter frames I shot while the light held. Square crops are safe for the delivery listings and there is headroom on the menu-board versions.',
      },
    ],
  },
  {
    requestKey: 'awarded_atlas_hotel',
    buyer: 'atlas',
    creator: 'isla',
    status: ORDER_STATUS.DELIVERED,
    fundedAfterHours: 6,
    deliveries: [
      {
        submittedDaysAgo: 2,
        status: DELIVERY_STATUS.SUBMITTED,
        fileCount: 4,
        message:
          'Three properties complete — every room category, exteriors, pools, and breakfast service. Rooms were photographed as found, with no digital tidying. Apologies for the two-day overrun: the third property moved my access window because of a late checkout.',
      },
    ],
  },
  {
    // Prompt 20: the delivered order the demo buyer reviews. A bundle brief, so
    // `buildFiles` mixes a film with a still — the two tile treatments the
    // deliverables grid has to get right.
    requestKey: 'awarded_verde_supper',
    buyer: 'verde',
    creator: 'amara',
    status: ORDER_STATUS.DELIVERED,
    fundedAfterHours: 4,
    deliveries: [
      {
        submittedDaysAgo: 1,
        status: DELIVERY_STATUS.SUBMITTED,
        fileCount: 2,
        message:
          'The supper club film and the first still from the same evening. Shot entirely on available candlelight as agreed — nothing was added to the floor. Releases are signed for both guests who appear in the film.',
      },
    ],
  },
  {
    // Prompt 20: the demo buyer's unpaid order (§9).
    requestKey: 'awarded_verde_market',
    buyer: 'verde',
    creator: 'ava',
    status: ORDER_STATUS.PENDING_PAYMENT,
    fundedAfterHours: null,
    deliveries: [],
  },
  {
    requestKey: 'awarded_verde_reel',
    buyer: 'verde',
    creator: 'ava',
    status: ORDER_STATUS.REVISION_REQUESTED,
    fundedAfterHours: 4,
    deliveries: [
      {
        submittedDaysAgo: 13,
        status: DELIVERY_STATUS.REVISION_REQUESTED,
        respondedDaysAgo: 11,
        fileCount: 3,
        message:
          'Three reels attached: prep, plating, and the dining room scene. Cut to kitchen sound as agreed, dish names captioned, all under 25 seconds.',
      },
    ],
    revisions: [
      {
        deliveryIndex: 0,
        createdDaysAgo: 11,
        notes:
          'These look great overall. Two changes before we publish: the plating reel runs 27 seconds, so it needs a trim to under 25, and the dish caption on the dining room reel reads "Autumn Squash" — it should be "Roast Squash & Sage" to match the printed menu.',
      },
    ],
  },
  {
    requestKey: 'awarded_urbannest_shelf',
    buyer: 'urbannest',
    creator: 'yuki',
    status: ORDER_STATUS.REVISION_REQUESTED,
    fundedAfterHours: 5,
    deliveries: [
      {
        submittedDaysAgo: 9,
        status: DELIVERY_STATUS.REVISION_REQUESTED,
        respondedDaysAgo: 7,
        fileCount: 4,
        message:
          'Four finishes, styled and unstyled, plus detail frames for each joint type. Camera height and colour temperature fixed across the whole set as discussed.',
      },
    ],
    revisions: [
      {
        deliveryIndex: 0,
        createdDaysAgo: 7,
        notes:
          'The walnut and oak sets are perfect. The white finish reads slightly warm against the others — could you re-grade those six frames to match the neutral reference? Everything else is approved.',
      },
    ],
  },
  {
    requestKey: 'awarded_pulse_explainer',
    buyer: 'pulse',
    creator: 'sara',
    status: ORDER_STATUS.DISPUTED,
    fundedAfterHours: 8,
    deliveries: [],
  },
  {
    requestKey: 'awarded_craftware_demo',
    buyer: 'craftware',
    creator: 'noah',
    status: ORDER_STATUS.DISPUTED,
    fundedAfterHours: 6,
    deliveries: [
      {
        submittedDaysAgo: 24,
        status: DELIVERY_STATUS.SUBMITTED,
        fileCount: 2,
        message:
          'Overview film delivered plus two attachment shorts. The third attachment short is not included — the sample tool arrived without that head, so I filmed what was available rather than hold the whole delivery.',
      },
    ],
  },
  {
    requestKey: 'completed_bloom_campaign',
    buyer: 'bloom',
    creator: 'zoe',
    status: ORDER_STATUS.COMPLETED,
    fundedAfterHours: 3,
    completedDaysAgo: 31,
    deliveries: [
      {
        submittedDaysAgo: 35,
        status: DELIVERY_STATUS.REVISION_REQUESTED,
        respondedDaysAgo: 34,
        fileCount: 2,
        message:
          'First cut of the campaign film in all three aspect ratios, with open-caption versions of each. Every on-screen line is taken from the approved claims list.',
      },
      {
        submittedDaysAgo: 32,
        status: DELIVERY_STATUS.ACCEPTED,
        respondedDaysAgo: 31,
        answersRevisionIndex: 0,
        fileCount: 3,
        message:
          'Updated masters attached. The closing claim card now matches the approved wording exactly, and I have re-timed the 9:16 cut so the product is fully in frame before the caption appears.',
      },
    ],
    revisions: [
      {
        deliveryIndex: 0,
        createdDaysAgo: 34,
        resolvedDaysAgo: 32,
        notes:
          'Beautiful work. One compliance fix: the closing card says "repairs the skin barrier" and the approved claim is "supports the skin barrier". Please update all three masters and the caption files.',
      },
    ],
  },
  {
    requestKey: 'completed_atlas_villa',
    buyer: 'atlas',
    creator: 'mateo',
    status: ORDER_STATUS.COMPLETED,
    fundedAfterHours: 4,
    completedDaysAgo: 18,
    deliveries: [
      {
        submittedDaysAgo: 27,
        status: DELIVERY_STATUS.ACCEPTED,
        respondedDaysAgo: 18,
        fileCount: 3,
        message:
          'All four villas delivered with interiors, terraces, and twilight exteriors. Two of the bedrooms at the third villa were occupied on the shoot day, so those frames are missing from the set.',
      },
    ],
    settlement: { refundedAmount: 205 },
  },
  {
    requestKey: 'completed_urbannest_loft',
    buyer: 'urbannest',
    creator: 'yuki',
    status: ORDER_STATUS.COMPLETED,
    fundedAfterHours: 2,
    completedDaysAgo: 14,
    deliveries: [
      {
        submittedDaysAgo: 23,
        status: DELIVERY_STATUS.ACCEPTED,
        respondedDaysAgo: 14,
        fileCount: 3,
        message:
          'Full showroom set delivered: every room set, the window-light detail frames, and the wide storefront frame. Graded and flat versions of each, no flash used anywhere.',
      },
    ],
  },
  {
    requestKey: 'cancelled_atlas_winter',
    buyer: 'atlas',
    creator: 'mateo',
    status: ORDER_STATUS.CANCELLED,
    fundedAfterHours: null,
    cancelledDaysAgo: 21,
    deliveries: [],
  },
  {
    requestKey: 'cancelled_bloom_serum',
    buyer: 'bloom',
    creator: 'chloe',
    status: ORDER_STATUS.REFUNDED,
    fundedAfterHours: 5,
    cancelledDaysAgo: 33,
    deliveries: [],
    settlement: { refundedAmount: 610 },
  },
]

/* -------------------------------------------------------------------------- */
/* Delivery copy for archived engagements                                     */
/* -------------------------------------------------------------------------- */

const HISTORY_DELIVERY_MESSAGES = [
  'Final delivery attached. Everything on the shot list is covered, delivered in the formats agreed in the brief.',
  'Delivering the finished set. Files are named by scene and supplied in both graded and flat versions.',
  'Final files attached, delivered a day inside the agreed window. Shout if you need an alternate crop of anything.',
  'Full delivery attached along with the working notes. Usage rights are exactly as set out on the order.',
]

/* -------------------------------------------------------------------------- */
/* Assembly                                                                   */
/* -------------------------------------------------------------------------- */

const orders = []
const deliveries = []
const revisions = []

const orderByRequestKey = new Map()
const settlementByOrderId = new Map()

let orderSequence = 0
let deliverySequence = 0
let revisionSequence = 0
let fileSequence = 0

/** `Autumn menu reels` → `autumn-menu-reels`, for deliverable file names. */
function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .split('-')
    .slice(0, 4)
    .join('-')
}

/**
 * The media type of the `index`-th file on a delivery.
 *
 * A `bundle` brief buys photo **and** video under one order, so its delivery
 * leads with the film and follows with the stills — which is also what gives the
 * buyer's deliverables grid one of each tile treatment to render (Prompt 20 §9).
 * Single-type briefs deliver only their own type.
 */
function mediaTypeFor(order, index) {
  if (order.contentType === CONTENT_TYPE.VIDEO) return MEDIA_TYPE.VIDEO
  if (order.contentType === CONTENT_TYPE.BUNDLE && index === 0) return MEDIA_TYPE.VIDEO
  return MEDIA_TYPE.IMAGE
}

/** Deterministic deliverable file metadata (mock uploads, 00 §15). */
function buildFiles({ order, count, version }) {
  const slug = slugify(order.title)

  return Array.from({ length: count }, (_, index) => {
    fileSequence += 1
    const id = seqId('dfl', fileSequence)
    const mediaType = mediaTypeFor(order, index)
    const isVideo = mediaType === MEDIA_TYPE.VIDEO
    return {
      id,
      name: `${slug}-v${version}-${String(index + 1).padStart(2, '0')}.${isVideo ? 'mp4' : 'jpg'}`,
      url: imageUrl(id, IMAGE_SIZES.hero.width, IMAGE_SIZES.hero.height),
      thumbnailUrl: imageUrl(
        id,
        IMAGE_SIZES.thumbnail.width,
        IMAGE_SIZES.thumbnail.height
      ),
      mediaType,
      sizeKb: isVideo ? 48000 + index * 9600 : 2400 + index * 180,
    }
  })
}

/**
 * Builds an order plus its deliveries and revisions.
 * `spec.deliveries` are ordered oldest first; a delivery that answers a
 * revision points at it through `answersRevisionIndex`.
 */
function buildOrder(spec) {
  const request = requestByKey(spec.requestKey)
  const proposal = acceptedProposalFor(spec.requestKey)
  const createdAt = proposal.respondedAt
  const activatedAt =
    spec.fundedAfterHours === null
      ? null
      : addHours(createdAt, spec.fundedAfterHours)
  const price = proposal.price
  const commissionRate = commissionRateFor(request.categoryId)
  const commissionAmount = round2(price * commissionRate)

  orderSequence += 1
  const order = {
    id: seqId('ord', orderSequence),
    requestId: request.id,
    proposalId: proposal.id,
    buyerId: buyerId(spec.buyer),
    creatorId: creatorId(spec.creator),
    title: request.title,
    categoryId: request.categoryId,
    contentType: request.contentType,
    price,
    currency: CURRENCY,
    commissionRate,
    commissionAmount,
    creatorEarnings: round2(price - commissionAmount),
    revisionsIncluded: proposal.revisionsIncluded,
    revisionsUsed: (spec.revisions ?? []).length,
    deliveryDueAt: addDays(activatedAt ?? createdAt, proposal.deliveryDays),
    status: spec.status,
    activatedAt,
    deliveredAt: null,
    completedAt:
      spec.completedDaysAgo === undefined
        ? null
        : daysAgo(spec.completedDaysAgo, 16, 10),
    cancelledAt:
      spec.cancelledDaysAgo === undefined
        ? null
        : daysAgo(spec.cancelledDaysAgo, 16, 30),
    createdAt,
  }

  // Deliveries first, then the revisions they triggered, so a revision can
  // reference the delivery it answers and vice versa.
  const orderDeliveries = (spec.deliveries ?? []).map((delivery, index) => {
    deliverySequence += 1
    const record = {
      id: seqId('dlv', deliverySequence),
      orderId: order.id,
      version: index + 1,
      message: delivery.message,
      files: buildFiles({ order, count: delivery.fileCount, version: index + 1 }),
      status: delivery.status,
      revisionId: null,
      submittedAt: daysAgo(delivery.submittedDaysAgo, 14, 45),
      respondedAt:
        delivery.respondedDaysAgo === undefined
          ? null
          : daysAgo(delivery.respondedDaysAgo, 10, 30),
    }
    deliveries.push(record)
    return record
  })

  const orderRevisions = (spec.revisions ?? []).map((revision) => {
    revisionSequence += 1
    const record = {
      id: seqId('rev', revisionSequence),
      orderId: order.id,
      deliveryId: orderDeliveries[revision.deliveryIndex].id,
      requestedById: order.buyerId,
      notes: revision.notes,
      createdAt: daysAgo(revision.createdDaysAgo, 10, 30),
      resolvedAt:
        revision.resolvedDaysAgo === undefined
          ? null
          : daysAgo(revision.resolvedDaysAgo, 14, 45),
    }
    revisions.push(record)
    return record
  })

  ;(spec.deliveries ?? []).forEach((delivery, index) => {
    if (delivery.answersRevisionIndex !== undefined) {
      orderDeliveries[index].revisionId =
        orderRevisions[delivery.answersRevisionIndex].id
    }
  })

  const lastDelivery = orderDeliveries[orderDeliveries.length - 1]
  order.deliveredAt = lastDelivery ? lastDelivery.submittedAt : null

  if (spec.settlement) {
    settlementByOrderId.set(order.id, spec.settlement)
  }

  orders.push(order)
  orderByRequestKey.set(spec.requestKey, order)
  return order
}

SCENARIO_ORDERS.forEach(buildOrder)

HISTORY_ENGAGEMENTS.forEach((engagement, index) => {
  const deliveredDaysAgo = engagement.createdDaysAgo - engagement.deliveryDays + 1
  const completedDaysAgo = deliveredDaysAgo - 2
  buildOrder({
    requestKey: engagement.key,
    buyer: engagement.buyer,
    creator: engagement.creator,
    status: ORDER_STATUS.COMPLETED,
    fundedAfterHours: 3,
    completedDaysAgo,
    deliveries: [
      {
        submittedDaysAgo: deliveredDaysAgo,
        status: DELIVERY_STATUS.ACCEPTED,
        respondedDaysAgo: completedDaysAgo,
        fileCount: engagement.contentType === CONTENT_TYPE.VIDEO ? 2 : 3,
        message: pick(HISTORY_DELIVERY_MESSAGES, index),
      },
    ],
  })
})

/* -------------------------------------------------------------------------- */
/* Prompt 24 — the demo creator's delivered order                             */
/* -------------------------------------------------------------------------- */

/**
 * Work Ava has handed over and the buyer has not yet reviewed — the third state
 * her order workspace needs alongside the in-progress and revision-requested
 * ones she already has (Prompt 24 §9).
 *
 * Built **after** the history engagements rather than inside `SCENARIO_ORDERS`:
 * order and delivery ids are handed out in creation order, so inserting one
 * into the scenario list would renumber every archived order after it,
 * including `ord_020`, which `docs/api-contract.md` quotes.
 */
buildOrder({
  requestKey: 'awarded_verde_pastry',
  buyer: 'verde',
  creator: 'ava',
  status: ORDER_STATUS.DELIVERED,
  fundedAfterHours: 4,
  deliveries: [
    {
      submittedDaysAgo: 1,
      status: DELIVERY_STATUS.SUBMITTED,
      fileCount: 3,
      message:
        'Twelve finished images attached: the counter wide at opening, each pastry straight on against the marble, and two frames of the bakers finishing the display. Everything shot in daylight with nothing styled in, and both bakers have signed releases on file.',
    },
  ],
})

/* -------------------------------------------------------------------------- */
/* Prompt 26 — the disputed orders behind the case gallery                    */
/* -------------------------------------------------------------------------- */

/**
 * Three more orders frozen at `disputed`, one per dispute status that had no
 * seeded example — `awaiting_buyer`, `awaiting_creator`, and `escalated`
 * (Prompt 26 §9). Two of them sit between the two demo accounts so the awaiting
 * banners and the nav badge can be seen from both chairs.
 *
 * Built **after** the history engagements for the same id-stability reason as
 * Prompt 24's order above: nothing that already exists is renumbered. Their
 * payments follow automatically — `finance.js` derives the escrow chain from
 * the order status, and a disputed order means one `charge` and a payment left
 * `held`, which is exactly the point of a dispute.
 */
const DISPUTED_ORDERS_26 = [
  {
    // `awaiting_buyer`: our team has come back to the demo buyer for something.
    requestKey: 'awarded_verde_tasting',
    buyer: 'verde',
    creator: 'isla',
    status: ORDER_STATUS.DISPUTED,
    fundedAfterHours: 5,
    deliveries: [
      {
        submittedDaysAgo: 17,
        status: DELIVERY_STATUS.SUBMITTED,
        fileCount: 3,
        message:
          'Fourteen frames from the two Friday services: every course as it left the pass, plus three wider frames of the table set before guests arrived. Two courses were plated differently on the second night, so I have delivered the version that matches the printed card.',
      },
    ],
  },
  {
    // `awaiting_creator`: the ball is with the demo creator.
    requestKey: 'awarded_verde_courtyard',
    buyer: 'verde',
    creator: 'ava',
    status: ORDER_STATUS.DISPUTED,
    fundedAfterHours: 3,
    deliveries: [
      {
        submittedDaysAgo: 11,
        status: DELIVERY_STATUS.SUBMITTED,
        fileCount: 2,
        message:
          'Two of the three films attached — the courtyard at dusk and the service run. The drinks piece needs a reshoot: the heaters were not lit on either evening and the terrace reads cold on every take.',
      },
    ],
  },
  {
    // `escalated`: with a senior reviewer, and nothing was ever delivered.
    requestKey: 'awarded_atlas_marina',
    buyer: 'atlas',
    creator: 'mateo',
    status: ORDER_STATUS.DISPUTED,
    fundedAfterHours: 7,
    deliveries: [],
  },
]

DISPUTED_ORDERS_26.forEach(buildOrder)

export { orders, deliveries, revisions }

/** The order created from a request key (scenario key or history key). */
export function orderFor(requestKey) {
  const order = orderByRequestKey.get(requestKey)
  if (!order) throw new Error(`No order for request key: ${requestKey}`)
  return order
}

/**
 * Dispute settlements, keyed by order id: how much of the payment went back to
 * the buyer. `finance.js` and `disputes.js` both read this so the payment, the
 * transactions, and the dispute resolution can never disagree.
 */
export function settlementFor(orderId) {
  return settlementByOrderId.get(orderId) ?? null
}

/**
 * The commission BetterBlue actually earned on an order: the platform rate
 * applied to the amount that stayed with the engagement after any dispute
 * refund. Equal to `order.commissionAmount` for every order that was not
 * partially refunded. `finance.js` writes it to the `commissions` row and
 * `affiliate.js` pays referral commission out of it.
 */
export function settledCommissionFor(order) {
  const settlement = settlementFor(order.id)
  const base = round2(order.price - (settlement?.refundedAmount ?? 0))
  return { base, amount: round2(base * order.commissionRate) }
}

/** Deliveries belonging to an order, oldest version first. */
export function deliveriesFor(orderId) {
  return deliveries.filter((delivery) => delivery.orderId === orderId)
}

/** Request keys that produced a scenario order, in seeded order. */
export const SCENARIO_ORDER_REQUEST_KEYS = SCENARIO_ORDERS.map(
  (spec) => spec.requestKey
)
