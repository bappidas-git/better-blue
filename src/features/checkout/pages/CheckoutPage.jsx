import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'
import { Navigate, useParams } from 'react-router-dom'

import StatusChip from '@/components/data-display/StatusChip'
import ErrorState from '@/components/feedback/ErrorState'
import CardSkeleton from '@/components/feedback/skeletons/CardSkeleton'
import { useToast } from '@/components/feedback/ToastProvider'
import StickyActionBar from '@/components/layout/StickyActionBar'
import { ORDER_STATUS } from '@/constants/statuses'
import { useAuth } from '@/context/AuthContext'
import DummyCardForm from '@/features/checkout/components/DummyCardForm'
import OrderSummaryCard from '@/features/checkout/components/OrderSummaryCard'
import PaymentFailure from '@/features/checkout/components/PaymentFailure'
import PaymentSuccess from '@/features/checkout/components/PaymentSuccess'
import ProcessingOverlay from '@/features/checkout/components/ProcessingOverlay'
import TestCardPanel from '@/features/checkout/components/TestCardPanel'
import useApiMutation from '@/hooks/useApiMutation'
import useApiQuery from '@/hooks/useApiQuery'
import DashboardPage from '@/layouts/dashboard/DashboardPage'
import { BOTTOM_NAV_HEIGHT } from '@/layouts/dashboard/MobileBottomNav'
import { paths } from '@/routes/paths'
import { orderService } from '@/services/orderService'
import { paymentService } from '@/services/paymentService'
import { userService } from '@/services/userService'
import { formatCurrency } from '@/utils/formatters'

// Checkout — where a buyer funds an order they have just awarded.
//
// **This page contains no payment logic.** `paymentService.initiateOrderPayment`
// charges the card, moves the payment to `held`, starts the order, writes the
// `charge` ledger row, and notifies both parties (Prompt 17,
// `docs/payments.md` §4). Everything here is the experience around that one
// call: what the buyer is about to pay for, the form that collects a card, the
// four states the call can leave them in, and the guards that stop them ever
// paying twice.
//
// The provider boundary holds (Prompt 19 §7): the only payment imports on this
// screen are `paymentService` and — in the dev-only test panel — the test cards
// it re-exports. Nothing under `services/payments/` is reachable from here.
//
//   grep -rn "services/payments" src --include=*.jsx   → no matches
//
// **Abandonment is safe by design.** Leaving mid-checkout writes nothing: the
// order stays `pending_payment` and the buyer is offered the way back in by
// `UnpaidOrderBanner` on the requests list and the dashboard overview.

/** The four states this screen can be in. One route, no navigation between them. */
const STAGE = Object.freeze({
  FORM: 'form',
  PROCESSING: 'processing',
  SUCCESS: 'success',
  FAILURE: 'failure',
})

/**
 * Floor on how long the processing state is shown, in milliseconds.
 *
 * The dummy provider already takes 1200 ms, so this changes nothing today — it
 * is here for the real one. A charge that resolves in 90 ms flashes an overlay
 * that reads as a glitch rather than as work being done, and a payment that
 * appears not to have been considered is not a reassuring payment.
 */
const MIN_PROCESSING_MS = 800

/** DOM id tying the mobile sticky pay button to the form it submits. */
const CHECKOUT_FORM_ID = 'checkout-card-form'

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

export default function CheckoutPage() {
  const { orderId } = useParams()
  const { user } = useAuth()
  const toast = useToast()
  const theme = useTheme()
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'))

  const { data, isLoading, error, refetch } = useApiQuery(
    () => orderService.getWithRelations(orderId),
    [orderId],
    { enabled: Boolean(orderId) }
  )

  const order = data?.order

  const { data: creator } = useApiQuery(
    () => userService.getById(order?.creatorId),
    [order?.creatorId],
    { enabled: Boolean(order?.creatorId) }
  )

  const [stage, setStage] = useState(STAGE.FORM)
  const [payment, setPayment] = useState(null)
  const [failure, setFailure] = useState(null)
  const [retryToken, setRetryToken] = useState(0)
  // The failure state replaces the form rather than hiding it, so the name is
  // held here to survive the remount a retry causes. Nothing else about the
  // card is kept, here or anywhere (00 §14).
  const [cardholderName, setCardholderName] = useState('')

  const { mutate } = useApiMutation(paymentService.initiateOrderPayment)

  const cardForm = useRef(null)
  const stageRef = useRef(stage)
  stageRef.current = stage
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  /**
   * Why this buyer may not pay for this order, or `null` when they may.
   *
   * Both cases are redirects rather than error screens: someone who lands here
   * on an order that is already funded wants the order, not an explanation, and
   * someone who lands on an order that is not theirs should not be told
   * anything about it at all.
   *
   * SECURITY (00 §11): this is UX. The Laravel API must make the same two
   * checks server-side, because a `POST /orders/:id/pay` never passes through
   * this component.
   */
  const guard = useMemo(() => {
    if (!order || !user) return null

    if (order.buyerId !== user.id) {
      return {
        to: paths.BUYER_REQUESTS,
        severity: 'error',
        message: 'That order belongs to another account.',
      }
    }

    if (order.status !== ORDER_STATUS.PENDING_PAYMENT) {
      return {
        to: paths.buyerOrderDetail(order.id),
        severity: 'info',
        message: 'This order is not waiting for payment.',
        description: 'Nothing was charged — here is where it got to.',
      }
    }

    return null
  }, [order, user])

  // A successful payment moves the order to `in_progress`, which would trip the
  // guard above and bounce the buyer off their own receipt. The success state
  // therefore outranks it.
  const isRedirecting = Boolean(guard) && stage !== STAGE.SUCCESS

  const announced = useRef(false)
  useEffect(() => {
    if (!isRedirecting || announced.current) return
    announced.current = true
    toast[guard.severity](guard.message, { description: guard.description })
  }, [guard, isRedirecting, toast])

  const pay = useCallback(
    async (method) => {
      // Belt and braces against a double submit: the overlay covers the form
      // and every control under it is disabled, and this rejects anything that
      // still gets through (a stray Enter on a native submit, say).
      if (stageRef.current === STAGE.PROCESSING) return

      setCardholderName(method.cardholderName ?? '')
      setStage(STAGE.PROCESSING)
      const startedAt = Date.now()

      /** Keeps the processing state on screen for at least the floor above. */
      const settle = async () => {
        const remaining = MIN_PROCESSING_MS - (Date.now() - startedAt)
        if (remaining > 0) await wait(remaining)
      }

      try {
        // Only the three card fields the provider needs cross the boundary; the
        // cardholder name never reaches the payment record (contract §9.4).
        const held = await mutate(orderId, {
          method: { brand: method.brand, last4: method.last4, number: method.number },
        })
        await settle()
        if (!mounted.current) return
        setPayment(held)
        setStage(STAGE.SUCCESS)
      } catch (thrown) {
        await settle()
        if (!mounted.current) return
        // A decline is data, not a crash: `PaymentFailure` turns the provider's
        // code into a sentence, and the order is untouched either way.
        setFailure(thrown)
        setStage(STAGE.FAILURE)
      }
    },
    [mutate, orderId]
  )

  const retry = useCallback(() => {
    setFailure(null)
    // Remounts the card form: empty card, cardholder name carried over.
    setRetryToken((token) => token + 1)
    setStage(STAGE.FORM)
  }, [])

  if (error) {
    return (
      <DashboardPage title="Checkout" backTo={paths.BUYER_REQUESTS} maxWidth="md">
        <ErrorState
          title="We could not open this order"
          message="Nothing has been charged. The order is safe — this page just needs another go."
          error={error}
          onRetry={refetch}
        />
      </DashboardPage>
    )
  }

  if (isLoading || !order || !user) {
    return (
      <DashboardPage title="Checkout" backTo={paths.BUYER_REQUESTS} maxWidth="md">
        <CardSkeleton media={false} lines={5} label="Loading your order" />
      </DashboardPage>
    )
  }

  if (isRedirecting) return <Navigate to={guard.to} replace />

  if (stage === STAGE.SUCCESS) {
    return (
      <DashboardPage
        title="Payment complete"
        subtitle="Your money is held in escrow until you approve the delivery."
        maxWidth="md"
      >
        <PaymentSuccess payment={payment} order={order} creator={creator} />
      </DashboardPage>
    )
  }

  const isProcessing = stage === STAGE.PROCESSING
  const payLabel = `Pay ${formatCurrency(order.price, order.currency)} securely`

  const payButton = (
    <Button
      type="submit"
      form={CHECKOUT_FORM_ID}
      variant="gradient"
      size="large"
      fullWidth
      disabled={isProcessing}
      startIcon={
        <Icon icon="solar:lock-keyhole-minimalistic-bold" width={18} aria-hidden="true" />
      }
    >
      {payLabel}
    </Button>
  )

  const summary = (
    <Box
      key="summary"
      sx={{
        position: { md: 'sticky' },
        // Clear of the desktop top bar, which is fixed above this column.
        top: { md: theme.spacing(3) },
      }}
    >
      <OrderSummaryCard
        order={order}
        request={data?.request}
        proposal={data?.proposal}
        creator={creator}
        collapsible={!isDesktop}
      />
    </Box>
  )

  const paymentColumn = (
    <Stack key="payment" spacing={2}>
      {stage === STAGE.FAILURE ? (
        <PaymentFailure error={failure} orderId={order.id} onRetry={retry} />
      ) : (
        <>
          <TestCardPanel
            onFill={(values) => cardForm.current?.fill(values)}
            disabled={isProcessing}
          />

          <Card sx={{ position: 'relative' }}>
            <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
              <Stack
                direction="row"
                spacing={1}
                alignItems="center"
                sx={{ mb: 2.5, color: 'text.secondary' }}
              >
                <Icon
                  icon="solar:card-linear"
                  width={20}
                  aria-hidden="true"
                  style={{ flexShrink: 0 }}
                />
                <Typography variant="subtitle2" component="h2">
                  Payment details
                </Typography>
              </Stack>

              {/* Keyed on the retry count: a decline followed by "try again"
                  is a fresh form with an empty card, whether or not the
                  failure state happened to unmount it. The name is handed
                  back in rather than retyped. */}
              <DummyCardForm
                key={retryToken}
                formId={CHECKOUT_FORM_ID}
                onSubmit={pay}
                initialName={cardholderName}
                disabled={isProcessing}
                fillRef={cardForm}
                submitSlot={isDesktop ? payButton : null}
              />
            </CardContent>

            <ProcessingOverlay open={isProcessing} />
          </Card>
        </>
      )}
    </Stack>
  )

  return (
    <DashboardPage
      title="Checkout"
      subtitle="Fund the order and BetterBlue holds the money until you approve the delivery."
      backTo={paths.BUYER_REQUESTS}
      meta={<StatusChip status={order.status} tooltip />}
    >
      <Box
        sx={{
          display: 'grid',
          gap: { xs: 2, md: 3 },
          gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 3fr) minmax(0, 2fr)' },
          alignItems: 'start',
        }}
      >
        {/* Ordered in the DOM rather than with CSS `order`: on a phone the
            summary genuinely comes first — a collapsed accordion above the
            form — and reading order has to agree with it for a keyboard and a
            screen reader, not just for the eye (§12). */}
        {isDesktop ? [paymentColumn, summary] : [summary, paymentColumn]}
      </Box>

      {/* The phone's primary action stays in reach of a thumb (00 §12). It sits
          above the dashboard's own fixed bar rather than over it. */}
      {!isDesktop && (stage === STAGE.FORM || isProcessing) ? (
        <StickyActionBar
          mobileOnly
          sx={{
            mx: { xs: -2, sm: -3 },
            mt: 2,
            bottom: `calc(${BOTTOM_NAV_HEIGHT + 1}px + env(safe-area-inset-bottom))`,
          }}
        >
          {payButton}
        </StickyActionBar>
      ) : null}
    </DashboardPage>
  )
}
