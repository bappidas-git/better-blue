import { useCallback, useState } from 'react'

import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import Link from '@mui/material/Link'
import Stack from '@mui/material/Stack'
import Tab from '@mui/material/Tab'
import Tabs from '@mui/material/Tabs'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import { useParams } from 'react-router-dom'

import StatusChip from '@/components/data-display/StatusChip'
import TimelineList from '@/components/data-display/TimelineList'
import UserAvatar from '@/components/data-display/UserAvatar'
import EmptyState from '@/components/feedback/EmptyState'
import ErrorState from '@/components/feedback/ErrorState'
import CardSkeleton from '@/components/feedback/skeletons/CardSkeleton'
import { useConfirm } from '@/components/feedback/ConfirmDialogProvider'
import { useToast } from '@/components/feedback/ToastProvider'
import StickyActionBar from '@/components/layout/StickyActionBar'
import { AUDIT_ACTION } from '@/constants/auditActions'
import { PERMISSIONS } from '@/constants/permissions'
import { ROLES } from '@/constants/roles'
import { ACCOUNT_STATUS, STATUS_META } from '@/constants/statuses'
import { useAuth } from '@/context/AuthContext'
import { AdminPageGuard, EntityRefChip } from '@/features/admin/shared'
import { categoryLabel } from '@/features/disputes/utils/disputeDisplay'
import AccountActionDialogs from '@/features/admin/users/components/AccountActionDialogs'
import RoleProfilePanel from '@/features/admin/users/components/RoleProfilePanel'
import UserAggregates from '@/features/admin/users/components/UserAggregates'
import UserStatusBanner from '@/features/admin/users/components/UserStatusBanner'
import { actionsFor, verifyConfirmOptions } from '@/features/admin/users/utils/accountActions'
import { roleLabel } from '@/features/admin/users/utils/userDirectory'
import useApiQuery from '@/hooks/useApiQuery'
import DashboardPage from '@/layouts/dashboard/DashboardPage'
import { PermissionGate } from '@/routes/guards'
import { paths } from '@/routes/paths'
import { auditService } from '@/services/auditService'
import { categoryService } from '@/services/categoryService'
import { disputeService } from '@/services/disputeService'
import { moderationService } from '@/services/moderationService'
import { orderService } from '@/services/orderService'
import { canAdminManageAccount, userService } from '@/services/userService'
import { EMPTY_PLACEHOLDER, formatCurrency, formatDate, formatDateTime } from '@/utils/formatters'

// One account, from the admin's chair — Prompt 29 §4.3.
//
// The header answers "who is this and can they trade"; the tabs answer
// "should anything change". Four of them, and the third only exists for
// creators — a buyer has no moderation history, and an empty tab that can never
// fill is worse than no tab.
//
// Everything the page can *do* is one of four service calls, all guarded twice:
// `PermissionGate` hides the buttons from an admin without `users.manage`, and
// `canAdminManageAccount` hides them for a target nobody may act on from here —
// while `userService` re-checks both before it writes (§7). The screen is a
// convenience, never the rule (00 §11).

/** Rows in each activity list. Enough to see a pattern, not a second table. */
const RECENT_LIMIT = 5

const TAB = Object.freeze({
  PROFILE: 'profile',
  ACTIVITY: 'activity',
  MODERATION: 'moderation',
  AUDIT: 'audit',
})

/**
 * How an audit verb reads in a sentence. Unknown verbs print themselves.
 *
 * Keyed off `AUDIT_ACTION` since Prompt 36 — the account tab shows the handful
 * of verbs that land on a `user` record, and spelling them here rather than
 * importing the constants was how `admin.suspend` came to be missing from the
 * list the day it was added.
 */
const AUDIT_LABEL = Object.freeze({
  [AUDIT_ACTION.USER_SUSPEND]: 'Account suspended',
  [AUDIT_ACTION.USER_BLACKLIST]: 'Account blacklisted',
  [AUDIT_ACTION.USER_REACTIVATE]: 'Account reactivated',
  [AUDIT_ACTION.USER_VERIFY]: 'Verification updated',
  [AUDIT_ACTION.USER_DEACTIVATE]: 'Account closed by the member',
  [AUDIT_ACTION.ADMIN_CREATE]: 'Admin account created',
  [AUDIT_ACTION.ADMIN_PERMISSIONS_UPDATE]: 'Permissions changed',
  [AUDIT_ACTION.ADMIN_SUSPEND]: 'Team access suspended',
  [AUDIT_ACTION.ADMIN_REACTIVATE]: 'Team access restored',
})

/** Tone per verb, so a suspension and a reinstatement do not look identical. */
const AUDIT_TONE = Object.freeze({
  [AUDIT_ACTION.USER_SUSPEND]: 'warning',
  [AUDIT_ACTION.USER_BLACKLIST]: 'error',
  [AUDIT_ACTION.USER_REACTIVATE]: 'success',
  [AUDIT_ACTION.USER_VERIFY]: 'info',
  [AUDIT_ACTION.ADMIN_SUSPEND]: 'warning',
  [AUDIT_ACTION.ADMIN_REACTIVATE]: 'success',
})

/**
 * `intellectual_property` → `Intellectual property`.
 *
 * Report reasons and moderation subject types are the two enum families with no
 * `STATUS_META` entry (they are not statuses), and an admin screen is not the
 * place to print a snake_case token. Deliberately not a new constants module:
 * Prompt 30 owns those vocabularies and will give them proper labels.
 */
function humanizeToken(value) {
  const text = String(value ?? '').replace(/_/g, ' ').trim()
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : EMPTY_PLACEHOLDER
}

export default function AdminUserDetailPage() {
  const { userId } = useParams()
  const { user: actor } = useAuth()
  const toast = useToast()
  const confirm = useConfirm()

  const [tab, setTab] = useState(TAB.PROFILE)
  const [pendingStatus, setPendingStatus] = useState(null)
  const [copied, setCopied] = useState(false)

  const {
    data: bundle,
    isLoading,
    error,
    refetch,
  } = useApiQuery(() => userService.adminGetUserBundle(userId), [userId], {
    enabled: Boolean(userId),
  })

  const user = bundle?.user
  const profile = bundle?.profile
  const isCreator = user?.role === ROLES.CREATOR

  // MOCK-JOIN: the banner names the colleague who made the change, and the
  // account only stores their id. One extra read, failing to "our team".
  const changedById = user?.statusChangedById
  const { data: statusActor } = useApiQuery(
    () => userService.getById(changedById).catch(() => null),
    [changedById],
    { enabled: Boolean(changedById) }
  )

  const { data: orders } = useApiQuery(
    () =>
      orderService
        .list({
          page: 1,
          limit: RECENT_LIMIT,
          sort: 'createdAt',
          order: 'desc',
          filters: { [isCreator ? 'creatorId' : 'buyerId']: user.id },
        })
        .catch(() => null),
    [user?.id, isCreator],
    { enabled: Boolean(user?.id) }
  )

  const { data: disputes } = useApiQuery(
    () => disputeService.listByUser(user.id, { page: 1, limit: RECENT_LIMIT }).catch(() => null),
    [user?.id],
    { enabled: Boolean(user?.id) }
  )

  const { data: moderation } = useApiQuery(
    () =>
      moderationService
        .list({ page: 1, limit: RECENT_LIMIT, filters: { creatorId: user.id } })
        .catch(() => null),
    [user?.id],
    { enabled: Boolean(user?.id) && isCreator }
  )

  const {
    data: audit,
    isLoading: auditLoading,
    refetch: refetchAudit,
  } = useApiQuery(
    () =>
      auditService
        .list({ page: 1, limit: 25, filters: { entityType: 'user', entityId: user.id } })
        .catch(() => null),
    [user?.id],
    { enabled: Boolean(user?.id) }
  )

  // Categories are stored as ids on the storefront; `listActive` is cached, so
  // this is one request for the whole console session. A failure leaves the ids
  // on screen, which is still readable.
  const { data: categories } = useApiQuery(
    () => categoryService.listActive().catch(() => []),
    [],
    { enabled: isCreator }
  )
  const categoryNameFor = useCallback(
    (id) => categories?.find((category) => category.id === id)?.name ?? id,
    [categories]
  )

  const manage = canAdminManageAccount(user, actor)

  const refreshAll = useCallback(() => {
    refetch()
    refetchAudit()
  }, [refetch, refetchAudit])

  const applyStatus = useCallback(
    async ({ status, reason }) => {
      const updated = await userService.adminSetAccountStatus(user.id, { status, reason, actor })
      toast.success(
        `${user.name} is now ${STATUS_META[status]?.label?.toLowerCase() ?? status}.`,
        { description: 'They have been notified, and the change is in the audit trail.' }
      )
      refreshAll()
      return updated
    },
    [actor, refreshAll, toast, user]
  )

  const toggleVerified = useCallback(async () => {
    const next = !profile?.verified
    const ok = await confirm(verifyConfirmOptions(user, next))
    if (!ok) return

    try {
      await userService.adminSetCreatorVerified(profile.id, { verified: next, actor })
      toast.success(next ? 'Creator verified.' : 'Verified badge removed.', {
        description: 'Their storefront and discovery card update immediately.',
      })
      refreshAll()
    } catch (failure) {
      toast.error(failure?.message ?? 'We could not change the verified badge.')
    }
  }, [actor, confirm, profile, refreshAll, toast, user])

  const copyEmail = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(user.email)
      setCopied(true)
      toast.success('Email address copied.')
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard access can be refused; the address is on screen either way.
      toast.error('We could not copy it — select the address and copy manually.')
    }
  }, [toast, user])

  /* -- loading and failure ------------------------------------------------- */

  if (error) {
    return (
      <DashboardPage title="Account" backTo={paths.ADMIN_USERS} maxWidth="lg">
        <ErrorState
          title="We could not open this account"
          message="It may have been removed, or the link may be wrong. The directory is unaffected."
          error={error}
          onRetry={refetch}
        />
      </DashboardPage>
    )
  }

  if (isLoading || !user) {
    return (
      <DashboardPage title="Account" backTo={paths.ADMIN_USERS} maxWidth="lg">
        <CardSkeleton media={false} lines={6} label="Loading this account" />
      </DashboardPage>
    )
  }

  /* -- actions ------------------------------------------------------------- */

  // The same descriptors the directory's kebab reads, so the two surfaces can
  // never offer a different set of actions on the same account.
  const statusActions = actionsFor(user, actor)

  const actionButtons = (
    <PermissionGate permission={PERMISSIONS.USERS_MANAGE}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1}
        sx={{ width: { xs: '100%', sm: 'auto' } }}
      >
        {isCreator && profile && manage.allowed ? (
          <Button
            variant="outlined"
            onClick={toggleVerified}
            fullWidth
            startIcon={<Icon icon="solar:verified-check-linear" width={18} aria-hidden="true" />}
          >
            {profile.verified ? 'Remove verification' : 'Verify creator'}
          </Button>
        ) : null}

        {statusActions.map((action) => (
          <Button
            key={action.key}
            variant={action.key === ACCOUNT_STATUS.ACTIVE ? 'contained' : 'outlined'}
            color={action.color}
            fullWidth
            onClick={() => setPendingStatus(action.key)}
            startIcon={<Icon icon={action.icon} width={18} aria-hidden="true" />}
          >
            {action.shortLabel}
          </Button>
        ))}
      </Stack>
    </PermissionGate>
  )

  /* -- panels -------------------------------------------------------------- */

  const identityCard = (
    <Card component="section" aria-labelledby="account-identity-heading">
      <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2.5}
          alignItems={{ xs: 'flex-start', sm: 'center' }}
        >
          <UserAvatar name={user.name} src={user.avatarUrl} size="xl" />

          <Box sx={{ minWidth: 0, flexGrow: 1 }}>
            <Typography id="account-identity-heading" variant="h6" component="h2" sx={{ fontWeight: 700 }}>
              {user.name}
            </Typography>

            <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: 0.5 }}>
              <Typography variant="body2" color="text.secondary" sx={{ wordBreak: 'break-all' }}>
                {user.email}
              </Typography>
              <Tooltip title={copied ? 'Copied' : 'Copy email address'}>
                <IconButton
                  size="small"
                  onClick={copyEmail}
                  aria-label={`Copy ${user.name}’s email address`}
                >
                  <Icon
                    icon={copied ? 'solar:check-circle-linear' : 'solar:copy-linear'}
                    width={16}
                    aria-hidden="true"
                  />
                </IconButton>
              </Tooltip>
            </Stack>

            <Stack direction="row" spacing={1} sx={{ mt: 1.5 }} flexWrap="wrap" useFlexGap>
              <Chip size="small" variant="outlined" label={roleLabel(user.role)} />
              <StatusChip status={user.accountStatus} size="sm" tooltip />
              {isCreator && profile?.verified ? (
                <Chip
                  size="small"
                  color="primary"
                  variant="outlined"
                  icon={<Icon icon="solar:verified-check-bold" width={15} aria-hidden="true" />}
                  label="Verified"
                />
              ) : null}
              <Chip
                size="small"
                variant="outlined"
                label={`Joined ${formatDate(user.createdAt)}`}
              />
            </Stack>

            {isCreator && profile ? (
              <Link
                href={paths.creatorProfile(profile.id)}
                target="_blank"
                rel="noopener noreferrer"
                variant="body2"
                underline="hover"
                sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, mt: 1.5 }}
              >
                <Icon icon="solar:arrow-right-up-linear" width={16} aria-hidden="true" />
                Open their public profile
              </Link>
            ) : null}
          </Box>

          {/* Desktop keeps the actions beside the identity; below `md` they move
              into the sticky bar at the bottom of the page, which is exactly
              where `StickyActionBar`'s `mobileOnly` stops rendering (§11). */}
          <Box sx={{ display: { xs: 'none', md: 'block' } }}>{actionButtons}</Box>
        </Stack>
      </CardContent>
    </Card>
  )

  const activityPanel = (
    <Stack spacing={{ xs: 2, md: 2.5 }}>
      <UserAggregates user={user} aggregates={bundle.aggregates} />

      <Card component="section" aria-labelledby="recent-orders-heading">
        <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
          <Typography id="recent-orders-heading" variant="subtitle2" component="h2" sx={{ mb: 2 }}>
            Recent orders
          </Typography>

          {(orders?.items ?? []).length === 0 ? (
            <EmptyState
              dense
              icon="solar:box-linear"
              title="No orders"
              description="This member has not been part of an engagement yet."
            />
          ) : (
            <Stack component="ul" spacing={1.5} sx={{ listStyle: 'none', m: 0, p: 0 }}>
              {orders.items.map((order) => (
                <Stack
                  key={order.id}
                  component="li"
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={1}
                  justifyContent="space-between"
                  alignItems={{ xs: 'flex-start', sm: 'center' }}
                >
                  {/* Plain text, not a link: `/admin/orders/:id` lands on the
                      dashboard 404 until Prompt 31 builds it, and
                      `entityRefs.js` keeps that case commented for the same
                      reason. Uncommenting it there turns every chip on this page
                      into a link with no change here. */}
                  <EntityRefChip type="order" id={order.id} label={order.title} />
                  <Stack direction="row" spacing={1} alignItems="center">
                    <StatusChip status={order.status} size="sm" />
                    <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                      {formatCurrency(order.price, order.currency)}
                    </Typography>
                  </Stack>
                </Stack>
              ))}
            </Stack>
          )}
        </CardContent>
      </Card>

      <Card component="section" aria-labelledby="recent-disputes-heading">
        <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
          <Typography id="recent-disputes-heading" variant="subtitle2" component="h2" sx={{ mb: 2 }}>
            Disputes
          </Typography>

          {(disputes?.items ?? []).length === 0 ? (
            <EmptyState
              dense
              icon="solar:shield-check-linear"
              title="No disputes"
              description="Neither this member nor anybody trading with them has raised a case."
            />
          ) : (
            <Stack component="ul" spacing={1.5} sx={{ listStyle: 'none', m: 0, p: 0 }}>
              {disputes.items.map((dispute) => (
                <Stack
                  key={dispute.id}
                  component="li"
                  direction="row"
                  spacing={1}
                  justifyContent="space-between"
                  alignItems="center"
                  flexWrap="wrap"
                  useFlexGap
                >
                  {/* Live since Prompt 33: the chip opens the case workspace. */}
                  <EntityRefChip type="dispute" id={dispute.id} label={categoryLabel(dispute.category)} />
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="caption" color="text.secondary">
                      {dispute.raisedById === user.id ? 'Raised by them' : 'Raised against them'}
                    </Typography>
                    <StatusChip status={dispute.status} size="sm" />
                  </Stack>
                </Stack>
              ))}
            </Stack>
          )}
        </CardContent>
      </Card>

      <Card component="section" aria-labelledby="reports-against-heading">
        <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
          <Typography id="reports-against-heading" variant="subtitle2" component="h2" sx={{ mb: 2 }}>
            Reports against this member
          </Typography>

          {(bundle.aggregates.reports ?? []).length === 0 ? (
            <EmptyState
              dense
              icon="solar:flag-linear"
              title="No reports"
              description="Nobody has reported this member’s profile, content, or briefs."
            />
          ) : (
            <Stack component="ul" spacing={1.5} sx={{ listStyle: 'none', m: 0, p: 0 }}>
              {bundle.aggregates.reports.map((report) => (
                <Stack
                  key={report.id}
                  component="li"
                  direction="row"
                  spacing={1}
                  justifyContent="space-between"
                  alignItems="center"
                  flexWrap="wrap"
                  useFlexGap
                >
                  {/* Links land in Prompt 30's reports queue. */}
                  <EntityRefChip type="report" id={report.id} label={humanizeToken(report.reason)} />
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="caption" color="text.secondary">
                      {formatDate(report.createdAt)}
                    </Typography>
                    <StatusChip status={report.status} size="sm" />
                  </Stack>
                </Stack>
              ))}
            </Stack>
          )}
        </CardContent>
      </Card>
    </Stack>
  )

  const moderationPanel = (
    <Card component="section" aria-labelledby="moderation-history-heading">
      <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
        <Typography id="moderation-history-heading" variant="subtitle2" component="h2" sx={{ mb: 2 }}>
          Moderation history
        </Typography>

        {(moderation?.items ?? []).length === 0 ? (
          <EmptyState
            dense
            icon="tabler:shield-check"
            title="Nothing has been reviewed"
            description="Content this creator submits appears here with the decision our team recorded."
          />
        ) : (
          <Stack component="ul" spacing={1.5} sx={{ listStyle: 'none', m: 0, p: 0 }}>
            {moderation.items.map((review) => (
              <Stack
                key={review.id}
                component="li"
                direction="row"
                spacing={1}
                justifyContent="space-between"
                alignItems="center"
                flexWrap="wrap"
                useFlexGap
              >
                {/* Links land in Prompt 30's moderation console. */}
                <EntityRefChip type="moderation_review" id={review.id} label={humanizeToken(review.subjectType)} />
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography variant="caption" color="text.secondary">
                    {review.reviewedAt
                      ? `Decided ${formatDate(review.reviewedAt)}`
                      : `Submitted ${formatDate(review.submittedAt)}`}
                  </Typography>
                  <StatusChip status={review.status} size="sm" />
                </Stack>
              </Stack>
            ))}
          </Stack>
        )}
      </CardContent>
    </Card>
  )

  const auditPanel = (
    <Card component="section" aria-labelledby="audit-trail-heading">
      <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
        <Typography id="audit-trail-heading" variant="subtitle2" component="h2" sx={{ mb: 2 }}>
          Audit trail
        </Typography>

        <TimelineList
          dense
          emptyText={
            auditLoading
              ? 'Loading the trail…'
              : 'No administrative action has been taken on this account.'
          }
          items={(audit?.items ?? []).map((entry) => ({
            id: entry.id,
            title: AUDIT_LABEL[entry.action] ?? entry.action,
            description: entry.meta?.reason ?? undefined,
            timestamp: formatDateTime(entry.createdAt),
            tone: AUDIT_TONE[entry.action] ?? 'neutral',
          }))}
        />
      </CardContent>
    </Card>
  )

  const tabs = [
    {
      key: TAB.PROFILE,
      label: 'Profile',
      panel: (
        <RoleProfilePanel user={user} profile={profile} categoryNameFor={categoryNameFor} />
      ),
    },
    { key: TAB.ACTIVITY, label: 'Activity', panel: activityPanel },
    ...(isCreator ? [{ key: TAB.MODERATION, label: 'Moderation', panel: moderationPanel }] : []),
    { key: TAB.AUDIT, label: 'Audit trail', panel: auditPanel },
  ]

  const current = tabs.find((entry) => entry.key === tab) ?? tabs[0]

  return (
    <DashboardPage
      title={user.name}
      documentTitle={`${user.name} — account`}
      backTo={paths.ADMIN_USERS}
      maxWidth="lg"
    >
      <AdminPageGuard permission={PERMISSIONS.USERS_MANAGE}>
        <Stack spacing={{ xs: 2, md: 2.5 }}>
          <UserStatusBanner user={user} actor={statusActor} />

          {identityCard}

          {!manage.allowed ? (
            <Typography variant="caption" color="text.secondary">
              {manage.reason}
            </Typography>
          ) : null}

          <Box>
            <Tabs
              value={current.key}
              onChange={(event, next) => setTab(next)}
              variant="scrollable"
              scrollButtons="auto"
              allowScrollButtonsMobile
              aria-label="Account sections"
              sx={{ borderBottom: 1, borderColor: 'divider', mb: { xs: 2, md: 2.5 } }}
            >
              {tabs.map((entry) => (
                <Tab
                  key={entry.key}
                  value={entry.key}
                  label={entry.label}
                  id={`account-tab-${entry.key}`}
                  aria-controls={`account-panel-${entry.key}`}
                  sx={{ minHeight: 48, textTransform: 'none', fontWeight: 600 }}
                />
              ))}
            </Tabs>

            <Box
              role="tabpanel"
              id={`account-panel-${current.key}`}
              aria-labelledby={`account-tab-${current.key}`}
            >
              {current.panel}
            </Box>
          </Box>
        </Stack>

        {/* Below sm the header's buttons are off-screen by the time anybody has
            read the page, so they are repeated here (00 §12). */}
        {statusActions.length > 0 || (isCreator && profile && manage.allowed) ? (
          <StickyActionBar mobileOnly justify="space-between">
            {actionButtons}
          </StickyActionBar>
        ) : null}

        <AccountActionDialogs
          status={pendingStatus}
          user={user}
          onConfirm={applyStatus}
          onClose={() => setPendingStatus(null)}
        />
      </AdminPageGuard>
    </DashboardPage>
  )
}
