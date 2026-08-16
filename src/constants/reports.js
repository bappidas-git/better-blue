// Member reports — the vocabulary behind `reports.subjectType` and
// `reports.reason` (`docs/api-contract.md` §6.21).
//
// Promoted here by Prompt 30, which is the first prompt that needs these values
// in the **app** rather than only in the seed: the public report dialog offers
// the reasons, and the admin reports queue prints them. `scripts/seed-utils.js`
// now re-exports both enums from this module instead of owning its own copy —
// the same path `VISIBILITY` and `MODERATION_SUBJECT` took in Prompt 22, so the
// seed and the app can never drift.
//
// Deliberately its own module rather than an addition to `statuses.js`: neither
// enum is a status, neither renders through `StatusChip`, and both carry a
// *description* that `STATUS_META` has no room for — the sentence under a radio
// option in the report dialog, which is what stops somebody filing an IP
// concern as "other".

/** What a member report is about. `subjectId` resolves per type (§6.21). */
export const REPORT_SUBJECT = Object.freeze({
  PORTFOLIO_ITEM: 'portfolio_item',
  /** A `cpr_…`, **not** a `usr_…` — reports are filed against the storefront. */
  CREATOR_PROFILE: 'creator_profile',
  REQUEST: 'request',
})

/** Why a member reported it — the options in the report dialog. */
export const REPORT_REASON = Object.freeze({
  PROHIBITED_CONTENT: 'prohibited_content',
  INTELLECTUAL_PROPERTY: 'intellectual_property',
  MISLEADING_CLAIMS: 'misleading_claims',
  SPAM: 'spam',
  OTHER: 'other',
})

/**
 * The reasons as the dialog renders them, in order.
 *
 * Wording is the plain, professional register the Content Policy uses (00 §1):
 * a reporter is telling us what they saw, not making an accusation, and the
 * copy should not invite one. `description` is the line under each option.
 */
export const REPORT_REASONS = Object.freeze([
  Object.freeze({
    value: REPORT_REASON.PROHIBITED_CONTENT,
    label: 'Content Policy concern',
    description:
      'Something here looks like content the BetterBlue Content Policy does not allow.',
  }),
  Object.freeze({
    value: REPORT_REASON.INTELLECTUAL_PROPERTY,
    label: 'Intellectual property concern',
    description:
      'Imagery, footage, music, or a likeness appears to be used without the rights to it.',
  }),
  Object.freeze({
    value: REPORT_REASON.MISLEADING_CLAIMS,
    label: 'Misleading or inaccurate',
    description:
      'The work, the claims made about it, or the profile behind it do not reflect reality.',
  }),
  Object.freeze({
    value: REPORT_REASON.SPAM,
    label: 'Spam or off-platform solicitation',
    description:
      'Repetitive postings, or an attempt to move an engagement off BetterBlue.',
  }),
  Object.freeze({
    value: REPORT_REASON.OTHER,
    label: 'Something else',
    description: 'A concern that does not fit the options above — tell us below.',
  }),
])

/** How each subject type reads in a sentence, plus its icon in the queue. */
export const REPORT_SUBJECT_META = Object.freeze({
  [REPORT_SUBJECT.PORTFOLIO_ITEM]: Object.freeze({
    label: 'Portfolio item',
    icon: 'solar:gallery-linear',
  }),
  [REPORT_SUBJECT.CREATOR_PROFILE]: Object.freeze({
    label: 'Creator profile',
    icon: 'solar:user-id-linear',
  }),
  [REPORT_SUBJECT.REQUEST]: Object.freeze({
    label: 'Content request',
    icon: 'solar:clipboard-list-linear',
  }),
})

/** Longest a reporter's free-text explanation may be (contract §6.21). */
export const REPORT_DETAILS_MAX = 500

const FALLBACK_SUBJECT_META = Object.freeze({
  label: 'Reported content',
  icon: 'solar:flag-linear',
})

/** Label + icon for a subject type, never `undefined`. */
export function getReportSubjectMeta(subjectType) {
  return REPORT_SUBJECT_META[subjectType] ?? FALLBACK_SUBJECT_META
}

/**
 * How a reason reads on screen. Falls back to a humanised token so a reason
 * written by a future version still prints something a person can read.
 */
export function getReportReasonLabel(reason) {
  const match = REPORT_REASONS.find((entry) => entry.value === reason)
  if (match) return match.label
  const text = String(reason ?? '').replace(/_/g, ' ').trim()
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : 'Unspecified'
}
