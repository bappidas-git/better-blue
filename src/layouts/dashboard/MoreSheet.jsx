import { useId } from 'react'

import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Drawer from '@mui/material/Drawer'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import Typography from '@mui/material/Typography'
import { NavLink } from 'react-router-dom'

import { NAV_FALLBACK_ICON } from '@/routes/navConfig'
import { durations } from '@/theme/motionTokens'

// The fifth slot of the mobile bar: everything that did not fit, in a bottom
// sheet. MUI's Drawer is built on Modal, so the focus trap, Escape, and focus
// return to the "More" tile come with it (00 §13) — the same reason
// `PublicTopNav` and `SideSheet` use it rather than a hand-rolled panel.

/**
 * @param {object} props
 * @param {boolean} props.open sheet visibility
 * @param {() => void} props.onClose backdrop click, Escape, or picking a destination
 * @param {Array} props.items destinations behind "More"
 * @param {Record<string, number>} [props.badges] counts keyed by `item.badgeKey`
 */
export default function MoreSheet({ open, onClose, items = [], badges = {} }) {
  const titleId = `${useId()}-more-sheet`

  return (
    <Drawer
      anchor="bottom"
      open={open}
      onClose={onClose}
      // 250ms — inside the ≤ 350ms budget for a sheet (00 §7 / Prompt 14 §6).
      transitionDuration={durations.base}
      PaperProps={{
        // The role and its label go on the paper, not on the Modal root: the
        // root carries no role, so a label there would name nothing.
        role: 'dialog',
        'aria-modal': true,
        'aria-labelledby': titleId,
        sx: {
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          maxHeight: '80vh',
          pb: 'max(8px, env(safe-area-inset-bottom))',
        },
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'center', pt: 1.25, pb: 0.5 }}>
        <Box
          aria-hidden="true"
          sx={{ width: 36, height: 4, borderRadius: 999, bgcolor: 'divider' }}
        />
      </Box>

      <Typography
        id={titleId}
        variant="subtitle1"
        component="h2"
        sx={{ px: 3, pt: 0.5, pb: 1, fontWeight: 700 }}
      >
        More
      </Typography>

      <List sx={{ px: 1.5, pb: 1, overflowY: 'auto' }}>
        {items.map((item) => (
          <ListItem key={item.key} disablePadding sx={{ mb: 0.25 }}>
            <ListItemButton
              component={NavLink}
              to={item.path}
              end={Boolean(item.exact)}
              onClick={onClose}
              sx={{
                minHeight: 52,
                borderRadius: 2,
                color: 'text.primary',
                '&.active': {
                  backgroundColor: 'primary.surface',
                  color: 'primary.light',
                  '& .MuiListItemIcon-root': { color: 'primary.main' },
                },
              }}
            >
              <ListItemIcon sx={{ minWidth: 40, color: 'text.secondary' }}>
                <Icon icon={item.icon || NAV_FALLBACK_ICON} width={22} aria-hidden="true" />
              </ListItemIcon>
              <ListItemText
                primary={item.label}
                primaryTypographyProps={{ fontSize: '0.9375rem', fontWeight: 600 }}
              />
              {badges[item.badgeKey] ? (
                <Chip
                  size="small"
                  color="primary"
                  label={badges[item.badgeKey] > 99 ? '99+' : badges[item.badgeKey]}
                  sx={{ height: 20, fontSize: '0.6875rem' }}
                />
              ) : null}
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </Drawer>
  )
}
