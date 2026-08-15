import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import Skeleton from '@mui/material/Skeleton'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { alpha } from '@mui/material/styles'

import useDebounce from '@/hooks/useDebounce'
import { formatCurrency, formatPercent } from '@/utils/formatters'

import useCommission from '../hooks/useCommission'

// "You'll receive ≈ $X" — the line that turns a quoted price into take-home pay
// while the creator is still typing it.
//
// The arithmetic lives in `useCommission`, which reads the live platform rate
// through `paymentService.computeCommission` (Prompt 17). This component only
// decides how to say it.
//
// The price is debounced rather than priced per keystroke; `useApiQuery` keeps
// the previous result while the next resolves, so the line never blinks back to
// a skeleton mid-edit.

/** Quiet period before a typed price is priced. */
const QUOTE_DELAY_MS = 250

/**
 * @param {object} props
 * @param {number|string} props.price the quoted amount as typed
 * @param {string} [props.categoryId] `cat_…` — a category override beats the default rate
 * @param {string} [props.creatorId] `usr_…` — reserved for per-creator rates (Prompt 35)
 * @param {string} [props.currency] the brief's currency
 */
export default function EarningsPreview({ price, categoryId, creatorId, currency }) {
  const debouncedPrice = useDebounce(price, QUOTE_DELAY_MS)
  const { rate, commission, net, isLoading, isPriced } = useCommission(debouncedPrice, {
    categoryId,
    creatorId,
  })

  const money = (value) => formatCurrency(value, currency)

  const body = () => {
    if (!isPriced) {
      return 'Enter a price and we will show what reaches you after the BetterBlue commission.'
    }
    if (net === null) {
      return isLoading ? null : 'We could not read the commission rate just now.'
    }

    return (
      <>
        You’ll receive{' '}
        <Box component="strong" sx={{ color: 'success.dark', fontWeight: 700 }}>
          ≈ {money(net)}
        </Box>{' '}
        after the {formatPercent(rate, { maximumFractionDigits: 1 })} BetterBlue commission (
        {money(commission)}).
      </>
    )
  }

  const content = body()

  return (
    <Stack
      direction="row"
      spacing={1.25}
      alignItems="flex-start"
      // `role="status"` + `aria-live` so a screen reader hears the take-home
      // figure update rather than having to hunt for it after every edit.
      role="status"
      aria-live="polite"
      sx={{
        p: 1.5,
        borderRadius: 2,
        bgcolor: (theme) => alpha(theme.palette.success.main, 0.07),
        border: 1,
        borderColor: (theme) => alpha(theme.palette.success.main, 0.22),
      }}
    >
      <Box sx={{ color: 'success.main', display: 'flex', pt: '2px' }}>
        <Icon icon="solar:wallet-money-linear" width={20} aria-hidden="true" />
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ minWidth: 0 }}>
        {content ?? <Skeleton variant="text" width={260} />}
      </Typography>
    </Stack>
  )
}
