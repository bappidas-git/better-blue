import { useEffect, useState } from 'react'

import { Icon } from '@iconify/react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Divider from '@mui/material/Divider'
import Link from '@mui/material/Link'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'

import StatusChip from '@/components/data-display/StatusChip'
import FormTextField from '@/components/inputs/FormTextField'
import SideSheet from '@/components/layout/SideSheet'
import CardSkeleton from '@/components/feedback/skeletons/CardSkeleton'
import { REPORT_SUBJECT } from '@/constants/reports'
import { EntityRefChip } from '@/features/admin/shared'
import {
  getReportReasonLabel,
  getReportSubjectMeta,
} from '@/features/admin/moderation/utils/moderationQueue'
import { paths } from '@/routes/paths'
import { OPEN_REPORT_STATUSES, REPORT_NOTE_MAX } from '@/services/reportService'
import { formatDateTime } from '@/utils/formatters'

// One report, weighed — Prompt 30 §4.4.
//
// Two outcomes, and the difference between them is what the sheet is for:
// **dismiss** closes it because there is nothing here, and **action** says there
// is, then sends it somewhere it can actually be dealt with. Where that is
// depends entirely on what was reported, which is why the primary button
// changes label, icon, and destination per subject type rather than being one
// vague "Take action".
//
// The reporter's words are quoted, not summarised, and nothing here styles them
// as a finding — a report is a claim until somebody looks (§6).

/** What "action" means, per subject type. */
const ACTION = Object.freeze({
  [REPORT_SUBJECT.PORTFOLIO_ITEM]: Object.freeze({
    label: 'Open a review case',
    icon: 'tabler:shield-check',
    explanation:
      'The item goes into the moderation queue — its existing case if it has one, a new one if it does not — and this report is recorded as actioned.',
  }),
  [REPORT_SUBJECT.CREATOR_PROFILE]: Object.freeze({
    label: 'Record as actioned',
    icon: 'solar:user-block-linear',
    explanation:
      'A profile is handled on the account itself: open it below to suspend, verify, or leave a note. This records that the report was upheld.',
  }),
  [REPORT_SUBJECT.REQUEST]: Object.freeze({
    label: 'Record as actioned',
    icon: 'solar:clipboard-list-linear',
    explanation:
      'Briefs are managed on the request board, which arrives with the marketplace operations console. This records that the report was upheld so the trail is complete.',
  }),
})

/**
 * @param {object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {object|null} props.context the result of `reportService.getReportContext`
 * @param {boolean} [props.isLoading=false]
 * @param {boolean} [props.canManage=false] the reader holds `reports.manage`
 * @param {(note: string) => Promise<*>} props.onDismiss
 * @param {(note: string) => Promise<*>} props.onAction
 */
export default function ReportDetailSheet({
  open,
  onClose,
  context,
  isLoading = false,
  canManage = false,
  onDismiss,
  onAction,
}) {
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(null)
  const [failure, setFailure] = useState(null)

  const report = context?.report ?? null

  // A fresh note per report: what was concluded about one is never the right
  // starting point for the next.
  useEffect(() => {
    setNote('')
    setFailure(null)
    setBusy(null)
  }, [report?.id])

  const run = async (kind, work) => {
    setBusy(kind)
    setFailure(null)
    try {
      await work(note.trim())
    } catch (error) {
      setFailure(error?.message ?? 'We could not record that outcome.')
    } finally {
      setBusy(null)
    }
  }

  const subjectMeta = report ? getReportSubjectMeta(report.subjectType) : null
  const action = report ? (ACTION[report.subjectType] ?? ACTION[REPORT_SUBJECT.PORTFOLIO_ITEM]) : null
  const isClosed = report ? !OPEN_REPORT_STATUSES.includes(report.status) : false

  return (
    <SideSheet
      open={open}
      onClose={onClose}
      title="Report"
      description={report ? `Filed ${formatDateTime(report.createdAt)}` : undefined}
      width={460}
      actions={
        report && canManage && !isClosed ? (
          <>
            <Button
              onClick={() => run('dismiss', onDismiss)}
              disabled={Boolean(busy)}
              startIcon={<Icon icon="solar:check-read-linear" width={18} aria-hidden="true" />}
            >
              {busy === 'dismiss' ? 'Dismissing…' : 'Dismiss'}
            </Button>
            <Button
              variant="contained"
              onClick={() => run('action', onAction)}
              disabled={Boolean(busy)}
              startIcon={<Icon icon={action.icon} width={18} aria-hidden="true" />}
            >
              {busy === 'action' ? 'Working…' : action.label}
            </Button>
          </>
        ) : (
          <Button onClick={onClose}>Close</Button>
        )
      }
    >
      {isLoading || !report ? (
        <CardSkeleton media={false} lines={5} label="Loading this report" />
      ) : (
        <Stack spacing={2.5}>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            <StatusChip status={report.status} size="sm" tooltip />
            <Chip size="small" variant="outlined" label={subjectMeta.label} />
            <Chip size="small" variant="outlined" label={getReportReasonLabel(report.reason)} />
          </Stack>

          <Box>
            <Typography variant="caption" color="text.secondary" component="p">
              Reported content
            </Typography>
            <Typography variant="subtitle2" component="h3" sx={{ mt: 0.25 }}>
              {context.subjectTitle}
            </Typography>

            {report.subjectType === REPORT_SUBJECT.PORTFOLIO_ITEM && context.subject ? (
              <Box
                sx={{
                  mt: 1.5,
                  width: '100%',
                  aspectRatio: '4 / 3',
                  maxWidth: 320,
                  borderRadius: 2,
                  overflow: 'hidden',
                  bgcolor: 'primary.surface',
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                {context.subject.thumbnailUrl ? (
                  <Box
                    component="img"
                    src={context.subject.thumbnailUrl}
                    alt={context.subject.title ?? 'Reported portfolio item'}
                    sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <Typography variant="caption" color="text.secondary">
                    No preview available
                  </Typography>
                )}
              </Box>
            ) : null}

            <Stack direction="row" spacing={1} sx={{ mt: 1.5 }} flexWrap="wrap" useFlexGap>
              {context.review ? (
                <EntityRefChip
                  type="moderation_review"
                  id={context.review.id}
                  label="Existing review case"
                />
              ) : null}
              {context.owner?.id ? (
                <EntityRefChip type="user" id={context.owner.id} label={context.owner.name} />
              ) : null}
              {report.subjectType === REPORT_SUBJECT.CREATOR_PROFILE ? (
                <Link
                  href={paths.creatorProfile(report.subjectId)}
                  target="_blank"
                  rel="noopener noreferrer"
                  variant="body2"
                  underline="hover"
                  sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}
                >
                  <Icon icon="solar:arrow-right-up-linear" width={16} aria-hidden="true" />
                  Public profile
                </Link>
              ) : null}
            </Stack>
          </Box>

          <Divider />

          <Box>
            <Typography variant="caption" color="text.secondary" component="p">
              Reported by {context.reporter?.name ?? 'a signed-out visitor'}
            </Typography>
            {report.details ? (
              <Typography variant="body2" sx={{ mt: 0.75 }}>
                “{report.details}”
              </Typography>
            ) : (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                No further detail was given.
              </Typography>
            )}
          </Box>

          {isClosed ? (
            <Alert severity="info" variant="outlined">
              This report was closed
              {report.handledAt ? ` on ${formatDateTime(report.handledAt)}` : ''}.
              {report.resolutionNote ? ` “${report.resolutionNote}”` : ''}
            </Alert>
          ) : canManage ? (
            <>
              <Alert severity="info" variant="outlined">
                {action.explanation}
              </Alert>

              {failure ? <Alert severity="error">{failure}</Alert> : null}

              <FormTextField
                label="Note (optional)"
                placeholder="e.g. Licence supplied by the creator and checked; no breach found."
                multiline
                minRows={3}
                maxLength={REPORT_NOTE_MAX}
                value={note}
                onChange={setNote}
                helperText="Stored on the report. The reporter is not sent it."
              />
            </>
          ) : (
            <Alert severity="info" variant="outlined">
              You can read reports, but recording an outcome needs the “Handle reports”
              permission.
            </Alert>
          )}
        </Stack>
      )}
    </SideSheet>
  )
}
