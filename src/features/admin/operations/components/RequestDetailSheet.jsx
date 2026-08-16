import { useEffect, useState } from 'react'

import { Icon } from '@iconify/react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Divider from '@mui/material/Divider'
import Link from '@mui/material/Link'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'

import StatusChip from '@/components/data-display/StatusChip'
import CardSkeleton from '@/components/feedback/skeletons/CardSkeleton'
import { useConfirm } from '@/components/feedback/ConfirmDialogProvider'
import SideSheet from '@/components/layout/SideSheet'
import { REQUEST_STATUS } from '@/constants/statuses'
import { EntityRefChip } from '@/features/admin/shared'
import RequestBriefPanel from '@/features/requests/components/RequestBriefPanel'
import { paths } from '@/routes/paths'
import { formatDateTime, formatNumber } from '@/utils/formatters'

// One brief, read by an admin — Prompt 31 §4.1.
//
// The brief itself is `RequestBriefPanel`, the **same** component the buyer's
// detail page and the public board render (§7 — shared views are reused, never
// forked). What this sheet adds is what an admin needs and a creator does not:
// who posted it, how much interest it drew, and the one intervention available.
//
// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ There is no "Reopen".                                                     ║
// ║                                                                          ║
// ║ `REQUEST_STATUS_MACHINE` makes `closed` terminal (00 §9), and inventing a ║
// ║ transition for the console would put the admin screens and the state      ║
// ║ machine into disagreement about what a status means. A business that      ║
// ║ still wants the work posts the brief again — which is also the honest     ║
// ║ record, because every creator who proposed the first time was told it     ║
// ║ was over.                                                                ║
// ╚══════════════════════════════════════════════════════════════════════════╝

/**
 * @param {object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {object|null} props.request the brief
 * @param {object|null} [props.buyer] the business behind it
 * @param {string} [props.categoryLabel] resolved category name
 * @param {number} [props.proposalsCount] offers received
 * @param {boolean} [props.isLoading=false]
 * @param {boolean} [props.canManage=false] the reader holds `requests.manage`
 * @param {boolean} [props.boardEnabled=true] show the "View public" link
 * @param {(reason: string) => Promise<*>} props.onCloseRequest
 */
export default function RequestDetailSheet({
  open,
  onClose,
  request,
  buyer,
  categoryLabel,
  proposalsCount,
  isLoading = false,
  canManage = false,
  boardEnabled = true,
  onCloseRequest,
}) {
  const confirm = useConfirm()
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState(null)

  // A fresh error per brief: what went wrong closing one is never relevant to
  // the next one somebody opens.
  useEffect(() => {
    setFailure(null)
    setBusy(false)
  }, [request?.id])

  const isOpen = request?.status === REQUEST_STATUS.OPEN
  const offers = proposalsCount ?? request?.proposalsCount ?? 0

  const askToClose = async () => {
    const result = await confirm({
      title: 'Close this request?',
      message:
        `“${request.title}” stops being visible to creators immediately. ` +
        // Deliberately "still waiting" rather than a number: `proposalsCount`
        // is every offer ever received, and some are already declined or
        // withdrawn. Only the live ones are cascaded, and quoting the wrong
        // figure in a confirmation is worse than quoting none.
        (offers > 0
          ? `Every proposal still waiting on it — of ${formatNumber(offers)} received — is declined, and each of those creators is notified with your reason. `
          : 'No creator has proposed on it yet, so nobody is left waiting. ') +
        'The buyer is told too. This is final — a closed request cannot be reopened.',
      confirmLabel: 'Close request',
      cancelLabel: 'Leave it open',
      tone: 'danger',
      requireReason: true,
      reasonLabel: 'Why is BetterBlue closing this request?',
      reasonPlaceholder: 'e.g. Brief breaches the Content Policy on usage rights; buyer asked to withdraw it.',
      reasonHelperText: 'Read by the buyer and by every creator who proposed.',
    })
    if (!result) return

    setBusy(true)
    setFailure(null)
    try {
      await onCloseRequest?.(result.reason)
    } catch (error) {
      setFailure(error?.message ?? 'We could not close this request.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <SideSheet
      open={open}
      onClose={onClose}
      title={request?.title ?? 'Request'}
      description={request ? `Posted ${formatDateTime(request.publishedAt ?? request.createdAt)}` : undefined}
      width={520}
      actions={
        request && canManage && isOpen ? (
          <>
            <Button onClick={onClose} disabled={busy}>
              Close panel
            </Button>
            <Button
              variant="outlined"
              color="error"
              onClick={askToClose}
              disabled={busy}
              startIcon={<Icon icon="solar:clipboard-remove-linear" width={18} aria-hidden="true" />}
            >
              {busy ? 'Closing…' : 'Close request'}
            </Button>
          </>
        ) : (
          <Button onClick={onClose}>Close panel</Button>
        )
      }
    >
      {isLoading || !request ? (
        <CardSkeleton media={false} lines={6} label="Loading this request" />
      ) : (
        <Stack spacing={2.5}>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            <StatusChip status={request.status} size="sm" tooltip />
            <EntityRefChip type="request" id={request.id} label={request.id} />
            {buyer?.userId ? (
              <EntityRefChip
                type="user"
                id={buyer.userId}
                label={buyer.companyName ?? buyer.name}
              />
            ) : null}
          </Stack>

          <Box>
            <Typography variant="caption" color="text.secondary" component="p">
              Interest so far
            </Typography>
            <Typography variant="subtitle2" component="p" sx={{ mt: 0.25 }}>
              {offers === 0
                ? 'No proposals yet'
                : `${formatNumber(offers)} proposal${offers === 1 ? '' : 's'} received`}
            </Typography>
            {request.awardedProposalId ? (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                Awarded — this brief became an order.
              </Typography>
            ) : null}
          </Box>

          {request.closureReason ? (
            <Alert severity="info" variant="outlined">
              Closed{request.closedAt ? ` on ${formatDateTime(request.closedAt)}` : ''}: “
              {request.closureReason}”
            </Alert>
          ) : null}

          {boardEnabled && isOpen ? (
            <Link
              href={paths.requestDetail(request.id)}
              target="_blank"
              rel="noopener noreferrer"
              variant="body2"
              underline="hover"
              sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}
            >
              <Icon icon="solar:arrow-right-up-linear" width={16} aria-hidden="true" />
              View public
            </Link>
          ) : null}

          {failure ? <Alert severity="error">{failure}</Alert> : null}

          {canManage && isOpen ? (
            <Alert severity="warning" variant="outlined">
              Closing a brief is an administrative action. Prefer asking the buyer to close it
              themselves where the situation allows.
            </Alert>
          ) : null}

          <Divider />

          <RequestBriefPanel request={request} categoryLabel={categoryLabel} />
        </Stack>
      )}
    </SideSheet>
  )
}
