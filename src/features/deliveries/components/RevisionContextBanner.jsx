import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { alpha } from '@mui/material/styles'

import { describeRevisions } from '@/features/orders/utils/orderDisplay'
import { formatDateTime, formatNumber } from '@/utils/formatters'

// What the buyer asked for, quoted, at the top of the workspace.
//
// An order at `revision_requested` has exactly one thing to say, and it is not
// a status: it is the buyer's own words about what is wrong. They are set as a
// quotation rather than paraphrased, because a creator about to redo work needs
// the brief in the buyer's language, not ours.
//
// `role="status"` (§12): the banner appears when the order changes underneath a
// creator who is already on the page, and an announcement is the only way that
// reaches a screen-reader user.

/**
 * @param {object} props
 * @param {object} props.order the order the changes are against
 * @param {object|null} props.revision the open change request
 * @param {() => void} [props.onRespond] jumps to the composer
 */
export default function RevisionContextBanner({ order, revision, onRespond }) {
  const revisions = describeRevisions(order)

  return (
    <Card
      role="status"
      sx={{
        borderColor: 'warning.main',
        borderWidth: 1,
        borderStyle: 'solid',
        bgcolor: (theme) => alpha(theme.palette.warning.main, 0.06),
      }}
    >
      <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1.5}
          alignItems={{ xs: 'flex-start', sm: 'center' }}
          justifyContent="space-between"
          sx={{ mb: 1.5 }}
        >
          <Stack direction="row" spacing={1.25} alignItems="center" sx={{ minWidth: 0 }}>
            <Box aria-hidden="true" sx={{ color: 'warning.dark', display: 'flex' }}>
              <Icon icon="solar:restart-linear" width={22} />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="subtitle1" component="h2" sx={{ fontWeight: 700 }}>
                The buyer asked for changes
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Sent {formatDateTime(revision?.createdAt)} · revision{' '}
                {formatNumber(revisions.used)} of {formatNumber(revisions.included)} used
              </Typography>
            </Box>
          </Stack>

          {onRespond ? (
            <Button
              onClick={onRespond}
              variant="contained"
              color="warning"
              sx={{ flexShrink: 0, whiteSpace: 'nowrap' }}
              startIcon={<Icon icon="solar:box-linear" width={18} aria-hidden="true" />}
            >
              Respond with a new version
            </Button>
          ) : null}
        </Stack>

        {revision?.notes ? (
          <Box
            component="blockquote"
            sx={{
              m: 0,
              pl: 2,
              borderLeft: 3,
              borderColor: 'warning.main',
            }}
          >
            <Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>
              {revision.notes}
            </Typography>
          </Box>
        ) : (
          <Typography variant="body2" color="text.secondary">
            The buyer did not leave notes with this request. Message them through the order if you
            are unsure what to change.
          </Typography>
        )}
      </CardContent>
    </Card>
  )
}
