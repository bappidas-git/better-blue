import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'

import StatusChip from '@/components/data-display/StatusChip'
import DataTable from '@/components/table/DataTable'
import { EMPTY_PLACEHOLDER, formatDate } from '@/utils/formatters'

// Who signed up through the link, and what happened next — Prompt 34 §4.3.
//
// PRIVACY: the names are masked, and they are masked in `affiliateService`
// rather than here (`maskName`), so no screen can render the whole of one by
// accident. An affiliate is entitled to know a referral converted; they are not
// entitled to know which business it was, because that business never agreed to
// be named to whoever shared a link with them.
//
// The mask is what assistive technology reads too — no `title`, no `aria-label`
// restoring the full name behind it (§12: the accessible name matches the
// visible one). The caption above the table says the masking is deliberate, so
// it reads as a privacy decision rather than as broken data.

/**
 * @param {object} props
 * @param {object[]} [props.rows] referrals from `affiliateService.getDashboard`
 * @param {boolean} [props.loading=false]
 * @param {object} [props.error]
 * @param {() => void} [props.onRetry]
 */
export default function ReferralsTable({ rows = [], loading = false, error, onRetry }) {
  const columns = [
    {
      key: 'referredName',
      label: 'Referred member',
      render: (row) => (
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {row.referredName}
        </Typography>
      ),
    },
    {
      key: 'createdAt',
      label: 'Signed up',
      width: 150,
      render: (row) => (
        <Typography variant="body2" sx={{ whiteSpace: 'nowrap' }}>
          {formatDate(row.createdAt)}
        </Typography>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      width: 140,
      render: (row) => <StatusChip status={row.status} size="sm" tooltip />,
    },
    {
      key: 'convertedAt',
      label: 'Converted',
      width: 150,
      render: (row) => (
        <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
          {row.convertedAt ? formatDate(row.convertedAt) : EMPTY_PLACEHOLDER}
        </Typography>
      ),
    },
  ]

  const renderMobileCard = (row) => (
    <Card variant="outlined">
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        <Stack direction="row" spacing={2} justifyContent="space-between" alignItems="flex-start">
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {row.referredName}
            </Typography>
            <Typography variant="caption" color="text.secondary" component="p">
              Signed up {formatDate(row.createdAt)}
              {row.convertedAt ? ` · converted ${formatDate(row.convertedAt)}` : ''}
            </Typography>
          </Box>
          <Box sx={{ flexShrink: 0 }}>
            <StatusChip status={row.status} size="sm" />
          </Box>
        </Stack>
      </CardContent>
    </Card>
  )

  return (
    <DataTable
      ariaLabel="Your referrals"
      columns={columns}
      rows={rows}
      loading={loading}
      error={error}
      onRetry={onRetry}
      renderMobileCard={renderMobileCard}
      emptyState={{
        icon: 'solar:users-group-rounded-linear',
        title: 'No referrals yet',
        description:
          'Nobody has signed up through your link so far. Share it with a business that needs content and they will appear here.',
      }}
    />
  )
}
