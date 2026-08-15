import { useId } from 'react'

import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import {
  ChartFrame,
  ChartTooltip,
  chartAxisProps,
  isChartDataEmpty,
  resolveChartFormats,
  useChartTheme,
} from './chartTheme'

// Trend chart for dashboard time series: spend over months, orders per week,
// earnings per month. Pre-styled from the theme so no screen restyles Recharts
// for itself, and framed by `ChartFrame` so it is announced rather than
// silently skipped by a screen reader.

/**
 * @param {object} props
 * @param {Array<object>} props.data one row per point on the x axis
 * @param {string} [props.xKey='label'] row key holding the x-axis label
 * @param {Array<{key: string, label?: string, color?: string}>} props.series
 *   one entry per line, drawn in palette order unless `color` overrides it
 * @param {string} props.ariaLabel **required** — one sentence describing the trend
 * @param {number|object} [props.height=280] chart body height
 * @param {'number'|'currency'|'percent'} [props.valueFormat='number'] tick + tooltip formatting
 * @param {boolean} [props.gradient=false] fill under the first series with a soft brand wash
 * @param {boolean} [props.showGrid=true] horizontal grid lines
 * @param {boolean} [props.showLegend=false] legend under the plot — worth it from two series up
 * @param {string} [props.emptyMessage] override the empty headline
 */
export default function ThemedLineChart({
  data = [],
  xKey = 'label',
  series = [],
  ariaLabel,
  height = 280,
  valueFormat = 'number',
  gradient = false,
  showGrid = true,
  showLegend = false,
  emptyMessage,
}) {
  const chartTheme = useChartTheme()
  const formats = resolveChartFormats(valueFormat)
  const gradientId = `${useId()}-area`.replace(/:/g, '')

  const colored = series.map((entry, index) => ({
    ...entry,
    color: entry.color ?? chartTheme.series[index % chartTheme.series.length],
  }))

  const isEmpty = isChartDataEmpty(
    data,
    colored.map((entry) => entry.key)
  )

  const axis = chartAxisProps(chartTheme)
  const Chart = gradient ? AreaChart : LineChart

  return (
    <ChartFrame
      ariaLabel={ariaLabel}
      componentName="ThemedLineChart"
      height={height}
      isEmpty={isEmpty}
      emptyMessage={emptyMessage}
    >
      <ResponsiveContainer width="100%" height="100%">
        <Chart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
          {gradient ? (
            <defs>
              {colored.map((entry, index) => (
                <linearGradient
                  key={entry.key}
                  id={`${gradientId}-${index}`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="0%" stopColor={entry.color} stopOpacity={0.28} />
                  <stop offset="100%" stopColor={entry.color} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
          ) : null}

          {showGrid ? (
            <CartesianGrid stroke={chartTheme.grid} strokeDasharray="3 3" vertical={false} />
          ) : null}

          <XAxis dataKey={xKey} {...axis} />
          <YAxis {...axis} width={56} tickFormatter={formats.tick} />

          <Tooltip
            cursor={{ stroke: chartTheme.grid }}
            content={<ChartTooltip formatValue={formats.value} />}
          />
          {showLegend ? (
            <Legend
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ paddingTop: 12, ...chartTheme.tickStyle }}
            />
          ) : null}

          {colored.map((entry, index) =>
            gradient ? (
              <Area
                key={entry.key}
                type="monotone"
                dataKey={entry.key}
                name={entry.label ?? entry.key}
                stroke={entry.color}
                strokeWidth={2.5}
                fill={`url(#${gradientId}-${index})`}
                activeDot={{ r: 5, strokeWidth: 0 }}
              />
            ) : (
              <Line
                key={entry.key}
                type="monotone"
                dataKey={entry.key}
                name={entry.label ?? entry.key}
                stroke={entry.color}
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 5, strokeWidth: 0 }}
              />
            )
          )}
        </Chart>
      </ResponsiveContainer>
    </ChartFrame>
  )
}
