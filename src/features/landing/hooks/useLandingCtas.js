import { useMemo } from 'react'

import { useAuth } from '@/context/AuthContext'
import { paths } from '@/routes/paths'

// The landing page's two calls to action, in one place because the hero and the
// closing band must always agree — and because both change once someone is
// signed in: asking a member to "join" is the fastest way to look broken.
//
// Signed out, both routes lead to `/register`, which is where the role choice
// actually happens (Prompt 09). The labels carry the intent, so a visitor
// arrives at the right half of that form knowing which one they picked.

/**
 * @typedef {object} LandingCta
 * @property {string} label button text
 * @property {string} to route path from `paths`
 * @property {string} icon iconify name shown before the label
 */

/**
 * @returns {{primary: LandingCta, secondary: LandingCta, isAuthenticated: boolean}}
 */
export function useLandingCtas() {
  const { user, isAuthenticated } = useAuth()
  const role = user?.role

  return useMemo(() => {
    if (isAuthenticated) {
      return {
        isAuthenticated: true,
        primary: {
          label: 'Go to dashboard',
          to: paths.roleHome(role),
          icon: 'tabler:layout-dashboard',
        },
        secondary: { label: 'Find creators', to: paths.CREATORS, icon: 'tabler:users-group' },
      }
    }

    return {
      isAuthenticated: false,
      primary: {
        label: 'Post a content request',
        to: paths.REGISTER,
        icon: 'tabler:file-text',
      },
      secondary: { label: 'Become a creator', to: paths.REGISTER, icon: 'tabler:camera' },
    }
  }, [isAuthenticated, role])
}

export default useLandingCtas
