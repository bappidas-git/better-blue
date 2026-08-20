import Container from '@mui/material/Container'
import Stack from '@mui/material/Stack'

import { ROLES } from '@/constants/roles'
import InfoCtaBand from '@/features/staticPages/components/InfoCtaBand'
import InfoSection from '@/features/staticPages/components/InfoSection'
import useApiQuery from '@/hooks/useApiQuery'
import useDocumentTitle from '@/hooks/useDocumentTitle'
import { paths } from '@/routes/paths'
import { SETTINGS_FALLBACK, settingsService } from '@/services'
import { formatCurrency } from '@/utils/formatters'

import WalletBenefits from '../components/WalletBenefits'
import WalletExample from '../components/WalletExample'
import WalletFaq from '../components/WalletFaq'
import WalletHero from '../components/WalletHero'
import WalletSteps from '../components/WalletSteps'
import { WALLET_CTA } from '../content/wallet'
import { buildWalletExample, WALLET_EXAMPLE_INPUT } from '../utils/walletExample'

// **Wallet** — how paying for an order on BetterBlue actually works (V2-10).
//
// This replaces the V2-02 stub. It is an *explainer*: there is no balance on
// this page, no top-up button, and no call into the payment providers. The one
// request it makes is for the platform's currency, so the worked example is
// denominated the way Pricing's is — `settingsService` caches its response, so
// arriving here from Pricing costs nothing. A failure falls back to the bundled
// default silently: the currency symbol is the only thing at stake, and a
// warning banner over a teaching example would be noise.
//
// Layout is the information-page shell taken apart: the hero is full-bleed so
// its `AmbientGlow` can reach the edges of the viewport, and the sections below
// sit in the same `lg` container the other storefront pages use. `InfoSection`
// and `InfoCtaBand` come from `staticPages` so this page's headings and closing
// panel are the ones How It Works and Pricing already have (00 §16.4).

export default function WalletPage() {
  useDocumentTitle('Wallet')

  const { data, error } = useApiQuery(() => settingsService.getSettings(), [])

  const settings = data ?? (error ? SETTINGS_FALLBACK : null)
  const currency = settings?.general?.currency ?? SETTINGS_FALLBACK.general.currency

  const { shortfall } = buildWalletExample(WALLET_EXAMPLE_INPUT)

  const money = (amount) => formatCurrency(amount, currency, { hideDecimals: true })

  return (
    <>
      <WalletHero />

      <Container maxWidth="lg" sx={{ px: { xs: 2, md: 4 }, pb: { xs: 8, md: 12 } }}>
        <Stack spacing={{ xs: 5, md: 7 }}>
          <InfoSection
            id="how-the-wallet-works"
            title="How the wallet works"
            description="Four steps, from signing in to a funded order. Nothing is charged until you accept work you want to go ahead with."
          >
            <WalletSteps />
          </InfoSection>

          <InfoSection
            id="worked-example"
            title="A worked example"
            description={`A ${money(WALLET_EXAMPLE_INPUT.orderTotal)} order against a ${money(
              WALLET_EXAMPLE_INPUT.openingBalance
            )} balance — ${money(shortfall)} short, so a payment link covers the difference.`}
          >
            <WalletExample currency={currency} />
          </InfoSection>

          <InfoSection
            id="why-a-wallet"
            title="Why a wallet"
            description="One funded balance behind every order, instead of a payment step per brief."
          >
            <WalletBenefits />
          </InfoSection>

          <InfoSection
            id="wallet-questions"
            title="Wallet questions"
            description="The three that come up first. Orders, escrow, and fees are covered in full on How It Works and Pricing."
          >
            <WalletFaq />
          </InfoSection>

          {/* Both CTAs are the storefront's, not a member's: `registerAs` opens
              the register form with "buyer" already chosen (V2-06), and a
              signed-in visitor who presses it is sent on by `GuestRoute`
              exactly as they are from the home page's pair. */}
          <InfoCtaBand
            title={WALLET_CTA.title}
            description={WALLET_CTA.description}
            primary={{
              label: 'Register as a Buyer',
              to: paths.registerAs(ROLES.BUYER),
              icon: 'tabler:building-store',
            }}
            secondary={{ label: 'See pricing', to: paths.PRICING, icon: 'tabler:receipt' }}
          />
        </Stack>
      </Container>
    </>
  )
}
