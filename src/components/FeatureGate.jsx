import AppLoader from '@/app/AppLoader'
import EmptyState from '@/components/feedback/EmptyState'
import useFeatureFlag from '@/hooks/useFeatureFlag'

// Feature-flag gating for a whole screen — Prompt 34 §4.3.
//
// The page-level twin of `AdminPageGuard` (Prompt 28), for the other reason a
// screen refuses to draw: not "you may not see this", but "this is switched off
// right now". Both problems have the same wrong answer — a blank workspace under
// a heading — so this renders an explanation instead (00 §13).
//
// **`isLoading` is the whole trick.** A flag starts out unknown, and unknown is
// not off: rendering the unavailable notice while `platformSettings` is still in
// flight would flash "not available" on every first paint of a feature that is
// perfectly on. `useFeatureFlag` documents this; this component is where the
// rule is actually kept, so no screen has to remember it.
//
// SECURITY: like every other gate in the client, this is UX (00 §11 / §14). A
// switched-off feature must also be refused by the API — a page that declines
// to render is not a disabled endpoint.

/**
 * Renders `children` only while a platform feature flag is on.
 *
 * @param {object} props
 * @param {string} props.flag a key of `platformSettings.features`, e.g.
 *   `'affiliateProgram'`
 * @param {React.ReactNode} props.children the screen, rendered when the flag is on
 * @param {React.ReactNode} [props.fallback] replaces the "unavailable" notice
 * @param {React.ReactNode} [props.loader] replaces the loading state
 * @param {string} [props.title='This area is not available right now']
 * @param {string} [props.description] override the explanation
 * @param {string} [props.icon='solar:card-2-linear'] iconify name for the notice
 *
 * @example
 * <DashboardPage title="Affiliate">
 *   <FeatureGate flag="affiliateProgram">
 *     <AffiliateDashboard />
 *   </FeatureGate>
 * </DashboardPage>
 */
export default function FeatureGate({
  flag,
  children,
  fallback,
  loader,
  title,
  description,
  icon = 'solar:card-2-linear',
}) {
  const { isEnabled, isLoading } = useFeatureFlag(flag)

  if (isLoading) return loader ?? <AppLoader label="Loading" />

  if (!isEnabled) {
    return (
      fallback ?? (
        <EmptyState
          icon={icon}
          title={title ?? 'This area is not available right now'}
          description={
            description ??
            'This part of BetterBlue is switched off at the moment. Nothing you have done is lost — it will be here again once the team turns it back on.'
          }
        />
      )
    )
  }

  return children
}
