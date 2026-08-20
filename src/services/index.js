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
  PASSWORD_MIN_LENGTH,
  REFERRAL_STORAGE_KEY,
  SELF_REGISTERABLE_ROLES,
} from './authService'
export { userService } from './userService'
export {
  buyerProfileService,
  BUYER_PROFILE_FIELDS,
  getBuyerProfileCompleteness,
} from './buyerProfileService'
export {
  creatorProfileService,
  CREATOR_ORDERING,
  CREATOR_PROFILE_FIELDS,
  getCreatorProfileCompleteness,
  maskAccountNumber,
} from './creatorProfileService'
export { portfolioService } from './portfolioService'

/* Marketplace ------------------------------------------------------------- */
export { categoryService } from './categoryService'
export { requestService } from './requestService'
export { proposalService } from './proposalService'
// Storefront V2 (prompts-v2/03): the feed board is a façade over
// `requestService` + the `feedReplies` collection — no collection was renamed.
export { feedService, FEED_SORT, REPLY_BODY_MIN, REPLY_BODY_MAX } from './feedService'
export { creatorMetaService } from './creatorMetaService'

/* Orders and delivery ----------------------------------------------------- */
export { orderService, ORDER_EVENT_TYPE } from './orderService'
export {
  deliveryService,
  DELIVERY_MESSAGE_MAX,
  DELIVERY_MESSAGE_MIN,
} from './deliveryService'
export { revisionService } from './revisionService'

/* Money ------------------------------------------------------------------- */
// `DUMMY_TEST_CARDS` and `PAYMENT_FAILURE_CODE` come through `paymentService`
// on purpose: `services/payments/` is the provider boundary and nothing outside
// that service imports it (Prompt 17 §7).
export { paymentService, DUMMY_TEST_CARDS, PAYMENT_FAILURE_CODE } from './paymentService'
export { payoutService } from './payoutService'

/* Trust & safety ---------------------------------------------------------- */
export {
  disputeService,
  ACTIVE_DISPUTE_STATUSES,
  DISPUTABLE_ORDER_STATUSES,
  INFO_REQUEST_ROLES,
  RESOLUTION_NOTE_MAX,
  RESOLUTION_NOTE_MIN,
  RESOLVABLE_DISPUTE_STATUSES,
  SETTLED_DISPUTE_STATUSES,
  awaitingRoleFor,
  awaitingStatusFor,
  canAssignDispute,
  canCloseDispute,
  canEscalateDispute,
  canRequestInfo,
  canResolveDispute,
  isAwaitingRole,
  resolutionSummary,
} from './disputeService'
export {
  moderationService,
  DECIDED_QUEUE_STATUSES,
  MODERATION_DECISION,
  MODERATION_DECISION_META,
  MODERATION_NOTES_MAX,
  MODERATION_NOTES_MIN,
  OPEN_QUEUE_STATUSES,
} from './moderationService'
export {
  reportService,
  OPEN_REPORT_STATUSES,
  REPORT_NOTE_MAX,
  REPORT_RESOLUTIONS,
} from './reportService'
export { reviewService, RATING_SCALE, RATING_MIN, RATING_MAX } from './reviewService'

/* Dashboards -------------------------------------------------------------- */
export {
  buyerDashboardService,
  ACTIVITY_LIMIT,
  SPEND_MONTHS,
} from './buyerDashboardService'
// `ACTIVITY_LIMIT` is deliberately *not* re-exported here: both dashboard
// services declare one, and the barrel can only carry a single spelling. Import
// it from `@/services/creatorDashboardService` on the rare occasion a screen
// needs the creator's own value.
export { creatorDashboardService, EARNINGS_MONTHS } from './creatorDashboardService'

/* Platform ---------------------------------------------------------------- */
export { landingService } from './landingService'
export {
  notificationService,
  ANNOUNCEMENT_AUDIENCE,
  ANNOUNCEMENT_BODY_MAX,
  ANNOUNCEMENT_BODY_MIN,
  ANNOUNCEMENT_TITLE_MAX,
  ANNOUNCEMENT_TITLE_MIN,
} from './notificationService'
export {
  supportService,
  OPEN_TICKET_STATUSES,
  TICKET_ACTION,
  TICKET_REPLY_MAX,
} from './supportService'
export { affiliateService } from './affiliateService'
export { settingsService, SETTINGS_FALLBACK } from './settingsService'
export { auditService } from './auditService'
export { adminService } from './adminService'
export {
  adminTeamService,
  ADMIN_SETTABLE_TEAM_STATUSES,
  SUPER_ADMIN_POLICY,
  TEAM_REASON_MAX_LENGTH,
  TEAM_REASON_MIN_LENGTH,
  TEAM_ROLES,
  TEMP_PASSWORD_PREFIX,
  canManageAdmin,
  diffPermissions,
} from './adminTeamService'

/* Uploads ----------------------------------------------------------------- */
export {
  uploadService,
  UPLOAD_PURPOSE,
  UPLOAD_RULES,
  MAX_FILES_PER_UPLOAD,
  MEDIA_TYPE,
} from './uploadService'
