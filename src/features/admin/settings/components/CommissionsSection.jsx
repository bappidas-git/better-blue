import { useCallback, useState } from 'react'

import { Icon } from '@iconify/react'
import Alert from '@mui/material/Alert'
import AlertTitle from '@mui/material/AlertTitle'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import InputAdornment from '@mui/material/InputAdornment'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'

import FormTextField from '@/components/inputs/FormTextField'
import DataTable from '@/components/table/DataTable'
import SettingsField from '@/features/admin/settings/components/SettingsField'
import {
  COMMISSION_EXAMPLE_ORDER,
  SETTINGS_BOUNDS,
  percentToRate,
} from '@/features/admin/settings/utils/settingsSchema'
import { formatCurrency, formatPercent } from '@/utils/formatters'
import { applyRate, subtractMoney } from '@/utils/money'

// Commissions — Prompt 35 §4.3.
//
// The default rate, the per-category overrides, and the one thing a reader
// changing a rate most needs to know: **it does not reprice work already
// agreed.** Prompt 17 freezes `commissionRate` onto the order at award time, so
// a rate change reaches future acceptances only. That is stated on the screen
// rather than left as tribal knowledge, because the alternative is somebody
// dropping the rate to fix a specific creator's pay and finding it did nothing.
//
// The worked example recomputes as the reader types, through the same
// `applyRate` every order uses — so what the screen promises and what the
// ledger does cannot disagree by a rounding rule.

/** The live "on a $400 order" line, recomputed on every keystroke. */
function RateExample({ percent, label }) {
  const rate = percentToRate(percent)
  if (rate === null) return null

  const commission = applyRate(COMMISSION_EXAMPLE_ORDER, rate)
  const creator = subtractMoney(COMMISSION_EXAMPLE_ORDER, commission)

  return (
    <Stack
      direction="row"
      spacing={1}
      alignItems="center"
      flexWrap="wrap"
      useFlexGap
      role="status"
      sx={{ mt: 1.25 }}
    >
      <Icon icon="solar:calculator-minimalistic-linear" width={18} aria-hidden="true" />
      <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums' }}>
        {label ?? `On a ${formatCurrency(COMMISSION_EXAMPLE_ORDER, 'USD', { hideDecimals: true })} order:`}{' '}
        <Box component="strong">BetterBlue {formatCurrency(commission)}</Box>
        {' · '}
        <Box component="strong">Creator {formatCurrency(creator)}</Box>
      </Typography>
    </Stack>
  )
}

/** The inline editor a single override row swaps to. */
function OverrideEditor({ category, value, onCommit, onCancel }) {
  const [draft, setDraft] = useState(value ?? '')
  const { min, max } = SETTINGS_BOUNDS.commissionPercent
  const parsed = Number(draft)
  const invalid = draft === '' || !Number.isFinite(parsed) || parsed < min || parsed > max

  return (
    <Stack direction="row" spacing={1} alignItems="flex-start">
      <TextField
        autoFocus
        size="small"
        type="number"
        label={`${category.name} rate`}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !invalid) onCommit(parsed)
          if (event.key === 'Escape') onCancel()
        }}
        error={draft !== '' && invalid}
        helperText={draft !== '' && invalid ? `${min}–${max}%` : ' '}
        inputProps={{ min, max, step: 0.5, inputMode: 'decimal', 'aria-label': `${category.name} commission rate, percent` }}
        InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }}
        sx={{ width: 140 }}
      />
      <Button
        size="small"
        variant="contained"
        disabled={invalid}
        onClick={() => onCommit(parsed)}
        sx={{ minHeight: 40, mt: 0.25 }}
      >
        Set
      </Button>
      <Button size="small" color="inherit" onClick={onCancel} sx={{ minHeight: 40, mt: 0.25 }}>
        Cancel
      </Button>
    </Stack>
  )
}

/**
 * @param {object} props
 * @param {import('@/hooks/useForm').UseFormResult} props.form the section's form
 * @param {object[]} props.categories every category, active and inactive
 * @param {boolean} [props.categoriesLoading]
 */
export default function CommissionsSection({ form, categories = [], categoriesLoading = false }) {
  const [editing, setEditing] = useState(null)
  const overrides = form.values.categoryOverrides ?? {}
  const { min: lowest, max: highest } = SETTINGS_BOUNDS.commissionPercent

  const setOverride = useCallback(
    (categoryId, percent) => {
      form.setValue('categoryOverrides', { ...(form.values.categoryOverrides ?? {}), [categoryId]: percent })
      setEditing(null)
    },
    [form]
  )

  const clearOverride = useCallback(
    (categoryId) => {
      const next = { ...(form.values.categoryOverrides ?? {}) }
      delete next[categoryId]
      form.setValue('categoryOverrides', next)
      setEditing(null)
    },
    [form]
  )

  // The inline editor refuses an out-of-bounds value, so the only way to arrive
  // at one is a rate stored before these bounds existed (or written straight to
  // the API). It still blocks the save, so it has to say *which row* — a save
  // bar reading "fix the highlighted fields" with nothing highlighted is a dead
  // end (§13).
  const invalidOverrides = Object.entries(overrides).filter(([, percent]) => {
    const value = Number(percent)
    return !Number.isFinite(value) || value < lowest || value > highest
  })

  const rateCell = (category) => {
    if (editing === category.id) {
      return (
        <OverrideEditor
          category={category}
          value={overrides[category.id]}
          onCommit={(percent) => setOverride(category.id, percent)}
          onCancel={() => setEditing(null)}
        />
      )
    }

    const percent = overrides[category.id]
    return percent === undefined ? (
      <Chip label="Default" size="small" variant="outlined" />
    ) : (
      <Typography variant="body2" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
        {formatPercent(percent / 100, { maximumFractionDigits: 2 })}
      </Typography>
    )
  }

  const rowActions = (category) => {
    if (editing === category.id) return null
    const hasOverride = overrides[category.id] !== undefined

    return (
      <Stack direction="row" spacing={0.5} justifyContent="flex-end">
        <Tooltip title={hasOverride ? 'Edit override' : 'Set an override'}>
          <IconButton
            size="small"
            onClick={() => setEditing(category.id)}
            aria-label={`${hasOverride ? 'Edit' : 'Set'} the commission override for ${category.name}`}
            sx={{ width: 44, height: 44 }}
          >
            <Icon icon="solar:pen-new-square-linear" width={18} />
          </IconButton>
        </Tooltip>
        {hasOverride ? (
          <Tooltip title="Use the default rate">
            <IconButton
              size="small"
              onClick={() => clearOverride(category.id)}
              aria-label={`Clear the commission override for ${category.name} and use the default rate`}
              sx={{ width: 44, height: 44 }}
            >
              <Icon icon="solar:restart-linear" width={18} />
            </IconButton>
          </Tooltip>
        ) : null}
      </Stack>
    )
  }

  const columns = [
    {
      key: 'name',
      label: 'Category',
      render: (category) => (
        <Stack direction="row" spacing={1} alignItems="center">
          <Icon icon={category.icon} width={20} aria-hidden="true" />
          <Box>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {category.name}
            </Typography>
            {category.active === false ? (
              <Typography variant="caption" color="text.secondary">
                Inactive
              </Typography>
            ) : null}
          </Box>
        </Stack>
      ),
    },
    { key: 'rate', label: 'Commission', render: rateCell },
    { key: 'actions', label: '', align: 'right', width: 120, render: rowActions },
  ]

  const renderMobileCard = (category) => (
    <Card variant="outlined" sx={{ p: 2 }}>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
        <Icon icon={category.icon} width={20} aria-hidden="true" />
        <Typography variant="subtitle2" sx={{ flexGrow: 1 }}>
          {category.name}
        </Typography>
        {rowActions(category)}
      </Stack>
      {rateCell(category)}
    </Card>
  )

  return (
    <Stack spacing={{ xs: 2, md: 2.5 }}>
      <Card>
        <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
          <Typography variant="subtitle1" component="h2" sx={{ fontWeight: 700, mb: 0.5 }}>
            Default rate
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5, maxWidth: '68ch' }}>
            What BetterBlue keeps from an order whose category has no override.
          </Typography>

          <SettingsField
            helper={`Applied when a proposal is accepted and frozen onto the order. The creator sees their net earnings before they price a proposal, and the pricing page quotes it publicly. Between ${lowest}% and ${highest}%.`}
            usedBy={['Pricing page', 'Proposal earnings preview', 'Order award', 'Admin › Commissions']}
          >
            <Box sx={{ maxWidth: 260 }}>
              <FormTextField
                label="Default commission"
                type="number"
                required
                inputProps={{
                  min: lowest,
                  max: highest,
                  step: 0.5,
                  inputMode: 'decimal',
                  'aria-label': 'Default commission rate, percent',
                }}
                endAdornment={<InputAdornment position="end">%</InputAdornment>}
                {...form.fieldProps('defaultRatePercent')}
              />
            </Box>
            <RateExample percent={form.values.defaultRatePercent} />
          </SettingsField>
        </CardContent>
      </Card>

      <Card>
        <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
          <Typography variant="subtitle1" component="h2" sx={{ fontWeight: 700, mb: 0.5 }}>
            Category overrides
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5, maxWidth: '68ch' }}>
            A category with an override uses it instead of the default. Everything left on “Default”
            follows the rate above, so removing an override is how you undo one — there is no zero.
          </Typography>

          {invalidOverrides.length > 0 ? (
            <Alert severity="error" sx={{ mb: 2 }}>
              <AlertTitle sx={{ mb: 0.5 }}>
                {invalidOverrides.length === 1
                  ? 'One override is outside the allowed range'
                  : `${invalidOverrides.length} overrides are outside the allowed range`}
              </AlertTitle>
              Edit or clear{' '}
              {invalidOverrides
                .map(([id]) => categories.find((category) => category.id === id)?.name ?? id)
                .join(', ')}{' '}
              — every rate must be between {lowest}% and {highest}%.
            </Alert>
          ) : null}

          <DataTable
            columns={columns}
            rows={categories}
            loading={categoriesLoading}
            ariaLabel="Commission rate by category"
            stickyHeader={false}
            emptyState={{
              icon: 'solar:widget-4-linear',
              title: 'No categories yet',
              description: 'Add one in Categories and it will appear here.',
            }}
            renderMobileCard={renderMobileCard}
          />
        </CardContent>
      </Card>

      <Alert severity="info" icon={<Icon icon="solar:lock-keyhole-minimalistic-linear" width={22} />}>
        <AlertTitle sx={{ mb: 0.5 }}>Rate changes affect future acceptances only</AlertTitle>
        Every order carries the commission rate it was awarded at — it is frozen onto the record when
        the proposal is accepted, so escrow, the creator’s payout, and the ledger all agree for the
        life of the engagement. Changing a rate here never reprices work already agreed, and the
        Commissions report keeps showing each order at the rate it was struck.
      </Alert>

      <Alert severity="info" icon={<Icon icon="solar:user-hand-up-linear" width={22} />}>
        <AlertTitle sx={{ mb: 0.5 }}>Per-creator rates are not here yet</AlertTitle>
        The commission calculator already accepts a creator alongside a category, so a negotiated
        rate for an individual creator can be added without touching any call site. Until it exists,
        the default and these category overrides are the whole story.
      </Alert>
    </Stack>
  )
}
