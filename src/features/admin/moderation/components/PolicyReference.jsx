import { Icon } from '@iconify/react'
import Accordion from '@mui/material/Accordion'
import AccordionDetails from '@mui/material/AccordionDetails'
import AccordionSummary from '@mui/material/AccordionSummary'
import Box from '@mui/material/Box'
import Link from '@mui/material/Link'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'

import { POLICY_LAST_UPDATED, POLICY_SECTIONS } from '@/constants/policy'
import { paths } from '@/routes/paths'
import { formatDate } from '@/utils/formatters'

// The Content Policy, beside the content — Prompt 30 §4.3.
//
// Same source as the public page (`constants/policy.js`, Prompt 11), rendered
// collapsed: a reviewer who knows the rule does not need it on screen, and one
// who is checking a borderline case should not have to open another tab and
// lose the submission. Single-sourced on purpose (§7) — if the rule a decision
// cites is not the rule the creator read, the decision is not defensible.
//
// MUI's `Accordion` carries the keyboard behaviour (Enter/Space to toggle,
// `aria-expanded`, `aria-controls`) and the focus ring, so §12 comes for free.

export default function PolicyReference() {
  return (
    <Box component="section" aria-labelledby="policy-reference-heading">
      <Stack
        direction="row"
        spacing={1}
        alignItems="baseline"
        justifyContent="space-between"
        sx={{ mb: 1 }}
      >
        <Typography id="policy-reference-heading" variant="subtitle2" component="h3">
          Content Policy
        </Typography>
        <Link
          href={paths.CONTENT_POLICY}
          target="_blank"
          rel="noopener noreferrer"
          variant="caption"
          underline="hover"
          sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}
        >
          <Icon icon="solar:arrow-right-up-linear" width={14} aria-hidden="true" />
          Public page
        </Link>
      </Stack>

      <Typography variant="caption" color="text.secondary" component="p" sx={{ mb: 1.5 }}>
        The same policy members read. Last updated {formatDate(POLICY_LAST_UPDATED)}.
      </Typography>

      <Box>
        {POLICY_SECTIONS.map((section) => (
          <Accordion
            key={section.id}
            disableGutters
            elevation={0}
            square
            sx={{
              border: 1,
              borderColor: 'divider',
              borderRadius: 1.5,
              mb: 1,
              '&::before': { display: 'none' },
            }}
          >
            <AccordionSummary
              expandIcon={<Icon icon="tabler:chevron-down" width={18} aria-hidden="true" />}
              aria-controls={`policy-${section.id}-content`}
              id={`policy-${section.id}-header`}
              sx={{ minHeight: 44, px: 1.5 }}
            >
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {section.title}
              </Typography>
            </AccordionSummary>
            <AccordionDetails sx={{ px: 1.5, pt: 0, pb: 2 }}>
              <Typography variant="caption" color="text.secondary" component="p" sx={{ mb: 1 }}>
                {section.summary}
              </Typography>
              <Stack component="ul" spacing={0.75} sx={{ m: 0, pl: 2.5 }}>
                {section.rules.map((rule) => (
                  <Typography component="li" variant="body2" key={rule}>
                    {rule}
                  </Typography>
                ))}
              </Stack>
            </AccordionDetails>
          </Accordion>
        ))}
      </Box>
    </Box>
  )
}
