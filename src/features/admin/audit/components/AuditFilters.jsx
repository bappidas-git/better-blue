import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'

import FormDateField from '@/components/inputs/FormDateField'
import FormSelect from '@/components/inputs/FormSelect'
import SearchInput from '@/components/inputs/SearchInput'
import {
  AUDIT_NAMESPACE_OPTIONS,
  ENTITY_TYPE_OPTIONS,
} from '@/features/admin/audit/utils/auditFilters'

// The explorer's toolbar — Prompt 36 §4.4.
//
// Four filters and a search, in the order an investigation narrows: **who**,
// **what kind of action**, **what it was about**, **when**, and finally the
// exact record. Every one of them is a URL parameter, so a narrowed view is a
// link somebody can paste into a ticket (00 §12).
//
// The whole row wraps to one column below md and each control keeps a 44px
// target, which is what makes this usable on a phone at 360px (§11).

/** The empty option every select carries — "no filter", not "unknown". */
const ANY = ''

/**
 * @param {object} props
 * @param {object} props.values parsed query values from `useListParams`
 * @param {(key: string, value: *) => void} props.onChange
 * @param {() => void} props.onClear
 * @param {boolean} props.isFiltered whether anything is narrowing the list
 * @param {{value: string, label: string}[]} [props.actorOptions] the admin team,
 *   loaded by the page — an empty list simply leaves the select with "Anyone"
 * @param {boolean} [props.actorsLoading]
 */
export default function AuditFilters({
  values,
  onChange,
  onClear,
  isFiltered,
  actorOptions = [],
  actorsLoading = false,
}) {
  return (
    <Stack spacing={1.5}>
      <Stack
        direction={{ xs: 'column', lg: 'row' }}
        spacing={1.5}
        alignItems={{ xs: 'stretch', lg: 'flex-start' }}
      >
        <Box sx={{ minWidth: { lg: 200 } }}>
          <FormSelect
            label="Actor"
            size="small"
            value={values.actor || ANY}
            onChange={(next) => onChange('actor', next)}
            placeholder={actorsLoading ? 'Loading team…' : 'Anyone'}
            options={actorOptions}
            helperText="Who took the action"
          />
        </Box>

        <Box sx={{ minWidth: { lg: 190 } }}>
          <FormSelect
            label="Action"
            size="small"
            value={values.ns || ANY}
            onChange={(next) => onChange('ns', next)}
            placeholder="Every action"
            options={AUDIT_NAMESPACE_OPTIONS}
            helperText="The area it belongs to"
          />
        </Box>

        <Box sx={{ minWidth: { lg: 180 } }}>
          <FormSelect
            label="Entity"
            size="small"
            value={values.entity || ANY}
            onChange={(next) => onChange('entity', next)}
            placeholder="Any record"
            options={ENTITY_TYPE_OPTIONS}
            helperText="What was acted on"
          />
        </Box>

        <Stack direction="row" spacing={1} sx={{ minWidth: { lg: 320 } }}>
          <FormDateField
            label="From"
            value={values.from}
            onChange={(next) => onChange('from', next ?? '')}
            maxDate={values.to || undefined}
          />
          <FormDateField
            label="To"
            value={values.to}
            onChange={(next) => onChange('to', next ?? '')}
            minDate={values.from || undefined}
          />
        </Stack>
      </Stack>

      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1.5}
        alignItems={{ xs: 'stretch', sm: 'center' }}
      >
        <Box sx={{ flexGrow: 1, minWidth: 0, maxWidth: { sm: 420 } }}>
          <SearchInput
            value={values.q}
            onChange={(next) => onChange('q', next)}
            placeholder="Entity ID, e.g. ord_012 or usr_creator_ava"
            label="Find every entry about one record by its ID"
          />
        </Box>

        {isFiltered ? (
          <Button
            onClick={onClear}
            color="inherit"
            startIcon={<Icon icon="tabler:x" width={16} aria-hidden="true" />}
            sx={{ minHeight: 44, alignSelf: { xs: 'stretch', sm: 'center' } }}
          >
            Clear filters
          </Button>
        ) : null}
      </Stack>
    </Stack>
  )
}
