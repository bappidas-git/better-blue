import { useEffect, useRef, useState } from 'react'

import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'

import KeyValueList from '@/components/data-display/KeyValueList'
import Section from '@/components/layout/Section'
import { STATUS_META } from '@/constants/statuses'
import { formatDate } from '@/utils/formatters'

// "About" is the paragraph a buyer reads before deciding whether to write a
// brief, plus the facts they check afterwards — languages, what this creator
// makes, where they are, how long they have been here.

/** Lines of bio shown before the fold. */
const BIO_CLAMP_LINES = 6

const MEMBER_SINCE_FORMAT = 'MMMM YYYY'

/** Slack for sub-pixel line heights when measuring the clamp. */
const OVERFLOW_TOLERANCE_PX = 4

const clampedSx = {
  display: '-webkit-box',
  WebkitBoxOrient: 'vertical',
  WebkitLineClamp: BIO_CLAMP_LINES,
  overflow: 'hidden',
}

/** Splits a bio into paragraphs on blank lines, dropping empty ones. */
function toParagraphs(bio) {
  return String(bio ?? '')
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
}

/**
 * @param {object} props
 * @param {object} props.profile the `creatorProfiles` record
 */
export default function AboutSection({ profile }) {
  const [isExpanded, setExpanded] = useState(false)
  const [isClampable, setClampable] = useState(false)
  const bioRef = useRef(null)

  const paragraphs = toParagraphs(profile.bio)
  const languages = profile.languages ?? []
  const contentTypes = profile.contentTypes ?? []

  // Measured rather than guessed from a character count: the same bio clamps at
  // 360px and does not at 1200px, and only the browser knows which.
  useEffect(() => {
    const node = bioRef.current
    if (!node) return
    setClampable(node.scrollHeight - node.clientHeight > OVERFLOW_TOLERANCE_PX)
  }, [profile.bio])

  const details = [
    languages.length > 0 ? { label: 'Languages', value: languages.join(', ') } : null,
    contentTypes.length > 0
      ? {
          label: 'Content types',
          value: contentTypes.map((type) => STATUS_META[type]?.label ?? type).join(', '),
        }
      : null,
    profile.location ? { label: 'Location', value: profile.location } : null,
    profile.createdAt
      ? {
          label: 'Member since',
          value: formatDate(profile.createdAt, MEMBER_SINCE_FORMAT),
        }
      : null,
  ].filter(Boolean)

  return (
    <Section title={`About ${profile.displayName}`} spacing="md">
      <Stack spacing={3}>
        {paragraphs.length > 0 ? (
          <Box>
            <Box ref={bioRef} sx={isExpanded ? undefined : clampedSx}>
              {paragraphs.map((paragraph, index) => (
                <Typography
                  key={paragraph.slice(0, 40)}
                  variant="body1"
                  color="text.secondary"
                  sx={{ maxWidth: '72ch', mt: index === 0 ? 0 : 2 }}
                >
                  {paragraph}
                </Typography>
              ))}
            </Box>

            {isClampable ? (
              <Button
                variant="text"
                onClick={() => setExpanded((open) => !open)}
                aria-expanded={isExpanded}
                sx={{ mt: 1, px: 0 }}
              >
                {isExpanded ? 'Read less' : 'Read more'}
              </Button>
            ) : null}
          </Box>
        ) : null}

        {contentTypes.length > 0 ? (
          <Box>
            <Typography variant="subtitle2" component="h3" gutterBottom>
              What I create
            </Typography>
            <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
              {contentTypes.map((type) => (
                <Chip
                  key={type}
                  label={STATUS_META[type]?.label ?? type}
                  size="small"
                  color="primary"
                  variant="outlined"
                />
              ))}
            </Stack>
          </Box>
        ) : null}

        {details.length > 0 ? <KeyValueList items={details} labelWidth={180} divided /> : null}
      </Stack>
    </Section>
  )
}
