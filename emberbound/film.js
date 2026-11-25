// Emberbound — Paper-cut Lightbox, vertical 1080×1920.
// A stack of cut-paper sheets lit from behind, drawn in Canvas 2D: each sheet is pre-cut with grain, a warm top rim
// and a dark bottom edge; per frame it is mapped by the camera, lit (warm backlight + pulp mottle), darkened by the lamp
// state, and preceded by its pre-blurred shadow. Light sources (moon, stars, windows, lantern, the dragon's heart) are
// emissive and bloom. Figures are jointed silhouettes that move by rotation only. Pure function of t.
const cv = document.getElementById('c'), ctx = cv.getContext('2d');
const VW = 1080, VH = 1920, CX = VW / 2, CY = VH / 2, LW = 1240, OX = (VW - LW) / 2;
window.DUR = 45.0;
let TL, VODUR;

// ---------- utils ----------
function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
let R = mulberry(7); const rnd = (a = 0, b = 1) => a + (b - a) * R();
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x)), lerp = (a, b, t) => a + (b - a) * t, seg = (t, a, b) => clamp((t - a) / (b - a));
const ss = t => { t = clamp(t); return t * t * (3 - 2 * t); }, eio = t => { t = clamp(t); return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
const eo = t => 1 - Math.pow(1 - clamp(t), 3), ei = t => Math.pow(clamp(t), 2.2);
const hash = n => { n = Math.sin(n * 127.1 + 311.7) * 43758.5453; return n - Math.floor(n); };
const vnoise = x => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return lerp(hash(i), hash(i + 1), u); };
function monotone(keys) {
  const n = keys.length, xs = keys.map(k => k[0]), ys = keys.map(k => k[1]), d = [], m = new Array(n).fill(0);
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  m[0] = d[0]; m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < n - 1; i++) { if (d[i] === 0) { m[i] = m[i + 1] = 0; continue; } const a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b; if (s > 9) { const k = 3 / Math.sqrt(s); m[i] = k * a * d[i]; m[i + 1] = k * b * d[i]; } }
  return t => { if (t <= xs[0]) return ys[0]; if (t >= xs[n - 1]) return ys[n - 1]; let i = 0; while (t > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i], u = (t - xs[i]) / h, u2 = u * u, u3 = u2 * u;
    return (2 * u3 - 3 * u2 + 1) * ys[i] + (u3 - 2 * u2 + u) * h * m[i] + (-2 * u3 + 3 * u2) * ys[i + 1] + (u3 - u2) * h * m[i + 1]; };
}
const mkCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const hex = (h, a = 1) => { const n = parseInt(h.slice(1), 16); return `rgba(${n >> 16},${n >> 8 & 255},${n & 255},${clamp(a).toFixed(3)})`; };
const LIGHT = '#ffb862', ACC = '#ff5a24', PAPERW = '#f3e6cf';

// ---------- the timeline of light ----------
const H = { crash: 10.0, off: 20.0, flare: 25.0, relight: 29.3, rise: 30.0, moon: 40.0 };
// how dark each layer is (0 = lamp fully on). i = 0 (sky) … 5 (front)
function darkOf(i, t) {
  const on = ss(seg(t, .9 + i * .45, 1.9 + i * .45));                       // the lamp turns on at the start, far to near
  const off = ss(seg(t, H.off + (5 - i) * .08, H.off + .45 + (5 - i) * .08)); // switched off, near to far
  const back = ss(seg(t, 25.35 + i * .4, 25.95 + i * .4));                   // back on after the flare, far to near
  const lit = t < H.off ? on : t < 25.3 ? 1 - off : back;
  return .9 * (1 - lit) + (i === 5 ? .35 : 0);
}
const winOn = (k, n, t) => t < H.off ? ss(seg(t, 6.4 + k / n * 2.6, 6.7 + k / n * 2.6)) : t < 25.3 ? 1 - ss(seg(t, H.off, H.off + .3)) : ss(seg(t, 26.0 + k / n * 1.6, 26.3 + k / n * 1.6));
const moonOpen = t => eo(seg(t, .3, 2.7));
const moonLevel = t => moonOpen(t) * (t < H.off ? 1 : t < 25.3 ? lerp(1, .2, ss(seg(t, H.off, H.off + .5))) : lerp(.2, 1, ss(seg(t, 25.3, 26.0))));
function heartLevel(t) {
  if (t < H.crash) return 0;
  let v = lerp(1.2, .55, ss(seg(t, H.crash, H.crash + 1.2)));
  v = lerp(v, .2, ss(seg(t, 14.7, 15.4)));                // dims on "going out"
  v = lerp(v, .1, ss(seg(t, H.off, H.off + .5)));
  v = lerp(v, 1.8, ss(seg(t, 24.85, 25.05)));             // flares on "light"
  v = lerp(v, 1.05, ss(seg(t, 25.1, 26.4)));
  const fl = 1 + .1 * Math.sin(7.3 * t) * Math.sin(3.1 * t) + (t < 25 ? .25 * (vnoise(t * 3) - .5) : 0);
  return v * fl;
}
function lanternLevel(t) {
  if (t < 12.5) return 0;
  let v = ss(seg(t, 12.6, 13.2));
  v = lerp(v, 0, ss(seg(t, 24.0, 25.0)));                 // her flame goes into the dragon
  v = lerp(v, 1.1, ss(seg(t, H.relight - .1, H.relight + .35)));   // and relights by itself: one fate
  v = lerp(v, 1.5, ss(seg(t, 41.1, 41.4))) ; v = lerp(v, 1.1, ss(seg(t, 41.5, 42.3)));   // pulse on "burns"
  return v * (1 + .07 * Math.sin(7.3 * t + 1) * Math.sin(3.1 * t));
}

// ---------- camera ----------
const camYc = monotone([[0, 0], [4.0, 0], [10.5, 1], [30.5, 1], [35.3, .62], [40.2, 1], [45, 1]]);
const camZ = monotone([[0, 1], [10.5, 1], [11.5, 1], [19, 1.22], [23.3, 1.22], [29.5, 1.3], [30.5, 1.25], [35.3, 1.0], [40.2, .62], [45, .62]]);
const camDX = monotone([[0, 0], [10.5, 0], [19, -120], [29.5, -150], [30.5, -150], [35.3, 0], [45, 0]]);
const cam = t => ({ yc: camYc(t), z: camZ(t), dx: camDX(t) + 3 * Math.sin(t * .7), dy: 2 * Math.sin(t * .53) });
// layers: travel = how far the sheet scrolls over the whole tilt (parallax), k = how much it scales with the dolly
const LAY = [
  { name: 'sky', travel: 600, k: .9, col: '#0b1433', trans: .55 },
  { name: 'far', travel: 1100, k: .93, col: '#6f88be', trans: .85 },
  { name: 'mid', travel: 1500, k: .95, col: '#45609b', trans: .6 },
  { name: 'village', travel: 1900, k: .97, col: '#28396a', trans: .4 },
  { name: 'story', travel: 2300, k: 1.0, col: '#121a38', trans: .14 },
  { name: 'front', travel: 2700, k: 1.12, col: '#06091a', trans: .04 },
];
function LM(i, c) {
  const L = LAY[i], s = 1 + (c.z - 1) * L.k, ox = OX + c.dx * L.k, oy = -L.travel * c.yc + c.dy;
  return { s, tx: (ox - CX) * s + CX, ty: (oy - CY) * s + CY };
}
const toScreen = (m, x, y) => [x * m.s + m.tx, y * m.s + m.ty];
const toLayer = (m, sx, sy) => [(sx - m.tx) / m.s, (sy - m.ty) / m.s];
// box framing at the end: the lamp's inner window, from beyond the screen to a box in the frame
const BOXF = [170, 120, 910, 1340];
function boxRect(t) { const u = eio(seg(t, 35.3, 40.2)); return [lerp(-60, BOXF[0], u), lerp(-60, BOXF[1], u), lerp(VW + 60, BOXF[2], u), lerp(VH + 60, BOXF[3], u), u]; }

// ---------- building the sheets ----------
let GRAIN, MOTTLE, SHEETS = [], STARS = [], WINDOWS = [], FIRS = [];
const MOON = [640, 430, 112];
const GROUND = 3440;              // story-layer y of the snow line
const CRASH = [800, GROUND - 6];
const COTTAGE = [70, 330];        // x range on the story layer
const DOOR = [292, GROUND - 92, 34, 92];
function ridge(c, w, base, pts) { c.beginPath(); c.moveTo(-10, c.canvas.height + 10); for (const [x, y] of pts) c.lineTo(x, y); c.lineTo(w + 10, c.canvas.height + 10); c.closePath(); c.fill(); }
function ridgePts(w, y0, amp, n, seed, sharp = 1) { const r = mulberry(seed), pts = []; for (let i = 0; i <= n; i++) { const x = -10 + (w + 20) * i / n; pts.push([x, y0 - amp * Math.pow(Math.abs(Math.sin(i * 1.7 + r() * 2)), sharp) * (.4 + .6 * r())]); } return pts; }
function fir(c, x, y, h) { c.beginPath(); const tiers = 4; for (let k = 0; k < tiers; k++) { const yt = y - h + k * h / tiers * .8, yb = yt + h / tiers * 1.35, w = h * (.16 + k * .08); c.moveTo(x, yt); c.lineTo(x + w, yb); c.lineTo(x + w * .3, yb - 4); c.lineTo(x - w * .3, yb - 4); c.lineTo(x - w, yb); c.closePath(); } c.rect(x - h * .03, y - h * .15, h * .06, h * .17); c.fill(); }
function house(c, x, y, w, h, roof) { c.beginPath(); c.moveTo(x - 8, y - h); c.lineTo(x + w / 2, y - h - roof); c.lineTo(x + w + 8, y - h); c.lineTo(x + w, y - h); c.lineTo(x + w, y); c.lineTo(x, y); c.lineTo(x, y - h); c.closePath(); c.fill(); c.fillRect(x + w * .7, y - h - roof * .8, w * .12, roof * .6); }
function cloud(c, x, y, s) { c.beginPath(); for (const [dx, dy, r] of [[0, 0, 40], [46, -14, 34], [86, 2, 30], [-40, 6, 28], [120, 10, 22]]) { c.moveTo(x + dx * s + r * s, y + dy * s); c.arc(x + dx * s, y + dy * s, r * s, 0, 7); } c.rect(x - 60 * s, y, 200 * s, 26 * s); c.fill(); }

function finish(cvs, col, rimA = .55) {
  const w = cvs.width, h = cvs.height, c = cvs.getContext('2d');
  // rim light on top edges, dark band on bottom edges (shape minus itself shifted)
  for (const [dy, colr, a] of [[3, '#ffd9a0', rimA], [-4, '#000000', .38]]) {
    const t = mkCanvas(w, h), tc = t.getContext('2d');
    tc.drawImage(cvs, 0, 0); tc.globalCompositeOperation = 'source-in'; tc.fillStyle = colr; tc.fillRect(0, 0, w, h);
    tc.globalCompositeOperation = 'destination-out'; tc.drawImage(cvs, 0, dy);
    c.save(); c.globalCompositeOperation = 'source-atop'; c.globalAlpha = a; c.drawImage(t, 0, 0); c.restore();
  }
  c.save(); c.globalCompositeOperation = 'source-atop'; c.globalAlpha = .09; c.fillStyle = c.createPattern(GRAIN, 'repeat'); c.fillRect(0, 0, w, h); c.restore();
  c.fillStyle = col;
  // pre-blurred shadow at half resolution
  const sh = mkCanvas(Math.ceil(w / 2), Math.ceil(h / 2)), sc = sh.getContext('2d');
  sc.filter = 'blur(7px)'; sc.drawImage(cvs, 0, 0, w / 2, h / 2); sc.filter = 'none';
  sc.globalCompositeOperation = 'source-in'; sc.fillStyle = '#000'; sc.fillRect(0, 0, sh.width, sh.height);
  return sh;
}
function buildSheets() {
  GRAIN = mkCanvas(256, 256); { const g = GRAIN.getContext('2d'), d = g.createImageData(256, 256); for (let i = 0; i < d.data.length; i += 4) { const v = R() < .5 ? 0 : 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = R() * 255; } g.putImageData(d, 0, 0);
    g.globalAlpha = .5; g.strokeStyle = '#fff'; for (let k = 0; k < 160; k++) { g.beginPath(); let x = rnd(0, 256), y = rnd(0, 256); g.moveTo(x, y); for (let j = 0; j < 4; j++) { x += rnd(-8, 8); y += rnd(-8, 8); g.lineTo(x, y); } g.stroke(); } }
  MOTTLE = mkCanvas(512, 512); { const g = MOTTLE.getContext('2d'); for (let k = 0; k < 90; k++) { const x = rnd(0, 512), y = rnd(0, 512), r = rnd(20, 90), gr = g.createRadialGradient(x, y, 0, x, y, r); const a = rnd(.08, .22); gr.addColorStop(0, `rgba(255,236,200,${a})`); gr.addColorStop(1, 'rgba(255,236,200,0)'); g.fillStyle = gr; for (const ox of [-512, 0, 512]) for (const oy of [-512, 0, 512]) { g.save(); g.translate(ox, oy); g.fillRect(x - r, y - r, 2 * r, 2 * r); g.restore(); } } }
  for (let i = 0; i < LAY.length; i++) {
    const L = LAY[i], w = LW, h = VH + L.travel, cvs = mkCanvas(w, h), c = cvs.getContext('2d');
    c.fillStyle = L.col;
    if (L.name === 'sky') {
      const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#070d26'); g.addColorStop(.6, '#0e1a40'); g.addColorStop(1, '#182a5a'); c.fillStyle = g; c.fillRect(0, 0, w, h);
      c.fillStyle = '#1b2a58'; for (const [x, y, s] of [[150, 760, 1.1], [900, 980, 1.3], [380, 1260, .9], [1010, 560, .8]]) cloud(c, x, y, s);
      for (let k = 0; k < 150; k++) STARS.push([rnd(0, w), rnd(0, 1900), rnd(1, 2.6), rnd(0, 6)]);
    } else if (L.name === 'far') {
      ridge(c, w, 0, ridgePts(w, 1760, 300, 9, 11, .8));
    } else if (L.name === 'mid') {
      const pts = ridgePts(w, 2280, 220, 11, 23, 1.2); ridge(c, w, 0, pts);
      for (let k = 0; k < 26; k++) { const x = rnd(0, w), yy = pts.reduce((a, p) => Math.abs(p[0] - x) < Math.abs(a[0] - x) ? p : a)[1]; fir(c, x, yy + rnd(20, 80), rnd(60, 110)); }
    } else if (L.name === 'village') {
      const pts = []; for (let x = -10; x <= w + 10; x += 40) pts.push([x, 2700 - 90 * Math.sin(x / w * Math.PI) - 18 * Math.sin(x * .02)]);
      ridge(c, w, 0, pts);
      const hs = [[150, 70, 60], [260, 86, 70], [400, 64, 56], [520, 96, 78], [660, 72, 60], [790, 84, 66], [930, 66, 54], [1050, 78, 62]];
      hs.forEach(([x, hw, hh], k) => { const y = 2700 - 90 * Math.sin(x / w * Math.PI) + 14; house(c, x, y, hw, hh, hh * .55);
        for (let j = 0; j < (hw > 75 ? 2 : 1); j++) WINDOWS.push({ x: x + hw * (j ? .62 : .2), y: y - hh * .62, w: 15, h: 19, k }); });
      for (let k = 0; k < 18; k++) { const x = rnd(0, w); fir(c, x, 2700 - 90 * Math.sin(x / w * Math.PI) + 30, rnd(70, 120)); }
      WINDOWS.sort((a, b) => a.x - b.x).forEach((wd, k) => wd.k = k);
    } else if (L.name === 'story') {
      c.beginPath(); c.moveTo(-10, h + 10);
      for (let x = -10; x <= w + 10; x += 20) c.lineTo(x, GROUND + 10 * Math.sin(x * .011) + 6 * Math.sin(x * .031 + 1) - 22 * Math.exp(-Math.pow((x - 1100) / 120, 2)));
      c.lineTo(w + 10, h + 10); c.closePath(); c.fill();
      // her cottage, a snowy fir beside it
      house(c, COTTAGE[0], GROUND + 4, COTTAGE[1] - COTTAGE[0], 150, 95);
      c.save(); c.globalCompositeOperation = 'destination-out'; c.fillRect(DOOR[0], DOOR[1], DOOR[2], DOOR[3]); c.fillRect(120, GROUND - 120, 40, 44); c.restore();
      c.fillStyle = L.col; fir(c, 1110, GROUND - 10, 330); fir(c, 1190, GROUND, 230); fir(c, 30, GROUND - 120, 210);
    } else if (L.name === 'front') {
      // snow-laden branches at the edges only
      c.lineCap = 'round';
      for (const [side, y0] of [[0, 900], [1, 1500], [0, 2300], [1, 3000], [0, 3700], [1, 4300]]) {
        const x0 = side ? w + 10 : -10, dir = side ? -1 : 1;
        c.lineWidth = 26; c.strokeStyle = L.col; c.beginPath(); c.moveTo(x0, y0); c.quadraticCurveTo(x0 + dir * 150, y0 - 40, x0 + dir * 260, y0 - 110); c.stroke();
        for (let k = 0; k < 7; k++) { const u = k / 7, bx = x0 + dir * 260 * u, by = y0 - 110 * u * u - 20; c.lineWidth = 10; c.beginPath(); c.moveTo(bx, by); c.lineTo(bx + dir * rnd(30, 70), by - rnd(30, 70)); c.stroke(); c.beginPath(); c.moveTo(bx, by); c.lineTo(bx + dir * rnd(20, 60), by + rnd(20, 50)); c.stroke(); }
      }
    }
    const sh = finish(cvs, L.col, L.name === 'sky' ? .25 : .55);
    let blurred = null;
    if (L.name === 'front') { blurred = mkCanvas(w, h); const b = blurred.getContext('2d'); b.filter = 'blur(5px)'; b.drawImage(cvs, 0, 0); }
    SHEETS.push({ cv: blurred || cvs, sh });
  }
}

// ---------- figures (jointed silhouettes, rotation only) ----------
function poly(c, pts) { c.beginPath(); pts.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.closePath(); c.fill(); }
function rot(c, x, y, a, fn) { c.save(); c.translate(x, y); c.rotate(a); fn(); c.restore(); }
// the girl: cloak + hood, two legs, one arm holding the lantern
function girlState(t) {
  const walkT = seg(t, 13.0, 18.6), x = lerp(DOOR[0] + 16, 600, ss(walkT));
  const walking = t > 13.0 && t < 18.6, ph = (t - 13.0) * 2 * Math.PI / 1.0;
  const kneel = ss(seg(t, 18.9, 19.6)) * (1 - ss(seg(t, 31.0, 31.8)));
  const reach = ss(seg(t, 23.3, 23.9)) * (1 - ss(seg(t, 30.6, 31.4)));
  const lift = ss(seg(t, 31.4, 32.4));
  const vis = ss(seg(t, 12.7, 13.1));
  return { x, y: GROUND + 2, ph, walking, kneel, reach, lift, vis };
}
function drawGirl(c, t, fill) {
  const g = girlState(t); if (g.vis <= 0) return null;
  c.save(); c.globalAlpha = g.vis; c.fillStyle = fill;
  const kneelDrop = 44 * g.kneel, bob = g.walking ? 3 * Math.abs(Math.sin(g.ph)) : 0, x = g.x, hip = g.y - 52 + kneelDrop - bob;
  // legs
  const sw = g.walking ? .42 * Math.sin(g.ph) : 0;
  rot(c, x - 4, hip, sw - g.kneel * 1.25, () => c.fillRect(-5, 0, 10, 50));
  rot(c, x + 6, hip, -sw + g.kneel * .2, () => c.fillRect(-5, 0, 10, 50 - g.kneel * 10));
  // cloak and hood
  poly(c, [[x - 14, hip - 118], [x + 16, hip - 118], [x + 38, hip + 4], [x - 40, hip + 6]]);
  c.beginPath(); c.arc(x + 2, hip - 132, 22, 0, 7); c.fill();
  poly(c, [[x - 20, hip - 140], [x + 4, hip - 162], [x + 26, hip - 132], [x - 6, hip - 118]]);
  // arm with lantern
  const aArm = lerp(lerp(.25, -.65, g.reach), -2.3, g.lift) + (g.walking ? .1 * Math.sin(g.ph + 1) : 0);
  const sx = x + 10, sy = hip - 104;
  let hand;
  rot(c, sx, sy, aArm, () => { c.fillRect(-4, 0, 9, 66); });
  hand = [sx - Math.sin(aArm) * 66, sy + Math.cos(aArm) * 66];
  // lantern hangs from the hand (stays upright)
  const lx = hand[0], ly = hand[1] + 6;
  c.fillRect(lx - 1, ly - 8, 2, 10);
  const lid = ss(seg(t, 23.6, 23.95)) * (1 - ss(seg(t, 25.3, 25.7)));
  c.save(); c.translate(lx - 13, ly + 2); c.rotate(-1.1 * lid); poly(c, [[0, 0], [26, 0], [20, -8], [6, -8]]); c.restore();
  c.fillRect(lx - 12, ly + 2, 24, 4); c.fillRect(lx - 12, ly + 32, 24, 5);
  c.fillRect(lx - 12, ly + 2, 3, 34); c.fillRect(lx + 9, ly + 2, 3, 34); c.fillRect(lx - 1.5, ly + 2, 3, 34);
  c.restore();
  return [lx, ly + 19];
}
// the dragon: a chain of rigid segments; neck and tail angles interpolate between a coiled and a flying pose
const SEGN = [44, 40, 38, 34], SEGB = [58, 54, 50, 44, 38, 32, 26];
const WN = [34, 30, 27, 24], WB = [40, 38, 34, 28, 22, 16, 10];
const POSE_COIL = { root: -.12, neck: [-.35, .2, .35, .3], body: [.35, .55, .6, .7, .8, .9, 1.0] };
const POSE_FLY = { root: -.12, neck: [-.15, -.12, .1, .2], body: [-.1, .15, .25, .1, -.15, -.25, -.2] };
let DRAG_PATH = null;
function dragonState(t, mStory) {
  const fly = ss(seg(t, H.rise + .2, H.rise + 1.4));
  const wings = ss(seg(t, H.rise, H.rise + 1.0));
  const flap = t > H.rise + .8 ? Math.sin((t - H.rise - .8) * 2 * Math.PI / 1.25) : 0;
  let x = CRASH[0], y = CRASH[1] - 46;
  const lift = seg(t, H.rise + .5, 44.8);
  if (lift > 0 && DRAG_PATH) { const [sx, sy] = [DRAG_PATH.x(t), DRAG_PATH.y(t)]; const [lx, ly] = toLayer(mStory, sx, sy); x = lerp(x, lx, ss(seg(t, H.rise + .5, H.rise + 1.6))); y = lerp(y, ly, ss(seg(t, H.rise + .5, H.rise + 1.6))); }
  const breath = t < H.rise ? .03 * Math.sin(t * 1.4) * (heartLevel(t) > .3 ? 1 : .3) : 0;
  const lp = (a, b) => a.map((v, k) => lerp(v, b[k], fly));
  return { x, y, root: lerp(POSE_COIL.root, POSE_FLY.root, fly) + breath + (fly ? .06 * flap : 0), neck: lp(POSE_COIL.neck, POSE_FLY.neck), body: lp(POSE_COIL.body, POSE_FLY.body), wings, flap, fly, scale: lerp(1, .78, ss(seg(t, 33, 40))) };
}
function chain(x, y, ang, lens, angs, dir) {
  const P = [[x, y, ang]]; let a = ang;
  for (let k = 0; k < lens.length; k++) { a += angs[k] * dir; const [px, py] = P[P.length - 1]; P.push([px + Math.cos(a) * lens[k] * dir, py + Math.sin(a) * lens[k] * dir, a]); }
  return P;
}
function drawDragon(c, t, fill, mStory) {
  const d = dragonState(t, mStory);
  if (t < H.crash) return { heart: null, eye: null, d };
  c.save(); c.translate(d.x, d.y); c.scale(d.scale, d.scale); c.fillStyle = fill;
  const N = chain(0, 0, d.root, SEGN, d.neck, -1), B = chain(0, 0, d.root, SEGB, d.body, 1);
  // far wing (behind the body)
  const wing = (side) => {
    const open = d.wings, base = lerp(1.42, side > 0 ? -.1 : .25, open) + d.flap * .6 * open, len = lerp(.42, 1, open);
    rot(c, 10, -16, base, () => {
      c.scale(1, len);
      poly(c, [[-6, 0], [-14, -70], [-4, -170], [30, -120], [52, -190], [66, -112], [102, -150], [104, -78], [140, -86], [120, -36], [150, -20], [60, -4]]); c.fillRect(-9, -172, 7, 172);
    });
  };
  wing(1);
  // segments as tapered rigid plates with spines
  const plate = (P, W) => { for (let k = 0; k < P.length - 1; k++) { const [x0, y0] = P[k], [x1, y1] = P[k + 1], a = Math.atan2(y1 - y0, x1 - x0), w0 = W[k], w1 = W[k + 1] ?? W[k] * .7, L = Math.hypot(x1 - x0, y1 - y0);
    rot(c, x0, y0, a, () => { poly(c, [[-4, -w0 / 2], [L + 4, -w1 / 2], [L + 4, w1 / 2], [-4, w0 / 2]]); c.beginPath(); c.arc(0, 0, w0 / 2, 0, 7); c.fill(); poly(c, [[L * .2, -w0 / 2 + 2], [L * .45, -w0 / 2 - 14], [L * .7, -w1 / 2 + 2]]); }); } };
  plate(B, WB); plate(N, WN);
  // tail tip
  { const [x0, y0] = B[B.length - 1], a = B[B.length - 1][2]; rot(c, x0, y0, a, () => poly(c, [[0, -6], [34, -16], [26, 0], [34, 16], [0, 6]])); }
  // head with horns and jaw, at the end of the neck chain
  const [hx, hy] = N[N.length - 1], ha = N[N.length - 1][2] + Math.PI;
  rot(c, hx, hy, ha, () => { poly(c, [[-8, -16], [36, -14], [62, -4], [64, 4], [40, 8], [56, 16], [30, 18], [-6, 14]]); poly(c, [[2, -14], [-24, -44], [12, -16]]); poly(c, [[14, -14], [-6, -36], [24, -14]]); });
  // legs (folded when coiled, tucked in flight)
  for (const [k, lx] of [[1, 0], [4, 1]]) { const [px, py] = B[k]; rot(c, px, py, lerp(.9, 1.6, d.fly), () => { c.fillRect(-6, 0, 12, 34); rot(c, 0, 32, -1.2, () => c.fillRect(-5, 0, 10, 22)); }); }
  wing(-1);
  c.restore();
  // heart (chest) and eye in story coords
  const ca = Math.cos(d.root), sa = Math.sin(d.root);
  const heart = [d.x + (ca * 18 - sa * 4) * d.scale, d.y + (sa * 18 + ca * 4) * d.scale];
  const eye = (() => { const a = ha; return [d.x + (hx + Math.cos(a) * 30 - Math.sin(a) * -4) * d.scale, d.y + (hy + Math.sin(a) * 30 + Math.cos(a) * -4) * d.scale]; })();
  return { heart, eye, d };
}

// ---------- emissive light (drawn on the main canvas and into the bloom buffer) ----------
let BL, blc, TMP, tmc;
function glow(c, x, y, r, col, a) { if (a <= 0 || r <= 0) return; const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, hex(col, a)); g.addColorStop(.35, hex(col, a * .45)); g.addColorStop(1, hex(col, 0)); c.fillStyle = g; c.fillRect(x - r, y - r, 2 * r, 2 * r); }
function emitSky(c, t) {
  const mo = moonOpen(t), ml = moonLevel(t); if (mo <= 0) return;
  c.fillStyle = hex('#fff2d6', .95 * ml); c.beginPath(); c.arc(MOON[0], MOON[1], MOON[2] * mo, 0, 7); c.fill();
  glow(c, MOON[0], MOON[1], MOON[2] * 2.6 * mo, '#ffe1a8', .35 * ml);
  const sa = ss(seg(t, 1.0, 3.0)) * (t < H.off ? 1 : t < 25.3 ? .35 : 1);
  for (const [x, y, r, p] of STARS) { const tw = .6 + .4 * Math.sin(t * 2.1 + p); c.fillStyle = hex('#fff0d0', sa * tw); c.fillRect(x - r / 2, y - r / 2, r, r); }
}
function emitVillage(c, t) { for (const w of WINDOWS) { const a = winOn(w.k, WINDOWS.length, t) * (1 + .06 * Math.sin(7.3 * t + w.k) * Math.sin(3.1 * t)); if (a <= 0) continue; c.fillStyle = hex(LIGHT, .95 * a); c.fillRect(w.x, w.y, w.w, w.h); glow(c, w.x + w.w / 2, w.y + w.h / 2, 40, LIGHT, .35 * a); } }
function emitStory(c, t, info) {
  // her cottage: window and open door
  const cot = t < H.off ? ss(seg(t, 8.6, 9.0)) : t < 25.3 ? .25 : ss(seg(t, 26.8, 27.2));
  c.fillStyle = hex(LIGHT, .9 * cot); c.fillRect(120, GROUND - 120, 40, 44); c.fillRect(DOOR[0], DOOR[1], DOOR[2], DOOR[3] * ss(seg(t, 12.3, 12.8)) * cot + 0.001);
  glow(c, 140, GROUND - 98, 60, LIGHT, .4 * cot);
  // the falling ember and its crash
  if (t > 3.3 && t < H.crash + .2) for (let k = 7; k >= 0; k--) { const p = emberPos(t - k * .045); if (!p) continue; const a = (1 - k / 8); glow(c, p[0], p[1], 46 * a + 8, ACC, .9 * a); c.fillStyle = hex('#ffe0b0', a); c.beginPath(); c.arc(p[0], p[1], 5 * a + 2, 0, 7); c.fill(); }
  const cb = seg(t, H.crash, H.crash + 1.4); if (cb > 0 && cb < 1) glow(c, CRASH[0], CRASH[1] - 30, 380 * eo(cb), ACC, .7 * (1 - cb));
  // the heart
  if (info && info.heart && t >= H.crash) { const h = heartLevel(t); if (h > 0) { glow(c, info.heart[0], info.heart[1], 26 + 70 * h, ACC, .55 * Math.min(1.3, h)); c.fillStyle = hex('#ffd2a0', Math.min(1, h)); c.beginPath(); c.arc(info.heart[0], info.heart[1], 5 + 3 * h, 0, 7); c.fill(); }
    const ey = ss(seg(t, 25.1, 25.5)); if (ey > 0) { c.fillStyle = hex('#ffcf8a', ey); c.beginPath(); c.arc(info.eye[0], info.eye[1], 3.2, 0, 7); c.fill(); } }
  // the lantern flame
  if (info && info.lantern) { const l = lanternLevel(t); if (l > 0) { glow(c, info.lantern[0], info.lantern[1], 30 + 60 * l, LIGHT, .55 * Math.min(1.2, l)); c.fillStyle = hex('#fff0c8', Math.min(1, l)); c.beginPath(); c.ellipse(info.lantern[0], info.lantern[1] + 2, 4, 8, 0, 0, 7); c.fill(); } }
  // the thread of light from the lantern to the heart
  if (info && info.lantern && info.heart && t >= H.crash) { const p = seg(t, 24.0, 25.0), q = seg(t, 25.0, 25.6); if (p > 0 && q < 1) {
    const [x0, y0] = info.lantern, [x1, y1] = info.heart, mx = (x0 + x1) / 2, my = Math.min(y0, y1) - 120, n = 40, head = eio(p), tail = ss(q);
    c.lineCap = 'round';
    for (const [w, a] of [[16, .18], [6, .55], [2.2, 1]]) { c.beginPath(); let first = true; for (let k = 0; k <= n; k++) { const u = k / n; if (u > head || u < tail) continue; const x = (1 - u) * (1 - u) * x0 + 2 * (1 - u) * u * mx + u * u * x1, y = (1 - u) * (1 - u) * y0 + 2 * (1 - u) * u * my + u * u * y1; first ? c.moveTo(x, y) : c.lineTo(x, y); first = false; } c.strokeStyle = hex(w > 10 ? LIGHT : '#ffe7c0', a); c.lineWidth = w; c.stroke(); } } }
}
let EMBER_SCR;    // ember fall path in screen space
function emberPos(t) {
  if (t < 3.3 || t > H.crash) return null;
  const c = cam(t), m = LM(4, c), u = seg(t, 3.3, H.crash);
  const sx = lerp(300, 0, 0) + (CRASH[0] * m.s + m.tx - 300) * ei(u) ** .8, sy = lerp(330, CRASH[1] * m.s + m.ty - 30, ss(u) * .25 + ei(u) * .75);
  return toLayer(m, lerp(300, CRASH[0] * m.s + m.tx, ei(u)), sy);
}

// ---------- frame ----------
function lightPoint(t, info, mStory, mSky) {
  const moon = toScreen(mSky, MOON[0], MOON[1]);
  const heart = info && info.heart ? toScreen(mStory, ...info.heart) : moon;
  const u = ss(seg(t, 9.6, 11.0)) * (1 - ss(seg(t, 33.5, 36.5)));
  return [lerp(moon[0], heart[0], u), lerp(moon[1], heart[1], u)];
}
function drawLayer(i, t, c, P, extra) {
  const m = LM(i, c), S = SHEETS[i], L = LAY[i];
  // shadow from the top spot onto the layers behind
  if (i > 0) { ctx.save(); ctx.globalAlpha = .5 * (1 - darkOf(i, t) * .6); ctx.setTransform(m.s * 2, 0, 0, m.s * 2, m.tx + 9 * m.s, m.ty + 20 * m.s); ctx.drawImage(S.sh, 0, 0); ctx.restore(); }
  tmc.setTransform(1, 0, 0, 1, 0, 0); tmc.globalCompositeOperation = 'source-over'; tmc.globalAlpha = 1; tmc.clearRect(0, 0, VW, VH);
  tmc.setTransform(m.s, 0, 0, m.s, m.tx, m.ty); tmc.drawImage(S.cv, 0, 0);
  let info = null; if (extra) info = extra(tmc, m);
  tmc.setTransform(1, 0, 0, 1, 0, 0); tmc.globalCompositeOperation = 'source-atop';
  const lit = 1 - darkOf(i, t) / .9;
  if (lit > 0) {
    const g = tmc.createRadialGradient(P[0], P[1], 0, P[0], P[1], 1500); g.addColorStop(0, hex(LIGHT, .62 * L.trans * lit)); g.addColorStop(.35, hex(LIGHT, .3 * L.trans * lit)); g.addColorStop(1, hex(LIGHT, .1 * L.trans * lit));
    tmc.fillStyle = g; tmc.fillRect(0, 0, VW, VH);
    tmc.globalAlpha = .32 * lit * L.trans; tmc.fillStyle = tmc.createPattern(MOTTLE, 'repeat'); tmc.fillRect(0, 0, VW, VH); tmc.globalAlpha = 1;
  }
  const dk = darkOf(i, t); if (dk > 0) { tmc.fillStyle = `rgba(2,3,10,${dk})`; tmc.fillRect(0, 0, VW, VH); }
  ctx.drawImage(TMP, 0, 0);
  return { m, info };
}
function emitBoth(m, fn) {
  ctx.save(); ctx.setTransform(m.s, 0, 0, m.s, m.tx, m.ty); ctx.globalCompositeOperation = 'lighter'; fn(ctx); ctx.restore();
  blc.save(); blc.setTransform(m.s / 4, 0, 0, m.s / 4, m.tx / 4, m.ty / 4); blc.globalCompositeOperation = 'lighter'; fn(blc); blc.restore();
}
function render(t) {
  const c = cam(t);
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; ctx.filter = 'none';
  ctx.fillStyle = '#07060a'; ctx.fillRect(0, 0, VW, VH);
  blc.setTransform(1, 0, 0, 1, 0, 0); blc.clearRect(0, 0, BL.width, BL.height);
  const [bx0, by0, bx1, by1, bu] = boxRect(t);
  // the room around the lamp (box framing): spill light on the table
  if (bu > 0) { glow(ctx, CX, by1 + 40, 900, LIGHT, .18 * bu); }
  ctx.save(); ctx.beginPath(); ctx.rect(bx0, by0, bx1 - bx0, by1 - by0); ctx.clip();
  const mSky = LM(0, c), mStory = LM(4, c);
  let story = {};
  const pre = { heart: null };
  { const d = withDragonInfo(t, mStory); pre.heart = d.heart; }
  const P = lightPoint(t, pre, mStory, mSky);
  for (let i = 0; i < LAY.length; i++) {
    const r = drawLayer(i, t, c, P, i === 4 ? (tc, m) => { const lan = drawGirl(tc, t, LAY[4].col); const dr = drawDragon(tc, t, '#0d1430', m); return { lantern: lan, heart: dr.heart, eye: dr.eye }; } : null);
    if (i === 0) { emitBoth(r.m, cc => emitSky(cc, t)); bloomOut(); }   // the moon's bloom sits behind the nearer sheets
    if (i === 3) emitBoth(r.m, cc => emitVillage(cc, t));
    if (i === 4) { story = r.info; emitBoth(r.m, cc => emitStory(cc, t, r.info)); }
  }
  // bloom: blur the quarter-res light buffer and add it back
  bloomOut();
  // title strip cut in paper (inside the box)
  drawTitle(t);
  // vignette inside the box
  { const g = ctx.createRadialGradient(CX, (by0 + by1) / 2, 200, CX, (by0 + by1) / 2, Math.max(bx1 - bx0, by1 - by0) * .75); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.45)'); ctx.fillStyle = g; ctx.fillRect(bx0, by0, bx1 - bx0, by1 - by0); }
  ctx.restore();
  if (bu > 0) drawFrame(bx0, by0, bx1, by1, bu);
  // ending: rack focus to the front until the story melts into warm light
  const rf = ss(seg(t, 42.4, 45.0));
  if (rf > 0) { ctx.save(); ctx.filter = `blur(${(14 * rf).toFixed(1)}px)`; ctx.globalAlpha = rf; ctx.drawImage(cv, 0, 0); ctx.restore(); ctx.fillStyle = hex(LIGHT, .16 * rf); ctx.globalCompositeOperation = 'soft-light'; ctx.fillRect(0, 0, VW, VH); ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = `rgba(7,6,10,${(ss(seg(t, 44.2, 45.0)) * .85).toFixed(3)})`; ctx.fillRect(0, 0, VW, VH); }
  drawSubs(t, by1, bu);
}
function bloomOut() {
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.filter = 'blur(10px)'; ctx.globalAlpha = .9; ctx.drawImage(BL, 0, 0, VW, VH); ctx.filter = 'blur(3px)'; ctx.globalAlpha = .6; ctx.drawImage(BL, 0, 0, VW, VH); ctx.restore();
  blc.setTransform(1, 0, 0, 1, 0, 0); blc.clearRect(0, 0, BL.width, BL.height);
}
function withDragonInfo(t, mStory) {
  // the heart position without drawing (for the light point), computed with a scratch context
  const d = dragonState(t, mStory), ca = Math.cos(d.root), sa = Math.sin(d.root);
  return { heart: [d.x + (ca * 18 - sa * 4) * d.scale, d.y + (sa * 18 + ca * 4) * d.scale] };
}
function drawFrame(x0, y0, x1, y1, u) {
  const fw = 38 * u;
  ctx.save();
  // wood frame
  const g = ctx.createLinearGradient(x0 - fw, 0, x1 + fw, 0); g.addColorStop(0, '#2a1a10'); g.addColorStop(.5, '#4a2e1a'); g.addColorStop(1, '#2a1a10');
  ctx.fillStyle = g; ctx.beginPath(); ctx.rect(x0 - fw, y0 - fw, x1 - x0 + 2 * fw, y1 - y0 + 2 * fw); ctx.rect(x1, y0, x0 - x1, y1 - y0); ctx.fill('evenodd');
  ctx.strokeStyle = hex('#ffcf90', .25 * u); ctx.lineWidth = 2; ctx.strokeRect(x0 - fw + 2, y0 - fw + 2, x1 - x0 + 2 * fw - 4, y1 - y0 + 2 * fw - 4);
  ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.lineWidth = 6; ctx.strokeRect(x0 - 3, y0 - 3, x1 - x0 + 6, y1 - y0 + 6);
  ctx.restore();
}
function drawTitle(t) {
  const p = seg(t, 40.3, 41.2); if (p <= 0) return;
  const [bx0, , bx1, by1] = boxRect(t), y = by1 - 118, w = (bx1 - bx0) - 120, x0 = bx0 + 60;
  ctx.save();
  ctx.beginPath(); ctx.rect(x0, y - 44, w * eo(p), 88); ctx.clip();
  ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 8;
  ctx.fillStyle = '#0c1126'; ctx.fillRect(x0, y - 40, w, 80); ctx.shadowColor = 'transparent';
  ctx.fillStyle = hex('#ffd9a0', .5); ctx.fillRect(x0, y - 40, w, 2);
  ctx.font = '600 58px "Cormorant Garamond"'; ctx.letterSpacing = '14px'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const a = ss(seg(t, 40.7, 41.4)) * lanternLevel(t) / 1.1;
  ctx.shadowColor = hex(LIGHT, .9); ctx.shadowBlur = 22; ctx.fillStyle = hex('#ffe2b0', a); ctx.fillText('EMBERBOUND', CX + 7, y + 3);
  ctx.restore();
}
// subtitles: warm off-white serif; on the dark ground band (full-bleed) or under the box
function wrap(txt, maxW) { if (ctx.measureText(txt).width <= maxW) return [txt]; const w = txt.split(' '); let best = null; for (let i = 1; i < w.length; i++) { const a = w.slice(0, i).join(' '), b = w.slice(i).join(' '), m = Math.max(ctx.measureText(a).width, ctx.measureText(b).width); if (!best || m < best[0]) best = [m, a, b]; } return [best[1], best[2]]; }
function subWin(v) { return [v.t - .15, v.t + Math.max(1.8, VODUR[v.id] + .6)]; }
function drawSubs(t, by1, bu) {
  for (const v of TL.vo) {
    const [a, b] = subWin(v); if (t < a || t > b) continue;
    const f = ss(seg(t, a, a + .25)) * (1 - ss(seg(t, b - .3, b)));
    ctx.save(); ctx.font = '500 48px "Cormorant Garamond"'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    const lines = wrap(v.text, 900), y = lerp(1560, by1 + 130, bu);
    // faint dark band so the words never sit on something lit
    const g = ctx.createLinearGradient(0, y - 120, 0, y + 50); g.addColorStop(0, 'rgba(4,5,12,0)'); g.addColorStop(.5, `rgba(4,5,12,${.45 * f})`); g.addColorStop(1, 'rgba(4,5,12,0)'); ctx.fillStyle = g; ctx.fillRect(0, y - 120, VW, 170);
    ctx.shadowColor = 'rgba(0,0,0,.8)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 2; ctx.fillStyle = hex('#f6ead2', .95 * f);
    lines.forEach((ln, k) => ctx.fillText(ln, CX, y - (lines.length - 1 - k) * 58));
    ctx.restore();
  }
}
window.render = render;
window.TEXTS = t => (t >= 40.7 ? [{ id: 'title', text: 'EMBERBOUND', x0: BOXF[0] + 60, y0: BOXF[3] - 160, x1: BOXF[2] - 60, y1: BOXF[3] - 78 }] : []);
window.EV = [
  { t: .3, type: 'switch' }, { t: 3.3, type: 'ember' }, { t: 4.0, type: 'slide', d: 6.5 }, { t: H.crash, type: 'crash' },
  { t: 12.3, type: 'door' }, { t: 13.0, type: 'steps', d: 5.6 }, { t: 18.9, type: 'kneel' }, { t: H.off, type: 'off' },
  { t: 23.6, type: 'lid' }, { t: 24.0, type: 'thread' }, { t: H.flare, type: 'flare' }, { t: 25.35, type: 'layers' },
  { t: H.relight, type: 'relight' }, { t: H.rise, type: 'wings' }, { t: 35.3, type: 'slide', d: 4.9 }, { t: H.moon, type: 'moon' },
  { t: 40.3, type: 'strip' }, { t: 41.3, type: 'pulse' }];
for (let k = 0; k < 16; k++) window.EV.push({ t: 6.4 + k / 16 * 2.6, type: 'window' });

(async () => {
  TL = await (await fetch('timeline.json')).json();
  VODUR = await (await fetch('voices/dur.json')).json();
  await Promise.all(['500 48px "Cormorant Garamond"', '600 58px "Cormorant Garamond"'].map(f => document.fonts.load(f)));
  BL = mkCanvas(VW / 4, VH / 4); blc = BL.getContext('2d');
  TMP = mkCanvas(VW, VH); tmc = TMP.getContext('2d');
  R = mulberry(7); buildSheets();
  // the dragon's flight in screen space: from where it lies, up past the peaks, across the moon
  const m0 = LM(4, cam(H.rise + .5)), start = toScreen(m0, CRASH[0], CRASH[1] - 46);
  const cE = cam(40.0), moonE = toScreen(LM(0, cE), MOON[0], MOON[1]);
  DRAG_PATH = { x: monotone([[H.rise + .5, start[0]], [33.5, 640], [36.5, 420], [40.0, moonE[0] - 10], [44.8, moonE[0] + 300]]),
                y: monotone([[H.rise + .5, start[1]], [33.5, 980], [36.5, 640], [40.0, moonE[1] + 6], [44.8, moonE[1] - 140]]) };
  window.READY = true;
})();
