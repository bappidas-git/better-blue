import { useState } from 'react'

import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Collapse from '@mui/material/Collapse'
import Divider from '@mui/material/Divider'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { alpha } from '@mui/material/styles'

// "How payouts work" — the four moves money makes between a buyer's card and a
// creator's bank, in the order they happen (`docs/payments.md` §4).
//
// Collapsed by default and opened by choice: a creator who already knows this
// should not have to scroll past it every visit, and one who is looking at the
// word "escrow" for the first time needs it on the same screen as the number it
// is describing rather than on a help page.

/** The four steps, oldest concept first. `owner` is who is holding the money. */
const STEPS = Object.freeze([
  Object.freeze({
    key: 'escrow',
    icon: 'solar:lock-keyhole-linear',
    title: 'Escrow',
    body: 'The buyer funds the order before you start. BetterBlue holds the money — the buyer cannot take it back on a whim, and it is not yours yet.',
  }),
  Object.freeze({
    key: 'release',
    icon: 'solar:check-circle-linear',
    title: 'Release',
    body: 'The buyer accepts your delivery. The escrow is released to your BetterBlue balance, less the commission agreed when the order was awarded.',
  }),
  Object.freeze({
    key: 'withdraw',
    icon: 'solar:card-transfer-linear',
    title: 'Withdraw',
    body: 'You request a payout of whatever is available. The amount is reserved out of your balance straight away, so it cannot be requested twice.',
  }),
  Object.freeze({
    key: 'processed',
    icon: 'solar:banknote-2-linear',
    title: 'Processed',
    body: 'Our finance team checks the request and sends the money to your bank — typically within three business days.',
  }),
])

/** One numbered step in the mini visual. */
function Step({ step, index, isLast }) {
  return (
    <Stack
      component="li"
      direction={{ xs: 'row', md: 'column' }}
      spacing={{ xs: 1.75, md: 1.25 }}
      alignItems={{ xs: 'flex-start', md: 'center' }}
      sx={{ flex: 1, minWidth: 0, textAlign: { xs: 'left', md: 'center' } }}
    >
      <Box sx={{ position: 'relative', display: 'flex', flexShrink: 0 }}>
        <Box
          aria-hidden="true"
          sx={{
            width: 44,
            height: 44,
            borderRadius: '50%',
            display: 'grid',
            placeItems: 'center',
            color: 'primary.main',
            bgcolor: (theme) => alpha(theme.palette.primary.main, 0.1),
          }}
        >
          <Icon icon={step.icon} width={22} />
        </Box>
        {/* The connector: a vertical rail on a phone, drawn by the row's own
            gap on desktop, so the four steps read as one sequence either way. */}
        {isLast ? null : (
          <Box
            aria-hidden="true"
            sx={{
              display: { xs: 'block', md: 'none' },
              position: 'absolute',
              left: 21,
              top: 48,
              width: 2,
              height: 'calc(100% + 4px)',
              bgcolor: 'divider',
            }}
          />
        )}
      </Box>

      <Box sx={{ minWidth: 0, pb: { xs: 2, md: 0 } }}>
        <Typography variant="subtitle2" component="h4">
          {index + 1}. {step.title}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
          {step.body}
        </Typography>
      </Box>
    </Stack>
  )
}

/**
 * @param {object} props
 * @param {boolean} [props.defaultOpen=false] start expanded
 */
export default function PayoutExplainer({ defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <Card>
      <CardContent sx={{ p: { xs: 2, md: 2.5 }, '&:last-child': { pb: { xs: 2, md: 2.5 } } }}>
        <Stack
          component="button"
          type="button"
          direction="row"
          spacing={1.5}
          alignItems="center"
          onClick={() => setOpen((current) => !current)}
          aria-expanded={open}
          aria-controls="payout-explainer-steps"
          sx={{
            width: '100%',
            minHeight: 44,
            border: 0,
            p: 0,
            bgcolor: 'transparent',
            cursor: 'pointer',
            textAlign: 'left',
            color: 'inherit',
            font: 'inherit',
            '&:focus-visible': {
              outline: (theme) => `2px solid ${theme.palette.primary.main}`,
              outlineOffset: 4,
              borderRadius: 1,
            },
          }}
        >
          <Box aria-hidden="true" sx={{ display: 'flex', color: 'primary.main' }}>
            <Icon icon="solar:question-circle-linear" width={22} />
          </Box>
          <Typography variant="subtitle2" component="h3" sx={{ flexGrow: 1 }}>
            How payouts work
          </Typography>
          <Box
            aria-hidden="true"
            sx={{
              display: 'flex',
              color: 'text.secondary',
              transform: open ? 'rotate(180deg)' : 'none',
              transition: (theme) => theme.transitions.create('transform'),
            }}
          >
            <Icon icon="tabler:chevron-down" width={20} />
          </Box>
        </Stack>

        <Collapse in={open} unmountOnExit>
          <Divider sx={{ my: 2 }} />
          <Stack
            component="ol"
            id="payout-explainer-steps"
            direction={{ xs: 'column', md: 'row' }}
            spacing={{ xs: 0, md: 3 }}
            sx={{ listStyle: 'none', m: 0, p: 0 }}
          >
            {STEPS.map((step, index) => (
              <Step
                key={step.key}
                step={step}
                index={index}
                isLast={index === STEPS.length - 1}
              />
            ))}
          </Stack>
        </Collapse>
      </CardContent>
    </Card>
  )
}
