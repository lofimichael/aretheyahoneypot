import { COLORS, PEGS, WEDGES } from './wheel.ts';

const R = 226;

const polar = (r: number, deg: number): [string, string] => {
  const a = (deg * Math.PI) / 180;
  return [(r * Math.sin(a)).toFixed(2), (-r * Math.cos(a)).toFixed(2)];
};

function labelSize(label: string): number {
  if (label === 'SPY') return 40;
  if (label === 'PROBABLY FINE') return 11.5;
  return label.length > 10 ? 17 : 24;
}

/** The wheel as an SVG string. Used by the page and by the share-image generator. */
export function wheelSvg(): string {
  const wedges = WEDGES.map((w) => {
    const [x1, y1] = polar(R, w.start);
    const [x2, y2] = polar(R, w.end);
    return `<path d="M0 0 L${x1} ${y1} A${R} ${R} 0 ${w.width > 180 ? 1 : 0} 1 ${x2} ${y2} Z" fill="${w.fill}" stroke="${COLORS.ink}" stroke-width="4" stroke-linejoin="round"/>`;
  }).join('');
  const labels = WEDGES.map((w) => `<g transform="rotate(${w.center.toFixed(3)})"><text transform="rotate(-90)" x="${R - 22}" y="0" text-anchor="end" dominant-baseline="central" font-family="Lilita One, sans-serif" font-size="${labelSize(w.label)}" fill="${w.ink}" letter-spacing="${w.label === 'SPY' ? 1 : 0.4}">${w.label}</text></g>`).join('');
  const pegs = PEGS.map((p) => {
    const [x, y] = polar(R + 11, p);
    return `<circle cx="${x}" cy="${y}" r="5.5" fill="${COLORS.honey}" stroke="${COLORS.ink}" stroke-width="3"/>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-250 -250 500 500"><circle r="248" fill="${COLORS.ink}"/><circle r="${R + 11}" fill="none" stroke="${COLORS.cream}" stroke-opacity="0.12" stroke-width="14"/>${wedges}${labels}${pegs}<circle r="92" fill="${COLORS.ink}"/></svg>`;
}
