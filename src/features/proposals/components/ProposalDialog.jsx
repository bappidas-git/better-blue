import { useEffect, useMemo, useState } from 'react'

import { Icon } from '@iconify/react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Checkbox from '@mui/material/Checkbox'
import Divider from '@mui/material/Divider'
import FormControlLabel from '@mui/material/FormControlLabel'
import FormHelperText from '@mui/material/FormHelperText'
import Link from '@mui/material/Link'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { alpha } from '@mui/material/styles'
import { Link as RouterLink } from 'react-router-dom'

import { useToast } from '@/components/feedback/ToastProvider'
import CurrencyField from '@/components/inputs/CurrencyField'
import FormSelect from '@/components/inputs/FormSelect'
import FormTextField from '@/components/inputs/FormTextField'
import ResponsiveDialog from '@/components/layout/ResponsiveDialog'
import { BUDGET_TYPE } from '@/constants/statuses'
import { formatBudget } from '@/features/requests/utils/requestDisplay'
import useApiMutation from '@/hooks/useApiMutation'
import useApiQuery from '@/hooks/useApiQuery'
import useForm, { focusFieldById } from '@/hooks/useForm'
import { paths } from '@/routes/paths'
import { portfolioService } from '@/services/portfolioService'
import {
  COVER_MESSAGE_LENGTH,
  DELIVERY_DAY_OPTIONS,
  MAX_SAMPLE_ITEMS,
  proposalService,
  REVISION_OPTIONS,
} from '@/services/proposalService'
import { formatCurrency } from '@/utils/formatters'
import { compose, maxLength, minLength, required } from '@/utils/validators'

import EarningsPreview from './EarningsPreview'
import SamplesPicker from './SamplesPicker'

// The proposal form — the creator's flagship screen, and the only place on the
// supply side where a mistake costs real money.
//
// It is a `ResponsiveDialog`, so it is a modal on a desktop and a full-screen
// sheet on a phone with a sticky footer (00 §12). Everything that helps
// somebody price well is *in the form* rather than in a tooltip: the brief's
// budget sits under the price field, the take-home figure updates as they type,
// and the sample grid shows what the buyer will actually open.
//
// One dialog does both jobs. Opened with a `proposal`, it prefills and PATCHes;
// opened without one, it creates — because "edit your proposal" and "write your
// proposal" are the same seven decisions, and two dialogs would drift.

/** How the quoted price sits against the brief's budget. */
function describePriceFit(price, request) {
  const amount = Number(price)
  if (!Number.isFinite(amount) || amount <= 0) return null

  const min = Number(request?.budgetMin)
  const max = Number(request?.budgetMax)
  if (!Number.isFinite(max)) return null

  const currency = request?.currency

  if (amount > max) {
    return {
      tone: 'warning.main',
      // Deliberately **not** blocking (§13): a creator who knows the brief is
      // underpriced should be able to say so, and the buyer decides.
      text: `Above this buyer’s budget of ${formatBudget(request)}. You can still send it — say why the extra ${formatCurrency(amount - max, currency)} is worth it.`,
    }
  }

  if (Number.isFinite(min) && amount < min && request?.budgetType === BUDGET_TYPE.RANGE) {
    return {
      tone: 'text.secondary',
      text: `Under this buyer’s range of ${formatBudget(request)} — you are leaving room on the table.`,
    }
  }

  return {
    tone: 'success.main',
    text: `Within this buyer’s budget of ${formatBudget(request)}.`,
  }
}

const toOptions = (values, label) =>
  values.map((value) => ({ value: String(value), label: label(value) }))

const DELIVERY_OPTIONS = toOptions(DELIVERY_DAY_OPTIONS, (days) => `${days} days`)
const REVISIONS_OPTIONS = toOptions(REVISION_OPTIONS, (count) =>
  count === 1 ? '1 revision' : `${count} revisions`
)

/**
 * @param {object} props
 * @param {boolean} props.open whether the dialog is shown
 * @param {() => void} props.onClose dismiss — also called by Escape and the backdrop
 * @param {object} props.request the brief being answered
 * @param {string} props.creatorUserId `usr_…` — the signed-in creator
 * @param {string} [props.creatorProfileId] `cpr_…` — whose published work fills the picker
 * @param {object} [props.proposal] an existing offer to edit; omit to create one
 * @param {() => void} [props.onSubmitted] called after a successful write, so the
 *   page behind can refetch
 */
export default function ProposalDialog({
  open,
  onClose,
  request,
  creatorUserId,
  creatorProfileId,
  proposal,
  onSubmitted,
}) {
  const toast = useToast()
  const isEditing = Boolean(proposal)

  const [samples, setSamples] = useState([])
  const [hasAgreed, setAgreed] = useState(false)
  const [agreementError, setAgreementError] = useState(false)
  const [isSent, setSent] = useState(false)
  const [failure, setFailure] = useState(null)

  const form = useForm({
    initialValues: {
      coverMessage: '',
      price: '',
      deliveryDays: String(DELIVERY_DAY_OPTIONS[2]),
      revisionsIncluded: String(REVISION_OPTIONS[1]),
    },
    validators: {
      coverMessage: compose(
        required('Tell the buyer how you would approach this brief.'),
        minLength(
          COVER_MESSAGE_LENGTH.min,
          `A few more sentences, please — at least ${COVER_MESSAGE_LENGTH.min} characters.`
        ),
        maxLength(COVER_MESSAGE_LENGTH.max)
      ),
      price: (value) =>
        Number(value) > 0 ? undefined : 'Enter the price you would charge for this brief.',
    },
  })

  const { reset } = form

  // Reopening is a fresh start: the dialog is mounted for the life of the page,
  // so without this an abandoned draft (or a success screen) would still be
  // there the next time it opens.
  useEffect(() => {
    if (!open) return
    setSent(false)
    setFailure(null)
    setAgreementError(false)
    setAgreed(Boolean(proposal))
    setSamples(proposal?.sampleItemIds ?? [])
    reset({
      coverMessage: proposal?.coverMessage ?? '',
      price: proposal?.price != null ? String(proposal.price) : '',
      deliveryDays: String(proposal?.deliveryDays ?? DELIVERY_DAY_OPTIONS[2]),
      revisionsIncluded: String(proposal?.revisionsIncluded ?? REVISION_OPTIONS[1]),
    })
  }, [open, proposal, reset])

  // Published work only — `listPublished` is the boundary that keeps drafts,
  // submissions, and restricted items out of a buyer's hands (Prompt 22).
  const { data: portfolio, isLoading: isPortfolioLoading } = useApiQuery(
    () => portfolioService.listPublished(creatorProfileId, { page: 1, limit: 24 }),
    [creatorProfileId, open],
    { enabled: open && Boolean(creatorProfileId) }
  )

  const publishedItems = useMemo(() => portfolio?.items ?? [], [portfolio])

  const { mutate: send, isLoading: isSending } = useApiMutation(
    isEditing
      ? (values) => proposalService.editProposal(proposal.id, values, { creatorId: creatorUserId })
      : (values) => proposalService.submitProposal(values)
  )

  const priceFit = describePriceFit(form.values.price, request)

  const handleSubmit = form.handleSubmit(async (values) => {
    if (!hasAgreed) {
      setAgreementError(true)
      // The acknowledgement is bespoke state rather than a `useForm` field, so
      // `handleSubmit`'s focus-first-invalid does not reach it — send it there
      // by hand, the way the other bespoke dialogs do (00 §12).
      focusFieldById('proposal-terms')
      return
    }

    setFailure(null)

    const payload = {
      requestId: request.id,
      creatorId: creatorUserId,
      coverMessage: values.coverMessage,
      price: values.price,
      deliveryDays: Number(values.deliveryDays),
      revisionsIncluded: Number(values.revisionsIncluded),
      sampleItemIds: samples,
    }

    try {
      await send(payload)

      if (isEditing) {
        onSubmitted?.()
        toast.success('Proposal updated', {
          description: 'The buyer sees your new numbers straight away.',
        })
        onClose?.()
        return
      }

      // Success screen **first**, then the page behind is told: `onSubmitted`
      // refetches, and this dialog must already be showing the outcome by the
      // time that lands.
      setSent(true)
      onSubmitted?.()
    } catch (error) {
      // A field the service rejected is shown under that field; anything else
      // (a closed brief, a duplicate, availability off) becomes the banner,
      // because it is about the *situation* rather than about what was typed.
      const details = error?.details ?? {}
      const fieldNames = ['coverMessage', 'price', 'deliveryDays', 'revisionsIncluded']
      const handled = fieldNames.filter((name) => details[name])
      handled.forEach((name) => form.setError(name, details[name]))

      if (handled.length === 0) {
        setFailure(error)
        toast.error('We could not send your proposal', { description: error?.message })
      }
    }
  })

  /* -- success state ------------------------------------------------------- */

  if (isSent) {
    return (
      <ResponsiveDialog
        open={open}
        onClose={onClose}
        title="Proposal sent"
        maxWidth="sm"
        actions={
          <>
            <Button component={RouterLink} to={paths.CREATOR_PROPOSALS} color="inherit">
              View my proposals
            </Button>
            <Button variant="gradient" onClick={onClose}>
              Back to the brief
            </Button>
          </>
        }
      >
        <Stack spacing={2} alignItems="center" sx={{ textAlign: 'center', py: 2 }}>
          <Box
            sx={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              display: 'grid',
              placeItems: 'center',
              bgcolor: (theme) => alpha(theme.palette.success.main, 0.12),
              color: 'success.main',
            }}
          >
            <Icon icon="tabler:check" width={32} aria-hidden="true" />
          </Box>
          <Typography variant="h6" component="p">
            The buyer has been notified
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: '46ch' }}>
            They will compare your proposal against the others on this brief. You can edit or
            withdraw it from My proposals until they respond.
          </Typography>
        </Stack>
      </ResponsiveDialog>
    )
  }

  /* -- the form ------------------------------------------------------------ */

  return (
    <ResponsiveDialog
      open={open}
      onClose={onClose}
      title={isEditing ? 'Edit your proposal' : 'Send a proposal'}
      description={request?.title}
      maxWidth="sm"
      actions={
        <>
          <Button onClick={onClose} color="inherit" disabled={isSending}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="proposal-form"
            variant="gradient"
            disabled={isSending}
            startIcon={
              isSending ? null : <Icon icon="tabler:send" width={18} aria-hidden="true" />
            }
          >
            {isSending
              ? isEditing
                ? 'Saving…'
                : 'Sending…'
              : isEditing
                ? 'Save changes'
                : 'Send proposal'}
          </Button>
        </>
      }
    >
      <Box component="form" id="proposal-form" onSubmit={handleSubmit} noValidate>
        <Stack spacing={2.5}>
          {failure ? (
            <Alert severity="error" onClose={() => setFailure(null)}>
              {failure.message}
            </Alert>
          ) : null}

          <FormTextField
            label="Your cover message"
            multiline
            minRows={5}
            maxRows={12}
            maxLength={COVER_MESSAGE_LENGTH.max}
            required
            placeholder="How would you shoot this? Say what you have done that is close to it, how you would run the day, and what the buyer gets at the end."
            helperText={`Buyers read this before the price. ${COVER_MESSAGE_LENGTH.min}–${COVER_MESSAGE_LENGTH.max} characters.`}
            {...form.fieldProps('coverMessage')}
          />

          <Divider />

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <CurrencyField
              label="Your price"
              required
              helperText={priceFit ? undefined : `This buyer’s budget: ${formatBudget(request)}`}
              sx={{ flex: 1 }}
              {...form.fieldProps('price')}
            />
            <FormSelect
              label="Delivery time"
              options={DELIVERY_OPTIONS}
              helperText="From the day the buyer accepts"
              sx={{ flex: 1 }}
              {...form.fieldProps('deliveryDays')}
            />
          </Stack>

          {priceFit ? (
            <Typography variant="body2" sx={{ color: priceFit.tone, mt: -1 }}>
              {priceFit.text}
            </Typography>
          ) : null}

          <FormSelect
            label="Revisions included"
            options={REVISIONS_OPTIONS}
            helperText="Rounds of changes covered by your price"
            {...form.fieldProps('revisionsIncluded')}
          />

          <EarningsPreview
            price={form.values.price}
            categoryId={request?.categoryId}
            creatorId={creatorUserId}
            currency={request?.currency}
          />

          <Divider />

          <SamplesPicker
            items={publishedItems}
            value={samples}
            onChange={setSamples}
            max={MAX_SAMPLE_ITEMS}
            isLoading={isPortfolioLoading}
          />

          <Divider />

          <Box>
            <FormControlLabel
              control={
                <Checkbox
                  id="proposal-terms"
                  checked={hasAgreed}
                  onChange={(event) => {
                    setAgreed(event.target.checked)
                    if (event.target.checked) setAgreementError(false)
                  }}
                  inputProps={{ 'aria-describedby': 'proposal-terms-error' }}
                />
              }
              label={
                <Typography variant="body2" color="text.secondary">
                  I can deliver this brief as described, and the work will meet the{' '}
                  <Link component={RouterLink} to={paths.CONTENT_POLICY} target="_blank">
                    Content Policy
                  </Link>{' '}
                  and{' '}
                  <Link component={RouterLink} to={paths.TERMS} target="_blank">
                    Terms
                  </Link>
                  .
                </Typography>
              }
              sx={{ alignItems: 'flex-start', mr: 0, '& .MuiCheckbox-root': { pt: 0.25 } }}
            />
            {agreementError ? (
              <FormHelperText id="proposal-terms-error" error sx={{ ml: 4 }}>
                Please confirm this before sending your proposal.
              </FormHelperText>
            ) : null}
          </Box>
        </Stack>
      </Box>
    </ResponsiveDialog>
  )
}
