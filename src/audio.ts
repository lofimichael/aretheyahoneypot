// Every sound is synthesized with WebAudio, so there are no audio files to load.
const KEY = 'ath:muted';
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = readMuted();
let lastTick = 0;

function readMuted(): boolean {
  try { return localStorage.getItem(KEY) === '1'; } catch { return false; }
}

export function isMuted(): boolean { return muted; }

export function setMuted(value: boolean): void {
  muted = value;
  try { localStorage.setItem(KEY, value ? '1' : '0'); } catch { /* storage unavailable */ }
  if (master && ctx) master.gain.setTargetAtTime(value ? 0 : 0.5, ctx.currentTime, 0.02);
}

/** Must run inside a user gesture (click, drop, paste, pointerdown). */
export function unlock(): void {
  try {
    if (!ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') void ctx.resume();
  } catch { ctx = null; }
}

function ready(): AudioContext | null {
  return ctx && master && !muted && ctx.state === 'running' ? ctx : null;
}

function tone(type: OscillatorType, freq: number, start: number, duration: number, gain: number, endFreq?: number) {
  const c = ready();
  if (!c || !master) return;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, start + duration);
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(gain, start + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(g).connect(master);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

function noise(start: number, duration: number, gain: number, filterFrom: number, filterTo: number) {
  const c = ready();
  if (!c || !master) return;
  const length = Math.max(1, Math.floor(c.sampleRate * duration));
  const buffer = c.createBuffer(1, length, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buffer;
  const filter = c.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(filterFrom, start);
  filter.frequency.exponentialRampToValueAtTime(filterTo, start + duration);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(gain, start + duration * 0.3);
  g.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  src.connect(filter).connect(g).connect(master);
  src.start(start);
  src.stop(start + duration + 0.02);
}

export function tick(speed: number): void {
  const c = ready();
  if (!c) return;
  const now = c.currentTime;
  if (now - lastTick < 0.018) return; // keep very fast spins from turning into a buzz
  lastTick = now;
  tone('triangle', 1700 + Math.random() * 300 - Math.min(speed, 2) * 200, now, 0.03, 0.35);
}

export function whoosh(): void {
  const c = ready();
  if (c) noise(c.currentTime, 0.5, 0.5, 300, 2400);
}

export function blip(): void {
  const c = ready();
  if (c) tone('sine', 620, c.currentTime, 0.08, 0.18, 880);
}

export function thud(): void {
  const c = ready();
  if (!c) return;
  const t = c.currentTime;
  tone('sine', 140, t, 0.28, 0.9, 50);
  noise(t, 0.12, 0.6, 1800, 200);
}

/** Dun, dun, DUN. */
export function sting(): void {
  const c = ready();
  if (!c) return;
  const t = c.currentTime;
  tone('sawtooth', 196, t, 0.22, 0.16);
  tone('sawtooth', 185, t + 0.26, 0.22, 0.16);
  tone('sawtooth', 147, t + 0.52, 0.9, 0.2);
  tone('square', 73.5, t + 0.52, 0.9, 0.08);
}

export function creak(): void {
  const c = ready();
  if (c) tone('sawtooth', 90, c.currentTime, 0.6, 0.05, 70);
}
