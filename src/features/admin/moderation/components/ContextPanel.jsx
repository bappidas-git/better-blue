import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import Divider from '@mui/material/Divider'
import Link from '@mui/material/Link'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'

import KeyValueList from '@/components/data-display/KeyValueList'
import StatusChip from '@/components/data-display/StatusChip'
import TimelineList from '@/components/data-display/TimelineList'
import UserAvatar from '@/components/data-display/UserAvatar'
import { getRejectionReason } from '@/constants/policy'
import { CONTENT_STATUS, MODERATION_SUBJECT, STATUS_META } from '@/constants/statuses'
import { EntityRefChip } from '@/features/admin/shared'
import { paths } from '@/routes/paths'
import { EMPTY_PLACEHOLDER, formatCurrency, formatDate, formatDateTime } from '@/utils/formatters'

import PolicyReference from './PolicyReference'

// Everything except the content itself — Prompt 30 §4.3.
//
// Four cards in the order a reviewer needs them: what this is, who sent it,
// what the rules say, and what has already happened to it. The creator card is
// the one that earns its place — a first submission and a fifth rejection are
// different decisions, and the numbers are read here rather than guessed.

/** Tone per history step, so an approval and a rejection do not look identical. */
const HISTORY_TONE = Object.freeze({
  [CONTENT_STATUS.SUBMITTED]: 'info',
  [CONTENT_STATUS.UNDER_REVIEW]: 'info',
  [CONTENT_STATUS.APPROVED]: 'success',
  [CONTENT_STATUS.PUBLISHED]: 'success',
  [CONTENT_STATUS.REJECTED]: 'error',
  [CONTENT_STATUS.REVISION_REQUIRED]: 'warning',
  [CONTENT_STATUS.RESTRICTED]: 'warning',
  [CONTENT_STATUS.ARCHIVED]: 'neutral',
})

/**
 * Who made a history entry.
 *
 * MOCK-JOIN: an entry stores an actor id and nothing else, and resolving every
 * one would be a request per row for a name the reviewer mostly does not need.
 * The creator is named because we already have them; everyone else is our own
 * team, which is what the entry means and is honest about what we know.
 */
function actorLabel(entry, creator) {
  if (!entry?.byId) return 'BetterBlue'
  if (creator && entry.byId === creator.id) return creator.name
  return 'Trust & Safety'
}

/** One stat in the creator's record. */
function StatFigure({ label, value, tone = 'text.primary' }) {
  return (
    <Box sx={{ minWidth: 64 }}>
      <Typography variant="h6" component="p" sx={{ color: tone, fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
    </Box>
  )
}

/**
 * @param {object} props
 * @param {object} props.bundle the result of `moderationService.getReviewBundle`
 * @param {(id: string) => string} [props.categoryNameFor] category id → name
 */
export default function ContextPanel({ bundle, categoryNameFor }) {
  const { review, subject, creator, creatorProfile, order, stats } = bundle
  const isDelivery = review.subjectType === MODERATION_SUBJECT.DELIVERY
  const reason = getRejectionReason(review.reasonCode)

  const metadata = isDelivery
    ? [
        { label: 'Type', value: 'Deliverable' },
        { label: 'Version', value: subject?.version ? `Version ${subject.version}` : EMPTY_PLACEHOLDER },
        {
          label: 'Files',
          value: subject?.files?.length ? `${subject.files.length}` : EMPTY_PLACEHOLDER,
        },
        {
          label: 'Submitted',
          value: review.submittedAt ? formatDateTime(review.submittedAt) : EMPTY_PLACEHOLDER,
        },
      ]
    : [
        {
          label: 'Type',
          value: subject?.contentType
            ? (STATUS_META[subject.contentType]?.label ?? subject.contentType)
            : EMPTY_PLACEHOLDER,
        },
        {
          label: 'Category',
          value: subject?.categoryId
            ? (categoryNameFor?.(subject.categoryId) ?? subject.categoryId)
            : EMPTY_PLACEHOLDER,
        },
        {
          label: 'Visibility',
          value: subject?.visibility
            ? (STATUS_META[subject.visibility]?.label ?? subject.visibility)
            : EMPTY_PLACEHOLDER,
        },
        {
          label: 'Submitted',
          value: review.submittedAt ? formatDateTime(review.submittedAt) : EMPTY_PLACEHOLDER,
        },
      ]

  return (
    <Stack spacing={{ xs: 2, md: 2.5 }}>
      <Card component="section" aria-labelledby="review-subject-heading">
        <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
          <Typography id="review-subject-heading" variant="subtitle2" component="h2" sx={{ mb: 1.5 }}>
            Submission
          </Typography>

          {!isDelivery && subject?.description ? (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {subject.description}
            </Typography>
          ) : null}

          {isDelivery && subject?.message ? (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              “{subject.message}”
            </Typography>
          ) : null}

          <KeyValueList items={metadata} dense />

          {!isDelivery && subject?.tags?.length ? (
            <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mt: 2 }}>
              {subject.tags.map((tag) => (
                <Chip key={tag} size="small" variant="outlined" label={tag} />
              ))}
            </Stack>
          ) : null}

          {review.notes ? (
            <>
              <Divider sx={{ my: 2 }} />
              <Typography variant="caption" color="text.secondary" component="p">
                Last decision {review.reviewedAt ? `· ${formatDate(review.reviewedAt)}` : ''}
              </Typography>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.75, mb: 1 }}>
                <StatusChip status={review.status} size="sm" />
                {reason ? <Chip size="small" variant="outlined" label={reason.label} /> : null}
              </Stack>
              <Typography variant="body2">{review.notes}</Typography>
            </>
          ) : null}
        </CardContent>
      </Card>

      <Card component="section" aria-labelledby="review-creator-heading">
        <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
          <Typography id="review-creator-heading" variant="subtitle2" component="h2" sx={{ mb: 2 }}>
            Creator
          </Typography>

          <Stack direction="row" spacing={2} alignItems="center">
            <UserAvatar name={creator?.name ?? 'Creator'} src={creator?.avatarUrl} size="lg" />
            <Box sx={{ minWidth: 0, flexGrow: 1 }}>
              <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
                <Typography variant="subtitle2" component="p">
                  {creator?.name ?? 'Unknown creator'}
                </Typography>
                {creatorProfile?.verified ? (
                  <Chip
                    size="small"
                    color="primary"
                    variant="outlined"
                    icon={<Icon icon="solar:verified-check-bold" width={14} aria-hidden="true" />}
                    label="Verified"
                  />
                ) : null}
              </Stack>
              {creator?.accountStatus ? (
                <Box sx={{ mt: 0.75 }}>
                  <StatusChip status={creator.accountStatus} size="sm" />
                </Box>
              ) : null}
            </Box>
          </Stack>

          <Stack direction="row" spacing={3} sx={{ mt: 2.5 }} flexWrap="wrap" useFlexGap>
            <StatFigure label="Approved" value={stats.approved} tone="success.main" />
            <StatFigure label="Rejected" value={stats.rejected} tone="error.main" />
            <StatFigure label="Changes asked" value={stats.changesRequested} tone="warning.main" />
            <StatFigure label="Submissions" value={stats.total} />
          </Stack>

          <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1.5 }}>
            {stats.truncated
              ? 'Their most recent 100 submissions. Context for this decision, not a verdict on it.'
              : 'Their whole record with us. Context for this decision, not a verdict on it.'}
          </Typography>

          <Stack direction="row" spacing={1} sx={{ mt: 2 }} flexWrap="wrap" useFlexGap>
            {creator?.id ? <EntityRefChip type="user" id={creator.id} label="Open account" /> : null}
            {creatorProfile?.id ? (
              <Link
                href={paths.creatorProfile(creatorProfile.id)}
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
        </CardContent>
      </Card>

      {isDelivery && order ? (
        <Card component="section" aria-labelledby="review-order-heading">
          <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
            <Typography id="review-order-heading" variant="subtitle2" component="h2" sx={{ mb: 1.5 }}>
              Order behind this delivery
            </Typography>
            <Typography variant="body2" sx={{ mb: 1.5 }}>
              {order.title}
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
              <EntityRefChip type="order" id={order.id} label={order.id} />
              <StatusChip status={order.status} size="sm" />
              <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                {formatCurrency(order.price, order.currency)}
              </Typography>
            </Stack>
            <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1.5 }}>
              A content review never moves an order. The buyer keeps what they were sent while
              this case is open.
            </Typography>
          </CardContent>
        </Card>
      ) : null}

      <Card component="section">
        <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
          <PolicyReference />
        </CardContent>
      </Card>

      <Card component="section" aria-labelledby="review-history-heading">
        <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
          <Typography id="review-history-heading" variant="subtitle2" component="h2" sx={{ mb: 2 }}>
            History
          </Typography>
          <TimelineList
            dense
            emptyText="Nothing has happened to this submission yet."
            items={(review.history ?? []).map((entry, index) => ({
              id: `${entry.at}-${index}`,
              title: STATUS_META[entry.toStatus]?.label ?? entry.toStatus,
              description: [actorLabel(entry, creator), entry.note].filter(Boolean).join(' · '),
              // Raw ISO, not a formatted string: `TimelineList` formats a string
              // timestamp itself, and pre-formatting it makes dayjs fail to
              // parse and print an em-dash.
              timestamp: entry.at,
              tone: HISTORY_TONE[entry.toStatus] ?? 'neutral',
            }))}
          />
        </CardContent>
      </Card>
    </Stack>
  )
}
