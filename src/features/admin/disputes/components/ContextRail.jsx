import { Icon } from '@iconify/react'
import Accordion from '@mui/material/Accordion'
import AccordionDetails from '@mui/material/AccordionDetails'
import AccordionSummary from '@mui/material/AccordionSummary'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import Link from '@mui/material/Link'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { Link as RouterLink } from 'react-router-dom'

import StatusChip from '@/components/data-display/StatusChip'
import TimelineList from '@/components/data-display/TimelineList'
import UserAvatar from '@/components/data-display/UserAvatar'
import { sideLabel } from '@/features/admin/disputes/utils/disputeQueue'
import OrderMoneyCard from '@/features/admin/operations/components/OrderMoneyCard'
import { EntityRefChip } from '@/features/admin/shared'
import EvidenceGrid from '@/features/disputes/components/EvidenceGrid'
import { categoryLabel } from '@/features/disputes/utils/disputeDisplay'
import { paths } from '@/routes/paths'
import { EMPTY_PLACEHOLDER, formatDateTime, formatNumber } from '@/utils/formatters'

// Everything a reviewer needs beside the thread — Prompt 33 §4.3.
//
// The thread says what the two of them think happened. This says what the
// records say happened: the money, the two accounts and their history, the
// opening statement with its evidence, and what the team has already done.
// A decision made from the thread alone is a decision made from whoever wrote
// the most.
//
// Every panel here is a **shared component**. The money card is Prompt 31's
// `OrderMoneyCard` — the same one the order console shows, ledger included —
// and the evidence is Prompt 26's `EvidenceGrid`, so a reviewer opens a file
// full-size in the same viewer the parties use. Nothing on this rail is a fork.
//
// Below `lg` the whole rail becomes an accordion and moves **above** the thread
// (§11): on a phone the context is what you check before you read, and a rail
// pushed under a fifteen-message thread is a rail nobody scrolls to.

/** One party, with the two figures that make them readable at a glance. */
function PartyCard({ party, fallbackLabel }) {
  const user = party?.user
  const side = sideLabel(party?.side)

  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography variant="caption" color="text.secondary" component="p">
        {party?.side ? side : fallbackLabel}
      </Typography>

      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mt: 0.75 }}>
        <UserAvatar name={user?.name ?? 'Unknown'} src={user?.avatarUrl} size="sm" />
        <Box sx={{ minWidth: 0, flexGrow: 1 }}>
          <Typography variant="subtitle2" component="p" noWrap>
            {user?.name ?? 'Account unavailable'}
          </Typography>
          <Typography variant="caption" color="text.secondary" component="p" noWrap>
            {user?.email ?? EMPTY_PLACEHOLDER}
          </Typography>
        </Box>
      </Stack>

      <Stack direction="row" spacing={0.75} sx={{ mt: 1 }} flexWrap="wrap" useFlexGap>
        {user?.id ? <EntityRefChip type="user" id={user.id} label="Open account" /> : null}
        {user?.accountStatus ? <StatusChip status={user.accountStatus} size="sm" tooltip /> : null}
      </Stack>

      {/* `null` renders as "—", never as zero: "no prior disputes" and "we
          could not count them" are different facts (§13). */}
      <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1 }}>
        {party?.ordersCount == null ? EMPTY_PLACEHOLDER : formatNumber(party.ordersCount)} orders ·{' '}
        {party?.disputeCount == null ? EMPTY_PLACEHOLDER : formatNumber(party.disputeCount)} disputes
        all time
      </Typography>
    </Box>
  )
}

/**
 * @param {object} props
 * @param {object} props.context a `disputeService.getAdminCaseContext` result
 * @param {boolean} [props.collapsible=false] render as accordions (below `lg`)
 */
export default function ContextRail({ context, collapsible = false }) {
  const { dispute, order, payment, transactions = [], buyer, creator, priorBetweenParties } =
    context ?? {}

  const priorCount = priorBetweenParties?.length ?? 0

  const sections = [
    {
      key: 'money',
      title: 'The money',
      // The money card brings its own card chrome, so it is rendered bare in
      // the rail and only wrapped when the accordion needs a body.
      bare: true,
      content: order ? (
        <Stack spacing={1.5}>
          <OrderMoneyCard order={order} payment={payment} transactions={transactions} />
          <Link
            component={RouterLink}
            to={paths.adminOrderDetail(order.id)}
            variant="body2"
            underline="hover"
            sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}
          >
            <Icon icon="solar:box-linear" width={16} aria-hidden="true" />
            Open the full order
          </Link>
        </Stack>
      ) : (
        <Typography variant="body2" color="text.secondary">
          The order behind this case is no longer available.
        </Typography>
      ),
    },
    {
      key: 'parties',
      title: 'The parties',
      content: (
        <Stack spacing={2.5}>
          <PartyCard party={buyer} fallbackLabel="Buyer" />
          <PartyCard party={creator} fallbackLabel="Creator" />

          {priorCount > 0 ? (
            <Alert severity="info" variant="outlined" icon={false}>
              <Typography variant="body2">
                These two have <strong>{formatNumber(priorCount)}</strong> other{' '}
                {priorCount === 1 ? 'dispute' : 'disputes'} between them.
              </Typography>
              <Stack direction="row" spacing={0.75} sx={{ mt: 1 }} flexWrap="wrap" useFlexGap>
                {priorBetweenParties.map((entry) => (
                  <EntityRefChip
                    key={entry.id}
                    type="dispute"
                    id={entry.id}
                    label={categoryLabel(entry.category)}
                  />
                ))}
              </Stack>
            </Alert>
          ) : null}
        </Stack>
      ),
    },
    {
      key: 'statement',
      title: 'What was reported',
      content: (
        <Stack spacing={1.5}>
          <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
            <Chip
              size="small"
              variant="outlined"
              icon={<Icon icon="solar:tag-linear" width={14} aria-hidden="true" />}
              label={categoryLabel(dispute?.category)}
              sx={{ height: 24 }}
            />
            <Typography variant="caption" color="text.secondary">
              Raised {formatDateTime(dispute?.createdAt)}
            </Typography>
          </Stack>

          <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-line' }}>
            {dispute?.description}
          </Typography>

          {(dispute?.evidence ?? []).length > 0 ? (
            <Box>
              <Typography variant="subtitle2" component="h4" sx={{ mb: 1 }}>
                Evidence attached at the start
              </Typography>
              <EvidenceGrid
                files={dispute.evidence}
                label="Evidence attached when this dispute was opened"
              />
            </Box>
          ) : (
            <Typography variant="caption" color="text.secondary">
              No evidence was attached when this case was opened.
            </Typography>
          )}
        </Stack>
      ),
    },
    {
      key: 'history',
      title: 'Case history',
      content: (
        <Stack spacing={1.5}>
          <TimelineList
            dense
            emptyText="Nothing has been recorded on this case yet."
            items={(context?.timeline ?? []).map((entry) => ({
              id: entry.id,
              icon: entry.icon,
              tone: entry.tone,
              title: entry.internal ? (
                <Box
                  component="span"
                  sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}
                >
                  {entry.title}
                  <Chip
                    component="span"
                    size="small"
                    color="warning"
                    label="Internal"
                    sx={{ fontWeight: 600 }}
                  />
                </Box>
              ) : (
                entry.title
              ),
              description: entry.description,
              timestamp: entry.at,
            }))}
          />
          <Typography variant="caption" color="text.secondary">
            Read from the audit trail. Entries marked Internal are admin-only — the buyer and the
            creator see the thread without them.
          </Typography>
        </Stack>
      ),
    },
  ]

  if (collapsible) {
    return (
      <Box component="section" aria-label="Case context">
        {sections.map((section, index) => (
          <Accordion
            key={section.key}
            // The money is the thing a reviewer checks first on a phone, so it
            // opens by default and everything else stays folded.
            defaultExpanded={index === 0}
            disableGutters
            sx={{ '&:before': { display: 'none' }, borderRadius: 2, mb: 1 }}
          >
            <AccordionSummary
              expandIcon={<Icon icon="tabler:chevron-down" width={20} aria-hidden="true" />}
              aria-controls={`case-context-${section.key}-content`}
              id={`case-context-${section.key}-header`}
              sx={{ minHeight: 52 }}
            >
              <Typography variant="subtitle2" component="h3">
                {section.title}
              </Typography>
            </AccordionSummary>
            <AccordionDetails id={`case-context-${section.key}-content`} sx={{ pt: 0 }}>
              {section.content}
            </AccordionDetails>
          </Accordion>
        ))}
      </Box>
    )
  }

  return (
    <Stack component="section" aria-label="Case context" spacing={{ xs: 2, md: 2.5 }}>
      {sections.map((section) =>
        section.bare ? (
          <Box key={section.key}>{section.content}</Box>
        ) : (
          <Card key={section.key}>
            <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
              <Typography variant="subtitle2" component="h3" sx={{ mb: 2 }}>
                {section.title}
              </Typography>
              {section.content}
            </CardContent>
          </Card>
        )
      )}
    </Stack>
  )
}
