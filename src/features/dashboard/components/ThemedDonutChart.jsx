import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'

import {
  ChartFrame,
  ChartTooltip,
  isChartDataEmpty,
  resolveChartFormats,
  useChartTheme,
} from './chartTheme'

// Composition chart for dashboard splits: escrow by state, spend by category,
// order outcomes. A donut rather than a pie so the middle can carry the total —
// the number people actually came for.

/**
 * @param {object} props
 * @param {Array<{name: string, value: number, color?: string}>} props.data one slice per row
 * @param {string} props.ariaLabel **required** — one sentence describing the split
 * @param {number|object} [props.height=280] chart body height
 * @param {'number'|'currency'|'percent'} [props.valueFormat='number'] tooltip + centre formatting
 * @param {React.ReactNode} [props.centerLabel] caption under the centre value, e.g. "In escrow"
 * @param {number} [props.centerValue] centre number — defaults to the sum of the slices
 * @param {boolean} [props.showCenter=true] render the centre total at all
 * @param {boolean} [props.showLegend=true] legend under the donut
 * @param {string} [props.emptyMessage] override the empty headline
 */
export default function ThemedDonutChart({
  data = [],
  ariaLabel,
  height = 280,
  valueFormat = 'number',
  centerLabel,
  centerValue,
  showCenter = true,
  showLegend = true,
  emptyMessage,
}) {
  const chartTheme = useChartTheme()
  const formats = resolveChartFormats(valueFormat)

  const colored = data.map((slice, index) => ({
    ...slice,
    color: slice.color ?? chartTheme.series[index % chartTheme.series.length],
  }))

  const isEmpty = isChartDataEmpty(colored, ['value'])
  const total =
    centerValue ?? colored.reduce((sum, slice) => sum + (Number(slice.value) || 0), 0)

  return (
    <ChartFrame
      ariaLabel={ariaLabel}
      componentName="ThemedDonutChart"
      height={height}
      isEmpty={isEmpty}
      emptyMessage={emptyMessage}
    >
      <Box sx={{ position: 'relative', width: '100%', height: '100%' }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={colored}
              dataKey="value"
              nameKey="name"
              innerRadius="62%"
              outerRadius="88%"
              paddingAngle={2}
              stroke="none"
              // The centre total is the summary; per-slice labels would only
              // crowd a card-sized donut.
              startAngle={90}
              endAngle={-270}
            >
              {colored.map((slice) => (
                <Cell key={slice.name} fill={slice.color} />
              ))}
            </Pie>

            <Tooltip content={<ChartTooltip formatValue={formats.value} />} />
            {showLegend ? (
              <Legend
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ paddingTop: 8, ...chartTheme.tickStyle }}
              />
            ) : null}
          </PieChart>
        </ResponsiveContainer>

        {showCenter ? (
          <Box
            aria-hidden="true"
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              // Leaves the legend strip out of the centring maths.
              bottom: showLegend ? 44 : 0,
              display: 'grid',
              placeItems: 'center',
              pointerEvents: 'none',
              textAlign: 'center',
              px: 2,
            }}
          >
            <Box>
              <Typography variant="h5" component="p" sx={{ lineHeight: 1.2 }}>
                {formats.value(total)}
              </Typography>
              {centerLabel ? (
                <Typography variant="caption" color="text.secondary">
                  {centerLabel}
                </Typography>
              ) : null}
            </Box>
          </Box>
        ) : null}
      </Box>
    </ChartFrame>
  )
}
