// Seed: `portfolioItems` — creator sample work (Prompt 05 §4.3).
//
// Items are grouped by creator and ordered oldest first. Statuses cover the
// whole CONTENT_STATUS lifecycle so the moderation queue (Prompt 30) has real
// work waiting: most items are published, with submitted / under review /
// changes requested / rejected items on top, plus one restricted item (acted
// on after a member report) and one archived item.
//
// All copy is commercial marketplace work — menu photography, product sets,
// listing walkthroughs (00 §1).

import { CATEGORY_ID } from '../../src/constants/categoriesFallback.js'
import { REJECTION_REASON_CODE } from '../../src/constants/policy.js'
import { CONTENT_STATUS, CONTENT_TYPE } from '../../src/constants/statuses.js'
import { imageUrl, IMAGE_SIZES } from '../../src/constants/images.js'
import {
  MEDIA_TYPE,
  VISIBILITY,
  addDays,
  compact,
  daysAgo,
  seqId,
} from '../seed-utils.js'
import { CREATOR_TENURE_DAYS, creatorProfileId } from './profiles.js'

const { PHOTO, VIDEO, BUNDLE } = CONTENT_TYPE

/**
 * Portfolio source, keyed by creator. Fields: title, description, category,
 * contentType, tags, status (defaults to `published`), visibility (defaults to
 * `public`), and an optional rejection note.
 */
const PORTFOLIO_SOURCE = {
  ava: [
    {
      title: 'Seasonal menu photography for a farm-to-table dinner service',
      description:
        'Eighteen plated dishes shot across one service, styled on the restaurant’s own tableware and delivered in both editorial and menu-card crops.',
      category: CATEGORY_ID.FOOD_BEVERAGE,
      contentType: PHOTO,
      tags: ['restaurant', 'menu', 'food styling', 'seasonal'],
    },
    {
      title: '30-second smoothie promo reel for a juice bar',
      description:
        'Vertical reel built around pour shots and fruit prep, cut to a licensed track with on-screen pricing for a summer launch.',
      category: CATEGORY_ID.FOOD_BEVERAGE,
      contentType: VIDEO,
      tags: ['reel', 'beverage', 'social', 'vertical'],
    },
    {
      title: 'Flat-lay packaging set for a cold-brew coffee launch',
      description:
        'Twelve flat-lay and hero frames of a new bottle range, shot on three surfaces so the brand could split-test creative on paid social.',
      category: CATEGORY_ID.ECOMMERCE_PRODUCTS,
      contentType: PHOTO,
      tags: ['packaging', 'flat lay', 'product', 'launch'],
    },
    {
      title: 'Hands-on pasta plating film for a restaurant group',
      description:
        'Close-focus kitchen film following one dish from pan to pass, delivered as a 45-second hero cut plus three vertical cutdowns.',
      category: CATEGORY_ID.FOOD_BEVERAGE,
      contentType: VIDEO,
      tags: ['kitchen', 'process', 'restaurant', 'short form'],
    },
    {
      title: 'Gift-box product bundle stills for a specialty grocer',
      description:
        'Holiday gifting range photographed as complete boxes and individual components, with white-background cutouts for the storefront.',
      category: CATEGORY_ID.ECOMMERCE_PRODUCTS,
      contentType: PHOTO,
      tags: ['gifting', 'ecommerce', 'product', 'holiday'],
    },
    {
      title: 'Barista process film for a seasonal drinks menu',
      description:
        'Counter-level film following three seasonal drinks from build to serve, cut as one hero film and three vertical menu teasers.',
      category: CATEGORY_ID.FOOD_BEVERAGE,
      contentType: VIDEO,
      tags: ['cafe', 'process', 'seasonal', 'short form'],
    },
    {
      title: 'Ingredient sourcing stills for a supplier story page',
      description:
        'Farm and market visit documented alongside the kitchen prep it feeds, shot for a restaurant group’s sourcing page.',
      category: CATEGORY_ID.FOOD_BEVERAGE,
      contentType: PHOTO,
      tags: ['sourcing', 'documentary', 'restaurant', 'story'],
    },
    {
      title: 'Ceramic serveware tabletop set for a homeware launch',
      description:
        'Full serveware range styled as complete table settings and as individual pieces, with matched cutouts for the product grid.',
      category: CATEGORY_ID.ECOMMERCE_PRODUCTS,
      contentType: PHOTO,
      tags: ['tabletop', 'serveware', 'styling', 'launch'],
    },
    {
      title: 'Bakery counter lifestyle set for a cafe group',
      description:
        'Morning service photographed across two sites — counter displays, pastry detail, and unposed customer moments cleared for use.',
      category: CATEGORY_ID.FOOD_BEVERAGE,
      contentType: PHOTO,
      tags: ['bakery', 'lifestyle', 'cafe', 'in situ'],
    },
  ],
  liam: [
    {
      title: 'Two-minute product walkthrough for a scheduling platform',
      description:
        'Scripted walkthrough of the shift-planning flow, combining screen capture, motion callouts, and a presenter segment recorded in studio.',
      category: CATEGORY_ID.TECHNOLOGY_SAAS,
      contentType: VIDEO,
      tags: ['product demo', 'saas', 'screen capture', 'explainer'],
    },
    {
      title: 'Customer story film with a hospitality operations lead',
      description:
        'On-site interview and b-roll shoot at a restaurant group, edited into a 90-second story film for the customer page.',
      category: CATEGORY_ID.TECHNOLOGY_SAAS,
      contentType: VIDEO,
      tags: ['case study', 'interview', 'b-roll', 'b2b'],
      visibility: VISIBILITY.UNLISTED,
    },
    {
      title: 'Feature launch teaser cut for a mobile release',
      description:
        'Fifteen-second teaser announcing a mobile app release, delivered in square and vertical with captions burned in.',
      category: CATEGORY_ID.TECHNOLOGY_SAAS,
      contentType: VIDEO,
      tags: ['teaser', 'launch', 'mobile', 'social'],
    },
    {
      title: 'Onboarding explainer series for a payroll tool',
      description:
        'Four-part explainer series covering account setup through first pay run, scripted for a support centre and in-app tours.',
      category: CATEGORY_ID.EDUCATION_COACHING,
      contentType: BUNDLE,
      tags: ['onboarding', 'explainer', 'series', 'support'],
    },
    {
      title: 'Conference booth recap film for a software trade show',
      description:
        'Two-day event coverage cut into a recap film for post-show follow-up, plus stills of the booth and demo stations.',
      category: CATEGORY_ID.TECHNOLOGY_SAAS,
      contentType: VIDEO,
      tags: ['event', 'recap', 'trade show', 'b2b'],
      status: CONTENT_STATUS.UNDER_REVIEW,
    },
    {
      title: 'Integration launch film for a payments partnership',
      description:
        'Joint launch film explaining a payments integration end to end, approved by both brands and delivered with co-branded end cards.',
      category: CATEGORY_ID.TECHNOLOGY_SAAS,
      contentType: VIDEO,
      tags: ['integration', 'launch', 'partnership', 'b2b'],
    },
    {
      title: 'Admin training bundle for a rollout programme',
      description:
        'Six short admin training films plus a printable quick-reference set, produced for a multi-site software rollout.',
      category: CATEGORY_ID.EDUCATION_COACHING,
      contentType: BUNDLE,
      tags: ['training', 'rollout', 'series', 'enablement'],
    },
  ],
  zoe: [
    {
      title: 'Texture and swatch photography for a tinted moisturiser range',
      description:
        'Macro swatch and texture frames across eight shades, matched to the brand’s existing colour profile for consistent e-commerce listings.',
      category: CATEGORY_ID.BEAUTY_SKINCARE,
      contentType: PHOTO,
      tags: ['macro', 'swatch', 'skincare', 'ecommerce'],
    },
    {
      title: 'Morning routine explainer for a clean skincare brand',
      description:
        'Three-step routine film shot in natural light with a licensed presenter, delivered with captions and a 15-second paid-social cut.',
      category: CATEGORY_ID.BEAUTY_SKINCARE,
      contentType: VIDEO,
      tags: ['routine', 'explainer', 'skincare', 'captions'],
    },
    {
      title: 'Autumn lookbook stills for an independent knitwear label',
      description:
        'Twenty-four looks photographed over two studio days, with model releases cleared for paid and organic use.',
      category: CATEGORY_ID.FASHION_APPAREL,
      contentType: PHOTO,
      tags: ['lookbook', 'knitwear', 'studio', 'campaign'],
    },
    {
      title: 'Studio campaign film for a sustainable denim drop',
      description:
        'Campaign film for a denim capsule, cut as a 30-second hero with vertical and square variants for the launch week schedule.',
      category: CATEGORY_ID.FASHION_APPAREL,
      contentType: VIDEO,
      tags: ['campaign', 'denim', 'studio', 'launch'],
    },
    {
      title: 'Refill pouch product set for a haircare relaunch',
      description:
        'Refill and full-size packaging photographed together to show the range, with sustainability messaging composited in post.',
      category: CATEGORY_ID.BEAUTY_SKINCARE,
      contentType: PHOTO,
      tags: ['packaging', 'haircare', 'refill', 'product'],
      status: CONTENT_STATUS.SUBMITTED,
    },
    {
      title: 'Fragrance launch still life for a boutique perfumer',
      description:
        'Bottle and packaging still life for a three-scent launch, lit to hold the glass edges without losing the label copy.',
      category: CATEGORY_ID.BEAUTY_SKINCARE,
      contentType: PHOTO,
      tags: ['fragrance', 'still life', 'glass', 'launch'],
    },
    {
      title: 'Accessory styling film for a spring apparel drop',
      description:
        'Styling film pairing accessories with the season’s core apparel, delivered as a hero cut plus six product-tagged verticals.',
      category: CATEGORY_ID.FASHION_APPAREL,
      contentType: VIDEO,
      tags: ['styling', 'accessories', 'spring', 'social'],
    },
  ],
  diego: [
    {
      title: 'Class highlight reel for a strength studio',
      description:
        'Single-session coverage of a 45-minute class, edited into a highlight reel used for membership advertising.',
      category: CATEGORY_ID.FITNESS_WELLNESS,
      contentType: VIDEO,
      tags: ['gym', 'class', 'highlight', 'membership'],
    },
    {
      title: 'Kettlebell technique explainer series',
      description:
        'Six technique films covering setup, swing, and recovery, shot from three angles with voiceover coaching cues.',
      category: CATEGORY_ID.FITNESS_WELLNESS,
      contentType: VIDEO,
      tags: ['technique', 'coaching', 'series', 'equipment'],
    },
    {
      title: 'Home treadmill assembly and first-run demo',
      description:
        'Assembly walkthrough and first-run demonstration filmed for a product listing, with timestamps for the support article.',
      category: CATEGORY_ID.ECOMMERCE_PRODUCTS,
      contentType: VIDEO,
      tags: ['assembly', 'demo', 'home fitness', 'listing'],
    },
    {
      title: 'Recovery routine short for a wellness app',
      description:
        'Vertical short covering a ten-minute mobility routine, produced as in-app content and a social teaser.',
      category: CATEGORY_ID.FITNESS_WELLNESS,
      contentType: VIDEO,
      tags: ['mobility', 'wellness', 'vertical', 'app'],
    },
    {
      title: 'Resistance band range demonstration set',
      description:
        'Demonstration films for a five-strength band range, showing correct anchoring and progression for each level.',
      category: CATEGORY_ID.ECOMMERCE_PRODUCTS,
      contentType: VIDEO,
      tags: ['equipment', 'demo', 'range', 'product'],
      status: CONTENT_STATUS.REVISION_REQUIRED,
    },
  ],
  isla: [
    {
      title: 'Coastal itinerary photography for a small-group tour',
      description:
        'Five-day itinerary documented end to end, delivered as a destination set the operator reuses across brochures and social.',
      category: CATEGORY_ID.TRAVEL_HOSPITALITY,
      contentType: PHOTO,
      tags: ['destination', 'itinerary', 'coastal', 'tour'],
    },
    {
      title: 'Boutique hotel room and amenity set',
      description:
        'Room categories, spa, and breakfast service photographed in one visit for a property’s booking pages.',
      category: CATEGORY_ID.TRAVEL_HOSPITALITY,
      contentType: PHOTO,
      tags: ['hotel', 'interiors', 'amenities', 'booking'],
    },
    {
      title: 'Harbour town walking film for a destination campaign',
      description:
        'Walking-pace destination film paired with a matching stills set, produced for a regional tourism campaign.',
      category: CATEGORY_ID.TRAVEL_HOSPITALITY,
      contentType: BUNDLE,
      tags: ['destination', 'film', 'tourism', 'bundle'],
    },
    {
      title: 'Cabin interior series for a lakeside rental portfolio',
      description:
        'Interior and exterior series for eight rental cabins, shot at consistent times of day for a uniform listing look.',
      category: CATEGORY_ID.HOME_LIFESTYLE,
      contentType: PHOTO,
      tags: ['rental', 'interiors', 'cabin', 'listing'],
    },
    {
      title: 'Winter market destination stills for a tourism board',
      description:
        'Seasonal market coverage from a 2023 campaign, retired from the live portfolio now the licence window has closed.',
      category: CATEGORY_ID.TRAVEL_HOSPITALITY,
      contentType: PHOTO,
      tags: ['seasonal', 'market', 'tourism', 'archive'],
      status: CONTENT_STATUS.ARCHIVED,
    },
  ],
  noah: [
    {
      title: 'Studio detail photography for an electric hatchback listing',
      description:
        'Exterior, interior, and charging-port detail frames shot on a controlled studio sweep for a dealership listing refresh.',
      category: CATEGORY_ID.AUTOMOTIVE,
      contentType: PHOTO,
      tags: ['automotive', 'studio', 'listing', 'electric'],
    },
    {
      title: 'Rolling footage package for a dealership launch event',
      description:
        'Tracking and rolling footage captured on a closed route, cut into a launch film plus three social edits.',
      category: CATEGORY_ID.AUTOMOTIVE,
      contentType: VIDEO,
      tags: ['rolling', 'launch', 'dealership', 'film'],
    },
    {
      title: 'Tool bag product set for an online hardware store',
      description:
        'Full range photographed loaded and empty, with cutouts and lifestyle context frames for marketplace listings.',
      category: CATEGORY_ID.ECOMMERCE_PRODUCTS,
      contentType: PHOTO,
      tags: ['tools', 'product', 'cutout', 'marketplace'],
    },
    {
      title: 'Roof rack fitment demonstration film',
      description:
        'Step-by-step fitment demonstration across two vehicle types, produced for the manufacturer’s support pages.',
      category: CATEGORY_ID.AUTOMOTIVE,
      contentType: VIDEO,
      tags: ['fitment', 'demo', 'accessories', 'support'],
    },
    {
      title: 'Tyre range catalogue stills',
      description:
        'Twenty-two SKUs photographed to a fixed template so the catalogue reads consistently across sizes.',
      category: CATEGORY_ID.AUTOMOTIVE,
      contentType: PHOTO,
      tags: ['catalogue', 'template', 'range', 'product'],
    },
  ],
  yuki: [
    {
      title: 'Natural-light room set for a small-space sofa range',
      description:
        'Three styled room sets built in studio to show a compact sofa range in realistic apartment proportions.',
      category: CATEGORY_ID.HOME_LIFESTYLE,
      contentType: PHOTO,
      tags: ['furniture', 'room set', 'styling', 'natural light'],
    },
    {
      title: 'Ceramic tableware collection on linen',
      description:
        'Full tableware collection photographed as a group and in individual detail, styled on undyed linen.',
      category: CATEGORY_ID.HOME_LIFESTYLE,
      contentType: PHOTO,
      tags: ['tableware', 'ceramics', 'detail', 'collection'],
    },
    {
      title: 'Two-bedroom apartment listing photography',
      description:
        'Full listing set including wide room frames, balcony aspect, and building amenities, delivered next morning.',
      category: CATEGORY_ID.REAL_ESTATE,
      contentType: PHOTO,
      tags: ['listing', 'apartment', 'real estate', 'wide'],
    },
    {
      title: 'Show home styling series for a developer',
      description:
        'Styled show home shot across two floors for a development launch, with a matching floor-plan-friendly wide set.',
      category: CATEGORY_ID.REAL_ESTATE,
      contentType: PHOTO,
      tags: ['show home', 'development', 'styling', 'launch'],
      visibility: VISIBILITY.UNLISTED,
    },
    {
      title: 'Storage furniture detail set for a catalogue refresh',
      description:
        'Work in progress for an upcoming catalogue: joinery, finish, and hardware detail frames across the storage range.',
      category: CATEGORY_ID.HOME_LIFESTYLE,
      contentType: PHOTO,
      tags: ['storage', 'detail', 'catalogue', 'furniture'],
      status: CONTENT_STATUS.DRAFT,
    },
  ],
  amara: [
    {
      title: 'Resort collection lookbook on location',
      description:
        'Thirty-look resort lookbook photographed over two location days, with full model and location releases on file.',
      category: CATEGORY_ID.FASHION_APPAREL,
      contentType: PHOTO,
      tags: ['lookbook', 'resort', 'location', 'campaign'],
    },
    {
      title: 'Runway recap film for a city fashion week',
      description:
        'Multi-camera runway coverage cut into a two-minute recap and a set of vertical designer highlights.',
      category: CATEGORY_ID.EVENTS_ENTERTAINMENT,
      contentType: VIDEO,
      tags: ['runway', 'recap', 'multi-camera', 'fashion week'],
    },
    {
      title: 'Accessories campaign stills for a leather goods label',
      description:
        'Bags and small leather goods photographed on figure and as still life, matched to the season’s campaign palette.',
      category: CATEGORY_ID.FASHION_APPAREL,
      contentType: PHOTO,
      tags: ['accessories', 'leather', 'campaign', 'still life'],
    },
    {
      title: 'Festival brand activation highlight film',
      description:
        'Brand activation coverage across a three-day festival, delivered as a sponsor recap film with usage rights for paid media.',
      category: CATEGORY_ID.EVENTS_ENTERTAINMENT,
      contentType: VIDEO,
      tags: ['activation', 'festival', 'sponsor', 'recap'],
    },
    {
      title: 'Tailoring atelier process film',
      description:
        'Craft-focused process film following a jacket from pattern to final press, produced for a heritage brand’s about page.',
      category: CATEGORY_ID.FASHION_APPAREL,
      contentType: VIDEO,
      tags: ['craft', 'process', 'tailoring', 'brand film'],
    },
  ],
  sara: [
    {
      title: 'Course module explainer with motion graphics',
      description:
        'Twelve-minute course module combining presenter segments and animated diagrams, delivered with a caption file.',
      category: CATEGORY_ID.EDUCATION_COACHING,
      contentType: VIDEO,
      tags: ['course', 'motion graphics', 'presenter', 'captions'],
    },
    {
      title: 'Screen-capture tutorial series for a design tool',
      description:
        'Eight short tutorials recorded at retina resolution, scripted so each one stands alone in the help centre.',
      category: CATEGORY_ID.TECHNOLOGY_SAAS,
      contentType: VIDEO,
      tags: ['tutorial', 'screen capture', 'help centre', 'series'],
    },
    {
      title: 'Coaching programme welcome video',
      description:
        'Warm, direct-to-camera welcome film for a professional coaching programme, with a branded lower-third package.',
      category: CATEGORY_ID.EDUCATION_COACHING,
      contentType: VIDEO,
      tags: ['welcome', 'coaching', 'branding', 'presenter'],
    },
    {
      title: 'Localised caption package for a language platform',
      description:
        'Existing lesson films re-versioned with localised captions and on-screen text in four languages.',
      category: CATEGORY_ID.EDUCATION_COACHING,
      contentType: VIDEO,
      tags: ['localisation', 'captions', 'lessons', 'accessibility'],
    },
    {
      title: 'Analytics dashboard feature explainer',
      description:
        'Feature explainer walking through a reporting dashboard, built from a clickable prototype ahead of general release.',
      category: CATEGORY_ID.TECHNOLOGY_SAAS,
      contentType: VIDEO,
      tags: ['analytics', 'feature', 'explainer', 'saas'],
      status: CONTENT_STATUS.SUBMITTED,
    },
  ],
  chloe: [
    {
      title: 'Serum bottle still life on stone',
      description:
        'Amber serum bottles photographed on textured stone in raking window light, delivered flat and lightly graded.',
      category: CATEGORY_ID.BEAUTY_SKINCARE,
      contentType: PHOTO,
      tags: ['serum', 'still life', 'natural light', 'skincare'],
    },
    {
      title: 'Refillable packaging range set',
      description:
        'Refillable jars and pouches photographed as a family, showing the refill step in three sequential frames.',
      category: CATEGORY_ID.ECOMMERCE_PRODUCTS,
      contentType: PHOTO,
      tags: ['refill', 'packaging', 'sustainability', 'product'],
    },
    {
      title: 'Bath and body gift set stills',
      description:
        'Gift set photographed boxed and unboxed for a seasonal campaign.',
      category: CATEGORY_ID.BEAUTY_SKINCARE,
      contentType: PHOTO,
      tags: ['gift set', 'seasonal', 'bath', 'product'],
      status: CONTENT_STATUS.RESTRICTED,
    },
    {
      title: 'Lip balm shade range flat-lay',
      description:
        'Six-shade balm range shot as an overhead flat-lay with individual product cutouts for listings.',
      category: CATEGORY_ID.BEAUTY_SKINCARE,
      contentType: PHOTO,
      tags: ['flat lay', 'shade range', 'cutout', 'cosmetics'],
    },
    {
      title: 'Facial oil dropper macro set',
      description:
        'Macro dropper and texture frames for a facial oil launch.',
      category: CATEGORY_ID.BEAUTY_SKINCARE,
      contentType: PHOTO,
      tags: ['macro', 'facial oil', 'texture', 'launch'],
      status: CONTENT_STATUS.REJECTED,
      rejectionReasonCode: REJECTION_REASON_CODE.IP_VIOLATION,
      rejectionReason:
        'Two frames use a licensed stock background without proof of a commercial licence. Re-submit with your own backdrop or attach the licence.',
    },
  ],
  mateo: [
    {
      title: 'Rooftop launch party recap film',
      description:
        'Evening product launch covered on two cameras and cut into a 60-second recap for the venue and the brand.',
      category: CATEGORY_ID.EVENTS_ENTERTAINMENT,
      contentType: VIDEO,
      tags: ['launch', 'recap', 'venue', 'evening'],
      status: CONTENT_STATUS.SUBMITTED,
    },
    {
      title: 'Wine estate tasting event coverage',
      description:
        'Guest tasting event photographed across the cellar and terrace for the estate’s booking pages.',
      category: CATEGORY_ID.EVENTS_ENTERTAINMENT,
      contentType: PHOTO,
      tags: ['tasting', 'estate', 'hospitality', 'event'],
      status: CONTENT_STATUS.UNDER_REVIEW,
    },
    {
      title: 'Conference keynote multi-camera edit',
      description:
        'Three-camera keynote capture with synchronised slides, delivered as a full session and a highlight cut.',
      category: CATEGORY_ID.EVENTS_ENTERTAINMENT,
      contentType: VIDEO,
      tags: ['keynote', 'conference', 'multi-camera', 'slides'],
      status: CONTENT_STATUS.SUBMITTED,
    },
    {
      title: 'Lakeside venue tour film',
      description:
        'Guided venue tour film covering ceremony, dining, and terrace spaces for a hospitality group.',
      category: CATEGORY_ID.TRAVEL_HOSPITALITY,
      contentType: VIDEO,
      tags: ['venue', 'tour', 'hospitality', 'film'],
      status: CONTENT_STATUS.REVISION_REQUIRED,
    },
    {
      title: 'Summer festival vertical cutdowns',
      description:
        'Vertical cutdown set built from festival coverage, sized for stories and short-form feeds.',
      category: CATEGORY_ID.EVENTS_ENTERTAINMENT,
      contentType: VIDEO,
      tags: ['festival', 'vertical', 'cutdown', 'social'],
      status: CONTENT_STATUS.UNDER_REVIEW,
    },
  ],
  ethan: [
    {
      title: 'Townhouse listing photography set',
      description:
        'Full listing set for a three-bedroom townhouse, shot mid-morning with balanced window exposures throughout.',
      category: CATEGORY_ID.REAL_ESTATE,
      contentType: PHOTO,
      tags: ['listing', 'townhouse', 'real estate', 'interiors'],
    },
    {
      title: 'Loft apartment walkthrough film',
      description:
        'Continuous walkthrough film of a converted loft, paired with a stills set for the agency’s listing page.',
      category: CATEGORY_ID.REAL_ESTATE,
      contentType: VIDEO,
      tags: ['walkthrough', 'loft', 'listing', 'agency'],
    },
    {
      title: 'Backyard and outdoor living stills',
      description:
        'Outdoor living spaces photographed across golden hour for a seasonal listing refresh.',
      category: CATEGORY_ID.HOME_LIFESTYLE,
      contentType: PHOTO,
      tags: ['outdoor', 'golden hour', 'listing', 'lifestyle'],
      status: CONTENT_STATUS.SUBMITTED,
    },
    {
      title: 'New-build show home series',
      description: 'Show home series across four plots on a new development.',
      category: CATEGORY_ID.REAL_ESTATE,
      contentType: PHOTO,
      tags: ['new build', 'show home', 'development'],
      status: CONTENT_STATUS.REJECTED,
      // The reason a creator reads and the code the reviewer picked have to
      // agree — this one is about missing details, not rights (see
      // `rejectionReasonCodeById` below).
      rejectionReasonCode: REJECTION_REASON_CODE.METADATA_INCOMPLETE,
      rejectionReason:
        'Category, content type, and usage details are missing from the submission, so the work cannot be indexed correctly. Add them and re-submit.',
    },
    {
      title: 'Garden studio listing set',
      description:
        'Work in progress: garden studio and home office listing frames, waiting on a second visit for exterior light.',
      category: CATEGORY_ID.REAL_ESTATE,
      contentType: PHOTO,
      tags: ['garden studio', 'home office', 'listing'],
      status: CONTENT_STATUS.DRAFT,
    },
  ],
}

/** Statuses that mean the item reached the public profile at some point. */
const PUBLISHED_LIFECYCLE = new Set([
  CONTENT_STATUS.PUBLISHED,
  CONTENT_STATUS.RESTRICTED,
  CONTENT_STATUS.ARCHIVED,
])

const mediaTypeFor = (contentType) =>
  contentType === CONTENT_TYPE.VIDEO ? MEDIA_TYPE.VIDEO : MEDIA_TYPE.IMAGE

/**
 * Spreads a creator's items evenly across their tenure, oldest first, so no
 * item ever predates the account that owns it.
 */
function itemAgeDays(creatorKey, index, total) {
  const tenure = CREATOR_TENURE_DAYS[creatorKey]
  return Math.round((tenure * (total - index)) / (total + 1))
}

let sequence = 0

/**
 * Item id → the `REJECTION_REASON_CODE` a reviewer picked for it.
 *
 * Source-only: the code lives on the `moderationReviews` record (that is where
 * a decision belongs), not on the item, so it is collected here rather than
 * written into the record below. `scripts/seed-data/moderation.js` reads it so
 * the case's `reasonCode` and the item's `rejectionReason` copy describe the
 * same decision.
 */
export const rejectionReasonCodeById = {}

export const portfolioItems = Object.entries(PORTFOLIO_SOURCE).flatMap(
  ([creatorKey, items]) =>
    items.map((item, index) => {
      sequence += 1
      const id = seqId('pfi', sequence)
      const status = item.status ?? CONTENT_STATUS.PUBLISHED
      const createdAt = daysAgo(itemAgeDays(creatorKey, index, items.length), 12, 20)
      const isDraft = status === CONTENT_STATUS.DRAFT
      const submittedAt = isDraft ? null : addDays(createdAt, 1)
      const publishedAt = PUBLISHED_LIFECYCLE.has(status)
        ? addDays(submittedAt, 1)
        : null

      if (item.rejectionReasonCode) rejectionReasonCodeById[id] = item.rejectionReasonCode

      return compact({
        id,
        creatorId: creatorProfileId(creatorKey),
        title: item.title,
        description: item.description,
        categoryId: item.category,
        contentType: item.contentType,
        tags: item.tags,
        mediaUrl: imageUrl(id, IMAGE_SIZES.wide.width, IMAGE_SIZES.wide.height),
        thumbnailUrl: imageUrl(
          id,
          IMAGE_SIZES.thumbnail.width,
          IMAGE_SIZES.thumbnail.height
        ),
        mediaType: mediaTypeFor(item.contentType),
        status,
        visibility: item.visibility ?? VISIBILITY.PUBLIC,
        rejectionReason: item.rejectionReason,
        submittedAt,
        publishedAt,
        createdAt,
      })
    })
)

/** Portfolio items owned by a creator (by creator key), oldest first. */
export function itemsForCreator(creatorKey) {
  const profileId = creatorProfileId(creatorKey)
  return portfolioItems.filter((item) => item.creatorId === profileId)
}

/**
 * Ids of a creator's live portfolio items — proposals attach these as sample
 * work, so only published items are ever offered.
 */
export function publishedItemIds(creatorKey, count = 2, offset = 0) {
  const published = itemsForCreator(creatorKey).filter(
    (item) => item.status === CONTENT_STATUS.PUBLISHED
  )
  if (published.length === 0) return []
  return Array.from({ length: Math.min(count, published.length) }, (_, index) =>
    published[(offset + index) % published.length].id
  )
}
