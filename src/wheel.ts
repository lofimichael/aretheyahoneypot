// Pure wheel geometry. Angles are degrees.
// "Local" angles are measured clockwise from 12 o'clock in the wheel's own frame.
// A wheel rotated clockwise by `rotation` shows local angle mod(-rotation, 360) under the top pointer.

export type SegmentKind = 'spy' | 'fine';

export interface Segment {
  label: string;
  kind: SegmentKind;
  weight: number;
  fill: string;
  ink: string;
}

export interface Wedge extends Segment {
  index: number;
  start: number;
  end: number;
  width: number;
  center: number;
}

export const COLORS = {
  ink: '#1B1B1F',
  cream: '#FFF4D6',
  honey: '#FFC21A',
  red: '#E63946',
  teal: '#2EC4B6',
  pink: '#FF8FC7',
} as const;

// Half the wheel looks reassuring. It never matters.
export const SEGMENTS: Segment[] = [
  { label: 'SPY', kind: 'spy', weight: 1, fill: COLORS.red, ink: COLORS.cream },
  { label: 'PROBABLY FINE', kind: 'fine', weight: 1, fill: COLORS.cream, ink: COLORS.ink },
  { label: 'HOT SPY', kind: 'spy', weight: 1, fill: COLORS.pink, ink: COLORS.ink },
  { label: 'NOT A SPY', kind: 'fine', weight: 1, fill: COLORS.teal, ink: COLORS.ink },
  { label: 'SPY', kind: 'spy', weight: 1, fill: COLORS.ink, ink: COLORS.honey },
  { label: 'TOTALLY NORMAL', kind: 'fine', weight: 1, fill: COLORS.honey, ink: COLORS.ink },
  { label: 'SPY', kind: 'spy', weight: 1, fill: COLORS.red, ink: COLORS.cream },
  { label: 'JUST A GUY', kind: 'fine', weight: 1, fill: COLORS.cream, ink: COLORS.ink },
  { label: 'HOT SPY', kind: 'spy', weight: 1, fill: COLORS.pink, ink: COLORS.ink },
  { label: 'INNOCENT', kind: 'fine', weight: 1, fill: COLORS.teal, ink: COLORS.ink },
  { label: 'SPY', kind: 'spy', weight: 1, fill: COLORS.ink, ink: COLORS.honey },
  { label: 'TRUST THEM', kind: 'fine', weight: 1, fill: COLORS.honey, ink: COLORS.ink },
];

export function layout(segments: Segment[]): Wedge[] {
  const total = segments.reduce((sum, s) => sum + s.weight, 0);
  let cursor = 0;
  return segments.map((s, index) => {
    const width = (s.weight / total) * 360;
    const wedge = { ...s, index, start: cursor, end: cursor + width, width, center: cursor + width / 2 };
    cursor += width;
    return wedge;
  });
}

export const WEDGES: Wedge[] = layout(SEGMENTS);

/** Fraction of a wedge's width kept clear of each edge when landing. */
export const EDGE_MARGIN = 0.18;

export const mod = (a: number, n: number): number => ((a % n) + n) % n;

export function pointerAngle(rotation: number): number {
  return mod(-rotation, 360);
}

export function wedgeAt(rotation: number, wedges: Wedge[] = WEDGES): Wedge {
  const a = pointerAngle(rotation);
  return wedges.find((w) => a >= w.start && a < w.end) ?? wedges[wedges.length - 1];
}

/** Position of the pointer inside its wedge, 0 = start edge, 1 = end edge. */
export function positionInWedge(rotation: number, wedges: Wedge[] = WEDGES): number {
  const w = wedgeAt(rotation, wedges);
  return (pointerAngle(rotation) - w.start) / w.width;
}

/** Smallest rotation >= min that puts `local` under the pointer. */
export function rotationAtOrAfter(local: number, min: number): number {
  const base = -local;
  return base + Math.ceil((min - base) / 360) * 360;
}

/** Largest rotation <= max that puts `local` under the pointer. */
export function rotationAtOrBefore(local: number, max: number): number {
  const base = -local;
  return base + Math.floor((max - base) / 360) * 360;
}

export type Rng = () => number;

export interface SpinPlan {
  /** Rotation where the wheel pauses on a reassuring wedge before creeping on, or null for a direct landing. */
  nearMiss: number | null;
  final: number;
  target: Wedge;
}

const spyWedges = (wedges: Wedge[]) => wedges.filter((w) => w.kind === 'spy');
const interiorPoint = (w: Wedge, rng: Rng) => w.start + w.width * (EDGE_MARGIN + (1 - 2 * EDGE_MARGIN) * rng());

/** The wedge the pointer enters right after leaving `wedge` while spinning clockwise. */
export function wedgeAfter(wedge: Wedge, wedges: Wedge[] = WEDGES): Wedge {
  return wedges[mod(wedge.index - 1, wedges.length)];
}

/** "Fine" wedges whose clockwise exit leads straight into a spy wedge: the near-miss candidates. */
export const NEAR_MISS_WEDGES: Wedge[] = WEDGES.filter((w) => w.kind === 'fine' && wedgeAfter(w).kind === 'spy');

/** Plan an automatic clockwise spin that always ends inside a spy wedge. */
export function planSpin(
  current: number,
  rng: Rng,
  opts: { turns?: number; nearMissChance?: number; nearMissOn?: string } = {},
): SpinPlan {
  const turns = opts.turns ?? 5 + rng() * 1.5;
  const minRotation = current + turns * 360;
  const nearMissChance = opts.nearMissChance ?? 0.75;
  const forced = opts.nearMissOn ? NEAR_MISS_WEDGES.find((w) => w.label === opts.nearMissOn) : undefined;

  if (forced || (NEAR_MISS_WEDGES.length && rng() < nearMissChance)) {
    const fine = forced ?? NEAR_MISS_WEDGES[Math.min(NEAR_MISS_WEDGES.length - 1, Math.floor(rng() * NEAR_MISS_WEDGES.length))];
    const after = wedgeAfter(fine);
    // Clockwise motion lowers the local angle, so the wheel leaves `fine` through its start edge
    // and enters `after` through its end edge. Pause comfortably inside "fine", then creep over.
    const pauseLocal = fine.start + fine.width * (EDGE_MARGIN + 0.2 * rng());
    const finalLocal = after.end - after.width * (EDGE_MARGIN + 0.22 * rng());
    const nearMiss = rotationAtOrAfter(pauseLocal, minRotation);
    return { nearMiss, final: nearMiss + (pauseLocal - finalLocal), target: after };
  }

  const options = spyWedges(WEDGES);
  const target = options[Math.min(options.length - 1, Math.floor(rng() * options.length))];
  return { nearMiss: null, final: rotationAtOrAfter(interiorPoint(target, rng), minRotation), target };
}

/**
 * Plan where a hand-flicked wheel stops. `velocity` is degrees per millisecond (signed, clockwise positive).
 * The stop lands near the natural coasting distance but always inside a SPY wedge.
 */
export function planFlick(current: number, velocity: number, rng: Rng): { final: number; target: Wedge } {
  const direction = velocity < 0 ? -1 : 1;
  const natural = Math.min(Math.max(Math.abs(velocity) * 700, 240), 3240);
  const aim = current + direction * natural;
  let best: { final: number; target: Wedge } | null = null;
  for (const w of spyWedges(WEDGES)) {
    const local = interiorPoint(w, rng);
    const final = direction > 0 ? rotationAtOrAfter(local, aim) : rotationAtOrBefore(local, aim);
    if (!best || Math.abs(final - aim) < Math.abs(best.final - aim)) best = { final, target: w };
  }
  return best!;
}

/** Peg positions (local angles): every wedge edge plus the middle of each wedge. */
export const PEGS: number[] = WEDGES.flatMap((w) => [w.start, w.center]);

/** Monotonic count of peg crossings for a rotation; a change between frames means a tick. */
export function pegCount(rotation: number, pegs: number[] = PEGS): number {
  let n = 0;
  for (const p of pegs) n += Math.floor((rotation + p) / 360);
  return n;
}

export const easeOutQuart = (t: number) => 1 - Math.pow(1 - t, 4);
export const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeInOutSine = (t: number) => -(Math.cos(Math.PI * t) - 1) / 2;
export const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
