// Copy for the How It Works page (Prompt 11 §7 — long static copy lives in a
// content module, not inline in JSX).
//
// The two journeys describe the workflow the product actually implements: the
// order state machine in `constants/stateMachines.js` and the escrow states in
// `PAYMENT_STATUS` (00 §9). Keep them in step with those if the flow changes.

export const HOW_IT_WORKS_INTRO =
  'BetterBlue connects businesses that need commercial photos and videos with creators who produce them. Every engagement runs through the same protected workflow — a written brief, priced proposals, a funded order, and a payment released only when the work is approved.'

/** The buyer's five steps, in the order the product runs them. */
export const BUYER_JOURNEY = Object.freeze([
  Object.freeze({
    key: 'create-request',
    icon: 'tabler:file-text',
    title: 'Create a content request',
    description:
      'Describe the deliverables, the budget, the deadline, and the usage rights you need. A clear brief is what gets you comparable proposals.',
  }),
  Object.freeze({
    key: 'compare-proposals',
    icon: 'tabler:checklist',
    title: 'Compare proposals',
    description:
      'Creators respond with a price, a delivery date, and the revisions they include. Review their portfolios and ratings side by side, then shortlist the ones you want.',
  }),
  Object.freeze({
    key: 'fund-securely',
    icon: 'tabler:lock',
    title: 'Fund the order securely',
    description:
      'Accepting a proposal creates the order. You pay the agreed price upfront and BetterBlue holds it — the creator starts knowing the budget is real.',
  }),
  Object.freeze({
    key: 'review-deliverables',
    icon: 'tabler:photo-check',
    title: 'Review the deliverables',
    description:
      'The creator submits the content inside the order. Check it against the brief and request a revision if something needs changing, within the revisions agreed.',
  }),
  Object.freeze({
    key: 'approve-release',
    icon: 'tabler:shield-check',
    title: 'Approve and release payment',
    description:
      'Approving the delivery releases the held payment to the creator and transfers the usage rights you agreed. If you do nothing, the order accepts automatically after the review window.',
  }),
])

/** The creator's five steps. */
export const CREATOR_JOURNEY = Object.freeze([
  Object.freeze({
    key: 'build-portfolio',
    icon: 'tabler:camera',
    title: 'Build your portfolio',
    description:
      'Publish the commercial work you want to be hired for — product, brand, social, testimonial — with the category, format, and context of each piece.',
  }),
  Object.freeze({
    key: 'get-approved',
    icon: 'tabler:certificate',
    title: 'Get approved',
    description:
      'Our Trust & Safety team reviews new portfolio work against the Content Policy before it goes live, so buyers browse a marketplace they can trust.',
  }),
  Object.freeze({
    key: 'propose-on-briefs',
    icon: 'tabler:send',
    title: 'Propose on briefs',
    description:
      'Browse open content requests and send a proposal: your price, your delivery date, the revisions you include, and samples that fit the brief.',
  }),
  Object.freeze({
    key: 'deliver',
    icon: 'tabler:upload',
    title: 'Produce and deliver',
    description:
      'Once the buyer funds the order, produce the work and submit it in the order workspace. Revisions are requested and answered in the same place.',
  }),
  Object.freeze({
    key: 'get-paid',
    icon: 'tabler:cash',
    title: 'Get paid',
    description:
      'When the buyer approves — or the review window closes — the payment is released to your earnings balance, minus the platform commission. Request a payout whenever you are above the minimum.',
  }),
])

/** The three states a buyer's money passes through on every order. */
export const ESCROW_STAGES = Object.freeze([
  Object.freeze({
    key: 'paid-upfront',
    icon: 'tabler:credit-card',
    title: 'Paid upfront',
    description:
      'The buyer pays the accepted proposal price as soon as the order is created. Nothing is produced against an unfunded brief.',
  }),
  Object.freeze({
    key: 'held-by-betterblue',
    icon: 'tabler:lock',
    title: 'Held by BetterBlue',
    description:
      'The payment sits in escrow while the work is produced, delivered, and reviewed. Neither side can move it on their own.',
  }),
  Object.freeze({
    key: 'released-on-approval',
    icon: 'tabler:circle-check',
    title: 'Released on approval',
    description:
      'Approval releases the payment to the creator minus commission. If something goes wrong, the money stays held until the dispute is resolved.',
  }),
])

export const ESCROW_FOOTNOTE =
  'Payments on this demonstration build are simulated end to end — no real card is charged and no money moves.'

/** Teaser questions on the page, each deep-linking into a FAQ group. */
export const HOW_IT_WORKS_FAQ_TEASERS = Object.freeze([
  Object.freeze({
    key: 'revisions',
    question: 'How many revisions do I get?',
    answer:
      'As many as the accepted proposal includes. Each request is logged against the order, and the creator delivers a new version in the same workspace.',
    group: 'orders-and-payments',
  }),
  Object.freeze({
    key: 'not-right',
    question: 'What if the content is not what I briefed?',
    answer:
      'Request a revision first. If that does not resolve it, open a dispute — the payment stays held while our team reviews the order and decides the outcome.',
    group: 'orders-and-payments',
  }),
  Object.freeze({
    key: 'rights',
    question: 'What rights do I get to the content?',
    answer:
      'Exactly the usage rights set out in the brief and the accepted proposal — organic social, paid ads, website, or full commercial use — transferred on approval.',
    group: 'orders-and-payments',
  }),
  Object.freeze({
    key: 'payouts',
    question: 'When do creators get paid?',
    answer:
      'On approval, or automatically when the buyer review window closes. Released earnings can be paid out once the balance clears the payout minimum.',
    group: 'for-creators',
  }),
])
