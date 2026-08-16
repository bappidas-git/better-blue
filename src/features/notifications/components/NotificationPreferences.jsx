import { useCallback, useEffect, useState } from 'react'

import { Icon } from '@iconify/react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import FormControlLabel from '@mui/material/FormControlLabel'
import Stack from '@mui/material/Stack'
import Switch from '@mui/material/Switch'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'

import ErrorState from '@/components/feedback/ErrorState'
import ListSkeleton from '@/components/feedback/skeletons/ListSkeleton'
import { useToast } from '@/components/feedback/ToastProvider'
import {
  NOTIFICATION_CATEGORY_META,
  allowsInAppCategory,
  defaultNotificationPrefs,
  isNotificationCategoryLocked,
} from '@/constants/notificationTypes'
import { useAuth } from '@/context/AuthContext'
import { categoriesForRole } from '@/features/notifications/notificationFilters'
import useApiQuery from '@/hooks/useApiQuery'
import { userService } from '@/services/userService'

// The Preferences card body on every role's settings screen (§4.4). One
// component, three mounts: buyer settings, creator settings, and — when
// Prompt 36 builds it — the admin's own account screen.
//
// Two columns, and only one of them does anything. **In-app** is real and is
// enforced at emit time: switching a category off means `notificationService.notify`
// writes no record for it at all, so nothing arrives and nothing is waiting if
// it is switched back on. **Email** is shown disabled with a "Coming soon" tag
// rather than hidden, because a settings screen that silently lacks the column
// reads as if email is on by default — this is the honest mock (00 §14).
//
// Saving is per-row and immediate: a switch that needs a Save button underneath
// it is a switch people leave in the wrong position.

/** The one row that is not a switch. */
function LockedRow({ category }) {
  const meta = NOTIFICATION_CATEGORY_META[category]
  return (
    <Tooltip title="Account and service notices are always delivered.">
      <Chip
        size="small"
        icon={<Icon icon="solar:lock-keyhole-minimalistic-linear" width={14} />}
        label="Always on"
        aria-label={`${meta?.label ?? category}: always on and cannot be switched off`}
        sx={{ height: 24 }}
      />
    </Tooltip>
  )
}

function PreferenceRow({ category, checked, disabled, onChange }) {
  const meta = NOTIFICATION_CATEGORY_META[category]
  const locked = isNotificationCategoryLocked(category)

  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      spacing={{ xs: 1, sm: 2 }}
      alignItems={{ xs: 'flex-start', sm: 'center' }}
      sx={{ py: 1.5, borderBottom: 1, borderColor: 'divider', '&:last-of-type': { border: 0 } }}
    >
      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
        <Typography variant="subtitle2" component="p">
          {meta?.label ?? category}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
          {meta?.description}
        </Typography>
      </Box>

      <Stack
        direction="row"
        spacing={{ xs: 2, sm: 3 }}
        alignItems="center"
        sx={{ flexShrink: 0, minHeight: 44 }}
      >
        {locked ? (
          <LockedRow category={category} />
        ) : (
          <FormControlLabel
            label="In-app"
            labelPlacement="start"
            sx={{ m: 0, gap: 0.5 }}
            control={
              <Switch
                checked={checked}
                disabled={disabled}
                onChange={(event) => onChange(event.target.checked)}
                inputProps={{
                  'aria-label': `${meta?.label ?? category} in the app — currently ${
                    checked ? 'on' : 'off'
                  }`,
                }}
              />
            }
          />
        )}

        <Tooltip title="Email notifications are not part of this release.">
          <span>
            <FormControlLabel
              label="Email"
              labelPlacement="start"
              sx={{ m: 0, gap: 0.5 }}
              control={
                <Switch
                  checked={false}
                  disabled
                  inputProps={{
                    'aria-label': `${meta?.label ?? category} by email — not available yet`,
                  }}
                />
              }
            />
          </span>
        </Tooltip>
      </Stack>
    </Stack>
  )
}

export default function NotificationPreferences() {
  const { user, refreshUser } = useAuth()
  const toast = useToast()
  const userId = user?.id

  const {
    data: account,
    isLoading,
    error,
    refetch,
  } = useApiQuery(() => userService.getById(userId), [userId], {
    enabled: Boolean(userId),
  })

  const [prefs, setPrefs] = useState(null)
  const [saving, setSaving] = useState(null)

  useEffect(() => {
    if (!account) return
    setPrefs({ ...defaultNotificationPrefs(), ...(account.notificationPrefs ?? {}) })
  }, [account])

  const save = useCallback(
    async (category, inApp) => {
      const previous = prefs
      // `notificationPrefs` is replaced whole (contract §6.2), so the patch
      // carries every category rather than the one that moved.
      const next = {
        ...previous,
        [category]: { ...(previous?.[category] ?? {}), inApp },
      }

      setPrefs(next)
      setSaving(category)

      try {
        await userService.update(userId, { notificationPrefs: next })
        // Keeps the copy in `AuthContext` from going stale — anything reading
        // preferences off the session would otherwise show the old value until
        // the next sign-in. Best effort: the preference *is* saved, and a failed
        // re-read must not roll the switch back and say otherwise.
        await refreshUser().catch(() => {})
        toast.success(
          inApp
            ? `${NOTIFICATION_CATEGORY_META[category]?.label} notifications are on.`
            : `${NOTIFICATION_CATEGORY_META[category]?.label} notifications are off.`
        )
      } catch (failure) {
        setPrefs(previous)
        toast.error(failure.message ?? 'We could not save that preference.')
      } finally {
        setSaving(null)
      }
    },
    [prefs, refreshUser, toast, userId]
  )

  if (error) {
    return (
      <ErrorState
        dense
        title="We could not load your preferences"
        message="Your current settings are unchanged — this panel just needs another go."
        error={error}
        onRetry={refetch}
      />
    )
  }

  if (isLoading || !prefs) {
    return <ListSkeleton rows={4} avatar={false} trailing label="Loading notification preferences" />
  }

  return (
    <Box>
      <Stack sx={{ mb: 1 }}>
        {categoriesForRole(user?.role).map((category) => (
          <PreferenceRow
            key={category}
            category={category}
            checked={allowsInAppCategory(prefs, category)}
            disabled={saving !== null}
            onChange={(inApp) => save(category, inApp)}
          />
        ))}
      </Stack>

      <Alert severity="info" icon={<Icon icon="solar:info-circle-linear" width={20} />}>
        Switching a category off stops those notifications being created at all — nothing is
        held back and shown later. Account and service notices are always delivered.
      </Alert>
    </Box>
  )
}
