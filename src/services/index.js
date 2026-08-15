// Services barrel — 00 §5, §10.
//
//   import { orderService, useApiQuery } from '@/services'   ← services only
//
// One service per domain, each exposing intention-named functions. Components
// never import from `services/api/` — that folder is the provider boundary, and
// the only things exported from it here are the error type and its codes,
// because features do need to branch on `error.code`.
//
// Nothing in here imports from `src/components` or `src/features`: services are
// callable from anywhere, including plain Node scripts.

/* API layer (error handling only — the client and adapter stay internal) ---- */
export { ApiError, API_ERROR_CODE, createApiError, isApiError, toApiError } from './api/apiError'

/* Accounts and profiles --------------------------------------------------- */
export {
  authService,
  clearStoredSession,
  readStoredSession,
  REFERRAL_STORAGE_KEY,
  SELF_REGISTERABLE_ROLES,
} from './authService'
export { userService } from './userService'
export { buyerProfileService } from './buyerProfileService'
export { creatorProfileService } from './creatorProfileService'
export { portfolioService } from './portfolioService'

/* Marketplace ------------------------------------------------------------- */
export { categoryService } from './categoryService'
export { requestService } from './requestService'
export { proposalService } from './proposalService'

/* Orders and delivery ----------------------------------------------------- */
export { orderService } from './orderService'
export { deliveryService } from './deliveryService'
export { revisionService } from './revisionService'

/* Money ------------------------------------------------------------------- */
export { paymentService } from './paymentService'
export { payoutService } from './payoutService'

/* Trust & safety ---------------------------------------------------------- */
export { disputeService } from './disputeService'
export { moderationService, OPEN_QUEUE_STATUSES } from './moderationService'
export { reportService } from './reportService'
export { reviewService } from './reviewService'

/* Platform ---------------------------------------------------------------- */
export { landingService } from './landingService'
export { notificationService } from './notificationService'
export { supportService } from './supportService'
export { affiliateService } from './affiliateService'
export { settingsService, SETTINGS_FALLBACK } from './settingsService'
export { auditService } from './auditService'
export { adminService } from './adminService'

/* Uploads ----------------------------------------------------------------- */
export {
  uploadService,
  UPLOAD_PURPOSE,
  UPLOAD_RULES,
  MAX_FILES_PER_UPLOAD,
  MEDIA_TYPE,
} from './uploadService'
