const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

const ui = {
  frontTab: document.getElementById('frontTab'),
  backTab: document.getElementById('backTab'),
  imageLoader: document.getElementById('imageLoader'),
  fitBtn: document.getElementById('fitBtn'),
  rotateLeftBtn: document.getElementById('rotateLeftBtn'),
  rotateRightBtn: document.getElementById('rotateRightBtn'),
  contrastBtn: document.getElementById('contrastBtn'),
  resetGuidesBtn: document.getElementById('resetGuidesBtn'),
  panModeBtn: document.getElementById('panModeBtn'),
  saveSessionBtn: document.getElementById('saveSessionBtn'),
  loadSessionInput: document.getElementById('loadSessionInput'),
  csvBtn: document.getElementById('csvBtn'),
  statusBar: document.getElementById('statusBar'),
  currentSideResult: document.getElementById('currentSideResult'),
  summaryResult: document.getElementById('summaryResult'),
  settingsBtn: document.getElementById('settingsBtn'),
  closeSettingsBtn: document.getElementById('closeSettingsBtn'),
  settingsPanel: document.getElementById('settingsPanel'),
  gridDensity: document.getElementById('gridDensity'),
  majorEvery: document.getElementById('majorEvery'),
  gridOpacity: document.getElementById('gridOpacity'),
  gridColor: document.getElementById('gridColor'),
  anchorSize: document.getElementById('anchorSize'),
  boundaryColor: document.getElementById('boundaryColor'),
  hitPadding: document.getElementById('hitPadding'),
  zoomStep: document.getElementById('zoomStep'),
  dimOutside: document.getElementById('dimOutside'),
  showGrid: document.getElementById('showGrid'),
  highlightHover: document.getElementById('highlightHover'),
  showMagnifier: document.getElementById('showMagnifier'),
};

const defaultSettings = {
  gridDensity: 14,
  majorEvery: 5,
  gridOpacity: 0.12,
  gridColor: '#a7afba',
  anchorSize: 7,
  boundaryColor: '#5fb2ff',
  hitPadding: 16,
  zoomStep: 0.018,
  dimOutside: true,
  showGrid: true,
  highlightHover: true,
  showMagnifier: true,
};

const state = {
  activeSide: 'front',
  settings: loadSettings(),
  contrastBoost: false,
  panMode: false,
  hover: null,
  drag: null,
  pointerDown: false,
  lastPointer: null,
  pinch: null,
  sides: {
    front: makeSide('front'),
    back: makeSide('back'),
  },
};

function makeSide(name) {
  return {
    name,
    img: null,
    imgSrc: null,
    rotation: 0,
    view: { scale: 1, offsetX: 0, offsetY: 0 },
    outer: null,
    inner: null,
  };
}

function active() { return state.sides[state.activeSide]; }
function other() { return state.sides[state.activeSide === 'front' ? 'back' : 'front']; }

function loadSettings() {
  try {
    return { ...defaultSettings, ...JSON.parse(localStorage.getItem('psaSucksV5Settings') || '{}') };
  } catch {
    return { ...defaultSettings };
  }
}
function saveSettings() {
  localStorage.setItem('psaSucksV5Settings', JSON.stringify(state.settings));
}

function syncSettingsUi() {
  for (const [key, val] of Object.entries(state.settings)) {
    const el = ui[key];
    if (!el) continue;
    if (el.type === 'checkbox') el.checked = !!val;
    else el.value = val;
  }
  ui.panModeBtn.setAttribute('aria-pressed', state.panMode ? 'true' : 'false');
  ui.panModeBtn.classList.toggle('active', state.panMode);
}

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.round(rect.width * dpr));
  canvas.height = Math.max(1, Math.round(rect.height * dpr));
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  draw();
}
window.addEventListener('resize', resizeCanvas);

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function lerp(a,b,t){return a+(b-a)*t;}
function colorAlpha(hex, alpha) {
  const n = hex.replace('#','');
  const full = n.length === 3 ? n.split('').map(x=>x+x).join('') : n;
  const r = parseInt(full.slice(0,2),16), g = parseInt(full.slice(2,4),16), b = parseInt(full.slice(4,6),16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function getImageBounds(side) {
  if (!side.img) return null;
  return { x: 0, y: 0, w: side.img.width, h: side.img.height };
}

function resetGuides(side = active()) {
  if (!side.img) return;
  const b = getImageBounds(side);
  const m = Math.round(Math.min(b.w, b.h) * 0.04);
  const innerM = Math.round(Math.min(b.w, b.h) * 0.11);
  side.outer = { x: m, y: m, w: b.w - 2*m, h: b.h - 2*m };
  side.inner = { x: innerM, y: innerM, w: b.w - 2*innerM, h: b.h - 2*innerM };
  fitImage(side);
}

function fitImage(side = active()) {
  if (!side.img) return;
  const rect = canvas.getBoundingClientRect();
  const pad = 24;
  const scale = Math.min((rect.width - pad*2) / side.img.width, (rect.height - pad*2) / side.img.height);
  side.view.scale = clamp(scale, 0.02, 30);
  side.view.offsetX = (rect.width - side.img.width * side.view.scale) / 2;
  side.view.offsetY = (rect.height - side.img.height * side.view.scale) / 2;
  draw();
}

function imageToScreen(x, y, side = active()) {
  return {
    x: side.view.offsetX + x * side.view.scale,
    y: side.view.offsetY + y * side.view.scale,
  };
}
function screenToImage(x, y, side = active()) {
  return {
    x: (x - side.view.offsetX) / side.view.scale,
    y: (y - side.view.offsetY) / side.view.scale,
  };
}

function draw() {
  const side = active();
  const rect = canvas.getBoundingClientRect();
  ctx.clearRect(0, 0, rect.width, rect.height);
  ctx.fillStyle = '#0b0f15';
  ctx.fillRect(0, 0, rect.width, rect.height);

  if (!side.img) {
    drawEmptyState(rect);
    updateResults();
    return;
  }

  drawImageAndBounds(side, rect);
  if (state.settings.showGrid) drawGrid(side, rect);
  drawRect(side.outer, '#ff657f', side, 'outer');
  drawRect(side.inner, '#51a2ff', side, 'inner');
  if (state.drag && state.settings.showMagnifier) drawMagnifier(side);
  updateResults();
}

function drawEmptyState(rect) {
  ctx.fillStyle = '#7f8b99';
  ctx.font = '600 18px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`Load ${state.activeSide} image`, rect.width / 2, rect.height / 2 - 8);
  ctx.font = '14px Inter, sans-serif';
  ctx.fillText('Drag guides once an image is loaded', rect.width / 2, rect.height / 2 + 18);
}

function drawImageAndBounds(side, rect) {
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  if (state.contrastBoost) ctx.filter = 'contrast(1.18) saturate(0.92) brightness(1.03)';
  ctx.drawImage(side.img, side.view.offsetX, side.view.offsetY, side.img.width * side.view.scale, side.img.height * side.view.scale);
  ctx.restore();

  const p = imageToScreen(0,0,side);
  const p2 = imageToScreen(side.img.width, side.img.height, side);
  if (state.settings.dimOutside) {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(0,0,rect.width, p.y);
    ctx.fillRect(0,p.y,p.x,p2.y-p.y);
    ctx.fillRect(p2.x,p.y,rect.width-p2.x,p2.y-p.y);
    ctx.fillRect(0,p2.y,rect.width,rect.height-p2.y);
    ctx.restore();
  }

  ctx.save();
  ctx.strokeStyle = state.settings.boundaryColor;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(p.x, p.y, p2.x-p.x, p2.y-p.y);
  ctx.restore();
}

function drawGrid(side, rect) {
  const density = state.settings.gridDensity;
  const majorEvery = state.settings.majorEvery;
  const p1 = imageToScreen(0,0,side);
  const p2 = imageToScreen(side.img.width, side.img.height, side);
  const minor = density * side.view.scale;
  if (minor < 7) return;

  ctx.save();
  ctx.beginPath();
  ctx.rect(p1.x, p1.y, p2.x-p1.x, p2.y-p1.y);
  ctx.clip();
  for (let i = 0; i <= side.img.width; i += density) {
    const x = p1.x + i * side.view.scale;
    const major = Math.round(i / density) % majorEvery === 0;
    ctx.strokeStyle = colorAlpha(state.settings.gridColor, major ? state.settings.gridOpacity * 1.9 : state.settings.gridOpacity);
    ctx.lineWidth = major ? 1.15 : 0.7;
    ctx.beginPath(); ctx.moveTo(x, p1.y); ctx.lineTo(x, p2.y); ctx.stroke();
  }
  for (let i = 0; i <= side.img.height; i += density) {
    const y = p1.y + i * side.view.scale;
    const major = Math.round(i / density) % majorEvery === 0;
    ctx.strokeStyle = colorAlpha(state.settings.gridColor, major ? state.settings.gridOpacity * 1.9 : state.settings.gridOpacity);
    ctx.lineWidth = major ? 1.15 : 0.7;
    ctx.beginPath(); ctx.moveTo(p1.x, y); ctx.lineTo(p2.x, y); ctx.stroke();
  }
  ctx.restore();
}

function drawRect(r, color, side, kind) {
  if (!r) return;
  const tl = imageToScreen(r.x, r.y, side);
  const br = imageToScreen(r.x+r.w, r.y+r.h, side);
  const hovered = state.settings.highlightHover && state.hover && state.hover.kind === kind;
  ctx.save();
  ctx.strokeStyle = hovered ? '#ffffff' : color;
  ctx.lineWidth = hovered ? 2.8 : 2;
  ctx.strokeRect(tl.x, tl.y, br.x-tl.x, br.y-tl.y);

  const a = state.settings.anchorSize;
  const anchors = [
    {x: tl.x, y: tl.y}, {x: br.x, y: tl.y}, {x: br.x, y: br.y}, {x: tl.x, y: br.y}
  ];
  anchors.forEach((pt, idx) => drawAnchor(pt.x, pt.y, hovered && state.hover?.part===`corner-${idx}`, color, a));

  const mids = [
    {x:(tl.x+br.x)/2, y:tl.y, part:'top'}, {x:br.x, y:(tl.y+br.y)/2, part:'right'},
    {x:(tl.x+br.x)/2, y:br.y, part:'bottom'}, {x:tl.x, y:(tl.y+br.y)/2, part:'left'}
  ];
  mids.forEach(m => {
    ctx.strokeStyle = hovered && state.hover?.part===m.part ? '#ffffff' : color;
    ctx.lineWidth = 1.5;
    const l = a * 0.95;
    ctx.beginPath(); ctx.moveTo(m.x-l, m.y); ctx.lineTo(m.x+l, m.y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(m.x, m.y-l); ctx.lineTo(m.x, m.y+l); ctx.stroke();
  });
  ctx.restore();
}

function drawAnchor(x, y, hovered, color, s) {
  ctx.save();
  ctx.strokeStyle = hovered ? '#ffffff' : color;
  ctx.lineWidth = hovered ? 2.2 : 1.6;
  ctx.beginPath(); ctx.moveTo(x-s, y); ctx.lineTo(x+s, y); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x, y-s); ctx.lineTo(x, y+s); ctx.stroke();
  ctx.restore();
}

function drawMagnifier(side) {
  const pt = state.lastPointer;
  if (!pt) return;
  const radius = 56;
  const zoom = 3;
  const imgPt = screenToImage(pt.x, pt.y, side);
  const sx = imgPt.x - (radius/zoom/side.view.scale);
  const sy = imgPt.y - (radius/zoom/side.view.scale);
  const sw = (radius*2)/(zoom*side.view.scale);
  const sh = (radius*2)/(zoom*side.view.scale);

  const lx = clamp(pt.x + 70, radius + 10, canvas.getBoundingClientRect().width - radius - 10);
  const ly = clamp(pt.y - 70, radius + 10, canvas.getBoundingClientRect().height - radius - 10);

  ctx.save();
  ctx.beginPath(); ctx.arc(lx, ly, radius, 0, Math.PI*2); ctx.clip();
  ctx.drawImage(side.img, sx, sy, sw, sh, lx-radius, ly-radius, radius*2, radius*2);
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(lx-radius, ly); ctx.lineTo(lx+radius, ly); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(lx, ly-radius); ctx.lineTo(lx, ly+radius); ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(lx, ly, radius, 0, Math.PI*2); ctx.stroke();
}

function pointRectDistance(px, py, rx, ry, rw, rh) {
  const dx = Math.max(rx - px, 0, px - (rx + rw));
  const dy = Math.max(ry - py, 0, py - (ry + rh));
  return Math.hypot(dx, dy);
}

function hitTest(screenX, screenY, side = active()) {
  if (!side.img || !side.outer || !side.inner) return null;
  const objects = [
    { kind: 'inner', rect: side.inner, priority: 2 },
    { kind: 'outer', rect: side.outer, priority: 1 },
  ];
  let best = null;
  const hp = state.settings.hitPadding;
  for (const obj of objects) {
    const { x, y } = imageToScreen(obj.rect.x, obj.rect.y, side);
    const { x: x2, y: y2 } = imageToScreen(obj.rect.x + obj.rect.w, obj.rect.y + obj.rect.h, side);
    const left = x, right = x2, top = y, bottom = y2;
    const mx = (left + right) / 2, my = (top + bottom) / 2;
    const corners = [
      { name: 'corner-0', x:left, y:top, cursor:'nwse-resize' },
      { name: 'corner-1', x:right, y:top, cursor:'nesw-resize' },
      { name: 'corner-2', x:right, y:bottom, cursor:'nwse-resize' },
      { name: 'corner-3', x:left, y:bottom, cursor:'nesw-resize' },
    ];
    for (const c of corners) {
      const d = Math.hypot(screenX-c.x, screenY-c.y);
      if (d <= hp) {
        const score = d - obj.priority * 1000;
        if (!best || score < best.score) best = { score, kind: obj.kind, part: c.name, cursor: c.cursor };
      }
    }
    const edges = [
      { name:'left', d: Math.abs(screenX-left), within: screenY >= top-hp && screenY <= bottom+hp, cursor:'ew-resize' },
      { name:'right', d: Math.abs(screenX-right), within: screenY >= top-hp && screenY <= bottom+hp, cursor:'ew-resize' },
      { name:'top', d: Math.abs(screenY-top), within: screenX >= left-hp && screenX <= right+hp, cursor:'ns-resize' },
      { name:'bottom', d: Math.abs(screenY-bottom), within: screenX >= left-hp && screenX <= right+hp, cursor:'ns-resize' },
    ];
    for (const e of edges) {
      if (!e.within || e.d > hp) continue;
      const score = e.d - obj.priority * 1000;
      if (!best || score < best.score) best = { score, kind: obj.kind, part: e.name, cursor: e.cursor };
    }
    if (screenX > left+hp && screenX < right-hp && screenY > top+hp && screenY < bottom-hp) {
      const score = 5000 - obj.priority * 1000;
      if (!best || score < best.score) best = { score, kind: obj.kind, part: 'move', cursor:'move' };
    }
  }
  return best;
}

function setCursor(hit) {
  if (state.panMode) canvas.style.cursor = 'grab';
  else canvas.style.cursor = hit?.cursor || 'default';
}

function onPointerDown(x, y, pointerId=1, isTouch=false) {
  state.pointerDown = true;
  state.lastPointer = {x,y};
  const side = active();
  const hit = state.panMode ? null : hitTest(x, y, side);
  state.hover = hit;
  setCursor(hit);
  if (hit) {
    state.drag = { mode:'guide', ...hit, startX:x, startY:y, pointerId, startRect: structuredClone(side[hit.kind]) };
  } else {
    state.drag = { mode:'pan', startX:x, startY:y, pointerId, startOffsetX: side.view.offsetX, startOffsetY: side.view.offsetY };
  }
  draw();
}

function applyGuideDrag(x, y) {
  const side = active();
  const drag = state.drag;
  const target = structuredClone(drag.startRect);
  const imgStart = screenToImage(drag.startX, drag.startY, side);
  const imgNow = screenToImage(x, y, side);
  const dx = imgNow.x - imgStart.x;
  const dy = imgNow.y - imgStart.y;
  const minSize = 10;

  if (drag.part === 'move') {
    target.x += dx; target.y += dy;
  } else if (drag.part === 'left') {
    target.x += dx; target.w -= dx;
  } else if (drag.part === 'right') {
    target.w += dx;
  } else if (drag.part === 'top') {
    target.y += dy; target.h -= dy;
  } else if (drag.part === 'bottom') {
    target.h += dy;
  } else if (drag.part === 'corner-0') {
    target.x += dx; target.w -= dx; target.y += dy; target.h -= dy;
  } else if (drag.part === 'corner-1') {
    target.w += dx; target.y += dy; target.h -= dy;
  } else if (drag.part === 'corner-2') {
    target.w += dx; target.h += dy;
  } else if (drag.part === 'corner-3') {
    target.x += dx; target.w -= dx; target.h += dy;
  }

  const bounds = drag.kind === 'outer' ? getImageBounds(side) : side.outer;
  if (target.w < minSize) { if (['left','corner-0','corner-3'].includes(drag.part)) target.x -= (minSize-target.w); target.w = minSize; }
  if (target.h < minSize) { if (['top','corner-0','corner-1'].includes(drag.part)) target.y -= (minSize-target.h); target.h = minSize; }

  target.x = clamp(target.x, bounds.x, bounds.x + bounds.w - target.w);
  target.y = clamp(target.y, bounds.y, bounds.y + bounds.h - target.h);
  target.w = clamp(target.w, minSize, bounds.w - (target.x - bounds.x));
  target.h = clamp(target.h, minSize, bounds.h - (target.y - bounds.y));

  if (drag.kind === 'outer') {
    side.outer = target;
    side.inner.x = clamp(side.inner.x, side.outer.x, side.outer.x + side.outer.w - side.inner.w);
    side.inner.y = clamp(side.inner.y, side.outer.y, side.outer.y + side.outer.h - side.inner.h);
    side.inner.w = Math.min(side.inner.w, side.outer.w - (side.inner.x - side.outer.x));
    side.inner.h = Math.min(side.inner.h, side.outer.h - (side.inner.y - side.outer.y));
    side.inner.w = Math.max(side.inner.w, minSize);
    side.inner.h = Math.max(side.inner.h, minSize);
  } else {
    side.inner = target;
  }
}

function onPointerMove(x, y, pointerId=1) {
  state.lastPointer = {x,y};
  if (state.drag && state.drag.pointerId === pointerId) {
    if (state.drag.mode === 'pan') {
      const side = active();
      side.view.offsetX = state.drag.startOffsetX + (x - state.drag.startX);
      side.view.offsetY = state.drag.startOffsetY + (y - state.drag.startY);
    } else if (state.drag.mode === 'guide') {
      applyGuideDrag(x, y);
    }
    draw();
    return;
  }
  state.hover = state.panMode ? null : hitTest(x, y, active());
  setCursor(state.hover);
  draw();
}

function onPointerUp(pointerId=1) {
  if (state.drag && state.drag.pointerId === pointerId) state.drag = null;
  state.pointerDown = false;
  setCursor(state.hover);
  draw();
}

canvas.addEventListener('pointerdown', (e) => {
  canvas.setPointerCapture(e.pointerId);
  onPointerDown(e.offsetX, e.offsetY, e.pointerId, e.pointerType === 'touch');
});
canvas.addEventListener('pointermove', (e) => onPointerMove(e.offsetX, e.offsetY, e.pointerId));
canvas.addEventListener('pointerup', (e) => onPointerUp(e.pointerId));
canvas.addEventListener('pointercancel', (e) => onPointerUp(e.pointerId));

canvas.addEventListener('wheel', (evt) => {
  if (!active().img) return;
  evt.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const x = evt.clientX - rect.left, y = evt.clientY - rect.top;
  const side = active();
  const imgPt = screenToImage(x, y, side);
  const step = state.settings.zoomStep;
  const factor = evt.deltaY < 0 ? (1 + step) : (1 - step);
  side.view.scale = clamp(side.view.scale * factor, 0.05, 30);
  side.view.offsetX = x - imgPt.x * side.view.scale;
  side.view.offsetY = y - imgPt.y * side.view.scale;
  draw();
}, { passive: false });

let touchPoints = new Map();
canvas.addEventListener('pointerdown', e => {
  if (e.pointerType === 'touch') touchPoints.set(e.pointerId, {x:e.offsetX,y:e.offsetY});
});
canvas.addEventListener('pointermove', e => {
  if (e.pointerType !== 'touch') return;
  touchPoints.set(e.pointerId, {x:e.offsetX,y:e.offsetY});
  if (touchPoints.size === 2) {
    const pts = Array.from(touchPoints.values());
    const dist = Math.hypot(pts[0].x-pts[1].x, pts[0].y-pts[1].y);
    const center = {x:(pts[0].x+pts[1].x)/2,y:(pts[0].y+pts[1].y)/2};
    const side = active();
    if (!state.pinch) {
      state.pinch = { dist, scale: side.view.scale, imgPt: screenToImage(center.x, center.y, side), center };
      state.drag = null;
    } else {
      const factor = dist / state.pinch.dist;
      side.view.scale = clamp(state.pinch.scale * factor, 0.05, 30);
      side.view.offsetX = center.x - state.pinch.imgPt.x * side.view.scale;
      side.view.offsetY = center.y - state.pinch.imgPt.y * side.view.scale;
      draw();
    }
  }
});
['pointerup','pointercancel'].forEach(type => canvas.addEventListener(type, e => {
  touchPoints.delete(e.pointerId);
  if (touchPoints.size < 2) state.pinch = null;
}));

function updateResults() {
  const makeHtml = (side) => {
    if (!side.img || !side.outer || !side.inner) return 'No image loaded.';
    const left = side.inner.x - side.outer.x;
    const right = (side.outer.x + side.outer.w) - (side.inner.x + side.inner.w);
    const top = side.inner.y - side.outer.y;
    const bottom = (side.outer.y + side.outer.h) - (side.inner.y + side.inner.h);
    const lrPct = centeringPct(left, right);
    const tbPct = centeringPct(top, bottom);
    return `<div class="result-grid">
      <div>Left / Right</div><div>${left.toFixed(1)} / ${right.toFixed(1)} px (${lrPct})</div>
      <div>Top / Bottom</div><div>${top.toFixed(1)} / ${bottom.toFixed(1)} px (${tbPct})</div>
      <div>Hint</div><div>${gradeHint(lrPct, tbPct)}</div>
    </div>`;
  };
  ui.currentSideResult.innerHTML = makeHtml(active());
  const f = state.sides.front, b = state.sides.back;
  if (!f.img || !b.img) {
    ui.summaryResult.innerHTML = 'Load both sides for a summary.';
  } else {
    ui.summaryResult.innerHTML = `<div class="result-grid">
      <div>Front</div><div>${centeringText(f)}</div>
      <div>Back</div><div>${centeringText(b)}</div>
      <div>Overall</div><div>${overallHint(f,b)}</div>
    </div>`;
  }
  ui.statusBar.textContent = state.drag?.mode === 'guide'
    ? `Dragging ${state.drag.kind} ${state.drag.part}. Guides stay inside image bounds.`
    : state.panMode ? 'Pan mode on. Drag image to move it.' : 'Guide drag has priority. Pan only when you miss the guides or toggle Pan Mode.';
}
function centeringPct(a,b){
  const small = Math.min(a,b), large = Math.max(a,b) || 1;
  const s = (small/(small+large))*100, l = (large/(small+large))*100;
  return `${Math.round(l)}/${Math.round(s)}`;
}
function centeringText(side){
  const left = side.inner.x - side.outer.x;
  const right = (side.outer.x + side.outer.w) - (side.inner.x + side.inner.w);
  const top = side.inner.y - side.outer.y;
  const bottom = (side.outer.y + side.outer.h) - (side.inner.y + side.inner.h);
  return `${centeringPct(left,right)} LR, ${centeringPct(top,bottom)} TB`;
}
function ratioOk(str, target){
  const [a,b] = str.split('/').map(Number);
  return a <= target;
}
function gradeHint(lr, tb){
  const best = ratioOk(lr,55) && ratioOk(tb,55);
  const okay = ratioOk(lr,60) && ratioOk(tb,60);
  return best ? 'Strong centering candidate' : okay ? 'Borderline centering candidate' : 'Weak centering candidate';
}
function overallHint(f,b){
  const frontText = centeringText(f), backText = centeringText(b);
  const strongest = ratioOk(frontText.split(',')[0].trim().split(' ')[0],55) && ratioOk(backText.split(',')[0].trim().split(' ')[0],75);
  return strongest ? 'Looks promising for pre-screening' : 'Use with caution; review manually';
}

function loadImageForSide(file, side = active()) {
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      side.img = img;
      side.imgSrc = reader.result;
      side.rotation = 0;
      resetGuides(side);
      draw();
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
}

function rotateSide(dir) {
  const side = active();
  if (!side.img) return;
  const src = side.img;
  const off = document.createElement('canvas');
  off.width = src.height; off.height = src.width;
  const octx = off.getContext('2d');
  if (dir < 0) {
    octx.translate(0, off.height);
    octx.rotate(-Math.PI / 2);
  } else {
    octx.translate(off.width, 0);
    octx.rotate(Math.PI / 2);
  }
  octx.drawImage(src, 0, 0);
  const img = new Image();
  img.onload = () => { side.img = img; resetGuides(side); draw(); };
  img.src = off.toDataURL('image/png');
}

function saveSession() {
  const payload = {
    settings: state.settings,
    sides: Object.fromEntries(Object.entries(state.sides).map(([name, side]) => [name, {
      imgSrc: side.imgSrc,
      outer: side.outer,
      inner: side.inner,
      rotation: side.rotation,
      view: side.view,
    }]))
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {type:'application/json'});
  downloadBlob(blob, 'psa-sucks-session.json');
}

function loadSession(file) {
  const reader = new FileReader();
  reader.onload = async () => {
    const data = JSON.parse(reader.result);
    if (data.settings) {
      state.settings = { ...defaultSettings, ...data.settings };
      syncSettingsUi(); saveSettings();
    }
    for (const [name, saved] of Object.entries(data.sides || {})) {
      const side = state.sides[name];
      if (!side || !saved.imgSrc) continue;
      await new Promise(resolve => {
        const img = new Image();
        img.onload = () => {
          side.img = img; side.imgSrc = saved.imgSrc; side.outer = saved.outer; side.inner = saved.inner; side.view = saved.view || side.view; resolve();
        };
        img.src = saved.imgSrc;
      });
    }
    draw();
  };
  reader.readAsText(file);
}

function downloadBlob(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

function exportCsv() {
  const rows = [['side','left_px','right_px','top_px','bottom_px','left_right','top_bottom','hint']];
  for (const side of Object.values(state.sides)) {
    if (!side.img || !side.outer || !side.inner) continue;
    const left = side.inner.x - side.outer.x;
    const right = (side.outer.x + side.outer.w) - (side.inner.x + side.inner.w);
    const top = side.inner.y - side.outer.y;
    const bottom = (side.outer.y + side.outer.h) - (side.inner.y + side.inner.h);
    rows.push([side.name, left.toFixed(2), right.toFixed(2), top.toFixed(2), bottom.toFixed(2), centeringPct(left,right), centeringPct(top,bottom), gradeHint(centeringPct(left,right), centeringPct(top,bottom))]);
  }
  const csv = rows.map(r => r.map(v => `"${String(v).replaceAll('"','""')}"`).join(',')).join('\n');
  downloadBlob(new Blob([csv], {type:'text/csv'}), 'psa-sucks-centering.csv');
}

ui.imageLoader.addEventListener('change', e => {
  const file = e.target.files?.[0]; if (file) loadImageForSide(file, active()); e.target.value='';
});
ui.frontTab.addEventListener('click', () => switchSide('front'));
ui.backTab.addEventListener('click', () => switchSide('back'));
function switchSide(name) {
  state.activeSide = name;
  ui.frontTab.classList.toggle('active', name === 'front');
  ui.backTab.classList.toggle('active', name === 'back');
  draw();
}
ui.fitBtn.addEventListener('click', () => fitImage());
ui.rotateLeftBtn.addEventListener('click', () => rotateSide(-1));
ui.rotateRightBtn.addEventListener('click', () => rotateSide(1));
ui.contrastBtn.addEventListener('click', () => { state.contrastBoost = !state.contrastBoost; ui.contrastBtn.classList.toggle('active', state.contrastBoost); draw(); });
ui.resetGuidesBtn.addEventListener('click', () => { resetGuides(); draw(); });
ui.panModeBtn.addEventListener('click', () => { state.panMode = !state.panMode; syncSettingsUi(); draw(); });
ui.saveSessionBtn.addEventListener('click', saveSession);
ui.loadSessionInput.addEventListener('change', e => { const file = e.target.files?.[0]; if (file) loadSession(file); e.target.value=''; });
ui.csvBtn.addEventListener('click', exportCsv);
ui.settingsBtn.addEventListener('click', () => ui.settingsPanel.classList.remove('hidden'));
ui.closeSettingsBtn.addEventListener('click', () => ui.settingsPanel.classList.add('hidden'));

for (const key of Object.keys(defaultSettings)) {
  const el = ui[key];
  if (!el) continue;
  el.addEventListener('input', () => {
    state.settings[key] = el.type === 'checkbox' ? el.checked : (el.type === 'range' ? Number(el.value) : el.value);
    saveSettings();
    draw();
  });
}

window.addEventListener('keydown', (e) => {
  const side = active();
  if (!side.img) return;
  const step = e.shiftKey ? 10 : (e.ctrlKey || e.metaKey ? 0.25 : 1);
  let target = state.hover?.kind || 'inner';
  if (!side[target]) return;
  const rect = side[target];
  if (e.key === 'ArrowLeft') { rect.x -= step; e.preventDefault(); }
  if (e.key === 'ArrowRight') { rect.x += step; e.preventDefault(); }
  if (e.key === 'ArrowUp') { rect.y -= step; e.preventDefault(); }
  if (e.key === 'ArrowDown') { rect.y += step; e.preventDefault(); }
  if (e.key === '0') { fitImage(); e.preventDefault(); }
  if (e.key.toLowerCase() === 'p') { state.panMode = !state.panMode; syncSettingsUi(); e.preventDefault(); }
  if (target === 'outer') {
    rect.x = clamp(rect.x, 0, side.img.width - rect.w);
    rect.y = clamp(rect.y, 0, side.img.height - rect.h);
    side.inner.x = clamp(side.inner.x, rect.x, rect.x + rect.w - side.inner.w);
    side.inner.y = clamp(side.inner.y, rect.y, rect.y + rect.h - side.inner.h);
  } else {
    rect.x = clamp(rect.x, side.outer.x, side.outer.x + side.outer.w - rect.w);
    rect.y = clamp(rect.y, side.outer.y, side.outer.y + side.outer.h - rect.h);
  }
  draw();
});

syncSettingsUi();
resizeCanvas();
updateResults();
