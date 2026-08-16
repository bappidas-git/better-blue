import { useCallback, useMemo, useState } from 'react'

import { Icon } from '@iconify/react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import Stack from '@mui/material/Stack'
import Switch from '@mui/material/Switch'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'

import { useConfirm } from '@/components/feedback/ConfirmDialogProvider'
import { useToast } from '@/components/feedback/ToastProvider'
import DataTable from '@/components/table/DataTable'
import { PERMISSIONS } from '@/constants/permissions'
import CategoryDialog from '@/features/admin/settings/components/CategoryDialog'
import { AdminPageGuard } from '@/features/admin/shared'
import { useAuth } from '@/context/AuthContext'
import useApiQuery from '@/hooks/useApiQuery'
import DashboardPage from '@/layouts/dashboard/DashboardPage'
import { categoryService } from '@/services/categoryService'
import { formatNumber } from '@/utils/formatters'

// `/admin/categories` — the marketplace taxonomy (Prompt 35 §4.7).
//
// **There is no delete, and there is not going to be one.** Every request,
// order, portfolio item, and creator profile that carries a category id keeps
// carrying it forever; removing the row would leave those records pointing at
// nothing and every one of those screens rendering a blank where a category name
// belongs. Deactivating is the whole removal story (contract §6.6): the category
// stops being offered in new selections and keeps rendering everywhere it is
// already used.
//
// So the deactivation confirmation leads with the **usage counts** — how many
// creators are tagged with it and how many briefs name it — because that is the
// number that tells a reader whether they are tidying up an unused row or
// quietly changing what a hundred records mean.

/** How a category's usage reads once it is counted. */
function usageLabel(usage) {
  if (!usage) return null
  const parts = []
  if (usage.creators) parts.push(`${formatNumber(usage.creators)} creator${usage.creators === 1 ? '' : 's'}`)
  if (usage.requests) parts.push(`${formatNumber(usage.requests)} request${usage.requests === 1 ? '' : 's'}`)
  return parts.length > 0 ? parts.join(' · ') : 'Not used yet'
}

export default function AdminCategoriesPage() {
  const { user: actor } = useAuth()
  const toast = useToast()
  const confirm = useConfirm()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [busyId, setBusyId] = useState(null)

  const {
    data: categories,
    isLoading,
    error,
    refetch,
  } = useApiQuery(() => categoryService.listAll(), [])

  const rows = useMemo(() => categories ?? [], [categories])
  const ids = useMemo(() => rows.map((category) => category.id), [rows])

  // Counted separately and never allowed to fail the screen: the taxonomy is
  // workable without the numbers, and the numbers are two reads per row.
  const { data: usage } = useApiQuery(
    () => categoryService.getUsageCounts(ids).catch(() => ({})),
    [ids],
    { enabled: ids.length > 0 }
  )

  const afterWrite = useCallback(() => {
    // Explicit, even though the service already drops it on every write: the
    // session cache is what every select on the site reads, and a stale one is
    // how a new category fails to appear until the next reload (§7).
    categoryService.invalidate()
    refetch()
  }, [refetch])

  /* -- add / edit ---------------------------------------------------------- */

  const openAdd = () => {
    setEditing(null)
    setDialogOpen(true)
  }

  const openEdit = (category) => {
    setEditing(category)
    setDialogOpen(true)
  }

  const submitCategory = useCallback(
    async (values) => {
      try {
        if (editing) {
          await categoryService.updateCategory(editing.id, values, { actor, previous: editing })
          toast.success(`${values.name} saved.`, {
            description: 'Every category list on the site is showing it already.',
          })
        } else {
          await categoryService.createCategory(values, { actor })
          toast.success(`${values.name} added.`, {
            description: values.active
              ? 'It is offered in new briefs, profiles, and filters from now on.'
              : 'It is inactive for now — switch it on when you are ready to offer it.',
          })
        }
        setDialogOpen(false)
        afterWrite()
      } catch (failure) {
        toast.error(failure?.message ?? 'We could not save that category.')
        // Rethrown so the dialog stays open with everything typed still in it,
        // and a duplicate slug lands under its own field.
        throw failure
      }
    },
    [actor, afterWrite, editing, toast]
  )

  /* -- activate / deactivate ----------------------------------------------- */

  const toggleActive = useCallback(
    async (category) => {
      const next = category.active === false
      const counts = usage?.[category.id]

      if (!next) {
        const inUse = Boolean(counts?.creators || counts?.requests)
        const ok = await confirm({
          title: `Deactivate ${category.name}?`,
          message: inUse
            ? `${usageLabel(counts)} still use this category. Existing content keeps it — briefs, orders, portfolios, and profiles carry on showing “${category.name}” exactly as they do now. It simply stops being offered in new briefs, profiles, and discovery filters. Categories are never deleted, so you can switch it back on at any time.`
            : `“${category.name}” stops being offered in new briefs, profiles, and discovery filters. Nothing uses it yet, and categories are never deleted — you can switch it back on at any time.`,
          confirmLabel: 'Deactivate category',
          tone: 'danger',
        })
        if (!ok) return
      }

      setBusyId(category.id)
      try {
        await categoryService.setCategoryActive(category.id, next, { actor, usage: counts })
        toast.success(next ? `${category.name} is active again.` : `${category.name} deactivated.`, {
          description: next
            ? 'It is back in every category list on the site.'
            : 'It is hidden from new selections. Existing content is untouched.',
        })
        afterWrite()
      } catch (failure) {
        toast.error(failure?.message ?? 'We could not change that category.')
      } finally {
        setBusyId(null)
      }
    },
    [actor, afterWrite, confirm, toast, usage]
  )

  /* -- reordering ---------------------------------------------------------- */

  const move = useCallback(
    async (category, direction) => {
      setBusyId(category.id)
      try {
        await categoryService.moveCategory(category.id, direction, { actor })
        afterWrite()
      } catch (failure) {
        toast.error(failure?.message ?? 'We could not move that category.')
      } finally {
        setBusyId(null)
      }
    },
    [actor, afterWrite, toast]
  )

  /* -- cells --------------------------------------------------------------- */

  const nameCell = (category) => (
    <Stack direction="row" spacing={1.5} alignItems="center" sx={{ minWidth: 0 }}>
      <Box
        aria-hidden="true"
        sx={{
          flexShrink: 0,
          width: 36,
          height: 36,
          borderRadius: 1.5,
          display: 'grid',
          placeItems: 'center',
          bgcolor: category.active === false ? 'action.hover' : 'primary.surface',
          color: category.active === false ? 'text.disabled' : 'primary.main',
        }}
      >
        <Icon icon={category.icon} width={20} />
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {category.name}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
          /{category.slug} · {category.icon}
        </Typography>
      </Box>
    </Stack>
  )

  const usageCell = (category) => {
    const counts = usage?.[category.id]
    if (!counts) {
      return (
        <Typography variant="caption" color="text.secondary">
          Counting…
        </Typography>
      )
    }
    return (
      <Typography variant="body2" color="text.secondary" sx={{ fontVariantNumeric: 'tabular-nums' }}>
        {usageLabel(counts)}
      </Typography>
    )
  }

  const activeCell = (category) => (
    <Switch
      checked={category.active !== false}
      onChange={() => toggleActive(category)}
      disabled={busyId === category.id}
      inputProps={{
        'aria-label': `${category.name} is ${category.active === false ? 'inactive' : 'active'}`,
      }}
    />
  )

  const orderCell = (category) => {
    const index = rows.findIndex((row) => row.id === category.id)
    return (
      <Stack direction="row" spacing={0.5} alignItems="center">
        <Tooltip title="Move up">
          <span>
            <IconButton
              size="small"
              onClick={() => move(category, 'up')}
              disabled={index <= 0 || busyId === category.id}
              aria-label={`Move ${category.name} up`}
              sx={{ width: 44, height: 44 }}
            >
              <Icon icon="tabler:chevron-up" width={18} />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Move down">
          <span>
            <IconButton
              size="small"
              onClick={() => move(category, 'down')}
              disabled={index < 0 || index >= rows.length - 1 || busyId === category.id}
              aria-label={`Move ${category.name} down`}
              sx={{ width: 44, height: 44 }}
            >
              <Icon icon="tabler:chevron-down" width={18} />
            </IconButton>
          </span>
        </Tooltip>
      </Stack>
    )
  }

  const editCell = (category) => (
    <Tooltip title="Edit">
      <IconButton
        size="small"
        onClick={() => openEdit(category)}
        aria-label={`Edit ${category.name}`}
        sx={{ width: 44, height: 44 }}
      >
        <Icon icon="solar:pen-new-square-linear" width={18} />
      </IconButton>
    </Tooltip>
  )

  const columns = [
    { key: 'name', label: 'Category', render: nameCell },
    { key: 'usage', label: 'In use by', render: usageCell },
    { key: 'active', label: 'Active', align: 'center', width: 100, render: activeCell },
    { key: 'order', label: 'Order', align: 'center', width: 120, render: orderCell },
    { key: 'edit', label: '', align: 'right', width: 72, render: editCell },
  ]

  const renderMobileCard = (category) => (
    <Card variant="outlined" sx={{ p: 2 }}>
      <Stack direction="row" spacing={1.5} alignItems="flex-start">
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>{nameCell(category)}</Box>
        {editCell(category)}
      </Stack>

      <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1.5, flexWrap: 'wrap' }} useFlexGap>
        <Chip
          label={category.active === false ? 'Inactive' : 'Active'}
          size="small"
          color={category.active === false ? 'default' : 'success'}
          variant={category.active === false ? 'outlined' : 'filled'}
          sx={{ height: 24 }}
        />
        {usageCell(category)}
      </Stack>

      <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between" sx={{ mt: 1.5 }}>
        {orderCell(category)}
        {activeCell(category)}
      </Stack>
    </Card>
  )

  return (
    <DashboardPage
      title="Categories"
      subtitle="The marketplace taxonomy — what buyers brief against and creators are matched to."
      actions={
        <Button
          onClick={openAdd}
          variant="gradient"
          startIcon={<Icon icon="tabler:plus" width={18} aria-hidden="true" />}
        >
          Add category
        </Button>
      }
    >
      <AdminPageGuard permission={PERMISSIONS.CATEGORIES_MANAGE}>
        <Stack spacing={{ xs: 2, md: 2.5 }}>
          <Alert severity="info" icon={<Icon icon="solar:info-circle-linear" width={22} />}>
            Categories are deactivated, never deleted. A deactivated category disappears from new
            briefs, profiles, and filters, and keeps showing on everything that already uses it —
            which is why nothing here can orphan a record.
          </Alert>

          <Card>
            <CardContent sx={{ p: { xs: 1.5, md: 2 } }}>
              <DataTable
                columns={columns}
                rows={rows}
                loading={isLoading}
                error={error}
                onRetry={refetch}
                ariaLabel="Marketplace categories"
                emptyState={{
                  icon: 'solar:widget-4-linear',
                  title: 'No categories yet',
                  description:
                    'Categories are what buyers brief against and creators are matched to. Add the first one to get started.',
                  primaryAction: { label: 'Add category', onClick: openAdd },
                }}
                renderMobileCard={renderMobileCard}
              />
            </CardContent>
          </Card>
        </Stack>

        <CategoryDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          onSubmit={submitCategory}
          category={editing}
        />
      </AdminPageGuard>
    </DashboardPage>
  )
}
