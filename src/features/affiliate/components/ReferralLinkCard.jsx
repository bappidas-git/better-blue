import { useCallback, useState } from 'react'

import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Divider from '@mui/material/Divider'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { alpha } from '@mui/material/styles'

import StatusChip from '@/components/data-display/StatusChip'
import { useToast } from '@/components/feedback/ToastProvider'
import { AFFILIATE_PROFILE_STATUS } from '@/constants/statuses'
import { copyToClipboard, referralUrl, shareTargets } from '@/features/affiliate/utils/referralLink'

// The hero of the affiliate dashboard: one link, one obvious way to copy it,
// and three ways to send it somewhere (Prompt 34 §6).
//
// Everything else on the screen is a number about the past. This is the only
// control that does anything, so it gets the top of the page, the brand tint,
// and the full width of the card — and the copy button is a real button with a
// label rather than an icon somebody has to guess at.
//
// A11Y: the copy result is announced twice over, because the two channels serve
// different readers — the button's own label flips to "Copied" (visible, and
// read by a screen reader on refocus) and a toast fires with `role="status"`
// (heard immediately, per `ToastProvider`). The share links are plain anchors
// with explicit "Share on …" labels; the icons are decorative.

/** How long the button keeps saying "Copied" before it offers the action again. */
const COPIED_MS = 2000

/**
 * @param {object} props
 * @param {object} props.profile the affiliate account — `code` and `status`
 */
export default function ReferralLinkCard({ profile }) {
  const toast = useToast()
  const [copied, setCopied] = useState(false)

  const url = referralUrl(profile?.code)
  const isSuspended = profile?.status === AFFILIATE_PROFILE_STATUS.SUSPENDED

  const copy = useCallback(async () => {
    if (await copyToClipboard(url)) {
      setCopied(true)
      toast.success('Referral link copied', {
        description: 'Paste it into an email, a message, or your profile bio.',
      })
      window.setTimeout(() => setCopied(false), COPIED_MS)
      return
    }
    toast.error('We could not copy the link.', {
      description: 'Select the link above and copy it manually.',
    })
  }, [toast, url])

  return (
    <Card>
      <CardContent sx={{ p: { xs: 2.5, md: 3.5 } }}>
        <Stack spacing={2.5}>
          <Stack
            direction="row"
            spacing={2}
            justifyContent="space-between"
            alignItems="flex-start"
            useFlexGap
            flexWrap="wrap"
          >
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="overline" component="p" color="text.secondary">
                Your referral link
              </Typography>
              <Typography variant="h6" component="h2">
                Share BetterBlue, earn commission
              </Typography>
            </Box>
            <StatusChip status={profile?.status} size="sm" tooltip />
          </Stack>

          {/* The link itself. `wordBreak` rather than truncation: a member
              reading it aloud or checking the code needs all of it, and on a
              360px phone that means it wraps. */}
          <Box
            sx={{
              p: { xs: 1.75, md: 2 },
              borderRadius: 2,
              border: 1,
              borderColor: (theme) => alpha(theme.palette.primary.main, 0.24),
              bgcolor: 'primary.surface',
            }}
          >
            <Typography
              component="p"
              sx={{
                fontFamily: 'monospace',
                fontSize: { xs: '0.875rem', md: '1rem' },
                wordBreak: 'break-all',
                color: 'primary.dark',
              }}
            >
              {url}
            </Typography>
          </Box>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            <Button
              variant="contained"
              onClick={copy}
              fullWidth
              sx={{ minHeight: 44, flexGrow: { sm: 0 }, minWidth: { sm: 200 } }}
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

            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }} useFlexGap>
              {shareTargets(profile?.code).map((target) => (
                <Button
                  key={target.key}
                  component="a"
                  href={target.href}
                  variant="outlined"
                  color="inherit"
                  aria-label={target.ariaLabel}
                  {...(target.external ? { target: '_blank', rel: 'noopener noreferrer' } : null)}
                  sx={{ minHeight: 44 }}
                  startIcon={<Icon icon={target.icon} width={20} aria-hidden="true" />}
                >
                  {target.shortLabel}
                </Button>
              ))}
            </Stack>
          </Stack>

          <Divider />

          <Stack direction="row" spacing={1.5} alignItems="flex-start">
            <Box aria-hidden="true" sx={{ display: 'flex', color: 'text.secondary', mt: 0.25 }}>
              <Icon icon="solar:info-circle-linear" width={20} />
            </Box>
            <Typography variant="body2" color="text.secondary">
              {isSuspended ? (
                <>
                  This link is paused, so new signups are not being recorded against it. Commission
                  you have already earned is unaffected — contact support if you would like the
                  account reviewed.
                </>
              ) : (
                <>
                  Your code is <strong>{profile?.code}</strong>. Anyone who signs up through this
                  link is attributed to you, and commission is earned when a referred business
                  completes their first order.
                </>
              )}
            </Typography>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  )
}
