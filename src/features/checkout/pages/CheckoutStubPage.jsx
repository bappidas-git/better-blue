import { Icon } from '@iconify/react'
import Alert from '@mui/material/Alert'
import AlertTitle from '@mui/material/AlertTitle'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Divider from '@mui/material/Divider'
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
import { EMPTY_PLACEHOLDER, formatCurrency, formatNumber } from '@/utils/formatters'

// TEMP: replaced in Prompt 19 (checkout and payment).
//
// Accepting a proposal creates an unfunded order and sends the buyer to
// `/buyer/checkout/:orderId` to pay for it. Prompt 19 builds that screen; until
// it does, this one exists so the award flow has somewhere real to land — a
// correct order summary and an honest note about what is missing, rather than
// a dead link or a 404 at the end of the most important journey on the buyer
// side. Everything here is read-only: no payment method, no charge, no
// mutation of any kind.
//
// Prompt 19 replaces this file wholesale and keeps the route entry in
// `buyerRoutes.jsx` exactly as it is.

export default function CheckoutStubPage() {
  const { orderId } = useParams()

  const { data, isLoading, error, refetch } = useApiQuery(
    () => orderService.getWithRelations(orderId),
    [orderId],
    { enabled: Boolean(orderId) }
  )

  const order = data?.order
  const proposal = data?.proposal

  const { data: creator } = useApiQuery(
    () => userService.getById(order?.creatorId),
    [order?.creatorId],
    { enabled: Boolean(order?.creatorId) }
  )

  if (error) {
    return (
      <DashboardPage title="Checkout" backTo={paths.BUYER_REQUESTS}>
        <ErrorState
          title="We could not open this order"
          message="The award itself went through — reload to pick it up again."
          error={error}
          onRetry={refetch}
        />
      </DashboardPage>
    )
  }

  if (isLoading || !order) {
    return (
      <DashboardPage title="Checkout" backTo={paths.BUYER_REQUESTS}>
        <CardSkeleton media={false} lines={4} label="Loading your order" />
      </DashboardPage>
    )
  }

  return (
    <DashboardPage
      title="Checkout"
      subtitle="Your proposal was accepted. Here is what you are about to fund."
      backTo={paths.BUYER_REQUESTS}
      meta={<StatusChip status={order.status} tooltip />}
      maxWidth="md"
    >
      <Stack spacing={{ xs: 2, md: 3 }}>
        <Card>
          <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
            <Typography variant="subtitle2" component="h2" color="text.secondary">
              Order summary
            </Typography>

            <Typography variant="h6" component="p" sx={{ mt: 1, mb: 2 }}>
              {order.title}
            </Typography>

            {creator ? (
              <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2.5 }}>
                <UserAvatar name={creator.name} src={creator.avatarUrl} size="sm" />
                <Typography variant="body2" color="text.secondary">
                  Awarded to <strong>{creator.name}</strong>
                </Typography>
              </Stack>
            ) : null}

            <Divider sx={{ mb: 2.5 }} />

            <KeyValueList
              divided
              labelWidth={200}
              items={[
                {
                  label: 'Agreed price',
                  value: (
                    <Typography variant="h6" component="p" sx={{ fontWeight: 700 }}>
                      {formatCurrency(order.price, order.currency)}
                    </Typography>
                  ),
                },
                {
                  label: 'Delivery',
                  value: order.deliveryDays
                    ? `${formatNumber(order.deliveryDays)} days once the order is funded`
                    : EMPTY_PLACEHOLDER,
                },
                {
                  label: 'Revisions included',
                  value: formatNumber(order.revisionsIncluded ?? 0),
                },
                { label: 'Order reference', value: order.id },
              ]}
            />

            {proposal?.coverMessage ? (
              <Box sx={{ mt: 3 }}>
                <Typography variant="subtitle2" component="h3" sx={{ mb: 0.75 }}>
                  What they proposed
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {proposal.coverMessage}
                </Typography>
              </Box>
            ) : null}
          </CardContent>
        </Card>

        <Alert severity="info" icon={<Icon icon="solar:shield-check-linear" width={22} />}>
          <AlertTitle>Secure payment arrives in the next release step</AlertTitle>
          Nothing has been charged. When checkout is switched on you will fund{' '}
          {formatCurrency(order.price, order.currency)} into escrow here, BetterBlue will hold it
          while the work is produced, and it will be released to the creator only once you have
          approved the final content.
        </Alert>

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
          <Button component={RouterLink} to={paths.BUYER_REQUESTS} variant="outlined">
            Back to my requests
          </Button>
          {order.requestId ? (
            <Button component={RouterLink} to={paths.buyerRequestDetail(order.requestId)} color="inherit">
              View the request
            </Button>
          ) : null}
        </Stack>
      </Stack>
    </DashboardPage>
  )
}
