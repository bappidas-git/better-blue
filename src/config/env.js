// Single access point for environment variables. Nothing outside this module
// may read import.meta.env — see prompts/00-architecture-and-rules.md §4.
const raw = import.meta.env

if (raw.DEV && !raw.VITE_API_BASE_URL) {
  console.warn(
    '[env] VITE_API_BASE_URL is not set — falling back to http://localhost:4000. ' +
      'Copy .env.example to .env to silence this warning.'
  )
}

export const env = Object.freeze({
  apiBaseUrl: raw.VITE_API_BASE_URL || 'http://localhost:4000',
  apiProvider: raw.VITE_API_PROVIDER || 'json-server',
  appName: raw.VITE_APP_NAME || 'BetterBlue',
  enableDevPages: String(raw.VITE_ENABLE_DEV_PAGES ?? 'true') === 'true',
  // Vite's build-time mode flag, surfaced here so the rest of the app keeps its
  // single access point. Used for developer-facing diagnostics only (e.g. the
  // "is `npm run api` running?" hint in `services/api/apiError.js`) — never to
  // change product behaviour.
  isDev: raw.DEV === true,
})
