import { useEffect, useRef } from 'react'

import { Navigate, useParams } from 'react-router-dom'

import AppLoader from '@/app/AppLoader'
import { useToast } from '@/components/feedback/ToastProvider'
import useApiQuery from '@/hooks/useApiQuery'
import useDocumentTitle from '@/hooks/useDocumentTitle'
import { paths } from '@/routes/paths'
import { affiliateService, captureReferralCode } from '@/services/affiliateService'

// `/r/:code` — the whole of referral capture, and the only page in BetterBlue
// that exists to redirect (Prompt 34 §4.1).
//
// It is deliberately silent about failure. A referral link is shared by a member
// and clicked by somebody who has never heard of this product: a code that is
// unknown, mistyped, or belongs to a suspended affiliate must land that visitor
// on the home page as though they had typed the address themselves. "Invalid
// referral code" would be an error message about somebody else's problem, shown
// to the one person who cannot do anything about it (§13).
//
// A valid code stores `{ code, at }` in `bb.referralCode` and sends the visitor
// to sign-up with a welcome toast. Registration reads it back, records
// `referredByCode` on the account, and writes the `pending` referral
// (`authService.register` → `affiliateService.recordReferral`).
//
// MOCK-ATTRIBUTION: capture is client-side, so it is per-browser and per-device,
// and the click counter is approximate — both are documented on
// `captureReferralCode` and `affiliateService.recordClick`. Laravel does this
// with a signed `HttpOnly` cookie set by the redirect response itself, which is
// the only version of this that survives a visitor clearing their storage or
// switching devices mid-decision.

export default function ReferralRedirectPage() {
  const { code } = useParams()
  const toast = useToast()
  useDocumentTitle('Welcome to BetterBlue')

  // The lookup is the gate: only an **active** affiliate on a **switched-on**
  // program can capture, so a suspended code stops working the moment an admin
  // suspends it (§13, verified by the negative test in §15).
  const { data: profile, isLoading } = useApiQuery(
    () => affiliateService.getCapturableByCode(code),
    [code],
    { enabled: Boolean(code) }
  )

  // Capture is a side effect of a resolved lookup, not of a render: React 18's
  // StrictMode double-invokes effects in development, and a ref keeps the toast
  // and the click count to one each.
  const handled = useRef(false)

  useEffect(() => {
    if (isLoading || handled.current || !profile) return
    handled.current = true

    captureReferralCode(profile.code)
    // Fire-and-forget: the redirect must not wait on a vanity metric, and
    // `recordClick` swallows its own failures.
    affiliateService.recordClick(profile)

    toast.success('You’ve been invited to BetterBlue', {
      description:
        'Create your account to start commissioning content — your invitation is already applied.',
    })
  }, [isLoading, profile, toast])

  if (isLoading) return <AppLoader label="Opening your invitation" />

  // Valid → sign-up, invitation in hand. Invalid, expired, suspended, or the
  // program switched off → home, in silence. `replace` on both, so Back returns
  // to wherever the link was shared rather than bouncing through here again.
  return <Navigate to={profile ? paths.REGISTER : paths.HOME} replace />
}
