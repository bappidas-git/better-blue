// Seed: `users` — every account on the marketplace (Prompt 05 §4.3).
//
// MOCK-AUTH: passwords are stored in plain text because JSON Server cannot
// authenticate — `authService` compares them client-side (00 §14). Every
// seeded account shares the same password, and the four demo accounts below
// are documented in the root README and docs/data-model.md. The Laravel
// backend replaces this with hashed credentials and real sessions; no seeded
// value here is a secret.

import { ACCOUNT_STATUS } from '../../src/constants/statuses.js'
import { ROLES } from '../../src/constants/roles.js'
import {
  DEFAULT_ADMIN_PERMISSIONS,
  PERMISSIONS,
  PERMISSION_VALUES,
} from '../../src/constants/permissions.js'
import { NOTIFICATION_CATEGORY } from '../../src/constants/notificationTypes.js'
import { avatarDataUri } from '../../src/constants/images.js'
import { compact, daysAgo } from '../seed-utils.js'

/** Shared password for every seeded account (MOCK-AUTH, documented). */
export const DEMO_PASSWORD = 'Password123!'

/**
 * Admin ids, so other modules never restate a `usr_admin_…` literal.
 *
 * Declared up here rather than beside the other exports at the bottom because
 * the buyer and creator sources below reference it in `statusChangedById` — a
 * restricted account records which of us restricted it (Prompt 29).
 */
export const ADMIN_ID = Object.freeze({
  SUPER: 'usr_super',
  MAYA: 'usr_admin_maya',
  DANIEL: 'usr_admin_daniel',
  PRIYA: 'usr_admin_priya',
})

/** Affiliate codes referenced by `referredByCode` and `affiliateProfiles`. */
export const AFFILIATE_CODE = Object.freeze({
  AVA: 'AVA-STUDIO',
  ISLA: 'ISLA-NORTH',
  NIMBUS: 'NIMBUS-PARTNER',
})

/** In-app notification preferences, all categories on unless overridden. */
function notificationPrefs(overrides = {}) {
  return Object.fromEntries(
    Object.values(NOTIFICATION_CATEGORY).map((category) => [
      category,
      { inApp: overrides[category] ?? true },
    ])
  )
}

/* -------------------------------------------------------------------------- */
/* Admin team                                                                 */
/* -------------------------------------------------------------------------- */

const ADMIN_SOURCE = [
  {
    id: 'usr_super',
    name: 'Elena Marsh',
    email: 'super@betterblue.test',
    role: ROLES.SUPER_ADMIN,
    // Super admins implicitly hold everything (permissions.js#hasPermission);
    // the array is stored anyway so the admin team table can render it.
    permissions: [...PERMISSION_VALUES],
    createdDaysAgo: 118,
    lastLoginDaysAgo: 0.4,
  },
  {
    id: 'usr_admin_maya',
    name: 'Maya Chen',
    email: 'admin@betterblue.test',
    role: ROLES.ADMIN,
    // Marketplace operations lead — the demo admin account, so the permission
    // set is broad enough to drive moderation, disputes, and support flows.
    permissions: [
      ...DEFAULT_ADMIN_PERMISSIONS,
      PERMISSIONS.CATEGORIES_MANAGE,
      PERMISSIONS.AUDIT_VIEW,
    ],
    createdDaysAgo: 117,
    lastLoginDaysAgo: 0.6,
  },
  {
    id: 'usr_admin_daniel',
    name: 'Daniel Okafor',
    email: 'daniel.okafor@betterblue.test',
    role: ROLES.ADMIN,
    // Finance admin — payments, settlements, and the affiliate program.
    permissions: [
      PERMISSIONS.PAYMENTS_MANAGE,
      PERMISSIONS.SETTLEMENTS_PROCESS,
      PERMISSIONS.ORDERS_MANAGE,
      PERMISSIONS.AFFILIATES_MANAGE,
      PERMISSIONS.AUDIT_VIEW,
    ],
    createdDaysAgo: 116,
    lastLoginDaysAgo: 1.3,
  },
  {
    id: 'usr_admin_priya',
    name: 'Priya Raman',
    email: 'priya.raman@betterblue.test',
    role: ROLES.ADMIN,
    // Trust & Safety reviewer — content only, no finance or platform access.
    permissions: [
      PERMISSIONS.MODERATION_REVIEW,
      PERMISSIONS.CONTENT_MANAGE,
      PERMISSIONS.REPORTS_MANAGE,
      PERMISSIONS.SUPPORT_MANAGE,
    ],
    createdDaysAgo: 115,
    lastLoginDaysAgo: 0.9,
  },
]

/* -------------------------------------------------------------------------- */
/* Buyers — the businesses commissioning content                              */
/* -------------------------------------------------------------------------- */

const BUYER_SOURCE = [
  {
    key: 'verde',
    id: 'usr_buyer_verde',
    name: 'Nora Whitfield',
    email: 'buyer@betterblue.test',
    phone: '+1 503 555 0142',
    createdDaysAgo: 114,
    lastLoginDaysAgo: 0.3,
  },
  {
    key: 'nimbus',
    id: 'usr_buyer_nimbus',
    name: 'Marcus Reyes',
    email: 'marcus.reyes@nimbusfitness.test',
    phone: '+44 161 555 0118',
    createdDaysAgo: 113,
    lastLoginDaysAgo: 1.2,
  },
  {
    key: 'atlas',
    id: 'usr_buyer_atlas',
    name: 'Sofia Almeida',
    email: 'sofia.almeida@atlastravel.test',
    phone: '+351 21 555 0173',
    createdDaysAgo: 112,
    lastLoginDaysAgo: 2.1,
  },
  {
    key: 'bloom',
    id: 'usr_buyer_bloom',
    name: 'Hana Sato',
    email: 'hana.sato@bloombeauty.test',
    phone: '+1 416 555 0164',
    createdDaysAgo: 111,
    lastLoginDaysAgo: 0.8,
  },
  {
    key: 'craftware',
    id: 'usr_buyer_craftware',
    name: 'Owen Bailey',
    email: 'owen.bailey@craftwaretools.test',
    phone: '+49 221 555 0135',
    createdDaysAgo: 110,
    lastLoginDaysAgo: 3.4,
    referredByCode: AFFILIATE_CODE.AVA,
  },
  {
    key: 'urbannest',
    id: 'usr_buyer_urbannest',
    name: 'Leila Haddad',
    email: 'leila.haddad@urbannest.test',
    phone: '+1 718 555 0157',
    createdDaysAgo: 109,
    lastLoginDaysAgo: 1.7,
  },
  {
    key: 'pulse',
    id: 'usr_buyer_pulse',
    name: 'Tomas Novak',
    email: 'tomas.novak@pulsesaas.test',
    phone: '+353 1 555 0129',
    createdDaysAgo: 108,
    lastLoginDaysAgo: 0.5,
    // Prefers a quieter inbox — moderation updates switched off.
    prefs: { [NOTIFICATION_CATEGORY.MODERATION]: false },
  },
  {
    key: 'cocoa',
    id: 'usr_buyer_cocoa',
    name: 'Grace Adeyemi',
    email: 'grace.adeyemi@cocoaandco.test',
    phone: '+61 3 5550 0186',
    createdDaysAgo: 107,
    lastLoginDaysAgo: 4.2,
    referredByCode: AFFILIATE_CODE.ISLA,
  },
  {
    // The **fresh buyer** demo account (Prompt 15): registered two days ago,
    // with a half-finished business profile, no briefs, no orders, and no
    // notifications. It exists so the buyer dashboard's first-run state —
    // the onboarding checklist rather than the stats band — can be
    // demonstrated without emptying the main demo account. Nothing downstream
    // may give this account requests, proposals, orders, or payments.
    key: 'harborlane',
    id: 'usr_buyer_harborlane',
    name: 'Ruth Alvarez',
    email: 'newbuyer@betterblue.test',
    createdDaysAgo: 2,
    lastLoginDaysAgo: 0.1,
  },
  {
    // **Blacklisted buyer** (Prompt 29 §9): the account-closure state the admin
    // users console has to be able to show and the login screen has to be able
    // to refuse. Deliberately given no orders, requests, or payments downstream
    // — this account exists to demonstrate an account status, and giving it
    // marketplace history would put a closed account in the middle of live
    // finance figures.
    key: 'meridian',
    id: 'usr_buyer_meridian',
    name: 'Callum Doyle',
    email: 'callum.doyle@meridiansupply.test',
    phone: '+61 2 5550 0248',
    createdDaysAgo: 76,
    lastLoginDaysAgo: 41,
    accountStatus: ACCOUNT_STATUS.BLACKLISTED,
    statusReason:
      'Repeated chargebacks after delivery and a brief that misrepresented the licence being purchased. Closed after a written warning.',
    statusChangedDaysAgo: 40,
    statusChangedById: ADMIN_ID.MAYA,
  },
  {
    // **Deactivated buyer** (Prompt 29 §9): the one non-active status our team
    // does *not* set — this member closed their own account from Settings, which
    // is why its audit line is written with `meta.selfService` (contract §6.26)
    // and why the admin console offers no way back into it.
    key: 'foundry',
    id: 'usr_buyer_foundry',
    name: 'Priyanka Nair',
    email: 'priyanka.nair@foundryandco.test',
    createdDaysAgo: 92,
    lastLoginDaysAgo: 55,
    accountStatus: ACCOUNT_STATUS.DEACTIVATED,
    statusReason: 'Closed their own account from Settings — campaign programme wound down.',
    statusChangedDaysAgo: 54,
  },
]

/* -------------------------------------------------------------------------- */
/* Creators — the professionals producing the content                         */
/* -------------------------------------------------------------------------- */

const CREATOR_SOURCE = [
  {
    key: 'ava',
    id: 'usr_creator_ava',
    name: 'Ava Martinez',
    email: 'creator@betterblue.test',
    phone: '+1 512 555 0110',
    createdDaysAgo: 113,
    lastLoginDaysAgo: 0.2,
  },
  {
    key: 'liam',
    id: 'usr_creator_liam',
    name: 'Liam Chen',
    email: 'liam@liamchenfilms.test',
    phone: '+1 604 555 0122',
    createdDaysAgo: 112,
    lastLoginDaysAgo: 0.7,
  },
  {
    key: 'zoe',
    id: 'usr_creator_zoe',
    name: 'Zoe Okonkwo',
    email: 'zoe@okonkwostudio.test',
    phone: '+44 20 555 0131',
    createdDaysAgo: 111,
    lastLoginDaysAgo: 1.1,
  },
  {
    key: 'diego',
    id: 'usr_creator_diego',
    name: 'Diego Ramirez',
    email: 'diego@ramirezmotion.test',
    phone: '+34 91 555 0148',
    createdDaysAgo: 110,
    lastLoginDaysAgo: 2.3,
  },
  {
    key: 'isla',
    id: 'usr_creator_isla',
    name: 'Isla Bergstrom',
    email: 'isla@bergstromvisuals.test',
    phone: '+46 8 555 0159',
    createdDaysAgo: 109,
    lastLoginDaysAgo: 1.9,
  },
  {
    key: 'noah',
    id: 'usr_creator_noah',
    name: 'Noah Feldman',
    email: 'noah@feldmanmotorstudio.test',
    phone: '+1 313 555 0167',
    createdDaysAgo: 108,
    lastLoginDaysAgo: 3.1,
  },
  {
    key: 'yuki',
    id: 'usr_creator_yuki',
    name: 'Yuki Tanaka',
    email: 'yuki@tanakainteriors.test',
    phone: '+81 6 5550 0175',
    createdDaysAgo: 107,
    lastLoginDaysAgo: 2.6,
  },
  {
    key: 'amara',
    id: 'usr_creator_amara',
    name: 'Amara Diallo',
    email: 'amara@diallocreative.test',
    phone: '+221 33 555 0183',
    createdDaysAgo: 106,
    lastLoginDaysAgo: 1.4,
  },
  {
    key: 'sara',
    id: 'usr_creator_sara',
    name: 'Sara Lindqvist',
    email: 'sara@lindqvistlearning.test',
    phone: '+358 9 555 0191',
    createdDaysAgo: 105,
    lastLoginDaysAgo: 5.2,
    prefs: { [NOTIFICATION_CATEGORY.AFFILIATE]: false },
  },
  {
    key: 'chloe',
    id: 'usr_creator_chloe',
    name: 'Chloe Dubois',
    email: 'chloe@duboisbeautystudio.test',
    phone: '+33 4 5555 0204',
    createdDaysAgo: 104,
    lastLoginDaysAgo: 29,
    // Suspended while Trust & Safety reviews a licensing complaint (see the
    // `user.suspend` audit entry and the dispute raised against this account).
    //
    // The reason, its date, and who set it must match that audit entry — Prompt
    // 29's detail banner reads them off the account, and an admin comparing the
    // banner with the audit tab would spot the difference immediately.
    accountStatus: ACCOUNT_STATUS.SUSPENDED,
    statusReason:
      'Licensing review following an upheld report and an unresolved non-delivery dispute.',
    statusChangedDaysAgo: 29,
    statusChangedById: ADMIN_ID.MAYA,
  },
  {
    key: 'mateo',
    id: 'usr_creator_mateo',
    name: 'Mateo Rossi',
    email: 'mateo@rossieventfilm.test',
    phone: '+39 02 5555 0212',
    createdDaysAgo: 44,
    lastLoginDaysAgo: 1.6,
    referredByCode: AFFILIATE_CODE.NIMBUS,
  },
  {
    key: 'ethan',
    id: 'usr_creator_ethan',
    name: 'Ethan Brooks',
    email: 'ethan@brooksestatemedia.test',
    phone: '+1 720 555 0227',
    createdDaysAgo: 38,
    lastLoginDaysAgo: 6.4,
    referredByCode: AFFILIATE_CODE.AVA,
  },
]

/* -------------------------------------------------------------------------- */
/* Assembly                                                                   */
/* -------------------------------------------------------------------------- */

function buildAccount(source, role) {
  return compact({
    id: source.id,
    email: source.email,
    // MOCK-AUTH: plain text on purpose — see the module header.
    password: DEMO_PASSWORD,
    role,
    accountStatus: source.accountStatus ?? ACCOUNT_STATUS.ACTIVE,
    name: source.name,
    avatarUrl: avatarDataUri(source.name),
    phone: source.phone,
    createdAt: daysAgo(source.createdDaysAgo, 10, 15),
    lastLoginAt: daysAgo(source.lastLoginDaysAgo, 8, 30),
    // Prompt 29: why an account is not `active`, when that was decided, and by
    // whom. All three are absent on an `active` account rather than present and
    // empty — `compact` drops them — which is what lets the detail banner test
    // `statusReason` and render nothing at all for a member in good standing.
    statusReason: source.statusReason,
    statusChangedAt:
      source.statusChangedDaysAgo === undefined
        ? undefined
        : daysAgo(source.statusChangedDaysAgo, 11, 20),
    statusChangedById: source.statusChangedById,
    notificationPrefs: notificationPrefs(source.prefs),
    // `permissions` is an admin-only field (00 §11).
    permissions: source.permissions,
    referredByCode: source.referredByCode,
  })
}

export const ADMIN_USERS = ADMIN_SOURCE.map((source) =>
  buildAccount(source, source.role)
)

export const BUYER_USERS = BUYER_SOURCE.map((source) =>
  buildAccount(source, ROLES.BUYER)
)

export const CREATOR_USERS = CREATOR_SOURCE.map((source) =>
  buildAccount(source, ROLES.CREATOR)
)

/** Ordered `{ key, userId }` pairs so downstream factories can address people. */
export const BUYER_KEYS = BUYER_SOURCE.map(({ key, id }) => ({ key, userId: id }))
export const CREATOR_KEYS = CREATOR_SOURCE.map(({ key, id }) => ({ key, userId: id }))

/** `buyerId('verde')` → `usr_buyer_verde`. Throws on an unknown key. */
export function buyerId(key) {
  const match = BUYER_SOURCE.find((buyer) => buyer.key === key)
  if (!match) throw new Error(`Unknown buyer key: ${key}`)
  return match.id
}

/** `creatorId('ava')` → `usr_creator_ava`. Throws on an unknown key. */
export function creatorId(key) {
  const match = CREATOR_SOURCE.find((creator) => creator.key === key)
  if (!match) throw new Error(`Unknown creator key: ${key}`)
  return match.id
}

/** ISO account-creation date for a user id — used for chronology validation. */
export const USER_CREATED_AT = Object.freeze(
  Object.fromEntries(
    [...ADMIN_USERS, ...BUYER_USERS, ...CREATOR_USERS].map((user) => [
      user.id,
      user.createdAt,
    ])
  )
)

/** Documented sign-in shortcuts (root README + docs/data-model.md). */
export const DEMO_ACCOUNTS = Object.freeze([
  { role: ROLES.BUYER, email: 'buyer@betterblue.test', name: 'Nora Whitfield' },
  {
    role: ROLES.BUYER,
    email: 'newbuyer@betterblue.test',
    name: 'Ruth Alvarez — fresh account',
  },
  { role: ROLES.CREATOR, email: 'creator@betterblue.test', name: 'Ava Martinez' },
  { role: ROLES.ADMIN, email: 'admin@betterblue.test', name: 'Maya Chen' },
  { role: ROLES.SUPER_ADMIN, email: 'super@betterblue.test', name: 'Elena Marsh' },
])

export const users = [...ADMIN_USERS, ...BUYER_USERS, ...CREATOR_USERS]
