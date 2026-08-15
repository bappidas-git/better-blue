import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { alpha } from '@mui/material/styles'

import { getRejectionReason } from '@/constants/policy'
import { CONTENT_STATUS } from '@/constants/statuses'
import { formatDate } from '@/utils/formatters'

// What a reviewer decided, said in the creator's own words.
//
// A rejection that only says "rejected" is a dead end. This banner carries the
// three things that make it actionable: which rule the submission fell short
// of, the reviewer's own note about *this* item, and the one button that starts
// the fix. `role="status"` (§12) so a screen reader hears the decision when the
// card it belongs to is read, rather than a bare chip labelled "Rejected".

/** Tone per decision — changes requested is a nudge, a rejection is a stop. */
const DECISION_TONE = {
  [CONTENT_STATUS.REVISION_REQUIRED]: {
    palette: 'warning',
    icon: 'solar:pen-new-square-linear',
    heading: 'Changes requested',
  },
  [CONTENT_STATUS.REJECTED]: {
    palette: 'error',
    icon: 'solar:shield-cross-linear',
    heading: 'Not approved',
  },
  [CONTENT_STATUS.RESTRICTED]: {
    palette: 'warning',
    icon: 'solar:eye-closed-linear',
    heading: 'Hidden from public view',
  },
}

/**
 * @param {object} props
 * @param {string} props.status the item's `CONTENT_STATUS`
 * @param {object} [props.review] the `moderationReviews` record behind it
 * @param {string} [props.fallbackReason] `portfolioItems.rejectionReason`, used
 *   when the moderation case could not be read
 * @param {() => void} [props.onFix] opens the editor — omitted when the status
 *   cannot be re-submitted
 */
export default function RejectionBanner({ status, review, fallbackReason, onFix }) {
  const tone = DECISION_TONE[status]
  if (!tone) return null

  const reason = getRejectionReason(review?.reasonCode)
  const notes = review?.notes || fallbackReason
  const decidedAt = review?.reviewedAt

  return (
    <Box
      role="status"
      sx={{
        px: 1.5,
        py: 1.25,
        borderRadius: 2,
        border: 1,
        borderColor: (theme) => alpha(theme.palette[tone.palette].main, 0.32),
        bgcolor: (theme) => alpha(theme.palette[tone.palette].main, 0.07),
      }}
    >
      <Stack direction="row" spacing={1} alignItems="flex-start">
        <Box
          aria-hidden="true"
          sx={{ display: 'flex', color: `${tone.palette}.main`, mt: 0.125, flexShrink: 0 }}
        >
          <Icon icon={tone.icon} width={18} />
        </Box>

        <Box sx={{ minWidth: 0 }}>
          <Typography variant="subtitle2" component="p" sx={{ lineHeight: 1.4 }}>
            {/* The reason code is the headline when there is one: it is the part
                that names the rule, and the notes explain it. */}
            {reason ? `${tone.heading} — ${reason.label}` : tone.heading}
          </Typography>

          {notes ? (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {notes}
            </Typography>
          ) : null}

          {decidedAt ? (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
              Reviewed {formatDate(decidedAt)}
            </Typography>
          ) : null}

          {onFix ? (
            <Button
              size="small"
              variant="contained"
              color={tone.palette}
              onClick={onFix}
              startIcon={<Icon icon="tabler:refresh" width={16} aria-hidden="true" />}
              sx={{ mt: 1.25, minHeight: 36 }}
            >
              Fix &amp; resubmit
            </Button>
          ) : null}
        </Box>
      </Stack>
    </Box>
  )
}
