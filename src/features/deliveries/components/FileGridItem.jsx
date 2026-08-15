import { useState } from 'react'

import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import ButtonBase from '@mui/material/ButtonBase'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { alpha } from '@mui/material/styles'

import { MEDIA_TYPE } from '@/services/uploadService'
import { formatFileSize } from '@/features/orders/utils/orderDisplay'

// One deliverable file, as a tile in the delivery grid.
//
// Lives in `features/deliveries` because both sides of an order render it:
// the buyer reviewing a hand-over (Prompt 20) and the creator reading back
// what they submitted (Prompt 24). It moved here from `features/orders`
// unchanged.
//
// A `ButtonBase` rather than a decorated `div`: opening a deliverable at full
// size is the single most common thing done on this screen, and it has to be
// reachable by keyboard with a name a screen reader can read out (§12). The
// accessible name is the file name plus its kind, because "image" alone is
// useless in a grid of eight.
//
// A thumbnail that fails to load leaves the tile intact with the file name on
// it (§13) — the file is still there and still downloadable; it is the preview
// that is missing, and a broken image icon says the opposite.

/**
 * @param {object} props
 * @param {{id: string, name: string, url: string, thumbnailUrl?: string,
 *   mediaType?: string, sizeKb?: number}} props.file the deliverable
 * @param {() => void} props.onOpen opens the lightbox at this file
 */
export default function FileGridItem({ file, onOpen }) {
  const [failed, setFailed] = useState(false)
  const isVideo = file?.mediaType === MEDIA_TYPE.VIDEO
  const preview = file?.thumbnailUrl ?? file?.url

  return (
    <Box component="li" sx={{ listStyle: 'none' }}>
      <ButtonBase
        onClick={onOpen}
        aria-label={`Open ${file?.name ?? 'file'} (${isVideo ? 'video' : 'image'})`}
        sx={{
          display: 'block',
          width: '100%',
          textAlign: 'left',
          borderRadius: 2,
          overflow: 'hidden',
          border: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
          transition: (theme) => theme.transitions.create(['border-color', 'box-shadow']),
          '&:hover': { borderColor: 'primary.main', boxShadow: 1 },
        }}
      >
        <Box
          sx={{
            position: 'relative',
            width: '100%',
            aspectRatio: '4 / 3',
            display: 'grid',
            placeItems: 'center',
            bgcolor: (theme) => alpha(theme.palette.text.primary, 0.06),
            color: 'text.secondary',
          }}
        >
          {preview && !failed ? (
            <Box
              component="img"
              src={preview}
              alt=""
              loading="lazy"
              onError={() => setFailed(true)}
              sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          ) : (
            <Stack alignItems="center" spacing={0.5} sx={{ p: 1.5, textAlign: 'center' }}>
              <Icon icon={isVideo ? 'solar:videocamera-linear' : 'solar:gallery-linear'} width={26} />
              <Typography variant="caption" sx={{ wordBreak: 'break-word' }}>
                Preview unavailable
              </Typography>
            </Stack>
          )}

          {isVideo ? (
            <Box
              aria-hidden="true"
              sx={{
                position: 'absolute',
                inset: 0,
                display: 'grid',
                placeItems: 'center',
                bgcolor: (theme) => alpha(theme.palette.common.black, 0.28),
                color: 'common.white',
              }}
            >
              <Box
                sx={{
                  width: 44,
                  height: 44,
                  borderRadius: '50%',
                  display: 'grid',
                  placeItems: 'center',
                  bgcolor: (theme) => alpha(theme.palette.common.black, 0.5),
                }}
              >
                <Icon icon="tabler:player-play-filled" width={20} />
              </Box>
            </Box>
          ) : null}
        </Box>

        <Box sx={{ px: 1.25, py: 1 }}>
          <Typography
            variant="body2"
            sx={{
              fontWeight: 600,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {file?.name}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {isVideo ? 'Video' : 'Image'} · {formatFileSize(file?.sizeKb)}
          </Typography>
        </Box>
      </ButtonBase>
    </Box>
  )
}
