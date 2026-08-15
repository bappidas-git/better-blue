import useApiQuery from '@/hooks/useApiQuery'
import { paymentService } from '@/services/paymentService'
import { subtractMoney } from '@/utils/money'

// What an amount is actually worth to the creator, after BetterBlue's fee.
//
// The rate is never hardcoded and never guessed: it comes from
// `paymentService.computeCommission`, the same function `orderService` calls
// when it freezes a rate onto an order at award time (Prompt 17). So the figure
// a creator is shown while pricing a proposal is the figure they are paid, and
// category overrides are honoured without anything here knowing they exist.
//
// The settings singleton is cached for a minute by `settingsService`, so this
// costs one request per session however many cards ask for it.

/**
 * @param {number|string} amount the gross amount
 * @param {object} [context]
 * @param {string} [context.categoryId] `cat_…` — a category override beats the default
 * @param {string} [context.creatorId] `usr_…` — reserved for per-creator rates (Prompt 35)
 * @returns {{rate: number|null, commission: number|null, net: number|null,
 *   isLoading: boolean, isPriced: boolean}} everything is `null` until the rate
 *   resolves, and while `amount` is not a positive number
 */
export default function useCommission(amount, { categoryId, creatorId } = {}) {
  const gross = Number(amount)
  const isPriced = Number.isFinite(gross) && gross > 0

  const { data, isLoading } = useApiQuery(
    () => paymentService.computeCommission(gross, { categoryId, creatorId }),
    [gross, categoryId, creatorId],
    { enabled: isPriced }
  )

  return {
    rate: data?.rate ?? null,
    commission: data?.amount ?? null,
    net: data ? subtractMoney(gross, data.amount) : null,
    isLoading: isPriced && isLoading,
    isPriced,
  }
}
