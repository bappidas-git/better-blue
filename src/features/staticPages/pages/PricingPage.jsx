import { Icon } from '@iconify/react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Divider from '@mui/material/Divider'
import Link from '@mui/material/Link'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { Link as RouterLink } from 'react-router-dom'

import StatCard from '@/components/data-display/StatCard'
import StaggerList from '@/components/motion/StaggerList'
import useApiQuery from '@/hooks/useApiQuery'
import { paths } from '@/routes/paths'
import { SETTINGS_FALLBACK, settingsService } from '@/services'
import { formatCurrency, formatNumber, formatPercent } from '@/utils/formatters'

import EscrowExplainer from '../components/EscrowExplainer'
import InfoCtaBand from '../components/InfoCtaBand'
import InfoPageLayout from '../components/InfoPageLayout'
import InfoSection from '../components/InfoSection'
import ProseList from '../components/ProseList'
import { ESCROW_FOOTNOTE, ESCROW_STAGES } from '../content/howItWorks'
import {
  EXAMPLE_ORDER_AMOUNT,
  PRICING_FAQ_LINKS,
  PRICING_INCLUDED,
  PRICING_INTRO,
  PRICING_PRINCIPLES,
} from '../content/pricing'

// Pricing & fees.
//
// Not one rate, minimum, or window is written into this page: they are read
// from `platformSettings` through `settingsService`, and the worked example is
// computed from whatever the commission rate currently is. An admin changing
// the rate changes this page (00 §9 — settings are load-bearing, and the
// service caches them briefly). If the settings cannot be read at all, the page
// falls back to the bundled defaults and says so rather than failing.

const dayLabel = (days) => `${formatNumber(days)} ${days === 1 ? 'day' : 'days'}`

/** One line of the worked example. */
function ExampleRow({ label, value, hint, emphasis = false }) {
  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      spacing={{ xs: 0.5, sm: 2 }}
      justifyContent="space-between"
      alignItems={{ xs: 'flex-start', sm: 'baseline' }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Typography variant={emphasis ? 'subtitle1' : 'body1'} color="text.primary">
          {label}
        </Typography>
        {hint ? (
          <Typography variant="caption" color="text.secondary">
            {hint}
          </Typography>
        ) : null}
      </Box>

      <Typography
        variant={emphasis ? 'h5' : 'body1'}
        component="p"
        sx={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}
      >
        {value}
      </Typography>
    </Stack>
  )
}

export default function PricingPage() {
  const { data, isLoading, error } = useApiQuery(() => settingsService.getSettings(), [])

  // One resolved shape for the whole page: live settings when we have them, the
  // bundled defaults when the request failed.
  const settings = data ?? (error ? SETTINGS_FALLBACK : null)

  const currency = settings?.general?.currency ?? SETTINGS_FALLBACK.general.currency
  const commissionRate =
    settings?.commission?.defaultRate ?? SETTINGS_FALLBACK.commission.defaultRate
  const payoutMinAmount =
    settings?.general?.payoutMinAmount ?? SETTINGS_FALLBACK.general.payoutMinAmount
  const autoAcceptDays =
    settings?.general?.autoAcceptDays ?? SETTINGS_FALLBACK.general.autoAcceptDays

  const affiliate = settings?.affiliate ?? SETTINGS_FALLBACK.affiliate
  const affiliateEnabled =
    Boolean(affiliate?.enabled) && settings?.features?.affiliateProgram !== false

  const commissionAmount = EXAMPLE_ORDER_AMOUNT * commissionRate
  const creatorAmount = EXAMPLE_ORDER_AMOUNT - commissionAmount

  return (
    <InfoPageLayout
      documentTitle="Pricing & fees"
      eyebrow="Pricing"
      title="One commission, on completed work"
      intro={PRICING_INTRO}
      maxWidth="lg"
      contentWidth="wide"
      banner={
        error ? (
          <Alert severity="warning" icon={<Icon icon="tabler:alert-triangle" width={20} />}>
            We could not load live platform settings just now, so the figures below are
            BetterBlue’s standard rates. Reload the page to try again.
          </Alert>
        ) : null
      }
    >
      <InfoSection id="how-fees-work" title="How fees work">
        <StaggerList
          inView
          sx={{
            display: 'grid',
            gap: { xs: 2, md: 3 },
            gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' },
          }}
        >
          {PRICING_PRINCIPLES.map((principle) => (
            <Card key={principle.key} sx={{ height: '100%' }}>
              <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
                <Stack spacing={1.5}>
                  <Box
                    aria-hidden="true"
                    sx={{
                      width: 44,
                      height: 44,
                      borderRadius: 2,
                      display: 'grid',
                      placeItems: 'center',
                      bgcolor: 'primary.surface',
                      color: 'primary.main',
                    }}
                  >
                    <Icon icon={principle.icon} width={22} />
                  </Box>
                  <Typography variant="h6" component="h3">
                    {principle.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {principle.description}
                  </Typography>
                </Stack>
              </CardContent>
            </Card>
          ))}
        </StaggerList>
      </InfoSection>

      <InfoSection
        id="current-rates"
        title="Current platform rates"
        description="These are read from the live platform configuration, so what you see here is what applies to an order created today."
      >
        <Box
          sx={{
            display: 'grid',
            gap: { xs: 2, md: 3 },
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' },
          }}
        >
          {/* `animate={false}`: these are contractual figures, not achievements
              — a pricing page that counts up from "0%" reads as broken for the
              frame it takes to settle. */}
          <StatCard
            loading={isLoading}
            animate={false}
            label="Platform commission"
            value={commissionRate}
            format={(value) => formatPercent(value)}
            deltaLabel="of the order price, taken at release"
            icon="tabler:percentage"
          />
          <StatCard
            loading={isLoading}
            animate={false}
            label="Payout minimum"
            value={payoutMinAmount}
            format={(value) => formatCurrency(value, currency, { hideDecimals: true })}
            deltaLabel="balance needed to request a payout"
            icon="tabler:wallet"
          />
          <StatCard
            loading={isLoading}
            animate={false}
            label="Buyer review window"
            value={autoAcceptDays}
            format={dayLabel}
            deltaLabel="before a delivery accepts automatically"
            icon="tabler:clock-check"
          />
        </Box>
      </InfoSection>

      <InfoSection
        id="worked-example"
        title="A worked example"
        description={`What a ${formatCurrency(EXAMPLE_ORDER_AMOUNT, currency, {
          hideDecimals: true,
        })} order looks like for both sides, at the commission rate above.`}
      >
        <Card>
          <CardContent sx={{ p: { xs: 2.5, md: 4 } }}>
            <Stack spacing={2.5}>
              <ExampleRow
                label="Order price"
                hint="Agreed in the proposal, paid upfront and held in escrow"
                value={formatCurrency(EXAMPLE_ORDER_AMOUNT, currency)}
              />

              <Divider />

              <ExampleRow
                label={`Platform commission (${formatPercent(commissionRate)})`}
                hint="Deducted once, when the payment is released"
                value={`− ${formatCurrency(commissionAmount, currency)}`}
              />

              <Divider />

              <ExampleRow
                emphasis
                label="Creator receives"
                hint="Credited to the creator’s earnings balance on approval"
                value={formatCurrency(creatorAmount, currency)}
              />

              <Typography variant="caption" color="text.secondary">
                The buyer pays {formatCurrency(EXAMPLE_ORDER_AMOUNT, currency)} — the commission
                comes out of the order, never on top of it.
              </Typography>
            </Stack>
          </CardContent>
        </Card>
      </InfoSection>

      <InfoSection
        id="payment-protection"
        title="What payment protection means"
        description="Every order is funded before work starts and released only when the work is approved."
      >
        <EscrowExplainer stages={ESCROW_STAGES} footnote={ESCROW_FOOTNOTE} />
      </InfoSection>

      <InfoSection
        id="whats-included"
        title="What the commission covers"
        description="One fee, and everything the marketplace does around an order."
      >
        <ProseList items={PRICING_INCLUDED} marker="check" />
      </InfoSection>

      {affiliateEnabled ? (
        <InfoSection
          id="affiliate"
          title="Refer a business or a creator"
          description="Members can share a referral link and earn commission on the orders it brings in."
        >
          <Card>
            <CardContent sx={{ p: { xs: 2.5, md: 4 } }}>
              <Stack spacing={2}>
                <Typography variant="body1" color="text.secondary" sx={{ maxWidth: '68ch' }}>
                  The BetterBlue affiliate programme pays{' '}
                  {formatPercent(affiliate.commissionRate)} of the platform commission on orders
                  from members you refer, with referrals attributed for{' '}
                  {dayLabel(affiliate.attributionDays)} after the first visit. Referral earnings
                  are paid out once they reach{' '}
                  {formatCurrency(affiliate.payoutMinAmount, currency, { hideDecimals: true })}.
                </Typography>

                <Box>
                  <Button
                    component={RouterLink}
                    to={paths.REGISTER}
                    variant="outlined"
                    startIcon={<Icon icon="tabler:share" width={20} />}
                  >
                    Join and get your link
                  </Button>
                </Box>

                <Typography variant="caption" color="text.secondary">
                  Your referral link and its earnings live in your dashboard once you have an
                  account.
                </Typography>
              </Stack>
            </CardContent>
          </Card>
        </InfoSection>
      ) : null}

      <InfoSection id="pricing-questions" title="Questions about money">
        <Stack spacing={1}>
          {PRICING_FAQ_LINKS.map((item) => (
            <Link
              key={item.key}
              component={RouterLink}
              to={`${paths.FAQ}#${item.group}`}
              variant="body1"
              underline="hover"
              sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, minHeight: 44 }}
            >
              <Icon icon="tabler:help-circle" width={20} aria-hidden="true" />
              {item.label}
            </Link>
          ))}
        </Stack>
      </InfoSection>

      <InfoCtaBand
        title="No fee to find out what your brief is worth"
        description="Publish a content request and compare priced proposals from creators who have done the work before."
        primary={{ label: 'Join BetterBlue', to: paths.REGISTER, icon: 'tabler:file-text' }}
        secondary={{ label: 'Read the FAQ', to: paths.FAQ, icon: 'tabler:help-circle' }}
      />
    </InfoPageLayout>
  )
}
