import Box from '@mui/material/Box'
import Container from '@mui/material/Container'
import Link from '@mui/material/Link'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'

import FadeInView from '@/components/motion/FadeInView'
import { appConfig } from '@/config/appConfig'
import useDocumentTitle from '@/hooks/useDocumentTitle'

// The shell every public information page mounts into — one header treatment
// (eyebrow → h1 → intro), one prose measure, one table of contents.
//
// Two layout modes, because these eight pages are two kinds of document:
// - `prose` (default) caps the column at 68ch for pages that are mostly text
//   (Content Policy, Terms, Privacy).
// - `wide` lets the column run to the container for pages built from cards,
//   timelines, and forms; their paragraphs cap themselves.
//
// The table of contents is desktop-only (00 §11: hidden below `lg`) and sticks
// under the public top nav. That same nav height is what section anchors have to
// clear, so `scroll-margin-top` is applied here, once, to every `<section id>`
// the page renders — no page has to remember it.

/** Sticky/anchor offset: the top nav plus a little breathing room. */
const NAV_OFFSET = {
  xs: appConfig.topNavHeight.xs + 16,
  md: appConfig.topNavHeight.md + 24,
}

/** Comfortable reading measure (00 §6). */
const PROSE_WIDTH = '68ch'

/**
 * Desktop-only "On this page" rail. Plain `#hash` anchors, so the browser does
 * the scrolling natively and `scroll-margin-top` above keeps the heading clear
 * of the sticky nav.
 */
function TableOfContents({ items }) {
  return (
    <Box
      component="nav"
      aria-label="On this page"
      sx={{
        display: { xs: 'none', lg: 'block' },
        position: 'sticky',
        top: NAV_OFFSET.md,
        alignSelf: 'start',
      }}
    >
      <Typography variant="overline" component="p" color="text.secondary" sx={{ mb: 1 }}>
        On this page
      </Typography>

      <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
        {items.map((item) => (
          <Box component="li" key={item.id}>
            <Link
              href={`#${item.id}`}
              variant="body2"
              underline="hover"
              color="text.secondary"
              sx={{
                display: 'block',
                py: 0.75,
                lineHeight: 1.4,
                '&:hover': { color: 'text.primary' },
              }}
            >
              {item.label}
            </Link>
          </Box>
        ))}
      </Box>
    </Box>
  )
}

/**
 * @param {object} props
 * @param {string} props.documentTitle browser tab title (without the app name)
 * @param {React.ReactNode} [props.eyebrow] small uppercase label above the title
 * @param {React.ReactNode} props.title page `h1`
 * @param {React.ReactNode} [props.intro] lead paragraph under the title
 * @param {React.ReactNode} [props.meta] small print under the intro — e.g. "Last updated…"
 * @param {React.ReactNode} [props.banner] full-width note between header and content (an `Alert`)
 * @param {{id: string, label: string}[]} [props.toc] table-of-contents entries; omit for no rail
 * @param {'sm'|'md'|'lg'} [props.maxWidth='md'] container width — forced to `lg` when a `toc` is given
 * @param {'prose'|'wide'} [props.contentWidth='prose'] cap the content column at 68ch, or let it fill
 * @param {React.ReactNode} props.children page sections — `InfoSection` elements
 */
export default function InfoPageLayout({
  documentTitle,
  eyebrow,
  title,
  intro,
  meta,
  banner,
  toc,
  maxWidth = 'md',
  contentWidth = 'prose',
  children,
}) {
  useDocumentTitle(documentTitle)

  const hasToc = Array.isArray(toc) && toc.length > 0

  return (
    <Container
      maxWidth={hasToc ? 'lg' : maxWidth}
      sx={{ px: { xs: 2, md: 4 }, py: { xs: 6, md: 10 } }}
    >
      <FadeInView component="header" sx={{ mb: { xs: 4, md: 6 }, maxWidth: PROSE_WIDTH }}>
        {eyebrow ? (
          <Typography variant="overline" component="p" sx={{ color: 'primary.main' }}>
            {eyebrow}
          </Typography>
        ) : null}

        <Typography variant="h2" component="h1" sx={{ mt: eyebrow ? 1 : 0 }}>
          {title}
        </Typography>

        {intro ? (
          <Typography variant="body1" color="text.secondary" sx={{ mt: 2 }}>
            {intro}
          </Typography>
        ) : null}

        {meta ? (
          <Typography variant="caption" component="p" color="text.secondary" sx={{ mt: 2 }}>
            {meta}
          </Typography>
        ) : null}
      </FadeInView>

      {banner ? <Box sx={{ mb: { xs: 4, md: 6 }, maxWidth: PROSE_WIDTH }}>{banner}</Box> : null}

      <Box
        sx={{
          display: 'grid',
          alignItems: 'start',
          columnGap: { lg: 8 },
          gridTemplateColumns: hasToc
            ? { xs: 'minmax(0, 1fr)', lg: 'minmax(0, 1fr) 220px' }
            : 'minmax(0, 1fr)',
        }}
      >
        <Stack
          spacing={{ xs: 5, md: 7 }}
          sx={{
            minWidth: 0,
            maxWidth: contentWidth === 'prose' ? PROSE_WIDTH : '100%',
            '& section[id]': { scrollMarginTop: NAV_OFFSET },
          }}
        >
          {children}
        </Stack>

        {hasToc ? <TableOfContents items={toc} /> : null}
      </Box>
    </Container>
  )
}
