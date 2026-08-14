# Prompt 01 — Project Foundation

> **Before you start:** Read `prompts/00-architecture-and-rules.md` in full. Follow its Execution Protocol (§16) for this and every future prompt. This is the first implementation prompt — the repository currently contains only the `prompts/` folder.

## 1. Objective

Initialize the BetterBlue frontend project: Vite + React 18 (JavaScript), the complete approved dependency set, ESLint, environment configuration, npm scripts, the canonical folder skeleton, and a minimal booting app shell — all verified on Node.js 18.19.0.

## 2. Context

BetterBlue is a professional creator marketplace for business-oriented UGC (see 00 §1). This prompt creates the technical foundation every later prompt builds on. Nothing product-facing is built yet beyond a placeholder shell.

## 3. What Already Exists

Only `prompts/` (this prompt system). Do not modify anything inside `prompts/`.

## 4. What to Implement

1. Hand-author `package.json` at the repo root (do **not** use `npm create vite` — its current templates may target newer Node/TS): name `betterblue`, version `0.1.0`, `"private": true`, `"engines": { "node": ">=18.19.0" }`, and **exactly** the dependencies/devDependencies listed in 00 §3.
2. Add all npm scripts from 00 §4 (`dev`, `api`, `dev:all`, `seed`, `build`, `preview`, `lint`; `seed` can be `node scripts/seed-db.js` even though the script arrives in Prompt 05; `smoke:*` scripts arrive later).
3. `vite.config.js` — `@vitejs/plugin-react`, alias `@` → `/src`, server port 5173.
4. `jsconfig.json` — `baseUrl` + `paths` for `@/*` so editors resolve the alias.
5. `.eslintrc.cjs` — ESLint 8 with `eslint:recommended`, `plugin:react/recommended`, `plugin:react-hooks/recommended`, `react-refresh`; `react/react-in-jsx-scope: off`, `react/prop-types: off`; browser + es2021 envs; separate override for `scripts/**` (node env). `.eslintignore` for `dist`, `server`, `prompts`.
6. `.gitignore` (node_modules, dist, .env, editor/OS junk — but keep `.env.example`), `.env.example` and `.env` with the four variables from 00 §4.
7. `index.html` — `lang="en"`, title "BetterBlue — Commercial Content Marketplace", meta description (professional UGC marketplace copy), viewport meta, `<div id="root">`, module script to `/src/main.jsx`.
8. Folder skeleton per 00 §5: create every directory under `src/` plus `docs/`, `scripts/`, `server/`, `public/` (use `.gitkeep` in empty dirs).
9. `src/config/env.js` — reads `import.meta.env` into a frozen `env` object (`apiBaseUrl`, `apiProvider`, `appName`, `enableDevPages` boolean) with sane defaults and a console warning in dev if `VITE_API_BASE_URL` is missing. All env access anywhere in the app goes through this module.
10. `src/config/appConfig.js` — app-level constants: `appName`, `supportEmail: "support@betterblue.example"`, `defaultCurrency: "USD"`, `defaultPageSize: 12`.
11. `src/main.jsx` + `src/app/App.jsx` + `src/app/AppProviders.jsx` — minimal shell: providers component (empty pass-through for now), App renders a centered "BetterBlue" heading, tagline "Commercial content, made by creators.", and an environment line showing `env.apiBaseUrl` (temporary; replaced in Prompt 02/08).
12. `server/db.json` — minimal valid placeholder: `{ "meta": [{ "id": "app", "name": "BetterBlue" }] }` (regenerated properly in Prompt 05).
13. Root `README.md` — project name, one-paragraph description (professional commercial UGC marketplace), Node 18.19.0 requirement, install/run instructions (`npm install`, `npm run dev:all`), scripts table, link to `docs/` (grows later).
14. Run `npm install` and verify everything.

## 5. Functional Requirements

- `npm run dev` serves the shell at `http://localhost:5173`; `npm run api` serves JSON Server at `http://localhost:4000/meta`; `npm run dev:all` runs both concurrently with named, colored output.
- The app renders without console errors or warnings.

## 6. UI/UX Requirements

Placeholder shell only: system font stack is fine this prompt, neutral near-white background, content centered. No design work yet (Prompt 02 owns it).

## 7. Technical Requirements

JavaScript/JSX only; ESM throughout; no TypeScript artifacts; alias imports working (`import { env } from '@/config/env'`); React 18 `createRoot`; StrictMode enabled.

## 8. API Requirements

None yet beyond JSON Server booting against the placeholder db.

## 9. Data Requirements

Placeholder `server/db.json` only. Never hand-edit it after Prompt 05.

## 10. Files & Folders

Creates: `package.json`, `package-lock.json`, `vite.config.js`, `jsconfig.json`, `.eslintrc.cjs`, `.eslintignore`, `.gitignore`, `.env`, `.env.example`, `index.html`, `README.md`, `server/db.json`, `src/main.jsx`, `src/app/App.jsx`, `src/app/AppProviders.jsx`, `src/config/env.js`, `src/config/appConfig.js`, full directory skeleton per 00 §5.

## 11. Responsive Requirements

Viewport meta present; shell centers correctly at 360px and 1440px.

## 12. Accessibility Requirements

`lang="en"`, single `h1` in the shell, meaningful `<title>`.

## 13. Validation & Error Handling

`env.js` tolerates missing vars with defaults + dev warning; app must not crash if `.env` is absent.

## 14. Acceptance Criteria

- `node -v` compatible install: `npm install` completes on Node 18.19.0 with no peer-dependency errors.
- `npm run lint` → 0 errors/warnings. `npm run build` → succeeds. `npm run dev:all` → both servers up; shell renders; `GET http://localhost:4000/meta` returns the placeholder record.
- Exactly the approved dependency set from 00 §3 is installed — nothing more.

## 15. Verification Steps

1. `npm install` (watch for engine/peer warnings — resolve any by adjusting to the approved versions, not by adding packages).
2. `npm run lint`, `npm run build`.
3. `npm run dev:all`; open 5173 (shell renders, console clean) and 4000/meta (JSON responds).
4. Confirm no `.ts`/`.tsx` files exist anywhere.

## 16. Constraints

Execution protocol per 00 §16: inspect first · additive changes · reuse before creating · JS/JSX only · no new dependencies beyond 00 §3 · Node 18.19.0 compatible · logic out of presentation components · lint+build clean · report changes/assumptions/issues.

## 17. Do NOT Change

Anything in `prompts/`.

## 18. Depends On

`00-architecture-and-rules.md` only (first implementation prompt).

## 19. Final Checklist

- [ ] Approved dependency set installed exactly; engines field set
- [ ] All npm scripts from 00 §4 present and working (except smoke:* which come later)
- [ ] Alias `@/` works in a real import
- [ ] Folder skeleton matches 00 §5
- [ ] Shell renders; JSON Server responds; lint + build clean
- [ ] Report written (changes, assumptions, remaining issues)
