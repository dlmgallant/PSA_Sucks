// ============================================================
// PSA SUCKS — site configuration
// Everything commercial or environment-specific lives here.
// ============================================================

// Vision tools API (Gemini-format proxy). Same-origin once deployed
// to psa-sucks.com, so no CORS changes needed there.
export const ANALYZE_ENDPOINT = 'https://psa-sucks.com/api/analyze';

// Trade Advisor AI (Claude via Cloudflare Worker).
export const TRADE_AI_ENDPOINT = 'https://empty-term-1f24pokeedge-proxy.dlmgallant.workers.dev';

// Card search + prices.
export const CARDS_API = 'https://api.pokemontcg.io/v2/cards';

// TCGPlayer affiliate. Set your partner/affiliate parameter here and
// every "Buy" link on want-list cards carries it. Leave '' to ship
// plain links until your affiliate account is approved.
// Example once approved (Impact): 'u=YOUR_ID'
export const TCGPLAYER_AFFILIATE_PARAM = '';

export function tcgplayerSearchUrl(cardName) {
  const base = `https://www.tcgplayer.com/search/all/product?q=${encodeURIComponent(cardName)}`;
  return TCGPLAYER_AFFILIATE_PARAM ? `${base}&${TCGPLAYER_AFFILIATE_PARAM}` : base;
}

// Pro waitlist. Point this at a Cloudflare Worker (see workers/waitlist.js
// in this repo). Leave '' and the form falls back to a Discord link.
export const WAITLIST_ENDPOINT = '';

// Community / feedback (preserved from V8 footer).
export const DISCORD_URL = 'https://discord.com/users/306435808355811330';

// localStorage keys
export const LS_COLLECTION = 'psasucks_collection_v1';
export const LS_RATES = 'psasucks_trade_rates_v1';
