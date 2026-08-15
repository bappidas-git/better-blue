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
import { PRIVACY_INTRO, PRIVACY_SECTIONS, PRIVACY_TOC } from '../content/privacy'

// Privacy Policy — same frame as the Terms page; the notice itself lives in
// ../content/privacy.js and carries the same "replace before launch" banner.

const RELATED = [
  { key: 'terms', label: 'Terms of Service', to: paths.TERMS },
  { key: 'policy', label: 'Content Policy', to: paths.CONTENT_POLICY },
  { key: 'contact', label: 'Contact support', to: paths.CONTACT },
]

export default function PrivacyPage() {
  return (
    <InfoPageLayout
      documentTitle="Privacy Policy"
      eyebrow="Legal"
      title="Privacy Policy"
      intro={PRIVACY_INTRO}
      meta={`Last updated ${formatDate(LEGAL_LAST_UPDATED)}`}
      banner={
        <Alert severity="info" icon={<Icon icon="tabler:info-circle" width={20} />}>
          {LEGAL_TEMPLATE_NOTICE}
        </Alert>
      }
      toc={PRIVACY_TOC}
    >
      <LegalDocument sections={PRIVACY_SECTIONS} />

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
