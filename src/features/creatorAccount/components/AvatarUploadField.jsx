import { useState } from 'react'

import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'

import FormFileField from '@/components/inputs/FormFileField'
import { avatarDataUri } from '@/constants/images'
import { UPLOAD_PURPOSE, UPLOAD_RULES, uploadService } from '@/services/uploadService'

// The creator's profile photo: a preview of what is on file, a picker that
// uploads the moment a file is chosen, and a way back to the generated initials
// mark.
//
// The buyer's twin is `buyerAccount/LogoUploadField` — same mechanics, different
// subject (a person, not a company mark), which is why it is a round preview
// with its own copy rather than a shared component with a `variant` prop.
//
// The field's value is the **avatar URL**, not a `File`. `FormFileField` emits
// `File[]`; this component hands that to `uploadService` and reports the
// resulting URL upward, so the form only ever holds a saveable value and there
// is no half-uploaded state to submit (00 §10 — uploading is the service's job).
//
// MOCK-UPLOAD: no bytes leave the browser and nothing is persisted, so the
// preview is a seeded stand-in image rather than the file that was picked
// (contract §5.2). The real backend returns a URL to the stored file and
// nothing here changes.

const RULES = UPLOAD_RULES[UPLOAD_PURPOSE.PROFILE_IMAGE]
const ACCEPT = RULES.accept.join(',')

/**
 * @param {object} props
 * @param {string} [props.value] the avatar URL currently on the form
 * @param {(url: string) => void} props.onChange receives the new avatar URL
 * @param {string} [props.displayName] name the initials fallback is generated from
 * @param {string} [props.error] validation message from the form
 * @param {(message?: string) => void} [props.onError] reports an upload failure
 *   back to the form so it can show it inline
 * @param {boolean} [props.disabled=false] disable while the form is saving
 */
export default function AvatarUploadField({
  value,
  onChange,
  displayName,
  error,
  onError,
  disabled = false,
}) {
  const [isUploading, setUploading] = useState(false)

  const initialsAvatar = avatarDataUri(displayName || 'BetterBlue')
  const isGenerated = !value || value === initialsAvatar
  const preview = value || initialsAvatar

  const handleFiles = async (files) => {
    const [file] = files ?? []
    if (!file) return

    setUploading(true)
    onError?.(undefined)
    try {
      const { file: uploaded } = await uploadService.upload(file, {
        purpose: UPLOAD_PURPOSE.PROFILE_IMAGE,
      })
      onChange?.(uploaded.url)
    } catch (failure) {
      // `details.file` carries the specific reason (type or size); the message
      // is the fallback for anything else that went wrong.
      onError?.(failure?.details?.file ?? failure?.message ?? 'That file could not be uploaded.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2.5} alignItems="flex-start">
        <Box sx={{ position: 'relative', flexShrink: 0 }}>
          <Box
            component="img"
            src={preview}
            alt={
              isGenerated
                ? `Generated initials avatar for ${displayName || 'your profile'}`
                : `Current profile photo for ${displayName || 'your profile'}`
            }
            sx={{
              width: 96,
              height: 96,
              borderRadius: '50%',
              objectFit: 'cover',
              border: 1,
              borderColor: 'divider',
              bgcolor: 'background.default',
              opacity: isUploading ? 0.4 : 1,
            }}
          />
          {isUploading ? (
            <Box sx={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
              <CircularProgress size={24} aria-label="Uploading your photo" />
            </Box>
          ) : null}
        </Box>

        <Stack spacing={1} sx={{ minWidth: 0, flexGrow: 1 }}>
          <Typography variant="body2" color="text.secondary">
            A clear head-and-shoulders photo works best — it appears on your storefront, on every
            proposal you send, and in each conversation with a buyer. Without one, we use your
            initials.
          </Typography>
          <Box>
            <Button
              variant="text"
              color="inherit"
              size="small"
              disabled={disabled || isUploading || isGenerated}
              onClick={() => onChange?.(initialsAvatar)}
              startIcon={<Icon icon="tabler:trash" width={18} />}
            >
              Remove photo
            </Button>
          </Box>
        </Stack>
      </Stack>

      <FormFileField
        id="field-avatarUrl"
        name="avatarFile"
        label="Upload a new photo"
        value={[]}
        onChange={handleFiles}
        accept={ACCEPT}
        maxSizeMb={RULES.maxSizeMb}
        disabled={disabled || isUploading}
        error={error}
        helperText="JPG, PNG, or WebP."
      />
    </Stack>
  )
}
