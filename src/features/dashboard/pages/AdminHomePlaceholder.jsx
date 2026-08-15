import RoleHomePlaceholder from '@/features/dashboard/components/RoleHomePlaceholder'

// TEMP: replaced in Prompt 28 by the real admin overview (marketplace health,
// moderation queue, open disputes, settlements due). Since Prompt 14 it renders
// inside `DashboardLayout`, registered at `paths.ADMIN` for admin and super
// admin. Per-screen permission gating lands with the console itself (29–36).

export default function AdminHomePlaceholder() {
  return (
    <RoleHomePlaceholder
      title="Overview"
      subtitle="Marketplace health, moderation, disputes, and settlements."
      icon="tabler:shield-check"
      description="Marketplace health, the moderation queue, disputes awaiting a decision, and settlements to process will live here."
      arrivesIn="Prompt 28"
    />
  )
}
