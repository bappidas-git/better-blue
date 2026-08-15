// File uploads — `docs/api-contract.md` §5.
//
// MOCK-UPLOAD: there is no upload endpoint. This simulates `POST /uploads`
// entirely client-side: real metadata is read from the real `File` (name, size,
// type) and only the bytes are fictional. No bytes leave the browser and
// nothing is persisted, so a reload loses the "file" while the record still
// references its URL — an accepted prototype limitation.
//
// Laravel: store on S3 or a local disk, generate a thumbnail for images and a
// poster frame for video, and return the same `{ file }` shape. Then replace
// the body of `upload` with a real multipart `POST /uploads` — nothing that
// calls it changes. Validate the MIME type server-side by sniffing content,
// never by trusting the client's `type` (contract §5.2).

import { IMAGE_SIZES, imageUrl } from '@/constants/images'
import { generateId, ID_PREFIX } from '@/utils/id'

import { API_ERROR_CODE, createApiError } from './api/apiError'

/** What an upload is for — drives the id prefix and the limits (contract §5.1). */
export const UPLOAD_PURPOSE = Object.freeze({
  PORTFOLIO: 'portfolio',
  DELIVERY: 'delivery',
  DISPUTE_EVIDENCE: 'dispute_evidence',
  /** A company logo or an account avatar — small, square-ish, images only. */
  PROFILE_IMAGE: 'profile_image',
  /** Reference imagery a buyer attaches to a content request (Prompt 16). */
  REQUEST_REFERENCE: 'request_reference',
})

/** `mediaType` values the contract defines for a file object. */
export const MEDIA_TYPE = Object.freeze({ IMAGE: 'image', VIDEO: 'video' })

/**
 * Per-purpose rules. These are the same limits the server must enforce — the
 * client copy exists so a member is told before waiting for an upload, not
 * instead of the server checking (§9.5).
 */
export const UPLOAD_RULES = Object.freeze({
  [UPLOAD_PURPOSE.PORTFOLIO]: Object.freeze({
    idPrefix: ID_PREFIX.PORTFOLIO_ITEM,
    maxSizeMb: 25,
    accept: Object.freeze(['image/jpeg', 'image/png', 'image/webp', 'video/mp4']),
  }),
  [UPLOAD_PURPOSE.DELIVERY]: Object.freeze({
    idPrefix: ID_PREFIX.DELIVERY_FILE,
    maxSizeMb: 100,
    accept: Object.freeze(['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime']),
  }),
  [UPLOAD_PURPOSE.DISPUTE_EVIDENCE]: Object.freeze({
    idPrefix: ID_PREFIX.DISPUTE_EVIDENCE,
    maxSizeMb: 25,
    accept: Object.freeze(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
  }),
  // A logo is displayed at 96px and never downloaded, so the ceiling is much
  // lower than the content purposes above — and no video, ever.
  [UPLOAD_PURPOSE.PROFILE_IMAGE]: Object.freeze({
    idPrefix: ID_PREFIX.PROFILE_IMAGE,
    maxSizeMb: 5,
    accept: Object.freeze(['image/jpeg', 'image/png', 'image/webp']),
    // A logo renders in a square tile, so the stand-in image is square too —
    // a 16:9 placeholder would letterbox in every avatar on the platform.
    renderSize: Object.freeze({ width: 400, height: 400 }),
  }),
  // A mood board, not a deliverable: buyers attach a handful of examples to
  // show the look they are after. Images only — a brief that needs a video
  // reference links it in the description instead.
  [UPLOAD_PURPOSE.REQUEST_REFERENCE]: Object.freeze({
    idPrefix: ID_PREFIX.REQUEST_REFERENCE,
    maxSizeMb: 10,
    accept: Object.freeze(['image/jpeg', 'image/png', 'image/webp']),
  }),
})

const DEFAULT_PURPOSE = UPLOAD_PURPOSE.DELIVERY

/** Simulated latency window, so real loading states get exercised. */
const MIN_LATENCY_MS = 600
const MAX_LATENCY_MS = 1200

/** Cap on how many files one call will accept, to keep the mock responsive. */
export const MAX_FILES_PER_UPLOAD = 10

/**
 * MOCK-UPLOAD: a video has no real asset to point at, so every video upload
 * resolves to this one seeded stand-in. Built through the `constants/images.js`
 * helper, because every image URL in the product flows through that module
 * (00 §1); each file still gets its own poster in `thumbnailUrl`.
 */
export const PLACEHOLDER_VIDEO_URL = imageUrl(
  'bb-video-placeholder',
  IMAGE_SIZES.wide.width,
  IMAGE_SIZES.wide.height
)

/** Characters no filesystem, URL, or `Content-Disposition` header wants. */
const FORBIDDEN_NAME_CHARS = '<>:"|?*'

/** Strips path segments and control characters from a filename (contract §9.5). */
function sanitizeFileName(name) {
  const base = String(name ?? 'file')
    .split(/[\\/]/)
    .pop()
  // Control characters and the characters no filesystem or header wants are
  // dropped by inspection rather than by regex, so no literal control byte
  // ever appears in this source file.
  const cleaned = Array.from(base)
    .filter((char) => char.charCodeAt(0) > 31 && !FORBIDDEN_NAME_CHARS.includes(char))
    .join('')
    .trim()
  return cleaned || 'file'
}

const isVideo = (type) => String(type ?? '').startsWith('video/')

/**
 * Deterministic latency in the 600–1200ms window, derived from the file size —
 * the same file always "uploads" in the same time, which keeps demos and
 * screenshots stable and makes a bigger file visibly slower.
 */
function latencyFor(sizeBytes) {
  const kb = Math.max(Math.round(Number(sizeBytes) || 0) / 1024, 0)
  const span = MAX_LATENCY_MS - MIN_LATENCY_MS
  return MIN_LATENCY_MS + Math.round(kb % (span + 1))
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/** Validates one file against its purpose's rules, or throws `validation_failed`. */
function assertValid(file, rules) {
  if (!file || typeof file.name !== 'string') {
    throw createApiError(API_ERROR_CODE.VALIDATION_FAILED, 'Choose a file to upload.', {
      file: 'Choose a file to upload.',
    })
  }

  const type = String(file.type ?? '').toLowerCase()
  if (rules.accept.length > 0 && !rules.accept.includes(type)) {
    throw createApiError(
      API_ERROR_CODE.VALIDATION_FAILED,
      'That file type is not accepted.',
      { file: `${sanitizeFileName(file.name)} — accepted types are ${rules.accept.join(', ')}.` }
    )
  }

  const maxBytes = rules.maxSizeMb * 1024 * 1024
  if (Number(file.size) > maxBytes) {
    throw createApiError(API_ERROR_CODE.VALIDATION_FAILED, 'That file is too large.', {
      file: `${sanitizeFileName(file.name)} — files must be under ${rules.maxSizeMb} MB.`,
    })
  }
}

/** Builds the contract's file object (§5.1) for an accepted file. */
function toFileRecord(file, rules) {
  const id = generateId(rules.idPrefix)
  // Seeded on the generated id, so the same upload always renders the same
  // placeholder image — and so mock files look exactly like seeded ones.
  const seed = id.replace(/_/g, '-')
  const video = isVideo(file.type)
  const size = rules.renderSize ?? IMAGE_SIZES.wide

  return {
    id,
    name: sanitizeFileName(file.name),
    url: video ? PLACEHOLDER_VIDEO_URL : imageUrl(seed, size.width, size.height),
    thumbnailUrl: imageUrl(seed, IMAGE_SIZES.thumbnail.width, IMAGE_SIZES.thumbnail.height),
    mediaType: video ? MEDIA_TYPE.VIDEO : MEDIA_TYPE.IMAGE,
    sizeKb: Math.max(Math.round((Number(file.size) || 0) / 1024), 1),
  }
}

function rulesFor(purpose) {
  return UPLOAD_RULES[purpose] ?? UPLOAD_RULES[DEFAULT_PURPOSE]
}

export const uploadService = Object.freeze({
  /**
   * Uploads one file — the contract's `POST /uploads` (§5.1).
   *
   * @param {File} file a real `File` from an `<input type="file">`
   * @param {object} [options]
   * @param {string} [options.purpose='delivery'] an `UPLOAD_PURPOSE` value
   * @returns {Promise<{file: object}>} `{ file: { id, name, url, thumbnailUrl, mediaType, sizeKb } }`
   * @throws {ApiError} `validation_failed` with `details.file` on type or size
   */
  async upload(file, { purpose = DEFAULT_PURPOSE } = {}) {
    const rules = rulesFor(purpose)
    assertValid(file, rules)
    await wait(latencyFor(file.size))
    return { file: toFileRecord(file, rules) }
  },

  /**
   * Uploads several files and returns just the file objects, ready to drop
   * straight into the delivery or dispute record being built (contract §5.1).
   *
   * Uploads run in parallel and the call rejects as soon as any file is
   * invalid — a half-attached set is worse than retrying the picker.
   *
   * @param {File[]} files real `File` objects
   * @param {object} [options]
   * @param {string} [options.kind] an `UPLOAD_PURPOSE` value (alias of `purpose`)
   * @param {string} [options.purpose='delivery'] an `UPLOAD_PURPOSE` value
   * @returns {Promise<object[]>} contract-shaped file objects, input order
   * @throws {ApiError} `validation_failed` when a file is rejected, or when
   *   more than {@link MAX_FILES_PER_UPLOAD} files are selected
   */
  async uploadFiles(files, { kind, purpose } = {}) {
    const list = Array.from(files ?? []).filter(Boolean)
    if (list.length === 0) return []

    if (list.length > MAX_FILES_PER_UPLOAD) {
      throw createApiError(API_ERROR_CODE.VALIDATION_FAILED, 'Too many files at once.', {
        file: `Attach up to ${MAX_FILES_PER_UPLOAD} files at a time.`,
      })
    }

    const resolvedPurpose = kind ?? purpose ?? DEFAULT_PURPOSE
    const rules = rulesFor(resolvedPurpose)

    // Validate the whole set before waiting on any of it, so a rejected file
    // reports immediately instead of after a second of fake latency.
    list.forEach((file) => assertValid(file, rules))

    const results = await Promise.all(
      list.map((file) => uploadService.upload(file, { purpose: resolvedPurpose }))
    )
    return results.map((result) => result.file)
  },
})

export default uploadService
