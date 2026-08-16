import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import List from '@mui/material/List'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import Tab from '@mui/material/Tab'
import Tabs from '@mui/material/Tabs'

import { SETTINGS_SECTIONS } from '@/features/admin/settings/utils/settingsSchema'

// Section navigation for `/admin/settings` — tabs from `md` up, a list of rows
// below it (Prompt 35 §4.1, §11).
//
// Not a `Tabs` component squeezed into a phone: five scrollable tabs on a 360px
// screen means the reader swipes a strip to find "Moderation", and each label
// sits in a 44px sliver. A vertical list gives every section a full-width,
// thumb-sized row with its icon and its description — which is also how the
// mobile "More" sheet already presents a set of destinations.
//
// The selection lives in the URL (`?section=…`), so a section is linkable, and
// the browser's back button steps between them.

/**
 * @param {object} props
 * @param {string} props.value the current section key
 * @param {(key: string) => void} props.onChange asked for a different section —
 *   the page decides whether unsaved work allows the move
 */
export default function SettingsSectionNav({ value, onChange }) {
  return (
    <>
      <Box sx={{ display: { xs: 'none', md: 'block' } }}>
        <Tabs
          value={value}
          onChange={(event, next) => onChange?.(next)}
          variant="scrollable"
          scrollButtons="auto"
          allowScrollButtonsMobile
          aria-label="Platform settings sections"
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          {SETTINGS_SECTIONS.map((section) => (
            <Tab
              key={section.key}
              value={section.key}
              label={section.label}
              icon={<Icon icon={section.icon} width={18} aria-hidden="true" />}
              iconPosition="start"
              sx={{ minHeight: 48, textTransform: 'none', fontWeight: 600 }}
            />
          ))}
        </Tabs>
      </Box>

      <Box
        component="nav"
        aria-label="Platform settings sections"
        sx={{
          display: { xs: 'block', md: 'none' },
          borderRadius: 2,
          border: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
          overflow: 'hidden',
        }}
      >
        <List disablePadding>
          {SETTINGS_SECTIONS.map((section) => {
            const selected = section.key === value
            return (
              <ListItemButton
                key={section.key}
                selected={selected}
                onClick={() => onChange?.(section.key)}
                aria-current={selected ? 'page' : undefined}
                sx={{ minHeight: 56, gap: 0.5 }}
              >
                <ListItemIcon sx={{ minWidth: 40, color: selected ? 'primary.main' : 'text.secondary' }}>
                  <Icon icon={section.icon} width={22} aria-hidden="true" />
                </ListItemIcon>
                <ListItemText
                  primary={section.label}
                  secondary={section.description}
                  primaryTypographyProps={{ fontWeight: selected ? 700 : 600 }}
                  secondaryTypographyProps={{ variant: 'caption', noWrap: true }}
                />
                <Icon icon="tabler:chevron-right" width={18} aria-hidden="true" />
              </ListItemButton>
            )
          })}
        </List>
      </Box>
    </>
  )
}
