import { useCallback, useState } from 'react'

import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'

import { brandGradient } from '@/theme/palette'
import { namespacedKey } from '@/utils/storage'

// The line at the top of an overview that says hello and points at the one
// thing worth doing next. Deliberately light: a tinted panel, not a hero — the
// brand gradient is reserved for accents (00 §6), so it appears only on the
// small icon tile.
//
// Dismissal is per **session**: gone for the rest of this visit, back tomorrow.
// `utils/storage` is localStorage-only (a dismissal that outlived the browser
// tab would be a preference nobody set), so this reads sessionStorage directly
// through the same `bb.` namespace helper.

const DEFAULT_STORAGE_KEY = 'dashboard.welcomeDismissed'

function readDismissed(key) {
  try {
    return window.sessionStorage?.getItem(namespacedKey(key)) === 'true'
  } catch {
    // Storage can be blocked entirely — a banner that will not hide is a much
    // smaller problem than a dashboard that will not render.
    return false
  }
}

function writeDismissed(key) {
  try {
    window.sessionStorage?.setItem(namespacedKey(key), 'true')
  } catch {
    // Ignored for the same reason.
  }
}

/** Greeting by local time — the daypart people actually use, not clock hours. */
function greetingForHour(hour) {
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

/** First name only — "Good morning, Nora Whitfield" reads like a form letter. */
function firstName(name) {
  return String(name ?? '').trim().split(/\s+/)[0] || 'there'
}

/**
 * @param {object} props
 * @param {string} props.name the member's name — only the first word is used
 * @param {React.ReactNode} [props.subline] the contextual second line: what needs
 *   attention today, e.g. "Two proposals are waiting on your decision."
 * @param {string} [props.icon='solar:hand-stars-linear'] iconify name for the tile
 * @param {React.ReactNode} [props.action] optional right-aligned slot — one button at most
 * @param {boolean} [props.dismissable=true] show the close button
 * @param {string} [props.storageKey='dashboard.welcomeDismissed'] per-session dismissal key;
 *   give role-specific banners distinct keys
 * @param {Date} [props.now] injectable clock — the dev gallery uses it to show every daypart
 * @param {object} [props.sx] MUI system styles
 */
export default function WelcomeBanner({
  name,
  subline,
  icon = 'solar:hand-stars-linear',
  action,
  dismissable = true,
  storageKey = DEFAULT_STORAGE_KEY,
  now,
  sx,
  ...rest
}) {
  const [dismissed, setDismissed] = useState(() => dismissable && readDismissed(storageKey))

  const dismiss = useCallback(() => {
    setDismissed(true)
    writeDismissed(storageKey)
  }, [storageKey])

  if (dismissed) return null

  const greeting = greetingForHour((now ?? new Date()).getHours())

  return (
    <Paper
      elevation={0}
      sx={{
        px: { xs: 2, md: 3 },
        py: { xs: 2, md: 2.5 },
        borderRadius: 4,
        border: 1,
        borderColor: 'divider',
        bgcolor: 'primary.surface',
        ...sx,
      }}
      {...rest}
    >
      <Stack direction="row" spacing={2} alignItems="center">
        <Box
          aria-hidden="true"
          sx={{
            flexShrink: 0,
            width: 44,
            height: 44,
            borderRadius: 2.5,
            display: { xs: 'none', sm: 'grid' },
            placeItems: 'center',
            backgroundImage: brandGradient,
            color: 'primary.contrastText',
          }}
        >
          <Icon icon={icon} width={23} />
        </Box>

        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography variant="h6" component="p" sx={{ fontSize: '1.0625rem' }}>
            {greeting}, {firstName(name)}
          </Typography>
          {subline ? (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
              {subline}
            </Typography>
          ) : null}
        </Box>

        {action ? <Box sx={{ flexShrink: 0 }}>{action}</Box> : null}

        {dismissable ? (
          <IconButton
            onClick={dismiss}
            aria-label="Dismiss welcome message"
            size="small"
            // 44px, not 36 — this is the only control on the banner and it sits
            // at the top of every dashboard on a phone (00 §13).
            sx={{ flexShrink: 0, width: 44, height: 44, color: 'text.secondary' }}
          >
            <Icon icon="tabler:x" width={18} />
          </IconButton>
        ) : null}
      </Stack>
    </Paper>
  )
}
