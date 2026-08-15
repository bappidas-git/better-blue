// Deliberately mixed exports: the chart hook, the formatters, and the two
// presentational pieces are one small module that only the three `Themed*Chart`
// wrappers import. Splitting them to satisfy fast refresh would scatter the
// chart theme across three files for no runtime benefit (same call as
// `context/AuthContext.jsx`).
/* eslint-disable react-refresh/only-export-components */

import { useEffect, useMemo } from 'react'

import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { alpha, useTheme } from '@mui/material/styles'

import EmptyState from '@/components/feedback/EmptyState'
import { env } from '@/config/env'
import {
  formatCurrency,
  formatNumber,
  formatNumberCompact,
  formatPercent,
} from '@/utils/formatters'

// Shared plumbing for the three themed Recharts wrappers. It lives beside them
// rather than inside one of them so the palette, the tick formatting, the
// tooltip, and the accessibility frame are defined once — a fourth chart type
// in a later prompt inherits all of it by importing from here.
//
// Recharts needs literal color strings, so every value is read off the theme at
// render time. No hex is written here (00 §6).

/**
 * Series colors, in the order a chart consumes them: brand purple, brand pink,
 * then the semantic hues. Distinguishable in the light palette and safe to run
 * side by side in a legend.
 */
export function useChartTheme() {
  const theme = useTheme()

  return useMemo(
    () => ({
      series: [
        theme.palette.primary.main,
        theme.palette.secondary.main,
        theme.palette.info.main,
        theme.palette.success.main,
        theme.palette.warning.main,
        theme.palette.primary.light,
      ],
      grid: theme.palette.divider,
      axis: theme.palette.text.secondary,
      cursor: alpha(theme.palette.text.primary, 0.06),
      tickStyle: {
        fill: theme.palette.text.secondary,
        fontSize: 12,
        fontFamily: theme.typography.fontFamily,
      },
    }),
    [theme]
  )
}

/** Axis ticks: compact, because axis labels have no room for `$12,480.00`. */
export const CHART_TICK_FORMATS = Object.freeze({
  number: formatNumberCompact,
  currency: (value) => formatCurrency(value, 'USD', { compact: true }),
  percent: (value) => formatPercent(value),
})

/** Tooltips have the room, so they show the full value. */
export const CHART_VALUE_FORMATS = Object.freeze({
  number: formatNumber,
  currency: (value) => formatCurrency(value),
  percent: (value) => formatPercent(value),
})

/** Resolves a `valueFormat` prop to its pair of formatters. */
export function resolveChartFormats(valueFormat = 'number') {
  return {
    tick: CHART_TICK_FORMATS[valueFormat] ?? CHART_TICK_FORMATS.number,
    value: CHART_VALUE_FORMATS[valueFormat] ?? CHART_VALUE_FORMATS.number,
  }
}

/** Shared axis props — hairline ticks, no axis line, generous tick margin. */
export function chartAxisProps(chartTheme) {
  return {
    tickLine: false,
    axisLine: false,
    tick: chartTheme.tickStyle,
    tickMargin: 8,
  }
}

/**
 * Tooltip body. Recharts renders its own surface by default; this one matches
 * the product's card treatment instead (radius, hairline border, z2 shadow).
 */
export function ChartTooltip({ active, payload, label, formatValue = formatNumber }) {
  if (!active || !payload?.length) return null

  return (
    <Paper
      elevation={0}
      sx={{
        px: 1.5,
        py: 1,
        border: 1,
        borderColor: 'divider',
        boxShadow: (theme) => theme.customShadows.z2,
        minWidth: 140,
      }}
    >
      {label ? (
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
          {label}
        </Typography>
      ) : null}

      <Stack spacing={0.5} sx={{ mt: label ? 0.75 : 0 }}>
        {payload.map((entry) => (
          <Stack
            key={`${entry.dataKey ?? entry.name}`}
            direction="row"
            spacing={1}
            alignItems="center"
          >
            <Box
              aria-hidden="true"
              sx={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                flexShrink: 0,
                bgcolor: entry.color ?? entry.payload?.fill,
              }}
            />
            <Typography variant="caption" color="text.secondary" sx={{ flexGrow: 1 }}>
              {entry.name}
            </Typography>
            <Typography variant="caption" sx={{ fontWeight: 700 }}>
              {formatValue(entry.value)}
            </Typography>
          </Stack>
        ))}
      </Stack>
    </Paper>
  )
}

/** One warning per component per session — enough to notice, not enough to spam. */
const warned = new Set()

/**
 * The accessibility + empty-state frame every themed chart renders inside.
 *
 * An SVG full of `<path>` elements says nothing to a screen reader, so the
 * frame is the chart's accessible representation: `role="img"` plus the
 * one-sentence summary the caller must supply (00 §13 / Prompt 14 §12). The
 * `ariaLabel` prop is required — in a dev build, omitting it logs a warning
 * naming the offending chart.
 *
 * @param {object} props
 * @param {string} props.ariaLabel **required** — what the chart shows, in a sentence
 * @param {string} props.componentName the wrapper's name, for the dev warning
 * @param {number|object} [props.height=280] body height (a responsive object works too)
 * @param {boolean} [props.isEmpty=false] render the "not enough data" state instead
 * @param {string} [props.emptyMessage='Not enough data yet'] empty headline
 * @param {string} [props.emptyDescription] optional line under the headline
 * @param {React.ReactNode} props.children the Recharts tree
 */
export function ChartFrame({
  ariaLabel,
  componentName,
  height = 280,
  isEmpty = false,
  emptyMessage = 'Not enough data yet',
  emptyDescription,
  children,
}) {
  useEffect(() => {
    if (!env.isDev || ariaLabel || warned.has(componentName)) return
    warned.add(componentName)
    console.warn(
      `[${componentName}] Missing the required \`ariaLabel\` prop. A chart is an image to ` +
        'assistive technology: describe what it shows, e.g. ariaLabel="Monthly spend, ' +
        'rising from $2.4K in January to $8.1K in June".'
    )
  }, [ariaLabel, componentName])

  if (isEmpty) {
    return (
      <Box sx={{ height, display: 'grid', placeItems: 'center' }}>
        <EmptyState
          dense
          icon="solar:chart-2-linear"
          title={emptyMessage}
          description={emptyDescription}
        />
      </Box>
    )
  }

  return (
    <Box role="img" aria-label={ariaLabel} sx={{ width: '100%', height }}>
      {children}
    </Box>
  )
}

/** True when there is nothing worth drawing — no rows, or every value blank. */
export function isChartDataEmpty(data, valueKeys = []) {
  if (!Array.isArray(data) || data.length === 0) return true
  if (valueKeys.length === 0) return false

  return !data.some((row) =>
    valueKeys.some((key) => Number.isFinite(Number(row?.[key])) && Number(row[key]) !== 0)
  )
}
