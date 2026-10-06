/* FreeKerf — protótipo navegável (HTML/CSS/JS puro, sem build).
 *
 * Seções:
 *   1. estado, utilidades, preferências
 *   2. documento: camadas e objetos (+ exemplo pré-carregado)
 *   3. canvas: vista, desenho, réguas, grade
 *   4. interação: Pointer Events (mouse, caneta, toque), gestos, teclado
 *   5. painéis: camadas, inspetor, paleta, console
 *   6. máquina simulada: conexão, jog, contorno, trabalho, alarmes, recuperação
 *   7. layout, densidade, tema, idioma, boas-vindas
 *
 * Coordenadas: o mundo é em mm com Y para baixo (como o canvas). A interface mostra
 * Y para cima, com origem no canto inferior esquerdo da mesa (convenção GRBL):
 *   Y exibido = altura da mesa − y interno.
 */
'use strict';
(function () {
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const t = (k, v) => FK.t(k, v);
  const root = document.documentElement;
  const Q = new URLSearchParams(location.search);
  const rad = d => d * Math.PI / 180, deg = r => r * 180 / Math.PI;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const pad2 = n => String(n).padStart(2, '0');
  const store = {
    get(k, d) { try { const v = localStorage.getItem('fk.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('fk.' + k, JSON.stringify(v)); } catch (e) { /* modo privado */ } }
  };

  // ================================================================ 1. ESTADO
  const WA = { w: 400, h: 300 };                      // área de trabalho (mm)
  const LAYER_IDS = ['c00', 'c01', 'c02', 'c03', 'c04', 'c05', 'c06', 'c07', 'c08', 'c09', 'c10', 'c11', 't1'];
  const RAPID = 6000;                                // mm/min, deslocamento com laser desligado
  const BURN_RES = 4;                                // px por mm do canvas de queima

  const S = {
    mode: 'design', layout: 'wide',
    densityPref: Q.get('density') || store.get('density', 'auto'), density: 'compact', input: 'mouse',
    theme: Q.get('theme') || store.get('theme', 'dark'), contrast: Q.has('contrast') ? Q.get('contrast') === '1' : store.get('contrast', false),
    units: Q.get('units') || store.get('units', 'mm'),
    tool: 'select', panel: 'object', multi: false, marquee: false, lockRatio: true,
    objects: [], layers: [], sel: new Set(), curLayer: 'c00', nextId: 1,
    view: { scale: 2, ox: 0, oy: 0 }, undo: [], redo: [], dirtyFile: false,
    m: { state: 'offline', x: 0, y: WA.h, port: 'sim', fw: '', step: 10, origin: null, anchor: 4, jobOrigin: 'abs', anim: null, issue: null, laserOn: false },
    job: null, plan: null, frameDash: null
  };
  FK.lang = Q.get('lang') || store.get('lang', 'pt-BR');
  const U = () => (S.units === 'in' ? 25.4 : 1);
  const DEC = () => (S.units === 'in' ? 3 : 2);
  const nf = (n, d) => new Intl.NumberFormat(FK.lang, { minimumFractionDigits: d, maximumFractionDigits: d, useGrouping: false }).format(n);
  const fmtLen = (mm, d) => nf(mm / U(), d == null ? DEC() : d);
  const unitLbl = () => (S.units === 'in' ? t('units.in') : 'mm');
  function fmtTime(s) {
    s = Math.max(0, Math.round(s)); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60;
    return h ? `${h}:${pad2(m)}:${pad2(x)}` : `${m}:${pad2(x)}`;
  }
  /** Lê número com expressão simples e unidade opcional ("10+5", "1in", "2,5 pol"). Retorna em unidade base. */
  function parseNum(str, kind) {
    let s = String(str).trim().toLowerCase().replace(/\s+/g, '');
    let f = kind === 'len' ? U() : 1;
    const m = s.match(/(mm|cm|in|pol|")$/);
    if (m && kind === 'len') { f = { mm: 1, cm: 10, in: 25.4, pol: 25.4, '"': 25.4 }[m[1]]; s = s.slice(0, -m[1].length); }
    s = s.replace(/,/g, '.').replace(/[°%]/g, '');
    if (!/^[-+*/().\d]+$/.test(s)) return NaN;
    try { const v = Function('"use strict";return (' + s + ')')(); return typeof v === 'number' && isFinite(v) ? v * f : NaN; } catch (e) { return NaN; }
  }
  const el = (tag, attrs, kids) => {
    const e = document.createElement(tag);
    for (const k in attrs || {}) {
      const v = attrs[k];
      if (k === 'class') e.className = v; else if (k === 'html') e.innerHTML = v; else if (k === 'text') e.textContent = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (v !== false && v != null) e.setAttribute(k, v === true ? '' : v);
    }
    (kids || []).forEach(c => c != null && e.append(c));
    return e;
  };
  const ico = (n, c) => { const s = document.createElement('span'); s.innerHTML = FK.icon(n, c); return s.firstChild; };

  // cores lidas dos tokens (recarregadas ao trocar tema)
  let C = {};
  function readColors() {
    const cs = getComputedStyle(root), g = n => cs.getPropertyValue('--fk-' + n).trim();
    C = {
      canvas: g('color-surface-canvas'), work: g('color-surface-workarea'), gmin: g('color-grid-minor'), gmaj: g('color-grid-major'),
      rbg: g('color-ruler-bg'), rtx: g('color-ruler-text'), border: g('color-border'), text: g('color-text'), sel: g('color-selection'),
      accent: g('color-accent'), head: g('color-head'), burn: g('color-burn'), alarm: g('color-state-alarm'), s1: g('color-surface-1'),
      handle: parseFloat(g('handle')) || 8, handleHit: parseFloat(g('handle-hit')) || 16, mono: g('font-family-mono'), ui: g('font-family-ui')
    };
    LAYER_IDS.forEach(id => (C[id] = g('color-layer-' + id)));
  }

  // ================================================================ 2. DOCUMENTO
  const MAT = {
    'mat.mdf3cut': { mode: 'line', speed: 300, power: 100, passes: 2, air: true },
    'mat.ply3eng': { mode: 'fill', speed: 3000, power: 45, passes: 1, interval: 0.1, air: true },
    'mat.acr3cut': { mode: 'line', speed: 600, power: 70, passes: 1, air: true },
    'mat.leather': { mode: 'fill', speed: 4000, power: 25, passes: 1, interval: 0.12, air: false },
    'mat.anod': { mode: 'fill', speed: 5000, power: 60, passes: 1, interval: 0.08, air: false }
  };
  const layerById = id => S.layers.find(l => l.id === id);
  function ensureLayer(id, init) {
    let l = layerById(id);
    if (!l) {
      l = Object.assign({ id, mode: id === 't1' ? 'tool' : 'line', speed: 1000, power: 60, passes: 1, interval: 0.1, air: true, output: id !== 't1', show: true, open: false }, init || {});
      S.layers.push(l);
    }
    return l;
  }
  function pruneLayers() { S.layers = S.layers.filter(l => l.id === S.curLayer || S.objects.some(o => o.layer === l.id)); }
  const objById = id => S.objects.find(o => o.id === id);
  function addObj(o) { o.id = S.nextId++; o.rot = o.rot || 0; S.objects.push(o); ensureLayer(o.layer); return o; }
  const selObjs = () => S.objects.filter(o => S.sel.has(o.id));

  // imagens (fora do JSON de desfazer)
  const IMAGES = {};
  function makePhoto() {
    const c = document.createElement('canvas'); c.width = c.height = 180; const g = c.getContext('2d', { willReadFrequently: true });
    let gr = g.createLinearGradient(0, 0, 0, 180); gr.addColorStop(0, '#f4f4f4'); gr.addColorStop(.62, '#8c8c8c'); gr.addColorStop(1, '#3c3c3c');
    g.fillStyle = gr; g.fillRect(0, 0, 180, 180);
    gr = g.createRadialGradient(118, 70, 2, 118, 70, 40); gr.addColorStop(0, '#fff'); gr.addColorStop(.45, '#eee'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(118, 70, 40, 0, 7); g.fill();
    g.fillStyle = '#505050'; g.beginPath(); g.moveTo(0, 120); g.lineTo(40, 78); g.lineTo(70, 104); g.lineTo(105, 64); g.lineTo(150, 112); g.lineTo(180, 92); g.lineTo(180, 180); g.lineTo(0, 180); g.fill();
    g.fillStyle = '#262626'; g.beginPath(); g.moveTo(0, 140); g.lineTo(55, 112); g.lineTo(95, 132); g.lineTo(140, 116); g.lineTo(180, 136); g.lineTo(180, 180); g.lineTo(0, 180); g.fill();
    g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 2; for (let y = 150; y < 178; y += 7) { g.beginPath(); g.moveTo(30 + (y % 3) * 10, y); g.lineTo(150 - (y % 5) * 6, y); g.stroke(); }
    return c;
  }
  function heartPts() {
    const pts = []; let mnx = 1e9, mxx = -1e9, mny = 1e9, mxy = -1e9;
    for (let i = 0; i < 96; i++) {
      const a = i / 96 * Math.PI * 2, x = 16 * Math.pow(Math.sin(a), 3), y = -(13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a));
      pts.push([x, y]); mnx = Math.min(mnx, x); mxx = Math.max(mxx, x); mny = Math.min(mny, y); mxy = Math.max(mxy, y);
    }
    return pts.map(([x, y]) => [(x - mnx) / (mxx - mnx) - .5, (y - mny) / (mxy - mny) - .5]);
  }

  // medição de texto (Inter Bold) — caixa real dos glifos
  const mctx = document.createElement('canvas').getContext('2d');
  const TFONT = '700 100px Inter, system-ui, sans-serif';
  const mcache = {};
  function measure(text) {
    if (mcache[text]) return mcache[text];
    mctx.font = TFONT; const m = mctx.measureText(text || ' ');
    const r = { L: m.actualBoundingBoxLeft, R: m.actualBoundingBoxRight, A: m.actualBoundingBoxAscent, D: m.actualBoundingBoxDescent };
    r.w = Math.max(1, r.L + r.R); r.h = Math.max(1, r.A + r.D);
    return (mcache[text] = r);
  }
  function fitTextBox(o, keep) { const m = measure(o.text); if (keep === 'w') o.h = o.w * m.h / m.w; else o.w = o.h * m.w / m.h; }

  function loadDemo() {
    S.objects = []; S.layers = []; S.nextId = 1;
    ensureLayer('t1');
    ensureLayer('c00', { mode: 'fill', speed: 3000, power: 45, interval: 0.1 });
    ensureLayer('c02', { mode: 'line', speed: 1500, power: 35 });
    ensureLayer('c03', { mode: 'image', speed: 2500, power: 55 });
    ensureLayer('c01', { mode: 'line', speed: 400, power: 100, passes: 2 });
    IMAGES.photo = makePhoto();
    addObj({ type: 'rect', x: 120, y: 112, w: 190, h: 120, rx: 0, layer: 't1' });
    addObj({ type: 'rect', x: 120, y: 112, w: 170, h: 100, rx: 8, layer: 'c01' });
    for (const [dx, dy] of [[-75, -40], [75, -40], [-75, 40], [75, 40]]) addObj({ type: 'ellipse', x: 120 + dx, y: 112 + dy, w: 5, h: 5, layer: 'c01' });
    const a = addObj({ type: 'text', text: 'FreeKerf', x: 120, y: 98, h: 20, layer: 'c00' }); fitTextBox(a);
    const b = addObj({ type: 'text', text: 'oficina livre', x: 120, y: 132, h: 9, layer: 'c00' }); fitTextBox(b);
    addObj({ type: 'ellipse', x: 305, y: 92, w: 84, h: 84, layer: 'c01' });
    addObj({ type: 'path', pts: heartPts(), x: 305, y: 92, w: 44, h: 38, layer: 'c02' });
    addObj({ type: 'image', img: 'photo', x: 305, y: 222, w: 64, h: 64, bright: 0, contrast: 10, dither: 'fs', layer: 'c03' });
    S.curLayer = 'c00'; S.sel.clear(); S.undo = []; S.redo = [];
  }

  // desfazer/refazer: instantâneos do documento
  const snapshotDoc = () => JSON.stringify({ o: S.objects, l: S.layers, n: S.nextId }, (k, v) => (k[0] === '_' ? undefined : v));
  function restoreDoc(json) {
    const d = JSON.parse(json); S.objects = d.o; S.layers = d.l; S.nextId = d.n;
    S.sel = new Set([...S.sel].filter(id => objById(id)));
    selChanged(); changed(true);
  }
  function pushUndo() { S.undo.push(snapshotDoc()); if (S.undo.length > 100) S.undo.shift(); S.redo = []; }
  function undo() { if (!S.undo.length) return; S.redo.push(snapshotDoc()); restoreDoc(S.undo.pop()); }
  function redo() { if (!S.redo.length) return; S.undo.push(snapshotDoc()); restoreDoc(S.redo.pop()); }

  // geometria
  function corners(o) {
    const c = Math.cos(rad(o.rot)), s = Math.sin(rad(o.rot)), hw = o.w / 2, hh = o.h / 2;
    return [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]].map(([x, y]) => [o.x + x * c - y * s, o.y + x * s + y * c]);
  }
  function aabb(list) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    list.forEach(o => corners(o).forEach(([x, y]) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }));
    return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 };
  }
  function selFrame() {
    const L = selObjs(); if (!L.length) return null;
    if (L.length === 1) { const o = L[0]; return { cx: o.x, cy: o.y, w: o.w, h: o.h, rot: o.rot }; }
    const b = aabb(L); return { cx: (b.x0 + b.x1) / 2, cy: (b.y0 + b.y1) / 2, w: b.w, h: b.h, rot: 0 };
  }
  function toLocal(F, x, y) { const c = Math.cos(-rad(F.rot)), s = Math.sin(-rad(F.rot)), dx = x - F.cx, dy = y - F.cy; return [dx * c - dy * s, dx * s + dy * c]; }
  function toWorld(F, x, y) { const c = Math.cos(rad(F.rot)), s = Math.sin(rad(F.rot)); return [F.cx + x * c - y * s, F.cy + x * s + y * c]; }
  const snapSel = () => selObjs().map(o => ({ id: o.id, x: o.x, y: o.y, w: o.w, h: o.h, rot: o.rot }));
  function applyScale(F0, snap, sx, sy, ax, ay) {
    for (const s of snap) {
      const o = objById(s.id); if (!o) continue;
      const [lx, ly] = toLocal(F0, s.x, s.y);
      [o.x, o.y] = toWorld(F0, ax + (lx - ax) * sx, ay + (ly - ay) * sy);
      const rel = ((s.rot - F0.rot) % 180 + 180) % 180, swap = rel > 45 && rel < 135;
      o.w = Math.max(.1, s.w * Math.abs(swap ? sy : sx)); o.h = Math.max(.1, s.h * Math.abs(swap ? sx : sy));
    }
  }
  function applyRotate(F0, snap, da) {
    const c = Math.cos(rad(da)), s = Math.sin(rad(da));
    for (const p of snap) {
      const o = objById(p.id), dx = p.x - F0.cx, dy = p.y - F0.cy;
      o.x = F0.cx + dx * c - dy * s; o.y = F0.cy + dx * s + dy * c; o.rot = ((p.rot + da) % 360 + 540) % 360 - 180;
    }
  }
  /** Contorno do objeto em coordenadas do mundo (para modo Linha). */
  function outline(o) {
    let pts;
    if (o.type === 'ellipse') { pts = []; for (let i = 0; i <= 96; i++) { const a = i / 96 * Math.PI * 2; pts.push([Math.cos(a) * o.w / 2, Math.sin(a) * o.h / 2]); } }
    else if (o.type === 'path') { pts = o.pts.map(([x, y]) => [x * o.w, y * o.h]); pts.push(pts[0]); }
    else {
      const hw = o.w / 2, hh = o.h / 2, r = Math.min(o.rx || 0, hw, hh); pts = [];
      if (r > 0) {
        const cs = [[hw - r, -hh + r, -90], [hw - r, hh - r, 0], [-hw + r, hh - r, 90], [-hw + r, -hh + r, 180]];
        cs.forEach(([cx, cy, a0]) => { for (let i = 0; i <= 6; i++) { const a = rad(a0 + i * 15); pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } });
        pts.push(pts[0]);
      } else pts = [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh], [-hw, -hh]];
    }
    const F = { cx: o.x, cy: o.y, rot: o.rot };
    return pts.map(([x, y]) => toWorld(F, x, y));
  }
  function localPath(o) {
    const p = new Path2D(), hw = o.w / 2, hh = o.h / 2;
    if (o.type === 'ellipse') p.ellipse(0, 0, hw, hh, 0, 0, Math.PI * 2);
    else if (o.type === 'path') { o.pts.forEach(([x, y], i) => (i ? p.lineTo(x * o.w, y * o.h) : p.moveTo(x * o.w, y * o.h))); p.closePath(); }
    else if (o.rx) p.roundRect(-hw, -hh, o.w, o.h, Math.min(o.rx, hw, hh));
    else p.rect(-hw, -hh, o.w, o.h);
    return p;
  }
  function inPoly(pts, x, y) {
    let c = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i], [xj, yj] = pts[j];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
    }
    return c;
  }
  function hitObj(wx, wy, tol) {
    for (let i = S.objects.length - 1; i >= 0; i--) {
      const o = S.objects[i], l = layerById(o.layer); if (l && !l.show) continue;
      const [lx, ly] = toLocal({ cx: o.x, cy: o.y, rot: o.rot }, wx, wy), hw = o.w / 2 + tol, hh = o.h / 2 + tol;
      if (Math.abs(lx) > hw || Math.abs(ly) > hh) continue;
      if (o.type === 'ellipse') { if ((lx * lx) / (hw * hw) + (ly * ly) / (hh * hh) <= 1) return o; continue; }
      if (o.type === 'path') { if (inPoly(o.pts.map(([x, y]) => [x * o.w, y * o.h]), lx, ly) || Math.abs(lx) > o.w / 2 - tol || Math.abs(ly) > o.h / 2 - tol) return o; continue; }
      return o;
    }
    return null;
  }

  // processamento de imagem (brilho/contraste/pontilhado) — também usado no caminho de ferramenta
  function processImage(o, color) {
    const key = [o.bright, o.contrast, o.dither, color].join('|');
    if (o._pc && o._pk === key) return o._pc;
    const src = IMAGES[o.img], w = src.width, h = src.height, g = src.getContext('2d').getImageData(0, 0, w, h).data;
    const gray = new Float32Array(w * h), cf = (259 * (o.contrast + 255)) / (255 * (259 - o.contrast));
    for (let i = 0; i < w * h; i++) gray[i] = clamp(cf * (g[i * 4] * .3 + g[i * 4 + 1] * .59 + g[i * 4 + 2] * .11 + o.bright * 2.55 - 128) + 128, 0, 255);
    const bits = new Uint8Array(w * h);
    const K = o.dither === 'atk' ? [[1, 0, 1 / 8], [2, 0, 1 / 8], [-1, 1, 1 / 8], [0, 1, 1 / 8], [1, 1, 1 / 8], [0, 2, 1 / 8]]
      : o.dither === 'fs' ? [[1, 0, 7 / 16], [-1, 1, 3 / 16], [0, 1, 5 / 16], [1, 1, 1 / 16]] : [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x, v = gray[i], on = v < 128; bits[i] = on ? 1 : 0;
      const err = v - (on ? 0 : 255);
      for (const [dx, dy, k] of K) { const xx = x + dx, yy = y + dy; if (xx >= 0 && xx < w && yy < h) gray[yy * w + xx] += err * k; }
    }
    const c = document.createElement('canvas'); c.width = w; c.height = h; const cx = c.getContext('2d'), id = cx.createImageData(w, h);
    const tmp = document.createElement('canvas').getContext('2d', { willReadFrequently: true }); tmp.fillStyle = color; tmp.fillRect(0, 0, 1, 1); const [r, gg, b] = tmp.getImageData(0, 0, 1, 1).data;
    for (let i = 0; i < w * h; i++) if (bits[i]) { id.data[i * 4] = r; id.data[i * 4 + 1] = gg; id.data[i * 4 + 2] = b; id.data[i * 4 + 3] = 255; }
    cx.putImageData(id, 0, 0);
    o._pc = c; o._pk = key; return c;
  }

  // ================================================================ 3. CANVAS
  const cv = $('#cv'), ctx = cv.getContext('2d');
  let DPR = 1, CW = 0, CH = 0, needDraw = true, firstFit = true;
  const burnCv = document.createElement('canvas'); burnCv.width = WA.w * BURN_RES; burnCv.height = WA.h * BURN_RES;
  const bctx = burnCv.getContext('2d');
  const dirty = () => { needDraw = true; };
  const RULER = () => parseFloat(getComputedStyle(document.body).getPropertyValue('--ruler')) || 22;
  const w2s = (x, y) => [x * S.view.scale + S.view.ox, y * S.view.scale + S.view.oy];
  const s2w = (x, y) => [(x - S.view.ox) / S.view.scale, (y - S.view.oy) / S.view.scale];

  function resizeCanvas() {
    const r = cv.getBoundingClientRect(); if (!r.width) return;
    const keepCenter = !firstFit && CW ? s2w(CW / 2, CH / 2) : null;
    DPR = window.devicePixelRatio || 1; CW = r.width; CH = r.height;
    cv.width = Math.round(CW * DPR); cv.height = Math.round(CH * DPR);
    if (firstFit) { fit(); firstFit = false; }
    else if (keepCenter) { S.view.ox = CW / 2 - keepCenter[0] * S.view.scale; S.view.oy = CH / 2 - keepCenter[1] * S.view.scale; }
    dirty();
  }
  function fit() {
    const r = RULER(), pad = 18, pal = $('#palette'), bottom = pal.offsetParent ? pal.offsetHeight + 20 : 12;
    const aw = CW - r - pad * 2, ah = CH - r - pad - bottom;
    S.view.scale = clamp(Math.min(aw / WA.w, ah / WA.h), .2, 80);
    S.view.ox = r + pad + (aw - WA.w * S.view.scale) / 2; S.view.oy = r + pad + (ah - WA.h * S.view.scale) / 2;
    dirty();
  }
  function zoomAt(px, py, f) {
    const ns = clamp(S.view.scale * f, .2, 80), [wx, wy] = s2w(px, py);
    S.view.scale = ns; S.view.ox = px - wx * ns; S.view.oy = py - wy * ns; dirty(); updateStatus();
  }
  function niceStep(minPx) {   // passo da grade/régua na unidade atual, em mm
    const u = U(), steps = S.units === 'in' ? [.01, .05, .1, .25, .5, 1, 2, 5, 10] : [.1, .5, 1, 2, 5, 10, 20, 50, 100, 200];
    for (const s of steps) if (s * u * S.view.scale >= minPx) return s * u;
    return steps[steps.length - 1] * u;
  }

  function draw() {
    needDraw = false;
    const g = ctx, sc = S.view.scale, prod = S.mode !== 'design' || S.layout === 'narrow';
    g.setTransform(DPR, 0, 0, DPR, 0, 0);
    g.fillStyle = C.canvas; g.fillRect(0, 0, CW, CH);
    // mesa
    const [ax, ay] = w2s(0, 0);
    g.fillStyle = C.work; g.fillRect(ax, ay, WA.w * sc, WA.h * sc);
    // grade
    const minor = niceStep(9), major = niceStep(60);
    g.save(); g.beginPath(); g.rect(ax, ay, WA.w * sc, WA.h * sc); g.clip();
    for (const [step, col] of [[minor, C.gmin], [major, C.gmaj]]) {
      g.strokeStyle = col; g.lineWidth = 1; g.beginPath();
      for (let x = 0; x <= WA.w + 1e-6; x += step) { const sx = Math.round(ax + x * sc) + .5; g.moveTo(sx, ay); g.lineTo(sx, ay + WA.h * sc); }
      for (let y = 0; y <= WA.h + 1e-6; y += step) { const sy = Math.round(ay + (WA.h - y) * sc) + .5; g.moveTo(ax, sy); g.lineTo(ax + WA.w * sc, sy); }
      g.stroke();
    }
    g.restore();
    g.strokeStyle = C.border; g.lineWidth = 1; g.strokeRect(Math.round(ax) + .5, Math.round(ay) + .5, Math.round(WA.w * sc), Math.round(WA.h * sc));

    // objetos
    for (const o of S.objects) {
      const l = layerById(o.layer); if (l && !l.show) continue;
      const col = C[o.layer] || C.text, mode = l ? l.mode : 'line';
      g.save(); const [cx, cy] = w2s(o.x, o.y); g.translate(cx, cy); g.rotate(rad(o.rot)); g.scale(sc, sc);
      g.globalAlpha = prod ? .55 : 1;
      if (o.type === 'image') {
        g.imageSmoothingEnabled = false; g.drawImage(processImage(o, col), -o.w / 2, -o.h / 2, o.w, o.h);
        g.strokeStyle = col; g.lineWidth = 1 / sc; g.setLineDash([4 / sc, 3 / sc]); g.strokeRect(-o.w / 2, -o.h / 2, o.w, o.h);
      } else if (o.type === 'text') {
        const m = measure(o.text); g.save(); g.scale(o.w / m.w, o.h / m.h); g.font = TFONT; g.textBaseline = 'alphabetic';
        const tx = -m.w / 2 + m.L, ty = m.h / 2 - m.D;
        if (mode === 'line' || mode === 'tool') { g.strokeStyle = col; g.lineWidth = 1.5 / sc * (m.h / o.h); g.strokeText(o.text, tx, ty); }
        else { g.fillStyle = col; g.fillText(o.text, tx, ty); }
        g.restore();
      } else {
        const p = localPath(o);
        if (mode === 'fill') { g.fillStyle = col; g.globalAlpha *= .3; g.fill(p); g.globalAlpha = prod ? .55 : 1; }
        if (mode === 'tool') g.setLineDash([6 / sc, 4 / sc]);
        // tema claro: halo escuro para cores claras (amarelo, céu…) manterem contraste ≥ 3:1 na mesa clara
        if (S.theme === 'light') { g.save(); g.strokeStyle = 'rgba(21,26,32,.45)'; g.lineWidth = 3.2 / sc; g.stroke(p); g.restore(); }
        g.strokeStyle = col; g.lineWidth = (mode === 'tool' ? 1 : 1.6) / sc;
        g.stroke(p);
      }
      g.restore();
    }

    // queima simulada (por cima dos objetos: é o resultado físico)
    g.save(); g.imageSmoothingEnabled = true; g.drawImage(burnCv, ax, ay, WA.w * sc, WA.h * sc); g.restore();

    // contorno do trabalho no modo produção
    if (prod) {
      const jb = jobBox();
      if (jb) { const [x0, y0] = w2s(jb.x0, jb.y0); g.save(); g.strokeStyle = C.accent; g.setLineDash([6, 4]); g.lineWidth = 1.5; g.strokeRect(x0, y0, jb.w * sc, jb.h * sc); g.restore(); }
    }
    if (S.frameDash) { g.save(); g.strokeStyle = C.accent; g.lineWidth = 2; g.setLineDash([8, 5]); g.beginPath(); S.frameDash.forEach(([x, y], i) => { const [sx, sy] = w2s(x, y); i ? g.lineTo(sx, sy) : g.moveTo(sx, sy); }); g.stroke(); g.restore(); }

    // seleção
    if (!prod) drawSelection(g);
    if (drag && drag.type === 'marquee' && drag.moved) {
      const [x0, y0] = w2s(drag.x0, drag.y0), [x1, y1] = w2s(drag.x1, drag.y1), crossing = drag.x1 < drag.x0;
      g.save(); g.fillStyle = C.sel; g.globalAlpha = .08; g.fillRect(x0, y0, x1 - x0, y1 - y0); g.globalAlpha = 1;
      g.strokeStyle = C.sel; g.lineWidth = 1; g.setLineDash(crossing ? [5, 4] : []); g.strokeRect(x0 + .5, y0 + .5, x1 - x0, y1 - y0); g.restore();
    }

    // origem do usuário
    if (S.m.origin) { const [ox, oy] = w2s(S.m.origin[0], S.m.origin[1]); g.save(); g.strokeStyle = C.accent; g.lineWidth = 2; g.beginPath(); g.moveTo(ox - 9, oy); g.lineTo(ox + 9, oy); g.moveTo(ox, oy - 9); g.lineTo(ox, oy + 9); g.stroke(); g.restore(); }

    // trecho em queima (segmento atual) + cabeçote
    if (S.job && S.job.cur && S.job.cur.on && S.m.state === 'run') {
      const s = S.job.cur, [x1, y1] = w2s(s.x1, s.y1), [hx, hy] = w2s(S.m.x, S.m.y);
      g.save(); g.strokeStyle = C.burn; g.lineWidth = Math.max(1, s.bw * sc / BURN_RES); g.beginPath(); g.moveTo(x1, y1); g.lineTo(hx, hy); g.stroke(); g.restore();
    }
    if (S.m.state !== 'offline' && S.m.state !== 'connecting') {
      const [hx, hy] = w2s(S.m.x, S.m.y), on = S.m.laserOn;
      g.save();
      if (on) { const gr = g.createRadialGradient(hx, hy, 0, hx, hy, 18); gr.addColorStop(0, C.accent); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.beginPath(); g.arc(hx, hy, 18, 0, 7); g.fill(); }
      g.strokeStyle = C.head; g.lineWidth = 1.5; g.beginPath(); g.arc(hx, hy, 8, 0, 7); g.moveTo(hx - 14, hy); g.lineTo(hx - 4, hy); g.moveTo(hx + 4, hy); g.lineTo(hx + 14, hy); g.moveTo(hx, hy - 14); g.lineTo(hx, hy - 4); g.moveTo(hx, hy + 4); g.lineTo(hx, hy + 14); g.stroke();
      g.fillStyle = on ? C.accent : C.head; g.beginPath(); g.arc(hx, hy, on ? 3 : 2, 0, 7); g.fill();
      g.restore();
    }
    drawRulers(g);
  }

  function handlePositions(F) {
    const sc = S.view.scale, out = [];
    for (const hx of [-1, 0, 1]) for (const hy of [-1, 0, 1]) {
      if (!hx && !hy) continue;
      const [x, y] = toWorld(F, hx * F.w / 2, hy * F.h / 2); out.push({ hx, hy, p: w2s(x, y) });
    }
    const off = (S.density === 'comfortable' ? 40 : 26) / sc;
    const [rx, ry] = toWorld(F, 0, -F.h / 2 - off); out.push({ rot: true, p: w2s(rx, ry), base: w2s(...toWorld(F, 0, -F.h / 2)) });
    return out;
  }
  function drawSelection(g) {
    const F = selFrame(); if (!F) return;
    const pts = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => w2s(...toWorld(F, a * F.w / 2, b * F.h / 2)));
    g.save(); g.strokeStyle = C.sel; g.lineWidth = 1.25; g.setLineDash([5, 3]); g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.stroke(); g.setLineDash([]);
    if (S.sel.size > 1) selObjs().forEach(o => { g.beginPath(); corners(o).map(p => w2s(...p)).forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.globalAlpha = .45; g.stroke(); g.globalAlpha = 1; });
    const hs = C.handle;
    for (const h of handlePositions(F)) {
      const [x, y] = h.p;
      if (h.rot) { g.beginPath(); g.moveTo(...h.base); g.lineTo(x, y); g.stroke(); g.beginPath(); g.arc(x, y, hs * .75, 0, 7); g.fillStyle = C.s1; g.fill(); g.stroke(); }
      else { g.fillStyle = C.s1; g.fillRect(x - hs / 2, y - hs / 2, hs, hs); g.strokeRect(x - hs / 2 + .5, y - hs / 2 + .5, hs - 1, hs - 1); }
    }
    g.restore();
  }
  function drawRulers(g) {
    const r = RULER(), sc = S.view.scale, major = niceStep(64), minor = niceStep(8), u = U();
    g.save(); g.fillStyle = C.rbg; g.fillRect(0, 0, CW, r); g.fillRect(0, 0, r, CH);
    g.strokeStyle = C.border; g.beginPath(); g.moveTo(0, r + .5); g.lineTo(CW, r + .5); g.moveTo(r + .5, 0); g.lineTo(r + .5, CH); g.stroke();
    g.fillStyle = C.rtx; g.strokeStyle = C.rtx; g.font = `10px ${C.mono}`; g.textBaseline = 'top';
    const fmt = v => { const n = v / u; return Math.abs(n - Math.round(n)) < 1e-6 ? String(Math.round(n)) : nf(n, S.units === 'in' ? 2 : 1); };
    const [wx0] = s2w(r, 0), [wx1] = s2w(CW, 0);
    g.beginPath();
    for (let x = Math.floor(wx0 / minor) * minor; x <= wx1; x += minor) {
      const sx = Math.round(x * sc + S.view.ox) + .5; if (sx < r) continue;
      const isMaj = Math.abs(x / major - Math.round(x / major)) < 1e-6;
      g.moveTo(sx, r); g.lineTo(sx, r - (isMaj ? r * .6 : r * .25));
      if (isMaj) g.fillText(fmt(x), sx + 3, 2);
    }
    const [, wy0] = s2w(0, r), [, wy1] = s2w(0, CH);
    for (let y = Math.floor(wy0 / minor) * minor; y <= wy1; y += minor) {
      const sy = Math.round(y * sc + S.view.oy) + .5; if (sy < r) continue;
      const disp = WA.h - y, isMaj = Math.abs(disp / major - Math.round(disp / major)) < 1e-6;
      g.moveTo(r, sy); g.lineTo(r - (isMaj ? r * .6 : r * .25), sy);
      if (isMaj) { g.save(); g.translate(2, sy - 3); g.rotate(-Math.PI / 2); g.fillText(fmt(disp), 0, 0); g.restore(); }
    }
    g.stroke();
    g.fillStyle = C.rbg; g.fillRect(0, 0, r, r); g.fillStyle = C.rtx; g.textBaseline = 'middle'; g.textAlign = 'center'; g.fillText(unitLbl(), r / 2, r / 2);
    g.restore();
  }

  // ================================================================ 4. INTERAÇÃO
  const ptrs = new Map();
  let drag = null, gesture = null, lpTimer = null, spaceDown = false;
  const cancelLP = () => { clearTimeout(lpTimer); lpTimer = null; };
  const startLP = fn => { cancelLP(); lpTimer = setTimeout(() => { lpTimer = null; fn(); }, 500); };
  const localPt = e => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  const editable = () => S.mode === 'design' && S.layout !== 'narrow';

  function noteInput(type) {
    S.input = type === 'touch' ? 'touch' : type === 'pen' ? 'pen' : 'mouse';
    if (S.densityPref === 'auto') setDensity(S.input === 'touch' ? 'comfortable' : 'compact');
    updateStatus();
  }
  function hitHandle(px, py, touch) {
    const F = selFrame(); if (!F || !editable()) return null;
    const r = (touch ? Math.max(C.handleHit, 44) : C.handleHit) / 2;
    let best = null, bd = Infinity;
    for (const h of handlePositions(F)) {
      const d = Math.hypot(h.p[0] - px, h.p[1] - py);
      if (d <= r && d < bd) { best = h; bd = d; }
    }
    // alças de borda em objetos muito pequenos atrapalham: prioriza cantos e rotação
    return best;
  }

  cv.addEventListener('pointerdown', e => {
    cv.focus({ preventScroll: true }); hideCtx(); noteInput(e.pointerType);
    try { cv.setPointerCapture(e.pointerId); } catch (err) { /* ponteiro já liberado */ }
    const [px, py] = localPt(e); ptrs.set(e.pointerId, { x: px, y: py });
    if (ptrs.size === 2) {
      cancelLP();
      if (drag && drag.snapDoc && drag.moved) { restoreDoc(drag.snapDoc); S.undo.pop(); }
      drag = null; const [a, b] = [...ptrs.values()];
      gesture = { d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, c0: [(a.x + b.x) / 2, (a.y + b.y) / 2], s0: S.view.scale, ox: S.view.ox, oy: S.view.oy };
      return;
    }
    if (ptrs.size > 2) return;
    const [wx, wy] = s2w(px, py), touch = e.pointerType === 'touch', tol = (touch ? 12 : 4) / S.view.scale;
    const pan = { type: 'pan', sx: px, sy: py, ox: S.view.ox, oy: S.view.oy, moved: false };
    if (e.button === 1 || (e.button === 0 && spaceDown)) { drag = pan; cv.style.cursor = 'grabbing'; return; }
    if (e.button === 2) {
      const o = hitObj(wx, wy, tol);
      if (o && editable()) { if (!S.sel.has(o.id)) setSel([o.id]); openCtx(e.clientX, e.clientY); }
      return;
    }
    if (!editable()) { drag = pan; return; }
    if (S.tool === 'rect' || S.tool === 'ellipse') { drag = { type: 'create', x0: wx, y0: wy, sx: px, sy: py, obj: null, moved: false }; return; }
    if (S.tool === 'text') {
      pushUndo(); const o = addObj({ type: 'text', text: t('obj.type.text'), x: wx, y: wy, h: 12, layer: S.curLayer }); fitTextBox(o);
      setTool('select'); setSel([o.id]); showPanel('object'); changed();
      setTimeout(() => { const i = $('#insText'); if (i) { i.focus(); i.select(); } }, 60);
      return;
    }
    const h = hitHandle(px, py, touch);
    if (h) {
      const F0 = selFrame();
      drag = { type: h.rot ? 'rotate' : 'resize', h, F0, snap: snapSel(), sx: px, sy: py, moved: false, a0: Math.atan2(wy - F0.cy, wx - F0.cx) };
      return;
    }
    const o = hitObj(wx, wy, tol), additive = e.shiftKey || e.ctrlKey || e.metaKey || S.multi;
    if (o) {
      let toggled = false;
      if (additive && !S.sel.has(o.id)) { S.sel.add(o.id); selChanged(); toggled = true; }
      else if (!additive && !S.sel.has(o.id)) setSel([o.id]);
      drag = { type: 'move', o, additive, toggled, wx0: wx, wy0: wy, sx: px, sy: py, moved: false, snap: snapSel() };
      if (touch) startLP(() => { if (!drag || drag.moved) return; drag = null; if (!S.sel.has(o.id)) setSel([o.id]); openCtx(e.clientX, e.clientY); vibrate(); });
      return;
    }
    if (touch && !S.marquee) {
      drag = Object.assign(pan, { tapClear: !additive });
      startLP(() => { if (drag && !drag.moved) { drag = { type: 'marquee', x0: wx, y0: wy, x1: wx, y1: wy, additive, sx: px, sy: py, moved: true }; vibrate(); dirty(); } });
      return;
    }
    drag = { type: 'marquee', x0: wx, y0: wy, x1: wx, y1: wy, additive, sx: px, sy: py, moved: false };
  });
  const vibrate = () => { try { navigator.vibrate && navigator.vibrate(12); } catch (e) { /* */ } };

  cv.addEventListener('pointermove', e => {
    const [px, py] = localPt(e);
    if (ptrs.has(e.pointerId)) ptrs.set(e.pointerId, { x: px, y: py });
    if (gesture && ptrs.size >= 2) {
      const [a, b] = [...ptrs.values()], d = Math.hypot(a.x - b.x, a.y - b.y), c = [(a.x + b.x) / 2, (a.y + b.y) / 2];
      const ns = clamp(gesture.s0 * d / gesture.d0, .2, 80), wx = (gesture.c0[0] - gesture.ox) / gesture.s0, wy = (gesture.c0[1] - gesture.oy) / gesture.s0;
      S.view.scale = ns; S.view.ox = c[0] - wx * ns; S.view.oy = c[1] - wy * ns; dirty(); updateStatus(); return;
    }
    const [wx, wy] = s2w(px, py);
    if (!drag) { hoverCursor(px, py, wx, wy, e.pointerType); return; }
    const thr = e.pointerType === 'touch' ? 8 : 3;
    if (!drag.moved) {
      if (Math.hypot(px - drag.sx, py - drag.sy) < thr) return;
      drag.moved = true; cancelLP();
      if (['move', 'resize', 'rotate'].includes(drag.type)) { drag.snapDoc = snapshotDoc(); pushUndo(); }
    }
    switch (drag.type) {
      case 'pan': S.view.ox = drag.ox + px - drag.sx; S.view.oy = drag.oy + py - drag.sy; break;
      case 'move': {
        let dx = wx - drag.wx0, dy = wy - drag.wy0;
        if (e.shiftKey) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0; }
        for (const s of drag.snap) { const o = objById(s.id); o.x = s.x + dx; o.y = s.y + dy; }
        break;
      }
      case 'resize': {
        const { F0, h } = drag, [qx, qy] = toLocal(F0, wx, wy), alt = e.altKey;
        const ax = alt ? 0 : -h.hx * F0.w / 2, ay = alt ? 0 : -h.hy * F0.h / 2;
        let sx = h.hx ? ((qx - ax) * h.hx) / (alt ? F0.w / 2 : F0.w) : 1;
        let sy = h.hy ? ((qy - ay) * h.hy) / (alt ? F0.h / 2 : F0.h) : 1;
        sx = Math.max(sx, .01); sy = Math.max(sy, .01);
        if (h.hx && h.hy && (S.lockRatio !== e.shiftKey)) { const s = Math.max(sx, sy); sx = sy = s; }
        applyScale(F0, drag.snap, sx, sy, ax, ay);
        break;
      }
      case 'rotate': {
        const { F0 } = drag; let da = deg(Math.atan2(wy - F0.cy, wx - F0.cx) - drag.a0);
        const snapStep = e.shiftKey ? 15 : (e.pointerType === 'touch' ? 5 : 0);
        if (snapStep) da = Math.round((F0.rot + da) / snapStep) * snapStep - F0.rot;
        applyRotate(F0, drag.snap, da);
        break;
      }
      case 'create': {
        if (!drag.obj) { pushUndo(); drag.obj = addObj({ type: S.tool, x: wx, y: wy, w: 1, h: 1, rx: 0, layer: S.curLayer }); setSel([drag.obj.id]); }
        let w = wx - drag.x0, hh = wy - drag.y0;
        if (e.shiftKey) { const m = Math.max(Math.abs(w), Math.abs(hh)); w = Math.sign(w || 1) * m; hh = Math.sign(hh || 1) * m; }
        Object.assign(drag.obj, { x: drag.x0 + w / 2, y: drag.y0 + hh / 2, w: Math.max(.5, Math.abs(w)), h: Math.max(.5, Math.abs(hh)) });
        break;
      }
      case 'marquee': drag.x1 = wx; drag.y1 = wy; break;
    }
    dirty(); refreshInspector(); updateStatus();
  });

  function endPointer(e, cancelled) {
    ptrs.delete(e.pointerId);
    if (gesture) { if (ptrs.size < 2) gesture = null; drag = null; return; }
    cancelLP();
    if (!drag) return;
    const d = drag; drag = null; cv.style.cursor = '';
    if (cancelled) { if (d.snapDoc && d.moved) { restoreDoc(d.snapDoc); S.undo.pop(); } dirty(); return; }
    if (d.type === 'move' && !d.moved) {
      if (d.additive && !d.toggled) { S.sel.delete(d.o.id); selChanged(); }
      else if (!d.additive) setSel([d.o.id]);
    }
    if (d.type === 'pan' && !d.moved && d.tapClear) setSel([]);
    if (d.type === 'marquee') {
      if (!d.moved) { if (!d.additive) setSel([]); }
      else {
        const x0 = Math.min(d.x0, d.x1), x1 = Math.max(d.x0, d.x1), y0 = Math.min(d.y0, d.y1), y1 = Math.max(d.y0, d.y1), crossing = d.x1 < d.x0;
        const hits = S.objects.filter(o => {
          const l = layerById(o.layer); if (l && !l.show) return false;
          const b = aabb([o]);
          return crossing ? !(b.x1 < x0 || b.x0 > x1 || b.y1 < y0 || b.y0 > y1) : (b.x0 >= x0 && b.x1 <= x1 && b.y0 >= y0 && b.y1 <= y1);
        }).map(o => o.id);
        setSel(d.additive ? [...S.sel, ...hits] : hits);
      }
    }
    if (d.type === 'create') {
      if (!d.obj) { pushUndo(); d.obj = addObj({ type: S.tool, x: d.x0, y: d.y0, w: 40, h: S.tool === 'ellipse' ? 40 : 30, rx: 0, layer: S.curLayer }); }
      setTool('select'); setSel([d.obj.id]); changed();
    }
    if (['move', 'resize', 'rotate'].includes(d.type) && d.moved) changed();
    dirty(); refreshInspector();
  }
  cv.addEventListener('pointerup', e => endPointer(e, false));
  cv.addEventListener('pointercancel', e => endPointer(e, true));
  cv.addEventListener('lostpointercapture', e => { if (ptrs.has(e.pointerId)) endPointer(e, false); });
  cv.addEventListener('contextmenu', e => e.preventDefault());
  cv.addEventListener('wheel', e => {
    e.preventDefault(); const [px, py] = localPt(e);
    if (e.shiftKey) { S.view.ox -= e.deltaY; dirty(); return; }
    const k = e.ctrlKey ? .01 : .0015;
    zoomAt(px, py, Math.exp(-e.deltaY * k));
  }, { passive: false });

  function hoverCursor(px, py, wx, wy, type) {
    if (type === 'touch') return;
    let c = '';
    if (spaceDown || !editable()) c = 'grab';
    else if (S.tool === 'rect' || S.tool === 'ellipse' || S.tool === 'text') c = S.tool === 'text' ? 'text' : 'crosshair';
    else {
      const h = hitHandle(px, py, false);
      if (h) {
        if (h.rot) c = 'grab';
        else { const F = selFrame(), a = ((deg(Math.atan2(h.hy, h.hx)) + F.rot) % 180 + 180) % 180; c = a < 22.5 || a > 157.5 ? 'ew-resize' : a < 67.5 ? 'nwse-resize' : a < 112.5 ? 'ns-resize' : 'nesw-resize'; }
      } else if (hitObj(wx, wy, 4 / S.view.scale)) c = 'move';
    }
    cv.style.cursor = c;
  }

  // teclado
  const typing = e => { const tg = e.target; return tg && (tg.tagName === 'INPUT' || tg.tagName === 'TEXTAREA' || tg.tagName === 'SELECT' || tg.isContentEditable); };
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && e.shiftKey) { e.preventDefault(); estop(); return; }
    if (e.key === 'F5') { e.preventDefault(); $('#btnStart').click(); return; }
    if (e.key === 'F6') { e.preventDefault(); $('#btnPause').click(); return; }
    if (e.key === 'F7') { e.preventDefault(); $('#btnFrame').click(); return; }
    if (typing(e) || document.querySelector('dialog[open]')) return;
    const mod = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
    if (e.key === 'Escape') {
      if (S.m.state === 'run') { pauseJob(); return; }
      hideCtx(); if (S.tool !== 'select') setTool('select'); else setSel([]); return;
    }
    if (e.key === ' ' && !e.repeat) { spaceDown = true; cv.style.cursor = 'grab'; e.preventDefault(); return; }
    if (mod && k === '1') { e.preventDefault(); setMode('design'); return; }
    if (mod && k === '2') { e.preventDefault(); setMode('produce'); return; }
    if (mod && k === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
    if (mod && k === 'y') { e.preventDefault(); redo(); return; }
    if (mod && k === '0') { e.preventDefault(); fit(); return; }
    if (e.key === '+' || e.key === '=') { zoomAt(CW / 2, CH / 2, 1.25); return; }
    if (e.key === '-') { zoomAt(CW / 2, CH / 2, .8); return; }
    if (!editable()) { if (k === 'f') fit(); return; }
    if (mod && k === 'a') { e.preventDefault(); setSel(S.objects.filter(o => (layerById(o.layer) || {}).show !== false).map(o => o.id)); return; }
    if (mod && k === 'd') { e.preventDefault(); duplicate(); return; }
    if (mod && k === 'i') { e.preventDefault(); stub('tool.import'); return; }
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); delSel(); return; }
    if (e.key.startsWith('Arrow') && S.sel.size) {
      e.preventDefault(); const st = e.shiftKey ? 10 : e.altKey ? .1 : 1;
      const dx = e.key === 'ArrowLeft' ? -st : e.key === 'ArrowRight' ? st : 0, dy = e.key === 'ArrowUp' ? -st : e.key === 'ArrowDown' ? st : 0;
      if (!e.repeat) pushUndo(); selObjs().forEach(o => { o.x += dx; o.y += dy; }); changed(); refreshInspector(); return;
    }
    if (mod || e.altKey) return;
    const map = { v: 'select', r: 'rect', e: 'ellipse', t: 'text' };
    if (map[k]) { setTool(map[k]); return; }
    if (k === 'n') { stub('tool.node'); return; }
    if (k === 'f') fit();
  });
  document.addEventListener('keyup', e => { if (e.key === ' ') { spaceDown = false; cv.style.cursor = ''; } });

  // ações de edição
  function setSel(ids) { S.sel = new Set(ids); selChanged(); }
  function delSel() { if (!S.sel.size) return; pushUndo(); S.objects = S.objects.filter(o => !S.sel.has(o.id)); S.sel.clear(); pruneLayers(); selChanged(); changed(); }
  function duplicate() {
    if (!S.sel.size) return toast(t('toast.needSel'), 'warn');
    pushUndo(); const ids = [];
    selObjs().forEach(o => { const c = JSON.parse(JSON.stringify(o, (k, v) => (k[0] === '_' ? undefined : v))); c.x += 5; c.y += 5; ids.push(addObj(c).id); });
    setSel(ids); changed();
  }
  function arrayGrid() {
    if (!S.sel.size) return toast(t('toast.needSel'), 'warn');
    pushUndo(); const b = aabb(selObjs()), src = selObjs(), ids = src.map(o => o.id);
    for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) {
      if (!r && !c) continue;
      src.forEach(o => { const n = JSON.parse(JSON.stringify(o, (k, v) => (k[0] === '_' ? undefined : v))); n.x += c * (b.w + 5); n.y += r * (b.h + 5); ids.push(addObj(n).id); });
    }
    setSel(ids); changed(); toast(t('toast.array'), 'ok');
  }
  function zorder(front) {
    pushUndo(); const sel = S.objects.filter(o => S.sel.has(o.id)), rest = S.objects.filter(o => !S.sel.has(o.id));
    S.objects = front ? rest.concat(sel) : sel.concat(rest); changed();
  }
  function align(kind) {
    const L = selObjs(); if (L.length < 1) return;
    pushUndo();
    const B = L.length > 1 ? aabb(L) : { x0: 0, y0: 0, x1: WA.w, y1: WA.h };
    L.forEach(o => {
      const b = aabb([o]);
      if (kind === 'alignLeft') o.x += B.x0 - b.x0; if (kind === 'alignRight') o.x += B.x1 - b.x1;
      if (kind === 'alignCenterH') o.x += (B.x0 + B.x1) / 2 - (b.x0 + b.x1) / 2;
      if (kind === 'alignTop') o.y += B.y0 - b.y0; if (kind === 'alignBottom') o.y += B.y1 - b.y1;
      if (kind === 'alignMiddleV') o.y += (B.y0 + B.y1) / 2 - (b.y0 + b.y1) / 2;
    });
    changed(); refreshInspector();
  }
  function assignLayer(id) {
    if (S.sel.size) {
      pushUndo(); ensureLayer(id); selObjs().forEach(o => { o.layer = id; delete o._pc; });
      S.curLayer = id; pruneLayers(); changed(); toast(t('toast.layerChanged', { c: id.toUpperCase() }), 'ok');
    } else { S.curLayer = id; ensureLayer(id); pruneLayers(); renderLayers(); }
    renderPalette(); buildInspector();
  }
  function setTool(tool) {
    S.tool = tool; $$('.tool[data-tool]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.tool === tool)));
    cv.style.cursor = tool === 'select' ? '' : 'crosshair';
  }
  function stub(key) { toast(t('toast.notInProto', { x: t(key).replace(/\s*\(.*\)$/, '') }), 'info'); }

  // menu de contexto (botão direito / toque longo)
  const ctxEl = $('#ctxmenu');
  function openCtx(x, y) {
    ctxEl.innerHTML = '';
    const item = (icon, key, fn) => ctxEl.append(el('button', { role: 'menuitem', onclick: () => { hideCtx(); fn(); } }, [ico(icon), el('span', { text: t(key).replace(/\s*\(.*\)$/, '') })]));
    item('copy', 'obj.duplicate', duplicate); item('front', 'obj.front', () => zorder(true)); item('back', 'obj.back', () => zorder(false));
    item('array', 'tool.array', arrayGrid); item('trash', 'obj.delete', delSel);
    const sws = el('div', { class: 'sws', 'aria-label': t('obj.layer') });
    LAYER_IDS.forEach(id => sws.append(el('button', { style: `--c:${C[id]}`, title: id.toUpperCase(), 'aria-label': id.toUpperCase(), onclick: () => { hideCtx(); assignLayer(id); } })));
    ctxEl.append(sws);
    ctxEl.hidden = false;
    const r = ctxEl.getBoundingClientRect();
    ctxEl.style.left = clamp(x, 8, innerWidth - r.width - 8) + 'px'; ctxEl.style.top = clamp(y, 8, innerHeight - r.height - 8) + 'px';
  }
  function hideCtx() { ctxEl.hidden = true; }
  document.addEventListener('pointerdown', e => { if (!ctxEl.hidden && !ctxEl.contains(e.target) && e.target !== cv) hideCtx(); });

  // ================================================================ 5. PAINÉIS
  // campo numérico com unidade, arraste (scrub) e passos para toque
  function numField(o) {
    // o: {label, get, set, kind:'len'|'deg'|'pct'|'speed'|'int'|'raw', step, min, max, id, title}
    const kind = o.kind || 'raw';
    const toDisp = v => (kind === 'len' ? v / U() : v);
    const dec = o.dec != null ? o.dec : kind === 'len' ? DEC() : kind === 'deg' ? 1 : 0;
    const unit = { len: unitLbl(), deg: '°', pct: '%', speed: 'mm/min', int: '×', raw: '' }[kind];
    const inp = el('input', { inputmode: 'decimal', id: o.id || null, 'aria-label': o.title || o.label, enterkeyhint: 'done' });
    const show = () => { if (document.activeElement !== inp) inp.value = nf(toDisp(o.get()), dec); };
    const setV = v => { if (isNaN(v)) return show(); if (o.min != null) v = Math.max(o.min, v); if (o.max != null) v = Math.min(o.max, v); o.set(v); show(); };
    inp.addEventListener('change', () => { o.before && o.before(); setV(parseNum(inp.value, kind === 'len' ? 'len' : 'raw')); o.after && o.after(); });
    inp.addEventListener('keydown', e => {
      if (e.key === 'Enter') { inp.blur(); }
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); const st = (o.step || 1) * (e.shiftKey ? 10 : e.altKey ? .1 : 1); setV(o.get() + (e.key === 'ArrowUp' ? st : -st) * (kind === 'len' ? U() : 1)); inp.select(); }
    });
    inp.addEventListener('focus', () => setTimeout(() => inp.select(), 0));
    inp.addEventListener('blur', show);
    const lab = el('span', { class: 'scrub', text: o.label, title: o.title || o.label });
    let sc = null;
    lab.addEventListener("pointerdown", e => { try { lab.setPointerCapture(e.pointerId); } catch (err) { /* */ } sc = { x: e.clientX, v: o.get(), pushed: false }; });
    lab.addEventListener('pointermove', e => {
      if (!sc) return; const dx = e.clientX - sc.x; if (Math.abs(dx) < 2) return;
      if (!sc.pushed) { o.before && o.before(); sc.pushed = true; }
      const per = (o.step || 1) * (e.shiftKey ? 10 : e.altKey ? .1 : 1) * (kind === 'len' ? U() : 1) / (e.pointerType === 'touch' ? 4 : 2);
      setV(sc.v + dx * per);
    });
    const endSc = () => { if (sc && sc.pushed && o.after) o.after(); sc = null; };
    lab.addEventListener('pointerup', endSc); lab.addEventListener('pointercancel', endSc);
    const step = dir => el('button', { class: 'step', type: 'button', 'aria-label': (dir > 0 ? '+' : '−') + ' ' + o.label, html: FK.icon(dir > 0 ? 'plus' : 'minus'),
      onclick: () => { o.before && o.before(); setV(o.get() + dir * (o.step || 1) * (kind === 'len' ? U() : 1)); o.after && o.after(); } });
    const box = el('div', { class: 'num' }, [lab, inp, unit ? el('span', { class: 'unit', text: unit }) : null, step(-1), step(1)]);
    box._refresh = show; show();
    return box;
  }
  function sliderField(label, nfOpts) {
    const range = el('input', { type: 'range', min: nfOpts.min, max: nfOpts.max, step: nfOpts.rstep || 1, 'aria-label': label, value: nfOpts.get() });
    const n = numField(Object.assign({ label }, nfOpts, { set: v => { nfOpts.set(v); range.value = v; } }));
    range.addEventListener('pointerdown', () => nfOpts.before && nfOpts.before());
    range.addEventListener('input', () => { nfOpts.set(+range.value); n._refresh(); });
    range.addEventListener('change', () => nfOpts.after && nfOpts.after());
    const wrap = el('div', { class: 'slider' }, [range, n]); wrap._refresh = () => { range.value = nfOpts.get(); n._refresh(); };
    return wrap;
  }

  // ---- camadas
  const MODE_KEYS = { line: 'layers.mode.line', fill: 'layers.mode.fill', image: 'layers.mode.image', tool: 'layers.mode.tool' };
  function renderLayers() {
    const box = $('#layerList'); box.innerHTML = '';
    if (!S.layers.length) { box.append(el('p', { class: 'empty', text: t('layers.empty') })); return; }
    const est = S.plan ? S.plan.byLayer : {};
    S.layers.forEach((l, i) => {
      const n = S.objects.filter(o => o.layer === l.id).length, isT = l.id === 't1';
      const params = isT ? t('layers.toolNote') : `${l.speed} mm/min · ${l.power}% · ${l.passes}×${est[l.id] ? ' · ≈' + fmtTime(est[l.id]) : ''}`;
      const toggle = (key, icon, iconOff, on, fn) => el('button', { class: 'icon-btn', 'aria-pressed': String(on), title: t(key), 'aria-label': t(key) + ' ' + l.id.toUpperCase(), html: FK.icon(on ? icon : iconOff),
        onclick: e => { e.stopPropagation(); pushUndo(); fn(); changed(); } });
      const row = el('div', { class: 'layer-row', onclick: () => { l.open = !l.open; S.curLayer = l.id; renderLayers(); renderPalette(); } }, [
        el('span', { class: 'layer-chip', style: `--c:${C[l.id]}`, text: l.id.toUpperCase().replace('C', '') }),
        el('span', { class: 'layer-main' }, [el('span', { class: 'layer-mode', text: `${t(MODE_KEYS[l.mode])} · ${t('layers.objects', { n })}` }), el('span', { class: 'layer-params', text: params, title: params })]),
        isT ? el('span') : toggle('layers.output', 'output', 'eyeOff', l.output, () => (l.output = !l.output)),
        toggle('layers.show', 'eye', 'eyeOff', l.show, () => (l.show = !l.show)),
        el('button', { class: 'icon-btn exp', title: t('layers.edit'), 'aria-label': t('layers.edit'), 'aria-expanded': String(!!l.open), html: FK.icon('chevDown'), onclick: e => { e.stopPropagation(); l.open = !l.open; renderLayers(); } })
      ]);
      const card = el('div', { class: 'layer' + (l.open ? ' open' : '') + (S.curLayer === l.id ? ' cur' : '') + (isT ? ' t' : ''), role: 'listitem', style: `--c:${C[l.id]}` }, [row]);
      if (l.open) card.append(layerEditor(l, i));
      box.append(card);
    });
  }
  function layerEditor(l, i) {
    const ed = el('div', { class: 'layer-edit' });
    const before = () => pushUndo(), after = () => changed();
    if (l.id === 't1') { ed.append(el('p', { class: 'hint', text: t('layers.toolNote') })); return ed; }
    const seg = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': t('layers.mode') });
    ['line', 'fill', 'image'].forEach(m => seg.append(el('button', { class: l.mode === m ? 'on' : '', role: 'radio', 'aria-checked': String(l.mode === m), html: FK.icon(m === 'line' ? 'line' : m === 'fill' ? 'fill' : 'image') + `<span>${t(MODE_KEYS[m])}</span>`,
      onclick: () => { pushUndo(); l.mode = m; S.objects.forEach(o => o.layer === l.id && delete o._pc); changed(); } })));
    ed.append(seg);
    ed.append(el('div', { class: 'field' }, [el('label', { text: t('layers.speed') }), sliderField(t('layers.speed'), { kind: 'speed', min: 50, max: 12000, rstep: 50, step: 50, get: () => l.speed, set: v => { l.speed = Math.round(v); }, before, after })]));
    ed.append(el('div', { class: 'field' }, [el('label', { text: t('layers.power') }), sliderField(t('layers.power'), { kind: 'pct', min: 0, max: 100, get: () => l.power, set: v => { l.power = Math.round(v); }, before, after })]));
    const r2 = el('div', { class: 'row2' }, [numField({ label: t('layers.passes'), kind: 'int', min: 1, max: 50, step: 1, get: () => l.passes, set: v => { l.passes = Math.round(v); }, before, after: () => changed() })]);
    if (l.mode !== 'line') r2.append(numField({ label: t('layers.interval'), kind: 'len', min: .02, max: 2, step: .01, dec: 2, get: () => l.interval, set: v => { l.interval = v; }, before, after }));
    ed.append(r2);
    const air = el('label', { class: 'check' }, [el('input', { type: 'checkbox', onchange: e => { pushUndo(); l.air = e.target.checked; changed(); } }), el('span', { text: t('layers.air') })]);
    air.firstChild.checked = l.air; ed.append(air);
    const mat = el('select', { 'aria-label': t('layers.material'), onchange: e => {
      const k = e.target.value; if (!k) return; pushUndo(); Object.assign(l, MAT[k]); changed(); toast(t('toast.material', { m: t(k), c: l.id.toUpperCase() }), 'ok');
    } }, [el('option', { value: '', text: t('layers.material') })].concat(Object.keys(MAT).map(k => el('option', { value: k, text: t(k) }))));
    const ord = el('div', { class: 'btn-row' }, [
      el('button', { class: 'icon-btn', title: t('layers.up'), 'aria-label': t('layers.up'), html: FK.icon('up'), disabled: i === 0, onclick: () => moveLayer(i, -1) }),
      el('button', { class: 'icon-btn', title: t('layers.down'), 'aria-label': t('layers.down'), html: FK.icon('down'), disabled: i === S.layers.length - 1, onclick: () => moveLayer(i, 1) }),
      mat
    ]);
    mat.style.flex = '1'; ed.append(ord);
    return ed;
  }
  function moveLayer(i, d) { const j = i + d; if (j < 0 || j >= S.layers.length) return; pushUndo(); const [l] = S.layers.splice(i, 1); S.layers.splice(j, 0, l); changed(); }

  // ---- paleta
  function renderPalette() {
    const p = $('#palette'); p.innerHTML = '';
    const used = new Set(selObjs().map(o => o.layer));
    LAYER_IDS.forEach(id => p.append(el('button', {
      class: 'sw' + (id === 't1' ? ' tool-layer' : '') + (S.curLayer === id ? ' cur' : ''), style: `--c:${C[id]}`,
      title: `${id.toUpperCase()} — ${t('palette.hint')}`, 'aria-label': id.toUpperCase(), 'aria-pressed': String(used.has(id)),
      text: id === 't1' ? 'T1' : id.slice(1), onclick: () => assignLayer(id)
    })));
  }

  // ---- inspetor
  let insRefresh = [];
  function selChanged() { buildInspector(); renderPalette(); dirty(); updateStatus(); }
  function refreshInspector() { insRefresh.forEach(f => f()); }
  function buildInspector() {
    const box = $('#inspector'); box.innerHTML = ''; insRefresh = [];
    const L = selObjs();
    $('#objSub').textContent = L.length === 1 ? t('obj.type.' + L[0].type) : L.length > 1 ? t('obj.count', { n: L.length }) : '';
    if (!L.length) { box.append(el('p', { class: 'empty', text: t('obj.none') })); return; }
    const before = () => pushUndo(), after = () => changed();
    const F = () => selFrame();
    const setFrame = (k, v) => {
      const F0 = selFrame(), snap = snapSel();
      if (k === 'x') snap.forEach(s => (objById(s.id).x = s.x + (v - F0.cx)));
      if (k === 'y') snap.forEach(s => (objById(s.id).y = s.y + ((WA.h - v) - F0.cy)));
      if (k === 'w' || k === 'h') {
        let sx = k === 'w' ? v / F0.w : 1, sy = k === 'h' ? v / F0.h : 1;
        if (S.lockRatio) { if (k === 'w') sy = sx; else sx = sy; }
        applyScale(F0, snap, sx, sy, 0, 0);
      }
      if (k === 'r') applyRotate(F0, snap, v - F0.rot);
      dirty(); refreshInspector();
    };
    const add = f => { insRefresh.push(f._refresh); return f; };
    const grid = el('div', { class: 'fgrid' }, [
      add(numField({ label: 'X', title: t('obj.center'), kind: 'len', step: 1, get: () => F().cx, set: v => setFrame('x', v), before, after })),
      add(numField({ label: 'Y', title: t('obj.center'), kind: 'len', step: 1, get: () => WA.h - F().cy, set: v => setFrame('y', v), before, after })),
      add(numField({ label: t('obj.w'), kind: 'len', step: 1, min: .1, get: () => F().w, set: v => setFrame('w', v), before, after })),
      add(numField({ label: t('obj.h'), kind: 'len', step: 1, min: .1, get: () => F().h, set: v => setFrame('h', v), before, after })),
      add(numField({ label: t('obj.rot'), kind: 'deg', step: 1, get: () => F().rot, set: v => setFrame('r', v), before, after }))
    ]);
    box.append(grid);
    const lock = el('label', { class: 'check' }, [el('input', { type: 'checkbox', onchange: e => (S.lockRatio = e.target.checked) }), ico('lock'), el('span', { text: t('obj.lock') })]);
    lock.firstChild.checked = S.lockRatio; box.append(lock);

    if (L.length === 1 && L[0].type === 'text') {
      const o = L[0];
      const ta = el('textarea', { id: 'insText', class: 'textarea', rows: 2, 'aria-label': t('obj.text') });
      ta.value = o.text;
      ta.addEventListener('focus', () => pushUndo());
      ta.addEventListener('input', () => { o.text = ta.value || ' '; fitTextBox(o); dirty(); refreshInspector(); });
      ta.addEventListener('change', () => changed());
      box.append(el('div', { class: 'field' }, [el('label', { for: 'insText', text: t('obj.text') }), ta]));
    }
    if (L.length === 1 && L[0].type === 'image') {
      const o = L[0], inv = () => { delete o._pc; dirty(); };
      box.append(el('div', { class: 'field' }, [el('label', { text: t('obj.brightness') }), add(sliderField(t('obj.brightness'), { min: -100, max: 100, get: () => o.bright, set: v => { o.bright = Math.round(v); inv(); }, before, after }))]));
      box.append(el('div', { class: 'field' }, [el('label', { text: t('obj.contrast') }), add(sliderField(t('obj.contrast'), { min: -100, max: 100, get: () => o.contrast, set: v => { o.contrast = Math.round(v); inv(); }, before, after }))]));
      const seg = el('div', { class: 'seg wrap', role: 'radiogroup', 'aria-label': t('obj.dither') });
      ['fs', 'atk', 'thr'].forEach(d => seg.append(el('button', { class: o.dither === d ? 'on' : '', role: 'radio', 'aria-checked': String(o.dither === d), text: t('obj.dither.' + d), onclick: () => { pushUndo(); o.dither = d; inv(); changed(); buildInspector(); } })));
      box.append(el('div', { class: 'field' }, [el('label', { text: t('obj.dither') }), seg]));
    }
    // camada
    const sws = el('div', { class: 'btn-row', role: 'group', 'aria-label': t('obj.layer') });
    const used = new Set(L.map(o => o.layer));
    LAYER_IDS.forEach(id => sws.append(el('button', { class: 'icon-btn', style: `background:${C[id]};border:2px solid ${used.has(id) ? 'var(--fk-color-text)' : 'transparent'};color:#000c;font:700 10px var(--fk-font-family-mono)`, title: id.toUpperCase(), 'aria-label': id.toUpperCase(), 'aria-pressed': String(used.has(id)), text: id === 't1' ? 'T1' : id.slice(1), onclick: () => assignLayer(id) })));
    box.append(el('div', { class: 'field' }, [el('label', { text: t('obj.layer') }), sws]));
    // alinhar
    const al = el('div', { class: 'btn-row', role: 'group', 'aria-label': t('obj.align') });
    ['alignLeft', 'alignCenterH', 'alignRight', 'alignTop', 'alignMiddleV', 'alignBottom'].forEach(k => al.append(el('button', { class: 'icon-btn', title: t('obj.' + k), 'aria-label': t('obj.' + k), html: FK.icon(k), onclick: () => align(k) })));
    box.append(el('div', { class: 'field' }, [el('label', { text: t('obj.align') }), al]));
    // ações
    const act = (icon, key, fn) => el('button', { class: 'btn', html: FK.icon(icon) + `<span>${t(key).replace(/\s*\(.*\)$/, '')}</span>`, title: t(key), onclick: fn });
    box.append(el('div', { class: 'btn-row' }, [act('copy', 'obj.duplicate', duplicate), act('array', 'tool.array', arrayGrid), act('front', 'obj.front', () => zorder(true)), act('back', 'obj.back', () => zorder(false)), act('trash', 'obj.delete', delSel)]));
  }

  let planTimer = null;
  function changed(noUndoMark) {
    S.dirtyFile = true; $('.file-dirty').style.visibility = 'visible';
    S.plan = null; clearTimeout(planTimer); planTimer = setTimeout(() => { S.plan = buildPlan(); renderLayers(); updateJobUI(); }, 250);
    renderLayers(); renderPalette(); dirty(); updateStatus();
  }

  // ---- console
  const con = $('#console');
  function log(text, cls) {
    const d = el('div', { class: 'ln ' + (cls || 'rx'), text });
    con.append(d); while (con.childElementCount > 400) con.firstChild.remove();
    con.scrollTop = con.scrollHeight;
  }
  $('#hideStatus').addEventListener('change', e => con.classList.toggle('hide-status', e.target.checked));
  con.classList.add('hide-status');
  $('#consoleForm').addEventListener('submit', e => {
    e.preventDefault(); const i = $('#consoleInput'), cmd = i.value.trim(); if (!cmd) return; i.value = '';
    log(cmd, 'tx');
    if (!connected()) { log(t('toast.needConn'), 'err'); return; }
    const c = cmd.toUpperCase();
    if (c === '$$') { ['$0=10', '$1=25', '$10=1', '$22=1', '$30=1000', '$31=0', '$32=1', `$130=${WA.w}`, `$131=${WA.h}`].forEach(s => log(s)); log('ok'); }
    else if (c === '?') log(statusLine(), 'rx');
    else if (c === '$I') { log('[VER:1.1h.20190825:]'); log('[OPT:VZL,15,128]'); log('ok'); }
    else if (c === '$H') home();
    else if (c === '$X') unlock();
    else if (/^G[01]\b/.test(c)) {
      const mx = c.match(/X(-?[\d.]+)/), my = c.match(/Y(-?[\d.]+)/);
      if (S.m.state !== 'idle') { log('error:8', 'err'); return; }
      moveHead([[mx ? +mx[1] : S.m.x, my ? WA.h - my[1] : S.m.y]], 3000, 'jog'); log('ok');
    } else log('ok');
  });
  const statusLine = () => `<${{ idle: 'Idle', run: 'Run', hold: 'Hold:0', alarm: 'Alarm', jog: 'Jog', home: 'Home', frame: 'Jog' }[S.m.state] || 'Idle'}|MPos:${S.m.x.toFixed(3)},${(WA.h - S.m.y).toFixed(3)},0.000|FS:${S.job && S.job.cur ? S.job.cur.speed : 0},${S.m.laserOn && S.job && S.job.cur ? Math.round(S.job.cur.power * 10) : 0}>`;

  // ================================================================ 6. MÁQUINA (simulada)
  const STATE_ICON = { offline: 'plugOff', connecting: 'plug', idle: 'check', run: 'laser', hold: 'pause', alarm: 'warn', home: 'home', jog: 'right', frame: 'frame' };
  const connected = () => S.m.state !== 'offline' && S.m.state !== 'connecting';
  function setState(st) {
    S.m.state = st; if (st !== 'run') S.m.laserOn = false;
    const chip = $('#stateChip'); chip.dataset.state = st;
    $('.state-ico', chip).innerHTML = FK.icon(STATE_ICON[st]);
    $('.state-label', chip).textContent = t('state.' + st);
    $('#sbState').textContent = t('state.' + st);
    updateMachineUI(); dirty();
  }
  function updateMachineUI() {
    const st = S.m.state, on = connected(), idle = st === 'idle';
    const conLbl = on || st === 'connecting' ? t('machine.disconnect') : t('machine.connect');
    $$('#btnConnect .lbl, #btnConnectTop .lbl').forEach(e => (e.textContent = conLbl));
    $$('#btnConnect, #btnConnectTop').forEach(b => { b.querySelector('.ico') && b.querySelector('.ico').remove(); b.prepend(ico(on ? 'plugOff' : 'plug')); });
    $('#machine').classList.toggle('offline', !on);
    $('#jogNote').hidden = on;
    $$('#jogpad button').forEach(b => (b.disabled = !(idle || st === 'jog')));
    $$('#steps button, #btnSetOrigin, #customBtns [data-gcode]').forEach(b => (b.disabled = !idle));
    $('#btnUnlock').disabled = !(on && (st === 'alarm' || idle));
    $('#btnFrame').disabled = !idle;
    $('#btnStart').disabled = !idle;
    $('#btnPause').disabled = !(st === 'run' || st === 'hold');
    $('#btnStop').disabled = !(st === 'run' || st === 'hold' || st === 'frame');
    const pl = $('#btnPause span'); pl.textContent = st === 'hold' ? t('machine.resume') : t('machine.pause');
    $('#btnPause .ico').outerHTML = FK.icon(st === 'hold' ? 'play' : 'pause');
    $$('#simAlarm, #simDisc').forEach(b => (b.disabled = !(st === 'run' || st === 'hold')));
    $$('[data-proxy]').forEach(b => {
      const src = $('#' + b.dataset.proxy); b.disabled = src.disabled;
      if (b.dataset.proxy === 'btnPause') { b.querySelector('span').textContent = pl.textContent; b.querySelector('.ico').outerHTML = FK.icon(st === 'hold' ? 'play' : 'pause'); }
    });
    $('#anchorRow').hidden = S.m.jobOrigin !== 'current';
    updateDRO();
  }
  function updateDRO() {
    $('#droX').textContent = fmtLen(S.m.x); $('#droY').textContent = fmtLen(WA.h - S.m.y);
    $('#sbHead').textContent = connected() ? `X ${fmtLen(S.m.x, 1)}  Y ${fmtLen(WA.h - S.m.y, 1)}` : '—';
  }

  function connect(instant) {
    if (connected() || S.m.state === 'connecting') return disconnect();
    S.m.port = $('#port').value; setState('connecting'); log(`${t('state.connecting')} ${$('#port').selectedOptions[0].textContent}`, 'sys');
    const done = () => {
      S.m.fw = S.m.port === 'wifi' ? 'grblHAL 1.1f' : 'Grbl 1.1h';
      log(`${S.m.fw} ['$' for help]`); log('[MSG:\'$H\'|\'$X\' to unlock]');
      setState('idle'); $('#connInfo').textContent = t('machine.detected', { fw: S.m.fw, w: WA.w, h: WA.h });
      if (!instant) toast(t('toast.connected', { fw: S.m.fw }), 'ok');
      if (S.m.pendingRecover) { S.m.pendingRecover = false; openRecover(); }
    };
    instant ? done() : setTimeout(done, 900);
  }
  function disconnect() {
    if (S.job) S.job = null;
    setState('offline'); $('#connInfo').textContent = ''; log('Desconectado.', 'sys'); updateJobUI();
  }
  $('#btnConnect').addEventListener('click', () => connect());
  $('#btnConnectTop').addEventListener('click', () => connect());

  // movimento animado do cabeçote (jog, home, contorno)
  function moveHead(points, speed, state, done) {
    S.m.anim = { pts: points.slice(), speed, state, done, prev: state === 'jog' || state === 'home' || state === 'frame' ? S.m.state : null };
    setState(state);
  }
  function stepAnim(dt) {
    const a = S.m.anim; if (!a) return;
    let dist = a.speed / 60 * dt;
    while (dist > 0 && a.pts.length) {
      const [tx, ty] = a.pts[0], dx = tx - S.m.x, dy = ty - S.m.y, d = Math.hypot(dx, dy);
      if (d <= dist) { S.m.x = tx; S.m.y = ty; a.pts.shift(); dist -= d; }
      else { S.m.x += dx / d * dist; S.m.y += dy / d * dist; dist = 0; }
    }
    if (a.cont) { S.m.x = clamp(S.m.x + a.cont[0] * a.speed / 60 * dt, 0, WA.w); S.m.y = clamp(S.m.y - a.cont[1] * a.speed / 60 * dt, 0, WA.h); }
    updateDRO(); dirty();
    if (!a.pts.length && !a.cont) { S.m.anim = null; S.frameDash = null; setState('idle'); a.done && a.done(); }
  }
  // jog: passo (toque/clique) ou contínuo (segurar = homem-morto)
  $$('#jogpad button').forEach(b => {
    const v = b.dataset.jog;
    if (v === 'home') { b.addEventListener('click', home); return; }
    const [dx, dy] = v.split(',').map(Number);
    b.addEventListener('pointerdown', e => {
      if (b.disabled) return; noteInput(e.pointerType);
      if ($('#jogCont').checked) {
        try { b.setPointerCapture(e.pointerId); } catch (err) { /* */ } b.classList.add('held');
        log(`$J=G91 X${dx * 1000} Y${dy * 1000} F3000`, 'tx');
        S.m.anim = { pts: [], speed: 3000, state: 'jog', cont: [dx, dy] }; setState('jog');
      }
    });
    const release = () => { if (S.m.anim && S.m.anim.cont) { S.m.anim.cont = null; log('0x85 (cancelar jog)', 'tx'); } b.classList.remove('held'); };
    b.addEventListener('pointerup', release); b.addEventListener('pointercancel', release); b.addEventListener('lostpointercapture', release);
    b.addEventListener('click', () => {
      if ($('#jogCont').checked || S.m.state !== 'idle') return;
      const st = S.m.step; log(`$J=G91 X${nf(dx * st, 1)} Y${nf(dy * st, 1)} F3000`.replace(/,/g, '.'), 'tx');
      moveHead([[clamp(S.m.x + dx * st, 0, WA.w), clamp(S.m.y - dy * st, 0, WA.h)]], 3000, 'jog');
    });
  });
  $$('#steps button').forEach(b => b.addEventListener('click', () => { S.m.step = +b.dataset.step; $$('#steps button').forEach(x => x.classList.toggle('on', x === b)); }));
  function home() { if (!(S.m.state === 'idle' || S.m.state === 'alarm')) return; log('$H', 'tx'); moveHead([[0, WA.h]], 2400, 'home', () => { log('ok'); toast(t('toast.homed'), 'ok'); }); }
  function unlock() { log('$X', 'tx'); log('[MSG:Caution: Unlocked]'); log('ok'); hideBanner(); if (S.m.state === 'alarm') setState('idle'); toast(t('toast.unlocked'), 'warn'); }
  $('#btnUnlock').addEventListener('click', unlock);
  $('#bannerUnlock').addEventListener('click', unlock);
  $('#btnSetOrigin').addEventListener('click', () => { S.m.origin = [S.m.x, S.m.y]; log('G10 L20 P1 X0 Y0', 'tx'); log('ok'); toast(t('toast.origin'), 'ok'); dirty(); });
  $$('#customBtns [data-gcode]').forEach(b => b.addEventListener('click', () => {
    const g = b.dataset.gcode; log(g, 'tx'); log('ok');
    const m = g.match(/X([\d.]+) Y([\d.]+)/); if (m) moveHead([[+m[1], WA.h - m[2]]], 3000, 'jog');
  }));
  $('#jobOrigin').addEventListener('change', e => { S.m.jobOrigin = e.target.value; updateMachineUI(); changed(); });
  (function anchors() {
    const a = $('#anchor');
    for (let i = 0; i < 9; i++) a.append(el('button', { role: 'radio', 'aria-checked': String(i === S.m.anchor), 'aria-label': String(i + 1), onclick: () => { S.m.anchor = i; $$('#anchor button').forEach((b, j) => b.setAttribute('aria-checked', String(j === i))); dirty(); } }));
  })();

  // caixa do trabalho (com deslocamento da origem escolhida)
  function outputObjs() { return S.objects.filter(o => { const l = layerById(o.layer); return l && l.output && l.mode !== 'tool'; }); }
  function jobOffset(b) {
    if (S.m.jobOrigin === 'current') { const ax = b.x0 + (S.m.anchor % 3) * b.w / 2, ay = b.y0 + Math.floor(S.m.anchor / 3) * b.h / 2; return [S.m.x - ax, S.m.y - ay]; }
    if (S.m.jobOrigin === 'user' && S.m.origin) return [S.m.origin[0] - b.x0, S.m.origin[1] - b.y1];
    return [0, 0];
  }
  function jobBox() {
    const L = outputObjs(); if (!L.length) return null;
    const b = aabb(L), [dx, dy] = jobOffset(b);
    return { x0: b.x0 + dx, y0: b.y0 + dy, x1: b.x1 + dx, y1: b.y1 + dy, w: b.w, h: b.h, dx, dy };
  }

  // rasteriza um objeto em máscara e devolve trechos de varredura (mundo, mm)
  const mask = document.createElement('canvas'), mkx = mask.getContext('2d', { willReadFrequently: true });
  function rasterRows(o, interval, color) {
    const b = aabb([o]), R = 4, W = Math.ceil(b.w * R) + 2, H = Math.ceil(b.h * R) + 2;
    mask.width = W; mask.height = H; mkx.setTransform(R, 0, 0, R, -b.x0 * R + 1, -b.y0 * R + 1);
    mkx.translate(o.x, o.y); mkx.rotate(rad(o.rot)); mkx.fillStyle = '#000';
    if (o.type === 'text') { const m = measure(o.text); mkx.scale(o.w / m.w, o.h / m.h); mkx.font = TFONT; mkx.fillText(o.text, -m.w / 2 + m.L, m.h / 2 - m.D); }
    else if (o.type === 'image') { mkx.imageSmoothingEnabled = false; mkx.drawImage(processImage(o, '#000'), -o.w / 2, -o.h / 2, o.w, o.h); }
    else mkx.fill(localPath(o));
    const data = mkx.getImageData(0, 0, W, H).data, rows = [];
    let flip = false;
    for (let y = b.y0 + interval / 2; y < b.y1; y += interval) {
      const py = Math.floor((y - b.y0) * R + 1); if (py < 0 || py >= H) continue;
      const runs = []; let start = -1;
      for (let px = 0; px <= W; px++) {
        const on = px < W && data[(py * W + px) * 4 + 3] > 127;
        if (on && start < 0) start = px; if (!on && start >= 0) { runs.push([start, px]); start = -1; }
      }
      const seg = runs.map(([a, c]) => [b.x0 + (a - 1) / R, b.x0 + (c - 1) / R]);
      if (flip) seg.reverse().forEach(r => r.reverse());
      seg.forEach(([xa, xb]) => rows.push([[xa, y], [xb, y]]));
      if (seg.length) flip = !flip;
    }
    return rows;
  }
  /** Gera o plano do trabalho: segmentos (laser ligado/desligado), tempos e linhas de G-code. */
  function buildPlan() {
    const jb = jobBox(); if (!jb) return null;
    const segs = [], byLayer = {}; let pos = [S.m.x, S.m.y], t0 = 0;
    const push = (to, on, l, bw) => {
      const [x1, y1] = pos, len = Math.hypot(to[0] - x1, to[1] - y1); if (len < 1e-6) return;
      const speed = on ? l.speed : RAPID, dur = len / speed * 60;
      segs.push({ x1, y1, x2: to[0], y2: to[1], on, lid: l ? l.id : null, speed, power: l ? l.power : 0, bw: bw || 1, t0, dur });
      t0 += dur; if (l) byLayer[l.id] = (byLayer[l.id] || 0) + dur; pos = to;
    };
    const off = ([x, y]) => [x + jb.dx, y + jb.dy];
    for (const l of S.layers) {
      if (!l.output || l.mode === 'tool') continue;
      const objs = S.objects.filter(o => o.layer === l.id); if (!objs.length) continue;
      for (let p = 0; p < l.passes; p++) for (const o of objs) {
        if (l.mode === 'line' && o.type !== 'text' && o.type !== 'image') {
          const pts = outline(o).map(off); push(pts[0], false, l); for (let i = 1; i < pts.length; i++) push(pts[i], true, l, .3 * BURN_RES);
        } else {
          const iv = l.mode === 'image' ? .35 : Math.max(l.interval, .4);
          for (const [a, c] of rasterRows(o, iv)) { push(off(a), false, l); push(off(c), true, l, iv * BURN_RES); }
        }
      }
    }
    push(S.m.jobOrigin === 'abs' ? [0, WA.h] : [S.m.x, S.m.y], false, null);
    return { segs, total: t0 * 1.08, raw: t0, byLayer, lines: segs.length + 6, box: jb };
  }

  function updateJobUI() {
    const j = S.job, p = j ? Math.min(1, j.t / j.plan.raw) : 0, pct = Math.round(p * 100);
    const plan = j ? j.plan : (S.plan || null);
    $('#jobEst').textContent = plan ? fmtTime(plan.total) : '—';
    $('#progress .bar').style.width = pct + '%'; $('#progress .pct').textContent = pct + '%'; $('#progress').setAttribute('aria-valuenow', pct);
    $('#jobElapsed').textContent = j ? fmtTime(j.elapsed) : '0:00';
    const remain = j ? (j.plan.raw - j.t) * 1.08 : null;
    $('#jobRemain').textContent = j ? fmtTime(remain) : plan ? fmtTime(plan.total) : '—';
    $('#jobLayer').textContent = j && j.cur && j.cur.lid ? j.cur.lid.toUpperCase() : '—';
    $('#jobLine').textContent = j ? t('machine.line', { a: Math.min(j.plan.lines, j.idx + 6), b: j.plan.lines }) : '';
    const ro = $('#readout'), active = !!j;
    ro.classList.toggle('show', active);
    if (active) {
      ro.querySelector('.readout-pct').textContent = pct + '%';
      ro.querySelector('.readout-sub').textContent = `${fmtTime(remain)} · ${t('machine.remaining').toLowerCase()}${j.cur && j.cur.lid ? ' · ' + j.cur.lid.toUpperCase() : ''}`;
    }
    $('#sbProgress').innerHTML = active ? `<b>${pct}%</b> · ${fmtTime(remain)}` : '';
  }

  // contorno (frame)
  $('#btnFrame').addEventListener('click', () => {
    if (!connected()) return toast(t('toast.needConn'), 'warn');
    const jb = jobBox(); if (!jb) return toast(t('machine.noJob'), 'warn');
    const pts = [[jb.x0, jb.y0], [jb.x1, jb.y0], [jb.x1, jb.y1], [jb.x0, jb.y1], [jb.x0, jb.y0]];
    S.frameDash = pts; log(`(contorno ${nf(jb.w, 1)}×${nf(jb.h, 1)} mm, laser desligado)`, 'sys');
    pts.forEach(([x, y]) => log(`G0 X${x.toFixed(2)} Y${(WA.h - y).toFixed(2)}`, 'tx'));
    moveHead(pts, 3000 * clamp(+$('#simSpeed').value / 5, 1, 4), 'frame', () => toast(t('toast.frameDone'), 'ok'));
  });

  // início com confirmação de segurança
  const dlgPre = $('#dlgPreflight');
  let countdown = null;
  $('#btnStart').addEventListener('click', () => {
    if (!connected()) return toast(t('toast.needConn'), 'warn');
    const plan = (S.plan = buildPlan());
    if (!plan) return toast(t('machine.noJob'), 'warn');
    const nL = Object.keys(plan.byLayer).length;
    $('#preSum').textContent = t('preflight.summary', { n: nL, t: fmtTime(plan.total), w: fmtLen(plan.box.w, 1), h: fmtLen(plan.box.h, 1) }) + (S.units === 'in' ? ' (pol)' : '');
    openDlg(dlgPre);
    let s = 3; const fire = $('#btnFire'), lbl = $('#fireLbl');
    fire.disabled = true; lbl.textContent = t('preflight.wait', { s });
    clearInterval(countdown);
    countdown = setInterval(() => { s--; if (s <= 0) { clearInterval(countdown); fire.disabled = false; lbl.textContent = t('preflight.fire'); fire.focus(); } else lbl.textContent = t('preflight.wait', { s }); }, 1000);
  });
  dlgPre.addEventListener('close', () => clearInterval(countdown));
  $('#btnFire').addEventListener('click', () => { dlgPre.close(); startJob(); });

  function startJob(fromIdx) {
    const plan = S.plan || buildPlan(); if (!plan) return;
    if (!fromIdx) { bctx.clearRect(0, 0, burnCv.width, burnCv.height); }
    const idx = fromIdx || 0;
    S.job = { plan, idx, t: idx ? plan.segs[idx].t0 : 0, elapsed: 0, cur: plan.segs[idx], logT: 0 };
    if (idx) { const s = plan.segs[idx]; S.m.x = s.x1; S.m.y = s.y1; }
    hideBanner(); setState('run'); log(`(início: ${plan.lines} linhas, ${fmtTime(plan.total)})`, 'sys'); log('G90', 'tx'); log('M4 S0', 'tx');
    if (S.mode === 'design' && S.layout !== 'narrow') setMode('produce');
    updateJobUI();
  }
  function burnSeg(s) {
    if (!s.on) return;
    bctx.strokeStyle = C.burn; bctx.globalAlpha = .3 + .7 * s.power / 100; bctx.lineWidth = s.bw; bctx.lineCap = 'butt';
    bctx.beginPath(); bctx.moveTo(s.x1 * BURN_RES, s.y1 * BURN_RES); bctx.lineTo(s.x2 * BURN_RES, s.y2 * BURN_RES); bctx.stroke(); bctx.globalAlpha = 1;
  }
  function advanceJob(dt) {
    const j = S.job; if (!j || S.m.state !== 'run') return;
    j.elapsed += dt; // tempo de máquina
    j.t += dt; const segs = j.plan.segs;
    while (j.idx < segs.length && segs[j.idx].t0 + segs[j.idx].dur <= j.t) { burnSeg(segs[j.idx]); j.idx++; }
    if (j.idx >= segs.length) return finishJob();
    const s = segs[j.idx], f = clamp((j.t - s.t0) / s.dur, 0, 1);
    j.cur = s; S.m.x = s.x1 + (s.x2 - s.x1) * f; S.m.y = s.y1 + (s.y2 - s.y1) * f; S.m.laserOn = s.on;
    j.logT += dt; if (j.logT > 1.5) { j.logT = 0; log(`${s.on ? 'G1' : 'G0'} X${s.x2.toFixed(2)} Y${(WA.h - s.y2).toFixed(2)}${s.on ? ' S' + s.power * 10 : ''}`, 'tx'); log('ok', 'rx st'); log(statusLine(), 'rx st'); }
  }
  function finishJob() {
    const j = S.job; S.job = null; S.m.laserOn = false; setState('idle'); log('M5', 'tx'); log('ok');
    updateJobUI(); toast(t('toast.jobDone', { t: fmtTime(j.plan.total) }), 'ok');
    const p = $('#progress'); p.querySelector('.bar').style.width = '100%'; p.querySelector('.pct').textContent = '100%';
  }
  function pauseJob() { if (S.m.state === 'run') { setState('hold'); log('!', 'tx'); } else if (S.m.state === 'hold') { setState('run'); log('~', 'tx'); } }
  $('#btnPause').addEventListener('click', pauseJob);
  $('#btnStop').addEventListener('click', () => {
    if (S.m.state === 'frame') { S.m.anim = null; S.frameDash = null; setState('idle'); return; }
    if (!S.job) return; S.job = null; log('0x18 (abortar) · M5', 'tx'); setState('idle'); updateJobUI(); toast(t('toast.stopped'), 'warn');
  });
  function estop() {
    $$('dialog[open]').forEach(d => d.close());
    if (!connected()) { toast(t('toast.estop'), 'err'); return; }
    const j = S.job; S.m.anim = null; S.frameDash = null; log('0x18 (reset por software)', 'err');
    setState('alarm'); toast(t('toast.estop'), 'err');
    if (j) raiseIssue('estop', j); else showBanner(t('estop.title'), t('toast.estop'), false);
  }
  $('#estop').addEventListener('click', estop);

  // falhas simuladas e recuperação (lógica herdada do ResumeJobForm do LaserGRBL)
  function raiseIssue(kind, j) {
    S.m.issue = { kind, exec: j.idx, sent: Math.min(j.plan.segs.length - 1, j.idx + 14), plan: j.plan, wco: S.m.origin };
    S.job = null; S.m.laserOn = false; updateJobUI();
    const line = j.idx + 6;
    if (kind === 'alarm') { log('ALARM:1', 'err'); showBanner(t('alarm.title'), t('alarm.body', { n: line }), true); }
    if (kind === 'disc') { showBanner(t('disc.title'), t('disc.body', { n: line }), true); }
    if (kind === 'estop') showBanner(t('estop.title'), t('estop.body', { n: line }), true);
  }
  $('#simAlarm').addEventListener('click', () => { if (!S.job) return; const j = S.job; setState('alarm'); raiseIssue('alarm', j); });
  $('#simDisc').addEventListener('click', () => { if (!S.job) return; const j = S.job; raiseIssue('disc', j); setState('offline'); log('(conexão perdida)', 'err'); });
  function showBanner(title, body, canRecover) {
    $('#bannerTitle').textContent = title; $('#bannerBody').textContent = body; $('#banner').hidden = false;
    $('#bannerRecover').hidden = !canRecover; $('#bannerUnlock').hidden = S.m.state !== 'alarm';
  }
  function hideBanner() { $('#banner').hidden = true; }
  $('#bannerRecover').addEventListener('click', () => {
    if (!connected()) { S.m.pendingRecover = true; connect(); return; }
    openRecover();
  });
  function openRecover() {
    const is = S.m.issue; if (!is) return;
    const some = Math.max(0, is.exec - 17), lines = n => n + 6;
    $('#recCause').textContent = t('cause.' + is.kind);
    const box = $('#recOpts'); box.innerHTML = '';
    const rec = is.kind === 'disc' ? 'sent' : 'before';
    const opt = (v, label, extra) => {
      const r = el('input', { type: 'radio', name: 'rec', value: v }); if (v === rec) r.checked = true;
      box.append(el('label', {}, [r, el('span', { text: label }), v === rec ? el('span', { class: 'tag', text: t('recover.recommended') }) : null, extra || null]));
    };
    opt('start', t('recover.fromStart'));
    opt('before', t('recover.fromBefore', { n: lines(some) }));
    opt('sent', t('recover.fromSent', { n: lines(is.sent) }));
    let custom = lines(is.exec);
    opt('line', t('recover.fromLine'), numField({ label: '#', kind: 'raw', min: 1, max: is.plan.lines, step: 1, get: () => custom, set: v => { custom = Math.round(v); box.querySelector('[value=line]').checked = true; } }));
    $('#recHoming').checked = is.kind !== 'disc';
    const w = is.wco || [0, WA.h];
    $('#recWcoLbl').textContent = t('recover.wco', { x: fmtLen(w[0], 1), y: fmtLen(WA.h - w[1], 1) });
    $('#btnRecoverGo').onclick = () => {
      const v = box.querySelector('input[name=rec]:checked').value;
      const idx = { start: 0, before: some, sent: is.sent, line: Math.max(0, custom - 6) }[v];
      $('#dlgRecover').close(); S.m.issue = null;
      const go = () => { S.plan = is.plan; startJob(Math.min(idx, is.plan.segs.length - 1)); };
      if (S.m.state === 'alarm') { log('$X', 'tx'); setState('idle'); }
      if ($('#recHoming').checked) home2(go); else go();
    };
    openDlg($('#dlgRecover'));
  }
  function home2(fn) { log('$H', 'tx'); moveHead([[0, WA.h]], 2400 * 4, 'home', () => { log('ok'); fn(); }); }

  // ================================================================ 7. LAYOUT, TEMA, IDIOMA
  function setMode(m) {
    if (S.layout === 'narrow') m = 'produce';
    S.mode = m; root.dataset.mode = m;
    $$('.mode-switch button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.mode === m)));
    if (m === 'produce') { setTool('select'); showPanel('machine'); }
    else showPanel(S.panel === 'machine' || S.panel === 'console' || (S.layout === 'wide' && S.panel === 'layers') ? (S.layout === 'wide' ? 'object' : 'layers') : S.panel, true);
    requestAnimationFrame(() => { resizeCanvas(); });
    dirty();
  }
  $$('.mode-switch button').forEach(b => b.addEventListener('click', () => setMode(b.dataset.mode)));
  function showPanel(p, quiet) {
    if (S.layout === 'wide' && S.mode === 'design' && p === 'layers') p = 'object';
    S.panel = p;
    $$('.dock-tabs [role=tab]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.panel === p)));
    $$('.panel').forEach(s => s.classList.toggle('show', s.dataset.panel === p));
    $$('#dockrail [data-panel]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.panel === p && $('#dock').classList.contains('open'))));
    if (S.layout === 'medium' && S.mode === 'design' && !quiet) openDrawer(true);
  }
  function openDrawer(open) {
    $('#dock').classList.toggle('open', open); $('#scrim').hidden = !open;
    $$('#dockrail [data-panel]').forEach(b => b.setAttribute('aria-pressed', String(open && b.dataset.panel === S.panel)));
  }
  $$('.dock-tabs [role=tab]').forEach(b => b.addEventListener('click', () => showPanel(b.dataset.panel)));
  $$('#dockrail [data-panel]').forEach(b => b.addEventListener('click', () => {
    if ($('#dock').classList.contains('open') && S.panel === b.dataset.panel) openDrawer(false); else showPanel(b.dataset.panel);
  }));
  $('#dockClose').addEventListener('click', () => openDrawer(false));
  $('#scrim').addEventListener('click', () => openDrawer(false));
  $('#stateChip').addEventListener('click', () => showPanel('machine'));

  function applyLayout() {
    const w = innerWidth, lay = w >= 1180 ? 'wide' : w >= 820 ? 'medium' : 'narrow';
    if (lay === S.layout && root.dataset.layout) return;
    const prev = S.layout; S.layout = lay; root.dataset.layout = lay;
    if (lay !== 'medium') openDrawer(false);
    if (lay === 'narrow') setMode('produce');
    else if (prev === 'narrow' && S.wantMode) setMode(S.wantMode);
    else setMode(S.mode);
    if (lay === 'narrow' && !$('#estop2')) {
      const e2 = $('#estop').cloneNode(true); e2.id = 'estop2'; e2.addEventListener('click', estop); $('#bottombar').append(e2);
    }
    firstFit = true; requestAnimationFrame(resizeCanvas);
  }
  addEventListener('resize', applyLayout);

  function setDensity(d) {
    if (S.density === d && root.dataset.density === d) return;
    S.density = d; root.dataset.density = d; readColors();
    requestAnimationFrame(() => { resizeCanvas(); renderPalette(); });
  }
  function applyTheme() {
    root.dataset.theme = S.theme; if (S.contrast) root.dataset.contrast = 'high'; else delete root.dataset.contrast;
    readColors(); S.objects.forEach(o => delete o._pc); renderPalette(); renderLayers(); buildInspector(); dirty();
  }
  function applyLang() {
    store.set('lang', FK.lang); FK.applyI18n();
    $$('.dock-tabs [role=tab]').forEach(b => { const n = b.textContent.trim(); b.title = n; b.setAttribute('aria-label', n); }); Object.keys(mcache).forEach(k => delete mcache[k]);
    setState(S.m.state); renderLayers(); buildInspector(); renderPalette(); buildShortcuts(); updateJobUI(); updateStatus(); $('#sbUnits').textContent = unitLbl();
    if (S.m.fw) $('#connInfo').textContent = t('machine.detected', { fw: S.m.fw, w: WA.w, h: WA.h });
    document.title = 'FreeKerf — ' + t('file.name');
  }
  function updateStatus() {
    const F = selFrame();
    $('#sbSel').textContent = F ? `${fmtLen(F.w, 1)} × ${fmtLen(F.h, 1)} ${unitLbl()}` : '—';
    $('#sbZoom').textContent = Math.round(S.view.scale / (96 / 25.4) * 100) + '%';
    $('#sbInput').innerHTML = FK.icon(S.input === 'touch' ? 'touch' : 'mouse') + `<span>${S.densityPref === 'auto' ? t('sb.auto') : ''}</span>`;
    updateDRO();
  }
  $('#sbUnits').addEventListener('click', () => setUnits(S.units === 'mm' ? 'in' : 'mm'));
  function setUnits(u) { S.units = u; store.set('units', u); $('#sbUnits').textContent = unitLbl(); buildInspector(); renderLayers(); updateStatus(); syncSettings(); dirty(); }

  // configurações
  const dlgSet = $('#dlgSettings');
  function syncSettings() {
    const mark = (sel, v) => $$(sel + ' button').forEach(b => b.classList.toggle('on', b.dataset.v === v));
    mark('#setTheme', S.theme); mark('#setDensity', S.densityPref); mark('#setLang', FK.lang); mark('#setUnits', S.units);
    $('#setContrast').checked = S.contrast;
  }
  $('#btnSettings').addEventListener('click', () => { syncSettings(); openDlg(dlgSet); });
  $$('#setTheme button').forEach(b => b.addEventListener('click', () => { S.theme = b.dataset.v; store.set('theme', S.theme); applyTheme(); syncSettings(); }));
  $('#setContrast').addEventListener('change', e => { S.contrast = e.target.checked; store.set('contrast', S.contrast); applyTheme(); });
  $$('#setDensity button').forEach(b => b.addEventListener('click', () => {
    S.densityPref = b.dataset.v; store.set('density', S.densityPref);
    setDensity(S.densityPref === 'auto' ? (S.input === 'touch' || matchMedia('(pointer:coarse)').matches ? 'comfortable' : 'compact') : S.densityPref); syncSettings(); updateStatus();
  }));
  $$('#setLang button').forEach(b => b.addEventListener('click', () => { FK.lang = b.dataset.v; applyLang(); syncSettings(); }));
  $$('#setUnits button').forEach(b => b.addEventListener('click', () => setUnits(b.dataset.v)));
  $('#btnShortcuts').addEventListener('click', () => { dlgSet.close(); openDlg($('#dlgShortcuts')); });
  $('#btnWelcomeAgain').addEventListener('click', () => { dlgSet.close(); openWelcome(); });

  function buildShortcuts() {
    const rows = [
      ['kb.g.tools', [['V', 'obj.type.select'], ['R', 'obj.type.rect'], ['E', 'obj.type.ellipse'], ['T', 'obj.type.text']]],
      ['kb.g.edit', [['Ctrl+Z', 'kb.undo'], ['Ctrl+Shift+Z · Ctrl+Y', 'kb.redo'], ['Ctrl+D', 'kb.dup'], ['Del', 'kb.del'], ['Ctrl+A', 'kb.all'], ['← ↑ → ↓', 'kb.nudge'], ['Shift / Alt', 'kb.constrain'], ['Esc', 'kb.esc']]],
      ['kb.g.view', [['+ / −', 'kb.zoom'], ['F · Ctrl+0', 'kb.fit'], ['Espaço · botão do meio', 'kb.pan'], ['Roda · Ctrl+roda', 'kb.wheel'], ['Ctrl+1 / Ctrl+2', 'kb.mode']]],
      ['kb.g.machine', [['F5', 'kb.start'], ['F6', 'kb.pause'], ['F7', 'kb.frame'], ['Esc', 'kb.hold'], ['Shift+Esc', 'kb.estop']]]
    ];
    const tb = $('#kbdTable'); tb.innerHTML = '';
    rows.forEach(([g, items]) => {
      tb.append(el('tr', {}, [el('th', { colspan: 2, text: t(g) })]));
      items.forEach(([k, d]) => tb.append(el('tr', {}, [el('td', { html: k.split(' · ').map(x => `<kbd>${x}</kbd>`).join(' ') }), el('td', { text: d === 'obj.type.select' ? t('tool.select').replace(/\s*\(.*\)$/, '') : t(d) })])));
    });
  }

  // diálogos
  // Não usamos showModal(): ele tornaria o PARAR inerte. Fundo e foco são geridos aqui.
  const backdrop = el('div', { class: 'dlg-backdrop', hidden: true }); document.body.append(backdrop);
  let dlgReturn = null;
  function openDlg(d) {
    if (d.open) return;
    $$('dialog[open]').forEach(x => x.close());
    const tb = $('.topbar').getBoundingClientRect().height, bb = $('#bottombar').offsetHeight || 0;
    root.style.setProperty('--top-h', tb + 'px'); root.style.setProperty('--bottom-h', bb + 'px');
    dlgReturn = document.activeElement; backdrop.hidden = false; d.show();
    const f = d.querySelector('[autofocus], input, select, textarea, button:not([data-close]):not([disabled])') || d.querySelector('button');
    if (f) f.focus();
  }
  $$('dialog').forEach(d => d.addEventListener('close', () => {
    if (!$('dialog[open]')) { backdrop.hidden = true; if (dlgReturn && dlgReturn.focus) dlgReturn.focus(); }
  }));
  backdrop.addEventListener('click', () => { const d = $('dialog[open]'); if (d && d.id !== 'dlgPreflight') d.close(); });
  document.addEventListener('keydown', e => {
    const d = $('dialog[open]'); if (!d || e.key !== 'Escape' || e.shiftKey) return;
    e.preventDefault(); e.stopImmediatePropagation(); d.close();
  }, true);
  $$('dialog [data-close]').forEach(b => b.addEventListener('click', () => b.closest('dialog').close()));

  // toasts
  function toast(msg, kind) {
    const icon = { ok: 'check', warn: 'warn', err: 'warn', info: 'info' }[kind] || 'info';
    const n = el('div', { class: 'toast ' + (kind || ''), role: kind === 'err' ? 'alert' : 'status' }, [ico(icon), el('span', { text: msg })]);
    $('#toasts').append(n); setTimeout(() => n.remove(), kind === 'err' ? 6000 : 3500);
    while ($('#toasts').childElementCount > 3) $('#toasts').firstChild.remove();
  }

  // ferramentas e botões genéricos
  $$('.tool[data-tool]').forEach(b => b.addEventListener('click', () => (b.dataset.stub ? stub(b.dataset.stub) : setTool(b.dataset.tool))));
  $$('[data-stub]:not([data-tool])').forEach(b => b.addEventListener('click', () => stub(b.dataset.stub)));
  const ACTS = { undo, redo, array: arrayGrid, zoomIn: () => zoomAt(CW / 2, CH / 2, 1.25), zoomOut: () => zoomAt(CW / 2, CH / 2, .8), fit };
  $$('[data-act]').forEach(b => b.addEventListener('click', () => ACTS[b.dataset.act]()));
  $('#btnMulti').addEventListener('click', e => { S.multi = !S.multi; e.currentTarget.setAttribute('aria-pressed', String(S.multi)); });
  $('#btnMarquee').addEventListener('click', e => { S.marquee = !S.marquee; e.currentTarget.setAttribute('aria-pressed', String(S.marquee)); });
  $$('[data-proxy]').forEach(b => b.addEventListener('click', () => $('#' + b.dataset.proxy).click()));

  // ---- boas-vindas / primeira execução
  const dlgW = $('#dlgWelcome');
  const W = { kind: 'diode', conn: 'sim', step: 'home' };
  const MARK = '<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="9" y="8" width="13" height="48" rx="2" fill="currentColor"/><path d="M43 8H57L39.5 32 57 56H43L25.5 32Z" fill="var(--fk-color-accent)"/><rect x="23" y="2" width="1.5" height="60" rx=".75" fill="var(--fk-color-accent)" opacity=".75"/></svg>';
  function welStep(step) {
    W.step = step; const box = $('#welSteps'); box.innerHTML = '';
    const order = ['kind', 'conn', 'ready'], dots = el('div', { class: 'wel-dots', 'aria-hidden': 'true' }, order.map(s => el('i', { class: s === step ? 'on' : '' })));
    const card = (icon, title, sub, on, fn) => el('button', { class: 'wel-card' + (on ? ' on' : ''), onclick: fn, 'aria-pressed': on == null ? null : String(!!on) }, [ico(icon), el('b', { text: title }), sub ? el('small', { text: sub }) : null]);
    const foot = (back, next, nextLbl, extra) => el('div', { class: 'wel-foot' }, [
      back ? el('button', { class: 'btn', onclick: back, html: FK.icon('chevLeft') + `<span>${t('welcome.back')}</span>` }) : el('span'),
      extra || dots,
      next ? el('button', { class: 'btn primary', onclick: next, html: `<span>${nextLbl || t('welcome.next')}</span>` + FK.icon('chevRight') }) : el('span')
    ]);
    const s = el('div', { class: 'wel' });
    if (step === 'home') {
      s.append(el('div', { class: 'wel-hero', html: MARK }, [el('div', {}, [el('h2', { id: 'hWel', text: t('welcome.title') }), el('p', { text: t('welcome.sub') })])]));
      s.append(el('div', { class: 'wel-actions' }, [
        card('machine', t('welcome.setup'), t('welcome.kind.diode') + ' · ' + t('welcome.kind.co2'), null, () => welStep('kind')),
        card('import', t('welcome.migrate'), t('welcome.mig.2'), null, () => welStep('migrate')),
        card('sparkle', t('welcome.explore'), t('welcome.conn.sim'), null, () => { W.conn = 'sim'; closeWelcome(true); })
      ]));
      s.append(el('div', { class: 'wel-foot' }, [el('p', { class: 'wel-origin', text: t('welcome.origin') }), el('button', { class: 'btn', text: t('welcome.skip'), onclick: () => closeWelcome(false) })]));
    }
    if (step === 'kind') {
      s.append(el('h2', { id: 'hWel', text: t('welcome.kindTitle') }));
      s.append(el('div', { class: 'wel-actions' }, [
        card('laser', t('welcome.kind.diode'), t('welcome.kind.diodeSub'), W.kind === 'diode', () => { W.kind = 'diode'; welStep('kind'); }),
        card('flame', t('welcome.kind.co2'), t('welcome.kind.co2Sub'), W.kind === 'co2', () => { W.kind = 'co2'; welStep('kind'); }),
        card('gear', t('welcome.kind.other'), t('welcome.kind.otherSub'), W.kind === 'other', () => { W.kind = 'other'; welStep('kind'); })
      ]));
      s.append(el('div', { class: 'field' }, [el('label', { text: t('welcome.area') }), el('div', { class: 'area-row' }, [
        numField({ label: 'X', kind: 'len', min: 50, max: 2000, step: 10, get: () => WA.w, set: v => { WA.w = Math.round(v); } }), el('span', { text: '×' }),
        numField({ label: 'Y', kind: 'len', min: 50, max: 2000, step: 10, get: () => WA.h, set: v => { WA.h = Math.round(v); } })])]));
      s.append(foot(() => welStep('home'), () => welStep('conn')));
    }
    if (step === 'conn') {
      s.append(el('h2', { id: 'hWel', text: t('welcome.connTitle') }));
      const list = el('div', { class: 'found' }, [el('p', { class: 'wel-search', text: t('welcome.searching') })]);
      s.append(list);
      setTimeout(() => {
        if (W.step !== 'conn') return; list.innerHTML = ''; list.append(el('p', { class: 'hint', text: t('welcome.found') }));
        [['sim', 'sparkle', 'welcome.conn.sim'], ['usb', 'usb', 'welcome.conn.usb'], ['wifi', 'wifi', 'welcome.conn.wifi']].forEach(([v, i, k]) => {
          const r = el('input', { type: 'radio', name: 'welconn', value: v, onchange: () => (W.conn = v) }); r.checked = W.conn === v;
          list.append(el('label', {}, [r, ico(i), el('span', { text: t(k) })]));
        });
      }, Q.has('shot') ? 0 : 900);
      s.append(foot(() => welStep('kind'), () => welStep('ready')));
    }
    if (step === 'migrate') {
      s.append(el('h2', { id: 'hWel', text: t('welcome.migrateTitle') }));
      s.append(el('p', { text: t('welcome.migrateNote') }));
      const list = el('div', { class: 'found' });
      for (let i = 1; i <= 5; i++) { const c = el('input', { type: 'checkbox' }); c.checked = true; list.append(el('label', {}, [c, el('span', { text: t('welcome.mig.' + i) })])); }
      s.append(list);
      s.append(foot(() => welStep('home'), () => { toast(t('toast.migrated'), 'ok'); W.conn = 'usb'; welStep('ready'); }, t('welcome.migrateGo')));
    }
    if (step === 'ready') {
      s.append(el('div', { class: 'wel-hero', html: MARK }, [el('div', {}, [el('h2', { id: 'hWel', text: t('welcome.ready') }), el('p', { text: t('welcome.readySub') })])]));
      s.append(foot(() => welStep('conn'), () => closeWelcome(true), t('welcome.finish')));
    }
    box.append(s);
  }
  function openWelcome() { welStep('home'); openDlg(dlgW); }
  function closeWelcome(doConnect) {
    store.set('welcomed', true); dlgW.close();
    burnCv.width = WA.w * BURN_RES; burnCv.height = WA.h * BURN_RES; S.m.y = Math.min(S.m.y, WA.h); S.plan = buildPlan(); updateJobUI();
    firstFit = true; resizeCanvas();
    if (doConnect) { $('#port').value = W.conn; if (!connected()) connect(); }
  }

  // ================================================================ LAÇO PRINCIPAL
  let last = performance.now(), uiT = 0;
  function loop(now) {
    const dt = Math.min(.1, (now - last) / 1000); last = now;
    if (S.m.anim) stepAnim(dt);
    if (S.job && S.m.state === 'run') { advanceJob(dt * (+$('#simSpeed').value || 1)); dirty(); uiT += dt; if (uiT > .2) { uiT = 0; updateJobUI(); updateDRO(); } }
    if (needDraw) draw();
    requestAnimationFrame(loop);
  }

  // ================================================================ INÍCIO
  function init() {
    $$('[data-icon]').forEach(e => e.insertAdjacentHTML('afterbegin', FK.icon(e.dataset.icon)));
    root.dataset.theme = S.theme; if (S.contrast) root.dataset.contrast = 'high';
    setDensity(S.densityPref === 'auto' ? (matchMedia('(pointer:coarse)').matches ? 'comfortable' : 'compact') : S.densityPref);
    if (matchMedia('(pointer:coarse)').matches) S.input = 'touch';
    readColors();
    loadDemo();
    applyLayout();
    S.wantMode = Q.get('mode') || 'design';
    setMode(S.layout === 'narrow' ? 'produce' : S.wantMode);
    $('.mode-switch').addEventListener('click', e => { const b = e.target.closest('button'); if (b) S.wantMode = b.dataset.mode; });
    setTool('select'); applyLang(); renderLayers(); renderPalette(); buildInspector(); buildShortcuts();
    $('.file-dirty').style.visibility = 'hidden';
    S.plan = buildPlan(); renderLayers(); updateJobUI();
    new ResizeObserver(resizeCanvas).observe($('#stage'));
    resizeCanvas();
    requestAnimationFrame(loop);
    setTimeout(() => document.body.classList.add('ready'), 400);
    log('FreeKerf — protótipo de interface. Máquina simulada.', 'sys');

    // estados para testes/screenshots: ?demo=run|alarm|preflight|recover|jog &sel=text &panel=…
    const demo = Q.get('demo');
    if (Q.get('sel') === 'text') setSel([S.objects.find(o => o.type === 'text').id]);
    if (Q.get('sel') === 'image') setSel([S.objects.find(o => o.type === 'image').id]);
    if (Q.get('sel') === 'multi') setSel(S.objects.filter(o => o.layer === 'c01').map(o => o.id));
    if (demo) {
      connect(true);
      if (demo === 'run' || demo === 'alarm' || demo === 'recover' || demo === 'hold') {
        S.plan = buildPlan(); startJob();
        const target = S.job.plan.raw * (demo === 'run' || demo === 'hold' ? .46 : .3);
        while (S.job && S.job.t < target) advanceJob(5);
        updateJobUI(); updateDRO();
        if (demo === 'hold') pauseJob();
        if (demo === 'alarm' || demo === 'recover') { const j = S.job; setState('alarm'); raiseIssue('alarm', j); if (demo === 'recover') openRecover(); }
      }
      if (demo === 'preflight') $('#btnStart').click();
    }
    if (Q.get('panel')) { if (S.layout === 'medium' && S.mode === 'design') showPanel(Q.get('panel')); else showPanel(Q.get('panel'), true); }
    const wel = Q.get('welcome');
    if (wel === '1' || (wel == null && !store.get('welcomed', false))) { openWelcome(); if (Q.get('wstep')) welStep(Q.get('wstep')); }
  }
  // espera as fontes para medir o texto corretamente (com limite de tempo)
  const fontsReady = document.fonts ? Promise.all([document.fonts.load(TFONT), document.fonts.load('400 13px Inter'), document.fonts.load('400 12px "JetBrains Mono"')]).then(() => document.fonts.ready) : Promise.resolve();
  Promise.race([fontsReady, new Promise(r => setTimeout(r, 1500))]).then(init, init);
  FK.debug = S;
})();
