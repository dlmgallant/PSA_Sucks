// Shared pipeline for the three vision tools.
// Behavior ported 1:1 from psa-sucks.com V8: same compression tiers,
// same endpoint, same payload shape, same response parsing.

import { ANALYZE_ENDPOINT } from '../config.js';

export function compressFile(file, quality, maxPx) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => {
      const MAX = maxPx || 1600;
      let w = img.width, h = img.height;
      if (w > MAX) { h = Math.round(h * MAX / w); w = MAX; }
      else if (h > MAX) { w = Math.round(w * MAX / h); h = MAX; }
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      res(c.toDataURL('image/jpeg', quality || 0.85).split(',')[1]);
    };
    img.onerror = rej;
    img.src = URL.createObjectURL(file);
  });
}

// files: { ff: File|null, fb: File|null, angled: File[] }
export async function runVisionTool(prompt, files, onStatus) {
  const totalImgs = (files.ff ? 1 : 0) + (files.fb ? 1 : 0) + (files.angled ? files.angled.length : 0);
  const quality = totalImgs >= 4 ? 0.65 : totalImgs === 3 ? 0.72 : totalImgs === 2 ? 0.82 : 0.92;
  const maxPx = totalImgs >= 4 ? 1200 : totalImgs === 3 ? 1400 : 1600;

  const parts = [{ text: prompt }];
  if (files.ff) {
    onStatus('Processing front…');
    parts.push({ text: 'FLAT FRONT:' }, { inlineData: { mimeType: 'image/jpeg', data: await compressFile(files.ff, quality, maxPx) } });
  }
  if (files.fb) {
    onStatus('Processing back…');
    parts.push({ text: 'FLAT BACK:' }, { inlineData: { mimeType: 'image/jpeg', data: await compressFile(files.fb, quality, maxPx) } });
  }
  if (files.angled && files.angled.length) {
    for (let i = 0; i < files.angled.length; i++) {
      onStatus('Processing angled ' + (i + 1) + '…');
      parts.push({ text: 'ANGLED PHOTO ' + (i + 1) + ':' }, { inlineData: { mimeType: 'image/jpeg', data: await compressFile(files.angled[i], quality, maxPx) } });
    }
  }

  onStatus('Analyzing…');
  const resp = await fetch(ANALYZE_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts }] }),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error?.message || 'HTTP ' + resp.status);
  }
  const data = await resp.json();
  return data.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('\n').trim() || 'No response received.';
}

// Splits AI output into named sections by header patterns.
export function splitSections(text, sectionDefs) {
  const lines = text.split('\n');
  const sections = {};
  let currentKey = null, currentLines = [];
  for (const line of lines) {
    let matched = false;
    for (const def of sectionDefs) {
      if (def.patterns.some(p => p.test(line))) {
        if (currentKey) sections[currentKey] = currentLines.join('\n').trim();
        currentKey = def.key;
        currentLines = [line];
        matched = true;
        break;
      }
    }
    if (!matched && currentKey) currentLines.push(line);
  }
  if (currentKey) sections[currentKey] = currentLines.join('\n').trim();
  return sections;
}

export function mdLite(content, extraStrip) {
  let s = content.split('\n').slice(1).join('\n');
  if (extraStrip) s = s.replace(extraStrip, '');
  return s
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^\s*[-•*]\s*/gm, '• ')
    .trim();
}

export function toParas(cleaned) {
  return cleaned
    .split('\n\n')
    .filter(p => p.trim())
    .map(p => '<p>' + p.replace(/\n/g, '<br>') + '</p>')
    .join('');
}

export function downloadText(name, text) {
  const b = new Blob([text], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(b);
  a.download = name;
  a.click();
}
