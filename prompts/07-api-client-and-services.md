# Prompt 07 — API Client & Service Layer

> **Before you start:** Read `prompts/00-architecture-and-rules.md` (especially §10 API rules), `docs/api-contract.md`, and inspect Prompts 01–06 output.

## 1. Objective

Implement the centralized API infrastructure (axios client, error normalization, provider list-adapter, upload mock) and one service module per domain with baseline CRUD/query functions, plus the data-fetching hooks (`useApiQuery`, `useApiMutation`, `usePaginatedQuery`) and an API smoke-test script.

## 2. Context

Every feature prompt from here on calls these services — components never touch axios (00 §2.4). Workflow orchestration methods (acceptProposal, releasePayment, …) are added by their feature prompts; this prompt builds the foundation + read/write basics so nothing else ever needs provider awareness.

## 3. What Already Exists

Contract (06), seeds/db (05), constants incl. `generateId` (03), hooks folder with `useDebounce`/`useForm` (04).

## 4. What to Implement

**Infrastructure (`src/services/api/`)**
1. `apiClient.js` — axios instance, `baseURL: env.apiBaseUrl`, JSON headers, 15s timeout; request interceptor attaches `Authorization: Bearer <token>` from `utils/storage` key `bb.auth` (commented `MOCK-AUTH:`); response interceptor passes through data and converts all failures via `toApiError`.
2. `apiError.js` — `ApiError` class `{ status, code, message, details }`; `toApiError(axiosError)` mapping: network → `network_error` ("Can't reach the BetterBlue API — is `npm run api` running?" in dev), 400→`validation_failed`, 401→`unauthorized`, 403→`forbidden`, 404→`not_found`, 409→`conflict`, 5xx→`server_error`; honors a server-provided `error` envelope when present (Laravel-ready).
3. `listAdapter.js` — per 00 §10: `buildListParams({ page, limit, sort, order, search, filters })` and `parseListResponse(axiosResponse)` → `{ items, total, page, limit }`; provider switch on `env.apiProvider` with `json-server` implemented and a stubbed `laravel` branch containing TODO mapping comments. **Only file aware of `_page`/`X-Total-Count`.**
4. `crudFactory.js` — `createCrudService(resourcePath)` returning `{ list(params), getById(id), create(payload), update(id, patch), remove(id) }`; `create` injects `id: generateId(prefix)` + `createdAt` (prefix passed in; commented as mock-era behavior); all methods return parsed data or throw `ApiError`.
5. `uploadService.js` (`src/services/`) — `uploadFiles(files, { kind })` → simulated 600–1200ms latency (deterministic per file size), returns contract-shaped file objects `{ id, name, url, thumbnailUrl, mediaType, sizeKb }` with URLs from `constants/images.js` helpers (image kinds) or a placeholder video URL constant; validates size/type and throws `ApiError('validation_failed')` on violations. Commented `MOCK-UPLOAD:` with Laravel swap note.

**Domain services (`src/services/`)** — each built on `crudFactory` + named query helpers; intention-verb orchestration arrives in later prompts (leave clearly-commented section markers `// —— workflow operations (added by later prompts) ——`):
6. `userService` (list/get/update; `findByEmail(email)`); `buyerProfileService` (`getByUserId`); `creatorProfileService` (`getByUserId`, `search(params)` mapping discovery filters per contract, `listFeatured(limit)`); `portfolioService` (`listByCreator(creatorId, { statuses })`, `listPublished(creatorId)`); `categoryService` (`listActive()` with in-memory cache + `invalidate()`, fallback to `categoriesFallback` on network error); `requestService` (`listOpen(params)`, `listByBuyer(buyerId, params)`); `proposalService` (`listByRequest`, `listByCreator`, `hasCreatorProposed(requestId, creatorId)`); `orderService` (`listByBuyer`, `listByCreator`, `getWithRelations(id)` — parallel-fetches request/proposal/deliveries/revisions/payment via `Promise.all`); `deliveryService` (`listByOrder`); `revisionService` (`listByOrder`); `paymentService` (baseline: `getByOrderId`, `listTransactions(params)`; escrow logic arrives in Prompt 17); `payoutService` (`listByCreator`); `disputeService` (`listByUser`, `listMessages(disputeId)`); `reviewService` (`listByCreator(params)`, `getByOrderId`); `notificationService` (`listByUser(userId, params)`, `unreadCount(userId)`, `markRead(id)`, `markAllRead(userId)`, and **`notify({ userId, type, title, body, entityType, entityId })`** — the emit helper all workflows call); `moderationService` (`listQueue(params)`, `getBySubject`); `reportService` (`create`, `listQueue`); `supportService` (`createTicket`, `listTickets`); `affiliateService` (`getByUserId`, `getByCode`); `settingsService` (`getSettings()` with 60s in-memory cache + `invalidate()`, `getCommissionRate({ categoryId })` fallback default, `getFeature(flagKey)`); `auditService` (**`log({ actorId, actorRole, action, entityType, entityId, meta })`**, `list(params)`); `adminService` (aggregate helpers placeholder — Prompt 28).
7. `src/services/index.js` barrel.

**Hooks (`src/hooks/`)**
8. `useApiQuery(fetcher, deps, { enabled=true } = {})` → `{ data, isLoading, error, refetch }`; ignores stale responses (request-id guard), refetch stable.
9. `useApiMutation(mutationFn)` → `{ mutate(...args), isLoading, error, reset }` — `mutate` returns result or throws `ApiError` (caller toasts).
10. `usePaginatedQuery(listFn, { initialParams })` → `{ items, total, page, limit, setPage, setSort, setSearch, setFilters, isLoading, error, refetch, params }` — debounces search internally; drives every list page per 00 §12.

**Smoke test**
11. `scripts/smoke-api.mjs` (+ `npm run smoke:api`) — plain Node 18 `fetch` against `http://localhost:4000`: asserts list+filter+pagination header on 6 collections, one create/patch/delete round-trip on a scratch record, settings singleton fetch; clear pass/fail output, non-zero exit on failure. Note: requires `npm run api` running.

**Dev verification page** — extend the dev gallery with an "API" tab: buttons exercising `creatorProfileService.search`, `usePaginatedQuery` demo grid against real seeds, an intentional 404 showing `ErrorState`, and upload-mock demo through `FormFileField`.

## 5. Functional Requirements

All services return normalized data or throw `ApiError`; no component-facing function leaks axios/raw responses; category/settings caches work and are invalidatable; `notify`/`log` write records successfully.

## 6. UI/UX Requirements

Dev gallery API tab uses standard loading/error/empty patterns (proves the trio works end-to-end).

## 7. Technical Requirements

JSON-Server specifics confined to `listAdapter.js` (+ documented id/createdAt injection in `crudFactory`); no `_embed`/`_expand` anywhere; JSDoc on every exported service function; services import only from `api/`, `constants/`, `utils/` — never from components.

## 8. API Requirements

Implements `docs/api-contract.md` §today exactly; any necessary deviation must be reported and the contract updated in the same change.

## 9. Data Requirements

Runs against seeded db; smoke test must not corrupt seeds (clean up scratch records; reseed if needed).

## 10. Files & Folders

Creates: `src/services/api/{apiClient,apiError,listAdapter,crudFactory}.js`, ~24 service modules + `index.js`, `src/hooks/{useApiQuery,useApiMutation,usePaginatedQuery}.js`, `scripts/smoke-api.mjs`. Updates: dev gallery, `package.json` (smoke:api script only).

## 11. Responsive Requirements

API tab demo grid responsive (reuses existing patterns).

## 12. Accessibility Requirements

Loading states announced via existing components (no new work).

## 13. Validation & Error Handling

Stopping JSON Server while using the API tab shows friendly `network_error` `ErrorState` with working Retry; 404 path shows not-found error; upload rejects oversized file with inline message.

## 14. Acceptance Criteria

- `npm run smoke:api` passes against a freshly seeded, running API.
- Dev gallery API tab: search+pagination works against seeds; kill-API test shows recoverable error UI.
- Grep proves no `axios`/`fetch` usage outside `src/services/api/` + `scripts/`; no `_page`/`X-Total-Count` outside `listAdapter.js`.
- Lint + build clean.

## 15. Verification Steps

1. `npm run seed && npm run api` (keep running) → `npm run smoke:api`.
2. Exercise the dev gallery API tab (success, error, retry, upload mock).
3. Greps from §14; `npm run lint && npm run build`.

## 16. Constraints

Execution protocol per 00 §16: inspect first · additive changes · reuse before creating · JS/JSX only · no new dependencies · Node 18.19.0 · lint+build clean · report changes/assumptions/issues.

## 17. Do NOT Change

Contract semantics (06), seed data (beyond smoke-test cleanup), component library APIs, `prompts/`.

## 18. Depends On

03, 04, 05, 06.

## 19. Final Checklist

- [ ] apiClient/apiError/listAdapter/crudFactory implemented per contract
- [ ] All domain services + notify/log helpers + caches created
- [ ] Three data hooks implemented and demoed
- [ ] Upload mock implemented with contract shape
- [ ] smoke:api passes; greps clean; lint + build clean; report written
