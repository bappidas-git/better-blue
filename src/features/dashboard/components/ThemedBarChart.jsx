import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
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

// Comparison chart for dashboard categories: orders per category, payouts per
// month, disputes by reason. Rounded caps and generous category gaps keep it
// closer to the product's card language than Recharts' square defaults.

/**
 * @param {object} props
 * @param {Array<object>} props.data one row per category
 * @param {string} [props.xKey='label'] row key holding the category label
 * @param {Array<{key: string, label?: string, color?: string}>} props.series
 *   one entry per bar series, drawn in palette order unless `color` overrides it
 * @param {string} props.ariaLabel **required** — one sentence describing the comparison
 * @param {number|object} [props.height=280] chart body height
 * @param {'number'|'currency'|'percent'} [props.valueFormat='number'] tick + tooltip formatting
 * @param {boolean} [props.stacked=false] stack the series instead of grouping them
 * @param {boolean} [props.horizontal=false] lay the bars out horizontally — better for
 *   long category names on a phone
 * @param {boolean} [props.showGrid=true] grid lines along the value axis
 * @param {boolean} [props.showLegend=false] legend under the plot
 * @param {string} [props.emptyMessage] override the empty headline
 */
export default function ThemedBarChart({
  data = [],
  xKey = 'label',
  series = [],
  ariaLabel,
  height = 280,
  valueFormat = 'number',
  stacked = false,
  horizontal = false,
  showGrid = true,
  showLegend = false,
  emptyMessage,
}) {
  const chartTheme = useChartTheme()
  const formats = resolveChartFormats(valueFormat)

  const colored = series.map((entry, index) => ({
    ...entry,
    color: entry.color ?? chartTheme.series[index % chartTheme.series.length],
  }))

  const isEmpty = isChartDataEmpty(
    data,
    colored.map((entry) => entry.key)
  )

  const axis = chartAxisProps(chartTheme)
  // Rounded on the growing end only — rounding the base would lift the bars off
  // the axis.
  const radius = horizontal ? [0, 8, 8, 0] : [8, 8, 0, 0]

  return (
    <ChartFrame
      ariaLabel={ariaLabel}
      componentName="ThemedBarChart"
      height={height}
      isEmpty={isEmpty}
      emptyMessage={emptyMessage}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout={horizontal ? 'vertical' : 'horizontal'}
          margin={{ top: 8, right: 8, bottom: 0, left: horizontal ? 8 : -8 }}
          barGap={6}
          barCategoryGap={horizontal ? '24%' : '32%'}
        >
          {showGrid ? (
            <CartesianGrid
              stroke={chartTheme.grid}
              strokeDasharray="3 3"
              vertical={horizontal}
              horizontal={!horizontal}
            />
          ) : null}

          {horizontal ? (
            <>
              <XAxis type="number" {...axis} tickFormatter={formats.tick} />
              <YAxis type="category" dataKey={xKey} {...axis} width={96} />
            </>
          ) : (
            <>
              <XAxis dataKey={xKey} {...axis} />
              <YAxis {...axis} width={56} tickFormatter={formats.tick} />
            </>
          )}

          <Tooltip
            cursor={{ fill: chartTheme.cursor }}
            content={<ChartTooltip formatValue={formats.value} />}
          />
          {showLegend ? (
            <Legend
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ paddingTop: 12, ...chartTheme.tickStyle }}
            />
          ) : null}

          {colored.map((entry) => (
            <Bar
              key={entry.key}
              dataKey={entry.key}
              name={entry.label ?? entry.key}
              fill={entry.color}
              radius={radius}
              maxBarSize={horizontal ? 22 : 48}
              stackId={stacked ? 'stack' : undefined}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  )
}
