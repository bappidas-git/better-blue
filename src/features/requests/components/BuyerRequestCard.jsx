import { useId, useState } from 'react'

import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import Divider from '@mui/material/Divider'
import IconButton from '@mui/material/IconButton'
import Link from '@mui/material/Link'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { visuallyHidden } from '@mui/utils'
import { Link as RouterLink } from 'react-router-dom'

import StatusChip from '@/components/data-display/StatusChip'
import { REQUEST_STATUS } from '@/constants/statuses'
import {
  describeDeadline,
  formatBudget,
  requestActions,
} from '@/features/requests/utils/requestDisplay'
import { paths } from '@/routes/paths'
import { formatDate, formatNumber } from '@/utils/formatters'

// One brief in the buyer's list. Cards rather than table rows at every width
// (00 §12 allows either; a brief is a paragraph of context, not a row of
// values), so 360px needs no separate layout.
//
// The card is not itself a link: it carries a kebab menu and, in a moment, a
// compare checkbox, and a link wrapping interactive children is the fastest way
// to an unusable card on a phone. The title is the link, and it stretches its
// hit area across the header via `::after` — the "card link" pattern.

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
 * @param {object} props.request a brief, with `newProposalsCount` from
 *   `requestService.listForBuyer`
 * @param {string} [props.categoryLabel] resolved category name
 * @param {(action: string, request: object) => void} props.onAction kebab choice —
 *   one of `edit` · `publish` · `close` · `cancel` · `discard`
 */
export default function BuyerRequestCard({ request, categoryLabel, onAction }) {
  const [menuAnchor, setMenuAnchor] = useState(null)
  const titleId = useId()

  const actions = requestActions(request)
  const deadline = describeDeadline(request)
  const proposals = Number(request.proposalsCount) || 0
  const fresh = Number(request.newProposalsCount) || 0
  const isDraft = request.status === REQUEST_STATUS.DRAFT

  const hasMenu = Object.values(actions).some(Boolean)
  const closeMenu = () => setMenuAnchor(null)

  const choose = (action) => {
    closeMenu()
    onAction?.(action, request)
  }

  const menuItems = [
    actions.canEdit && { key: 'edit', label: 'Edit draft', icon: 'tabler:pencil' },
    actions.canPublish && { key: 'publish', label: 'Publish request', icon: 'tabler:send' },
    actions.canClose && { key: 'close', label: 'Close request', icon: 'tabler:archive' },
    actions.canCancel && { key: 'cancel', label: 'Cancel request', icon: 'tabler:x', danger: true },
    actions.canDiscard && { key: 'discard', label: 'Discard draft', icon: 'tabler:trash', danger: true },
  ].filter(Boolean)

  return (
    <Card
      component="li"
      sx={{
        position: 'relative',
        listStyle: 'none',
        transition: (theme) => theme.transitions.create(['box-shadow', 'border-color']),
        '&:hover': { boxShadow: 2 },
        // The title's stretched hit area must not sit above the kebab.
        '&:focus-within': { boxShadow: 2 },
      }}
    >
      <CardContent sx={{ p: { xs: 2, md: 2.5 }, '&:last-child': { pb: { xs: 2, md: 2.5 } } }}>
        <Stack direction="row" spacing={1.5} alignItems="flex-start">
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Stack
              direction="row"
              spacing={1}
              alignItems="center"
              flexWrap="wrap"
              useFlexGap
              sx={{ mb: 1 }}
            >
              <StatusChip status={request.status} size="sm" tooltip />
              {categoryLabel ? (
                <Chip label={categoryLabel} size="small" variant="outlined" />
              ) : null}
            </Stack>

            <Typography
              id={titleId}
              variant="subtitle1"
              component="h3"
              sx={{ fontWeight: 600, lineHeight: 1.35 }}
            >
              <Link
                component={RouterLink}
                to={paths.buyerRequestDetail(request.id)}
                underline="hover"
                color="inherit"
                sx={{
                  '&::after': {
                    content: '""',
                    position: 'absolute',
                    inset: 0,
                    // Below the kebab button, which lifts itself above it.
                    zIndex: 0,
                  },
                }}
              >
                {request.title}
              </Link>
            </Typography>
          </Box>

          {hasMenu ? (
            <>
              <IconButton
                aria-label={`Actions for ${request.title}`}
                aria-haspopup="menu"
                aria-expanded={Boolean(menuAnchor)}
                onClick={(event) => setMenuAnchor(event.currentTarget)}
                sx={{ width: 44, height: 44, mt: -0.5, mr: -1, flexShrink: 0, position: 'relative', zIndex: 1 }}
              >
                <Icon icon="tabler:dots-vertical" width={20} />
              </IconButton>

              <Menu
                anchorEl={menuAnchor}
                open={Boolean(menuAnchor)}
                onClose={closeMenu}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                MenuListProps={{ 'aria-label': `Actions for ${request.title}`, dense: true }}
              >
                {menuItems.map((item) => (
                  <MenuItem
                    key={item.key}
                    onClick={() => choose(item.key)}
                    sx={item.danger ? { color: 'error.main' } : undefined}
                  >
                    <ListItemIcon sx={{ color: 'inherit' }}>
                      <Icon icon={item.icon} width={18} />
                    </ListItemIcon>
                    <ListItemText>{item.label}</ListItemText>
                  </MenuItem>
                ))}
              </Menu>
            </>
          ) : null}
        </Stack>

        <Divider sx={{ my: 1.5 }} />

        <Stack direction="row" spacing={{ xs: 1.5, sm: 2.5 }} flexWrap="wrap" useFlexGap>
          <Fact icon="solar:wallet-money-linear" label="Budget" value={formatBudget(request)} />
          <Fact
            icon="solar:calendar-linear"
            label="Deadline"
            value={deadline.isOverdue ? `Overdue · ${deadline.date}` : deadline.date}
            tone={deadline.tone}
            title={deadline.label}
          />
          <Fact
            icon="solar:clock-circle-linear"
            label={isDraft ? 'Saved' : 'Posted'}
            value={`${isDraft ? 'Saved' : 'Posted'} ${formatDate(request.publishedAt ?? request.createdAt)}`}
          />
        </Stack>

        {isDraft ? null : (
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1.5 }}>
            <Icon icon="solar:inbox-in-linear" width={18} aria-hidden="true" />
            <Typography variant="body2" color="text.secondary">
              {proposals === 0
                ? 'No proposals yet'
                : `${formatNumber(proposals)} ${proposals === 1 ? 'proposal' : 'proposals'}`}
            </Typography>
            {fresh > 0 ? (
              <Chip
                label={`${formatNumber(fresh)} new`}
                size="small"
                color="primary"
                sx={{ height: 22, fontSize: '0.6875rem', fontWeight: 600 }}
              />
            ) : null}
          </Stack>
        )}
      </CardContent>
    </Card>
  )
}
