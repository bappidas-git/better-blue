import { useState } from 'react'

import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Collapse from '@mui/material/Collapse'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'

import { env } from '@/config/env'
import { formatCardNumber } from '@/features/checkout/cardUtils'
import { DUMMY_TEST_CARDS } from '@/services/paymentService'

// A one-click way to reach each of the three outcomes the prototype's processor
// can produce — success, a plain decline, and a decline for insufficient funds.
//
// **Development only.** Gated on `import.meta.env.DEV && env.enableDevPages`,
// the same two independent switches as `DemoAccountsPanel`. `import.meta.env.DEV`
// is read here rather than through `env` deliberately (the one exception to
// 00 §4, shared with that component): Vite replaces it at build time, so this
// panel and the card numbers in it are eliminated from a production bundle
// rather than merely hidden. Reading it through `env.isDev` — a runtime
// property — would leave the markup and the digits in the shipped chunk.
//
// The cards come from `paymentService`, which re-exports them precisely so a
// screen can show them **without importing `services/payments/`** (Prompt 17
// §7). Nothing here knows the outcome is decided from the digits — it just
// prints what the export says.

/** A card is good until the end of its printed month; three years out is safe. */
function demoExpiry(now = new Date()) {
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const year = String((now.getFullYear() + 3) % 100).padStart(2, '0')
  return `${month}/${year}`
}

/** Iconify name per outcome, so success and failure read apart at a glance. */
const OUTCOME_ICON = {
  succeeded: 'solar:check-circle-linear',
  failed: 'solar:close-circle-linear',
}

/**
 * @param {object} props
 * @param {(values: object) => void} props.onFill receives the card form values to apply
 * @param {boolean} [props.disabled=false] frozen while a charge is in flight
 */
export default function TestCardPanel({ onFill, disabled = false }) {
  const [open, setOpen] = useState(false)

  if (!import.meta.env.DEV || !env.enableDevPages) return null

  // The form keeps a name that has already been typed; this one only fills the
  // blank.
  const apply = (card) => {
    onFill?.({
      cardholderName: 'Demo Buyer',
      cardNumber: formatCardNumber(card.number),
      expiry: demoExpiry(),
      cvv: '123',
    })
  }

  return (
    <Box
      sx={{
        border: 1,
        borderColor: 'divider',
        borderStyle: 'dashed',
        borderRadius: 2,
        bgcolor: 'background.default',
      }}
    >
      <Button
        onClick={() => setOpen((shown) => !shown)}
        fullWidth
        color="inherit"
        aria-expanded={open}
        aria-controls="test-card-panel"
        startIcon={<Icon icon="solar:test-tube-linear" width={18} aria-hidden="true" />}
        endIcon={
          <Icon
            icon={open ? 'solar:alt-arrow-up-linear' : 'solar:alt-arrow-down-linear'}
            width={18}
            aria-hidden="true"
          />
        }
        sx={{ justifyContent: 'space-between', px: 2, py: 1.25, minHeight: 44 }}
      >
        <Box component="span" sx={{ typography: 'body2', fontWeight: 600 }}>
          Test cards (development only)
        </Box>
      </Button>

      <Collapse in={open} unmountOnExit>
        <Stack spacing={1.25} id="test-card-panel" sx={{ px: 2, pb: 2 }}>
          <Typography variant="caption" color="text.secondary">
            Fills the form below. Nothing is charged and none of these numbers belongs to anyone.
          </Typography>

          {DUMMY_TEST_CARDS.map((card) => (
            <Button
              key={card.number}
              onClick={() => apply(card)}
              disabled={disabled}
              variant="outlined"
              color="inherit"
              startIcon={
                <Icon
                  icon={OUTCOME_ICON[card.outcome] ?? 'solar:card-linear'}
                  width={20}
                  aria-hidden="true"
                />
              }
              sx={{ justifyContent: 'flex-start', textAlign: 'left', px: 1.75, py: 1.25 }}
            >
              <Box sx={{ minWidth: 0 }}>
                <Box
                  component="span"
                  sx={{ display: 'block', typography: 'body2', fontWeight: 600 }}
                >
                  {card.label}
                </Box>
                <Box
                  component="span"
                  sx={{
                    display: 'block',
                    typography: 'caption',
                    color: 'text.secondary',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {card.number} — {card.description}
                </Box>
              </Box>
            </Button>
          ))}
        </Stack>
      </Collapse>
    </Box>
  )
}
