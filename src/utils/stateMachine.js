// State-machine helpers — prompts/00-architecture-and-rules.md §9.
//
// Machines live in `src/constants/stateMachines.js` as `{ name, transitions }`.
// Services call these helpers before persisting any status change; the UI never
// mutates statuses directly. Plain `{ from: [to, …] }` maps are accepted too,
// so ad-hoc machines (e.g. in tests or admin tooling) work without ceremony.

const EMPTY = Object.freeze([])

/** Reads the transition map out of a machine object or a bare map. */
function transitionsOf(machine) {
  if (!machine || typeof machine !== 'object') return null
  return machine.transitions && typeof machine.transitions === 'object'
    ? machine.transitions
    : machine
}

/** Name used in error messages. */
function machineNameOf(machine) {
  return machine?.name ?? 'state machine'
}

/**
 * States reachable from `from`.
 * @returns {string[]} frozen list — empty for terminal or unknown states.
 */
export function nextStates(machine, from) {
  const transitions = transitionsOf(machine)
  const next = transitions?.[from]
  return Array.isArray(next) ? next : EMPTY
}

/** True when `from → to` is a declared transition. */
export function canTransition(machine, from, to) {
  return nextStates(machine, from).includes(to)
}

/** True when the machine declares `state` but allows no moves out of it. */
export function isTerminalState(machine, state) {
  const transitions = transitionsOf(machine)
  return Boolean(transitions && state in transitions && nextStates(machine, state).length === 0)
}

/**
 * Throws unless `from → to` is allowed. Returns `to` so callers can inline it:
 * `const status = assertTransition(ORDER_STATUS_MACHINE, order.status, ORDER_STATUS.DELIVERED)`.
 *
 * The thrown Error carries `code: 'invalid_transition'` plus the machine name
 * and both states, so the services layer can map it onto an `ApiError`
 * (Prompt 07) and surface a friendly message.
 */
export function assertTransition(machine, from, to) {
  if (canTransition(machine, from, to)) return to

  const name = machineNameOf(machine)
  const transitions = transitionsOf(machine)
  const known = transitions && from in transitions
  const allowed = nextStates(machine, from)

  const detail = !known
    ? `"${from}" is not a state of ${name}`
    : allowed.length
      ? `allowed from "${from}": ${allowed.join(', ')}`
      : `"${from}" is a terminal state`

  const error = new Error(
    `Invalid ${name} transition: "${from}" → "${to}" (${detail}).`
  )
  error.name = 'InvalidTransitionError'
  error.code = 'invalid_transition'
  error.machine = name
  error.from = from
  error.to = to
  error.allowed = allowed
  throw error
}
