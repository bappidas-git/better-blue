import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'

// The card a dashboard chart lives in: title, optional subtitle, an action slot
// on the right (a range switch, a "View all" link), and a height-managed body.
//
// The height belongs here rather than in the chart because Recharts'
// `ResponsiveContainer` measures its parent — a chart dropped into a card with
// no fixed height collapses to nothing.

/**
 * @param {object} props
 * @param {React.ReactNode} props.title card heading
 * @param {React.ReactNode} [props.subtitle] one line of context under the heading
 * @param {React.ReactNode} [props.action] right-aligned slot — filter, link, menu
 * @param {number|object} [props.height=280] body height in px; pass an object for
 *   a responsive height, e.g. `{ xs: 220, md: 300 }`
 * @param {React.ReactNode} props.children the chart (or a loading/error state)
 * @param {object} [props.sx] MUI system styles applied to the card
 */
export default function ChartCard({ title, subtitle, action, height = 280, children, sx, ...rest }) {
  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column', ...sx }} {...rest}>
      <CardContent
        sx={{ p: { xs: 2.5, md: 3 }, flexGrow: 1, display: 'flex', flexDirection: 'column' }}
      >
        <Stack
          direction="row"
          spacing={2}
          alignItems="flex-start"
          justifyContent="space-between"
          sx={{ mb: 2 }}
        >
          <Stack spacing={0.25} sx={{ minWidth: 0 }}>
            <Typography variant="h6" component="h2" sx={{ fontSize: '1.0625rem' }}>
              {title}
            </Typography>
            {subtitle ? (
              <Typography variant="body2" color="text.secondary">
                {subtitle}
              </Typography>
            ) : null}
          </Stack>

          {action ? <Stack sx={{ flexShrink: 0 }}>{action}</Stack> : null}
        </Stack>

        <Stack sx={{ flexGrow: 1, minHeight: height, justifyContent: 'center' }}>{children}</Stack>
      </CardContent>
    </Card>
  )
}
