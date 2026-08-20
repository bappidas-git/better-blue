import { useCallback, useMemo, useState } from 'react'

import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Container from '@mui/material/Container'
import { NavigationType, useNavigationType } from 'react-router-dom'

import RoleGateDialog from '@/components/feedback/RoleGateDialog'
import PageHeader from '@/components/layout/PageHeader'
import { ROLES } from '@/constants/roles'
import { useAuth } from '@/context/AuthContext'
import BackToTopButton from '@/features/feeds/components/BackToTopButton'
import useDocumentTitle from '@/hooks/useDocumentTitle'
import useInfiniteList from '@/hooks/useInfiniteList'
import { creatorMetaService } from '@/services'
import { formatNumber } from '@/utils/formatters'

import CreatorFilterBar from '../components/CreatorFilterBar'
import CreatorFilterSheet from '../components/CreatorFilterSheet'
import CreatorTimeline from '../components/CreatorTimeline'
import PromoteCreatorDialog from '../components/PromoteCreatorDialog'
import SendMessageDialog from '../components/SendMessageDialog'
import { useDiscoveryParams } from '../hooks/useDiscoveryParams'
import {
  CREATORS_CONTENT_MAX_WIDTH,
  CREATORS_PAGE_SIZE,
  creatorsSchema,
  toCreatorListParams,
} from '../utils/creatorFilters'

// **Creators** — every open storefront on BetterBlue as a social column
// (V2-09).
//
// This replaces the Prompt 12 discovery grid: the four-column card grid, the
// category rail, the price and rating filters, the search box, and the
// paginator are gone. What is left is the question a buyer actually arrives
// with — *who can do this, and are they any good* — answered by one column of
// full-width creator cards that keeps loading as you scroll, seven chips, and a
// sort.
//
// The page owns three decisions and delegates everything else: which creators
// to ask for (`toCreatorListParams`), what "Send message" and "Promote" mean
// for whoever is reading (below), and what the column says while it has nothing
// yet (`CreatorTimeline`).

/** Anchor the back-to-top button returns focus to. */
const TOP_ANCHOR_ID = 'creators-top'

/**
 * The restore cache's key (see `useInfiniteList`). One column, one key: the
 * accumulated pages survive a trip to a storefront and back, and nothing else
 * in the app shares the slot.
 */
const RESTORE_KEY = 'creators-column'

/** Which dialog a card's action opened, and for whom. */
const ACTION = Object.freeze({ NONE: 'none', MESSAGE: 'message', PROMOTE: 'promote' })

export default function CreatorsPage() {
  useDocumentTitle('Creators')

  const { user } = useAuth()
  const navigationType = useNavigationType()

  const [isSheetOpen, setSheetOpen] = useState(false)
  const [action, setAction] = useState(ACTION.NONE)
  const [gateAction, setGateAction] = useState(null)
  const [selected, setSelected] = useState(null)

  const { values, setValues, clearFilters, isFiltered } = useDiscoveryParams(creatorsSchema)

  const listParams = useMemo(
    () => toCreatorListParams(values, { limit: CREATORS_PAGE_SIZE }),
    [values]
  )

  const list = useInfiniteList(creatorMetaService.listCreators, {
    params: listParams,
    limit: CREATORS_PAGE_SIZE,
    cacheKey: RESTORE_KEY,
    // Only a *back* navigation restores. A fresh load has an empty cache
    // anyway, and arriving from a link should start at the top of a fresh
    // column rather than in the middle of the last one.
    restore: navigationType === NavigationType.Pop,
  })

  const isBuyer = user?.role === ROLES.BUYER

  /**
   * The two gated actions, for whoever is reading (§4, §5).
   *
   * A signed-in **buyer** gets the dialog; everybody else — guest, creator,
   * admin — meets the role gate, which is the same gate the feeds page uses for
   * Reply and offers the same two ways out. The card renders both buttons
   * either way and asks us what they mean, which is why the decision is here
   * rather than inside it.
   *
   * SECURITY: the gate is UX (00 §11). `directMessagesService.sendMessage` and
   * the affiliate service enforce the same rules on their own, and the Laravel
   * API must too.
   */
  const openFor = useCallback(
    (creator, next, gateVerb) => {
      setSelected(creator)
      if (isBuyer) {
        setAction(next)
        return
      }
      setGateAction(gateVerb)
    },
    [isBuyer]
  )

  const handleSendMessage = useCallback(
    (creator) => openFor(creator, ACTION.MESSAGE, 'send a message to this creator'),
    [openFor]
  )

  const handlePromote = useCallback(
    (creator) => openFor(creator, ACTION.PROMOTE, 'promote this creator with a referral link'),
    [openFor]
  )

  const closeAction = useCallback(() => setAction(ACTION.NONE), [])
  const closeGate = useCallback(() => setGateAction(null), [])

  const handleFilterChange = useCallback((patch) => setValues(patch), [setValues])
  const closeSheet = useCallback(() => setSheetOpen(false), [])
  const openSheet = useCallback(() => setSheetOpen(true), [])

  return (
    <Box sx={{ position: 'relative' }}>
      <Container maxWidth="lg" sx={{ px: { xs: 2, md: 4 }, py: { xs: 3, md: 5 } }}>
        {/* No AmbientGlow behind this header: the intro paragraph runs the width
            of it, and a glow behind body copy is the one thing §5 of
            docs/theme-v2.md rules out. The level badges and the online dots in
            the column carry the brand instead. */}
        <PageHeader
          id={TOP_ANCHOR_ID}
          tabIndex={-1}
          // Same axis as the filter bar and the column below it.
          sx={{
            maxWidth: CREATORS_CONTENT_MAX_WIDTH,
            mx: 'auto',
            outline: 'none',
            mb: { xs: 2, md: 3 },
          }}
          title="Creators"
          subtitle="Every creator taking commercial work on BetterBlue — their level, what they have published, and what buyers have said about it. Filter the column or just keep scrolling; it loads as you go."
          meta={
            <Chip
              // The header's copy of the count. The filter bar's line is the
              // live region, so this one is silent and the number is announced
              // once rather than twice.
              label={
                list.isLoading && list.total === 0
                  ? 'Loading…'
                  : `${formatNumber(list.total)} ${list.total === 1 ? 'creator' : 'creators'}`
              }
              size="small"
              color="primary"
              variant="outlined"
            />
          }
        />

        <CreatorFilterBar
          values={values}
          onChange={handleFilterChange}
          onClear={clearFilters}
          isFiltered={isFiltered}
          total={list.total}
          isLoading={list.isLoading}
          onOpenSheet={openSheet}
        />

        <CreatorTimeline
          list={list}
          onSendMessage={handleSendMessage}
          onPromote={handlePromote}
          isFiltered={isFiltered}
          onClear={clearFilters}
        />
      </Container>

      <CreatorFilterSheet
        open={isSheetOpen}
        onClose={closeSheet}
        values={values}
        onChange={handleFilterChange}
        onClear={clearFilters}
        isFiltered={isFiltered}
        total={list.total}
        isLoading={list.isLoading}
      />

      <BackToTopButton targetId={TOP_ANCHOR_ID} />

      <SendMessageDialog
        open={action === ACTION.MESSAGE}
        onClose={closeAction}
        creator={selected}
        buyerId={user?.id}
      />

      <PromoteCreatorDialog
        open={action === ACTION.PROMOTE}
        onClose={closeAction}
        creator={selected}
        buyerId={user?.id}
      />

      <RoleGateDialog
        open={Boolean(gateAction)}
        onClose={closeGate}
        requiredRole={ROLES.BUYER}
        action={gateAction ?? undefined}
      />
    </Box>
  )
}
