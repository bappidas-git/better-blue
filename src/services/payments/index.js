// The payments provider folder — 00 §5, §15.
//
// `paymentService` is the **only** module allowed to import from here (Prompt 17
// §7). Features, hooks, and components see payment records and nothing else, so
// the day a real processor arrives, the diff is inside this folder plus one
// value in `platformSettings`.
//
//   grep -rn "services/payments" src --include=*.jsx
//
// should only ever match nothing — anything it does match is a leak of provider
// detail into the product.

export {
  getPaymentProvider,
  PAYMENT_PROVIDER_KEY,
} from './paymentProvider'

export {
  dummyPaymentProvider,
  DUMMY_PROCESSING_MS,
  DUMMY_PROVIDER_KEY,
  DUMMY_TEST_CARDS,
  PAYMENT_FAILURE_CODE,
  PAYMENT_FAILURE_MESSAGE,
} from './dummyPaymentProvider'
