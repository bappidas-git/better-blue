import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'

import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { alpha } from '@mui/material/styles'

import FormTextField from '@/components/inputs/FormTextField'
import ResponsiveDialog from '@/components/layout/ResponsiveDialog'

// Promise-based confirmation for destructive and irreversible actions —
// 00 §12: "cancel, reject, suspend, blacklist, resolve, refund: always
// useConfirm() with explicit consequence copy; reason field where the domain
// requires it."
//
//   const ok = await confirm({ title, message, tone: 'danger' })
//   if (!ok) return
//
// Resolves `false` when dismissed, or `{ confirmed: true, reason? }` when
// accepted — both branches read naturally in an `if`.

const ConfirmContext = createContext(null)

/**
 * Access the confirm dialog from anywhere under `<ConfirmDialogProvider>`.
 * @returns {(options?: object) => Promise<false | { confirmed: true, reason?: string }>}
 *
 * @example
 * const confirm = useConfirm()
 * const result = await confirm({
 *   title: 'Cancel this order?',
 *   message: 'The buyer is refunded in full and the creator is notified.',
 *   confirmLabel: 'Cancel order',
 *   tone: 'danger',
 *   requireReason: true,
 * })
 * if (result) orderService.cancelOrder(orderId, result.reason)
 */
// The hook and its provider are one unit — splitting them across files to
// satisfy fast refresh would scatter the confirm API for no runtime benefit.
// eslint-disable-next-line react-refresh/only-export-components
export function useConfirm() {
  const context = useContext(ConfirmContext)
  if (!context) {
    throw new Error(
      'useConfirm() must be used inside <ConfirmDialogProvider> (mounted in AppProviders).'
    )
  }
  return context
}

const DEFAULT_OPTIONS = {
  title: 'Are you sure?',
  message: '',
  confirmLabel: 'Confirm',
  cancelLabel: 'Cancel',
  tone: 'primary',
  requireReason: false,
  // Prompt 18 addition: some decisions want a reason without demanding one —
  // closing a content request tells the creators who proposed on it why, and
  // "no comment" is a legitimate answer. `allowReason` renders the same field,
  // optional; `requireReason` still implies it.
  allowReason: false,
  reasonLabel: 'Reason',
  reasonPlaceholder: '',
  reasonHelperText: 'Shared with the people affected by this decision.',
  icon: undefined,
}

/**
 * @param {object} props
 * @param {React.ReactNode} props.children app tree that can raise confirmations
 */
export default function ConfirmDialogProvider({ children }) {
  const [request, setRequest] = useState(null)
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [reasonError, setReasonError] = useState(undefined)
  const resolverRef = useRef(null)

  const settle = useCallback((result) => {
    resolverRef.current?.(result)
    resolverRef.current = null
    setOpen(false)
  }, [])

  const confirm = useCallback(
    (options = {}) =>
      new Promise((resolve) => {
        // A second request while one is open declines the first — the newest
        // intent wins rather than queueing behind a stale dialog.
        resolverRef.current?.(false)
        resolverRef.current = resolve
        setReason('')
        setReasonError(undefined)
        setRequest({ ...DEFAULT_OPTIONS, ...options })
        setOpen(true)
      }),
    []
  )

  const options = request ?? DEFAULT_OPTIONS
  const isDanger = options.tone === 'danger'

  const handleConfirm = useCallback(() => {
    const trimmed = reason.trim()
    if (options.requireReason && !trimmed) {
      setReasonError('Add a short reason before continuing.')
      return
    }
    settle({ confirmed: true, reason: trimmed || undefined })
  }, [options.requireReason, reason, settle])

  const value = useMemo(() => confirm, [confirm])

  return (
    <ConfirmContext.Provider value={value}>
      {children}

      <ResponsiveDialog
        open={open}
        onClose={() => settle(false)}
        title={options.title}
        maxWidth="xs"
        // Keep the content mounted through the exit transition, then drop it.
        TransitionProps={{ onExited: () => setRequest(null) }}
        actions={
          <>
            <Button color="inherit" onClick={() => settle(false)}>
              {options.cancelLabel}
            </Button>
            <Button
              variant={isDanger ? 'contained' : 'gradient'}
              color={isDanger ? 'error' : 'primary'}
              onClick={handleConfirm}
            >
              {options.confirmLabel}
            </Button>
          </>
        }
      >
        <Stack direction="row" spacing={2} alignItems="flex-start">
          {options.icon || isDanger ? (
            <Box
              aria-hidden="true"
              sx={{
                flexShrink: 0,
                width: 44,
                height: 44,
                borderRadius: '50%',
                display: 'grid',
                placeItems: 'center',
                bgcolor: (theme) =>
                  isDanger
                    ? alpha(theme.palette.error.main, 0.12)
                    : theme.palette.primary.surface,
                color: isDanger ? 'error.main' : 'primary.main',
              }}
            >
              <Icon
                icon={options.icon ?? 'tabler:alert-triangle'}
                width={22}
              />
            </Box>
          ) : null}

          <Box sx={{ minWidth: 0, width: '100%' }}>
            {options.message ? (
              <Typography variant="body2" color="text.secondary">
                {options.message}
              </Typography>
            ) : null}

            {options.requireReason || options.allowReason ? (
              <Box sx={{ mt: options.message ? 2.5 : 0 }}>
                <FormTextField
                  id="confirm-dialog-reason"
                  label={
                    options.requireReason ? options.reasonLabel : `${options.reasonLabel} (optional)`
                  }
                  value={reason}
                  onChange={(next) => {
                    setReason(next)
                    if (reasonError && next.trim()) setReasonError(undefined)
                  }}
                  placeholder={options.reasonPlaceholder}
                  helperText={options.reasonHelperText}
                  error={reasonError}
                  required={options.requireReason}
                  multiline
                  minRows={3}
                  maxLength={500}
                  autoFocus
                />
              </Box>
            ) : null}
          </Box>
        </Stack>
      </ResponsiveDialog>
    </ConfirmContext.Provider>
  )
}
