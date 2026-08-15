import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { Link as RouterLink } from 'react-router-dom'

import StatusChip from '@/components/data-display/StatusChip'
import { CONTENT_STATUS } from '@/constants/statuses'
import { POLICY_INTRO, POLICY_LAST_UPDATED, POLICY_SECTIONS } from '@/constants/policy'
import { paths } from '@/routes/paths'
import { formatDate } from '@/utils/formatters'

import InfoPageLayout from '../components/InfoPageLayout'
import InfoSection from '../components/InfoSection'
import ProseList from '../components/ProseList'
import { POLICY_REPORTING, POLICY_REVIEW_STATES_NOTE } from '../content/contentPolicy'

// The Content Policy — the canonical trust-and-safety surface for the whole
// product (00 §1).
//
// Every word of the policy comes from `src/constants/policy.js`, which is the
// same module the moderation console and its rejection reasons read (Prompt
// 30). There is deliberately no policy copy in this file: a second copy of the
// rules is a second copy to keep in step, and reviewers would eventually be
// enforcing something the public page does not say.

/** The review states a submission moves through, in the order it moves. */
const REVIEW_FLOW = [
  CONTENT_STATUS.SUBMITTED,
  CONTENT_STATUS.UNDER_REVIEW,
  CONTENT_STATUS.APPROVED,
]

/** Where a review can land instead of approval, plus the post-publication one. */
const REVIEW_OUTCOMES = [
  CONTENT_STATUS.REVISION_REQUIRED,
  CONTENT_STATUS.REJECTED,
  CONTENT_STATUS.RESTRICTED,
]

const POLICY_TOC = [
  ...POLICY_SECTIONS.map((section) => ({ id: section.id, label: section.title })),
  { id: POLICY_REPORTING.id, label: POLICY_REPORTING.title },
]

/** The review-state strip shown inside the enforcement section. */
function ReviewStates() {
  return (
    <Box sx={{ mt: 3 }}>
      <Typography variant="subtitle2" component="h3" sx={{ mb: 1.5 }}>
        Review states
      </Typography>

      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
        {REVIEW_FLOW.map((status, index) => (
          <Stack key={status} direction="row" spacing={1} alignItems="center">
            {index > 0 ? (
              <Box aria-hidden="true" sx={{ display: 'flex', color: 'text.disabled' }}>
                <Icon icon="tabler:arrow-right" width={16} />
              </Box>
            ) : null}
            <StatusChip status={status} size="sm" tooltip />
          </Stack>
        ))}
      </Stack>

      <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
        {POLICY_REVIEW_STATES_NOTE}
      </Typography>

      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mt: 1.5 }}>
        {REVIEW_OUTCOMES.map((status) => (
          <StatusChip key={status} status={status} size="sm" tooltip />
        ))}
      </Stack>
    </Box>
  )
}

export default function ContentPolicyPage() {
  return (
    <InfoPageLayout
      documentTitle="Content Policy"
      eyebrow="Trust & Safety"
      title="Content Policy"
      intro={POLICY_INTRO}
      meta={`Last updated ${formatDate(POLICY_LAST_UPDATED)}`}
      toc={POLICY_TOC}
    >
      {POLICY_SECTIONS.map((section) => (
        <InfoSection
          key={section.id}
          id={section.id}
          title={section.title}
          description={section.summary}
        >
          <ProseList items={section.rules} />

          {/* The enforcement section is where the review states belong — they
              are the same `CONTENT_STATUS` values the moderation queue uses. */}
          {section.id === 'enforcement' ? <ReviewStates /> : null}
        </InfoSection>
      ))}

      <InfoSection
        id={POLICY_REPORTING.id}
        title={POLICY_REPORTING.title}
        description={POLICY_REPORTING.summary}
      >
        <Stack spacing={2}>
          {POLICY_REPORTING.paragraphs.map((paragraph) => (
            <Typography key={paragraph} variant="body1" color="text.secondary">
              {paragraph}
            </Typography>
          ))}

          <Box>
            <Button
              component={RouterLink}
              to={paths.CONTACT}
              variant="outlined"
              startIcon={<Icon icon="tabler:flag" width={20} />}
            >
              {POLICY_REPORTING.ctaLabel}
            </Button>
          </Box>
        </Stack>
      </InfoSection>
    </InfoPageLayout>
  )
}
