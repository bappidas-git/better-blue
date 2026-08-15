import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { motion } from 'framer-motion'
import { useNavigate, useSearchParams } from 'react-router-dom'

import ErrorState from '@/components/feedback/ErrorState'
import FormSkeleton from '@/components/feedback/skeletons/FormSkeleton'
import { useToast } from '@/components/feedback/ToastProvider'
import StickyActionBar from '@/components/layout/StickyActionBar'
import { useAuth } from '@/context/AuthContext'
import { CREATOR_HINT_PARAM } from '@/features/creatorProfile/hooks/useCreatorRequestCta'
import StepBasics from '@/features/requests/components/wizard/StepBasics'
import StepBudget from '@/features/requests/components/wizard/StepBudget'
import StepReview from '@/features/requests/components/wizard/StepReview'
import StepSpecs from '@/features/requests/components/wizard/StepSpecs'
import WizardProgress from '@/features/requests/components/wizard/WizardProgress'
import useRequestWizard, { STEP_INDEX } from '@/features/requests/hooks/useRequestWizard'
import useApiQuery from '@/hooks/useApiQuery'
import DashboardPage from '@/layouts/dashboard/DashboardPage'
import { BOTTOM_NAV_HEIGHT } from '@/layouts/dashboard/MobileBottomNav'
import { buyerRoutes } from '@/routes/buyerRoutes'
import { paths } from '@/routes/paths'
import { categoryService } from '@/services/categoryService'
import { creatorProfileService } from '@/services/creatorProfileService'
import { requestService } from '@/services/requestService'
import { durations, easing } from '@/theme/motionTokens'

// The buyer's content request wizard — four steps between "we need photos" and
// a brief creators can propose on.
//
// The page owns everything that comes from outside the form: the draft being
// resumed, the categories, the creator hint, and where a published brief sends
// you. `useRequestWizard` owns the steps and the answers; the step components
// own nothing at all (00 §16.9).

/** Query parameter that resumes a saved draft. */
export const DRAFT_PARAM = 'draft'

/** Content column cap for form pages, matching the profile screens (Prompt 15). */
const FORM_MAX_WIDTH = 720

/**
 * Room a field keeps below itself when the browser scrolls it into view on
 * focus — the sticky action bar plus the mobile nav underneath it. Without
 * this, tabbing to the last field on a step parks it behind the buttons (§6).
 */
const FOCUS_CLEARANCE = BOTTOM_NAV_HEIGHT + 96

/**
 * Step transition — a direction-aware slide + fade, well inside the 400ms
 * interaction ceiling (00 §7).
 *
 * The step animates **in** only, and React's `key` does the swapping: an
 * `AnimatePresence` crossfade would need two steps mounted at once, which on a
 * phone means the card jumping to the taller of the two mid-animation. Entering
 * from the side the person is travelling gives the same sense of movement for
 * none of that, and `<MotionConfig reducedMotion="user">` strips the transform
 * for anyone who has asked it to.
 */
const STEP_TRANSITION = { duration: durations.fast / 1000, ease: easing }
const stepVariants = {
  enter: (direction) => ({ opacity: 0, x: direction >= 0 ? 24 : -24 }),
  center: { opacity: 1, x: 0, transition: STEP_TRANSITION },
}

/**
 * Is a buyer path actually rendered by a page yet?
 *
 * TODO(Prompt 18): once `BUYER_REQUESTS` renders the request list, this check
 * always passes and can be replaced with a plain `navigate(paths.BUYER_REQUESTS)`.
 * Until then a published brief would land on the dashboard 404, so it goes to
 * the overview instead — the same rule `navConfig` follows for nav entries.
 */
const isRouteBuilt = (path) => buyerRoutes.some((route) => route.path === path)

/** Where a published brief takes you, given what has been built so far. */
const publishedDestination = () =>
  isRouteBuilt(paths.BUYER_REQUESTS) ? paths.BUYER_REQUESTS : paths.BUYER

/** Small "Saved" / "Saving…" line under the actions, per §4.6. */
function DraftIndicator({ state }) {
  if (state === 'idle') return null

  const copy = {
    saving: { icon: 'tabler:loader-2', label: 'Saving draft…', color: 'text.secondary' },
    saved: { icon: 'tabler:cloud-check', label: 'Draft saved', color: 'text.secondary' },
    error: { icon: 'tabler:cloud-off', label: 'Draft not saved — we will try again', color: 'warning.main' },
  }[state]

  if (!copy) return null

  return (
    <Stack
      direction="row"
      spacing={0.75}
      alignItems="center"
      // Polite, because it fires while someone is typing somewhere else.
      role="status"
      sx={{ color: copy.color }}
    >
      <Icon icon={copy.icon} width={16} aria-hidden="true" />
      <Typography variant="caption">{copy.label}</Typography>
    </Stack>
  )
}

/** The check that plays for a moment between "Publish" and the next screen. */
function PublishedOverlay() {
  return (
    <Box
      component={motion.div}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      role="status"
      sx={{
        position: 'fixed',
        inset: 0,
        zIndex: (theme) => theme.zIndex.modal,
        display: 'grid',
        placeItems: 'center',
        bgcolor: 'background.default',
      }}
    >
      <Stack spacing={2} alignItems="center">
        <Box
          component={motion.div}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: durations.base / 1000, ease: easing }}
          sx={{
            width: 72,
            height: 72,
            borderRadius: '50%',
            display: 'grid',
            placeItems: 'center',
            bgcolor: 'success.main',
            color: 'common.white',
          }}
        >
          <Icon icon="tabler:check" width={40} aria-hidden="true" />
        </Box>
        <Typography variant="h6" component="p">
          Your request is live
        </Typography>
      </Stack>
    </Box>
  )
}

/**
 * The wizard proper. Mounted only once the draft (if any) has been fetched, so
 * the form is built from real values exactly once and never has to be
 * back-filled mid-edit.
 */
function RequestWizard({ buyerId, draft, invitedCreatorId }) {
  const navigate = useNavigate()
  const toast = useToast()
  const [, setSearchParams] = useSearchParams()
  const headingRef = useRef(null)
  const [furthestStep, setFurthestStep] = useState(draft ? STEP_INDEX.review : 0)

  const { data: categories, isLoading: categoriesLoading } = useApiQuery(
    () => categoryService.listActive(),
    []
  )

  // Only for the review card's "you invited X" line — the hint is stored on the
  // brief either way, so a failed lookup costs nothing and is not surfaced.
  const { data: invitedCreator } = useApiQuery(
    () => creatorProfileService.getById(invitedCreatorId),
    [invitedCreatorId],
    { enabled: Boolean(invitedCreatorId) }
  )

  const categoryOptions = useMemo(
    () => (categories ?? []).map((category) => ({ value: category.id, label: category.name })),
    [categories]
  )

  /** A new draft puts its id in the URL, so a refresh resumes where you were. */
  const handleDraftCreated = useCallback(
    (draftId) => {
      setSearchParams(
        (previous) => {
          const next = new URLSearchParams(previous)
          next.set(DRAFT_PARAM, draftId)
          return next
        },
        { replace: true }
      )
    },
    [setSearchParams]
  )

  const handlePublished = useCallback(() => {
    toast.success('Request published', {
      description: 'Creators can see it now. Proposals usually start arriving within 48 hours.',
    })
    // Long enough for the check to register, short enough not to be a wait.
    window.setTimeout(() => navigate(publishedDestination()), durations.slow)
  }, [navigate, toast])

  const wizard = useRequestWizard({
    buyerId,
    draft,
    invitedCreatorId,
    onDraftCreated: handleDraftCreated,
    onPublished: handlePublished,
  })

  const {
    form,
    steps,
    step,
    stepIndex,
    direction,
    isFirstStep,
    isLastStep,
    goNext,
    goBack,
    goToStep,
    needsVideoDuration,
    draftState,
    isSavingDraft,
    saveDraft,
    isSubmitting,
    isPublished,
  } = wizard

  const busy = isSubmitting || isPublished

  // Focus lands on the new step's heading, so a keyboard or screen-reader user
  // is told where they are instead of being dropped at the top of the document
  // (§12). `preventScroll` keeps the page from jumping under the animation.
  useEffect(() => {
    headingRef.current?.focus?.({ preventScroll: true })
  }, [stepIndex])

  useEffect(() => {
    setFurthestStep((previous) => Math.max(previous, stepIndex))
  }, [stepIndex])

  const stepContent = {
    basics: (
      <StepBasics
        form={form}
        categoryOptions={categoryOptions}
        categoriesLoading={categoriesLoading}
        disabled={busy}
      />
    ),
    specs: <StepSpecs form={form} needsVideoDuration={needsVideoDuration} disabled={busy} />,
    budget: <StepBudget form={form} disabled={busy} />,
    review: (
      <StepReview
        form={form}
        onEditStep={goToStep}
        categoryLabel={
          categoryOptions.find((option) => option.value === form.values.categoryId)?.label
        }
        invitedCreator={invitedCreator}
        disabled={busy}
      />
    ),
  }[step.key]

  const actions = (
    <>
      <Button
        color="inherit"
        onClick={saveDraft}
        disabled={isSavingDraft || busy}
        startIcon={<Icon icon="tabler:device-floppy" width={18} aria-hidden="true" />}
      >
        {isSavingDraft ? 'Saving…' : 'Save as draft'}
      </Button>

      <Box sx={{ flexGrow: 1 }} />

      {!isFirstStep ? (
        <Button onClick={goBack} disabled={busy} variant="outlined">
          Back
        </Button>
      ) : null}

      {isLastStep ? (
        <Button onClick={wizard.submit} disabled={busy} variant="gradient">
          {isSubmitting ? 'Publishing…' : 'Publish request'}
        </Button>
      ) : (
        <Button
          onClick={goNext}
          disabled={busy}
          variant="gradient"
          endIcon={<Icon icon="tabler:arrow-right" width={18} aria-hidden="true" />}
        >
          Next
        </Button>
      )}
    </>
  )

  return (
    <DashboardPage
      title="New request"
      subtitle="Brief the content you need. Creators respond with priced proposals."
      backTo={publishedDestination()}
      maxWidth={false}
      sx={{ maxWidth: FORM_MAX_WIDTH, mx: 'auto' }}
    >
      {isPublished ? <PublishedOverlay /> : null}

      <Stack spacing={{ xs: 2, md: 3 }}>
        <WizardProgress
          steps={steps}
          activeStep={stepIndex}
          furthestStep={furthestStep}
          onStepClick={goToStep}
          disabled={busy}
        />

        <Card>
          <CardContent
            sx={{
              p: { xs: 2.5, md: 3 },
              // Applied to the controls themselves rather than the card, so the
              // browser's own focus scrolling stops short of the sticky bar.
              '& .MuiInputBase-root, & .MuiButtonBase-root, & label': {
                scrollMarginBottom: { xs: `${FOCUS_CLEARANCE}px`, md: 0 },
              },
            }}
          >
            {/* Keyed on the step, so changing step remounts this subtree and
                the enter animation runs from the right side each time. */}
            <motion.div
              key={step.key}
              custom={direction}
              variants={stepVariants}
              initial="enter"
              animate="center"
            >
              <Box sx={{ mb: 3 }}>
                <Typography
                  variant="h6"
                  component="h2"
                  ref={headingRef}
                  tabIndex={-1}
                  sx={{ fontSize: '1.125rem', outline: 'none' }}
                >
                  {step.heading}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {step.description}
                </Typography>
              </Box>

              {stepContent}
            </motion.div>
          </CardContent>
        </Card>

        {/* Desktop keeps the actions inline under the card; the phone gets the
            sticky bar below (§6). */}
        <Stack
          direction="row"
          spacing={1.5}
          alignItems="center"
          sx={{ display: { xs: 'none', md: 'flex' } }}
        >
          {actions}
        </Stack>

        <Box sx={{ display: { xs: 'none', md: 'flex' }, justifyContent: 'flex-end' }}>
          <DraftIndicator state={draftState} />
        </Box>
      </Stack>

      <StickyActionBar
        mobileOnly
        justify="space-between"
        sx={{
          mx: { xs: -2, sm: -3 },
          mt: 2,
          // The viewport's bottom edge on a phone belongs to the dashboard's
          // fixed bar, so the actions sit clear of it rather than over it.
          bottom: `calc(${BOTTOM_NAV_HEIGHT + 1}px + env(safe-area-inset-bottom))`,
          pb: 1.5,
        }}
      >
        {actions}
      </StickyActionBar>

      <Box sx={{ display: { xs: 'flex', md: 'none' }, justifyContent: 'center', pt: 1 }}>
        <DraftIndicator state={draftState} />
      </Box>
    </DashboardPage>
  )
}

export default function RequestWizardPage() {
  const { user } = useAuth()
  const [searchParams] = useSearchParams()

  const draftId = searchParams.get(DRAFT_PARAM)
  const invitedCreatorId = searchParams.get(CREATOR_HINT_PARAM)

  const {
    data: draft,
    isLoading,
    error,
    refetch,
  } = useApiQuery(() => requestService.getDraft(draftId, { buyerId: user?.id }), [draftId, user?.id], {
    enabled: Boolean(draftId && user?.id),
  })

  if (draftId && isLoading) {
    return (
      <DashboardPage title="New request" maxWidth={false} sx={{ maxWidth: FORM_MAX_WIDTH, mx: 'auto' }}>
        <Card>
          <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
            <FormSkeleton fields={4} label="Loading your draft" />
          </CardContent>
        </Card>
      </DashboardPage>
    )
  }

  if (draftId && error) {
    return (
      <DashboardPage title="New request" maxWidth={false} sx={{ maxWidth: FORM_MAX_WIDTH, mx: 'auto' }}>
        <ErrorState
          title="We could not open that draft"
          message="It may have been published or removed. You can still start a new request."
          error={error}
          onRetry={refetch}
        />
      </DashboardPage>
    )
  }

  // Keyed on the draft so the form is built once, from real values — resuming a
  // different draft rebuilds it rather than merging into a half-edited one.
  return (
    <RequestWizard
      key={draft?.id ?? 'new'}
      buyerId={user?.id}
      draft={draft}
      invitedCreatorId={invitedCreatorId}
    />
  )
}
