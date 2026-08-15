import { useState } from 'react'

import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import FormHelperText from '@mui/material/FormHelperText'
import Link from '@mui/material/Link'
import LinearProgress from '@mui/material/LinearProgress'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { alpha } from '@mui/material/styles'

import FormFileField from '@/components/inputs/FormFileField'
import FormSelect from '@/components/inputs/FormSelect'
import FormTextField from '@/components/inputs/FormTextField'
import ResponsiveDialog from '@/components/layout/ResponsiveDialog'
import { CONTENT_STATUS, CONTENT_TYPE, STATUS_META } from '@/constants/statuses'
import ListEntryInput from '@/features/requests/components/wizard/ListEntryInput'
import useForm from '@/hooks/useForm'
import { paths } from '@/routes/paths'
import {
  MEDIA_TYPE,
  UPLOAD_PURPOSE,
  UPLOAD_RULES,
  uploadService,
} from '@/services/uploadService'
import { compose, maxLength, minLength, required } from '@/utils/validators'

// Adding and editing one piece of sample work.
//
// The media comes first — on a phone especially, a creator is here because of a
// file, and the fields describe it afterwards. It is uploaded the moment it is
// chosen rather than on save, which is what makes the preview real, gives the
// mock latency somewhere honest to live, and means pressing "submit for review"
// does one thing instead of two.
//
// The dialog owns the form and the upload. It owns no lifecycle: which service
// calls a save turns into is `CreatorPortfolioPage`'s decision, because that is
// where the edit-republish policy and its confirmation live.

const RULES = UPLOAD_RULES[UPLOAD_PURPOSE.PORTFOLIO]
const ACCEPT = RULES.accept.join(',')

const TITLE_MIN = 8
const TITLE_MAX = 80
const DESCRIPTION_MIN = 30
const DESCRIPTION_MAX = 600
const BRAND_CREDIT_MAX = 80
const MAX_TAGS = 6

const validators = {
  title: compose(
    required('Give this piece a title.'),
    minLength(TITLE_MIN, `Use at least ${TITLE_MIN} characters — say what the work is.`),
    maxLength(TITLE_MAX)
  ),
  description: compose(
    required('Describe what you shot and who it was for.'),
    minLength(
      DESCRIPTION_MIN,
      `Write at least ${DESCRIPTION_MIN} characters — buyers read this before they hire.`
    ),
    maxLength(DESCRIPTION_MAX)
  ),
  categoryId: required('Pick the category this belongs to.'),
  contentType: required('Say whether this is a photo, a film, or both.'),
  brandCredit: maxLength(BRAND_CREDIT_MAX),
}

const CONTENT_TYPE_OPTIONS = Object.values(CONTENT_TYPE).map((value) => ({
  value,
  label: STATUS_META[value]?.label ?? value,
}))

/** What an uploaded file suggests the content type is. Editable afterwards. */
const contentTypeFor = (mediaType) =>
  mediaType === MEDIA_TYPE.VIDEO ? CONTENT_TYPE.VIDEO : CONTENT_TYPE.PHOTO

/** `uploadService` records a size in KB; a 24 MB film should not read "24576". */
function formatSize(sizeKb) {
  if (!sizeKb) return null
  return sizeKb >= 1024 ? `${(sizeKb / 1024).toFixed(1)} MB` : `${Math.round(sizeKb)} KB`
}

/** The item's stored media, in the shape `uploadService` returns. */
function toMedia(item) {
  if (!item?.mediaUrl) return null
  return {
    url: item.mediaUrl,
    thumbnailUrl: item.thumbnailUrl ?? item.mediaUrl,
    mediaType: item.mediaType ?? MEDIA_TYPE.IMAGE,
    name: item.title,
  }
}

function toFormValues(item) {
  return {
    title: item?.title ?? '',
    description: item?.description ?? '',
    categoryId: item?.categoryId ?? '',
    contentType: item?.contentType ?? '',
    tags: item?.tags ?? [],
    brandCredit: item?.brandCredit ?? '',
  }
}

/**
 * @param {object} props
 * @param {boolean} props.open
 * @param {object} [props.item] the item being edited — omit to add a new one
 * @param {object[]} [props.categories] active categories for the picker
 * @param {boolean} [props.categoriesLoading=false]
 * @param {boolean} [props.isSaving=false] a save is in flight (owned by the page)
 * @param {() => void} props.onClose
 * @param {(payload: object, options: {submitForReview: boolean}) => Promise<void>} props.onSave
 *   the page persists it, decides what the save means, and closes the dialog
 */
export default function PortfolioItemDialog({
  open,
  item,
  categories = [],
  categoriesLoading = false,
  isSaving = false,
  onClose,
  onSave,
}) {
  const form = useForm({ initialValues: toFormValues(item), validators })

  const [media, setMedia] = useState(() => toMedia(item))
  const [uploading, setUploading] = useState(false)
  const [mediaError, setMediaError] = useState(undefined)

  const isEdit = Boolean(item)
  const isPublished = item?.status === CONTENT_STATUS.PUBLISHED
  const busy = isSaving || uploading

  const categoryOptions = categories.map((category) => ({
    value: category.id,
    label: category.name,
  }))

  const upload = async (files) => {
    const file = files?.[0]
    if (!file) return

    setMediaError(undefined)
    setUploading(true)
    try {
      const { file: uploaded } = await uploadService.upload(file, {
        purpose: UPLOAD_PURPOSE.PORTFOLIO,
      })
      setMedia(uploaded)
      // The file knows what it is; the creator can still overrule it below
      // (a photo set delivered as a bundle, say).
      if (!form.values.contentType) {
        form.setValue('contentType', contentTypeFor(uploaded.mediaType))
      }
    } catch (failure) {
      // `uploadService` reports type and size failures as `details.file`.
      setMediaError(failure?.details?.file ?? failure?.message ?? 'That file could not be uploaded.')
    } finally {
      setUploading(false)
    }
  }

  const save = (submitForReview) =>
    form.handleSubmit(async (values) => {
      if (!media) {
        setMediaError('Add a photo or a film before saving.')
        return
      }

      await onSave?.(
        {
          title: values.title.trim(),
          description: values.description.trim(),
          categoryId: values.categoryId,
          contentType: values.contentType,
          tags: values.tags,
          brandCredit: values.brandCredit.trim(),
          mediaUrl: media.url,
          thumbnailUrl: media.thumbnailUrl,
          mediaType: media.mediaType,
        },
        { submitForReview }
      )
    })

  // Three buttons do not fit across 360px — the labels wrap to three and four
  // lines — so on a phone they stack full-width with the primary nearest the
  // thumb, and only line up in a row once there is width for them (§11).
  const actions = (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      spacing={1}
      justifyContent="flex-end"
      sx={{ width: '100%', '& .MuiButton-root': { width: { xs: '100%', sm: 'auto' } } }}
    >
      <Button color="inherit" onClick={onClose} disabled={busy}>
        Cancel
      </Button>

      {/* A published item has one way out of this dialog: editing live work is
          a re-submission (the edit-republish policy), so there is no "save it
          quietly" button to press by mistake. */}
      {isPublished ? null : (
        <Button variant="outlined" onClick={save(false)} disabled={busy}>
          {isEdit ? 'Save changes' : 'Save draft'}
        </Button>
      )}

      <Button variant="gradient" onClick={save(true)} disabled={busy}>
        {isSaving ? 'Saving…' : isPublished ? 'Save & resubmit' : 'Save & submit for review'}
      </Button>
    </Stack>
  )

  return (
    <ResponsiveDialog
      open={open}
      onClose={busy ? undefined : onClose}
      maxWidth="md"
      title={isEdit ? 'Edit sample work' : 'Add sample work'}
      description={
        isPublished
          ? 'This piece is live. Saving takes it off your public profile and sends it back for review.'
          : 'Show buyers a piece of commercial work — what it was, who it was for, and how it was delivered.'
      }
      actions={actions}
    >
      {/* Enter inside a field submits the *safe* action: a draft save for
          anything unpublished, and the only action there is for a published
          item, which is a re-submission. */}
      <Stack component="form" spacing={3} noValidate onSubmit={save(isPublished)}>
        {/* ---- media ------------------------------------------------------ */}
        <Box>
          {media ? (
            <Stack spacing={1.5}>
              <Box
                sx={{
                  position: 'relative',
                  width: '100%',
                  aspectRatio: '16 / 9',
                  borderRadius: 2,
                  overflow: 'hidden',
                  border: 1,
                  borderColor: 'divider',
                  bgcolor: 'primary.surface',
                }}
              >
                {/* MOCK-UPLOAD: a "video" upload resolves to a placeholder
                    still, not a playable file (contract §5.2) — a `<video>`
                    here would render an empty player. So film is previewed as
                    its poster frame with a play badge, exactly as the public
                    gallery does it, and the real player arrives with real
                    storage. */}
                <Box
                  component="img"
                  src={media.thumbnailUrl || media.url}
                  alt={`Preview of ${media.name ?? 'the selected file'}`}
                  sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
                {media.mediaType === MEDIA_TYPE.VIDEO ? (
                  <Box
                    aria-hidden="true"
                    sx={{
                      position: 'absolute',
                      inset: 0,
                      display: 'grid',
                      placeItems: 'center',
                      color: 'common.white',
                      bgcolor: (theme) => alpha(theme.palette.common.black, 0.28),
                    }}
                  >
                    <Icon icon="tabler:player-play-filled" width={44} />
                  </Box>
                ) : null}
              </Box>

              <Stack
                direction="row"
                spacing={1}
                alignItems="center"
                justifyContent="space-between"
                flexWrap="wrap"
                useFlexGap
              >
                <Typography variant="caption" color="text.secondary" sx={{ minWidth: 0 }}>
                  {[
                    media.name,
                    STATUS_META[media.mediaType === MEDIA_TYPE.VIDEO ? CONTENT_TYPE.VIDEO : CONTENT_TYPE.PHOTO]?.label,
                    formatSize(media.sizeKb),
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </Typography>
                <Button
                  size="small"
                  variant="outlined"
                  disabled={busy}
                  onClick={() => {
                    setMedia(null)
                    setMediaError(undefined)
                  }}
                  startIcon={<Icon icon="tabler:refresh" width={16} aria-hidden="true" />}
                >
                  Replace file
                </Button>
              </Stack>
            </Stack>
          ) : (
            <FormFileField
              id="field-portfolioMedia"
              name="portfolioMedia"
              label="Photo or film"
              required
              value={[]}
              onChange={upload}
              accept={ACCEPT}
              maxSizeMb={RULES.maxSizeMb}
              disabled={busy}
              error={mediaError}
              helperText="One piece per item. JPG, PNG, WebP, or MP4."
            />
          )}

          {uploading ? (
            <Box sx={{ mt: 1.5 }}>
              <LinearProgress aria-label="Uploading your file" sx={{ borderRadius: 999 }} />
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                Uploading…
              </Typography>
            </Box>
          ) : null}

          {media && mediaError ? (
            <FormHelperText error sx={{ mx: 1.75 }}>
              {mediaError}
            </FormHelperText>
          ) : null}
        </Box>

        {/* ---- details ----------------------------------------------------- */}
        <FormTextField
          label="Title"
          required
          maxLength={TITLE_MAX}
          disabled={busy}
          placeholder="Seasonal menu photography for a farm-to-table dinner service"
          helperText="Name the work the way a buyer would search for it."
          {...form.fieldProps('title')}
        />

        <FormTextField
          label="Description"
          required
          multiline
          minRows={4}
          maxLength={DESCRIPTION_MAX}
          disabled={busy}
          placeholder="What the brief was, what you delivered, and how it was used — formats, quantity, and where it ran."
          helperText={`Between ${DESCRIPTION_MIN} and ${DESCRIPTION_MAX} characters. Keep it factual: the brief, the deliverables, the outcome.`}
          {...form.fieldProps('description')}
        />

        <FormSelect
          label="Category"
          required
          disabled={busy || categoriesLoading}
          options={categoryOptions}
          placeholder={categoriesLoading ? 'Loading categories…' : 'Choose a category'}
          helperText="Buyers filter on this, and it decides where the piece surfaces."
          {...form.fieldProps('categoryId')}
        />

        <FormSelect
          label="Content type"
          required
          disabled={busy}
          options={CONTENT_TYPE_OPTIONS}
          helperText="Set from your file — change it if this piece is a bundle."
          {...form.fieldProps('contentType')}
        />

        <ListEntryInput
          label="Tags"
          placeholder="restaurant, menu, food styling"
          maxEntries={MAX_TAGS}
          disabled={busy}
          helperText={`Up to ${MAX_TAGS} short tags. They help buyers find work like this.`}
          {...form.fieldProps('tags')}
        />

        <FormTextField
          label="Created for (optional)"
          maxLength={BRAND_CREDIT_MAX}
          disabled={busy}
          placeholder="A local juice bar campaign"
          helperText="Credit the brand or the kind of business. Leave it out if the work is under NDA."
          {...form.fieldProps('brandCredit')}
        />

        {/* Sits last so it is the line above the footer on every width (§4.4). */}
        <Box
          sx={{
            display: 'flex',
            gap: 1.5,
            p: 1.5,
            borderRadius: 2,
            border: 1,
            borderStyle: 'dashed',
            borderColor: 'divider',
            bgcolor: 'background.default',
          }}
        >
          <Box aria-hidden="true" sx={{ display: 'flex', color: 'text.secondary', mt: 0.125 }}>
            <Icon icon="solar:shield-check-linear" width={18} />
          </Box>
          <Typography variant="body2" color="text.secondary">
            Everything you submit is reviewed against the{' '}
            <Link href={paths.CONTENT_POLICY} target="_blank" rel="noopener noreferrer">
              Content Policy
            </Link>
            . Publish only work you have the rights to show.
          </Typography>
        </Box>
      </Stack>
    </ResponsiveDialog>
  )
}
