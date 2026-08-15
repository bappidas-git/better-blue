import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { Link as RouterLink, useParams } from 'react-router-dom'

import EmptyState from '@/components/feedback/EmptyState'
import DashboardPage from '@/layouts/dashboard/DashboardPage'
import { paths } from '@/routes/paths'

// TEMP STUB (Prompt 23 → replaced by Prompt 24).
//
// An accepted proposal links to the order it created (§4.6), and Prompt 23 ships
// before Prompt 24 builds the creator's order workspace. The established
// convention for that gap is Prompt 11's: mount the route with a placeholder so
// the link resolves, rather than sending a creator whose proposal was just
// accepted to a dashboard 404.
//
// Prompt 24 replaces this file with the real order workspace and keeps the route
// entry in `creatorRoutes.jsx` exactly as it is.

export default function CreatorOrderDetailPage() {
  const { orderId } = useParams()

  return (
    <DashboardPage title="Order" backTo={paths.CREATOR_PROPOSALS}>
      <EmptyState
        icon="solar:box-linear"
        title="Your order workspace is on its way"
        description="Congratulations — this proposal was accepted and became a funded order. The screen where you deliver the work, handle revisions, and track the payment is being built."
        primaryAction={{ label: 'Back to my proposals', to: paths.CREATOR_PROPOSALS }}
      >
        <Stack spacing={1} alignItems="center" sx={{ mt: 1 }}>
          <Typography variant="caption" color="text.secondary">
            Order reference: {orderId}
          </Typography>
          <Button component={RouterLink} to={paths.CREATOR} size="small" color="inherit">
            Go to your dashboard
          </Button>
        </Stack>
      </EmptyState>
    </DashboardPage>
  )
}
