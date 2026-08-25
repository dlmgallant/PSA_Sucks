// Badge + verdict + tier logic, regexes ported verbatim from psa-sucks.com V8.

// ---- Pre-Grade ----
export const GRADE_SECTIONS = [
  { key: 'centering', title: 'Centering', patterns: [/1\.\s*\**CENTERING/i] },
  { key: 'surface', title: 'Surface Condition', patterns: [/2\.\s*\**SURFACE/i] },
  { key: 'edges', title: 'Edges', patterns: [/3\.\s*\**EDGES/i] },
  { key: 'corners', title: 'Corners', patterns: [/4\.\s*\**CORNERS/i] },
  { key: 'grade', title: 'Grade Estimate', patterns: [/5\.\s*\**OVERALL/i] },
  { key: 'submit', title: 'Submit Recommendation', patterns: [/6\.\s*\**SUBMIT/i] },
];

export function gradeBadge(key, content) {
  if (key === 'submit') {
    if (/yes|definitely|recommend|worth/i.test(content)) return { cls: 'badge-good', label: '✓ Submit' };
    if (/\bno\b|don't|skip|not worth/i.test(content)) return { cls: 'badge-bad', label: '✗ Skip' };
    return { cls: 'badge-warn', label: '⚠ Maybe' };
  }
  if (key === 'grade') {
    const psa = content.match(/PSA[:\s]*([0-9]+(?:\s*[-–]\s*[0-9]+)?)/i);
    if (psa) return { cls: 'badge-warn', label: 'PSA ' + psa[1].trim() };
    return { cls: 'badge-neutral', label: 'See notes' };
  }
  if (key === 'centering') {
    const ratio = content.match(/([4-6][0-9])\s*\/\s*([4-6][0-9])/);
    if (ratio) return { cls: 'badge-neutral', label: ratio[0] };
  }
  const clearlyBad = /\b(significant\s+scratch|major\s+|heavy\s+wear|severe|crease|damage(?!d\s+area)|scuff|whitening|chipping|fray|blunt\s+corner)/i;
  const clearlyGood = /no\s+(visible|noticeable|sign|significant|evidence)|clean|sharp|perfect|excellent|minimal|great|strong|smooth|well.centered|balanced|pack.fresh/i;
  const mixed = /slight|minor|faint|mild|marginally/i;
  if (clearlyGood.test(content)) return { cls: 'badge-good', label: 'Clean' };
  if (clearlyBad.test(content)) return { cls: 'badge-bad', label: 'Issues found' };
  if (mixed.test(content)) return { cls: 'badge-warn', label: 'Minor notes' };
  return { cls: 'badge-neutral', label: 'See notes' };
}

export function extractGrades(content) {
  const psa = content.match(/PSA[:\s]*([0-9]+(?:\s*[-–]\s*[0-9]+)?)/i);
  const bgs = content.match(/BGS[:\s]*([0-9]+(?:\.[0-9]+)?(?:\s*[-–]\s*[0-9]+(?:\.[0-9]+)?)?)/i);
  const cgc = content.match(/CGC[:\s]*([0-9]+(?:\.[0-9]+)?(?:\s*[-–]\s*[0-9]+(?:\.[0-9]+)?)?)/i);
  return { psa: psa ? psa[1].trim() : null, bgs: bgs ? bgs[1].trim() : null, cgc: cgc ? cgc[1].trim() : null };
}

// ---- Fake Detector ----
export const AUTH_SECTIONS = [
  { key: 'photo', title: 'Photo Quality', patterns: [/1\.\s*\**PHOTO/i] },
  { key: 'cardtype', title: 'Card Type', patterns: [/2\.\s*\**CARD\s*TYPE/i] },
  { key: 'print', title: 'Print & Color', patterns: [/3\.\s*\**PRINT/i] },
  { key: 'font', title: 'Font & Text', patterns: [/4\.\s*\**FONT/i] },
  { key: 'foil', title: 'Foil & Texture', patterns: [/5\.\s*\**FOIL/i] },
  { key: 'verdict', title: 'Verdict', patterns: [/6\.\s*\**VERDICT/i] },
];

export function parseVerdict(content) {
  const m = content.match(/(?:^|\n)\s*[-–]?\s*\**VERDICT\**\s*:\s*(Genuine|Suspicious|Likely Fake)\s*[—\-–]\s*CONFIDENCE\s*:\s*([0-9]+)\s*%/im);
  if (!m) return null;
  return { verdict: m[1], confidence: parseInt(m[2], 10) };
}

export function authBadge(key, content) {
  if (key === 'verdict') {
    const v = parseVerdict(content);
    if (!v) return { cls: 'badge-neutral', label: 'See notes' };
    if (v.verdict === 'Genuine') return { cls: 'badge-good', label: '✓ Genuine' };
    if (v.verdict === 'Likely Fake') return { cls: 'badge-bad', label: '✗ Likely Fake' };
    return { cls: 'badge-warn', label: '⚠ Suspicious' };
  }
  const clearlyBad = /significant|major|heavy|severe|crease|damage|counterfeit|fake|incorrect|wrong|mismatch/i;
  const clearlyGood = /excellent|clean|sharp|perfect|no\s+(visible|sign)|minimal|great|strong|correct|accurate|consistent|genuine/i;
  const mixed = /slight|minor|faint|mild|uncertain|slightly\s+off|marginally/i;
  if (clearlyBad.test(content)) return { cls: 'badge-warn', label: 'Worth noting' };
  if (mixed.test(content)) return { cls: 'badge-neutral', label: 'Minor notes' };
  if (clearlyGood.test(content)) return { cls: 'badge-good', label: 'Looks good' };
  return { cls: 'badge-neutral', label: 'See notes' };
}

// ---- Condition Guide ----
export const COND_SECTIONS = [
  { key: 'centering', title: 'Centering', patterns: [/1\.\s*\**CENTERING/i] },
  { key: 'surface', title: 'Surface', patterns: [/2\.\s*\**SURFACE/i] },
  { key: 'edges', title: 'Edges', patterns: [/3\.\s*\**EDGES/i] },
  { key: 'corners', title: 'Corners', patterns: [/4\.\s*\**CORNERS/i] },
  { key: 'overall', title: 'Overall Condition', patterns: [/5\.\s*\**OVERALL/i] },
];

export const TIER_MAP = {
  'Mint': { cls: 'mint', sub: 'Essentially perfect' },
  'Near Mint': { cls: 'near-mint', sub: 'Very minor imperfections only' },
  'Lightly Played': { cls: 'lightly-played', sub: 'Small signs of handling' },
  'Moderately Played': { cls: 'moderately-played', sub: 'Noticeable wear present' },
  'Heavily Played': { cls: 'heavily-played', sub: 'Significant wear or damage' },
};

export function parseTier(content) {
  const m = content.match(/TIER\s*:\s*(Mint|Near Mint|Lightly Played|Moderately Played|Heavily Played)/i);
  return m ? m[1] : null;
export function condBadge(key, content) {
  if (key === 'overall') {
    const t = parseTier(content);
    if (!t) return { cls: 'badge-neutral', label: 'See notes' };
    if (t === 'Mint' || t === 'Near Mint') return { cls: 'badge-good', label: t };
    if (t === 'Lightly Played') return { cls: 'badge-warn', label: t };
    return { cls: 'badge-bad', label: t };
  }

  // Drop negated clauses so "no noticeable scratches" can't read as damage
  const cleaned = content.replace(
    /\b(?:no|not|without|don'?t\s+see|can'?t\s+spot|free\s+of|nothing)\b[^.;]*/gi,
    ''
  );

  if (key === 'centering') {
    const offBad = /noticeably|significantly|heavily|very\s+off|poor|badly/i;
    const offWarn = /slightly|marginally|a\s+bit|not\s+perfect|noticeable/i;
    const centered = /well.centered|nicely\s+(aligned|centered)|even|balanced|perfectly|looks\s+good/i;
    if (centered.test(cleaned) && !offBad.test(cleaned)) return { cls: 'badge-good', label: 'Well centered' };
    if (offBad.test(cleaned)) return { cls: 'badge-bad', label: 'Off center' };
    if (offWarn.test(cleaned)) return { cls: 'badge-warn', label: 'Slightly off' };
    return { cls: 'badge-neutral', label: 'See notes' };
  }

  const DAMAGE = String.raw`scratch(?:es)?|whitening|chip(?:ping|ped)?|fray(?:ing|ed)?|crease|fold|bend|scuff|wear|mark(?:s)?|white\s+spot(?:s)?|rounded\s+corner`;
  const QUAL   = String.raw`slight(?:ly)?|minor|faint|mild|light|small|subtle|barely|a\s+bit|very\s+little`;
  const SEVERE = /significant|major|heavy|severe|deep|obvious|pronounced|extensive|crease|fold|bend|rounded\s+corner/i;

  const unqualified = new RegExp(String.raw`(?<!(?:${QUAL})\s+)(?:${DAMAGE})`, 'i');
  const qualified   = new RegExp(String.raw`(?:${QUAL})\s+(?:${DAMAGE})`, 'i');
  const good        = /clean|sharp|perfect|excellent|minimal|smooth|intact|crisp|vibrant/i;

  if (SEVERE.test(cleaned))      return { cls: 'badge-bad',  label: 'Wear present' };
  if (qualified.test(cleaned))   return { cls: 'badge-warn', label: 'Minor wear' };
  if (unqualified.test(cleaned)) return { cls: 'badge-warn', label: 'Minor wear' };
  if (good.test(cleaned))        return { cls: 'badge-good', label: 'Clean' };
  return { cls: 'badge-neutral', label: 'See notes' };
}
