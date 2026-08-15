import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'

import { getStatusMeta } from '@/constants/statuses'
import { formatQuantity } from '@/features/requests/utils/requestDisplay'
import { formatNumber } from '@/utils/formatters'

// The brief's specifications, restated as the things this delivery has to be.
//
// **Informational, not enforced.** Nothing here is a checkbox a creator ticks
// and nothing gates the submit button: BetterBlue cannot count the files in a
// video or measure an aspect ratio, and a checklist that pretended otherwise
// would either block honest deliveries or give false assurance. What it does is
// put the agreed numbers next to the composer, where the mistakes it prevents —
// eleven photos instead of fifteen, landscape instead of portrait — actually
// happen.
//
// A `<ul>` rather than a styled stack of rows, because it is a list and a
// screen reader should say how long it is (§12).

/** One agreed specification. */
function ChecklistItem({ icon, label, value, hint }) {
  return (
    <Stack component="li" direction="row" spacing={1.5} alignItems="flex-start">
      <Box aria-hidden="true" sx={{ color: 'success.main', display: 'flex', pt: '2px' }}>
        <Icon icon={icon ?? 'tabler:circle-check'} width={20} />
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {value}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {label}
          {hint ? ` · ${hint}` : ''}
        </Typography>
      </Box>
    </Stack>
  )
}

/**
 * @param {object} props
 * @param {object|null} props.request the brief behind the order
 * @param {object} props.order the order, read for its content type snapshot
 */
export default function FulfillmentChecklist({ request, order }) {
  const contentType = request?.contentType ?? order?.contentType
  const contentTypeMeta = getStatusMeta(contentType)

  if (!request) {
    return (
      <Card>
        <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
          <Typography variant="subtitle2" component="h2" sx={{ mb: 1 }}>
            What this delivery has to cover
          </Typography>
          <Typography variant="body2" color="text.secondary">
            The original brief is no longer available. Everything agreed when the proposal was
            accepted is on the order itself — content type {contentTypeMeta.label.toLowerCase()}.
          </Typography>
        </CardContent>
      </Card>
    )
  }

  const items = [
    {
      icon: 'solar:gallery-linear',
      label: 'Deliverables agreed',
      value: formatQuantity(request, contentTypeMeta.label),
    },
    {
      icon: 'solar:camera-linear',
      label: 'Content type',
      value: contentTypeMeta.label,
      hint: contentTypeMeta.description,
    },
    ...(request.videoDurationSec
      ? [
          {
            icon: 'solar:clock-circle-linear',
            label: 'Clip length',
            value: `${formatNumber(request.videoDurationSec)} seconds each`,
          },
        ]
      : []),
    ...(request.orientation
      ? [
          {
            icon: 'solar:crop-linear',
            label: 'Framing',
            value: getStatusMeta(request.orientation).label,
          },
        ]
      : []),
    ...(request.usageRights
      ? [
          {
            icon: 'solar:shield-check-linear',
            label: 'Usage rights',
            value: getStatusMeta(request.usageRights).label,
            hint: getStatusMeta(request.usageRights).description,
          },
        ]
      : []),
  ]

  return (
    <Card>
      <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
        <Typography variant="subtitle2" component="h2" sx={{ mb: 0.75 }}>
          What this delivery has to cover
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Taken from the brief you priced. Nothing here is checked automatically — it is the list
          the buyer will review your files against.
        </Typography>

        <Stack
          component="ul"
          spacing={1.75}
          aria-label="Agreed specifications for this order"
          sx={{ listStyle: 'none', m: 0, p: 0 }}
        >
          {items.map((item) => (
            <ChecklistItem key={item.label} {...item} />
          ))}
        </Stack>
      </CardContent>
    </Card>
  )
}
