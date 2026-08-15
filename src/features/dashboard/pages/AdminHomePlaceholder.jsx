import RoleHomePlaceholder from '@/features/dashboard/components/RoleHomePlaceholder'

// TEMP: replaced in Prompt 24 by the real admin overview (marketplace health,
// moderation queue, open disputes, settlements due) inside DashboardLayout.
// Registered at `paths.ADMIN` so the admin and super admin role home exists.
// Per-screen permission gating lands with the console itself (Prompts 28–31).

export default function AdminHomePlaceholder() {
  return (
    <RoleHomePlaceholder
      title="Admin console"
      icon="tabler:shield-check"
      description="Marketplace health, the moderation queue, disputes awaiting a decision, and settlements to process will live here."
      arrivesIn="Prompt 24"
    />
  )
}
