import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import LinearProgress from '@mui/material/LinearProgress'
import Link from '@mui/material/Link'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'

import KeyValueList from '@/components/data-display/KeyValueList'
import RatingStars from '@/components/data-display/RatingStars'
import EmptyState from '@/components/feedback/EmptyState'
import { ROLES } from '@/constants/roles'
import { getBuyerProfileCompleteness } from '@/services/buyerProfileService'
import { getCreatorProfileCompleteness } from '@/services/creatorProfileService'
import { EMPTY_PLACEHOLDER, formatCurrency, formatDate, formatNumber } from '@/utils/formatters'

// The member's own record, read from the admin's chair — Prompt 29 §4.3.
//
// Two shapes behind one component, because a buyer profile and a creator
// storefront answer the same question ("who is this, and are they set up?") with
// different fields. The completeness meter is the same derivation the member's
// own profile screen shows them (`get*ProfileCompleteness`), so an admin and a
// member never see different numbers for the same account.
//
// Read-only, deliberately. An admin editing somebody's business details behind
// their back is not a thing this console does; the account actions are the
// levers, and they are all on the header.

const dash = (value) => {
  const text = String(value ?? '').trim()
  return text.length > 0 ? text : EMPTY_PLACEHOLDER
}

/** An external link cell, or the placeholder when the field is empty. */
function ExternalLink({ href, label }) {
  if (!href) return EMPTY_PLACEHOLDER
  const url = /^https?:\/\//i.test(href) ? href : `https://${href}`
  return (
    <Link
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      underline="hover"
      sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}
    >
      {label ?? href}
      <Icon icon="solar:arrow-right-up-linear" width={14} aria-hidden="true" />
    </Link>
  )
}

/** Names for a list of ids we may not have labels for — ids are still honest. */
function ChipList({ values, labelFor }) {
  if (!Array.isArray(values) || values.length === 0) return EMPTY_PLACEHOLDER
  return (
    <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
      {values.map((value) => (
        <Chip key={value} size="small" variant="outlined" label={labelFor?.(value) ?? value} />
      ))}
    </Stack>
  )
}

function buyerItems(profile, user) {
  return [
    { label: 'Company', value: dash(profile.companyName) },
    { label: 'Industry', value: dash(profile.industry) },
    { label: 'Location', value: dash(profile.location) },
    { label: 'Website', value: <ExternalLink href={profile.website} /> },
    { label: 'Contact', value: dash(user.name) },
    { label: 'Phone', value: dash(user.phone) },
    {
      label: 'About',
      value: dash(profile.bio),
    },
    { label: 'Profile created', value: formatDate(profile.createdAt) },
  ]
}

function creatorItems(profile, user, { categoryNameFor } = {}) {
  return [
    { label: 'Storefront name', value: dash(profile.displayName) },
    { label: 'Tagline', value: dash(profile.tagline) },
    { label: 'Location', value: dash(profile.location) },
    {
      label: 'Categories',
      value: <ChipList values={profile.categories} labelFor={categoryNameFor} />,
    },
    { label: 'Content types', value: <ChipList values={profile.contentTypes} /> },
    {
      label: 'Starting price',
      value: formatCurrency(profile.startingPrice ?? 0, profile.currency),
      hint: 'The lowest price on their storefront',
    },
    {
      label: 'Response time',
      value: profile.responseTimeHours
        ? `${formatNumber(profile.responseTimeHours)} hours`
        : EMPTY_PLACEHOLDER,
    },
    {
      label: 'Rating',
      value:
        profile.ratingCount > 0 ? (
          <RatingStars value={profile.ratingAvg} count={profile.ratingCount} size="sm" />
        ) : (
          'Not rated yet'
        ),
    },
    { label: 'Contact', value: dash(user.name) },
    { label: 'Phone', value: dash(user.phone) },
    { label: 'Profile created', value: formatDate(profile.createdAt) },
  ]
}

/**
 * @param {object} props
 * @param {object} props.user the account
 * @param {object|null} props.profile the `buyerProfiles` / `creatorProfiles` record
 * @param {(categoryId: string) => string} [props.categoryNameFor] resolves a
 *   category id to its name — omit and the ids show, which is still readable
 */
export default function RoleProfilePanel({ user, profile, categoryNameFor }) {
  const isCreator = user?.role === ROLES.CREATOR

  if (!profile) {
    return (
      <Card>
        <CardContent>
          <EmptyState
            icon="solar:user-id-linear"
            title="No marketplace profile"
            description={
              isCreator || user?.role === ROLES.BUYER
                ? 'This account has no profile record. That normally means registration was interrupted — the member will be asked to complete it the next time they sign in.'
                : 'Team accounts have no buyer or creator profile. Their permissions are managed on the Admin team screen.'
            }
          />
        </CardContent>
      </Card>
    )
  }

  const completeness = isCreator
    ? getCreatorProfileCompleteness(profile, user)
    : getBuyerProfileCompleteness(profile, user)

  const items = isCreator
    ? creatorItems(profile, user, { categoryNameFor })
    : buyerItems(profile, user)

  return (
    <Stack spacing={{ xs: 2, md: 2.5 }}>
      <Card component="section" aria-labelledby="profile-completeness-heading">
        <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="baseline"
            spacing={2}
            sx={{ mb: 1.5 }}
          >
            <Typography id="profile-completeness-heading" variant="subtitle2" component="h2">
              Profile completeness
            </Typography>
            <Typography variant="h6" component="p" sx={{ fontWeight: 700 }}>
              {completeness.percent}%
            </Typography>
          </Stack>

          <LinearProgress
            variant="determinate"
            value={completeness.percent}
            aria-label={`Profile ${completeness.percent} percent complete`}
            sx={{ height: 8, borderRadius: 1 }}
          />

          <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1.5 }}>
            {/* The creator meter is weighted and the buyer one is a plain count,
                so the copy names the gaps rather than a denominator that means
                two different things. */}
            {completeness.missing.length === 0
              ? 'Every profile field is filled in.'
              : `Still missing: ${completeness.missing.map((field) => field.label).join(', ')}.`}
          </Typography>
        </CardContent>
      </Card>

      <Card component="section" aria-labelledby="profile-details-heading">
        <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
          <Typography id="profile-details-heading" variant="subtitle2" component="h2" sx={{ mb: 2 }}>
            {isCreator ? 'Storefront' : 'Business details'}
          </Typography>
          <Box sx={{ overflowX: 'auto' }}>
            <KeyValueList items={items} labelWidth={180} divided />
          </Box>
        </CardContent>
      </Card>
    </Stack>
  )
}
