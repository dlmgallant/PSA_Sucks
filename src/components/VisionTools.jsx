import { useState, useRef } from 'react';
import { runVisionTool, splitSections, mdLite, toParas, downloadText } from '../lib/vision.js';
import {
  GRADE_SECTIONS, gradeBadge, extractGrades,
  AUTH_SECTIONS, authBadge, parseVerdict,
  COND_SECTIONS, condBadge, parseTier, TIER_MAP,
} from '../lib/parsers.js';
import { AI_PROMPT, AUTH_PROMPT, COND_PROMPT } from '../lib/prompts.js';
import ResultSlab from './ResultSlab.jsx';

function UploadZone({ label, hint, multi, file, onChange }) {
  const inputRef = useRef(null);
  const has = multi ? file && file.length : !!file;
  const name = !has ? null
    : multi ? `${file.length} photo(s)`
    : file.name.length > 18 ? file.name.slice(0, 16) + '…' : file.name;
  return (
    <div className={`upload-zone ${has ? 'has-file' : ''}`}>
      <input ref={inputRef} type="file" accept="image/*" multiple={multi}
        aria-label={label}
        onChange={e => {
          const files = [...e.target.files];
          if (!files.length) return;
          onChange(multi ? files : files[0]);
        }} />
      <span className="lbl">{label}</span>
      <span className="hint">{hint}</span>
      {has && <span className="name">{name}</span>}
    </div>
  );
}

function Section({ title, badge, children }) {
  return (
    <div className="ai-section">
      <div className="ai-section-head">
        <span className="ai-section-title">{title}</span>
        <span className={`ai-section-badge ${badge.cls}`}>{badge.label}</span>
      </div>
      <div className="ai-section-body">{children}</div>
    </div>
  );
}

const EMPTY = { ff: null, fb: null, angled: [] };

function VisionTool({ cert, title, blurb, runLabel, prompt, sections, badgeFn, renderExtra, stripRe, exportName, placeholder, slabConfig }) {
  const [files, setFiles] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('Ready');
  const [dot, setDot] = useState('');
  const [result, setResult] = useState(null); // {raw, sections} | {error} | null

  const hasAny = files.ff || files.fb || files.angled.length;

  async function run() {
    if (!hasAny) { setResult({ error: 'Upload at least one card photo first.' }); return; }
    setBusy(true); setDot('thinking'); setResult(null);
    try {
      const raw = await runVisionTool(prompt, files, setStatus);
      const secs = splitSections(raw, sections);
      setResult({ raw, sections: Object.keys(secs).length >= 2 ? secs : null });
      setDot('live'); setStatus('Done');
    } catch (e) {
      setResult({ error: e.message });
      setDot('err'); setStatus('Error');
    } finally {
      setBusy(false);
    }
  }

  function clear() {
    setFiles(EMPTY); setResult(null); setDot(''); setStatus('Ready');
  }

  return (
    <div className="tool-view">
      <div className="tool-head">
        <div className="th-cert">{cert}</div>
        <h2>{title}</h2>
        <p>{blurb}</p>
      </div>

      <div className="panel">
        <div className="panel-title">Card photos · clear light, no glare beats more megapixels</div>
        <div className="uz-row">
          <UploadZone label="Flat front" hint="straight-on" file={files.ff} onChange={f => setFiles(s => ({ ...s, ff: f }))} />
          <UploadZone label="Flat back" hint="straight-on" file={files.fb} onChange={f => setFiles(s => ({ ...s, fb: f }))} />
          <UploadZone label="Angled" hint="for foil + surface" multi file={files.angled} onChange={f => setFiles(s => ({ ...s, angled: f }))} />
        </div>
      </div>

      <div className="run-bar">
        <button className="btn-run" disabled={busy} onClick={run}>{busy ? 'Working…' : runLabel}</button>
        <button className="btn-sub" onClick={clear}>Clear</button>
        {exportName && result?.raw && (
          <button className="btn-sub" onClick={() => downloadText(exportName, result.raw)}>Export .txt</button>
        )}
        <div className="status"><span className={`dot ${dot}`} />{status}</div>
      </div>

      <div className="panel">
        {!result && !busy && <div className="out placeholder">{placeholder}</div>}
        {busy && <div className="out placeholder"><span className="spinner" />{status}</div>}

        {/* THE SLAB — your card, graded and framed */}
        {result && !result.error && result.sections && slabConfig && (() => {
          const sc = slabConfig(result.sections);
          if (!sc) return null;
          return (
            <ResultSlab
              imageFile={files.ff}
              gradeLine={sc.gradeLine}
              gradeLabel={sc.gradeLabel}
              certLine={sc.certLine}
              badgeCls={sc.badgeCls}
              badgeText={sc.badgeText}
              subLine={sc.subLine}
            />
          );
        })()}

        {result?.error && <div className="out raw">Error: {result.error}</div>}
        {result && !result.error && !result.sections && <div className="out raw">{result.raw}</div>}
        {result?.sections && (
          <div className="ai-sections">
            {sections.map(def => {
              const content = result.sections[def.key];
              if (!content) return null;
              const badge = badgeFn(def.key, content);
              const paras = toParas(mdLite(content, stripRe));
              return (
                <Section key={def.key} title={def.title} badge={badge}>
                  {renderExtra && renderExtra(def.key, content, badge)}
                  <div dangerouslySetInnerHTML={{ __html: paras }} />
                </Section>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---- The three configured tools ---- */

export function PreGrade() {
  return (
    <VisionTool
      cert="GRADE · 001 · FEE $0.00"
      title="AI Pre-Grade"
      blurb="The full workup before you mail anything: centering, surface, edges, corners, grade estimates across PSA, BGS, and CGC — and a straight yes or no on submitting."
      runLabel="Analyze card with AI"
      prompt={AI_PROMPT}
      sections={GRADE_SECTIONS}
      badgeFn={gradeBadge}
      exportName="ai_pregrade_report.txt"
      placeholder="Upload card photos above, then tap Analyze card with AI."
      slabConfig={(secs) => {
        const g = secs.grade ? extractGrades(secs.grade) : {};
        const gradeLine = g.psa ? `PSA ${g.psa}` : g.bgs ? `BGS ${g.bgs}` : g.cgc ? `CGC ${g.cgc}` : null;
        if (!gradeLine) return null;
        const submitBadge = secs.submit ? gradeBadge('submit', secs.submit) : null;
        const centerBadge = secs.centering ? gradeBadge('centering', secs.centering) : null;
        const surfaceBadge = secs.surface ? gradeBadge('surface', secs.surface) : null;
        const subParts = [];
        if (centerBadge) subParts.push('Centering: ' + centerBadge.label);
        if (surfaceBadge) subParts.push('Surface: ' + surfaceBadge.label);
        return {
          gradeLine,
          gradeLabel: 'Grade est.',
          certLine: 'Pre-Grade · 2026',
          badgeCls: submitBadge?.cls || 'badge-neutral',
          badgeText: submitBadge?.label || 'See report',
          subLine: subParts.join(' · ') || null,
        };
      }}
      renderExtra={(key, content) => {
        if (key === 'grade') {
          const g = extractGrades(content);
          if (!g.psa && !g.bgs && !g.cgc) return null;
          return (
            <div className="grade-grid">
              {g.psa && <div className="grade-item"><div className="gi-label">PSA</div><div className="gi-val">{g.psa}</div></div>}
              {g.bgs && <div className="grade-item"><div className="gi-label">BGS</div><div className="gi-val">{g.bgs}</div></div>}
              {g.cgc && <div className="grade-item"><div className="gi-label">CGC</div><div className="gi-val">{g.cgc}</div></div>}
            </div>
          );
        }
        return null;
      }}
    />
  );
}

export function ConditionGuide() {
  return (
    <VisionTool
      cert="GRADE · 002 · FEE $0.00"
      title="Condition Guide"
      blurb="No jargon, no grade numbers — just an honest read on your card's condition in plain language, from Mint to Heavily Played."
      runLabel="Assess condition"
      prompt={COND_PROMPT}
      sections={COND_SECTIONS}
      badgeFn={condBadge}
      stripRe={/TIER\s*:.*$/gim}
      placeholder="Upload card photos above, then tap Assess condition."
      slabConfig={(secs) => {
        const tier = secs.overall ? parseTier(secs.overall) : null;
        if (!tier) return null;
        const t = TIER_MAP[tier];
        const badge = condBadge('overall', secs.overall);
        return {
          gradeLine: tier,
          gradeLabel: 'Condition',
          certLine: 'Condition Guide · 2026',
          badgeCls: badge.cls,
          badgeText: tier,
          subLine: t?.sub || null,
        };
      }}
      renderExtra={(key, content) => {
        if (key !== 'overall') return null;
        const tier = parseTier(content);
        if (!tier || !TIER_MAP[tier]) return null;
        const t = TIER_MAP[tier];
        return (
          <div className={`condition-tier ${t.cls}`}>
            <div>
              <div className="condition-tier-label">{tier}</div>
              <div className="condition-tier-sub">{t.sub}</div>
            </div>
          </div>
        );
      }}
    />
  );
}

export function FakeDetector() {
  return (
    <VisionTool
      cert="GRADE · 003 · FEE $0.00"
      title="Fake Detector"
      blurb="Print quality, fonts, foil light behavior, back design — checked against how genuine cards are actually made. Verdict with a confidence score. Angled photos are critical for foils."
      runLabel="Check authenticity"
      prompt={AUTH_PROMPT}
      sections={AUTH_SECTIONS}
      badgeFn={authBadge}
      stripRe={/VERDICT\s*:.*CONFIDENCE\s*:.*%/gi}
      placeholder="Upload card photos above, then tap Check authenticity."
      slabConfig={(secs) => {
        const v = secs.verdict ? parseVerdict(secs.verdict) : null;
        if (!v) return null;
        const cls = v.verdict === 'Genuine' ? 'badge-good' : v.verdict === 'Likely Fake' ? 'badge-bad' : 'badge-warn';
        return {
          gradeLine: `${v.confidence}%`,
          gradeLabel: 'Confidence',
          certLine: 'Authenticity Check · 2026',
          badgeCls: cls,
          badgeText: v.verdict === 'Genuine' ? '✓ Genuine' : v.verdict === 'Likely Fake' ? '✗ Likely Fake' : '⚠ Suspicious',
          subLine: `Verdict: ${v.verdict} · Confidence: ${v.confidence}%`,
        };
      }}
      renderExtra={(key, content) => {
        if (key !== 'verdict') return null;
        const v = parseVerdict(content);
        if (!v) return null;
        const cls = v.verdict === 'Genuine' ? 'genuine' : v.verdict === 'Likely Fake' ? 'fake' : 'suspicious';
        const sub = v.verdict === 'Genuine' ? 'No signs of counterfeiting detected'
          : v.verdict === 'Likely Fake' ? 'Signs of counterfeit detected'
          : 'Requires closer inspection';
        return (
          <div className={`auth-verdict ${cls}`}>
            <div className="auth-verdict-info">
              <div className="auth-verdict-label">{v.verdict}</div>
              <div className="auth-verdict-sub">{sub}</div>
              <div className="conf-bar-wrap"><div className="conf-bar" style={{ width: v.confidence + '%' }} /></div>
            </div>
            <div className="auth-confidence">
              <div className="conf-num">{v.confidence}%</div>
              <div className="conf-label">Confidence</div>
            </div>
          </div>
        );
      }}
    />
  );
}
