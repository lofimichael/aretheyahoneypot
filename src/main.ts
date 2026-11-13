import '@fontsource/lilita-one/400.css';
import '@fontsource-variable/dm-sans';
import '@fontsource/courier-prime/400.css';
import '@fontsource/courier-prime/700.css';
import './styles.css';

import { wheelSvg } from './wheel-svg';
import { WEDGES, easeInOutCubic, easeOutQuart, pegCount, planFlick, planSpin, wedgeAt, type SpinPlan } from './wheel';
import { agentSvg, velvetSvg } from './sprites';
import { createRain, createTerminal } from './processing';
import * as sound from './audio';
import { burst } from './confetti';
import { renderDossier } from './dossier';
import {
  ANALYSIS_LINES, EVIDENCE, FLICK_LINES, NEAR_MISS_RESOLVE, PROBABLY_FINE_OPINIONS, RATE_LIMITED,
  SECOND_OPINIONS, UNDECODABLE, hesitate, pick, sample,
} from './copy';

type State = 'idle' | 'scanning' | 'spinning' | 'verdict';

const el = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const wheelWrap = el('wheelWrap');
const wheelEl = el('wheel');
const pointerEl = el('pointer');
const hubFace = el('hubFace');
const hubPhoto = el<HTMLImageElement>('hubPhoto');
const hubRedacted = el('hubRedacted');
const disguise = el('disguise');
const stamp = el('stamp');
const caption = el('caption');
const announce = el('announce');
const actions = el('actions');
const uploadBtn = el<HTMLButtonElement>('upload');
const fileInput = el<HTMLInputElement>('file');
const verdictEl = el('verdict');
const verdictTitle = el('verdictTitle');
const verdictLabel = el('verdictLabel');
const agentEl = el('agent');
const agent2El = el('agent2');
const againBtn = el<HTMLButtonElement>('again');
const secondBtn = el<HTMLButtonElement>('second');
const saveBtn = el<HTMLButtonElement>('save');
const muteBtn = el<HTMLButtonElement>('mute');
const counterEl = el('counter');
const countEl = el('count');
const countLabel = el('countLabel');
const dropEl = el('drop');
const wipeEl = el('wipe');
// Shake the stage (inside .app's horizontal clip) so the page never gains sideways scroll.
const stageEl = document.querySelector('.stage') as HTMLElement;
const confettiCanvas = el<HTMLCanvasElement>('confetti');
const rain = createRain(el<HTMLCanvasElement>('rain'));
const terminal = createTerminal(el('terminal'));

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const reduced = () => reducedMotion.matches;
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

let state: State = 'idle';
let busy = false;
let objectUrl: string | null = null;
let photo: HTMLImageElement | null = null;
let caseNumber = '';
let evidence: string[] = [];
let opinions = 0;

let spies: number | null = null;

function setState(next: State) {
  state = next;
  document.body.dataset.state = next;
}

/* ---------------- Kinetic flavor text ---------------- */

const escapeHtml = (t: string) => t.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const tokens = new WeakMap<HTMLElement, number>();

/** Swap a line of text with letters that tumble in (and the old ones flying out). */
function kinetic(target: HTMLElement, text: string) {
  const token = (tokens.get(target) ?? 0) + 1;
  tokens.set(target, token);
  const render = () => {
    if (tokens.get(target) !== token) return;
    if (!text) {
      target.replaceChildren();
      return;
    }
    let i = 0;
    const words = text.split(' ').map((word) => `<span class="w">${[...word].map((ch) => `<span class="k" style="--i:${i++}">${escapeHtml(ch)}</span>`).join('')}</span>`);
    target.innerHTML = `<span class="sr-only">${escapeHtml(text)}</span><span class="kw" aria-hidden="true">${words.join(' ')}</span>`;
  };
  const current = target.querySelector('.kw');
  if (current && !reduced()) {
    current.classList.add('out');
    setTimeout(render, 170);
  } else {
    render();
  }
}

function say(text: string) {
  kinetic(caption, text);
}

agentEl.innerHTML = agentSvg();
agent2El.innerHTML = velvetSvg();
const replay = (node: HTMLElement) => {
  node.style.animation = 'none';
  void node.offsetWidth;
  node.style.animation = '';
};

/* ---------------- Wheel drawing ---------------- */

wheelEl.innerHTML = wheelSvg();

/* ---------------- Motion loop ---------------- */

let rotation = -WEDGES[0].center;
let lastPeg = pegCount(rotation);
let flapAngle = 0;
let flapVel = 0;
let dragging = false;
let lastVibrate = 0;

interface Tween { from: number; to: number; start: number; duration: number; ease: (t: number) => number; resolve: () => void; silent: boolean; }
let tween: Tween | null = null;
/** While the WIA "processes", the wheel free-spins at this target speed (degrees per ms). */
let freeSpin: { target: number } | null = null;
let spinVelocity = 0;

function setRotation(next: number, speed: number, silent: boolean) {
  rotation = next;
  wheelEl.style.transform = `rotate(${rotation.toFixed(3)}deg)`;
  const count = pegCount(rotation);
  if (count !== lastPeg) {
    const dir = Math.sign(count - lastPeg);
    lastPeg = count;
    // A clockwise wheel drags the flapper tip to the right, which is a counter-clockwise rotation.
    flapAngle = -dir * Math.min(32, 12 + speed * 14);
    flapVel = 0;
    if (!silent) {
      sound.tick(speed);
      const now = performance.now();
      if (!sound.isMuted() && now - lastVibrate > 60 && 'vibrate' in navigator) {
        lastVibrate = now;
        try { navigator.vibrate(4); } catch { /* unsupported */ }
      }
    }
  }
}

function animateTo(to: number, duration: number, ease: (t: number) => number, silent = false): Promise<void> {
  return new Promise((resolve) => {
    tween?.resolve();
    tween = { from: rotation, to, start: performance.now(), duration, ease, resolve, silent };
  });
}

let lastFrame = performance.now();
function frame(now: number) {
  const dt = Math.min(64, now - lastFrame);
  lastFrame = now;
  const before = rotation;
  if (tween) {
    const t = Math.min(1, (now - tween.start) / tween.duration);
    const next = tween.from + (tween.to - tween.from) * tween.ease(t);
    setRotation(next, Math.abs(next - before) / Math.max(dt, 1), tween.silent);
    if (t >= 1) {
      const done = tween.resolve;
      tween = null;
      done();
    }
  } else if (freeSpin) {
    spinVelocity += (freeSpin.target - spinVelocity) * Math.min(1, dt / 450);
    setRotation(rotation + spinVelocity * dt, spinVelocity, false);
  } else if (state === 'idle' && !dragging && !reduced() && !document.hidden) {
    setRotation(rotation + 0.012 * dt, 0, true);
  }
  // Springy flapper.
  const k = dt / 16.67;
  flapVel += (-0.32 * flapAngle - 0.34 * flapVel) * k;
  flapAngle += flapVel * k;
  if (Math.abs(flapAngle) < 0.01 && Math.abs(flapVel) < 0.01) { flapAngle = 0; flapVel = 0; }
  pointerEl.style.rotate = `${flapAngle.toFixed(2)}deg`;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

/* ---------------- Flicking the idle wheel ---------------- */

let dragStart = { x: 0, y: 0, t: 0 };
let lastAngle = 0;
let samples: { t: number; r: number }[] = [];

function pointerAngleDeg(e: PointerEvent): number {
  const box = wheelWrap.getBoundingClientRect();
  return (Math.atan2(e.clientY - (box.top + box.height / 2), e.clientX - (box.left + box.width / 2)) * 180) / Math.PI;
}

wheelWrap.addEventListener('pointerdown', (e) => {
  if (state !== 'idle' || busy || e.button !== 0) return;
  sound.unlock();
  dragging = true;
  tween?.resolve();
  tween = null;
  wheelWrap.setPointerCapture(e.pointerId);
  wheelWrap.classList.add('grabbing');
  dragStart = { x: e.clientX, y: e.clientY, t: performance.now() };
  lastAngle = pointerAngleDeg(e);
  samples = [{ t: performance.now(), r: rotation }];
});

wheelWrap.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  const a = pointerAngleDeg(e);
  let delta = a - lastAngle;
  if (delta > 180) delta -= 360;
  if (delta < -180) delta += 360;
  lastAngle = a;
  const now = performance.now();
  setRotation(rotation + delta, Math.abs(delta) / 16, false);
  samples.push({ t: now, r: rotation });
  while (samples.length > 2 && now - samples[0].t > 90) samples.shift();
});

async function endDrag(e: PointerEvent) {
  if (!dragging) return;
  dragging = false;
  wheelWrap.classList.remove('grabbing');
  try { wheelWrap.releasePointerCapture(e.pointerId); } catch { /* already released */ }
  const moved = Math.hypot(e.clientX - dragStart.x, e.clientY - dragStart.y);
  const elapsed = performance.now() - dragStart.t;
  if (e.type === 'pointerup' && moved < 8 && elapsed < 350) {
    openPicker();
    return;
  }
  const first = samples[0];
  const last = samples[samples.length - 1];
  const velocity = last && first && last.t > first.t ? (last.r - first.r) / (last.t - first.t) : 0;
  if (Math.abs(velocity) < 0.12) return;
  busy = true;
  const plan = planFlick(rotation, velocity, Math.random);
  const distance = Math.abs(plan.final - rotation);
  const duration = Math.min(6500, Math.max(900, (4 * distance) / Math.abs(velocity)));
  say('…');
  await animateTo(plan.final, reduced() ? 1 : duration, easeOutQuart);
  sound.blip();
  say(pick(FLICK_LINES));
  busy = false;
}
wheelWrap.addEventListener('pointerup', endDrag);
wheelWrap.addEventListener('pointercancel', endDrag);

/* ---------------- Upload, drop, paste ---------------- */

function openPicker() {
  if (busy) return;
  sound.unlock();
  fileInput.click();
}

uploadBtn.addEventListener('click', openPicker);
fileInput.addEventListener('change', () => {
  const file = fileInput.files?.[0];
  fileInput.value = '';
  if (file) void investigate(file);
});

let dragDepth = 0;
const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes('Files');
window.addEventListener('dragenter', (e) => {
  if (!hasFiles(e)) return;
  e.preventDefault();
  dragDepth++;
  if (!busy) dropEl.hidden = false;
});
window.addEventListener('dragover', (e) => {
  if (!hasFiles(e)) return;
  e.preventDefault();
  if (e.dataTransfer) e.dataTransfer.dropEffect = busy ? 'none' : 'copy';
});
window.addEventListener('dragleave', (e) => {
  if (!hasFiles(e)) return;
  dragDepth = Math.max(0, dragDepth - 1);
  if (dragDepth === 0) dropEl.hidden = true;
});
window.addEventListener('drop', (e) => {
  if (!hasFiles(e)) return;
  e.preventDefault();
  dragDepth = 0;
  dropEl.hidden = true;
  const file = e.dataTransfer?.files?.[0];
  if (file && !busy) {
    sound.unlock();
    void investigate(file);
  }
});
window.addEventListener('paste', (e) => {
  const item = Array.from(e.clipboardData?.items ?? []).find((i) => i.kind === 'file');
  const file = item?.getAsFile();
  if (file && !busy) {
    e.preventDefault();
    sound.unlock();
    void investigate(file);
  }
});

/* ---------------- The investigation ---------------- */

interface VerdictResult { caseNumber: string; spies: number | null; limited: boolean; }

async function requestVerdict(): Promise<VerdictResult> {
  const local = `HP-${String(Math.floor(Math.random() * 900000) + 100000)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    // No body: the photo never leaves this page.
    const res = await fetch('/api/verdict', { method: 'POST', signal: controller.signal, credentials: 'same-origin' });
    if (res.status === 429) return { caseNumber: local, spies: null, limited: true };
    if (!res.ok) return { caseNumber: local, spies: null, limited: false };
    const data = (await res.json()) as { caseNumber?: string; spies?: number };
    return { caseNumber: data.caseNumber ?? local, spies: typeof data.spies === 'number' ? data.spies : null, limited: false };
  } catch {
    return { caseNumber: local, spies: null, limited: false };
  } finally {
    clearTimeout(timer);
  }
}

function clearSuspect() {
  if (objectUrl) URL.revokeObjectURL(objectUrl);
  objectUrl = null;
  photo = null;
  hubPhoto.hidden = true;
  hubPhoto.removeAttribute('src');
  hubRedacted.hidden = true;
  hubFace.hidden = false;
  disguise.classList.remove('on');
}

async function showSuspect(file: File): Promise<boolean> {
  clearSuspect();
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.decoding = 'async';
  img.src = url;
  try {
    await img.decode();
    if (!img.naturalWidth) throw new Error('empty image');
  } catch {
    URL.revokeObjectURL(url);
    hubFace.hidden = true;
    hubRedacted.hidden = false;
    return false;
  }
  objectUrl = url;
  photo = img;
  hubPhoto.src = url;
  hubPhoto.hidden = false;
  hubFace.hidden = true;
  return true;
}

function setWorking(working: boolean) {
  busy = working;
  uploadBtn.disabled = working;
  uploadBtn.innerHTML = working ? '<span aria-hidden="true">🔎</span> Investigating…' : '<span aria-hidden="true">📸</span> Upload a suspect';
}

/** Start the processing theatre: free spin, glyph rain, typing terminal. */
function startProcessing() {
  const motion = !reduced();
  terminal.start(!motion);
  if (!motion) return;
  rain.start();
  sound.whoosh();
  spinVelocity = 0;
  freeSpin = { target: 1.15 };
}

function stopProcessing(label: string) {
  rain.stop();
  terminal.finish(label);
}

/**
 * Bring the wheel to rest on a spy wedge, decelerating from whatever speed it is doing.
 * `nearMissOn` forces the pause-on-a-reassuring-wedge gag on that wedge; otherwise it lands directly.
 */
async function land(nearMissOn?: string): Promise<SpinPlan> {
  const motion = !reduced();
  const plan = planSpin(rotation, Math.random, { turns: motion ? 3 : 1, nearMissChance: 0, nearMissOn });
  wheelWrap.dataset.nearMiss = plan.nearMiss !== null ? wedgeAt(plan.nearMiss).label : '';
  const velocity = Math.max(freeSpin ? spinVelocity : 0, 0.6);
  freeSpin = null;
  const firstStop = plan.nearMiss ?? plan.final;
  // easeOutQuart starts at 4·distance/duration, so match the current speed for a seamless slowdown.
  const duration = Math.min(6500, Math.max(3200, (4 * (firstStop - rotation)) / velocity));
  await animateTo(firstStop, motion ? duration : 1, easeOutQuart, !motion);
  if (plan.nearMiss !== null) {
    say(hesitate(wedgeAt(plan.nearMiss).label));
    sound.creak();
    await wait(motion ? 950 : 700);
    await animateTo(plan.final, motion ? 1150 : 1, easeInOutCubic, !motion);
    say(pick(NEAR_MISS_RESOLVE));
    await wait(motion ? 450 : 0);
  }
  return plan;
}

async function investigate(file: File) {
  if (busy) return;
  setWorking(true);
  if (state === 'verdict') leaveVerdict();
  opinions = 0;
  setState('scanning');
  const verdict = requestVerdict();
  const decoded = await showSuspect(file);
  sound.blip();
  startProcessing();
  if (!decoded) {
    say(UNDECODABLE);
    await wait(reduced() ? 600 : 1500);
  }
  for (const line of sample(ANALYSIS_LINES, 4)) {
    say(line);
    sound.blip();
    await wait(reduced() ? 400 : 1100);
  }
  setState('spinning');
  // The first verdict always lands straight on a spy wedge: no "probably fine" stall.
  const plan = await land();
  stopProcessing(plan.target.label);
  const result = await verdict;
  caseNumber = result.caseNumber;
  if (result.spies !== null) updateCounter(result.spies, true);
  reveal(plan.target.label, result.limited ? RATE_LIMITED : '');
  setWorking(false);
}

function reveal(label: string, line: string) {
  const motion = !reduced();
  if (motion) {
    const box = wheelWrap.getBoundingClientRect();
    wipeEl.style.setProperty('--wx', `${box.left + box.width / 2}px`);
    wipeEl.style.setProperty('--wy', `${box.top + box.height / 2}px`);
    wipeEl.classList.add('go');
  }
  setState('verdict');
  if (motion) {
    stamp.animate(
      [
        { transform: 'scale(3.2)', opacity: 0 },
        { transform: 'scale(0.84)', opacity: 1, offset: 0.55 },
        { transform: 'scale(1.07)', offset: 0.8 },
        { transform: 'scale(1)' },
      ],
      { duration: 480, easing: 'cubic-bezier(.2,.8,.2,1)' },
    );
  }
  setTimeout(() => {
    sound.thud();
    if (motion) {
      stageEl.classList.remove('shake');
      void stageEl.offsetWidth;
      stageEl.classList.add('shake');
      const box = wheelWrap.getBoundingClientRect();
      burst(confettiCanvas, box.left + box.width / 2, box.top + box.height / 2);
      if (!sound.isMuted() && 'vibrate' in navigator) {
        try { navigator.vibrate([30, 40, 60]); } catch { /* unsupported */ }
      }
    }
    disguise.classList.add('on');
  }, motion ? 260 : 0);
  setTimeout(() => sound.sting(), motion ? 520 : 0);

  verdictLabel.textContent = label;
  evidence = sample(EVIDENCE, 3);
  terminal.hide();
  actions.hidden = true;
  verdictEl.hidden = false;
  replay(agentEl);
  replay(agent2El);
  say(line);
  announce.textContent = `Verdict: ${label}. Case ${caseNumber}.${line ? ` ${line}` : ''}`;
  verdictTitle.focus({ preventScroll: true });
  const rect = verdictEl.getBoundingClientRect();
  if (rect.bottom > window.innerHeight) {
    setTimeout(() => verdictEl.scrollIntoView({ behavior: motion ? 'smooth' : 'auto', block: 'end' }), motion ? 700 : 0);
  }
  setTimeout(() => {
    wipeEl.style.transition = 'none';
    wipeEl.classList.remove('go');
    void wipeEl.offsetWidth;
    wipeEl.style.transition = '';
  }, 900);
}

function leaveVerdict() {
  verdictEl.hidden = true;
  actions.hidden = false;
  announce.textContent = '';
}

againBtn.addEventListener('click', () => {
  if (busy) return;
  leaveVerdict();
  clearSuspect();
  terminal.hide();
  setState('idle');
  say('');
  uploadBtn.focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: reduced() ? 'auto' : 'smooth' });
  openPicker();
});

secondBtn.addEventListener('click', async () => {
  if (busy) return;
  setWorking(true);
  opinions += 1;
  // Every other second opinion stalls on PROBABLY FINE first.
  const probablyFine = opinions % 2 === 1;
  verdictEl.hidden = true;
  actions.hidden = false;
  setState('scanning');
  startProcessing();
  say('Escalating to the WIA…');
  await wait(reduced() ? 300 : 1300);
  say(pick(ANALYSIS_LINES));
  await wait(reduced() ? 300 : 1100);
  setState('spinning');
  const plan = await land(probablyFine ? 'PROBABLY FINE' : undefined);
  stopProcessing(plan.target.label);
  const round = Math.floor((opinions - 1) / 2);
  const line = probablyFine
    ? PROBABLY_FINE_OPINIONS[round % PROBABLY_FINE_OPINIONS.length]
    : SECOND_OPINIONS[round % SECOND_OPINIONS.length].replace('{n}', String(opinions + 1));
  reveal(plan.target.label, line);
  setWorking(false);
});

saveBtn.addEventListener('click', async () => {
  if (saveBtn.disabled) return;
  saveBtn.disabled = true;
  const label = saveBtn.textContent;
  saveBtn.textContent = 'Printing…';
  try {
    const blob = await renderDossier({ photo, caseNumber, evidence, label: verdictLabel.textContent || 'SPY' });
    const name = `dossier-${caseNumber}.png`;
    const file = new File([blob], name, { type: 'image/png' });
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    if (coarse && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: 'Are They a Honeypot?', text: 'The wheel has spoken: SPY. aretheyahoneypot.com' });
      } catch (err) {
        if ((err as Error).name !== 'AbortError') download(blob, name);
      }
    } else {
      download(blob, name);
    }
  } catch {
    say('The printer is also a spy. Try again.');
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = label;
  }
});

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/* ---------------- Counter ---------------- */

function updateCounter(value: number, animate: boolean) {
  const from = spies ?? value;
  spies = value;
  counterEl.hidden = false;
  countLabel.textContent = value === 1 ? 'spy exposed' : 'spies exposed';
  if (!animate || reduced() || from === value) {
    countEl.textContent = value.toLocaleString();
    return;
  }
  const start = performance.now();
  const step = (now: number) => {
    const t = Math.min(1, (now - start) / 700);
    countEl.textContent = Math.round(from + (value - from) * easeOutQuart(t)).toLocaleString();
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
  countEl.classList.remove('bump');
  void countEl.offsetWidth;
  countEl.classList.add('bump');
}

async function loadStats() {
  try {
    const res = await fetch('/api/stats', { credentials: 'same-origin' });
    if (!res.ok) return;
    const data = (await res.json()) as { spies?: number };
    if (typeof data.spies === 'number' && data.spies > 0) updateCounter(data.spies, false);
  } catch { /* counter stays hidden */ }
}
void loadStats();

/* ---------------- Sound toggle ---------------- */

function renderMute() {
  const muted = sound.isMuted();
  muteBtn.setAttribute('aria-pressed', String(muted));
  muteBtn.setAttribute('aria-label', muted ? 'Unmute sounds' : 'Mute sounds');
}
muteBtn.addEventListener('click', () => {
  sound.unlock();
  sound.setMuted(!sound.isMuted());
  renderMute();
  if (!sound.isMuted()) sound.blip();
});
renderMute();
