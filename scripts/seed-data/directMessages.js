// Seed: `directMessages` — the opening message a buyer sends a creator from the
// public creators page (Storefront V2, prompts-v2/09 §4).
//
// **The simplest record in the database.** One row is one message: who sent it,
// which storefront it went to, what it said, and when. There is no thread, no
// status, and no read flag, because a first contact is not a conversation yet —
// `directMessagesService.sendMessage` writes one of these and raises a
// `direct_message_received` notification, and that is the whole of the feature.
//
// **A message is not a feed reply and not a proposal.** A reply travels
// creator → buyer under a brief (`feedReplies`); a proposal is a priced offer
// on one (`proposals`). This travels buyer → creator, attached to no brief at
// all: it is somebody who saw a storefront and wants to talk about work that
// has not been written down yet. See `docs/data-model.md` → `directMessages`.
//
// **Honest limitation:** nothing renders these yet. The creator-side inbox is
// future work, so the seeded rows exist to give that screen something real to
// open on — and to prove the collection's shape now rather than later.

import { daysAgo, seqId } from '../seed-utils.js'
import { creatorProfileId } from './profiles.js'
import { buyerId } from './users.js'

/**
 * Eight first contacts, written the way a business actually opens one: what
 * they sell, what they need shot, roughly when, and a question the creator can
 * answer. Six buyers, seven storefronts, and one creator (`ava`) contacted
 * twice — because a busy storefront gets more than one of these, and the inbox
 * that eventually reads them should not be built against a list where every
 * row is from a different person.
 *
 * `daysAgo` values stay inside the seed window and, more particularly, after
 * the sender's account was opened — `harborlane` joined two days before the
 * anchor, so its message is the most recent one here. The seed validator
 * enforces both.
 */
const MESSAGES = [
  {
    buyer: 'verde',
    creator: 'ava',
    daysAgo: 3,
    hour: 10,
    body:
      'Hello Ava — we run a small group of neighbourhood restaurants and are refreshing our menu photography before the autumn launch. Roughly twenty dishes across two sites, shot in daylight. Would that fit a single day with you, and is early October still open?',
  },
  {
    buyer: 'nimbus',
    creator: 'liam',
    daysAgo: 5,
    hour: 14,
    body:
      'Hi Liam — Nimbus Fitness here. We are putting together a short campaign film for our new class timetable and liked the pacing in your studio work. We have the space for a half day and would need a sixty-second cut plus vertical versions. Could you share your availability?',
  },
  {
    buyer: 'atlas',
    creator: 'zoe',
    daysAgo: 7,
    hour: 9,
    body:
      'Good morning Zoe — Atlas Travel. We are commissioning hotel and destination stills for next season’s brochure and website. Six properties, spread over three weeks, all interiors and exteriors. Do you take multi-location bookings, and would you quote per property or per day?',
  },
  {
    buyer: 'bloom',
    creator: 'ava',
    daysAgo: 9,
    hour: 16,
    body:
      'Hi Ava — Bloom Beauty. We are launching a skincare range in November and need clean product stills on a neutral set, plus a handful of lifestyle frames for social. Is that something you shoot in studio, and what does your usual turnaround look like?',
  },
  {
    buyer: 'craftware',
    creator: 'noah',
    daysAgo: 12,
    hour: 11,
    body:
      'Hello Noah — Craftware Tools. We make hand tools for trade customers and want short demonstration videos, one per product, filmed on a workbench. Around eight in total. Would you be able to keep a consistent look across them if we film in batches?',
  },
  {
    buyer: 'urbannest',
    creator: 'yuki',
    daysAgo: 16,
    hour: 13,
    body:
      'Hi Yuki — Urban Nest. We are photographing three furnished apartments for a new listing page and admired the way you light interiors. Natural light where possible, and we would need both wide room shots and detail frames. Are you taking bookings for next month?',
  },
  {
    buyer: 'cocoa',
    creator: 'amara',
    daysAgo: 21,
    hour: 15,
    body:
      'Hello Amara — Cocoa & Co. We are a small chocolate maker preparing a gifting campaign. What we need most is a set of warm, textured product photographs and one short film of the wrapping process. Could you tell us what a package like that usually costs?',
  },
  {
    buyer: 'harborlane',
    creator: 'isla',
    daysAgo: 1,
    hour: 12,
    body:
      'Hi Isla — we are a new account here, opening a coastal cafe next spring and starting our marketing from nothing. Interiors, a few plates, and one short film for the launch. Where would you suggest a business at this stage begins?',
  },
]

export const directMessages = MESSAGES.map((message, index) => ({
  id: seqId('dm', index + 1),
  buyerId: buyerId(message.buyer),
  creatorId: creatorProfileId(message.creator),
  body: message.body,
  createdAt: daysAgo(message.daysAgo, message.hour, (index * 7) % 60),
}))

export default directMessages
