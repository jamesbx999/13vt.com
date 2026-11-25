// BeatVibe Studio — "One Drop" · Watercolor Brush
// One painted sheet: a drop becomes a sound line; the line becomes a night skyline that bursts alight,
// is washed away by mist, and becomes the still horizon of a lake with a lotus; pull back to the whole sheet.
// Everything is a pure function of t. Strokes built inside render() use withSeed.
const cv = document.getElementById('c'), ctx = cv.getContext('2d');
window.DUR = 45.0;
let TL, VODUR, PAPER_IMG;
const ACC = '#c8442a';                 // the one accent: the drop, the beat marker, the seal
const LINEC = '#2b2f45';               // ink-indigo for the sound line
const GOLD = ['#e9b24a', '#f2c76a', '#e39a52'];
const NIGHT = ['#3e4a6b', '#4a5578', '#56628a', '#45506f'];
const BEAT = 2 / 3, B0 = 5.3333;

// ---------- camera (world → screen: (w - cam) * Z + centre) ----------
const camX = monotone([[0, 1100], [5.33, 1100], [13.33, 3000], [18.67, 4300], [21.33, 5000], [27.5, 7000], [34.67, 7300], [37.0, 4450], [45, 4450]]);
const camY = monotone([[0, 560], [19.2, 560], [21.8, 420], [23.2, 420], [27.5, 640], [34.67, 690], [37.0, 880], [45, 880]]);
const camZ = monotone([[0, 1.0], [5.33, 1.04], [8, 1.0], [13.33, 1.0], [18.67, 1.15], [21.33, 1.0], [27.5, 1.0], [34.67, 1.9], [37.0, .21], [45, .21]]);
const LHk = monotone([[0, 760], [.9, 760], [5.33, 2350], [13.33, 4300], [18.67, 5600], [21.33, 6200], [27.5, 8200], [34.67, 8300], [36.6, 9050]]);
const cam = t => ({ x: camX(t), y: camY(t), z: camZ(t) });
const toS = (c, wx, wy) => [(wx - c.x) * c.z + 960, (wy - c.y) * c.z + 540];
function worldT(c) { ctx.setTransform(c.z, 0, 0, c.z, 960 - c.x * c.z, 540 - c.y * c.z); }
function screenT() { ctx.setTransform(1, 0, 0, 1, 0, 0); }

// ---------- world contents ----------
const DROP = [760, 600];
const CITY0 = 1900, CITY1 = 5200, BASE = 720;
let FRONT = [], BACK = [], LINE = [], CHUNKS = [], SKY_N, GLOW, STREET, LAKE = {}, LOTUS, BLOOM;

function wave(x) {
  if (x < CITY0) return 600 + 30 * ss((x - 760) / 500) * Math.sin((x - 760) * 2 * Math.PI / 120);
  if (x < 6200) return 600 + 30 * (1 - ss((x - CITY1) / 1000)) * Math.sin((x - 760) * 2 * Math.PI / 120);
  return 600 + 2 * Math.sin(x * .021) + 1.2 * Math.sin(x * .053);
}
function roofAt(x) { for (const b of FRONT) if (x >= b.x0 && x < b.x1) return b.top; return null; }
function lineAt(x) { const r = roofAt(x); return r !== null ? r : wave(x); }

function buildCity() {
  // front row: contiguous blocks, taller toward the centre of the city
  let x = CITY0 + 10;
  while (x < CITY1 - 60) {
    const w = Math.min(rnd(95, 190), CITY1 - x), mid = 1 - Math.abs((x + w / 2 - 3500) / 1700);
    const top = BASE - (rnd() < .22 ? rnd(70, 120) : 120 + 210 * clamp(mid) + rnd(-50, 60));
    FRONT.push({ x0: x, x1: x + w, top, base: BASE, kind: 'front' }); x += w;
  }
  FRONT[FRONT.length - 1].x1 = CITY1;
  // back row: paler, set between the front tops
  for (let x = CITY0 + 60; x < CITY1 - 120; x += rnd(90, 170)) {
    const w = rnd(80, 150), f = roofAt(x + w / 2) ?? BASE - 200;
    BACK.push({ x0: x, x1: x + w, top: Math.min(f - rnd(40, 140), BASE - 120), base: BASE - 20, kind: 'back' });
  }
  for (const b of [...BACK, ...FRONT]) {
    const w = b.x1 - b.x0, n = Math.max(2, Math.ceil(w / 34)), back = b.kind === 'back';
    b.S = [];
    for (let i = 0; i < n; i++) {
      const xx = b.x0 + (i + .5) * w / n;
      b.S.push(mk(qcurve(xx + rnd(-2, 2), b.base, xx + rnd(-2, 2), b.top + 6, rnd(-3, 3), 10), w / n * 1.3,
        back ? '#8e96b0' : pick(NIGHT), { prof: 'even', nb: 4, a: back ? .5 : .82, rough: .18 }));
    }
    if (!back) b.S.push(edgeOf(b.S[n - 1], 1, 4, '#262c44', .6));
    b.spr = sprite(b.S);
    // windows
    b.W = []; b.pre = [];
    const cols = Math.max(1, Math.floor((w - 24) / (back ? 26 : 22))), x0 = b.x0 + (w - (cols - 1) * (back ? 26 : 22)) / 2;
    for (let y = b.top + 26; y < b.base - 40; y += back ? 34 : 30) for (let c = 0; c < cols; c++) {
      if (rnd() < (back ? .55 : .42)) continue;
      const xx = x0 + c * (back ? 26 : 22) + rnd(-1.5, 1.5), s = mk(qcurve(xx, y, xx + rnd(-1, 1), y + (back ? 9 : 13), 0, 3), back ? 7 : 9.5, pick(GOLD), { prof: 'even', nb: 0, a: back ? .7 : .92, rough: .3 });
      s.delay = rnd(0, .75); s.pre = rnd() < .14; b.W.push(s);
    }
    b.wspr = b.W.length ? sprite(b.W) : null;
    const pl = b.W.filter(s => s.pre); b.pspr = pl.length ? sprite(pl) : null;
  }
  // night sky wash behind the city, a warm glow for the burst, and the street
  const S = [];
  for (let y = 210; y < 720; y += rnd(26, 40)) {
    const f = (y - 210) / 510;
    for (let x = CITY0 - 300 + rnd(-200, 0); x < CITY1 + 200; x += rnd(280, 460)) S.push(mk(qcurve(x, y + rnd(-8, 8), x + rnd(380, 620), y + rnd(-10, 10), rnd(-14, 14), 14), rnd(36, 56), mixc('#b9c0d3', '#7a84a4', f), { prof: 'brush', nb: 5, a: (.12 + .26 * f) * rnd(.7, 1.1), rough: .3 }));
  }
  SKY_N = fadeEdges(sprite(S), 420, 160, 0);
  const G = [];
  for (let y = 420; y < 720; y += 26) for (let x = CITY0; x < CITY1; x += 380) G.push(mk(qcurve(x, y, x + rnd(400, 520), y + rnd(-5, 5), rnd(-6, 6), 12), 40, pick(['#efc27a', '#f0b26a', '#e9a37a']), { prof: 'brush', nb: 4, a: .16 + .2 * (y - 420) / 300, rough: .3 }));
  GLOW = fadeEdges(sprite(G), 300, 120, 0);
  const St = [];
  for (let k = 0; k < 3; k++) for (let x = CITY0 - 40; x < CITY1 + 40; x += 400) St.push(mk(qcurve(x, BASE + 4 + k * 14, x + rnd(420, 520), BASE + 4 + k * 14 + rnd(-4, 4), rnd(-4, 4), 12), 22, '#3a4262', { prof: 'brush', nb: 5, a: .45 - k * .12, rough: .3 }));
  STREET = fadeEdges(sprite(St), 260);
}

function buildLine() {
  const P = [];
  for (let x = DROP[0]; x < CITY0; x += 6) P.push([x, wave(x)]);
  // the skyline: up, along each roof, down/up at each step
  let y = wave(CITY0);
  for (const b of FRONT) {
    for (let yy = y; Math.abs(yy - b.top) > 6; yy += Math.sign(b.top - yy) * 6) P.push([b.x0 + rnd(-.6, .6), yy]);
    for (let x = b.x0; x < b.x1; x += 6) P.push([x, b.top + rnd(-.8, .8)]);
    y = b.top;
  }
  const yEnd = wave(CITY1);
  for (let yy = y; Math.abs(yy - yEnd) > 6; yy += Math.sign(yEnd - yy) * 6) P.push([CITY1 + rnd(-.6, .6), yy]);
  for (let x = CITY1; x <= 9050; x += 6) P.push([x, wave(x)]);
  LINE = P;
  for (let i = 0; i < P.length - 1; i += 46) {
    const pts = P.slice(i, Math.min(P.length, i + 50)); if (pts.length < 3) break;
    const k = i / 46, col = k < 3 ? mixc(ACC, LINEC, k / 3) : LINEC;
    const s = mk(pts, 6.5, col, { prof: 'even', nb: 3, a: .9, rough: .25 });
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; for (const [px, py] of pts) { x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py); }
    CHUNKS.push({ s, x0, x1, y0: y0 - 10, y1: y1 + 10, i0: i, n: pts.length, xs: pts.map(p => p[0]) });
  }
}

function buildBloom() {
  // an irregular pooled ring for the drop, as unit shapes scaled at draw time
  BLOOM = [];
  for (let L = 0; L < 4; L++) {
    const pts = [], k = 1 - L * .2;
    for (let a = 0; a < 40; a++) { const th = a / 40 * Math.PI * 2, r = k * (1 + .18 * (fbm(a * .4 + L * 7) - .5) * 2); pts.push([Math.cos(th) * r * 1.25, Math.sin(th) * r * .8]); }
    BLOOM.push(pts);
  }
  BLOOM.spl = []; for (let i = 0; i < 14; i++) { const th = rnd(0, 7), r = rnd(1.1, 1.8); BLOOM.spl.push([Math.cos(th) * r * 1.25, Math.sin(th) * r * .8, rnd(2, 6)]); }
}

function buildLake() {
  const sky = [];
  const bands = [[150, '#f3dcbf', .42], [240, '#f0e2cc', .36], [330, '#dfe3dc', .34], [420, '#cbd6d8', .38], [510, '#b9cad0', .42]];
  for (const [y, c, a] of bands) for (let k = 0; k < 3; k++) for (let x = 5500 + rnd(-250, 0); x < 9400; x += rnd(280, 460))
    sky.push(mk(qcurve(x, y + k * 30 + rnd(-10, 10), x + rnd(380, 620), y + k * 30 + rnd(-12, 12), rnd(-14, 14), 14), rnd(40, 58), c, { prof: 'brush', nb: 5, a: a * rnd(.6, 1.0), rough: .3 }));
  LAKE.sky = fadeEdges(sprite(sky), 700, 140, 0);
  const ridge = (x0, x1, base, peak, n, col, a, seed) => withSeed(seed, () => {
    const c = document.createElement('canvas'); c.width = x1 - x0 + 40; c.height = base - peak + 120; const g = c.getContext('2d');
    g.translate(-x0 + 20, -peak + 60);
    const pts = [[x0, base]]; for (let i = 0; i <= n; i++) { const x = x0 + (x1 - x0) * i / n, u = i / n; pts.push([x, base - (base - peak) * Math.pow(Math.sin(Math.PI * u), 1.3) * (.55 + .45 * fbm(i * .35 + seed))]); }
    pts.push([x1, base]);
    for (let p = 0; p < 3; p++) { g.beginPath(); pts.forEach(([x, y], i) => { const yy = y + (i % 3 === 0 ? rnd(-5, 5) : 0); i ? g.lineTo(x, yy) : g.moveTo(x, yy); }); g.closePath(); g.globalAlpha = a / 3 * 1.6; g.fillStyle = col; g.fill(); }
    return { cv: c, x0: x0 - 20, y0: peak - 60 };
  });
  LAKE.far = ridge(6250, 8950, 602, 360, 60, '#b9c6c4', .5, 31);
  LAKE.near = ridge(6600, 8300, 602, 440, 50, '#8fa4ae', .62, 47);
  const wat = [];
  for (let y = 608; y < 900; y += rnd(16, 26)) { const f = (y - 606) / 294; for (let x = 5600 + rnd(-250, 0); x < 9400; x += rnd(280, 460))
    wat.push(mk(qcurve(x, y + rnd(-3, 3), x + rnd(380, 600), y + rnd(-5, 5), rnd(-6, 6), 12), rnd(24, 34), mixc('#8fa9bb', '#c9d6da', f), { prof: 'brush', nb: 4, a: .42 * (1 - f * .85) * rnd(.7, 1.1), rough: .3 })); }
  for (let i = 0; i < 70; i++) { const x = rnd(6000, 9000), y = rnd(615, 860), l = rnd(30, 120) * (1 - (y - 615) / 400);
    wat.push(mk(qcurve(x, y, x + l, y + rnd(-1, 1), rnd(-1, 1), 5), rnd(2, 3.5), '#5f7f96', { prof: 'even', nb: 0, a: rnd(.35, .6), rough: .4 })); }
  LAKE.water = fadeEdges(sprite(wat), 700, 0, 120);
}

function buildLotus() {
  const S = [], cx = 7300, cy = 676;
  const pad = (x, y, rx, ry, col) => { for (let k = 0; k < 6; k++) { const yy = y - ry + (k + .5) * ry * 2 / 6, half = rx * Math.sqrt(1 - Math.pow((yy - y) / ry, 2)); S.push(mk(qcurve(x - half, yy, x + half, yy, rnd(-2, 2), 8), ry * 2 / 6 * 1.5, col, { prof: 'brush', nb: 4, a: .72, rough: .25 })); } };
  pad(cx - 120, cy + 30, 80, 16, '#7f9a6c'); pad(cx + 135, cy + 38, 64, 13, '#6f8d5f'); pad(cx + 30, cy + 46, 46, 10, '#8ea860');
  S.push(mk(qcurve(cx, cy + 40, cx + 2, cy + 6, 3, 8), 5, '#5f7d58', { prof: 'even', nb: 0, a: .8 }));
  const petal = (ang, len, w, col, tip) => { const x1 = cx + Math.sin(ang) * len, y1 = cy - Math.cos(ang) * len;
    S.push(mk(qcurve(cx + Math.sin(ang) * 6, cy, x1, y1, ang * 6, 10), w, col, { prof: 'leaf', nb: 4, a: .82, rough: .2 }));
    S.push(mk(qcurve(lerp(cx, x1, .62), lerp(cy, y1, .62), x1, y1, 0, 5), w * .45, tip, { prof: 'tip', nb: 0, a: .55, rough: .2 })); };
  for (const a of [-1.25, 1.25, -.95, .95]) petal(a, 62, 34, '#e7b3bb', '#c86a7c');
  for (const a of [-.62, .62, -.3, .3]) petal(a, 74, 34, '#e2a2ae', '#c45f74');
  petal(0, 80, 36, '#dc93a2', '#bd5a70');
  S.push(mk(qcurve(cx - 10, cy - 4, cx + 10, cy - 4, 0, 4), 9, '#e3b04a', { prof: 'leaf', nb: 0, a: .85 }));
  LOTUS = S;
  LOTUS.refl = S.slice(-19).map(s => ({ ...s, pts: s.pts.map(([x, y]) => [x, 2 * (cy + 8) - y]) }));
}

function fadeEdges(spr, fx, ftop = 0, fbot = 0) {
  const c = spr.cv.getContext('2d'), w = spr.cv.width, h = spr.cv.height;
  c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'destination-in';
  let g = c.createLinearGradient(0, 0, w, 0); const e = Math.min(.45, fx / w);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(e, 'rgba(0,0,0,1)'); g.addColorStop(1 - e, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = g; c.fillRect(0, 0, w, h);
  if (ftop || fbot) { g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, ftop ? 'rgba(0,0,0,0)' : 'rgba(0,0,0,1)'); g.addColorStop(Math.min(.5, (ftop || 1) / h), 'rgba(0,0,0,1)'); g.addColorStop(Math.max(.5, 1 - (fbot || 1) / h), 'rgba(0,0,0,1)'); g.addColorStop(1, fbot ? 'rgba(0,0,0,0)' : 'rgba(0,0,0,1)'); c.fillStyle = g; c.fillRect(0, 0, w, h); }
  c.globalCompositeOperation = 'source-over'; return spr;
}
// ---------- drawing ----------
function drawSprite(spr, a = 1) { if (!spr || a <= 0) return; ctx.globalAlpha = a; ctx.drawImage(spr.cv, spr.x0, spr.y0); ctx.globalAlpha = 1; }
function wavyClipX(xEdge, y0, y1, amp, ph) {   // reveal everything left of a wavy vertical brush edge (world coords)
  ctx.beginPath(); ctx.moveTo(-1e5, y0);
  for (let y = y0; y <= y1; y += 30) ctx.lineTo(xEdge + (vnoise(y * .01 + ph) - .5) * amp, y);
  ctx.lineTo(-1e5, y1); ctx.closePath(); ctx.clip();
}
function visible(c, x0, x1, y0, y1) { const [a, b] = toS(c, x0, y0), [d, e] = toS(c, x1, y1); return d > -40 && a < W + 40 && e > -40 && b < H + 40; }

function buildingP(b, t) {
  if (t > 35) return ss(seg(t, 35.0 + (b.x0 - CITY0) / (CITY1 - CITY0) * 2.0, 35.6 + (b.x0 - CITY0) / (CITY1 - CITY0) * 2.0));
  return clamp((LHk(t) - 240 - b.x0) / 430 - (b.kind === 'back' ? -.25 : 0));
}
function drawCity(t, c, am) {
  const reveal = t > 35 ? lerp(CITY0 - 200, CITY1 + 300, eio(seg(t, 35, 37.4))) : LHk(t) - 120;
  ctx.save(); wavyClipX(reveal, 0, 1200, 160, 3);
  drawSprite(SKY_N, am);
  const burst = t > 35 ? 1 : ss(seg(t, 13.333, 14.2));
  drawSprite(GLOW, burst * am * (t > 35 ? .6 : 1));
  ctx.restore();
  for (const row of [BACK, FRONT]) for (const b of row) {
    if (!visible(c, b.x0, b.x1, b.top, b.base)) continue;
    const p = buildingP(b, t); if (p <= 0) continue;
    if (p < 1) drawList(ctx, b.S, p, null, am); else drawSprite(b.spr, am);
    // windows
    const pw = seg(p, .7, 1); if (pw <= 0) continue;
    if (t > 35) { if (b.wspr) drawSprite(b.wspr, pw * am); continue; }
    const bt = 13.333;
    const tPaint = b.paintT;              // when this building finished painting
    if (t < bt) { if (b.pspr) drawSprite(b.pspr, pw * am); continue; }
    if (tPaint > bt + .2) { if (p < 1) { for (const s of b.W) drawS(ctx, s, pw, null, am); } else drawSprite(b.wspr, am); continue; }
    if (t > bt + 1.1) { drawSprite(b.wspr, am); continue; }
    for (const s of b.W) drawS(ctx, s, s.pre ? 1 : seg(t, bt + s.delay * .9, bt + s.delay * .9 + .22), null, am);
  }
  ctx.save(); wavyClipX(reveal, 0, 1200, 160, 5); drawSprite(STREET, am); ctx.restore();
}

function drawMist(t) {
  const c = eio(seg(t, 18.8, 21.2)); if (c <= 0 || c >= 1) return;
  for (const [lift, a] of [[140, .55], [0, 1]]) {
    const top = 1180 - c * 1450 - lift;
    ctx.save(); ctx.beginPath(); ctx.moveTo(-10, 1100);
    for (let x = -10; x <= W + 40; x += 40) ctx.lineTo(x, top + (vnoise(x * .006 + lift) - .5) * 170 + Math.sin(x * .01 + t) * 12);
    ctx.lineTo(W + 10, 1100); ctx.closePath(); ctx.clip(); ctx.globalAlpha = a; ctx.drawImage(PAPER_IMG, 0, 0); ctx.restore();
  }
}

function drawLake(t, c) {
  if (!visible(c, 5700, 9200, 100, 950)) return;
  const pb = t > 34.67;
  const rs = pb ? 9200 : lerp(5700, 9200, eio(seg(t, 21.4, 25.6)));
  ctx.save(); wavyClipX(rs, 0, 1200, 220, 11); drawSprite(LAKE.sky); ctx.restore();
  const rm = pb ? 9200 : lerp(6100, 9200, eio(seg(t, 22.6, 26.4)));
  ctx.save(); wavyClipX(rm, 0, 1200, 160, 13); drawSprite(LAKE.far); drawSprite(LAKE.near); ctx.restore();
  const rw = pb ? 9200 : lerp(5700, 9200, eio(seg(t, 23.4, 27.2)));
  ctx.save(); wavyClipX(rw, 590, 1200, 160, 17); drawSprite(LAKE.water); ctx.restore();
  // lotus paints itself in
  const pl = seg(t, 28.6, 31.6);
  if (pl > 0) {
    const pr = seg(t, 30.4, 32.0);
    if (pr > 0) for (const s of LOTUS.refl) drawS(ctx, s, pr, null, .18);
    drawList(ctx, LOTUS, pl);
  }
}

function drawLine(t, c) {
  const head = LHk(t);
  for (const ch of CHUNKS) {
    if (ch.x0 > head) continue;
    if (!visible(c, ch.x0 - 10, ch.x1 + 10, ch.y0, ch.y1)) continue;
    let p = 1;
    if (ch.x1 > head) { let k = 0; while (k < ch.n - 1 && ch.xs[k + 1] <= head) k++; p = (k + 1) / ch.n; }
    drawS(ctx, ch.s, p);
  }
}

function drawBloom(t) {
  const r = 70 * eo(seg(t, .667, 2.4)); if (r <= 0) return;
  const [x, y] = DROP;
  BLOOM.forEach((pts, L) => { ctx.beginPath(); pts.forEach(([px, py], i) => i ? ctx.lineTo(x + px * r, y + py * r) : ctx.moveTo(x + px * r, y + py * r)); ctx.closePath();
    ctx.fillStyle = rgba(ACC, L === 0 ? .16 : .13); ctx.fill(); if (L === 0) { ctx.strokeStyle = rgba(ACC, .32); ctx.lineWidth = 2.2; ctx.stroke(); } });
  const sp = seg(t, .667, 1.0);
  for (const [px, py, s] of BLOOM.spl) { ctx.beginPath(); ctx.arc(x + px * 70 * eo(sp), y + py * 70 * eo(sp), s * sp, 0, 7); ctx.fillStyle = rgba(ACC, .55); ctx.fill(); }
}

function dropStroke(x, y, len, seed) {
  return withSeed(seed, () => mk(qcurve(x, y, x, y - len, 0, 6), len * .55, ACC, { prof: 'tip', nb: 3, a: .95, rough: .15 }));
}
function drawFallingDrop(t, x, y0, y1, t0, t1, scale = 1) {
  if (t < t0 || t >= t1) return;
  const u = ei(seg(t, t0, t1)), y = lerp(y0, y1, u), len = 30 * scale * (1 + u * .5);
  drawS(ctx, dropStroke(x, y, len, 77), 1);
}

function markerPos(t) {
  // the vermilion beat marker rides the line, near the right of frame, landing on every beat
  const c = cam(t), wx = c.x + 300 / c.z;
  const base = lineAt(wx);
  let hop = 0;
  if (t >= B0 && t < 18.667) { const ph = ((t - B0) / BEAT) % 1; hop = Math.sin(Math.PI * ph) * (t < 13.333 ? 46 : 64); }
  return [wx, base - 9 - hop, hop];
}
function drawMarker(t) {
  const a = t < 5.0 ? 0 : t < 34.67 ? ss(seg(t, 5.0, 5.33)) : 1 - ss(seg(t, 34.67, 35.4));
  if (a <= 0) return;
  let [x, y, hop] = markerPos(t);
  if (t >= 18.667) { const cx = cam(t); x = cx.x + 300 / cx.z; y = lineAt(x) - 9 - 4 * Math.sin(t * 1.3); }
  withSeed(91, () => {
    const sq = hop < 6 && t < 18.667 ? 1.25 : 1;
    const s = mk(qcurve(x - 11 * sq, y, x + 11 * sq, y, 0, 6), 18 / sq, ACC, { prof: 'leaf', nb: 4, a: .95, rough: .2 });
    drawS(ctx, s, 1, null, a);
  });
}

// ---------- annotations (screen space) ----------
function hand(txt, x, y, p, o = {}) {
  if (p <= 0) return;
  ctx.save(); ctx.font = `${o.w || 500} ${o.size || 34}px Caveat`; ctx.textAlign = o.align || 'left'; ctx.textBaseline = 'middle';
  const w = ctx.measureText(txt).width, x0 = o.align === 'right' ? x - w : o.align === 'center' ? x - w / 2 : x;
  ctx.beginPath(); ctx.rect(x0 - 6, y - 50, (w + 12) * eo(p), 100); ctx.clip();
  ctx.shadowColor = rgba(PAPER, .95); ctx.shadowBlur = 12; ctx.fillStyle = rgba(o.col || INK, o.a ?? .92); ctx.fillText(txt, x, y); ctx.fillText(txt, x, y);
  ctx.restore();
}
function leader(x0, y0, x1, y1, p, bend = 20, a = .75) {
  if (p <= 0) return;
  const pts = qcurve(x0, y0, x1, y1, bend, 16), m = Math.max(1, Math.round(16 * clamp(p)));
  ctx.beginPath(); for (let i = 0; i <= m; i++) i ? ctx.lineTo(pts[i][0], pts[i][1]) : ctx.moveTo(pts[i][0], pts[i][1]);
  ctx.strokeStyle = rgba(INK, a); ctx.lineWidth = 1.7; ctx.lineCap = 'round'; ctx.stroke();
  if (p >= 1) { ctx.beginPath(); ctx.arc(x1, y1, 3, 0, 7); ctx.fillStyle = rgba(INK, a); ctx.fill(); }
}
const NOTES = [
  // [t0, t1, text, labelX, labelY, anchor(t) → screen point]
  [8.4, 13.0, '90 BPM · the groove', 1180, 196, t => { const [x, y] = markerPos(t); return toS(cam(t), x, y - 14); }],
  [30.2, 34.4, '528 Hz · calm', 1190, 250, t => toS(cam(t), 7318, 600)],
];
function drawNotes(t) {
  for (const [t0, t1, txt, lx, ly, anc] of NOTES) {
    const f = 1 - ss(seg(t, t1 - .4, t1)); if (t < t0 || f <= 0) continue;
    const [ax, ay] = anc(t);
    ctx.globalAlpha = f; leader(lx + 20, ly + 26, ax, ay, seg(t, t0, t0 + .6), 26); hand(txt, lx, ly, seg(t, t0 + .3, t0 + 1.2), { size: 44 }); ctx.globalAlpha = 1;
  }
}
const SIDES = [[5.9, 18.4, 'SIDE A', 'BEATS · HIP-HOP · EDM', ACC], [22.9, 34.3, 'SIDE B', 'CHILL · MEDITATION · HEALING', '#6f8ea3']];
function drawSides(t) {
  for (const [t0, t1, a, b, col] of SIDES) {
    const f = ss(seg(t, t0, t0 + .6)) * (1 - ss(seg(t, t1 - .5, t1))); if (f <= 0) continue;
    ctx.globalAlpha = f;
    withSeed(5, () => drawS(ctx, mk(qcurve(86, 104, 150, 104, 0, 6), 13, col, { prof: 'even', nb: 3 }), seg(t, t0, t0 + .5)));
    ctx.font = '400 19px "IBM Plex Mono"'; ctx.letterSpacing = '5px'; ctx.fillStyle = rgba(INK, .85); ctx.textBaseline = 'middle';
    ctx.fillText(a, 168, 104); ctx.font = 'italic 500 34px "Cormorant Garamond"'; ctx.letterSpacing = '0px'; ctx.fillText(b.toLowerCase().replace(/ · /g, ' · '), 86, 150);
    ctx.globalAlpha = 1;
  }
}

// ---------- title, seal, ending ----------
const SEAL = [1452, 742];
let TBAND;
function drawTitle(t) {
  if (t < 36.6) return;
  const pb = seg(t, 36.7, 37.5);
  if (pb > 0) drawS(ctx, TBAND, pb);
  const pt = seg(t, 36.9, 38.1);
  if (pt > 0) {
    ctx.save(); ctx.font = '600 108px "Cormorant Garamond"'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    const w = ctx.measureText('BeatVibe Studio').width;
    ctx.beginPath(); ctx.rect(960 - w / 2 - 10, 600, (w + 20) * eo(pt), 220); ctx.clip();
    ctx.shadowColor = rgba(PAPER, .9); ctx.shadowBlur = 14; ctx.fillStyle = rgba(INK, .94); ctx.fillText('BeatVibe Studio', 960, 778); ctx.restore();
  }
  const pm = ss(seg(t, 38.3, 38.9));
  if (pm > 0) { ctx.save(); ctx.globalAlpha = pm; ctx.font = '400 20px "IBM Plex Mono"'; ctx.letterSpacing = '7px'; ctx.textAlign = 'center'; ctx.fillStyle = rgba(INK, .8); ctx.fillText('BEATS · CHILL · HEALING SOUND', 960, 830); ctx.restore(); }
  hand('Subscribe — let’s make beats together', 960, 900, seg(t, 39.4, 40.5), { size: 46, align: 'center', col: INK });
  // seal: stamped on the downbeat
  const ps = t - 42.667;
  if (ps >= 0) {
    const k = ps < .12 ? 1.18 - 1.5 * ps : 1;
    ctx.save(); ctx.translate(SEAL[0], SEAL[1]); ctx.scale(k, k); ctx.rotate(-.04);
    withSeed(303, () => { for (let i = 0; i < 6; i++) drawS(ctx, mk(qcurve(-40, -34 + i * 13.6 + rnd(-2, 2), 40, -34 + i * 13.6 + rnd(-2, 2), rnd(-2, 2), 8), 15, ACC, { prof: 'even', nb: 5, a: .9, rough: .25 }), 1); });
    ctx.font = '600 40px "Cormorant Garamond"'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = rgba(PAPER, .92); ctx.fillText('BV', 0, 2);
    ctx.restore();
  }
  drawFallingDrop(t, SEAL[0] + 4, -60, SEAL[1] - 34, 43.25, 44.0, 1.0);
  const rr = seg(t, 44.0, 45.0);
  if (rr > 0) { ctx.beginPath(); ctx.ellipse(SEAL[0] + 4, SEAL[1] - 30, 6 + 60 * eo(rr), 3 + 26 * eo(rr), 0, 0, 7); ctx.strokeStyle = rgba(ACC, .5 * (1 - rr)); ctx.lineWidth = 2.4; ctx.stroke(); }
}

// ---------- subtitles ----------
function subWin(v) { const d = VODUR[v.id]; return [v.t - .1, v.t + Math.max(1.8, d + .6)]; }
function drawSubs(t) {
  for (const v of TL.vo) {
    const [a, b] = subWin(v); if (t < a || t > b) continue;
    const f = ss(seg(t, a, a + .25)) * (1 - ss(seg(t, b - .3, b)));
    ctx.save(); ctx.font = 'italic 500 40px "Cormorant Garamond"'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.shadowColor = rgba(PAPER, .95); ctx.shadowBlur = 18; ctx.fillStyle = rgba(INK, .8 * f);
    ctx.fillText(v.text, 960, 1010); ctx.fillText(v.text, 960, 1010); ctx.restore();
  }
}

// ---------- frame ----------
function render(t) {
  screenT(); ctx.globalAlpha = 1; ctx.drawImage(PAPER_IMG, 0, 0);
  // ending push into the seal
  let ek = 1 + .38 * eio(seg(t, 43.6, 45.0));
  ctx.setTransform(ek, 0, 0, ek, SEAL[0] * (1 - ek), SEAL[1] * (1 - ek));
  const base = ctx.getTransform();
  const c = cam(t);
  const wt = () => { ctx.setTransform(base); ctx.transform(c.z, 0, 0, c.z, 960 - c.x * c.z, 540 - c.y * c.z); };
  wt();
  drawLake(t, c);
  if (t < 21.3 || t > 35) drawCity(t, c, t > 35 ? .62 : 1);
  ctx.setTransform(base); drawMist(t);
  wt(); drawBloom(t); drawLine(t, c); drawMarker(t);
  ctx.setTransform(base); { const [dx, dy] = toS(c, DROP[0], DROP[1]); drawFallingDrop(t, dx, -60, dy, 0, .667); }
  drawNotes(t); drawSides(t); drawTitle(t);
  screenT(); drawSubs(t);
}
window.render = render;

window.TEXTS = t => {
  const out = [];
  for (const [t0, t1, txt, lx, ly] of NOTES) if (t >= t0 + .3 && t < t1) { ctx.font = '500 44px Caveat'; const w = ctx.measureText(txt).width; out.push({ id: txt, text: txt, x0: lx, y0: ly - 30, x1: lx + w, y1: ly + 30 }); }
  for (const [t0, t1, a, b] of SIDES) if (t >= t0 && t < t1) out.push({ id: a, text: a + ' ' + b, x0: 86, y0: 90, x1: 700, y1: 170 });
  if (t >= 36.9) out.push({ id: 'title', text: 'BeatVibe Studio', x0: 560, y0: 690, x1: 1360, y1: 790 });
  if (t >= 38.3) out.push({ id: 'tag', text: 'BEATS · CHILL · HEALING SOUND', x0: 600, y0: 815, x1: 1320, y1: 845 });
  if (t >= 39.4) out.push({ id: 'sub', text: 'Subscribe — let’s make beats together', x0: 620, y0: 870, x1: 1300, y1: 930 });
  return out;
};

// ---------- sound / cue events for the mixer ----------
function events() {
  const EV = [{ t: .667, type: 'drop' }, { t: .9, type: 'brush', d: 4.4, pan0: -.6, pan1: .7 },
    { t: 8.4, type: 'pencil', d: 1.0 }, { t: 13.333, type: 'burst' }, { t: 18.8, type: 'mist', d: 2.4 },
    { t: 21.4, type: 'brush', d: 4.0, pan0: -.8, pan1: .8, g: .35 }, { t: 23.4, type: 'brush', d: 3.6, pan0: -.6, pan1: .6, g: .3 },
    { t: 28.6, type: 'brush', d: 3.0, pan0: -.2, pan1: .3, g: .45 }, { t: 30.2, type: 'pencil', d: 1.0 }, { t: 31.0, type: 'plink' },
    { t: 35.0, type: 'brush', d: 2.4, pan0: -.8, pan1: .8, g: .3 }, { t: 36.7, type: 'brush', d: 1.1, pan0: -.4, pan1: .4, g: .4 },
    { t: 39.4, type: 'pencil', d: 1.1 }, { t: 42.667, type: 'stamp' }, { t: 44.0, type: 'drop' }];
  for (const b of FRONT) if (b.paintT0 > 1 && b.paintT0 < 18.6) EV.push({ t: b.paintT0, type: 'brush', d: .9, pan0: .3, pan1: .6, g: .22 });
  return EV.sort((a, b) => a.t - b.t);
}

(async () => {
  TL = await (await fetch('timeline.json')).json();
  VODUR = await (await fetch('voices/dur.json')).json();
  PAPER_IMG = new Image(); PAPER_IMG.src = 'paper.jpg'; await PAPER_IMG.decode();
  await Promise.all(['500 44px Caveat', '600 108px "Cormorant Garamond"', 'italic 500 40px "Cormorant Garamond"', '400 20px "IBM Plex Mono"'].map(f => document.fonts.load(f)));
  withSeed(11, buildCity); withSeed(12, buildLine); withSeed(13, buildBloom); withSeed(14, buildLake); withSeed(15, buildLotus);
  TBAND = withSeed(16, () => mk(qcurve(560, 742, 1370, 738, -6, 16), 118, '#c9d6da', { prof: 'brush', nb: 8, a: .55, rough: .3 }));
  // when each building starts and finishes painting (for windows and the brush foley)
  for (const b of [...FRONT, ...BACK]) { b.paintT = 99; b.paintT0 = 99; for (let t = 0; t < 34; t += 1 / 60) { const p = clamp((LHk(t) - 240 - b.x0) / 430 - (b.kind === 'back' ? -.25 : 0)); if (p > 0 && b.paintT0 === 99) b.paintT0 = t; if (p >= 1) { b.paintT = t; break; } } }
  window.EV = events();
  window.READY = true;
})();
