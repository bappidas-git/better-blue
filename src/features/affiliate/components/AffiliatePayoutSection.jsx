import { useEffect, useState } from 'react'

import { Icon } from '@iconify/react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Divider from '@mui/material/Divider'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { alpha } from '@mui/material/styles'

import PaginationControl from '@/components/data-display/PaginationControl'
import StatusChip from '@/components/data-display/StatusChip'
import EmptyState from '@/components/feedback/EmptyState'
import ResponsiveDialog from '@/components/layout/ResponsiveDialog'
import { formatCurrency, formatDate } from '@/utils/formatters'

// Requesting referral commission, and the history of every request — Prompt 34
// §4.3, following the shape of Prompt 25's `WithdrawDialog`: the balance first,
// the destination spelled out, one confirm, and a success state that stays put
// to say "requested" is not "paid".
//
// **There is no amount field, and that is a decision rather than an omission.**
// A creator's balance is one fungible number they can take any slice of; an
// affiliate's is a set of discrete commission records that were each approved
// individually and each settle whole. A part-payment would leave a payout that
// no set of earnings adds up to, and the table above this card would stop
// reconciling with the total on it. So a request always takes the whole approved
// balance — which is also the only amount `affiliateService.requestAffiliatePayout`
// will accept, and it re-derives that balance itself rather than trusting this
// screen (§13: every bound is checked twice and computed once).

/** One settlement request. A list item, not a table: four facts, no columns. */
function PayoutRow({ payout }) {
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
              {payout.processedAt ? ` · processed ${formatDate(payout.processedAt)}` : ''}
            </Typography>
          </Box>
          <Box sx={{ flexShrink: 0 }}>
            <StatusChip status={payout.status} size="sm" tooltip />
          </Box>
        </Stack>

        {payout.rejectedReason ? (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
            {payout.rejectedReason}
          </Typography>
        ) : null}
      </CardContent>
    </Card>
  )
}

/** The confirm-and-done dialog. Kept local: nothing else requests one of these. */
function AffiliateWithdrawDialog({ open, onClose, balance, onConfirm, isSubmitting }) {
  const [serverError, setServerError] = useState(null)
  const [requested, setRequested] = useState(null)

  // Every open starts from a clean sheet: a stale error or a previous success
  // card would both be worse than an empty dialog.
  useEffect(() => {
    if (!open) return
    setServerError(null)
    setRequested(null)
  }, [open])

  const handleConfirm = async () => {
    setServerError(null)
    try {
      setRequested(await onConfirm())
    } catch (failure) {
      setServerError({
        message: failure?.message ?? 'We could not request that payout.',
        detail: failure?.details?.amount,
      })
    }
  }

  const actions = requested ? (
    <Button variant="contained" onClick={onClose} sx={{ minHeight: 44 }}>
      Done
    </Button>
  ) : (
    <>
      <Button color="inherit" onClick={onClose} disabled={isSubmitting} sx={{ minHeight: 44 }}>
        Cancel
      </Button>
      <Button
        variant="contained"
        onClick={handleConfirm}
        disabled={isSubmitting || !balance?.canRequest}
        sx={{ minHeight: 44 }}
      >
        {isSubmitting ? 'Requesting…' : 'Request payout'}
      </Button>
    </>
  )

  return (
    <ResponsiveDialog
      open={open}
      onClose={isSubmitting ? undefined : onClose}
      title={requested ? 'Payout requested' : 'Request your commission'}
      description={
        requested
          ? undefined
          : 'Affiliate payouts are reviewed by our finance team before the money is sent.'
      }
      actions={actions}
    >
      {requested ? (
        <Stack spacing={2} alignItems="flex-start">
          <Box
            aria-hidden="true"
            sx={{
              width: 48,
              height: 48,
              borderRadius: 2,
              display: 'grid',
              placeItems: 'center',
              color: 'success.dark',
              bgcolor: (theme) => alpha(theme.palette.success.main, 0.12),
            }}
          >
            <Icon icon="solar:check-circle-linear" width={26} />
          </Box>
          <Box>
            <Typography variant="h6" component="p" sx={{ fontVariantNumeric: 'tabular-nums' }}>
              {formatCurrency(requested.amount, requested.currency)}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Payout requested — reviewed by our finance team, typically within 3 business days. It
              shows as <strong>Requested</strong> below until it settles, and the commission behind
              it is marked paid once the transfer has gone out.
            </Typography>
          </Box>
        </Stack>
      ) : (
        <Stack spacing={2.5}>
          <Box
            sx={{
              p: 2,
              borderRadius: 2,
              bgcolor: (theme) => alpha(theme.palette.success.main, 0.08),
              border: 1,
              borderColor: (theme) => alpha(theme.palette.success.main, 0.22),
            }}
          >
            <Typography variant="overline" component="p" color="text.secondary">
              Approved and ready to pay
            </Typography>
            <Typography
              variant="h5"
              component="p"
              sx={{ fontVariantNumeric: 'tabular-nums', color: 'success.dark' }}
            >
              {formatCurrency(balance?.available ?? 0, balance?.currency)}
            </Typography>
          </Box>

          {serverError?.message ? (
            <Alert severity="error">
              {serverError.message}
              {serverError.detail ? ` ${serverError.detail}` : ''}
            </Alert>
          ) : null}

          <Typography variant="body2" color="text.secondary">
            Approved commission is paid out in full, so this request covers your whole balance.
            Anything still pending review stays where it is and can be requested once it is
            approved.
          </Typography>

          <Divider />

          <Stack direction="row" spacing={1.5} alignItems="flex-start">
            <Box aria-hidden="true" sx={{ display: 'flex', color: 'text.secondary', mt: 0.25 }}>
              <Icon icon="solar:card-linear" width={22} />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="caption" color="text.secondary" component="p">
                Sending to
              </Typography>
              <Typography variant="body2">
                {balance?.method?.accountMasked
                  ? `Bank account ${balance.method.accountMasked}`
                  : 'The payout details on your account — our finance team confirms them with you before the transfer.'}
              </Typography>
            </Box>
          </Stack>
        </Stack>
      )}
    </ResponsiveDialog>
  )
}

/**
 * @param {object} props
 * @param {object} props.balance from `affiliateService.getPayoutBalance`
 * @param {object[]} [props.payouts] this affiliate's settlement requests
 * @param {() => Promise<object>} props.onRequest requests the payout
 * @param {boolean} [props.isSubmitting=false]
 * @param {boolean} [props.disabled=false] the affiliate account is suspended
 */
export default function AffiliatePayoutSection({
  balance,
  payouts = [],
  onRequest,
  isSubmitting = false,
  disabled = false,
}) {
  const [open, setOpen] = useState(false)
  const [page, setPage] = useState(1)
  const pageSize = 5

  const available = balance?.available ?? 0
  const minimum = balance?.minimum ?? 0
  const shortfall = Math.max(0, minimum - available)
  const visible = payouts.slice((page - 1) * pageSize, page * pageSize)

  return (
    <Stack spacing={{ xs: 2, md: 2.5 }}>
      <Card>
        <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={2}
            justifyContent="space-between"
            alignItems={{ xs: 'stretch', sm: 'center' }}
          >
            <Box>
              <Typography variant="overline" component="p" color="text.secondary">
                Available to request
              </Typography>
              <Typography
                variant="h4"
                component="p"
                sx={{ fontVariantNumeric: 'tabular-nums', color: 'success.dark' }}
              >
                {formatCurrency(available, balance?.currency)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Approved commission, less {formatCurrency(balance?.inFlight ?? 0, balance?.currency)}{' '}
                already requested. Minimum payout {formatCurrency(minimum, balance?.currency)}.
              </Typography>
            </Box>

            <Button
              variant="contained"
              size="large"
              disabled={disabled || !balance?.canRequest || isSubmitting}
              onClick={() => setOpen(true)}
              sx={{ minHeight: 48, flexShrink: 0 }}
              startIcon={<Icon icon="solar:wallet-money-linear" width={20} aria-hidden="true" />}
            >
              Request payout
            </Button>
          </Stack>

          {disabled ? (
            <Alert severity="warning" sx={{ mt: 2 }}>
              Payouts are paused while your affiliate account is suspended.
            </Alert>
          ) : shortfall > 0 && available > 0 ? (
            <Alert severity="info" sx={{ mt: 2 }}>
              {formatCurrency(shortfall, balance?.currency)} more approved commission and you can
              request a payout.
            </Alert>
          ) : null}
        </CardContent>
      </Card>

      {payouts.length === 0 ? (
        <EmptyState
          dense
          icon="solar:wallet-money-linear"
          title="No payouts yet"
          description="Once you request your approved commission, every request and its outcome is listed here."
        />
      ) : (
        <>
          <Stack component="ul" spacing={1.5} sx={{ listStyle: 'none', m: 0, p: 0 }}>
            {visible.map((payout) => (
              <PayoutRow key={payout.id} payout={payout} />
            ))}
          </Stack>
          <PaginationControl
            page={page}
            pageSize={pageSize}
            total={payouts.length}
            onPageChange={setPage}
            itemLabel="payouts"
          />
        </>
      )}

      <AffiliateWithdrawDialog
        open={open}
        onClose={() => setOpen(false)}
        balance={balance}
        onConfirm={onRequest}
        isSubmitting={isSubmitting}
      />
    </Stack>
  )
}
