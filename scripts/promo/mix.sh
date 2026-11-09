#!/usr/bin/env bash
# Filters, balances and masters the stems from music.py into one stereo track.
# Usage: mix.sh <stem-dir> <out.wav>
set -euo pipefail
d="$1"
ffmpeg -y -loglevel error \
  -i "$d/drums.wav" -i "$d/bass.wav" -i "$d/pad.wav" -i "$d/pluck.wav" -i "$d/sfx.wav" \
  -filter_complex "
    [0]highpass=f=30,volume=0.9,pan=stereo|c0=c0|c1=c0[dr];
    [1]lowpass=f=900,lowpass=f=900,volume=0.75,pan=stereo|c0=c0|c1=c0[ba];
    [2]lowpass=f=2200,highpass=f=180,aecho=0.8:0.7:60|120:0.25|0.18,volume=0.45,pan=stereo|c0=0.9*c0|c1=c0[pa];
    [3]lowpass=f=5000,aecho=0.8:0.6:250|375:0.22|0.12,volume=0.5,pan=stereo|c0=c0|c1=0.85*c0[pl];
    [4]highpass=f=200,lowpass=f=7000,aecho=0.8:0.5:120:0.2,volume=0.38,pan=stereo|c0=0.85*c0|c1=c0[fx];
    [dr][ba][pa][pl][fx]amix=inputs=5:normalize=0,
      acompressor=threshold=0.25:ratio=3:attack=10:release=150,
      afade=t=in:d=0.05,afade=t=out:st=19:d=1,
      alimiter=limit=0.89,aresample=48000[out]" \
  -map "[out]" "$2"
