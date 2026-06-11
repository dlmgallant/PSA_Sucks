import { useRef, useEffect, useState } from 'react';
import gsap from 'gsap';

const REDUCED = typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * ResultSlab — the graded card gets slabbed.
 *
 * Props:
 *   imageFile   – the uploaded File (front photo) to display
 *   gradeLine   – e.g. "PSA 8-9" or "Near Mint" or "Genuine"
 *   gradeLabel  – e.g. "Grade est." or "Condition" or "Verdict"
 *   certLine    – e.g. "Pre-Grade · 2026" or "Condition Guide · 2026"
 *   badgeCls    – 'badge-good' | 'badge-warn' | 'badge-bad' | 'badge-neutral'
 *   badgeText   – e.g. "✓ Submit" or "Near Mint" or "✓ Genuine"
 *   subLine     – e.g. "Centering 55/45 · Surface clean" (optional summary)
 */
export default function ResultSlab({ imageFile, gradeLine, gradeLabel, certLine, badgeCls, badgeText, subLine }) {
  const stageRef = useRef(null);
  const slabRef = useRef(null);
  const foilRef = useRef(null);
  const [imgSrc, setImgSrc] = useState(null);
  const [saving, setSaving] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragRef = useRef(null);

  // drag-to-reposition the card inside the slab window
  function onImgPointerDown(e) {
    e.preventDefault();
    const start = { px: e.clientX, py: e.clientY, ox: offset.x, oy: offset.y };
    dragRef.current = start;
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function onImgPointerMove(e) {
    if (!dragRef.current) return;
    const d = dragRef.current;
    setOffset({ x: d.ox + (e.clientX - d.px), y: d.oy + (e.clientY - d.py) });
  }
  function onImgPointerUp(e) {
    dragRef.current = null;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* noop */ }
  }

  // convert uploaded File → object URL
  useEffect(() => {
    if (!imageFile) return;
    const url = URL.createObjectURL(imageFile);
    setImgSrc(url);
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  // tilt + foil interaction (same as landing slab)
  useEffect(() => {
    const slab = slabRef.current;
    if (!slab || REDUCED) return;

    let idle = gsap.to(slab, {
      rotateY: 5, rotateX: -3, duration: 3.4,
      yoyo: true, repeat: -1, ease: 'sine.inOut',
    });

    const setRX = gsap.quickTo(slab, 'rotateX', { duration: 0.5, ease: 'power3' });
    const setRY = gsap.quickTo(slab, 'rotateY', { duration: 0.5, ease: 'power3' });

    function onMove(e) {
      const pt = e.touches ? e.touches[0] : e;
      const r = stageRef.current.getBoundingClientRect();
      const nx = (pt.clientX - r.left) / r.width - 0.5;
      const ny = (pt.clientY - r.top) / r.height - 0.5;
      idle && idle.pause();
      setRY(nx * 22);
      setRX(ny * -16);
      if (foilRef.current) {
        gsap.to(foilRef.current, { backgroundPosition: `${50 + nx * 80}% ${50 + ny * 80}%`, duration: 0.4, overwrite: 'auto' });
      }
    }
    function onLeave() {
      gsap.to(slab, { rotateX: 0, rotateY: 0, duration: 0.9, ease: 'elastic.out(1,0.6)' });
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

  async function saveAsPng() {
    setSaving(true);
    try {
      // dynamic import keeps bundle lighter for users who never save
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(slabRef.current, {
        backgroundColor: '#0c0c12',
        scale: 2, // retina-quality
        useCORS: true,
        logging: false,
        // reset any 3D transform so the capture is face-on
        onclone: (_doc, el) => {
          el.style.transform = 'none';
        },
      });
      const link = document.createElement('a');
      link.download = 'psa-sucks-slab.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error('Slab save failed:', err);
    }
    setSaving(false);
  }

  const badgeColor = badgeCls === 'badge-good' ? 'var(--good)'
    : badgeCls === 'badge-bad' ? 'var(--bad)'
    : badgeCls === 'badge-warn' ? 'var(--warn)'
    : 'var(--muted)';

  return (
    <div className="result-slab-wrap">
      <div className="slab-stage" ref={stageRef}>
        <div className="slab result-slab" ref={slabRef}>
          {/* Label bar */}
          <div className="slab-label">
            <div>
              <div className="sl-brand">PSA-SUCKS.COM</div>
              <div className="sl-cert">{certLine || 'AI Graded · 2026'}</div>
            </div>
            <div className="sl-grade">
              <div className="g-num" style={gradeLine && gradeLine.length > 10 ? { fontSize: 14 } : {}}>{gradeLine || '—'}</div>
              <div className="g-lbl">{gradeLabel || 'Grade'}</div>
            </div>
          </div>

          {/* Card window */}
          <div className="slab-card result-slab-card">
            <div className="foil" ref={foilRef} />
            <div className="foil-grain" />
            {imgSrc && (
              <img
                className="rs-card-img"
                src={imgSrc}
                alt="Your graded card"
                draggable="false"
                onPointerDown={onImgPointerDown}
                onPointerMove={onImgPointerMove}
                onPointerUp={onImgPointerUp}
                style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})` }}
              />
            )}
            {!imgSrc && (
              <div className="rs-card-placeholder">
                <span>Your card</span>
              </div>
            )}

            {/* Badge overlay */}
            <div className="rs-badge" style={{ '--badge-color': badgeColor }}>
              <span className={`ai-section-badge ${badgeCls || 'badge-neutral'}`} style={{ fontSize: 13, padding: '6px 14px' }}>
                {badgeText || 'See report'}
              </span>
            </div>
          </div>

          {/* Bottom sub-line */}
          {subLine && (
            <div className="rs-sub">{subLine}</div>
          )}
        </div>
        <div className="slab-shadow" />
      </div>

      <div className="rs-actions">
        {imgSrc && (
          <div className="rs-adjust">
            <span className="rs-adjust-label">Drag the card to center it · zoom</span>
            <div className="rs-zoom-row">
              <input
                className="rs-zoom"
                type="range" min="1" max="3" step="0.02"
                value={zoom}
                onChange={e => setZoom(parseFloat(e.target.value))}
                aria-label="Zoom card"
              />
              <button className="rs-reset" onClick={() => { setZoom(1); setOffset({ x: 0, y: 0 }); }}>Reset</button>
            </div>
          </div>
        )}
        <button className="btn-primary rs-save" onClick={saveAsPng} disabled={saving}>
          {saving ? 'Saving…' : 'Save slab as PNG'}
        </button>
        <span className="rs-hint">Share your grade on Discord, X, or Instagram</span>
      </div>
    </div>
  );
}
