import { useEffect, useState } from 'react'

import { Icon } from '@iconify/react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import FormControl from '@mui/material/FormControl'
import FormControlLabel from '@mui/material/FormControlLabel'
import FormLabel from '@mui/material/FormLabel'
import Radio from '@mui/material/Radio'
import RadioGroup from '@mui/material/RadioGroup'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'

import { useToast } from '@/components/feedback/ToastProvider'
import FormTextField from '@/components/inputs/FormTextField'
import ResponsiveDialog from '@/components/layout/ResponsiveDialog'
import { REPORT_DETAILS_MAX, REPORT_REASONS } from '@/constants/reports'
import { useAuth } from '@/context/AuthContext'
import { paths } from '@/routes/paths'
import { reportService } from '@/services/reportService'
import { getItem, setItem } from '@/utils/storage'

// The public "Report" dialog — Prompt 30 §4.5.
//
// It is deliberately unremarkable. Reporting content is a normal part of a
// professional marketplace, so this is a short form with plain options and a
// plain confirmation — no warnings, no severity picker, nothing that invites
// somebody to escalate a disagreement into a policy complaint (00 §1).
//
// **Anyone can file one, signed in or not.** A visitor who spots a licensing
// problem on a public profile is exactly the person we want to hear from, and
// requiring an account first would lose that report. Signed-out reports carry
// no `reporterId` at all (see `reportService.fileReport`).
//
// **Nobody is told they were reported.** A report is a queue item for Trust &
// Safety, not an accusation the subject gets to answer before anyone has looked.

/**
 * MOCK-RATE-LIMIT: one report per subject per browser.
 *
 * A real rate limit is a server concern and belongs in the Laravel API (00 §11
 * — a client-side guard is a courtesy, not a control). This stops the honest
 * double-report: somebody presses the button, is not sure it worked, and
 * presses it again. Stored under `bb.reportedSubjects` as
 * `{ "portfolio_item:pfi_012": "2026-08-16T…" }` and never read by anything
 * else; clearing site data resets it, which is fine for what it is.
 */
const STORAGE_KEY = 'reportedSubjects'

const subjectKey = (subjectType, subjectId) => `${subjectType}:${subjectId}`

/** Has this browser already reported this exact thing? */
function hasReportedSubject(subjectType, subjectId) {
  if (!subjectType || !subjectId) return false
  const filed = getItem(STORAGE_KEY, {})
  return Boolean(filed?.[subjectKey(subjectType, subjectId)])
}

function rememberReport(subjectType, subjectId) {
  const filed = getItem(STORAGE_KEY, {}) ?? {}
  setItem(STORAGE_KEY, {
    ...filed,
    [subjectKey(subjectType, subjectId)]: new Date().toISOString(),
  })
}

/**
 * @param {object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {string} props.subjectType a `REPORT_SUBJECT` value
 * @param {string} props.subjectId the reported record's id
 * @param {string} [props.subjectLabel] what is being reported, in the reader's
 *   words — "Ava Martinez", or the title of a portfolio item
 */
export default function ReportDialog({ open, onClose, subjectType, subjectId, subjectLabel }) {
  const { user } = useAuth()
  const toast = useToast()

  const [reason, setReason] = useState('')
  const [details, setDetails] = useState('')
  const [error, setError] = useState(null)
  const [isSubmitting, setSubmitting] = useState(false)
  const [alreadyFiled, setAlreadyFiled] = useState(false)

  // A fresh form per opening, and a fresh look at whether this browser has
  // already reported this subject.
  useEffect(() => {
    if (!open) return
    setReason('')
    setDetails('')
    setError(null)
    setSubmitting(false)
    setAlreadyFiled(hasReportedSubject(subjectType, subjectId))
  }, [open, subjectId, subjectType])

  const submit = async (event) => {
    event?.preventDefault?.()
    if (!reason) {
      setError('Choose the option that best describes your concern.')
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      await reportService.fileReport({
        subjectType,
        subjectId,
        reason,
        details,
        reporterId: user?.id,
      })
      rememberReport(subjectType, subjectId)
      toast.success('Thanks — our Trust & Safety team will review this.', {
        description: 'We look at every report against the Content Policy. You will not be contacted unless we need more detail.',
      })
      onClose()
    } catch (failure) {
      setError(failure?.message ?? 'We could not send that report. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <ResponsiveDialog
      open={open}
      onClose={isSubmitting ? () => {} : onClose}
      title="Report this content"
      description={subjectLabel ? `About: ${subjectLabel}` : undefined}
      maxWidth="sm"
      actions={
        <>
          <Button onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={submit}
            disabled={isSubmitting || alreadyFiled}
            startIcon={<Icon icon="solar:flag-linear" width={18} aria-hidden="true" />}
          >
            {isSubmitting ? 'Sending…' : 'Send report'}
          </Button>
        </>
      }
    >
      <Box component="form" onSubmit={submit} noValidate>
        <Stack spacing={2.5}>
          {alreadyFiled ? (
            <Alert severity="info" variant="outlined">
              You have already reported this. It is with our Trust & Safety team — there is no
              need to send it again.
            </Alert>
          ) : (
            <Typography variant="body2" color="text.secondary">
              Tell us what you have noticed and our Trust & Safety team will review it against
              the{' '}
              <Box
                component="a"
                href={paths.CONTENT_POLICY}
                target="_blank"
                rel="noopener noreferrer"
                sx={{ color: 'primary.main' }}
              >
                Content Policy
              </Box>
              . Reports are confidential: we do not tell anyone who reported them.
            </Typography>
          )}

          {error ? <Alert severity="error">{error}</Alert> : null}

          <FormControl disabled={alreadyFiled}>
            <FormLabel id="report-reason-label" sx={{ typography: 'subtitle2', mb: 1 }}>
              What is the concern?
            </FormLabel>
            <RadioGroup
              aria-labelledby="report-reason-label"
              name="report-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            >
              {REPORT_REASONS.map((option) => (
                <FormControlLabel
                  key={option.value}
                  value={option.value}
                  control={<Radio size="small" sx={{ mt: -0.5 }} />}
                  sx={{ alignItems: 'flex-start', mb: 1, mr: 0 }}
                  label={
                    <Box sx={{ py: 0.25 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {option.label}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {option.description}
                      </Typography>
                    </Box>
                  }
                />
              ))}
            </RadioGroup>
          </FormControl>

          <FormTextField
            label="Anything else we should know? (optional)"
            placeholder="e.g. The same image appears in a campaign we licensed exclusively last season."
            multiline
            minRows={3}
            maxLength={REPORT_DETAILS_MAX}
            value={details}
            onChange={setDetails}
            disabled={alreadyFiled}
            helperText={`Up to ${REPORT_DETAILS_MAX} characters. Specifics help us review it faster.`}
          />
        </Stack>
      </Box>
    </ResponsiveDialog>
  )
}
