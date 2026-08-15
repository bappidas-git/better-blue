import { Icon } from '@iconify/react'
import Alert from '@mui/material/Alert'
import Link from '@mui/material/Link'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { Link as RouterLink } from 'react-router-dom'

import FadeInView from '@/components/motion/FadeInView'
import { paths } from '@/routes/paths'
import { formatDate } from '@/utils/formatters'

import InfoPageLayout from '../components/InfoPageLayout'
import LegalDocument from '../components/LegalDocument'
import { LEGAL_LAST_UPDATED, LEGAL_TEMPLATE_NOTICE } from '../content/legal'
import { TERMS_INTRO, TERMS_SECTIONS, TERMS_TOC } from '../content/terms'

// Terms of Service. The document itself lives in ../content/terms.js and is
// rendered by `LegalDocument`, so this file is only the page frame: the header,
// the template banner it must carry (Prompt 11 §4.7), and the related links.

const RELATED = [
  { key: 'policy', label: 'Content Policy', to: paths.CONTENT_POLICY },
  { key: 'privacy', label: 'Privacy Policy', to: paths.PRIVACY },
  { key: 'contact', label: 'Contact support', to: paths.CONTACT },
]

export default function TermsPage() {
  return (
    <InfoPageLayout
      documentTitle="Terms of Service"
      eyebrow="Legal"
      title="Terms of Service"
      intro={TERMS_INTRO}
      meta={`Last updated ${formatDate(LEGAL_LAST_UPDATED)}`}
      banner={
        <Alert severity="info" icon={<Icon icon="tabler:info-circle" width={20} />}>
          {LEGAL_TEMPLATE_NOTICE}
        </Alert>
      }
      toc={TERMS_TOC}
    >
      <LegalDocument sections={TERMS_SECTIONS} />

      <FadeInView>
        <Typography variant="subtitle2" component="h2" sx={{ mb: 1 }}>
          Related
        </Typography>
        <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
          {RELATED.map((item) => (
            <Link
              key={item.key}
              component={RouterLink}
              to={item.to}
              variant="body2"
              underline="hover"
              sx={{ display: 'inline-flex', alignItems: 'center', minHeight: 44 }}
            >
              {item.label}
            </Link>
          ))}
        </Stack>
      </FadeInView>
    </InfoPageLayout>
  )
}
