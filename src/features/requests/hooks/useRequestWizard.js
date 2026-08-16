import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import dayjs from 'dayjs'

import { useToast } from '@/components/feedback/ToastProvider'
import {
  BUDGET_TYPE,
  CONTENT_TYPE,
  getStatusMeta,
  ORIENTATION,
  USAGE_RIGHTS,
} from '@/constants/statuses'
import useDebounce from '@/hooks/useDebounce'
import useForm, { fieldId, focusFieldById } from '@/hooks/useForm'
import { requestService, requiresVideoDuration } from '@/services/requestService'
import {
  compose,
  max as maxRule,
  maxLength,
  min as minRule,
  minLength,
  numeric,
  oneOf,
  required,
} from '@/utils/validators'

// The whole request wizard's brain: which step you are on, what each step
// demands before it lets you move, and how the answers become a draft or a
// published brief. The step components below it are presentational — they
// render fields and call back (00 §16.9).
//
// FORM STATE — one `useForm` for all four steps, not one per step.
// -----------------------------------------------------------------
// A single instance is what the screen actually needs: the review step reads
// every answer at once, autosave serialises every answer at once, and a
// cross-step rule (a budget maximum above its minimum) is a plain
// `(value, values)` validator rather than a message passed between forms.
// Per-step gating comes from handing `useForm` only the *current* step's
// validators — it reads them from a ref on every render, so "validate this
// step" is already the behaviour of `handleSubmit`, and `validateEverything`
// below is the one place that widens that to all four for the final submit.

/** How long the form has to be still before a draft autosaves (§4.6). */
export const DRAFT_AUTOSAVE_MS = 2000

/** Earliest deadline a buyer may pick, in days from today (§4.4). */
export const MIN_DEADLINE_DAYS = 3

/** Budget floor, in the platform currency (§4.4). */
export const MIN_BUDGET = 25

export const TITLE_MIN = 10
export const TITLE_MAX = 90
export const DESCRIPTION_MIN = 60
export const DESCRIPTION_MAX = 2000
export const GUIDELINES_MAX = 1000
export const QUANTITY_MIN = 1
export const QUANTITY_MAX = 50
export const MAX_REFERENCE_FILES = 5
export const MAX_LIST_ENTRIES = 8

/** Clip lengths a buyer can ask for, in seconds (§4.3). */
export const VIDEO_DURATION_OPTIONS = Object.freeze([15, 30, 60, 90])

/** `{ value, label }` options built from an enum + its `STATUS_META`. */
const optionsFrom = (enumObject, extras = {}) =>
  Object.freeze(
    Object.values(enumObject).map((value) => {
      const meta = getStatusMeta(value)
      return Object.freeze({
        value,
        label: meta.label,
        description: meta.description,
        ...(extras[value] ?? {}),
      })
    })
  )

/** Content type choice cards — icons are this screen's, labels are the enum's. */
export const CONTENT_TYPE_OPTIONS = optionsFrom(CONTENT_TYPE, {
  [CONTENT_TYPE.PHOTO]: { icon: 'solar:camera-linear' },
  [CONTENT_TYPE.VIDEO]: { icon: 'solar:videocamera-record-linear' },
  [CONTENT_TYPE.BUNDLE]: { icon: 'solar:gallery-wide-linear' },
})

export const ORIENTATION_OPTIONS = optionsFrom(ORIENTATION)

export const USAGE_RIGHTS_OPTIONS = optionsFrom(USAGE_RIGHTS, {
  [USAGE_RIGHTS.ORGANIC_SOCIAL]: { icon: 'solar:hashtag-linear' },
  [USAGE_RIGHTS.PAID_ADS]: { icon: 'solar:graph-up-linear' },
  [USAGE_RIGHTS.WEBSITE]: { icon: 'solar:globus-linear' },
  [USAGE_RIGHTS.FULL_COMMERCIAL]: { icon: 'solar:crown-linear' },
})

export const BUDGET_TYPE_OPTIONS = optionsFrom(BUDGET_TYPE)

/**
 * The four steps, in order. `fields` drives both the per-step validation gate
 * and the "jump to the step that is complaining" behaviour on submit, so a
 * field added to a step needs listing here and nowhere else.
 */
export const WIZARD_STEPS = Object.freeze([
  Object.freeze({
    key: 'basics',
    label: 'Basics',
    heading: 'What do you need made?',
    description: 'The headline of your brief — what it is, and who it is for.',
    fields: Object.freeze(['title', 'categoryId', 'contentType', 'description']),
  }),
  Object.freeze({
    key: 'specs',
    label: 'Specifications',
    heading: 'The specifics',
    description: 'How much, in what shape, and what you may use it for.',
    fields: Object.freeze([
      'quantity',
      'videoDurationSec',
      'orientation',
      'usageRights',
      'brandGuidelines',
      'dos',
      'donts',
      'referenceFiles',
    ]),
  }),
  Object.freeze({
    key: 'budget',
    label: 'Budget & timeline',
    heading: 'Budget and timeline',
    description: 'What you are prepared to spend, and when you need it by.',
    fields: Object.freeze(['budgetType', 'budgetMin', 'budgetMax', 'deadline']),
  }),
  Object.freeze({
    key: 'review',
    label: 'Review',
    heading: 'Review and publish',
    description: 'One last read before creators see it.',
    fields: Object.freeze(['policyAck']),
  }),
])

/** Step index by key, for the review step's "Edit" jump links. */
export const STEP_INDEX = Object.freeze(
  Object.fromEntries(WIZARD_STEPS.map((step, index) => [step.key, index]))
)

/** The earliest date the deadline picker will accept, as `YYYY-MM-DD`. */
export const earliestDeadline = () => dayjs().add(MIN_DEADLINE_DAYS, 'day').startOf('day')

/**
 * Every rule for every field. Conditional rules read the second argument, so
 * "a video length is only required once video is involved" is expressed here
 * rather than by swapping validator maps around.
 */
const VALIDATORS = Object.freeze({
  title: compose(
    required('Give your request a clear title.'),
    minLength(TITLE_MIN, `Titles need at least ${TITLE_MIN} characters — say what and how many.`),
    maxLength(TITLE_MAX)
  ),
  categoryId: required('Choose the category that fits this work.'),
  contentType: compose(
    required('Choose what you need made.'),
    oneOf(Object.values(CONTENT_TYPE))
  ),
  description: compose(
    required('Describe the content you need.'),
    minLength(
      DESCRIPTION_MIN,
      `Add a little more — ${DESCRIPTION_MIN} characters is about one honest sentence.`
    ),
    maxLength(DESCRIPTION_MAX)
  ),

  quantity: compose(
    required('Say how many deliverables you need.'),
    numeric(),
    minRule(QUANTITY_MIN, `Ask for at least ${QUANTITY_MIN}.`),
    maxRule(QUANTITY_MAX, `${QUANTITY_MAX} is the most one brief can cover — split it in two.`)
  ),
  videoDurationSec: (value, values) =>
    requiresVideoDuration(values.contentType)
      ? required('Choose how long each clip should be.')(value)
      : undefined,
  orientation: compose(required('Choose a framing.'), oneOf(Object.values(ORIENTATION))),
  usageRights: compose(
    required('Choose the usage rights you need.'),
    oneOf(Object.values(USAGE_RIGHTS))
  ),
  brandGuidelines: maxLength(GUIDELINES_MAX),
  dos: maxLength(MAX_LIST_ENTRIES, `Keep it to ${MAX_LIST_ENTRIES} points creators will remember.`),
  donts: maxLength(
    MAX_LIST_ENTRIES,
    `Keep it to ${MAX_LIST_ENTRIES} points creators will remember.`
  ),
  referenceFiles: maxLength(
    MAX_REFERENCE_FILES,
    `Attach up to ${MAX_REFERENCE_FILES} reference images.`
  ),

  budgetType: compose(required(), oneOf(Object.values(BUDGET_TYPE))),
  budgetMin: (value, values) =>
    compose(
      required(
        values.budgetType === BUDGET_TYPE.RANGE ? 'Enter the bottom of your range.' : 'Enter your budget.'
      ),
      numeric('Enter a budget as a number.'),
      minRule(MIN_BUDGET, `The minimum budget on BetterBlue is $${MIN_BUDGET}.`)
    )(value, values),
  budgetMax: (value, values) => {
    if (values.budgetType !== BUDGET_TYPE.RANGE) return undefined
    const base = compose(
      required('Enter the top of your range.'),
      numeric('Enter a budget as a number.'),
      minRule(MIN_BUDGET, `The minimum budget on BetterBlue is $${MIN_BUDGET}.`)
    )(value, values)
    if (base) return base
    return Number(value) > Number(values.budgetMin)
      ? undefined
      : 'The top of the range has to be above the bottom.'
  },
  deadline: (value) => {
    const missing = required('Choose a deadline.')(value)
    if (missing) return missing
    const picked = dayjs(value)
    if (!picked.isValid()) return 'Choose a deadline.'
    return picked.startOf('day').isBefore(earliestDeadline())
      ? `Give creators room to work — pick a date at least ${MIN_DEADLINE_DAYS} days out.`
      : undefined
  },

  policyAck: (value) =>
    value ? undefined : 'Confirm your request complies with the Content Policy.',
})

/** Only the rules for one step — what `useForm` sees while that step is open. */
const validatorsForStep = (stepIndex) =>
  Object.fromEntries(
    (WIZARD_STEPS[stepIndex]?.fields ?? [])
      .filter((field) => VALIDATORS[field])
      .map((field) => [field, VALIDATORS[field]])
  )

/**
 * `dos`/`donts` are one free-text field each in the data model, but a list is
 * far easier to write on a phone than a paragraph. The wizard edits a list and
 * stores the newline-joined string, which round-trips exactly.
 */
export const listToText = (entries) =>
  (Array.isArray(entries) ? entries : []).map((entry) => String(entry).trim()).filter(Boolean).join('\n')

export const textToList = (value) =>
  String(value ?? '')
    .split('\n')
    .map((entry) => entry.trim())
    .filter(Boolean)

/** A blank brief, plus whatever the URL told us about it. */
export function emptyWizardValues({ invitedCreatorId } = {}) {
  return {
    title: '',
    categoryId: '',
    contentType: '',
    description: '',
    quantity: 1,
    videoDurationSec: '',
    orientation: ORIENTATION.ANY,
    usageRights: '',
    brandGuidelines: '',
    dos: [],
    donts: [],
    referenceFiles: [],
    referenceUrls: [],
    budgetType: BUDGET_TYPE.FIXED,
    budgetMin: '',
    budgetMax: '',
    deadline: null,
    policyAck: false,
    invitedCreatorId: invitedCreatorId ?? null,
  }
}

/** A saved draft, unpacked back into the shape the wizard edits. */
export function draftToWizardValues(draft, { invitedCreatorId } = {}) {
  const blank = emptyWizardValues({ invitedCreatorId })
  if (!draft) return blank

  return {
    ...blank,
    title: draft.title ?? '',
    categoryId: draft.categoryId ?? '',
    contentType: draft.contentType ?? '',
    description: draft.description ?? '',
    quantity: draft.quantity ?? QUANTITY_MIN,
    videoDurationSec: draft.videoDurationSec ?? '',
    orientation: draft.orientation ?? ORIENTATION.ANY,
    usageRights: draft.usageRights ?? '',
    brandGuidelines: draft.brandGuidelines ?? '',
    dos: textToList(draft.dos),
    donts: textToList(draft.donts),
    // Files already uploaded stay as URLs; the picker starts empty again,
    // because a `File` cannot survive a page load (`uploadService` §MOCK-UPLOAD).
    referenceUrls: Array.isArray(draft.referenceUrls) ? draft.referenceUrls : [],
    budgetType: draft.budgetType ?? BUDGET_TYPE.FIXED,
    budgetMin: draft.budgetMin == null ? '' : String(draft.budgetMin),
    budgetMax: draft.budgetMax == null ? '' : String(draft.budgetMax),
    deadline: draft.deadline ? dayjs(draft.deadline).format('YYYY-MM-DD') : null,
    // The URL wins over the draft, so arriving from a creator's profile
    // re-points a resumed draft at them.
    invitedCreatorId: invitedCreatorId ?? draft.invitedCreatorId ?? null,
  }
}

/** Form values → the payload both service methods take. */
function toServiceInput(values, buyerId) {
  return {
    ...values,
    buyerId,
    dos: listToText(values.dos),
    donts: listToText(values.donts),
    // Video answers are dropped rather than hidden when the type goes back to
    // photos, so a stale duration can never reach the record (§5).
    videoDurationSec: requiresVideoDuration(values.contentType) ? values.videoDurationSec : null,
  }
}

/**
 * Fingerprint of everything worth saving — autosave skips identical states.
 * `File` objects do not serialise, so pending picks are counted instead; the
 * acknowledgment is not part of the record at all.
 */
const snapshotOf = (values, buyerId) => {
  const input = toServiceInput(values, buyerId)
  return JSON.stringify({
    ...input,
    referenceFiles: undefined,
    policyAck: undefined,
    pendingFiles: (input.referenceFiles ?? []).length,
  })
}

/**
 * Drives the request wizard.
 *
 * @param {object} params
 * @param {string} params.buyerId the signed-in buyer, `usr_…`
 * @param {object} [params.draft] a draft being resumed, already fetched
 * @param {string} [params.invitedCreatorId] `?creator=` hint, `cpr_…`
 * @param {(draftId: string) => void} [params.onDraftCreated] fires once, when the
 *   first save mints an id — the page puts it in the URL so a refresh resumes
 * @param {(request: object) => void} [params.onPublished] fires after a successful submit
 * @returns {object} everything the page and its steps render from
 */
export function useRequestWizard({
  buyerId,
  draft,
  invitedCreatorId,
  onDraftCreated,
  onPublished,
}) {
  const toast = useToast()

  const [stepIndex, setStepIndex] = useState(0)
  // +1 moving forward, -1 moving back — the step transition slides the way the
  // person is travelling.
  const [direction, setDirection] = useState(1)
  const [draftId, setDraftId] = useState(draft?.id ?? null)
  const [draftState, setDraftState] = useState('idle')
  const [isSavingDraft, setSavingDraft] = useState(false)
  const [isSubmitting, setSubmitting] = useState(false)
  const [isPublished, setPublished] = useState(false)

  const initialValues = useMemo(
    () => draftToWizardValues(draft, { invitedCreatorId }),
    [draft, invitedCreatorId]
  )

  const form = useForm({ initialValues, validators: validatorsForStep(stepIndex) })
  const { setError, setValue, values } = form

  // What the server already has. Seeded from the resumed draft so reopening one
  // and changing nothing does not immediately write it back.
  const savedSnapshot = useRef(draft ? snapshotOf(initialValues, buyerId) : null)
  const valuesRef = useRef(values)
  valuesRef.current = values

  const step = WIZARD_STEPS[stepIndex]
  const isFirstStep = stepIndex === 0
  const isLastStep = stepIndex === WIZARD_STEPS.length - 1

  /* ---------------------------------------------------------------------- */
  /* Conditional fields                                                     */
  /* ---------------------------------------------------------------------- */

  const needsVideoDuration = requiresVideoDuration(values.contentType)

  // A brief switched away from video loses its clip length in the form too, so
  // what is on screen and what would be saved never disagree (§5).
  useEffect(() => {
    if (!needsVideoDuration && values.videoDurationSec) setValue('videoDurationSec', '')
  }, [needsVideoDuration, setValue, values.videoDurationSec])

  /* ---------------------------------------------------------------------- */
  /* Persistence                                                            */
  /* ---------------------------------------------------------------------- */

  /**
   * Writes the current answers as a draft.
   *
   * @param {object} [options]
   * @param {boolean} [options.silent=false] autosave — no toast, and one quiet
   *   retry before the indicator admits to a problem (§13)
   */
  const persistDraft = useCallback(
    async ({ silent = false } = {}) => {
      const current = valuesRef.current
      const input = toServiceInput(current, buyerId)
      const snapshot = snapshotOf(current, buyerId)

      setDraftState('saving')
      if (!silent) setSavingDraft(true)

      const attempt = () => requestService.saveDraft(input, { draftId })

      try {
        let saved
        try {
          saved = await attempt()
        } catch (failure) {
          // One quiet retry: a single dropped request should not turn into a
          // warning the buyer has to think about.
          if (!silent) throw failure
          saved = await attempt()
        }

        savedSnapshot.current = snapshot
        setDraftState('saved')

        if (!draftId && saved?.id) {
          setDraftId(saved.id)
          onDraftCreated?.(saved.id)
        }

        // The picker is emptied once its files are stored as URLs, so autosave
        // cannot upload the same images again on the next tick.
        if ((current.referenceFiles ?? []).length > 0) {
          setValue('referenceFiles', [])
          setValue('referenceUrls', saved?.referenceUrls ?? current.referenceUrls)
          savedSnapshot.current = snapshotOf(
            { ...current, referenceFiles: [], referenceUrls: saved?.referenceUrls ?? [] },
            buyerId
          )
        }

        return saved
      } catch (failure) {
        setDraftState('error')
        if (!silent) throw failure
        return null
      } finally {
        if (!silent) setSavingDraft(false)
      }
    },
    [buyerId, draftId, onDraftCreated, setValue]
  )

  /** "Save as draft" — reachable from any step, and only ever needs a title. */
  const saveDraft = useCallback(async () => {
    const titleError = VALIDATORS.title(valuesRef.current.title, valuesRef.current)
    if (titleError) {
      setError('title', titleError)
      setDirection(-1)
      setStepIndex(STEP_INDEX.basics)
      return null
    }

    try {
      const saved = await persistDraft()
      toast.success('Draft saved', {
        description: 'Pick it back up whenever you are ready — nothing is public yet.',
      })
      return saved
    } catch (failure) {
      toast.error('We could not save your draft', { description: failure?.message })
      return null
    }
  }, [persistDraft, setError, toast])

  // Autosave: quiet, debounced, and only once a draft exists to update (§4.6).
  const debouncedValues = useDebounce(values, DRAFT_AUTOSAVE_MS)

  useEffect(() => {
    if (!draftId || isSubmitting || isPublished) return
    if (snapshotOf(debouncedValues, buyerId) === savedSnapshot.current) return
    persistDraft({ silent: true })
  }, [buyerId, debouncedValues, draftId, isPublished, isSubmitting, persistDraft])

  /* ---------------------------------------------------------------------- */
  /* Navigation                                                             */
  /* ---------------------------------------------------------------------- */

  /** Validates the open step and reports the first field that failed. */
  const validateStep = useCallback(
    (index) => {
      const current = valuesRef.current
      const failed = (WIZARD_STEPS[index]?.fields ?? []).find((field) => {
        const message = VALIDATORS[field]?.(current[field], current)
        if (message) setError(field, message)
        return Boolean(message)
      })
      return failed ?? null
    },
    [setError]
  )

  const goToStep = useCallback((index) => {
    setDirection(index >= stepIndex ? 1 : -1)
    setStepIndex(Math.min(Math.max(index, 0), WIZARD_STEPS.length - 1))
  }, [stepIndex])

  const goNext = useCallback(() => {
    // `handleSubmit` already validates exactly the open step and focuses the
    // first field that failed, which is precisely what Next has to do.
    return form.handleSubmit(() => {
      setDirection(1)
      setStepIndex((index) => Math.min(index + 1, WIZARD_STEPS.length - 1))
    })()
  }, [form])

  const goBack = useCallback(() => {
    setDirection(-1)
    setStepIndex((index) => Math.max(index - 1, 0))
  }, [])

  /* ---------------------------------------------------------------------- */
  /* Submit                                                                 */
  /* ---------------------------------------------------------------------- */

  const submit = useCallback(async () => {
    // Every step, not just the review one: a jump link may have left an earlier
    // answer half-edited, and the record has to be whole either way (§5).
    let brokenField = null
    const brokenStep = WIZARD_STEPS.findIndex((_, index) => {
      brokenField = validateStep(index)
      return brokenField !== null
    })
    if (brokenStep !== -1) {
      goToStep(brokenStep)
      // Publish owes the same courtesy every Next click gives (00 §12): the
      // field that failed takes focus, not the button that was pressed. The
      // step may be about to swap, so this waits for that render — and for the
      // step transition — rather than reaching for a node that is not there.
      window.requestAnimationFrame(() => focusFieldById(fieldId(brokenField)))
      return null
    }

    setSubmitting(true)
    try {
      const created = await requestService.createRequest(
        toServiceInput(valuesRef.current, buyerId),
        { draftId }
      )
      setPublished(true)
      onPublished?.(created)
      return created
    } catch (failure) {
      // The wizard keeps every answer — a failed publish is a retry, not a
      // reason to start again (§13).
      Object.entries(failure?.details ?? {}).forEach(([field, message]) => {
        if (field in valuesRef.current) {
          setError(field, Array.isArray(message) ? message[0] : message)
        }
      })
      toast.error('We could not publish your request', { description: failure?.message })
      return null
    } finally {
      setSubmitting(false)
    }
  }, [buyerId, draftId, goToStep, onPublished, setError, toast, validateStep])

  return {
    form,
    steps: WIZARD_STEPS,
    step,
    stepIndex,
    direction,
    isFirstStep,
    isLastStep,
    goNext,
    goBack,
    goToStep,
    needsVideoDuration,
    draftId,
    draftState,
    isSavingDraft,
    saveDraft,
    isSubmitting,
    isPublished,
    submit,
  }
}

export default useRequestWizard
