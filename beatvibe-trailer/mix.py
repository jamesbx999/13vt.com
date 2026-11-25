# score (sampled instruments + synthesis) + foley from events.json + narration → out/mix.wav (48k stereo)
# usage: "$LIB/.venv/bin/python" mix.py   (run with the library's venv; LIB is the library folder)
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
LIB = os.environ.get('LIB') or sys.exit('set LIB to the library folder')
sys.path.insert(0, LIB)
import numpy as np, soundfile as sf
from scipy.signal import butter, sosfilt, resample_poly, fftconvolve
from core.audio import sampler as S
from core.audio.sfx import compress, limit

TL = json.load(open(f'{HERE}/timeline.json'))
EVS = json.load(open(f'{HERE}/events.json'))['ev']
VODUR = json.load(open(f'{HERE}/voices/dur.json'))
SR = 48000; DUR = TL['dur']; N = int(DUR * SR)
B = TL['beat']; BAR = TL['bar']
rng = np.random.default_rng(7); S.seed(7)
def bp(x, lo, hi, o=2): return sosfilt(butter(o, [lo, hi], 'band', fs=SR, output='sos'), x)
def lp(x, f, o=2): return sosfilt(butter(o, f, 'low', fs=SR, output='sos'), x)
def hp(x, f, o=2): return sosfilt(butter(o, f, 'high', fs=SR, output='sos'), x)
def noise(n): return rng.standard_normal(n)
def norm(x, p=1.0): return x / (np.abs(x).max() + 1e-9) * p
def st(x, pan=0.0):
    l = np.cos((pan + 1) * np.pi / 4); r = np.sin((pan + 1) * np.pi / 4)
    return np.stack([x * l * 1.414, x * r * 1.414], 1)
def put(buf, t, x, g=1.0):
    i = int(round(t * SR)); j = min(len(buf), i + len(x))
    if j > i: buf[i:j] += x[:j - i] * g
def rms(x): return np.sqrt(np.mean(x ** 2) + 1e-12)
def fade_env(n, segs):   # piecewise-linear gain over the film: [(t, g), ...]
    t = np.arange(n) / SR; ts, gs = zip(*segs); return np.interp(t, ts, gs)

# ============ score ============
b = lambda bar, beat=0: bar * BAR + beat * B     # bar 0 starts at t = 0
ev = []
def kal(t, p, v=.6, pan=-.2): ev.append((t, 'kalimba', p, 2.5, v, pan))
# A · Drop: one note on the drop, then the motif; a bowed-vibraphone pad
kal(TL['hits']['drop'], 'D4', .75, 0)
MOTIF = [(0, 'A3'), (.5, 'C4'), (1, 'D4'), (2, 'F4'), (2.5, 'E4'), (3, 'D4')]
for bt, p in MOTIF[3:]: kal(b(1, bt), p, .62)      # the motif's tail only, after the first line is spoken
for p in ['A3', 'C4', 'E4', 'F4']: ev.append(dict(t=.9, inst='vibraphone_bowed', pitch=p, dur=4.3, vel=.32, pan=.25, attack=1.2))
# B/C · Groove (bars 2–6, 5.33–18.67): hip-hop kit, upright piano chords, kalimba motif, bass from the burst
CH = {2: ['D3', 'F3', 'A3', 'C4'], 3: ['Bb2', 'D3', 'F3', 'A3'], 4: ['G2', 'Bb2', 'D3', 'F3'], 5: ['A2', 'C#3', 'E3', 'G3'],
      6: ['D3', 'F3', 'A3', 'C4'], 7: ['Bb2', 'D3', 'F3', 'A3']}
ROOT = {2: 'D2', 3: 'Bb1', 4: 'G1', 5: 'A1', 6: 'D2', 7: 'Bb1'}
for bar in range(2, 8):
    t0 = b(bar)
    for k in [0, 2.5]: ev.append((t0 + k * B, 'drum_kit', 'kick_drum_left', None, .78 if k == 0 else .62, 0))
    if bar >= 3: ev.append((t0 + 3.5 * B, 'drum_kit', 'kick_drum_right', None, .45, 0))
    for k in [1, 3]:
        ev.append((t0 + k * B, 'drum_kit', 'snare_1', None, .5, .05))
        ev.append((t0 + k * B + .012, 'claps', 'group', None, .55, -.1))
    for k in range(8):
        ev.append((t0 + k * B / 2 + (.025 if k % 2 else 0), 'drum_kit', 'hi_hat_closed', None, .42 if k % 2 == 0 else .28, .35))
    if bar >= 6: ev.append((t0 + 3.5 * B, 'drum_kit', 'hi_hat_open', None, .3, .35))
    for p in CH[bar]: ev.append((t0, 'upright', p, BAR * .9, .42, -.15))
    ev.append((t0 + 2.5 * B, 'upright', CH[bar][-1], B * 1.2, .3, -.15))
    if bar % 2 == 0:
        for bt, p in MOTIF: kal(t0 + bt * B, p, .5, -.3)
    else:
        for bt, p in [(0, 'F4'), (1, 'E4'), (1.5, 'D4'), (2, 'C4'), (3, 'A3')]: kal(t0 + bt * B, p, .42, -.3)
    if bar >= 6:   # lights: pad
        for p in [x for x in CH[bar] if S.midi(x) >= 57] + ['E4']: ev.append(dict(t=t0, inst='vibraphone_bowed', pitch=p, dur=BAR, vel=.34, pan=.3, attack=.3))
# burst sparkle
for i, p in enumerate(['D6', 'A6', 'F6', 'C7', 'E6', 'A5']): ev.append((TL['hits']['burst'] + i * .07, 'glockenspiel', p, 1.5, .45, -.4 + i * .16))
# D · Calm (bars 8–12, 21.33–34.67): pad, slow kalimba, flute; the bowl is synthesised below
CALM = {8: ['A3', 'C4', 'E4', 'F4'], 9: ['A3', 'C4', 'E4', 'F4'], 10: ['A3', 'D4', 'E4', 'F4'], 11: ['A3', 'D4', 'E4', 'F4'], 12: ['A3', 'D4', 'F4', 'Bb3']}
for bar, ps in CALM.items():
    for p in ps: ev.append(dict(t=b(bar), inst='vibraphone_bowed', pitch=p, dur=BAR + .4, vel=.3, pan=.2, attack=.9))
for k, p in enumerate(['D4', 'A3', 'F4', 'E4', 'C4', 'D4', 'A3', 'F4', 'G4', 'E4', 'D4', 'C4', 'A3']):
    kal(b(8, 2) + k * 2 * B, p, .38, -.25)
ev.append(dict(t=b(9), inst='flute', pitch='A4', dur=BAR * 1.6, vel=.35, pan=.35, attack=.6))
ev.append(dict(t=b(10, 2), inst='flute', pitch='F4', dur=BAR * 1.1, vel=.32, pan=.35, attack=.6))
ev.append(dict(t=b(11, 2), inst='flute', pitch='E4', dur=BAR * 1.3, vel=.32, pan=.35, attack=.6))
# E · Resolve (bars 13–16, 34.67–45): motif returns over a gentle kick on beat 1
RES = {13: ['A3', 'C4', 'E4', 'F4'], 14: ['A3', 'D4', 'F4', 'Bb3'], 15: ['A3', 'C4', 'E4', 'F4'], 16: ['A3', 'D4', 'E4', 'F#4']}
for bar, ps in RES.items():
    t0 = b(bar)
    ev.append((t0, 'drum_kit', 'kick_drum_left', None, .55, 0))
    if bar < 16: ev.append((t0 + 2 * B, 'drum_kit', 'kick_drum_left', None, .35, 0))
    for p in ps: ev.append(dict(t=t0, inst='vibraphone_bowed', pitch=p, dur=BAR + (1.8 if bar == 16 else .3), vel=.32, pan=.2, attack=.5))
    if bar in (13, 15):
        for bt, p in MOTIF: kal(t0 + bt * B, p, .55, -.25)
    if bar == 14:
        for bt, p in [(0, 'F4'), (1, 'E4'), (1.5, 'D4'), (2, 'C4'), (3, 'A3')]: kal(t0 + bt * B, p, .48, -.25)
ev.append((TL['hits']['seal'], 'upright', 'D3', 2.3, .45, 0))
kal(TL['hits']['lastdrop'], 'D4', .7, 0)
ev.append((TL['hits']['lastdrop'], 'glockenspiel', 'D6', 1.0, .35, .2))

music = S.render(ev, dur=DUR + 2, master=False)[:N]
# synth sub-bass with 2nd/3rd harmonics from the burst (bars 5–6)
bass = np.zeros(N)
for bar in (5, 6):
    t0 = b(bar); f = S.hz(ROOT[bar + 1])
    for k in [0, 2.5]:
        d = (2.5 if k == 0 else 1.5) * B; n = int(d * SR); tt = np.arange(n) / SR
        x = (np.sin(2 * np.pi * f * tt) + .45 * np.sin(4 * np.pi * f * tt) + .22 * np.sin(6 * np.pi * f * tt)) * np.minimum(1, tt / .01) * np.exp(-tt / (d * .8))
        put(bass, t0 + k * B, x * .5)
music += st(lp(bass, 400), 0) * .7
# singing bowl: inharmonic partials with slow beating; first sound after the silence
def bowl(f0, d, g):
    n = int(d * SR); tt = np.arange(n) / SR; x = np.zeros(n)
    for r, a, tau in [(1, 1, 6), (2.71, .5, 4), (5.2, .22, 2.4), (8.4, .09, 1.4)]:
        x += a * np.sin(2 * np.pi * f0 * r * tt + rng.random() * 6) * (1 + .25 * np.sin(2 * np.pi * (1.3 + r * .4) * tt)) * np.exp(-tt / tau)
    x += hp(noise(n), 2000) * np.exp(-tt / .01) * .4
    return norm(x * np.minimum(1, tt / .004), g)
put_s = lambda t, x, g, pan=0: put(music, t, st(x, pan), g)
put_s(TL['hits']['bowl'], bowl(146.8, 9, 1), .55, -.1)
put_s(b(11), bowl(110.0, 7, 1), .3, .15)
music = S.room(music, size=.5, mix=.2)
# the silence: music fully out on the cut, back on the bowl
music *= fade_env(N, [(0, 1), (TL['hits']['cut'] - .05, 1), (TL['hits']['cut'] + .02, 0), (TL['hits']['bowl'] - .01, 0), (TL['hits']['bowl'], 1), (DUR, 1)])[:, None]
music = np.concatenate([music, np.zeros((max(0, N - len(music)), 2))])[:N]
# the groove carries the energy of the film: lift it against the calm half
music *= fade_env(N, [(0, 1), (5.2, 1), (5.33, 2.1), (13.3, 2.1), (13.33, 2.4), (18.67, 2.4), (18.7, 1), (DUR, 1)])[:, None]

# ============ ambience + foley ============
sfx = np.zeros((N, 2))
def brush(d, g, pan0=-.5, pan1=.5):
    n = int(d * SR); p = np.arange(n) / n
    x = bp(noise(n), 1500, 7000) * (.6 + .4 * np.abs(np.sin(np.arange(n) / SR * 2 * np.pi * 9))) + bp(noise(n), 300, 1500) * .3
    y = norm(x * np.sin(np.pi * p) ** .8, .5) * g; pan = pan0 + (pan1 - pan0) * p
    return np.stack([y * np.cos((pan + 1) * np.pi / 4) * 1.414, y * np.sin((pan + 1) * np.pi / 4) * 1.414], 1)
def pencil(d, g):
    n = int(d * SR); tt = np.arange(n) / SR
    x = bp(noise(n), 2500, 9000) * (.5 + .5 * (np.sin(2 * np.pi * 7 * tt) > 0)) * np.sin(np.pi * tt / d) ** .5
    return st(norm(x, .3) * g, .3)
def dropsnd(g):
    n = int(.9 * SR); tt = np.arange(n) / SR
    x = np.sin(2 * np.pi * np.cumsum(420 + 900 * np.exp(-tt * 40)) / SR) * np.exp(-tt * 14) * .7 + lp(noise(n), 1200) * np.exp(-tt * 30) * .5
    return st(norm(x, .7) * g)
def stamp(g):
    n = int(1.2 * SR); tt = np.arange(n) / SR
    x = np.sin(2 * np.pi * np.cumsum(90 * (1 + .5 * np.exp(-tt * 30))) / SR) * np.exp(-tt * 9) + lp(noise(n), 900) * np.exp(-tt * 20) * .6
    return st(norm(x, .8) * g)
def mist(d, g):
    n = int(d * SR); p = np.arange(n) / n
    return st(norm(bp(noise(n), 400, 3000) * np.sin(np.pi * p) ** 1.5, .4) * g, 0)
def plink(g):
    n = int(.6 * SR); tt = np.arange(n) / SR
    return st(norm(np.sin(2 * np.pi * np.cumsum(1400 - 700 * tt) / SR) * np.exp(-tt * 12), .5) * g, .2)
def sparkle(g):
    out = np.zeros((int(1.2 * SR), 2))
    for i in range(18):
        n = int(.25 * SR); tt = np.arange(n) / SR; f = rng.uniform(3000, 7000)
        put(out, rng.uniform(0, .9), st(np.sin(2 * np.pi * f * tt) * np.exp(-tt * 25), rng.uniform(-.8, .8)), .08)
    return out * g
for e in EVS:
    ty = e['type']; t = e['t']
    if ty == 'brush': put(sfx, t, brush(e.get('d', 1), e.get('g', .5), e.get('pan0', -.5), e.get('pan1', .5)))
    elif ty == 'pencil': put(sfx, t, pencil(e.get('d', 1), .45))
    elif ty == 'drop': put(sfx, t, dropsnd(.6))
    elif ty == 'stamp': put(sfx, t, stamp(.7))
    elif ty == 'mist': put(sfx, t, mist(e.get('d', 2.4), .5))
    elif ty == 'plink': put(sfx, t, plink(.35))
    elif ty == 'burst': put(sfx, t, sparkle(1.0))
# beds: paper/room throughout, city hum in A/B/C, water and soft wind in D
room = lp(noise(N), 3000) * .006
city = lp(np.cumsum(noise(N)) * .002, 250); city -= lp(city, 30); city = norm(city, .08)
city *= fade_env(N, [(0, 0), (5.0, 0), (6.5, .7), (13.3, .8), (14.0, 1.2), (18.6, 1.0), (19.6, 0), (DUR, 0)])
water = bp(noise(N), 200, 1800) * (.6 + .4 * np.sin(2 * np.pi * .15 * np.arange(N) / SR)) ; water = norm(water, .05)
water *= fade_env(N, [(0, 0), (21.2, 0), (23.0, 1), (34.0, 1), (36.0, .3), (DUR, .2)])
wind = norm(lp(noise(N), 500), .03) * fade_env(N, [(0, 0), (21.2, 0), (24, 1), (34, 1), (36, 0), (DUR, 0)])
sfx += st(room) + st(city, -.1) + np.stack([water, np.roll(water, 900)], 1) + st(wind, .2)

# ============ voice ============
vo = np.zeros((N, 2)); mask = np.zeros(N)
for v in TL['vo']:
    x, sr = sf.read(f"{HERE}/voices/{v['id']}.wav")
    if x.ndim > 1: x = x.mean(1)
    x = resample_poly(x, SR, sr); x = hp(x, 90)
    r = rms(x[np.abs(x) > .02 * np.abs(x).max()])
    x = np.clip(x, -r * 3.5, r * 3.5)                  # tame Kokoro's peaks before levelling
    x = compress(x / (r * 3.5) * .5, thr=.2, ratio=3)
    put(vo, v['t'], st(x, 0))
    i = int(v['t'] * SR); mask[i:i + len(x)] = 1
# level: voice RMS ≈ music RMS + 8 dB during speech; music ducks ~4 dB under voice
sm = np.convolve(mask, np.ones(int(.3 * SR)) / int(.3 * SR), 'same')
mus_speech = rms(music[mask > 0]) if mask.any() else rms(music)
vo *= (mus_speech * 10 ** (7 / 20)) / rms(vo[mask > 0])
music *= (1 - .37 * sm)[:, None]
# reverb send for voice (short, soft)
irn = int(.6 * SR); ir = noise(irn) * np.exp(-np.arange(irn) / SR * 9); ir /= np.sqrt((ir ** 2).sum())
vo = vo * .88 + np.stack([fftconvolve(vo[:, 0], ir)[:N], fftconvolve(vo[:, 1], ir[::-1])[:N]], 1) * .12

mix = music + sfx * 1.0 + vo
mix = limit(mix / np.abs(mix).max() * .89, .9)
os.makedirs(f'{HERE}/out', exist_ok=True)
sf.write(f'{HERE}/out/mix.wav', mix.astype(np.float32), SR)
for name, x in [('music', music), ('sfx', sfx), ('voice', vo)]: print(name, 'rms dB', round(20 * np.log10(rms(x)), 1))
inst = sorted({e[1] if isinstance(e, tuple) else e['inst'] for e in ev})
open(f'{HERE}/out/instruments.json', 'w').write(json.dumps(inst))
print('instruments', inst)
