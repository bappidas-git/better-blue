import { useState } from 'react'

import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Divider from '@mui/material/Divider'
import IconButton from '@mui/material/IconButton'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { alpha } from '@mui/material/styles'

import { formatDate, formatRelativeTime } from '@/utils/formatters'

import ReplyComposer from './ReplyComposer'

// **The creator's own conversation with the buyer** — Storefront V2,
// `prompts-v2/08` §2.
//
// PRIVACY: this card renders exactly one thread, the one handed to it, and the
// only thread the page ever fetches is the signed-in creator's own
// (`feedService.getMyReply(feedId, creatorId)`). There is no list here and no
// prop that could carry somebody else's messages. The check that *matters* is
// server-side: the Laravel API must scope the query to the signed-in creator,
// because a client-side filter protects nothing (00 §11).
//
// The composer sits at the bottom of the card and is sticky below `md`, which
// is what keeps it reachable on a phone without `position: fixed` — a fixed bar
// is the one that ends up underneath an on-screen keyboard. In normal flow the
// browser scrolls the focused field above the keyboard by itself.

/** Which side of the thread a message sits on. */
const CREATOR = 'creator'

/**
 * @param {object} props
 * @param {object} props.reply the thread — `{ id, messages, createdAt }`
 * @param {string} props.buyerName the business, as the header names it
 * @param {(body: string) => Promise<*>} props.onSendMessage
 * @param {() => void} props.onDelete opens the caller's confirmation
 * @param {boolean} [props.isSending]
 * @param {boolean} [props.isDeleting]
 * @param {object} [props.composerRef] ref onto the textarea
 * @param {string} props.headingId
 */
export default function ReplyThreadCard({
  reply,
  buyerName,
  onSendMessage,
  onDelete,
  isSending = false,
  isDeleting = false,
  composerRef,
  headingId,
}) {
  const [menuAnchor, setMenuAnchor] = useState(null)
  const messages = Array.isArray(reply.messages) ? reply.messages : []

  const closeMenu = () => setMenuAnchor(null)

  return (
    <Card>
      <CardContent sx={{ p: { xs: 2, sm: 3 }, '&:last-child': { pb: { xs: 2, sm: 3 } } }}>
        {/* --- header ------------------------------------------------------- */}
        <Stack direction="row" spacing={1.5} alignItems="flex-start">
          <Box sx={{ minWidth: 0, flexGrow: 1 }}>
            <Typography id={headingId} variant="subtitle1" component="h2" sx={{ fontWeight: 700 }}>
              Your conversation with {buyerName}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              You replied on <time dateTime={reply.createdAt}>{formatDate(reply.createdAt)}</time> ·
              Private to you and {buyerName}
            </Typography>
          </Box>

          <IconButton
            aria-label="Reply options"
            aria-haspopup="menu"
            aria-expanded={menuAnchor ? true : undefined}
            onClick={(event) => setMenuAnchor(event.currentTarget)}
            disabled={isDeleting}
            // 44px explicitly, the way every other kebab in the product does it
            // — an icon button's padding alone does not clear the touch target
            // (00 §13).
            sx={{ flexShrink: 0, mt: -0.5, width: 44, height: 44 }}
          >
            <Icon icon="solar:menu-dots-bold" width={20} aria-hidden="true" />
          </IconButton>
          <Menu
            anchorEl={menuAnchor}
            open={Boolean(menuAnchor)}
            onClose={closeMenu}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            MenuListProps={{ 'aria-label': 'Reply options' }}
          >
            <MenuItem
              onClick={() => {
                closeMenu()
                onDelete()
              }}
              sx={{ color: 'error.dark' }}
            >
              <ListItemIcon sx={{ color: 'inherit' }}>
                <Icon icon="solar:trash-bin-trash-linear" width={20} aria-hidden="true" />
              </ListItemIcon>
              <ListItemText primary="Delete reply" />
            </MenuItem>
          </Menu>
        </Stack>

        <Divider sx={{ my: 2 }} />

        {/* --- the conversation --------------------------------------------- */}
        <Stack
          // `role="log"` gives it a polite live region, so a message appended
          // while the creator is reading is announced without stealing focus.
          role="log"
          aria-label={`Conversation with ${buyerName}, oldest message first`}
          spacing={2}
          sx={{ minWidth: 0 }}
        >
          {messages.map((message) => {
            const isMine = message.authorRole === CREATOR
            const author = isMine ? 'You' : buyerName

            return (
              <Stack
                key={message.id}
                spacing={0.5}
                sx={{ alignItems: isMine ? 'flex-end' : 'flex-start', opacity: message.pending ? 0.65 : 1 }}
              >
                <Typography variant="caption" color="text.secondary" sx={{ px: 0.5 }}>
                  {author} ·{' '}
                  {message.pending ? (
                    'Sending…'
                  ) : (
                    <time dateTime={message.at}>{formatRelativeTime(message.at)}</time>
                  )}
                </Typography>

                <Box
                  sx={{
                    maxWidth: { xs: '92%', sm: '82%' },
                    px: 2,
                    py: 1.5,
                    borderRadius: 'var(--bb-radius-lg)',
                    border: '1px solid',
                    ...(isMine
                      ? {
                          // A *tint* of the brand gradient, not the gradient:
                          // body copy never sits on the full-saturation stops
                          // (docs/theme-v2.md §4).
                          background: (theme) =>
                            `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.2)} 0%, ${alpha(
                              theme.palette.secondary.main,
                              0.18
                            )} 100%)`,
                          borderColor: (theme) => alpha(theme.palette.primary.main, 0.3),
                          borderBottomRightRadius: 'var(--bb-radius-sm)',
                        }
                      : {
                          backgroundColor: 'var(--bb-glass-bg)',
                          borderColor: 'var(--bb-glass-border)',
                          borderBottomLeftRadius: 'var(--bb-radius-sm)',
                        }),
                  }}
                >
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-line', wordBreak: 'break-word' }}>
                    {message.body}
                  </Typography>
                </Box>
              </Stack>
            )
          })}
        </Stack>

        {/* --- the composer, sticky on a phone ------------------------------ */}
        <Box
          sx={{
            mt: 2.5,
            pt: 2,
            position: { xs: 'sticky', md: 'static' },
            bottom: 0,
            zIndex: 1,
            scrollMarginBottom: 16,
            // The card's own surface, so the thread scrolls *under* the
            // composer rather than through it.
            bgcolor: 'background.elevated',
            borderTop: '1px solid',
            borderColor: 'divider',
            pb: 'env(safe-area-inset-bottom, 0px)',
          }}
        >
          <ReplyComposer
            label="Add to the conversation"
            placeholder="Answer their question, confirm a date, or share what you would need to get started."
            submitLabel="Send"
            hint={`Only ${buyerName} can read this.`}
            rows={3}
            inputRef={composerRef}
            isSubmitting={isSending}
            // A closed deal stops *new* replies; it does not end a conversation
            // that is already open. `addReplyMessage` takes a message whatever
            // the feed's status is, and a buyer who closed the brief may still
            // owe this creator an answer.
            disabled={isDeleting}
            onSubmit={onSendMessage}
          />
        </Box>
      </CardContent>
    </Card>
  )
}
