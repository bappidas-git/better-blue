import { useId } from 'react'

import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
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
import { describeCreatorProgress, describeDue } from '@/features/orders/utils/orderDisplay'
import { paths } from '@/routes/paths'
import { formatCurrency } from '@/utils/formatters'

// One order in the creator's list — the mirror of `OrderCard`, and different in
// the one way that matters: the number on it is **take-home pay**, not order
// value.
//
// A creator scanning a dozen engagements is asking two questions — what do I owe
// somebody, and by when — so the status line carries an imperative ("Revision
// requested — respond") and an overdue date is coloured rather than merely
// stated. The order value stays on the card as a subline, because it is what
// the buyer's invoice says and it should never be a surprise.
//
// The card is not itself a link: the title is, and it stretches its hit area
// across the card with `::after`.

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
 * @param {{name?: string, companyName?: string, logoUrl?: string}} [props.buyer]
 *   the business it is for, as `requestService.getBuyerSummaries` returns it
 */
export default function CreatorOrderCard({ order, buyer }) {
  const titleId = useId()
  const due = describeDue(order)
  const progress = describeCreatorProgress(order)
  const businessName = buyer?.companyName ?? buyer?.name

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
            <Stack
              direction="row"
              spacing={1}
              alignItems="center"
              flexWrap="wrap"
              useFlexGap
              sx={{ mb: 1 }}
            >
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
                to={paths.creatorOrderDetail(order.id)}
                underline="hover"
                color="inherit"
                sx={{ '&::after': { content: '""', position: 'absolute', inset: 0, zIndex: 0 } }}
              >
                {order.title}
              </Link>
            </Typography>

            {businessName ? (
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }}>
                <UserAvatar name={businessName} src={buyer?.logoUrl} size="xs" />
                <Typography variant="body2" color="text.secondary">
                  {businessName}
                </Typography>
              </Stack>
            ) : null}
          </Box>

          <Stack
            spacing={0.25}
            alignItems={{ xs: 'flex-start', sm: 'flex-end' }}
            sx={{ flexShrink: 0 }}
          >
            <Typography
              variant="h6"
              component="p"
              sx={{ fontWeight: 700, color: 'success.dark', fontVariantNumeric: 'tabular-nums' }}
            >
              <Box component="span" sx={visuallyHidden}>
                Your earnings:{' '}
              </Box>
              {formatCurrency(order.creatorEarnings, order.currency)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {formatCurrency(order.price, order.currency)} order value
            </Typography>
          </Stack>
        </Stack>

        <Divider sx={{ my: 1.5 }} />

        <Stack direction="row" spacing={{ xs: 1.5, sm: 2.5 }} flexWrap="wrap" useFlexGap>
          <Fact
            icon="solar:calendar-linear"
            label="Delivery due"
            value={due.isOverdue ? `Due ${due.relative}` : due.date}
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
