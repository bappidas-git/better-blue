import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import Stack from '@mui/material/Stack'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'

import { formatFileSize } from '@/features/orders/utils/orderDisplay'

import { ATTACHMENT_STATE } from '@/features/disputes/hooks/useAttachmentQueue'

// The files queued on a picker, as chips that wrap (§11 — at 360px a row of
// four filenames has to become four rows rather than a horizontal scroll).
//
// Each chip says what state its file is in, because "attached" and "failed to
// upload" look identical otherwise and only one of them is safe to submit on.

/**
 * @param {object} props
 * @param {object[]} props.entries queue entries from `useAttachmentQueue`
 * @param {(key: string) => void} props.onRemove drops one file from the queue
 * @param {(key: string) => void} props.onRetry re-uploads one failed file
 * @param {string} props.label accessible name for the list
 */
export default function AttachmentChips({ entries = [], onRemove, onRetry, label }) {
  if (entries.length === 0) return null

  return (
    <Stack
      component="ul"
      direction="row"
      flexWrap="wrap"
      useFlexGap
      spacing={1}
      aria-label={label}
      sx={{ listStyle: 'none', m: 0, p: 0 }}
    >
      {entries.map((entry) => {
        const failed = entry.state === ATTACHMENT_STATE.FAILED
        const uploading = entry.state === ATTACHMENT_STATE.UPLOADING
        const name = entry.file?.name ?? 'file'
        const size = formatFileSize(Math.round((entry.file?.size ?? 0) / 1024))

        return (
          <Box component="li" key={entry.key} sx={{ maxWidth: '100%' }}>
            <Tooltip title={failed ? entry.error : `${name} · ${size}`}>
              <Chip
                variant="outlined"
                color={failed ? 'error' : 'default'}
                onDelete={() => onRemove?.(entry.key)}
                deleteIcon={
                  <Icon icon="tabler:x" width={16} aria-label={`Remove ${name}`} role="img" />
                }
                icon={
                  uploading ? (
                    <CircularProgress size={14} aria-hidden="true" sx={{ ml: 1 }} />
                  ) : (
                    <Icon
                      icon={failed ? 'solar:danger-triangle-linear' : 'solar:paperclip-linear'}
                      width={16}
                      aria-hidden="true"
                    />
                  )
                }
                label={
                  <Box component="span" sx={{ display: 'inline-flex', alignItems: 'baseline', gap: 0.75 }}>
                    <Box
                      component="span"
                      sx={{
                        maxWidth: 180,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {name}
                    </Box>
                    {failed ? (
                      <Box
                        component="span"
                        role="button"
                        tabIndex={0}
                        onClick={() => onRetry?.(entry.key)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault()
                            onRetry?.(entry.key)
                          }
                        }}
                        sx={{
                          fontWeight: 700,
                          textDecoration: 'underline',
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        Retry
                      </Box>
                    ) : null}
                  </Box>
                }
                sx={{ maxWidth: '100%' }}
              />
            </Tooltip>
          </Box>
        )
      })}

      {entries.some((entry) => entry.state === ATTACHMENT_STATE.FAILED) ? (
        <Box component="li" sx={{ width: '100%' }}>
          <Typography variant="caption" color="error.main">
            Remove or retry the files that did not upload before sending.
          </Typography>
        </Box>
      ) : null}
    </Stack>
  )
}
