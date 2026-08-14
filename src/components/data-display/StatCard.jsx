import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardActionArea from '@mui/material/CardActionArea'
import CardContent from '@mui/material/CardContent'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { alpha } from '@mui/material/styles'

import StatSkeleton from '@/components/feedback/skeletons/StatSkeleton'
import AnimatedNumber from '@/components/motion/AnimatedNumber'
import { useLinkProps } from '@/hooks/useLinkProps'
import { formatCurrency, formatNumber, formatPercent } from '@/utils/formatters'

// Dashboard metric tile: label, a number that counts up, an optional
// period-over-period delta, and an icon tile. Numbers arrive as numbers and are
// formatted here (00 §8) — never pre-formatted strings, or the count-up cannot
// animate.

const ICON_TONES = {
  brand: 'primary',
  info: 'info',
  success: 'success',
  warning: 'warning',
  error: 'error',
}

const DELTA_FORMATS = {
  percent: (value) => formatPercent(value),
  currency: (value) => formatCurrency(value),
  number: (value) => formatNumber(value),
}

/**
 * @param {object} props
 * @param {React.ReactNode} props.label metric name, e.g. "Active orders"
 * @param {number|React.ReactNode} props.value the metric — numbers count up, nodes render as-is
 * @param {(value: number) => string} [props.format=formatNumber] formatter for numeric values
 * @param {boolean} [props.animate=true] count up on mount (ignored under reduced motion)
 * @param {number} [props.delta] signed change vs the comparison period, e.g. `0.124`
 * @param {'percent'|'currency'|'number'} [props.deltaFormat='percent'] how to render the delta
 * @param {React.ReactNode} [props.deltaLabel] context for the delta, e.g. "vs last 30 days"
 * @param {'auto'|'success'|'error'|'neutral'} [props.deltaTone='auto'] `auto` treats up as good —
 *   override for metrics where a rise is bad (disputes, refunds)
 * @param {string} [props.icon] iconify name for the tile
 * @param {'brand'|'info'|'success'|'warning'|'error'} [props.iconTone='brand'] tile tint
 * @param {string} [props.to] route path — makes the whole card a link
 * @param {() => void} [props.onClick] click handler — makes the whole card a button
 * @param {boolean} [props.loading=false] render `StatSkeleton` instead
 */
export default function StatCard({
  label,
  value,
  format = formatNumber,
  animate = true,
  delta,
  deltaFormat = 'percent',
  deltaLabel,
  deltaTone = 'auto',
  icon,
  iconTone = 'brand',
  to,
  onClick,
  loading = false,
  sx,
  ...rest
}) {
  const linkProps = useLinkProps(to)

  if (loading) return <StatSkeleton sx={sx} />

  const isNumeric = typeof value === 'number' && Number.isFinite(value)
  const hasDelta = typeof delta === 'number' && Number.isFinite(delta)
  const paletteKey = ICON_TONES[iconTone] ?? 'primary'

  const deltaDirection = hasDelta && delta !== 0 ? (delta > 0 ? 'up' : 'down') : 'flat'
  const resolvedDeltaTone =
    deltaTone === 'auto'
      ? { up: 'success', down: 'error', flat: 'neutral' }[deltaDirection]
      : deltaTone
  const deltaText = hasDelta
    ? `${deltaDirection === 'up' ? '+' : deltaDirection === 'down' ? '−' : ''}${(
        DELTA_FORMATS[deltaFormat] ?? DELTA_FORMATS.number
      )(Math.abs(delta))}`
    : null

  const content = (
    <CardContent sx={{ p: 3, '&:last-child': { pb: 3 } }}>
      <Stack direction="row" spacing={2} alignItems="flex-start">
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography variant="overline" component="p" color="text.secondary">
            {label}
          </Typography>
          <Typography variant="h4" component="p" sx={{ mt: 0.5, wordBreak: 'break-word' }}>
            {isNumeric && animate ? (
              <AnimatedNumber value={value} format={format} />
            ) : isNumeric ? (
              format(value)
            ) : (
              value
            )}
          </Typography>

          {hasDelta || deltaLabel ? (
            <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: 0.75 }}>
              {deltaText ? (
                <Typography
                  variant="caption"
                  sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 0.25,
                    fontWeight: 600,
                    color:
                      resolvedDeltaTone === 'neutral'
                        ? 'text.secondary'
                        : `${resolvedDeltaTone}.main`,
                  }}
                >
                  <Icon
                    icon={
                      deltaDirection === 'up'
                        ? 'tabler:trending-up'
                        : deltaDirection === 'down'
                          ? 'tabler:trending-down'
                          : 'tabler:minus'
                    }
                    width={14}
                    aria-hidden="true"
                  />
                  {deltaText}
                </Typography>
              ) : null}
              {deltaLabel ? (
                <Typography variant="caption" color="text.secondary">
                  {deltaLabel}
                </Typography>
              ) : null}
            </Stack>
          ) : null}
        </Box>

        {icon ? (
          <Box
            aria-hidden="true"
            sx={{
              flexShrink: 0,
              width: 44,
              height: 44,
              borderRadius: 2,
              display: 'grid',
              placeItems: 'center',
              bgcolor: (theme) => alpha(theme.palette[paletteKey].main, 0.12),
              color: `${paletteKey}.main`,
            }}
          >
            <Icon icon={icon} width={22} />
          </Box>
        ) : null}
      </Stack>
    </CardContent>
  )

  const interactive = Boolean(to || onClick)

  return (
    <Card sx={{ height: '100%', ...sx }} {...rest}>
      {interactive ? (
        <CardActionArea
          onClick={onClick}
          sx={{ height: '100%', borderRadius: 'inherit' }}
          {...linkProps}
        >
          {content}
        </CardActionArea>
      ) : (
        content
      )}
    </Card>
  )
}
