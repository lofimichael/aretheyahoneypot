// Voice: the Wheel Intelligence Agency (WIA) is the authority, never the wheel itself.

export const ANALYSIS_LINES = [
  'Scanning for trench coats…',
  'Measuring cheekbones for state secrets…',
  'Cross-referencing LinkedIn endorsements…',
  'Checking if they laugh at your jokes too hard…',
  'Where were they on the night of the 14th?',
  'Enhancing… enhancing… enhancing…',
  'Forwarding pixels to WIA headquarters…',
  'Counting suspiciously good angles…',
  'Checking for a second, secret phone…',
  'WIA analysts are on it…',
];

/** Normal second opinions. `{n}` is the opinion number. */
export const SECOND_OPINIONS = [
  'Opinion #{n}: spy. The WIA double-checked.',
  'WIA field office confirms: spy.',
  'Opinion #{n}: still spy.',
  'Fresh eyes at the WIA: spy.',
];

/** Second opinions that stall on PROBABLY FINE first (every other try). */
export const PROBABLY_FINE_OPINIONS = [
  'Probably fine was right there. Spy.',
  'So close to probably fine. Spy.',
  'Probably fine, said nobody at the WIA.',
];

export const EVIDENCE = [
  'Has never once publicly denied being a spy.',
  'Looked directly at the camera. Classic.',
  'Photographed. Innocent things rarely are.',
  'Seems nice. That is how they get you.',
  'Pixel arrangement consistent with espionage.',
  'Suspiciously well lit.',
  'Owns at least one shadow.',
  'Too normal. Way too normal.',
  'Refused to comment.',
  'Within thirty feet of a Wi-Fi router.',
  'Expression: unreadable.',
  'Showed up in your camera roll uninvited.',
  'Knows things. Possibly everything.',
  'Would absolutely laugh at your startup idea.',
  'Convenient alibi: being a photo.',
  'Fits in a little too well.',
];

export const NEAR_MISS_RESOLVE = ['…nope.', '…the WIA disagrees.', '…WIA says no.'];

export const FLICK_LINES = [
  'No photo? The WIA has opened a file on you.',
  'Spun with no suspect. The WIA noticed.',
  'Bold. The WIA is taking notes.',
];

export const UNDECODABLE = 'So suspicious it won’t even open.';
export const RATE_LIMITED = 'WIA servers are swamped with spies. Verdict stands.';

/** "PROBABLY FINE" -> "Probably fine…?" */
export function hesitate(label: string): string {
  const lower = label.toLowerCase();
  return `${lower.charAt(0).toUpperCase()}${lower.slice(1)}…?`;
}

export function pick<T>(list: readonly T[], rng: () => number = Math.random): T {
  return list[Math.floor(rng() * list.length) % list.length];
}

export function sample<T>(list: readonly T[], n: number, rng: () => number = Math.random): T[] {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
}
