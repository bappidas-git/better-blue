import NotificationPreferences from '@/features/notifications/components/NotificationPreferences'

// The Preferences card body on the buyer and creator settings screens.
//
// Prompt 15 created this as a placeholder card explaining that preferences were
// coming; Prompt 27 filled it in. It stays as a one-line seam rather than being
// deleted for two reasons: both settings screens already render it, so the swap
// touched one file, and the notification feature keeps its own component
// (`features/notifications/components/NotificationPreferences`) instead of
// living inside `buyerAccount` where the creator's screen would have to reach
// across to find it.
//
// A future prompt that gives admins their own account screen renders
// `NotificationPreferences` directly — there is nothing buyer-specific here.

export default function SettingsNotificationSlot() {
  return <NotificationPreferences />
}
