// Copy for the Pricing page. Every number on that page comes from
// `platformSettings` at runtime (Prompt 11 §5) — nothing here states a rate, a
// minimum, or a window, so the copy can never drift from the configuration.

/** Order value used for the worked example — the maths is computed live. */
export const EXAMPLE_ORDER_AMOUNT = 400

export const PRICING_INTRO =
  'One commission, taken once, on completed work. Buyers pay the price they accepted; creators receive that price minus the platform commission. There is no listing fee, no subscription, and no charge for a request that never becomes an order.'

/** The three-card summary of how money moves. */
export const PRICING_PRINCIPLES = Object.freeze([
  Object.freeze({
    key: 'buyers',
    icon: 'tabler:building-store',
    title: 'Buyers pay the proposal price',
    description:
      'The price you accept is the price you pay — funded upfront and held in escrow until you approve the work. No platform fee is added on top of it.',
  }),
  Object.freeze({
    key: 'creators',
    icon: 'tabler:camera',
    title: 'Creators receive price minus commission',
    description:
      'The platform commission is deducted once, when the payment is released. What is left lands in your earnings balance, ready to be paid out.',
  }),
  Object.freeze({
    key: 'free-to-post',
    icon: 'tabler:gift',
    title: 'Free to post and to propose',
    description:
      'Publishing a content request, receiving proposals, building a portfolio, and sending proposals all cost nothing. You are only charged on an order you agreed to.',
  }),
])

/** What the commission pays for — the "included with every order" list. */
export const PRICING_INCLUDED = Object.freeze([
  'Escrow on every order: the buyer’s payment is held until the work is approved.',
  'Trust & Safety review of published content against the Content Policy.',
  'A written record of the brief, the accepted proposal, deliveries, and revisions.',
  'Dispute resolution when an order does not go to plan, with the payment held throughout.',
  'Payouts of released earnings, and a statement of every commission taken.',
])

/** Questions answered on the FAQ page, linked from Pricing. */
export const PRICING_FAQ_LINKS = Object.freeze([
  Object.freeze({
    key: 'when-charged',
    label: 'When am I charged for an order?',
    group: 'orders-and-payments',
  }),
  Object.freeze({
    key: 'payouts',
    label: 'How and when are creator payouts paid?',
    group: 'for-creators',
  }),
  Object.freeze({
    key: 'refunds',
    label: 'What happens to my money in a dispute?',
    group: 'orders-and-payments',
  }),
])
