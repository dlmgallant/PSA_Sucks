import { useState, useCallback } from 'react';
import Landing from './components/Landing.jsx';
import { PreGrade, ConditionGuide, FakeDetector } from './components/VisionTools.jsx';
import Collection from './components/Collection.jsx';
import TradeAdvisor from './components/TradeAdvisor.jsx';
import { WAITLIST_ENDPOINT, DISCORD_URL } from './config.js';

const GRADE_TABS = [
  ['pregrade', 'Pre-Grade'],
  ['condition', 'Condition'],
  ['fake', 'Fake Check'],
];
const EDGE_TABS = [
  ['collection', 'Collection'],
  ['trade', 'Trades'],
];

function Pricing({ onOpenTool }) {
  const [email, setEmail] = useState('');
  const [state, setState] = useState('idle'); // idle | busy | done | err

  async function join(e) {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setState('err'); return; }
    if (!WAITLIST_ENDPOINT) {
      // No endpoint configured yet — route interest to Discord instead.
      window.open(DISCORD_URL, '_blank', 'noopener');
      setState('done');
      return;
    }
    setState('busy');
    try {
      const res = await fetch(WAITLIST_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      setState(res.ok ? 'done' : 'err');
    } catch {
      setState('err');
    }
  }

  return (
    <section className="section" id="pricing">
      <div className="sec-head" data-reveal>
        <div className="sec-eyebrow">Pricing</div>
        <h2>Free is the product.</h2>
        <p className="sec-sub">Everything live today stays free. Pro is for the people who want more firepower.</p>
      </div>
      <div className="vs-grid">
        <div className="vs-card us" data-reveal>
          <span className="vs-tag">Free · forever</span>
          <div className="vs-row"><span className="k">AI Pre-Grade</span><span className="v">Unlimited</span></div>
          <div className="vs-row"><span className="k">Fake Detector</span><span className="v">Unlimited</span></div>
          <div className="vs-row"><span className="k">Condition Guide</span><span className="v">Unlimited</span></div>
          <div className="vs-row"><span className="k">Collection + Trades</span><span className="v">Included</span></div>
          <div style={{ marginTop: 18 }}>
            <button className="btn-primary" onClick={() => onOpenTool('pregrade')}>Start grading</button>
          </div>
        </div>
        <div className="vs-card them" data-reveal>
          <span className="vs-tag" style={{ color: 'var(--foil-gold)', borderColor: '#ffd1663d' }}>Pro · coming soon</span>
          <div className="vs-row"><span className="k">Batch grading</span><span className="v">Whole binders at once</span></div>
          <div className="vs-row"><span className="k">Grade history</span><span className="v">Saved reports</span></div>
          <div className="vs-row"><span className="k">Collection sync</span><span className="v">Across devices</span></div>
          <div className="vs-row"><span className="k">Price alerts</span><span className="v">On your want list</span></div>
          {state === 'done' ? (
            <div style={{ marginTop: 18, color: 'var(--good)', fontWeight: 600, fontSize: 14 }}>You're on the list. We'll be in touch.</div>
          ) : (
            <form className="add-row" style={{ marginTop: 18 }} onSubmit={join}>
              <input className="field" type="email" placeholder="you@email.com" value={email}
                onChange={e => { setEmail(e.target.value); setState('idle'); }} aria-label="Email for Pro waitlist" />
              <button className="btn-sub" type="submit" disabled={state === 'busy'}>
                {state === 'busy' ? 'Joining…' : 'Join waitlist'}
              </button>
              {state === 'err' && <span className="status" style={{ color: 'var(--bad)' }}>Check that email and try again</span>}
            </form>
          )}
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer>
      <div className="foot-disclaimer">
        ⚠️ <strong>Early access</strong> — results are AI-generated and should be used as a guide only, not a definitive assessment. Always verify high-value decisions in person.
      </div>
      <div className="foot-credit">Built by <span>@danimalcollects</span> · for collectors, not corporations</div>
      <div className="foot-links">
        <a className="foot-btn discord" href={DISCORD_URL} target="_blank" rel="noopener noreferrer">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.043.033.055a19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03z"/></svg>
          Report a Bug
        </a>
        <a className="foot-btn plain" href={DISCORD_URL} target="_blank" rel="noopener noreferrer">💬 Provide Feedback</a>
      </div>
    </footer>
  );
}

export default function App() {
  const [view, setView] = useState('home');
  const [injectedWants, setInjectedWants] = useState(null);
  const [injectedMyItems, setInjectedMyItems] = useState(null);

  const openTool = useCallback((id) => {
    setView(id);
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, []);

  // Collection → Trade (wants list for matching + AI context)
  const handleSendToTrade = useCallback((wants) => {
    setInjectedWants(wants);
    openTool('trade');
  }, [openTool]);

  // Collection → Trade (a card you own onto YOUR side of the trade)
  const handleSendToMySide = useCallback((card) => {
    setInjectedMyItems([card]);
    openTool('trade');
  }, [openTool]);

  // Collection → Pre-Grade ("should I slab this?")
  const handleGradeCard = useCallback(() => {
    openTool('pregrade');
  }, [openTool]);

  return (
    <>
      <nav className="nav">
        <button className="wordmark" onClick={() => openTool('home')} aria-label="PSA Sucks home">
          PSA<em>SUCKS</em><span className="tm">™</span>
        </button>
        <div className="nav-tabs">
          <span className="nav-group-label">Grade</span>
          {GRADE_TABS.map(([id, label]) => (
            <button key={id} className={`nav-tab ${view === id ? 'active' : ''}`} onClick={() => openTool(id)}>{label}</button>
          ))}
          <span className="nav-group-label">Edge</span>
          {EDGE_TABS.map(([id, label]) => (
            <button key={id} className={`nav-tab edge-tab ${view === id ? 'active' : ''}`} onClick={() => openTool(id)}>{label}</button>
          ))}
        </div>
      </nav>

      {view === 'home' && (
        <>
          <Landing onOpenTool={openTool} />
          <Pricing onOpenTool={openTool} />
        </>
      )}
      {view === 'pregrade' && <PreGrade />}
      {view === 'condition' && <ConditionGuide />}
      {view === 'fake' && <FakeDetector />}
      {view === 'collection' && (
        <Collection
          onSendToTrade={handleSendToTrade}
          onSendToMySide={handleSendToMySide}
          onGradeCard={handleGradeCard}
        />
      )}
      {view === 'trade' && (
        <TradeAdvisor
          injectedWants={injectedWants}
          injectedMyItems={injectedMyItems}
          onConsumedMyItems={() => setInjectedMyItems(null)}
        />
      )}

      <Footer />
    </>
  );
}
