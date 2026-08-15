import { Icon } from '@iconify/react'
import Alert from '@mui/material/Alert'
import AlertTitle from '@mui/material/AlertTitle'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { Link as RouterLink, useParams } from 'react-router-dom'

import KeyValueList from '@/components/data-display/KeyValueList'
import StatusChip from '@/components/data-display/StatusChip'
import UserAvatar from '@/components/data-display/UserAvatar'
import ErrorState from '@/components/feedback/ErrorState'
import CardSkeleton from '@/components/feedback/skeletons/CardSkeleton'
import useApiQuery from '@/hooks/useApiQuery'
import DashboardPage from '@/layouts/dashboard/DashboardPage'
import { paths } from '@/routes/paths'
import { orderService } from '@/services/orderService'
import { userService } from '@/services/userService'
import { EMPTY_PLACEHOLDER, formatCurrency, formatDate, formatNumber } from '@/utils/formatters'

// TEMP: replaced in Prompt 20 (the buyer order detail screen).
//
// The same landing-pad pattern Prompt 18 used for checkout, applied one step
// later in the journey. Paying for an order sends the buyer to
// `/buyer/orders/:orderId`, and both `PaymentSuccess` and the guards on
// `CheckoutPage` link there — so the route has to render something honest
// rather than the dashboard 404 at the end of the payment flow.
//
// Read-only in every sense: no mutation, no action, no status change. It shows
// what the order *is* and says plainly what is not built yet. Prompt 20
// replaces this file wholesale and keeps the route entry in `buyerRoutes.jsx`
// exactly as it is.

export default function OrderDetailStubPage() {
  const { orderId } = useParams()

  const { data, isLoading, error, refetch } = useApiQuery(
    () => orderService.getWithRelations(orderId),
    [orderId],
    { enabled: Boolean(orderId) }
  )

  const order = data?.order
  const payment = data?.payment

  const { data: creator } = useApiQuery(
    () => userService.getById(order?.creatorId),
    [order?.creatorId],
    { enabled: Boolean(order?.creatorId) }
  )

  if (error) {
    return (
      <DashboardPage title="Order" backTo={paths.BUYER_REQUESTS} maxWidth="md">
        <ErrorState
          title="We could not open this order"
          message="Nothing about it has changed — this page just needs another go."
          error={error}
          onRetry={refetch}
        />
      </DashboardPage>
    )
  }

  if (isLoading || !order) {
    return (
      <DashboardPage title="Order" backTo={paths.BUYER_REQUESTS} maxWidth="md">
        <CardSkeleton media={false} lines={5} label="Loading your order" />
      </DashboardPage>
    )
  }

  return (
    <DashboardPage
      title={order.title}
      documentTitle="Order"
      subtitle="Where this engagement stands right now."
      backTo={paths.BUYER_REQUESTS}
      meta={<StatusChip status={order.status} tooltip />}
      maxWidth="md"
    >
      <Stack spacing={{ xs: 2, md: 3 }}>
        <Card>
          <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
            {creator ? (
              <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2.5 }}>
                <UserAvatar name={creator.name} src={creator.avatarUrl} size="sm" />
                <Typography variant="body2" color="text.secondary">
                  Awarded to <strong>{creator.name}</strong>
                </Typography>
              </Stack>
            ) : null}

            <KeyValueList
              divided
              labelWidth={200}
              items={[
                {
                  label: 'Order total',
                  value: (
                    <Typography variant="h6" component="p" sx={{ fontWeight: 700 }}>
                      {formatCurrency(order.price, order.currency)}
                    </Typography>
                  ),
                },
                {
                  label: 'Payment',
                  value: payment ? (
                    <StatusChip status={payment.status} size="sm" tooltip />
                  ) : (
                    'Not yet funded'
                  ),
                },
                {
                  label: 'Delivery due',
                  value: order.deliveryDueAt ? formatDate(order.deliveryDueAt) : EMPTY_PLACEHOLDER,
                },
                {
                  label: 'Revisions included',
                  value: formatNumber(order.revisionsIncluded ?? 0),
                },
                { label: 'Order reference', value: order.id },
              ]}
            />
          </CardContent>
        </Card>

        <Alert severity="info" icon={<Icon icon="solar:hourglass-linear" width={22} />}>
          <AlertTitle>The full order workspace arrives next</AlertTitle>
          Deliveries, revision requests, messages, and the button that approves the work and
          releases the escrow all live on this screen once it is built. Everything above is real —
          nothing here is waiting on you.
        </Alert>

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
          <Button component={RouterLink} to={paths.BUYER_PAYMENTS} variant="outlined">
            View payments
          </Button>
          <Button component={RouterLink} to={paths.BUYER_REQUESTS} color="inherit">
            Back to my requests
          </Button>
        </Stack>
      </Stack>
    </DashboardPage>
  )
}
