import { useCallback, useMemo, useState } from 'react'

import Badge from '@mui/material/Badge'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Tab from '@mui/material/Tab'
import Tabs from '@mui/material/Tabs'
import { useLocation, useNavigate } from 'react-router-dom'

import PaginationControl from '@/components/data-display/PaginationControl'
import EmptyState from '@/components/feedback/EmptyState'
import ErrorState from '@/components/feedback/ErrorState'
import ListSkeleton from '@/components/feedback/skeletons/ListSkeleton'
import { useToast } from '@/components/feedback/ToastProvider'
import FilterChipGroup from '@/components/inputs/FilterChipGroup'
import FormDateField from '@/components/inputs/FormDateField'
import FormSelect from '@/components/inputs/FormSelect'
import SearchInput from '@/components/inputs/SearchInput'
import SortSelect from '@/components/inputs/SortSelect'
import { PERMISSIONS, hasPermission } from '@/constants/permissions'
import { useAuth } from '@/context/AuthContext'
import { AdminPageGuard } from '@/features/admin/shared'
import QueueCard from '@/features/admin/moderation/components/QueueCard'
import ReportDetailSheet from '@/features/admin/moderation/components/ReportDetailSheet'
import ReportsTab from '@/features/admin/moderation/components/ReportsTab'
import {
  MODERATION_PARAMS,
  MODERATION_TAB,
  MODERATION_TABS,
  QUEUE_PAGE_SIZE,
  QUEUE_SORT_OPTIONS,
  REPORTS_PARAMS,
  REPORT_STATUS_OPTIONS,
  REPORT_SUBJECT_OPTIONS,
  REVIEW_STATUS_OPTIONS,
  moderationTab,
  orderFor,
  slaThresholds,
  statusesFor,
} from '@/features/admin/moderation/utils/moderationQueue'
import useApiQuery from '@/hooks/useApiQuery'
import useListParams from '@/hooks/useListParams'
import DashboardPage from '@/layouts/dashboard/DashboardPage'
import { paths } from '@/routes/paths'
import { categoryService } from '@/services/categoryService'
import { moderationService } from '@/services/moderationService'
import { reportService } from '@/services/reportService'
import { settingsService } from '@/services/settingsService'

// The Trust & Safety workspace — Prompt 30 §4.2.
//
// Three queues on one screen, because they are one job: content waiting for a
// first look, deliverables pulled out of auto-approval, and members telling us
// to look at something already live. Splitting them across three routes would
// mean three places to check whether the afternoon is clear.
//
// The screen is deliberately calm (§6). No counts in red, no "urgent" styling,
// no exclamation marks — the only tension on the page is an `AgeBadge` turning
// amber, and it does that against the SLA an admin configured rather than
// against a number invented here.
//
// It does **not** use `AdminListPage`: that component's toolbar has one
// chip-group filter and no tabs, and this screen has tabs, two chip groups, a
// category select, and a date range. That is the case its own header calls out
// — copy the pattern rather than bend the component.

/** Fallback turnaround when `platformSettings` cannot be read (§13). */
const DEFAULT_SLA_DAYS = 2

/** What a reader without the tab's permission sees instead of its queue. */
function NoAccessNotice({ title, description }) {
  return (
    <EmptyState
      icon="solar:lock-keyhole-minimalistic-linear"
      title={title}
      description={description}
    />
  )
}

/**
 * @param {object} props
 * @param {boolean} [props.reportsFirst=false] mounted at `/admin/reports`, so an
 *   unparameterised visit opens on the reports tab
 */
export default function AdminModerationPage({ reportsFirst = false }) {
  const { user: actor } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const location = useLocation()

  const schema = reportsFirst ? REPORTS_PARAMS : MODERATION_PARAMS
  const { values, setValue, setValues, clearFilters, isFiltered } = useListParams(schema)
  const { tab, q, status, category, subject, from, to, sort, page } = values

  const [openReport, setOpenReport] = useState(null)

  const current = moderationTab(tab)
  const isReports = current.key === MODERATION_TAB.REPORTS
  const canReview = hasPermission(actor, PERMISSIONS.MODERATION_REVIEW)
  const canManageReports = hasPermission(actor, PERMISSIONS.REPORTS_MANAGE)

  /* -- shared context ------------------------------------------------------ */

  const { data: settings } = useApiQuery(() => settingsService.getSettings().catch(() => null), [])
  const sla = useMemo(
    () => slaThresholds(settings?.moderation?.reviewSlaDays ?? DEFAULT_SLA_DAYS),
    [settings]
  )

  const { data: categories } = useApiQuery(() => categoryService.listActive().catch(() => []), [])
  const categoryOptions = useMemo(
    () => [
      { value: '', label: 'All categories' },
      ...(categories ?? []).map((entry) => ({ value: entry.id, label: entry.name })),
    ],
    [categories]
  )
  const categoryNameFor = useCallback(
    (id) => categories?.find((entry) => entry.id === id)?.name ?? id,
    [categories]
  )

  const {
    data: counts,
    isLoading: countsLoading,
    refetch: refetchCounts,
  } = useApiQuery(() => moderationService.getQueueCounts(), [])

  /* -- the queue ----------------------------------------------------------- */

  const statuses = useMemo(() => statusesFor(current.key, status), [current.key, status])
  const order = orderFor(sort)

  const {
    data: board,
    isLoading,
    error,
    refetch,
  } = useApiQuery(
    () =>
      isReports
        ? reportService.listReportBoard({
            statuses,
            subjectType: subject || undefined,
            search: q || undefined,
            from: from || undefined,
            to: to || undefined,
            order,
            page,
            limit: QUEUE_PAGE_SIZE,
          })
        : moderationService.listReviewBoard({
            subjectType: current.subjectType,
            statuses,
            categoryId: category || undefined,
            search: q || undefined,
            from: from || undefined,
            to: to || undefined,
            order,
            page,
            limit: QUEUE_PAGE_SIZE,
          }),
    [current.key, current.subjectType, statuses, category, subject, q, from, to, order, page, isReports]
  )

  // Memoised: `openReview` hands the queue's own ordering to the review screen,
  // and a new array each render would rebuild that callback every time.
  const items = useMemo(() => board?.items ?? [], [board])

  /* -- the report sheet ---------------------------------------------------- */

  const {
    data: reportContext,
    isLoading: reportLoading,
    refetch: refetchReport,
  } = useApiQuery(
    () => reportService.getReportContext(openReport.id),
    [openReport?.id],
    { enabled: Boolean(openReport?.id) }
  )

  const dismissReport = useCallback(
    async (note) => {
      await reportService.dismissReport(openReport.id, { note, actor })
      toast.success('Report dismissed.', {
        description: 'It is closed, and the outcome is in the audit trail.',
      })
      setOpenReport(null)
      refetch()
      refetchCounts()
    },
    [actor, openReport, refetch, refetchCounts, toast]
  )

  const actionReport = useCallback(
    async (note) => {
      const result = await reportService.actionReport(openReport.id, { note, actor })
      setOpenReport(null)
      refetch()
      refetchCounts()

      if (result.review) {
        toast.success(
          result.created ? 'Review case opened.' : 'This content is already in the queue.',
          { description: 'Taking you to it now.' }
        )
        navigate(paths.adminModerationDetail(result.review.id))
        return
      }

      toast.success('Report recorded as actioned.', {
        description: 'Act on the account or the brief from the links on the report.',
      })
      refetchReport()
    },
    [actor, navigate, openReport, refetch, refetchCounts, refetchReport, toast]
  )

  /* -- rendering ----------------------------------------------------------- */

  const openReview = useCallback(
    (review) =>
      navigate(paths.adminModerationDetail(review.id), {
        // The detail screen auto-advances through the queue the reviewer was
        // actually looking at, filters and sort included — not through some
        // canonical order they never chose (§4.3).
        state: {
          queue: items.map((entry) => entry.id),
          returnTo: `${location.pathname}${location.search}`,
          filters: { subjectType: current.subjectType, statuses, order },
        },
      }),
    [current.subjectType, items, location.pathname, location.search, navigate, order, statuses]
  )

  const emptyState = isFiltered || q
    ? {
        icon: 'tabler:search-off',
        title: 'Nothing matches those filters',
        description: 'Try a wider date range, another status, or a shorter search term.',
        primaryAction: { label: 'Clear filters', onClick: () => clearFilters(), variant: 'outlined' },
      }
    : isReports
      ? {
          icon: 'solar:check-circle-linear',
          title: 'No reports waiting',
          description:
            'Nothing has been reported that still needs a decision. Reports arrive here the moment a member files one.',
        }
      : {
          icon: 'solar:check-circle-linear',
          title: 'Queue clear',
          description:
            'Nothing is waiting on us. Submitted content appears here as soon as a creator sends it for review.',
        }

  const toolbar = (
    <Stack spacing={1.5}>
      <Stack
        direction={{ xs: 'column', lg: 'row' }}
        spacing={1.5}
        alignItems={{ xs: 'stretch', lg: 'center' }}
      >
        <Box sx={{ flexGrow: 1, minWidth: 0, maxWidth: { lg: 320 } }}>
          <SearchInput
            value={q}
            onChange={(next) => setValue('q', next)}
            placeholder={isReports ? 'Search reports' : 'Search by title or creator'}
            label={isReports ? 'Search reports' : 'Search the queue by title or creator'}
          />
        </Box>

        <FilterChipGroup
          label="Status"
          options={isReports ? REPORT_STATUS_OPTIONS : REVIEW_STATUS_OPTIONS}
          multiple
          value={status}
          onChange={(next) => setValue('status', next)}
          size="sm"
        />

        <SortSelect
          value={sort}
          onChange={(next) => setValue('sort', next)}
          options={QUEUE_SORT_OPTIONS}
        />
      </Stack>

      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1.5}
        alignItems={{ xs: 'stretch', sm: 'center' }}
      >
        {isReports ? (
          <FilterChipGroup
            label="Reported"
            options={REPORT_SUBJECT_OPTIONS}
            value={subject || null}
            onChange={(next) => setValue('subject', next ?? '')}
            size="sm"
          />
        ) : current.key === MODERATION_TAB.PORTFOLIO ? (
          <Box sx={{ minWidth: { sm: 220 } }}>
            <FormSelect
              label="Category"
              size="small"
              value={category}
              onChange={(next) => setValue('category', next)}
              options={categoryOptions}
            />
          </Box>
        ) : null}

        <Stack direction="row" spacing={1} sx={{ minWidth: { sm: 320 } }}>
          <FormDateField
            label={isReports ? 'Reported from' : 'Submitted from'}
            value={from}
            onChange={(next) => setValue('from', next ?? '')}
            maxDate={to || undefined}
          />
          <FormDateField
            label={isReports ? 'Reported to' : 'Submitted to'}
            value={to}
            onChange={(next) => setValue('to', next ?? '')}
            minDate={from || undefined}
          />
        </Stack>
      </Stack>
    </Stack>
  )

  const reviewQueue = () => {
    if (error) {
      return (
        <ErrorState
          title="We could not load this queue"
          message="Nothing has been lost — the cases are waiting, this list just failed to fetch."
          error={error}
          onRetry={refetch}
        />
      )
    }

    if (isLoading) return <ListSkeleton rows={5} label="Loading the review queue" />

    if (items.length === 0) return <EmptyState {...emptyState} />

    return (
      <Stack spacing={{ xs: 1.5, md: 2 }}>
        <Stack component="ul" spacing={{ xs: 1.5, md: 2 }} sx={{ listStyle: 'none', m: 0, p: 0 }}>
          {items.map((review) => (
            <QueueCard
              key={review.id}
              review={review}
              categoryNameFor={categoryNameFor}
              sla={sla}
              onOpen={() => openReview(review)}
            />
          ))}
        </Stack>

        <PaginationControl
          page={board?.page ?? 1}
          pageSize={QUEUE_PAGE_SIZE}
          total={board?.total ?? 0}
          onPageChange={(next) => setValues({ page: next })}
          itemLabel="cases"
          hideOnSinglePage
        />
      </Stack>
    )
  }

  return (
    <DashboardPage
      title="Moderation"
      subtitle="Content review and member reports, oldest first."
      maxWidth={false}
    >
      <AdminPageGuard permission={[PERMISSIONS.MODERATION_REVIEW, PERMISSIONS.REPORTS_MANAGE]}>
        <Tabs
          value={current.key}
          onChange={(event, next) => setValues({ tab: next, status: [] })}
          variant="scrollable"
          scrollButtons="auto"
          allowScrollButtonsMobile
          aria-label="Moderation queues"
          sx={{ borderBottom: 1, borderColor: 'divider', mb: { xs: 2, md: 2.5 } }}
        >
          {MODERATION_TABS.map((entry) => {
            const count = counts?.[entry.countKey]
            return (
              <Tab
                key={entry.key}
                value={entry.key}
                sx={{ minHeight: 48, textTransform: 'none', fontWeight: 600 }}
                label={
                  <Badge
                    // A count that could not be read renders no badge at all —
                    // a `0` there would read as "nothing waiting" (§13).
                    badgeContent={countsLoading || count == null ? 0 : count}
                    color="primary"
                    max={99}
                    sx={{ '& .MuiBadge-badge': { right: -14, top: 2 } }}
                  >
                    <Box component="span" sx={{ pr: count ? 2 : 0 }}>
                      {entry.label}
                    </Box>
                  </Badge>
                }
              />
            )
          })}
        </Tabs>

        <Stack spacing={{ xs: 2, md: 2.5 }}>
          {toolbar}

          <Box
            role="region"
            aria-live="polite"
            aria-label={`${current.label} queue`}
          >
            {isReports ? (
              canManageReports ? (
                <ReportsTab
                  items={items}
                  loading={isLoading}
                  error={error}
                  onRetry={refetch}
                  emptyState={emptyState}
                  onOpen={setOpenReport}
                  sla={sla}
                  pagination={{
                    page: board?.page ?? 1,
                    pageSize: QUEUE_PAGE_SIZE,
                    total: board?.total ?? 0,
                    onPageChange: (next) => setValues({ page: next }),
                    itemLabel: 'reports',
                  }}
                />
              ) : (
                <NoAccessNotice
                  title="You do not have access to reports"
                  description="Reviewing content does not include triaging member reports. Ask a super admin for the “Handle reports” permission."
                />
              )
            ) : canReview ? (
              reviewQueue()
            ) : (
              <NoAccessNotice
                title="You do not have access to the review queues"
                description="Handling reports does not include reviewing content. Ask a super admin for the “Review content” permission."
              />
            )}
          </Box>
        </Stack>

        <ReportDetailSheet
          open={Boolean(openReport)}
          onClose={() => setOpenReport(null)}
          context={reportContext}
          isLoading={reportLoading}
          canManage={canManageReports}
          onDismiss={dismissReport}
          onAction={actionReport}
        />
      </AdminPageGuard>
    </DashboardPage>
  )
}
