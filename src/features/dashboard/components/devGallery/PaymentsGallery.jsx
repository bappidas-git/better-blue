import { useState } from 'react'

import { Icon } from '@iconify/react'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Stack,
  Typography,
} from '@mui/material'

import CurrencyField from '@/components/inputs/CurrencyField'
import FormSelect from '@/components/inputs/FormSelect'
import { useApiQuery } from '@/hooks/useApiQuery'
import { categoryService, DUMMY_TEST_CARDS, paymentService } from '@/services'
import { formatCurrency, formatPercent } from '@/utils/formatters'
import { subtractMoney } from '@/utils/money'

import GalleryBlock from './GalleryBlock'

// Dev-only verification surface for Prompt 17 (payments & escrow). There is no
// buyer-facing payment UI yet — Prompt 19 builds checkout on top of this
// service layer — so this panel exists to prove two things by hand:
//
//   1. the dummy provider's test cards and what each one does, and
//   2. that `computeCommission` really reads the live platform settings,
//      including a category override an admin has set.
//
// Everything goes through `@/services`; the provider modules stay behind
// `paymentService` (Prompt 17 §7), which is why the cards arrive from the
// services barrel rather than from `services/payments/`.

const OUTCOME_TONE = {
  succeeded: 'success',
  failed: 'error',
}

/* --- Test cards ----------------------------------------------------------- */

function TestCards() {
  return (
    <Stack spacing={2}>
      <Alert severity="info" icon={<Icon icon="tabler:credit-card" width={20} />}>
        Simulated cards. No request leaves the browser and no money moves — the outcome is decided
        from the digits, after a fixed 1.2 second processing delay.
      </Alert>

      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' },
        }}
      >
        {DUMMY_TEST_CARDS.map((card) => (
          <Card key={card.number} variant="outlined">
            <CardContent>
              <Stack spacing={1.5}>
                <Typography variant="subtitle2">{card.label}</Typography>
                <Typography
                  variant="body2"
                  sx={{ fontFamily: 'monospace', letterSpacing: '0.04em' }}
                >
                  {card.number}
                </Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  <Chip
                    size="small"
                    color={OUTCOME_TONE[card.outcome] ?? 'default'}
                    label={card.outcome}
                  />
                  {card.failureCode ? <Chip size="small" label={card.failureCode} /> : null}
                </Stack>
                <Typography variant="caption" color="text.secondary">
                  {card.description}
                </Typography>
              </Stack>
            </CardContent>
          </Card>
        ))}
      </Box>
    </Stack>
  )
}

/* --- Commission calculator ------------------------------------------------ */

function CommissionDemo() {
  const categories = useApiQuery(() => categoryService.listActive(), [])
  const [amount, setAmount] = useState(940)
  const [categoryId, setCategoryId] = useState('')
  const [result, setResult] = useState(null)
  const [isRunning, setRunning] = useState(false)

  const options = [
    { value: '', label: 'No category (platform default rate)' },
    ...(categories.data ?? []).map((entry) => ({ value: entry.id, label: entry.name })),
  ]

  const run = async () => {
    setRunning(true)
    try {
      const commission = await paymentService.computeCommission(Number(amount) || 0, {
        categoryId: categoryId || undefined,
      })
      setResult(commission)
    } finally {
      setRunning(false)
    }
  }

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="flex-start">
        <CurrencyField
          label="Order price"
          value={amount}
          onChange={(next) => {
            setAmount(next)
            setResult(null)
          }}
          helperText="The base the fee is charged on."
        />
        <FormSelect
          label="Category"
          value={categoryId}
          onChange={(next) => {
            setCategoryId(next)
            setResult(null)
          }}
          options={options}
          helperText="A category override in platformSettings beats the default rate."
        />
      </Stack>

      <Stack direction="row" spacing={1.5}>
        <Button
          variant="contained"
          onClick={run}
          disabled={isRunning}
          startIcon={<Icon icon="tabler:calculator" width={18} />}
        >
          {isRunning ? 'Computing…' : 'Compute commission'}
        </Button>
        {result ? (
          <Button variant="text" onClick={() => setResult(null)}>
            Clear
          </Button>
        ) : null}
      </Stack>

      {result ? (
        <Card variant="outlined">
          <CardContent>
            <Stack spacing={1}>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Chip size="small" label={`rate: ${formatPercent(result.rate)}`} />
                <Chip size="small" label={`commission: ${formatCurrency(result.amount)}`} />
                <Chip
                  size="small"
                  color="success"
                  label={`creator earns: ${formatCurrency(
                    subtractMoney(Number(amount) || 0, result.amount)
                  )}`}
                />
              </Stack>
              <Typography variant="caption" color="text.secondary">
                Live from <code>platformSettings.commission</code> through{' '}
                <code>settingsService</code>. Set a category override in the settings singleton and
                recompute — the rate here must follow it, and <code>npm run seed</code> restores the
                default.
              </Typography>
            </Stack>
          </CardContent>
        </Card>
      ) : null}
    </Stack>
  )
}

/* --- Panel ---------------------------------------------------------------- */

export default function PaymentsGallery() {
  return (
    <Stack spacing={{ xs: 6, md: 8 }}>
      <GalleryBlock
        title="Dummy provider test cards"
        caption="DUMMY_TEST_CARDS, exported by paymentService for the checkout screen Prompt 19 builds. The rules are deterministic: a number ending 0002 is declined, 9995 is declined for insufficient funds, and any other valid 16-digit number succeeds."
      >
        <TestCards />
      </GalleryBlock>

      <GalleryBlock
        title="Commission calculator"
        caption="paymentService.computeCommission against the live settings singleton — the same call acceptProposal makes when it freezes a rate onto an order, and the release path makes when it writes the commission record."
      >
        <CommissionDemo />
      </GalleryBlock>
    </Stack>
  )
}
