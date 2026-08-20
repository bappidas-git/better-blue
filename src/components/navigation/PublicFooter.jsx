import Box from '@mui/material/Box'
import Container from '@mui/material/Container'
import Divider from '@mui/material/Divider'
import Link from '@mui/material/Link'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { Link as RouterLink } from 'react-router-dom'

import Logo from '@/components/brand/Logo'
import { paths } from '@/routes/paths'

// Signed-out footer: brand block plus four link columns on desktop, everything
// stacked on mobile (no accordions — the lists are short enough to just read).
// Neutral dark-on-light per 00 §6; the only brand color here is the logo.

const FOOTER_COLUMNS = [
  {
    key: 'marketplace',
    // V2-02: the same four storefront destinations the top nav leads with, in
    // the same order and under the same names. Pricing moved out of this column
    // and is reached from the nav, the info pages, and the CTA bands.
    title: 'Marketplace',
    links: [
      { key: 'home', label: 'Home', to: paths.HOME },
      { key: 'feeds', label: 'Feeds', to: paths.FEEDS },
      { key: 'creators', label: 'Creators', to: paths.CREATORS },
      { key: 'wallet', label: 'Wallet', to: paths.WALLET },
    ],
  },
  {
    key: 'company',
    title: 'Company',
    links: [
      { key: 'about', label: 'About BetterBlue', to: paths.ABOUT },
      { key: 'how-it-works', label: 'How It Works', to: paths.HOW_IT_WORKS },
      { key: 'register', label: 'Join BetterBlue', to: paths.REGISTER },
    ],
  },
  {
    key: 'trust',
    title: 'Trust & Safety',
    links: [
      { key: 'content-policy', label: 'Content Policy', to: paths.CONTENT_POLICY },
      { key: 'terms', label: 'Terms of Service', to: paths.TERMS },
      { key: 'privacy', label: 'Privacy Policy', to: paths.PRIVACY },
    ],
  },
  {
    key: 'support',
    title: 'Support',
    links: [
      { key: 'faq', label: 'Help & FAQ', to: paths.FAQ },
      { key: 'contact', label: 'Contact Us', to: paths.CONTACT },
      { key: 'login', label: 'Log in', to: paths.LOGIN },
    ],
  },
]

export default function PublicFooter() {
  return (
    <Box
      component="footer"
      sx={{ mt: 'auto', bgcolor: 'background.paper', borderTop: 1, borderColor: 'divider' }}
    >
      <Container maxWidth="lg" sx={{ px: { xs: 2, md: 4 }, py: { xs: 6, md: 8 } }}>
        <Box
          sx={{
            display: 'grid',
            gap: { xs: 4, md: 5 },
            gridTemplateColumns: {
              xs: '1fr',
              sm: 'repeat(2, minmax(0, 1fr))',
              md: 'minmax(0, 1.4fr) repeat(4, minmax(0, 1fr))',
            },
          }}
        >
          <Stack spacing={2} sx={{ gridColumn: { sm: '1 / -1', md: 'auto' } }}>
            <Logo variant="full" size={30} />
            <Typography variant="body2" color="text.secondary" sx={{ maxWidth: '34ch' }}>
              The professional marketplace where businesses commission commercial photos and
              videos from vetted creators.
            </Typography>
          </Stack>

          {FOOTER_COLUMNS.map((column) => (
            <Box component="nav" key={column.key} aria-label={column.title}>
              <Typography
                variant="subtitle2"
                component="h2"
                sx={{ mb: { xs: 0.5, md: 1.5 }, color: 'text.primary' }}
              >
                {column.title}
              </Typography>
              <Stack component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
                {column.links.map((link) => (
                  <Box component="li" key={link.key}>
                    <Link
                      component={RouterLink}
                      to={link.to}
                      variant="body2"
                      underline="hover"
                      color="text.secondary"
                      sx={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        minHeight: 44,
                        '&:hover': { color: 'text.primary' },
                      }}
                    >
                      {link.label}
                    </Link>
                  </Box>
                ))}
              </Stack>
            </Box>
          ))}
        </Box>

        <Divider sx={{ my: { xs: 4, md: 5 } }} />

        <Typography variant="caption" color="text.secondary">
          © 2026 BetterBlue. Professional commercial content marketplace.
        </Typography>
      </Container>
    </Box>
  )
}
