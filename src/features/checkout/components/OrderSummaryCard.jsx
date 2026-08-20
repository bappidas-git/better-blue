import { Icon } from '@iconify/react'
import Accordion from '@mui/material/Accordion'
import AccordionDetails from '@mui/material/AccordionDetails'
import AccordionSummary from '@mui/material/AccordionSummary'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Divider from '@mui/material/Divider'
import Link from '@mui/material/Link'
import Stack from '@mui/material/Stack'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import { Link as RouterLink } from 'react-router-dom'

import StatusChip from '@/components/data-display/StatusChip'
import UserAvatar from '@/components/data-display/UserAvatar'
import { getStatusMeta } from '@/constants'
import { formatQuantity } from '@/features/requests/utils/requestDisplay'
import { paths } from '@/routes/paths'
import { EMPTY_PLACEHOLDER, formatCurrency, formatNumber } from '@/utils/formatters'

// What the buyer is about to fund, in the order they want to check it: the
// brief, who is doing it, what arrives and when, and only then the number.
//
// Renders no arithmetic of its own (Prompt 19 §7) — every figure is a field on
// the order, computed by `orderService.acceptProposal` when the work was agreed
// and frozen there ever since.
//
// Below `md` the same content is an accordion, collapsed by default with the
// total still on the summary line, so the payment form is the first thing on
// screen without the price ever being out of sight.

/** How the delivery window reads before there is a clock to count down. */
function deliveryLine(days) {
  const count = Number(days)
  if (!Number.isFinite(count) || count <= 0) return EMPTY_PLACEHOLDER
  return `${formatNumber(count)} ${count === 1 ? 'day' : 'days'} after payment`
}

/** One label/value row of the "what you get" block. */
function DetailRow({ label, value }) {
  return (
    <Stack direction="row" spacing={2} justifyContent="space-between" alignItems="baseline">
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: 600, textAlign: 'right' }}>
        {value}
      </Typography>
    </Stack>
  )
}

/**
 * @param {object} props
 * @param {object} props.order the order being funded
 * @param {object} [props.request] the brief behind it — carries the quantity
 * @param {object} [props.proposal] the accepted offer — the delivery window on
 *   orders created before it was stored on the order itself
 * @param {object} [props.creator] the creator the work was awarded to
 * @param {boolean} [props.collapsible=false] render as a collapsed accordion
 *   (mobile), rather than an always-open card
 */
export default function OrderSummaryCard({
  order,
  request,
  proposal,
  creator,
  collapsible = false,
}) {
  const currency = order?.currency
  const total = formatCurrency(order?.price, currency)
  const contentTypeLabel = getStatusMeta(order?.contentType).label
  const deliveryDays = order?.deliveryDays ?? proposal?.deliveryDays

  const body = (
    <Stack spacing={2.5}>
      <Box>
        <Typography variant="subtitle1" component="p" sx={{ fontWeight: 700 }}>
          {order?.title}
        </Typography>

        {creator ? (
          <Stack direction="row" spacing={1.25} alignItems="center" sx={{ mt: 1.5 }}>
            <UserAvatar name={creator.name} src={creator.avatarUrl} size="sm" />
            <Typography variant="body2" color="text.secondary">
              Awarded to <strong>{creator.name}</strong>
            </Typography>
          </Stack>
        ) : null}

        <Stack direction="row" spacing={1} sx={{ mt: 1.5, flexWrap: 'wrap', gap: 1 }}>
          <StatusChip status={order?.contentType} size="sm" showDot={false} variant="outlined" />
          {request?.quantity ? (
            <StatusChip
              status={order?.contentType}
              size="sm"
              showDot={false}
              variant="outlined"
              label={formatQuantity(request, contentTypeLabel)}
            />
          ) : null}
        </Stack>
      </Box>

      <Divider />

      <Stack spacing={1.25}>
        <DetailRow label="Delivery" value={deliveryLine(deliveryDays)} />
        <DetailRow
          label="Revisions included"
          value={formatNumber(order?.revisionsIncluded ?? 0)}
        />
        <DetailRow label="Order reference" value={order?.id ?? EMPTY_PLACEHOLDER} />
      </Stack>

      <Divider />

      <Stack spacing={1.5}>
        <Stack direction="row" spacing={2} justifyContent="space-between" alignItems="baseline">
          <Typography variant="subtitle2" component="p">
            Total due today
          </Typography>
          <Typography variant="h5" component="p" sx={{ fontWeight: 800 }}>
            {total}
          </Typography>
        </Stack>

        <Stack
          direction="row"
          spacing={1.25}
          alignItems="flex-start"
          sx={{
            bgcolor: 'primary.lighter',
            borderRadius: 2,
            px: 1.75,
            py: 1.5,
          }}
        >
          <Box sx={{ color: 'primary.light', display: 'flex', mt: 0.125 }}>
            <Icon icon="solar:shield-check-bold" width={20} aria-hidden="true" />
          </Box>
          <Box>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              Held securely until you approve delivery
            </Typography>
            <Typography variant="caption" color="text.secondary">
              BetterBlue holds the money in escrow. Nothing reaches the creator until you have
              seen the content and accepted it.
            </Typography>
          </Box>
        </Stack>

        <Stack direction="row" spacing={0.75} alignItems="center">
          <Typography variant="caption" color="text.secondary">
            No booking fee, no card surcharge
          </Typography>
          <Tooltip title="The creator receives the total minus the BetterBlue commission. There are no extra buyer fees — what you see above is what you pay.">
            <Box
              component="span"
              tabIndex={0}
              role="note"
              aria-label="How fees work: the creator receives the total minus the BetterBlue commission. There are no extra buyer fees."
              sx={{ display: 'inline-flex', color: 'text.secondary', cursor: 'help' }}
            >
              <Icon icon="solar:info-circle-linear" width={16} aria-hidden="true" />
            </Box>
          </Tooltip>
        </Stack>
      </Stack>

      <Typography variant="caption" color="text.secondary">
        By paying you agree to the{' '}
        <Link component={RouterLink} to={paths.TERMS} target="_blank" rel="noopener">
          Terms of Service
        </Link>{' '}
        and the{' '}
        <Link component={RouterLink} to={paths.CONTENT_POLICY} target="_blank" rel="noopener">
          Content Policy
        </Link>
        .
      </Typography>
    </Stack>
  )

  if (collapsible) {
    return (
      <Accordion
        disableGutters
        elevation={0}
        sx={{
          border: 1,
          borderColor: 'divider',
          borderRadius: 2,
          '&::before': { display: 'none' },
        }}
      >
        <AccordionSummary
          expandIcon={<Icon icon="solar:alt-arrow-down-linear" width={20} />}
          aria-controls="checkout-summary-content"
          id="checkout-summary-header"
          sx={{ minHeight: 56, px: 2 }}
        >
          <Stack
            direction="row"
            spacing={2}
            alignItems="center"
            justifyContent="space-between"
            sx={{ width: '100%', pr: 1 }}
          >
            <Typography variant="subtitle2" component="h2">
              Order summary
            </Typography>
            <Typography variant="subtitle1" component="p" sx={{ fontWeight: 800 }}>
              {total}
            </Typography>
          </Stack>
        </AccordionSummary>
        <AccordionDetails id="checkout-summary-content" sx={{ px: 2, pb: 2.5, pt: 0 }}>
          {body}
        </AccordionDetails>
      </Accordion>
    )
  }

  return (
    <Card>
      <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
        <Typography variant="subtitle2" component="h2" color="text.secondary" sx={{ mb: 2 }}>
          Order summary
        </Typography>
        {body}
      </CardContent>
    </Card>
  )
}
