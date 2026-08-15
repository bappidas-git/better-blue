import { Icon } from '@iconify/react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import Divider from '@mui/material/Divider'
import FormHelperText from '@mui/material/FormHelperText'
import IconButton from '@mui/material/IconButton'
import LinearProgress from '@mui/material/LinearProgress'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { alpha } from '@mui/material/styles'
import { visuallyHidden } from '@mui/utils'

import FormFileField from '@/components/inputs/FormFileField'
import FormTextField from '@/components/inputs/FormTextField'
import { FILE_STATE, DELIVERY_MESSAGE_MAX } from '@/features/deliveries/hooks/useDeliveryComposer'
import { formatFileSize } from '@/features/orders/utils/orderDisplay'
import { UPLOAD_RULES, UPLOAD_PURPOSE } from '@/services/uploadService'
import { formatNumber } from '@/utils/formatters'

// Where a creator hands work over.
//
// One note and one set of files, and everything else on the card is about
// making the state of those files obvious: what is queued, what is on the wire,
// what failed and can be retried without losing the rest (§13). The submit
// button stays disabled until the note is long enough and something is attached,
// because the failure a creator would hate most is a version that went to the
// buyer empty.
//
// The composer renders; `useDeliveryComposer` holds the queue and does the
// uploading; `deliveryService.submitDelivery` creates the version. Nothing here
// knows what an order status is.

const DELIVERY_RULES = UPLOAD_RULES[UPLOAD_PURPOSE.DELIVERY]
const ACCEPT = DELIVERY_RULES.accept.join(',')

const PLACEHOLDER =
  'Say what is attached and anything the buyer should know, e.g. “All three reels attached, cut to kitchen sound and captioned with the menu names. The plating reel is now 24 seconds.”'

/** Per-file chip: queued, on the wire, done, or broken. */
const STATE_CHIP = {
  [FILE_STATE.QUEUED]: { label: 'Ready to upload', color: 'default' },
  [FILE_STATE.UPLOADING]: { label: 'Uploading…', color: 'info' },
  [FILE_STATE.UPLOADED]: { label: 'Uploaded', color: 'success' },
  [FILE_STATE.FAILED]: { label: 'Failed', color: 'error' },
}

/** One attachment, with whatever it is currently doing written on it. */
function AttachmentTile({ entry, onRemove, onRetry, disabled }) {
  const name = entry.file?.name ?? 'Untitled file'
  const chip = STATE_CHIP[entry.state] ?? STATE_CHIP[FILE_STATE.QUEUED]
  const isUploading = entry.state === FILE_STATE.UPLOADING
  const isVideo = String(entry.file?.type ?? '').startsWith('video/')

  return (
    <Box
      component="li"
      sx={{
        listStyle: 'none',
        borderRadius: 2,
        border: 1,
        borderColor: entry.state === FILE_STATE.FAILED ? 'error.main' : 'divider',
        bgcolor: 'background.paper',
        p: 1.5,
        minWidth: 0,
      }}
    >
      <Stack direction="row" spacing={1} alignItems="flex-start">
        <Box aria-hidden="true" sx={{ display: 'flex', color: 'text.secondary', pt: '2px' }}>
          <Icon icon={isVideo ? 'solar:videocamera-linear' : 'solar:gallery-linear'} width={20} />
        </Box>

        <Box sx={{ minWidth: 0, flexGrow: 1 }}>
          <Typography
            variant="body2"
            sx={{ fontWeight: 600, overflowWrap: 'anywhere' }}
            title={name}
          >
            {name}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {isVideo ? 'Video' : 'Image'} · {formatFileSize((entry.file?.size ?? 0) / 1024)}
          </Typography>
        </Box>

        <IconButton
          size="small"
          onClick={() => onRemove(entry.key)}
          disabled={disabled || isUploading}
          aria-label={`Remove ${name} from this delivery`}
          sx={{ width: 40, height: 40 }}
        >
          <Icon icon="tabler:x" width={18} />
        </IconButton>
      </Stack>

      <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }} flexWrap="wrap" useFlexGap>
        <Chip size="small" label={chip.label} color={chip.color} variant="outlined" />
        {entry.state === FILE_STATE.FAILED ? (
          <Button size="small" onClick={() => onRetry(entry.key)} disabled={disabled}>
            Retry
          </Button>
        ) : null}
      </Stack>

      {isUploading ? (
        <LinearProgress sx={{ mt: 1, borderRadius: 1 }} aria-hidden="true" />
      ) : null}

      {entry.error ? (
        <Typography variant="caption" color="error.main" sx={{ display: 'block', mt: 0.75 }}>
          {entry.error}
        </Typography>
      ) : null}
    </Box>
  )
}

/**
 * @param {object} props
 * @param {ReturnType<typeof import('@/features/deliveries/hooks/useDeliveryComposer').default>} props.composer
 * @param {boolean} [props.isAnsweringRevision] this version answers a change request
 * @param {number} [props.nextVersion] the version number this will become
 * @param {() => void} props.onSubmit opens the page's confirmation dialog
 */
export default function DeliveryComposer({
  composer,
  isAnsweringRevision = false,
  nextVersion,
  onSubmit,
}) {
  const {
    message,
    setMessage,
    touchMessage,
    messageError,
    files,
    addFiles,
    removeFile,
    retryFile,
    overflowNotice,
    uploadStatus,
    isBusy,
    canSubmit,
    maxFiles,
  } = composer

  const atLimit = files.length >= maxFiles

  return (
    <Card>
      <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
        <Stack
          direction="row"
          spacing={1.5}
          alignItems="center"
          justifyContent="space-between"
          sx={{ mb: 0.75 }}
        >
          <Typography variant="subtitle1" component="h2" sx={{ fontWeight: 700 }}>
            {isAnsweringRevision ? 'Submit the revised version' : 'Submit your delivery'}
          </Typography>
          {nextVersion ? (
            <Chip size="small" label={`Version ${formatNumber(nextVersion)}`} variant="outlined" />
          ) : null}
        </Stack>

        <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
          {isAnsweringRevision
            ? 'This goes back to the buyer as a new version, attached to the changes they asked for. The earlier version stays on the order.'
            : 'The buyer reviews what you send here. Your payment is already in escrow and is released when they accept it.'}
        </Typography>

        <Stack spacing={2.5}>
          <FormTextField
            label="Message to the buyer"
            required
            multiline
            minRows={4}
            maxRows={10}
            maxLength={DELIVERY_MESSAGE_MAX}
            placeholder={PLACEHOLDER}
            helperText="Name what is attached and flag anything that differs from the brief. It is the first thing they read."
            value={message}
            onChange={setMessage}
            onBlur={touchMessage}
            error={messageError ?? undefined}
            disabled={isBusy}
          />

          <Box>
            <FormFileField
              label="Files"
              required
              multiple
              accept={ACCEPT}
              maxSizeMb={DELIVERY_RULES.maxSizeMb}
              maxFiles={maxFiles}
              value={[]}
              onChange={addFiles}
              disabled={isBusy || atLimit}
              helperText={
                atLimit
                  ? `You have attached the maximum of ${maxFiles} files for one version.`
                  : `Photos and video, up to ${DELIVERY_RULES.maxSizeMb} MB each. ${formatNumber(
                      files.length
                    )} of ${formatNumber(maxFiles)} attached.`
              }
            />

            {overflowNotice ? (
              <FormHelperText error sx={{ mx: 1.75 }}>
                {overflowNotice}
              </FormHelperText>
            ) : null}
          </Box>

          {/* The upload queue is announced rather than only drawn: the tiles
              change state on their own, which is invisible to a screen reader
              without this (§12). */}
          <Box role="status" aria-live="polite">
            <Box sx={visuallyHidden}>{uploadStatus}</Box>

            {files.length > 0 ? (
              <Box
                component="ul"
                aria-label="Files attached to this delivery"
                sx={{
                  listStyle: 'none',
                  m: 0,
                  p: 0,
                  display: 'grid',
                  gap: 1.5,
                  gridTemplateColumns: {
                    xs: 'repeat(2, minmax(0, 1fr))',
                    md: 'repeat(3, minmax(0, 1fr))',
                  },
                }}
              >
                {files.map((entry) => (
                  <AttachmentTile
                    key={entry.key}
                    entry={entry}
                    onRemove={removeFile}
                    onRetry={retryFile}
                    disabled={composer.isSubmitting}
                  />
                ))}
              </Box>
            ) : null}
          </Box>
        </Stack>

        <Divider sx={{ my: 2.5 }} />

        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1.5}
          alignItems={{ xs: 'stretch', sm: 'center' }}
          justifyContent="space-between"
        >
          <Typography variant="caption" color="text.secondary" sx={{ minWidth: 0 }}>
            {uploadStatus || 'Nothing attached yet.'}
          </Typography>

          {/* Desktop only: below `md` the same action lives in the page's sticky
              bar, so a thumb never has to scroll to find it and the two are
              never on screen at once (§11). */}
          <Button
            onClick={onSubmit}
            variant="gradient"
            disabled={!canSubmit}
            startIcon={<Icon icon="solar:box-linear" width={18} aria-hidden="true" />}
            sx={{ display: { xs: 'none', md: 'inline-flex' }, whiteSpace: 'nowrap' }}
          >
            {isBusy ? 'Sending…' : 'Submit delivery'}
          </Button>
        </Stack>

        {files.length === 0 ? (
          <Alert
            severity="info"
            variant="outlined"
            icon={<Icon icon="solar:info-circle-linear" width={20} />}
            sx={{
              mt: 2,
              borderColor: (theme) => alpha(theme.palette.info.main, 0.3),
            }}
          >
            Attach at least one file before submitting. Everything you send is checked against the
            BetterBlue Content Policy.
          </Alert>
        ) : null}
      </CardContent>
    </Card>
  )
}
