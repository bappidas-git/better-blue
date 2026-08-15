import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'

// "How payment protection works" — the three states a buyer's money passes
// through on every order (00 §18: escrow/held → release). Used on How It Works
// and on Pricing, so the explanation is written once.
//
// The stages are a numbered list read left to right on desktop and top to
// bottom on a phone, where a decorative arrow makes the sequence obvious.

/**
 * @param {object} props
 * @param {{key: string, icon: string, title: string, description: string}[]} props.stages
 *   the escrow stages, in order
 * @param {React.ReactNode} [props.footnote] small print under the stages
 */
export default function EscrowExplainer({ stages = [], footnote }) {
  return (
    <Card>
      <CardContent sx={{ p: { xs: 2.5, md: 4 } }}>
        <Box
          component="ol"
          sx={{
            listStyle: 'none',
            m: 0,
            p: 0,
            display: 'grid',
            gap: { xs: 2, md: 3 },
            gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(3, minmax(0, 1fr))' },
          }}
        >
          {stages.map((stage, index) => (
            <Stack component="li" key={stage.key} spacing={1.5}>
              <Stack direction="row" spacing={1.5} alignItems="center">
                <Box
                  aria-hidden="true"
                  sx={{
                    width: 44,
                    height: 44,
                    flexShrink: 0,
                    borderRadius: 2,
                    display: 'grid',
                    placeItems: 'center',
                    bgcolor: 'primary.surface',
                    color: 'primary.main',
                  }}
                >
                  <Icon icon={stage.icon} width={22} />
                </Box>

                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="overline" component="p" color="text.secondary">
                    {`Stage ${index + 1}`}
                  </Typography>
                  <Typography variant="subtitle1" component="h3">
                    {stage.title}
                  </Typography>
                </Box>
              </Stack>

              <Typography variant="body2" color="text.secondary">
                {stage.description}
              </Typography>

              {/* Sequence cue for the stacked layout only — the three columns
                  already read in order on desktop. */}
              {index < stages.length - 1 ? (
                <Box
                  aria-hidden="true"
                  sx={{ display: { xs: 'flex', md: 'none' }, color: 'text.disabled', pl: 1.75 }}
                >
                  <Icon icon="tabler:arrow-down" width={20} />
                </Box>
              ) : null}
            </Stack>
          ))}
        </Box>

        {footnote ? (
          <Typography variant="caption" component="p" color="text.secondary" sx={{ mt: 3 }}>
            {footnote}
          </Typography>
        ) : null}
      </CardContent>
    </Card>
  )
}
