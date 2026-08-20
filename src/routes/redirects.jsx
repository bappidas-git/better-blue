import { Navigate, useLocation, useParams } from 'react-router-dom'

import { paths } from './paths'

// Redirect elements for renamed URLs. Route tables stay declarative, and a
// renamed path keeps working instead of turning into a 404.

/**
 * `/requests` → `/feeds` and `/requests/:requestId` → `/feeds/:feedId` (V2-02).
 *
 * `<Navigate>` does not interpolate `:params`, so this reads the id it was
 * given and rebuilds the target through `paths`; without a param it lands on
 * the board. The query string and hash ride along untouched, so a bookmarked
 * `/requests?category=…&sort=…` keeps its filters across the rename, and
 * `replace` keeps the dead URL out of the history stack.
 */
export function LegacyFeedRedirect() {
  const { requestId } = useParams()
  const { search, hash } = useLocation()
  const pathname = requestId ? paths.feedDetail(requestId) : paths.FEEDS

  return <Navigate to={{ pathname, search, hash }} replace />
}

export default LegacyFeedRedirect
