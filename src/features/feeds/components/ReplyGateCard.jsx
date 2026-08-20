import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { alpha } from '@mui/material/styles'

import { formatNumber } from '@/utils/formatters'

// What everyone who is **not** a signed-in creator sees under a feed
// (Storefront V2, `prompts-v2/08` §2).
//
// PRIVACY: this card is the whole of the reply area for a guest, a buyer, or an
// admin. It renders a *number* and nothing else — no thread, no message, no
// creator name, not even a breakdown of who replied. That is not a styling
// decision: a reply is private between one creator and the buyer who posted the
// feed, so there is no view of it for a third party to be shown. The page never
// asks the API for one either (`FeedReplySection`).

/**
 * @param {object} props
 * @param {number} props.repliesCount the public count on the feed
 * @param {boolean} props.canReply whether the feed is still taking replies
 * @param {() => void} props.onReply opens the role gate
 * @param {string} props.headingId
 */
export default function ReplyGateCard({ repliesCount, canReply, onReply, headingId }) {
  const replies = Number(repliesCount) || 0

  return (
    <Card>
      <CardContent sx={{ p: { xs: 2.5, sm: 3 } }}>
        <Stack direction="row" spacing={2} alignItems="flex-start">
          <Box
            aria-hidden="true"
            sx={{
              flexShrink: 0,
              display: 'grid',
              placeItems: 'center',
              width: 44,
              height: 44,
              borderRadius: 'var(--bb-radius-md)',
              color: 'primary.light',
              bgcolor: 'primary.lighter',
              boxShadow: (theme) => `inset 0 0 0 1px ${alpha(theme.palette.primary.main, 0.28)}`,
            }}
          >
            <Icon icon="solar:lock-keyhole-minimalistic-linear" width={22} />
          </Box>

          <Box sx={{ minWidth: 0, flexGrow: 1 }}>
            <Typography id={headingId} variant="subtitle1" component="h2" sx={{ fontWeight: 700 }}>
              Replies are private between each creator and the buyer
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
              {replies === 0
                ? 'No creator has replied to this feed yet. Reply as a creator and your conversation with the buyer stays between the two of you.'
                : `${formatNumber(replies)} ${replies === 1 ? 'creator has' : 'creators have'} replied. Each conversation is visible only to the creator who wrote it and the business that posted the feed.`}
            </Typography>
          </Box>
        </Stack>

        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1.5}
          alignItems={{ xs: 'stretch', sm: 'center' }}
          sx={{ mt: 2.5 }}
        >
          <Button
            variant="gradient"
            size="large"
            disabled={!canReply}
            onClick={onReply}
            startIcon={<Icon icon="solar:chat-round-line-linear" width={18} aria-hidden="true" />}
          >
            Reply
          </Button>
          <Typography variant="body2" color="text.secondary">
            {canReply
              ? 'Creators only — it takes a minute to register.'
              : 'This feed is no longer taking replies.'}
          </Typography>
        </Stack>
      </CardContent>
    </Card>
  )
}
