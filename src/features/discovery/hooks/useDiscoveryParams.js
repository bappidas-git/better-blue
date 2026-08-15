import { listParam, useListParams } from '@/hooks/useListParams'

// Creator discovery's names for the shared URL-state hook.
//
// Prompt 12 wrote the implementation here; Prompt 23 lifted it verbatim to
// `src/hooks/useListParams.js` so the request board could declare its own
// schema against the same machinery (00 §16.4 — reuse before creating). This
// module stays as the discovery feature's spelling of it: `creatorFilters.js`
// and `CreatorsPage` keep importing `discoveryParam` / `useDiscoveryParams`
// from here, and nothing about their behaviour changed.

export { listParam as discoveryParam, useListParams as useDiscoveryParams }

export default useListParams
