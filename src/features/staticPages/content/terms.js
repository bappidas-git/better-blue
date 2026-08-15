// Terms of Service — a structured placeholder (see ./legal.js).
//
// The commercial mechanics described here mirror what the product actually
// does: escrow on every order, a single commission taken at release, usage
// rights agreed on the order, disputes resolved by release, refund, or partial
// refund, and account status changes instead of deletion (00 §9).

export const TERMS_INTRO =
  'These terms describe the relationship between BetterBlue, the businesses who commission content, and the creators who produce it. They cover accounts, orders, payments, content rights, acceptable use, and how disagreements are resolved.'

/** Ordered sections; the page numbers them and builds its contents from them. */
export const TERMS_SECTIONS = Object.freeze([
  Object.freeze({
    id: 'about-these-terms',
    title: 'About these terms',
    paragraphs: Object.freeze([
      'BetterBlue operates an online marketplace where businesses commission commercial photos and videos from independent creators. These terms apply to everyone who uses the marketplace, whether as a visitor, a buyer, or a creator.',
      'By creating an account or using the marketplace you agree to these terms, to the Content Policy, and to the Privacy Policy. If you are using BetterBlue on behalf of a company, you confirm that you are authorised to accept these terms for it.',
    ]),
  }),
  Object.freeze({
    id: 'definitions',
    title: 'Definitions',
    paragraphs: Object.freeze([
      'The following terms are used throughout this document with the meanings given here.',
    ]),
    list: Object.freeze([
      '“BetterBlue”, “we”, “us” — the operator of the marketplace.',
      '“Buyer” — a business, or someone acting for one, commissioning content.',
      '“Creator” — an independent member producing content for buyers.',
      '“Content request” — a buyer’s published brief describing the content required, the budget, the deadline, and the usage rights sought.',
      '“Proposal” — a creator’s priced offer against a content request, including the delivery date and the number of revisions included.',
      '“Order” — the engagement created when a buyer accepts a proposal.',
      '“Deliverable” — content submitted by a creator to fulfil an order.',
      '“Escrow” — the buyer’s payment, held by BetterBlue, until it is released or refunded.',
      '“Commission” — the percentage of the order price retained by BetterBlue when a payment is released.',
      '“Payout” — a transfer of a creator’s released earnings out of the marketplace.',
    ]),
  }),
  Object.freeze({
    id: 'accounts',
    title: 'Accounts and eligibility',
    paragraphs: Object.freeze([
      'You must be at least 18 years old and able to enter into a binding contract to hold an account. Accounts are personal to the member or business that registered them and may not be shared, sold, or transferred.',
      'You are responsible for the accuracy of the information on your account and for keeping your credentials secure. Tell us immediately if you believe your account has been accessed by someone else.',
    ]),
  }),
  Object.freeze({
    id: 'using-the-marketplace',
    title: 'Using the marketplace',
    paragraphs: Object.freeze([
      'A buyer publishes a content request describing what they need produced. Creators respond with proposals, and the buyer may shortlist, decline, or accept them. Accepting a proposal forms the order and fixes the price, the deadline, the deliverables, the revisions included, and the usage rights.',
      'BetterBlue is the marketplace, not a party to the engagement between buyer and creator. We provide the platform, hold the payment, review content against the Content Policy, and resolve disputes; we do not produce content and do not supervise how a creator works.',
      'Both parties agree to keep the engagement on the marketplace. Soliciting or accepting payment outside BetterBlue removes the protections these terms provide and is a breach of the Content Policy.',
    ]),
  }),
  Object.freeze({
    id: 'payments-and-escrow',
    title: 'Payments, escrow, and commission',
    paragraphs: Object.freeze([
      'The buyer pays the accepted proposal price when the order is created. BetterBlue holds that payment in escrow for the duration of the order.',
      'The payment is released to the creator when the buyer approves a delivery, when the buyer review window closes without a revision request or dispute, or when a dispute is resolved in the creator’s favour. BetterBlue retains its commission at the point of release; the balance is credited to the creator’s earnings.',
    ]),
    list: Object.freeze([
      'The commission rate in force is published on the Pricing page and applied at the time the order is created.',
      'No fee is charged for publishing a content request, sending a proposal, or holding a portfolio.',
      'Creators may request a payout of released earnings once their balance reaches the published payout minimum.',
      'Refunds return the held payment to the buyer in whole or in part, and reverse the commission on any amount refunded.',
    ]),
  }),
  Object.freeze({
    id: 'delivery-and-acceptance',
    title: 'Delivery, revisions, and acceptance',
    paragraphs: Object.freeze([
      'Creators submit deliverables inside the order. A buyer may accept a delivery or request a revision within the number of revisions the accepted proposal includes; each request must describe what needs to change.',
      'If a buyer neither accepts, requests a revision, nor opens a dispute within the buyer review window published on the Pricing page, the delivery is accepted automatically and the payment is released.',
    ]),
  }),
  Object.freeze({
    id: 'licensing',
    title: 'Content licensing and intellectual property',
    paragraphs: Object.freeze([
      'Creators retain ownership of the content they produce except where the order expressly transfers it. On approval, the buyer receives the usage rights agreed on the order — for example organic social, paid advertising, website use, or full commercial use — and no rights beyond them.',
      'Creators warrant that they hold the rights to everything they deliver, including music, footage, fonts, trademarks, and the consent of anyone appearing in the content. Buyers warrant that any brand assets they supply may lawfully be used for the brief.',
      'Portfolio work published on BetterBlue may be displayed by us to promote the marketplace and the creator who produced it. Delivered client work is shown publicly only where the creator is permitted to show it.',
    ]),
  }),
  Object.freeze({
    id: 'acceptable-use',
    title: 'Acceptable use',
    paragraphs: Object.freeze([
      'Everything published or exchanged on BetterBlue — portfolios, requests, proposals, deliverables, messages, and profile information — is subject to the Content Policy. The Content Policy forms part of these terms, and the prohibited content listed there is prohibited everywhere on the marketplace, in public listings and private deliveries alike.',
      'You also agree not to interfere with the marketplace or the people on it: no scraping or automated abuse, no attempts to circumvent access controls, no impersonation, and no use of the marketplace to advertise unrelated services.',
    ]),
  }),
  Object.freeze({
    id: 'disputes',
    title: 'Disputes and refunds',
    paragraphs: Object.freeze([
      'If an order cannot be resolved between the parties, either side may open a dispute. The payment stays held while the dispute is open. Both parties are asked for their account of what happened and for any supporting material.',
      'BetterBlue reviews the brief, the accepted proposal, the deliveries, and the correspondence on the order, and resolves the dispute by releasing the payment, refunding it in full, or agreeing a partial refund. Our decision is made in good faith on the record available and closes the order.',
    ]),
  }),
  Object.freeze({
    id: 'suspension',
    title: 'Suspension and account status',
    paragraphs: Object.freeze([
      'We may restrict content, suspend an account, or permanently remove a member from the marketplace where these terms or the Content Policy are breached, where activity puts other members at risk, or where we are required to do so by law.',
      'Accounts are not deleted: a suspended or removed account keeps the record of its orders, payments, and decisions so that obligations to other members and to our own record-keeping can still be met. You may deactivate your account at any time, subject to completing any open orders.',
    ]),
  }),
  Object.freeze({
    id: 'disclaimers',
    title: 'Service availability and liability',
    paragraphs: Object.freeze([
      'The marketplace is provided as it stands. We do not guarantee that a content request will attract proposals, that a proposal will be accepted, or that the marketplace will be available without interruption.',
      'Nothing in these terms limits liability that cannot lawfully be limited. Subject to that, BetterBlue is not liable for the acts or omissions of buyers or creators, or for indirect or consequential loss arising from an engagement between them.',
    ]),
  }),
  Object.freeze({
    id: 'changes',
    title: 'Changes to these terms',
    paragraphs: Object.freeze([
      'We may update these terms as the marketplace changes. Material changes are announced before they take effect, and the date at the top of this page always shows when the current version was published. Continuing to use BetterBlue after a change takes effect means you accept the updated terms.',
    ]),
  }),
  Object.freeze({
    id: 'contact',
    title: 'Contact',
    paragraphs: Object.freeze([
      'Questions about these terms, or about an order they apply to, can be sent to our support team through the contact form. Please include the order or request reference where there is one.',
    ]),
  }),
])

/** Contents entries for `InfoPageLayout`, numbered to match the sections. */
export const TERMS_TOC = Object.freeze(
  TERMS_SECTIONS.map((section, index) => ({
    id: section.id,
    label: `${index + 1}. ${section.title}`,
  }))
)
