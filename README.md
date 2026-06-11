# PSA Sucks v2 — Grade + Edge

The combined platform: PSA Sucks (AI grading tools) absorbing PokeEdge
(collection + trade intel, now branded "The Edge").

## Run it
    npm install
    npm run dev        # local preview at localhost:5173
    npm run build      # production build to dist/
    npm run deploy     # gh-pages deploy (same flow as pokeedge)

Deploying to psa-sucks.com: upload the contents of dist/ to the site root.
Asset paths are relative (base './') so it works at the domain root AND
at a github.io/repo/ subpath with zero config changes.

## CORS note
The three vision tools call https://psa-sucks.com/api/analyze. Hosted on
psa-sucks.com that's same-origin — nothing to do. Hosted anywhere else
(github.io preview), the API needs an Access-Control-Allow-Origin header
or those three tools will fail. Collection (pokemontcg.io) and Trade
Advisor (Cloudflare Worker) work from any origin.

## Monetization wiring — src/config.js
- TCGPLAYER_AFFILIATE_PARAM: set when your affiliate account is approved;
  every want-list "Buy" link picks it up.
- WAITLIST_ENDPOINT: deploy workers/waitlist.js to Cloudflare (KV binding
  name: WAITLIST), paste the worker URL here. Until then the Pro waitlist
  button routes interest to your Discord.

## What's preserved 1:1 from the originals
- All three vision prompts verbatim (src/lib/prompts.js)
- Compression tiers, payload shape, response parsing (src/lib/vision.js)
- Badge/verdict/tier regexes (src/lib/parsers.js)
- Trade Advisor prompt, Haiku model, JSON extraction (TradeAdvisor.jsx)
- pokemontcg.io search + TCGPlayer price extraction + condition multipliers
- Footer disclaimer, credit, Discord links

## What's new
- Awwwards-style landing: interactive 3D holo slab (GSAP), load sequence,
  scroll reveals, subgrade ticker, industry-vs-us receipts, pricing section
- localStorage persistence: collection + trade rates survive reloads
  (mock data seeds first run only)
- Table Mode: full-screen HAVE/WANT lookup built for card show tables
- Collection → Trade: send owned cards to your side of a trade
- Want-list matching: offer items on your wants get flagged ★ and fed
  to the AI as context
- Collection → Pre-Grade handoff ("Grade" button on owned cards)
- CSV export (TCGPlayer-friendly columns)
- Price refresh for API-added cards (sequential, rate-limit friendly)
- Pro waitlist + affiliate link scaffolding (see config.js)
- OG/SEO meta tags, prefers-reduced-motion respected, 44px+ tap targets

## Expansion path (documented, not built)
- Multi-TCG collection data (One Piece, sports) — swap/add card APIs in
  config.js and marketPrice() in Collection.jsx
- Pro gating: all five tools route through config.js endpoints, so a
  keyed proxy is a drop-in change

## Deployment
See DEPLOY.md — the site is on Vercel, and api/analyze.js (your ChatGPT gpt-4o backend) is included and must stay.
