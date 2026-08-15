import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'

import FileGridItem from '@/features/deliveries/components/FileGridItem'

// The files on one delivered version, as a responsive grid of tiles.
//
// Two columns on a phone, four on a wide screen (§11) — the same grid on both
// sides of an order, which is the point of it living here: the buyer reviewing
// a hand-over and the creator reading back what they sent are looking at the
// same set of files and should see them laid out the same way.
//
// A semantic list, because it is one: eight deliverables announced as "list,
// 8 items" tells a screen-reader user how much is here before they start
// arrowing through it (§12).

/**
 * @param {object} props
 * @param {object[]} [props.files] contract file objects (§5.1)
 * @param {string} props.label accessible name for the grid, e.g. `Files in version 2`
 * @param {(fileIndex: number) => void} props.onOpenFile opens the lightbox at this file
 * @param {string} [props.emptyText] shown instead of the grid when there are no files
 */
export default function DeliveryFilesGrid({ files = [], label, onOpenFile, emptyText }) {
  if (files.length === 0) {
    return emptyText ? (
      <Typography variant="body2" color="text.secondary">
        {emptyText}
      </Typography>
    ) : null
  }

  return (
    <Box
      component="ul"
      aria-label={label}
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
        <FileGridItem key={file.id ?? index} file={file} onOpen={() => onOpenFile?.(index)} />
      ))}
    </Box>
  )
}
