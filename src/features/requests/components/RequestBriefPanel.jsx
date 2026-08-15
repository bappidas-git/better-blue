import { useState } from 'react'

import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import ButtonBase from '@mui/material/ButtonBase'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import Link from '@mui/material/Link'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'

import KeyValueList from '@/components/data-display/KeyValueList'
import MediaLightbox from '@/components/data-display/MediaLightbox'
import StatusChip from '@/components/data-display/StatusChip'
import { getStatusMeta } from '@/constants/statuses'
import { describeDeadline, formatBudget, formatQuantity } from '@/features/requests/utils/requestDisplay'
import { EMPTY_PLACEHOLDER, formatDate, formatNumber } from '@/utils/formatters'

// The brief itself, read back the way a creator reads it: the description, the
// specifications, and the three lists a buyer wrote to keep a shoot on track.
//
// Nothing here is editable. A published brief is a promise creators have priced
// against, so changing it is a new request rather than an edit (Prompt 16 §5);
// only drafts reopen, and they reopen in the wizard.

/** URLs we are willing to render as an `<img>` rather than link out to. */
const IMAGE_URL = /(\.(png|jpe?g|gif|webp|avif|svg)(\?|$))|picsum\.photos/i

/** A titled block of free text, skipped entirely when the buyer left it blank. */
function Prose({ title, body, icon, tone }) {
  if (!body) return null

  return (
    <Box>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.75, color: tone }}>
        {icon ? <Icon icon={icon} width={18} aria-hidden="true" /> : null}
        <Typography variant="subtitle2" component="h3">
          {title}
        </Typography>
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-line' }}>
        {body}
      </Typography>
    </Box>
  )
}

/**
 * @param {object} props
 * @param {object} props.request the brief
 * @param {string} [props.categoryLabel] resolved category name
 */
export default function RequestBriefPanel({ request, categoryLabel }) {
  const [lightboxIndex, setLightboxIndex] = useState(null)

  const references = (request.referenceUrls ?? []).filter(Boolean)
  const images = references.filter((url) => IMAGE_URL.test(url))
  const links = references.filter((url) => !IMAGE_URL.test(url))
  const deadline = describeDeadline(request)
  const contentTypeLabel = getStatusMeta(request.contentType).label

  return (
    <Stack spacing={{ xs: 2, md: 3 }}>
      <Card>
        <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
          <Typography variant="subtitle2" component="h2" sx={{ mb: 1 }}>
            The brief
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ whiteSpace: 'pre-line' }}>
            {request.description || 'This request has no description yet.'}
          </Typography>
        </CardContent>
      </Card>

      <Card>
        <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
          <Typography variant="subtitle2" component="h2" sx={{ mb: 2 }}>
            Specifications
          </Typography>
          <KeyValueList
            divided
            labelWidth={190}
            items={[
              { label: 'Category', value: categoryLabel ?? EMPTY_PLACEHOLDER },
              {
                label: 'Content type',
                value: <StatusChip status={request.contentType} size="sm" tooltip />,
              },
              { label: 'Deliverables', value: formatQuantity(request, contentTypeLabel) },
              ...(request.videoDurationSec
                ? [
                    {
                      label: 'Clip length',
                      value: `${formatNumber(request.videoDurationSec)} seconds each`,
                    },
                  ]
                : []),
              {
                label: 'Framing',
                value: <StatusChip status={request.orientation} size="sm" tooltip />,
              },
              {
                label: 'Usage rights',
                value: <StatusChip status={request.usageRights} size="sm" tooltip />,
                hint: getStatusMeta(request.usageRights).description,
              },
              { label: 'Budget', value: formatBudget(request) },
              {
                label: 'Deadline',
                value: (
                  <Typography variant="body2" sx={{ fontWeight: 500, color: deadline.tone }}>
                    {deadline.date}
                    {deadline.relative ? ` · ${deadline.relative}` : ''}
                  </Typography>
                ),
              },
              { label: 'Posted', value: formatDate(request.publishedAt ?? request.createdAt) },
            ]}
          />
        </CardContent>
      </Card>

      {request.brandGuidelines || request.dos || request.donts ? (
        <Card>
          <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
            <Typography variant="subtitle2" component="h2" sx={{ mb: 2 }}>
              Direction for creators
            </Typography>
            <Stack spacing={2.5}>
              <Prose
                title="Brand guidelines"
                body={request.brandGuidelines}
                icon="solar:palette-linear"
              />
              <Prose
                title="Please do"
                body={request.dos}
                icon="tabler:circle-check"
                tone="success.main"
              />
              <Prose
                title="Please avoid"
                body={request.donts}
                icon="tabler:circle-x"
                tone="error.main"
              />
            </Stack>
          </CardContent>
        </Card>
      ) : null}

      {references.length > 0 ? (
        <Card>
          <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
            <Typography variant="subtitle2" component="h2" sx={{ mb: 2 }}>
              References
            </Typography>

            {images.length > 0 ? (
              <Stack
                direction="row"
                spacing={1.5}
                component="ul"
                aria-label="Reference images"
                sx={{ listStyle: 'none', m: 0, p: 0, overflowX: 'auto', pb: 1 }}
              >
                {images.map((url, index) => (
                  <Box component="li" key={url} sx={{ flexShrink: 0 }}>
                    <ButtonBase
                      onClick={() => setLightboxIndex(index)}
                      aria-label={`View reference image ${index + 1} of ${images.length}`}
                      sx={{
                        width: 132,
                        height: 99,
                        borderRadius: 2,
                        overflow: 'hidden',
                        display: 'block',
                        border: 1,
                        borderColor: 'divider',
                      }}
                    >
                      <Box
                        component="img"
                        src={url}
                        alt=""
                        loading="lazy"
                        sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                      />
                    </ButtonBase>
                  </Box>
                ))}
              </Stack>
            ) : null}

            {links.length > 0 ? (
              <Stack
                direction="row"
                spacing={1}
                flexWrap="wrap"
                useFlexGap
                sx={{ mt: images.length > 0 ? 2 : 0 }}
              >
                {links.map((url) => (
                  <Chip
                    key={url}
                    component={Link}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    clickable
                    variant="outlined"
                    icon={<Icon icon="tabler:external-link" width={16} />}
                    label={url.replace(/^https?:\/\//, '')}
                    sx={{ maxWidth: '100%' }}
                  />
                ))}
              </Stack>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <MediaLightbox
        open={lightboxIndex !== null}
        items={images.map((url, index) => ({
          id: url,
          src: url,
          alt: `Reference image ${index + 1} for ${request.title}`,
        }))}
        defaultIndex={lightboxIndex ?? 0}
        onClose={() => setLightboxIndex(null)}
        title="Reference images"
      />
    </Stack>
  )
}
