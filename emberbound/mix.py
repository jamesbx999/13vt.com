# Emberbound: original score (harp, soft strings, flute, chimes; single gong / frame-drum strokes) + paper & light foley + narration
# usage: LIB=<library> "$LIB/.venv/bin/python" mix.py [out.wav]
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
LIB = os.environ.get('LIB') or sys.exit('set LIB to the library folder')
sys.path.insert(0, LIB)
import numpy as np, soundfile as sf
from scipy.signal import butter, sosfilt, resample_poly, fftconvolve
from core.audio import sampler as S
from core.audio.sfx import compress, limit

TL = json.load(open(f'{HERE}/timeline.json')); EVS = json.load(open(f'{HERE}/events.json'))['ev']
SR = 48000; DUR = TL['dur']; N = int(DUR * SR); B = TL['beat']; BAR = TL['bar']; HIT = TL['hits']
rng = np.random.default_rng(5); S.seed(5)
def bp(x, lo, hi, o=2): return sosfilt(butter(o, [lo, hi], 'band', fs=SR, output='sos'), x)
def lp(x, f, o=2): return sosfilt(butter(o, f, 'low', fs=SR, output='sos'), x)
def hp(x, f, o=2): return sosfilt(butter(o, f, 'high', fs=SR, output='sos'), x)
def noise(n): return rng.standard_normal(n)
def norm(x, p=1.0): return x / (np.abs(x).max() + 1e-9) * p
def st(x, pan=0.0): l = np.cos((pan + 1) * np.pi / 4); r = np.sin((pan + 1) * np.pi / 4); return np.stack([x * l * 1.414, x * r * 1.414], 1)
def put(buf, t, x, g=1.0):
    i = int(round(t * SR)); j = min(len(buf), i + len(x))
    if j > i: buf[i:j] += x[:j - i] * g
def rms(x): return np.sqrt(np.mean(x ** 2) + 1e-12)
def env(segs): t = np.arange(N) / SR; ts, gs = zip(*segs); return np.interp(t, ts, gs)
b = lambda bar, beat=0: bar * BAR + beat * B

ev = []
def E(t, inst, p, d, v, pan=0, **k): ev.append(dict(t=t, inst=inst, pitch=p, dur=d, vel=v, pan=pan, **k))
# harp ostinato (A minor → F → C → G), eighths
ARP = {'Am': ['A2', 'E3', 'A3', 'C4', 'E4', 'C4', 'A3', 'E3'], 'F': ['F2', 'C3', 'F3', 'A3', 'C4', 'A3', 'F3', 'C3'],
       'C': ['C3', 'G3', 'C4', 'E4', 'G4', 'E4', 'C4', 'G3'], 'G': ['G2', 'D3', 'G3', 'B3', 'D4', 'B3', 'G3', 'D3'],
       'A': ['A2', 'E3', 'A3', 'C#4', 'E4', 'C#4', 'A3', 'E3'], 'D': ['D3', 'A3', 'D4', 'F#4', 'A4', 'F#4', 'D4', 'A3'],
       'Dm': ['D3', 'A3', 'D4', 'F4', 'A4', 'F4', 'D4', 'A3'], 'E': ['E2', 'B2', 'E3', 'G#3', 'B3', 'G#3', 'E3', 'B2']}
PAD = {'Am': ['A3', 'C4', 'E4'], 'F': ['A3', 'C4', 'F4'], 'C': ['G3', 'C4', 'E4'], 'G': ['G3', 'B3', 'D4'], 'A': ['A3', 'C#4', 'E4'],
       'D': ['A3', 'D4', 'F#4'], 'Dm': ['A3', 'D4', 'F4'], 'E': ['G#3', 'B3', 'E4']}
BASS = {'Am': 'A2', 'F': 'F2', 'C': 'C3', 'G': 'G2', 'A': 'A2', 'D': 'D3', 'Dm': 'D3', 'E': 'E2'}
def harp_bar(bar, ch, v=.45, half=False):
    for k, p in enumerate(ARP[ch]):
        if half and k % 2: continue
        E(b(bar, k / 2), 'harp', p, B * 1.5, v * (1 if k % 4 == 0 else .8), -.3 + .08 * (k % 4))
# 0–10: night (bars 0–2): harp alone at first, chimes on the pinhole and the windows, a high string pad
E(HIT['pinhole'], 'hand_chimes', 'E6', 2.5, .5, .3)
for bar, ch in [(0, 'Am'), (1, 'F'), (2, 'Am')]:
    harp_bar(bar, ch, .38 if bar == 0 else .45, half=bar == 0)
    for p in PAD[ch]: E(b(bar), 'violins', S.name(S.midi(p) + 12), BAR, .18, .2, attack=.8)
for k in range(8): E(6.4 + k * .33, 'hand_chimes', ['A5', 'C6', 'E6', 'A6', 'G5', 'E6', 'C6', 'A5'][k], 1.5, .28, -.5 + k * .14)
# 10: the crash — frame drum and gong, one stroke each
ev.append((HIT['crash'], 'frame_drum', 'large', None, .8, 0)); ev.append((HIT['crash'] + .02, 'gong', None, None, .32, .1))
# 10–20: snow (bars 3–5): low strings + flute melody, harp thinning
MEL = [(0, 'E5', 1.5), (1.5, 'D5', .5), (2, 'C5', 1), (3, 'B4', 1), (4, 'A4', 2.5), (7, 'C5', 1), (8, 'B4', 1.5), (9.5, 'A4', .5), (10, 'G4', 2)]
for bar, ch in [(3, 'Am'), (4, 'F'), (5, 'E')]:
    harp_bar(bar, ch, .34, half=True)
    E(b(bar), 'cellos', BASS[ch], BAR, .38, -.2, attack=.4)
    for p in PAD[ch]: E(b(bar), 'violas', p, BAR, .26, .25, attack=.6)
for bt, p, d in MEL: E(b(3, bt), 'flute', p, d * B, .42, .3, attack=.08)
# 20.0–23.33: silence. 23.33–30: light returns (bars 7–8), C → C# on the flare
for bar, ch in [(7, 'Dm'), (8, 'A')]:
    harp_bar(bar, ch, .5)
for p in ['D3', 'F3', 'A3', 'C4']: E(b(7), 'violins' if S.midi(p) >= 55 else 'cellos', p, 2 * B, .32, 0, attack=.6)
for p in ['A2', 'E3', 'A3', 'C#4', 'E4']: E(HIT['flare'], 'violins' if S.midi(p) >= 55 else 'cellos', p, 4.5, .5, 0, attack=.25)
for k in range(10): E(25.35 + k * .2, 'hand_chimes', ['A5', 'C#6', 'E6', 'A6', 'E6', 'C#6', 'A5', 'E6', 'A6', 'C#7'][k], 1.4, .3, -.6 + k * .13)
E(HIT['relight'], 'hand_chimes', 'A6', 2, .4, -.2)
# 30–45: flight (bars 9–13): full theme
THEME = [(0, 'A4', 1), (1, 'C#5', 1), (2, 'E5', 2), (4, 'F#5', 1.5), (5.5, 'E5', .5), (6, 'D5', 2), (8, 'C#5', 1), (9, 'E5', 1), (10, 'A5', 3), (13, 'G#5', 1), (14, 'A5', 4)]
for bar, ch in [(9, 'A'), (10, 'D'), (11, 'A'), (12, 'E'), (13, 'A')]:
    harp_bar(bar, ch, .5)
    E(b(bar), 'cellos', BASS[ch], BAR, .45, -.2, attack=.3)
    for p in PAD[ch]: E(b(bar), 'violins', S.name(S.midi(p) + 12), BAR, .3, .25, attack=.4)
for bt, p, d in THEME: E(b(9, bt), 'flute', p, d * B, .5, .3, attack=.06)
ev.append((HIT['moon'], 'gong', None, None, .28, -.1))
for p in ['A2', 'E3', 'A3', 'C#4', 'E4', 'A4']: E(b(13), 'violins' if S.midi(p) >= 55 else 'cellos', p, 45 - b(13), .38, 0, attack=.5)
music = S.render(ev, dur=DUR + 3, master=False)[:N]
music = np.concatenate([music, np.zeros((max(0, N - len(music)), 2))])[:N]
music = S.room(music, size=.62, mix=.26)
music *= env([(0, 1), (HIT['off'] - .05, 1), (HIT['off'] + .35, 0), (HIT['back'] - .01, 0), (HIT['back'] + .3, 1), (DUR - 2.0, 1), (DUR, 0)])[:, None]

# ---- foley: paper and light ----
sfx = np.zeros((N, 2))
def click(): n = int(.08 * SR); tt = np.arange(n) / SR; return st(norm(hp(noise(n), 2000) * np.exp(-tt * 120) + np.sin(2 * np.pi * 1800 * tt) * np.exp(-tt * 60) * .4, .5))
def shimmer(d, g=.3): n = int(d * SR); tt = np.arange(n) / SR; x = sum(np.sin(2 * np.pi * f * tt * (1 + .002 * np.sin(tt * 5 + f))) for f in [2637, 3136, 3951, 5274]) * np.sin(np.pi * tt / d) ** 2; return st(norm(x, g))
def rustle(d, g=.35, p0=-.5, p1=.5):
    n = int(d * SR); p = np.arange(n) / n; x = bp(noise(n), 800, 6000) * (.5 + .5 * np.abs(np.sin(np.arange(n) / SR * 2 * np.pi * 5))); y = norm(x * np.sin(np.pi * p) ** 1.2, .4) * g
    pan = p0 + (p1 - p0) * p; return np.stack([y * np.cos((pan + 1) * np.pi / 4) * 1.414, y * np.sin((pan + 1) * np.pi / 4) * 1.414], 1)
def hiss(d, g): n = int(d * SR); tt = np.arange(n) / SR; return st(norm(bp(noise(n), 2500, 9000) * np.minimum(1, tt / d * 3) * np.exp(-np.maximum(0, tt - d * .8) * 20), g), -.3)
def thump(g, f=70): n = int(1.4 * SR); tt = np.arange(n) / SR; return st(norm(np.sin(2 * np.pi * np.cumsum(f * (1 + np.exp(-tt * 20))) / SR) * np.exp(-tt * 4) + lp(noise(n), 600) * np.exp(-tt * 12) * .5, g))
def burst_snow(g): n = int(1.6 * SR); tt = np.arange(n) / SR; return st(norm(bp(noise(n), 300, 4000) * np.exp(-tt * 3.5), g))
def step(): n = int(.18 * SR); tt = np.arange(n) / SR; return norm(bp(noise(n), 500, 3500) * np.exp(-tt * 28), .3)
def whoomph(g): n = int(1.6 * SR); tt = np.arange(n) / SR; return st(norm(lp(noise(n), 900) * np.minimum(1, tt / .08) * np.exp(-tt * 2.5) + np.sin(2 * np.pi * 55 * tt) * np.exp(-tt * 3) * .6, g))
def flap(): n = int(.35 * SR); tt = np.arange(n) / SR; return norm(bp(noise(n), 200, 2200) * np.sin(np.pi * tt / .35) ** 2, .35)
for e in EVS:
    t, ty = e['t'], e['type']
    if ty == 'switch': put(sfx, t, click()); put(sfx, t + .05, shimmer(2.2, .25))
    elif ty == 'ember': put(sfx, t, hiss(6.6, .18))
    elif ty == 'slide': put(sfx, t, rustle(e.get('d', 2), .3, -.3, .3))
    elif ty == 'crash': put(sfx, t, thump(.7)); put(sfx, t + .02, burst_snow(.4))
    elif ty == 'door': put(sfx, t, rustle(.6, .25, -.7, -.5))
    elif ty == 'steps':
        for k in range(int(e['d'] / .5)): put(sfx, t + k * .5, st(step(), -.4 + k * .06))
    elif ty == 'kneel': put(sfx, t, rustle(.7, .2, -.1, 0))
    elif ty == 'lid': put(sfx, t, click() * .7)
    elif ty == 'thread': put(sfx, t, shimmer(1.4, .3))
    elif ty == 'flare': put(sfx, t, whoomph(.65))
    elif ty == 'layers':
        for k in range(6): put(sfx, t + k * .4, rustle(.5, .16, -.5 + k * .2, -.3 + k * .2))
    elif ty == 'relight': put(sfx, t, click() * .6); put(sfx, t + .03, shimmer(1.2, .2))
    elif ty == 'wings':
        for k in range(12): put(sfx, t + .8 + k * 1.25, st(flap(), .2), .8 - k * .05)
    elif ty == 'moon': pass
    elif ty == 'strip': put(sfx, t, rustle(1.0, .3, -.4, .4))
    elif ty == 'pulse': put(sfx, t, shimmer(1.0, .18))
    elif ty == 'window': put(sfx, t, shimmer(.35, .05))
wind = norm(bp(noise(N), 150, 1200) * (.6 + .4 * np.sin(2 * np.pi * .07 * np.arange(N) / SR)), .05)
wind *= env([(0, .4), (4, 1), (HIT['off'], 1), (HIT['off'] + .3, 0), (HIT['back'], 0), (26, .8), (40, .6), (DUR, 0)])
room = lp(noise(N), 2500) * .003
sfx += np.stack([wind, np.roll(wind, 700)], 1) + st(room)

# ---- voice ----
vo = np.zeros((N, 2)); mask = np.zeros(N)
for v in TL['vo']:
    x, sr = sf.read(f"{HERE}/voices/{v['id']}.wav"); x = x.mean(1) if x.ndim > 1 else x
    x = hp(resample_poly(x, SR, sr), 90); r = rms(x[np.abs(x) > .02 * np.abs(x).max()])
    x = compress(np.clip(x, -r * 3.5, r * 3.5) / (r * 3.5) * .5, thr=.2, ratio=3)
    put(vo, v['t'], st(x)); i = int(v['t'] * SR); mask[i:i + len(x)] = 1
sm = np.convolve(mask, np.ones(int(.3 * SR)) / int(.3 * SR), 'same')
mus_on = rms(music[(mask > 0) & (np.abs(music[:, 0]) > 1e-5)])
vo *= mus_on * 10 ** (8 / 20) / rms(vo[mask > 0])
music *= (1 - .45 * sm)[:, None]
irn = int(.7 * SR); ir = noise(irn) * np.exp(-np.arange(irn) / SR * 7); ir /= np.sqrt((ir ** 2).sum())
vo = vo * .86 + np.stack([fftconvolve(vo[:, 0], ir)[:N], fftconvolve(vo[:, 1], ir[::-1])[:N]], 1) * .14
mix = music + sfx * 1.1 + vo
mix = limit(mix / np.abs(mix).max() * .89, .9)
os.makedirs(f'{HERE}/out', exist_ok=True)
sf.write(sys.argv[1] if len(sys.argv) > 1 else f'{HERE}/out/mix.wav', mix.astype(np.float32), SR)
for name, x in [('music', music), ('sfx', sfx), ('voice', vo)]: print(name, 'rms dB', round(20 * np.log10(rms(x)), 1))
inst = sorted({e[1] if isinstance(e, tuple) else e['inst'] for e in ev}); open(f'{HERE}/out/instruments.json', 'w').write(json.dumps(inst)); print('instruments', inst)
