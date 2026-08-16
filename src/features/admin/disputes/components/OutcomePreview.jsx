import Box from '@mui/material/Box'
import Skeleton from '@mui/material/Skeleton'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { alpha } from '@mui/material/styles'

import { DISPUTE_RESOLUTION } from '@/constants/statuses'
import { EMPTY_PLACEHOLDER, formatCurrency, formatPercent } from '@/utils/formatters'

// What an outcome does to the money, stated in full — Prompt 33 §4.4.
//
// **Nothing here calculates anything.** Every figure comes from
// `paymentService.previewSettlement`, which prices a settlement with the same
// rate resolution and the same rounding the release itself uses — the order's
// frozen `commissionRate` first (`docs/payments.md` §6). A preview computed in
// this component could quote a rate the settlement would not charge, and the
// one screen where that must never happen is the one issuing binding decisions.
//
// Each figure is a **labelled line of text**, not a chart or a bar: an admin
// about to move somebody's money reads the numbers, and a screen reader has to
// be able to read them out in the same order (§12).

/** One labelled amount. `tone` is the eye's only hint; the label carries the meaning. */
function MoneyLine({ label, value, currency, tone = 'default', hint, strong = false }) {
  const color =
    tone === 'positive' ? 'success.dark' : tone === 'negative' ? 'text.primary' : 'text.primary'

  return (
    <Stack
      direction="row"
      spacing={2}
      justifyContent="space-between"
      alignItems="baseline"
      sx={{ py: 0.5 }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="body2" color="text.secondary">
          {label}
        </Typography>
        {hint ? (
          <Typography variant="caption" color="text.secondary" component="p">
            {hint}
          </Typography>
        ) : null}
      </Box>
      <Typography
        variant="body2"
        sx={{
          color,
          fontWeight: strong ? 800 : 600,
          fontVariantNumeric: 'tabular-nums',
          whiteSpace: 'nowrap',
        }}
      >
        {Number.isFinite(Number(value)) ? formatCurrency(value, currency) : EMPTY_PLACEHOLDER}
      </Typography>
    </Stack>
  )
}

/**
 * @param {object} props
 * @param {string} props.outcome a `DISPUTE_RESOLUTION` value
 * @param {object} [props.preview] a `paymentService.previewSettlement` result
 * @param {boolean} [props.isLoading=false]
 * @param {boolean} [props.dense=false] the compact form used inside an outcome
 *   card, where the split matters more than the labels around it
 */
export default function OutcomePreview({ outcome, preview, isLoading = false, dense = false }) {
  const currency = preview?.currency
  const held = preview?.held

  if (isLoading && !preview) {
    return <Skeleton variant="rounded" height={dense ? 44 : 108} />
  }

  const lines = () => {
    switch (outcome) {
      case DISPUTE_RESOLUTION.RELEASE_PAYMENT:
        return [
          { label: 'Buyer receives', value: 0, key: 'buyer' },
          {
            label: 'Creator receives',
            value: preview?.creatorEarnings,
            tone: 'positive',
            strong: true,
            key: 'creator',
            hint: `After the ${formatPercent(preview?.rate ?? 0, {
              maximumFractionDigits: 1,
            })} BetterBlue commission (${formatCurrency(preview?.commissionAmount, currency)}).`,
          },
        ]
      case DISPUTE_RESOLUTION.FULL_REFUND:
        return [
          {
            label: 'Buyer receives',
            value: held,
            tone: 'positive',
            strong: true,
            key: 'buyer',
            hint: 'Back to the card it was paid with. Card refunds settle in a few working days.',
          },
          {
            label: 'Creator receives',
            value: 0,
            key: 'creator',
            hint: 'BetterBlue earns no commission on money it gave back.',
          },
        ]
      case DISPUTE_RESOLUTION.PARTIAL_REFUND:
        return [
          { label: 'Buyer receives', value: preview?.refundedAmount, tone: 'positive', strong: true, key: 'buyer' },
          {
            label: 'Creator receives',
            value: preview?.creatorEarnings,
            tone: 'positive',
            strong: true,
            key: 'creator',
            hint: `Commission is charged only on the ${formatCurrency(
              preview?.baseAmount,
              currency
            )} retained — ${formatCurrency(preview?.commissionAmount, currency)} at ${formatPercent(
              preview?.rate ?? 0,
              { maximumFractionDigits: 1 }
            )}.`,
          },
        ]
      default:
        return []
    }
  }

  const rows = lines()

  return (
    <Box
      // `role="status"` so a reader who moves the slider hears the split change
      // rather than having to go hunting for it (§12).
      role="status"
      aria-live="polite"
      sx={{
        p: dense ? 1.25 : 1.75,
        borderRadius: 2,
        border: 1,
        borderColor: (theme) => alpha(theme.palette.success.main, 0.22),
        bgcolor: (theme) => alpha(theme.palette.success.main, 0.06),
        opacity: isLoading ? 0.65 : 1,
        transition: (theme) => theme.transitions.create('opacity'),
      }}
    >
      {!dense ? (
        <Typography variant="caption" color="text.secondary" component="p" sx={{ mb: 0.5 }}>
          {Number.isFinite(Number(held))
            ? `${formatCurrency(held, currency)} is held on this order.`
            : 'Reading the escrow on this order…'}
        </Typography>
      ) : null}

      {rows.map(({ key, ...row }) => (
        <MoneyLine key={key} {...row} currency={currency} />
      ))}
    </Box>
  )
}
