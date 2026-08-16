import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Stack from '@mui/material/Stack'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'

import PaginationControl from '@/components/data-display/PaginationControl'
import StatusChip from '@/components/data-display/StatusChip'
import EmptyState from '@/components/feedback/EmptyState'
import ErrorState from '@/components/feedback/ErrorState'
import ListSkeleton from '@/components/feedback/skeletons/ListSkeleton'
import { PAYOUT_STATUS } from '@/constants/statuses'
import PayoutMethodCard from '@/features/earnings/components/PayoutMethodCard'
import { formatCurrency, formatDate } from '@/utils/formatters'

// Where the money goes, and what happened to every request that has gone there.
//
// A payout is the one record on this screen whose state a creator cannot
// influence — it is a queue their bank details sit in until finance processes it
// (`docs/payments.md` §5) — so the list is deliberately plain and the rejection
// reason is never hidden behind a click: an unexplained "Rejected" chip is the
// single most alarming thing this product could show a creator.

/** One settlement request. Rendered as a list item, not a table: four facts, no columns. */
function PayoutRow({ payout }) {
  const isRejected = payout.status === PAYOUT_STATUS.REJECTED

  return (
    <Card component="li" variant="outlined">
      <CardContent sx={{ p: { xs: 2, md: 2.5 }, '&:last-child': { pb: { xs: 2, md: 2.5 } } }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={{ xs: 1.5, sm: 2 }}
          justifyContent="space-between"
          alignItems={{ xs: 'flex-start', sm: 'center' }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography
              variant="h6"
              component="p"
              sx={{ fontSize: '1.125rem', fontVariantNumeric: 'tabular-nums' }}
            >
              {formatCurrency(payout.amount, payout.currency)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Requested {formatDate(payout.requestedAt)}
              {payout.processedAt ? ` · Processed ${formatDate(payout.processedAt)}` : ''}
              {payout.method?.accountMasked ? ` · to ${payout.method.accountMasked}` : ''}
            </Typography>
          </Box>

          <Box sx={{ flexShrink: 0 }}>
            {isRejected && payout.rejectedReason ? (
              <Tooltip title={payout.rejectedReason}>
                <Box component="span">
                  <StatusChip status={payout.status} size="sm" />
                </Box>
              </Tooltip>
            ) : (
              <StatusChip status={payout.status} size="sm" tooltip />
            )}
          </Box>
        </Stack>

        {/* The reason is printed as well as tooltipped: colour and hover are
            never the only carriers of something this consequential (00 §13). */}
        {isRejected && payout.rejectedReason ? (
          <Stack direction="row" spacing={1.25} alignItems="flex-start" sx={{ mt: 1.5 }}>
            <Box aria-hidden="true" sx={{ display: 'flex', color: 'error.main', pt: '2px' }}>
              <Icon icon="solar:info-circle-linear" width={18} />
            </Box>
            <Typography variant="body2" color="text.secondary">
              {payout.rejectedReason}
            </Typography>
          </Stack>
        ) : null}
      </CardContent>
    </Card>
  )
}

/**
 * @param {object} props
 * @param {object|null} [props.method] the creator's stored payout method
 * @param {boolean} [props.methodLoading=false]
 * @param {object[]} [props.payouts] the current page of settlement requests
 * @param {number} [props.total] settlements matching the query, for paging
 * @param {number} props.page current page
 * @param {number} props.pageSize rows per page
 * @param {(page: number) => void} props.onPageChange
 * @param {boolean} [props.loading=false]
 * @param {object} [props.error]
 * @param {() => void} [props.onRetry]
 * @param {boolean} [props.canWithdraw=false]
 * @param {string} [props.withdrawHint] why the button is disabled, if it is
 * @param {() => void} props.onWithdraw
 */
export default function PayoutsTab({
  method,
  methodLoading = false,
  payouts = [],
  total = 0,
  page,
  pageSize,
  onPageChange,
  loading = false,
  error,
  onRetry,
  canWithdraw = false,
  withdrawHint,
  onWithdraw,
}) {
  const withdrawButton = (
    <Box component="span" sx={{ display: 'inline-flex' }}>
      <Button
        variant="contained"
        onClick={onWithdraw}
        disabled={!canWithdraw}
        startIcon={<Icon icon="solar:card-transfer-linear" width={18} aria-hidden="true" />}
        sx={{ minHeight: 44 }}
      >
        Withdraw
      </Button>
    </Box>
  )

  return (
    <Stack spacing={{ xs: 2, md: 3 }}>
      <PayoutMethodCard method={method} loading={methodLoading} />

      <Box>
        <Stack
          direction="row"
          spacing={2}
          alignItems="center"
          justifyContent="space-between"
          sx={{ mb: 2 }}
        >
          <Typography variant="h6" component="h2" sx={{ fontSize: '1.0625rem' }}>
            Payout history
          </Typography>
          {withdrawHint ? (
            <Tooltip title={withdrawHint}>{withdrawButton}</Tooltip>
          ) : (
            withdrawButton
          )}
        </Stack>

        {error ? (
          <ErrorState
            title="We could not load your payouts"
            message="Your balance is safe — this list just needs another go."
            error={error}
            onRetry={onRetry}
          />
        ) : loading ? (
          <ListSkeleton rows={3} avatar={false} label="Loading your payouts" />
        ) : payouts.length === 0 ? (
          <EmptyState
            icon="solar:banknote-2-linear"
            title="No payouts yet"
            description="Release earnings by completing orders — once a buyer accepts your delivery, the escrow lands in your balance and you can withdraw it."
          />
        ) : (
          <>
            <Stack component="ul" spacing={2} sx={{ listStyle: 'none', m: 0, p: 0 }}>
              {payouts.map((payout) => (
                <PayoutRow key={payout.id} payout={payout} />
              ))}
            </Stack>

            <PaginationControl
              page={page}
              pageSize={pageSize}
              total={total}
              onPageChange={onPageChange}
              itemLabel="payouts"
              hideOnSinglePage
            />
          </>
        )}
      </Box>
    </Stack>
  )
}
