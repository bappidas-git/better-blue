// The worked example on the Wallet page, as arithmetic rather than as prose.
//
// Only three numbers are written down — what the buyer holds, what the order
// comes to, and what they top up by. Every other figure on the statement (the
// shortfall, the balance after the recharge, what is left afterwards) is
// derived, so the page cannot contradict itself and a different example is a
// one-line change to `WALLET_EXAMPLE_INPUT`.
//
// Nothing here reads or writes a balance: these are teaching figures on an
// informational page (V2-10 scope guard). The real money path — order funding,
// escrow, release — lives in `services/payments/` and is untouched.

/** The three given quantities of the example. Plain USD-scale numbers. */
export const WALLET_EXAMPLE_INPUT = Object.freeze({
  /** What the buyer's Wallet holds before the order. */
  openingBalance: 150,
  /** The order they want to fund — matches Pricing's own worked example. */
  orderTotal: 400,
  /** What they choose to top up by. More than the shortfall, deliberately. */
  rechargeAmount: 300,
})

/** How a statement row moves the balance — drives the row's sign and colour. */
export const LEDGER_KIND = Object.freeze({
  /** A balance reading, not a movement: the opening and closing rows. */
  BALANCE: 'balance',
  /** Money into the Wallet. */
  CREDIT: 'credit',
  /** Money out of the Wallet. */
  DEBIT: 'debit',
  /** A figure that is neither — the order total and the shortfall. */
  NOTE: 'note',
})

/**
 * Builds the statement rows for the example.
 *
 * @param {{openingBalance: number, orderTotal: number, rechargeAmount: number}} [input]
 * @returns {{
 *   shortfall: number,
 *   balanceAfterRecharge: number,
 *   closingBalance: number,
 *   rows: {key: string, label: string, hint: string, kind: string,
 *          amount: number|null, balance: number|null, highlight?: boolean}[]
 * }} the derived figures plus the rows to render, in order
 */
export function buildWalletExample(input = WALLET_EXAMPLE_INPUT) {
  const { openingBalance, orderTotal, rechargeAmount } = input

  const shortfall = Math.max(orderTotal - openingBalance, 0)
  const balanceAfterRecharge = openingBalance + rechargeAmount
  const closingBalance = balanceAfterRecharge - orderTotal

  const rows = [
    {
      key: 'opening',
      label: 'Wallet balance',
      hint: 'What the Wallet holds before this order',
      kind: LEDGER_KIND.BALANCE,
      amount: null,
      balance: openingBalance,
    },
    {
      key: 'order',
      label: 'Order total',
      hint: 'The proposal the buyer accepted, funded in full',
      kind: LEDGER_KIND.NOTE,
      amount: orderTotal,
      balance: openingBalance,
    },
    {
      key: 'shortfall',
      label: 'Shortfall — payment link issued',
      hint: 'The balance cannot cover the order, so BetterBlue issues a payment link for exactly the difference',
      kind: LEDGER_KIND.NOTE,
      amount: shortfall,
      balance: openingBalance,
      // The step the whole page is about — the statement calls it out.
      highlight: true,
    },
    {
      key: 'recharge',
      label: 'Recharge via the payment link',
      hint: 'Topped up by more than the shortfall — the surplus stays in the Wallet',
      kind: LEDGER_KIND.CREDIT,
      amount: rechargeAmount,
      balance: balanceAfterRecharge,
    },
    {
      key: 'funded',
      label: 'Order funded — held in escrow',
      hint: 'Released to the creator when the delivery is approved',
      kind: LEDGER_KIND.DEBIT,
      amount: orderTotal,
      balance: closingBalance,
    },
    {
      key: 'closing',
      label: 'Remaining balance',
      hint: 'Ready for the next order, no top-up needed',
      kind: LEDGER_KIND.BALANCE,
      amount: null,
      balance: closingBalance,
    },
  ]

  return { shortfall, balanceAfterRecharge, closingBalance, rows }
}

export default buildWalletExample
