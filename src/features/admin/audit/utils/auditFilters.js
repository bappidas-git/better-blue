// The audit explorer's vocabulary: its filters, its URL schema, and the shape
// of its CSV — Prompt 36 §4.4.
//
// Split out of the page for the reason `users/utils/userDirectory.js` is: the
// page renders, this decides what a filter *means*. The table and the export
// read the same query object, so an exported file can never contain a different
// set of entries than the screen showed.

import { auditActionsIn, AUDIT_NAMESPACES } from '@/constants/auditActions'
import { ENTITY_TYPE_OPTIONS, getEntityMeta } from '@/features/admin/shared'
import { listParam } from '@/hooks/useListParams'
import { formatDateTime } from '@/utils/formatters'

import { humanizeAuditAction, summarizeAuditMeta } from './auditVocabulary'

/** Rows per page (§4.4). Dense, single-line rows — an investigator scrolls. */
export const AUDIT_PAGE_SIZE = 50

/**
 * Ceiling on a CSV export — the provider's page limit (contract §4.1). A
 * filtered view above it exports the first page's worth and says so rather than
 * truncating in silence.
 */
export const AUDIT_EXPORT_LIMIT = 100

/** Action namespaces as filter options, labelled for reading (`ticket` → Support). */
export const AUDIT_NAMESPACE_OPTIONS = Object.freeze(
  AUDIT_NAMESPACES.map((namespace) =>
    Object.freeze({ value: namespace.id, label: namespace.label })
  )
)

const NAMESPACE_VALUES = AUDIT_NAMESPACES.map((namespace) => namespace.id)
const ENTITY_VALUES = ENTITY_TYPE_OPTIONS.map((option) => option.value)

/** Entity types as filter options — the console's own list (`entityRefs`). */
export { ENTITY_TYPE_OPTIONS }

/**
 * The explorer's query string (00 §12), declared at module scope so its identity
 * is stable across renders — what `useListParams` requires.
 *
 * `actor` and `entity` are single-select rather than lists: an investigation is
 * "what did Maya do" or "what happened to this order", and an OR of three
 * actors is a report, not a question.
 */
export const AUDIT_PARAMS = Object.freeze({
  actor: listParam.text({ maxLength: 40 }),
  ns: listParam.choice({ options: NAMESPACE_VALUES, fallback: '' }),
  entity: listParam.choice({ options: ENTITY_VALUES, fallback: '' }),
  from: listParam.text({ maxLength: 10, group: 'when' }),
  to: listParam.text({ maxLength: 10, group: 'when' }),
  q: listParam.text(),
  page: listParam.number({ fallback: 1, min: 1, integer: true, isFilter: false }),
})

/**
 * URL values → the params `auditService.list` takes.
 *
 * The namespace filter is expanded into **every action in it** because the
 * provider has no prefix matching (contract §4.3): `?ns=dispute` becomes
 * `action=dispute.assign&action=dispute.close&…`, which JSON Server reads as an
 * OR and Laravel will answer with `WHERE action LIKE 'dispute.%'`. That is the
 * whole reason `constants/auditActions.js` exists — a verb missing from it is a
 * verb this filter silently hides.
 *
 * @param {object} values the parsed query string
 * @returns {import('@/services/api/listAdapter').ListParams}
 */
export function auditQueryFrom({ actor, ns, entity, from, to, q } = {}) {
  const filters = {}

  if (actor) filters.actorId = actor
  if (entity) filters.entityType = entity
  if (ns) {
    const actions = auditActionsIn(ns)
    if (actions.length > 0) filters.action = [...actions]
  }
  // Date-only bounds widened to the instants they mean: `createdAt` is a full
  // ISO timestamp, so `createdAt_lte=2026-08-01` compares as a string and drops
  // everything that happened *on* the 1st.
  if (from) filters.createdAt_gte = `${from}T00:00:00.000Z`
  if (to) filters.createdAt_lte = `${to}T23:59:59.999Z`
  // `entityId` is an exact match, not a search: the trail's searchable text is
  // its action vocabulary, and a free-text `q` over that would match `usr_…`
  // against nothing. The field is labelled "entity ID" on screen for that reason.
  if (q) filters.entityId = q.trim()

  return { filters }
}

/** Columns in the CSV. Deliberately flatter than the table — no markup. */
export const AUDIT_EXPORT_COLUMNS = Object.freeze([
  { key: 'id', label: 'Entry ID' },
  { key: 'createdAt', label: 'Timestamp', format: (row) => formatDateTime(row.createdAt) },
  { key: 'actorId', label: 'Actor ID' },
  { key: 'actorName', label: 'Actor', format: (row) => row.actorName ?? '' },
  { key: 'actorRole', label: 'Actor role' },
  { key: 'action', label: 'Action' },
  { key: 'actionLabel', label: 'What happened', format: (row) => humanizeAuditAction(row.action) },
  {
    key: 'entityType',
    label: 'Entity type',
    format: (row) => (row.entityType ? getEntityMeta(row.entityType).label : ''),
  },
  { key: 'entityId', label: 'Entity ID' },
  { key: 'summary', label: 'Detail', format: (row) => summarizeAuditMeta(row) },
  {
    key: 'meta',
    label: 'Meta (JSON)',
    // The full record, so an export is a complete extract rather than a preview
    // of one. `escapeCsvValue` quotes it; a shape that cannot be stringified
    // (a cycle, which nothing writes) exports as empty rather than throwing.
    format: (row) => {
      try {
        return row.meta && Object.keys(row.meta).length > 0 ? JSON.stringify(row.meta) : ''
      } catch {
        return ''
      }
    },
  },
])
