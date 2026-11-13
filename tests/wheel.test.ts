import { describe, expect, it } from 'vitest';
import {
  EDGE_MARGIN, NEAR_MISS_WEDGES, PEGS, WEDGES, pegCount, planFlick, planSpin, pointerAngle, positionInWedge,
  rotationAtOrAfter, rotationAtOrBefore, wedgeAfter, wedgeAt,
} from '../src/wheel';

// Small deterministic PRNG so failures are reproducible.
function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const interior = (rotation: number) => {
  const p = positionInWedge(rotation);
  return p >= EDGE_MARGIN - 1e-9 && p <= 1 - EDGE_MARGIN + 1e-9;
};

describe('wheel layout', () => {
  it('covers exactly 360 degrees with no gaps', () => {
    expect(WEDGES[0].start).toBe(0);
    expect(WEDGES.at(-1)!.end).toBeCloseTo(360, 9);
    for (let i = 1; i < WEDGES.length; i++) expect(WEDGES[i].start).toBeCloseTo(WEDGES[i - 1].end, 9);
  });

  it('looks fair: reassuring and spy wedges split the wheel evenly and alternate', () => {
    const area = (kind: string) => WEDGES.filter((w) => w.kind === kind).reduce((sum, w) => sum + w.width, 0);
    expect(area('fine')).toBeCloseTo(180, 9);
    expect(area('spy')).toBeCloseTo(180, 9);
    for (const w of WEDGES) expect(wedgeAfter(w).kind).not.toBe(w.kind);
    expect(WEDGES.some((w) => w.label === 'PROBABLY FINE' && w.kind === 'fine')).toBe(true);
    expect(WEDGES.filter((w) => w.label === 'HOT SPY' && w.kind === 'spy').length).toBeGreaterThanOrEqual(2);
    expect(NEAR_MISS_WEDGES.length).toBe(WEDGES.filter((w) => w.kind === 'fine').length);
  });

  it('maps rotation to the wedge under the pointer', () => {
    expect(pointerAngle(0)).toBe(0);
    expect(wedgeAt(0).index).toBe(0);
    // Rotating clockwise by a small amount shows the last wedge under the pointer.
    expect(wedgeAt(1).index).toBe(WEDGES.length - 1);
    expect(wedgeAt(-1).index).toBe(0);
  });

  it('solves rotations in both directions', () => {
    for (const local of [0, 12.5, 180, 359.9]) {
      const after = rotationAtOrAfter(local, 1000);
      expect(after).toBeGreaterThanOrEqual(1000);
      expect(after - 1000).toBeLessThan(360);
      expect(pointerAngle(after)).toBeCloseTo(local, 6);
      const before = rotationAtOrBefore(local, -1000);
      expect(before).toBeLessThanOrEqual(-1000);
      expect(-1000 - before).toBeLessThan(360);
      expect(pointerAngle(before)).toBeCloseTo(local, 6);
    }
  });
});

describe('planSpin always lands on a spy wedge', () => {
  it('lands inside a spy wedge interior for 20,000 random spins', () => {
    const rng = mulberry32(42);
    for (let i = 0; i < 20000; i++) {
      const current = (rng() - 0.5) * 1e6;
      const plan = planSpin(current, rng);
      expect(wedgeAt(plan.final).kind).toBe('spy');
      expect(wedgeAt(plan.final).index).toBe(plan.target.index);
      expect(interior(plan.final)).toBe(true);
      expect(plan.final - current).toBeGreaterThan(4 * 360);
    }
  });

  it('near misses pause on a reassuring wedge and then creep forward into the next spy wedge', () => {
    const rng = mulberry32(7);
    for (let i = 0; i < 5000; i++) {
      const current = rng() * 1e5;
      const plan = planSpin(current, rng, { nearMissChance: 1 });
      expect(plan.nearMiss).not.toBeNull();
      const paused = wedgeAt(plan.nearMiss!);
      expect(paused.kind).toBe('fine');
      expect(interior(plan.nearMiss!)).toBe(true);
      expect(plan.final).toBeGreaterThan(plan.nearMiss!);
      expect(wedgeAt(plan.final).index).toBe(wedgeAfter(paused).index);
      expect(plan.final - plan.nearMiss!).toBeLessThan(paused.width + wedgeAfter(paused).width);
      expect(interior(plan.final)).toBe(true);
    }
  });

  it('can force the PROBABLY FINE joke', () => {
    const rng = mulberry32(11);
    for (let i = 0; i < 2000; i++) {
      const plan = planSpin(rng() * 1e5, rng, { nearMissChance: 0, nearMissOn: 'PROBABLY FINE' });
      expect(wedgeAt(plan.nearMiss!).label).toBe('PROBABLY FINE');
      expect(wedgeAt(plan.final).kind).toBe('spy');
    }
  });

  it('direct landings go straight to a spy wedge', () => {
    const rng = mulberry32(99);
    for (let i = 0; i < 5000; i++) {
      const plan = planSpin(rng() * 1e4, rng, { nearMissChance: 0 });
      expect(plan.nearMiss).toBeNull();
      expect(wedgeAt(plan.final).kind).toBe('spy');
      expect(interior(plan.final)).toBe(true);
    }
  });

  it('is robust to adversarial random values at the extremes', () => {
    for (const r of [0, 0.999999999, 0.5]) {
      const plan = planSpin(123.4, () => r);
      expect(wedgeAt(plan.final).kind).toBe('spy');
      expect(interior(plan.final)).toBe(true);
    }
  });
});

describe('planFlick always lands on a spy wedge in the flick direction', () => {
  it('handles clockwise and counter-clockwise flicks of any speed', () => {
    const rng = mulberry32(2026);
    for (let i = 0; i < 20000; i++) {
      const current = (rng() - 0.5) * 1e5;
      const velocity = (rng() - 0.5) * 12;
      const plan = planFlick(current, velocity, rng);
      expect(wedgeAt(plan.final).kind).toBe('spy');
      expect(interior(plan.final)).toBe(true);
      if (velocity < 0) expect(plan.final).toBeLessThan(current);
      else expect(plan.final).toBeGreaterThan(current);
    }
  });
});

describe('pegs', () => {
  it('counts one tick per peg per revolution', () => {
    expect(pegCount(360) - pegCount(0)).toBe(PEGS.length);
    expect(pegCount(720.5) - pegCount(0.5)).toBe(PEGS.length * 2);
    expect(pegCount(0.001) - pegCount(0)).toBeLessThanOrEqual(1);
  });
});
