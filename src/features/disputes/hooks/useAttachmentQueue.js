import { useCallback, useMemo, useRef, useState } from 'react'

import { uploadService, UPLOAD_PURPOSE, UPLOAD_RULES } from '@/services/uploadService'

// The state behind "attach a few files" — used by the raise-dispute dialog (up
// to five pieces of evidence) and by the thread composer (up to three).
//
// It exists for the same reason `useDeliveryComposer` has its own queue: a set
// of uploads is a set of *independent* failures. One file that will not upload
// must not discard the other four, and it must never cost the member the
// paragraph they just wrote (§13). So each file carries its own state and its
// own error, and a failure leaves everything else exactly where it was with a
// Retry on the one that broke.
//
// Deliberately smaller than the delivery composer's hook: there is no note and
// no submit here. The hook uploads and reports; the dialog and the composer own
// their own text and call the service.

/** What one attachment can be doing. */
export const ATTACHMENT_STATE = Object.freeze({
  QUEUED: 'queued',
  UPLOADING: 'uploading',
  UPLOADED: 'uploaded',
  FAILED: 'failed',
})

const EVIDENCE_RULES = UPLOAD_RULES[UPLOAD_PURPOSE.DISPUTE_EVIDENCE]

/** What the picker accepts, and what the helper text says out loud. */
export const EVIDENCE_ACCEPT = EVIDENCE_RULES.accept.join(',')
export const EVIDENCE_MAX_SIZE_MB = EVIDENCE_RULES.maxSizeMb

/**
 * @param {object} options
 * @param {number} options.max how many files this surface accepts
 * @returns {object} the queue's state and the handlers a picker binds to
 */
export default function useAttachmentQueue({ max }) {
  const [entries, setEntries] = useState([])
  const [uploadingKey, setUploadingKey] = useState(null)
  const [overflowNotice, setOverflowNotice] = useState(null)

  // Keys are minted rather than derived from name and size, so removing a file
  // and picking the same one again is two entries, not one confused entry.
  const nextKey = useRef(0)

  const patchEntry = useCallback((key, patch) => {
    setEntries((current) =>
      current.map((entry) => (entry.key === key ? { ...entry, ...patch } : entry))
    )
  }, [])

  /** Uploads one attachment, recording the outcome on the entry itself. */
  const uploadEntry = useCallback(
    async (entry) => {
      setUploadingKey(entry.key)
      patchEntry(entry.key, { state: ATTACHMENT_STATE.UPLOADING, error: null })

      try {
        const { file } = await uploadService.upload(entry.file, {
          purpose: UPLOAD_PURPOSE.DISPUTE_EVIDENCE,
        })
        patchEntry(entry.key, { state: ATTACHMENT_STATE.UPLOADED, uploaded: file, error: null })
      } catch (failure) {
        patchEntry(entry.key, {
          state: ATTACHMENT_STATE.FAILED,
          error: failure?.details?.file ?? failure?.message ?? 'This file did not upload.',
        })
      } finally {
        setUploadingKey(null)
      }
    },
    [patchEntry]
  )

  /** Appends a picked set, capped at what this surface may carry, and uploads it. */
  const addFiles = useCallback(
    async (files) => {
      const incoming = Array.from(files ?? []).filter(Boolean)
      if (incoming.length === 0) return

      let added = []
      setEntries((current) => {
        const room = Math.max(max - current.length, 0)
        // Silently dropping the extras is how somebody ends up submitting two of
        // the four screenshots they meant to attach (§13).
        setOverflowNotice(
          incoming.length > room
            ? `Only ${max} files fit here — ${incoming.length - room} were not attached.`
            : null
        )
        added = incoming.slice(0, room).map((file) => {
          nextKey.current += 1
          return {
            key: `dev-draft-${nextKey.current}`,
            file,
            state: ATTACHMENT_STATE.QUEUED,
            uploaded: null,
            error: null,
          }
        })
        return [...current, ...added]
      })

      for (const entry of added) {
        // eslint-disable-next-line no-await-in-loop -- one at a time, so a
        // per-file error points at the file it belongs to.
        await uploadEntry(entry)
      }
    },
    [max, uploadEntry]
  )

  const removeFile = useCallback((key) => {
    setOverflowNotice(null)
    setEntries((current) => current.filter((entry) => entry.key !== key))
  }, [])

  const retryFile = useCallback(
    async (key) => {
      const entry = entries.find((candidate) => candidate.key === key)
      if (!entry || entry.state === ATTACHMENT_STATE.UPLOADING) return
      await uploadEntry(entry)
    },
    [entries, uploadEntry]
  )

  const reset = useCallback(() => {
    setEntries([])
    setUploadingKey(null)
    setOverflowNotice(null)
  }, [])

  const isUploading = uploadingKey !== null
  const hasFailure = entries.some((entry) => entry.state === ATTACHMENT_STATE.FAILED)

  /** The uploaded file records, ready to hand to a service (contract §5.1). */
  const files = useMemo(
    () => entries.map((entry) => entry.uploaded).filter(Boolean),
    [entries]
  )

  /**
   * One announcement covering the whole queue, for an `aria-live` region (§12):
   * a screen-reader user hears the uploads progress rather than having to hunt
   * the chips for a state that changed silently.
   */
  const status = useMemo(() => {
    if (entries.length === 0) return ''

    const uploading = entries.find((entry) => entry.state === ATTACHMENT_STATE.UPLOADING)
    if (uploading) {
      return `Uploading ${uploading.file?.name ?? 'file'} — ${
        entries.indexOf(uploading) + 1
      } of ${entries.length}.`
    }

    const failed = entries.filter((entry) => entry.state === ATTACHMENT_STATE.FAILED).length
    if (failed > 0) {
      return `${failed} of ${entries.length} files did not upload. Retry or remove them to continue.`
    }

    return `${files.length} ${files.length === 1 ? 'file' : 'files'} attached.`
  }, [entries, files.length])

  return {
    entries,
    files,
    addFiles,
    removeFile,
    retryFile,
    reset,
    overflowNotice,
    status,
    isUploading,
    hasFailure,
    isBlocked: isUploading || hasFailure,
    max,
    isFull: entries.length >= max,
  }
}
