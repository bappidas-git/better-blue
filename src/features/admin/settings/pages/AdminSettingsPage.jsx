import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'

import AppLoader from '@/app/AppLoader'
import ErrorState from '@/components/feedback/ErrorState'
import { useConfirm } from '@/components/feedback/ConfirmDialogProvider'
import { useToast } from '@/components/feedback/ToastProvider'
import { PERMISSIONS } from '@/constants/permissions'
import AffiliateSection from '@/features/admin/settings/components/AffiliateSection'
import ChangeSummaryDialog from '@/features/admin/settings/components/ChangeSummaryDialog'
import CommissionsSection from '@/features/admin/settings/components/CommissionsSection'
import FeaturesSection from '@/features/admin/settings/components/FeaturesSection'
import GeneralSection from '@/features/admin/settings/components/GeneralSection'
import ModerationSection from '@/features/admin/settings/components/ModerationSection'
import SettingsSaveBar from '@/features/admin/settings/components/SettingsSaveBar'
import SettingsSectionNav from '@/features/admin/settings/components/SettingsSectionNav'
import {
  SETTINGS_PARAMS,
  SETTINGS_SECTION,
  getSettingsSection,
} from '@/features/admin/settings/utils/settingsSchema'
import { AdminPageGuard } from '@/features/admin/shared'
import { useAuth } from '@/context/AuthContext'
import useApiQuery from '@/hooks/useApiQuery'
import useForm from '@/hooks/useForm'
import useListParams from '@/hooks/useListParams'
import DashboardPage from '@/layouts/dashboard/DashboardPage'
import { categoryService } from '@/services/categoryService'
import { settingsService } from '@/services/settingsService'

// `/admin/settings` — the platform's configuration, in five sections
// (Prompt 35 §4.1).
//
// One page, one form. The section specs in `utils/settingsSchema.js` say how to
// read the singleton into fields, how to validate them, how to diff them, and
// what to send back; this page owns the machinery they all share:
//
//   read (forced)  the editor must never open on a cached copy — a stale rate
//                  edited and saved would quietly revert somebody else's change
//   seed           values are reset from the singleton whenever the section or
//                  the stored settings change, and never mid-edit
//   dirty          the save bar appears the moment a value differs, and says
//                  how many do
//   confirm        the only path to the API is the change summary, old → new
//   save           `settingsService.saveSettings` PATCHes, invalidates every
//                  consumer's cache, and writes the `settings.update` audit
//                  entry carrying the same diff the reader just approved
//   refetch        the screen re-reads what was actually stored
//
// A failed save keeps every edit exactly where it was (§13): nothing is reset
// until the API confirms the write.
//
// SECURITY: the route is super-admin-only and this page is permission-gated,
// but both are UX (00 §11). The Laravel API must refuse a `PATCH` from anyone
// else independently.

export default function AdminSettingsPage() {
  const { user: actor } = useAuth()
  const toast = useToast()
  const confirm = useConfirm()

  const { values: params, setValues: setParams } = useListParams(SETTINGS_PARAMS)
  const spec = getSettingsSection(params.section)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [isSaving, setSaving] = useState(false)
  // Which `(section, settings)` pair the form currently holds. Until it matches
  // what is on screen, the form is still carrying the previous section's values
  // and nothing may be diffed against them.
  const [seededFor, setSeededFor] = useState(null)
  const bodyRef = useRef(null)

  /* -- data ---------------------------------------------------------------- */

  const {
    data: settings,
    isLoading,
    error,
    refetch,
  } = useApiQuery(() => settingsService.getSettings({ force: true }), [])

  // Every category, not just the active ones: an override left on a category
  // that has since been deactivated still has to be visible and clearable.
  const { data: categories, isLoading: categoriesLoading } = useApiQuery(
    () => categoryService.listAll().catch(() => []),
    [],
    { enabled: spec.key === SETTINGS_SECTION.COMMISSIONS }
  )

  const categoryNameFor = useCallback(
    (categoryId) => (categories ?? []).find((category) => category.id === categoryId)?.name,
    [categories]
  )

  /* -- the section's form -------------------------------------------------- */

  const form = useForm({ initialValues: {}, validators: spec.validators })
  const { reset } = form

  useEffect(() => {
    if (!settings) return
    if (seededFor?.key === spec.key && seededFor?.settings === settings) return
    reset(spec.toValues(settings))
    setSeededFor({ key: spec.key, settings })
  }, [reset, seededFor, settings, spec])

  const isSeeded = seededFor?.key === spec.key && seededFor?.settings === settings

  const changes = useMemo(
    () => (isSeeded ? spec.changes(settings, form.values, { categoryNameFor }) : []),
    [categoryNameFor, form.values, isSeeded, settings, spec]
  )

  const hasErrors = Object.keys(form.errors).length > 0 || (isSeeded && !form.isValid)

  /* -- moving between sections --------------------------------------------- */

  const changeSection = useCallback(
    async (next) => {
      if (next === spec.key) return

      if (changes.length > 0) {
        const ok = await confirm({
          title: 'Leave without saving?',
          message: `You have ${changes.length} unsaved ${changes.length === 1 ? 'change' : 'changes'} in ${spec.title}. Moving to another section discards ${changes.length === 1 ? 'it' : 'them'}.`,
          confirmLabel: 'Discard and move',
          tone: 'danger',
        })
        if (!ok) return
      }

      setParams({ section: next })

      // On a phone the section list fills the first screen, so picking a
      // section and being left looking at the same list is the whole
      // interaction. Bring the fields up instead. `scroll-behavior` is forced
      // to `auto` for reduced-motion users in `styles/global.css`, so this stays
      // comfortable either way (00 §7).
      window.requestAnimationFrame(() => {
        bodyRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' })
      })
    },
    [changes.length, confirm, setParams, spec.key, spec.title]
  )

  /* -- saving -------------------------------------------------------------- */

  const discard = useCallback(() => {
    if (settings) reset(spec.toValues(settings))
  }, [reset, settings, spec])

  const save = useCallback(async () => {
    setSaving(true)
    try {
      await settingsService.saveSettings(spec.toPatch(form.values, settings), {
        actor,
        changes,
      })

      setDialogOpen(false)
      // Forget the seed so the refetched settings re-seed the form — the screen
      // then shows what was actually stored rather than what was typed.
      setSeededFor(null)
      refetch()

      toast.success(`${spec.title} settings saved.`, {
        description: 'They are in effect across BetterBlue now — nobody needs to reload.',
      })
    } catch (failure) {
      // Deliberately nothing is reset: every edit stays on screen so the reader
      // can try again without retyping (§13).
      setDialogOpen(false)
      toast.error(failure?.message ?? 'We could not save those settings.', {
        description: 'Your changes are still here — try again in a moment.',
      })
    } finally {
      setSaving(false)
    }
  }, [actor, changes, form.values, refetch, settings, spec, toast])

  /* -- rendering ----------------------------------------------------------- */

  const sectionBody = () => {
    if (!isSeeded) return <AppLoader label="Loading settings" />

    switch (spec.key) {
      case SETTINGS_SECTION.COMMISSIONS:
        return (
          <CommissionsSection
            form={form}
            categories={categories ?? []}
            categoriesLoading={categoriesLoading}
          />
        )
      case SETTINGS_SECTION.AFFILIATE:
        return <AffiliateSection form={form} commissionRate={settings?.commission?.defaultRate} />
      case SETTINGS_SECTION.MODERATION:
        return <ModerationSection form={form} />
      case SETTINGS_SECTION.FEATURES:
        return <FeaturesSection form={form} />
      default:
        return <GeneralSection form={form} />
    }
  }

  return (
    <DashboardPage
      title="Platform settings"
      subtitle="Configuration for the whole marketplace. Every change here takes effect immediately."
    >
      <AdminPageGuard permission={PERMISSIONS.SETTINGS_MANAGE}>
        <Stack spacing={{ xs: 2, md: 2.5 }}>
          <SettingsSectionNav value={spec.key} onChange={changeSection} />

          <Box ref={bodyRef} sx={{ scrollMarginTop: { xs: 72, md: 16 } }}>
            {error ? (
              <ErrorState
                title="We could not load the platform settings"
                message="Nothing has been changed. Try again — if it keeps failing, the API may be down."
                error={error}
                onRetry={refetch}
              />
            ) : isLoading && !settings ? (
              <AppLoader label="Loading settings" />
            ) : (
              sectionBody()
            )}
          </Box>
        </Stack>

        <SettingsSaveBar
          count={changes.length}
          onSave={() => setDialogOpen(true)}
          onDiscard={discard}
          isSaving={isSaving}
          hasErrors={hasErrors}
        />

        <ChangeSummaryDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          onConfirm={save}
          changes={changes}
          sectionLabel={spec.title}
          isSaving={isSaving}
        />
      </AdminPageGuard>
    </DashboardPage>
  )
}
