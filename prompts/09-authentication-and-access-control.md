# Prompt 09 — Authentication & Access Control

> **Before you start:** Read `prompts/00-architecture-and-rules.md` (especially §11 RBAC, §14 security), `docs/api-contract.md` auth section, then inspect Prompts 01–08 output.

## 1. Objective

Implement the full authentication experience (login, registration with role choice, logout, session persistence, boot revalidation) plus route guards (`GuestRoute`, `ProtectedRoute`, `RoleRoute`), `PermissionGate`, account-status handling, and auth-aware navigation.

## 2. Context

JSON Server cannot authenticate, so `authService` simulates the contract's auth endpoints over `/users` while keeping Laravel-identical function signatures (00 §14, contract §2). All four roles must be able to sign in and land on their role home (placeholder dashboard pages for now — real dashboards arrive in Prompt 14+).

## 3. What Already Exists

Router + layouts + AuthLayout (08), services incl. `userService.findByEmail` (07), demo accounts in seeds (05), `ROLE_HOME_PATH` (03), `useForm` + validators + storage utils (03/04).

## 4. What to Implement

1. `authService` (`src/services/authService.js`) — `login({ email, password })`: finds user by email (case-insensitive), verifies password field, rejects with `ApiError('unauthorized', 'Incorrect email or password')` on mismatch **without revealing which field failed**; account-status check: `suspended`/`blacklisted`/`deactivated` → `ApiError('forbidden', code-specific message)`; success → `{ token, user }` where token = `MOCK-AUTH` base64 of `{ sub, role, iat }`; updates `lastLoginAt`. `register({ role, name, email, password, companyName? , displayName? })`: validates role ∈ buyer|creator, rejects duplicate email (`conflict`), creates user (accountStatus `active`, default notificationPrefs) + corresponding buyerProfile/creatorProfile, reads `bb.referralCode` from storage and stores `referredByCode` on the user (referral record creation happens in Prompt 34 — leave marked hook comment), auto-logs-in. `me()`: re-fetches user by stored id — used on boot; if status no longer active → throw with code. `logout()`: clears storage. Every mock shortcut commented `MOCK-AUTH:` with the Laravel swap note.
2. `src/context/AuthContext.jsx` — provider + `useAuth()` → `{ user, isAuthenticated, isBooting, login, register, logout, refreshUser }`; persists `{ token, user }` in storage `bb.auth`; on mount revalidates via `me()` (silently logs out on failure with a toast for status-based rejections); wires into `AppProviders` (inside Router? No — AuthProvider wraps RouterProvider; guards consume context). On login/register: toast welcome + navigate to `ROLE_HOME_PATH[user.role]`. On logout: navigate `HOME` + toast.
3. `src/routes/guards.jsx` — `ProtectedRoute` (unauthenticated → `LOGIN` with `state.from` for post-login redirect; renders Outlet), `RoleRoute({ roles })` (wrong role → their own role home with info toast, not a dead end), `GuestRoute` (authenticated → role home). While `isBooting`: branded full-screen loader (no flicker of wrong state). `PermissionGate({ permission, children, fallback=null })` component using `hasPermission`.
4. Wire guards into the router: `/buyer/*` → RoleRoute buyer; `/creator/*` → creator; `/admin/*` → admin + super_admin; login/register under GuestRoute + AuthLayout. Create minimal placeholder dashboard index pages (`BuyerHomePlaceholder`, `CreatorHomePlaceholder`, `AdminHomePlaceholder`) marked `// TEMP: replaced in Prompts 14/15/21/28` showing "Signed in as {name} ({role})" + Logout button.
5. `LoginPage` (`src/features/auth/pages/`) — email + password (show/hide), submit with loading, inline `ApiError` message region, links to register; **Demo accounts panel** (DEV-only via `env.enableDevPages`): four one-click fill buttons (buyer/creator/admin/super) using seeded credentials.
6. `RegisterPage` — step 1 role choice: two selectable cards ("I'm a business — I need content" / "I'm a creator — I make content") with icons + descriptions; step 2 details: name, email, password (strength hint: min 8 + letter + number), confirm password, buyer→companyName / creator→displayName, terms+content-policy agreement checkbox (links); submit → auto-login → role home. Both pages: `useForm` + validators, Enter submits, fields autocomplete attributes.
7. Account-status UX — `AccountStatusScreen` used when `me()`/login rejects for suspended/blacklisted/deactivated: respectful copy, support email link, logout action. Blacklisted copy: "This account has been restricted for violating the BetterBlue marketplace policies."
8. Auth-aware `PublicTopNav` — replace the Prompt-08 slot: authenticated users see UserAvatar menu (name, role chip, "Go to dashboard", "Log out") instead of Login/Join CTAs.
9. `ForgotPasswordPage` — email form → always shows "If an account exists, we've sent reset instructions" success state (mock; no actual send; documented); linked from login.

## 5. Functional Requirements

Login/logout/register for all roles; refresh keeps session (revalidated); `state.from` deep-link redirect works (visit `/buyer/orders` logged out → login → land back); duplicate-email register shows conflict error; suspended seeded creator cannot log in; role mismatch redirects with toast.

## 6. UI/UX Requirements

AuthLayout card ≤ 440px, generous spacing, gradient CTA, subtle card entrance (fadeInUp); role-choice cards with selected ring state; mobile: full-width card, brand panel hidden; loading buttons; no layout jump between steps (fixed min-height or animated height).

## 7. Technical Requirements

All auth logic in authService/AuthContext (zero in components); guards are the only route-protection mechanism; storage only via `utils/storage`; **document in code + report: frontend protection is UX-only; Laravel must enforce authorization independently** (00 §11).

## 8. API Requirements

Follows contract auth section semantics with documented mock deviations; `PATCH /users/:id` for lastLoginAt; profile creation per data model.

## 9. Data Requirements

Uses seeded demo accounts; registration writes valid user+profile records (verify shape matches data-model.md).

## 10. Files & Folders

Creates: `src/services/authService.js`, `src/context/AuthContext.jsx`, `src/routes/guards.jsx`, `src/features/auth/pages/{LoginPage,RegisterPage,ForgotPasswordPage}.jsx`, `src/features/auth/components/{DemoAccountsPanel,RoleChoiceCards,AccountStatusScreen}.jsx`, three placeholder dashboard pages. Updates: router/route configs, `AppProviders.jsx`, `PublicTopNav.jsx`, `paths.js` (FORGOT_PASSWORD).

## 11. Responsive Requirements

Auth pages polished at 360px (full-width card, 44px+ inputs, sticky-free); avatar menu usable on touch.

## 12. Accessibility Requirements

Labeled inputs + `autocomplete` (email, current-password, new-password); error region `role="alert"`; password toggle `aria-pressed` + label; role-choice cards keyboard selectable (radio semantics); focus moves to first field per step.

## 13. Validation & Error Handling

Client validation before submit (email format, password rules, required, match); server `ApiError` mapped to friendly copy; network error → inline retryable message; buttons disabled while pending.

## 14. Acceptance Criteria

- All four demo accounts log in and land on their role home; refresh persists; logout returns to `/`.
- Register (buyer + creator) creates records, auto-logs-in, lands correctly; duplicate email → clear conflict message.
- Deep-link redirect works; wrong-role access redirects with toast; suspended account sees status screen at login; guards show no wrong-state flicker on hard refresh.
- Lint + build clean.

## 15. Verification Steps

1. Reseed. Walk: login×4 roles, refresh, logout; register buyer + creator; duplicate email; suspended creator login; `/admin` as buyer; `/buyer/orders` logged out → login → redirected.
2. Keyboard-only pass on both auth forms; check autocomplete attrs.
3. `npm run lint && npm run build`.

## 16. Constraints

Execution protocol per 00 §16: inspect first · additive changes · reuse before creating · JS/JSX only · no new dependencies · Node 18.19.0 · lint+build clean · report changes/assumptions/issues.

## 17. Do NOT Change

Contract semantics, seed passwords/emails, listAdapter, component library, `prompts/`.

## 18. Depends On

03, 04, 05, 07, 08.

## 19. Final Checklist

- [ ] authService with MOCK-AUTH comments + Laravel notes; AuthContext with boot revalidation
- [ ] Guards + PermissionGate wired; placeholders for role homes
- [ ] Login (with demo panel), Register (role choice), Forgot, Status screens done
- [ ] Auth-aware public nav; deep-link redirect; all §14 criteria pass
- [ ] Lint + build clean; report written
