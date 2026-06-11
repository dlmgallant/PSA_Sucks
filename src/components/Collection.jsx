import { useState, useEffect, useRef } from 'react';
import { CARDS_API, LS_COLLECTION, tcgplayerSearchUrl } from '../config.js';

const CONDITIONS = ['NM', 'LP', 'MP', 'HP', 'DMG'];
const CONDITION_MULT = { NM: 1.0, LP: 0.85, MP: 0.65, HP: 0.45, DMG: 0.25 };

function loadCollection() {
  try {
    const raw = localStorage.getItem(LS_COLLECTION);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch { /* fall through */ }
  return [];
}

function marketPrice(card) {
  const p = card.tcgplayer?.prices;
  if (!p) return 0;
  return p.holofoil?.market || p.normal?.market || p.reverseHolofoil?.market || p['1stEditionHolofoil']?.market || 0;
}

function money(n) {
  if (!n) return '—';
  return '$' + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function csvEscape(v) {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

export default function Collection({ onSendToTrade, onSendToMySide, onGradeCard }) {
  const [allCards, setAllCards] = useState(loadCollection);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterFocus, setFilterFocus] = useState(null);
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [tableMode, setTableMode] = useState(false);
  const [tmQuery, setTmQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [refreshNote, setRefreshNote] = useState('');

  // add form
  const [apiSearch, setApiSearch] = useState('');
  const [apiResults, setApiResults] = useState([]);
  const [apiLoading, setApiLoading] = useState(false);
  const [apiError, setApiError] = useState('');
  const [addStatus, setAddStatus] = useState('have');
  const [addFocus, setAddFocus] = useState('');
  const [addCondition, setAddCondition] = useState('NM');
  const searchTimeout = useRef(null);
  const tmInputRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    try { localStorage.setItem(LS_COLLECTION, JSON.stringify(allCards)); } catch { /* blocked */ }
  }, [allCards]);

  useEffect(() => {
    if (tableMode && tmInputRef.current) tmInputRef.current.focus();
  }, [tableMode]);

  useEffect(() => {
    if (!menuOpen) return;
    const close = e => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [menuOpen]);

  // dynamic focus tags — built from what's actually in the collection
  const focuses = Array.from(new Set(allCards.map(c => c.focus).filter(Boolean))).sort();

  async function searchCards(q) {
    if (!q.trim()) { setApiResults([]); return; }
    setApiLoading(true); setApiError('');
    try {
      const res = await fetch(`${CARDS_API}?q=name:"${encodeURIComponent(q)}"&pageSize=20&orderBy=-set.releaseDate`);
      const data = await res.json();
      setApiResults(data.data || []);
    } catch {
      setApiError('Search failed — check your connection.');
    }
    setApiLoading(false);
  }

  function handleApiSearchChange(e) {
    const q = e.target.value;
    setApiSearch(q);
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => searchCards(q), 500);
  }

  function addFromApi(card) {
    const nm = marketPrice(card);
    const newCard = {
      id: `api-${card.id}-${addCondition}-${Date.now()}`,
      apiId: card.id,
      name: card.name,
      number: card.number,
      set: card.set?.name || 'Unknown Set',
      type: card.rarity || '—',
      value: nm * (CONDITION_MULT[addCondition] || 1),
      condition: addCondition,
      status: addStatus,
      focus: addFocus.trim() || null,
      image: card.images?.small,
    };
    setAllCards(prev => [...prev, newCard]);
    setApiResults([]);
    setApiSearch('');
  }

  async function refreshPrices() {
    setMenuOpen(false);
    const apiCards = allCards.filter(c => c.apiId);
    if (!apiCards.length) { setRefreshNote('Add cards via search first to enable price refresh.'); return; }
    setRefreshing(true);
    let updated = 0;
    for (const c of apiCards) {
      try {
        const res = await fetch(`${CARDS_API}/${c.apiId}`);
        const data = await res.json();
        const nm = marketPrice(data.data || {});
        if (nm > 0) {
          setAllCards(prev => prev.map(x => x.id === c.id
            ? { ...x, value: nm * (CONDITION_MULT[x.condition || 'NM'] || 1) }
            : x));
          updated++;
        }
        await new Promise(r => setTimeout(r, 350));
      } catch { /* skip */ }
    }
    setRefreshing(false);
    setRefreshNote(`${updated} price${updated === 1 ? '' : 's'} refreshed.`);
  }

  function exportCsv() {
    setMenuOpen(false);
    const header = 'Name,Number,Set,Rarity,Condition,Status,Focus,Value';
    const rows = allCards.map(c =>
      [c.name, c.number || '', c.set, c.type, c.condition || 'NM', c.status, c.focus || '', c.value?.toFixed(2) || ''].map(csvEscape).join(','));
    const blob = new Blob([header + '\n' + rows.join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'psa-sucks-collection.csv';
    a.click();
  }

  const filtered = allCards.filter(c => {
    const statusMatch = filterStatus === 'all' || c.status === filterStatus;
    const focusMatch = !filterFocus || c.focus === filterFocus;
    const q = search.toLowerCase();
    const searchMatch = !q || c.name?.toLowerCase().includes(q) || c.set?.toLowerCase().includes(q) || c.number?.toLowerCase().includes(q);
    return statusMatch && focusMatch && searchMatch;
  });

  const haveCount = allCards.filter(c => c.status === 'have').length;
  const wantCount = allCards.filter(c => c.status === 'want').length;
  const totalVal = allCards.filter(c => c.status === 'have').reduce((s, c) => s + (c.value || 0), 0);
  const wants = allCards.filter(c => c.status === 'want');

  function toggleStatus(id) {
    setAllCards(prev => prev.map(c => c.id === id ? { ...c, status: c.status === 'have' ? 'want' : 'have' } : c));
  }
  function updateCondition(id, cond) {
    setAllCards(prev => prev.map(c => {
      if (c.id !== id) return c;
      const oldMult = CONDITION_MULT[c.condition || 'NM'] || 1;
      return { ...c, condition: cond, value: (c.value / oldMult) * (CONDITION_MULT[cond] || 1) };
    }));
  }
  function removeCard(id) {
    setAllCards(prev => prev.filter(c => c.id !== id));
  }

  const tmMatch = (() => {
    const q = tmQuery.trim().toLowerCase();
    if (!q) return null;
    const m = allCards.find(c =>
      c.name?.toLowerCase().includes(q) ||
      c.set?.toLowerCase().includes(q) ||
      (c.number && q === c.number.toLowerCase())
    );
    return m ? { type: m.status, card: m } : { type: 'unknown' };
  })();

  return (
    <div className="tool-view wide">
      <div className="tool-head">
        <div className="th-cert">EDGE · 001</div>
        <h2>Collection</h2>
        <p>Your haves and wants — with live TCGPlayer prices, condition adjustments, and show-table lookup.</p>
      </div>

      {/* STATS — only show if there's something to show */}
      {allCards.length > 0 && (
        <div className="coll-hero">
          <div className="ch-label">Collection value</div>
          <div className="ch-value">{money(totalVal)}</div>
          <div className="ch-sub">{haveCount} owned · {wantCount} on the wishlist</div>
        </div>
      )}

      {/* TOOLBAR */}
      <div className="coll-toolbar">
        <button className={`btn-add ${showAdd ? 'open' : ''}`} onClick={() => setShowAdd(v => !v)}>
          {showAdd ? '✕ Close' : '+ Add cards'}
        </button>
        {allCards.length > 0 && (
          <div className="overflow" ref={menuRef}>
            <button className="btn-more" onClick={() => setMenuOpen(v => !v)} aria-label="More actions">•••</button>
            {menuOpen && (
              <div className="menu">
                <button onClick={() => { setMenuOpen(false); setTableMode(true); }}>
                  📋 Show Mode
                  <span style={{ display: 'block', fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>Full-screen lookup for card shows</span>
                </button>
                {wants.length > 0 && (
                  <button onClick={() => { setMenuOpen(false); onSendToTrade(wants); }}>Send wants → Trade Advisor</button>
                )}
                <button onClick={exportCsv}>Export as CSV</button>
                <button onClick={refreshPrices} disabled={refreshing}>{refreshing ? 'Refreshing…' : 'Refresh prices'}</button>
              </div>
            )}
          </div>
        )}
      </div>
      {refreshNote && <div className="inline-note">{refreshNote}</div>}

      {/* ADD PANEL */}
      {showAdd && (
        <div className="panel add-panel">
          <div className="panel-title">Search any card · prices pulled from TCGPlayer</div>
          <input
            className="field"
            autoFocus
            placeholder="e.g. Charizard ex, Blastoise, Dark Dragonite"
            value={apiSearch}
            onChange={handleApiSearchChange}
          />
          <div className="add-row">
            <select className="field" value={addStatus} onChange={e => setAddStatus(e.target.value)}>
              <option value="have">I have it</option>
              <option value="want">I want it</option>
            </select>
            <select className="field" value={addCondition} onChange={e => setAddCondition(e.target.value)}>
              {CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <input
              className="field"
              placeholder="Tag (e.g. Charizard)"
              value={addFocus}
              onChange={e => setAddFocus(e.target.value)}
              title="Optional — group cards by tag so you can filter them later"
            />
          </div>
          {apiLoading && <div className="out placeholder"><span className="spinner" />Searching…</div>}
          {apiError && <div className="out placeholder">{apiError}</div>}
          {apiResults.length > 0 && (
            <div className="search-results">
              {apiResults.map(card => (
                <div className="search-result-row" key={card.id}>
                  {card.images?.small && <img src={card.images.small} alt="" loading="lazy" />}
                  <div className="c-info">
                    <div className="c-name">{card.name} <span className="c-num">#{card.number}</span></div>
                    <div className="c-meta">{card.set?.name} · {card.rarity || '—'} · {money(marketPrice(card))}</div>
                  </div>
                  <button className="mini-btn" onClick={() => addFromApi(card)}>+ Add</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* FILTERS — only show when there are cards */}
      {allCards.length > 0 && (
        <div className="filter-bar">
          <div className="filter-bar-2">
            <div className="seg">
              {['all', 'have', 'want'].map(s => (
                <button key={s} className={filterStatus === s ? 'on' : ''} onClick={() => setFilterStatus(s)}>
                  {s === 'all' ? 'All' : s === 'have' ? `Have (${haveCount})` : `Want (${wantCount})`}
                </button>
              ))}
            </div>
            <input
              className="field filter-search"
              placeholder="Search your collection…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {/* DYNAMIC FOCUS TAGS */}
          {focuses.length > 0 && (
            <div className="chip-row">
              <span className="filter-label">Filter by tag</span>
              {focuses.map(f => (
                <button
                  key={f}
                  className={`chip ${filterFocus === f ? 'on' : ''}`}
                  onClick={() => setFilterFocus(filterFocus === f ? null : f)}
                >
                  {f}
                </button>
              ))}
              {filterFocus && (
                <button className="chip" onClick={() => setFilterFocus(null)}>✕ Clear</button>
              )}
            </div>
          )}
        </div>
      )}

      {/* EMPTY STATE */}
      {allCards.length === 0 && !showAdd && (
        <div className="empty-state">
          <div className="empty-icon">🃏</div>
          <div className="empty-title">Your collection is empty</div>
          <div className="empty-sub">Search for any Pokémon card above to add it. Prices are pulled live from TCGPlayer.</div>
          <button className="btn-primary" style={{ marginTop: 18 }} onClick={() => setShowAdd(true)}>+ Add your first card</button>
        </div>
      )}

      {/* FILTERED EMPTY */}
      {allCards.length > 0 && filtered.length === 0 && (
        <div className="empty-state">
          <div className="empty-title">No cards match</div>
          <div className="empty-sub">Try adjusting your filters or search.</div>
        </div>
      )}

      {/* CARD GRID */}
      {filtered.length > 0 && (
        <div className="card-grid">
          {filtered.map(c => (
            <div className="g-card" key={c.id}>
              <div className="g-thumb">
                {c.image
                  ? <img src={c.image} alt={c.name} loading="lazy" />
                  : (
                    <div className="g-placeholder">
                      <span>{c.name?.split(' ')[0]}</span>
                    </div>
                  )
                }
                <span className={`pill ${c.status}`}>{c.status}</span>
              </div>

              <div className="g-body">
                <div className="g-name">{c.name}</div>
                {c.number && <div className="g-meta">#{c.number} · {c.set}</div>}
                {!c.number && <div className="g-meta">{c.set}</div>}
                <div className="g-meta dim">{c.type}</div>

                <div className="g-foot">
                  <span className="g-val">{money(c.value)}</span>
                  <select
                    className="cond-select"
                    value={c.condition || 'NM'}
                    onChange={e => updateCondition(c.id, e.target.value)}
                    aria-label="Condition"
                  >
                    {CONDITIONS.map(x => <option key={x} value={x}>{x}</option>)}
                  </select>
                </div>

                <div className="g-actions">
                  {c.status === 'have' && <>
                    <button className="mini-btn" onClick={() => onGradeCard(c)}>Grade</button>
                    <button className="mini-btn" onClick={() => onSendToMySide(c)}>Trade</button>
                  </>}
                  {c.status === 'want' && (
                    <a className="mini-btn" href={tcgplayerSearchUrl(c.name)} target="_blank" rel="noopener noreferrer">Buy</a>
                  )}
                  <button className="mini-btn icon" onClick={() => toggleStatus(c.id)} title="Flip have/want">⇄</button>
                  <button className="mini-btn icon" onClick={() => removeCard(c.id)} title="Remove">✕</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* SHOW MODE (was Table Mode) */}
      {tableMode && (
        <div className="table-mode" role="dialog" aria-label="Show Mode">
          <div className="tm-head">
            <div>
              <h3>Show Mode</h3>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                Type any card name — see instantly if you have it or want it
              </div>
            </div>
            <button className="btn-sub" onClick={() => { setTableMode(false); setTmQuery(''); }}>Close</button>
          </div>
          <input
            ref={tmInputRef}
            className="field tm-search"
            placeholder="e.g. Charizard, Blastoise 2/102…"
            value={tmQuery}
            onChange={e => setTmQuery(e.target.value)}
          />
          <div className={`tm-verdict ${tmMatch ? tmMatch.type : 'unknown'}`}>
            {!tmMatch && (
              <>
                <div className="tm-big" style={{ color: 'var(--muted)' }}>?</div>
                <div className="tm-card-meta">Start typing a card name above.</div>
              </>
            )}
            {tmMatch?.type === 'have' && (
              <>
                <div className="tm-big">HAVE IT</div>
                <div className="tm-card-name">{tmMatch.card.name} {tmMatch.card.number ? `#${tmMatch.card.number}` : ''}</div>
                <div className="tm-card-meta">{tmMatch.card.set} · {money(tmMatch.card.value)}</div>
              </>
            )}
            {tmMatch?.type === 'want' && (
              <>
                <div className="tm-big">WANT IT</div>
                <div className="tm-card-name">{tmMatch.card.name} {tmMatch.card.number ? `#${tmMatch.card.number}` : ''}</div>
                <div className="tm-card-meta">{tmMatch.card.set} · {money(tmMatch.card.value)}</div>
              </>
            )}
            {tmMatch?.type === 'unknown' && (
              <>
                <div className="tm-big" style={{ color: 'var(--muted)' }}>NOT LISTED</div>
                <div className="tm-card-meta">"{tmQuery}" isn't in your collection or wishlist.</div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
