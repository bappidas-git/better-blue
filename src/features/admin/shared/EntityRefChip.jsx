import { Icon } from '@iconify/react'
import Chip from '@mui/material/Chip'
import Tooltip from '@mui/material/Tooltip'

import { useLinkProps } from '@/hooks/useLinkProps'
import { truncate } from '@/utils/formatters'

import { getEntityMeta, resolveEntityPath } from './entityRefs'

// The admin console's cross-reference: "this dispute is about *that* order".
//
// Every admin screen ends up pointing at records owned by another screen — a
// queue row at its order, an audit entry at the account it touched, a payout at
// its creator. One chip renders all of them, so a reference looks and behaves
// the same wherever it appears, and the id → route mapping lives in exactly one
// place (`entityRefs.js`) instead of being re-derived per feature.

/**
 * @param {object} props
 * @param {string} props.type entity type — an `auditLogs.entityType` value
 * @param {string} [props.id] the record's id, e.g. `ord_012`
 * @param {React.ReactNode} [props.label] what to show instead of the id — a
 *   title, a member's name. The id stays in the tooltip either way.
 * @param {number} [props.maxLabelLength=32] where a long title is truncated
 * @param {boolean} [props.showType=false] prefix the label with the type, e.g.
 *   "Order · Menu photography" — for feeds that mix entity types
 * @param {'sm'|'md'} [props.size='sm'] chip size
 * @param {object} [props.sx] MUI system styles
 */
export default function EntityRefChip({
  type,
  id,
  label,
  maxLabelLength = 32,
  showType = false,
  size = 'sm',
  sx,
  ...rest
}) {
  const meta = getEntityMeta(type)
  const to = resolveEntityPath(type, id)
  const linkProps = useLinkProps(to)

  const text = typeof label === 'string' ? truncate(label, maxLabelLength) : (label ?? id)
  const body = showType ? `${meta.label} · ${text}` : text

  const chip = (
    <Chip
      icon={<Icon icon={meta.icon} width={15} aria-hidden="true" />}
      label={body}
      size={size === 'sm' ? 'small' : 'medium'}
      variant="outlined"
      clickable={Boolean(to)}
      sx={{
        maxWidth: '100%',
        fontSize: '0.75rem',
        '& .MuiChip-icon': { color: 'text.secondary', ml: 1 },
        ...sx,
      }}
      {...linkProps}
      {...rest}
    />
  )

  // The tooltip is where the opaque id lives: it is what an admin quotes in a
  // ticket, but it is not what they read a queue by.
  const title = [meta.label, id].filter(Boolean).join(' · ')
  return (
    <Tooltip title={title}>
      <span style={{ display: 'inline-flex', maxWidth: '100%' }}>{chip}</span>
    </Tooltip>
  )
}
