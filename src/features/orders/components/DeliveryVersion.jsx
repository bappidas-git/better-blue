import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'

import StatusChip from '@/components/data-display/StatusChip'
import FileGridItem from '@/features/orders/components/FileGridItem'
import { formatDateTime, formatNumber } from '@/utils/formatters'

// One delivered version: what the creator said, and what they handed over.
//
// Versions are records, not drafts — asking for changes closes a version and
// the answer arrives as a new one (00 §9) — so every version a buyer has ever
// received stays on this page, newest first, with its own files intact.

/**
 * @param {object} props
 * @param {object} props.delivery the delivery record
 * @param {(fileIndex: number) => void} props.onOpenFile opens the lightbox on this version
 */
export default function DeliveryVersion({ delivery, onOpenFile }) {
  const files = delivery?.files ?? []

  return (
    <Card component="li" sx={{ listStyle: 'none' }}>
      <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          flexWrap="wrap"
          useFlexGap
          sx={{ mb: 1.5 }}
        >
          <Typography variant="subtitle2" component="h3">
            Version {formatNumber(delivery?.version ?? 1)}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {formatDateTime(delivery?.submittedAt)}
          </Typography>
          <Box sx={{ flexGrow: 1 }} />
          <StatusChip status={delivery?.status} size="sm" tooltip />
        </Stack>

        {delivery?.message ? (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ whiteSpace: 'pre-line', mb: files.length > 0 ? 2 : 0 }}
          >
            {delivery.message}
          </Typography>
        ) : null}

        {files.length > 0 ? (
          <Box
            component="ul"
            aria-label={`Files in version ${delivery?.version ?? 1}`}
            sx={{
              listStyle: 'none',
              m: 0,
              p: 0,
              display: 'grid',
              gap: { xs: 1.25, md: 2 },
              gridTemplateColumns: {
                xs: 'repeat(2, minmax(0, 1fr))',
                sm: 'repeat(3, minmax(0, 1fr))',
                lg: 'repeat(4, minmax(0, 1fr))',
              },
            }}
          >
            {files.map((file, index) => (
              <FileGridItem key={file.id ?? index} file={file} onOpen={() => onOpenFile(index)} />
            ))}
          </Box>
        ) : (
          <Typography variant="body2" color="text.secondary">
            No files were attached to this version.
          </Typography>
        )}
      </CardContent>
    </Card>
  )
}
