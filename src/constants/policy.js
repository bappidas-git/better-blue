// Content Policy — prompts/00-architecture-and-rules.md §1.
//
// Single source for the public Content Policy page (Prompt 11), the policy
// reference panel in the moderation console (Prompt 30), and the rejection
// reasons reviewers pick from. Copy is written as ordinary marketplace trust
// and safety guidance: informative, professional, and stated plainly.

/** ISO date the policy copy below was last revised (shown as "Last updated"). */
export const POLICY_LAST_UPDATED = '2026-08-01'

export const POLICY_INTRO =
  'BetterBlue is a professional marketplace for commercial content. Businesses commission photos and videos for marketing, advertising, product, and brand use, and creators deliver that work under clear terms. This policy sets out what may be created, published, and sold on BetterBlue, and how our Trust & Safety team reviews content against it. It applies to portfolios, content requests, proposals, deliverables, messages, and profile information alike.'

/**
 * Policy sections — `{ id, title, summary, rules[] }`.
 * Rendered in order on the public page and in the moderation reference panel.
 */
export const POLICY_SECTIONS = Object.freeze([
  Object.freeze({
    id: 'professional_content',
    title: 'Professional commercial content only',
    summary:
      'Everything published on BetterBlue must be business-oriented content a brand could put its name to.',
    rules: Object.freeze([
      'Content must serve a commercial purpose: brand promotion, product marketing, social media campaigns, testimonials, advertising, website imagery, or lifestyle and product demonstrations.',
      'Portfolios should present work you produced for real or self-directed commercial briefs, presented as it would be delivered to a client.',
      'Content requests must describe a genuine business need, including the deliverables, usage rights, and budget expected.',
      'Keep people in your content appropriately dressed and presented for a professional advertising context.',
      'Content produced for a client remains subject to this policy even when it is delivered privately within an order.',
    ]),
  }),
  Object.freeze({
    id: 'prohibited_content',
    title: 'Prohibited content',
    summary:
      'The following are not permitted anywhere on BetterBlue, in public listings or private deliveries.',
    rules: Object.freeze([
      'Nudity.',
      'Pornographic or sexually explicit content.',
      'Sexual services or solicitation.',
      'Escort-related services.',
      'Illegal content, or content that promotes or facilitates illegal activity.',
      'Exploitative content, including content that degrades or endangers the people in it.',
      'Any inappropriate content involving minors.',
      'Requests, proposals, or messages asking another member to produce any of the above.',
    ]),
  }),
  Object.freeze({
    id: 'intellectual_property',
    title: 'Intellectual property and licensing',
    summary:
      'Publish only what you have the rights to, and be precise about the rights you transfer.',
    rules: Object.freeze([
      'Only upload work you created or hold the rights to publish, including any client work you are permitted to show.',
      'Clear the rights to music, stock footage, fonts, logos, and third-party trademarks used in a deliverable before you submit it.',
      'Obtain permission from anyone appearing in your content, and confirm they consent to commercial use.',
      'Buyers receive exactly the usage rights agreed on the order — organic social, paid ads, website, or full commercial use — and nothing broader.',
      'Do not present another creator’s work as your own, and do not resell delivered content beyond the agreed license.',
    ]),
  }),
  Object.freeze({
    id: 'respectful_conduct',
    title: 'Respectful conduct',
    summary:
      'Communication on BetterBlue stays professional, in both directions, at every stage of an engagement.',
    rules: Object.freeze([
      'Treat buyers and creators as business partners: be clear, be timely, and keep feedback constructive.',
      'Harassment, discrimination, hate speech, threats, and personal attacks are not tolerated.',
      'Do not pressure a member to work outside the agreed scope, deadline, or price, or to take payment off-platform.',
      'Do not share another member’s personal information, private messages, or unpublished content without their consent.',
      'Report concerns through the reporting tools rather than acting on them yourself.',
    ]),
  }),
  Object.freeze({
    id: 'accurate_representation',
    title: 'Accurate representation',
    summary:
      'Profiles, portfolios, briefs, and deliverables must reflect reality.',
    rules: Object.freeze([
      'Represent your identity, business, location, and experience truthfully.',
      'Do not inflate portfolio results, invent client relationships, or misstate what a piece of content is.',
      'Disclose material use of AI generation or heavy compositing when a buyer would reasonably expect to know.',
      'Deliver what the accepted proposal describes — quantity, format, duration, and specifications included.',
      'Reviews must describe a real engagement; incentivized, traded, or fabricated reviews are not permitted.',
    ]),
  }),
  Object.freeze({
    id: 'enforcement',
    title: 'How we enforce this policy',
    summary:
      'Content is reviewed before it goes live, and again whenever it is reported.',
    rules: Object.freeze([
      'Submitted content moves through review states — submitted, under review, then approved, changes requested, or rejected — and only approved content is published.',
      'If changes are requested, you can update the submission and send it back for review.',
      'Published content can be restricted later if a review or a member report shows it breaches this policy.',
      'Repeated or serious breaches can lead to account suspension or, in the most serious cases, permanent removal from the marketplace.',
      'Every decision records a reason, and you are notified when the status of your content changes.',
      'Report content, profiles, or requests that concern you, and our Trust & Safety team will review them.',
    ]),
  }),
])

/** Codes reviewers attach to a rejection or a changes-requested decision. */
export const REJECTION_REASON_CODE = Object.freeze({
  POLICY_PROHIBITED_CONTENT: 'policy_prohibited_content',
  LOW_PRODUCTION_QUALITY: 'low_production_quality',
  MISMATCH_WITH_BRIEF: 'mismatch_with_brief',
  IP_VIOLATION: 'ip_violation',
  METADATA_INCOMPLETE: 'metadata_incomplete',
  OTHER: 'other',
})

/**
 * Rejection reasons offered in the moderation decision dialog (Prompt 30).
 * Labels and descriptions are shown to reviewers and, alongside the reviewer's
 * notes, to the creator who submitted the content.
 */
export const REJECTION_REASONS = Object.freeze([
  Object.freeze({
    code: REJECTION_REASON_CODE.POLICY_PROHIBITED_CONTENT,
    label: 'Prohibited content',
    description:
      'The submission contains material the BetterBlue Content Policy does not allow.',
  }),
  Object.freeze({
    code: REJECTION_REASON_CODE.LOW_PRODUCTION_QUALITY,
    label: 'Production quality below standard',
    description:
      'Lighting, focus, framing, audio, or editing fall short of the marketplace’s minimum quality bar.',
  }),
  Object.freeze({
    code: REJECTION_REASON_CODE.MISMATCH_WITH_BRIEF,
    label: 'Does not match the brief',
    description:
      'The content differs from the agreed brief — wrong deliverables, format, quantity, or specifications.',
  }),
  Object.freeze({
    code: REJECTION_REASON_CODE.IP_VIOLATION,
    label: 'Intellectual property issue',
    description:
      'Music, footage, logos, or likenesses appear to be used without the necessary rights or consent.',
  }),
  Object.freeze({
    code: REJECTION_REASON_CODE.METADATA_INCOMPLETE,
    label: 'Incomplete details',
    description:
      'Required title, description, category, or usage information is missing, unclear, or inaccurate.',
  }),
  Object.freeze({
    code: REJECTION_REASON_CODE.OTHER,
    label: 'Other',
    description:
      'A reason not covered above — the reviewer’s notes explain the decision.',
  }),
])

/** Look up a rejection reason by code; `undefined` when the code is unknown. */
export function getRejectionReason(code) {
  return REJECTION_REASONS.find((reason) => reason.code === code)
}
