import { Icon } from '@iconify/react'
import Accordion from '@mui/material/Accordion'
import AccordionDetails from '@mui/material/AccordionDetails'
import AccordionSummary from '@mui/material/AccordionSummary'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'

import { WALLET_FAQ } from '../content/wallet'

// The mini-FAQ. Three questions, in the same accordion treatment the full FAQ
// page uses (`staticPages/pages/FaqPage.jsx`) — one hairline-separated panel,
// MUI's own top rule suppressed, 56px summaries so every control clears the
// 44px touch target (00 §13).
//
// Deliberately not deep-linkable: these three answers are a summary, and the
// questions that need an anchor live on `/faq`.

export default function WalletFaq() {
  return (
    <Box
      sx={{
        borderRadius: 3,
        border: 1,
        borderColor: 'divider',
        bgcolor: 'background.paper',
        overflow: 'hidden',
      }}
    >
      {WALLET_FAQ.map((item) => (
        <Accordion
          key={item.key}
          disableGutters
          square
          elevation={0}
          sx={{
            bgcolor: 'transparent',
            '&::before': { display: 'none' },
            '&:not(:last-of-type)': { borderBottom: 1, borderColor: 'divider' },
          }}
        >
          <AccordionSummary
            id={`wallet-faq-${item.key}-header`}
            aria-controls={`wallet-faq-${item.key}-content`}
            expandIcon={<Icon icon="tabler:chevron-down" width={20} />}
            sx={{ minHeight: 56, px: { xs: 2, md: 3 }, py: 1 }}
          >
            <Typography variant="subtitle1" component="h3" sx={{ pr: 1 }}>
              {item.question}
            </Typography>
          </AccordionSummary>

          <AccordionDetails
            id={`wallet-faq-${item.key}-content`}
            sx={{ px: { xs: 2, md: 3 }, pt: 0, pb: 3 }}
          >
            <Typography variant="body1" color="text.secondary" sx={{ maxWidth: '68ch' }}>
              {item.answer}
            </Typography>
          </AccordionDetails>
        </Accordion>
      ))}
    </Box>
  )
}
