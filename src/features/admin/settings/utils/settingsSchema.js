// The five settings sections, described once — Prompt 35 §4.1.
//
// Every section on `/admin/settings` is the same machine with different fields:
// read the singleton into form values, validate, diff what changed, and send
// back **complete sub-objects** (the JSON Server `PATCH` trap, contract §6.27).
// Writing that machine five times would produce five drifting versions of it,
// so it is described as data here and driven by one page.
//
// A section declares:
//
//   toValues(settings)          the singleton → flat form values
//   toPatch(values, settings)   form values → the sub-objects to PATCH
//   validators                  one `useForm` rule per field
//   changes(settings, values)   the field-level diff the confirm dialog shows
//                               and the audit entry stores
//
// **Bounds live here, not in the components.** The same numbers back the
// validator, the helper text, and the input's `min`/`max`, so a field cannot
// advertise one range and enforce another (§13).

import { listParam } from '@/hooks/useListParams'
import { SETTINGS_FALLBACK } from '@/services/settingsService'
import { formatCurrency, formatPercent } from '@/utils/formatters'
import { compose, email, max, maxLength, min, minLength, numeric, required } from '@/utils/validators'

/* -------------------------------------------------------------------------- */
/* Bounds                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Every limit the screen enforces, as `{ min, max }`. Percentages are in
 * **percent units** (what the reader types); everything else is in the unit the
 * setting is stored in.
 */
export const SETTINGS_BOUNDS = Object.freeze({
  platformName: Object.freeze({ min: 3, max: 40 }),
  autoAcceptDays: Object.freeze({ min: 2, max: 14 }),
  payoutMinAmount: Object.freeze({ min: 10, max: 500 }),
  commissionPercent: Object.freeze({ min: 5, max: 40 }),
  affiliatePercent: Object.freeze({ min: 5, max: 50 }),
  attributionDays: Object.freeze({ min: 7, max: 90 }),
  // Not specified by the prompt; $5–$500 mirrors the platform payout floor's
  // shape while allowing a smaller minimum, since referral commission accrues
  // in much smaller amounts than order earnings.
  affiliatePayoutMin: Object.freeze({ min: 5, max: 500 }),
  reviewSlaDays: Object.freeze({ min: 1, max: 7 }),
  categoryName: Object.freeze({ min: 3, max: 30 }),
  rejectionReasonLabel: Object.freeze({ min: 3, max: 60 }),
})

/** The one order amount every commission example on this screen is worked on. */
export const COMMISSION_EXAMPLE_ORDER = 400

/* -------------------------------------------------------------------------- */
/* Percent ⇄ decimal                                                          */
/* -------------------------------------------------------------------------- */

/**
 * A stored rate (`0.2`) as the percentage a reader types (`20`).
 *
 * Rounded to two decimal places of a percent — 0.01% granularity — so a rate
 * round-trips through the input unchanged instead of arriving back as
 * `19.999999999999996`.
 *
 * @param {number|string} rate a decimal fraction
 * @returns {number|''} the percentage, or `''` when there is nothing to show
 */
export function rateToPercent(rate) {
  const value = Number(rate)
  if (rate === '' || rate === null || rate === undefined || !Number.isFinite(value)) return ''
  return Math.round(value * 10000) / 100
}

/**
 * A typed percentage (`20`) as the rate that is stored (`0.2`) — the inverse of
 * {@link rateToPercent}, and the **only** sanctioned conversion (§7: "percent
 * inputs store decimals via money-safe conversion").
 *
 * The integer round happens in percent-hundredths rather than after the divide,
 * which is what keeps `12.5%` at exactly `0.125` and stops a rate from drifting
 * a millionth every time it is saved.
 *
 * @param {number|string} percent a percentage
 * @returns {number|null} the decimal fraction, or `null` when unusable
 */
export function percentToRate(percent) {
  const value = Number(percent)
  if (percent === '' || percent === null || percent === undefined || !Number.isFinite(value)) {
    return null
  }
  return Math.round(value * 100) / 10000
}

/** A whole number from a form field, or `null` when there is nothing usable. */
function toInteger(value) {
  const parsed = Number(value)
  return value === '' || value === null || !Number.isFinite(parsed) ? null : Math.round(parsed)
}

/** A money amount from a form field, snapped to cents. */
function toMoney(value) {
  const parsed = Number(value)
  return value === '' || value === null || !Number.isFinite(parsed)
    ? null
    : Math.round(parsed * 100) / 100
}

/* -------------------------------------------------------------------------- */
/* Sections                                                                   */
/* -------------------------------------------------------------------------- */

export const SETTINGS_SECTION = Object.freeze({
  GENERAL: 'general',
  COMMISSIONS: 'commissions',
  AFFILIATE: 'affiliate',
  MODERATION: 'moderation',
  FEATURES: 'features',
})

/**
 * The feature flags, with what each one actually switches off. The Features
 * section renders this list, and the confirm dialog quotes `disableWarning`
 * word for word before anything is hidden.
 */
export const FEATURE_FLAGS = Object.freeze([
  Object.freeze({
    key: 'affiliateProgram',
    label: 'Affiliate program',
    icon: 'solar:users-group-two-rounded-linear',
    scope:
      'The referral program end to end: enrolment, code capture, commission accrual, and affiliate payouts.',
    usedBy: ['Affiliate dashboard', 'Admin › Affiliates', 'Pricing page teaser', 'Buyer nav'],
    disableWarning:
      'The Affiliate entry disappears from the buyer nav and the admin console immediately, referral links stop capturing signups, and no new commission accrues. Nothing already earned is touched.',
  }),
  Object.freeze({
    key: 'publicRequestBoard',
    label: 'Public request board',
    icon: 'solar:clipboard-list-linear',
    scope:
      'The signed-out `/requests` board and its detail pages — how creators discover briefs before joining.',
    usedBy: ['Public request board', 'Top navigation', 'Admin › Requests'],
    disableWarning:
      'The public board and every brief on it stop being reachable to signed-out visitors, and the link leaves the top navigation. Signed-in creators keep browsing requests from their dashboard.',
  }),
  Object.freeze({
    key: 'reviews',
    label: 'Reviews',
    icon: 'solar:star-linear',
    scope:
      'Asking a buyer to rate a completed order, and the review they leave on the creator’s profile.',
    usedBy: ['Buyer order detail', 'Creator public profile'],
    disableWarning:
      'Buyers stop being prompted to review completed orders and the review form closes. Reviews already published stay exactly where they are.',
  }),
  Object.freeze({
    key: 'disputes',
    label: 'Disputes',
    icon: 'solar:shield-warning-linear',
    scope: 'Raising a new case against an order, from either side.',
    usedBy: ['Buyer order detail', 'Creator order detail', 'Admin › Disputes'],
    disableWarning:
      '“Report an issue” disappears from every order, so no new case can be opened. Cases already open keep running and stay workable in the console.',
  }),
])

/** Display copy for a value that has not been set. */
const NOT_SET = 'Not set'

const money = (value) => (value === null || value === '' ? NOT_SET : formatCurrency(value))
const percentOf = (value) =>
  value === null || value === '' ? NOT_SET : formatPercent(Number(value) / 100, { maximumFractionDigits: 2 })
const days = (value) =>
  value === null || value === '' ? NOT_SET : `${value} ${Number(value) === 1 ? 'day' : 'days'}`
const onOff = (value) => (value ? 'On' : 'Off')
const text = (value) => (value === '' || value === null || value === undefined ? NOT_SET : String(value))

/**
 * A section definition.
 *
 * @typedef {object} SettingsSectionSpec
 * @property {string} key one of {@link SETTINGS_SECTION}
 * @property {string} label tab label
 * @property {string} icon Iconify name
 * @property {string} title card heading
 * @property {string} description one line under the heading
 * @property {(settings: object) => object} toValues singleton → form values
 * @property {(values: object, settings: object) => object} toPatch form values →
 *   the complete sub-objects to send
 * @property {object} validators `useForm` rules, keyed by field name
 * @property {(settings: object, values: object, context: object) => Array} changes
 *   the field-level diff, `[{ key, label, from, to }]`
 */

const GENERAL_SECTION = {
  key: SETTINGS_SECTION.GENERAL,
  label: 'General',
  icon: 'solar:settings-linear',
  title: 'General',
  description: 'The platform’s name, where members write to, and the two windows every order runs on.',

  toValues: (settings) => ({
    platformName: settings?.general?.platformName ?? '',
    supportEmail: settings?.general?.supportEmail ?? '',
    currency: settings?.general?.currency ?? SETTINGS_FALLBACK.general.currency,
    autoAcceptDays: settings?.general?.autoAcceptDays ?? '',
    payoutMinAmount: settings?.general?.payoutMinAmount ?? '',
  }),

  toPatch: (values, settings) => ({
    general: {
      ...settings?.general,
      platformName: String(values.platformName).trim(),
      supportEmail: String(values.supportEmail).trim(),
      currency: values.currency,
      autoAcceptDays: toInteger(values.autoAcceptDays),
      payoutMinAmount: toMoney(values.payoutMinAmount),
    },
  }),

  validators: {
    platformName: compose(
      required('The platform needs a name.'),
      minLength(SETTINGS_BOUNDS.platformName.min),
      maxLength(SETTINGS_BOUNDS.platformName.max)
    ),
    supportEmail: compose(required('Members need somewhere to write to.'), email()),
    currency: required(),
    autoAcceptDays: compose(
      required('Set a review window.'),
      numeric(),
      min(SETTINGS_BOUNDS.autoAcceptDays.min),
      max(SETTINGS_BOUNDS.autoAcceptDays.max)
    ),
    payoutMinAmount: compose(
      required('Set a payout minimum.'),
      numeric(),
      min(SETTINGS_BOUNDS.payoutMinAmount.min),
      max(SETTINGS_BOUNDS.payoutMinAmount.max)
    ),
  },

  changes: (settings, values) => {
    const before = GENERAL_SECTION.toValues(settings)
    return [
      { key: 'general.platformName', label: 'Platform name', from: text(before.platformName), to: text(values.platformName) },
      { key: 'general.supportEmail', label: 'Support email', from: text(before.supportEmail), to: text(values.supportEmail) },
      { key: 'general.currency', label: 'Currency', from: text(before.currency), to: text(values.currency) },
      { key: 'general.autoAcceptDays', label: 'Auto-accept window', from: days(before.autoAcceptDays), to: days(values.autoAcceptDays) },
      { key: 'general.payoutMinAmount', label: 'Payout minimum', from: money(before.payoutMinAmount), to: money(values.payoutMinAmount) },
    ].filter((change) => change.from !== change.to)
  },
}

const COMMISSIONS_SECTION = {
  key: SETTINGS_SECTION.COMMISSIONS,
  label: 'Commissions',
  icon: 'solar:hand-money-linear',
  title: 'Commissions',
  description: 'What BetterBlue keeps from an order, by default and per category.',

  toValues: (settings) => ({
    defaultRatePercent: rateToPercent(settings?.commission?.defaultRate),
    // `{ catId: percent }`, mirroring the stored `{ catId: rate }`. A category
    // with no entry uses the default — an absent key, never a zero.
    categoryOverrides: Object.fromEntries(
      Object.entries(settings?.commission?.categoryOverrides ?? {}).map(([id, rate]) => [
        id,
        rateToPercent(rate),
      ])
    ),
  }),

  toPatch: (values, settings) => ({
    commission: {
      ...settings?.commission,
      defaultRate: percentToRate(values.defaultRatePercent),
      categoryOverrides: Object.fromEntries(
        Object.entries(values.categoryOverrides ?? {})
          .map(([id, percent]) => [id, percentToRate(percent)])
          .filter(([, rate]) => rate !== null)
      ),
    },
  }),

  validators: {
    defaultRatePercent: compose(
      required('Set a commission rate.'),
      numeric(),
      min(SETTINGS_BOUNDS.commissionPercent.min, `Enter ${SETTINGS_BOUNDS.commissionPercent.min}% or more.`),
      max(SETTINGS_BOUNDS.commissionPercent.max, `Enter ${SETTINGS_BOUNDS.commissionPercent.max}% or less.`)
    ),
    // The overrides map validates per row inside the table — one `useForm` rule
    // cannot address a dynamic set of keys, and an invalid row must name itself.
    categoryOverrides: (overrides) => {
      const { min: low, max: high } = SETTINGS_BOUNDS.commissionPercent
      const bad = Object.entries(overrides ?? {}).find(([, percent]) => {
        const value = Number(percent)
        return !Number.isFinite(value) || value < low || value > high
      })
      return bad ? `Category overrides must be between ${low}% and ${high}%.` : undefined
    },
  },

  changes: (settings, values, { categoryNameFor } = {}) => {
    const before = COMMISSIONS_SECTION.toValues(settings)
    const rows = []

    if (before.defaultRatePercent !== values.defaultRatePercent) {
      rows.push({
        key: 'commission.defaultRate',
        label: 'Default rate',
        from: percentOf(before.defaultRatePercent),
        to: percentOf(values.defaultRatePercent),
      })
    }

    const ids = new Set([
      ...Object.keys(before.categoryOverrides ?? {}),
      ...Object.keys(values.categoryOverrides ?? {}),
    ])
    ids.forEach((id) => {
      const from = before.categoryOverrides?.[id]
      const to = values.categoryOverrides?.[id]
      if (from === to) return
      rows.push({
        key: `commission.categoryOverrides.${id}`,
        label: `${categoryNameFor?.(id) ?? id} override`,
        from: from === undefined ? 'Default' : percentOf(from),
        to: to === undefined ? 'Default' : percentOf(to),
      })
    })

    return rows
  },
}

const AFFILIATE_SECTION = {
  key: SETTINGS_SECTION.AFFILIATE,
  label: 'Affiliate',
  icon: 'solar:users-group-two-rounded-linear',
  title: 'Affiliate program',
  description: 'Whether members can refer businesses, and what a referral is worth.',

  toValues: (settings) => ({
    // SINGLE SOURCE: the program's on/off switch **is** the feature flag. There
    // is no `affiliate.enabled` any more (contract §6.27) — this control and
    // the one in Features write the same key.
    affiliateProgram: settings?.features?.affiliateProgram !== false,
    commissionRatePercent: rateToPercent(settings?.affiliate?.commissionRate),
    attributionDays: settings?.affiliate?.attributionDays ?? '',
    payoutMinAmount: settings?.affiliate?.payoutMinAmount ?? '',
  }),

  toPatch: (values, settings) => ({
    affiliate: {
      ...settings?.affiliate,
      commissionRate: percentToRate(values.commissionRatePercent),
      attributionDays: toInteger(values.attributionDays),
      payoutMinAmount: toMoney(values.payoutMinAmount),
    },
    features: {
      ...settings?.features,
      affiliateProgram: Boolean(values.affiliateProgram),
    },
  }),

  validators: {
    commissionRatePercent: compose(
      required('Set a referral share.'),
      numeric(),
      min(SETTINGS_BOUNDS.affiliatePercent.min, `Enter ${SETTINGS_BOUNDS.affiliatePercent.min}% or more.`),
      max(SETTINGS_BOUNDS.affiliatePercent.max, `Enter ${SETTINGS_BOUNDS.affiliatePercent.max}% or less.`)
    ),
    attributionDays: compose(
      required('Set an attribution window.'),
      numeric(),
      min(SETTINGS_BOUNDS.attributionDays.min),
      max(SETTINGS_BOUNDS.attributionDays.max)
    ),
    payoutMinAmount: compose(
      required('Set a payout minimum.'),
      numeric(),
      min(SETTINGS_BOUNDS.affiliatePayoutMin.min),
      max(SETTINGS_BOUNDS.affiliatePayoutMin.max)
    ),
  },

  changes: (settings, values) => {
    const before = AFFILIATE_SECTION.toValues(settings)
    return [
      { key: 'features.affiliateProgram', label: 'Affiliate program', from: onOff(before.affiliateProgram), to: onOff(values.affiliateProgram) },
      { key: 'affiliate.commissionRate', label: 'Referral share', from: percentOf(before.commissionRatePercent), to: percentOf(values.commissionRatePercent) },
      { key: 'affiliate.attributionDays', label: 'Attribution window', from: days(before.attributionDays), to: days(values.attributionDays) },
      { key: 'affiliate.payoutMinAmount', label: 'Affiliate payout minimum', from: money(before.payoutMinAmount), to: money(values.payoutMinAmount) },
    ].filter((change) => change.from !== change.to)
  },
}

const MODERATION_SECTION = {
  key: SETTINGS_SECTION.MODERATION,
  label: 'Moderation',
  icon: 'tabler:shield-check',
  title: 'Moderation',
  description: 'How much of what the marketplace produces reaches a reviewer, and how fast it is expected to move.',

  toValues: (settings) => ({
    autoApproveDeliveries: settings?.moderation?.autoApproveDeliveries !== false,
    reviewSlaDays: settings?.moderation?.reviewSlaDays ?? '',
    customRejectionReasons: (settings?.moderation?.customRejectionReasons ?? []).map((reason) => ({
      code: reason.code,
      label: reason.label,
    })),
  }),

  toPatch: (values, settings) => ({
    moderation: {
      ...settings?.moderation,
      autoApproveDeliveries: Boolean(values.autoApproveDeliveries),
      reviewSlaDays: toInteger(values.reviewSlaDays),
      customRejectionReasons: values.customRejectionReasons ?? [],
    },
  }),

  validators: {
    reviewSlaDays: compose(
      required('Set a review target.'),
      numeric(),
      min(SETTINGS_BOUNDS.reviewSlaDays.min),
      max(SETTINGS_BOUNDS.reviewSlaDays.max)
    ),
  },

  changes: (settings, values) => {
    const before = MODERATION_SECTION.toValues(settings)
    const rows = [
      { key: 'moderation.autoApproveDeliveries', label: 'Auto-approve deliveries', from: onOff(before.autoApproveDeliveries), to: onOff(values.autoApproveDeliveries) },
      { key: 'moderation.reviewSlaDays', label: 'Review target', from: days(before.reviewSlaDays), to: days(values.reviewSlaDays) },
    ].filter((change) => change.from !== change.to)

    const codes = new Set([
      ...before.customRejectionReasons.map((reason) => reason.code),
      ...values.customRejectionReasons.map((reason) => reason.code),
    ])
    codes.forEach((code) => {
      const from = before.customRejectionReasons.find((reason) => reason.code === code)
      const to = values.customRejectionReasons.find((reason) => reason.code === code)
      if (from?.label === to?.label) return
      rows.push({
        key: `moderation.customRejectionReasons.${code}`,
        label: 'Custom rejection reason',
        from: from ? from.label : 'Not offered',
        to: to ? to.label : 'Removed',
      })
    })

    return rows
  },
}

const FEATURES_SECTION = {
  key: SETTINGS_SECTION.FEATURES,
  label: 'Features',
  icon: 'solar:widget-4-linear',
  title: 'Features',
  description: 'Whole areas of BetterBlue, switched on or off for everybody at once.',

  toValues: (settings) =>
    Object.fromEntries(
      FEATURE_FLAGS.map((flag) => [
        flag.key,
        (settings?.features?.[flag.key] ?? SETTINGS_FALLBACK.features[flag.key]) !== false,
      ])
    ),

  toPatch: (values, settings) => ({
    features: {
      ...settings?.features,
      ...Object.fromEntries(FEATURE_FLAGS.map((flag) => [flag.key, Boolean(values[flag.key])])),
    },
  }),

  validators: {},

  changes: (settings, values) => {
    const before = FEATURES_SECTION.toValues(settings)
    return FEATURE_FLAGS.map((flag) => ({
      key: `features.${flag.key}`,
      label: flag.label,
      from: onOff(before[flag.key]),
      to: onOff(values[flag.key]),
      // Danger flavour: the confirm dialog leads with this when it is present.
      warning: before[flag.key] && !values[flag.key] ? flag.disableWarning : undefined,
    })).filter((change) => change.from !== change.to)
  },
}

/** Every section, in tab order. */
export const SETTINGS_SECTIONS = Object.freeze([
  GENERAL_SECTION,
  COMMISSIONS_SECTION,
  AFFILIATE_SECTION,
  MODERATION_SECTION,
  FEATURES_SECTION,
])

/** A section spec by key, falling back to General for an unknown value. */
export function getSettingsSection(key) {
  return SETTINGS_SECTIONS.find((section) => section.key === key) ?? SETTINGS_SECTIONS[0]
}

/** URL state for the screen — one key, so a section is linkable and reloadable. */
export const SETTINGS_PARAMS = Object.freeze({
  section: listParam.choice({
    options: SETTINGS_SECTIONS.map((section) => section.key),
    fallback: SETTINGS_SECTION.GENERAL,
    isFilter: false,
  }),
})

/* -------------------------------------------------------------------------- */
/* Custom rejection reasons                                                   */
/* -------------------------------------------------------------------------- */

/**
 * A stable code for a custom rejection reason, generated from its label the
 * same way a category slug is generated from its name — `'Watermark visible'`
 * → `'custom_watermark_visible'`.
 *
 * The `custom_` prefix is what keeps an addition from ever colliding with a
 * canonical `REJECTION_REASON_CODE`, which is why the constants can stay the
 * authority on the built-in six (contract §6.27).
 *
 * @param {string} label what the reviewer will read
 * @returns {string} the code stored on decided cases
 */
export function rejectionReasonCode(label) {
  const slug = String(label ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40)
  return slug ? `custom_${slug}` : ''
}
