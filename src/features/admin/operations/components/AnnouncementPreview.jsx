import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'

import { NOTIFICATION_TYPE } from '@/constants/notificationTypes'
import NotificationItem from '@/features/notifications/components/NotificationItem'

// What the announcement will look like in a member's feed — Prompt 31 §6.
//
// Rendered with the **real** `NotificationItem`, the same component the bell
// dropdown and the notifications page use, because a preview drawn by a
// lookalike is a preview of the lookalike. It is fed a notification-shaped
// object that is never written anywhere: `read: false` and a `createdAt` of
// now, which is exactly the state a recipient will find it in.
//
// Labelled as a preview in the region's accessible name (§12), so somebody
// reading the page with a screen reader does not meet an unexplained
// notification in the middle of a compose form.

/** Placeholders, so an empty composer previews the shape rather than a blank. */
const PLACEHOLDER_TITLE = 'Your announcement title'
const PLACEHOLDER_BODY =
  'Your message appears here. Members see it in their notification feed and in the bell menu.'

/**
 * @param {object} props
 * @param {string} [props.title] the composer's current title
 * @param {string} [props.body] the composer's current message
 * @param {string} [props.audienceLabel] who it is going to, shown as a chip
 * @param {string} [props.sentAt] ISO timestamp to preview against (defaults to now)
 */
export default function AnnouncementPreview({ title, body, audienceLabel, sentAt }) {
  const notification = {
    id: 'preview',
    type: NOTIFICATION_TYPE.SYSTEM_ANNOUNCEMENT,
    title: title?.trim() || PLACEHOLDER_TITLE,
    body: body?.trim() || PLACEHOLDER_BODY,
    read: false,
    createdAt: sentAt ?? new Date().toISOString(),
  }

  return (
    <Card
      component="section"
      aria-label="Preview of the announcement as members will see it"
      variant="outlined"
      sx={{ bgcolor: 'background.default' }}
    >
      <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
          <Typography variant="subtitle2" component="h2">
            Preview
          </Typography>
          <Box sx={{ flexGrow: 1 }} />
          {audienceLabel ? <Chip size="small" variant="outlined" label={audienceLabel} /> : null}
        </Stack>

        <Box
          component="ul"
          sx={{ listStyle: 'none', m: 0, p: 0, bgcolor: 'background.paper', borderRadius: 2 }}
        >
          {/* Inert on purpose: a preview that navigates would be a lie about
              what it is. `onOpen` is a no-op rather than absent so the row still
              renders its real markup. */}
          <NotificationItem notification={notification} onOpen={() => {}} />
        </Box>

        <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1.5 }}>
          Announcements ignore notification preferences — a member who has muted the “Account &
          announcements” category still receives this one.
        </Typography>
      </CardContent>
    </Card>
  )
}
