import { useState, useEffect } from 'react';
import { TRADE_AI_ENDPOINT, LS_RATES } from '../config.js';

const ITEM_TYPES = ['Card', 'Sealed Pack', 'Booster Box', 'ETB', 'Slab (PSA)', 'Slab (BGS)', 'Bundle'];
const EMPTY_OFFER = n => ({ id: `offer-${n}`, label: `Offer ${n}`, items: [] });
const MY_PRESETS = [70, 75, 80, 85, 90, 100];
const THEIR_PRESETS = [80, 85, 90, 95, 100];

function scoreClass(s) { return s >= 75 ? 'high' : s >= 50 ? 'med' : 'low'; }

function loadRates() {
  try {
    const r = JSON.parse(localStorage.getItem(LS_RATES));
    if (r && typeof r.my === 'number' && typeof r.their === 'number') return r;
  } catch { /* defaults */ }
  return { my: 80, their: 100 };
}

export default function TradeAdvisor({ injectedWants, injectedMyItems, onConsumedMyItems }) {
  const [myItems, setMyItems] = useState([
    { id: 'my1', name: 'Charizard-GX SV49/SV94', type: 'Card', value: 624 },
  ]);
  const [myName, setMyName] = useState('');
  const [myType, setMyType] = useState('Card');
  const [myVal, setMyVal] = useState('');
  const [offers, setOffers] = useState([EMPTY_OFFER(1)]);
  const [offerInputs, setOfferInputs] = useState({});
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [wantBanner, setWantBanner] = useState(null);
  const initialRates = loadRates();
  const [myRate, setMyRate] = useState(initialRates.my);
  const [theirRate, setTheirRate] = useState(initialRates.their);
  const [activeOfferIdx, setActiveOfferIdx] = useState(0);

  useEffect(() => {
    try { localStorage.setItem(LS_RATES, JSON.stringify({ my: myRate, their: theirRate })); } catch { /* noop */ }
  }, [myRate, theirRate]);

  useEffect(() => {
    if (injectedWants && injectedWants.length > 0) setWantBanner(injectedWants);
  }, [injectedWants]);

  // NEW: cards sent over from Collection land on YOUR side of the trade
  useEffect(() => {
    if (injectedMyItems && injectedMyItems.length > 0) {
      setMyItems(prev => {
        const additions = injectedMyItems
          .filter(c => !prev.find(p => p.name === c.name))
          .map(c => ({ id: `coll-${c.id}`, name: c.name, type: 'Card', value: Math.round(c.value * 100) / 100 }));
        return [...prev, ...additions];
      });
      onConsumedMyItems && onConsumedMyItems();
    }
  }, [injectedMyItems, onConsumedMyItems]);

  function addMyItem() {
    if (!myName.trim()) return;
    setMyItems(prev => [...prev, { id: `my-${Date.now()}`, name: myName.trim(), type: myType, value: parseFloat(myVal) || 0 }]);
    setMyName(''); setMyVal('');
  }
  const removeMyItem = id => setMyItems(p => p.filter(i => i.id !== id));

  function addOfferItem(offerId) {
    const inp = offerInputs[offerId] || {};
    if (!inp.name?.trim()) return;
    setOffers(prev => prev.map(o => o.id === offerId ? {
      ...o, items: [...o.items, { id: `item-${Date.now()}`, name: inp.name.trim(), type: inp.type || 'Card', value: parseFloat(inp.value) || 0 }],
    } : o));
    setOfferInputs(prev => ({ ...prev, [offerId]: {} }));
  }
  const removeOfferItem = (offerId, itemId) =>
    setOffers(prev => prev.map(o => o.id === offerId ? { ...o, items: o.items.filter(i => i.id !== itemId) } : o));
  function addOffer() {
    setOffers(prev => {
      const next = [...prev, EMPTY_OFFER(prev.length + 1)];
      setActiveOfferIdx(next.length - 1);
      return next;
    });
  }
  function removeOffer(id) {
    setOffers(prev => {
      const next = prev.filter(o => o.id !== id);
      setActiveOfferIdx(i => Math.min(i, Math.max(0, next.length - 1)));
      return next;
    });
  }
  const updateOfferInput = (offerId, field, val) =>
    setOfferInputs(prev => ({ ...prev, [offerId]: { ...(prev[offerId] || {}), [field]: val } }));

  const myTotal = myItems.reduce((s, i) => s + i.value, 0);
  const myAdjusted = myTotal * (myRate / 100);
  const offerAdjusted = offer => offer.items.reduce((s, i) => s + i.value, 0) * (theirRate / 100);

  // NEW: flag offer items that match your want list
  const isWanted = name => {
    if (!wantBanner) return false;
    const n = name.toLowerCase();
    return wantBanner.some(w => {
      const wn = w.name.toLowerCase();
      return wn.includes(n) || n.includes(wn) || n.split(' ')[0] === wn.split(' ')[0] && wn.length > 4 && n.includes(wn.split(' ')[0]);
    });
  };

  async function analyze() {
    if (offers.every(o => o.items.length === 0)) return;
    setLoading(true);
    setAnalysis(null);

    const wantsCtx = wantBanner ? `\nThe collector's active want list includes: ${wantBanner.map(w => w.name).join(', ')}.` : '';
    const rateCtx = `\nTrade rate context: The vendor is offering ${myRate}% trade credit on the collector's items (market value $${myTotal.toFixed(2)} → effective trade credit $${myAdjusted.toFixed(2)}). The vendor's items are priced at ${theirRate}% of market value. Net trade gap per offer is factored below.`;

    const prompt = `You are an expert Pokémon TCG trade advisor and market analyst with deep knowledge of 30 years of card price history.

A collector is trading away: ${myItems.map(i => `${i.name} (${i.type}, $${i.value})`).join(', ')}.
Market value: $${myTotal.toFixed(2)}. Effective trade credit at ${myRate}%: $${myAdjusted.toFixed(2)}.${rateCtx}${wantsCtx}

They have received ${offers.length} trade offer(s). For each offer the NET POSITION (adjusted credit minus adjusted offer value) is shown:

${offers.map((o, i) => {
  const offerFaceVal = o.items.reduce((s, x) => s + x.value, 0);
  const adjOffer = offerFaceVal * (theirRate / 100);
  const gap = myAdjusted - adjOffer;
  const gapStr = gap > 0.5 ? `collector owes $${gap.toFixed(2)} cash` : gap < -0.5 ? `collector receives $${Math.abs(gap).toFixed(2)} back` : 'even trade';
  return `OFFER ${i + 1} — ${o.label}:
${o.items.map(item => `  - ${item.name} (${item.type}, face $${item.value}, adjusted $${(item.value * theirRate / 100).toFixed(2)})`).join('\n')}
  Face total: $${offerFaceVal.toFixed(2)} | Adjusted at ${theirRate}%: $${adjOffer.toFixed(2)} | Net: ${gapStr}`;
}).join('\n\n')}

Analyze each offer across these dimensions:
1. PRICE HISTORY & LIFECYCLE TRENDS — Full 30-year price trajectory where applicable. Identify spike/crash/recovery patterns, trend momentum.
2. REPRINT RISK — How likely is TPCi to reprint this? Set age, legal status, product history.
3. GRADING UPSIDE — PSA/BGS pop report logic. Is there grading potential that could 2-5x value?
4. COLLECTOR DEMAND — Fan favorite status, nostalgia cycle, community sentiment, iconic Pokémon premium.
5. TOURNAMENT/META — Competitive relevance driving price spikes vs. pure collectible demand.
6. TRADE RATE FAIRNESS — Factor in the ${myRate}% trade credit. Does the net gap make this offer better or worse than it appears at face value?

For EACH offer, give a SPECULATION SCORE out of 100 and BRIEF analysis broken into the categories. Keep each category to 1-2 short sentences max. Be concise and scannable. Then give an overall RECOMMENDATION ranked 1st, 2nd, 3rd.

CRITICAL: Return ONLY the JSON object below — no commentary before or after. Each text field must be 1-2 sentences MAX.

{
  "offers": [
    {
      "id": "offer-1",
      "score": 82,
      "verdict": "1 sentence summary verdict",
      "priceHistory": "1-2 sentences on lifetime price trends",
      "reprintRisk": "1 sentence on reprint likelihood",
      "gradingUpside": "1 sentence on PSA/grading potential",
      "demand": "1 sentence on collector/meta demand",
      "rateImpact": "1 sentence on net trade gap effect",
      "keyUpside": "5-10 word upside",
      "keyRisk": "5-10 word risk"
    }
  ],
  "recommendation": {
    "rank1": "offer-1",
    "rank2": "offer-2",
    "rank3": "offer-3",
    "summary": "2-3 sentence overall verdict"
  }
}`;

    try {
      const res = await fetch(TRADE_AI_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'claude-haiku-4-5', max_tokens: 4000, messages: [{ role: 'user', content: prompt }] }),
      });
      const data = await res.json();
      const text = data.content.map(b => b.text || '').join('');
      let clean = text.trim();
      const fenceMatch = clean.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (fenceMatch) {
        clean = fenceMatch[1].trim();
      } else {
        const start = clean.indexOf('{');
        if (start !== -1) {
          let depth = 0;
          for (let i = start; i < clean.length; i++) {
            if (clean[i] === '{') depth++;
            else if (clean[i] === '}') { depth--; if (depth === 0) { clean = clean.slice(start, i + 1); break; } }
          }
        }
      }
      setAnalysis(JSON.parse(clean));
    } catch {
      setAnalysis({ error: 'Analysis failed. Please try again.' });
    }
    setLoading(false);
  }

  const offerAnalysis = id => analysis?.offers?.find(o => o.id === id);
  const rankOf = id => {
    const r = analysis?.recommendation;
    if (!r) return null;
    if (r.rank1 === id) return '1st';
    if (r.rank2 === id) return '2nd';
    if (r.rank3 === id) return '3rd';
    return null;
  };

  const active = offers[activeOfferIdx];

  return (
    <div className="tool-view wide">
      <div className="tool-head">
        <div className="th-cert">EDGE · 002</div>
        <h2>Trade Advisor</h2>
        <p>Stack offers side by side. The AI weighs price history, reprint risk, grading upside, demand — and whether the vendor's trade credit math is working against you.</p>
      </div>

      {wantBanner && (
        <div className="panel" style={{ borderColor: '#ffd16640' }}>
          <div className="panel-title" style={{ color: 'var(--foil-gold)', marginBottom: 4 }}>★ Want list loaded ({wantBanner.length} cards) — matching offer items get flagged</div>
        </div>
      )}

      <div className="trade-grid">
        <div className="panel">
          <div className="panel-title">Your side · what you're trading away</div>
          {myItems.map(i => (
            <div className="t-item" key={i.id}>
              <span className="ti-name">{i.name}</span>
              <span className="ti-type">{i.type}</span>
              <span className="ti-val">${i.value.toFixed(2)}</span>
              <button className="icon-btn" onClick={() => removeMyItem(i.id)}>✕</button>
            </div>
          ))}
          <div className="t-total"><span>Market ${myTotal.toFixed(2)} · credit at {myRate}%</span><strong>${myAdjusted.toFixed(2)}</strong></div>
          <div className="add-row">
            <input className="field" placeholder="Item name" value={myName} onChange={e => setMyName(e.target.value)} />
            <select className="field" value={myType} onChange={e => setMyType(e.target.value)}>
              {ITEM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <input className="field num" type="number" placeholder="$" value={myVal} onChange={e => setMyVal(e.target.value)} />
            <button className="btn-sub" onClick={addMyItem}>Add</button>
          </div>
          <div className="rate-row" style={{ marginTop: 12 }}>
            <span className="panel-title" style={{ margin: 0 }}>Their credit on your items</span>
            {MY_PRESETS.map(r => (
              <button key={r} className={`rate-chip ${myRate === r ? 'on' : ''}`} onClick={() => setMyRate(r)}>{r}%</button>
            ))}
          </div>
          <div className="rate-row" style={{ marginTop: 8 }}>
            <span className="panel-title" style={{ margin: 0 }}>Their items priced at</span>
            {THEIR_PRESETS.map(r => (
              <button key={r} className={`rate-chip ${theirRate === r ? 'on' : ''}`} onClick={() => setTheirRate(r)}>{r}%</button>
            ))}
          </div>
        </div>

        <div className="panel">
          <div className="panel-title">Their offers</div>
          <div className="offer-tabs">
            {offers.map((o, i) => (
              <button key={o.id} className={`offer-tab ${i === activeOfferIdx ? 'on' : ''}`} onClick={() => setActiveOfferIdx(i)}>
                {o.label}{rankOf(o.id) && <span className="ot-rank">{rankOf(o.id)}</span>}
              </button>
            ))}
            <button className="offer-tab" onClick={addOffer}>+ Offer</button>
          </div>
          {active && (
            <div>
              {active.items.map(item => (
                <div className="t-item" key={item.id}>
                  {isWanted(item.name) && <span className="ti-want" title="On your want list">★</span>}
                  <span className="ti-name">{item.name}</span>
                  <span className="ti-type">{item.type}</span>
                  <span className="ti-val">${item.value.toFixed(2)}</span>
                  <button className="icon-btn" onClick={() => removeOfferItem(active.id, item.id)}>✕</button>
                </div>
              ))}
              <div className="t-total">
                <span>Adjusted at {theirRate}%</span><strong>${offerAdjusted(active).toFixed(2)}</strong>
              </div>
              <div className="add-row">
                <input className="field" placeholder="Item name" value={offerInputs[active.id]?.name || ''} onChange={e => updateOfferInput(active.id, 'name', e.target.value)} />
                <select className="field" value={offerInputs[active.id]?.type || 'Card'} onChange={e => updateOfferInput(active.id, 'type', e.target.value)}>
                  {ITEM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <input className="field num" type="number" placeholder="$" value={offerInputs[active.id]?.value || ''} onChange={e => updateOfferInput(active.id, 'value', e.target.value)} />
                <button className="btn-sub" onClick={() => addOfferItem(active.id)}>Add</button>
              </div>
              {offers.length > 1 && (
                <button className="icon-btn" style={{ marginTop: 10 }} onClick={() => removeOffer(active.id)}>Remove this offer</button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="run-bar">
        <button className="btn-run" disabled={loading || offers.every(o => o.items.length === 0)} onClick={analyze}>
          {loading ? 'Analyzing…' : 'Run speculation analysis'}
        </button>
        <div className="status"><span className={`dot ${loading ? 'thinking' : analysis && !analysis.error ? 'live' : ''}`} />{loading ? 'Thinking' : analysis ? (analysis.error ? 'Error' : 'Done') : 'Ready'}</div>
      </div>

      {analysis?.error && <div className="panel"><div className="out raw">{analysis.error}</div></div>}

      {analysis?.recommendation && (
        <div className="reco-box">
          <div className="reco-rank">AI VERDICT · ranked {offers.length > 1 ? `${Math.min(offers.length, 3)} offers` : 'this offer'}</div>
          <div style={{ fontSize: 14 }}>{analysis.recommendation.summary}</div>
        </div>
      )}

      {analysis?.offers && offers.map(o => {
        const a = offerAnalysis(o.id);
        if (!a) return null;
        return (
          <div className="panel" key={o.id}>
            <div className="panel-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>{o.label}{rankOf(o.id) ? ` · ranked ${rankOf(o.id)}` : ''}</span>
              <span className={`score-ring ${scoreClass(a.score)}`}>{a.score}</span>
            </div>
            <div style={{ fontSize: 13.5, marginBottom: 8 }}>{a.verdict}</div>
            <div className="ai-cat"><span className="ai-cat-label">Price history</span><span className="ai-cat-text">{a.priceHistory}</span></div>
            <div className="ai-cat"><span className="ai-cat-label">Reprint risk</span><span className="ai-cat-text">{a.reprintRisk}</span></div>
            <div className="ai-cat"><span className="ai-cat-label">Grading upside</span><span className="ai-cat-text">{a.gradingUpside}</span></div>
            <div className="ai-cat"><span className="ai-cat-label">Demand</span><span className="ai-cat-text">{a.demand}</span></div>
            <div className="ai-cat"><span className="ai-cat-label">Rate impact</span><span className="ai-cat-text">{a.rateImpact}</span></div>
            <div className="ai-pros-cons">
              <div className="ai-pc upside"><div className="ai-pc-label">Key upside</div><div className="ai-pc-text">{a.keyUpside}</div></div>
              <div className="ai-pc risk"><div className="ai-pc-label">Key risk</div><div className="ai-pc-text">{a.keyRisk}</div></div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
