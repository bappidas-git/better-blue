// Copy for the FAQ page.
//
// Every answer describes behaviour the product actually implements — escrow,
// the revision loop, auto-acceptance, moderation states, disputes, payouts —
// and deliberately states no rate, minimum, or review window: those are
// configuration, and the Pricing page reads them live. Group ids are the hash
// targets other pages deep-link to, so treat them as stable.

export const FAQ_INTRO =
  'How BetterBlue works for businesses and creators: posting a brief, paying for an order, delivery and revisions, moderation, disputes, and payouts.'

export const FAQ_GROUPS = Object.freeze([
  Object.freeze({
    id: 'getting-started',
    title: 'Getting started',
    description: 'What BetterBlue is, who it is for, and what it costs to begin.',
    questions: Object.freeze([
      Object.freeze({
        key: 'what-is-betterblue',
        question: 'What is BetterBlue?',
        answer:
          'BetterBlue is a professional marketplace for commercial content. Businesses commission photos and videos for marketing, advertising, product, and brand use, and creators produce that work to an agreed brief, price, and deadline.',
      }),
      Object.freeze({
        key: 'who-uses-it',
        question: 'Who uses BetterBlue?',
        answer:
          'Businesses of every size — restaurants and cafés, e-commerce and product brands, fitness studios, hotels and travel operators, SaaS companies, beauty and food brands, agencies buying on behalf of clients — and the photographers, videographers, and content creators who produce commercial work for them.',
      }),
      Object.freeze({
        key: 'cost-to-start',
        question: 'What does it cost to get started?',
        answer:
          'Nothing. Creating an account, publishing a feed, receiving proposals, building a portfolio, and sending proposals are all free. Money only changes hands when a buyer accepts a proposal and funds the resulting order.',
      }),
      Object.freeze({
        key: 'browse-without-account',
        question: 'Do I need an account to look around?',
        answer:
          'No. You can browse creators and the open feeds while signed out. An account is needed to publish a feed, send a proposal, or take part in an order.',
      }),
      Object.freeze({
        key: 'writing-a-brief',
        question: 'What makes a good brief?',
        answer:
          'Say what you need produced, how many pieces, in what format, by when, and where the content will be used. The clearer the deliverables and usage rights, the more comparable the proposals you get back — and the less there is to argue about later.',
      }),
    ]),
  }),

  Object.freeze({
    id: 'orders-and-payments',
    title: 'Orders and payments',
    description: 'How money is held, when it moves, and what happens if something goes wrong.',
    questions: Object.freeze([
      Object.freeze({
        key: 'when-charged',
        question: 'When am I charged for an order?',
        answer:
          'When you accept a proposal. Accepting creates the order and takes you to checkout, where you pay the agreed price upfront. The creator begins once the order is funded.',
      }),
      Object.freeze({
        key: 'what-is-escrow',
        question: 'What does "held in escrow" mean?',
        answer:
          'Your payment is held by BetterBlue rather than passed straight to the creator. It stays held while the work is produced, delivered, and reviewed, and is released only when you approve the delivery — or when the review window closes.',
      }),
      Object.freeze({
        key: 'revisions',
        question: 'How many revisions are included?',
        answer:
          'As many as the accepted proposal states. Requesting a revision returns the order to the creator with your notes, and the new version is delivered in the same workspace. Extra revisions beyond the agreed number are a matter for you and the creator to agree.',
      }),
      Object.freeze({
        key: 'auto-accept',
        question: 'What if I do not review a delivery?',
        answer:
          'Orders accept automatically once the buyer review window has passed without a revision request or a dispute, so a creator is never left waiting indefinitely. The current window is shown on the Pricing page.',
      }),
      Object.freeze({
        key: 'usage-rights',
        question: 'What rights do I get to the content?',
        answer:
          'Exactly the usage rights agreed on the order — organic social, paid advertising, website use, or full commercial use. The rights transfer when the delivery is approved, and nothing broader is implied.',
      }),
      Object.freeze({
        key: 'cancel-order',
        question: 'Can an order be cancelled?',
        answer:
          'An order can be cancelled before work is under way, and by agreement afterwards. A cancelled order returns the held payment to the buyer; a partly completed one is usually better resolved through a dispute, where a partial refund is possible.',
      }),
      Object.freeze({
        key: 'disputes',
        question: 'What happens to my money in a dispute?',
        answer:
          'It stays held. Opening a dispute pauses the order and asks both sides for their account of what happened. Our team reviews the brief, the proposal, and what was delivered, then releases the payment, refunds it, or splits it as a partial refund.',
      }),
      Object.freeze({
        key: 'off-platform',
        question: 'Can I pay a creator directly instead?',
        answer:
          'No. Taking payment off-platform breaches the Content Policy, and it removes the protections that make the marketplace work: escrow, the written record of what was agreed, dispute resolution, and reviews.',
      }),
    ]),
  }),

  Object.freeze({
    id: 'for-creators',
    title: 'For creators',
    description: 'Joining, getting work published, and being paid for it.',
    questions: Object.freeze([
      Object.freeze({
        key: 'join-as-creator',
        question: 'How do I join as a creator?',
        answer:
          'Create a creator account, complete your profile, and publish portfolio work that shows the commercial content you want to be hired for. Once your work is approved you can propose on any open brief.',
      }),
      Object.freeze({
        key: 'portfolio-review',
        question: 'Is my portfolio reviewed before it goes live?',
        answer:
          'Yes. New portfolio work is submitted for review and checked against the Content Policy before it is published. You are notified of the outcome, and if changes are requested you can update the submission and send it back.',
      }),
      Object.freeze({
        key: 'winning-work',
        question: 'How do I win more work?',
        answer:
          'Propose on briefs you have relevant, published work for; be specific about what you will deliver, when, and how many revisions are included; and keep your portfolio current. Completed orders and reviews build the track record buyers filter on.',
      }),
      Object.freeze({
        key: 'commission',
        question: 'What commission does BetterBlue take?',
        answer:
          'A single percentage of the order price, deducted once when the payment is released — never at proposal time and never from your payout. The current rate, with a worked example, is on the Pricing page.',
      }),
      Object.freeze({
        key: 'payouts',
        question: 'How and when are payouts paid?',
        answer:
          'Released earnings build up as an available balance. Once that balance is above the payout minimum you can request a payout, which is reviewed and marked paid by our operations team. The current minimum is on the Pricing page.',
      }),
      Object.freeze({
        key: 'buyer-unresponsive',
        question: 'What if a buyer never reviews my delivery?',
        answer:
          'The order accepts automatically when the buyer review window closes, and the held payment is released to you. You do not need to chase an approval to be paid for work that was delivered as briefed.',
      }),
    ]),
  }),

  Object.freeze({
    id: 'trust-and-safety',
    title: 'Trust and safety',
    description: 'What may be published, how content is reviewed, and how to raise a concern.',
    questions: Object.freeze([
      Object.freeze({
        key: 'allowed-content',
        question: 'What content is allowed on BetterBlue?',
        answer:
          'Professional commercial content — brand and product marketing, social campaigns, testimonials, advertising, website imagery, and lifestyle or product demonstrations. The Content Policy sets out the standards in full, including what is prohibited.',
      }),
      Object.freeze({
        key: 'moderation',
        question: 'How does content review work?',
        answer:
          'Submitted content moves from submitted to under review, and then to approved, changes requested, or rejected. Only approved content is published, every decision records a reason, and you are notified when the status of your content changes.',
      }),
      Object.freeze({
        key: 'reporting',
        question: 'How do I report content or a member?',
        answer:
          'Report the content, profile, or request from the page it appears on, or contact support with the details. Our Trust & Safety team reviews every report and can restrict content, request changes, or suspend an account.',
      }),
      Object.freeze({
        key: 'account-action',
        question: 'What happens if the policy is breached?',
        answer:
          'Depending on what happened, content can be sent back for changes, rejected, or restricted after publication. Repeated or serious breaches lead to account suspension and, in the most serious cases, permanent removal from the marketplace.',
      }),
      Object.freeze({
        key: 'data',
        question: 'What do you do with my data?',
        answer:
          'We collect what is needed to run the marketplace — your account and profile, the content and messages you post, and the record of your orders and payments. The Privacy Policy explains what is collected, how it is used, and how long it is kept.',
      }),
    ]),
  }),
])
