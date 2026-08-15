// Page copy that surrounds the Content Policy itself.
//
// The policy — intro, sections, rules, enforcement — lives in
// `src/constants/policy.js` and is shared with the moderation console, so none
// of it is repeated here. What is here is the framing the public page adds:
// the review-state explainer and the "how to report something" section, which
// describe product behaviour rather than policy rules.

/** Sits under the review-state chips in the enforcement section. */
export const POLICY_REVIEW_STATES_NOTE =
  'A review that does not approve a submission ends in one of these instead — and published content can be restricted later if a report shows it breaches the policy.'

/**
 * The reporting section. Report flows are built in Prompt 30; until then the
 * page describes the capability and points at support, which is a real inbox.
 */
export const POLICY_REPORTING = Object.freeze({
  id: 'reporting',
  title: 'Reporting a concern',
  summary:
    'If something on BetterBlue looks wrong, tell us — reports are how most policy breaches reach our Trust & Safety team.',
  paragraphs: Object.freeze([
    'Content, profiles, and content requests can be reported from the page they appear on, and anything you report is reviewed against this policy. You do not need to be party to an order to report something, and we do not tell the member who reported them.',
    'If a report concerns an order you are part of, raise a dispute on the order as well: that keeps the payment held while the case is looked at. For anything else — including an intellectual property claim — contact our support team with the details and any links or references you have.',
  ]),
  ctaLabel: 'Contact Trust & Safety',
})
