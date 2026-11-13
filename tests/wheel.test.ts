import { describe, expect, it } from 'vitest';
import {
  EDGE_MARGIN, PEGS, WEDGES, pegCount, planFlick, planSpin, pointerAngle, positionInWedge,
  rotationAtOrAfter, rotationAtOrBefore, wedgeAfterFine, wedgeAt,
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

  it('has exactly one tiny "fine" sliver and plenty of SPY', () => {
    const fine = WEDGES.filter((w) => w.kind === 'fine');
    expect(fine).toHaveLength(1);
    expect(fine[0].width).toBeLessThan(15);
    expect(WEDGES.filter((w) => w.label === 'SPY').length).toBeGreaterThanOrEqual(4);
    expect(WEDGES.filter((w) => w.kind === 'spy').every((w) => w.label === 'SPY')).toBe(true);
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

describe('planSpin always lands on SPY', () => {
  it('lands inside a SPY wedge interior for 20,000 random spins', () => {
    const rng = mulberry32(42);
    for (let i = 0; i < 20000; i++) {
      const current = (rng() - 0.5) * 1e6;
      const plan = planSpin(current, rng);
      expect(wedgeAt(plan.final).label).toBe('SPY');
      expect(wedgeAt(plan.final).index).toBe(plan.target.index);
      expect(interior(plan.final)).toBe(true);
      expect(plan.final - current).toBeGreaterThan(4 * 360);
    }
  });

  it('near misses pause on PROBABLY FINE and then creep forward into SPY', () => {
    const rng = mulberry32(7);
    for (let i = 0; i < 5000; i++) {
      const current = rng() * 1e5;
      const plan = planSpin(current, rng, { nearMissChance: 1 });
      expect(plan.nearMiss).not.toBeNull();
      expect(wedgeAt(plan.nearMiss!).kind).toBe('fine');
      expect(plan.final).toBeGreaterThan(plan.nearMiss!);
      // The creep crosses only the remaining part of the sliver plus the margin of the next wedge.
      expect(plan.final - plan.nearMiss!).toBeLessThan(WEDGES.find((w) => w.kind === 'fine')!.width + wedgeAfterFine().width);
      expect(wedgeAt(plan.final).label).toBe('SPY');
      expect(interior(plan.final)).toBe(true);
    }
  });

  it('direct landings never touch the sliver', () => {
    const rng = mulberry32(99);
    for (let i = 0; i < 5000; i++) {
      const plan = planSpin(rng() * 1e4, rng, { nearMissChance: 0 });
      expect(plan.nearMiss).toBeNull();
      expect(wedgeAt(plan.final).label).toBe('SPY');
    }
  });

  it('is robust to adversarial random values at the extremes', () => {
    for (const r of [0, 0.999999999, 0.5]) {
      const plan = planSpin(123.4, () => r);
      expect(wedgeAt(plan.final).label).toBe('SPY');
      expect(interior(plan.final)).toBe(true);
    }
  });
});

describe('planFlick always lands on SPY in the flick direction', () => {
  it('handles clockwise and counter-clockwise flicks of any speed', () => {
    const rng = mulberry32(2026);
    for (let i = 0; i < 20000; i++) {
      const current = (rng() - 0.5) * 1e5;
      const velocity = (rng() - 0.5) * 12;
      const plan = planFlick(current, velocity, rng);
      expect(wedgeAt(plan.final).label).toBe('SPY');
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
