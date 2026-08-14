import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import FormHelperText from '@mui/material/FormHelperText'
import FormLabel from '@mui/material/FormLabel'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { alpha } from '@mui/material/styles'

// File picker with the unified field contract: drag-and-drop zone plus a
// Browse button, inline `accept`/size enforcement, and metadata chips with
// image previews.
//
// It emits `File[]` and nothing else — uploading is `uploadService`'s job in a
// later prompt (00 §10). Rejected files never throw: they are reported inline
// and dropped from the selection.

const BYTE_UNITS = ['B', 'KB', 'MB', 'GB']

/** Local byte formatter — `utils/formatters` deals in money, dates, and counts. */
function formatBytes(bytes) {
  const size = Number(bytes)
  if (!Number.isFinite(size) || size <= 0) return '0 B'
  const exponent = Math.min(Math.floor(Math.log(size) / Math.log(1024)), BYTE_UNITS.length - 1)
  const value = size / 1024 ** exponent
  return `${value >= 10 || exponent === 0 ? Math.round(value) : value.toFixed(1)} ${BYTE_UNITS[exponent]}`
}

/** `image/*`, `.png`, and `video/mp4` style rules, matched defensively. */
function matchesAccept(file, accept) {
  if (!accept) return true
  const type = (file?.type ?? '').toLowerCase()
  const name = (file?.name ?? '').toLowerCase()

  return accept
    .split(',')
    .map((rule) => rule.trim().toLowerCase())
    .filter(Boolean)
    .some((rule) => {
      if (rule.startsWith('.')) return name.endsWith(rule)
      if (rule.endsWith('/*')) return type.startsWith(`${rule.slice(0, -1)}`)
      return type === rule
    })
}

const isImage = (file) => (file?.type ?? '').startsWith('image/')
const fileKey = (file, index) => `${file?.name ?? 'file'}-${file?.size ?? 0}-${index}`

/**
 * @param {object} props
 * @param {string} [props.id] DOM id — `useForm` supplies `field-<name>`
 * @param {string} [props.name] field name
 * @param {React.ReactNode} props.label visible label
 * @param {File[]} [props.value=[]] currently selected files
 * @param {(files: File[]) => void} props.onChange receives the next `File[]`
 * @param {() => void} [props.onBlur] blur handler — `useForm` validates here
 * @param {string|boolean} [props.error] error message (or `true` for a bare error state)
 * @param {React.ReactNode} [props.helperText] guidance shown when there is no error
 * @param {boolean} [props.required=false] marks the field required
 * @param {string} [props.accept] comma-separated accept rules, e.g. `'image/*,video/mp4'`
 * @param {boolean} [props.multiple=false] allow several files
 * @param {number} [props.maxSizeMb] per-file size cap in MB
 * @param {number} [props.maxFiles] cap on the number of selected files
 * @param {boolean} [props.disabled=false] disable the zone and the Browse button
 */
export default function FormFileField({
  id,
  name,
  label,
  value = [],
  onChange,
  onBlur,
  error,
  helperText,
  required = false,
  accept,
  multiple = false,
  maxSizeMb,
  maxFiles,
  disabled = false,
  inputRef,
  sx,
  ...rest
}) {
  const fileInputRef = useRef(null)
  const [dragging, setDragging] = useState(false)
  const [rejections, setRejections] = useState([])

  const files = useMemo(() => (Array.isArray(value) ? value.filter(Boolean) : []), [value])
  const hasError = Boolean(error) || rejections.length > 0
  const message = typeof error === 'string' && error ? error : helperText

  // Object URLs are created per render pass and revoked when the selection
  // changes or the field unmounts, so previews never leak.
  const previews = useMemo(() => {
    const entries = new Map()
    files.forEach((file, index) => {
      if (isImage(file) && typeof URL !== 'undefined' && URL.createObjectURL) {
        try {
          entries.set(fileKey(file, index), URL.createObjectURL(file))
        } catch {
          // Not a real File (e.g. a test stub) — skip the preview, keep the chip.
        }
      }
    })
    return entries
  }, [files])

  useEffect(
    () => () => {
      previews.forEach((url) => URL.revokeObjectURL(url))
    },
    [previews]
  )

  const acceptFiles = useCallback(
    (incoming) => {
      const candidates = Array.from(incoming ?? []).filter(Boolean)
      if (candidates.length === 0) return

      const accepted = []
      const rejected = []

      candidates.forEach((file) => {
        if (!matchesAccept(file, accept)) {
          rejected.push(`${file.name ?? 'This file'} — file type is not accepted.`)
          return
        }
        if (maxSizeMb && Number(file.size) > maxSizeMb * 1024 * 1024) {
          rejected.push(
            `${file.name ?? 'This file'} — ${formatBytes(file.size)} is over the ${maxSizeMb} MB limit.`
          )
          return
        }
        accepted.push(file)
      })

      let next = multiple ? [...files, ...accepted] : accepted.slice(0, 1)
      if (multiple && maxFiles && next.length > maxFiles) {
        rejected.push(`Only ${maxFiles} files can be attached — the extras were skipped.`)
        next = next.slice(0, maxFiles)
      }

      setRejections(rejected)
      if (accepted.length > 0 || !multiple) onChange?.(next)
    },
    [accept, files, maxFiles, maxSizeMb, multiple, onChange]
  )

  const removeAt = (index) => {
    setRejections([])
    onChange?.(files.filter((_, position) => position !== index))
  }

  const handleDrop = (event) => {
    event.preventDefault()
    setDragging(false)
    if (disabled) return
    acceptFiles(event.dataTransfer?.files)
  }

  const hint = [
    accept ? `Accepts ${accept.replace(/,/g, ', ')}` : null,
    maxSizeMb ? `up to ${maxSizeMb} MB each` : null,
    multiple && maxFiles ? `max ${maxFiles} files` : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <Box sx={sx} {...rest}>
      {label ? (
        <FormLabel component="p" required={required} error={hasError} sx={{ mb: 1, display: 'block' }}>
          {label}
        </FormLabel>
      ) : null}

      <Box
        onDragOver={(event) => {
          event.preventDefault()
          if (!disabled) setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => !disabled && fileInputRef.current?.click()}
        sx={{
          display: 'grid',
          placeItems: 'center',
          gap: 1,
          textAlign: 'center',
          px: 2,
          py: 4,
          borderRadius: 2,
          border: '1px dashed',
          borderColor: hasError ? 'error.main' : dragging ? 'primary.main' : 'divider',
          bgcolor: (theme) =>
            dragging ? alpha(theme.palette.primary.main, 0.06) : 'background.default',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.6 : 1,
          transition: (theme) =>
            theme.transitions.create(['border-color', 'background-color'], { duration: 150 }),
        }}
      >
        <Box aria-hidden="true" sx={{ color: 'primary.main', display: 'flex' }}>
          <Icon icon="tabler:cloud-upload" width={28} />
        </Box>
        <Typography variant="body2" color="text.secondary">
          Drag {multiple ? 'files' : 'a file'} here, or
        </Typography>
        <Button
          variant="outlined"
          component="label"
          disabled={disabled}
          onClick={(event) => event.stopPropagation()}
          startIcon={<Icon icon="tabler:paperclip" width={18} />}
          // `useForm` focuses the first errored field by this ref: the Browse
          // button is the visible, focusable stand-in for the hidden input.
          ref={inputRef}
        >
          Browse files
          <input
            id={id}
            name={name}
            ref={fileInputRef}
            type="file"
            accept={accept}
            multiple={multiple}
            disabled={disabled}
            // Deliberately not `required`: a visually hidden required input
            // makes native form validation fail on an unfocusable control.
            // Requiredness is enforced by the field's validator instead.
            aria-label={typeof label === 'string' ? label : 'Choose files'}
            onBlur={onBlur}
            onChange={(event) => {
              acceptFiles(event.target.files)
              // Reset so re-picking the same file still fires a change event.
              event.target.value = ''
            }}
            style={{
              position: 'absolute',
              width: 1,
              height: 1,
              padding: 0,
              margin: -1,
              overflow: 'hidden',
              clip: 'rect(0 0 0 0)',
              whiteSpace: 'nowrap',
              border: 0,
            }}
          />
        </Button>
        {hint ? (
          <Typography variant="caption" color="text.secondary">
            {hint}
          </Typography>
        ) : null}
      </Box>

      {files.length > 0 ? (
        <Stack spacing={1.5} sx={{ mt: 2 }}>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {files.map((file, index) => (
              <Chip
                key={fileKey(file, index)}
                label={`${file.name ?? 'Untitled file'} · ${formatBytes(file.size)}${
                  file.type ? ` · ${file.type}` : ''
                }`}
                onDelete={disabled ? undefined : () => removeAt(index)}
                deleteIcon={<Icon icon="tabler:x" width={16} />}
                title={file.name}
                sx={{ maxWidth: '100%' }}
              />
            ))}
          </Stack>

          {previews.size > 0 ? (
            <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
              {files.map((file, index) => {
                const preview = previews.get(fileKey(file, index))
                return preview ? (
                  <Box
                    key={`${fileKey(file, index)}-preview`}
                    component="img"
                    src={preview}
                    alt={`Preview of ${file.name ?? 'the selected image'}`}
                    sx={{
                      width: 88,
                      height: 88,
                      objectFit: 'cover',
                      borderRadius: 1.5,
                      border: 1,
                      borderColor: 'divider',
                    }}
                  />
                ) : null
              })}
            </Stack>
          ) : null}
        </Stack>
      ) : null}

      {rejections.map((rejection) => (
        <FormHelperText key={rejection} error>
          {rejection}
        </FormHelperText>
      ))}

      {message ? (
        <FormHelperText error={Boolean(error)} sx={{ mx: 1.75 }}>
          {message}
        </FormHelperText>
      ) : null}
    </Box>
  )
}
