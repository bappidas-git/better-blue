import { useCallback, useMemo, useState } from 'react'

import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Tab from '@mui/material/Tab'
import Tabs from '@mui/material/Tabs'
import { useParams } from 'react-router-dom'

import StatusChip from '@/components/data-display/StatusChip'
import ErrorState from '@/components/feedback/ErrorState'
import CardSkeleton from '@/components/feedback/skeletons/CardSkeleton'
import { REQUEST_STATUS } from '@/constants/statuses'
import ProposalReviewPanel from '@/features/proposals/components/ProposalReviewPanel'
import RequestActivityTimeline from '@/features/requests/components/RequestActivityTimeline'
import RequestBriefPanel from '@/features/requests/components/RequestBriefPanel'
import useRequestActions, { REQUEST_ACTION } from '@/features/requests/hooks/useRequestActions'
import { requestActions } from '@/features/requests/utils/requestDisplay'
import { useAuth } from '@/context/AuthContext'
import useApiQuery from '@/hooks/useApiQuery'
import DashboardPage from '@/layouts/dashboard/DashboardPage'
import { paths } from '@/routes/paths'
import { categoryService } from '@/services/categoryService'
import { proposalService } from '@/services/proposalService'
import { requestService } from '@/services/requestService'
import { formatNumber } from '@/utils/formatters'

// One brief, and the decision that ends it.
//
// Three tabs, because a buyer arrives here for one of three reasons: to reread
// what they asked for, to choose between the people who answered, or to check
// what has happened so far. Proposals is the default — it is the only tab with
// anything to *do* in it.

const TAB = Object.freeze({ DETAILS: 'details', PROPOSALS: 'proposals', ACTIVITY: 'activity' })

/** Statuses whose proposals are still worth loading — a draft has none. */
const HAS_PROPOSALS = [
  REQUEST_STATUS.OPEN,
  REQUEST_STATUS.AWARDED,
  REQUEST_STATUS.COMPLETED,
  REQUEST_STATUS.CLOSED,
  REQUEST_STATUS.CANCELLED,
]

export default function BuyerRequestDetailPage() {
  const { requestId } = useParams()
  const { user } = useAuth()
  const buyerId = user?.id

  const [tab, setTab] = useState(TAB.PROPOSALS)

  const {
    data: request,
    isLoading,
    error,
    refetch,
  } = useApiQuery(() => requestService.getById(requestId), [requestId], {
    enabled: Boolean(requestId),
  })

  // A draft has no proposals by construction, so the second request is skipped
  // rather than asked and answered with an empty array.
  const wantsProposals = HAS_PROPOSALS.includes(request?.status)

  const {
    data: proposalList,
    isLoading: proposalsLoading,
    error: proposalsError,
    refetch: refetchProposals,
  } = useApiQuery(() => proposalService.listForRequestReview(requestId), [requestId], {
    enabled: Boolean(requestId) && wantsProposals,
  })

  const { data: categories } = useApiQuery(() => categoryService.listActive(), [])
  const categoryLabel = useMemo(
    () => (categories ?? []).find((category) => category.id === request?.categoryId)?.name,
    [categories, request?.categoryId]
  )

  const refreshAll = useCallback(() => {
    refetch()
    refetchProposals()
  }, [refetch, refetchProposals])

  const { run } = useRequestActions({ buyerId, onChanged: refreshAll })

  const proposals = proposalList?.items ?? []
  const actions = requestActions(request)

  /* -- loading and failure ----------------------------------------------- */

  if (error) {
    return (
      <DashboardPage title="Request" backTo={paths.BUYER_REQUESTS}>
        <ErrorState
          title="We could not open this request"
          message="It may have been removed, or the link may be wrong. Your other requests are unaffected."
          error={error}
          onRetry={refetch}
        />
      </DashboardPage>
    )
  }

  if (isLoading || !request) {
    return (
      <DashboardPage title="Request" backTo={paths.BUYER_REQUESTS}>
        <CardSkeleton media={false} lines={5} label="Loading this request" />
      </DashboardPage>
    )
  }

  // SECURITY: a UX guard only (00 §11) — it stops a mistyped or shared link
  // showing another business's brief. The API must scope the read as well.
  if (buyerId && request.buyerId !== buyerId) {
    return (
      <DashboardPage title="Request" backTo={paths.BUYER_REQUESTS}>
        <ErrorState
          title="This request is not yours"
          message="It belongs to another BetterBlue account, so we cannot show it here."
        />
      </DashboardPage>
    )
  }

  /* -- header actions ----------------------------------------------------- */

  const headerActions = (
    <>
      {actions.canEdit ? (
        <Button
          variant="outlined"
          onClick={() => run(REQUEST_ACTION.EDIT, request)}
          startIcon={<Icon icon="tabler:pencil" width={18} aria-hidden="true" />}
        >
          Edit draft
        </Button>
      ) : null}
      {actions.canPublish ? (
        <Button
          variant="gradient"
          onClick={() => run(REQUEST_ACTION.PUBLISH, request)}
          startIcon={<Icon icon="tabler:send" width={18} aria-hidden="true" />}
        >
          Publish
        </Button>
      ) : null}
      {actions.canClose ? (
        <Button color="inherit" onClick={() => run(REQUEST_ACTION.CLOSE, request)}>
          Close request
        </Button>
      ) : null}
      {actions.canCancel ? (
        <Button color="error" onClick={() => run(REQUEST_ACTION.CANCEL, request)}>
          Cancel
        </Button>
      ) : null}
      {actions.canDiscard ? (
        <Button color="error" onClick={() => run(REQUEST_ACTION.DISCARD, request)}>
          Discard draft
        </Button>
      ) : null}
    </>
  )

  const proposalCount = wantsProposals ? proposals.length : 0

  return (
    <DashboardPage
      title={request.title}
      documentTitle={request.title}
      subtitle={
        request.status === REQUEST_STATUS.OPEN
          ? 'Review the proposals, shortlist the ones you like, and award the work.'
          : undefined
      }
      backTo={paths.BUYER_REQUESTS}
      meta={<StatusChip status={request.status} tooltip />}
      actions={headerActions}
    >
      <Tabs
        value={tab}
        onChange={(event, next) => setTab(next)}
        variant="scrollable"
        scrollButtons="auto"
        allowScrollButtonsMobile
        aria-label="Request sections"
        sx={{ borderBottom: 1, borderColor: 'divider', mb: { xs: 2.5, md: 3 } }}
      >
        <Tab
          value={TAB.PROPOSALS}
          label={
            proposalCount > 0 ? `Proposals (${formatNumber(proposalCount)})` : 'Proposals'
          }
          sx={{ minHeight: 48, textTransform: 'none', fontWeight: 600 }}
        />
        <Tab
          value={TAB.DETAILS}
          label="Details"
          sx={{ minHeight: 48, textTransform: 'none', fontWeight: 600 }}
        />
        <Tab
          value={TAB.ACTIVITY}
          label="Activity"
          sx={{ minHeight: 48, textTransform: 'none', fontWeight: 600 }}
        />
      </Tabs>

      {/* Each panel is mounted only while selected: the proposals grid is the
          heaviest thing on the page, and keeping three panels alive to preserve
          scroll position is not worth the cost on a phone. */}
      <Box role="tabpanel" aria-label={tab}>
        {tab === TAB.PROPOSALS ? (
          <ProposalReviewPanel
            request={request}
            proposals={proposals}
            isLoading={wantsProposals && proposalsLoading}
            error={wantsProposals ? proposalsError : null}
            onRefetch={refreshAll}
            buyerId={buyerId}
          />
        ) : null}

        {tab === TAB.DETAILS ? (
          <RequestBriefPanel request={request} categoryLabel={categoryLabel} />
        ) : null}

        {tab === TAB.ACTIVITY ? (
          <RequestActivityTimeline request={request} proposals={proposals} />
        ) : null}
      </Box>
    </DashboardPage>
  )
}
