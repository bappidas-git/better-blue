import { useCallback, useEffect, useState } from 'react'

import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Skeleton from '@mui/material/Skeleton'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { alpha } from '@mui/material/styles'
import { Link as RouterLink } from 'react-router-dom'

import ErrorState from '@/components/feedback/ErrorState'
import { useToast } from '@/components/feedback/ToastProvider'
import ResponsiveDialog from '@/components/layout/ResponsiveDialog'
import { AFFILIATE_PROFILE_STATUS } from '@/constants/statuses'
import {
  copyToClipboard,
  referralUrl,
  shareTargets,
} from '@/features/affiliate/utils/referralLink'
import useApiQuery from '@/hooks/useApiQuery'
import { paths } from '@/routes/paths'
import { affiliateService } from '@/services'

// "Promote" for a signed-in buyer — Storefront V2 (`prompts-v2/09` §5).
//
// One dialog, two states, decided by whether the buyer is enrolled in the
// referral programme:
//
//   enrolled     their own referral link, with the storefront that prompted it
//                attributed on the end, plus copy and the three share targets
//   not enrolled the same explanation and a way in — `/buyer/affiliate`
//
// One dialog rather than two, because the second state is the first one's
// answer to "why can I not see a link": a buyer who clicks Promote is asking
// the same question either way, and being told to go somewhere else entirely
// would lose the creator they were looking at.
//
// **The programme's mechanics are untouched** (§"Do NOT"): the link is the
// member's ordinary `/r/{CODE}`, the commission is the same commission, and the
// `?creator=` parameter is a note about where the link was shared, not a second
// kind of attribution. See `features/affiliate/utils/referralLink.js`.

/** How long the button keeps saying "Copied" before it offers the action again. */
const COPIED_MS = 2000

/** The link, in the tinted well the affiliate dashboard uses for the same string. */
function LinkWell({ url }) {
  return (
    <Box
      sx={{
        p: { xs: 1.75, md: 2 },
        borderRadius: 2,
        border: 1,
        borderColor: (theme) => alpha(theme.palette.primary.main, 0.24),
        bgcolor: 'primary.surface',
      }}
    >
      {/* `wordBreak` rather than truncation: a member checking their code needs
          all of it, and on a 360px phone that means it wraps. */}
      <Typography
        component="p"
        sx={{
          fontFamily: 'monospace',
          fontSize: { xs: '0.8125rem', md: '0.875rem' },
          wordBreak: 'break-all',
          color: 'primary.light',
        }}
      >
        {url}
      </Typography>
    </Box>
  )
}

/**
 * @param {object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {object|null} props.creator the storefront being promoted
 * @param {string} props.buyerId `usr_…` — the signed-in buyer
 */
export default function PromoteCreatorDialog({ open, onClose, creator, buyerId }) {
  const toast = useToast()
  const [copied, setCopied] = useState(false)

  // Asked only while the dialog is open, and only for a buyer: a guest or a
  // creator never reaches this component (the page shows them the role gate),
  // and a closed dialog has no reason to hold a request.
  const {
    data: profile,
    isLoading,
    error,
    refetch,
  } = useApiQuery(() => affiliateService.getByUserId(buyerId), [buyerId, open], {
    enabled: open && Boolean(buyerId),
  })

  useEffect(() => {
    if (open) setCopied(false)
  }, [open, creator?.id])

  const isEnrolled = Boolean(profile)
  const isSuspended = profile?.status === AFFILIATE_PROFILE_STATUS.SUSPENDED
  const url = isEnrolled ? referralUrl(profile.code, { creatorId: creator?.id }) : ''

  const copy = useCallback(async () => {
    if (await copyToClipboard(url)) {
      setCopied(true)
      toast.success('Promotion link copied', {
        description: 'Paste it into a post, an email, or a message.',
      })
      window.setTimeout(() => setCopied(false), COPIED_MS)
      return
    }
    toast.error('We could not copy the link.', {
      description: 'Select the link above and copy it manually.',
    })
  }, [toast, url])

  const creatorName = creator?.displayName ?? 'this creator'

  const renderBody = () => {
    if (isLoading) {
      return (
        <Stack spacing={2}>
          <Skeleton variant="text" width="90%" />
          <Skeleton variant="rounded" height={64} />
          <Skeleton variant="rounded" height={44} width={200} />
        </Stack>
      )
    }

    if (error) {
      return (
        <ErrorState
          dense
          title="We could not check your referral account"
          message="Your link is safe — this is only the lookup that fetches it."
          error={error}
          onRetry={refetch}
        />
      )
    }

    if (!isEnrolled) {
      return (
        <Stack spacing={2}>
          <Typography variant="body2" color="text.secondary">
            Join the affiliate program to promote creators. You get a referral link of your own,
            and BetterBlue pays you commission when a business you introduce completes its first
            order.
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Enrolling is free and takes a minute — the same link then works on every storefront,
            including {creatorName}’s.
          </Typography>
        </Stack>
      )
    }

    return (
      <Stack spacing={2}>
        <Typography variant="body2" color="text.secondary">
          Share {creatorName}’s work with your referral link. Anyone who signs up through it is
          attributed to you, and you earn commission when they complete their first order.
        </Typography>

        <LinkWell url={url} />

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
          <Button
            variant="contained"
            onClick={copy}
            sx={{ minHeight: 44, minWidth: { sm: 180 } }}
            startIcon={
              <Icon
                icon={copied ? 'solar:check-circle-bold' : 'solar:copy-linear'}
                width={20}
                aria-hidden="true"
              />
            }
          >
            {copied ? 'Copied' : 'Copy link'}
          </Button>

          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {shareTargets(profile.code, { creatorId: creator?.id }).map((target) => (
              <Button
                key={target.key}
                component="a"
                href={target.href}
                variant="outlined"
                color="inherit"
                aria-label={target.ariaLabel}
                {...(target.external
                  ? { target: '_blank', rel: 'noopener noreferrer' }
                  : null)}
                sx={{ minHeight: 44 }}
                startIcon={<Icon icon={target.icon} width={20} aria-hidden="true" />}
              >
                {target.shortLabel}
              </Button>
            ))}
          </Stack>
        </Stack>

        <Stack direction="row" spacing={1.5} alignItems="flex-start">
          <Box aria-hidden="true" sx={{ display: 'flex', color: 'text.secondary', mt: 0.25 }}>
            <Icon icon="solar:info-circle-linear" width={20} />
          </Box>
          <Typography variant="caption" color="text.secondary">
            {isSuspended ? (
              <>
                Your referral account is paused, so new signups are not being recorded against
                this link. Commission you have already earned is unaffected — your affiliate page
                explains where it stands.
              </>
            ) : (
              <>
                Your code is <strong>{profile.code}</strong>. The <code>creator</code> parameter
                notes which storefront you shared from; attribution itself is always the code.
              </>
            )}
          </Typography>
        </Stack>
      </Stack>
    )
  }

  return (
    <ResponsiveDialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      title={isEnrolled ? `Promote ${creatorName}` : 'Promote creators and earn commission'}
      description={
        isEnrolled
          ? 'Your referral link, with this storefront attributed on the end.'
          : 'Referral links are part of the BetterBlue affiliate program.'
      }
      actions={
        <Stack
          direction={{ xs: 'column-reverse', sm: 'row' }}
          spacing={1}
          sx={{ width: '100%', justifyContent: 'flex-end' }}
        >
          <Button variant="text" color="inherit" onClick={onClose}>
            Close
          </Button>
          <Button
            component={RouterLink}
            to={paths.BUYER_AFFILIATE}
            variant={isEnrolled ? 'outlined' : 'gradient'}
            onClick={onClose}
            endIcon={<Icon icon="tabler:arrow-right" width={18} aria-hidden="true" />}
          >
            {isEnrolled ? 'Open affiliate dashboard' : 'Join the affiliate program'}
          </Button>
        </Stack>
      }
    >
      {renderBody()}
    </ResponsiveDialog>
  )
}
