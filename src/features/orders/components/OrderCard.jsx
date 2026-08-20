import { useId } from 'react'

import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Divider from '@mui/material/Divider'
import Link from '@mui/material/Link'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { alpha } from '@mui/material/styles'
import { visuallyHidden } from '@mui/utils'
import { Link as RouterLink } from 'react-router-dom'

import StatusChip from '@/components/data-display/StatusChip'
import UserAvatar from '@/components/data-display/UserAvatar'
import { describeDue, describeProgress, orderActions } from '@/features/orders/utils/orderDisplay'
import { paths } from '@/routes/paths'
import { formatCurrency } from '@/utils/formatters'

// One order in the buyer's list. Cards rather than table rows at every width,
// matching the request list (00 §12 allows either): an order is a small story —
// who is making what, for how much, by when — rather than a row of values.
//
// The card is not itself a link, because an unpaid one carries a button. The
// title is the link and stretches its hit area across the card via `::after`;
// the payment CTA lifts itself above that layer.

/** A labelled fact in the card's meta row. */
function Fact({ icon, label, value, tone = 'text.secondary', title }) {
  return (
    <Stack direction="row" spacing={0.75} alignItems="center" sx={{ minWidth: 0 }} title={title}>
      <Icon icon={icon} width={16} aria-hidden="true" style={{ flexShrink: 0 }} />
      <Typography variant="body2" sx={{ color: tone, whiteSpace: 'nowrap' }}>
        <Box component="span" sx={visuallyHidden}>
          {label}:{' '}
        </Box>
        {value}
      </Typography>
    </Stack>
  )
}

/**
 * @param {object} props
 * @param {object} props.order the order record
 * @param {{name?: string, avatarUrl?: string}} [props.creator] the creator it was awarded to
 */
export default function OrderCard({ order, creator }) {
  const titleId = useId()
  const due = describeDue(order)
  const progress = describeProgress(order)
  const actions = orderActions(order)

  return (
    <Card
      component="li"
      sx={{
        position: 'relative',
        listStyle: 'none',
        transition: (theme) => theme.transitions.create(['box-shadow', 'border-color']),
        '&:hover': { boxShadow: 2 },
        '&:focus-within': { boxShadow: 2 },
      }}
    >
      <CardContent sx={{ p: { xs: 2, md: 2.5 }, '&:last-child': { pb: { xs: 2, md: 2.5 } } }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={{ xs: 1.5, sm: 2 }}
          alignItems={{ xs: 'stretch', sm: 'flex-start' }}
        >
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mb: 1 }}>
              <StatusChip status={order.status} size="sm" tooltip />
            </Stack>

            <Typography
              id={titleId}
              variant="subtitle1"
              component="h3"
              sx={{ fontWeight: 600, lineHeight: 1.35 }}
            >
              <Link
                component={RouterLink}
                to={paths.buyerOrderDetail(order.id)}
                underline="hover"
                color="inherit"
                sx={{ '&::after': { content: '""', position: 'absolute', inset: 0, zIndex: 0 } }}
              >
                {order.title}
              </Link>
            </Typography>

            {creator?.name ? (
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }}>
                <UserAvatar name={creator.name} src={creator.avatarUrl} size="xs" />
                <Typography variant="body2" color="text.secondary">
                  {creator.name}
                </Typography>
              </Stack>
            ) : null}
          </Box>

          <Stack
            spacing={1}
            alignItems={{ xs: 'flex-start', sm: 'flex-end' }}
            sx={{ flexShrink: 0, position: 'relative', zIndex: 1 }}
          >
            <Typography
              variant="h6"
              component="p"
              sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}
            >
              {formatCurrency(order.price, order.currency)}
            </Typography>

            {actions.canPay ? (
              <Button
                component={RouterLink}
                to={paths.buyerCheckout(order.id)}
                size="small"
                variant="contained"
                color="warning"
                startIcon={<Icon icon="solar:card-linear" width={18} aria-hidden="true" />}
                sx={{ minHeight: 44, whiteSpace: 'nowrap' }}
              >
                Complete payment
              </Button>
            ) : null}
          </Stack>
        </Stack>

        <Divider sx={{ my: 1.5 }} />

        <Stack direction="row" spacing={{ xs: 1.5, sm: 2.5 }} flexWrap="wrap" useFlexGap>
          <Fact
            icon="solar:calendar-linear"
            label="Delivery due"
            value={due.isOverdue ? `Overdue · ${due.date}` : due.date}
            tone={due.tone}
            title={due.label}
          />
        </Stack>

        {progress.text ? (
          <Box
            sx={{
              mt: 1.5,
              px: progress.accent ? 1.25 : 0,
              py: progress.accent ? 0.75 : 0,
              borderRadius: 1.5,
              bgcolor: progress.accent
                ? (theme) => alpha(theme.palette.primary.main, 0.08)
                : 'transparent',
            }}
          >
            <Stack direction="row" spacing={1} alignItems="center">
              <Icon
                icon={progress.accent ? 'solar:bell-bing-linear' : 'solar:info-circle-linear'}
                width={16}
                aria-hidden="true"
                style={{ flexShrink: 0 }}
              />
              <Typography
                variant="body2"
                sx={{
                  color: progress.accent ? 'primary.light' : 'text.secondary',
                  fontWeight: progress.accent ? 600 : 400,
                }}
              >
                {progress.text}
              </Typography>
            </Stack>
          </Box>
        ) : null}
      </CardContent>
    </Card>
  )
}
