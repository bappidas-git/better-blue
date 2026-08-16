import { useCallback, useMemo, useState } from 'react'

import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'

import EmptyState from '@/components/feedback/EmptyState'
import ErrorState from '@/components/feedback/ErrorState'
import ListSkeleton from '@/components/feedback/skeletons/ListSkeleton'
import { useConfirm } from '@/components/feedback/ConfirmDialogProvider'
import { useToast } from '@/components/feedback/ToastProvider'
import { PERMISSIONS } from '@/constants/permissions'
import { useAuth } from '@/context/AuthContext'
import AnnouncementComposer from '@/features/admin/operations/components/AnnouncementComposer'
import AnnouncementPreview from '@/features/admin/operations/components/AnnouncementPreview'
import { audienceLabel } from '@/features/admin/operations/utils/operationsFilters'
import { AdminPageGuard } from '@/features/admin/shared'
import useApiQuery from '@/hooks/useApiQuery'
import DashboardPage from '@/layouts/dashboard/DashboardPage'
import {
  ANNOUNCEMENT_AUDIENCE,
  ANNOUNCEMENT_BODY_MAX,
  ANNOUNCEMENT_BODY_MIN,
  ANNOUNCEMENT_TITLE_MAX,
  ANNOUNCEMENT_TITLE_MIN,
  notificationService,
} from '@/services/notificationService'
import { formatDateTime, formatNumber } from '@/utils/formatters'

// Platform announcements — Prompt 31 §4.4.
//
// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ THE HISTORY IS THE AUDIT TRAIL, and that is the whole design.             ║
// ║                                                                          ║
// ║ There is no `announcements` collection. An announcement is an event — it  ║
// ║ is sent once, never edited, never deleted — and `auditLogs` already has   ║
// ║ to record it. A second table storing the same four fields would be a      ║
// ║ second source of truth for one sentence, and the two would drift the      ║
// ║ first time somebody sent one and the write half-failed.                   ║
// ║                                                                          ║
// ║ `notificationService.listAnnouncements` reads `announcement.send` entries ║
// ║ back out. The cost is a tolerant `meta` reader — the seeded entry spells  ║
// ║ its fields differently — which is a cheap price for one source of truth.  ║
// ╚══════════════════════════════════════════════════════════════════════════╝

/** Validation mirrors the service exactly, so the form and the API agree. */
function validate(values) {
  const errors = {}
  const title = values.title.trim()
  const body = values.body.trim()

  if (title.length < ANNOUNCEMENT_TITLE_MIN || title.length > ANNOUNCEMENT_TITLE_MAX) {
    errors.title = `The title must be ${ANNOUNCEMENT_TITLE_MIN}–${ANNOUNCEMENT_TITLE_MAX} characters.`
  }
  if (body.length < ANNOUNCEMENT_BODY_MIN || body.length > ANNOUNCEMENT_BODY_MAX) {
    errors.body = `The message must be ${ANNOUNCEMENT_BODY_MIN}–${ANNOUNCEMENT_BODY_MAX} characters.`
  }
  return errors
}

const INITIAL_VALUES = {
  audience: ANNOUNCEMENT_AUDIENCE.ALL,
  title: '',
  body: '',
}

export default function AdminAnnouncementsPage() {
  const { user: actor } = useAuth()
  const confirm = useConfirm()
  const toast = useToast()

  const [values, setValues] = useState(INITIAL_VALUES)
  const [errors, setErrors] = useState({})
  const [sending, setSending] = useState(false)
  const [progress, setProgress] = useState(null)
  const [historyToken, setHistoryToken] = useState(0)

  const {
    data: recipientCount,
    isLoading: countLoading,
  } = useApiQuery(() => notificationService.countAudience(values.audience), [values.audience])

  const {
    data: history,
    isLoading: historyLoading,
    error: historyError,
    refetch: refetchHistory,
  } = useApiQuery(() => notificationService.listAnnouncements({ limit: 10 }), [historyToken])

  const setField = useCallback((name, value) => {
    setValues((current) => ({ ...current, [name]: value }))
    setErrors((current) => ({ ...current, [name]: undefined }))
  }, [])

  const blurField = useCallback(
    (name) => {
      setValues((current) => {
        const message = validate(current)[name]
        setErrors((currentErrors) => ({ ...currentErrors, [name]: message }))
        return current
      })
    },
    []
  )

  const audienceName = useMemo(() => audienceLabel(values.audience), [values.audience])

  const send = useCallback(async () => {
    const nextErrors = validate(values)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) {
      document.getElementById(nextErrors.title ? 'announcement-title' : 'announcement-body')?.focus()
      return
    }

    // The count is fetched **live** rather than reused from the tile, because
    // the tile may be minutes old and "send to 243 people" has to be a number
    // somebody can stand behind at the moment they agree to it (§13).
    let audienceSize = null
    try {
      audienceSize = await notificationService.countAudience(values.audience)
    } catch {
      audienceSize = recipientCount ?? null
    }

    const result = await confirm({
      title: 'Send this announcement?',
      message:
        (typeof audienceSize === 'number'
          ? `${formatNumber(audienceSize)} member${audienceSize === 1 ? '' : 's'} in “${audienceName}” will receive it. `
          : `Everybody in “${audienceName}” will receive it. `) +
        'It cannot be recalled, and notification preferences do not suppress it.',
      confirmLabel: 'Send now',
      cancelLabel: 'Keep editing',
      icon: 'solar:megaphone-linear',
    })
    if (!result) return

    setSending(true)
    setProgress({ sent: 0, failed: 0, total: audienceSize ?? 0 })
    try {
      const outcome = await notificationService.broadcastAnnouncement({
        ...values,
        actor,
        onProgress: setProgress,
      })

      if (outcome.failed > 0) {
        toast.warning(
          `Sent ${formatNumber(outcome.sent)}/${formatNumber(outcome.recipientCount)} — retry failed.`,
          {
            description:
              'Sending again delivers to everybody in the audience, so the members who did receive it will get a second copy.',
          }
        )
      } else {
        toast.success(
          `Sent to ${formatNumber(outcome.sent)} member${outcome.sent === 1 ? '' : 's'}.`,
          { description: 'It is in their notification feeds now, and in the audit trail.' }
        )
      }

      setValues((current) => ({ ...INITIAL_VALUES, audience: current.audience }))
      setHistoryToken((token) => token + 1)
    } catch (failure) {
      toast.error(failure?.message ?? 'We could not send that announcement.')
    } finally {
      setSending(false)
      setProgress(null)
    }
  }, [actor, audienceName, confirm, recipientCount, toast, values])

  return (
    <DashboardPage
      title="Announcements"
      subtitle="Tell buyers, creators, or everybody about a change to BetterBlue."
      maxWidth="lg"
    >
      <AdminPageGuard permission={PERMISSIONS.ANNOUNCEMENTS_SEND}>
        <Stack spacing={{ xs: 2, md: 3 }}>
          <Box
            sx={{
              display: 'grid',
              gap: { xs: 2, md: 3 },
              gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1.2fr) minmax(0, 1fr)' },
              alignItems: 'start',
            }}
          >
            <AnnouncementComposer
              values={values}
              errors={errors}
              onChange={setField}
              onBlur={blurField}
              recipientCount={recipientCount}
              countLoading={countLoading}
              progress={progress}
              sending={sending}
              onSend={send}
            />

            <AnnouncementPreview
              title={values.title}
              body={values.body}
              audienceLabel={audienceName}
            />
          </Box>

          <Card>
            <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
              <Typography variant="subtitle2" component="h2" sx={{ mb: 0.5 }}>
                Recently sent
              </Typography>
              <Typography variant="caption" color="text.secondary" component="p" sx={{ mb: 2 }}>
                Read from the audit trail — announcements are events, not records, so the trail is
                the history.
              </Typography>

              {historyError ? (
                <ErrorState
                  dense
                  title="We could not load the history"
                  error={historyError}
                  onRetry={refetchHistory}
                />
              ) : historyLoading ? (
                <ListSkeleton rows={3} label="Loading sent announcements" />
              ) : (history?.items ?? []).length === 0 ? (
                <EmptyState
                  dense
                  icon="solar:megaphone-linear"
                  title="Nothing has been announced yet"
                  description="Announcements you send will be listed here."
                  sx={{ py: 3 }}
                />
              ) : (
                <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
                  {history.items.map((entry, index) => (
                    <Box
                      component="li"
                      key={entry.id}
                      sx={{
                        py: 1.75,
                        borderBottom: index === history.items.length - 1 ? 0 : 1,
                        borderColor: 'divider',
                      }}
                    >
                      <Stack
                        direction="row"
                        spacing={1}
                        alignItems="center"
                        flexWrap="wrap"
                        useFlexGap
                      >
                        <Typography variant="body2" sx={{ fontWeight: 600, flexGrow: 1, minWidth: 0 }}>
                          {entry.title}
                        </Typography>
                        <Chip size="small" variant="outlined" label={audienceLabel(entry.audience)} />
                        {typeof entry.recipientCount === 'number' ? (
                          <Chip
                            size="small"
                            variant="outlined"
                            label={`${formatNumber(entry.recipientCount)} recipients`}
                          />
                        ) : null}
                        {entry.failed > 0 ? (
                          <Chip
                            size="small"
                            color="warning"
                            label={`${formatNumber(entry.failed)} failed`}
                          />
                        ) : null}
                      </Stack>

                      {entry.body ? (
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                          {entry.body}
                        </Typography>
                      ) : null}

                      <Typography
                        variant="caption"
                        color="text.disabled"
                        component="p"
                        sx={{ mt: 0.5 }}
                      >
                        {formatDateTime(entry.sentAt)}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              )}
            </CardContent>
          </Card>

          <Alert severity="info" variant="outlined">
            MOCK-FANOUT: this browser writes one notification per recipient, one at a time. It is
            visibly slow past a few dozen members and is capped — the Laravel backend replaces the
            whole loop with a single request and a queued job.
          </Alert>
        </Stack>
      </AdminPageGuard>
    </DashboardPage>
  )
}
