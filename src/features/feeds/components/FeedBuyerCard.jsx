import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Skeleton from '@mui/material/Skeleton'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'

import KeyValueList from '@/components/data-display/KeyValueList'
import UserAvatar from '@/components/data-display/UserAvatar'
import { EMPTY_PLACEHOLDER, formatDate, formatNumber } from '@/utils/formatters'

// The business behind a feed, in three lines (Storefront V2, `prompts-v2/08`
// §1).
//
// Deliberately a *mini* card. The buyer's full public presence is not part of
// V2, and the questions a creator actually has before replying are small: who
// is this, how long have they been here, and do they post regularly. Anything
// more would be a profile page, which this is not.

/**
 * @param {object} props
 * @param {object|null} props.buyer the business summary from
 *   `feedService.getFeed` — `null` when it could not be read
 * @param {number|null} [props.feedsPosted] public feeds this business has
 *   posted; `null` while the count is still loading
 */
export default function FeedBuyerCard({ buyer, feedsPosted }) {
  if (!buyer) {
    return (
      <Card>
        <CardContent sx={{ p: { xs: 2.5, sm: 3 } }}>
          <Typography variant="subtitle2" component="h2">
            About the business
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            We could not load this business’s details just now. The feed above is unaffected.
          </Typography>
        </CardContent>
      </Card>
    )
  }

  const name = buyer.companyName ?? buyer.name ?? 'A BetterBlue business'

  return (
    <Card>
      <CardContent sx={{ p: { xs: 2.5, sm: 3 } }}>
        <Typography variant="subtitle2" component="h2" sx={{ mb: 2 }}>
          About the business
        </Typography>

        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ minWidth: 0 }}>
          <UserAvatar name={name} src={buyer.logoUrl} size="md" variant="rounded" />
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }} noWrap>
              {name}
            </Typography>
            <Typography variant="body2" color="text.secondary" noWrap>
              {buyer.industry ?? EMPTY_PLACEHOLDER}
            </Typography>
          </Box>
        </Stack>

        <KeyValueList
          divided
          labelWidth={140}
          sx={{ mt: 2 }}
          items={[
            { label: 'Member since', value: formatDate(buyer.memberSince) },
            {
              label: 'Feeds posted',
              value:
                feedsPosted == null ? (
                  <Skeleton variant="text" width={40} aria-label="Counting feeds" />
                ) : (
                  formatNumber(feedsPosted)
                ),
            },
            ...(buyer.location ? [{ label: 'Location', value: buyer.location }] : []),
          ]}
        />
      </CardContent>
    </Card>
  )
}
