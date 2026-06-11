import { useState, useEffect, useRef } from 'react';
import { CARDS_API, LS_COLLECTION, tcgplayerSearchUrl } from '../config.js';

const MOCK_COLLECTION = [
  { id: 'c1', name: "Charizard VMAX 074/073", set: "Champion's Path", type: 'Rainbow Rare', value: 174.18, condition: 'NM', status: 'have', focus: 'Charizard' },
  { id: 'c2', name: 'Charizard ex 223/197', set: 'Obsidian Flames', type: 'Special Illustration Rare', value: 109.46, condition: 'NM', status: 'have', focus: 'Charizard' },
  { id: 'c3', name: 'Charizard 6/108', set: 'EX Power Keepers', type: 'Reverse Holo', value: 144.84, condition: 'LP', status: 'have', focus: 'Charizard' },
  { id: 'c4', name: 'Charizard-EX 100/106', set: 'Flashfire', type: 'Ultra Rare', value: 266.08, condition: 'NM', status: 'have', focus: 'Charizard' },
  { id: 'c5', name: 'Charizard 146/144', set: 'Skyridge', type: 'Secret Rare', value: 2524.86, condition: 'NM', status: 'have', focus: 'Charizard' },
  { id: 'c6', name: 'Pikachu 049/203', set: 'Evolving Skies', type: 'Reverse Holo', value: 0.60, condition: 'NM', status: 'have', focus: 'Pikachu' },
  { id: 'c7', name: 'Pikachu ex 063/193', set: 'Paldea Evolved', type: 'Double Rare', value: 4.17, condition: 'NM', status: 'have', focus: 'Pikachu' },
  { id: 'c8', name: 'Pikachu 065/202', set: 'Sword & Shield Base', type: 'Reverse Holo', value: 1.26, condition: 'NM', status: 'have', focus: 'Pikachu' },
  { id: 'c9', name: 'Mimikyu 97/149', set: 'Sun & Moon Base', type: 'Holo Rare', value: 18.50, condition: 'NM', status: 'have', focus: 'Mimikyu' },
  { id: 'c10', name: 'Mimikyu VMAX 115/264', set: 'Fusion Strike', type: 'Rare Holo V', value: 12.00, condition: 'NM', status: 'have', focus: 'Mimikyu' },
];
const MOCK_WANTS = [
  { id: 'w1', name: 'Charizard 4/102', set: 'Base Set', type: 'Holo Rare', value: 380.00, status: 'want', focus: 'Charizard' },
  { id: 'w2', name: 'Charizard 3/110', set: 'Legendary Collection', type: 'Reverse Holo', value: 1110.97, status: 'want', focus: 'Charizard' },
  { id: 'w3', name: 'Shining Charizard 107/105', set: 'Neo Destiny 1st Ed.', type: 'Secret Rare', value: 2067.48, status: 'want', focus: 'Charizard' },
  { id: 'w4', name: 'Charizard-EX XY121', set: 'XY Black Star Promos', type: 'Promo', value: 163.31, status: 'want', focus: 'Charizard' },
  { id: 'w5', name: 'Surfing Pikachu V 021/028 (JP)', set: '25th Anniversary Collection', type: 'Double Rare', value: 6.64, status: 'want', focus: 'Pikachu' },
  { id: 'w6', name: "Ash's Pikachu SM112", set: 'SM Black Star Promos', type: 'Promo', value: 28.00, status: 'want', focus: 'Pikachu' },
  { id: 'w7', name: 'Flying Pikachu V 006/025', set: '25th Anniversary Collection', type: 'Ultra Rare', value: 22.00, status: 'want', focus: 'Pikachu' },
  { id: 'w8', name: 'Mimikyu ex 250/193', set: 'Paldea Evolved', type: 'Special Illustration Rare', value: 35.00, status: 'want', focus: 'Mimikyu' },
  { id: 'w9', name: 'Mimikyu 097/189', set: 'Darkness Ablaze', type: 'Rare Holo', value: 8.50, status: 'want', focus: 'Mimikyu' },
];

const CONDITIONS = ['NM', 'LP', 'MP', 'HP', 'DMG'];
const CONDITION_MULT = { NM: 1.0, LP: 0.85, MP: 0.65, HP: 0.45, DMG: 0.25 };

function loadCollection() {
  try {
    const raw = localStorage.getItem(LS_COLLECTION);
    if (raw) return JSON.parse(raw);
  } catch { /* fall through */ }
  return [...MOCK_COLLECTION, ...MOCK_WANTS];
}

function marketPrice(card) {
  const p = card.tcgplayer?.prices;
  if (!p) return 0;
  return p.holofoil?.market || p.normal?.market || p.reverseHolofoil?.market || p['1stEditionHolofoil']?.market || 0;
}

function csvEscape(v) {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function money(n) {
  return '$' + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function Collection({ onSendToTrade, onSendToMySide, onGradeCard }) {
  const [allCards, setAllCards] = useState(loadCollection);
  const [activeFocus, setActiveFocus] = useState('All');
  const [filterStatus, setFilterStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState('grid');
  const [showAdd, setShowAdd] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [tableMode, setTableMode] = useState(false);
  const [tmQuery, setTmQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [refreshNote, setRefreshNote] = useState('');

  const [apiSearch, setApiSearch] = useState('');
  const [apiResults, setApiResults] = useState([]);
  const [apiLoading, setApiLoading] = useState(false);
  const [apiError, setApiError] = useState('');
  const [addStatus, setAddStatus] = useState('have');
  const [addFocus, setAddFocus] = useState('Other');
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

  const focuses = ['All', ...Array.from(new Set(allCards.map(c => c.focus).filter(Boolean)))];

  async function searchCards(q) {
    if (!q.trim()) { setApiResults([]); return; }
    setApiLoading(true); setApiError('');
    try {
      const res = await fetch(`${CARDS_API}?q=name:"${encodeURIComponent(q)}"&pageSize=20&orderBy=-set.releaseDate`);
      const data = await res.json();
      setApiResults(data.data || []);
    } catch {
      setApiError('Search failed — check your connection and try again.');
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
      id: `api-${card.id}-${addCondition}`,
      apiId: card.id,
      name: `${card.name} ${card.number}/${card.set?.printedTotal || card.set?.total || '?'}`,
      set: card.set?.name || 'Unknown Set',
      type: card.rarity || '—',
      value: nm * (CONDITION_MULT[addCondition] || 1),
      condition: addCondition,
      status: addStatus,
      focus: addFocus || card.name,
      image: card.images?.small,
    };
    setAllCards(prev => prev.find(c => c.id === newCard.id) ? prev : [...prev, newCard]);
  }

  async function refreshPrices() {
    setMenuOpen(false);
    const apiCards = allCards.filter(c => c.apiId);
    if (!apiCards.length) { setRefreshNote('No live-priced cards to refresh yet — add cards from search first.'); return; }
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
    const header = 'Name,Set,Rarity,Condition,Status,Focus,Market Value';
    const rows = allCards.map(c =>
      [c.name, c.set, c.type, c.condition || 'NM', c.status, c.focus || '', c.value.toFixed(2)].map(csvEscape).join(','));
    const blob = new Blob([header + '\n' + rows.join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'psa-sucks-collection.csv';
    a.click();
  }

  const filtered = allCards.filter(c => {
    const focusMatch = activeFocus === 'All' || c.focus === activeFocus;
    const statusMatch = filterStatus === 'all' || c.status === filterStatus;
    const q = search.toLowerCase();
    const searchMatch = !q || c.name.toLowerCase().includes(q) || c.set.toLowerCase().includes(q);
    return focusMatch && statusMatch && searchMatch;
  });

  const inFocus = c => activeFocus === 'All' || c.focus === activeFocus;
  const scoped = allCards.filter(inFocus);
  const haveCount = scoped.filter(c => c.status === 'have').length;
  const wantCount = scoped.filter(c => c.status === 'want').length;
  const totalVal = scoped.filter(c => c.status === 'have').reduce((s, c) => s + c.value, 0);
  const wantVal = scoped.filter(c => c.status === 'want').reduce((s, c) => s + c.value, 0);

  const focusValues = (() => {
    const m = {};
    allCards.filter(c => c.status === 'have').forEach(c => {
      const f = c.focus || 'Other';
      m[f] = (m[f] || 0) + c.value;
    });
    const arr = Object.entries(m).map(([name, val]) => ({ name, val })).sort((a, b) => b.val - a.val);
    const max = arr.length ? arr[0].val : 1;
    return { arr, max };
  })();

  function toggleStatus(id) {
    setAllCards(prev => prev.map(c => c.id === id ? { ...c, status: c.status === 'have' ? 'want' : 'have' } : c));
  }
  function updateCondition(id, newCondition) {
    setAllCards(prev => prev.map(c => {
      if (c.id !== id) return c;
      const oldMult = CONDITION_MULT[c.condition || 'NM'] || 1;
      return { ...c, condition: newCondition, value: (c.value / oldMult) * (CONDITION_MULT[newCondition] || 1) };
    }));
  }
  function removeCard(id) { setAllCards(prev => prev.filter(c => c.id !== id)); }

  const tmMatch = (() => {
    const q = tmQuery.trim().toLowerCase();
    if (!q) return null;
    const m = allCards.find(c => c.name.toLowerCase().includes(q) || c.set.toLowerCase().includes(q));
    return m ? { type: m.status, card: m } : { type: 'unknown' };
  })();

  const wants = allCards.filter(c => c.status === 'want');

  function CardActions({ c }) {
    return (
      <div className="g-actions">
        {c.status === 'have' && <>
          <button className="mini-btn" onClick={() => onGradeCard(c)} title="Run AI Pre-Grade">Grade</button>
          <button className="mini-btn" onClick={() => onSendToMySide(c)} title="Add to a trade">Trade</button>
        </>}
        {c.status === 'want' && (
          <a className="mini-btn" href={tcgplayerSearchUrl(c.name)} target="_blank" rel="noopener noreferrer" title="Find on TCGPlayer">Buy</a>
        )}
        <button className="mini-btn icon" onClick={() => toggleStatus(c.id)} title="Flip have/want">⇄</button>
        <button className="mini-btn icon" onClick={() => removeCard(c.id)} title="Remove">✕</button>
      </div>
    );
  }

  return (
    <div className="tool-view wide">
      <div className="tool-head">
        <div className="th-cert">EDGE · 001</div>
        <h2>Collection</h2>
      </div>

      <div className="coll-hero">
        <div className="ch-label">{activeFocus === 'All' ? 'Collection value' : `${activeFocus} value`}</div>
        <div className="ch-value">{money(totalVal)}</div>
        <div className="ch-sub">
          {haveCount} owned · {wantCount} on the wishlist
          {wantVal > 0 && <> · {money(wantVal)} to chase</>}
        </div>
      </div>

      {focusValues.arr.length > 1 && (
        <div className="focus-bars">
          {focusValues.arr.map(f => (
            <button key={f.name} className="fb-row" onClick={() => setActiveFocus(activeFocus === f.name ? 'All' : f.name)}>
              <span className="fb-name">{f.name}</span>
              <span className="fb-track"><span className="fb-fill" style={{ width: Math.max(4, (f.val / focusValues.max) * 100) + '%' }} /></span>
              <span className="fb-val">{money(f.val)}</span>
            </button>
          ))}
        </div>
      )}

      <div className="coll-toolbar">
        <div className="seg">
          <button className={viewMode === 'grid' ? 'on' : ''} onClick={() => setViewMode('grid')}>Grid</button>
          <button className={viewMode === 'list' ? 'on' : ''} onClick={() => setViewMode('list')}>List</button>
        </div>
        <button className={`btn-add ${showAdd ? 'open' : ''}`} onClick={() => setShowAdd(v => !v)}>
          {showAdd ? 'Close' : '+ Add cards'}
        </button>
        <div className="overflow" ref={menuRef}>
          <button className="btn-more" onClick={() => setMenuOpen(v => !v)} aria-label="More actions">•••</button>
          {menuOpen && (
            <div className="menu">
              <button onClick={() => { setMenuOpen(false); setTableMode(true); }}>Table Mode</button>
              {wants.length > 0 && <button onClick={() => { setMenuOpen(false); onSendToTrade(wants); }}>Send wants → Trade</button>}
              <button onClick={exportCsv}>Export CSV</button>
              <button onClick={refreshPrices} disabled={refreshing}>{refreshing ? 'Refreshing…' : 'Refresh prices'}</button>
            </div>
          )}
        </div>
      </div>
      {refreshNote && <div className="inline-note">{refreshNote}</div>}

      {showAdd && (
        <div className="panel add-panel">
          <input className="field" autoFocus placeholder="Search any card — e.g. Charizard ex" value={apiSearch} onChange={handleApiSearchChange} />
          <div className="add-row">
            <select className="field" value={addStatus} onChange={e => setAddStatus(e.target.value)}>
              <option value="have">I have it</option>
              <option value="want">I want it</option>
            </select>
            <select className="field" value={addCondition} onChange={e => setAddCondition(e.target.value)}>
              {CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <input className="field" placeholder="Focus (e.g. Charizard)" value={addFocus} onChange={e => setAddFocus(e.target.value)} />
          </div>
          {apiLoading && <div className="out placeholder"><span className="spinner" />Searching…</div>}
          {apiError && <div className="out placeholder">{apiError}</div>}
          {apiResults.length > 0 && (
            <div className="card-list" style={{ marginTop: 11, maxHeight: 320, overflowY: 'auto' }}>
              {apiResults.map(card => (
                <div className="api-result" key={card.id}>
                  {card.images?.small && <img src={card.images.small} alt="" loading="lazy" />}
                  <div className="c-info">
                    <div className="c-name">{card.name} {card.number}/{card.set?.printedTotal || '?'}</div>
                    <div className="c-meta">{card.set?.name} · {card.rarity || '—'} · {money(marketPrice(card))}</div>
                  </div>
                  <button className="mini-btn" onClick={() => addFromApi(card)}>+ Add</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="filter-bar">
        <div className="chip-row">
          {focuses.map(f => (
            <button key={f} className={`chip ${activeFocus === f ? 'on' : ''}`} onClick={() => setActiveFocus(f)}>{f}</button>
          ))}
        </div>
        <div className="filter-bar-2">
          <div className="seg">
            {['all', 'have', 'want'].map(s => (
              <button key={s} className={filterStatus === s ? 'on' : ''} onClick={() => setFilterStatus(s)}>
                {s === 'all' ? 'All' : s === 'have' ? 'Have' : 'Want'}
              </button>
            ))}
          </div>
          <input className="field filter-search" placeholder="Filter…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-title">Nothing here yet</div>
          <div className="empty-sub">Tap “+ Add cards” to search and start building, or clear the filters above.</div>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="card-grid">
          {filtered.map(c => (
            <div className="g-card" key={c.id}>
              <div className="g-thumb">
                {c.image
                  ? <img src={c.image} alt="" loading="lazy" />
                  : <div className="g-placeholder"><span>{c.name.split(' ')[0]}</span></div>}
                <span className={`pill ${c.status}`}>{c.status}</span>
              </div>
              <div className="g-body">
                <div className="g-name">{c.name}</div>
                <div className="g-meta">{c.set}</div>
                <div className="g-meta dim">{c.type}</div>
                <div className="g-foot">
                  <span className="g-val">{money(c.value)}</span>
                  <select className="cond-select" value={c.condition || 'NM'} onChange={e => updateCondition(c.id, e.target.value)} aria-label="Condition">
                    {CONDITIONS.map(x => <option key={x} value={x}>{x}</option>)}
                  </select>
                </div>
                <CardActions c={c} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card-list">
          {filtered.map(c => (
            <div className="c-card" key={c.id}>
              {c.image && <img src={c.image} alt="" loading="lazy" />}
              <span className={`pill ${c.status}`}>{c.status}</span>
              <div className="c-info">
                <div className="c-name">{c.name}</div>
                <div className="c-meta">{c.set} · {c.type}</div>
              </div>
              <span className="c-val">{money(c.value)}</span>
              <div className="c-controls">
                <select className="cond-select" value={c.condition || 'NM'} onChange={e => updateCondition(c.id, e.target.value)} aria-label="Condition">
                  {CONDITIONS.map(x => <option key={x} value={x}>{x}</option>)}
                </select>
                <CardActions c={c} />
              </div>
            </div>
          ))}
        </div>
      )}

      {tableMode && (
        <div className="table-mode" role="dialog" aria-label="Table Mode">
          <div className="tm-head">
            <h3>Table Mode</h3>
            <button className="btn-sub" onClick={() => { setTableMode(false); setTmQuery(''); }}>Close</button>
          </div>
          <input ref={tmInputRef} className="field tm-search" placeholder="Type a card name…" value={tmQuery} onChange={e => setTmQuery(e.target.value)} />
          <div className={`tm-verdict ${tmMatch ? tmMatch.type : 'unknown'}`}>
            {!tmMatch && <><div className="tm-big" style={{ color: 'var(--muted)' }}>?</div><div className="tm-card-meta">Search your list — built for one-handed use at a show table.</div></>}
            {tmMatch?.type === 'have' && <><div className="tm-big">HAVE IT</div><div className="tm-card-name">{tmMatch.card.name}</div><div className="tm-card-meta">{tmMatch.card.set} · {money(tmMatch.card.value)}</div></>}
            {tmMatch?.type === 'want' && <><div className="tm-big">WANT IT</div><div className="tm-card-name">{tmMatch.card.name}</div><div className="tm-card-meta">{tmMatch.card.set} · market {money(tmMatch.card.value)}</div></>}
            {tmMatch?.type === 'unknown' && <><div className="tm-big" style={{ color: 'var(--muted)' }}>NOT LISTED</div><div className="tm-card-meta">“{tmQuery}” isn’t in your collection or wants.</div></>}
          </div>
        </div>
      )}
    </div>
  );
}
