import { useState } from 'react'

import { Icon } from '@iconify/react'
import IconButton from '@mui/material/IconButton'
import InputAdornment from '@mui/material/InputAdornment'

import FormTextField from '@/components/inputs/FormTextField'

// The password input used by sign-in and registration — `FormTextField` plus a
// reveal toggle, so the show/hide behaviour and its accessible naming are
// written once instead of three times.
//
// The toggle is a real button with `aria-pressed`, which is what tells a screen
// reader whether the password is currently visible; the icon alone would say
// nothing. It stays out of the tab order (`tabIndex={-1}`) so tabbing through
// the form goes field → field → submit, and is still reachable by anyone
// navigating by button.

/**
 * @param {object} props
 * @param {string} props.label visible label
 * @param {'current-password'|'new-password'} [props.autoComplete='current-password']
 *   what a password manager should offer here (00 §13)
 * @param {...*} props everything else is forwarded to `FormTextField`, so
 *   `useForm().fieldProps('password')` spreads straight in
 */
export default function PasswordField({
  label = 'Password',
  autoComplete = 'current-password',
  ...rest
}) {
  const [visible, setVisible] = useState(false)

  return (
    <FormTextField
      label={label}
      type={visible ? 'text' : 'password'}
      autoComplete={autoComplete}
      endAdornment={
        <InputAdornment position="end">
          <IconButton
            onClick={() => setVisible((shown) => !shown)}
            aria-label={visible ? 'Hide password' : 'Show password'}
            aria-pressed={visible}
            tabIndex={-1}
            edge="end"
            sx={{ width: 44, height: 44 }}
          >
            <Icon icon={visible ? 'tabler:eye-off' : 'tabler:eye'} width={20} />
          </IconButton>
        </InputAdornment>
      }
      {...rest}
    />
  )
}
