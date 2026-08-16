import { useMemo } from 'react'

import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Checkbox from '@mui/material/Checkbox'
import Chip from '@mui/material/Chip'
import Divider from '@mui/material/Divider'
import FormControlLabel from '@mui/material/FormControlLabel'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'

import {
  DEFAULT_ADMIN_PERMISSIONS,
  PERMISSION_GROUPS,
  PERMISSION_META,
  PERMISSION_VALUES,
} from '@/constants/permissions'

// The permission picker — Prompt 36 §4.2.
//
// This is where an admin account is actually defined, so it is written to be
// **read** rather than merely ticked: every permission carries the sentence from
// `PERMISSION_META` that says what holding it lets somebody do, grouped the way
// `PERMISSION_GROUPS` groups them, with a select-all per group for the common
// case ("give them all of Finance").
//
// Grouped as `fieldset` + `legend` rather than as styled headings, so a screen
// reader announces "Finance, group, 2 of 2 selected" when it enters the block
// (§12) — the same information a sighted reader gets from the count chip.
//
// It renders a single column below md with everything full width, and the
// dialog that hosts it pins its confirm bar (§11).

/**
 * @param {object} props
 * @param {string[]} props.value the current grant
 * @param {(next: string[]) => void} props.onChange receives the whole new array —
 *   the grant is a state, not a stream of deltas (see `adminTeamService`)
 * @param {boolean} [props.disabled]
 * @param {string[]} [props.baseline] a grant to compare against — the editor
 *   passes the admin's current permissions so changed rows are marked
 * @param {boolean} [props.showPresets=true] offer the "operations default" and
 *   "clear all" shortcuts
 */
export default function PermissionPicker({
  value = [],
  onChange,
  disabled = false,
  baseline,
  showPresets = true,
}) {
  const selected = useMemo(() => new Set(value), [value])
  const before = useMemo(() => new Set(baseline ?? []), [baseline])

  /** Always emits in the canonical order of `PERMISSION_VALUES`. */
  const emit = (next) => onChange?.(PERMISSION_VALUES.filter((key) => next.has(key)))

  const toggle = (key) => {
    const next = new Set(selected)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    emit(next)
  }

  const toggleGroup = (group, on) => {
    const next = new Set(selected)
    group.permissions.forEach((key) => (on ? next.add(key) : next.delete(key)))
    emit(next)
  }

  return (
    <Stack spacing={2.5}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1}
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        justifyContent="space-between"
      >
        <Chip
          icon={<Icon icon="solar:key-square-linear" width={16} aria-hidden="true" />}
          label={`${selected.size} of ${PERMISSION_VALUES.length} permissions`}
          color={selected.size > 0 ? 'primary' : 'default'}
          variant={selected.size > 0 ? 'filled' : 'outlined'}
          sx={{ height: 28, fontWeight: 600 }}
        />

        {showPresets ? (
          <Stack direction="row" spacing={0.5}>
            <Button
              size="small"
              onClick={() => emit(new Set(DEFAULT_ADMIN_PERMISSIONS))}
              disabled={disabled}
              sx={{ minHeight: 36 }}
            >
              Operations default
            </Button>
            <Button
              size="small"
              color="inherit"
              onClick={() => emit(new Set())}
              disabled={disabled || selected.size === 0}
              sx={{ minHeight: 36 }}
            >
              Clear all
            </Button>
          </Stack>
        ) : null}
      </Stack>

      {PERMISSION_GROUPS.map((group) => {
        const chosen = group.permissions.filter((key) => selected.has(key))
        const all = chosen.length === group.permissions.length
        const some = chosen.length > 0 && !all

        return (
          <Box
            key={group.id}
            component="fieldset"
            sx={{
              m: 0,
              p: 0,
              pt: 0.5,
              border: 0,
              minWidth: 0,
            }}
          >
            <Box component="legend" sx={{ width: '100%', p: 0, mb: 1 }}>
              <Stack
                direction="row"
                spacing={1}
                alignItems="flex-start"
                justifyContent="space-between"
              >
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                    {group.label}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {group.description}
                  </Typography>
                </Box>
                <FormControlLabel
                  sx={{ mr: 0, flexShrink: 0 }}
                  control={
                    <Checkbox
                      checked={all}
                      indeterminate={some}
                      onChange={(event) => toggleGroup(group, event.target.checked)}
                      disabled={disabled}
                      inputProps={{
                        'aria-label': `Select every ${group.label} permission`,
                      }}
                    />
                  }
                  label={
                    <Typography variant="caption" color="text.secondary">
                      {chosen.length}/{group.permissions.length}
                    </Typography>
                  }
                />
              </Stack>
            </Box>

            <Stack spacing={0.5}>
              {group.permissions.map((key) => {
                const meta = PERMISSION_META[key]
                const isOn = selected.has(key)
                const changed = baseline ? isOn !== before.has(key) : false

                return (
                  <Box
                    key={key}
                    sx={{
                      borderRadius: 1.5,
                      px: 1,
                      py: 0.5,
                      border: 1,
                      borderColor: changed ? 'primary.main' : 'transparent',
                      bgcolor: changed ? 'primary.surface' : 'transparent',
                      transition: 'background-color 150ms ease, border-color 150ms ease',
                    }}
                  >
                    <FormControlLabel
                      sx={{ alignItems: 'flex-start', ml: 0, mr: 0, width: '100%', minHeight: 44 }}
                      control={
                        <Checkbox
                          checked={isOn}
                          onChange={() => toggle(key)}
                          disabled={disabled}
                          sx={{ mt: 0.25 }}
                          inputProps={{ 'aria-describedby': `permission-${key}-description` }}
                        />
                      }
                      label={
                        <Box sx={{ py: 0.5, minWidth: 0 }}>
                          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              {meta?.label ?? key}
                            </Typography>
                            <Typography
                              variant="caption"
                              color="text.disabled"
                              sx={{ fontFamily: 'monospace' }}
                            >
                              {key}
                            </Typography>
                            {changed ? (
                              <Chip
                                label={isOn ? 'Adding' : 'Removing'}
                                size="small"
                                color={isOn ? 'success' : 'error'}
                                variant="outlined"
                                sx={{ height: 20, fontSize: '0.65rem' }}
                              />
                            ) : null}
                          </Stack>
                          <Typography
                            id={`permission-${key}-description`}
                            variant="caption"
                            color="text.secondary"
                            component="p"
                          >
                            {meta?.description}
                          </Typography>
                        </Box>
                      }
                    />
                  </Box>
                )
              })}
            </Stack>

            <Divider sx={{ mt: 1.5 }} />
          </Box>
        )
      })}
    </Stack>
  )
}
