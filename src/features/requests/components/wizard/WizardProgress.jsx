import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import LinearProgress from '@mui/material/LinearProgress'
import Step from '@mui/material/Step'
import StepButton from '@mui/material/StepButton'
import StepLabel from '@mui/material/StepLabel'
import Stepper from '@mui/material/Stepper'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { visuallyHidden } from '@mui/utils'

// Where you are in the wizard, in the two shapes the two screens can afford:
// the full stepper from md up, and a one-line "Step 2 of 4" header with a
// progress bar on a phone, where four labels would either wrap or truncate.
//
// Progress is always visible either way (§6) — on mobile the header is sticky
// under the dashboard app bar, so scrolling a long step never loses it.

/** Height of the sticky mobile header's shadow-free hairline. */
const MOBILE_HEADER_OFFSET = 0

/**
 * @param {object} props
 * @param {{key: string, label: string}[]} props.steps every step, in order
 * @param {number} props.activeStep zero-based index of the open step
 * @param {number} [props.furthestStep=activeStep] the highest step reached, so
 *   already-answered steps stay clickable and later ones do not
 * @param {(index: number) => void} [props.onStepClick] jump to a visited step
 * @param {boolean} [props.disabled=false] freeze navigation while publishing
 */
export default function WizardProgress({
  steps = [],
  activeStep = 0,
  furthestStep,
  onStepClick,
  disabled = false,
}) {
  const reached = Math.max(furthestStep ?? activeStep, activeStep)
  const current = steps[activeStep]
  const percent = ((activeStep + 1) / Math.max(steps.length, 1)) * 100

  return (
    <Box component="nav" aria-label="Request steps">
      {/* Mobile — compact header + bar */}
      <Box
        sx={{
          display: { xs: 'block', md: 'none' },
          position: 'sticky',
          top: MOBILE_HEADER_OFFSET,
          zIndex: 1,
          bgcolor: 'background.default',
          py: 1,
        }}
      >
        <Stack direction="row" spacing={1} alignItems="baseline" justifyContent="space-between">
          <Typography variant="subtitle2" component="p">
            <Box component="span" sx={{ color: 'text.secondary' }}>
              Step {activeStep + 1} of {steps.length}
            </Box>
            {current ? ` — ${current.label}` : null}
          </Typography>
        </Stack>
        <LinearProgress
          variant="determinate"
          value={percent}
          aria-hidden="true"
          sx={{ mt: 1, height: 6, borderRadius: 999 }}
        />
      </Box>

      {/* Desktop — the full stepper, with visited steps as jump targets */}
      <Stepper
        activeStep={activeStep}
        nonLinear
        sx={{ display: { xs: 'none', md: 'flex' }, mb: 1 }}
      >
        {steps.map((step, index) => {
          const isComplete = index < reached
          const isCurrent = index === activeStep

          return (
            <Step
              key={step.key}
              completed={isComplete}
              aria-current={isCurrent ? 'step' : undefined}
            >
              {onStepClick && index <= reached ? (
                <StepButton
                  onClick={() => onStepClick(index)}
                  disabled={disabled}
                  icon={isComplete && !isCurrent ? <CompletedIcon /> : undefined}
                >
                  {step.label}
                  <Box component="span" sx={visuallyHidden}>
                    {` — step ${index + 1} of ${steps.length}`}
                  </Box>
                </StepButton>
              ) : (
                <StepLabel>{step.label}</StepLabel>
              )}
            </Step>
          )
        })}
      </Stepper>
    </Box>
  )
}

/** Tick that replaces the number on a step already answered. */
function CompletedIcon() {
  return (
    <Box
      aria-hidden="true"
      sx={{
        width: 24,
        height: 24,
        borderRadius: '50%',
        display: 'grid',
        placeItems: 'center',
        bgcolor: 'primary.main',
        color: 'primary.contrastText',
      }}
    >
      <Icon icon="tabler:check" width={16} />
    </Box>
  )
}
