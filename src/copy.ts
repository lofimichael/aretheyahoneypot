export const ANALYSIS_LINES = [
  'Scanning for trench coats…',
  'Measuring cheekbones for state secrets…',
  'Cross-referencing LinkedIn endorsements…',
  'Checking if they laugh at your jokes a little too hard…',
  'Asking where they were on the night of the 14th…',
  'Enhancing… enhancing… enhancing…',
  'Running the pixels past our guy…',
  'Counting suspiciously good angles…',
  'Checking for a second, secret phone…',
  'Consulting the wheel…',
];

export const VERDICT_LINES = [
  'Confidence: 100%. Margin of error: also spy.',
  'Our analysts are unanimous. Our analysts are one wheel.',
  'The wheel has spoken. The wheel is never wrong.',
  'Do not let them know you know.',
  'We ran it twice. Same answer.',
  'Act natural. Delete nothing.',
];

export const SECOND_OPINIONS = [
  'Second opinion: spy.',
  'Third opinion: spy. We are getting annoyed.',
  'We asked a bigger wheel. It said spy.',
  'The wheel would like you to stop asking.',
  'Opinion number {n}: still a spy. Go outside.',
];

export const EVIDENCE = [
  'Has never once publicly denied being a spy.',
  'Looked directly at the camera. Classic.',
  'Photographed. Innocent things are rarely photographed.',
  'Seems nice. That is how they get you.',
  'Pixel arrangement consistent with espionage.',
  'Suspiciously well lit.',
  'Owns at least one shadow.',
  'Too normal. Way too normal.',
  'Refused to comment.',
  'Exactly what a spy would look like, if a spy looked like this.',
  'Was within thirty feet of a Wi-Fi router.',
  'Expression: unreadable. Like a spy.',
  'Showed up in your camera roll uninvited.',
  'Knows things. Possibly everything.',
  'Maintains steady eye contact with the void.',
  'Would absolutely laugh at your startup idea.',
  'Has a very convenient alibi: being a photo.',
  'Fits in a little too well.',
];

export const NEAR_MISS = ['Wait…', 'Hmm…', 'Hold on…'];
export const NEAR_MISS_RESOLVE = '…nope. SPY.';

export const FLICK_LINES = [
  'No suspect uploaded. The wheel suspects you.',
  'You spun it with no photo. Bold. Also, spy.',
  'The wheel has questions about you.',
];

export const UNDECODABLE = 'So suspicious it won’t even open.';
export const IDLE_CAPTION = 'Psst. You can flick the wheel.';
export const RATE_LIMITED = 'Our servers are swamped with spies. Verdict stands anyway.';

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
