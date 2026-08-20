// Copy for the Wallet page (Prompt 11 §7 — long static copy lives in a content
// module, not inline in JSX; V2-10 builds the page on the same convention).
//
// The Wallet page is **informational**. Nothing here reads a balance, and no
// number below is anybody's money: the worked example is a teaching example,
// stated as inputs and computed in `walletExample.js` so the arithmetic on the
// page can never drift from the prose.
//
// The escrow sentences deliberately repeat the ones on How It Works and Pricing
// (`staticPages/content/howItWorks.js`, `…/pricing.js`) — one payment story,
// told the same way wherever a buyer meets it. Change them together.

export const WALLET_EYEBROW = 'Wallet'

/**
 * The page heading, in two halves: the second takes `.bb-gradient-text`, which
 * theme-v2 §7 restricts to display sizes. Splitting it here keeps the wording
 * in the content module rather than in a regex in the component.
 */
export const WALLET_TITLE_LEAD = 'One wallet.'
export const WALLET_TITLE_ACCENT = 'Every order.'

export const WALLET_INTRO =
  'Buyers fund a BetterBlue Wallet once and every order is paid from that balance. No card details re-entered per order, no invoice chased between teams — one balance, one statement, and the same escrow protection on every order it funds.'

/** The four steps of the purchase flow — the page's spine. */
export const WALLET_STEPS = Object.freeze([
  Object.freeze({
    key: 'log-in',
    icon: 'tabler:login',
    title: 'Log in as a buyer',
    description:
      'The Wallet belongs to a buyer account. Register as a buyer, sign in, and your balance travels with you across every brief, proposal, and order.',
  }),
  Object.freeze({
    key: 'choose',
    icon: 'tabler:shopping-bag',
    title: 'Choose what to order',
    description:
      'Pick the creator and the work — a proposal on one of your feeds, or a brief you have agreed directly. Accepting it fixes the price, the deadline, and the deliverables.',
  }),
  Object.freeze({
    key: 'pay-from-wallet',
    icon: 'tabler:wallet',
    title: 'Pay from your Wallet',
    description:
      'The order total is charged to your balance. If the balance is short, BetterBlue issues a payment link for exactly the top-up you need — the order waits, nothing is part-paid.',
  }),
  Object.freeze({
    key: 'recharge',
    icon: 'tabler:link',
    title: 'Recharge and the order is funded',
    description:
      'Complete the payment link, the balance lands in your Wallet, and the order funds itself from it. From that point escrow applies as it does everywhere on BetterBlue: the money is held until you approve the work.',
  }),
])

/** "Why a wallet" — the three-card trio under the worked example. */
export const WALLET_BENEFITS = Object.freeze([
  Object.freeze({
    key: 'one-balance',
    icon: 'tabler:wallet',
    title: 'One balance across orders',
    description:
      'Fund once and spend it across as many creators and orders as you like. Budget approved in one place instead of a fresh payment for every brief.',
  }),
  Object.freeze({
    key: 'faster-checkout',
    icon: 'tabler:bolt',
    title: 'Faster checkout',
    description:
      'An order with the balance behind it funds immediately — no card entry, no payment step between accepting a proposal and the creator starting work.',
  }),
  Object.freeze({
    key: 'one-statement',
    icon: 'tabler:receipt',
    title: 'Every top-up and charge in one statement',
    description:
      'Recharges in, order funding out, refunds back — one running record of the balance, ready for whoever signs off the spend.',
  }),
])

/**
 * The mini-FAQ. Three questions, answered consistently with the escrow story on
 * How It Works and Pricing — the review window and the commission rate are
 * published on the Pricing page, so neither is restated here.
 */
export const WALLET_FAQ = Object.freeze([
  Object.freeze({
    key: 'when-recharge',
    question: 'When do I recharge?',
    answer:
      'Only when an order needs more than the balance you hold. BetterBlue works out the shortfall at the moment you fund the order and issues a payment link for it, so you are never asked to guess an amount up front or to keep a float sitting in the Wallet.',
  }),
  Object.freeze({
    key: 'payment-link',
    question: 'What is a payment link?',
    answer:
      'A single-use link to complete one top-up. It names the amount, the order it unblocks, and the Wallet it credits. Completing it credits your balance; the order then funds from that balance. You can also send it to whoever holds the card in your business — they never need a BetterBlue account to pay it.',
  }),
  Object.freeze({
    key: 'protected',
    question: 'Is my money protected?',
    answer:
      'Yes. Funding an order moves that amount out of your balance and into escrow, where BetterBlue holds it until you approve the delivery — or until the buyer review window published on the Pricing page closes. If an order is cancelled or a dispute is resolved in your favour, the money is refunded to your Wallet balance, ready for the next order.',
  }),
])

/**
 * The demonstration-build note. The same standing caveat the checkout and
 * payment screens carry (`docs/payments.md` — the mock provider), stated here
 * because a page about paying for things is exactly where somebody would
 * otherwise assume a real card is involved.
 */
export const WALLET_SIMULATION_NOTE =
  'This is a demonstration build. Wallet balances, payment links, and order funding are simulated end to end — no card is charged, no bank is contacted, and no real money moves.'

export const WALLET_CTA = Object.freeze({
  title: 'Fund your first brief',
  description:
    'Creating a buyer account is free, and so is publishing a feed and collecting proposals. The Wallet only comes into it once you have accepted work you want to fund.',
})
