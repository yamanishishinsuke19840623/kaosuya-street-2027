# 紙コラージュ・アニメ用の BGM と効果音を純Pythonで合成する
#   python3 synth.py <cues.json> <out.wav>
# BGM: 96BPM / 19小節 = 47.5秒（マリンバ＋ベース＋軽いリズム）
# 効果音: アニメ側（index.html）が登録したタイミング（cues.json）に合わせて鳴らす
import json, math, random, struct, sys, wave

SR = 44100
BPM = 96
B = 60 / BPM
BAR = 4 * B
DUR = 19 * BAR
N = int(SR * DUR) + SR // 2
L = [0.0] * N
R = [0.0] * N
rng = random.Random(8)


def add(i, l, r=None):
    if 0 <= i < N:
        L[i] += l
        R[i] += l if r is None else r


def hz(m):
    return 440 * 2 ** ((m - 69) / 12)


# ---------------- instruments ----------------
def marimba(t0, midi, g=0.16, pan=0.0, dec=0.42):
    f = hz(midi); s = int(t0 * SR)
    for n in range(int(dec * 3 * SR)):
        t = n / SR
        v = (math.sin(2 * math.pi * f * t) * math.exp(-t / dec)
             + 0.35 * math.sin(2 * math.pi * f * 4 * t) * math.exp(-t / 0.025)
             + 0.12 * math.sin(2 * math.pi * f * 2 * t) * math.exp(-t / (dec * .5))) * g
        v *= min(1, t / 0.002)
        add(s + n, v * (1 - pan), v * (1 + pan))


def bass(t0, midi, g=0.24, dur=0.5):
    f = hz(midi); s = int(t0 * SR)
    for n in range(int((dur + .1) * SR)):
        t = n / SR
        env = min(1, t / 0.004) * math.exp(-t / 0.28) * (1 if t < dur else max(0, 1 - (t - dur) / .1))
        v = (math.sin(2 * math.pi * f * t) + 0.3 * math.sin(4 * math.pi * f * t)) * env * g
        add(s + n, v)


def pad(t0, notes, dur, g=0.035):
    s = int(t0 * SR)
    for n in range(int(dur * SR)):
        t = n / SR
        env = min(1, t / 0.35) * min(1, (dur - t) / 0.4)
        v = sum(math.sin(2 * math.pi * hz(m) * t) + 0.2 * math.sin(2 * math.pi * hz(m) * 2.003 * t) for m in notes) * env * g
        add(s + n, v * 0.9, v * 1.1)


def kick(t0, g=0.45):
    s = int(t0 * SR); ph = 0
    for n in range(int(0.25 * SR)):
        t = n / SR
        ph += 2 * math.pi * (48 + 70 * math.exp(-t / 0.03)) / SR
        add(s + n, math.sin(ph) * math.exp(-t / 0.09) * g)


def noise(t0, dur, g, hp=0.7, dec=0.03, pan=0.0, lp=1.0):
    s = int(t0 * SR); a = b = 0.0
    for n in range(int(dur * SR)):
        t = n / SR
        x = rng.random() * 2 - 1
        a += (x - a) * (1 - hp)          # low part
        y = x - a                        # high-passed
        b += (y - b) * lp                # soften
        v = b * math.exp(-t / dec) * g
        add(s + n, v * (1 - pan), v * (1 + pan))


def snap(t0, g=0.16):
    noise(t0, 0.12, g, hp=0.55, dec=0.035, lp=0.6)


def shaker(t0, g=0.05, pan=0.25):
    noise(t0, 0.06, g, hp=0.93, dec=0.012, pan=pan)


def chime(t0, midi, g=0.08, pan=0.0):
    f = hz(midi); s = int(t0 * SR)
    for n in range(int(1.8 * SR)):
        t = n / SR
        v = (math.sin(2 * math.pi * f * t) + 0.4 * math.sin(2 * math.pi * f * 2.76 * t) * math.exp(-t / .3)) * math.exp(-t / 0.7) * g
        add(s + n, v * (1 - pan), v * (1 + pan))


# ---------------- music ----------------
CHORD = {'C': (60, 64, 67), 'Am': (57, 60, 64), 'F': (53, 57, 60), 'G': (55, 59, 62)}
ROOT = {'C': 36, 'Am': 33, 'F': 41, 'G': 43}
prog = ['C', 'G'] + ['C', 'Am', 'F', 'G'] * 4 + ['C']        # 19小節
PENTA = [60, 62, 64, 67, 69, 72, 74, 76, 79, 81, 84]
RHY = [[1, 0, 1, 1, 0, 1, 1, 0], [1, 1, 0, 1, 1, 0, 1, 0], [1, 0, 1, 0, 1, 1, 1, 1], [1, 0, 0, 1, 1, 0, 1, 0]]
QUIET = {14, 15}      # 「地域の居場所」の2小節はリズムを抜いて余韻を出す

mel = random.Random(2027)
idx = 6
for bar, ch in enumerate(prog):
    t0 = bar * BAR
    tones = [m + 12 for m in CHORD[ch]]
    pad(t0, CHORD[ch], BAR, g=0.03 if bar not in QUIET else 0.045)
    if bar == 18:
        break
    # ベース
    bass(t0, ROOT[ch]); bass(t0 + 2 * B, ROOT[ch] + (7 if bar % 2 else 12))
    if bar % 2:
        bass(t0 + 3.5 * B, ROOT[ch] + 12, g=0.15, dur=0.25)
    # メロディ（イントロ2小節はアルペジオ）
    if bar < 2:
        for k, m in enumerate([tones[0], tones[1], tones[2], tones[1] + 12, tones[2], tones[1], tones[0], tones[1]]):
            marimba(t0 + k * B / 2, m, g=0.12, pan=-0.3 + 0.08 * k)
    else:
        rhy = RHY[(bar // 2) % len(RHY)]
        for k in range(8):
            if not rhy[k]:
                continue
            if k in (0, 4):
                target = min(tones, key=lambda m: abs(PENTA[idx] - m))
                idx = min(range(len(PENTA)), key=lambda i: abs(PENTA[i] - target))
            else:
                idx = max(1, min(len(PENTA) - 2, idx + mel.choice([-2, -1, -1, 1, 1, 2])))
            g = 0.15 if bar not in QUIET else 0.12
            marimba(t0 + k * B / 2, PENTA[idx], g=g, pan=(k - 3.5) * 0.06)
            if bar in QUIET and k % 4 == 0:
                chime(t0 + k * B / 2, PENTA[idx] + 12, g=0.03, pan=0.3)
    # リズム
    if bar >= 2 and bar not in QUIET:
        for b in range(4):
            if b in (0, 2):
                kick(t0 + b * B)
            if b in (1, 3):
                snap(t0 + b * B)
        for k in range(16):
            shaker(t0 + k * B / 4 + (0.02 if k % 2 else 0), g=0.05 if k % 2 else 0.03, pan=0.3)
    elif bar < 2:
        for k in range(8):
            shaker(t0 + k * B / 2, g=0.03)

# 最後の小節: Cのロールとチャイムで締める
t0 = 18 * BAR
kick(t0, 0.35)
for k, m in enumerate([60, 64, 67, 72, 76, 79, 84]):
    marimba(t0 + k * 0.07, m, g=0.12, pan=-0.4 + 0.13 * k, dec=0.7)
for k, m in enumerate([84, 88, 91]):
    chime(t0 + 0.3 + k * 0.18, m, g=0.05, pan=0.3 - 0.3 * k)
bass(t0, 36, dur=1.5)

# ---------------- sound effects from cues ----------------
def sfx_paper(t0, seed):
    r = random.Random(seed)
    pan = r.uniform(-0.4, 0.4)
    s = int(t0 * SR); a = 0.0; n1 = int(0.15 * SR)
    for n in range(n1):
        u = n / n1
        x = rng.random() * 2 - 1
        a += (x - a) * (0.25 + 0.5 * u)
        env = math.sin(math.pi * u) ** 1.5
        v = (x - a * 0.6) * env * 0.11
        add(s + n, v * (1 - pan), v * (1 + pan))


def sfx_tile(t0, seed):
    r = random.Random(seed)
    f = r.uniform(420, 620); s = int(t0 * SR)
    noise(t0, 0.02, 0.10, hp=0.9, dec=0.004)
    for n in range(int(0.06 * SR)):
        t = n / SR
        add(s + n, math.sin(2 * math.pi * f * t) * math.exp(-t / 0.018) * 0.07)


def sfx_pop(t0, seed):
    r = random.Random(seed)
    f0 = r.uniform(520, 700); s = int(t0 * SR); ph = 0
    for n in range(int(0.09 * SR)):
        t = n / SR
        ph += 2 * math.pi * (f0 + 900 * t / 0.09) / SR
        v = math.sin(ph) * math.exp(-t / 0.035) * 0.11
        add(s + n, v)


def sfx_bounce(t0, seed):
    s = int(t0 * SR); ph = 0
    for n in range(int(0.22 * SR)):
        t = n / SR
        ph += 2 * math.pi * (240 + 1600 * t + 30 * math.sin(2 * math.pi * 18 * t)) / SR
        add(s + n, math.sin(ph) * math.exp(-t / 0.09) * 0.09)


def sfx_stamp(t0, seed):
    s = int(t0 * SR); ph = 0
    for n in range(int(0.35 * SR)):
        t = n / SR
        ph += 2 * math.pi * (45 + 60 * math.exp(-t / 0.03)) / SR
        add(s + n, math.sin(ph) * math.exp(-t / 0.12) * 0.5)
    noise(t0, 0.12, 0.25, hp=0.3, dec=0.03, lp=0.3)


def sfx_whoosh(t0, seed):
    s = int(t0 * SR); a = 0.0; n1 = int(0.62 * SR)
    for n in range(n1):
        u = n / n1
        x = rng.random() * 2 - 1
        a += (x - a) * (0.03 + 0.35 * math.sin(math.pi * u))
        env = math.sin(math.pi * u) ** 2
        pan = 0.8 - 1.6 * u      # 紙は右から左へ
        v = a * env * 0.35
        add(s + n, v * (1 - pan), v * (1 + pan))


FX = {'paper': sfx_paper, 'tile': sfx_tile, 'pop': sfx_pop, 'bounce': sfx_bounce, 'stamp': sfx_stamp, 'whoosh': sfx_whoosh}
cues = json.load(open(sys.argv[1]))
for i, c in enumerate(cues):
    fn = FX.get(c['type'])
    if fn and c['t'] < DUR:
        fn(c['t'], i)

# ---------------- mix ----------------
end = int(DUR * SR)
peak = max(max(abs(x) for x in L[:end]), max(abs(x) for x in R[:end])) or 1
g = 1.9 / peak
out = bytearray()
for i in range(end):
    fade = min(1.0, (end - i) / (0.4 * SR))
    out += struct.pack('<hh', int(math.tanh(L[i] * g) * 0.9 * fade * 32767), int(math.tanh(R[i] * g) * 0.9 * fade * 32767))
with wave.open(sys.argv[2], 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(bytes(out))
print('wrote', sys.argv[2], len(cues), 'cues')
