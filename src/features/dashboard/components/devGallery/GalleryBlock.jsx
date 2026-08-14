import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'

// Dev-gallery-only section wrapper: eyebrow title, caption, content. Kept
// separate from the shipped `Section` component so the gallery can demonstrate
// `Section` itself without nesting one inside the other.

/**
 * @param {object} props
 * @param {string} props.title eyebrow label
 * @param {string} [props.caption] short explanation of what the block verifies
 * @param {React.ReactNode} props.children demo content
 */
export default function GalleryBlock({ title, caption, children }) {
  return (
    <Box component="section">
      <Typography variant="overline" color="text.secondary" component="p">
        {title}
      </Typography>
      {caption ? (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3, maxWidth: '80ch' }}>
          {caption}
        </Typography>
      ) : (
        <Box sx={{ mb: 3 }} />
      )}
      {children}
    </Box>
  )
}
