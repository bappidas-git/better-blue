import { useCallback, useState } from 'react'

import { Icon } from '@iconify/react'
import Accordion from '@mui/material/Accordion'
import AccordionDetails from '@mui/material/AccordionDetails'
import AccordionSummary from '@mui/material/AccordionSummary'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'

import ErrorState from '@/components/feedback/ErrorState'
import { useToast } from '@/components/feedback/ToastProvider'
import FeatureGate from '@/components/FeatureGate'
import Section from '@/components/layout/Section'
import { AFFILIATE_PROFILE_STATUS } from '@/constants/statuses'
import AffiliatePayoutSection from '@/features/affiliate/components/AffiliatePayoutSection'
import AffiliateStats from '@/features/affiliate/components/AffiliateStats'
import EarningsTable from '@/features/affiliate/components/EarningsTable'
import EnrollCard from '@/features/affiliate/components/EnrollCard'
import ReferralLinkCard from '@/features/affiliate/components/ReferralLinkCard'
import ReferralsTable from '@/features/affiliate/components/ReferralsTable'
import { useAuth } from '@/context/AuthContext'
import useApiMutation from '@/hooks/useApiMutation'
import useApiQuery from '@/hooks/useApiQuery'
import DashboardPage from '@/layouts/dashboard/DashboardPage'
import { affiliateService, getProgramSettings } from '@/services/affiliateService'
import { formatCurrency, formatPercent } from '@/utils/formatters'

// `/buyer/affiliate` — the member's whole view of the referral program
// (Prompt 34 §4.3).
//
// Two states, one screen. A member who has not joined sees the pitch and the
// terms; a member who has sees their link, their numbers, and their money. They
// are the same page rather than two routes because they are the same *place* —
// enrolling should feel like the screen filling in, not like being sent
// somewhere else — and the second state is what the first one becomes the
// moment `enroll` resolves.
//
// Mounted on the buyer dashboard (the referral program is a buyer-facing perk,
// and the nav entry lives in `buyerNav`), but the service is role-agnostic: a
// creator who is enrolled — three of them are, in the seed — has the same
// dashboard waiting behind the same call the day a creator nav entry is added.
//
// Everything is inside `FeatureGate`: with `features.affiliateProgram` off the
// nav entry is gone and this page says so, rather than rendering an enrolment
// pitch for a program that is switched off.

export default function BuyerAffiliatePage() {
  const { user } = useAuth()
  const toast = useToast()
  const [enrollError, setEnrollError] = useState(null)

  const {
    data: settings,
    isLoading: settingsLoading,
  } = useApiQuery(() => getProgramSettings(), [])

  const {
    data: dashboard,
    isLoading,
    error,
    refetch,
  } = useApiQuery(() => affiliateService.getDashboard(user?.id), [user?.id], {
    enabled: Boolean(user?.id),
  })

  const { mutate: enroll, isLoading: isEnrolling } = useApiMutation(() =>
    affiliateService.enroll(user?.id, { name: user?.name })
  )

  const { mutate: requestPayout, isLoading: isRequesting } = useApiMutation(() =>
    affiliateService.requestAffiliatePayout(user?.id)
  )

  const handleEnroll = useCallback(async () => {
    setEnrollError(null)
    try {
      await enroll()
      toast.success('You’re in — here is your referral link', {
        description: 'Copy it and share it with a business that needs content.',
      })
      refetch()
    } catch (failure) {
      setEnrollError(failure)
      toast.error(failure?.message ?? 'We could not set up your referral link.')
    }
  }, [enroll, refetch, toast])

  const handleRequestPayout = useCallback(async () => {
    // The dialog owns the error surface here (it keeps the request open so the
    // reason is read beside the amount), so this re-throws rather than
    // swallowing — the toast only fires on the way through success.
    const payout = await requestPayout()
    toast.success('Payout requested', {
      description: 'Our finance team reviews affiliate payouts before the money is sent.',
    })
    refetch()
    return payout
  }, [refetch, requestPayout, toast])

  const profile = dashboard?.profile ?? null
  const isSuspended = profile?.status === AFFILIATE_PROFILE_STATUS.SUSPENDED
  const busy = isLoading || settingsLoading

  return (
    <DashboardPage
      title="Referral program"
      subtitle={
        profile
          ? 'Share your link, track what it brings in, and request your commission.'
          : 'Introduce a business to BetterBlue and earn a share of the commission on their first order.'
      }
    >
      <FeatureGate
        flag="affiliateProgram"
        icon="solar:users-group-rounded-linear"
        title="The referral program is not available right now"
        description="Referrals are switched off at the moment. Any commission you have already earned is safe and will be here when the program is back."
      >
        {error ? (
          <ErrorState
            error={error}
            onRetry={refetch}
            title="We could not load your referral dashboard"
          />
        ) : !profile && !busy ? (
          <EnrollCard
            settings={settings}
            onEnroll={handleEnroll}
            isSubmitting={isEnrolling}
            error={enrollError}
          />
        ) : (
          <Stack spacing={{ xs: 3, md: 4 }}>
            {profile ? <ReferralLinkCard profile={profile} /> : null}

            <AffiliateStats profile={profile} balance={dashboard?.balance} loading={busy} />

            <Section
              title="Your referrals"
              description="Everyone who signed up through your link. Names are shortened — a referred business is never identified to the member who referred them."
              spacing="sm"
              titleComponent="h2"
            >
              <ReferralsTable
                rows={dashboard?.referrals ?? []}
                loading={busy}
                onRetry={refetch}
              />
            </Section>

            <Section
              title="Commission"
              description="Every commission you have earned, and where each one stands. Orders are shown by reference only."
              spacing="sm"
              titleComponent="h2"
            >
              <EarningsTable rows={dashboard?.earnings ?? []} loading={busy} onRetry={refetch} />
            </Section>

            <Section title="Payouts" spacing="sm" titleComponent="h2">
              <AffiliatePayoutSection
                balance={dashboard?.balance}
                payouts={dashboard?.payouts ?? []}
                onRequest={handleRequestPayout}
                isSubmitting={isRequesting}
                disabled={isSuspended}
              />
            </Section>

            {/* Collapsed by default: the terms are load-bearing at enrolment and
                reference material afterwards. Keeping them on the page — rather
                than on a link somebody has to go and find — is what makes
                "commission can be voided" something a member can check the day
                it happens. */}
            <Accordion disableGutters elevation={0} sx={{ border: 1, borderColor: 'divider', borderRadius: 2 }}>
              <AccordionSummary
                expandIcon={<Icon icon="solar:alt-arrow-down-linear" width={20} aria-hidden="true" />}
                aria-controls="affiliate-terms-content"
                id="affiliate-terms-header"
                sx={{ minHeight: 56 }}
              >
                <Typography variant="subtitle1" component="h2">
                  Program terms
                </Typography>
              </AccordionSummary>
              <AccordionDetails id="affiliate-terms-content">
                <Stack component="ul" spacing={1} sx={{ m: 0, pl: 2.5 }}>
                  <Typography component="li" variant="body2" color="text.secondary">
                    You earn {formatPercent(settings?.commissionRate ?? 0)} of the platform
                    commission BetterBlue earns on a referred business&rsquo;s first completed
                    order — never a share of what the creator is paid.
                  </Typography>
                  <Typography component="li" variant="body2" color="text.secondary">
                    A referral is attributed for {settings?.attributionDays ?? 30} days from the
                    click. A first order completed after that window earns nothing.
                  </Typography>
                  <Typography component="li" variant="body2" color="text.secondary">
                    Only the first completed order of a referred business earns commission. Their
                    later orders do not.
                  </Typography>
                  <Typography component="li" variant="body2" color="text.secondary">
                    Commission is reviewed before it can be paid, and can be voided if the order is
                    refunded or the referral breaches these terms. You are told when either happens.
                  </Typography>
                  <Typography component="li" variant="body2" color="text.secondary">
                    Payouts are available once approved commission reaches{' '}
                    {formatCurrency(settings?.payoutMinAmount ?? 0, settings?.currency, {
                      hideDecimals: true,
                    })}
                    , and settle your whole approved balance.
                  </Typography>
                  <Typography component="li" variant="body2" color="text.secondary">
                    You cannot refer yourself, and referrals must be genuine introductions.
                  </Typography>
                </Stack>
              </AccordionDetails>
            </Accordion>
          </Stack>
        )}
      </FeatureGate>
    </DashboardPage>
  )
}
