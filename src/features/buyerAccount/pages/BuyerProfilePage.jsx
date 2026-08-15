import { useState } from 'react'

import { Icon } from '@iconify/react'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Divider from '@mui/material/Divider'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'

import ErrorState from '@/components/feedback/ErrorState'
import { useToast } from '@/components/feedback/ToastProvider'
import FormSkeleton from '@/components/feedback/skeletons/FormSkeleton'
import FormSelect from '@/components/inputs/FormSelect'
import FormTextField from '@/components/inputs/FormTextField'
import StickyActionBar from '@/components/layout/StickyActionBar'
import { buyerIndustryOptions } from '@/constants/industries'
import { useAuth } from '@/context/AuthContext'
import LogoUploadField from '@/features/buyerAccount/components/LogoUploadField'
import ProfileCompletenessMeter from '@/features/buyerAccount/components/ProfileCompletenessMeter'
import useApiMutation from '@/hooks/useApiMutation'
import useApiQuery from '@/hooks/useApiQuery'
import useForm from '@/hooks/useForm'
import useUnsavedChanges from '@/hooks/useUnsavedChanges'
import DashboardPage from '@/layouts/dashboard/DashboardPage'
import { BOTTOM_NAV_HEIGHT } from '@/layouts/dashboard/MobileBottomNav'
import { buyerProfileService, getBuyerProfileCompleteness } from '@/services/buyerProfileService'
import { userService } from '@/services/userService'
import { compose, maxLength, minLength, required, url as urlRule } from '@/utils/validators'

// The buyer's business profile — the record creators read before deciding
// whether to propose on a brief.
//
// It edits **two records at once**: the business details on `buyerProfiles` and
// the contact name and phone on `users`. Only the record that actually changed
// is patched (Prompt 15 §7), and the session is refreshed only when the account
// half moved, so the top bar picks up a new name without a pointless round trip
// after a bio edit.

/** Content column cap for form pages (§6). */
const FORM_MAX_WIDTH = 720

/** Fields that live on `buyerProfiles`. */
const PROFILE_KEYS = ['companyName', 'industry', 'website', 'location', 'logoUrl', 'bio']

/** Fields that live on `users` — the account, not the business. */
const USER_KEYS = ['name', 'phone']

const BIO_MAX = 600

const validators = {
  companyName: compose(
    required('Enter the name of your business.'),
    minLength(2),
    maxLength(80)
  ),
  website: compose(urlRule('Enter a valid URL, including https://'), maxLength(200)),
  location: maxLength(120),
  bio: maxLength(BIO_MAX),
  name: compose(required('Enter your name.'), minLength(2), maxLength(80)),
  phone: maxLength(32),
}

/** Both records flattened into the one shape the form edits. */
function toFormValues(profile, user) {
  return {
    companyName: profile?.companyName ?? '',
    industry: profile?.industry ?? '',
    website: profile?.website ?? '',
    location: profile?.location ?? '',
    logoUrl: profile?.logoUrl ?? '',
    bio: profile?.bio ?? '',
    name: user?.name ?? '',
    phone: user?.phone ?? '',
  }
}

/** Trimmed value, so a field of spaces counts as empty everywhere. */
const clean = (value) => String(value ?? '').trim()

/** Only the keys whose value actually moved — the patch body, or `null`. */
function changedFields(keys, values, baseline) {
  const patch = {}
  keys.forEach((key) => {
    if (clean(values[key]) !== clean(baseline[key])) patch[key] = clean(values[key])
  })
  return Object.keys(patch).length > 0 ? patch : null
}

function BuyerProfileForm({ profile, user, onSaved }) {
  const toast = useToast()
  const { refreshUser } = useAuth()

  // The saved state the form is measured against. Set once at mount and again
  // after every successful save, so "dirty" always means "differs from what the
  // server has".
  const [baseline, setBaseline] = useState(() => toFormValues(profile, user))
  const form = useForm({ initialValues: baseline, validators })
  const { mutate, isLoading: isSaving } = useApiMutation(async (patches) => {
    const [updatedProfile, updatedUser] = await Promise.all([
      patches.profile ? buyerProfileService.update(profile.id, patches.profile) : null,
      patches.user ? userService.update(user.id, patches.user) : null,
    ])
    return { updatedProfile, updatedUser }
  })

  const isDirty = Object.keys(baseline).some(
    (key) => clean(form.values[key]) !== clean(baseline[key])
  )

  useUnsavedChanges(isDirty)

  const completeness = getBuyerProfileCompleteness(
    {
      companyName: form.values.companyName,
      industry: form.values.industry,
      website: form.values.website,
      location: form.values.location,
      bio: form.values.bio,
    },
    { name: form.values.name, phone: form.values.phone }
  )

  const handleSubmit = form.handleSubmit(async (values, { setError }) => {
    const patches = {
      profile: changedFields(PROFILE_KEYS, values, baseline),
      user: changedFields(USER_KEYS, values, baseline),
    }

    if (!patches.profile && !patches.user) {
      toast.info('Nothing to save', { description: 'Your profile is already up to date.' })
      return
    }

    try {
      await mutate(patches)

      const saved = Object.fromEntries(
        Object.keys(values).map((key) => [key, clean(values[key])])
      )
      setBaseline(saved)
      form.reset(saved)

      // The top bar and every avatar read the account from the session, so a
      // changed name has to be re-read before it appears anywhere else.
      if (patches.user) await refreshUser()

      toast.success('Profile saved', {
        description: 'Creators see your updated business details from now on.',
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
      <Button
        color="inherit"
        onClick={() => form.reset(baseline)}
        disabled={!isDirty || isSaving}
      >
        Discard
      </Button>
      <Button
        type="submit"
        form="buyer-profile-form"
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
      subtitle="How your business appears to creators across BetterBlue."
      maxWidth={false}
      // Desktop keeps the actions in the header; the phone gets the sticky bar
      // at the bottom of the form instead (§6).
      actions={<Stack direction="row" spacing={1.5} sx={{ display: { xs: 'none', md: 'flex' } }}>{actions}</Stack>}
      sx={{ maxWidth: FORM_MAX_WIDTH, mx: 'auto' }}
    >
      <Stack component="form" id="buyer-profile-form" onSubmit={handleSubmit} spacing={{ xs: 2, md: 3 }} noValidate>
        <Card>
          <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
            <ProfileCompletenessMeter completeness={completeness} />
          </CardContent>
        </Card>

        <Card>
          <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
            <Typography variant="h6" component="h2" sx={{ fontSize: '1.0625rem' }}>
              Company identity
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 3 }}>
              The name, mark, and details creators see on every brief you post.
            </Typography>

            <Stack spacing={3}>
              <LogoUploadField
                value={form.values.logoUrl}
                onChange={(logoUrl) => form.setValue('logoUrl', logoUrl)}
                companyName={form.values.companyName}
                error={form.errors.logoUrl}
                onError={(message) => form.setError('logoUrl', message)}
                disabled={isSaving}
              />

              <Divider />

              <FormTextField
                label="Company name"
                required
                maxLength={80}
                autoComplete="organization"
                {...form.fieldProps('companyName')}
              />

              <FormSelect
                label="Industry"
                placeholder="Choose an industry"
                options={buyerIndustryOptions(form.values.industry)}
                helperText="Helps creators judge whether your work is a fit for them."
                {...form.fieldProps('industry')}
              />

              <FormTextField
                label="Website"
                type="url"
                placeholder="https://example.com"
                autoComplete="url"
                helperText="Include https:// so the link works everywhere it appears."
                {...form.fieldProps('website')}
              />

              <FormTextField
                label="Location"
                placeholder="City, Country"
                autoComplete="address-level2"
                helperText="Where the business is based. Creators use it to judge time zones and travel."
                {...form.fieldProps('location')}
              />
            </Stack>
          </CardContent>
        </Card>

        <Card>
          <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
            <Typography variant="h6" component="h2" sx={{ fontSize: '1.0625rem' }}>
              About
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 3 }}>
              A short introduction to your business and the content you commission.
            </Typography>

            <FormTextField
              label="About your business"
              multiline
              minRows={5}
              maxLength={BIO_MAX}
              helperText="What you sell, who it is for, and the kind of content you usually need."
              {...form.fieldProps('bio')}
            />
          </CardContent>
        </Card>

        <Card>
          <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
            <Typography variant="h6" component="h2" sx={{ fontSize: '1.0625rem' }}>
              Contact
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 3 }}>
              Who creators are speaking to. Your phone number is never shown publicly.
            </Typography>

            <Stack spacing={3}>
              <FormTextField
                label="Your name"
                required
                maxLength={80}
                autoComplete="name"
                {...form.fieldProps('name')}
              />
              <FormTextField
                label="Phone"
                type="tel"
                autoComplete="tel"
                placeholder="+1 555 000 0000"
                helperText="Shared only with creators on an order you have funded."
                {...form.fieldProps('phone')}
              />
            </Stack>
          </CardContent>
        </Card>
      </Stack>

      {isDirty ? (
        // Sticky bottoms out against the viewport, and the viewport's bottom
        // edge on a phone belongs to the dashboard's fixed bar — so the save
        // bar is lifted clear of it rather than covering the navigation. The
        // bar's own safe-area padding is already handled below it.
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

export default function BuyerProfilePage() {
  const { user } = useAuth()

  const {
    data: profile,
    isLoading,
    error,
    refetch,
  } = useApiQuery(() => buyerProfileService.getByUserId(user?.id), [user?.id], {
    enabled: Boolean(user?.id),
  })

  if (isLoading) {
    return (
      <DashboardPage
        title="Profile"
        subtitle="How your business appears to creators across BetterBlue."
        maxWidth={false}
        sx={{ maxWidth: FORM_MAX_WIDTH, mx: 'auto' }}
      >
        <Card>
          <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
            <FormSkeleton fields={4} label="Loading your profile" />
          </CardContent>
        </Card>
      </DashboardPage>
    )
  }

  // A buyer account always has a profile — registration creates one alongside
  // it (contract §2.1) — so a missing record is a failure to report, not an
  // empty state to design around.
  if (error || !profile) {
    return (
      <DashboardPage title="Profile" maxWidth={false} sx={{ maxWidth: FORM_MAX_WIDTH, mx: 'auto' }}>
        <ErrorState
          title="We could not load your profile"
          message={
            profile === null && !error
              ? 'This account has no business profile yet. Try again, and contact support if it keeps happening.'
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
  return <BuyerProfileForm key={profile.id} profile={profile} user={user} onSaved={refetch} />
}
