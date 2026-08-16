import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Stack from '@mui/material/Stack'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import { alpha } from '@mui/material/styles'

import StatCard from '@/components/data-display/StatCard'
import StatSkeleton from '@/components/feedback/skeletons/StatSkeleton'
import { formatCurrency } from '@/utils/formatters'

// The four figures a creator's money divides into, and the one button that
// moves any of it.
//
// Three of them are ordinary `StatCard`s. **Available to withdraw** is not: it
// is the only number on the screen that is also an action, so it gets its own
// accent card with the primary button inside it, rather than a tile that looks
// identical to the three around it and hides the button somewhere else.
//
// Every amount arrives already computed by `paymentService.getEarningsBreakdown`
// (Prompt 25 §7). Nothing here adds, subtracts, or rounds anything — it decides
// type size and tone.

/** Financial figures are set in tabular numerals so columns of them line up. */
const MONEY_SX = { fontVariantNumeric: 'tabular-nums' }

/**
 * The accent card. Deliberately not a `StatCard`: the tile is a link surface
 * and this one holds a button, which cannot be nested inside a `CardActionArea`.
 */
function AvailableCard({ amount, currency, pendingPayouts, canWithdraw, withdrawHint, onWithdraw }) {
  const button = (
    <Box component="span" sx={{ display: 'inline-flex', width: { xs: '100%', sm: 'auto' } }}>
      <Button
        variant="contained"
        onClick={onWithdraw}
        disabled={!canWithdraw}
        startIcon={<Icon icon="solar:card-transfer-linear" width={18} aria-hidden="true" />}
        sx={{ minHeight: 44, width: { xs: '100%', sm: 'auto' } }}
      >
        Withdraw
      </Button>
    </Box>
  )

  return (
    <Card
      sx={{
        height: '100%',
        borderColor: (theme) => alpha(theme.palette.success.main, 0.35),
        bgcolor: (theme) => alpha(theme.palette.success.main, 0.06),
      }}
    >
      <CardContent sx={{ p: 3, '&:last-child': { pb: 3 } }}>
        <Stack direction="row" spacing={2} alignItems="flex-start">
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Typography variant="overline" component="p" color="text.secondary">
              Available to withdraw
            </Typography>
            <Typography
              variant="h4"
              component="p"
              sx={{ ...MONEY_SX, mt: 0.5, color: 'success.dark', wordBreak: 'break-word' }}
            >
              {formatCurrency(amount, currency)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {pendingPayouts > 0
                ? `${formatCurrency(pendingPayouts, currency)} already requested and not counted here`
                : 'Released earnings, ready to send to your bank'}
            </Typography>
          </Box>

          <Box
            aria-hidden="true"
            sx={{
              flexShrink: 0,
              width: 44,
              height: 44,
              borderRadius: 2,
              display: 'grid',
              placeItems: 'center',
              bgcolor: (theme) => alpha(theme.palette.success.main, 0.14),
              color: 'success.dark',
            }}
          >
            <Icon icon="solar:wallet-money-linear" width={22} />
          </Box>
        </Stack>

        <Box sx={{ mt: 2 }}>
          {withdrawHint ? (
            // Wrapped, because a disabled button fires no pointer events and a
            // tooltip on it would never open (00 §13).
            <Tooltip title={withdrawHint}>{button}</Tooltip>
          ) : (
            button
          )}
        </Box>
      </CardContent>
    </Card>
  )
}

/**
 * @param {object} props
 * @param {object} [props.summary] `getEarningsSummary`'s four figures
 * @param {string} [props.currency] ISO 4217 code for every amount shown
 * @param {boolean} [props.loading=false] render skeleton tiles instead
 * @param {boolean} [props.canWithdraw=false] is the Withdraw button live?
 * @param {string} [props.withdrawHint] tooltip explaining a disabled button —
 *   no payout method, or nothing available
 * @param {() => void} props.onWithdraw opens the withdraw dialog
 */
export default function EarningsSummaryCards({
  summary,
  currency,
  loading = false,
  canWithdraw = false,
  withdrawHint,
  onWithdraw,
}) {
  const money = (amount) => formatCurrency(amount, currency)

  return (
    <Box
      sx={{
        display: 'grid',
        gap: { xs: 2, md: 3 },
        // 2×2 on a phone (§11), one band of four from `md` up.
        gridTemplateColumns: {
          xs: 'repeat(2, minmax(0, 1fr))',
          md: 'repeat(4, minmax(0, 1fr))',
        },
      }}
    >
      {loading ? (
        Array.from({ length: 4 }, (unused, index) => <StatSkeleton key={index} />)
      ) : (
        <>
          {/* The tooltip carries the fuller sentence, and the tile carries the
              short version in visible text — so the qualification that matters
              most on this screen is never hover-only (00 §13). The wrapper is
              focusable for the same reason: a tooltip a keyboard cannot open is
              a tooltip half the people who need it will never see. */}
          <Tooltip title="Escrow on orders still in flight. Nothing here is yours until the buyer accepts your delivery.">
            <Box
              tabIndex={0}
              sx={{
                height: '100%',
                borderRadius: 4,
                '&:focus-visible': {
                  outline: (theme) => `2px solid ${theme.palette.primary.main}`,
                  outlineOffset: 2,
                },
              }}
            >
              <StatCard
                label="In escrow"
                value={<Box component="span" sx={MONEY_SX}>{money(summary?.held)}</Box>}
                icon="solar:lock-keyhole-linear"
                iconTone="info"
                deltaLabel="Released when buyers approve"
                sx={{ height: '100%' }}
              />
            </Box>
          </Tooltip>

          <AvailableCard
            amount={summary?.available ?? 0}
            currency={currency}
            pendingPayouts={summary?.pendingPayouts ?? 0}
            canWithdraw={canWithdraw}
            withdrawHint={withdrawHint}
            onWithdraw={onWithdraw}
          />

          <StatCard
            label="Paid out"
            value={<Box component="span" sx={MONEY_SX}>{money(summary?.paidOut)}</Box>}
            icon="solar:banknote-2-linear"
            iconTone="brand"
            deltaLabel="Settled to your bank"
          />

          <StatCard
            label="Lifetime earnings"
            value={<Box component="span" sx={MONEY_SX}>{money(summary?.lifetime)}</Box>}
            icon="solar:chart-2-linear"
            iconTone="success"
            deltaLabel="Every release, after commission"
          />
        </>
      )}
    </Box>
  )
}
