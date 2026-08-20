import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'

import KeyValueList from '@/components/data-display/KeyValueList'
import { PERMISSION_META } from '@/constants/permissions'
import {
  humanizeMetaKey,
  humanizeToken,
  statusLabel,
} from '@/features/admin/audit/utils/auditVocabulary'
import { EMPTY_PLACEHOLDER, formatDateTime, formatNumber } from '@/utils/formatters'

// The `meta` object on an audit entry, rendered for a human — Prompt 36 §4.4.
//
// `meta` is deliberately schemaless (contract §6.26): each verb stores whatever
// the reader of that verb needs, and every prompt adds verbs. So this component
// makes **no assumptions it cannot recover from** (§13):
//
//   - it recognises the three shapes that carry a *change* — `from`/`to`,
//     `added`/`removed`, and `changes[]` — and renders those as diffs, because
//     "what moved" is the question an audit entry is opened to answer;
//   - everything else is printed by type: scalars in a definition list, arrays
//     as chips, and anything nested as readable JSON;
//   - a shape it has never seen renders as JSON rather than as nothing, and a
//     value that cannot even be stringified renders as a placeholder rather
//     than throwing inside a drawer.
//
// Nothing here is editable. The trail is append-only at every permission level.

/** Keys rendered by a dedicated block above, so the generic list skips them. */
const HANDLED_KEYS = new Set(['added', 'removed', 'from', 'to', 'changes'])

/** ISO-8601-ish, so a timestamp inside `meta` prints as a date rather than a string. */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/

/** Keys whose value is a status token — printed with its `STATUS_META` label. */
const STATUS_KEYS = new Set([
  'fromStatus',
  'toStatus',
  'status',
  'orderFromStatus',
  'orderToStatus',
])

const isPlainObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

/** JSON, or `null` when the value cannot be serialised (a cycle — nothing writes one). */
function safeJson(value) {
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return null
  }
}

/** A permission key as its label, anything else humanised. */
function tokenLabel(value) {
  return PERMISSION_META[value]?.label ?? humanizeToken(value)
}

/** One scalar, printed by type. Never returns `undefined`. */
function ScalarValue({ name, value }) {
  if (value === null || value === undefined || value === '') {
    return (
      <Typography variant="body2" color="text.disabled">
        {EMPTY_PLACEHOLDER}
      </Typography>
    )
  }

  if (typeof value === 'boolean') {
    return (
      <Chip
        label={value ? 'Yes' : 'No'}
        size="small"
        color={value ? 'success' : 'default'}
        variant="outlined"
        sx={{ height: 24 }}
      />
    )
  }

  if (typeof value === 'number') {
    return (
      <Typography variant="body2" sx={{ fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>
        {formatNumber(value)}
      </Typography>
    )
  }

  const text = String(value)
  const printed = ISO_DATE.test(text)
    ? formatDateTime(text)
    : STATUS_KEYS.has(name)
      ? statusLabel(text)
      : text

  return (
    <Typography variant="body2" sx={{ fontWeight: 500, wordBreak: 'break-word' }}>
      {printed}
    </Typography>
  )
}

/** A readable JSON block for anything nested — monospace, scrollable, selectable. */
function JsonBlock({ value }) {
  const json = safeJson(value)

  if (json === null) {
    return (
      <Typography variant="body2" color="text.disabled">
        This value could not be displayed.
      </Typography>
    )
  }

  return (
    <Box
      component="pre"
      tabIndex={0}
      sx={{
        m: 0,
        p: 1.5,
        borderRadius: 1.5,
        border: 1,
        borderColor: 'divider',
        bgcolor: 'background.default',
        color: 'text.secondary',
        fontFamily: 'monospace',
        fontSize: '0.75rem',
        lineHeight: 1.6,
        overflowX: 'auto',
        maxHeight: 240,
        overflowY: 'auto',
        whiteSpace: 'pre',
      }}
    >
      {json}
    </Box>
  )
}

/** A list of scalars as chips — permission keys read as their labels. */
function ChipList({ values, color = 'default' }) {
  return (
    <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
      {values.map((value, index) => (
        <Chip
          key={`${String(value)}-${index}`}
          label={tokenLabel(value)}
          size="small"
          color={color}
          variant="outlined"
          sx={{ height: 24, maxWidth: '100%' }}
        />
      ))}
    </Stack>
  )
}

/** `+ granted` / `− revoked`, the shape `admin.permissions.update` writes. */
function GrantDiff({ added, removed }) {
  return (
    <Stack spacing={1.5}>
      {added.length > 0 ? (
        <Box>
          <Stack
            direction="row"
            spacing={0.75}
            alignItems="center"
            sx={{ mb: 0.75, color: 'success.main' }}
          >
            <Icon icon="tabler:plus" width={15} aria-hidden="true" />
            <Typography variant="caption" sx={{ fontWeight: 700 }}>
              Granted ({added.length})
            </Typography>
          </Stack>
          <ChipList values={added} color="success" />
        </Box>
      ) : null}

      {removed.length > 0 ? (
        <Box>
          <Stack
            direction="row"
            spacing={0.75}
            alignItems="center"
            sx={{ mb: 0.75, color: 'error.main' }}
          >
            <Icon icon="tabler:minus" width={15} aria-hidden="true" />
            <Typography variant="caption" sx={{ fontWeight: 700 }}>
              Revoked ({removed.length})
            </Typography>
          </Stack>
          <ChipList values={removed} color="error" />
        </Box>
      ) : null}
    </Stack>
  )
}

/** One `old → new` line. Used by both `from`/`to` and each row of `changes[]`. */
function ValueDelta({ label, from, to }) {
  const printable = (value) =>
    isPlainObject(value) || Array.isArray(value) ? (safeJson(value) ?? EMPTY_PLACEHOLDER) : value

  return (
    <Box>
      {label ? (
        <Typography variant="caption" color="text.secondary" component="p" sx={{ mb: 0.25 }}>
          {label}
        </Typography>
      ) : null}
      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
        <Box
          component="span"
          sx={{
            px: 1,
            py: 0.25,
            borderRadius: 1,
            bgcolor: 'action.hover',
            color: 'text.secondary',
            typography: 'body2',
            textDecoration: 'line-through',
            wordBreak: 'break-word',
          }}
        >
          {String(printable(from) ?? EMPTY_PLACEHOLDER)}
        </Box>
        <Icon icon="tabler:arrow-right" width={15} aria-hidden="true" />
        <Box
          component="span"
          sx={{
            px: 1,
            py: 0.25,
            borderRadius: 1,
            bgcolor: 'primary.surface',
            color: 'primary.light',
            typography: 'body2',
            fontWeight: 600,
            wordBreak: 'break-word',
          }}
        >
          {String(printable(to) ?? EMPTY_PLACEHOLDER)}
        </Box>
      </Stack>
    </Box>
  )
}

/**
 * @param {object} props
 * @param {object} [props.meta] the entry's `meta` — any shape, including none
 */
export default function AuditMetaView({ meta }) {
  if (!meta || !isPlainObject(meta) || Object.keys(meta).length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        This entry carries no extra detail — the action, the actor, and what it was about are the
        whole record.
      </Typography>
    )
  }

  const added = Array.isArray(meta.added) ? meta.added : []
  const removed = Array.isArray(meta.removed) ? meta.removed : []
  const hasGrantDiff = added.length > 0 || removed.length > 0

  // `from`/`to` are only a *value* diff when neither side is a list: the
  // permissions verb stores whole arrays under the same two keys, and those
  // belong beside their grant diff rather than on a strikethrough line.
  const hasScalarDelta =
    ('from' in meta || 'to' in meta) && !Array.isArray(meta.from) && !Array.isArray(meta.to)

  const fieldChanges = Array.isArray(meta.changes)
    ? meta.changes.filter((change) => isPlainObject(change))
    : []

  const rest = Object.entries(meta).filter(([key, value]) => {
    if (HANDLED_KEYS.has(key)) {
      // `from`/`to` fall through to the generic list when they are arrays (the
      // before/after grants), so nothing a verb writes is silently dropped.
      return (key === 'from' || key === 'to') && !hasScalarDelta
    }
    return value !== undefined
  })

  const scalars = rest.filter(([, value]) => !isPlainObject(value) && !Array.isArray(value))
  const lists = rest.filter(([, value]) => Array.isArray(value))
  const objects = rest.filter(([, value]) => isPlainObject(value))

  return (
    <Stack spacing={2.5}>
      {hasGrantDiff ? <GrantDiff added={added} removed={removed} /> : null}

      {hasScalarDelta ? <ValueDelta from={meta.from} to={meta.to} /> : null}

      {fieldChanges.length > 0 ? (
        <Stack spacing={1.5}>
          {fieldChanges.map((change, index) => (
            <ValueDelta
              key={`${change.key ?? index}`}
              label={change.label ?? humanizeMetaKey(change.key)}
              from={change.from}
              to={change.to}
            />
          ))}
        </Stack>
      ) : null}

      {scalars.length > 0 ? (
        <KeyValueList
          dense
          labelWidth={150}
          items={scalars.map(([key, value]) => ({
            label: humanizeMetaKey(key),
            value: <ScalarValue name={key} value={value} />,
          }))}
        />
      ) : null}

      {lists.map(([key, value]) => (
        <Box key={key}>
          <Typography variant="caption" color="text.secondary" component="p" sx={{ mb: 0.75 }}>
            {humanizeMetaKey(key)} ({value.length})
          </Typography>
          {value.length === 0 ? (
            <Typography variant="body2" color="text.disabled">
              None
            </Typography>
          ) : value.every((entry) => !isPlainObject(entry) && !Array.isArray(entry)) ? (
            <ChipList values={value} />
          ) : (
            <JsonBlock value={value} />
          )}
        </Box>
      ))}

      {objects.map(([key, value]) => (
        <Box key={key}>
          <Typography variant="caption" color="text.secondary" component="p" sx={{ mb: 0.75 }}>
            {humanizeMetaKey(key)}
          </Typography>
          <JsonBlock value={value} />
        </Box>
      ))}
    </Stack>
  )
}
