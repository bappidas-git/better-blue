import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { alpha } from '@mui/material/styles'

import UserAvatar from '@/components/data-display/UserAvatar'
import { isAdminRole } from '@/constants/roles'
import EvidenceGrid from '@/features/disputes/components/EvidenceGrid'
import { authorRoleLabel } from '@/features/disputes/utils/disputeDisplay'
import { formatDateTime, formatRelativeTime } from '@/utils/formatters'

// One message in the case thread.
//
// Three treatments, not two: what this member said (right-aligned, tinted), what
// the other party said (left, plain), and what BetterBlue said (left, with the
// support badge). The third one matters — a decision-shaped sentence from the
// team must never be mistakable for the other side arguing their corner.
//
// Each bubble is a `<li>` inside the thread's `role="log"` list and carries its
// own accessible label, so a screen-reader user hears "Ava Martinez, Creator,
// 2 days ago" before the text rather than a wall of unattributed paragraphs
// (§12).
//
// **Internal notes never reach this component.** They are filtered in
// `disputeService.listMessages` and, in production, server-side (contract
// §6.17) — there is deliberately no `internal` branch here to get wrong.

/**
 * @param {object} props
 * @param {object} props.message the message record
 * @param {object} [props.author] the author's account, for name and avatar
 * @param {boolean} props.isOwn written by the person reading it
 */
export default function MessageBubble({ message, author, isOwn }) {
  const fromSupport = isAdminRole(message?.authorRole)
  const name = fromSupport ? 'BetterBlue Support' : (author?.companyName ?? author?.name ?? 'Member')
  const roleLabel = authorRoleLabel(message?.authorRole)
  const sent = formatRelativeTime(message?.createdAt)
  const attachments = message?.attachments ?? []

  return (
    <Box
      component="li"
      aria-label={`${isOwn ? 'You' : name}, ${roleLabel}, ${sent}`}
      sx={{
        listStyle: 'none',
        display: 'flex',
        justifyContent: isOwn ? 'flex-end' : 'flex-start',
      }}
    >
      <Stack
        direction={isOwn ? 'row-reverse' : 'row'}
        spacing={1.25}
        alignItems="flex-start"
        // Bubbles stop well short of the full width so the eye can tell the two
        // sides apart without reading a word (§6).
        sx={{ maxWidth: { xs: '100%', sm: '84%', md: '76%' }, minWidth: 0 }}
      >
        <Box sx={{ flexShrink: 0, pt: 0.5 }}>
          {fromSupport ? (
            <Box
              aria-hidden="true"
              sx={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                display: 'grid',
                placeItems: 'center',
                bgcolor: (theme) => alpha(theme.palette.primary.main, 0.12),
                color: 'primary.dark',
              }}
            >
              <Icon icon="solar:shield-user-linear" width={20} />
            </Box>
          ) : (
            <UserAvatar name={name} src={author?.avatarUrl ?? author?.logoUrl} size="sm" />
          )}
        </Box>

        <Box sx={{ minWidth: 0 }}>
          <Stack
            direction="row"
            spacing={0.75}
            alignItems="center"
            flexWrap="wrap"
            useFlexGap
            sx={{ mb: 0.5, justifyContent: isOwn ? 'flex-end' : 'flex-start' }}
          >
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
              {isOwn ? 'You' : name}
            </Typography>
            {/* The support badge *is* the name, so it is not repeated as a chip
                beside itself — the two together read as a stutter. */}
            {fromSupport ? null : (
              <Chip size="small" variant="outlined" label={roleLabel} sx={{ height: 22 }} />
            )}
            <Typography variant="caption" color="text.secondary" title={formatDateTime(message?.createdAt)}>
              {sent}
            </Typography>
          </Stack>

          <Box
            sx={{
              px: 2,
              py: 1.5,
              borderRadius: 2,
              border: 1,
              borderColor: fromSupport ? 'primary.light' : 'divider',
              bgcolor: (theme) =>
                isOwn
                  ? alpha(theme.palette.primary.main, 0.06)
                  : fromSupport
                    ? alpha(theme.palette.primary.main, 0.03)
                    : 'background.paper',
            }}
          >
            <Typography variant="body2" sx={{ whiteSpace: 'pre-line', wordBreak: 'break-word' }}>
              {message?.body}
            </Typography>

            {attachments.length > 0 ? (
              <Box sx={{ mt: 1.5 }}>
                <EvidenceGrid
                  files={attachments}
                  label={`Files attached by ${isOwn ? 'you' : name}`}
                />
              </Box>
            ) : null}
          </Box>
        </Box>
      </Stack>
    </Box>
  )
}
