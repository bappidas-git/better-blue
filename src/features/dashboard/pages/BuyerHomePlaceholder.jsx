import RoleHomePlaceholder from '@/features/dashboard/components/RoleHomePlaceholder'

// TEMP: replaced in Prompt 15 by the real buyer overview (active requests,
// orders awaiting action, escrow balance, recent activity). Since Prompt 14 it
// renders inside `DashboardLayout`, registered at `paths.BUYER`.

export default function BuyerHomePlaceholder() {
  return (
    <RoleHomePlaceholder
      title="Overview"
      subtitle="Your requests, proposals, orders, and escrow at a glance."
      icon="tabler:building-store"
      description="Your content requests, proposals to review, orders in flight, and payments held in escrow will live here."
      arrivesIn="Prompt 15"
    />
  )
}
