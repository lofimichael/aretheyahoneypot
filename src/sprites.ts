// Original pixel-art characters drawn for this site, rendered as crisp SVG rectangles.

const PALETTE: Record<string, string> = {
  K: '#1b1b1f', // ink
  S: '#e7b089', // skin
  s: '#c98e66', // skin shade
  W: '#fff4d6', // shirt
  R: '#e63946', // tie / hat band
  B: '#34343f', // suit
  b: '#4b4b5a', // suit highlight
  H: '#ffc21a', // honey
  D: '#d99a00', // honey shade
  G: '#ffffff', // glint
};

/** Pixels whose letter appears here get a class so CSS can animate them. */
const CLASSES: Record<string, string> = { G: 'px-glint' };

// "Agent Honey": slick hair, shades, sharp suit, a pot of honey.
const AGENT = [
  '................',
  '......KKKKK.....',
  '....KKKKKKKKK...',
  '...KKKKKKKKKKK..',
  '...KKKKKKKKKKKK.',
  '...KSSSSSSSSKK..',
  '...KSSSSSSSSSK..',
  '...KKKKKKKKKKK..',
  '...SKGKKSKGKKS..',
  '...SKKKKSKKKKS..',
  '...SSSSSSSSSSs..',
  '....SSSSSKKSs...',
  '.....sSSSSSs....',
  '......KssK......',
  '...KKKWRRWKKK...',
  '..KbBBWRRWBBbK..',
  '.KbBBBWRRWBBBbK.',
  '.KBBBBBRRBBBBBK.',
  '.KBBKBBRRBBKBBK.',
  '.KSSKKKKKKKKSSK.',
  '.KSSKHHHHHHKSSK.',
  '.KBBKHDHHDHKBBK.',
  '..KBKHHHHHHKBK..',
  '..KBBKKKKKKBBK..',
  '..KBBBBKKBBBBK..',
  '..KBBBBKKBBBBK..',
  '..KKKKK..KKKKK..',
];

// "Agent Velvet": sleek black bob, cat-eye shades, red lips, black jumpsuit, honey belt.
const VELVET = [
  '................',
  '.....KKKKKK.....',
  '...KKKKKKKKKK...',
  '..KKKKKKKKKKKK..',
  '..KKKKKKKKKKKK..',
  '..KKKSSSSSSKKK..',
  '..KKSSSSSSSSKK..',
  '.KKKKKKKKKKKKKK.',
  '..KKKGKSSKGKKK..',
  '..KKSSSSSSSSKK..',
  '..KKSSSRRSSSKK..',
  '..KKKSSSSSSKKK..',
  '..KKK.sSSs.KKK..',
  '..KKK.sSSs.KKK..',
  '..KKKBBSSBBKKK..',
  '...KBBBSSBBBK...',
  '..KBBBBBBBBBBK..',
  '..KBBKBBBBKBBK..',
  '..KBBKBBBBKBBK..',
  '..KSSKHHHHKSSK..',
  '..KKKKBBBBKKKK..',
  '....KBBBBBBK....',
  '...KBBBBBBBBK...',
  '...KBBBBBBBBK...',
  '....KSK..KSK....',
  '....KSK..KSK....',
  '....KRK..KRK....',
];

function spriteSvg(rows: string[], title: string): string {
  const width = Math.max(...rows.map((r) => r.length));
  const rects: string[] = [];
  const overlays: string[] = [];
  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const ch = row[x];
      let run = 1;
      while (x + run < row.length && row[x + run] === ch) run++;
      if (ch !== '.' && PALETTE[ch]) {
        // Animated pixels sit on top of solid ink, so a blink never shows the page behind them.
        const base = CLASSES[ch] ? PALETTE.K : PALETTE[ch];
        rects.push(`<rect x="${x}" y="${y}" width="${run}" height="1" fill="${base}"/>`);
        if (CLASSES[ch]) overlays.push(`<rect x="${x}" y="${y}" width="${run}" height="1" fill="${PALETTE[ch]}" class="${CLASSES[ch]}"/>`);
      }
      x += run;
    }
  });
  rects.push(...overlays);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${rows.length}" shape-rendering="crispEdges" role="img" aria-label="${title}">${rects.join('')}</svg>`;
}

export const agentSvg = () => spriteSvg(AGENT, 'Pixel-art agent in shades holding a honey pot');
export const velvetSvg = () => spriteSvg(VELVET, 'Pixel-art spy in cat-eye shades');
