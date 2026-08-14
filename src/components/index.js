// Shared component library barrel — prompts/04 §7.
//
// Named re-exports only: bundlers can drop anything a page does not import, and
// features get one obvious import path:
//
//   import { DataTable, PageHeader, StatusChip, useToast } from '@/components'
//
// Deep imports (`@/components/table/DataTable`) stay valid and are the better
// choice inside other library components, which is why the modules themselves
// keep default exports. Everything here is controlled and prop-driven: no API
// awareness, no business logic (00 §16.9).

/* Brand ------------------------------------------------------------------- */
export { default as Logo } from './brand/Logo'

/* Feedback ---------------------------------------------------------------- */
export { default as ToastProvider, useToast } from './feedback/ToastProvider'
export { default as ConfirmDialogProvider, useConfirm } from './feedback/ConfirmDialogProvider'
export { default as EmptyState } from './feedback/EmptyState'
export { default as ErrorState } from './feedback/ErrorState'
export {
  CardSkeleton,
  ListSkeleton,
  TableSkeleton,
  StatSkeleton,
  ProfileSkeleton,
  FormSkeleton,
} from './feedback/skeletons'

/* Data display ------------------------------------------------------------ */
export { default as StatusChip } from './data-display/StatusChip'
export { default as StatCard } from './data-display/StatCard'
export { default as UserAvatar, UserAvatarGroup } from './data-display/UserAvatar'
export { default as RatingStars } from './data-display/RatingStars'
export { default as KeyValueList } from './data-display/KeyValueList'
export { default as TimelineList } from './data-display/TimelineList'
export { default as PaginationControl } from './data-display/PaginationControl'
export { default as MediaLightbox } from './data-display/MediaLightbox'

/* Inputs ------------------------------------------------------------------ */
export { default as SearchInput } from './inputs/SearchInput'
export { default as SortSelect } from './inputs/SortSelect'
export { default as FilterChipGroup } from './inputs/FilterChipGroup'
export { default as FormTextField } from './inputs/FormTextField'
export { default as FormSelect } from './inputs/FormSelect'
export { default as FormDateField } from './inputs/FormDateField'
export { default as FormFileField } from './inputs/FormFileField'
export { default as CurrencyField } from './inputs/CurrencyField'

/* Layout ------------------------------------------------------------------ */
export { default as PageHeader } from './layout/PageHeader'
export { default as Section } from './layout/Section'
export { default as ResponsiveDialog } from './layout/ResponsiveDialog'
export { default as SideSheet } from './layout/SideSheet'
export { default as StickyActionBar } from './layout/StickyActionBar'

/* Table ------------------------------------------------------------------- */
export { default as DataTable } from './table/DataTable'

/* Motion ------------------------------------------------------------------ */
export { default as PageTransition } from './motion/PageTransition'
export { default as FadeInView } from './motion/FadeInView'
export { default as StaggerList } from './motion/StaggerList'
export { default as AnimatedNumber } from './motion/AnimatedNumber'
export * from './motion/motionPresets'
