import RoleHomePlaceholder from '@/features/dashboard/components/RoleHomePlaceholder'

// TEMP: replaced in Prompt 21 by the real creator overview (proposals sent,
// active orders, earnings, portfolio status). Since Prompt 14 it renders inside
// `DashboardLayout`, registered at `paths.CREATOR`.

export default function CreatorHomePlaceholder() {
  return (
    <RoleHomePlaceholder
      title="Overview"
      subtitle="Briefs to pitch for, orders to deliver, and what you have earned."
      icon="tabler:camera"
      description="Briefs worth pitching for, the proposals you have sent, orders to deliver, and your earnings will live here."
      arrivesIn="Prompt 21"
    />
  )
}
