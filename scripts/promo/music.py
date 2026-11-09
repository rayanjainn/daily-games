"""Synthesises the launch video's soundtrack as stems on one 120 BPM grid.

Usage: python3 music.py <timeline.json> <out-dir>
Writes drums.wav, bass.wav, pad.wav, pluck.wav and sfx.wav (mono, 44.1 kHz); mix.sh filters,
places and masters them with ffmpeg. Key: C major, progression C - Am - F - G.
"""
import json
import sys
import wave

import numpy as np

SR = 44100
tl = json.load(open(sys.argv[1]))
OUT = sys.argv[2]
BEAT = 60 / tl["bpm"]
DUR = tl["duration"]
N = int(SR * DUR)
rng = np.random.default_rng(7)


def buf():
    return np.zeros(N)


def add(track, start, sig):
    i = int(start * SR)
    if i >= N:
        return
    sig = sig[: N - i]
    track[i : i + len(sig)] += sig


def env(n, attack, decay):
    t = np.arange(n) / SR
    a = np.minimum(1, t / max(attack, 1e-4))
    return a * np.exp(-t / decay)


def hz(midi):
    return 440 * 2 ** ((midi - 69) / 12)


def saw(f, n, detune=0.0):
    t = np.arange(n) / SR
    out = np.zeros(n)
    for d in (-detune, 0, detune):
        ph = (t * f * (1 + d)) % 1
        out += 2 * ph - 1
    return out / 3


def tri(f, n):
    t = np.arange(n) / SR
    return 2 * np.abs(2 * ((t * f) % 1) - 1) - 1


# Chords per bar (two seconds): C, Am, F, G — as MIDI notes.
CHORDS = [[60, 64, 67], [57, 60, 64], [53, 57, 60], [55, 59, 62]]
ROOTS = [36, 33, 29, 31]
bars = int(DUR / (4 * BEAT))

drums, bass, pad, pluck, sfx = buf(), buf(), buf(), buf(), buf()

# --- drums: the beat comes in with the reveal at 3s; half-time feel in the hook.
def kick():
    n = int(0.35 * SR)
    t = np.arange(n) / SR
    f = 45 + 95 * np.exp(-t / 0.03)
    ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * env(n, 0.001, 0.18)


def clap():
    n = int(0.22 * SR)
    noise = rng.standard_normal(n)
    e = sum(env(n, 0.001, 0.012) * (np.arange(n) >= int(d * SR)) for d in (0, 0.012, 0.024))
    return noise * (e + 0.6 * env(n, 0.001, 0.09)) * 0.5


def hat(open_=False):
    n = int((0.18 if open_ else 0.05) * SR)
    return rng.standard_normal(n) * env(n, 0.0005, 0.06 if open_ else 0.015) * 0.35


beats = int(DUR / BEAT)
for b in range(beats):
    t = b * BEAT
    if t < 3:
        if b % 4 == 0:
            add(drums, t, kick() * 0.8)
        continue
    if t >= DUR - 1.0:
        continue
    add(drums, t, kick())
    if b % 2 == 1:
        add(drums, t, clap())
    add(drums, t + BEAT / 2, hat())
    if b % 4 == 3:
        add(drums, t + BEAT / 2, hat(True))

# --- bass: root on the beat with an octave bounce on the off-beat.
for bar in range(bars):
    root = ROOTS[bar % 4]
    for k in range(4):
        t = (bar * 4 + k) * BEAT
        if t < 3 or t >= DUR - 1.0:
            continue
        n = int(BEAT * 0.9 * SR)
        add(bass, t, saw(hz(root), n, 0.003) * env(n, 0.005, 0.25) * 0.55)
        n2 = int(BEAT * 0.4 * SR)
        add(bass, t + BEAT / 2, saw(hz(root + 12), n2, 0.003) * env(n2, 0.005, 0.12) * 0.3)

# --- pad: the chord for each bar, soft attack.
for bar in range(bars):
    n = int(4 * BEAT * SR)
    t0 = bar * 4 * BEAT
    e = env(n, 0.35, 3.0) * np.minimum(1, (n - np.arange(n)) / (0.3 * SR))
    chord = sum(saw(hz(m), n, 0.006) for m in CHORDS[bar % 4]) / 3
    add(pad, t0, chord * e * (0.35 if t0 < 3 else 0.5))
# Last chord rings out over the outro.
n = int(3.5 * SR)
add(pad, DUR - 3.0, sum(saw(hz(m), n, 0.006) for m in [60, 64, 67, 72]) / 4 * env(n, 0.05, 1.6) * 0.6)

# --- pluck: rising arpeggio in the hook and the outro, on 16ths.
def pl(midi, length=0.25, level=0.4):
    n = int(length * SR)
    return (tri(hz(midi), n) * 0.7 + saw(hz(midi), n) * 0.3) * env(n, 0.002, 0.12) * level


ARP = [72, 76, 79, 84]
for i in range(12):
    add(pluck, i * BEAT / 4, pl(ARP[i % 4] - (0 if i < 8 else -2), level=0.25 + 0.02 * i))
for i in range(8):
    add(pluck, 17 + i * BEAT / 4, pl([72, 76, 79, 84, 88, 84, 79, 76][i], level=0.3))

# --- effects, in key and on the grid.
def whoosh(length=0.5):
    n = int(length * SR)
    t = np.arange(n) / SR
    rise = (t / length) ** 2
    return rng.standard_normal(n) * rise * np.minimum(1, (n - np.arange(n)) / (0.02 * SR)) * 0.25


for s in tl["scenes"][1:]:
    add(sfx, s["start"] - 0.5, whoosh())
for i, t in enumerate(tl["glowTaps"]):
    # Each tap a little higher, up the C major scale, ending on the octave.
    add(sfx, t, pl([72, 74, 76, 77, 79, 81, 84][i % 7], 0.3, 0.32))
for i, t in enumerate(tl["tileFlips"]):
    add(sfx, t, pl([79, 81, 83, 84, 88][i % 5], 0.25, 0.28))
# A soft shimmer when the logo lands.
n = int(1.5 * SR)
add(sfx, 3.0, sum(tri(hz(m), n) for m in (84, 88, 91)) / 3 * env(n, 0.01, 0.6) * 0.25)


def write(name, x):
    x = x / max(1e-9, np.max(np.abs(x))) * 0.9
    with wave.open(f"{OUT}/{name}.wav", "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((x * 32767).astype("<i2").tobytes())


for name, x in [("drums", drums), ("bass", bass), ("pad", pad), ("pluck", pluck), ("sfx", sfx)]:
    write(name, x)
print("stems written to", OUT)
