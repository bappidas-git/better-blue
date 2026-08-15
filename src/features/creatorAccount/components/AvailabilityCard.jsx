import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Skeleton from '@mui/material/Skeleton'
import Stack from '@mui/material/Stack'
import Switch from '@mui/material/Switch'
import Typography from '@mui/material/Typography'
import { alpha } from '@mui/material/styles'

import { paths } from '@/routes/paths'

// "Accepting new requests" as a card: the state, what it means for the
// storefront, and the switch — the version that sits on the creator overview
// where it is the first thing read, rather than the compact one beside the page
// header.
//
// The tint carries the state as well as the switch does (§6: success tint when
// on), and the copy under it changes with it, so the card is never ambiguous at
// a glance or to a screen reader.

/**
 * @param {object} props
 * @param {boolean} props.isAvailable current state
 * @param {(next: boolean) => void} props.onChange
 * @param {boolean} [props.disabled=false] while a save is in flight
 * @param {boolean} [props.loading=false] render a skeleton instead
 * @param {object} [props.sx] MUI system styles
 */
export default function AvailabilityCard({
  isAvailable,
  onChange,
  disabled = false,
  loading = false,
  sx,
}) {
  if (loading) {
    return (
      <Card sx={sx}>
        <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
          <Skeleton
            variant="rounded"
            role="status"
            aria-busy="true"
            aria-label="Loading your availability"
            sx={{ height: 64 }}
          />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card
      sx={{
        borderColor: (theme) =>
          isAvailable ? alpha(theme.palette.success.main, 0.4) : 'divider',
        bgcolor: (theme) =>
          isAvailable ? alpha(theme.palette.success.main, 0.06) : 'background.paper',
        ...sx,
      }}
    >
      <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={{ xs: 2, sm: 2.5 }}
          alignItems={{ xs: 'flex-start', sm: 'center' }}
        >
          <Box
            aria-hidden="true"
            sx={{
              width: 44,
              height: 44,
              flexShrink: 0,
              borderRadius: 2,
              display: 'grid',
              placeItems: 'center',
              color: isAvailable ? 'success.main' : 'text.secondary',
              bgcolor: (theme) =>
                isAvailable
                  ? alpha(theme.palette.success.main, 0.14)
                  : theme.palette.background.default,
            }}
          >
            <Icon icon={isAvailable ? 'solar:shop-2-linear' : 'solar:moon-sleep-linear'} width={24} />
          </Box>

          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Typography variant="h6" component="h2" sx={{ fontSize: '1.0625rem' }}>
              {isAvailable ? 'Accepting new requests' : 'Not accepting new requests'}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, maxWidth: '62ch' }}>
              {isAvailable
                ? `Your storefront appears in the creator directory at ${paths.CREATORS} and buyers can invite you to their briefs.`
                : 'Your storefront is hidden from the creator directory. Orders already in flight carry on as normal, and your public profile link still works for anyone who has it.'}
            </Typography>
          </Box>

          <Box sx={{ flexShrink: 0 }}>
            {/* The switch carries its own state in its accessible name, so it
                never announces as a bare "Accepting new requests, checkbox"
                whose meaning depends on a tint (§12). */}
            <Switch
              checked={isAvailable}
              onChange={(event) => onChange?.(event.target.checked)}
              disabled={disabled}
              color="success"
              inputProps={{
                'aria-label': isAvailable
                  ? 'Accepting new requests. Switch off to hide your storefront from the directory.'
                  : 'Not accepting new requests. Switch on to list your storefront in the directory.',
              }}
            />
          </Box>
        </Stack>
      </CardContent>
    </Card>
  )
}
