import { Icon } from '@iconify/react'
import Alert from '@mui/material/Alert'
import AlertTitle from '@mui/material/AlertTitle'
import Button from '@mui/material/Button'
import { Link as RouterLink } from 'react-router-dom'

import { ORDER_STATUS } from '@/constants/statuses'
import useApiQuery from '@/hooks/useApiQuery'
import { paths } from '@/routes/paths'
import { orderService } from '@/services/orderService'
import { formatCurrency, formatNumber } from '@/utils/formatters'

// The way back into an abandoned checkout.
//
// Leaving the checkout screen writes nothing — that is the point of the design
// (`docs/payments.md` §4: the order simply stays `pending_payment`, and a stale
// `processing` attempt does not block a retry). The cost of that safety is that
// an awarded order can sit unfunded and invisible, with a creator waiting on a
// payment nobody has told the buyer is outstanding. This banner is the other
// half of the bargain.
//
// It runs **one list query of its own** rather than being threaded through the
// pages that show it: the requests list is paginated and filtered by tab, so an
// unpaid order on page three would otherwise never raise its hand. Cheap
// (`pending_payment` is a small set, capped below) and correct regardless of
// what the page around it happens to be showing.
//
// Rendered on `BuyerRequestsPage` and on the dashboard overview. Renders
// nothing at all when there is nothing outstanding.

/**
 * How many unpaid orders to fetch. More than a couple is already unusual; the
 * banner names the first and counts the rest.
 */
const UNPAID_LIMIT = 5

/**
 * @param {object} props
 * @param {string} props.buyerId `usr_…` — the signed-in buyer
 * @param {object} [props.sx] MUI system styles
 */
export default function UnpaidOrderBanner({ buyerId, sx }) {
  const { data } = useApiQuery(
    () =>
      orderService.listByBuyer(buyerId, {
        page: 1,
        limit: UNPAID_LIMIT,
        filters: { status: ORDER_STATUS.PENDING_PAYMENT },
      }),
    [buyerId],
    { enabled: Boolean(buyerId) }
  )

  const unpaid = data?.items ?? []
  const [next] = unpaid

  // No banner while it loads and none when there is nothing to say: a slot that
  // appears and disappears above a list is worse than one that arrives late.
  if (!next) return null

  const others = unpaid.length - 1

  return (
    <Alert
      severity="warning"
      icon={<Icon icon="solar:wallet-money-linear" width={22} />}
      action={
        <Button
          component={RouterLink}
          to={paths.buyerCheckout(next.id)}
          size="small"
          variant="contained"
          color="warning"
          sx={{ whiteSpace: 'nowrap' }}
        >
          Complete payment
        </Button>
      }
      sx={{ alignItems: 'center', ...sx }}
    >
      <AlertTitle sx={{ mb: 0.25 }}>
        {others > 0
          ? `${formatNumber(unpaid.length)} orders are waiting for payment`
          : 'An order is waiting for payment'}
      </AlertTitle>
      “{next.title}” was awarded and needs {formatCurrency(next.price, next.currency)} paid into
      escrow before the creator can start
      {others > 0
        ? `, along with ${formatNumber(others)} other${others === 1 ? '' : 's'}.`
        : '.'}
    </Alert>
  )
}
