import { Icon } from '@iconify/react'
import Chip from '@mui/material/Chip'
import Tooltip from '@mui/material/Tooltip'

// The `verified` badge, as the creator sees it on their own profile screen.
//
// **Read-only, always.** Verification is granted by Trust & Safety from the
// admin console (Prompt 29) after they have checked the account — there is no
// self-service path to it, and this chip must never look like one. It reports
// the state and explains where it comes from, and that is all.
//
// The public storefront draws the granted state differently (a badge beside the
// display name, `creatorProfile/ProfileHeader`), because there the question is
// "can I trust this creator" rather than "where do I stand".

/**
 * @param {object} props
 * @param {boolean} [props.verified=false] the storefront's `verified` flag
 * @param {'small'|'medium'} [props.size='small'] MUI density
 */
export default function VerificationChip({ verified = false, size = 'small' }) {
  const label = verified ? 'Verified creator' : 'Not verified yet'

  return (
    <Tooltip
      title={
        verified
          ? 'Verified by BetterBlue Trust & Safety'
          : 'BetterBlue Trust & Safety verifies creators once they have completed work on the platform. There is nothing to apply for.'
      }
    >
      <Chip
        size={size}
        variant={verified ? 'filled' : 'outlined'}
        color={verified ? 'primary' : 'default'}
        icon={
          <Icon
            icon={verified ? 'tabler:rosette-discount-check-filled' : 'tabler:clock-hour-4'}
            width={16}
            aria-hidden="true"
          />
        }
        label={label}
      />
    </Tooltip>
  )
}
