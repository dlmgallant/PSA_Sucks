import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const REDUCED = typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---- Signature element: the hijacked slab ---- */
function Slab() {
  const stageRef = useRef(null);
  const slabRef = useRef(null);
  const foilRef = useRef(null);

  useEffect(() => {
    const slab = slabRef.current, foil = foilRef.current;
    if (!slab) return;

    let idle;
    if (!REDUCED) {
      // ambient float when untouched
      idle = gsap.to(slab, {
        rotateY: 7, rotateX: -4, duration: 3.4,
        yoyo: true, repeat: -1, ease: 'sine.inOut',
      });
    }

    const setRX = gsap.quickTo(slab, 'rotateX', { duration: 0.5, ease: 'power3' });
    const setRY = gsap.quickTo(slab, 'rotateY', { duration: 0.5, ease: 'power3' });

    function onMove(e) {
      if (REDUCED) return;
      const pt = e.touches ? e.touches[0] : e;
      const r = stageRef.current.getBoundingClientRect();
      const nx = (pt.clientX - r.left) / r.width - 0.5;
      const ny = (pt.clientY - r.top) / r.height - 0.5;
      idle && idle.pause();
      setRY(nx * 26);
      setRX(ny * -20);
      if (foil) gsap.to(foil, { backgroundPosition: `${50 + nx * 90}% ${50 + ny * 90}%`, duration: 0.4, overwrite: 'auto' });
    }
    function onLeave() {
      if (REDUCED) return;
      gsap.to(slabRef.current, { rotateX: 0, rotateY: 0, duration: 0.9, ease: 'elastic.out(1,0.6)' });
      idle && idle.resume();
    }
    const stage = stageRef.current;
    stage.addEventListener('pointermove', onMove);
    stage.addEventListener('pointerleave', onLeave);
    return () => {
      stage.removeEventListener('pointermove', onMove);
      stage.removeEventListener('pointerleave', onLeave);
      idle && idle.kill();
    };
  }, []);

  return (
    <div className="slab-stage" ref={stageRef} aria-hidden="true">
      <div className="slab" ref={slabRef} data-anim="slab">
        <div className="slab-label">
          <div>
            <div className="sl-brand">PSA-SUCKS.COM</div>
            <div className="sl-cert">CERT #FREE4EVER · 2026</div>
          </div>
          <div className="sl-grade">
            <div className="g-num">YOURS</div>
            <div className="g-lbl">Grade</div>
          </div>
        </div>
        <div className="slab-card">
          <div className="foil" ref={foilRef} />
          <div className="foil-grain" />
          <div className="sc-top">Holo · 1st Edition · Self-Graded</div>
          <div className="sc-art">
            Grade it<br />yourself.
            <small>Fee: $0.00 · Wait: 30 sec</small>
          </div>
          <div className="sc-foot">
            <span>EDGES ✓ CORNERS ✓</span>
            <span>SURFACE ✓ 55/45</span>
          </div>
        </div>
      </div>
      <div className="slab-shadow" />
    </div>
  );
}

/* ---- Subgrade ticker ---- */
const TICKER_ITEMS = [
  'CENTERING 55/45', 'SURFACE', 'EDGES', 'CORNERS',
  ['hot', 'NO $25 FEE'], 'FAKE DETECTION', 'TRADE INTEL',
  ['hot', 'NO 45-DAY WAIT'], 'COLLECTION TRACKING', 'POP REPORT LOGIC',
];

function Ticker() {
  const trackRef = useRef(null);
  useEffect(() => {
    if (REDUCED || !trackRef.current) return;
    const tween = gsap.to(trackRef.current, { xPercent: -50, duration: 28, ease: 'none', repeat: -1 });
    return () => tween.kill();
  }, []);
  const half = TICKER_ITEMS.map((it, i) =>
    Array.isArray(it)
      ? <span key={i} className={it[0]}>{it[1]}</span>
      : <span key={i}>{it}</span>
  );
  return (
    <div className="ticker" aria-hidden="true">
      <div className="ticker-track" ref={trackRef}>{half}{half}</div>
    </div>
  );
}

/* ---- Tool index data ---- */
const TOOLS = [
  { id: 'pregrade', group: 'grade', cert: 'GRADE · 001', name: 'AI Pre-Grade', desc: 'Centering, surface, edges, corners — with PSA, BGS, and CGC estimates and a straight answer on whether submitting is worth it.', go: 'Run a pre-grade →' },
  { id: 'condition', group: 'grade', cert: 'GRADE · 002', name: 'Condition Guide', desc: 'Plain-language condition check. Mint to Heavily Played, explained like a knowledgeable friend, not a grading robot.', go: 'Check condition →' },
  { id: 'fake', group: 'grade', cert: 'GRADE · 003', name: 'Fake Detector', desc: 'Print quality, fonts, foil behavior, back design. A verdict with a confidence score before you get burned.', go: 'Verify a card →' },
  { id: 'collection', group: 'edge', cert: 'EDGE · 001', name: 'Collection', desc: 'Track haves and wants with live TCGPlayer prices, condition-adjusted values, and a Table Mode built for card shows.', go: 'Open collection →' },
  { id: 'trade', group: 'edge', cert: 'EDGE · 002', name: 'Trade Advisor', desc: 'Stack offers side by side. AI speculation scores factor reprint risk, grading upside, demand — and whether that 80% trade credit is fleecing you.', go: 'Analyze a trade →' },
];

export default function Landing({ onOpenTool }) {
  const rootRef = useRef(null);

  useEffect(() => {
    if (REDUCED) return;
    const ctx = gsap.context(() => {
      // load sequence
      gsap.timeline({ defaults: { ease: 'power3.out' } })
        .from('[data-anim="line"] > span', { yPercent: 110, duration: 0.9, stagger: 0.09 })
        .from('[data-anim="fade"]', { y: 18, opacity: 0, duration: 0.7, stagger: 0.08 }, '-=0.45')
        .from('[data-anim="slab"]', { y: 50, opacity: 0, duration: 1.1, ease: 'power2.out' }, '-=0.9');
      // scroll reveals
      gsap.utils.toArray('[data-reveal]').forEach((el) => {
        gsap.from(el, {
          y: 34, opacity: 0, duration: 0.8, ease: 'power3.out',
          scrollTrigger: { trigger: el, start: 'top 86%' },
        });
      });
    }, rootRef);
    return () => ctx.revert();
  }, []);

  return (
    <div ref={rootRef}>
      <section className="hero">
        <div className="hero-bg" />
        <div className="hero-copy">
          <div className="eyebrow" data-anim="fade">Tools for collectors, not corporations</div>
          <h1>
            <span className="line" data-anim="line"><span>The hobby's</span></span>
            <span className="line" data-anim="line"><span>middlemen</span></span>
            <span className="line" data-anim="line"><span className="holo-text">can keep the fee.</span></span>
          </h1>
          <p className="hero-sub" data-anim="fade">
            AI pre-grading, fake detection, condition checks, collection tracking,
            and trade analysis — <strong>free, instant, no account.</strong> Know what
            your cards are worth before anyone charges you to find out.
          </p>
          <div className="hero-ctas" data-anim="fade">
            <button className="btn-primary" onClick={() => onOpenTool('pregrade')}>Grade a card free</button>
            <button className="btn-ghost" onClick={() => onOpenTool('collection')}>Open The Edge</button>
          </div>
          <div className="hero-receipts" data-anim="fade">
            <div className="receipt">
              <div className="r-num"><span className="strike">$25+</span>$0.00</div>
              <div className="r-lbl">Per card</div>
            </div>
            <div className="receipt">
              <div className="r-num"><span className="strike">Weeks</span>~30s</div>
              <div className="r-lbl">Turnaround</div>
            </div>
            <div className="receipt">
              <div className="r-num">5</div>
              <div className="r-lbl">Tools, one roof</div>
            </div>
          </div>
        </div>
        <Slab />
      </section>

      <Ticker />

      <section className="section" id="tools">
        <div className="sec-head" data-reveal>
          <div className="sec-eyebrow">The toolkit</div>
          <h2>Pick your weapon.</h2>
          <p className="sec-sub">Three grading tools. Two market tools — that side's called The Edge. All of it talks to each other.</p>
        </div>
        <div className="tool-grid">
          {TOOLS.map(t => (
            <button key={t.id} className={`tool-card ${t.group}-tool`} data-reveal onClick={() => onOpenTool(t.id)}>
              <span className="tc-cert">{t.cert}</span>
              <span className="tc-name">{t.name}</span>
              <span className="tc-desc">{t.desc}</span>
              <span className="tc-go">{t.go}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="sec-head" data-reveal>
          <div className="sec-eyebrow">The receipts</div>
          <h2>Why this site exists.</h2>
          <p className="sec-sub">A second opinion shouldn't cost more than the card.</p>
        </div>
        <div className="vs-grid">
          <div className="vs-card them" data-reveal>
            <span className="vs-tag">The grading industry</span>
            <div className="vs-row"><span className="k">Cost per card</span><span className="v">$25 and up</span></div>
            <div className="vs-row"><span className="k">Turnaround</span><span className="v">Weeks of waiting</span></div>
            <div className="vs-row"><span className="k">Bad submission</span><span className="v">Fee kept anyway</span></div>
            <div className="vs-row"><span className="k">Trade-in credit</span><span className="v">Vendor's math</span></div>
          </div>
          <div className="vs-card us" data-reveal>
            <span className="vs-tag">psa-sucks.com</span>
            <div className="vs-row"><span className="k">Cost per card</span><span className="v">$0, forever</span></div>
            <div className="vs-row"><span className="k">Turnaround</span><span className="v">About 30 seconds</span></div>
            <div className="vs-row"><span className="k">Bad submission</span><span className="v">We tell you to skip it</span></div>
            <div className="vs-row"><span className="k">Trade-in credit</span><span className="v">Your math, AI-checked</span></div>
          </div>
        </div>
      </section>
    </div>
  );
}
