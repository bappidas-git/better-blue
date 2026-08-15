import RoleHomePlaceholder from '@/features/dashboard/components/RoleHomePlaceholder'

// TEMP: replaced in Prompt 15 by the real creator overview (proposals sent,
// active orders, earnings, portfolio status) inside DashboardLayout.
// Registered at `paths.CREATOR` so the creator role home exists.

export default function CreatorHomePlaceholder() {
  return (
    <RoleHomePlaceholder
      title="Creator dashboard"
      icon="tabler:camera"
      description="Briefs worth pitching for, the proposals you have sent, orders to deliver, and your earnings will live here."
      arrivesIn="Prompt 15"
    />
  )
}
