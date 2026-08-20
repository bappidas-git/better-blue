import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import Stack from '@mui/material/Stack'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Typography from '@mui/material/Typography'
import { alpha, useTheme } from '@mui/material/styles'
import useMediaQuery from '@mui/material/useMediaQuery'

import { EMPTY_PLACEHOLDER, formatCurrency } from '@/utils/formatters'

import { WALLET_SIMULATION_NOTE } from '../content/wallet'
import { buildWalletExample, LEDGER_KIND, WALLET_EXAMPLE_INPUT } from '../utils/walletExample'

// The worked example — the whole flow as a six-line statement.
//
// The arithmetic is not written here: `buildWalletExample` derives every figure
// from three inputs, so the table and the prose around it cannot disagree. Money
// is rendered only through `formatCurrency` (00 §8).
//
// Two renderings of the same rows, switched at `sm` the way `DataTable` switches
// its own (00 §13 — a table becomes cards on a phone): a real `<table>` where
// three columns fit, and a stack of labelled blocks at 360px where they do not.
// Only one is mounted, so a screen reader is never offered the statement twice.

/** How each kind of row signs and colours its amount. */
const AMOUNT_STYLE = {
  [LEDGER_KIND.CREDIT]: { sign: '+ ', color: 'success.dark' },
  [LEDGER_KIND.DEBIT]: { sign: '− ', color: 'text.primary' },
  [LEDGER_KIND.NOTE]: { sign: '', color: 'text.primary' },
  [LEDGER_KIND.BALANCE]: { sign: '', color: 'text.primary' },
}

/** Tabular figures, so the column of amounts lines up digit for digit. */
const FIGURE_SX = { fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }

/**
 * The tint behind the payment-link row. An alpha wash rather than a flat hex so
 * it composites on the card's elevated surface (docs/theme-v2.md §3).
 */
const highlightBg = (theme) => alpha(theme.palette.secondary.main, 0.12)

/** One row's movement, e.g. `+ $300.00`, or the em dash on a balance reading. */
function Amount({ row, currency }) {
  if (row.amount == null) {
    return (
      <Typography component="span" color="text.secondary" sx={FIGURE_SX}>
        {EMPTY_PLACEHOLDER}
      </Typography>
    )
  }

  const style = AMOUNT_STYLE[row.kind] ?? AMOUNT_STYLE[LEDGER_KIND.NOTE]

  return (
    <Typography component="span" sx={{ ...FIGURE_SX, color: style.color }}>
      {style.sign}
      {formatCurrency(row.amount, currency)}
    </Typography>
  )
}

/** The "Payment link" marker on the shortfall row. */
function PaymentLinkChip() {
  return (
    <Chip
      size="small"
      color="secondary"
      variant="filled"
      icon={<Icon icon="tabler:link" width={14} aria-hidden="true" />}
      label="Payment link"
      sx={{ alignSelf: 'flex-start' }}
    />
  )
}

/**
 * @param {object} props
 * @param {string} [props.currency='USD'] ISO code the figures are formatted in
 */
export default function WalletExample({ currency = 'USD' }) {
  const theme = useTheme()
  const stacked = useMediaQuery(theme.breakpoints.down('sm'))

  const { rows } = buildWalletExample(WALLET_EXAMPLE_INPUT)

  const caption = `Worked example: a ${formatCurrency(WALLET_EXAMPLE_INPUT.orderTotal, currency, {
    hideDecimals: true,
  })} order funded from a ${formatCurrency(WALLET_EXAMPLE_INPUT.openingBalance, currency, {
    hideDecimals: true,
  })} wallet balance`

  return (
    <Card>
      <CardContent sx={{ p: { xs: 2, sm: 2.5, md: 4 } }}>
        {stacked ? (
          <Box component="ol" sx={{ listStyle: 'none', m: 0, p: 0 }} aria-label={caption}>
            {rows.map((row) => (
              <Stack
                component="li"
                key={row.key}
                spacing={1}
                sx={{
                  p: 2,
                  borderRadius: 2,
                  bgcolor: row.highlight ? highlightBg : 'transparent',
                  '&:not(:last-of-type)': { mb: 1 },
                }}
              >
                <Box>
                  <Typography variant="subtitle2" component="h3">
                    {row.label}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {row.hint}
                  </Typography>
                </Box>

                {row.highlight ? <PaymentLinkChip /> : null}

                <Stack direction="row" spacing={2} justifyContent="space-between">
                  <Box>
                    <Typography variant="caption" component="p" color="text.secondary">
                      Movement
                    </Typography>
                    <Amount row={row} currency={currency} />
                  </Box>

                  <Box sx={{ textAlign: 'right' }}>
                    <Typography variant="caption" component="p" color="text.secondary">
                      Wallet balance
                    </Typography>
                    <Typography component="p" sx={FIGURE_SX}>
                      {formatCurrency(row.balance, currency)}
                    </Typography>
                  </Box>
                </Stack>
              </Stack>
            ))}
          </Box>
        ) : (
          <Table aria-label={caption} size="small">
            <TableHead>
              <TableRow>
                <TableCell scope="col">Step</TableCell>
                <TableCell scope="col" align="right">
                  Movement
                </TableCell>
                <TableCell scope="col" align="right">
                  Wallet balance
                </TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              {rows.map((row) => (
                <TableRow
                  key={row.key}
                  sx={{
                    bgcolor: row.highlight ? highlightBg : 'transparent',
                    // The theme already colours cell borders `divider`; the
                    // closing row simply does not need one.
                    '&:last-of-type > *': { border: 0 },
                  }}
                >
                  <TableCell component="th" scope="row" sx={{ fontWeight: 400 }}>
                    <Stack spacing={0.75} alignItems="flex-start">
                      <Typography variant="subtitle2" component="span">
                        {row.label}
                      </Typography>
                      {row.highlight ? <PaymentLinkChip /> : null}
                      <Typography variant="caption" color="text.secondary">
                        {row.hint}
                      </Typography>
                    </Stack>
                  </TableCell>

                  <TableCell align="right">
                    <Amount row={row} currency={currency} />
                  </TableCell>

                  <TableCell align="right">
                    <Typography component="span" sx={FIGURE_SX}>
                      {formatCurrency(row.balance, currency)}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        <Typography
          variant="caption"
          component="p"
          color="text.secondary"
          sx={{ mt: 3, maxWidth: '68ch' }}
        >
          {WALLET_SIMULATION_NOTE}
        </Typography>
      </CardContent>
    </Card>
  )
}
