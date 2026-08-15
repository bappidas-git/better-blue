import Container from '@mui/material/Container'

import PageHeader from '@/components/layout/PageHeader'
import useDocumentTitle from '@/hooks/useDocumentTitle'

import { usePublishDashboardPageTitle } from './DashboardPageContext'

// The wrapper **every** dashboard page renders inside — buyer, creator, admin,
// super admin alike (00 §12). It owns the three things that must not drift from
// screen to screen: the page gutters, the document title, and the heading.
//
// Gutters are px 2/3/4 and py 3 (00 §6 spacing scale). The bottom padding that
// keeps content clear of the mobile bar belongs to the layout, not here, so a
// page never has to know a bar exists.
//
// @example
// export default function BuyerOrdersPage() {
//   return (
//     <DashboardPage title="Orders" subtitle="Everything in flight" actions={<NewOrderButton />}>
//       <OrdersTable />
//     </DashboardPage>
//   )
// }

/**
 * @param {object} props
 * @param {React.ReactNode} props.title page heading — also the top-bar title and, by
 *   default, the document title. Rendered as the page `h1`.
 * @param {string} [props.documentTitle] override for the browser tab when the heading
 *   is a node or too long for a tab
 * @param {React.ReactNode} [props.subtitle] one line under the heading
 * @param {React.ReactNode} [props.breadcrumbs] breadcrumbs slot, above the heading
 * @param {React.ReactNode} [props.meta] inline slot beside the heading — a `StatusChip`, an id
 * @param {React.ReactNode} [props.actions] page-level buttons, right-aligned on desktop
 * @param {string} [props.backTo] route path for a back button (detail pages)
 * @param {'sm'|'md'|'lg'|'xl'|false} [props.maxWidth='lg'] content width cap; `false` fills the area
 * @param {boolean} [props.disableHeader=false] skip the heading block — for pages that
 *   open with their own hero or tab strip
 * @param {React.ReactNode} props.children page content
 * @param {object} [props.sx] MUI system styles applied to the content container
 */
export default function DashboardPage({
  title,
  documentTitle,
  subtitle,
  breadcrumbs,
  meta,
  actions,
  backTo,
  maxWidth = 'lg',
  disableHeader = false,
  children,
  sx,
  ...rest
}) {
  const plainTitle = documentTitle ?? (typeof title === 'string' ? title : undefined)

  useDocumentTitle(plainTitle)
  usePublishDashboardPageTitle(plainTitle)

  return (
    <Container
      maxWidth={maxWidth}
      disableGutters
      sx={{
        px: { xs: 2, sm: 3, md: 4 },
        py: 3,
        mx: maxWidth === false ? 0 : 'auto',
        ...sx,
      }}
      {...rest}
    >
      {!disableHeader && title ? (
        <PageHeader
          title={title}
          subtitle={subtitle}
          breadcrumbs={breadcrumbs}
          meta={meta}
          actions={actions}
          backTo={backTo}
        />
      ) : null}

      {children}
    </Container>
  )
}
