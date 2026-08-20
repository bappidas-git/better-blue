# BetterBlue — Storefront V2 Prompt Series (10 prompts)

Sequential Claude Code prompts that convert the BetterBlue storefront to the new dark pink/purple social-style experience: Feeds (renamed requests, social cards, private creator replies), rebuilt Home, social Creators page with levels + gated messaging + affiliate promote, new Wallet page, and the vibrant dark theme.

**Run them in order, one at a time, starting from 01.** Each prompt is scoped for a ~15–20 minute Claude Code run and ends by opening a PR — Claude Code must report the **PR URL** at the end of every run. Merge (or at least keep the branch checked out) before running the next prompt, since each builds on the previous one.

| # | File | Delivers | PR branch |
|---|------|----------|-----------|
| 01 | `01-dark-theme-foundation.md` | Dark vibrant pink/purple theme tokens, glow/glass/gradient utilities, AmbientGlow | `feat/storefront-v2-01-dark-theme` |
| 02 | `02-navigation-and-feeds-rename.md` | Menu: Home · Feeds · Creators · How it Works · Pricing · Wallet; `/feeds` routes + redirects; label sweep; Wallet stub | `feat/storefront-v2-02-nav-feeds-rename` |
| 03 | `03-feed-data-layer-and-core-components.md` | Seeds (tags, offerPrice, feedReplies, creator levels/online/contributions), feedService, FeedCard, level badge, RoleGateDialog | `feat/storefront-v2-03-feed-data-core` |
| 04 | `04-home-hero-and-section-removals.md` | Lorem hero + View Feeds / Explore Creators CTAs + creator-attributed images; removes trust band + category section | `feat/storefront-v2-04-home-hero` |
| 05 | `05-home-latest-feeds-and-top-creators.md` | Home: latest 10 feeds timeline + full-width Top Creators cards with works slider | `feat/storefront-v2-05-home-feeds-creators` |
| 06 | `06-home-audience-and-cta-updates.md` | "For Buyers" edits, Register as Buyer/Creator CTAs, lorem final CTA, `?role=` register preselect | `feat/storefront-v2-06-home-audience-cta` |
| 07 | `07-feeds-page.md` | Feeds page: social timeline, infinite scroll, Latest/Most replies/Open/Closed filters, price sort, reply gating | `feat/storefront-v2-07-feeds-page` |
| 08 | `08-feed-details-and-replies.md` | Feed details page + private creator reply/conversation (view/delete own only) | `feat/storefront-v2-08-feed-details-replies` |
| 09 | `09-creators-page.md` | Creators page: social cards, online/level filters, gated Send Message, affiliate Promote CTA | `feat/storefront-v2-09-creators-page` |
| 10 | `10-wallet-page-and-final-qa.md` | Wallet explainer page (payment-link recharge example) + final storefront QA sweep | `feat/storefront-v2-10-wallet-final-qa` |

Ground rules carried through every prompt: storefront only (no admin panel work — the shared dark theme reaching logged-in areas is expected, with legibility-only fixes); "Feeds" is a UI-level rename (collections/services/dashboards keep their names, old routes redirect); categories are removed from storefront UI only; JS/JSX only, no new dependencies, Node 18.19.0, lint + build green before every PR.
