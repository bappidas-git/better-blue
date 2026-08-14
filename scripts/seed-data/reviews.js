// Seed: `reviews` — the buyer's rating of a completed engagement
// (Prompt 05 §4.3).
//
// One review per completed order, left a couple of days after acceptance.
// Two archived orders were never reviewed, which is what keeps a creator's
// `ratingCount` and `completedOrders` legitimately different — both figures
// are recomputed from this collection and from `orders` in `seed-db.js`.
//
// Ratings are only ever left by the buyer on the order, so a review always
// resolves to the same buyer, creator, and request as its order.

import { addDays, seqId } from '../seed-utils.js'
import { orderFor } from './orders.js'

/** `{ requestKey, rating, comment, afterDays }` — keyed by the order's brief. */
const REVIEW_SOURCE = [
  {
    requestKey: 'h02',
    rating: 5,
    comment:
      'Liam wrote to our release notes, not just to the camera. The walkthrough needed one small wording change and nothing else, and the open-caption version was ready the same day.',
  },
  {
    requestKey: 'h03',
    rating: 5,
    comment:
      'Shade accuracy was spot on across all eighteen frames, which is the whole job with a serum launch. Dropped straight into the product pages with no re-grading.',
  },
  {
    requestKey: 'h04',
    rating: 4,
    comment:
      'Good energy in all three promos and the coaching cues are clear. Delivery ran a day past the agreed date, but Diego flagged it early and we still made the schedule.',
  },
  {
    requestKey: 'h05',
    rating: 5,
    comment:
      'Isla travelled with the group for five days and came back with a set we are still using across brochures and social. Every frame leaves room for our itinerary overlay, exactly as briefed.',
  },
  {
    requestKey: 'h07',
    rating: 5,
    comment:
      'Beautifully calm room sets that make a small bedroom read generously without exaggerating it. Yuki styled on set and saved us a separate stylist fee.',
  },
  {
    requestKey: 'h08',
    rating: 5,
    comment:
      'Amara turned two days of booth footage into a recap film our sales team actually sends to prospects. Fast, professional, and easy to brief.',
  },
  {
    requestKey: 'h09',
    rating: 4,
    comment:
      'Lovely natural light on the refill range and the sequence frames explain the product well. A couple of frames needed a straighten, handled within the revision round.',
  },
  {
    requestKey: 'h10',
    rating: 5,
    comment:
      'Three reels, all under the length limit, all captioned correctly, delivered a day early. Ava knows how a kitchen works and never got in the way of service.',
  },
  {
    requestKey: 'h11',
    rating: 4,
    comment:
      'Clear, well-paced explainers that our new members actually finish. We would have liked one more variation for the app tour, but that was outside the agreed scope.',
  },
  {
    requestKey: 'h12',
    rating: 5,
    comment:
      'Two guesthouses covered in a single trip with consistent light across both. Isla is the first person we call for property work now.',
  },
  {
    requestKey: 'h13',
    rating: 4,
    comment:
      'The demonstration films do the job and the safety equipment is visible throughout, which matters to us. Audio needed a pass in the second film.',
  },
  {
    requestKey: 'h14',
    rating: 4,
    comment:
      'Consistent camera height across twenty-six frames made the catalogue refresh painless. One finish needed a re-grade, turned around quickly.',
  },
  {
    requestKey: 'h15',
    rating: 5,
    comment:
      'The hamper range has never looked better. Warm, tactile, and the closed-box frames keep our branding fully legible for the storefront.',
  },
  {
    requestKey: 'h16',
    rating: 5,
    comment:
      'Our customer was comfortable on camera within minutes, which is most of the battle with a story film. The final cut has been our best-performing page asset this quarter.',
  },
  {
    requestKey: 'h17',
    rating: 4,
    comment:
      'Well produced and fully compliant with our claims list. The pacing in the middle section runs slightly long for paid social, so we trimmed it in-house.',
  },
  {
    requestKey: 'h18',
    rating: 3,
    comment:
      'The finished frames are good, but the delivery arrived at the end of the agreed window with little communication in between. The work itself met the brief.',
  },
  {
    requestKey: 'h19',
    rating: 5,
    comment:
      'Diego filmed four machines in one session and the form on camera is correct in every clip. Our coaches signed these off without a single note.',
  },
  {
    requestKey: 'h20',
    rating: 5,
    comment:
      'Thirty-five usable frames from a single showcase day, including partner stands and genuine guest moments. Releases were handled without us having to ask.',
  },
  {
    requestKey: 'h21',
    rating: 5,
    comment:
      'Twenty SKUs shot to the same template, so the accessory range finally reads as one family on the listing pages. Exactly what we needed.',
  },
  {
    requestKey: 'h22',
    rating: 5,
    comment:
      'Sara scripted, presented, and edited the whole onboarding set. New kitchen staff now watch five short films instead of reading a folder, and it shows.',
  },
  {
    requestKey: 'h23',
    rating: 4,
    comment:
      'Sharp teaser and delivered ahead of the launch date. We asked for a second edit late in the process and that sat outside the revision allowance, fairly enough.',
  },
  {
    requestKey: 'h24',
    rating: 4,
    comment:
      'Great coverage of the opening night and the queue-outside-the-door shot is now our hero image. A few frames were softer than the rest of the set.',
  },
  {
    requestKey: 'completed_bloom_campaign',
    rating: 5,
    comment:
      'Zoe caught a compliance issue we had missed ourselves and fixed all three masters inside a day. Calm, precise, and the campaign film outperformed the last one.',
    afterDays: 2,
  },
  {
    requestKey: 'completed_atlas_villa',
    rating: 3,
    comment:
      'Solid photography and the twilight exteriors are lovely, but two bedrooms were missing from the set and it took a dispute to settle it. Mateo was reasonable throughout and we would consider working together again on a smaller brief.',
    afterDays: 3,
  },
  {
    requestKey: 'completed_urbannest_loft',
    rating: 4,
    comment:
      'The showroom set is excellent and the storefront frame turned out to be sharp after all — that one was on us. Yuki was patient while we checked and the files are print-ready.',
    afterDays: 2,
  },
]

export const reviews = REVIEW_SOURCE.map((source, index) => {
  const order = orderFor(source.requestKey)
  return {
    id: seqId('rvw', index + 1),
    orderId: order.id,
    requestId: order.requestId,
    buyerId: order.buyerId,
    creatorId: order.creatorId,
    rating: source.rating,
    comment: source.comment,
    createdAt: addDays(order.completedAt, source.afterDays ?? 2),
  }
})
