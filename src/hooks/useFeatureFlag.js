import useApiQuery from '@/hooks/useApiQuery'
import { settingsService } from '@/services/settingsService'

// Platform feature flags — 00 §5 lists this hook, contract §6.27 defines the
// `features.*` object behind it.
//
// The flags live on the `platformSettings` singleton, which `settingsService`
// caches for a minute and *never* throws from: an unreachable API resolves to
// the bundled `SETTINGS_FALLBACK`, so a flag check can never break a render or
// leave a route in limbo. Prompt 35 adds the admin screen that edits them; this
// is the only way anything in `src/` may read one (§7).
//
// **`isLoading` matters.** A flag starts out unknown, and "unknown" is not
// "off": routing on `isEnabled` alone would flash a "not available" screen on
// every first paint before the settings land. Gate on `isLoading` first.

/**
 * Reads one platform feature flag.
 *
 * @param {string} flagKey a key of `platformSettings.features`, e.g.
 *   `'publicRequestBoard'`, `'affiliateProgram'`, `'reviews'`, `'disputes'`
 * @returns {{isEnabled: boolean, isLoading: boolean}} `isEnabled` is `false`
 *   until the settings resolve — render a loader while `isLoading`
 *
 * @example
 * const { isEnabled, isLoading } = useFeatureFlag('publicRequestBoard')
 * if (isLoading) return <AppLoader />
 * if (!isEnabled) return <BoardUnavailable />
 */
export function useFeatureFlag(flagKey) {
  const { data, isLoading } = useApiQuery(
    () => settingsService.getFeature(flagKey),
    [flagKey],
    { enabled: Boolean(flagKey) }
  )

  return { isEnabled: data === true, isLoading: Boolean(flagKey) && isLoading }
}

export default useFeatureFlag
