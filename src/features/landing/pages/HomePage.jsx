import Box from '@mui/material/Box'

import useDocumentTitle from '@/hooks/useDocumentTitle'
import useApiQuery from '@/hooks/useApiQuery'
import { categoryService } from '@/services'

import AudiencePanels from '../components/AudiencePanels'
import CategoryGrid from '../components/CategoryGrid'
import FeaturedCreators from '../components/FeaturedCreators'
import FinalCta from '../components/FinalCta'
import Hero from '../components/Hero'
import HowItWorksSection from '../components/HowItWorksSection'
import StatsBand from '../components/StatsBand'
import Testimonials from '../components/Testimonials'
import TrustBand from '../components/TrustBand'
import useLandingAnimations from '../hooks/useLandingAnimations'

// The landing page: nine bands, composed here and implemented one file each.
//
// Two things this file owns, and nothing else does:
//
// - **The GSAP root.** `useLandingAnimations` binds every marketing scene on
//   the page to this element and reverts them on unmount. The whole layer is
//   inside the lazily-loaded landing chunk, so GSAP never reaches the app
//   bundle (00 §7).
// - **The categories request.** The category grid renders the taxonomy and the
//   featured shelf labels its chips from it, so it is fetched once here and
//   passed to both rather than requested by each of them.
//
// Everything else fetches its own data and fails on its own: a section that
// cannot load renders a quiet fallback, and the page around it is unaffected.

export default function HomePage() {
  useDocumentTitle('Commercial content, made by creators')

  const rootRef = useLandingAnimations()

  const {
    data: categories,
    isLoading: categoriesLoading,
    error: categoriesError,
  } = useApiQuery(() => categoryService.listActive(), [])

  return (
    <Box ref={rootRef}>
      <Hero />
      <TrustBand />
      <HowItWorksSection />
      <CategoryGrid
        categories={categories}
        isLoading={categoriesLoading}
        error={categoriesError}
      />
      <FeaturedCreators categories={categories} />
      <AudiencePanels />
      <StatsBand />
      <Testimonials />
      <FinalCta />
    </Box>
  )
}
