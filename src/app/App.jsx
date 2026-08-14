import { Suspense } from 'react'

import { RouterProvider } from 'react-router-dom'

import AppLoader from '@/app/AppLoader'
import ErrorBoundary from '@/app/ErrorBoundary'
import { router } from '@/routes'

// The whole application is the router now. The two wrappers are the app-wide
// safety nets: `ErrorBoundary` catches render errors that escape the router
// (including a router that fails to boot), and the outer `Suspense` covers any
// lazy chunk resolving above a layout — the layouts host their own boundary so
// ordinary navigation keeps the nav and footer mounted.

export default function App() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<AppLoader fullScreen />}>
        <RouterProvider router={router} />
      </Suspense>
    </ErrorBoundary>
  )
}
