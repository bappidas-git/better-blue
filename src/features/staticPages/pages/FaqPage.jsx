import { useEffect } from 'react'

import { Icon } from '@iconify/react'
import Accordion from '@mui/material/Accordion'
import AccordionDetails from '@mui/material/AccordionDetails'
import AccordionSummary from '@mui/material/AccordionSummary'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { useLocation } from 'react-router-dom'

import { paths } from '@/routes/paths'

import InfoCtaBand from '../components/InfoCtaBand'
import InfoPageLayout from '../components/InfoPageLayout'
import InfoSection from '../components/InfoSection'
import { FAQ_GROUPS, FAQ_INTRO } from '../content/faq'

// The FAQ. Four groups, each an accordion, each deep-linkable: other pages link
// to `/faq#orders-and-payments` and land on that group.
//
// Router navigations do not act on a URL fragment (and `ScrollRestoration` in
// `PublicLayout` sends every new navigation to the top), so the hash is honored
// here explicitly. In-page anchors — the contents rail — are plain `<a href>`
// and are scrolled by the browser itself; `InfoPageLayout` gives every section
// the `scroll-margin-top` that clears the sticky top nav either way.

const FAQ_TOC = FAQ_GROUPS.map((group) => ({ id: group.id, label: group.title }))

export default function FaqPage() {
  const { hash } = useLocation()

  useEffect(() => {
    if (!hash) return

    const id = decodeURIComponent(hash.slice(1))
    // Runs after ScrollRestoration's layout effect for the same navigation, so
    // this wins over the scroll-to-top it performs.
    document.getElementById(id)?.scrollIntoView()
  }, [hash])

  return (
    <InfoPageLayout
      documentTitle="Help & FAQ"
      eyebrow="Help"
      title="Frequently asked questions"
      intro={FAQ_INTRO}
      toc={FAQ_TOC}
      contentWidth="wide"
    >
      {FAQ_GROUPS.map((group) => (
        <InfoSection
          key={group.id}
          id={group.id}
          title={group.title}
          description={group.description}
        >
          <Box
            sx={{
              borderRadius: 3,
              border: 1,
              borderColor: 'divider',
              bgcolor: 'background.paper',
              overflow: 'hidden',
            }}
          >
            {group.questions.map((item) => (
              <Accordion
                key={item.key}
                disableGutters
                square
                elevation={0}
                sx={{
                  bgcolor: 'transparent',
                  // MUI draws a top hairline pseudo-element on every panel; the
                  // borders below place the dividers instead.
                  '&::before': { display: 'none' },
                  '&:not(:last-of-type)': { borderBottom: 1, borderColor: 'divider' },
                }}
              >
                <AccordionSummary
                  id={`${item.key}-header`}
                  aria-controls={`${item.key}-content`}
                  expandIcon={<Icon icon="tabler:chevron-down" width={20} />}
                  sx={{ minHeight: 56, px: { xs: 2, md: 3 }, py: 1 }}
                >
                  <Typography variant="subtitle1" component="h3" sx={{ pr: 1 }}>
                    {item.question}
                  </Typography>
                </AccordionSummary>

                <AccordionDetails
                  id={`${item.key}-content`}
                  sx={{ px: { xs: 2, md: 3 }, pt: 0, pb: 3 }}
                >
                  <Typography variant="body1" color="text.secondary" sx={{ maxWidth: '68ch' }}>
                    {item.answer}
                  </Typography>
                </AccordionDetails>
              </Accordion>
            ))}
          </Box>
        </InfoSection>
      ))}

      <InfoCtaBand
        title="Still need a hand?"
        description="Send our support team the details and we will come back to you — usually within one business day."
        primary={{ label: 'Contact support', to: paths.CONTACT, icon: 'tabler:mail' }}
        secondary={{ label: 'Read the Content Policy', to: paths.CONTENT_POLICY, icon: 'tabler:shield-check' }}
      />
    </InfoPageLayout>
  )
}
