// Form validators — paired with `useForm` (Prompt 04).
//
// Every rule is a factory returning `(value, values) => undefined | string`:
// `undefined` means valid, a string is the message shown under the field.
// Messages are written for the person filling in the form, not for developers.
//
//   const validators = {
//     email: compose(required(), email()),
//     budget: compose(required('Enter a budget.'), min(50)),
//   }

const isEmpty = (value) =>
  value === undefined ||
  value === null ||
  (typeof value === 'string' && value.trim() === '') ||
  (Array.isArray(value) && value.length === 0)

// Pragmatic address check — deliberately permissive; the backend is the
// authority on deliverability.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i

const lengthOf = (value) => (Array.isArray(value) ? value.length : String(value).length)

/** Field must have a value. Every other rule ignores empty values. */
export const required =
  (message = 'This field is required.') =>
  (value) =>
    isEmpty(value) ? message : undefined

export const email =
  (message = 'Enter a valid email address.') =>
  (value) =>
    isEmpty(value) || EMAIL_PATTERN.test(String(value).trim()) ? undefined : message

export const minLength =
  (length, message) =>
  (value) =>
    isEmpty(value) || lengthOf(value) >= length
      ? undefined
      : (message ?? `Use at least ${length} characters.`)

export const maxLength =
  (length, message) =>
  (value) =>
    isEmpty(value) || lengthOf(value) <= length
      ? undefined
      : (message ?? `Use no more than ${length} characters.`)

export const min =
  (limit, message) =>
  (value) =>
    isEmpty(value) || Number(value) >= limit
      ? undefined
      : (message ?? `Enter ${limit} or more.`)

export const max =
  (limit, message) =>
  (value) =>
    isEmpty(value) || Number(value) <= limit
      ? undefined
      : (message ?? `Enter ${limit} or less.`)

export const url =
  (message = 'Enter a valid URL, including https://') =>
  (value) => {
    if (isEmpty(value)) return undefined
    try {
      const parsed = new URL(String(value).trim())
      return parsed.protocol === 'http:' || parsed.protocol === 'https:'
        ? undefined
        : message
    } catch {
      return message
    }
  }

export const pattern =
  (regex, message = 'This value is not in the expected format.') =>
  (value) =>
    isEmpty(value) || regex.test(String(value)) ? undefined : message

export const oneOf =
  (allowed = [], message = 'Choose one of the available options.') =>
  (value) =>
    isEmpty(value) || allowed.includes(value) ? undefined : message

/** Numeric-only guard for currency and quantity fields. */
export const numeric =
  (message = 'Enter a number.') =>
  (value) =>
    isEmpty(value) || Number.isFinite(Number(value)) ? undefined : message

/** Runs rules in order and returns the first message produced. */
export const compose =
  (...rules) =>
  (value, values) => {
    for (const rule of rules) {
      if (typeof rule !== 'function') continue
      const message = rule(value, values)
      if (message) return message
    }
    return undefined
  }
