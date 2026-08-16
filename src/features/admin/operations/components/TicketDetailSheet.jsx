import { useEffect, useMemo, useState } from 'react'

import { Icon } from '@iconify/react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Divider from '@mui/material/Divider'
import Link from '@mui/material/Link'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'

import StatusChip from '@/components/data-display/StatusChip'
import UserAvatar from '@/components/data-display/UserAvatar'
import CardSkeleton from '@/components/feedback/skeletons/CardSkeleton'
import FormTextField from '@/components/inputs/FormTextField'
import SideSheet from '@/components/layout/SideSheet'
import { isAdminRole } from '@/constants/roles'
import { TICKET_STATUS } from '@/constants/statuses'
import { EntityRefChip } from '@/features/admin/shared'
import { TICKET_REPLY_MAX } from '@/services/supportService'
import { formatDateTime } from '@/utils/formatters'

// One support ticket, worked — Prompt 31 §4.3.
//
// The thread is an ordered list with each turn labelled by who took it, because
// "who said this" is the first thing anybody reading a support conversation
// needs and the last thing a wall of paragraphs conveys.
//
// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ HONEST ABOUT WHERE A REPLY GOES (§4.3).                                   ║
// ║                                                                          ║
// ║ v1 replies are **admin-side records**. There is no email in the mock      ║
// ║ stack and the member has no "my tickets" screen — the contact form is     ║
// ║ write-only (Prompt 11). So the composer says so, in the field's own       ║
// ║ helper text, rather than letting somebody believe they have answered a    ║
// ║ member. Laravel closes it at both ends: a queued mailable to the address  ║
// ║ on the ticket, and a member-facing screen reading this same array.        ║
// ╚══════════════════════════════════════════════════════════════════════════╝

/** Status actions offered on a ticket, and what each one means. */
const STATUS_ACTIONS = Object.freeze([
  Object.freeze({
    status: TICKET_STATUS.RESOLVED,
    label: 'Resolve',
    icon: 'solar:check-circle-linear',
    availableFrom: [TICKET_STATUS.OPEN, TICKET_STATUS.PENDING],
    noteLabel: 'Closing note (optional)',
  }),
  Object.freeze({
    status: TICKET_STATUS.CLOSED,
    label: 'Close',
    icon: 'solar:archive-minimalistic-linear',
    availableFrom: [TICKET_STATUS.OPEN, TICKET_STATUS.PENDING, TICKET_STATUS.RESOLVED],
  }),
  Object.freeze({
    status: TICKET_STATUS.OPEN,
    label: 'Reopen',
    icon: 'solar:restart-linear',
    availableFrom: [TICKET_STATUS.RESOLVED, TICKET_STATUS.CLOSED],
  }),
])

/** One turn in the conversation. */
function ThreadEntry({ author, authorRole, body, at, isOriginal }) {
  const fromTeam = isAdminRole(authorRole)

  return (
    <Box
      component="li"
      sx={{
        listStyle: 'none',
        p: 2,
        borderRadius: 2,
        border: 1,
        borderColor: fromTeam ? 'primary.light' : 'divider',
        bgcolor: fromTeam ? 'primary.surface' : 'background.default',
      }}
    >
      <Stack direction="row" spacing={1.25} alignItems="center" sx={{ mb: 1 }}>
        <UserAvatar name={author} size={28} />
        <Box sx={{ minWidth: 0, flexGrow: 1 }}>
          <Typography variant="subtitle2" component="p" noWrap>
            {author}
            {fromTeam ? ' · BetterBlue' : ''}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {isOriginal ? 'Original message · ' : ''}
            {formatDateTime(at)}
          </Typography>
        </Box>
      </Stack>
      <Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>
        {body}
      </Typography>
    </Box>
  )
}

/**
 * @param {object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {object|null} props.context result of `supportService.getTicketContext`
 * @param {boolean} [props.isLoading=false]
 * @param {boolean} [props.canManage=false] the reader holds `support.manage`
 * @param {(body: string) => Promise<*>} props.onReply
 * @param {(status: string, note?: string) => Promise<*>} props.onSetStatus
 */
export default function TicketDetailSheet({
  open,
  onClose,
  context,
  isLoading = false,
  canManage = false,
  onReply,
  onSetStatus,
}) {
  const [reply, setReply] = useState('')
  const [busy, setBusy] = useState(null)
  const [failure, setFailure] = useState(null)

  const ticket = context?.ticket ?? null
  const requester = context?.requester ?? null

  // A fresh composer per ticket: a half-written answer to one member is never
  // the right opening for the next.
  useEffect(() => {
    setReply('')
    setFailure(null)
    setBusy(null)
  }, [ticket?.id])

  const thread = useMemo(() => {
    if (!ticket) return []
    const participants = context?.participants ?? {}
    return [
      {
        id: `${ticket.id}:original`,
        author: ticket.name ?? requester?.name ?? 'A member',
        authorRole: requester?.role,
        body: ticket.body,
        at: ticket.createdAt,
        isOriginal: true,
      },
      ...(ticket.replies ?? []).map((entry, index) => ({
        id: `${ticket.id}:reply:${index}`,
        author: participants[entry.byId]?.name ?? entry.byId ?? 'BetterBlue',
        authorRole: participants[entry.byId]?.role,
        body: entry.body,
        at: entry.at,
        isOriginal: false,
      })),
    ]
  }, [context, ticket, requester])

  const run = async (key, work) => {
    setBusy(key)
    setFailure(null)
    try {
      await work()
    } catch (error) {
      setFailure(error?.message ?? 'We could not record that.')
    } finally {
      setBusy(null)
    }
  }

  const sendReply = () =>
    run('reply', async () => {
      await onReply?.(reply.trim())
      setReply('')
    })

  const actions = ticket
    ? STATUS_ACTIONS.filter((action) => action.availableFrom.includes(ticket.status))
    : []

  return (
    <SideSheet
      open={open}
      onClose={onClose}
      title={ticket?.subject ?? 'Support ticket'}
      description={ticket ? `Received ${formatDateTime(ticket.createdAt)}` : undefined}
      width={520}
      actions={
        ticket && canManage ? (
          <>
            <Button onClick={onClose} disabled={Boolean(busy)}>
              Close panel
            </Button>
            <Button
              variant="contained"
              onClick={sendReply}
              disabled={Boolean(busy) || reply.trim().length === 0}
              startIcon={<Icon icon="solar:plain-linear" width={18} aria-hidden="true" />}
            >
              {busy === 'reply' ? 'Saving…' : 'Send reply'}
            </Button>
          </>
        ) : (
          <Button onClick={onClose}>Close panel</Button>
        )
      }
    >
      {isLoading || !ticket ? (
        <CardSkeleton media={false} lines={6} label="Loading this ticket" />
      ) : (
        <Stack spacing={2.5}>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            <StatusChip status={ticket.status} size="sm" tooltip />
            <EntityRefChip type="support_ticket" id={ticket.id} label={ticket.id} />
            {requester?.id ? (
              <EntityRefChip type="user" id={requester.id} label={requester.name} />
            ) : null}
          </Stack>

          <Box>
            <Typography variant="caption" color="text.secondary" component="p">
              Reply to
            </Typography>
            <Typography variant="subtitle2" component="p" sx={{ mt: 0.25 }}>
              {ticket.name}
            </Typography>
            <Link href={`mailto:${ticket.email}`} variant="body2" underline="hover">
              {ticket.email}
            </Link>
            {!requester ? (
              <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 0.5 }}>
                Sent by a signed-out visitor — the address above is the only way to reach them.
              </Typography>
            ) : null}
          </Box>

          <Divider />

          <Box>
            <Typography variant="subtitle2" component="h3" sx={{ mb: 1.5 }}>
              Conversation
            </Typography>
            <Stack component="ol" spacing={1.5} sx={{ listStyle: 'none', m: 0, p: 0 }}>
              {thread.map((entry) => (
                <ThreadEntry key={entry.id} {...entry} />
              ))}
            </Stack>
          </Box>

          {failure ? <Alert severity="error">{failure}</Alert> : null}

          {canManage ? (
            <>
              <FormTextField
                label="Reply"
                placeholder="Answer the member's question in full — they cannot ask a follow-up here."
                multiline
                minRows={4}
                maxLength={TICKET_REPLY_MAX}
                value={reply}
                onChange={setReply}
                helperText="Recorded on the ticket and visible to the admin team. v1 sends no email — see the note below."
              />

              <Alert severity="info" variant="outlined">
                Replies are admin-side records in this version: there is no outbound email yet and
                members have no ticket screen of their own. Contact the member directly at the
                address above if they are waiting on an answer.
              </Alert>

              <Box>
                <Typography variant="caption" color="text.secondary" component="p" sx={{ mb: 1 }}>
                  Status
                </Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  {actions.map((action) => (
                    <Button
                      key={action.status}
                      variant="outlined"
                      size="small"
                      disabled={Boolean(busy)}
                      onClick={() =>
                        run(action.status, () =>
                          onSetStatus?.(action.status, action.noteLabel ? reply.trim() : undefined)
                        )
                      }
                      startIcon={<Icon icon={action.icon} width={18} aria-hidden="true" />}
                    >
                      {busy === action.status ? 'Working…' : action.label}
                    </Button>
                  ))}
                </Stack>
                {actions.some((action) => action.noteLabel) ? (
                  <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1 }}>
                    Resolving posts whatever is in the reply box first, so you can answer and close
                    in one go.
                  </Typography>
                ) : null}
              </Box>
            </>
          ) : (
            <Alert severity="info" variant="outlined">
              You can read tickets, but replying and changing a status needs the “Manage support”
              permission.
            </Alert>
          )}
        </Stack>
      )}
    </SideSheet>
  )
}
