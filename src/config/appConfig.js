// App-level constants (not environment-dependent — those live in env.js).
export const appConfig = Object.freeze({
  appName: 'BetterBlue',
  supportEmail: 'support@betterblue.example',
  defaultCurrency: 'USD',
  defaultPageSize: 12,
  // Public top-nav height (00 §6 shell spec). Shared by PublicTopNav and by
  // anything that sticks underneath it, so the offset never drifts.
  topNavHeight: Object.freeze({ xs: 56, md: 64 }),
})
