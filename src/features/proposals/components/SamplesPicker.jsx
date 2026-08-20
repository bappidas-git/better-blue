import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import ButtonBase from '@mui/material/ButtonBase'
import Link from '@mui/material/Link'
import Skeleton from '@mui/material/Skeleton'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { visuallyHidden } from '@mui/utils'
import { alpha } from '@mui/material/styles'
import { Link as RouterLink } from 'react-router-dom'

import { paths } from '@/routes/paths'

// Pick up to three pieces of published sample work to send with an offer.
//
// Checkboxes, not a listbox: each tile is an `aria-pressed` toggle backed by a
// real `<input type="checkbox">`, so the whole grid is one labelled group that
// arrows and space keys already understand. The visual check overlay is
// decorative — everything it says is in the tile's accessible name.
//
// Only **published** work is offered. That is a rule the picker cannot enforce
// on its own (its caller decides what to pass), so the caller loads the grid
// through `portfolioService.listPublished` — the single leak-proof boundary for
// a creator's live work (Prompt 22).

/** Tiles rendered while the portfolio loads. */
const SKELETON_COUNT = 6

function Tile({ item, isSelected, isDisabled, onToggle }) {
  return (
    <Box component="li" sx={{ listStyle: 'none' }}>
      <ButtonBase
        component="label"
        focusRipple
        sx={{
          position: 'relative',
          display: 'block',
          width: '100%',
          aspectRatio: '4 / 3',
          borderRadius: 2,
          overflow: 'hidden',
          border: 2,
          borderColor: isSelected ? 'primary.main' : 'divider',
          cursor: isDisabled ? 'not-allowed' : 'pointer',
          opacity: isDisabled ? 0.45 : 1,
          transition: (theme) => theme.transitions.create(['border-color', 'opacity']),
        }}
      >
        <Box
          component="input"
          type="checkbox"
          checked={isSelected}
          disabled={isDisabled}
          onChange={() => onToggle(item.id)}
          sx={visuallyHidden}
        />
        <Box component="span" sx={visuallyHidden}>
          {item.title}
        </Box>

        <Box
          component="img"
          src={item.thumbnailUrl || item.mediaUrl}
          alt=""
          loading="lazy"
          sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />

        {/* Decorative: the checkbox above already carries the state. */}
        <Box
          aria-hidden="true"
          sx={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'flex-end',
            p: 0.75,
            bgcolor: (theme) =>
              isSelected ? alpha(theme.palette.primary.main, 0.22) : 'transparent',
            transition: (theme) => theme.transitions.create('background-color'),
          }}
        >
          <Box
            sx={{
              width: 26,
              height: 26,
              borderRadius: '50%',
              display: 'grid',
              placeItems: 'center',
              // Over a photo thumbnail, so the unselected chip is a dark scrim
              // rather than the old near-white disc — on this theme the neutral
              // text token is *light* and would have vanished into it.
              bgcolor: (theme) =>
                isSelected
                  ? theme.palette.primary.main
                  : alpha(theme.palette.common.black, 0.62),
              color: 'common.white',
              boxShadow: 1,
            }}
          >
            <Icon icon={isSelected ? 'tabler:check' : 'tabler:plus'} width={16} />
          </Box>
        </Box>

        <Box
          aria-hidden="true"
          sx={{
            position: 'absolute',
            insetInline: 0,
            bottom: 0,
            px: 1,
            py: 0.75,
            background: 'linear-gradient(to top, rgba(0,0,0,0.72), rgba(0,0,0,0))',
          }}
        >
          <Typography
            variant="caption"
            sx={{
              color: 'common.white',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              textAlign: 'left',
              lineHeight: 1.3,
            }}
          >
            {item.title}
          </Typography>
        </Box>
      </ButtonBase>
    </Box>
  )
}

/**
 * @param {object} props
 * @param {object[]} props.items the creator's **published** portfolio items
 * @param {string[]} props.value selected `pfi_…` ids
 * @param {(next: string[]) => void} props.onChange reports the new selection
 * @param {number} [props.max=3] selection ceiling
 * @param {boolean} [props.isLoading=false] the portfolio request is in flight
 */
export default function SamplesPicker({ items = [], value = [], onChange, max = 3, isLoading = false }) {
  const isFull = value.length >= max

  const toggle = (id) => {
    if (value.includes(id)) {
      onChange(value.filter((entry) => entry !== id))
      return
    }
    if (isFull) return
    onChange([...value, id])
  }

  return (
    <Box>
      <Stack
        direction="row"
        spacing={1}
        alignItems="baseline"
        justifyContent="space-between"
        sx={{ mb: 1 }}
      >
        <Typography variant="subtitle2" component="h3" id="samples-picker-label">
          Sample work
        </Typography>
        <Typography
          variant="caption"
          // Announced on change so a keyboard user hears the counter move
          // rather than discovering the ceiling by a tile going quiet.
          role="status"
          aria-live="polite"
          sx={{ color: isFull ? 'primary.main' : 'text.secondary', fontWeight: isFull ? 600 : 400 }}
        >
          {value.length} of {max} selected
        </Typography>
      </Stack>

      {isLoading ? (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 1,
          }}
        >
          {Array.from({ length: SKELETON_COUNT }, (_, index) => (
            <Skeleton key={index} variant="rounded" sx={{ width: '100%', aspectRatio: '4 / 3' }} />
          ))}
        </Box>
      ) : items.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          You have no published work yet, so this proposal will go without samples.{' '}
          <Link component={RouterLink} to={paths.CREATOR_PORTFOLIO}>
            Add portfolio items
          </Link>{' '}
          — buyers open them before they read a word of the price.
        </Typography>
      ) : (
        <>
          <Box
            component="ul"
            role="group"
            aria-labelledby="samples-picker-label"
            aria-describedby="samples-picker-hint"
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 1,
              m: 0,
              p: 0,
            }}
          >
            {items.map((item) => (
              <Tile
                key={item.id}
                item={item}
                isSelected={value.includes(item.id)}
                isDisabled={isFull && !value.includes(item.id)}
                onToggle={toggle}
              />
            ))}
          </Box>

          <Typography
            id="samples-picker-hint"
            variant="caption"
            color="text.secondary"
            component="p"
            sx={{ mt: 1 }}
          >
            {items.length < max ? (
              <>
                Pick up to {max}.{' '}
                <Link component={RouterLink} to={paths.CREATOR_PORTFOLIO}>
                  Add portfolio items
                </Link>{' '}
                to have more to choose from.
              </>
            ) : (
              `Pick up to ${max} pieces that are closest to what this buyer asked for.`
            )}
          </Typography>
        </>
      )}
    </Box>
  )
}
