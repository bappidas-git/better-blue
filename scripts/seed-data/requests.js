// Seed: `contentRequests` — the buyer briefs that start every engagement
// (Prompt 05 §4.3).
//
// The collection has two layers:
//
// 1. **Scenario requests** (`SCENARIO_REQUESTS`) — hand-written briefs that
//    cover every REQUEST_STATUS and host the 14 scenario orders, so each
//    order status can be demonstrated end to end.
// 2. **History engagements** (`HISTORY_ENGAGEMENTS`) — a compact table of
//    completed engagements spread over the seed window. It is expanded into
//    requests here and into proposals, orders, deliveries, payments, and
//    reviews by the other modules, which is what gives creators believable
//    `ratingAvg` / `completedOrders` figures and the finance console real
//    volume to work with.
//
// `proposalsCount` and `awardedProposalId` are derived in `seed-db.js` from
// the proposals themselves, so they cannot drift.

import { CATEGORY_ID } from '../../src/constants/categoriesFallback.js'
import {
  CONTENT_TYPE,
  REQUEST_STATUS,
  USAGE_RIGHTS,
} from '../../src/constants/statuses.js'
import {
  BUDGET_TYPE,
  CURRENCY,
  ORIENTATION,
  addDays,
  compact,
  daysAgo,
  seqId,
} from '../seed-utils.js'
import { creatorProfileId } from './profiles.js'
import { buyerId } from './users.js'

const { PHOTO, VIDEO, BUNDLE } = CONTENT_TYPE

/* -------------------------------------------------------------------------- */
/* Scenario requests                                                          */
/* -------------------------------------------------------------------------- */

const SCENARIO_SOURCE = [
  /* --- Open on the request board ------------------------------------------ */
  {
    key: 'open_verde_menu',
    buyer: 'verde',
    status: REQUEST_STATUS.OPEN,
    category: CATEGORY_ID.FOOD_BEVERAGE,
    contentType: PHOTO,
    title: '20 seasonal menu photos for our autumn dinner service',
    description:
      'We are refreshing the autumn menu across all six locations and need photography for the printed menu, the website, and organic social. Shooting happens in our Portland kitchen over one service. We will have the full dish list, plating notes, and our own tableware ready on the day.',
    quantity: 20,
    orientation: ORIENTATION.ANY,
    usageRights: USAGE_RIGHTS.FULL_COMMERCIAL,
    brandGuidelines:
      'Warm, natural light with visible texture. Muted greens and warm neutrals. No heavy colour grading, no synthetic-looking food.',
    dos: 'Shoot each dish overhead and at 45 degrees. Include two or three wider table scenes. Leave headroom for menu typography.',
    donts: 'No stock props we do not own, no visible branding from other restaurants, no heavy vignettes.',
    referenceUrls: ['https://verdekitchen.test/press/autumn-menu-brief'],
    budgetType: BUDGET_TYPE.RANGE,
    budgetMin: 600,
    budgetMax: 900,
    deadlineInDays: 18,
    createdDaysAgo: 9,
  },
  {
    key: 'open_nimbus_class',
    buyer: 'nimbus',
    status: REQUEST_STATUS.OPEN,
    category: CATEGORY_ID.FITNESS_WELLNESS,
    contentType: VIDEO,
    title: 'Three 30-second class promo videos for the January membership push',
    description:
      'We need three vertical promo videos covering strength, conditioning, and mobility classes, filmed at our Manchester studio. Members and coaches have already signed appearance releases. Captions are required because most of the placement is sound-off.',
    quantity: 3,
    videoDurationSec: 30,
    orientation: ORIENTATION.PORTRAIT,
    usageRights: USAGE_RIGHTS.PAID_ADS,
    brandGuidelines:
      'High energy but never intimidating. Show a range of ages and abilities. Brand blue only as an accent, never as a full-frame wash.',
    dos: 'Open on movement in the first second. Include coach-to-member interaction. Burn in captions and end on the membership offer card.',
    donts: 'No before-and-after body comparisons, no calorie or weight-loss claims, no music that needs a separate licence.',
    referenceUrls: ['https://nimbusfitness.test/brand/social-guidelines'],
    budgetType: BUDGET_TYPE.RANGE,
    budgetMin: 900,
    budgetMax: 1400,
    deadlineInDays: 24,
    createdDaysAgo: 7,
  },
  {
    key: 'open_atlas_itinerary',
    buyer: 'atlas',
    status: REQUEST_STATUS.OPEN,
    category: CATEGORY_ID.TRAVEL_HOSPITALITY,
    contentType: BUNDLE,
    title: 'Photo and video package for a new Douro Valley itinerary',
    description:
      'We are launching a four-day Douro Valley trip and need a content package covering the vineyard stays, river section, and two partner restaurants. You would travel with the first departure group. Travel, accommodation, and meals are covered separately from the quoted fee.',
    quantity: 40,
    videoDurationSec: 90,
    orientation: ORIENTATION.ANY,
    usageRights: USAGE_RIGHTS.FULL_COMMERCIAL,
    brandGuidelines:
      'Unhurried and warm. Real guests rather than staged models. Landscape frames must leave space for our itinerary overlay on the left third.',
    dos: 'Deliver a hero film plus vertical cutdowns. Cover mornings and golden hour. Photograph rooms empty and in use.',
    donts: 'No drone footage over the restricted vineyard zones, no partner logos in the hero film, no identifiable guests without a signed release.',
    referenceUrls: ['https://atlastravel.test/partners/content-brief'],
    budgetType: BUDGET_TYPE.RANGE,
    budgetMin: 1200,
    budgetMax: 1800,
    deadlineInDays: 31,
    createdDaysAgo: 5,
  },
  {
    key: 'open_bloom_routine',
    buyer: 'bloom',
    status: REQUEST_STATUS.OPEN,
    category: CATEGORY_ID.BEAUTY_SKINCARE,
    contentType: VIDEO,
    title: '60-second evening routine explainer for a retinol serum launch',
    description:
      'A single explainer video walking through a three-step evening routine with our new retinol serum. We supply product, packaging, and the approved claims list. The presenter should be comfortable talking to camera and reading from an autocue.',
    quantity: 1,
    videoDurationSec: 60,
    orientation: ORIENTATION.PORTRAIT,
    usageRights: USAGE_RIGHTS.PAID_ADS,
    brandGuidelines:
      'Soft daylight, clean bathroom set, minimal props. Copy on screen must match the approved claims list exactly.',
    dos: 'Show the pump and texture clearly. Keep each step under fifteen seconds. Include the patch-test reminder card at the end.',
    donts: 'No medical or clinical claims, no competitor products in frame, no filters that alter skin texture.',
    referenceUrls: ['https://bloombeauty.test/brand/claims-list'],
    budgetType: BUDGET_TYPE.FIXED,
    budgetMin: 750,
    budgetMax: 750,
    deadlineInDays: 14,
    createdDaysAgo: 4,
  },
  {
    key: 'open_pulse_walkthrough',
    buyer: 'pulse',
    status: REQUEST_STATUS.OPEN,
    category: CATEGORY_ID.TECHNOLOGY_SAAS,
    contentType: VIDEO,
    title: 'Two-minute product walkthrough for our shift scheduling release',
    description:
      'We need a walkthrough film for the new scheduling release, aimed at operations managers evaluating us for the first time. We provide a demo environment with seeded data, the release notes, and a script outline. Screen capture plus light motion graphics, no on-camera presenter required.',
    quantity: 1,
    videoDurationSec: 120,
    orientation: ORIENTATION.LANDSCAPE,
    usageRights: USAGE_RIGHTS.WEBSITE,
    brandGuidelines:
      'Product-first. Interface recordings at full resolution, callouts in brand ink and teal, voiceover calm and unhurried.',
    dos: 'Follow the script outline. Record at 2560 by 1440 and deliver a 1080p master. Include an open-caption version.',
    donts: 'No customer names or real employee data on screen, no stock office footage, no claims about competitor products.',
    referenceUrls: ['https://pulsesaas.test/brand/video-guidelines'],
    budgetType: BUDGET_TYPE.RANGE,
    budgetMin: 800,
    budgetMax: 1200,
    deadlineInDays: 21,
    createdDaysAgo: 3,
  },

  /* --- Drafts, still private ---------------------------------------------- */
  {
    key: 'draft_craftware_bench',
    buyer: 'craftware',
    status: REQUEST_STATUS.DRAFT,
    category: CATEGORY_ID.ECOMMERCE_PRODUCTS,
    contentType: PHOTO,
    title: 'Listing photography for the spring bench tool range',
    description:
      'Draft brief for the spring range: twelve SKUs needing white-background cutouts plus one in-use frame each. Still confirming which SKUs make the launch window, so quantities may change before we publish this.',
    quantity: 12,
    orientation: ORIENTATION.SQUARE,
    usageRights: USAGE_RIGHTS.WEBSITE,
    brandGuidelines:
      'Neutral grey backdrop for in-use frames, pure white for cutouts. Consistent scale across the range.',
    dos: 'Match the existing catalogue template. Keep shadows soft and consistent.',
    donts: 'No lifestyle staging, no props that imply a use case we do not support.',
    referenceUrls: [],
    budgetType: BUDGET_TYPE.RANGE,
    budgetMin: 450,
    budgetMax: 700,
    deadlineInDays: 40,
    createdDaysAgo: 6,
  },
  // Two drafts for the demo buyer, added in Prompt 18 so the request list's
  // Drafts tab, its "resume in the wizard" action, and its publish flow are all
  // exercisable on the seeded demo account. The first is finished and publishes
  // cleanly; the second is deliberately half-written, so the "this draft is not
  // finished yet — here is what is missing" path has something to catch.
  {
    key: 'draft_verde_launch',
    buyer: 'verde',
    status: REQUEST_STATUS.DRAFT,
    category: CATEGORY_ID.FOOD_BEVERAGE,
    contentType: PHOTO,
    title: 'Launch photography for the new Portland location',
    description:
      'We open our seventh site in Portland this autumn and need photography for the announcement: the dining room, the open kitchen, and a handful of signature dishes. Shooting before service on a quiet weekday. Everything is ready except the opening date, which is why this is still a draft.',
    quantity: 24,
    orientation: ORIENTATION.ANY,
    usageRights: USAGE_RIGHTS.FULL_COMMERCIAL,
    brandGuidelines:
      'Warm and unhurried, matching the autumn menu set. Natural light wherever possible, no flash in the dining room.',
    dos: 'Photograph the room empty and in use. Include the open kitchen pass. Leave headroom for the announcement overlay.',
    donts: 'No staff faces without a signed release, no competitor branding, no heavy colour grading.',
    referenceUrls: [],
    budgetType: BUDGET_TYPE.RANGE,
    budgetMin: 700,
    budgetMax: 1100,
    deadlineInDays: 34,
    createdDaysAgo: 3,
  },
  {
    key: 'draft_verde_supplier',
    buyer: 'verde',
    status: REQUEST_STATUS.DRAFT,
    category: CATEGORY_ID.FOOD_BEVERAGE,
    // Intentionally incomplete: no content type, no usage rights, no budget,
    // and no deadline. An unanswered field is **absent** on the record (that is
    // `compact`'s contract), which is exactly what
    // `requestService.missingPublishFields` looks for — it names all four.
    contentType: undefined,
    title: 'Supplier farm visits — short films, details still to confirm',
    description:
      'Rough notes for a series about the farms we buy from. We know we want three or four short films shot on location across the season, but the farms, the travel days, and the budget are all still being agreed internally.',
    quantity: 4,
    orientation: ORIENTATION.PORTRAIT,
    usageRights: undefined,
    brandGuidelines: '',
    dos: '',
    donts: '',
    referenceUrls: [],
    budgetType: BUDGET_TYPE.FIXED,
    budgetMin: undefined,
    budgetMax: undefined,
    deadlineInDays: null,
    createdDaysAgo: 1,
  },
  {
    key: 'draft_urbannest_sofa',
    buyer: 'urbannest',
    status: REQUEST_STATUS.DRAFT,
    category: CATEGORY_ID.HOME_LIFESTYLE,
    contentType: BUNDLE,
    title: 'Styled room sets for the compact sofa collection',
    description:
      'Early draft for the compact sofa launch. We want three styled room sets and a short assembly film, but the delivery date depends on when the sample units clear customs.',
    quantity: 18,
    videoDurationSec: 45,
    orientation: ORIENTATION.LANDSCAPE,
    usageRights: USAGE_RIGHTS.FULL_COMMERCIAL,
    brandGuidelines:
      'Small-space realism. Rooms should read as apartments, not showrooms. Warm neutrals with one accent colour per set.',
    dos: 'Show scale against everyday objects. Include at least one frame per set with a person seated.',
    donts: 'No oversized rooms, no props from competitor brands.',
    referenceUrls: [],
    budgetType: BUDGET_TYPE.RANGE,
    budgetMin: 900,
    budgetMax: 1300,
    deadlineInDays: 45,
    createdDaysAgo: 2,
  },

  /* --- Closed without an award -------------------------------------------- */
  {
    key: 'closed_cocoa_easter',
    buyer: 'cocoa',
    status: REQUEST_STATUS.CLOSED,
    category: CATEGORY_ID.FOOD_BEVERAGE,
    contentType: PHOTO,
    title: 'Seasonal gift box photography for a limited spring range',
    description:
      'We needed gift box photography for a limited spring range. The range sold out before the campaign went live, so we closed the brief without awarding it. Thank you to everyone who proposed.',
    quantity: 10,
    orientation: ORIENTATION.SQUARE,
    usageRights: USAGE_RIGHTS.ORGANIC_SOCIAL,
    brandGuidelines:
      'Tactile and warm. Chocolate should read glossy, never melted or dull.',
    dos: 'Photograph boxes closed, open, and part-unwrapped.',
    donts: 'No seasonal props beyond the ones we supply.',
    referenceUrls: [],
    budgetType: BUDGET_TYPE.FIXED,
    budgetMin: 480,
    budgetMax: 480,
    deadlineInDays: -12,
    createdDaysAgo: 52,
  },

  /* --- Awarded: hosting an active scenario order --------------------------- */
  {
    key: 'awarded_cocoa_gift',
    buyer: 'cocoa',
    status: REQUEST_STATUS.AWARDED,
    category: CATEGORY_ID.ECOMMERCE_PRODUCTS,
    contentType: PHOTO,
    title: '15 lifestyle photos for a single-origin gift box launch',
    description:
      'Lifestyle photography for our new single-origin gift box, for use on the storefront and in paid social through the gifting season. We will ship product and packaging ahead of the shoot.',
    quantity: 15,
    orientation: ORIENTATION.ANY,
    usageRights: USAGE_RIGHTS.FULL_COMMERCIAL,
    brandGuidelines:
      'Warm, tactile, close focus. Deep browns with a single warm highlight. Hands in frame are welcome.',
    dos: 'Include three frames with the box closed and branding fully legible. Deliver square and 4:5 crops.',
    donts: 'No melted or broken product, no competitor packaging in frame.',
    referenceUrls: ['https://cocoaandco.test/brand/gifting-guidelines'],
    budgetType: BUDGET_TYPE.RANGE,
    budgetMin: 700,
    budgetMax: 1000,
    deadlineInDays: 12,
    createdDaysAgo: 22,
  },
  {
    key: 'awarded_nimbus_equipment',
    buyer: 'nimbus',
    status: REQUEST_STATUS.AWARDED,
    category: CATEGORY_ID.FITNESS_WELLNESS,
    contentType: VIDEO,
    title: 'Equipment demonstration films for six new studio machines',
    description:
      'Six short demonstration films covering setup, correct form, and a common mistake for each new machine. These play on the studio screens and in the member app.',
    quantity: 6,
    videoDurationSec: 45,
    orientation: ORIENTATION.LANDSCAPE,
    usageRights: USAGE_RIGHTS.WEBSITE,
    brandGuidelines:
      'Clear, instructional, well-lit. One coach on camera throughout for continuity.',
    dos: 'Film each machine from front and side. Call out the safety stop in every film.',
    donts: 'No background music over the coaching audio, no members in frame without a release.',
    referenceUrls: ['https://nimbusfitness.test/brand/equipment-brief'],
    budgetType: BUDGET_TYPE.FIXED,
    budgetMin: 1080,
    budgetMax: 1080,
    deadlineInDays: 9,
    createdDaysAgo: 19,
  },
  {
    key: 'awarded_bloom_texture',
    buyer: 'bloom',
    status: REQUEST_STATUS.AWARDED,
    category: CATEGORY_ID.BEAUTY_SKINCARE,
    contentType: PHOTO,
    title: 'Texture and swatch photography for a new tinted SPF range',
    description:
      'Swatch and texture photography across eight shades of our new tinted SPF, matched to the existing product page treatment so the range reads consistently.',
    quantity: 24,
    orientation: ORIENTATION.SQUARE,
    usageRights: USAGE_RIGHTS.WEBSITE,
    brandGuidelines:
      'Neutral white balance, no warming filters. Shade accuracy matters more than mood.',
    dos: 'Photograph swatches on a range of skin tones. Include one macro frame per shade.',
    donts: 'No retouching that alters shade colour, no props that cast coloured light.',
    referenceUrls: ['https://bloombeauty.test/brand/product-page-spec'],
    budgetType: BUDGET_TYPE.FIXED,
    budgetMin: 880,
    budgetMax: 880,
    deadlineInDays: 4,
    createdDaysAgo: 26,
  },
  {
    key: 'awarded_atlas_hotel',
    buyer: 'atlas',
    status: REQUEST_STATUS.AWARDED,
    category: CATEGORY_ID.TRAVEL_HOSPITALITY,
    contentType: PHOTO,
    title: 'Property photography for three partner hotels in the Algarve',
    description:
      'Room categories, common areas, and breakfast service across three partner properties, shot over three days. Each property has agreed access windows and will hold rooms for you.',
    quantity: 45,
    orientation: ORIENTATION.LANDSCAPE,
    usageRights: USAGE_RIGHTS.FULL_COMMERCIAL,
    brandGuidelines:
      'Bright and airy, true-to-life colour. Rooms must be photographed as guests find them.',
    dos: 'Shoot every room category. Include one exterior and one pool frame per property.',
    donts: 'No wide-angle distortion that oversells room size, no staff in frame without a release.',
    referenceUrls: ['https://atlastravel.test/partners/property-shot-list'],
    budgetType: BUDGET_TYPE.RANGE,
    budgetMin: 1300,
    budgetMax: 1700,
    deadlineInDays: 6,
    createdDaysAgo: 30,
  },
  {
    key: 'awarded_verde_reel',
    buyer: 'verde',
    status: REQUEST_STATUS.AWARDED,
    category: CATEGORY_ID.FOOD_BEVERAGE,
    contentType: VIDEO,
    title: 'Three vertical reels for the autumn menu launch',
    description:
      'Three vertical reels built around the autumn menu: one prep-led, one plating-led, and one dining room scene. These run on organic social during launch week.',
    quantity: 3,
    videoDurationSec: 25,
    orientation: ORIENTATION.PORTRAIT,
    usageRights: USAGE_RIGHTS.ORGANIC_SOCIAL,
    brandGuidelines:
      'Warm and hand-made. Kitchen noise is welcome in the mix. No voiceover.',
    dos: 'Open on motion. Keep cuts to the beat. Include the dish name as an on-screen caption.',
    donts: 'No trending audio that needs a commercial licence, no staff faces without a release.',
    referenceUrls: ['https://verdekitchen.test/press/autumn-menu-brief'],
    budgetType: BUDGET_TYPE.FIXED,
    budgetMin: 720,
    budgetMax: 720,
    deadlineInDays: 3,
    createdDaysAgo: 24,
  },
  {
    // Prompt 20: the demo buyer's **delivered** order — the one screen the
    // buyer order workspace exists for. A bundle brief so the delivery carries
    // both a film and a still, which is what exercises the video tile and the
    // lightbox's two modes side by side (§9).
    key: 'awarded_verde_supper',
    buyer: 'verde',
    status: REQUEST_STATUS.AWARDED,
    category: CATEGORY_ID.FOOD_BEVERAGE,
    contentType: BUNDLE,
    title: 'Harvest supper club: a short film and a stills set',
    description:
      'One evening of our harvest supper club, covered as a bundle: a short film for the events page and a small stills set for the newsletter. The room is candlelit and we would rather keep it that way than light it for camera.',
    quantity: 8,
    videoDurationSec: 60,
    orientation: ORIENTATION.ANY,
    usageRights: USAGE_RIGHTS.FULL_COMMERCIAL,
    brandGuidelines:
      'Warm, low-light, unhurried. The room as guests actually experience it — no additional lighting rigs on the floor.',
    dos: 'Shoot the pass, the room, and two or three guest moments. Deliver the film and the stills matched in colour.',
    donts: 'No flash on the floor, no guest faces without a signed release, no staged plating.',
    referenceUrls: ['https://verdekitchen.test/press/harvest-supper-club'],
    budgetType: BUDGET_TYPE.FIXED,
    budgetMin: 1180,
    budgetMax: 1180,
    deadlineInDays: 2,
    createdDaysAgo: 14,
  },
  {
    // Prompt 20: the demo buyer's **unpaid** order, so the "Complete payment"
    // path off the orders list has something to point at on the account people
    // actually sign in as (§9).
    key: 'awarded_verde_market',
    buyer: 'verde',
    status: REQUEST_STATUS.AWARDED,
    category: CATEGORY_ID.FOOD_BEVERAGE,
    contentType: PHOTO,
    title: 'Supplier market photography for the new sourcing page',
    description:
      'A morning at the growers market with our head chef, photographed for the sourcing page we are adding to the site. Produce, hands, crates, and two or three portraits of the growers we buy from.',
    quantity: 14,
    orientation: ORIENTATION.ANY,
    usageRights: USAGE_RIGHTS.WEBSITE,
    brandGuidelines:
      'Early light, muted greens, visible texture. Documentary rather than styled.',
    dos: 'Shoot at the stalls rather than setting up a table. Include wide context frames as well as detail.',
    donts: 'No other traders’ branding in the foreground, no portraits without permission.',
    referenceUrls: [],
    budgetType: BUDGET_TYPE.FIXED,
    budgetMin: 560,
    budgetMax: 560,
    deadlineInDays: 14,
    createdDaysAgo: 6,
  },
  {
    key: 'awarded_urbannest_shelf',
    buyer: 'urbannest',
    status: REQUEST_STATUS.AWARDED,
    category: CATEGORY_ID.HOME_LIFESTYLE,
    contentType: PHOTO,
    title: 'Catalogue photography for the modular shelving range',
    description:
      'Catalogue photography for a modular shelving range in four finishes: each configuration styled and unstyled, plus joinery and hardware detail frames.',
    quantity: 28,
    orientation: ORIENTATION.LANDSCAPE,
    usageRights: USAGE_RIGHTS.WEBSITE,
    brandGuidelines:
      'Calm, natural light, consistent camera height across configurations.',
    dos: 'Photograph each finish against the same backdrop. Include one detail frame per joint type.',
    donts: 'No mixed colour temperatures, no props taller than the shelving.',
    referenceUrls: ['https://urbannest.test/brand/catalogue-spec'],
    budgetType: BUDGET_TYPE.FIXED,
    budgetMin: 760,
    budgetMax: 760,
    deadlineInDays: 5,
    createdDaysAgo: 21,
  },
  {
    key: 'awarded_pulse_explainer',
    buyer: 'pulse',
    status: REQUEST_STATUS.AWARDED,
    category: CATEGORY_ID.TECHNOLOGY_SAAS,
    contentType: VIDEO,
    title: 'Feature explainer series for the reporting dashboard',
    description:
      'A four-part explainer series covering the new reporting dashboard, for the help centre and in-product tours. Scripts are drafted; we need production, motion graphics, and captions.',
    quantity: 4,
    videoDurationSec: 90,
    orientation: ORIENTATION.LANDSCAPE,
    usageRights: USAGE_RIGHTS.WEBSITE,
    brandGuidelines:
      'Product-first with brand-ink callouts. Neutral narration, no background music bed under voiceover.',
    dos: 'Record from the demo environment we provide. Deliver caption files alongside each master.',
    donts: 'No real customer data on screen, no claims outside the release notes.',
    referenceUrls: ['https://pulsesaas.test/brand/video-guidelines'],
    budgetType: BUDGET_TYPE.FIXED,
    budgetMin: 1150,
    budgetMax: 1150,
    deadlineInDays: -6,
    createdDaysAgo: 34,
  },
  {
    key: 'awarded_craftware_demo',
    buyer: 'craftware',
    status: REQUEST_STATUS.AWARDED,
    category: CATEGORY_ID.ECOMMERCE_PRODUCTS,
    contentType: VIDEO,
    title: 'Demonstration films for the cordless multi-tool launch',
    description:
      'Demonstration films for our cordless multi-tool: one overview film and three attachment-specific shorts, for listing pages and paid social.',
    quantity: 4,
    videoDurationSec: 40,
    orientation: ORIENTATION.SQUARE,
    usageRights: USAGE_RIGHTS.PAID_ADS,
    brandGuidelines:
      'Workshop-real, not staged. Show the tool doing actual work on real material.',
    dos: 'Include a close-up of each attachment changing over. Show correct protective equipment throughout.',
    donts: 'No unsafe technique on camera, no claims about run time that we have not verified.',
    referenceUrls: ['https://craftwaretools.test/brand/product-video-brief'],
    budgetType: BUDGET_TYPE.FIXED,
    budgetMin: 980,
    budgetMax: 980,
    deadlineInDays: -9,
    createdDaysAgo: 38,
  },
  {
    key: 'awarded_nimbus_app',
    buyer: 'nimbus',
    status: REQUEST_STATUS.AWARDED,
    category: CATEGORY_ID.TECHNOLOGY_SAAS,
    contentType: VIDEO,
    title: 'App feature film for the connected training release',
    description:
      'A single product film introducing the connected training features in our member app: screen capture, light motion graphics, and two short studio inserts.',
    quantity: 1,
    videoDurationSec: 75,
    orientation: ORIENTATION.LANDSCAPE,
    usageRights: USAGE_RIGHTS.PAID_ADS,
    brandGuidelines:
      'Energetic but clear. App recordings must be legible at mobile size.',
    dos: 'Record the app at device resolution. Keep on-screen text above the safe area.',
    donts: 'No member data on screen, no music that needs a separate licence.',
    referenceUrls: ['https://nimbusfitness.test/brand/social-guidelines'],
    budgetType: BUDGET_TYPE.FIXED,
    budgetMin: 940,
    budgetMax: 940,
    deadlineInDays: 20,
    createdDaysAgo: 4,
  },

  /* --- Completed --------------------------------------------------------- */
  {
    key: 'completed_bloom_campaign',
    buyer: 'bloom',
    status: REQUEST_STATUS.COMPLETED,
    category: CATEGORY_ID.BEAUTY_SKINCARE,
    contentType: VIDEO,
    title: 'Campaign film for the barrier repair range relaunch',
    description:
      'A 45-second campaign film for the barrier repair relaunch, plus vertical and square cutdowns for the launch week schedule.',
    quantity: 1,
    videoDurationSec: 45,
    orientation: ORIENTATION.LANDSCAPE,
    usageRights: USAGE_RIGHTS.PAID_ADS,
    brandGuidelines:
      'Soft daylight, clean set, calm pacing. Copy on screen must match the approved claims list.',
    dos: 'Deliver 16:9, 9:16, and 1:1 masters. Include an open-caption version of each.',
    donts: 'No clinical claims, no filters that alter skin texture.',
    referenceUrls: ['https://bloombeauty.test/brand/claims-list'],
    budgetType: BUDGET_TYPE.FIXED,
    budgetMin: 1020,
    budgetMax: 1020,
    deadlineInDays: -22,
    createdDaysAgo: 48,
  },
  {
    key: 'completed_atlas_villa',
    buyer: 'atlas',
    status: REQUEST_STATUS.COMPLETED,
    category: CATEGORY_ID.TRAVEL_HOSPITALITY,
    contentType: PHOTO,
    title: 'Villa and terrace photography for a summer stay collection',
    description:
      'Photography for four villas joining the summer collection: interiors, terraces, and one twilight exterior each.',
    quantity: 32,
    orientation: ORIENTATION.LANDSCAPE,
    usageRights: USAGE_RIGHTS.WEBSITE,
    brandGuidelines:
      'True-to-life colour, no oversaturated skies. Properties shot as guests find them.',
    dos: 'Include one twilight exterior per villa. Photograph every bedroom.',
    donts: 'No wide-angle distortion that oversells space, no neighbouring properties in frame.',
    referenceUrls: ['https://atlastravel.test/partners/property-shot-list'],
    budgetType: BUDGET_TYPE.FIXED,
    budgetMin: 820,
    budgetMax: 820,
    deadlineInDays: -26,
    createdDaysAgo: 42,
  },
  {
    key: 'completed_urbannest_loft',
    buyer: 'urbannest',
    status: REQUEST_STATUS.COMPLETED,
    category: CATEGORY_ID.REAL_ESTATE,
    contentType: PHOTO,
    title: 'Loft showroom photography for the Brooklyn flagship',
    description:
      'Photography of our new Brooklyn showroom loft: full room sets, window light detail, and a wide storefront frame for local listings.',
    quantity: 22,
    orientation: ORIENTATION.LANDSCAPE,
    usageRights: USAGE_RIGHTS.WEBSITE,
    brandGuidelines:
      'Warm neutrals, natural light only, no flash. Show the space as a working showroom.',
    dos: 'Photograph every room set and the storefront. Deliver both flat and graded versions.',
    donts: 'No customers in frame, no exterior signage from neighbouring businesses.',
    referenceUrls: ['https://urbannest.test/brand/catalogue-spec'],
    budgetType: BUDGET_TYPE.FIXED,
    budgetMin: 640,
    budgetMax: 640,
    deadlineInDays: -20,
    createdDaysAgo: 34,
  },

  /* --- Cancelled --------------------------------------------------------- */
  {
    key: 'cancelled_atlas_winter',
    buyer: 'atlas',
    status: REQUEST_STATUS.CANCELLED,
    category: CATEGORY_ID.EVENTS_ENTERTAINMENT,
    contentType: VIDEO,
    title: 'Recap film for the winter travel showcase',
    description:
      'A recap film for our winter showcase event. We awarded the brief and then postponed the event to next season, so the order was cancelled before it was funded.',
    quantity: 1,
    videoDurationSec: 60,
    orientation: ORIENTATION.LANDSCAPE,
    usageRights: USAGE_RIGHTS.ORGANIC_SOCIAL,
    brandGuidelines: 'Warm, busy, human. Show conversations rather than stages.',
    dos: 'Capture the partner stands and at least one guest interview.',
    donts: 'No attendee faces without a signed release.',
    referenceUrls: [],
    budgetType: BUDGET_TYPE.FIXED,
    budgetMin: 560,
    budgetMax: 560,
    deadlineInDays: -4,
    createdDaysAgo: 28,
  },
  {
    key: 'cancelled_bloom_serum',
    buyer: 'bloom',
    status: REQUEST_STATUS.CANCELLED,
    category: CATEGORY_ID.BEAUTY_SKINCARE,
    contentType: PHOTO,
    title: 'Packaging stills for the refillable serum bottle',
    description:
      'Packaging photography for the refillable serum bottle. The engagement ended in a dispute and was refunded in full, so the brief was cancelled and will be re-posted later this quarter.',
    quantity: 14,
    orientation: ORIENTATION.SQUARE,
    usageRights: USAGE_RIGHTS.WEBSITE,
    brandGuidelines: 'Neutral background, product-accurate colour, no props.',
    dos: 'Photograph the refill step in sequence. Include a scale reference frame.',
    donts: 'No coloured gels, no competitor packaging in frame.',
    referenceUrls: ['https://bloombeauty.test/brand/product-page-spec'],
    budgetType: BUDGET_TYPE.FIXED,
    budgetMin: 610,
    budgetMax: 610,
    deadlineInDays: -18,
    createdDaysAgo: 56,
  },

  /* --- Open, appended by Prompt 21 ---------------------------------------- */
  //
  // The creator overview counts the live briefs in the signed-in creator's
  // categories, and the demo creator (Ava — food & beverage, e-commerce
  // products) had exactly one to look at. These two give that tile something to
  // say, and give the request board two more categories' worth of material.
  //
  // **Appended rather than slotted into the "Open" block above**: request ids
  // are assigned in array order, and inserting two rows at the top would
  // renumber every scenario request after them — including the ones
  // `docs/api-contract.md` and `scripts/smoke-api.mjs` quote by id. The same
  // reasoning kept h29/h30 at the end of `HISTORY_ENGAGEMENTS` in Prompt 15.
  {
    key: 'open_cocoa_truffle',
    buyer: 'cocoa',
    status: REQUEST_STATUS.OPEN,
    category: CATEGORY_ID.FOOD_BEVERAGE,
    contentType: PHOTO,
    title: 'Product photography for the single-origin truffle collection',
    description:
      'We are launching a twelve-piece truffle collection and need photography for the online shop, the printed insert, and organic social. Shooting in our Chicago kitchen over one day. We will have every piece plated, the packaging flats, and our own linens and boards ready.',
    quantity: 24,
    orientation: ORIENTATION.SQUARE,
    usageRights: USAGE_RIGHTS.FULL_COMMERCIAL,
    brandGuidelines:
      'Dark, warm, and tactile. Deep browns and brass, matte surfaces, one clear light source. Product-accurate colour above all — chocolate that photographs grey does not sell.',
    dos: 'Photograph each piece straight on and cut in half. Include three packaging scenes and one flat lay of the full collection.',
    donts: 'No melting or smearing for effect, no props we do not stock, no competitor packaging in frame.',
    referenceUrls: ['https://cocoaandco.test/press/truffle-collection-brief'],
    budgetType: BUDGET_TYPE.RANGE,
    budgetMin: 520,
    budgetMax: 780,
    deadlineInDays: 16,
    createdDaysAgo: 6,
  },
  {
    key: 'open_craftware_giftset',
    buyer: 'craftware',
    status: REQUEST_STATUS.OPEN,
    category: CATEGORY_ID.ECOMMERCE_PRODUCTS,
    contentType: PHOTO,
    title: 'Listing photography for the winter gift set range',
    description:
      'Six gift sets going live for the winter season, each needing a full listing set: hero, angles, contents laid out, and one in-use frame. Product ships to your studio and is yours to keep. We supply the shot list and the marketplace spec sheet.',
    quantity: 30,
    orientation: ORIENTATION.SQUARE,
    usageRights: USAGE_RIGHTS.WEBSITE,
    brandGuidelines:
      'Pure white background on the hero and angle frames, exactly as the marketplace spec requires. In-use frames on a workbench, natural light, no styling clutter.',
    dos: 'Deliver every frame on the marketplace-required square crop. Include one scale reference per set.',
    donts: 'No composited shadows, no third-party tool brands in frame, no heavy retouching of tool marks.',
    referenceUrls: ['https://craftware.test/suppliers/listing-photo-spec'],
    budgetType: BUDGET_TYPE.RANGE,
    budgetMin: 480,
    budgetMax: 700,
    deadlineInDays: 21,
    createdDaysAgo: 4,
  },

  /* --- Open, appended by Prompt 23 ---------------------------------------- */
  //
  // The request board needs enough live material to filter meaningfully (§9:
  // at least eight open briefs across categories and budgets), and one brief
  // has to carry an **invitation** so the "Invited" badge and the "Invited to
  // you" filter have something to show. `invitedCreator` is a creator *key*;
  // the assembly below resolves it to the `cpr_…` the data model stores.
  //
  // **Appended rather than slotted into the "Open" block above**, for the same
  // reason Prompt 21's two were: request ids are assigned in array order, and
  // inserting rows would renumber every scenario request after them —
  // including the ones `docs/api-contract.md` and `scripts/smoke-api.mjs`
  // quote by id.
  {
    key: 'open_verde_invite_ava',
    buyer: 'verde',
    // The demo creator's own storefront (Ava — food & beverage, e-commerce),
    // so signing in as `creator@betterblue.test` shows the badge immediately.
    invitedCreator: 'ava',
    status: REQUEST_STATUS.OPEN,
    category: CATEGORY_ID.FOOD_BEVERAGE,
    contentType: BUNDLE,
    title: 'Photo and video package for the winter tasting menu launch',
    description:
      'We are launching the winter tasting menu across three sites and would like the same photographer to cover stills and short-form video in one pass. We found your food work through the directory and think the warmth in it is exactly right for this menu. Shooting over two evening services in Portland, with the full dish list and plating notes ready on the day.',
    quantity: 26,
    videoDurationSec: 30,
    orientation: ORIENTATION.ANY,
    usageRights: USAGE_RIGHTS.FULL_COMMERCIAL,
    brandGuidelines:
      'Warm, low light with visible steam and texture. Muted greens and warm neutrals, matching the autumn set. No heavy colour grading.',
    dos: 'Cover every course plated, three wider table scenes, and one vertical reel per course. Leave headroom for menu typography on the stills.',
    donts: 'No stock props we do not own, no other restaurants’ branding in frame, no licensed music on the reels.',
    referenceUrls: ['https://verdekitchen.test/press/winter-tasting-brief'],
    budgetType: BUDGET_TYPE.RANGE,
    budgetMin: 900,
    budgetMax: 1300,
    deadlineInDays: 20,
    createdDaysAgo: 2,
  },
  {
    key: 'open_urbannest_studio',
    buyer: 'urbannest',
    status: REQUEST_STATUS.OPEN,
    category: CATEGORY_ID.HOME_LIFESTYLE,
    contentType: PHOTO,
    title: 'Room sets for the small-space studio collection',
    description:
      'A twelve-piece collection built for studio flats, needing room sets that make a small space read as liveable rather than cramped. Shooting at our London showroom, which is already dressed. We supply the floor plan and the shot list.',
    quantity: 18,
    orientation: ORIENTATION.LANDSCAPE,
    usageRights: USAGE_RIGHTS.WEBSITE,
    brandGuidelines:
      'Natural daylight only, calm neutrals, and honest proportions. A sofa that photographs larger than it is comes straight back as a return.',
    dos: 'Photograph each set wide and at seating height. Include one detail frame per piece showing the fabric.',
    donts: 'No wide-angle distortion, no props we do not sell, no composited windows.',
    referenceUrls: ['https://urbannest.test/suppliers/room-set-spec'],
    budgetType: BUDGET_TYPE.FIXED,
    budgetMin: 450,
    budgetMax: 450,
    deadlineInDays: 11,
    createdDaysAgo: 3,
  },
  {
    // Prompt 24: the demo **creator's** delivered order — work already handed
    // over and sitting with the buyer. Ava has an in-progress order and one
    // sent back for changes, and this completes the set her workspace needs
    // (§9). Between the two demo accounts on purpose, so the two-sided loop can
    // be walked without leaving them.
    //
    // Appended to the end of this array rather than filed beside the other
    // `awarded_verde_*` briefs: request ids are handed out in array order, and
    // inserting mid-list would renumber every archived brief after it.
    key: 'awarded_verde_pastry',
    buyer: 'verde',
    status: REQUEST_STATUS.AWARDED,
    category: CATEGORY_ID.FOOD_BEVERAGE,
    contentType: PHOTO,
    title: 'Pastry counter stills for the morning service page',
    description:
      'The morning pastry counter photographed for the new breakfast page: the full counter as it looks at opening, individual pastries for the online order menu, and two or three frames of the bakers finishing the display.',
    quantity: 12,
    orientation: ORIENTATION.ANY,
    usageRights: USAGE_RIGHTS.WEBSITE,
    brandGuidelines:
      'Early daylight, warm crumb tones, minimal styling. The counter as guests see it at opening rather than a built set.',
    dos: 'Shoot the full counter wide, then each pastry straight on against the marble. Include the bakers at work.',
    donts: 'No artificial steam, no props from outside the kitchen, no faces without a signed release.',
    referenceUrls: ['https://verdekitchen.test/press/morning-service-brief'],
    budgetType: BUDGET_TYPE.FIXED,
    budgetMin: 620,
    budgetMax: 620,
    deadlineInDays: 4,
    createdDaysAgo: 12,
  },
]

/* -------------------------------------------------------------------------- */
/* History engagements                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Completed engagements, newest last. Each row expands into a request, an
 * accepted proposal (plus a declined one on every second row), an order, a
 * delivery, a payment, a commission, transactions, and — unless `noReview` is
 * set — a review.
 *
 * `createdDaysAgo` is the age of the *order*; the request that produced it is
 * published six days earlier.
 */
export const HISTORY_ENGAGEMENTS = [
  { key: 'h01', buyer: 'verde', creator: 'ava', category: CATEGORY_ID.FOOD_BEVERAGE, contentType: PHOTO, title: 'Menu photography for the summer small-plates menu', quantity: 16, price: 640, deliveryDays: 8, createdDaysAgo: 100, noReview: true },
  { key: 'h02', buyer: 'pulse', creator: 'liam', category: CATEGORY_ID.TECHNOLOGY_SAAS, contentType: VIDEO, title: 'Product walkthrough film for the shift-swap release', quantity: 1, price: 980, deliveryDays: 10, createdDaysAgo: 97 },
  { key: 'h03', buyer: 'bloom', creator: 'zoe', category: CATEGORY_ID.BEAUTY_SKINCARE, contentType: PHOTO, title: 'Product photography for the vitamin C serum launch', quantity: 18, price: 720, deliveryDays: 7, createdDaysAgo: 94 },
  { key: 'h04', buyer: 'nimbus', creator: 'diego', category: CATEGORY_ID.FITNESS_WELLNESS, contentType: VIDEO, title: 'Class promo films for the spring timetable', quantity: 3, price: 540, deliveryDays: 9, createdDaysAgo: 91 },
  { key: 'h05', buyer: 'atlas', creator: 'isla', category: CATEGORY_ID.TRAVEL_HOSPITALITY, contentType: PHOTO, title: 'Destination photography for the Algarve coastal tour', quantity: 40, price: 1150, deliveryDays: 12, createdDaysAgo: 88 },
  { key: 'h06', buyer: 'craftware', creator: 'noah', category: CATEGORY_ID.ECOMMERCE_PRODUCTS, contentType: PHOTO, title: 'Listing photography for the precision screwdriver range', quantity: 24, price: 480, deliveryDays: 6, createdDaysAgo: 85, noReview: true },
  { key: 'h07', buyer: 'urbannest', creator: 'yuki', category: CATEGORY_ID.HOME_LIFESTYLE, contentType: PHOTO, title: 'Room sets for the linen bedding collection', quantity: 20, price: 610, deliveryDays: 8, createdDaysAgo: 82 },
  { key: 'h08', buyer: 'pulse', creator: 'amara', category: CATEGORY_ID.EVENTS_ENTERTAINMENT, contentType: VIDEO, title: 'Conference booth recap film for the hospitality expo', quantity: 1, price: 890, deliveryDays: 7, createdDaysAgo: 79 },
  { key: 'h09', buyer: 'bloom', creator: 'chloe', category: CATEGORY_ID.BEAUTY_SKINCARE, contentType: PHOTO, title: 'Packaging stills for the refillable cleanser range', quantity: 15, price: 520, deliveryDays: 6, createdDaysAgo: 76 },
  { key: 'h10', buyer: 'verde', creator: 'ava', category: CATEGORY_ID.FOOD_BEVERAGE, contentType: VIDEO, title: 'Vertical reels for the weekend brunch launch', quantity: 3, price: 700, deliveryDays: 8, createdDaysAgo: 73 },
  { key: 'h11', buyer: 'nimbus', creator: 'sara', category: CATEGORY_ID.EDUCATION_COACHING, contentType: VIDEO, title: 'Coaching programme explainer for the app onboarding', quantity: 2, price: 660, deliveryDays: 9, createdDaysAgo: 70 },
  { key: 'h12', buyer: 'atlas', creator: 'isla', category: CATEGORY_ID.TRAVEL_HOSPITALITY, contentType: PHOTO, title: 'Property set for two partner guesthouses in Porto', quantity: 30, price: 980, deliveryDays: 10, createdDaysAgo: 66 },
  { key: 'h13', buyer: 'craftware', creator: 'noah', category: CATEGORY_ID.ECOMMERCE_PRODUCTS, contentType: VIDEO, title: 'Demonstration films for the cordless driver launch', quantity: 3, price: 750, deliveryDays: 8, createdDaysAgo: 63 },
  { key: 'h14', buyer: 'urbannest', creator: 'yuki', category: CATEGORY_ID.HOME_LIFESTYLE, contentType: PHOTO, title: 'Catalogue refresh for the storage furniture range', quantity: 26, price: 580, deliveryDays: 7, createdDaysAgo: 60 },
  { key: 'h15', buyer: 'cocoa', creator: 'ava', category: CATEGORY_ID.ECOMMERCE_PRODUCTS, contentType: PHOTO, title: 'Gift box photography for the winter hamper range', quantity: 18, price: 690, deliveryDays: 8, createdDaysAgo: 57 },
  { key: 'h16', buyer: 'pulse', creator: 'liam', category: CATEGORY_ID.TECHNOLOGY_SAAS, contentType: VIDEO, title: 'Customer story film with a national restaurant group', quantity: 1, price: 1100, deliveryDays: 12, createdDaysAgo: 54 },
  { key: 'h17', buyer: 'bloom', creator: 'zoe', category: CATEGORY_ID.BEAUTY_SKINCARE, contentType: VIDEO, title: 'Routine explainer for the barrier repair moisturiser', quantity: 1, price: 810, deliveryDays: 9, createdDaysAgo: 51 },
  { key: 'h18', buyer: 'cocoa', creator: 'chloe', category: CATEGORY_ID.ECOMMERCE_PRODUCTS, contentType: PHOTO, title: 'Packaging stills for the single-origin bar range', quantity: 16, price: 540, deliveryDays: 7, createdDaysAgo: 48 },
  { key: 'h19', buyer: 'nimbus', creator: 'diego', category: CATEGORY_ID.FITNESS_WELLNESS, contentType: VIDEO, title: 'Equipment demonstration films for the rowing range', quantity: 4, price: 620, deliveryDays: 8, createdDaysAgo: 45 },
  { key: 'h20', buyer: 'atlas', creator: 'amara', category: CATEGORY_ID.EVENTS_ENTERTAINMENT, contentType: PHOTO, title: 'Event coverage for the summer travel showcase', quantity: 35, price: 740, deliveryDays: 6, createdDaysAgo: 42 },
  { key: 'h21', buyer: 'craftware', creator: 'noah', category: CATEGORY_ID.ECOMMERCE_PRODUCTS, contentType: PHOTO, title: 'Catalogue stills for the workbench accessory range', quantity: 20, price: 500, deliveryDays: 7, createdDaysAgo: 38 },
  { key: 'h22', buyer: 'verde', creator: 'sara', category: CATEGORY_ID.EDUCATION_COACHING, contentType: VIDEO, title: 'Training films for the new kitchen onboarding programme', quantity: 5, price: 580, deliveryDays: 9, createdDaysAgo: 34 },
  { key: 'h23', buyer: 'pulse', creator: 'liam', category: CATEGORY_ID.TECHNOLOGY_SAAS, contentType: VIDEO, title: 'Feature launch teaser for the mobile release', quantity: 1, price: 690, deliveryDays: 6, createdDaysAgo: 30 },
  { key: 'h24', buyer: 'cocoa', creator: 'amara', category: CATEGORY_ID.EVENTS_ENTERTAINMENT, contentType: PHOTO, title: 'Launch event coverage for the flagship cafe opening', quantity: 28, price: 660, deliveryDays: 6, createdDaysAgo: 26 },
  // h25–h28 (Prompt 13): a deeper review history for the marketplace's most
  // visited storefront, so the public profile demonstrates a real rating
  // distribution and its paginated review list rather than three cards.
  { key: 'h25', buyer: 'urbannest', creator: 'ava', category: CATEGORY_ID.ECOMMERCE_PRODUCTS, contentType: PHOTO, title: 'Tabletop stills for the ceramic serveware launch', quantity: 22, price: 610, deliveryDays: 7, createdDaysAgo: 24 },
  { key: 'h26', buyer: 'cocoa', creator: 'ava', category: CATEGORY_ID.FOOD_BEVERAGE, contentType: VIDEO, title: 'Barista process films for the seasonal drinks menu', quantity: 3, price: 720, deliveryDays: 8, createdDaysAgo: 21 },
  { key: 'h27', buyer: 'verde', creator: 'ava', category: CATEGORY_ID.FOOD_BEVERAGE, contentType: PHOTO, title: 'Ingredient sourcing stills for the supplier story page', quantity: 18, price: 560, deliveryDays: 6, createdDaysAgo: 18 },
  { key: 'h28', buyer: 'craftware', creator: 'ava', category: CATEGORY_ID.ECOMMERCE_PRODUCTS, contentType: PHOTO, title: 'Packaging stills for the gift tool range refresh', quantity: 20, price: 530, deliveryDays: 6, createdDaysAgo: 15 },
  // h29–h30 (Prompt 15): two more engagements for the buyer demo account, so
  // its payment history covers five calendar months and the "Spend — last 6
  // months" chart on the buyer overview has real monthly aggregation to show.
  //
  // These two are **appended rather than slotted into date order**: ids are
  // assigned in array order, and inserting h30 among the older rows would
  // renumber every request, order, and payment after it. The runner-up
  // rotation is index-based too, which is why the recent engagement takes the
  // even slot — the losing offer it generates is dated a fortnight ago, where
  // every creator account already exists.
  { key: 'h29', buyer: 'verde', creator: 'amara', category: CATEGORY_ID.EVENTS_ENTERTAINMENT, contentType: PHOTO, title: 'Supper club coverage for the harvest series', quantity: 24, price: 520, deliveryDays: 5, createdDaysAgo: 9 },
  { key: 'h30', buyer: 'verde', creator: 'ava', category: CATEGORY_ID.FOOD_BEVERAGE, contentType: PHOTO, title: 'Produce stills for the supplier story board', quantity: 14, price: 480, deliveryDays: 7, createdDaysAgo: 107 },
]

/** Boilerplate brief copy for history requests, rotated by content type. */
const HISTORY_BRIEF = {
  [PHOTO]: {
    description:
      'A completed commission from our archive. The brief covered the full shot list, delivery formats, and usage rights agreed at the time of award.',
    brandGuidelines:
      'Shot to the brand guidelines supplied with the brief: consistent colour, consistent framing, no heavy grading.',
    dos: 'Work to the agreed shot list. Deliver both graded and flat versions of every frame.',
    donts: 'No third-party branding in frame, no unlicensed props or backgrounds.',
    orientation: ORIENTATION.ANY,
    usageRights: USAGE_RIGHTS.WEBSITE,
  },
  [VIDEO]: {
    description:
      'A completed commission from our archive. The brief covered the script outline, delivery formats, and usage rights agreed at the time of award.',
    brandGuidelines:
      'Produced to the brand guidelines supplied with the brief: brand colours as accents only, captions on every master.',
    dos: 'Follow the agreed script outline. Deliver a master plus the cutdowns listed in the brief.',
    donts: 'No music requiring a separate licence, no on-camera appearances without a signed release.',
    orientation: ORIENTATION.LANDSCAPE,
    usageRights: USAGE_RIGHTS.PAID_ADS,
  },
  [BUNDLE]: {
    description:
      'A completed commission from our archive covering both photo and video deliverables under one brief.',
    brandGuidelines:
      'Photo and video delivered to one look, matched in colour and pacing to the brand guidelines supplied.',
    dos: 'Deliver the stills set and the film from the same shoot days.',
    donts: 'No unlicensed music or stock, no third-party branding in frame.',
    orientation: ORIENTATION.ANY,
    usageRights: USAGE_RIGHTS.FULL_COMMERCIAL,
  },
}

/* -------------------------------------------------------------------------- */
/* Assembly                                                                   */
/* -------------------------------------------------------------------------- */

const requestIdByKey = new Map()
let sequence = 0

function nextRequestId(key) {
  sequence += 1
  const id = seqId('req', sequence)
  requestIdByKey.set(key, id)
  return id
}

const scenarioRequests = SCENARIO_SOURCE.map((source) => {
  const createdAt = daysAgo(source.createdDaysAgo, 13, 30)
  const isDraft = source.status === REQUEST_STATUS.DRAFT
  return compact({
    id: nextRequestId(source.key),
    buyerId: buyerId(source.buyer),
    title: source.title,
    description: source.description,
    categoryId: source.category,
    contentType: source.contentType,
    quantity: source.quantity,
    videoDurationSec: source.videoDurationSec,
    orientation: source.orientation,
    usageRights: source.usageRights,
    brandGuidelines: source.brandGuidelines,
    dos: source.dos,
    donts: source.donts,
    referenceUrls: source.referenceUrls,
    budgetType: source.budgetType,
    budgetMin: source.budgetMin,
    budgetMax: source.budgetMax,
    currency: CURRENCY,
    // A draft may not have picked a date yet (Prompt 18's incomplete draft), so
    // `null` stays `null` rather than becoming "today" via `-null === -0`.
    deadline: source.deadlineInDays == null ? null : daysAgo(-source.deadlineInDays, 17, 0),
    // Prompt 16's "arrived from a creator's profile" hint, stored as the
    // storefront id (`cpr_…`) the data model specifies. Absent on every brief
    // that was written from a blank wizard, which is all but one of them.
    invitedCreatorId: source.invitedCreator
      ? creatorProfileId(source.invitedCreator)
      : undefined,
    status: source.status,
    // Derived in seed-db.js from the proposals on this request.
    proposalsCount: 0,
    awardedProposalId: null,
    createdAt,
    publishedAt: isDraft ? null : addDays(createdAt, 0.25),
  })
})

const historyRequests = HISTORY_ENGAGEMENTS.map((engagement) => {
  const createdAt = daysAgo(engagement.createdDaysAgo + 6, 13, 30)
  const brief = HISTORY_BRIEF[engagement.contentType]
  return compact({
    id: nextRequestId(engagement.key),
    buyerId: buyerId(engagement.buyer),
    title: engagement.title,
    description: brief.description,
    categoryId: engagement.category,
    contentType: engagement.contentType,
    quantity: engagement.quantity,
    videoDurationSec:
      engagement.contentType === PHOTO ? undefined : engagement.videoDurationSec ?? 60,
    orientation: brief.orientation,
    usageRights: brief.usageRights,
    brandGuidelines: brief.brandGuidelines,
    dos: brief.dos,
    donts: brief.donts,
    referenceUrls: [],
    budgetType: BUDGET_TYPE.FIXED,
    budgetMin: engagement.price,
    budgetMax: engagement.price,
    currency: CURRENCY,
    deadline: daysAgo(engagement.createdDaysAgo - engagement.deliveryDays, 17, 0),
    status: REQUEST_STATUS.COMPLETED,
    proposalsCount: 0,
    awardedProposalId: null,
    createdAt,
    publishedAt: addDays(createdAt, 0.25),
  })
})

/* -------------------------------------------------------------------------- */
/* Prompt 26 — briefs behind the disputed orders the case gallery needs        */
/* -------------------------------------------------------------------------- */

/**
 * Three more awarded briefs, each of which becomes a **disputed** order so the
 * dispute statuses that had no example can have one: `awaiting_buyer`,
 * `awaiting_creator`, and `escalated` (Prompt 26 §9). Two of them sit between
 * the two demo accounts, so the badge, the "Action needed" accent, and the
 * awaiting banners can all be walked without signing in as anyone else.
 *
 * Built **after** the history requests rather than appended to
 * `SCENARIO_SOURCE`: request ids are handed out in creation order, and adding a
 * row to the scenario array would renumber every archived brief — and with it
 * every order, payment, and delivery downstream. Landing them at the very end
 * moves nothing that already exists.
 */
const LATE_SCENARIO_SOURCE = [
  {
    key: 'awarded_verde_tasting',
    buyer: 'verde',
    status: REQUEST_STATUS.AWARDED,
    category: CATEGORY_ID.FOOD_BEVERAGE,
    contentType: PHOTO,
    title: 'Tasting menu stills for the winter chef’s table',
    description:
      'Photography for the eight-course winter tasting menu we run at the chef’s table on Fridays. Every course photographed as it is served, plus a handful of room frames showing the table set for service. These go on the booking page and into the printed card guests take home.',
    quantity: 14,
    orientation: ORIENTATION.ANY,
    usageRights: USAGE_RIGHTS.WEBSITE,
    brandGuidelines:
      'Low winter light, deep warm tones, plates photographed as served with no restyling between courses.',
    dos: 'One overhead and one 45-degree frame per course. Two or three wider frames of the table set for service.',
    donts: 'No flash at the table, no props brought in from outside the kitchen, no guests in frame.',
    referenceUrls: ['https://verdekitchen.test/press/chefs-table-brief'],
    budgetType: BUDGET_TYPE.FIXED,
    budgetMin: 700,
    budgetMax: 700,
    deadlineDaysAgo: 9,
    createdDaysAgo: 30,
  },
  {
    key: 'awarded_verde_courtyard',
    buyer: 'verde',
    status: REQUEST_STATUS.AWARDED,
    category: CATEGORY_ID.FOOD_BEVERAGE,
    contentType: VIDEO,
    title: 'Courtyard dining films for the winter terrace launch',
    description:
      'Three short films for the covered courtyard we are opening for winter service: the space at dusk with the heaters and lights on, a service sequence from the pass to the table, and a short piece on the winter drinks list.',
    quantity: 3,
    videoDurationSec: 30,
    orientation: ORIENTATION.PORTRAIT,
    usageRights: USAGE_RIGHTS.PAID_ADS,
    brandGuidelines:
      'Warm, low light and a slow pace. Kitchen and room sound only — no licensed music on any cut.',
    dos: 'Shoot at dusk with the heaters lit. Caption the drinks names on the third film.',
    donts: 'No guests in frame without a signed release, no drone footage, no music beds.',
    referenceUrls: ['https://verdekitchen.test/press/winter-terrace-brief'],
    budgetType: BUDGET_TYPE.FIXED,
    budgetMin: 820,
    budgetMax: 820,
    deadlineDaysAgo: 6,
    createdDaysAgo: 24,
  },
  {
    key: 'awarded_atlas_marina',
    buyer: 'atlas',
    status: REQUEST_STATUS.AWARDED,
    category: CATEGORY_ID.TRAVEL_HOSPITALITY,
    contentType: PHOTO,
    title: 'Marina resort photography for the spring brochure',
    description:
      'A full property set for the marina resort going into the spring brochure and the partner booking pages: rooms, the two restaurants, the pool terrace, and the berth frontage from the water.',
    quantity: 32,
    orientation: ORIENTATION.LANDSCAPE,
    usageRights: USAGE_RIGHTS.FULL_COMMERCIAL,
    brandGuidelines:
      'Bright, even coastal light. Rooms photographed as found, no digital tidying, no sky replacement.',
    dos: 'Cover every room category, both restaurants, the terrace, and the frontage from the water.',
    donts: 'No composite skies, no guests in frame, no third-party boat branding in the frontage shots.',
    referenceUrls: ['https://atlasescapes.test/partners/marina-brief'],
    budgetType: BUDGET_TYPE.FIXED,
    budgetMin: 1180,
    budgetMax: 1180,
    deadlineDaysAgo: 16,
    createdDaysAgo: 44,
  },
]

const lateScenarioRequests = LATE_SCENARIO_SOURCE.map((source) => {
  const createdAt = daysAgo(source.createdDaysAgo, 13, 30)
  return compact({
    id: nextRequestId(source.key),
    buyerId: buyerId(source.buyer),
    title: source.title,
    description: source.description,
    categoryId: source.category,
    contentType: source.contentType,
    quantity: source.quantity,
    videoDurationSec: source.videoDurationSec,
    orientation: source.orientation,
    usageRights: source.usageRights,
    brandGuidelines: source.brandGuidelines,
    dos: source.dos,
    donts: source.donts,
    referenceUrls: source.referenceUrls,
    budgetType: source.budgetType,
    budgetMin: source.budgetMin,
    budgetMax: source.budgetMax,
    currency: CURRENCY,
    // Every one of these briefs is already past its delivery date — which is
    // most of the reason each ended up in dispute.
    deadline: daysAgo(source.deadlineDaysAgo, 17, 0),
    status: source.status,
    proposalsCount: 0,
    awardedProposalId: null,
    createdAt,
    publishedAt: addDays(createdAt, 0.25),
  })
})

export const contentRequests = [
  ...scenarioRequests,
  ...historyRequests,
  ...lateScenarioRequests,
]

/** `requestId('open_verde_menu')` → `req_001`. Throws on an unknown key. */
export function requestId(key) {
  const id = requestIdByKey.get(key)
  if (!id) throw new Error(`Unknown request key: ${key}`)
  return id
}

/** The full request record for a key — factories read dates and prices off it. */
export function requestByKey(key) {
  const id = requestId(key)
  return contentRequests.find((request) => request.id === id)
}

/** Scenario request keys in seeded order, for iteration in other modules. */
export const SCENARIO_REQUEST_KEYS = SCENARIO_SOURCE.map((source) => source.key)

/** Keys of the requests that are live on the public board. */
export const OPEN_REQUEST_KEYS = SCENARIO_SOURCE.filter(
  (source) => source.status === REQUEST_STATUS.OPEN
).map((source) => source.key)
