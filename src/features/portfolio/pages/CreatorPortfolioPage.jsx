import { useMemo, useState } from 'react'

import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'

import { visuallyHidden } from '@mui/utils'
import MediaLightbox from '@/components/data-display/MediaLightbox'
import EmptyState from '@/components/feedback/EmptyState'
import ErrorState from '@/components/feedback/ErrorState'
import { useConfirm } from '@/components/feedback/ConfirmDialogProvider'
import { useToast } from '@/components/feedback/ToastProvider'
import CardSkeleton from '@/components/feedback/skeletons/CardSkeleton'
import { imageUrl, IMAGE_SIZES } from '@/constants/images'
import { CONTENT_STATUS, VISIBILITY } from '@/constants/statuses'
import { useAuth } from '@/context/AuthContext'
import useApiMutation from '@/hooks/useApiMutation'
import useApiQuery from '@/hooks/useApiQuery'
import DashboardPage from '@/layouts/dashboard/DashboardPage'
import { categoryService } from '@/services/categoryService'
import { creatorProfileService } from '@/services/creatorProfileService'
import { portfolioService } from '@/services/portfolioService'
import { SETTINGS_FALLBACK, settingsService } from '@/services/settingsService'

import PortfolioItemDialog from '../components/PortfolioItemDialog'
import PortfolioManageCard from '../components/PortfolioManageCard'
import StatusSummaryChips from '../components/StatusSummaryChips'
import {
  DEFAULT_PORTFOLIO_FILTER,
  emptyStateCopy,
  matchesPortfolioFilter,
  PORTFOLIO_FILTER,
} from '../utils/statusFilters'

// The creator's portfolio manager — the private half of the gallery buyers see.
//
// Everything on this screen is one creator's own work, so it is loaded in a
// single read (`listManagedByCreator`) and filtered in the browser: the counts
// on the chips and the cards under them are then guaranteed to describe the
// same set, which two round trips could not promise.
//
// No status is moved here. Every action calls a named `portfolioService`
// operation that guards the move against `CONTENT_STATUS_MACHINE` and, for a
// submission, writes the moderation case in the same breath (00 §9, §10). The
// page's job is to decide what to *ask* — which is why the edit-republish
// confirmation lives here rather than in the dialog: it is a consequence of the
// action, not of the form.

/** Tiles drawn while the portfolio is in flight. */
const SKELETON_COUNT = 6

/** 2 columns at 360px, 3 from sm, 4 from lg — the public gallery's rhythm (§11). */
const gridSx = {
  display: 'grid',
  gridTemplateColumns: {
    xs: 'repeat(2, minmax(0, 1fr))',
    sm: 'repeat(3, minmax(0, 1fr))',
    lg: 'repeat(4, minmax(0, 1fr))',
  },
  gap: { xs: 1.5, md: 2 },
  alignItems: 'stretch',
}

/** How long review takes, in the creator's words. */
function reviewPromise(days) {
  const sla = Number(days) || SETTINGS_FALLBACK.moderation.reviewSlaDays
  return `Typically reviewed within ${sla} ${sla === 1 ? 'day' : 'days'}.`
}

export default function CreatorPortfolioPage() {
  const { user } = useAuth()
  const toast = useToast()
  const confirm = useConfirm()

  const [filter, setFilter] = useState(DEFAULT_PORTFOLIO_FILTER)
  const [dialog, setDialog] = useState(null)
  const [previewIndex, setPreviewIndex] = useState(null)
  const [busyId, setBusyId] = useState(null)

  // The storefront: portfolio items are keyed by `cpr_…` while the session
  // carries a `usr_…` (`docs/data-model.md` §3).
  const {
    data: profile,
    isLoading: profileLoading,
    error: profileError,
    refetch: refetchProfile,
  } = useApiQuery(() => creatorProfileService.getByUserId(user?.id), [user?.id], {
    enabled: Boolean(user?.id),
  })

  const creatorId = profile?.id

  const { data, isLoading, error, refetch } = useApiQuery(
    () => portfolioService.listManagedByCreator(creatorId, { creatorUserId: user?.id }),
    [creatorId, user?.id],
    { enabled: Boolean(creatorId) }
  )

  const { data: categories, isLoading: categoriesLoading } = useApiQuery(
    () => categoryService.listActive(),
    []
  )

  // The SLA is copy, not a gate: an unreachable settings endpoint must not stop
  // a creator submitting work, so it falls back to the bundled default.
  const { data: reviewSlaDays } = useApiQuery(
    () =>
      settingsService
        .getSettings()
        .then((settings) => settings?.moderation?.reviewSlaDays)
        .catch(() => SETTINGS_FALLBACK.moderation.reviewSlaDays),
    []
  )

  const { mutate: persistItem, isLoading: isSaving } = useApiMutation(({ item, payload }) =>
    item
      ? portfolioService.updateItem(item.id, payload)
      : portfolioService.createItem(creatorId, payload)
  )

  const items = useMemo(() => data?.items ?? [], [data])
  const counts = data?.counts ?? {}
  const reviewsByItemId = data?.reviewsByItemId ?? {}

  const categoryNames = useMemo(
    () => Object.fromEntries((categories ?? []).map((category) => [category.id, category.name])),
    [categories]
  )

  const visible = useMemo(
    () => items.filter((item) => matchesPortfolioFilter(item, filter)),
    [items, filter]
  )

  // MOCK-MEDIA: seeded and mock-uploaded portfolio media is a still for every
  // item, films included (contract §5.2) — the same reason the public gallery
  // opens video items as stills rather than into an empty player.
  const lightboxItems = useMemo(
    () =>
      visible.map((item) => ({
        id: item.id,
        type: 'image',
        src: item.mediaUrl || imageUrl(item.id, IMAGE_SIZES.wide.width, IMAGE_SIZES.wide.height),
        alt: item.title,
        caption: [item.description, item.brandCredit ? `Created for: ${item.brandCredit}` : null]
          .filter(Boolean)
          .join(' · '),
      })),
    [visible]
  )

  const changeFilter = (next) => {
    setFilter(next)
    // The set behind the viewer is about to change; close it rather than leave
    // it pointing at an item that just left the grid.
    setPreviewIndex(null)
  }

  /** Runs a card action, keeping that one card busy and reporting either way. */
  const runAction = async (item, action, { success, failure }) => {
    setBusyId(item.id)
    try {
      await action()
      toast.success(success.title, { description: success.description })
      refetch()
    } catch (thrown) {
      // Service errors are already written for the person reading them — an
      // illegal transition comes back as "This item cannot be sent for review
      // from its current status." rather than a machine name.
      toast.error(failure, { description: thrown?.message })
    } finally {
      setBusyId(null)
    }
  }

  const handleSave = async (payload, { submitForReview }) => {
    const item = dialog?.item
    const isPublishedEdit = item?.status === CONTENT_STATUS.PUBLISHED

    // The edit-republish policy, stated before it happens rather than after.
    if (isPublishedEdit) {
      const confirmed = await confirm({
        title: 'Send this back for review?',
        message:
          'Editing published work re-opens a Trust & Safety review. This piece comes off your public profile now and goes back up once a reviewer approves it.',
        confirmLabel: 'Save & resubmit',
      })
      if (!confirmed) return
    }

    let saved
    try {
      saved = await persistItem({ item, payload })
    } catch (thrown) {
      toast.error('We could not save this item', { description: thrown?.message })
      return
    }

    if (!submitForReview) {
      setDialog(null)
      toast.success(item ? 'Changes saved' : 'Draft saved', {
        description: 'Send it for review whenever you are ready — drafts stay private.',
      })
      refetch()
      return
    }

    try {
      await portfolioService.submitForReview(saved.id, { creatorUserId: user?.id })
      setDialog(null)
      toast.success('Submitted for review', { description: reviewPromise(reviewSlaDays) })
    } catch (thrown) {
      // The save landed and the submission did not: say exactly that, and leave
      // the item where it is so the creator can try the submission again.
      setDialog(null)
      toast.error('Saved, but not submitted', {
        description: `${thrown?.message ?? 'The review queue could not be reached.'} Your work is safe — submit it again from the card menu.`,
      })
    }
    refetch()
  }

  const handleSubmit = (item) =>
    runAction(item, () => portfolioService.submitForReview(item.id, { creatorUserId: user?.id }), {
      success: { title: 'Submitted for review', description: reviewPromise(reviewSlaDays) },
      failure: 'We could not send this for review',
    })

  const handleArchive = async (item) => {
    const confirmed = await confirm({
      title: 'Archive this item?',
      message:
        'Archiving takes it off your public profile and out of your working portfolio for good. It cannot be restored.',
      confirmLabel: 'Archive',
      tone: 'danger',
    })
    if (!confirmed) return

    return runAction(item, () => portfolioService.archiveItem(item.id), {
      success: { title: 'Archived', description: 'It is no longer shown anywhere public.' },
      failure: 'We could not archive this item',
    })
  }

  const handleVisibility = (item, visibility) => {
    const listed = visibility === VISIBILITY.PUBLIC
    return runAction(item, () => portfolioService.setVisibility(item.id, visibility), {
      success: {
        title: listed ? 'Shown on your profile' : 'Hidden from your profile',
        description: listed
          ? 'Buyers can find this piece again.'
          : 'It stays approved and stays here — buyers just will not see it.',
      },
      failure: 'We could not change who can see this',
    })
  }

  const addButton = (
    <Button
      variant="gradient"
      onClick={() => setDialog({ item: null })}
      disabled={!creatorId}
      startIcon={<Icon icon="solar:gallery-add-linear" width={18} aria-hidden="true" />}
    >
      Add item
    </Button>
  )

  const renderBody = () => {
    const failure = profileError ?? error
    if (failure) {
      return (
        <ErrorState
          title="We could not load your portfolio"
          message="Nothing has changed on your account — try again in a moment."
          error={failure}
          onRetry={profileError ? refetchProfile : refetch}
        />
      )
    }

    if (profileLoading || isLoading) {
      return (
        <Box sx={gridSx}>
          {Array.from({ length: SKELETON_COUNT }, (_, index) => (
            <CardSkeleton key={index} lines={1} label="Loading your portfolio" />
          ))}
        </Box>
      )
    }

    if (visible.length === 0) {
      const copy = emptyStateCopy(filter, items.length === 0)
      return (
        <EmptyState
          icon={copy.icon}
          title={copy.title}
          description={copy.description}
          primaryAction={
            items.length === 0
              ? { label: 'Add your first item', icon: 'solar:gallery-add-linear', onClick: () => setDialog({ item: null }) }
              : { label: 'Show everything', variant: 'outlined', onClick: () => changeFilter(PORTFOLIO_FILTER.ALL) }
          }
        />
      )
    }

    return (
      <Box sx={gridSx}>
        {/* Names the grid in the outline, so the page reads h1 → h2 → each
            card's own h3 rather than skipping a level (00 §13). Visually
            hidden — the filter chips above already label it on screen. */}
        <Typography component="h2" sx={visuallyHidden}>
          Portfolio items
        </Typography>

        {visible.map((item, index) => (
          <PortfolioManageCard
            key={item.id}
            item={item}
            review={reviewsByItemId[item.id]}
            categoryName={categoryNames[item.categoryId]}
            busy={busyId === item.id}
            onPreview={() => setPreviewIndex(index)}
            onEdit={() => setDialog({ item })}
            onSubmit={() => handleSubmit(item)}
            onArchive={() => handleArchive(item)}
            onVisibilityChange={(next) => handleVisibility(item, next)}
          />
        ))}
      </Box>
    )
  }

  return (
    <DashboardPage
      title="Portfolio"
      subtitle="Your sample work, and where each piece stands with Trust & Safety."
      actions={addButton}
    >
      {profileLoading || profileError ? null : (
        <StatusSummaryChips
          counts={counts}
          value={filter}
          onChange={changeFilter}
          sx={{ mb: 2.5 }}
        />
      )}

      {renderBody()}

      <MediaLightbox
        open={previewIndex !== null}
        items={lightboxItems}
        index={previewIndex ?? 0}
        onIndexChange={setPreviewIndex}
        onClose={() => setPreviewIndex(null)}
        title={previewIndex === null ? 'Portfolio item' : (visible[previewIndex]?.title ?? 'Portfolio item')}
      />

      {dialog ? (
        <PortfolioItemDialog
          // Keyed so the form is rebuilt from scratch for each item rather than
          // inheriting the last one's values.
          key={dialog.item?.id ?? 'new'}
          open
          item={dialog.item}
          categories={categories ?? []}
          categoriesLoading={categoriesLoading}
          isSaving={isSaving}
          onClose={() => setDialog(null)}
          onSave={handleSave}
        />
      ) : null}
    </DashboardPage>
  )
}
