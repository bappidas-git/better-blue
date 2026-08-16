import { useState } from 'react'

import { Icon } from '@iconify/react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Checkbox from '@mui/material/Checkbox'
import FormControlLabel from '@mui/material/FormControlLabel'
import FormHelperText from '@mui/material/FormHelperText'
import Link from '@mui/material/Link'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { alpha } from '@mui/material/styles'
import { Link as RouterLink } from 'react-router-dom'

import { paths } from '@/routes/paths'
import { formatCurrency, formatPercent } from '@/utils/formatters'

// The state a member sees before they join — Prompt 34 §4.3, §6.
//
// The copy is the point. A referral program is the single easiest thing in a
// marketplace to make sound like a pyramid scheme, so this card says exactly
// three things and stops: what the link does, when money is earned, and how
// much. No "unlimited earnings", no downlines, no urgency, no exclamation
// marks — a business tool a professional can share with a colleague without
// explaining themselves.
//
// The terms checkbox is a real precondition, not decoration: the button stays
// disabled until it is ticked, and the reason is stated under it rather than
// left for somebody to work out from a greyed-out control (§13).

/** The three steps, in the order they actually happen. */
const STEPS = [
  {
    key: 'share',
    icon: 'solar:share-linear',
    title: 'Share your link',
    body: 'You get a personal referral link the moment you join. Send it to a business that needs content, or add it to your profile.',
  },
  {
    key: 'signup',
    icon: 'solar:buildings-3-linear',
    title: 'A business signs up',
    body: 'Anyone who creates a BetterBlue account through your link is attributed to you automatically.',
  },
  {
    key: 'earn',
    icon: 'solar:hand-money-linear',
    title: 'They complete their first order',
    body: 'When that business completes its first order, you earn a share of the platform commission on it.',
  },
]

/**
 * @param {object} props
 * @param {object} props.settings program settings — `commissionRate`,
 *   `attributionDays`, `payoutMinAmount`, `currency`
 * @param {(agreed: boolean) => void} props.onEnroll
 * @param {boolean} [props.isSubmitting=false]
 * @param {object} [props.error] a failed enrolment, shown above the button
 */
export default function EnrollCard({ settings, onEnroll, isSubmitting = false, error }) {
  const [agreed, setAgreed] = useState(false)
  const [touched, setTouched] = useState(false)

  const rate = formatPercent(settings?.commissionRate ?? 0)
  const minimum = formatCurrency(settings?.payoutMinAmount ?? 0, settings?.currency, {
    hideDecimals: true,
  })
  const showRequirement = touched && !agreed

  return (
    <Stack spacing={{ xs: 2, md: 3 }}>
      <Card>
        <CardContent sx={{ p: { xs: 2.5, md: 4 } }}>
          <Stack spacing={{ xs: 3, md: 4 }}>
            <Box sx={{ maxWidth: '62ch' }}>
              <Typography variant="overline" component="p" color="text.secondary">
                Referral program
              </Typography>
              <Typography variant="h5" component="h2" gutterBottom>
                Earn {rate} of the platform commission on businesses you introduce
              </Typography>
              <Typography variant="body1" color="text.secondary">
                If you know a business that needs photo or video content, share BetterBlue with
                them. When they complete their first order, you earn a share of the commission we
                charge on it — never a cut of what the creator is paid.
              </Typography>
            </Box>

            {/* Three steps. A grid rather than a numbered list: they are stages,
                not instructions, and on a phone they stack in the same order. */}
            <Box
              component="ol"
              sx={{
                listStyle: 'none',
                m: 0,
                p: 0,
                display: 'grid',
                gap: { xs: 2, md: 3 },
                gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' },
              }}
            >
              {STEPS.map((step, index) => (
                <Box component="li" key={step.key}>
                  <Stack spacing={1.25}>
                    <Box
                      aria-hidden="true"
                      sx={{
                        width: 44,
                        height: 44,
                        borderRadius: 2,
                        display: 'grid',
                        placeItems: 'center',
                        color: 'primary.main',
                        bgcolor: (theme) => alpha(theme.palette.primary.main, 0.1),
                      }}
                    >
                      <Icon icon={step.icon} width={24} />
                    </Box>
                    <Typography variant="subtitle1" component="h3">
                      {index + 1}. {step.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {step.body}
                    </Typography>
                  </Stack>
                </Box>
              ))}
            </Box>

            <Box
              sx={{
                p: { xs: 2, md: 2.5 },
                borderRadius: 2,
                bgcolor: 'background.default',
                border: 1,
                borderColor: 'divider',
              }}
            >
              <Typography variant="subtitle2" component="h3" gutterBottom>
                The terms, in full
              </Typography>
              <Stack component="ul" spacing={0.75} sx={{ m: 0, pl: 2.5 }}>
                <Typography component="li" variant="body2" color="text.secondary">
                  Commission is {rate} of the platform commission BetterBlue earns on a referred
                  business&rsquo;s first completed order.
                </Typography>
                <Typography component="li" variant="body2" color="text.secondary">
                  A referral is attributed for {settings?.attributionDays ?? 30} days from the day
                  the link is clicked. After that the attribution expires.
                </Typography>
                <Typography component="li" variant="body2" color="text.secondary">
                  Commission is reviewed by our team before it can be paid out, and can be voided if
                  the order behind it is refunded or the referral breaches these terms.
                </Typography>
                <Typography component="li" variant="body2" color="text.secondary">
                  Payouts are available once your approved commission reaches {minimum}.
                </Typography>
                <Typography component="li" variant="body2" color="text.secondary">
                  You cannot refer yourself, and referrals must be genuine introductions — no paid
                  search on our brand name, no misleading claims about the platform.
                </Typography>
              </Stack>
              <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1.5 }}>
                The full{' '}
                <Link component={RouterLink} to={paths.TERMS}>
                  Terms of Service
                </Link>{' '}
                and{' '}
                <Link component={RouterLink} to={paths.CONTENT_POLICY}>
                  Content Policy
                </Link>{' '}
                apply to referral activity as they do to everything else on BetterBlue.
              </Typography>
            </Box>

            {error?.message ? <Alert severity="error">{error.message}</Alert> : null}

            <Box>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={agreed}
                    onChange={(event) => {
                      setAgreed(event.target.checked)
                      setTouched(true)
                    }}
                    inputProps={{ 'aria-describedby': 'affiliate-terms-help' }}
                  />
                }
                label="I have read and accept the referral program terms"
              />
              <FormHelperText id="affiliate-terms-help" error={showRequirement}>
                {showRequirement
                  ? 'Accept the terms to join the referral program.'
                  : 'Required — you can leave the program at any time by contacting support.'}
              </FormHelperText>

              <Box sx={{ mt: 2 }}>
                <Button
                  variant="contained"
                  size="large"
                  disabled={isSubmitting}
                  onClick={() => {
                    setTouched(true)
                    if (agreed) onEnroll(true)
                  }}
                  sx={{ minHeight: 48 }}
                  startIcon={<Icon icon="solar:link-round-linear" width={20} aria-hidden="true" />}
                >
                  {isSubmitting ? 'Setting up your link…' : 'Join and get my link'}
                </Button>
              </Box>
            </Box>
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  )
}
