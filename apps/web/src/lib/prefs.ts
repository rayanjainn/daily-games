/**
 * Device feedback preferences. The server keeps them on the account so they follow the player;
 * this copy in localStorage lets them apply before the page has loaded anything.
 *
 * - Motion: `ed-motion` = reduced (the theme script sets `data-motion` from it before paint).
 * - Sound: `ed-sound` = 1. Off unless asked for.
 * - Vibration: `ed-haptics` = 0 turns it off. On by default where the device can do it.
 */
export interface Prefs {
  sound?: boolean;
  haptics?: boolean;
  reducedMotion?: boolean;
}

const get = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const set = (k: string, v: string | null) => {
  try {
    if (v === null) localStorage.removeItem(k);
    else localStorage.setItem(k, v);
  } catch {
    // Storage blocked: the setting lasts for this page only.
  }
};

export function applyPrefs(p: Prefs) {
  const root = document.documentElement;
  if (p.reducedMotion) root.dataset.motion = 'reduced';
  else delete root.dataset.motion;
  set('ed-motion', p.reducedMotion ? 'reduced' : null);
  set('ed-sound', p.sound ? '1' : null);
  set('ed-haptics', p.haptics === false ? '0' : null);
}

export const soundOn = () => get('ed-sound') === '1';
export const hapticsOn = () => get('ed-haptics') !== '0';

export type Feedback = 'done' | 'win' | 'tap';

const BUZZ: Record<Feedback, number | number[]> = { tap: 8, done: 18, win: [20, 40, 30] };
const NOTES: Record<Feedback, number[]> = {
  tap: [660],
  done: [523, 784],
  win: [523, 659, 784, 1047],
};

let audio: AudioContext | null = null;

/** A short vibration and/or chime for a moment worth marking. Never throws. */
export function feedback(kind: Feedback) {
  if (typeof window === 'undefined') return;
  try {
    if (hapticsOn() && typeof navigator.vibrate === 'function') navigator.vibrate(BUZZ[kind]);
    if (!soundOn()) return;
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    audio ??= new Ctx();
    const ctx = audio;
    void ctx.resume();
    NOTES[kind].forEach((hz, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const t = ctx.currentTime + i * 0.09;
      osc.type = 'sine';
      osc.frequency.value = hz;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.12, t + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.25);
    });
  } catch {
    // Audio can be blocked until a tap; nothing to do about it.
  }
}
