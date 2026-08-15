// Copy for the About page. Deliberately team-free: no invented founders, no
// stock portraits, no fabricated milestones — the page describes what the
// marketplace does and the principles it is built on (00 §1).

export const ABOUT_INTRO =
  'BetterBlue exists to help businesses get authentic commercial content made by the people who are good at making it — and to make that engagement safe, clear, and worth a creator’s time.'

export const ABOUT_MISSION = Object.freeze([
  'Good marketing content used to mean a production budget, an agency, and a lead time measured in months. Most businesses do not work that way any more: they need a set of product photos this month, a batch of short-form videos for a campaign next month, and a testimonial film after that.',
  'At the same time, a generation of photographers, videographers, and content creators produce exactly that work — but spend as much effort chasing briefs, chasing payment, and arguing about usage rights as they do producing.',
  'BetterBlue puts both sides on the same terms. A business writes a brief with the deliverables, budget, deadline, and usage rights stated up front. Creators respond with priced proposals. The accepted proposal becomes a funded order, and the payment is held until the work is approved.',
])

/** The three principles the product is actually built around. */
export const ABOUT_VALUES = Object.freeze([
  Object.freeze({
    key: 'professional',
    icon: 'tabler:briefcase',
    title: 'Professional by default',
    description:
      'BetterBlue is a commercial content marketplace and nothing else. Published work is reviewed against the Content Policy, so what a buyer browses is work a brand could put its name to.',
  }),
  Object.freeze({
    key: 'protected',
    icon: 'tabler:shield-check',
    title: 'Protected on both sides',
    description:
      'Payments are held in escrow from the moment an order is funded. Buyers do not pay for work they have not seen; creators do not produce work against a budget that might not exist.',
  }),
  Object.freeze({
    key: 'clear',
    icon: 'tabler:license',
    title: 'Clear about rights',
    description:
      'Usage rights are agreed in the brief and the proposal, and transfer on approval. Both sides know what was bought, what was licensed, and what was not.',
  }),
])

/** Short "what we do" facts, stated without invented statistics. */
export const ABOUT_FACTS = Object.freeze([
  Object.freeze({
    key: 'what-we-do',
    title: 'What we do',
    description:
      'Run the marketplace: discovery, briefs, proposals, escrow payments, delivery and revisions, disputes, and payouts.',
  }),
  Object.freeze({
    key: 'what-we-do-not',
    title: 'What we do not do',
    description:
      'We do not produce content, take a cut of work agreed off-platform, or resell what creators deliver to buyers.',
  }),
  Object.freeze({
    key: 'how-we-are-paid',
    title: 'How we are paid',
    description:
      'A single commission on completed orders. Posting a brief, proposing on one, and holding a portfolio are free.',
  }),
])

export const ABOUT_BUILD_NOTE =
  'This is a demonstration build of the BetterBlue marketplace. Creators, businesses, orders, and reviews shown across the site are illustrative sample data, and payments are simulated end to end.'
