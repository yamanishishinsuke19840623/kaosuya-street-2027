# 15秒 / 128BPM / 8小節 のショーリール用トラックを純Pythonで合成する
import math, random, wave, struct, sys

SR = 44100
BPM = 128
B = 60 / BPM          # 1拍 = 0.46875s
BAR = B * 4           # 1小節 = 1.875s
DUR = 15.0
N = int(SR * DUR)
L = [0.0] * N
R = [0.0] * N
rnd = random.Random(7)
kicks = []

def add(i, l, r=None):
    if 0 <= i < N:
        L[i] += l
        R[i] += l if r is None else r

def duck(t):
    # サイドチェイン: 直近のキックからの経過でダッキング
    d = 1.0
    for k in kicks:
        if 0 <= t - k < 0.3:
            d = min(d, 1 - 0.75 * math.exp(-(t - k) / 0.09))
    return d

def kick(t0, gain=1.0, big=False):
    kicks.append(t0)
    dur = 0.9 if big else 0.38
    s = int(t0 * SR); ph = 0.0
    for n in range(int(dur * SR)):
        t = n / SR
        f = 45 + 140 * math.exp(-t / 0.035)
        ph += 2 * math.pi * f / SR
        env = math.exp(-t / (0.32 if big else 0.13))
        click = math.exp(-t / 0.002) * 0.4
        v = (math.sin(ph) * env + click * (rnd.random() * 2 - 1)) * gain
        add(s + n, v)

def noise_burst(t0, dur, gain, hp=0.0, decay=0.05, pan=0.0):
    s = int(t0 * SR); lp = 0.0
    for n in range(int(dur * SR)):
        t = n / SR
        x = rnd.random() * 2 - 1
        lp += (x - lp) * (1 - hp)
        v = (x - lp) * math.exp(-t / decay) * gain
        add(s + n, v * (1 - pan), v * (1 + pan))

def hat(t0, g=0.16, open_=False):
    noise_burst(t0, 0.18 if open_ else 0.05, g, hp=0.97, decay=0.06 if open_ else 0.012, pan=0.2)

def clap(t0, g=0.5):
    for k, off in enumerate((0, 0.009, 0.018)):
        noise_burst(t0 + off, 0.2 if k == 2 else 0.01, g * (0.7 if k < 2 else 1), hp=0.6, decay=0.06 if k == 2 else 0.004)

def saw(ph):
    return 2 * (ph - math.floor(ph + 0.5))

def note(t0, f, dur, g, cutoff=0.08, attack=0.004, release=0.08, detune=0.006, sc=True, pan=0.0):
    s = int(t0 * SR); p1 = p2 = 0.0; lp1 = lp2 = 0.0
    total = int((dur + release) * SR)
    for n in range(total):
        t = n / SR
        env = min(1, t / attack) if t < dur else max(0, 1 - (t - dur) / release)
        p1 += f * (1 + detune) / SR; p2 += f * (1 - detune) / SR
        a = saw(p1); b = saw(p2)
        c = cutoff * (0.5 + 1.5 * math.exp(-t / 0.12))
        lp1 += (a - lp1) * min(1, c); lp2 += (b - lp2) * min(1, c)
        d = duck(t0 + t) if sc else 1
        add(s + n, lp1 * env * g * d * (1 - pan), lp2 * env * g * d * (1 + pan))

def sine_note(t0, f, dur, g, attack=0.005, decay=0.4, pan=0.0):
    s = int(t0 * SR); ph = 0.0
    for n in range(int(dur * SR)):
        t = n / SR
        ph += 2 * math.pi * f / SR
        env = min(1, t / attack) * math.exp(-t / decay)
        v = (math.sin(ph) + 0.25 * math.sin(2 * ph) + 0.1 * math.sin(3 * ph)) * env * g
        add(s + n, v * (1 - pan), v * (1 + pan))

def riser(t0, t1, g):
    s = int(t0 * SR); lp = 0.0; ph = 0.0
    n1 = int((t1 - t0) * SR)
    for n in range(n1):
        u = n / n1
        x = rnd.random() * 2 - 1
        lp += (x - lp) * (0.02 + 0.9 * u)
        ph += 2 * math.pi * (220 + 1400 * u * u) / SR
        v = (lp * 0.8 + 0.25 * math.sin(ph)) * (u ** 2.2) * g
        add(s + n, v, v)

def whoosh(tc, g=0.3, w=0.35):
    s = int((tc - w) * SR); lp = 0.0; n1 = int(w * 1.4 * SR)
    for n in range(n1):
        u = n / n1
        x = rnd.random() * 2 - 1
        lp += (x - lp) * (0.05 + 0.5 * math.sin(math.pi * u))
        env = math.sin(math.pi * u) ** 2
        pan = math.cos(math.pi * u) * 0.8
        add(s + n, lp * env * g * (1 - pan), lp * env * g * (1 + pan))

def crash(t0, g=0.5, dur=1.8):
    noise_burst(t0, dur, g, hp=0.85, decay=0.6)

def hz(midi):
    return 440 * 2 ** ((midi - 69) / 12)

# コード進行 (Dメジャー): D - Bm - G - A
CH = {
    'D':  (62, 66, 69), 'Bm': (59, 62, 66), 'G': (55, 59, 62), 'A': (57, 61, 64),
}
ROOT = {'D': 38, 'Bm': 35, 'G': 43, 'A': 45}
prog = ['D', 'D', 'Bm', 'G', 'A', 'D', 'Bm', 'G', 'D']

# ---- 小節0 : イントロ (パッド + インパクト + ライザー) ----
kick(0.0, 1.0, big=True)
crash(0.0, 0.25, 1.5)
for m in CH['D']:
    note(0.0, hz(m), BAR - 0.1, 0.05, cutoff=0.03, attack=0.4, release=0.2, sc=False)
for k in range(4):
    sine_note(k * B, hz([74, 78, 81, 86][k]), 0.5, 0.12, pan=(-0.5 + k / 3))
riser(BAR - 0.8, BAR, 0.18)
whoosh(BAR, 0.3)

# ---- 小節1〜5 : メインビート ----
for bar in range(1, 6):
    t0 = bar * BAR
    ch = prog[bar]
    for b in range(4):
        kick(t0 + b * B, 0.95)
        hat(t0 + b * B + B / 2, 0.14, open_=(b == 3))
        hat(t0 + b * B + B / 4, 0.06); hat(t0 + b * B + 3 * B / 4, 0.06)
        if b in (1, 3):
            clap(t0 + b * B, 0.42)
        # オフビートのベース
        note(t0 + b * B + B / 2, hz(ROOT[ch]), B / 2 - 0.04, 0.22, cutoff=0.05, detune=0.003)
    # コードスタブ (1拍目 / 2拍目裏 / 4拍目)
    for pos in (0, 1.5, 3):
        for m in CH[ch]:
            note(t0 + pos * B, hz(m + 12), 0.12, 0.05, cutoff=0.12, release=0.12, pan=0.3 if pos == 1.5 else -0.3)
            note(t0 + pos * B + B * 0.75, hz(m + 12), 0.1, 0.018, cutoff=0.1, release=0.1, pan=0.6)   # エコー
    # 小節終わりのスウッシュ (シーン転換と同期)
    whoosh(t0 + BAR, 0.22)

# 小節2 の最終拍 (写真ストロボ) : 16分のハット
for k in range(4):
    hat(2 * BAR + 3 * B + k * B / 4, 0.12)

# 小節3 : 伸びていく棒グラフ用の上昇アルペジオ (8分)
for k in range(8):
    sine_note(3 * BAR + k * B / 2, hz(62 + [0, 4, 7, 12, 14, 16, 19, 24][k]), 0.3, 0.07, decay=0.2, pan=-0.6 + k * 0.17)

# ---- 小節6 : ビルドアップ (スネアロール + ライザー) ----
t0 = 6 * BAR
for b in range(4):
    kick(t0 + b * B, 0.8)
    note(t0 + b * B + B / 2, hz(ROOT['G' if b < 2 else 'A']), B / 2 - 0.04, 0.2, cutoff=0.05)
roll = [0, 2, 4, 6, 8, 9, 10, 11, 12, 13, 14, 15]
for i, k in enumerate(roll):
    clap(t0 + k * B / 4, 0.18 + 0.03 * i)
for k in range(16, 32):
    clap(t0 + k * B / 8, 0.25 + 0.012 * (k - 16))
riser(t0, t0 + BAR, 0.3)

# ---- 小節7 : ドロップ (ロゴ) ----
t0 = 7 * BAR
kick(t0, 1.1, big=True)
crash(t0, 0.5, 1.9)
for m in CH['D']:
    note(t0, hz(m), BAR - 0.2, 0.06, cutoff=0.06, attack=0.01, release=0.15, sc=False)
    note(t0, hz(m + 12), BAR - 0.2, 0.035, cutoff=0.1, attack=0.01, release=0.15, sc=False, pan=0.4)
note(t0, hz(26), BAR - 0.2, 0.25, cutoff=0.02, sc=False)
arp = [74, 78, 81, 86, 90, 93, 98, 102]
for k in range(8):
    sine_note(t0 + 0.1 + k * B / 2, hz(arp[k]), 0.5, 0.06, decay=0.3, pan=(-0.7 + k * 0.2))
kick(t0 + 2 * B, 0.6); kick(t0 + 2.75 * B, 0.4)

# ---- ミックス: ソフトクリップ + 正規化 + 最後のフェード ----
peak = max(max(abs(x) for x in L), max(abs(x) for x in R))
g = 1.6 / peak
out = bytearray()
for i in range(N):
    fade = min(1.0, (N - i) / (0.12 * SR))
    l = math.tanh(L[i] * g) * 0.92 * fade
    r = math.tanh(R[i] * g) * 0.92 * fade
    out += struct.pack('<hh', int(l * 32767), int(r * 32767))
with wave.open(sys.argv[1], 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(bytes(out))
print('wrote', sys.argv[1])
