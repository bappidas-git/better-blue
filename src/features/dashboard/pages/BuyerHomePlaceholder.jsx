import RoleHomePlaceholder from '@/features/dashboard/components/RoleHomePlaceholder'

// TEMP: replaced in Prompt 14 by the real buyer overview (active requests,
// orders awaiting action, escrow balance, recent activity) inside
// DashboardLayout. Registered at `paths.BUYER` so the buyer role home exists.

export default function BuyerHomePlaceholder() {
  return (
    <RoleHomePlaceholder
      title="Buyer dashboard"
      icon="tabler:building-store"
      description="Your content requests, proposals to review, orders in flight, and payments held in escrow will live here."
      arrivesIn="Prompt 14"
    />
  )
}
