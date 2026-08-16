// Seed: `buyerProfiles` + `creatorProfiles` (Prompt 05 §4.3).
//
// A profile is the marketplace-facing record for an account: the business a
// buyer represents, and the service a creator sells. `users` stays the
// authentication record, so both profiles carry a `userId` foreign key.
//
// Aggregates (`totalSpent`, `ratingAvg`, `ratingCount`, `completedOrders`) are
// seeded at zero here and recomputed from orders, payments, and reviews by
// `scripts/seed-db.js`, so they can never contradict the ledger.

import { CATEGORY_ID } from '../../src/constants/categoriesFallback.js'
import { CONTENT_TYPE } from '../../src/constants/statuses.js'
import { avatarDataUri } from '../../src/constants/images.js'
import {
  CURRENCY,
  PAYOUT_METHOD_TYPE,
  compact,
  daysAgo,
  maskedAccount,
} from '../seed-utils.js'
import { buyerId, creatorId } from './users.js'

/* -------------------------------------------------------------------------- */
/* Buyer profiles                                                             */
/* -------------------------------------------------------------------------- */

const BUYER_SOURCE = [
  {
    key: 'verde',
    id: 'bpr_verde',
    companyName: 'Verde Kitchen',
    industry: 'Food & Beverage',
    website: 'https://verdekitchen.test',
    bio: 'A plant-forward restaurant group with six locations across the Pacific Northwest. We commission seasonal menu photography and short social videos for each new menu drop.',
    location: 'Portland, OR, United States',
    createdDaysAgo: 114,
  },
  {
    key: 'nimbus',
    id: 'bpr_nimbus',
    companyName: 'Nimbus Fitness',
    industry: 'Fitness & Wellness',
    website: 'https://nimbusfitness.test',
    bio: 'A studio chain and connected training app. We run always-on social campaigns and need a steady stream of class, equipment, and coaching content.',
    location: 'Manchester, United Kingdom',
    createdDaysAgo: 113,
  },
  {
    key: 'atlas',
    id: 'bpr_atlas',
    companyName: 'Atlas Travel Co',
    industry: 'Travel & Hospitality',
    website: 'https://atlastravel.test',
    bio: 'A boutique tour operator running small-group trips across southern Europe. Our marketing runs on authentic destination photography and short itinerary films.',
    location: 'Lisbon, Portugal',
    createdDaysAgo: 112,
  },
  {
    key: 'bloom',
    id: 'bpr_bloom',
    companyName: 'Bloom Beauty',
    industry: 'Beauty & Skincare',
    website: 'https://bloombeauty.test',
    bio: 'A clean skincare brand sold online and through pharmacy partners. We commission product photography, routine explainers, and customer testimonial videos.',
    location: 'Toronto, Canada',
    createdDaysAgo: 111,
  },
  {
    key: 'craftware',
    id: 'bpr_craftware',
    companyName: 'Craftware Tools',
    industry: 'E-commerce & Retail',
    website: 'https://craftwaretools.test',
    bio: 'A direct-to-consumer workshop tool brand. Our listings and ad campaigns rely on clear product detail photography and honest demonstration videos.',
    location: 'Cologne, Germany',
    createdDaysAgo: 110,
  },
  {
    key: 'urbannest',
    id: 'bpr_urbannest',
    companyName: 'UrbanNest Interiors',
    industry: 'Home & Lifestyle',
    website: 'https://urbannest.test',
    bio: 'A small-space furniture and homeware studio. We publish styled room sets and assembly walkthroughs across our storefront and social channels.',
    location: 'Brooklyn, NY, United States',
    createdDaysAgo: 109,
  },
  {
    key: 'pulse',
    id: 'bpr_pulse',
    companyName: 'Pulse SaaS',
    industry: 'Technology & SaaS',
    website: 'https://pulsesaas.test',
    bio: 'Workforce scheduling software for hospitality teams. We commission product walkthroughs, customer story videos, and conference booth content.',
    location: 'Dublin, Ireland',
    createdDaysAgo: 108,
  },
  {
    key: 'cocoa',
    id: 'bpr_cocoa',
    companyName: 'Cocoa & Co',
    industry: 'Food & Beverage',
    website: 'https://cocoaandco.test',
    bio: 'A single-origin chocolate maker with a cafe in Fitzroy. We market seasonal boxes and gifting ranges with warm, tactile product content.',
    location: 'Melbourne, Australia',
    createdDaysAgo: 107,
  },
  {
    // The fresh-buyer demo account (Prompt 15). Only the company name exists —
    // industry, website, bio, and location are the fields the onboarding
    // checklist asks this account to fill in, so they are deliberately absent
    // and `compact()` keeps them out of the record entirely.
    key: 'harborlane',
    id: 'bpr_harborlane',
    companyName: 'Harbor Lane Bakery',
    createdDaysAgo: 2,
  },
  {
    // The blacklisted account (Prompt 29). It has a full profile because it
    // traded normally before the closure — an account that was never used would
    // not be an interesting one to show a closure on.
    key: 'meridian',
    id: 'bpr_meridian',
    companyName: 'Meridian Supply Co',
    industry: 'E-commerce & Retail',
    website: 'https://meridiansupply.test',
    bio: 'A wholesale homeware supplier selling through marketplaces across Australia and New Zealand.',
    location: 'Sydney, Australia',
    createdDaysAgo: 76,
  },
  {
    // The self-deactivated account (Prompt 29).
    key: 'foundry',
    id: 'bpr_foundry',
    companyName: 'Foundry & Co',
    industry: 'Professional Services',
    website: 'https://foundryandco.test',
    bio: 'A brand consultancy that commissioned campaign content on behalf of its retail clients.',
    location: 'Bengaluru, India',
    createdDaysAgo: 92,
  },
]

export const buyerProfiles = BUYER_SOURCE.map((source) =>
  compact({
    id: source.id,
    userId: buyerId(source.key),
    companyName: source.companyName,
    industry: source.industry,
    website: source.website,
    bio: source.bio,
    location: source.location,
    logoUrl: avatarDataUri(source.companyName),
    // Recomputed by seed-db.js from the payments ledger.
    totalSpent: 0,
    createdAt: daysAgo(source.createdDaysAgo, 10, 40),
  })
)

/** `buyerProfileId('verde')` → `bpr_verde`. */
export function buyerProfileId(key) {
  const match = BUYER_SOURCE.find((buyer) => buyer.key === key)
  if (!match) throw new Error(`Unknown buyer key: ${key}`)
  return match.id
}

/** Company name by buyer key — reused in request copy and notifications. */
export function buyerCompanyName(key) {
  const match = BUYER_SOURCE.find((buyer) => buyer.key === key)
  if (!match) throw new Error(`Unknown buyer key: ${key}`)
  return match.companyName
}

/* -------------------------------------------------------------------------- */
/* Creator profiles                                                           */
/* -------------------------------------------------------------------------- */

const CREATOR_SOURCE = [
  {
    key: 'ava',
    id: 'cpr_ava',
    displayName: 'Ava Martinez',
    tagline: 'Food and product content that makes people hungry to buy',
    bio: 'I shoot menu, packaging, and lifestyle content for restaurants and food brands. Ten years in commercial food photography, now split between stills and short-form video for social and paid campaigns. Studio in East Austin with a full prop and surface library.',
    categories: [CATEGORY_ID.FOOD_BEVERAGE, CATEGORY_ID.ECOMMERCE_PRODUCTS],
    contentTypes: [CONTENT_TYPE.PHOTO, CONTENT_TYPE.VIDEO, CONTENT_TYPE.BUNDLE],
    startingPrice: 320,
    location: 'Austin, TX, United States',
    languages: ['English', 'Spanish'],
    responseTimeHours: 4,
    availability: true,
    featured: true,
    verified: true,
    payoutLast4: '4821',
    createdDaysAgo: 113,
  },
  {
    key: 'liam',
    id: 'cpr_liam',
    displayName: 'Liam Chen',
    tagline: 'Product films and customer stories for software teams',
    bio: 'I make product walkthroughs, launch films, and customer story videos for B2B software companies. Former in-house video lead at a scheduling platform, so I write to the roadmap as much as to the camera. Remote-friendly workflow with scripted storyboards before every shoot.',
    categories: [CATEGORY_ID.TECHNOLOGY_SAAS, CATEGORY_ID.EDUCATION_COACHING],
    contentTypes: [CONTENT_TYPE.VIDEO, CONTENT_TYPE.BUNDLE],
    startingPrice: 480,
    location: 'Vancouver, Canada',
    languages: ['English', 'Mandarin'],
    responseTimeHours: 6,
    availability: true,
    featured: true,
    verified: true,
    payoutLast4: '7310',
    createdDaysAgo: 112,
  },
  {
    key: 'zoe',
    id: 'cpr_zoe',
    displayName: 'Zoe Okonkwo',
    tagline: 'Beauty and fashion campaigns with editorial polish',
    bio: 'Beauty and apparel content for brands that want campaign-quality work at social speed. I cover texture and swatch photography, routine explainers, and lookbook video, and I handle model casting and rights clearance end to end.',
    categories: [CATEGORY_ID.BEAUTY_SKINCARE, CATEGORY_ID.FASHION_APPAREL],
    contentTypes: [CONTENT_TYPE.PHOTO, CONTENT_TYPE.VIDEO],
    startingPrice: 390,
    location: 'London, United Kingdom',
    languages: ['English'],
    responseTimeHours: 3,
    availability: true,
    featured: true,
    verified: true,
    payoutLast4: '5566',
    createdDaysAgo: 111,
  },
  {
    key: 'diego',
    id: 'cpr_diego',
    displayName: 'Diego Ramirez',
    tagline: 'Training and equipment video for fitness brands',
    bio: 'I film class content, coaching explainers, and equipment demonstrations for gyms, studios, and wellness apps. Certified trainer as well as a videographer, so the technique on camera holds up to scrutiny.',
    categories: [CATEGORY_ID.FITNESS_WELLNESS, CATEGORY_ID.ECOMMERCE_PRODUCTS],
    contentTypes: [CONTENT_TYPE.VIDEO, CONTENT_TYPE.BUNDLE],
    startingPrice: 260,
    location: 'Madrid, Spain',
    languages: ['Spanish', 'English'],
    responseTimeHours: 8,
    availability: true,
    featured: false,
    verified: true,
    payoutLast4: '9042',
    createdDaysAgo: 110,
  },
  {
    key: 'isla',
    id: 'cpr_isla',
    displayName: 'Isla Bergstrom',
    tagline: 'Destination and hospitality photography, Nordic to Mediterranean',
    bio: 'Travel and hospitality content for operators, hotels, and tourism boards. I work light and fast on location, delivering a mix of wide destination frames, room and amenity detail, and vertical social cutdowns from the same shoot day.',
    categories: [CATEGORY_ID.TRAVEL_HOSPITALITY, CATEGORY_ID.HOME_LIFESTYLE],
    contentTypes: [CONTENT_TYPE.PHOTO, CONTENT_TYPE.BUNDLE],
    startingPrice: 540,
    location: 'Stockholm, Sweden',
    languages: ['Swedish', 'English'],
    responseTimeHours: 12,
    availability: true,
    featured: false,
    verified: true,
    payoutLast4: '2287',
    createdDaysAgo: 109,
  },
  {
    key: 'noah',
    id: 'cpr_noah',
    displayName: 'Noah Feldman',
    tagline: 'Automotive and hard-goods product content',
    bio: 'Vehicle and equipment content for dealerships, parts brands, and marketplaces. Controlled studio lighting for detail work, plus rolling and location footage when a listing needs motion. Comfortable with tight turnarounds around launch dates.',
    categories: [CATEGORY_ID.AUTOMOTIVE, CATEGORY_ID.ECOMMERCE_PRODUCTS],
    contentTypes: [CONTENT_TYPE.PHOTO, CONTENT_TYPE.VIDEO],
    startingPrice: 300,
    location: 'Detroit, MI, United States',
    languages: ['English'],
    responseTimeHours: 5,
    availability: true,
    featured: false,
    verified: true,
    payoutLast4: '6133',
    createdDaysAgo: 108,
  },
  {
    key: 'yuki',
    id: 'cpr_yuki',
    displayName: 'Yuki Tanaka',
    tagline: 'Calm, considered interiors and homeware photography',
    bio: 'Interiors, homeware, and property photography with a quiet, natural-light approach. I style on set and shoot for catalogue, listing, and social use in one pass, and I deliver both flat and lightly graded versions of every frame.',
    categories: [CATEGORY_ID.HOME_LIFESTYLE, CATEGORY_ID.REAL_ESTATE],
    contentTypes: [CONTENT_TYPE.PHOTO],
    startingPrice: 275,
    location: 'Osaka, Japan',
    languages: ['Japanese', 'English'],
    responseTimeHours: 10,
    availability: true,
    featured: false,
    verified: true,
    payoutLast4: '3874',
    createdDaysAgo: 107,
  },
  {
    key: 'amara',
    id: 'cpr_amara',
    displayName: 'Amara Diallo',
    tagline: 'Fashion lookbooks and event coverage with real energy',
    bio: 'Apparel campaigns, lookbooks, and event films for brands and venues. I build shot lists around the way a collection actually sells, and I keep a trusted crew for styling, hair, and lighting on larger production days.',
    categories: [CATEGORY_ID.FASHION_APPAREL, CATEGORY_ID.EVENTS_ENTERTAINMENT],
    contentTypes: [CONTENT_TYPE.PHOTO, CONTENT_TYPE.VIDEO, CONTENT_TYPE.BUNDLE],
    startingPrice: 410,
    location: 'Dakar, Senegal',
    languages: ['French', 'English', 'Wolof'],
    responseTimeHours: 6,
    availability: true,
    featured: false,
    verified: true,
    payoutLast4: '4409',
    createdDaysAgo: 106,
  },
  {
    key: 'sara',
    id: 'cpr_sara',
    displayName: 'Sara Lindqvist',
    tagline: 'Course and explainer video for education brands',
    bio: 'Explainer and course content for education platforms, coaches, and software teams. Scripting, on-camera presenting, screen capture, and motion graphics in one package, with captions and localisation-ready exports as standard.',
    categories: [CATEGORY_ID.EDUCATION_COACHING, CATEGORY_ID.TECHNOLOGY_SAAS],
    contentTypes: [CONTENT_TYPE.VIDEO],
    startingPrice: 350,
    location: 'Helsinki, Finland',
    languages: ['Finnish', 'English'],
    responseTimeHours: 9,
    availability: true,
    featured: false,
    verified: true,
    payoutLast4: '7712',
    createdDaysAgo: 105,
  },
  {
    key: 'chloe',
    id: 'cpr_chloe',
    displayName: 'Chloe Dubois',
    tagline: 'Skincare and packaging stills with a soft, natural finish',
    bio: 'Product and packaging photography for beauty and wellness brands, shot in natural light with minimal retouching. Studio in Lyon, and I keep a standing surface and glassware library for skincare sets.',
    categories: [CATEGORY_ID.BEAUTY_SKINCARE, CATEGORY_ID.ECOMMERCE_PRODUCTS],
    contentTypes: [CONTENT_TYPE.PHOTO],
    startingPrice: 290,
    location: 'Lyon, France',
    languages: ['French', 'English'],
    responseTimeHours: 18,
    // Account is suspended pending a licensing review, so the profile is off
    // the market until Trust & Safety closes the case.
    availability: false,
    featured: false,
    verified: true,
    payoutLast4: '8890',
    createdDaysAgo: 104,
  },
  {
    key: 'mateo',
    id: 'cpr_mateo',
    displayName: 'Mateo Rossi',
    tagline: 'Event films and venue content across northern Italy',
    bio: 'Event, festival, and venue content for organisers and hospitality groups. Multi-camera coverage on the day, then recap films and vertical cutdowns for the campaign that follows. New to BetterBlue, ten years in event production.',
    categories: [CATEGORY_ID.EVENTS_ENTERTAINMENT, CATEGORY_ID.TRAVEL_HOSPITALITY],
    contentTypes: [CONTENT_TYPE.PHOTO, CONTENT_TYPE.VIDEO],
    startingPrice: 240,
    location: 'Milan, Italy',
    languages: ['Italian', 'English'],
    responseTimeHours: 14,
    availability: true,
    featured: false,
    // Still working through the first portfolio review round.
    verified: false,
    createdDaysAgo: 44,
  },
  {
    key: 'ethan',
    id: 'cpr_ethan',
    displayName: 'Ethan Brooks',
    tagline: 'Property listings shot to sell, next-day turnaround',
    bio: 'Real estate and home content for agents and developers. Listing photography, walkthrough video, and floor-plan-friendly wide frames, delivered the next working day. Building out my BetterBlue portfolio after four years shooting for local agencies.',
    categories: [CATEGORY_ID.REAL_ESTATE, CATEGORY_ID.HOME_LIFESTYLE],
    contentTypes: [CONTENT_TYPE.PHOTO, CONTENT_TYPE.VIDEO],
    startingPrice: 220,
    location: 'Denver, CO, United States',
    languages: ['English'],
    responseTimeHours: 24,
    availability: false,
    featured: false,
    verified: false,
    createdDaysAgo: 38,
  },
]

export const creatorProfiles = CREATOR_SOURCE.map((source) =>
  compact({
    id: source.id,
    userId: creatorId(source.key),
    displayName: source.displayName,
    tagline: source.tagline,
    bio: source.bio,
    categories: source.categories,
    contentTypes: source.contentTypes,
    startingPrice: source.startingPrice,
    currency: CURRENCY,
    location: source.location,
    languages: source.languages,
    responseTimeHours: source.responseTimeHours,
    availability: source.availability,
    featured: source.featured,
    verified: source.verified,
    // Recomputed by seed-db.js from reviews and completed orders.
    ratingAvg: 0,
    ratingCount: 0,
    completedOrders: 0,
    payoutMethod: source.payoutLast4
      ? {
          type: PAYOUT_METHOD_TYPE,
          accountName: source.displayName,
          accountMasked: maskedAccount(source.payoutLast4),
        }
      : undefined,
    createdAt: daysAgo(source.createdDaysAgo, 11, 5),
  })
)

/** `creatorProfileId('ava')` → `cpr_ava`. */
export function creatorProfileId(key) {
  const match = CREATOR_SOURCE.find((creator) => creator.key === key)
  if (!match) throw new Error(`Unknown creator key: ${key}`)
  return match.id
}

/** Display name by creator key — reused in proposal and dispute copy. */
export function creatorDisplayName(key) {
  const match = CREATOR_SOURCE.find((creator) => creator.key === key)
  if (!match) throw new Error(`Unknown creator key: ${key}`)
  return match.displayName
}

/** Creator keys in profile order — drives the portfolio and history factories. */
export const CREATOR_PROFILE_KEYS = CREATOR_SOURCE.map((source) => source.key)

/**
 * How long each creator has been on BetterBlue, in days before the seed
 * anchor. Downstream factories space a creator's portfolio and order history
 * inside this window so nothing predates their account.
 */
export const CREATOR_TENURE_DAYS = Object.freeze(
  Object.fromEntries(CREATOR_SOURCE.map((source) => [source.key, source.createdDaysAgo]))
)

/** `creatorProfiles.id` keyed by `users.id`, for FK translation downstream. */
export const CREATOR_PROFILE_BY_USER = Object.freeze(
  Object.fromEntries(
    CREATOR_SOURCE.map((source) => [creatorId(source.key), source.id])
  )
)

/**
 * Inverse of the map above: the account behind a creator profile. Portfolio
 * items are owned by the profile, while moderation decisions, notifications,
 * and audit entries address the *account* — this is the bridge between them.
 */
export const USER_BY_CREATOR_PROFILE = Object.freeze(
  Object.fromEntries(
    CREATOR_SOURCE.map((source) => [source.id, creatorId(source.key)])
  )
)
