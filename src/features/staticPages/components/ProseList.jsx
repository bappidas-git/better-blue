import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'

// Bulleted list for information pages — policy rules, legal clauses, the "what
// we collect" lists. One markup and one bullet treatment, so every list on the
// public pages reads the same.
//
// The bullet is a decorative icon rather than a `list-style` marker so it can
// carry the brand tint and stay aligned with the first line of a wrapped item;
// the list is still a real `ul`/`li`, so a screen reader announces the count.

/**
 * @param {object} props
 * @param {string[]} props.items list entries, one line of copy each
 * @param {'bullet'|'check'} [props.marker='bullet'] marker glyph
 * @param {object} [props.sx] MUI system styles for the list
 */
export default function ProseList({ items = [], marker = 'bullet', sx }) {
  if (!items.length) return null

  return (
    <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', gap: 1.25, ...sx }}>
      {items.map((item) => (
        <Box
          component="li"
          key={item}
          sx={{ display: 'flex', gap: 1.25, alignItems: 'flex-start' }}
        >
          {marker === 'check' ? (
            <Box
              aria-hidden="true"
              sx={{ color: 'success.main', display: 'flex', mt: '2px', flexShrink: 0 }}
            >
              <Icon icon="tabler:circle-check" width={18} />
            </Box>
          ) : (
            <Box
              aria-hidden="true"
              sx={{
                width: 6,
                height: 6,
                mt: '9px',
                borderRadius: '50%',
                bgcolor: 'primary.main',
                flexShrink: 0,
              }}
            />
          )}

          <Typography variant="body1" color="text.secondary" sx={{ maxWidth: '68ch' }}>
            {item}
          </Typography>
        </Box>
      ))}
    </Box>
  )
}
