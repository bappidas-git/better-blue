// Copy and options for the Contact page.
//
// The subject options are the topics the support inbox is triaged by. Their
// labels are what is stored as the ticket `subject` (contract §6.22), so they
// are written to read well in the admin inbox as well as in the form.

export const CONTACT_INTRO =
  'Questions about a brief, an order, a payment, or something you have seen on the marketplace? Send us the details and our support team will come back to you.'

/** Subject options — `value` is the form value, `label` is stored on the ticket. */
export const CONTACT_SUBJECTS = Object.freeze([
  Object.freeze({ value: 'general', label: 'General enquiry' }),
  Object.freeze({ value: 'orders_payments', label: 'Orders & payments' }),
  Object.freeze({ value: 'trust_safety', label: 'Trust & safety' }),
  Object.freeze({ value: 'partnerships', label: 'Partnerships' }),
])

/** `'orders_payments'` → `'Orders & payments'`; falls back to the raw value. */
export function contactSubjectLabel(value) {
  return CONTACT_SUBJECTS.find((subject) => subject.value === value)?.label ?? value
}

export const CONTACT_RESPONSE_TIME = 'We usually reply within 1 business day.'

/** Pointers shown beside the form, so people self-serve where they can. */
export const CONTACT_ROUTES = Object.freeze([
  Object.freeze({
    key: 'faq',
    icon: 'tabler:help-circle',
    title: 'Check the FAQ first',
    description:
      'Payments, revisions, moderation, disputes, and payouts are answered there in full.',
  }),
  Object.freeze({
    key: 'policy',
    icon: 'tabler:shield-check',
    title: 'Reporting something?',
    description:
      'Report content, a profile, or a request from the page it appears on, or tell us here — every report is reviewed by Trust & Safety.',
  }),
  Object.freeze({
    key: 'account',
    icon: 'tabler:user-circle',
    title: 'Asking about an order?',
    description:
      'Include the order or request reference if you have one — it is the fastest way for us to find the right record.',
  }),
])
