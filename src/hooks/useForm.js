import { useCallback, useMemo, useRef, useState } from 'react'

// Minimal controlled-form state machine — prompts/00-architecture-and-rules.md
// §12: "Forms via `useForm` + `validators` + `Form*` field components; errors
// inline under fields; first invalid field focused on submit."
//
// Validation rules come from `src/utils/validators.js` (Prompt 03): each rule is
// `(value, values) => undefined | string`. Fields validate on blur and on
// submit — never on every keystroke, which would shout at people mid-typing.
// An already-errored field re-validates as the person types so the message
// clears the moment it is fixed.

/** DOM id convention shared with the `Form*` fields, so submit can focus by id. */
export const fieldId = (name) => `field-${name}`

const runRule = (rule, value, values) =>
  typeof rule === 'function' ? rule(value, values) : undefined

/**
 * @typedef {object} UseFormResult
 * @property {object} values current field values
 * @property {Record<string,string|undefined>} errors validation messages by field
 * @property {Record<string,boolean>} touched fields blurred or submitted at least once
 * @property {boolean} isSubmitting true while `handleSubmit`'s callback is pending
 * @property {boolean} isValid true when no validator currently fails
 * @property {(name: string, value: *) => void} setValue updates one field
 * @property {(values: object) => void} setValues replaces every value
 * @property {(name: string, message?: string) => void} setError sets/clears one message (e.g. from the API)
 * @property {(name: string) => void} handleBlur marks touched + validates one field
 * @property {(onValid: (values: object, helpers: object) => *) => (event?: Event) => Promise<void>} handleSubmit
 * @property {(nextValues?: object) => void} reset back to initial (or new) values
 * @property {(submitting: boolean) => void} setSubmitting manual pending control
 * @property {(name: string) => (node: *) => void} registerField ref callback used to focus the first error
 * @property {(name: string) => object} fieldProps spreadable props for a `Form*` field
 */

/**
 * @param {object} config
 * @param {object} [config.initialValues] starting values, keyed by field name
 * @param {Record<string, Function>} [config.validators] one rule per field —
 *   compose several with `compose()` from `@/utils/validators`
 * @returns {UseFormResult}
 *
 * @example
 * const form = useForm({
 *   initialValues: { title: '', budget: '' },
 *   validators: { title: compose(required(), minLength(8)), budget: min(50) },
 * })
 * <form onSubmit={form.handleSubmit(async (values) => requestService.create(values))}>
 *   <FormTextField label="Title" {...form.fieldProps('title')} />
 * </form>
 */
export function useForm({ initialValues = {}, validators = {} } = {}) {
  const [values, setValuesState] = useState(initialValues)
  const [errors, setErrors] = useState({})
  const [touched, setTouched] = useState({})
  const [isSubmitting, setSubmitting] = useState(false)

  // Kept in refs so the returned callbacks stay referentially stable even when
  // callers declare `validators` inline (the common case).
  const validatorsRef = useRef(validators)
  validatorsRef.current = validators
  const valuesRef = useRef(values)
  valuesRef.current = values
  const initialValuesRef = useRef(initialValues)

  // name -> DOM node, populated by `registerField`, read when focusing errors.
  const fieldNodes = useRef({})
  const refCallbacks = useRef({})

  const validateField = useCallback((name, nextValues) => {
    return runRule(validatorsRef.current[name], nextValues[name], nextValues)
  }, [])

  const validateAll = useCallback((nextValues) => {
    const nextErrors = {}
    Object.keys(validatorsRef.current).forEach((name) => {
      const message = runRule(validatorsRef.current[name], nextValues[name], nextValues)
      if (message) nextErrors[name] = message
    })
    return nextErrors
  }, [])

  const setValue = useCallback(
    (name, value) => {
      const nextValues = { ...valuesRef.current, [name]: value }
      valuesRef.current = nextValues
      setValuesState(nextValues)
      // Only re-validate a field that is already complaining, so the message
      // disappears as soon as the input becomes valid.
      setErrors((previous) => {
        if (!previous[name]) return previous
        const message = validateField(name, nextValues)
        if (message === previous[name]) return previous
        const next = { ...previous }
        if (message) next[name] = message
        else delete next[name]
        return next
      })
    },
    [validateField]
  )

  const setValues = useCallback((nextValues) => {
    valuesRef.current = nextValues
    setValuesState(nextValues)
  }, [])

  const setError = useCallback((name, message) => {
    setErrors((previous) => {
      const next = { ...previous }
      if (message) next[name] = message
      else delete next[name]
      return next
    })
    setTouched((previous) => (previous[name] ? previous : { ...previous, [name]: true }))
  }, [])

  const handleBlur = useCallback(
    (name) => {
      setTouched((previous) => (previous[name] ? previous : { ...previous, [name]: true }))
      const message = validateField(name, valuesRef.current)
      setErrors((previous) => {
        if (message === previous[name]) return previous
        const next = { ...previous }
        if (message) next[name] = message
        else delete next[name]
        return next
      })
    },
    [validateField]
  )

  const registerField = useCallback((name) => {
    if (!refCallbacks.current[name]) {
      refCallbacks.current[name] = (node) => {
        if (node) fieldNodes.current[name] = node
        else delete fieldNodes.current[name]
      }
    }
    return refCallbacks.current[name]
  }, [])

  /** Focus (and scroll to) a field by registered ref, falling back to its id. */
  const focusField = useCallback((name) => {
    const node =
      fieldNodes.current[name] ??
      (typeof document !== 'undefined' ? document.getElementById(fieldId(name)) : null)
    if (!node) return
    node.focus?.({ preventScroll: true })
    // `scroll-behavior` is forced to `auto` for reduced-motion users in
    // src/styles/global.css, so this stays comfortable either way.
    node.scrollIntoView?.({ block: 'center', behavior: 'smooth' })
  }, [])

  const reset = useCallback((nextValues) => {
    const resetTo = nextValues ?? initialValuesRef.current
    if (nextValues) initialValuesRef.current = nextValues
    valuesRef.current = resetTo
    setValuesState(resetTo)
    setErrors({})
    setTouched({})
    setSubmitting(false)
  }, [])

  const handleSubmit = useCallback(
    (onValid) => async (event) => {
      event?.preventDefault?.()

      const currentValues = valuesRef.current
      const nextErrors = validateAll(currentValues)
      setErrors(nextErrors)
      setTouched((previous) => {
        const next = { ...previous }
        Object.keys(validatorsRef.current).forEach((name) => {
          next[name] = true
        })
        Object.keys(currentValues).forEach((name) => {
          next[name] = true
        })
        return next
      })

      // Validator declaration order defines "first" — matching the field order
      // authors write their forms in.
      const firstErrored = Object.keys(validatorsRef.current).find((name) => nextErrors[name])
      if (firstErrored) {
        focusField(firstErrored)
        return
      }

      try {
        setSubmitting(true)
        await onValid?.(currentValues, { reset, setError, setValues })
      } finally {
        setSubmitting(false)
      }
    },
    [focusField, reset, setError, setValues, validateAll]
  )

  const isValid = useMemo(
    () => Object.keys(validateAll(values)).length === 0,
    [validateAll, values]
  )

  /** Spreadable props for a `Form*` field — id, value, handlers, and error. */
  const fieldProps = useCallback(
    (name) => ({
      id: fieldId(name),
      name,
      value: values[name],
      onChange: (value) => setValue(name, value),
      onBlur: () => handleBlur(name),
      error: touched[name] ? errors[name] : undefined,
      inputRef: registerField(name),
    }),
    [errors, handleBlur, registerField, setValue, touched, values]
  )

  return {
    values,
    errors,
    touched,
    isSubmitting,
    isValid,
    setValue,
    setValues,
    setError,
    handleBlur,
    handleSubmit,
    reset,
    setSubmitting,
    registerField,
    fieldProps,
  }
}

export default useForm
