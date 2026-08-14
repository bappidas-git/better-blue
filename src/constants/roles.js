// Roles — prompts/00-architecture-and-rules.md §9 / §11.
// The four roles are fixed for the product's lifetime; the future Laravel
// backend mirrors these exact string values. Never write role literals in
// components or services — import from here (00 §2.5).

export const ROLES = Object.freeze({
  BUYER: 'buyer',
  CREATOR: 'creator',
  ADMIN: 'admin',
  SUPER_ADMIN: 'super_admin',
})

/** Every role value, in product hierarchy order. */
export const ROLE_VALUES = Object.freeze([
  ROLES.BUYER,
  ROLES.CREATOR,
  ROLES.ADMIN,
  ROLES.SUPER_ADMIN,
])

/** Roles that reach the admin console. */
export const ADMIN_ROLES = Object.freeze([ROLES.ADMIN, ROLES.SUPER_ADMIN])

/**
 * Human-facing role metadata. Labels surface verbatim in the UI (role chips,
 * registration cards, admin team tables), so keep them polished.
 */
export const ROLE_META = Object.freeze({
  [ROLES.BUYER]: Object.freeze({
    label: 'Buyer',
    description:
      'A business commissioning commercial photos and videos — posts content requests, reviews proposals, and funds orders.',
  }),
  [ROLES.CREATOR]: Object.freeze({
    label: 'Creator',
    description:
      'A professional content creator — publishes a portfolio, sends proposals, and delivers commissioned brand content.',
  }),
  [ROLES.ADMIN]: Object.freeze({
    label: 'Admin',
    description:
      'A BetterBlue team member operating the marketplace within the permissions granted to them.',
  }),
  [ROLES.SUPER_ADMIN]: Object.freeze({
    label: 'Super Admin',
    description:
      'Full platform ownership — manages the admin team, permissions, and platform configuration.',
  }),
})

/**
 * Landing route per role after sign-in (00 §9).
 * Prompt 08 introduces `src/routes/paths.js` as the canonical route registry;
 * it should build its role-home helpers on top of these values rather than
 * restating them.
 */
export const ROLE_HOME_PATH = Object.freeze({
  [ROLES.BUYER]: '/buyer',
  [ROLES.CREATOR]: '/creator',
  [ROLES.ADMIN]: '/admin',
  [ROLES.SUPER_ADMIN]: '/admin',
})

/** True when the role belongs to the admin console (admin or super admin). */
export function isAdminRole(role) {
  return ADMIN_ROLES.includes(role)
}
