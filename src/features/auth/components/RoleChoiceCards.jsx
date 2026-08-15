import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { visuallyHidden } from '@mui/utils'

import { ROLES } from '@/constants/roles'

// Step one of registration: what kind of account is this?
//
// The two cards are **real radio inputs**, hidden visually and wrapped in
// `<label>`s. That is the whole accessibility story: arrow keys move between
// options, Space selects, the group is announced as "radio, 1 of 2", and a
// form-level `required` would work — none of which comes free from
// `<div role="radio">` and a keydown handler. The card is the visible half; the
// input is the semantic half.

const CHOICES = [
  {
    value: ROLES.BUYER,
    icon: 'tabler:building-store',
    title: "I'm a business — I need content",
    description:
      'Post a brief, compare proposals from creators, and pay only when you approve the work.',
  },
  {
    value: ROLES.CREATOR,
    icon: 'tabler:camera',
    title: "I'm a creator — I make content",
    description:
      'Build a portfolio, pitch for briefs from real brands, and get paid from escrow on delivery.',
  },
]

/**
 * @param {object} props
 * @param {string} [props.value] the selected role
 * @param {(role: string) => void} props.onChange called with the chosen role
 * @param {string} props.name radio group name — must be unique on the page
 * @param {string} [props.ariaLabelledBy] id of the visible group heading
 */
export default function RoleChoiceCards({ value, onChange, name, ariaLabelledBy }) {
  return (
    <Stack component="fieldset" spacing={1.5} sx={{ border: 0, m: 0, p: 0 }}>
      <Box component="legend" sx={visuallyHidden}>
        Choose the kind of account you want
      </Box>

      <Stack spacing={1.5} role="radiogroup" aria-labelledby={ariaLabelledBy}>
        {CHOICES.map((choice) => {
          const selected = value === choice.value

          return (
            <Stack
              key={choice.value}
              component="label"
              direction="row"
              spacing={2}
              sx={{
                cursor: 'pointer',
                p: 2,
                borderRadius: 2,
                border: 1,
                borderColor: selected ? 'primary.main' : 'divider',
                bgcolor: selected ? 'primary.surface' : 'background.paper',
                // The selected ring, drawn outside the border so the card does
                // not shift by a pixel when it is chosen.
                boxShadow: (theme) => (selected ? `0 0 0 2px ${theme.palette.primary.main}` : 'none'),
                transition: (theme) =>
                  theme.transitions.create(['border-color', 'background-color', 'box-shadow']),
                '&:hover': { borderColor: selected ? 'primary.main' : 'text.disabled' },
                // The input is invisible, so its focus ring has to land here.
                '&:focus-within': {
                  outline: (theme) => `2px solid ${theme.palette.primary.main}`,
                  outlineOffset: 2,
                },
              }}
            >
              <Box
                component="input"
                type="radio"
                name={name}
                value={choice.value}
                checked={selected}
                onChange={() => onChange(choice.value)}
                sx={visuallyHidden}
              />

              <Box
                aria-hidden="true"
                sx={{
                  flexShrink: 0,
                  width: 44,
                  height: 44,
                  borderRadius: 2,
                  display: 'grid',
                  placeItems: 'center',
                  bgcolor: selected ? 'primary.main' : 'primary.surface',
                  color: selected ? 'primary.contrastText' : 'primary.main',
                }}
              >
                <Icon icon={choice.icon} width={24} />
              </Box>

              <Box>
                <Typography variant="subtitle1" component="span" sx={{ display: 'block' }}>
                  {choice.title}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {choice.description}
                </Typography>
              </Box>
            </Stack>
          )
        })}
      </Stack>
    </Stack>
  )
}
