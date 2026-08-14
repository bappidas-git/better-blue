// Seed: `disputes` + `disputeMessages` — Trust & Safety casework
// (Prompt 05 §4.3).
//
// Five cases spanning the lifecycle: one just opened and not yet triaged, one
// under review with an admin assigned, two resolved (a full refund and a
// partial refund), and one closed after the evidence supported the creator.
// Every thread carries at least one `internal: true` note — admin-only
// commentary that must never be rendered to the buyer or the creator.
//
// Refund amounts come from `orders.js#settlementFor`, the same source
// `finance.js` uses, so a resolution can never disagree with the ledger.

import {
  DISPUTE_CATEGORY,
  DISPUTE_RESOLUTION,
  DISPUTE_STATUS,
} from '../../src/constants/statuses.js'
import { ROLES } from '../../src/constants/roles.js'
import { imageUrl, IMAGE_SIZES } from '../../src/constants/images.js'
import { MEDIA_TYPE, compact, daysAgo, seqId } from '../seed-utils.js'
import { ADMIN_ID } from './users.js'
import { orderFor, settlementFor } from './orders.js'

const DISPUTE_SOURCE = [
  {
    key: 'pulse_late',
    requestKey: 'awarded_pulse_explainer',
    category: DISPUTE_CATEGORY.LATE_DELIVERY,
    status: DISPUTE_STATUS.OPEN,
    openedDaysAgo: 6,
    updatedDaysAgo: 5,
    raisedBy: 'buyer',
    description:
      'The explainer series was due eighteen days ago and nothing has been submitted. We have asked for a status update twice through the order thread and had no reply since the shoot date slipped. Our help centre release is now blocked on this content.',
    evidenceCount: 1,
    messages: [
      {
        author: 'buyer',
        daysAgo: 6,
        body: 'Opening this because we are three weeks past the delivery date with no files and no update. We are happy to extend if there is a genuine reason, but we need to hear something today.',
      },
      {
        author: 'creator',
        daysAgo: 5,
        body: 'Apologies for the silence — the demo environment we were given stopped returning data mid-shoot and I have been waiting on new credentials. Three of the four explainers are edited and I can submit them within 48 hours.',
      },
    ],
  },
  {
    key: 'craftware_scope',
    requestKey: 'awarded_craftware_demo',
    category: DISPUTE_CATEGORY.SCOPE_MISMATCH,
    status: DISPUTE_STATUS.UNDER_REVIEW,
    openedDaysAgo: 18,
    updatedDaysAgo: 9,
    assignedAdmin: ADMIN_ID.MAYA,
    raisedBy: 'buyer',
    description:
      'We ordered an overview film plus three attachment shorts and received the overview plus two shorts. The missing short covers the attachment our launch campaign leads with, so the delivery does not meet the brief we paid for.',
    evidenceCount: 2,
    messages: [
      {
        author: 'buyer',
        daysAgo: 18,
        body: 'The order specifies four films and three arrived. We would like the fourth delivered or the price adjusted to reflect three of four deliverables.',
      },
      {
        author: 'creator',
        daysAgo: 17,
        body: 'The sample tool shipped without the plunge head, so there was nothing to film for the fourth short. I raised it in the order thread on the shoot day and offered to film it as soon as the part arrives, at no extra cost.',
      },
      {
        author: 'admin',
        daysAgo: 16,
        body: 'Thank you both. I have the order thread and the delivery in front of me. Craftware, can you confirm when the plunge head is expected? If it lands inside a week, finishing the fourth film is the cleanest outcome for everyone.',
      },
      {
        author: 'admin',
        daysAgo: 9,
        internal: true,
        body: 'Internal: order thread confirms the creator flagged the missing part on the shoot day, so this reads as a supply issue rather than a scope failure. Holding for the buyer to confirm the part date before proposing a partial release.',
      },
    ],
  },
  {
    key: 'bloom_nondelivery',
    requestKey: 'cancelled_bloom_serum',
    category: DISPUTE_CATEGORY.NON_DELIVERY,
    status: DISPUTE_STATUS.RESOLVED,
    openedDaysAgo: 40,
    updatedDaysAgo: 33,
    assignedAdmin: ADMIN_ID.MAYA,
    raisedBy: 'buyer',
    description:
      'No files were ever submitted and the creator has not responded to the order thread for two weeks. The packaging campaign has been pulled from the schedule and we would like the payment returned.',
    evidenceCount: 1,
    resolution: {
      outcome: DISPUTE_RESOLUTION.FULL_REFUND,
      resolvedById: ADMIN_ID.MAYA,
      resolvedDaysAgo: 33,
      note: 'No deliverables were submitted and the creator did not respond to either party inside the review window. The payment has been refunded to the buyer in full and the account has been referred for a separate review.',
    },
    messages: [
      {
        author: 'buyer',
        daysAgo: 40,
        body: 'Nothing has been delivered and we have had no reply in the order thread since the shoot was booked. We need the funds back so we can re-post the brief.',
      },
      {
        author: 'admin',
        daysAgo: 38,
        body: 'Thank you for the detail. I have contacted the creator directly and opened a five-day window for a response before we decide.',
      },
      {
        author: 'admin',
        daysAgo: 34,
        internal: true,
        body: 'Internal: no response from the creator across two contact attempts, and the same pattern appears on an unrelated licensing report. Refunding in full and referring the account to the accounts review queue.',
      },
      {
        author: 'admin',
        daysAgo: 33,
        body: 'Resolved in the buyer’s favour. The full amount has been returned to your payment method and should settle within three working days. Thank you for your patience.',
      },
    ],
  },
  {
    key: 'atlas_quality',
    requestKey: 'completed_atlas_villa',
    category: DISPUTE_CATEGORY.QUALITY_ISSUE,
    status: DISPUTE_STATUS.RESOLVED,
    openedDaysAgo: 26,
    updatedDaysAgo: 18,
    assignedAdmin: ADMIN_ID.MAYA,
    raisedBy: 'buyer',
    description:
      'The villa set is good work overall, but two bedrooms at the third property are missing entirely and the brief asked for every bedroom. We would like a partial adjustment rather than a re-shoot, since the collection is already live.',
    evidenceCount: 2,
    resolution: {
      outcome: DISPUTE_RESOLUTION.PARTIAL_REFUND,
      resolvedById: ADMIN_ID.MAYA,
      resolvedDaysAgo: 18,
      note: 'The delivery covers the agreed scope apart from two bedrooms that were occupied on the shoot day, which the creator noted at handover. A quarter of the order value has been returned to the buyer and the balance released to the creator. Both parties accepted this outcome.',
    },
    messages: [
      {
        author: 'buyer',
        daysAgo: 26,
        body: 'Two bedrooms at the third villa are not in the set. Everything else meets the brief and we are already using it, so a re-shoot is not practical — a partial adjustment would settle this for us.',
      },
      {
        author: 'creator',
        daysAgo: 25,
        body: 'Both rooms were occupied on the day and the property would not move the guests. I flagged it in the delivery note at handover. I am happy with a proportionate adjustment rather than travelling back.',
      },
      {
        author: 'admin',
        daysAgo: 20,
        internal: true,
        body: 'Internal: delivery note does record the occupied rooms, so this is a partial-scope shortfall rather than a quality failure. Both parties have proposed the same remedy — settling at a quarter of order value.',
      },
      {
        author: 'admin',
        daysAgo: 18,
        body: 'Resolved by agreement: a quarter of the order value returns to the buyer and the remainder is released to the creator. Thank you both for working this through so constructively.',
      },
    ],
  },
  {
    key: 'urbannest_quality',
    requestKey: 'completed_urbannest_loft',
    category: DISPUTE_CATEGORY.QUALITY_ISSUE,
    status: DISPUTE_STATUS.CLOSED,
    openedDaysAgo: 21,
    updatedDaysAgo: 12,
    assignedAdmin: ADMIN_ID.PRIYA,
    raisedBy: 'buyer',
    description:
      'The storefront frame looks softer than the rest of the set and we are not sure it is usable at print size. Raising this to get a second opinion before we accept the delivery.',
    evidenceCount: 1,
    resolution: {
      outcome: DISPUTE_RESOLUTION.RELEASE_PAYMENT,
      resolvedById: ADMIN_ID.PRIYA,
      resolvedDaysAgo: 14,
      note: 'The delivered files are sharp at full resolution; the softness the buyer saw came from the preview render rather than the masters. The delivery meets the brief, so the payment has been released to the creator in full.',
    },
    messages: [
      {
        author: 'buyer',
        daysAgo: 21,
        body: 'The storefront frame looks soft to us at 100 per cent. Everything else in the set is excellent — we would just like this checked before we sign off.',
      },
      {
        author: 'creator',
        daysAgo: 20,
        body: 'Happy to have it checked. The master is 45 megapixels and sharp at full size — the file in the preview panel is a compressed proxy, which is likely what you are seeing.',
      },
      {
        author: 'admin',
        daysAgo: 15,
        internal: true,
        body: 'Internal: downloaded the master and inspected at 100 per cent. Focus is on the storefront glazing as intended and the file is print-ready. No fault with the delivery.',
      },
      {
        author: 'admin',
        daysAgo: 14,
        body: 'Reviewed and closed in the creator’s favour. The master files are sharp at full resolution — the softness came from the compressed preview. Payment has been released and the order is complete.',
      },
    ],
  },
]

/* -------------------------------------------------------------------------- */
/* Assembly                                                                   */
/* -------------------------------------------------------------------------- */

const disputes = []
const disputeMessages = []

let disputeSequence = 0
let messageSequence = 0
let evidenceSequence = 0

/** Evidence uploads attached to the opening statement (mock file metadata). */
function buildEvidence(count) {
  return Array.from({ length: count }, (_, index) => {
    evidenceSequence += 1
    const id = seqId('evd', evidenceSequence)
    return {
      id,
      name: `dispute-evidence-${String(evidenceSequence).padStart(2, '0')}.jpg`,
      url: imageUrl(id, IMAGE_SIZES.card.width, IMAGE_SIZES.card.height),
      thumbnailUrl: imageUrl(
        id,
        IMAGE_SIZES.thumbnail.width,
        IMAGE_SIZES.thumbnail.height
      ),
      mediaType: MEDIA_TYPE.IMAGE,
      sizeKb: 820 + index * 140,
    }
  })
}

DISPUTE_SOURCE.forEach((source) => {
  const order = orderFor(source.requestKey)
  const settlement = settlementFor(order.id)
  disputeSequence += 1

  const participants = {
    buyer: order.buyerId,
    creator: order.creatorId,
    admin: source.assignedAdmin ?? ADMIN_ID.MAYA,
  }
  const roleOf = {
    buyer: ROLES.BUYER,
    creator: ROLES.CREATOR,
    admin: ROLES.ADMIN,
  }

  const dispute = compact({
    id: seqId('dsp', disputeSequence),
    orderId: order.id,
    raisedById: participants[source.raisedBy],
    againstId:
      source.raisedBy === 'buyer' ? order.creatorId : order.buyerId,
    category: source.category,
    description: source.description,
    evidence: buildEvidence(source.evidenceCount),
    status: source.status,
    assignedAdminId: source.assignedAdmin,
    resolution: source.resolution
      ? compact({
          outcome: source.resolution.outcome,
          amountRefunded:
            source.resolution.outcome === DISPUTE_RESOLUTION.RELEASE_PAYMENT
              ? undefined
              : settlement?.refundedAmount,
          note: source.resolution.note,
          resolvedById: source.resolution.resolvedById,
          resolvedAt: daysAgo(source.resolution.resolvedDaysAgo, 16, 10),
        })
      : undefined,
    createdAt: daysAgo(source.openedDaysAgo, 9, 25),
    updatedAt: daysAgo(source.updatedDaysAgo, 16, 40),
  })

  disputes.push(dispute)

  source.messages.forEach((message) => {
    messageSequence += 1
    disputeMessages.push({
      id: seqId('dmsg', messageSequence),
      disputeId: dispute.id,
      authorId: participants[message.author],
      authorRole: roleOf[message.author],
      body: message.body,
      attachments: [],
      internal: message.internal === true,
      createdAt: daysAgo(message.daysAgo, 11, 15),
    })
  })
})

export { disputes, disputeMessages }

/** The dispute raised on an order, or `null` when there is none. */
export function disputeForOrder(orderId) {
  return disputes.find((dispute) => dispute.orderId === orderId) ?? null
}
