// The referral link, and the four ways a member shares it — Prompt 34 §4.3.
//
// Split out of the components so the URL is built in exactly one place: the
// link, the mail body, and both social share targets all have to carry the same
// string, and three of them are URL-encoded copies of the fourth.
//
// Route paths come from `routes/paths.js` (00 §2.6) — this module composes an
// **absolute** URL from one, which is the one thing a `to=` cannot do and the
// whole reason a share link needs a helper at all.

import { paths } from '@/routes/paths'

/**
 * The query key carrying the storefront a referral link was shared from
 * (V2-09 §5). Spelled here and read by `ReferralRedirectPage`, so the two
 * halves of the round trip cannot drift.
 */
export const REFERRAL_CREATOR_PARAM = 'creator'

/** Where the app is served from, e.g. `https://betterblue.test`. */
function origin() {
  if (typeof window === 'undefined' || !window.location) return ''
  return window.location.origin ?? ''
}

/**
 * The full, shareable referral URL for a code.
 *
 * `creatorId` is Storefront V2's addition (`prompts-v2/09` §5): the Promote
 * button on a creator card shares the member's ordinary referral link with the
 * storefront that prompted it hung off the end. **The code is still the whole
 * of the attribution** — `/r/:code` reads the path parameter and nothing else,
 * so a link with the extra parameter captures exactly as one without it, and a
 * link that loses it on the way through somebody's messaging app still works.
 * `ReferralRedirectPage` stores the id alongside the code for a future
 * "which storefront sent them" report; nothing reads it yet.
 *
 * @param {string} code an affiliate code, e.g. `'VERDE-K7'`
 * @param {object} [options]
 * @param {string} [options.creatorId] `cpr_…` — the storefront being promoted
 * @returns {string} e.g. `https://betterblue.test/r/VERDE-K7?creator=cpr_ava`
 */
export function referralUrl(code, { creatorId } = {}) {
  if (!code) return ''

  const url = `${origin()}${paths.referral(code)}`
  return creatorId ? `${url}?${REFERRAL_CREATOR_PARAM}=${encodeURIComponent(creatorId)}` : url
}

/**
 * The message shared alongside the link. One sentence, written the way a member
 * would actually introduce a marketplace to a colleague — no hype, no urgency,
 * nothing that would embarrass the person sending it.
 */
export const SHARE_MESSAGE =
  'I use BetterBlue to commission photo and video content for my business — vetted creators, ' +
  'fixed quotes, and payment held until the work is delivered. Worth a look:'

/**
 * Share targets for a referral link — plain `href`s, opened by the browser.
 *
 * Deliberately anchors rather than an SDK or a popup: no third-party script
 * (00 §3 — nothing new gets installed), no tracking pixel, and a link a member
 * can right-click and copy like any other.
 *
 * `label` is the accessible name — "Share on LinkedIn", never a bare icon
 * (§12); `shortLabel` is what fits beside it on a 360px screen.
 *
 * @param {string} code the affiliate code
 * @param {object} [options]
 * @param {string} [options.subject] email subject line
 * @param {string} [options.creatorId] `cpr_…` — see {@link referralUrl}
 * @returns {{key: string, label: string, shortLabel: string, ariaLabel: string, icon: string,
 *   href: string, external: boolean}[]}
 */
export function shareTargets(
  code,
  { subject = 'A marketplace for business content', creatorId } = {}
) {
  const url = referralUrl(code, { creatorId })
  if (!url) return []

  const encodedUrl = encodeURIComponent(url)
  const encodedText = encodeURIComponent(`${SHARE_MESSAGE} ${url}`)

  return [
    {
      key: 'email',
      label: 'Share by email',
      shortLabel: 'Email',
      ariaLabel: 'Share your referral link by email',
      icon: 'solar:letter-linear',
      href: `mailto:?subject=${encodeURIComponent(subject)}&body=${encodedText}`,
      external: false,
    },
    {
      key: 'linkedin',
      label: 'Share on LinkedIn',
      shortLabel: 'LinkedIn',
      ariaLabel: 'Share your referral link on LinkedIn, opens in a new tab',
      icon: 'tabler:brand-linkedin',
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
      external: true,
    },
    {
      key: 'x',
      label: 'Share on X',
      shortLabel: 'X',
      ariaLabel: 'Share your referral link on X, opens in a new tab',
      icon: 'tabler:brand-x',
      href: `https://x.com/intent/tweet?text=${encodedText}`,
      external: true,
    },
  ]
}

/**
 * Copies text to the clipboard, falling back to a hidden textarea where the
 * async Clipboard API is unavailable (it needs a secure context, which a plain
 * `http://` dev server is not).
 *
 * @param {string} text
 * @returns {Promise<boolean>} whether it was copied
 */
export async function copyToClipboard(text) {
  const value = String(text ?? '')
  if (!value) return false

  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(value)
      return true
    }
  } catch {
    // Fall through to the legacy path — a denied permission is not a dead end.
  }

  try {
    const field = document.createElement('textarea')
    field.value = value
    field.setAttribute('readonly', '')
    field.style.position = 'fixed'
    field.style.opacity = '0'
    document.body.appendChild(field)
    field.select()
    const copied = document.execCommand('copy')
    document.body.removeChild(field)
    return copied
  } catch {
    return false
  }
}
