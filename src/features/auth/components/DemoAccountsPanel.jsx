import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'

import { env } from '@/config/env'
import { ROLES, ROLE_META } from '@/constants/roles'

// One-click sign-in for the seeded demo accounts — a development affordance,
// never part of the product.
//
// Two independent switches keep it out of anything a visitor can reach:
// `import.meta.env.DEV` is replaced at build time, so this component and its
// credentials are eliminated from a production bundle entirely, and
// `env.enableDevPages` lets a developer switch it off locally (00 §4).
//
// MOCK-AUTH: these credentials are the seeded ones from
// `scripts/seed-data/users.js` — every account shares `Password123!` and none
// of it is a secret (docs/data-model.md §2). Keep this list in step with the
// seed if the demo accounts ever change; `src/` cannot import from `scripts/`.

/** Shared password for every seeded account. */
const DEMO_PASSWORD = 'Password123!'

const DEMO_ACCOUNTS = [
  { role: ROLES.BUYER, email: 'buyer@betterblue.test', name: 'Nora Whitfield' },
  // A buyer with no briefs, no orders, and a half-finished profile, so the
  // dashboard's first-run onboarding state can be reached in one click.
  { role: ROLES.BUYER, email: 'newbuyer@betterblue.test', name: 'Ruth Alvarez — fresh account' },
  { role: ROLES.CREATOR, email: 'creator@betterblue.test', name: 'Ava Martinez' },
  { role: ROLES.ADMIN, email: 'admin@betterblue.test', name: 'Maya Chen' },
  { role: ROLES.SUPER_ADMIN, email: 'super@betterblue.test', name: 'Elena Marsh' },
]

/**
 * @param {object} props
 * @param {(credentials: {email: string, password: string}) => void} props.onFill
 *   fills the sign-in form with the chosen account
 * @param {boolean} [props.disabled=false] true while a sign-in is pending
 */
export default function DemoAccountsPanel({ onFill, disabled = false }) {
  if (!import.meta.env.DEV || !env.enableDevPages) return null

  return (
    <Box
      sx={{
        p: 2,
        borderRadius: 2,
        border: 1,
        borderStyle: 'dashed',
        borderColor: 'divider',
        bgcolor: 'background.default',
      }}
    >
      <Stack spacing={1.5}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Box sx={{ display: 'flex', color: 'text.secondary' }}>
            <Icon icon="tabler:flask" width={18} />
          </Box>
          <Typography variant="subtitle2" component="p">
            Demo accounts
          </Typography>
          <Typography variant="caption" color="text.secondary">
            development only
          </Typography>
        </Stack>

        <Box
          sx={{
            display: 'grid',
            gap: 1,
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
          }}
        >
          {DEMO_ACCOUNTS.map((account) => (
            <Button
              key={account.email}
              size="small"
              variant="outlined"
              color="inherit"
              disabled={disabled}
              onClick={() => onFill({ email: account.email, password: DEMO_PASSWORD })}
              sx={{ justifyContent: 'flex-start', textAlign: 'left' }}
            >
              <Box sx={{ minWidth: 0 }}>
                <Box component="span" sx={{ display: 'block' }}>
                  {ROLE_META[account.role].label}
                </Box>
                <Box
                  component="span"
                  sx={{
                    display: 'block',
                    fontWeight: 400,
                    fontSize: '0.75rem',
                    color: 'text.secondary',
                  }}
                >
                  {account.name}
                </Box>
              </Box>
            </Button>
          ))}
        </Box>

        <Typography variant="caption" color="text.secondary">
          Seeded accounts from <code>npm run seed</code>. All use the same demo password.
        </Typography>
      </Stack>
    </Box>
  )
}
