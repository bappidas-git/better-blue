import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { visuallyHidden } from '@mui/utils'
import { useLocation, useNavigate, useParams } from 'react-router-dom'

import StatusChip from '@/components/data-display/StatusChip'
import ErrorState from '@/components/feedback/ErrorState'
import CardSkeleton from '@/components/feedback/skeletons/CardSkeleton'
import { useToast } from '@/components/feedback/ToastProvider'
import { PERMISSIONS, hasPermission } from '@/constants/permissions'
import { useAuth } from '@/context/AuthContext'
import { AdminPageGuard } from '@/features/admin/shared'
import ContextPanel from '@/features/admin/moderation/components/ContextPanel'
import DecisionBar from '@/features/admin/moderation/components/DecisionBar'
import DecisionDialogs from '@/features/admin/moderation/components/DecisionDialogs'
import SubjectPreview from '@/features/admin/moderation/components/SubjectPreview'
import {
  QUEUE_PAGE_SIZE,
  isOpenCase,
} from '@/features/admin/moderation/utils/moderationQueue'
import useApiQuery from '@/hooks/useApiQuery'
import DashboardPage from '@/layouts/dashboard/DashboardPage'
import { paths } from '@/routes/paths'
import { categoryService } from '@/services/categoryService'
import {
  MODERATION_DECISION_META,
  OPEN_QUEUE_STATUSES,
  moderationService,
} from '@/services/moderationService'

// One case, decided — Prompt 30 §4.3.
//
// Three zones, and the split is the whole design: the content takes the left
// 60% because that is what is being judged, the context sits beside it because
// a reviewer needs it *while* looking rather than after, and the decision bar
// is pinned so the verdict is reachable from wherever they stopped reading.
// Below `md` the same three stack in that order, which is also the order they
// are needed in.
//
// **Auto-advance** is the other half of the design. A reviewer working a queue
// of forty should press "Approve" and find themselves on the next case, in the
// order they were looking at it — filters and sort included, which is why the
// queue screen hands its own ordering over in the navigation state rather than
// letting this page invent a canonical one. When there is no handover (a
// deep link, a reload) the next open case is fetched instead, so the flow
// survives a refresh.

/** How long the "moved to the next case" announcement stays in the live region. */
const ANNOUNCE_MS = 4000

export default function AdminModerationDetailPage() {
  const { moderationId } = useParams()
  const { user: actor } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const location = useLocation()

  const [pendingDecision, setPendingDecision] = useState(null)
  const [isWorking, setWorking] = useState(false)
  const [announcement, setAnnouncement] = useState('')

  const headingRef = useRef(null)
  const advancedRef = useRef(false)

  // Handed over by the queue screen: the ids it was showing, where to go back
  // to, and the filters behind both. All optional — every fallback below works
  // without them.
  // Memoised because the fallback literal would otherwise be a new object on
  // every render, and the auto-advance callbacks depend on it.
  const handover = useMemo(() => location.state ?? {}, [location.state])
  const returnTo = handover.returnTo ?? paths.ADMIN_MODERATION

  const {
    data: bundle,
    isLoading,
    error,
    refetch,
  } = useApiQuery(() => moderationService.getReviewBundle(moderationId), [moderationId], {
    enabled: Boolean(moderationId),
  })

  const { data: categories } = useApiQuery(
    () => categoryService.listActive().catch(() => []),
    []
  )
  const categoryNameFor = useCallback(
    (id) => categories?.find((entry) => entry.id === id)?.name ?? id,
    [categories]
  )

  const review = bundle?.review
  const canReview = hasPermission(actor, PERMISSIONS.MODERATION_REVIEW)

  // Arriving on a new case by auto-advance moves focus to its heading and says
  // so, because nothing else on the page changed position — a reviewer working
  // by keyboard would otherwise be left on a button that now decides something
  // different (§12).
  useEffect(() => {
    if (!advancedRef.current || !review) return
    advancedRef.current = false
    headingRef.current?.focus()
    setAnnouncement(`Next case: ${bundle.subject?.title ?? review.subjectId}.`)
    const timer = window.setTimeout(() => setAnnouncement(''), ANNOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [bundle, review])

  /**
   * Where to go once this case is decided: the next id the reviewer could see,
   * or the oldest open case matching the same filters when there is no
   * handover to read.
   */
  const nextCaseId = useCallback(async () => {
    const queue = Array.isArray(handover.queue) ? handover.queue : []
    const position = queue.indexOf(moderationId)
    if (position >= 0 && position + 1 < queue.length) return queue[position + 1]

    try {
      const board = await moderationService.listReviewBoard({
        subjectType: handover.filters?.subjectType ?? review?.subjectType,
        statuses: handover.filters?.statuses ?? [...OPEN_QUEUE_STATUSES],
        order: handover.filters?.order ?? 'asc',
        page: 1,
        limit: QUEUE_PAGE_SIZE,
      })
      return board.items.find((entry) => entry.id !== moderationId)?.id ?? null
    } catch {
      // No next case is not a failure — it is an empty queue, and the reviewer
      // is sent back to see that for themselves.
      return null
    }
  }, [handover, moderationId, review])

  const advance = useCallback(async () => {
    const nextId = await nextCaseId()
    if (!nextId) {
      navigate(returnTo)
      return
    }
    advancedRef.current = true
    navigate(paths.adminModerationDetail(nextId), {
      state: {
        ...handover,
        queue: Array.isArray(handover.queue)
          ? handover.queue.filter((id) => id !== moderationId)
          : undefined,
      },
      replace: true,
    })
  }, [handover, moderationId, navigate, nextCaseId, returnTo])

  const claim = useCallback(async () => {
    setWorking(true)
    try {
      await moderationService.claimForReview(moderationId, { actor })
      toast.success('Case claimed.', { description: 'It is marked as yours while you review it.' })
      refetch()
    } catch (failure) {
      toast.error(failure?.message ?? 'We could not claim this case.')
      refetch()
    } finally {
      setWorking(false)
    }
  }, [actor, moderationId, refetch, toast])

  const decide = useCallback(
    async ({ decision, notes, reasonCode }) => {
      setWorking(true)
      try {
        await moderationService.decide(moderationId, { decision, notes, reasonCode, actor })
        toast.success(`${MODERATION_DECISION_META[decision].label} recorded.`, {
          description: 'The creator has been told, and the decision is in the audit trail.',
        })
        await advance()
      } finally {
        setWorking(false)
      }
    },
    // The dialog keeps its own error state, so a failure is re-thrown to it
    // rather than swallowed here — a stale case must not close the dialog and
    // lose what the reviewer wrote (§13).
    [actor, advance, moderationId, toast]
  )

  /* -- loading and failure ------------------------------------------------- */

  if (error) {
    return (
      <DashboardPage title="Content review" backTo={returnTo} maxWidth={false}>
        <ErrorState
          title="We could not open this case"
          message="It may have been decided by a colleague, or the link may be wrong. The queue is unaffected."
          error={error}
          onRetry={refetch}
        />
      </DashboardPage>
    )
  }

  if (isLoading || !bundle) {
    return (
      <DashboardPage title="Content review" backTo={returnTo} maxWidth={false}>
        <CardSkeleton media lines={5} label="Loading this case" />
      </DashboardPage>
    )
  }

  const title = bundle.subject?.title ?? (bundle.subject?.version
    ? `Delivery version ${bundle.subject.version}`
    : review.subjectId)

  // How many cases sit behind this one in the queue the reviewer came from.
  // Absent (rather than `0`) on a deep link, where there is no queue to count.
  const queueIds = Array.isArray(handover.queue) ? handover.queue : null
  const position = queueIds ? queueIds.indexOf(moderationId) : -1
  const remaining = position >= 0 ? queueIds.length - position - 1 : undefined

  return (
    <DashboardPage
      title="Content review"
      documentTitle={`${title} — content review`}
      backTo={returnTo}
      maxWidth={false}
      meta={<StatusChip status={review.status} size="sm" tooltip />}
    >
      <AdminPageGuard permission={PERMISSIONS.MODERATION_REVIEW}>
        <Box aria-live="polite" sx={visuallyHidden}>
          {announcement}
        </Box>

        <Typography
          ref={headingRef}
          tabIndex={-1}
          variant="h6"
          component="h2"
          sx={{ mb: { xs: 2, md: 2.5 }, outline: 'none' }}
        >
          {title}
        </Typography>

        <Box
          sx={{
            display: 'grid',
            gap: { xs: 2, md: 2.5 },
            gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 3fr) minmax(0, 2fr)' },
            alignItems: 'start',
          }}
        >
          <SubjectPreview
            subject={bundle.subject}
            subjectType={review.subjectType}
            title={title}
          />

          <ContextPanel bundle={bundle} categoryNameFor={categoryNameFor} />
        </Box>

        {/* Sticky on every width: the verdict has to be reachable from wherever
            the reviewer stopped reading, and on a phone that is the bottom of a
            very long column (§11). */}
        <DecisionBar
          review={review}
          disabled={!canReview}
          isWorking={isWorking}
          onClaim={claim}
          onDecide={setPendingDecision}
          onBackToQueue={() => navigate(returnTo)}
          remaining={remaining}
        />

        {!isOpenCase(review) && review.reviewedAt ? (
          <Stack sx={{ mt: 2 }}>
            <Typography variant="caption" color="text.secondary">
              This case was decided. Re-opening it is the creator’s move — they edit the
              submission and send it back for review.
            </Typography>
          </Stack>
        ) : null}

        <DecisionDialogs
          decision={pendingDecision}
          subjectType={review.subjectType}
          subjectTitle={title}
          onConfirm={decide}
          onClose={() => setPendingDecision(null)}
        />
      </AdminPageGuard>
    </DashboardPage>
  )
}
