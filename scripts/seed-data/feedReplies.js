// Seed: `feedReplies` — the Storefront V2 conversation a creator opens on a
// feed (prompts-v2/03 §1).
//
// **A reply is not a proposal.** Proposals are the priced, formal offer that
// runs the award → order → escrow workflow (`proposals`, contract §6.8, and
// every prompt from 18 onward). A reply is the informal, private message thread
// a creator starts under a feed on the public storefront — no price, no
// deliverables, no state machine, and nothing downstream depends on it. The two
// collections are independent on purpose and neither reads the other; see
// `docs/data-model.md` → `feedReplies`.
//
// **One reply per creator per feed**, and the thread inside it is private to
// that creator and the buyer who posted the feed. That is what makes the
// counts interesting and the privacy rule enforceable —
// `feedService.getMyReply` always filters by `creatorId`, and the Laravel API
// must scope the same query to the signed-in creator server-side.
//
// `contentRequests.repliesCount` is derived from this file in `seed-db.js`, so
// the number on a feed card and the threads under it cannot drift.

import { addHours, seqId } from '../seed-utils.js'
import { buyerProfiles, creatorDisplayName, creatorProfileId } from './profiles.js'
import { requestByKey, requestId } from './requests.js'
import { creatorId } from './users.js'

/** `users.id` → trading name, so a thread can address the buyer by name. */
const COMPANY_BY_USER = new Map(
  buyerProfiles.map((profile) => [profile.userId, profile.companyName])
)

/* -------------------------------------------------------------------------- */
/* Conversation templates                                                     */
/* -------------------------------------------------------------------------- */

/**
 * The shapes a first contact takes on a feed, written once and reused across
 * threads.
 *
 * Reuse is invisible in the product and deliberate here: a thread is private to
 * one creator and one buyer, so **no screen ever renders two of them side by
 * side**. Writing thirty-one unique conversations would spend a lot of copy on
 * something nobody can compare, and would make it harder to keep every thread
 * to the same professional register.
 *
 * Every template opens with the creator (a reply is something a creator starts)
 * and alternates from there. `creator` and `buyer` are the display names.
 */
const CONVERSATIONS = [
  {
    key: 'availability',
    messages: [
      ({ buyer }) =>
        `Hello ${buyer} team — this is close to the work I do most weeks, and the window in your brief is open in my calendar. I would plan a full day on site plus two days of editing, and deliver graded and flat versions of every frame.`,
      () =>
        'Thanks for coming back so quickly. The shot list is nearly final — we are still deciding whether the wider scenes are in scope. Could you hold the week either side while we confirm internally?',
      () =>
        'I can hold that week. If the wider scenes come in they add about half a day rather than a second visit, so the quote would barely move.',
      ({ creator }) =>
        `That is helpful, ${creator}. We will confirm the list in the next couple of days and come straight back to you.`,
    ],
  },
  {
    key: 'portfolio',
    messages: [
      ({ buyer }) =>
        `Hi — this sits squarely in what I shoot, and the most recent set on my profile was made for a brief very like ${buyer}'s. Happy to match your reference frames exactly if a like-for-like look is what you need.`,
      () =>
        'That set is close to what we had in mind. What turnaround would you expect from the shoot day itself?',
      () =>
        'First selects within forty-eight hours and the full graded delivery inside five working days. If you need a handful of frames sooner for the announcement, I can prioritise those.',
    ],
  },
  {
    key: 'scope',
    messages: [
      ({ buyer }) =>
        `Hello ${buyer} — I have read the brief twice and it is clear, which is rarer than it should be. One question before I quote: is the quantity you list the number of finished assets, or the number of set-ups?`,
      () =>
        'Finished assets. We would expect a few more set-ups than that to get there, and we are not counting the alternates.',
      () =>
        'Understood — that is the reading I hoped for. On that basis I would plan the day around the harder set-ups first and keep the simpler ones for the back half, so nothing important is shot against the clock.',
      () =>
        'That matches how the last shoot went. Send us your availability and we will look at dates.',
      () =>
        'I will put a note through with my open dates for the next three weeks. Two of them sit either side of your deadline, so there is room to move if the schedule slips at your end.',
    ],
  },
  {
    key: 'logistics',
    messages: [
      ({ buyer }) =>
        `Hi — I am interested in this one. Before anything else: is the location in your brief the only site, or would ${buyer} want the same treatment repeated elsewhere later?`,
      () =>
        'One site for now. If it goes well there is a good chance we repeat it at two more, but we are not committing to that in this brief.',
      () =>
        'Good to know. I will quote for the one site, and I will keep the set-up notes and settings so a repeat later matches rather than approximates.',
      () =>
        'That is exactly the sort of thing we were hoping to hear. Thank you.',
    ],
  },
  {
    key: 'licensing',
    messages: [
      () =>
        'Hello — the usage rights on this brief are clear, which makes quoting straightforward. I work to the terms as written and I clear any releases needed on the day rather than after it.',
      () =>
        'Good. We have been caught out before by releases arriving weeks later, so that matters to us more than it probably should.',
      () =>
        'It is worth caring about. Signed releases come back with the delivery, not separately, so the whole set is usable the moment you have it.',
    ],
  },
  {
    key: 'quote',
    messages: [
      ({ buyer }) =>
        `Hello ${buyer} — thank you for a brief with an actual budget on it. It is workable for the scope as written, and I would rather say that plainly than open with a number and negotiate down.`,
      () =>
        'Appreciated. Where would you expect the cost to move if we added a second day?',
      () =>
        'A second day is the day rate again, less the set-up, so it is not double. Editing scales with the number of finished frames rather than the days, so that part moves less than people expect.',
      () =>
        'That is clearer than the last three answers we have had to the same question. Is the second day something you would recommend?',
      () =>
        'Only if the list grows. For the scope you have written, one day is enough and a second would mostly buy alternates you will not use.',
      ({ creator }) =>
        `Noted, ${creator}. We will hold at one day and keep the option in reserve.`,
    ],
  },
  {
    key: 'intro',
    messages: [
      ({ buyer }) =>
        `Hi ${buyer} — I have shot this category for the last few years and the brief reads like something I could deliver without a discovery call. My recent work is on my profile if it is useful.`,
      () =>
        'Thank you for the note. We are reading through the replies this week and will come back to everyone either way.',
    ],
  },
  {
    key: 'crew',
    messages: [
      () =>
        'Hello — one practical note up front: for a brief this size I would bring an assistant, which is included in what I quote rather than added to it. It is the difference between finishing on the day and running over.',
      () =>
        'That is useful to know. Would the assistant need their own access pass for the site?',
      () =>
        'Yes, one extra name on the list. I will send both sets of details as soon as dates are agreed so nothing is held up at the door.',
      () =>
        'Perfect. Our operations team will want them a week ahead, which sounds like it fits.',
    ],
  },
  {
    key: 'deadline',
    messages: [
      ({ buyer }) =>
        `Hello — I can meet the deadline in this brief, and I would rather flag now than later that it is a firm date for me rather than a comfortable one. ${buyer} would have the full set on the day you have written.`,
      () =>
        'That honesty is welcome. Is there anything at our end that would put it at risk?',
      () =>
        'Only sign-off. If feedback on the first selects comes back within a day, the schedule holds comfortably.',
    ],
  },
  {
    key: 'revisions',
    messages: [
      () =>
        'Hi — I am keen on this one. My usual arrangement is one round of revisions on the graded set included, and I have found that is almost always enough when the brief is as specific as yours.',
      () =>
        'One round is standard for us too. What happens if we need a second?',
      () =>
        'A second round is charged at an hourly rate rather than as a new job, and I would tell you before starting it rather than after. It has come up twice in the last year.',
      ({ creator }) =>
        `Thanks ${creator} — that is a fair way to handle it. We will be in touch once the internal review is done.`,
    ],
  },
]

/* -------------------------------------------------------------------------- */
/* Assignments                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Which creators replied to which feed, in the order the threads were opened.
 *
 * The nine open feeds carry two to five replies each. Two feeds that are no
 * longer open carry threads as well, which is the point of seeding them: a
 * reply and a deal status are **independent** — a creator who replied while a
 * feed was live still has their conversation after the buyer has awarded the
 * work to someone (`awarded_verde_pastry`, which Ava went on to win) or after
 * it has been delivered (`completed_urbannest_loft`).
 *
 * Creators are matched to feeds by category and content type, the way a real
 * board would fill up. `hoursAfterPublish` spaces the first message of each
 * thread out behind the feed's publication, oldest first.
 */
const REPLY_SOURCE = [
  /* --- Open feeds --------------------------------------------------------- */
  { feed: 'open_verde_menu', creator: 'ava', conversation: 'availability', hoursAfterPublish: 5 },
  { feed: 'open_verde_menu', creator: 'chloe', conversation: 'portfolio', hoursAfterPublish: 21 },
  { feed: 'open_verde_menu', creator: 'noah', conversation: 'intro', hoursAfterPublish: 44 },

  { feed: 'open_nimbus_class', creator: 'diego', conversation: 'scope', hoursAfterPublish: 3 },
  { feed: 'open_nimbus_class', creator: 'sara', conversation: 'deadline', hoursAfterPublish: 19 },
  { feed: 'open_nimbus_class', creator: 'amara', conversation: 'intro', hoursAfterPublish: 40 },

  { feed: 'open_atlas_itinerary', creator: 'isla', conversation: 'logistics', hoursAfterPublish: 6 },
  { feed: 'open_atlas_itinerary', creator: 'mateo', conversation: 'quote', hoursAfterPublish: 26 },
  { feed: 'open_atlas_itinerary', creator: 'amara', conversation: 'crew', hoursAfterPublish: 47 },

  { feed: 'open_bloom_routine', creator: 'zoe', conversation: 'revisions', hoursAfterPublish: 4 },
  { feed: 'open_bloom_routine', creator: 'amara', conversation: 'portfolio', hoursAfterPublish: 27 },

  { feed: 'open_pulse_walkthrough', creator: 'liam', conversation: 'scope', hoursAfterPublish: 7 },
  { feed: 'open_pulse_walkthrough', creator: 'sara', conversation: 'licensing', hoursAfterPublish: 23 },

  { feed: 'open_cocoa_truffle', creator: 'ava', conversation: 'quote', hoursAfterPublish: 4 },
  { feed: 'open_cocoa_truffle', creator: 'chloe', conversation: 'crew', hoursAfterPublish: 18 },
  { feed: 'open_cocoa_truffle', creator: 'noah', conversation: 'licensing', hoursAfterPublish: 33 },
  { feed: 'open_cocoa_truffle', creator: 'yuki', conversation: 'intro', hoursAfterPublish: 49 },

  { feed: 'open_craftware_giftset', creator: 'noah', conversation: 'availability', hoursAfterPublish: 3 },
  { feed: 'open_craftware_giftset', creator: 'chloe', conversation: 'deadline', hoursAfterPublish: 16 },
  { feed: 'open_craftware_giftset', creator: 'ava', conversation: 'logistics', hoursAfterPublish: 30 },
  { feed: 'open_craftware_giftset', creator: 'yuki', conversation: 'portfolio', hoursAfterPublish: 45 },

  // This feed went up two days before the seed anchor, so its threads are the
  // short ones — a six-message conversation would run past "now".
  { feed: 'open_verde_invite_ava', creator: 'ava', conversation: 'portfolio', hoursAfterPublish: 2 },
  { feed: 'open_verde_invite_ava', creator: 'isla', conversation: 'licensing', hoursAfterPublish: 6 },
  { feed: 'open_verde_invite_ava', creator: 'amara', conversation: 'intro', hoursAfterPublish: 14 },

  { feed: 'open_urbannest_studio', creator: 'yuki', conversation: 'licensing', hoursAfterPublish: 5 },
  { feed: 'open_urbannest_studio', creator: 'isla', conversation: 'revisions', hoursAfterPublish: 20 },
  { feed: 'open_urbannest_studio', creator: 'ethan', conversation: 'intro', hoursAfterPublish: 38 },

  /* --- Feeds that have since moved on ------------------------------------- */
  { feed: 'awarded_verde_pastry', creator: 'ava', conversation: 'deadline', hoursAfterPublish: 6 },
  { feed: 'awarded_verde_pastry', creator: 'chloe', conversation: 'intro', hoursAfterPublish: 28 },

  { feed: 'completed_urbannest_loft', creator: 'yuki', conversation: 'crew', hoursAfterPublish: 8 },
  { feed: 'completed_urbannest_loft', creator: 'ethan', conversation: 'portfolio', hoursAfterPublish: 31 },
]

/* -------------------------------------------------------------------------- */
/* Assembly                                                                   */
/* -------------------------------------------------------------------------- */

/** Hours between consecutive messages in a thread, rotated by position. */
const MESSAGE_GAP_HOURS = [7, 15, 5, 21, 11]

const conversationByKey = new Map(
  CONVERSATIONS.map((conversation) => [conversation.key, conversation])
)

let messageSequence = 0

/**
 * One thread's messages: the creator opens, the buyer answers, and so on.
 *
 * @param {object} source a `REPLY_SOURCE` row
 * @param {string} openedAt ISO timestamp of the first message
 * @param {object} names `{ creator, buyer }` display names for the copy
 * @param {object} authors `{ creator, buyer }` `usr_…` ids
 * @returns {object[]} messages, oldest first
 */
function buildMessages(source, openedAt, names, authors) {
  const conversation = conversationByKey.get(source.conversation)
  if (!conversation) {
    throw new Error(`Unknown conversation template: ${source.conversation}`)
  }

  let at = openedAt
  return conversation.messages.map((body, index) => {
    if (index > 0) {
      at = addHours(at, MESSAGE_GAP_HOURS[(index - 1) % MESSAGE_GAP_HOURS.length])
    }
    const isCreator = index % 2 === 0
    messageSequence += 1
    return {
      id: seqId('frm', messageSequence),
      authorRole: isCreator ? 'creator' : 'buyer',
      // The **account** that wrote the message, always a `usr_…`, exactly as
      // `disputeMessages.authorId` is. The thread's `creatorId` is the
      // storefront (`cpr_…`) the reply belongs to; the author is the person.
      authorId: isCreator ? authors.creator : authors.buyer,
      body: body(names),
      at,
    }
  })
}

export const feedReplies = REPLY_SOURCE.map((source, index) => {
  const feed = requestByKey(source.feed)
  const openedAt = addHours(feed.publishedAt, source.hoursAfterPublish)

  const messages = buildMessages(
    source,
    openedAt,
    {
      creator: creatorDisplayName(source.creator),
      buyer: COMPANY_BY_USER.get(feed.buyerId) ?? 'the buyer',
    },
    { creator: creatorId(source.creator), buyer: feed.buyerId }
  )

  return {
    id: seqId('frp', index + 1),
    feedId: requestId(source.feed),
    // The storefront, not the account — a reply belongs to the profile a buyer
    // clicks through to, the same way `portfolioItems.creatorId` does.
    creatorId: creatorProfileId(source.creator),
    buyerId: feed.buyerId,
    messages,
    createdAt: openedAt,
    updatedAt: messages[messages.length - 1].at,
  }
})

/** Reply threads per feed id — `seed-db.js` derives `repliesCount` from this. */
export const REPLIES_BY_FEED = feedReplies.reduce((counts, reply) => {
  counts.set(reply.feedId, (counts.get(reply.feedId) ?? 0) + 1)
  return counts
}, new Map())
