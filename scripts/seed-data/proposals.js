// Seed: `proposals` — creator offers on content requests (Prompt 05 §4.3).
//
// Three groups:
//   • offers on the five live requests (submitted / shortlisted / declined /
//     withdrawn), so the buyer's compare-and-award flow has real material;
//   • offers on the closed request, left `expired`;
//   • the accepted offer behind every order, plus the offers that lost.
//
// The accepted proposal's `respondedAt` is the moment the buyer awarded the
// brief, and `orders.js` builds each order's timeline from it — so an order
// can never predate the proposal that created it.

import { PROPOSAL_STATUS } from '../../src/constants/statuses.js'
import { CURRENCY, addDays, compact, daysAgo, pick, seqId } from '../seed-utils.js'
import { creatorId } from './users.js'
import { publishedItemIds } from './portfolio.js'
import { HISTORY_ENGAGEMENTS, requestByKey, requestId } from './requests.js'

const { SUBMITTED, SHORTLISTED, ACCEPTED, DECLINED, WITHDRAWN, EXPIRED } =
  PROPOSAL_STATUS

/* -------------------------------------------------------------------------- */
/* Offers on live and closed requests                                         */
/* -------------------------------------------------------------------------- */

const BOARD_PROPOSALS = {
  open_verde_menu: [
    {
      creator: 'ava',
      price: 820,
      deliveryDays: 9,
      revisions: 2,
      status: SHORTLISTED,
      afterDays: 1,
      message:
        'I shoot menu photography for restaurant groups every week, so I can work inside a live service without slowing the pass. I would cover all twenty dishes overhead and at 45 degrees, plus three table scenes, and deliver menu-safe crops with space for your typography.',
    },
    {
      creator: 'yuki',
      price: 700,
      deliveryDays: 12,
      revisions: 1,
      status: SUBMITTED,
      afterDays: 2,
      message:
        'My work is mostly interiors and tableware, which means I light for texture and I style with restraint — a good fit for the warm, natural look in your brief. I would shoot on your own tableware and deliver both flat and lightly graded versions.',
    },
    {
      creator: 'noah',
      price: 640,
      deliveryDays: 7,
      revisions: 2,
      status: SUBMITTED,
      afterDays: 3,
      message:
        'I shoot high-volume product work to a fixed template, which is what keeps a twenty-dish set consistent. Happy to work around one service and turn the full set around inside a week.',
    },
    {
      creator: 'mateo',
      price: 880,
      deliveryDays: 10,
      revisions: 2,
      status: WITHDRAWN,
      afterDays: 4,
      message:
        'I would love to shoot this, though I should flag that my availability is in Milan for most of the month.',
    },
  ],
  open_nimbus_class: [
    {
      creator: 'diego',
      price: 1150,
      deliveryDays: 12,
      revisions: 2,
      status: SHORTLISTED,
      afterDays: 1,
      message:
        'I am a certified trainer as well as a videographer, so the technique on camera will hold up to member scrutiny. Three vertical promos, captions burned in, and I will cast from your existing class members so the mix of ages and abilities is genuine.',
    },
    {
      creator: 'amara',
      price: 1380,
      deliveryDays: 14,
      revisions: 3,
      status: SUBMITTED,
      afterDays: 2,
      message:
        'I bring a small crew for lighting so a busy studio still reads clean on camera. You would get three hero verticals plus a bank of extra cutdowns from the same shoot day for the rest of the January schedule.',
    },
    {
      creator: 'mateo',
      price: 960,
      deliveryDays: 10,
      revisions: 2,
      status: SUBMITTED,
      afterDays: 3,
      message:
        'Event and multi-camera work is my day job, so shooting three classes back to back is straightforward. I can deliver captioned verticals plus the offer end-card as an editable template.',
    },
  ],
  open_atlas_itinerary: [
    {
      creator: 'isla',
      price: 1650,
      deliveryDays: 18,
      revisions: 2,
      status: SUBMITTED,
      afterDays: 1,
      message:
        'I have photographed two of your existing itineraries, so I know how you use the left third for overlay and I frame for it. I travel light, work at both ends of the day, and can deliver the hero film plus vertical cutdowns from the same trip.',
    },
    {
      creator: 'amara',
      price: 1780,
      deliveryDays: 16,
      revisions: 2,
      status: SUBMITTED,
      afterDays: 2,
      message:
        'I would treat this as a documentary trip rather than a staged shoot, staying with the group across all four days. Releases for anyone identifiable are handled on the ground before we shoot.',
    },
    {
      creator: 'mateo',
      price: 1420,
      deliveryDays: 20,
      revisions: 3,
      status: SUBMITTED,
      afterDays: 3,
      message:
        'I am based a short flight away and know the Douro restaurants well. Package would be a 90-second hero film, vertical cutdowns, and a full stills set covering both vineyard stays.',
    },
  ],
  open_bloom_routine: [
    {
      creator: 'zoe',
      price: 750,
      deliveryDays: 10,
      revisions: 2,
      status: SHORTLISTED,
      afterDays: 1,
      message:
        'I produce routine explainers for skincare brands most months, and I handle presenter casting and release paperwork as part of the fee. Every on-screen line will come straight from your approved claims list, and I will include the patch-test card in the final cut.',
    },
    {
      creator: 'sara',
      price: 720,
      deliveryDays: 8,
      revisions: 2,
      status: SUBMITTED,
      afterDays: 2,
      message:
        'I script and present education video, so I can take the autocue myself and keep each step tight to fifteen seconds. Deliverables would include an open-caption version and a caption file for your own edits.',
    },
  ],
  open_pulse_walkthrough: [
    {
      creator: 'liam',
      price: 1100,
      deliveryDays: 14,
      revisions: 2,
      status: SUBMITTED,
      afterDays: 0.5,
      message:
        'I was the in-house video lead at a scheduling platform, so I can write to your release notes rather than just film the interface. Two-minute master at 1080p from a 1440p capture, motion callouts in your brand colours, plus an open-caption version.',
    },
    {
      creator: 'sara',
      price: 940,
      deliveryDays: 12,
      revisions: 3,
      status: SUBMITTED,
      afterDays: 1,
      message:
        'Screen-capture walkthroughs are most of what I do, and I keep the pacing slow enough for an evaluator watching without sound. I can work entirely from your demo environment and deliver localisation-ready caption files.',
    },
    {
      creator: 'diego',
      price: 1200,
      deliveryDays: 10,
      revisions: 2,
      status: DECLINED,
      afterDays: 1.5,
      message:
        'Most of my work is fitness video, but the production side transfers directly and I have the motion graphics toolkit for callouts.',
    },
    {
      creator: 'ethan',
      price: 820,
      deliveryDays: 16,
      revisions: 1,
      status: SUBMITTED,
      afterDays: 2,
      message:
        'I am building out my BetterBlue portfolio and would put extra care into this one. Comfortable with screen capture and clean voiceover, and I can turn revisions around the same day.',
    },
  ],
  closed_cocoa_easter: [
    {
      creator: 'ava',
      price: 520,
      deliveryDays: 8,
      revisions: 2,
      status: EXPIRED,
      afterDays: 2,
      message:
        'Gift boxes photograph best with a little warmth and a lot of texture, and I keep a surface library for exactly this kind of set. Happy to shoot closed, open, and part-unwrapped as you describe.',
    },
    {
      creator: 'chloe',
      price: 480,
      deliveryDays: 7,
      revisions: 1,
      status: EXPIRED,
      afterDays: 3,
      message:
        'I shoot packaging in natural light with minimal retouching, which suits a tactile seasonal range. I can deliver square crops sized for your storefront grid.',
    },
  ],
}

/* -------------------------------------------------------------------------- */
/* Accepted offers behind the scenario orders                                 */
/* -------------------------------------------------------------------------- */

/**
 * One entry per order-hosting request. `awardDaysAgo` is when the buyer
 * accepted — `orders.js` starts every order clock from it. `alsoDeclined`
 * lists the creators who lost the brief.
 */
const AWARD_PROPOSALS = {
  awarded_cocoa_gift: {
    creator: 'ava',
    price: 940,
    deliveryDays: 10,
    revisions: 2,
    awardDaysAgo: 6,
    message:
      'Gifting sets live or die on texture, so I would shoot close and warm with hands in a few frames to give scale. Fifteen finished lifestyle images plus square and 4:5 crops, with three frames keeping your branding fully legible.',
    alsoDeclined: ['yuki', 'noah'],
  },
  awarded_nimbus_equipment: {
    creator: 'diego',
    price: 1080,
    deliveryDays: 12,
    revisions: 2,
    awardDaysAgo: 15,
    message:
      'Six machines, one coach, one lighting setup — that is how the series stays consistent on your studio screens. I will call out the safety stop in every film and shoot front and side angles for each machine.',
    alsoDeclined: ['mateo'],
  },
  awarded_bloom_texture: {
    creator: 'zoe',
    price: 880,
    deliveryDays: 9,
    revisions: 2,
    awardDaysAgo: 12,
    message:
      'Shade accuracy is the whole job here, so I will shoot to a colour chart and match your existing product page profile. Swatches across a range of skin tones, one macro frame per shade, no warming filters anywhere.',
    alsoDeclined: ['chloe'],
  },
  awarded_atlas_hotel: {
    creator: 'isla',
    price: 1520,
    deliveryDays: 14,
    revisions: 2,
    awardDaysAgo: 20,
    message:
      'Three properties in three days is comfortable if I shoot rooms in the morning and exteriors at golden hour. Every room category covered, plus one exterior and one pool frame per property, all true to life.',
    alsoDeclined: ['yuki', 'mateo'],
  },
  awarded_verde_reel: {
    creator: 'ava',
    price: 720,
    deliveryDays: 8,
    revisions: 2,
    awardDaysAgo: 20,
    message:
      'One prep-led, one plating-led, one dining room — cut to kitchen sound rather than a licensed track, exactly as your brief asks. I will caption each dish name on screen and keep every reel under 25 seconds.',
    alsoDeclined: ['mateo'],
  },
  awarded_verde_supper: {
    creator: 'amara',
    price: 1180,
    deliveryDays: 12,
    revisions: 2,
    awardDaysAgo: 11,
    message:
      'Supper clubs live or die on whether the room still feels like the room once a camera is in it, so I work handheld on fast glass and never bring a light to the floor. You would get the film and a matched stills set from the same evening, graded together.',
    alsoDeclined: ['isla'],
  },
  awarded_verde_market: {
    creator: 'ava',
    price: 560,
    deliveryDays: 7,
    revisions: 1,
    awardDaysAgo: 1,
    message:
      'I shoot market mornings for two other kitchens, so I know how to work a busy stall without holding anyone up. Produce, hands, and crates in early light, plus grower portraits taken with permission on the day.',
    alsoDeclined: ['chloe'],
  },
  awarded_urbannest_shelf: {
    creator: 'yuki',
    price: 760,
    deliveryDays: 9,
    revisions: 2,
    awardDaysAgo: 17,
    message:
      'Catalogue consistency comes from fixing camera height and colour temperature once and never moving them. Four finishes styled and unstyled, plus a detail frame for every joint type in the range.',
    alsoDeclined: ['ethan'],
  },
  awarded_pulse_explainer: {
    creator: 'sara',
    price: 1150,
    deliveryDays: 12,
    revisions: 2,
    awardDaysAgo: 30,
    message:
      'Four explainers built from your demo environment, each one standing alone in the help centre. Motion graphics in brand ink and teal, neutral narration, and caption files delivered with every master.',
    alsoDeclined: ['liam', 'ethan'],
  },
  awarded_craftware_demo: {
    creator: 'noah',
    price: 980,
    deliveryDays: 11,
    revisions: 2,
    awardDaysAgo: 34,
    message:
      'I shoot tools doing real work on real material, with protective equipment visible throughout. One overview film plus three attachment shorts, each with a clear changeover close-up.',
    alsoDeclined: ['diego'],
  },
  awarded_nimbus_app: {
    creator: 'liam',
    price: 940,
    deliveryDays: 12,
    revisions: 2,
    awardDaysAgo: 1,
    message:
      'App films need the interface legible at thumb size, so I record at device resolution and scale up rather than zooming in post. One 75-second master, two studio inserts, and captions above the safe area.',
    alsoDeclined: ['sara'],
  },
  completed_bloom_campaign: {
    creator: 'zoe',
    price: 1020,
    deliveryDays: 12,
    revisions: 2,
    awardDaysAgo: 44,
    message:
      'A relaunch film should feel calm and confident rather than busy. I will shoot in soft daylight on a clean set and deliver 16:9, 9:16, and 1:1 masters with open-caption versions of each.',
    alsoDeclined: ['amara'],
  },
  completed_atlas_villa: {
    creator: 'mateo',
    price: 820,
    deliveryDays: 10,
    revisions: 2,
    awardDaysAgo: 38,
    message:
      'Four villas across two days, interiors in flat light and one twilight exterior each. I will photograph every bedroom and keep the lens wide enough to read the space without distorting it.',
    alsoDeclined: ['isla'],
  },
  completed_urbannest_loft: {
    creator: 'yuki',
    price: 640,
    deliveryDays: 8,
    revisions: 2,
    awardDaysAgo: 30,
    message:
      'A working showroom photographs best on natural light alone, so I would shoot through the middle of the day and let the window light do the work. Every room set plus a wide storefront frame, delivered graded and flat.',
    alsoDeclined: ['ethan'],
  },
  cancelled_atlas_winter: {
    creator: 'mateo',
    price: 560,
    deliveryDays: 7,
    revisions: 1,
    awardDaysAgo: 25,
    message:
      'Showcase events are best covered as conversations rather than stages, so I would work the floor and the partner stands. Recap film plus a guest interview, releases collected on the day.',
    alsoDeclined: ['amara'],
  },
  cancelled_bloom_serum: {
    creator: 'chloe',
    price: 610,
    deliveryDays: 9,
    revisions: 2,
    awardDaysAgo: 52,
    message:
      'Refill packaging photographs best as a sequence, so the customer understands the step before they read a word. Neutral background, product-accurate colour, and a scale reference frame as you asked.',
    alsoDeclined: ['zoe'],
  },
}

/* -------------------------------------------------------------------------- */
/* Templated copy for losing and archived offers                              */
/* -------------------------------------------------------------------------- */

const DECLINED_MESSAGES = [
  (request) =>
    `I have delivered work close to this brief before and can cover the full scope in one production block. Happy to walk through my approach to "${request.title}" on a call before you decide.`,
  (request) =>
    `My quote for "${request.title}" covers production, editing, and one round of changes, with the shot list agreed before we start. Availability comfortably clears your deadline.`,
  (request) =>
    `I would keep this simple: one shoot day, a clear deliverables list, and files handed over in the formats "${request.title}" asks for. Recent work in this category is attached as samples.`,
  (request) =>
    `Everything in your brief is inside my usual scope, including the ${request.usageRights.replace(/_/g, ' ')} rights you specified. I can start within a week of award and share a first look early for direction.`,
]

const HISTORY_ACCEPTED_MESSAGES = [
  (engagement) =>
    `Thanks for the brief. I can cover the full scope in ${engagement.deliveryDays} days, working to the shot list and delivering in the formats you listed.`,
  (engagement) =>
    `This sits squarely in the work I do most weeks. Quoted price covers production, editing, and the revision rounds set out below, with delivery in ${engagement.deliveryDays} days.`,
  (engagement) =>
    `Happy to take this on. I will confirm the shot list before the shoot and hand over graded and flat versions of everything within ${engagement.deliveryDays} days.`,
  (engagement) =>
    `I have delivered several projects of this size and can hold to a ${engagement.deliveryDays}-day turnaround, with a first look shared early so direction is settled before final delivery.`,
]

/* -------------------------------------------------------------------------- */
/* Assembly                                                                   */
/* -------------------------------------------------------------------------- */

const proposals = []
const acceptedByRequestKey = new Map()
let sequence = 0
let sampleOffset = 0

function addProposal({
  requestKey,
  creatorKey,
  price,
  deliveryDays,
  revisions,
  status,
  coverMessage,
  createdAt,
  respondedAt,
}) {
  sequence += 1
  sampleOffset += 1
  const proposal = compact({
    id: seqId('prp', sequence),
    requestId: requestId(requestKey),
    creatorId: creatorId(creatorKey),
    coverMessage,
    price,
    currency: CURRENCY,
    deliveryDays,
    revisionsIncluded: revisions,
    sampleItemIds: publishedItemIds(creatorKey, 2, sampleOffset),
    status,
    createdAt,
    respondedAt: respondedAt ?? null,
  })
  proposals.push(proposal)
  return proposal
}

/* Live board + closed request ------------------------------------------------ */

Object.entries(BOARD_PROPOSALS).forEach(([requestKey, offers]) => {
  const request = requestByKey(requestKey)
  offers.forEach((offer) => {
    const createdAt = addDays(request.publishedAt, offer.afterDays)
    const responded = offer.status === SUBMITTED ? null : addDays(createdAt, 0.5)
    addProposal({
      requestKey,
      creatorKey: offer.creator,
      price: offer.price,
      deliveryDays: offer.deliveryDays,
      revisions: offer.revisions,
      status: offer.status,
      coverMessage: offer.message,
      createdAt,
      respondedAt: responded,
    })
  })
})

/* Awarded scenario briefs ---------------------------------------------------- */

Object.entries(AWARD_PROPOSALS).forEach(([requestKey, award], index) => {
  const request = requestByKey(requestKey)
  const awardedAt = daysAgo(award.awardDaysAgo, 15, 20)

  const accepted = addProposal({
    requestKey,
    creatorKey: award.creator,
    price: award.price,
    deliveryDays: award.deliveryDays,
    revisions: award.revisions,
    status: ACCEPTED,
    coverMessage: award.message,
    createdAt: addDays(request.publishedAt, 1),
    respondedAt: awardedAt,
  })
  acceptedByRequestKey.set(requestKey, accepted)

  award.alsoDeclined.forEach((creatorKey, declinedIndex) => {
    addProposal({
      requestKey,
      creatorKey,
      price: award.price + 60 * (declinedIndex + 1),
      deliveryDays: award.deliveryDays + 2 + declinedIndex,
      revisions: 1,
      status: DECLINED,
      coverMessage: pick(DECLINED_MESSAGES, index + declinedIndex)(request),
      createdAt: addDays(request.publishedAt, 1.5 + declinedIndex * 0.5),
      respondedAt: awardedAt,
    })
  })
})

/* History engagements -------------------------------------------------------- */

/**
 * Creators eligible to have lost an archived brief. Only long-tenured accounts
 * qualify — Mateo and Ethan joined inside the last seven weeks, so they cannot
 * have proposed on a brief published months ago.
 */
const HISTORY_RUNNER_UP_POOL = [
  'zoe',
  'noah',
  'yuki',
  'amara',
  'diego',
  'sara',
  'isla',
  'liam',
]

/** First eligible runner-up that is not the creator who won the brief. */
function runnerUpFor(engagement, index) {
  for (let step = 0; step < HISTORY_RUNNER_UP_POOL.length; step += 1) {
    const candidate = pick(HISTORY_RUNNER_UP_POOL, Math.floor(index / 2) + step)
    if (candidate !== engagement.creator) return candidate
  }
  throw new Error(`No runner-up available for engagement ${engagement.key}`)
}

HISTORY_ENGAGEMENTS.forEach((engagement, index) => {
  const request = requestByKey(engagement.key)
  const awardedAt = daysAgo(engagement.createdDaysAgo, 15, 20)

  const accepted = addProposal({
    requestKey: engagement.key,
    creatorKey: engagement.creator,
    price: engagement.price,
    deliveryDays: engagement.deliveryDays,
    revisions: 2,
    status: ACCEPTED,
    coverMessage: pick(HISTORY_ACCEPTED_MESSAGES, index)(engagement),
    createdAt: addDays(request.publishedAt, 1),
    respondedAt: awardedAt,
  })
  acceptedByRequestKey.set(engagement.key, accepted)

  // Every second archived brief kept a losing offer on file.
  if (index % 2 === 0) {
    addProposal({
      requestKey: engagement.key,
      creatorKey: runnerUpFor(engagement, index),
      price: engagement.price + 90,
      deliveryDays: engagement.deliveryDays + 3,
      revisions: 1,
      status: DECLINED,
      coverMessage: pick(DECLINED_MESSAGES, index)(request),
      createdAt: addDays(request.publishedAt, 2),
      respondedAt: awardedAt,
    })
  }
})

/* Live board, appended by Prompt 21 ------------------------------------------ */

/**
 * Offers on the two briefs Prompt 21 added to the board, so the demo creator's
 * "Active proposals" tile has more than one row behind it and the new briefs
 * are not the only ones on the board with an empty proposal list.
 *
 * **Emitted last, not merged into `BOARD_PROPOSALS`**: proposal ids are handed
 * out in creation order, and adding rows to that object would renumber every
 * awarded and archived offer after it — including `prp_019`, which
 * `docs/api-contract.md` quotes. Appending here leaves every existing id
 * exactly where it was.
 */
const LATE_BOARD_PROPOSALS = {
  open_cocoa_truffle: [
    {
      creator: 'ava',
      price: 700,
      deliveryDays: 8,
      revisions: 2,
      status: SUBMITTED,
      afterDays: 1,
      message:
        'Chocolate is the hardest product I shoot and the one I enjoy most — it needs a cool room, fast work, and a light that shows the temper rather than blowing it out. I would photograph each piece straight on and cut, then build the packaging scenes and the full-collection flat lay from the same setup so the colour matches across all twenty-four frames.',
    },
    {
      creator: 'yuki',
      price: 640,
      deliveryDays: 11,
      revisions: 2,
      status: SUBMITTED,
      afterDays: 2,
      message:
        'Most of my work is tableware and interiors, so I light for texture and style with restraint — a good fit for the matte, tactile look in your brief. I would shoot on your own linens and boards and deliver both flat and lightly graded versions of every frame.',
    },
  ],
  open_craftware_giftset: [
    {
      creator: 'noah',
      price: 560,
      deliveryDays: 7,
      revisions: 2,
      status: SUBMITTED,
      afterDays: 1,
      message:
        'I shoot to marketplace specs every week, so the white-background frames will pass validation first time. Six sets at thirty frames is two studio days for me, and I would deliver the in-use frames from my own workbench under north light.',
    },
    {
      creator: 'ava',
      price: 690,
      deliveryDays: 9,
      revisions: 2,
      status: SHORTLISTED,
      afterDays: 2,
      message:
        'I have shot two packaging ranges for Craftware already, so I know the spec sheet and the square crop it wants. I would keep the hero and angle frames strictly to spec, and give the in-use frames enough warmth to work as social content as well as listings.',
    },
    {
      creator: 'ethan',
      price: 480,
      deliveryDays: 14,
      revisions: 1,
      status: SUBMITTED,
      afterDays: 3,
      message:
        'I am building out my BetterBlue portfolio and would put extra care into this one. Product work on white is straightforward for me, and I can turn revisions around the same day.',
    },
  ],
}

Object.entries(LATE_BOARD_PROPOSALS).forEach(([requestKey, offers]) => {
  const request = requestByKey(requestKey)
  offers.forEach((offer) => {
    const createdAt = addDays(request.publishedAt, offer.afterDays)
    addProposal({
      requestKey,
      creatorKey: offer.creator,
      price: offer.price,
      deliveryDays: offer.deliveryDays,
      revisions: offer.revisions,
      status: offer.status,
      coverMessage: offer.message,
      createdAt,
      respondedAt: offer.status === SUBMITTED ? null : addDays(createdAt, 0.5),
    })
  })
})

/* Live board, appended by Prompt 23 ------------------------------------------ */

/**
 * Offers on the two briefs Prompt 23 added to the board, so neither of the
 * newest requests reads as an empty board slot.
 *
 * **Ava is deliberately absent from both.** She is the demo creator, and the
 * acceptance walkthrough (§14) is "browse → open the invited request → submit
 * a proposal". A seeded offer from her on either brief would make the duplicate
 * guard fire on the very first step of the demo. Her invitation is on
 * `open_verde_invite_ava`, which is left entirely unanswered for that reason.
 *
 * Emitted last for the same id-stability reason as `LATE_BOARD_PROPOSALS`.
 */
const BOARD_PROPOSALS_23 = {
  open_verde_invite_ava: [
    {
      creator: 'amara',
      price: 1240,
      deliveryDays: 14,
      revisions: 2,
      status: SUBMITTED,
      afterDays: 1,
      message:
        'I shoot restaurant work as a single documentary pass rather than a stills day and a video day, which is what keeps the two sets looking like one launch. Two evening services, stills and verticals from the same setups, and everything graded together at the end.',
    },
  ],
  open_urbannest_studio: [
    {
      creator: 'yuki',
      price: 440,
      deliveryDays: 6,
      revisions: 2,
      status: SUBMITTED,
      afterDays: 1,
      message:
        'Small rooms are most of what I photograph, and the honest answer is that they read best on a longer lens from further back rather than on a wide angle from the doorway. I would shoot every set wide and at seating height in daylight, and add a fabric detail frame per piece.',
    },
    {
      creator: 'ethan',
      price: 380,
      deliveryDays: 9,
      revisions: 1,
      status: SUBMITTED,
      afterDays: 2,
      message:
        'I am building out my BetterBlue portfolio and interiors are where I want more work. Comfortable working to a floor plan and a shot list, and I can turn revisions around the same day.',
    },
  ],
}

Object.entries(BOARD_PROPOSALS_23).forEach(([requestKey, offers]) => {
  const request = requestByKey(requestKey)
  offers.forEach((offer) => {
    const createdAt = addDays(request.publishedAt, offer.afterDays)
    addProposal({
      requestKey,
      creatorKey: offer.creator,
      price: offer.price,
      deliveryDays: offer.deliveryDays,
      revisions: offer.revisions,
      status: offer.status,
      coverMessage: offer.message,
      createdAt,
      respondedAt: offer.status === SUBMITTED ? null : addDays(createdAt, 0.5),
    })
  })
})

export { proposals }

/** The accepted proposal for a request key — the order factory builds on it. */
export function acceptedProposalFor(requestKey) {
  const proposal = acceptedByRequestKey.get(requestKey)
  if (!proposal) throw new Error(`No accepted proposal for request: ${requestKey}`)
  return proposal
}
