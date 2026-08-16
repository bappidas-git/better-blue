import { useEffect, useState } from 'react'

import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Divider from '@mui/material/Divider'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { useLocation } from 'react-router-dom'

import ErrorState from '@/components/feedback/ErrorState'
import { useToast } from '@/components/feedback/ToastProvider'
import FormSkeleton from '@/components/feedback/skeletons/FormSkeleton'
import FormSelect from '@/components/inputs/FormSelect'
import FormTextField from '@/components/inputs/FormTextField'
import StickyActionBar from '@/components/layout/StickyActionBar'
import { creatorLanguageOptions } from '@/constants/languages'
import { useAuth } from '@/context/AuthContext'
import ProfileCompletenessMeter from '@/features/buyerAccount/components/ProfileCompletenessMeter'
import AvailabilityCard from '@/features/creatorAccount/components/AvailabilityCard'
import AvatarUploadField from '@/features/creatorAccount/components/AvatarUploadField'
import ExpertiseForm, {
  MAX_CATEGORIES,
  MIN_STARTING_PRICE,
} from '@/features/creatorAccount/components/ExpertiseForm'
import PayoutMethodCard from '@/features/creatorAccount/components/PayoutMethodCard'
import VerificationChip from '@/features/creatorAccount/components/VerificationChip'
import useCreatorAvailability from '@/features/creatorAccount/hooks/useCreatorAvailability'
import useApiMutation from '@/hooks/useApiMutation'
import useApiQuery from '@/hooks/useApiQuery'
import useForm from '@/hooks/useForm'
import useUnsavedChanges from '@/hooks/useUnsavedChanges'
import DashboardPage from '@/layouts/dashboard/DashboardPage'
import { BOTTOM_NAV_HEIGHT } from '@/layouts/dashboard/MobileBottomNav'
import { paths } from '@/routes/paths'
import { categoryService } from '@/services/categoryService'
import {
  creatorProfileService,
  getCreatorProfileCompleteness,
  maskAccountNumber,
} from '@/services/creatorProfileService'
import { orderService } from '@/services/orderService'
import { userService } from '@/services/userService'
import { compose, max, maxLength, min, minLength, pattern, required } from '@/utils/validators'

// The creator's storefront — the record buyers read on `/creators` and on the
// public profile before they decide whether to hire.
//
// It edits **two records at once**: the storefront on `creatorProfiles` and the
// name and photo on `users`. Only the record that actually changed is patched
// (the Prompt 15 pattern), and the session is refreshed only when the account
// half moved, so the top bar picks up a new photo without a pointless round
// trip after a price edit.
//
// Two things on this screen are read-only by design and say so: `verified` is
// granted by Trust & Safety (Prompt 29), and the rating, completed-order count,
// and response time are derived from real work (contract §6.4).

/** Content column cap for form pages (§6). */
const FORM_MAX_WIDTH = 720

/** Fields that live on `creatorProfiles`. */
const PROFILE_KEYS = [
  'displayName',
  'tagline',
  'bio',
  'location',
  'languages',
  'categories',
  'contentTypes',
  'startingPrice',
]

/** Fields that live on `users` — the account, not the storefront. */
const USER_KEYS = ['name', 'avatarUrl']

const TAGLINE_MAX = 80
const BIO_MIN = 200
const BIO_MAX = 1200

/** A sort code or routing number: digits only, and the right number of them. */
const ROUTING_PATTERN = /^\d{6,9}$/
/** An account number long enough to be one, short enough to be plausible. */
const ACCOUNT_PATTERN = /^[\d\s-]{8,21}$/

const validators = {
  displayName: compose(
    required('Enter the name buyers should see.'),
    minLength(2),
    maxLength(80)
  ),
  tagline: compose(
    required('One line about what you shoot.'),
    minLength(10, 'Give buyers a little more than that.'),
    maxLength(TAGLINE_MAX)
  ),
  bio: compose(
    required('Tell buyers what you do.'),
    minLength(BIO_MIN, `Write at least ${BIO_MIN} characters — this is what buyers read first.`),
    maxLength(BIO_MAX)
  ),
  location: maxLength(120),
  categories: (value) => {
    if (!value?.length) return 'Pick at least one category.'
    if (value.length > MAX_CATEGORIES) return `Pick no more than ${MAX_CATEGORIES}.`
    return undefined
  },
  contentTypes: (value) => (value?.length ? undefined : 'Choose at least one content type.'),
  startingPrice: compose(
    required('Set a starting price.'),
    min(MIN_STARTING_PRICE, `The minimum starting price is $${MIN_STARTING_PRICE}.`),
    max(100000)
  ),
  name: compose(required('Enter your name.'), minLength(2), maxLength(80)),
  payoutAccountName: maxLength(80),
  // Both payout fields are optional — a storefront can exist before its bank
  // details do — but anything typed has to look like the thing it claims to be.
  payoutAccountNumber: (value) =>
    !value || ACCOUNT_PATTERN.test(String(value).trim())
      ? undefined
      : 'Enter 8 to 17 digits, with or without spaces.',
  payoutRoutingNumber: pattern(ROUTING_PATTERN, 'Enter 6 to 9 digits.'),
}

/** Both records flattened into the one shape the form edits. */
function toFormValues(profile, user) {
  return {
    displayName: profile?.displayName ?? '',
    tagline: profile?.tagline ?? '',
    bio: profile?.bio ?? '',
    location: profile?.location ?? '',
    languages: profile?.languages ?? [],
    categories: profile?.categories ?? [],
    contentTypes: profile?.contentTypes ?? [],
    startingPrice: profile?.startingPrice ? String(profile.startingPrice) : '',
    name: user?.name ?? '',
    avatarUrl: user?.avatarUrl ?? '',
    payoutAccountName: profile?.payoutMethod?.accountName ?? '',
    // Never prefilled: the full number was never stored (see `PayoutMethodCard`).
    payoutAccountNumber: '',
    payoutRoutingNumber: profile?.payoutMethod?.routingNumber ?? '',
  }
}

/** Trimmed value, so a field of spaces counts as empty everywhere. */
const clean = (value) => String(value ?? '').trim()

/** Two selections are equal when they hold the same ids, order aside. */
const sameList = (a = [], b = []) =>
  a.length === b.length && [...a].sort().join('|') === [...b].sort().join('|')

/** Has this field moved since the last save? One rule per shape. */
function isChanged(key, value, baseline) {
  if (Array.isArray(baseline[key]) || Array.isArray(value)) {
    return !sameList(value ?? [], baseline[key] ?? [])
  }
  return clean(value) !== clean(baseline[key])
}

/** Only the keys whose value actually moved — the patch body, or `null`. */
function changedFields(keys, values, baseline) {
  const patch = {}
  keys.forEach((key) => {
    if (!isChanged(key, values[key], baseline)) return
    if (Array.isArray(values[key])) patch[key] = values[key]
    else if (key === 'startingPrice') patch[key] = Number(values[key])
    else patch[key] = clean(values[key])
  })
  return Object.keys(patch).length > 0 ? patch : null
}

/**
 * The payout half of the storefront patch, or `null` when nothing moved.
 *
 * SECURITY: `maskAccountNumber` runs here, on the way *into* the request — the
 * typed number never reaches the service layer, let alone the wire (00 §14).
 * An untouched account number field means "keep what is on file", so the saved
 * mask is carried through rather than blanked.
 */
function payoutPatch(values, baseline, savedPayout) {
  const typedNumber = clean(values.payoutAccountNumber)
  const nameMoved = clean(values.payoutAccountName) !== clean(baseline.payoutAccountName)
  const routingMoved = clean(values.payoutRoutingNumber) !== clean(baseline.payoutRoutingNumber)

  if (!typedNumber && !nameMoved && !routingMoved) return null

  const accountMasked = typedNumber
    ? maskAccountNumber(typedNumber)
    : (savedPayout?.accountMasked ?? '')

  if (!accountMasked) return null

  return {
    payoutMethod: {
      type: 'bank',
      accountName: clean(values.payoutAccountName),
      accountMasked,
      routingNumber: clean(values.payoutRoutingNumber),
    },
  }
}

/**
 * Scrolls to `#<id>` once the form has finished growing.
 *
 * A client-side navigation never acts on a URL fragment, and
 * `ScrollRestoration` in `DashboardLayout` sends every new navigation to the
 * top — the same two facts `FaqPage` handles the same way. The extra condition
 * here is `ready`: the expertise section renders its category chips only once
 * that query resolves, so scrolling before then aims at a card that is about to
 * move several hundred pixels down the page. The card's own `scroll-margin-top`
 * clears the sticky top bar, and the jump is instant because a long smooth
 * scroll is exactly what 00 §7 asks us not to do to somebody.
 *
 * @param {string} hash `location.hash`, with or without its `#`
 * @param {boolean} ready false while the form is still filling in
 */
function useHashScroll(hash, ready) {
  useEffect(() => {
    const id = decodeURIComponent(String(hash ?? '').replace(/^#/, ''))
    if (!id || !ready) return
    document.getElementById(id)?.scrollIntoView()
  }, [hash, ready])
}

function CreatorProfileForm({ profile, user, onSaved }) {
  const toast = useToast()
  const { refreshUser } = useAuth()
  const { hash } = useLocation()

  // The saved state the form is measured against. Set once at mount and again
  // after every successful save, so "dirty" always means "differs from what the
  // server has".
  const [baseline, setBaseline] = useState(() => toFormValues(profile, user))
  const [savedPayout, setSavedPayout] = useState(() => profile?.payoutMethod ?? null)
  const form = useForm({ initialValues: baseline, validators })

  const { data: categories, isLoading: categoriesLoading } = useApiQuery(
    () => categoryService.listActive(),
    []
  )

  const { mutate, isLoading: isSaving } = useApiMutation(async (patches) => {
    const [updatedProfile, updatedUser] = await Promise.all([
      patches.profile ? creatorProfileService.update(profile.id, patches.profile) : null,
      patches.user ? userService.update(user.id, patches.user) : null,
    ])
    return { updatedProfile, updatedUser }
  })

  // Only used to decide whether closing the storefront deserves a word of
  // explanation, so a failed count simply means no confirmation rather than a
  // broken switch.
  const { data: activeOrders } = useApiQuery(
    () => orderService.countActiveByCreator(user?.id).catch(() => 0),
    [user?.id],
    { enabled: Boolean(user?.id) }
  )

  const availability = useCreatorAvailability(profile, {
    activeOrders: activeOrders ?? 0,
    onChanged: onSaved,
  })

  const isDirty = Object.keys(baseline).some((key) =>
    isChanged(key, form.values[key], baseline)
  )

  useUnsavedChanges(isDirty)
  useHashScroll(hash, !categoriesLoading)

  // Recomputed from the *form values* rather than the saved record, so the
  // meter moves as fields are filled in, before anything is saved.
  const completeness = getCreatorProfileCompleteness(
    {
      displayName: form.values.displayName,
      tagline: form.values.tagline,
      bio: form.values.bio,
      categories: form.values.categories,
      contentTypes: form.values.contentTypes,
      startingPrice: form.values.startingPrice,
      location: form.values.location,
      languages: form.values.languages,
      payoutMethod: clean(form.values.payoutAccountNumber)
        ? { accountMasked: maskAccountNumber(form.values.payoutAccountNumber) }
        : savedPayout,
    },
    { avatarUrl: form.values.avatarUrl }
  )

  const handleSubmit = form.handleSubmit(async (values, { setError }) => {
    const profilePatch = {
      ...(changedFields(PROFILE_KEYS, values, baseline) ?? {}),
      ...(payoutPatch(values, baseline, savedPayout) ?? {}),
    }
    const patches = {
      profile: Object.keys(profilePatch).length > 0 ? profilePatch : null,
      user: changedFields(USER_KEYS, values, baseline),
    }

    if (!patches.profile && !patches.user) {
      toast.info('Nothing to save', { description: 'Your profile is already up to date.' })
      return
    }

    try {
      const { updatedProfile } = await mutate(patches)

      // The baseline is what the *server* now holds, which for the account
      // number means the mask rather than the digits that were typed.
      const saved = { ...values, payoutAccountNumber: '' }
      setBaseline(saved)
      form.reset(saved)
      if (patches.profile?.payoutMethod) {
        setSavedPayout(updatedProfile?.payoutMethod ?? patches.profile.payoutMethod)
      }

      // The top bar and every avatar read the account from the session, so a
      // changed name or photo has to be re-read before it appears anywhere else.
      if (patches.user) await refreshUser()

      toast.success('Profile saved', {
        description: 'Buyers see your updated storefront from now on.',
      })
      onSaved?.()
    } catch (failure) {
      // Field-level messages from the API land under their own inputs; the
      // headline goes to a toast, because the form may be scrolled away from it.
      Object.entries(failure?.details ?? {}).forEach(([field, message]) => {
        if (field in values) setError(field, Array.isArray(message) ? message[0] : message)
      })
      toast.error('We could not save your profile', { description: failure?.message })
    }
  })

  const actions = (
    <>
      <Button color="inherit" onClick={() => form.reset(baseline)} disabled={!isDirty || isSaving}>
        Discard
      </Button>
      <Button
        type="submit"
        form="creator-profile-form"
        variant="gradient"
        disabled={!isDirty || isSaving}
        startIcon={
          isSaving ? null : <Icon icon="tabler:device-floppy" width={18} aria-hidden="true" />
        }
      >
        {isSaving ? 'Saving…' : 'Save changes'}
      </Button>
    </>
  )

  return (
    <DashboardPage
      title="Profile"
      subtitle="How you appear to buyers across BetterBlue."
      maxWidth={false}
      meta={<VerificationChip verified={Boolean(profile.verified)} />}
      // Desktop keeps the actions in the header; the phone gets the sticky bar
      // at the bottom of the form instead (§6).
      actions={
        <Stack direction="row" spacing={1.5} sx={{ display: { xs: 'none', md: 'flex' } }}>
          {actions}
        </Stack>
      }
      sx={{ maxWidth: FORM_MAX_WIDTH, mx: 'auto' }}
    >
      <Stack spacing={{ xs: 2, md: 3 }}>
        <Card>
          <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
            <ProfileCompletenessMeter
              completeness={completeness}
              completeMessage="Everything is filled in. Buyers can see what you shoot, what it costs, and where to pay you."
            />
          </CardContent>
        </Card>

        {/* The same switch as the overview, on the screen a creator is most
            likely to be on when they decide to close their storefront. */}
        <AvailabilityCard
          isAvailable={availability.isAvailable}
          onChange={availability.setAvailable}
          disabled={!availability.canToggle}
        />

        <Stack
          component="form"
          id="creator-profile-form"
          onSubmit={handleSubmit}
          spacing={{ xs: 2, md: 3 }}
          noValidate
        >
          <Card>
            <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
              <Typography variant="h6" component="h2" sx={{ fontSize: '1.0625rem' }}>
                Identity
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 3 }}>
                Your photo, your name, and the one line that appears on every card and proposal.
              </Typography>

              <Stack spacing={3}>
                <AvatarUploadField
                  value={form.values.avatarUrl}
                  onChange={(avatarUrl) => form.setValue('avatarUrl', avatarUrl)}
                  displayName={form.values.displayName || form.values.name}
                  error={form.errors.avatarUrl}
                  onError={(message) => form.setError('avatarUrl', message)}
                  disabled={isSaving}
                />

                <Divider />

                <FormTextField
                  label="Display name"
                  required
                  maxLength={80}
                  disabled={isSaving}
                  helperText="What buyers see on your storefront. Your studio name works here too."
                  {...form.fieldProps('displayName')}
                />

                <FormTextField
                  label="Tagline"
                  required
                  maxLength={TAGLINE_MAX}
                  disabled={isSaving}
                  placeholder="Food and product content that makes people hungry to buy"
                  helperText="One line about what you shoot and who for. It is the first thing a buyer reads."
                  {...form.fieldProps('tagline')}
                />

                <FormTextField
                  label="Location"
                  autoComplete="address-level2"
                  disabled={isSaving}
                  placeholder="City, Country"
                  helperText="Where you are based. Buyers use it to judge travel and time zones."
                  {...form.fieldProps('location')}
                />

                <FormSelect
                  label="Languages"
                  multiple
                  disabled={isSaving}
                  options={creatorLanguageOptions(form.values.languages)}
                  helperText="Languages you can work in on set and in writing."
                  {...form.fieldProps('languages')}
                />

                <Divider />

                <FormTextField
                  label="Your name"
                  required
                  maxLength={80}
                  autoComplete="name"
                  disabled={isSaving}
                  helperText="Your account name. Shared with buyers on an order you are working on."
                  {...form.fieldProps('name')}
                />
              </Stack>
            </CardContent>
          </Card>

          <Card>
            <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
              <Typography variant="h6" component="h2" sx={{ fontSize: '1.0625rem' }}>
                Expertise and pricing
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 3 }}>
                What you shoot and what it starts at — the three things buyers filter on.
              </Typography>

              <ExpertiseForm
                form={form}
                categories={categories ?? []}
                categoriesLoading={categoriesLoading}
                currency={profile.currency}
                disabled={isSaving}
              />
            </CardContent>
          </Card>

          <Card>
            <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
              <Typography variant="h6" component="h2" sx={{ fontSize: '1.0625rem' }}>
                About
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 3 }}>
                The longer introduction on your storefront.
              </Typography>

              <Stack spacing={2}>
                <FormTextField
                  label="About you"
                  required
                  multiline
                  minRows={7}
                  maxLength={BIO_MAX}
                  disabled={isSaving}
                  helperText={`Between ${BIO_MIN} and ${BIO_MAX} characters.`}
                  {...form.fieldProps('bio')}
                />

                <Box
                  sx={{
                    p: 2,
                    borderRadius: 2,
                    border: 1,
                    borderStyle: 'dashed',
                    borderColor: 'divider',
                    bgcolor: 'background.default',
                  }}
                >
                  <Stack direction="row" spacing={1.5} alignItems="flex-start">
                    <Box aria-hidden="true" sx={{ display: 'flex', color: 'text.secondary', mt: 0.25 }}>
                      <Icon icon="solar:pen-new-square-linear" width={18} />
                    </Box>
                    <Box>
                      <Typography variant="subtitle2" component="p">
                        What to write
                      </Typography>
                      <Typography
                        component="ul"
                        variant="body2"
                        color="text.secondary"
                        sx={{ mt: 0.5, pl: 2.5, mb: 0 }}
                      >
                        <li>The kind of businesses you shoot for, and what you shoot for them.</li>
                        <li>How you work: your kit, your studio, your turnaround.</li>
                        <li>What a buyer gets — formats, versions, and usage rights.</li>
                        <li>Leave out prices; they belong in your proposals.</li>
                      </Typography>
                    </Box>
                  </Stack>
                </Box>
              </Stack>
            </CardContent>
          </Card>

          <PayoutMethodCard
            form={form}
            savedMasked={savedPayout?.accountMasked}
            disabled={isSaving}
          />

          <Card>
            <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
              <Typography variant="h6" component="h2" sx={{ fontSize: '1.0625rem' }}>
                Public profile
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 2 }}>
                Everything above appears here. Saved changes are live immediately.
              </Typography>

              <Button
                variant="outlined"
                component="a"
                href={paths.creatorProfile(profile.id)}
                target="_blank"
                rel="noopener noreferrer"
                startIcon={<Icon icon="solar:square-top-down-linear" width={18} aria-hidden="true" />}
              >
                View public profile
              </Button>
            </CardContent>
          </Card>
        </Stack>
      </Stack>

      {isDirty ? (
        // Sticky bottoms out against the viewport, and the viewport's bottom
        // edge on a phone belongs to the dashboard's fixed bar — so the save
        // bar is lifted clear of it rather than covering the navigation.
        <StickyActionBar
          mobileOnly
          sx={{
            mx: { xs: -2, sm: -3 },
            mt: 2,
            bottom: `calc(${BOTTOM_NAV_HEIGHT + 1}px + env(safe-area-inset-bottom))`,
            pb: 1.5,
          }}
        >
          {actions}
        </StickyActionBar>
      ) : null}
    </DashboardPage>
  )
}

export default function CreatorProfilePage() {
  const { user } = useAuth()

  const {
    data: profile,
    isLoading,
    error,
    refetch,
  } = useApiQuery(() => creatorProfileService.getByUserId(user?.id), [user?.id], {
    enabled: Boolean(user?.id),
  })

  if (isLoading) {
    return (
      <DashboardPage
        title="Profile"
        subtitle="How you appear to buyers across BetterBlue."
        maxWidth={false}
        sx={{ maxWidth: FORM_MAX_WIDTH, mx: 'auto' }}
      >
        <Card>
          <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
            <FormSkeleton fields={5} label="Loading your profile" />
          </CardContent>
        </Card>
      </DashboardPage>
    )
  }

  // A creator account always has a storefront — registration creates one
  // alongside it (contract §2.1) — so a missing record is a failure to report,
  // not an empty state to design around.
  if (error || !profile) {
    return (
      <DashboardPage title="Profile" maxWidth={false} sx={{ maxWidth: FORM_MAX_WIDTH, mx: 'auto' }}>
        <ErrorState
          title="We could not load your profile"
          message={
            profile === null && !error
              ? 'This account has no creator profile yet. Try again, and contact support if it keeps happening.'
              : 'Nothing has changed on your account — try again in a moment.'
          }
          error={error}
          onRetry={refetch}
        />
      </DashboardPage>
    )
  }

  // Keyed on the record so the form state is built once, from real data, and
  // rebuilt from scratch if the account behind it ever changes.
  return <CreatorProfileForm key={profile.id} profile={profile} user={user} onSaved={refetch} />
}
