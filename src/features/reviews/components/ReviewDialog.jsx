import { useEffect } from 'react'

import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import FormHelperText from '@mui/material/FormHelperText'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'

import RatingStars from '@/components/data-display/RatingStars'
import FormTextField from '@/components/inputs/FormTextField'
import ResponsiveDialog from '@/components/layout/ResponsiveDialog'
import useForm from '@/hooks/useForm'
import { RATING_MAX, RATING_MIN } from '@/services/reviewService'
import { compose, maxLength, minLength, required } from '@/utils/validators'

// Leaving a review. Two fields, and a warning that this one is permanent.
//
// Reviews are not editable (contract §6.18) — a public rating that could be
// revised after the fact is not a rating — so the dialog says so before anyone
// commits, in the same breath as explaining who reads it. That framing is also
// what gets a useful review: a buyer writing "for the next business deciding
// whether to hire them" writes something different from one leaving a score.
//
// `RatingStars` in input mode is a native radio group, so the stars are
// keyboard-operable with the arrow keys and announced as a labelled group (§12).

/** Shortest comment worth publishing — long enough to say what it was like. */
export const COMMENT_MIN = 20

/** Cap, matching the contract's `reviews.comment` column. */
export const COMMENT_MAX = 600

/** What each star means, so a rating is a judgement rather than a mood. */
const RATING_LABELS = {
  1: 'Fell well short of the brief',
  2: 'Below what we agreed',
  3: 'Met the brief with reservations',
  4: 'Good work, would hire again',
  5: 'Excellent — everything we asked for',
}

/**
 * @param {object} props
 * @param {boolean} props.open whether the dialog is shown
 * @param {() => void} props.onClose dismiss handler
 * @param {(values: {rating: number, comment: string}) => Promise<void>} props.onSubmit
 *   sends the review; the dialog stays open if it rejects, so nothing is lost
 * @param {string} [props.creatorName] who is being reviewed
 * @param {string} [props.orderTitle] what the review is about
 */
export default function ReviewDialog({ open, onClose, onSubmit, creatorName, orderTitle }) {
  const form = useForm({
    initialValues: { rating: 0, comment: '' },
    validators: {
      rating: (value) =>
        Number(value) >= RATING_MIN && Number(value) <= RATING_MAX
          ? undefined
          : 'Choose a rating from one to five stars.',
      comment: compose(
        required('Tell other businesses what working together was like.'),
        minLength(COMMENT_MIN, `Use at least ${COMMENT_MIN} characters.`),
        maxLength(COMMENT_MAX)
      ),
    },
  })

  const { reset } = form
  useEffect(() => {
    if (open) reset({ rating: 0, comment: '' })
  }, [open, reset])

  const submit = form.handleSubmit(async (values) => {
    await onSubmit({ rating: Number(values.rating), comment: values.comment.trim() })
  })

  const rating = Number(form.values.rating) || 0
  const ratingError = form.touched.rating ? form.errors.rating : undefined

  return (
    <ResponsiveDialog
      open={open}
      onClose={form.isSubmitting ? undefined : onClose}
      title={creatorName ? `Review ${creatorName}` : 'Leave a review'}
      description={
        orderTitle
          ? `How was “${orderTitle}”? Your review appears on their public profile.`
          : 'Your review appears on the creator’s public profile.'
      }
      actions={
        <>
          <Button onClick={onClose} color="inherit" disabled={form.isSubmitting}>
            Not now
          </Button>
          <Button onClick={submit} variant="gradient" disabled={form.isSubmitting}>
            {form.isSubmitting ? 'Publishing…' : 'Publish review'}
          </Button>
        </>
      }
    >
      <Stack component="form" spacing={2.5} onSubmit={submit} noValidate>
        <Box>
          <Typography
            component="p"
            variant="subtitle2"
            id="review-rating-label"
            sx={{ mb: 0.75 }}
          >
            Overall rating <Box component="span" sx={{ color: 'error.main' }}>*</Box>
          </Typography>
          <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
            <RatingStars
              size="lg"
              value={rating}
              onChange={(next) => {
                form.setValue('rating', next ?? 0)
                form.handleBlur('rating')
              }}
              label="Overall rating"
            />
            <Typography variant="body2" color="text.secondary" role="status">
              {RATING_LABELS[rating] ?? 'Not rated yet'}
            </Typography>
          </Stack>
          {ratingError ? (
            <FormHelperText error sx={{ mx: 0, mt: 0.5 }}>
              {ratingError}
            </FormHelperText>
          ) : null}
        </Box>

        <FormTextField
          label="Your review"
          required
          multiline
          minRows={4}
          maxRows={10}
          maxLength={COMMENT_MAX}
          placeholder="What was the work like, and what was working together like? Mention the brief, the turnaround, and anything another business would want to know before hiring."
          helperText="Written for the next business deciding whether to hire this creator."
          {...form.fieldProps('comment')}
        />

        <Alert severity="info">
          Reviews are published under your business name and cannot be edited or removed afterwards.
        </Alert>
      </Stack>
    </ResponsiveDialog>
  )
}
