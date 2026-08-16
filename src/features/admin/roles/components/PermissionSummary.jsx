import { useState } from 'react'

import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Popover from '@mui/material/Popover'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'

import { PERMISSION_GROUPS, PERMISSION_META, PERMISSION_VALUES } from '@/constants/permissions'

// "7 permissions" — with the list one tap away. Prompt 36 §4.2.
//
// A team table needs the *count* at a glance (is this a limited account or a
// broad one?) and the *list* on demand (which seven?). Sixteen chips in a table
// cell answers neither. A click rather than a hover tooltip, because the answer
// has to be reachable on a phone and by keyboard — the chip is a real button.

/**
 * @param {object} props
 * @param {string[]} [props.permissions] the grant
 * @param {boolean} [props.all=false] super admins hold everything implicitly
 *   (`hasPermission`), so their chip says so rather than counting an array that
 *   only exists to be rendered
 * @param {string} [props.name] whose permissions these are — used in the popover
 *   heading and the accessible name
 */
export default function PermissionSummary({ permissions = [], all = false, name }) {
  const [anchor, setAnchor] = useState(null)

  const granted = all ? PERMISSION_VALUES : permissions
  const count = granted.length

  return (
    <>
      <Chip
        icon={<Icon icon="solar:key-square-linear" width={14} aria-hidden="true" />}
        label={all ? 'Every permission' : `${count} permission${count === 1 ? '' : 's'}`}
        size="small"
        variant="outlined"
        color={all ? 'primary' : 'default'}
        onClick={(event) => setAnchor(event.currentTarget)}
        aria-haspopup="dialog"
        aria-label={`${name ? `${name}: ` : ''}${
          all ? 'every permission' : `${count} permissions`
        } — show the list`}
        sx={{ height: 26, fontWeight: 600, '& .MuiChip-icon': { ml: 1 } }}
      />

      <Popover
        open={Boolean(anchor)}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        slotProps={{ paper: { sx: { maxWidth: 360, p: 2 } } }}
      >
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
          {name ? `${name} can` : 'This admin can'}
        </Typography>
        <Typography variant="caption" color="text.secondary" component="p" sx={{ mb: 1.5 }}>
          {all
            ? 'Super admins hold every permission implicitly, including any added later.'
            : `${count} of ${PERMISSION_VALUES.length} permissions granted.`}
        </Typography>

        <Stack spacing={1.5}>
          {PERMISSION_GROUPS.map((group) => {
            const held = group.permissions.filter((key) => granted.includes(key))
            if (held.length === 0) return null

            return (
              <Box key={group.id}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                  {group.label}
                </Typography>
                <Stack component="ul" spacing={0.25} sx={{ m: 0, mt: 0.25, pl: 2 }}>
                  {held.map((key) => (
                    <Typography key={key} component="li" variant="body2">
                      {PERMISSION_META[key]?.label ?? key}
                    </Typography>
                  ))}
                </Stack>
              </Box>
            )
          })}

          {count === 0 ? (
            <Typography variant="body2" color="text.secondary">
              None yet — this account can sign in but has nothing to work on.
            </Typography>
          ) : null}
        </Stack>
      </Popover>
    </>
  )
}
