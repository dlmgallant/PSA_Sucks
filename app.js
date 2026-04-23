const canvas = document.getElementById('cardCanvas');
const ctx = canvas.getContext('2d');
const canvasWrap = document.getElementById('canvasWrap');
const statusText = document.getElementById('statusText');
const measurementsEl = document.getElementById('measurements');

const STORAGE_KEY = 'pokemon_centering_mobile_settings_v1';

const defaultSettings = {
  gridColor: '#aeb4be',
  gridOpacity: 0.18,
  majorGrid: 24,
  minorDivisions: 4,
  anchorSize: 7,
  boundaryColor: '#00d1ff',
  dimOutside: true,
  showMajorGrid: true,
  showMinorGrid: true,
  snapGrid: false,
};

const state = {
  activeSide: 'front',
  selectedShape: 'outer',
  microStep: false,
  showGrid: true,
  highContrast: false,
  settings: loadSettings(),
  sides: {
    front: makeSideState(),
    back: makeSideState(),
  },
  drag: null,
  pan: null,
  pinch: null,
};

function makeSideState() {
  return {
    img: null,
    imgName: '',
    imgDataURL: null,
    rotation: 0,
    view: { scale: 1, offsetX: 0, offsetY: 0 },
    outer: null,
    inner: null,
    lastMeasurement: null,
  };
}

function active() { return state.sides[state.activeSide]; }

function loadSettings() {
  try {
    return { ...defaultSettings, ...(JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}) };
  } catch {
    return { ...defaultSettings };
  }
}
function saveSettings() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.settings));
}

function setCanvasSize() {
  const rect = canvasWrap.getBoundingClientRect();
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  canvas.style.width = rect.width + 'px';
  canvas.style.height = rect.height + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  draw();
}
window.addEventListener('resize', setCanvasSize);

function imageBounds(side = active()) {
  if (!side.img) return null;
  return {
    x: side.view.offsetX,
    y: side.view.offsetY,
    w: side.img.width * side.view.scale,
    h: side.img.height * side.view.scale,
  };
}

function fitImage(side = active()) {
  if (!side.img) return;
  const rect = canvasWrap.getBoundingClientRect();
  const pad = 14;
  const scale = Math.min((rect.width - pad * 2) / side.img.width, (rect.height - pad * 2) / side.img.height);
  side.view.scale = Math.max(0.05, scale);
  side.view.offsetX = (rect.width - side.img.width * side.view.scale) / 2;
  side.view.offsetY = (rect.height - side.img.height * side.view.scale) / 2;
  initializeBoxes(side);
  draw();
}

function initializeBoxes(side = active()) {
  if (!side.img) return;
  const m = 0.02;
  const ix = 0.12;
  const iy = 0.11;
  side.outer = [
    { x: side.img.width * m, y: side.img.height * m },
    { x: side.img.width * (1 - m), y: side.img.height * m },
    { x: side.img.width * (1 - m), y: side.img.height * (1 - m) },
    { x: side.img.width * m, y: side.img.height * (1 - m) },
  ];
  side.inner = [
    { x: side.img.width * ix, y: side.img.height * iy },
    { x: side.img.width * (1 - ix), y: side.img.height * iy },
    { x: side.img.width * (1 - ix), y: side.img.height * (1 - iy) },
    { x: side.img.width * ix, y: side.img.height * (1 - iy) },
  ];
}

function draw() {
  const rect = canvasWrap.getBoundingClientRect();
  ctx.clearRect(0, 0, rect.width, rect.height);
  ctx.fillStyle = '#0c0f14';
  ctx.fillRect(0, 0, rect.width, rect.height);

  const side = active();
  if (!side.img) {
    drawEmptyState(rect);
    return;
  }

  const b = imageBounds(side);
  if (state.settings.dimOutside) drawDimOutside(rect, b);
  drawImage(side);
  if (state.showGrid) drawGrid(b, side.view.scale);
  drawBoundary(b);
  drawShape(side.outer, '#ff5f6d', state.selectedShape === 'outer');
  drawShape(side.inner, '#59a8ff', state.selectedShape === 'inner');
}

function drawEmptyState(rect) {
  ctx.fillStyle = '#cad0db';
  ctx.font = '15px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Load a front or back scan', rect.width / 2, rect.height / 2 - 8);
  ctx.fillStyle = '#8b95a5';
  ctx.font = '13px sans-serif';
  ctx.fillText('Use the buttons below to import an image', rect.width / 2, rect.height / 2 + 18);
}

function drawDimOutside(rect, b) {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.42)';
  ctx.beginPath();
  ctx.rect(0, 0, rect.width, rect.height);
  ctx.rect(b.x, b.y, b.w, b.h);
  ctx.fill('evenodd');
  ctx.restore();
}

function drawImage(side) {
  ctx.save();
  if (state.highContrast) {
    ctx.filter = 'contrast(1.3) saturate(0.95)';
  }
  ctx.drawImage(side.img, side.view.offsetX, side.view.offsetY, side.img.width * side.view.scale, side.img.height * side.view.scale);
  ctx.restore();
}

function hexToRgb(hex) {
  const s = hex.replace('#', '');
  const n = parseInt(s, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function drawGrid(bounds, scale) {
  const rgb = hexToRgb(state.settings.gridColor);
  const major = state.settings.majorGrid * scale;
  const minor = major / Math.max(1, state.settings.minorDivisions);

  if (state.settings.showMinorGrid && minor >= 4) {
    ctx.save();
    ctx.strokeStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},${Math.max(0.01, state.settings.gridOpacity * 0.45)})`;
    ctx.lineWidth = 1;
    for (let x = bounds.x; x <= bounds.x + bounds.w + 0.5; x += minor) {
      ctx.beginPath(); ctx.moveTo(x, bounds.y); ctx.lineTo(x, bounds.y + bounds.h); ctx.stroke();
    }
    for (let y = bounds.y; y <= bounds.y + bounds.h + 0.5; y += minor) {
      ctx.beginPath(); ctx.moveTo(bounds.x, y); ctx.lineTo(bounds.x + bounds.w, y); ctx.stroke();
    }
    ctx.restore();
  }

  if (state.settings.showMajorGrid) {
    ctx.save();
    ctx.strokeStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},${state.settings.gridOpacity})`;
    ctx.lineWidth = 1;
    for (let x = bounds.x; x <= bounds.x + bounds.w + 0.5; x += major) {
      ctx.beginPath(); ctx.moveTo(x, bounds.y); ctx.lineTo(x, bounds.y + bounds.h); ctx.stroke();
    }
    for (let y = bounds.y; y <= bounds.y + bounds.h + 0.5; y += major) {
      ctx.beginPath(); ctx.moveTo(bounds.x, y); ctx.lineTo(bounds.x + bounds.w, y); ctx.stroke();
    }
    ctx.restore();
  }
}

function drawBoundary(b) {
  ctx.save();
  ctx.strokeStyle = state.settings.boundaryColor;
  ctx.lineWidth = 1.2;
  ctx.strokeRect(b.x + 0.5, b.y + 0.5, b.w, b.h);
  ctx.restore();
}

function drawShape(points, color, selected) {
  if (!points) return;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = selected ? 2 : 1.5;
  ctx.beginPath();
  const p0 = imageToScreen(points[0]);
  ctx.moveTo(p0.x, p0.y);
  for (let i = 1; i < points.length; i++) {
    const p = imageToScreen(points[i]);
    ctx.lineTo(p.x, p.y);
  }
  ctx.closePath();
  ctx.stroke();

  for (const pt of points) {
    const p = imageToScreen(pt);
    const s = state.settings.anchorSize;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(p.x - s, p.y); ctx.lineTo(p.x + s, p.y);
    ctx.moveTo(p.x, p.y - s); ctx.lineTo(p.x, p.y + s);
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.fillRect(p.x - 1, p.y - 1, 2, 2);
  }
  ctx.restore();
}

function imageToScreen(pt, side = active()) {
  return { x: side.view.offsetX + pt.x * side.view.scale, y: side.view.offsetY + pt.y * side.view.scale };
}
function screenToImage(x, y, side = active()) {
  return { x: (x - side.view.offsetX) / side.view.scale, y: (y - side.view.offsetY) / side.view.scale };
}

function constrainPoint(pt, side, shapeName, index) {
  const imgW = side.img.width;
  const imgH = side.img.height;
  pt.x = clamp(pt.x, 0, imgW);
  pt.y = clamp(pt.y, 0, imgH);

  if (shapeName === 'inner') {
    const out = side.outer;
    pt.x = clamp(pt.x, out[0].x, out[1].x);
    pt.y = clamp(pt.y, out[0].y, out[2].y);
  }

  const shape = side[shapeName];
  const tl = shape[0], tr = shape[1], br = shape[2], bl = shape[3];

  if (index === 0) {
    pt.x = Math.min(pt.x, tr.x - 1, bl.x - 1);
    pt.y = Math.min(pt.y, bl.y - 1, tr.y - 1);
  } else if (index === 1) {
    pt.x = Math.max(pt.x, tl.x + 1, br.x - 1);
    pt.y = Math.min(pt.y, br.y - 1, tl.y - 1 + 999999);
    pt.y = Math.min(pt.y, br.y - 1);
  } else if (index === 2) {
    pt.x = Math.max(pt.x, bl.x + 1, tr.x + 1);
    pt.y = Math.max(pt.y, tr.y + 1, bl.y + 1);
  } else if (index === 3) {
    pt.x = Math.min(pt.x, br.x - 1, tl.x - 1 + 999999);
    pt.x = Math.min(pt.x, br.x - 1);
    pt.y = Math.max(pt.y, tl.y + 1, br.y - 1);
  }

  if (shapeName === 'outer') {
    const inner = side.inner;
    if (index === 0) {
      pt.x = Math.min(pt.x, inner[0].x);
      pt.y = Math.min(pt.y, inner[0].y);
    } else if (index === 1) {
      pt.x = Math.max(pt.x, inner[1].x);
      pt.y = Math.min(pt.y, inner[1].y);
    } else if (index === 2) {
      pt.x = Math.max(pt.x, inner[2].x);
      pt.y = Math.max(pt.y, inner[2].y);
    } else if (index === 3) {
      pt.x = Math.min(pt.x, inner[3].x);
      pt.y = Math.max(pt.y, inner[3].y);
    }
  }

  pt.x = clamp(pt.x, 0, imgW);
  pt.y = clamp(pt.y, 0, imgH);
  return pt;
}

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

function getPointerPos(evt) {
  const rect = canvas.getBoundingClientRect();
  return { x: evt.clientX - rect.left, y: evt.clientY - rect.top };
}

function nearestAnchor(x, y) {
  const side = active();
  const check = (shapeName, points) => {
    for (let i = 0; i < points.length; i++) {
      const p = imageToScreen(points[i], side);
      const dx = p.x - x, dy = p.y - y;
      if (Math.hypot(dx, dy) <= Math.max(14, state.settings.anchorSize + 8)) return { shapeName, index: i };
    }
    return null;
  };
  return check('outer', side.outer) || check('inner', side.inner);
}

canvas.addEventListener('pointerdown', (evt) => {
  if (!active().img) return;
  canvas.setPointerCapture(evt.pointerId);
  const p = getPointerPos(evt);
  const hit = nearestAnchor(p.x, p.y);
  if (hit) {
    state.selectedShape = hit.shapeName;
    syncSelectedButtons();
    state.drag = { pointerId: evt.pointerId, ...hit };
  } else {
    state.pan = { pointerId: evt.pointerId, startX: p.x, startY: p.y, originX: active().view.offsetX, originY: active().view.offsetY };
  }
  draw();
});

canvas.addEventListener('pointermove', (evt) => {
  const side = active();
  if (!side.img) return;
  const p = getPointerPos(evt);
  if (state.drag && state.drag.pointerId === evt.pointerId) {
    const imgPt = screenToImage(p.x, p.y, side);
    const shape = side[state.drag.shapeName];
    shape[state.drag.index] = constrainPoint({ ...imgPt }, side, state.drag.shapeName, state.drag.index);
    normalizeShape(side, state.drag.shapeName);
    draw();
  } else if (state.pan && state.pan.pointerId === evt.pointerId) {
    side.view.offsetX = state.pan.originX + (p.x - state.pan.startX);
    side.view.offsetY = state.pan.originY + (p.y - state.pan.startY);
    draw();
  }
});

function normalizeShape(side, shapeName) {
  const s = side[shapeName];
  const xs = s.map(p => p.x).sort((a,b)=>a-b);
  const ys = s.map(p => p.y).sort((a,b)=>a-b);
  side[shapeName] = [
    { x: xs[0], y: ys[0] },
    { x: xs[3], y: ys[0] },
    { x: xs[3], y: ys[3] },
    { x: xs[0], y: ys[3] },
  ];
  if (shapeName === 'outer') {
    for (let i = 0; i < 4; i++) side.inner[i] = constrainPoint({ ...side.inner[i] }, side, 'inner', i);
    normalizeShapeSimple(side, 'inner');
  }
}

function normalizeShapeSimple(side, shapeName) {
  const s = side[shapeName];
  const xs = s.map(p => p.x).sort((a,b)=>a-b);
  const ys = s.map(p => p.y).sort((a,b)=>a-b);
  side[shapeName] = [
    { x: xs[0], y: ys[0] },
    { x: xs[3], y: ys[0] },
    { x: xs[3], y: ys[3] },
    { x: xs[0], y: ys[3] },
  ];
}

canvas.addEventListener('pointerup', clearPointer);
canvas.addEventListener('pointercancel', clearPointer);
function clearPointer(evt) {
  if (state.drag?.pointerId === evt.pointerId) state.drag = null;
  if (state.pan?.pointerId === evt.pointerId) state.pan = null;
}

canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
canvas.addEventListener('touchend', handleTouchEnd, { passive: false });

function handleTouchStart(evt) {
  if (evt.touches.length === 2 && active().img) {
    evt.preventDefault();
    state.drag = null;
    state.pan = null;
    const [a, b] = [...evt.touches].map(t => touchPos(t));
    state.pinch = {
      startDist: Math.hypot(b.x - a.x, b.y - a.y),
      startScale: active().view.scale,
      center: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
      centerImage: screenToImage((a.x + b.x) / 2, (a.y + b.y) / 2),
    };
  }
}

function handleTouchMove(evt) {
  if (evt.touches.length === 2 && state.pinch && active().img) {
    evt.preventDefault();
    const [a, b] = [...evt.touches].map(t => touchPos(t));
    const dist = Math.hypot(b.x - a.x, b.y - a.y);
    const scale = clamp(state.pinch.startScale * (dist / state.pinch.startDist), 0.05, 25);
    active().view.scale = scale;
    active().view.offsetX = state.pinch.center.x - state.pinch.centerImage.x * scale;
    active().view.offsetY = state.pinch.center.y - state.pinch.centerImage.y * scale;
    draw();
  }
}
function handleTouchEnd(evt) {
  if (evt.touches.length < 2) state.pinch = null;
}
function touchPos(touch) {
  const rect = canvas.getBoundingClientRect();
  return { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
}

canvas.addEventListener('wheel', (evt) => {
  if (!active().img) return;
  evt.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const x = evt.clientX - rect.left, y = evt.clientY - rect.top;
  const side = active();
  const imgPt = screenToImage(x, y, side);

  const zoomStep = 0.03;
  const factor = evt.deltaY < 0 ? (1 + zoomStep) : (1 - zoomStep);

  side.view.scale = clamp(side.view.scale * factor, 0.05, 30);
  side.view.offsetX = x - imgPt.x * side.view.scale;
  side.view.offsetY = y - imgPt.y * side.view.scale;
  draw();
}, { passive: false });

function readImageFile(file, sideName) {
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      const side = state.sides[sideName];
      side.img = img;
      side.imgName = file.name;
      side.imgDataURL = reader.result;
      side.rotation = 0;
      state.activeSide = sideName;
      syncTabs();
      fitImage(side);
      updateStatus(`${capitalize(sideName)} scan loaded: ${file.name}`);
      clearMeasurementsIfNeeded();
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
}

document.getElementById('frontInput').addEventListener('change', e => {
  const file = e.target.files[0]; if (file) readImageFile(file, 'front');
});
document.getElementById('backInput').addEventListener('change', e => {
  const file = e.target.files[0]; if (file) readImageFile(file, 'back');
});

document.querySelectorAll('.tab').forEach(btn => btn.addEventListener('click', () => {
  state.activeSide = btn.dataset.side;
  syncTabs();
  updateStatus(`${capitalize(state.activeSide)} side active.`);
  draw();
  renderMeasurements();
}));

function syncTabs() {
  document.querySelectorAll('.tab').forEach(btn => btn.classList.toggle('active', btn.dataset.side === state.activeSide));
}
function syncSelectedButtons() {
  document.getElementById('selectOuterBtn').classList.toggle('active', state.selectedShape === 'outer');
  document.getElementById('selectInnerBtn').classList.toggle('active', state.selectedShape === 'inner');
}
function updateStatus(msg) { statusText.textContent = msg; }

['selectOuterBtn','selectInnerBtn'].forEach(id => document.getElementById(id).addEventListener('click', () => {
  state.selectedShape = id.includes('Outer') ? 'outer' : 'inner';
  syncSelectedButtons();
  draw();
}));

document.getElementById('fitBtn').addEventListener('click', () => fitImage());
document.getElementById('toggleGridBtn').addEventListener('click', () => { state.showGrid = !state.showGrid; draw(); });
document.getElementById('toggleContrastBtn').addEventListener('click', () => { state.highContrast = !state.highContrast; draw(); });
document.getElementById('microModeBtn').addEventListener('click', () => {
  state.microStep = !state.microStep;
  document.getElementById('microModeBtn').classList.toggle('active', state.microStep);
});

document.querySelectorAll('[data-nudge]').forEach(btn => btn.addEventListener('click', () => nudge(btn.dataset.nudge)));

function nudge(dir) {
  const side = active();
  if (!side.img || !side[state.selectedShape]) return;
  let step = state.microStep ? 0.5 : 1;
  if (state.settings.snapGrid) step = Math.max(step, state.settings.majorGrid / Math.max(1, state.settings.minorDivisions));
  const dx = dir === 'left' ? -step : dir === 'right' ? step : 0;
  const dy = dir === 'up' ? -step : dir === 'down' ? step : 0;
  const shape = side[state.selectedShape].map((p, i) => constrainPoint({ x: p.x + dx, y: p.y + dy }, side, state.selectedShape, i));
  side[state.selectedShape] = shape;
  normalizeShapeSimple(side, state.selectedShape);
  draw();
}

function rotateActive(deg) {
  const side = active();
  if (!side.img || !side.imgDataURL) return;
  const src = new Image();
  src.onload = () => {
    const off = document.createElement('canvas');
    const octx = off.getContext('2d');
    const clockwise = deg > 0;
    off.width = src.height;
    off.height = src.width;
    octx.translate(off.width / 2, off.height / 2);
    octx.rotate((deg * Math.PI) / 180);
    octx.drawImage(src, -src.width / 2, -src.height / 2);
    const rotated = new Image();
    rotated.onload = () => {
      side.img = rotated;
      side.imgDataURL = off.toDataURL('image/png');
      initializeBoxes(side);
      fitImage(side);
      updateStatus(`${capitalize(state.activeSide)} rotated ${clockwise ? 'right' : 'left'}.`);
    };
    rotated.src = off.toDataURL('image/png');
  };
  src.src = side.imgDataURL;
}

document.getElementById('rotateLeftBtn').addEventListener('click', () => rotateActive(-90));
document.getElementById('rotateRightBtn').addEventListener('click', () => rotateActive(90));
document.getElementById('resetOuterBtn').addEventListener('click', () => { initializeBoxes(active()); draw(); });
document.getElementById('resetInnerBtn').addEventListener('click', () => {
  const side = active();
  if (!side.img) return;
  const ix = 0.12, iy = 0.11;
  side.inner = [
    { x: side.img.width * ix, y: side.img.height * iy },
    { x: side.img.width * (1 - ix), y: side.img.height * iy },
    { x: side.img.width * (1 - ix), y: side.img.height * (1 - iy) },
    { x: side.img.width * ix, y: side.img.height * (1 - iy) },
  ];
  draw();
});

document.getElementById('measureBtn').addEventListener('click', measureActive);

document.getElementById('saveSessionBtn').addEventListener('click', saveSessionFile);
document.getElementById('loadSessionInput').addEventListener('change', loadSessionFile);
document.getElementById('exportSummaryBtn').addEventListener('click', exportSummary);

function clearMeasurementsIfNeeded() { renderMeasurements(); }

function measureActive() {
  const side = active();
  if (!side.img || !side.outer || !side.inner) return;
  const left = side.inner[0].x - side.outer[0].x;
  const right = side.outer[1].x - side.inner[1].x;
  const top = side.inner[0].y - side.outer[0].y;
  const bottom = side.outer[2].y - side.inner[2].y;

  const lr = ratioText(left, right);
  const tb = ratioText(top, bottom);
  const gradeHint = gradingHint(left, right, top, bottom);

  side.lastMeasurement = {
    left, right, top, bottom,
    lr, tb, gradeHint,
    timestamp: new Date().toISOString(),
  };
  renderMeasurements();
  updateStatus(`${capitalize(state.activeSide)} measured.`);
}

function ratioText(a, b) {
  const thin = Math.min(a, b), thick = Math.max(a, b);
  const thinPct = thick === 0 ? 0 : (thin / (thin + thick)) * 100;
  const thickPct = 100 - thinPct;
  return `${thinPct.toFixed(1)}/${thickPct.toFixed(1)} (${thin.toFixed(1)}px vs ${thick.toFixed(1)}px)`;
}

function gradingHint(left, right, top, bottom) {
  const lrThin = Math.min(left, right) / Math.max(left + right, 0.0001) * 100;
  const tbThin = Math.min(top, bottom) / Math.max(top + bottom, 0.0001) * 100;
  const worst = Math.min(lrThin, tbThin);
  if (worst >= 45) return 'Strong centering';
  if (worst >= 40) return 'Borderline strong';
  if (worst >= 35) return 'Noticeable off-center';
  return 'Clearly off-center';
}

function renderMeasurements() {
  const side = active();
  if (!side.lastMeasurement) {
    measurementsEl.textContent = 'No measurement yet for this side.';
    return;
  }
  const m = side.lastMeasurement;
  measurementsEl.textContent =
`Left vs Right: ${m.lr}
Top vs Bottom: ${m.tb}
Raw borders: L ${m.left.toFixed(1)} | R ${m.right.toFixed(1)} | T ${m.top.toFixed(1)} | B ${m.bottom.toFixed(1)}
Hint: ${m.gradeHint}`;
}

function saveSessionFile() {
  const payload = {
    version: 1,
    settings: state.settings,
    sides: serializeSides(),
    activeSide: state.activeSide,
  };
  downloadBlob(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }), 'pokemon_centering_session.json');
}

function serializeSides() {
  const out = {};
  for (const [name, side] of Object.entries(state.sides)) {
    out[name] = {
      imgName: side.imgName,
      imgDataURL: side.imgDataURL,
      outer: side.outer,
      inner: side.inner,
      lastMeasurement: side.lastMeasurement,
    };
  }
  return out;
}

function loadSessionFile(evt) {
  const file = evt.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async () => {
    const data = JSON.parse(reader.result);
    if (data.settings) {
      state.settings = { ...defaultSettings, ...data.settings };
      applySettingsToInputs();
      saveSettings();
    }
    if (data.sides) {
      for (const [name, saved] of Object.entries(data.sides)) {
        const target = state.sides[name];
        target.imgName = saved.imgName || '';
        target.outer = saved.outer || null;
        target.inner = saved.inner || null;
        target.lastMeasurement = saved.lastMeasurement || null;
        target.imgDataURL = saved.imgDataURL || null;
        if (saved.imgDataURL) {
          target.img = await loadImage(saved.imgDataURL);
        }
      }
    }
    state.activeSide = data.activeSide || 'front';
    syncTabs();
    if (active().img) fitImage(active()); else draw();
    renderMeasurements();
    updateStatus('Session loaded.');
  };
  reader.readAsText(file);
}

function loadImage(src) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.src = src;
  });
}

function exportSummary() {
  const rows = [['Side','Image','Left(px)','Right(px)','Top(px)','Bottom(px)','LeftRight','TopBottom','Hint']];
  for (const [name, side] of Object.entries(state.sides)) {
    const m = side.lastMeasurement;
    rows.push([
      name,
      side.imgName || '',
      m ? m.left.toFixed(1) : '',
      m ? m.right.toFixed(1) : '',
      m ? m.top.toFixed(1) : '',
      m ? m.bottom.toFixed(1) : '',
      m ? m.lr : '',
      m ? m.tb : '',
      m ? m.gradeHint : '',
    ]);
  }
  const csv = rows.map(r => r.map(csvEscape).join(',')).join('\n');
  downloadBlob(new Blob([csv], { type: 'text/csv' }), 'pokemon_centering_summary.csv');
}

function csvEscape(v) {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

// Settings modal
const settingsBtn = document.getElementById('settingsBtn');
const settingsModal = document.getElementById('settingsModal');
document.getElementById('closeSettingsBtn').addEventListener('click', closeSettings);
settingsBtn.addEventListener('click', openSettings);
settingsModal.addEventListener('click', (e) => { if (e.target === settingsModal) closeSettings(); });

function openSettings() {
  settingsModal.classList.remove('hidden');
  settingsModal.setAttribute('aria-hidden', 'false');
}
function closeSettings() {
  settingsModal.classList.add('hidden');
  settingsModal.setAttribute('aria-hidden', 'true');
}

function bindSetting(id, key, parser = v => v) {
  document.getElementById(id).addEventListener('input', (e) => {
    state.settings[key] = parser(e.target.type === 'checkbox' ? e.target.checked : e.target.value);
    saveSettings();
    draw();
  });
}

bindSetting('gridColorInput', 'gridColor');
bindSetting('gridOpacityInput', 'gridOpacity', Number);
bindSetting('gridMajorInput', 'majorGrid', Number);
bindSetting('gridMinorInput', 'minorDivisions', Number);
bindSetting('anchorSizeInput', 'anchorSize', Number);
bindSetting('boundaryColorInput', 'boundaryColor');
bindSetting('dimOutsideInput', 'dimOutside', Boolean);
bindSetting('showMajorGridInput', 'showMajorGrid', Boolean);
bindSetting('showMinorGridInput', 'showMinorGrid', Boolean);
bindSetting('snapGridInput', 'snapGrid', Boolean);

function applySettingsToInputs() {
  document.getElementById('gridColorInput').value = state.settings.gridColor;
  document.getElementById('gridOpacityInput').value = state.settings.gridOpacity;
  document.getElementById('gridMajorInput').value = state.settings.majorGrid;
  document.getElementById('gridMinorInput').value = state.settings.minorDivisions;
  document.getElementById('anchorSizeInput').value = state.settings.anchorSize;
  document.getElementById('boundaryColorInput').value = state.settings.boundaryColor;
  document.getElementById('dimOutsideInput').checked = state.settings.dimOutside;
  document.getElementById('showMajorGridInput').checked = state.settings.showMajorGrid;
  document.getElementById('showMinorGridInput').checked = state.settings.showMinorGrid;
  document.getElementById('snapGridInput').checked = state.settings.snapGrid;
}

applySettingsToInputs();
syncTabs();
syncSelectedButtons();
setCanvasSize();
renderMeasurements();
