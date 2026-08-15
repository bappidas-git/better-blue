import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import LinearProgress from '@mui/material/LinearProgress'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { alpha } from '@mui/material/styles'

import { useLinkProps } from '@/hooks/useLinkProps'

// What a dashboard shows a member on their first visit, instead of four zeroes
// and an empty chart: the two or three things that turn an empty account into a
// working one, in order, with the ones already done ticked off.
//
// Progress is **derived from data**, never stored — a step is complete because
// the profile has the fields or the account has the briefs, so it cannot drift
// from reality or get stuck ticked. The caller computes each step's `done`;
// this component only draws them.
//
// Generic on purpose: the creator (Prompt 21) and affiliate onboarding states
// render the same component with their own steps.

function StepAction({ action }) {
  const linkProps = useLinkProps(action.to)

  return (
    <Button
      variant={action.primary ? 'gradient' : 'outlined'}
      size="small"
      onClick={action.onClick}
      disabled={action.disabled}
      startIcon={action.icon ? <Icon icon={action.icon} width={18} /> : undefined}
      {...linkProps}
    >
      {action.label}
    </Button>
  )
}

function Step({ step, index, isLast, isNext }) {
  const { done, title, description, action } = step

  return (
    <Stack direction="row" spacing={2} alignItems="flex-start">
      {/* Number, tick, and the rail that joins them into one sequence. */}
      <Stack alignItems="center" alignSelf="stretch" sx={{ flexShrink: 0 }}>
        <Box
          aria-hidden="true"
          sx={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            display: 'grid',
            placeItems: 'center',
            fontSize: '0.8125rem',
            fontWeight: 700,
            border: 1,
            borderColor: done ? 'success.main' : isNext ? 'primary.main' : 'divider',
            bgcolor: (theme) =>
              done
                ? alpha(theme.palette.success.main, 0.12)
                : isNext
                  ? theme.palette.primary.surface
                  : 'transparent',
            color: done ? 'success.main' : isNext ? 'primary.main' : 'text.secondary',
          }}
        >
          {done ? <Icon icon="tabler:check" width={18} /> : index + 1}
        </Box>
        {isLast ? null : (
          <Box
            aria-hidden="true"
            sx={{ width: '2px', flexGrow: 1, minHeight: 16, my: 0.5, bgcolor: 'divider' }}
          />
        )}
      </Stack>

      <Box sx={{ flexGrow: 1, minWidth: 0, pb: isLast ? 0 : 3 }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={{ xs: 1.5, sm: 2 }}
          alignItems={{ xs: 'flex-start', sm: 'center' }}
          justifyContent="space-between"
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography
              variant="subtitle2"
              component="h3"
              sx={{ color: done ? 'text.secondary' : 'text.primary' }}
            >
              {title}
              {done ? (
                <Box component="span" sx={{ ml: 1, color: 'success.main', fontWeight: 600 }}>
                  Done
                </Box>
              ) : null}
            </Typography>
            {description ? (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                {description}
              </Typography>
            ) : null}
          </Box>

          {action ? (
            <Box sx={{ flexShrink: 0 }}>
              <StepAction action={{ ...action, primary: action.primary ?? isNext }} />
            </Box>
          ) : null}
        </Stack>
      </Box>
    </Stack>
  )
}

/**
 * @param {object} props
 * @param {React.ReactNode} [props.title='Get set up'] card heading
 * @param {React.ReactNode} [props.description] one line under the heading
 * @param {Array<{key: string, title: string, description?: string, done: boolean,
 *   action?: {label: string, to?: string, onClick?: () => void, icon?: string,
 *   disabled?: boolean, primary?: boolean}}>} props.steps
 *   the steps, in the order they should be done
 * @param {object} [props.sx] MUI system styles
 */
export default function OnboardingChecklist({
  title = 'Get set up',
  description,
  steps = [],
  sx,
  ...rest
}) {
  if (steps.length === 0) return null

  const completed = steps.filter((step) => step.done).length
  const percent = Math.round((completed / steps.length) * 100)
  // The first unfinished step is the one being asked for — it gets the filled
  // button, so there is never a row of equally loud calls to action.
  const nextIndex = steps.findIndex((step) => !step.done)

  return (
    <Card sx={sx} {...rest}>
      <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
        <Stack spacing={0.5} sx={{ mb: 2 }}>
          <Typography variant="h6" component="h2" sx={{ fontSize: '1.0625rem' }}>
            {title}
          </Typography>
          {description ? (
            <Typography variant="body2" color="text.secondary">
              {description}
            </Typography>
          ) : null}
        </Stack>

        <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 3 }}>
          <LinearProgress
            variant="determinate"
            value={percent}
            aria-label="Setup progress"
            sx={{ flexGrow: 1, height: 8, borderRadius: 4 }}
          />
          <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
            {completed} of {steps.length} done
          </Typography>
        </Stack>

        <Box component="ol" sx={{ listStyle: 'none', m: 0, p: 0 }}>
          {steps.map((step, index) => (
            <Box component="li" key={step.key}>
              <Step
                step={step}
                index={index}
                isLast={index === steps.length - 1}
                isNext={index === nextIndex}
              />
            </Box>
          ))}
        </Box>
      </CardContent>
    </Card>
  )
}
