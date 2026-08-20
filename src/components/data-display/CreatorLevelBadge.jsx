import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Tooltip from '@mui/material/Tooltip'
import { alpha } from '@mui/material/styles'
import { visuallyHidden } from '@mui/utils'

import { getCreatorLevel, getCreatorLevelMeta } from '@/constants/creatorLevels'

// A creator's level, wherever a storefront is shown (Storefront V2,
// prompts-v2/03). The rule that produces the number lives in
// `constants/creatorLevels.js` and is shared with the seed, so this component
// only ever renders what it is given.

/** `CREATOR_LEVEL_META.tone` → the palette family the badge tints itself with. */
const TONE_PALETTE = {
  neutral: null,
  info: 'info',
  brand: 'primary',
}

/**
 * Halo strength per tier. Level 3 is the only one loud enough to read as an
 * award; Level 2 gets a hint of one; Level 1 gets none, because a badge that
 * glows on everybody is not a badge (`docs/theme-v2.md` §5).
 */
const GLOW_ALPHA = { none: 0, subtle: 0.18, strong: 0.42 }

/**
 * @param {object} props
 * @param {object} [props.creator] a `creatorProfiles` record — its `level` is
 *   used when present, and recomputed from `deliveriesCount`/`totalEarned`
 *   when it is not
 * @param {1|2|3} [props.level] the level directly, when the caller has it
 * @param {'sm'|'md'} [props.size='sm']
 * @param {boolean} [props.tooltip=true] reveal what the level means on hover/focus
 */
export default function CreatorLevelBadge({
  creator,
  level,
  size = 'sm',
  tooltip = true,
  sx,
  ...rest
}) {
  const resolved = Number(level ?? creator?.level) || getCreatorLevel(creator)
  const meta = getCreatorLevelMeta(resolved)
  const family = TONE_PALETTE[meta.tone]
  const isSmall = size === 'sm'
  const glow = GLOW_ALPHA[meta.glow] ?? 0

  const badge = (
    <Chip
      size={isSmall ? 'small' : 'medium'}
      color={family ?? 'default'}
      icon={<Icon icon="solar:medal-ribbon-star-bold" width={isSmall ? 14 : 16} aria-hidden="true" />}
      label={
        <>
          {meta.label}
          {/* The chip alone reads as "Level 3" out of context. Spelling out
              whose level it is keeps the announcement useful in a card where
              the name sits several elements away. */}
          <Box component="span" sx={visuallyHidden}> creator</Box>
        </>
      }
      sx={{
        fontWeight: 600,
        fontSize: isSmall ? '0.6875rem' : '0.75rem',
        '& .MuiChip-icon': { color: 'inherit', ml: isSmall ? 0.75 : 1, mr: -0.25 },
        ...(glow > 0 && family
          ? {
              boxShadow: (theme) => `0 0 ${isSmall ? 12 : 16}px ${alpha(theme.palette[family].main, glow)}`,
            }
          : null),
        ...sx,
      }}
      {...rest}
    />
  )

  if (!tooltip) return badge

  return (
    <Tooltip title={meta.description}>
      <span style={{ display: 'inline-flex' }}>{badge}</span>
    </Tooltip>
  )
}
