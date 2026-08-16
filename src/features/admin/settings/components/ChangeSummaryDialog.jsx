import { Icon } from '@iconify/react'
import Alert from '@mui/material/Alert'
import AlertTitle from '@mui/material/AlertTitle'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { alpha } from '@mui/material/styles'

import ResponsiveDialog from '@/components/layout/ResponsiveDialog'

// The confirmation before anything is written — Prompt 35 §4.1, §6.
//
// A settings save is not "are you sure": the reader has usually edited three
// fields across two cards and needs to see **the list**, old value → new value,
// before it goes live for everybody. So this dialog is a readable diff rather
// than a warning, and it is the only path from the save bar to the API.
//
// Two flavours, decided by the changes themselves. A change carrying a
// `warning` — switching a feature off — turns the dialog danger-flavoured and
// leads with what will disappear, because that is the one edit here that hides
// parts of the product from everyone at once. Everything else is neutral.
//
// The list is a real `<dl>`: a screen reader hears "Default rate, 20% becomes
// 18%" rather than three unrelated table cells (§12).

/**
 * @param {object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {() => void} props.onConfirm writes the change
 * @param {Array<{key: string, label: string, from: string, to: string, warning?: string}>} props.changes
 * @param {string} props.sectionLabel which section is being saved
 * @param {boolean} [props.isSaving]
 */
export default function ChangeSummaryDialog({
  open,
  onClose,
  onConfirm,
  changes = [],
  sectionLabel,
  isSaving = false,
}) {
  const warnings = changes.filter((change) => change.warning)
  const isDanger = warnings.length > 0
  const count = changes.length

  return (
    <ResponsiveDialog
      open={open}
      onClose={isSaving ? undefined : onClose}
      title={`Save ${count} ${count === 1 ? 'change' : 'changes'} to ${sectionLabel}?`}
      description="These values take effect across BetterBlue as soon as you save — nobody needs to reload."
      maxWidth="sm"
      actions={
        <>
          <Button onClick={onClose} color="inherit" disabled={isSaving} sx={{ minHeight: 44 }}>
            Keep editing
          </Button>
          <Button
            onClick={onConfirm}
            variant="contained"
            color={isDanger ? 'error' : 'primary'}
            disabled={isSaving}
            sx={{ minHeight: 44 }}
            startIcon={<Icon icon="solar:diskette-linear" width={18} aria-hidden="true" />}
          >
            {isSaving ? 'Saving…' : 'Save changes'}
          </Button>
        </>
      }
    >
      <Stack spacing={2}>
        {isDanger ? (
          <Alert severity="warning" icon={<Icon icon="solar:danger-triangle-bold" width={22} />}>
            <AlertTitle sx={{ mb: 0.5 }}>
              {warnings.length === 1
                ? 'This hides a feature across the app immediately'
                : 'These hide features across the app immediately'}
            </AlertTitle>
            <Stack component="ul" spacing={0.75} sx={{ m: 0, pl: 2.5 }}>
              {warnings.map((change) => (
                <Typography component="li" variant="body2" key={change.key}>
                  <strong>{change.label}:</strong> {change.warning}
                </Typography>
              ))}
            </Stack>
          </Alert>
        ) : null}

        <Box component="dl" sx={{ m: 0, display: 'grid', gap: 1.25 }}>
          {changes.map((change) => (
            <Box
              key={change.key}
              sx={{
                p: 1.5,
                borderRadius: 2,
                border: 1,
                borderColor: 'divider',
                // Changed-field highlighting (§6): every row here *is* a change,
                // so the tint carries the severity rather than the fact.
                bgcolor: (theme) =>
                  change.warning ? alpha(theme.palette.error.main, 0.07) : theme.palette.primary.surface,
              }}
            >
              <Typography component="dt" variant="caption" color="text.secondary">
                {change.label}
              </Typography>
              <Stack
                component="dd"
                direction="row"
                spacing={1}
                alignItems="center"
                flexWrap="wrap"
                useFlexGap
                sx={{ m: 0, mt: 0.25 }}
              >
                <Typography
                  variant="body2"
                  sx={{ color: 'text.secondary', textDecoration: 'line-through' }}
                >
                  {change.from}
                </Typography>
                <Icon icon="tabler:arrow-right" width={16} aria-hidden="true" />
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  {change.to}
                </Typography>
              </Stack>
            </Box>
          ))}
        </Box>
      </Stack>
    </ResponsiveDialog>
  )
}
