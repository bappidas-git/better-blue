import { useCallback, useState } from 'react'

import Box from '@mui/material/Box'

import useDocumentTitle from '@/hooks/useDocumentTitle'

import AudiencePanels from '../components/AudiencePanels'
import FeaturedCreators from '../components/FeaturedCreators'
import FinalCta from '../components/FinalCta'
import Hero from '../components/Hero'
import HowItWorksSection from '../components/HowItWorksSection'
import StatsBand from '../components/StatsBand'
import Testimonials from '../components/Testimonials'
import useLandingAnimations from '../hooks/useLandingAnimations'

// The landing page: seven bands, composed here and implemented one file each.
//
// V2-04 removed two of the original nine — the "Trusted by growing brands"
// strip and the category grid. Categories are gone from the storefront entirely
// (the collection, the admin screens, and the dashboard forms keep them), which
// is why this page no longer fetches the taxonomy at all.
//
// One thing this file owns, and nothing else does: **the GSAP root**.
// `useLandingAnimations` binds every marketing scene on the page to this
// element and reverts them on unmount. The whole layer is inside the lazily
// loaded landing chunk, so GSAP never reaches the app bundle (00 §7). The hero
// raises `onCardsReady` when its featured-creator cards land, because those
// arrive from the API a beat after the page mounts and the timeline has to know
// they exist before it can move them.
//
// Everything else fetches its own data and fails on its own: a section that
// cannot load renders a quiet fallback, and the page around it is unaffected.

export default function HomePage() {
  useDocumentTitle('Commercial content, made by creators')

  const [heroCardsReady, setHeroCardsReady] = useState(false)
  const handleHeroCardsReady = useCallback(() => setHeroCardsReady(true), [])

  const rootRef = useLandingAnimations({ heroCardsReady })

  return (
    <Box ref={rootRef}>
      <Hero onCardsReady={handleHeroCardsReady} />
      <HowItWorksSection />
      <FeaturedCreators />
      <AudiencePanels />
      <StatsBand />
      <Testimonials />
      <FinalCta />
    </Box>
  )
}
