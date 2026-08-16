import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardActionArea from '@mui/material/CardActionArea'
import Chip from '@mui/material/Chip'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'

import PaginationControl from '@/components/data-display/PaginationControl'
import StatusChip from '@/components/data-display/StatusChip'
import EmptyState from '@/components/feedback/EmptyState'
import ErrorState from '@/components/feedback/ErrorState'
import ListSkeleton from '@/components/feedback/skeletons/ListSkeleton'
import { AgeBadge } from '@/features/admin/shared'
import {
  getReportReasonLabel,
  getReportSubjectMeta,
} from '@/features/admin/moderation/utils/moderationQueue'
import { truncate } from '@/utils/formatters'

// The reports queue — Prompt 30 §4.4.
//
// Reports are not moderation cases: a report is somebody telling us to look at
// something, and most of them end in "we looked, and it is fine". So this list
// is deliberately plainer than the review queue — no thumbnails, no decision
// affordances on the row. The reader's question is "is this worth opening",
// which is answered by the reason, the reporter's own words, and how long it
// has been sitting there.
//
// **A report is a claim, not a finding.** The row states who said what and
// nothing more; the detail sheet is where it is weighed (§6 — no sensational
// styling anywhere in Trust & Safety).

/** One report. The whole card opens the detail sheet — one control, one target. */
function ReportRow({ report, sla, onOpen }) {
  const subjectMeta = getReportSubjectMeta(report.subjectType)
  const reporter = report.reporter?.name ?? 'Guest'

  return (
    <Card component="li" sx={{ listStyle: 'none' }}>
      <CardActionArea
        onClick={onOpen}
        aria-label={`Open the report about ${report.subjectTitle}, filed by ${reporter}`}
        sx={{ p: { xs: 1.75, sm: 2 } }}
      >
        <Stack direction="row" spacing={2} alignItems="flex-start">
          <Box sx={{ minWidth: 0, flexGrow: 1 }}>
            <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
              <Chip size="small" variant="outlined" label={subjectMeta.label} />
              <Typography variant="subtitle2" component="h3" sx={{ minWidth: 0 }}>
                {truncate(report.subjectTitle, 70)}
              </Typography>
            </Stack>

            <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 0.5 }}>
              {getReportReasonLabel(report.reason)} · reported by {reporter}
            </Typography>

            {report.details ? (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{
                  mt: 1,
                  display: '-webkit-box',
                  WebkitBoxOrient: 'vertical',
                  WebkitLineClamp: 2,
                  overflow: 'hidden',
                }}
              >
                {report.details}
              </Typography>
            ) : null}

            <Box sx={{ mt: 1.25 }}>
              <StatusChip status={report.status} size="sm" />
            </Box>
          </Box>

          <Box sx={{ flexShrink: 0 }}>
            <AgeBadge date={report.createdAt} noun="Reported" {...sla} />
          </Box>
        </Stack>
      </CardActionArea>
    </Card>
  )
}

/**
 * @param {object} props
 * @param {object[]} props.items entries from `reportService.listReportBoard`
 * @param {boolean} [props.loading=false]
 * @param {object} [props.error] an `ApiError`
 * @param {() => void} [props.onRetry]
 * @param {object} props.emptyState props forwarded to `EmptyState`
 * @param {(report: object) => void} props.onOpen open the detail sheet
 * @param {{warnAfterDays: number, errorAfterDays: number}} props.sla age thresholds
 * @param {object} props.pagination props forwarded to `PaginationControl`
 */
export default function ReportsTab({
  items,
  loading = false,
  error,
  onRetry,
  emptyState,
  onOpen,
  sla,
  pagination,
}) {
  if (error) {
    return (
      <ErrorState
        title="We could not load the reports"
        message="The review queues are unaffected — this list alone failed to load."
        error={error}
        onRetry={onRetry}
      />
    )
  }

  if (loading) return <ListSkeleton rows={5} label="Loading reports" />

  if (items.length === 0) return <EmptyState {...emptyState} />

  return (
    <Stack spacing={{ xs: 1.5, md: 2 }}>
      <Stack component="ul" spacing={{ xs: 1.5, md: 2 }} sx={{ listStyle: 'none', m: 0, p: 0 }}>
        {items.map((report) => (
          <ReportRow
            key={report.id}
            report={report}
            sla={sla}
            onOpen={() => onOpen(report)}
          />
        ))}
      </Stack>

      <PaginationControl {...pagination} hideOnSinglePage />
    </Stack>
  )
}
