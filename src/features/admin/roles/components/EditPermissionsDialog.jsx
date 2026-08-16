import { useEffect, useMemo, useState } from 'react'

import { Icon } from '@iconify/react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'

import ResponsiveDialog from '@/components/layout/ResponsiveDialog'
import { PERMISSION_META } from '@/constants/permissions'
import PermissionPicker from '@/features/admin/roles/components/PermissionPicker'
import { diffPermissions } from '@/services/adminTeamService'

// Edit an admin's permissions — Prompt 36 §4.2.
//
// The same picker the create dialog uses, prefilled, plus the thing a create
// dialog has no need for: **the diff**. Changing somebody's access is a decision
// about what they can no longer do as much as what they now can, so the changed
// rows are marked inside the picker and summarised above the confirm button —
// the reader approves a change, not a checklist.
//
// The timing note is not decoration. `AuthContext` reads `permissions` off the
// user object it loaded at boot, so a signed-in admin keeps the nav they have
// until their next revalidation. Nothing they can reach in the meantime is
// unguarded — the API is the authority on every request — but somebody watching
// over their shoulder deserves to know why the sidebar has not changed yet.

/** A permission key as its label, falling back to the raw key. */
const label = (key) => PERMISSION_META[key]?.label ?? key

/**
 * @param {object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {object|null} props.admin the team member being edited
 * @param {(permissions: string[]) => Promise<void>} props.onSubmit
 */
export default function EditPermissionsDialog({ open, onClose, admin, onSubmit }) {
  const baseline = useMemo(
    () => (Array.isArray(admin?.permissions) ? admin.permissions : []),
    [admin]
  )

  const [value, setValue] = useState(baseline)
  const [saving, setSaving] = useState(false)

  // Re-seeded on every open, so editing one admin and then another does not
  // carry the first one's grant across.
  useEffect(() => {
    if (!open) return
    setValue(baseline)
    setSaving(false)
  }, [baseline, open])

  const { added, removed } = useMemo(() => diffPermissions(baseline, value), [baseline, value])
  const changed = added.length > 0 || removed.length > 0

  const submit = async () => {
    if (!changed || value.length === 0) return
    setSaving(true)
    try {
      await onSubmit(value)
    } finally {
      setSaving(false)
    }
  }

  return (
    <ResponsiveDialog
      open={open}
      onClose={saving ? undefined : onClose}
      title={admin ? `${admin.name}’s permissions` : 'Edit permissions'}
      description="Roles are fixed. What one admin can do differently from another is decided entirely here."
      maxWidth="md"
      actions={
        <>
          <Button onClick={onClose} color="inherit" disabled={saving} sx={{ minHeight: 44 }}>
            Cancel
          </Button>
          <Button
            onClick={submit}
            variant="gradient"
            disabled={saving || !changed || value.length === 0}
            sx={{ minHeight: 44 }}
          >
            {saving ? 'Saving…' : 'Save permissions'}
          </Button>
        </>
      }
    >
      <Stack spacing={2.5}>
        {value.length === 0 ? (
          <Alert severity="error" icon={<Icon icon="solar:danger-triangle-linear" width={20} />}>
            An admin needs at least one permission. With none they can sign in and see an empty
            console — suspend the account instead if that is what you mean.
          </Alert>
        ) : changed ? (
          <Alert severity="info" icon={<Icon icon="solar:info-circle-linear" width={20} />}>
            <Stack spacing={1}>
              <Typography variant="body2">
                <strong>
                  {added.length} to grant, {removed.length} to revoke.
                </strong>{' '}
                It takes effect the next time they sign in or their session revalidates — their
                sidebar will not change while they are mid-session.
              </Typography>

              {added.length > 0 ? (
                <Box>
                  <Typography variant="caption" sx={{ fontWeight: 700, color: 'success.dark' }}>
                    Granting
                  </Typography>
                  <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap" sx={{ mt: 0.5 }}>
                    {added.map((key) => (
                      <Chip
                        key={key}
                        label={label(key)}
                        size="small"
                        color="success"
                        variant="outlined"
                        sx={{ height: 24 }}
                      />
                    ))}
                  </Stack>
                </Box>
              ) : null}

              {removed.length > 0 ? (
                <Box>
                  <Typography variant="caption" sx={{ fontWeight: 700, color: 'error.main' }}>
                    Revoking
                  </Typography>
                  <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap" sx={{ mt: 0.5 }}>
                    {removed.map((key) => (
                      <Chip
                        key={key}
                        label={label(key)}
                        size="small"
                        color="error"
                        variant="outlined"
                        sx={{ height: 24 }}
                      />
                    ))}
                  </Stack>
                </Box>
              ) : null}
            </Stack>
          </Alert>
        ) : (
          <Alert severity="info" icon={<Icon icon="solar:info-circle-linear" width={20} />}>
            Nothing has changed yet. Tick or untick a permission to see what this will do.
          </Alert>
        )}

        <PermissionPicker
          value={value}
          onChange={setValue}
          baseline={baseline}
          disabled={saving}
        />
      </Stack>
    </ResponsiveDialog>
  )
}
