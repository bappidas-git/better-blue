import { useCallback, useMemo, useRef, useState } from 'react'

import {
  DELIVERY_MESSAGE_MAX,
  DELIVERY_MESSAGE_MIN,
} from '@/services/deliveryService'
import { MAX_FILES_PER_UPLOAD, uploadService, UPLOAD_PURPOSE } from '@/services/uploadService'

// The state behind the delivery composer: a note, a set of files, and where
// each one of those files has got to.
//
// The hook exists because "attach files and submit" is two failures pretending
// to be one. An upload that fails must not take the other seven with it, and it
// must not cost the creator the note they wrote — so the files are uploaded
// **one at a time, before** the delivery is created, each carrying its own
// status, and a failure leaves everything else exactly where it was with a
// Retry on the one that broke (§13).
//
// `useForm` is not used here for the same reason: this is not a form with a
// value per field, it is a queue with a lifecycle, and the submit button is
// gated on the state of that queue rather than on a validator.
//
// The hook uploads; it does not deliver. Creating the version is
// `deliveryService.submitDelivery`, handed in as `onSubmit` — no business logic
// in a hook that renders a card (00 §16.9).

/** What one attachment can be doing. */
export const FILE_STATE = Object.freeze({
  QUEUED: 'queued',
  UPLOADING: 'uploading',
  UPLOADED: 'uploaded',
  FAILED: 'failed',
})

/** The note's rules, mirrored from the service so the field can say them first. */
export { DELIVERY_MESSAGE_MAX, DELIVERY_MESSAGE_MIN }

/** Validates the note the way the service will, so nothing reaches it to be refused. */
function validateMessage(value) {
  const text = String(value ?? '').trim()
  if (text.length === 0) return 'Tell the buyer what you are handing over.'
  if (text.length < DELIVERY_MESSAGE_MIN) {
    return `Use at least ${DELIVERY_MESSAGE_MIN} characters — enough to say what is in the delivery.`
  }
  if (text.length > DELIVERY_MESSAGE_MAX) {
    return `Keep this under ${DELIVERY_MESSAGE_MAX} characters.`
  }
  return null
}

/**
 * @param {object} options
 * @param {(payload: {message: string, files: object[]}) => Promise<*>} options.onSubmit
 *   creates the version — rejects to keep the composer's contents intact
 * @returns {object} the composer's state and the handlers a card binds to
 */
export default function useDeliveryComposer({ onSubmit } = {}) {
  const [message, setMessageValue] = useState('')
  const [messageTouched, setMessageTouched] = useState(false)
  const [entries, setEntries] = useState([])
  const [isSubmitting, setSubmitting] = useState(false)
  const [uploadingKey, setUploadingKey] = useState(null)
  const [overflowNotice, setOverflowNotice] = useState(null)

  // Keys have to survive removals and re-adds of the same file, so they are
  // minted rather than derived from name and size.
  const nextKey = useRef(0)

  const patchEntry = useCallback((key, patch) => {
    setEntries((current) =>
      current.map((entry) => (entry.key === key ? { ...entry, ...patch } : entry))
    )
  }, [])

  const setMessage = useCallback((value) => {
    setMessageValue(value)
  }, [])

  const touchMessage = useCallback(() => setMessageTouched(true), [])

  /** Appends a picked set, capped at what one delivery may carry. */
  const addFiles = useCallback((files) => {
    const incoming = Array.from(files ?? []).filter(Boolean)
    if (incoming.length === 0) return

    setEntries((current) => {
      const room = Math.max(MAX_FILES_PER_UPLOAD - current.length, 0)
      // Silently dropping the extras is how someone ends up delivering nine of
      // the twelve files they meant to (§13).
      setOverflowNotice(
        incoming.length > room
          ? `Only ${MAX_FILES_PER_UPLOAD} files fit in one version — ${
              incoming.length - room
            } were not attached. Send the rest as the next version, or ask the buyer for a second order.`
          : null
      )
      const added = incoming.slice(0, room).map((file) => {
        nextKey.current += 1
        return {
          key: `dfl-draft-${nextKey.current}`,
          file,
          state: FILE_STATE.QUEUED,
          uploaded: null,
          error: null,
        }
      })
      return [...current, ...added]
    })
  }, [])

  const removeFile = useCallback((key) => {
    setOverflowNotice(null)
    setEntries((current) => current.filter((entry) => entry.key !== key))
  }, [])

  /** Uploads one attachment, recording the outcome on the entry itself. */
  const uploadEntry = useCallback(
    async (entry) => {
      setUploadingKey(entry.key)
      patchEntry(entry.key, { state: FILE_STATE.UPLOADING, error: null })

      try {
        const { file } = await uploadService.upload(entry.file, {
          purpose: UPLOAD_PURPOSE.DELIVERY,
        })
        patchEntry(entry.key, { state: FILE_STATE.UPLOADED, uploaded: file, error: null })
        return file
      } catch (failure) {
        patchEntry(entry.key, {
          state: FILE_STATE.FAILED,
          error: failure?.details?.file ?? failure?.message ?? 'This file did not upload.',
        })
        return null
      } finally {
        setUploadingKey(null)
      }
    },
    [patchEntry]
  )

  /** Re-uploads one file that failed, leaving the rest of the queue alone. */
  const retryFile = useCallback(
    async (key) => {
      const entry = entries.find((candidate) => candidate.key === key)
      if (!entry || entry.state === FILE_STATE.UPLOADING) return
      await uploadEntry(entry)
    },
    [entries, uploadEntry]
  )

  const reset = useCallback(() => {
    setMessageValue('')
    setMessageTouched(false)
    setEntries([])
    setUploadingKey(null)
    setOverflowNotice(null)
  }, [])

  const messageError = useMemo(() => validateMessage(message), [message])
  const isUploading = uploadingKey !== null
  const isBusy = isUploading || isSubmitting

  const canSubmit = !isBusy && !messageError && entries.length > 0

  /**
   * One announcement covering the whole queue, for the composer's `aria-live`
   * region (§12): a screen-reader user hears the uploads progress rather than
   * having to hunt the tiles for a state that changed silently.
   */
  const uploadStatus = useMemo(() => {
    if (entries.length === 0) return ''

    const uploading = entries.find((entry) => entry.state === FILE_STATE.UPLOADING)
    if (uploading) {
      const position = entries.indexOf(uploading) + 1
      return `Uploading ${uploading.file?.name ?? 'file'} — ${position} of ${entries.length}.`
    }

    const failed = entries.filter((entry) => entry.state === FILE_STATE.FAILED).length
    if (failed > 0) {
      return `${failed} of ${entries.length} files did not upload. Retry or remove them to continue.`
    }

    const uploaded = entries.filter((entry) => entry.state === FILE_STATE.UPLOADED).length
    if (uploaded === entries.length) {
      return `${uploaded} ${uploaded === 1 ? 'file' : 'files'} uploaded and ready to send.`
    }

    return `${entries.length} ${entries.length === 1 ? 'file' : 'files'} attached.`
  }, [entries])

  /**
   * Uploads whatever has not been uploaded yet, then creates the version.
   *
   * Sequential rather than parallel: a creator watching eight files go up wants
   * to know which one is on the wire, and the mock's simulated latency is the
   * only thing standing in for a real progress event (00 §15).
   *
   * @returns {Promise<*|null>} whatever `onSubmit` resolved to, or `null` when
   *   the composer stopped short of submitting
   */
  const submit = useCallback(async () => {
    setMessageTouched(true)
    if (validateMessage(message) || entries.length === 0 || isBusy) return null

    const uploaded = []
    for (const entry of entries) {
      if (entry.uploaded) {
        uploaded.push(entry.uploaded)
        continue
      }
      // eslint-disable-next-line no-await-in-loop -- deliberate: one file at a
      // time is what makes per-file progress and per-file retry meaningful.
      const file = await uploadEntry(entry)
      if (!file) return null
      uploaded.push(file)
    }

    setSubmitting(true)
    try {
      const result = await onSubmit?.({ message: message.trim(), files: uploaded })
      reset()
      return result
    } finally {
      setSubmitting(false)
    }
  }, [entries, isBusy, message, onSubmit, reset, uploadEntry])

  return {
    message,
    setMessage,
    touchMessage,
    messageError: messageTouched ? messageError : null,
    files: entries,
    addFiles,
    removeFile,
    retryFile,
    overflowNotice,
    uploadStatus,
    isUploading,
    isSubmitting,
    isBusy,
    canSubmit,
    maxFiles: MAX_FILES_PER_UPLOAD,
    submit,
    reset,
  }
}
