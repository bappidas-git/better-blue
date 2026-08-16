import { useEffect, useRef, useState } from 'react'

import { Icon } from '@iconify/react'
import Alert from '@mui/material/Alert'
import AlertTitle from '@mui/material/AlertTitle'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { visuallyHidden } from '@mui/utils'

import ResponsiveDialog from '@/components/layout/ResponsiveDialog'
import { appConfig } from '@/config/appConfig'

// The temporary password, shown **once** — Prompt 36 §4.2.
//
// This is the one moment in the console where dismissing a dialog destroys
// information: nothing stores the plain password, no screen can re-read it, and
// the only recovery is to suspend the account and create another. So the
// dialog is deliberately heavy — a warning above the value, the value itself in
// a large selectable field, a copy button, and a confirm that says what closing
// it means. It is not a toast, and it does not close on a backdrop click.
//
// **Laravel:** none of this ships. `POST /admin/admins` creates the account with
// no credential and emails a signed invitation link; the invitee sets their own
// password. This dialog exists because JSON Server has no mail and no tokens —
// it is the mock stack's stand-in for that email, and it disappears with it.

/**
 * @param {object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {object|null} props.admin the account that was just created
 * @param {string} [props.tempPassword] the one-time password
 */
export default function TempPasswordDialog({ open, onClose, admin, tempPassword }) {
  const [copied, setCopied] = useState(false)
  const valueRef = useRef(null)

  useEffect(() => {
    if (open) setCopied(false)
  }, [open])

  const copy = async () => {
    const text = String(tempPassword ?? '')
    try {
      // `navigator.clipboard` is unavailable on insecure origins and in some
      // embedded webviews, so selecting the text is the fallback — the reader
      // can still copy it by hand rather than being told it failed.
      await navigator.clipboard.writeText(text)
      setCopied(true)
    } catch {
      valueRef.current?.focus?.()
      valueRef.current?.select?.()
      setCopied(false)
    }
  }

  return (
    <ResponsiveDialog
      open={open}
      // No backdrop dismissal: closing this loses the password, so it takes a
      // deliberate click on a button that says so.
      onClose={undefined}
      hideCloseButton
      title={admin ? `${admin.name} can now sign in` : 'Admin account created'}
      description="Send them this password over a channel you trust. It is not stored anywhere and cannot be shown again."
      maxWidth="sm"
      actions={
        <Button onClick={onClose} variant="gradient" sx={{ minHeight: 44 }}>
          I have saved it
        </Button>
      }
    >
      <Stack spacing={2.5}>
        <Alert severity="warning" icon={<Icon icon="solar:danger-triangle-linear" width={22} />}>
          <AlertTitle sx={{ fontWeight: 700 }}>Shown only once</AlertTitle>
          Nothing in {appConfig.appName} can display this password again. If it is lost, suspend the
          account and create a replacement.
        </Alert>

        <Box>
          <Typography
            component="label"
            htmlFor="temp-password-value"
            variant="caption"
            color="text.secondary"
            sx={{ display: 'block', mb: 0.75 }}
          >
            Temporary password for {admin?.email ?? 'the new admin'}
          </Typography>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems="stretch">
            <Box
              id="temp-password-value"
              component="input"
              ref={valueRef}
              readOnly
              value={tempPassword ?? ''}
              onFocus={(event) => event.target.select()}
              sx={{
                flexGrow: 1,
                minWidth: 0,
                minHeight: 56,
                px: 2,
                borderRadius: 2,
                border: 1,
                borderColor: 'divider',
                bgcolor: 'background.default',
                color: 'text.primary',
                fontFamily: 'monospace',
                fontSize: '1.25rem',
                fontWeight: 700,
                letterSpacing: '0.06em',
              }}
            />
            <Button
              onClick={copy}
              variant="outlined"
              startIcon={
                <Icon
                  icon={copied ? 'tabler:check' : 'solar:copy-linear'}
                  width={18}
                  aria-hidden="true"
                />
              }
              sx={{ minHeight: 56, flexShrink: 0 }}
            >
              {copied ? 'Copied' : 'Copy'}
            </Button>
          </Stack>

          {/* Announced rather than only coloured: a copy that succeeded is
              invisible to a screen reader otherwise (§12). */}
          <Box aria-live="polite" sx={visuallyHidden}>
            {copied ? 'Temporary password copied to the clipboard.' : ''}
          </Box>
        </Box>

        <Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
            What happens next
          </Typography>
          <Stack component="ol" spacing={0.75} sx={{ m: 0, pl: 2.5 }}>
            <Typography component="li" variant="body2" color="text.secondary">
              They sign in at the usual address with {admin?.email ?? 'their email'} and this
              password.
            </Typography>
            <Typography component="li" variant="body2" color="text.secondary">
              Their console shows exactly the sections you granted — nothing else is reachable, by
              menu or by typed URL.
            </Typography>
            <Typography component="li" variant="body2" color="text.secondary">
              They change the password from their own settings. Ask them to, straight away.
            </Typography>
          </Stack>
        </Box>
      </Stack>
    </ResponsiveDialog>
  )
}
