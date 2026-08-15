import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { alpha } from '@mui/material/styles'

import { describeAutoAccept, describeRevisions } from '@/features/orders/utils/orderDisplay'
import { formatCurrency, formatNumber } from '@/utils/formatters'

// The decision, given its own surface.
//
// This is the only card in the buyer's workspace with a gradient-tinted edge,
// and it earns it: it is the one moment on the whole screen where the buyer is
// being asked for something. Everywhere else the page reports; here it asks.
//
// Both options are offered plainly, side by side. Accepting is the primary
// button because it is the ordinary outcome, but asking for changes is a full
// button rather than a link — a buyer who is unhappy should not have to hunt.

/**
 * @param {object} props
 * @param {object} props.order the delivered order
 * @param {() => void} props.onAccept opens the accept confirmation
 * @param {() => void} props.onRequestChanges opens the revision form
 * @param {number} [props.autoAcceptDays] `platformSettings.general.autoAcceptDays`
 * @param {boolean} [props.isBusy] disables both while a decision is in flight
 */
export default function ReviewActionsCard({
  order,
  onAccept,
  onRequestChanges,
  autoAcceptDays,
  isBusy = false,
}) {
  const revisions = describeRevisions(order)
  const autoAccept = describeAutoAccept(order, autoAcceptDays)

  return (
    <Card
      sx={{
        borderColor: 'primary.main',
        borderWidth: 1,
        borderStyle: 'solid',
        bgcolor: (theme) => alpha(theme.palette.primary.main, 0.03),
      }}
    >
      <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
        <Typography variant="h6" component="h2" sx={{ fontSize: '1.0625rem', fontWeight: 700 }}>
          Review this delivery
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
          Open every file before you decide. Accepting releases{' '}
          {formatCurrency(order?.price, order?.currency)} from escrow and completes the order —
          asking for changes moves nothing.
        </Typography>

        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1.5}
          sx={{ mt: 2.5, '& > *': { minHeight: 44 } }}
        >
          <Button
            onClick={onAccept}
            variant="gradient"
            size="large"
            disabled={isBusy}
            fullWidth
            startIcon={<Icon icon="tabler:circle-check" width={20} aria-hidden="true" />}
          >
            Accept content
          </Button>
          <Button
            onClick={onRequestChanges}
            variant="outlined"
            size="large"
            disabled={isBusy}
            fullWidth
            startIcon={<Icon icon="solar:restart-linear" width={20} aria-hidden="true" />}
          >
            {revisions.isExhausted
              ? 'Request changes'
              : `Request changes (${formatNumber(revisions.remaining)} left)`}
          </Button>
        </Stack>

        <Stack spacing={0.75} sx={{ mt: 2 }}>
          <Stack direction="row" spacing={1} alignItems="flex-start">
            <Box aria-hidden="true" sx={{ color: 'text.secondary', mt: 0.15, flexShrink: 0 }}>
              <Icon icon="solar:restart-linear" width={16} />
            </Box>
            <Typography variant="caption" color="text.secondary">
              {revisions.isExhausted
                ? `All ${formatNumber(revisions.included)} included revisions have been used. If the delivery does not match the brief, raise a dispute rather than accepting it.`
                : `Revisions: ${revisions.label}.`}
            </Typography>
          </Stack>

          {autoAccept ? (
            <Stack direction="row" spacing={1} alignItems="flex-start">
              <Box aria-hidden="true" sx={{ color: 'text.secondary', mt: 0.15, flexShrink: 0 }}>
                <Icon icon="solar:clock-circle-linear" width={16} />
              </Box>
              <Typography variant="caption" color="text.secondary">
                Auto-accepts on {autoAccept.date} if you do neither, so a creator is never left
                waiting indefinitely.
              </Typography>
            </Stack>
          ) : null}
        </Stack>
      </CardContent>
    </Card>
  )
}
