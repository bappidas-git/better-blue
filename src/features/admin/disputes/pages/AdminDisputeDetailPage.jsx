import { useCallback, useMemo, useState } from 'react'

import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'
import { useParams } from 'react-router-dom'

import StatusChip from '@/components/data-display/StatusChip'
import UserAvatar from '@/components/data-display/UserAvatar'
import ErrorState from '@/components/feedback/ErrorState'
import CardSkeleton from '@/components/feedback/skeletons/CardSkeleton'
import { useConfirm } from '@/components/feedback/ConfirmDialogProvider'
import { useToast } from '@/components/feedback/ToastProvider'
import StickyActionBar from '@/components/layout/StickyActionBar'
import { PERMISSIONS, hasPermission } from '@/constants/permissions'
import { ROLES } from '@/constants/roles'
import { DISPUTE_STATUS } from '@/constants/statuses'
import { useAuth } from '@/context/AuthContext'
import AdminThreadComposer from '@/features/admin/disputes/components/AdminThreadComposer'
import ContextRail from '@/features/admin/disputes/components/ContextRail'
import EscalateDialog from '@/features/admin/disputes/components/EscalateDialog'
import RequestInfoDialog from '@/features/admin/disputes/components/RequestInfoDialog'
import ResolveDialog from '@/features/admin/disputes/components/ResolveDialog'
import { DISPUTE_SLA, awaitingPartyLabel } from '@/features/admin/disputes/utils/disputeQueue'
import { shortId } from '@/features/admin/operations/utils/operationsFilters'
import { AdminPageGuard, AgeBadge, EntityRefChip } from '@/features/admin/shared'
import DisputeThread from '@/features/disputes/components/DisputeThread'
import ResolutionCard from '@/features/disputes/components/ResolutionCard'
import { categoryLabel, isSettled } from '@/features/disputes/utils/disputeDisplay'
import useApiQuery from '@/hooks/useApiQuery'
import DashboardPage from '@/layouts/dashboard/DashboardPage'
import { paths } from '@/routes/paths'
import { API_ERROR_CODE } from '@/services/api/apiError'
import {
  canAssignDispute,
  canCloseDispute,
  canEscalateDispute,
  canRequestInfo,
  canResolveDispute,
  disputeService,
} from '@/services/disputeService'
import { userService } from '@/services/userService'

// One case, from the reviewer's chair — Prompt 33 §4.3.
//
// Two columns at `lg`: the thread, which is the argument, and a context rail,
// which is the record. Below `lg` the rail folds into an accordion and moves
// **above** the thread — on a phone you check the money and the two accounts
// before you start reading, and a rail underneath a long thread is a rail
// nobody reaches (§11).
//
// **Internal notes are visible here and only here.** The same
// `disputeService.listMessages` the party screens call is asked for an admin
// role, and Prompt 26's `MessageBubble` marks what comes back — amber, and
// labelled in words. The leak test is the party screens, which ask with a party
// role and filter twice; nothing on this page changes what they get.
//
// The action bar is state-aware and reads its state from the service's own
// predicates (`canResolveDispute` and friends), which read it off
// `DISPUTE_STATUS_MACHINE`. A button is on screen exactly when the call behind
// it would succeed.

/** Who is on the case, in one line under the heading. */
function AssigneeLine({ assignee, resolvedBy }) {
  const person = resolvedBy ?? assignee
  if (!person) {
    return (
      <Typography variant="caption" color="text.secondary">
        Nobody has picked this up yet.
      </Typography>
    )
  }

  return (
    <Stack direction="row" spacing={0.75} alignItems="center">
      <UserAvatar name={person.name} src={person.avatarUrl} size="xs" />
      <Typography variant="caption" color="text.secondary">
        {resolvedBy ? 'Decided by' : 'Assigned to'} {person.name}
      </Typography>
    </Stack>
  )
}

export default function AdminDisputeDetailPage() {
  const { disputeId } = useParams()
  const { user: actor } = useAuth()
  const toast = useToast()
  const confirm = useConfirm()
  const theme = useTheme()
  const isCompact = useMediaQuery(theme.breakpoints.down('lg'))

  const canResolve = hasPermission(actor, PERMISSIONS.DISPUTES_RESOLVE)

  const [busy, setBusy] = useState(false)
  const [infoOpen, setInfoOpen] = useState(false)
  const [escalateOpen, setEscalateOpen] = useState(false)
  const [resolveOpen, setResolveOpen] = useState(false)

  // No `isLoading` here on purpose — see the skeleton branch in `body()`.
  const {
    data: context,
    error,
    refetch,
  } = useApiQuery(() => disputeService.getAdminCaseContext(disputeId), [disputeId], {
    enabled: Boolean(disputeId),
  })

  const dispute = context?.dispute
  const order = context?.order

  const {
    data: thread,
    isLoading: threadLoading,
    error: threadError,
    refetch: refetchThread,
  } = useApiQuery(
    // The admin role is what includes the internal notes — the party screens
    // pass their own role and never see one (contract §6.17).
    () => disputeService.listMessages(disputeId, { viewerRole: actor?.role }),
    [disputeId, actor?.role],
    { enabled: Boolean(disputeId) }
  )

  const messages = useMemo(() => thread?.items ?? [], [thread])

  // MOCK-JOIN: messages carry `authorId` only (00 §10 bans `_expand`), so the
  // names and avatars come from one batched follow-up. A failure leaves the
  // bubbles intact with a generic name rather than failing the page.
  const authorIds = useMemo(
    () => [...new Set(messages.map((message) => message.authorId).filter(Boolean))],
    [messages]
  )
  const { data: people } = useApiQuery(
    () =>
      userService
        .listByIds(authorIds)
        .then((accounts) => new Map(accounts.map((account) => [account.id, account])))
        .catch(() => new Map()),
    [authorIds.join(',')],
    { enabled: authorIds.length > 0 }
  )

  const reload = useCallback(() => {
    refetch()
    refetchThread()
  }, [refetch, refetchThread])

  /**
   * One failure handler for every action on the page. A `conflict` means the
   * case moved underneath the screen — somebody else picked it up, or a party
   * replied — so the page is refreshed and says so rather than leaving a stale
   * view the reviewer would act on again (§13).
   */
  const reportFailure = useCallback(
    (failure, fallback) => {
      if (failure?.code === API_ERROR_CODE.CONFLICT) {
        toast.error(failure.message, {
          description: 'This page was showing an older version of the case. It has been refreshed.',
        })
        reload()
        return
      }
      if (failure?.code === API_ERROR_CODE.SERVER_ERROR) {
        toast.error(failure.message, {
          description:
            'Check the order and the ledger before trying again — part of this may already have happened.',
        })
        reload()
        return
      }
      toast.error(failure?.message ?? fallback)
    },
    [reload, toast]
  )

  /* -- actions ------------------------------------------------------------- */

  const assignToMe = useCallback(async () => {
    setBusy(true)
    try {
      await disputeService.assign(disputeId, { adminId: actor?.id, actor })
      toast.success('You have this case.', { description: 'It is now under review.' })
      reload()
    } catch (failure) {
      reportFailure(failure, 'We could not assign this case.')
    } finally {
      setBusy(false)
    }
  }, [actor, disputeId, reload, reportFailure, toast])

  const requestInfo = useCallback(
    async ({ from, message }) => {
      try {
        await disputeService.requestInfo(disputeId, { from, message, actor })
        setInfoOpen(false)
        toast.success(`Asked the ${from} for more information.`, {
          description: 'The case parks with them until they reply.',
        })
        reload()
      } catch (failure) {
        reportFailure(failure, 'We could not send that request.')
        throw failure
      }
    },
    [actor, disputeId, reload, reportFailure, toast]
  )

  const escalate = useCallback(
    async ({ note }) => {
      try {
        await disputeService.escalate(disputeId, { note, actor })
        setEscalateOpen(false)
        toast.success('Case escalated.', {
          description: 'Everyone who can resolve disputes has been told.',
        })
        reload()
      } catch (failure) {
        reportFailure(failure, 'We could not escalate this case.')
        throw failure
      }
    },
    [actor, disputeId, reload, reportFailure, toast]
  )

  const resolve = useCallback(
    async ({ outcome, amountRefunded, note }) => {
      try {
        const result = await disputeService.resolve(disputeId, {
          outcome,
          amountRefunded,
          note,
          actor,
        })
        toast.success('Decision issued.', {
          description: 'The money has moved and both parties have been notified.',
        })
        reload()
        return result
      } catch (failure) {
        reportFailure(failure, 'We could not issue that decision.')
        throw failure
      }
    },
    [actor, disputeId, reload, reportFailure, toast]
  )

  const close = useCallback(async () => {
    const confirmed = await confirm({
      title: 'Close this case?',
      message:
        'The decision stays on record and both parties keep their copy of it. The thread is already closed to new messages — this files the case away.',
      confirmLabel: 'Close case',
      icon: 'solar:archive-linear',
    })
    if (!confirmed) return

    setBusy(true)
    try {
      await disputeService.close(disputeId, { actor })
      toast.success('Case closed.')
      reload()
    } catch (failure) {
      reportFailure(failure, 'We could not close this case.')
    } finally {
      setBusy(false)
    }
  }, [actor, confirm, disputeId, reload, reportFailure, toast])

  const postMessage = useCallback(
    async ({ body, attachments, internal }) => {
      try {
        await disputeService.postMessage(disputeId, {
          authorId: actor?.id,
          authorRole: actor?.role,
          body,
          attachments,
          internal,
        })
        reload()
      } catch (failure) {
        reportFailure(failure, 'We could not post that message.')
        // Rethrown so the composer keeps the draft (§13).
        throw failure
      }
    },
    [actor, disputeId, reload, reportFailure]
  )

  /* -- rendering ----------------------------------------------------------- */

  const body = () => {
    if (error && !dispute) {
      return (
        <ErrorState
          title="We could not open this case"
          message="It may have been removed, or the link may be wrong. Every other case is unaffected."
          error={error}
          onRetry={refetch}
        />
      )
    }
    // The skeleton is for the **first** load only. Every action on this page
    // refetches, and `useApiQuery` keeps the previous data while it does — so
    // branching on `isLoading` here would tear the workspace down mid-flow and
    // take any open dialog, and its state, with it. A refresh after a decision
    // must not close the dialog that just issued it.
    if (!dispute) {
      return <CardSkeleton media={false} lines={8} label="Loading this case" />
    }

    const settled = isSettled(dispute)
    const awaiting = awaitingPartyLabel(dispute)

    const actions = [
      canResolve && canAssignDispute(dispute) && dispute.assignedAdminId !== actor?.id
        ? {
            key: 'assign',
            label: 'Assign to me',
            icon: 'solar:user-check-linear',
            onClick: assignToMe,
            variant: 'outlined',
          }
        : null,
      canResolve && (canRequestInfo(dispute, ROLES.BUYER) || canRequestInfo(dispute, ROLES.CREATOR))
        ? {
            key: 'request-info',
            label: 'Request info',
            icon: 'solar:chat-round-dots-linear',
            onClick: () => setInfoOpen(true),
            variant: 'outlined',
          }
        : null,
      canResolve && canEscalateDispute(dispute)
        ? {
            key: 'escalate',
            label: 'Escalate',
            icon: 'solar:double-alt-arrow-up-linear',
            onClick: () => setEscalateOpen(true),
            variant: 'outlined',
          }
        : null,
      canResolve && canCloseDispute(dispute)
        ? {
            key: 'close',
            label: 'Close case',
            icon: 'solar:archive-linear',
            onClick: close,
            variant: 'outlined',
          }
        : null,
      canResolve && canResolveDispute(dispute)
        ? {
            key: 'resolve',
            label: 'Resolve',
            icon: 'solar:shield-check-linear',
            onClick: () => setResolveOpen(true),
            variant: 'contained',
            primary: true,
          }
        : null,
    ].filter(Boolean)

    const rail = <ContextRail context={context} collapsible={isCompact} />

    return (
      <>
        <Stack spacing={{ xs: 2, md: 2.5 }}>
          {settled ? (
            <ResolutionCard dispute={dispute} role={actor?.role} currency={order?.currency} />
          ) : null}

          <Box
            sx={{
              display: 'grid',
              gap: { xs: 2, md: 2.5 },
              gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 5fr) minmax(0, 3fr)' },
              alignItems: 'start',
            }}
          >
            {/* Source order flips below `lg`: the rail is read first on a
                phone and second on a desktop, and CSS `order` does it without
                rendering the panels twice. */}
            <Box sx={{ minWidth: 0, order: { xs: 2, lg: 1 } }}>
              <Stack spacing={{ xs: 2, md: 2.5 }}>
                <Card>
                  <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
                    <Stack
                      direction="row"
                      spacing={1}
                      alignItems="center"
                      justifyContent="space-between"
                      sx={{ mb: 2 }}
                    >
                      <Typography variant="subtitle2" component="h2">
                        Case thread
                      </Typography>
                      {awaiting ? (
                        <Typography
                          variant="caption"
                          sx={{ color: 'warning.dark', fontWeight: 700 }}
                        >
                          {awaiting}
                        </Typography>
                      ) : null}
                    </Stack>

                    <DisputeThread
                      messages={messages}
                      authors={people}
                      viewerId={actor?.id}
                      isLoading={threadLoading}
                      error={threadError}
                      onRetry={refetchThread}
                      label="Case thread, including internal notes"
                      emptyDescription="Nothing has been said on this case yet. Messages from both parties and the team appear here."
                    />
                  </CardContent>
                </Card>

                {canResolve ? (
                  <AdminThreadComposer
                    onSend={postMessage}
                    disabled={settled}
                    disabledReason={
                      dispute.status === DISPUTE_STATUS.CLOSED
                        ? 'This case is closed, so the thread no longer takes messages. It stays here as the record of what was decided.'
                        : 'A decision has been issued on this case, so the thread is closed. Close the case once both parties have read the outcome.'
                    }
                  />
                ) : null}
              </Stack>
            </Box>

            <Box sx={{ minWidth: 0, order: { xs: 1, lg: 2 } }}>{rail}</Box>
          </Box>
        </Stack>

        {/* No full-bleed negative margins on the bar: the page container's own
            gutters already frame it, and pulling it wider than its parent is
            what puts a horizontal scrollbar on a 360px screen (§11). */}
        {actions.length > 0 ? (
          <StickyActionBar sx={{ mt: { xs: 2, md: 2.5 }, borderRadius: 2 }}>
            {/* One wrapping child rather than four siblings: `StickyActionBar`
                lays its children out in a non-wrapping row, and four actions do
                not fit across 360px (§11). */}
            <Box
              sx={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 1.5,
                width: '100%',
                justifyContent: { xs: 'stretch', sm: 'flex-end' },
              }}
            >
              {actions.map((action) => (
                <Button
                  key={action.key}
                  variant={action.variant}
                  color={action.primary ? 'primary' : 'inherit'}
                  onClick={action.onClick}
                  disabled={busy}
                  startIcon={<Icon icon={action.icon} width={18} aria-hidden="true" />}
                  sx={{ flexGrow: { xs: 1, sm: 0 }, minHeight: 44 }}
                >
                  {action.label}
                </Button>
              ))}
            </Box>
          </StickyActionBar>
        ) : null}

        <RequestInfoDialog
          open={infoOpen}
          dispute={dispute}
          parties={{ buyer: context?.buyer?.user, creator: context?.creator?.user }}
          onClose={() => setInfoOpen(false)}
          onSubmit={requestInfo}
        />

        <EscalateDialog
          open={escalateOpen}
          onClose={() => setEscalateOpen(false)}
          onSubmit={escalate}
        />

        <ResolveDialog
          open={resolveOpen}
          dispute={dispute}
          order={order}
          onClose={() => setResolveOpen(false)}
          onResolve={resolve}
        />
      </>
    )
  }

  return (
    <DashboardPage
      title={dispute ? categoryLabel(dispute.category) : 'Dispute'}
      documentTitle={dispute ? `${categoryLabel(dispute.category)} · Dispute` : 'Dispute'}
      subtitle={dispute ? `${shortId(dispute.id)} · ${dispute.id}` : undefined}
      backTo={paths.ADMIN_DISPUTES}
      maxWidth={false}
      meta={
        dispute ? (
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            <StatusChip status={dispute.status} tooltip />
            <AgeBadge date={dispute.createdAt} noun="Raised" {...DISPUTE_SLA} />
            <EntityRefChip
              type="order"
              id={dispute.orderId}
              label={order?.title ?? dispute.orderId}
            />
            <AssigneeLine assignee={context?.assignee} resolvedBy={context?.resolvedBy} />
          </Stack>
        ) : null
      }
    >
      <AdminPageGuard permission={PERMISSIONS.DISPUTES_RESOLVE}>{body()}</AdminPageGuard>
    </DashboardPage>
  )
}
