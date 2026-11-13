// Renders the shareable "dossier" image entirely on the device.
const W = 1080;
const H = 1350;
const INK = '#1b1b1f';
const CREAM = '#fff4d6';
const HONEY = '#ffc21a';
const RED = '#e63946';
const MANILA = '#efd39a';

export interface DossierInput {
  photo: HTMLImageElement | null;
  caseNumber: string;
  evidence: string[];
}

async function fontsReady(): Promise<void> {
  try {
    await Promise.all([
      document.fonts.load('80px "Lilita One"'),
      document.fonts.load('700 30px "Courier Prime"'),
      document.fonts.load('30px "Courier Prime"'),
    ]);
  } catch { /* fall back to system fonts */ }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = word; } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

function drawPhoto(ctx: CanvasRenderingContext2D, img: HTMLImageElement | null, x: number, y: number, size: number) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, size, size);
  ctx.clip();
  if (img && img.naturalWidth > 0) {
    const scale = Math.max(size / img.naturalWidth, size / img.naturalHeight);
    const w = img.naturalWidth * scale;
    const h = img.naturalHeight * scale;
    ctx.drawImage(img, x + (size - w) / 2, y + (size - h) / 2, w, h);
  } else {
    ctx.fillStyle = CREAM;
    ctx.fillRect(x, y, size, size);
    ctx.fillStyle = INK;
    [0.62, 0.48, 0.56].forEach((wf, i) => ctx.fillRect(x + (size * (1 - wf)) / 2, y + size * (0.34 + i * 0.12), size * wf, size * 0.07));
    ctx.fillStyle = RED;
    ctx.font = '700 34px "Courier Prime", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('FILE REDACTED', x + size / 2, y + size * 0.82);
  }
  ctx.restore();
}

// Same sunglasses and mustache as the page, in the 200x200 coordinate space of the hub SVG.
const STACHE = new Path2D('M100 128 C88 118 66 116 52 128 C62 128 70 140 84 140 C92 140 98 134 100 132 C102 134 108 140 116 140 C130 140 138 128 148 128 C134 116 112 118 100 128 Z');
function drawDisguise(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 200, size / 200);
  ctx.strokeStyle = INK;
  ctx.lineCap = 'round';
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(28, 78);
  ctx.lineTo(172, 78);
  ctx.stroke();
  ctx.fillStyle = INK;
  roundRect(ctx, 34, 74, 56, 34, 12);
  ctx.fill();
  roundRect(ctx, 110, 74, 56, 34, 12);
  ctx.fill();
  ctx.strokeStyle = CREAM;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(44, 82);
  ctx.lineTo(54, 82);
  ctx.moveTo(120, 82);
  ctx.lineTo(130, 82);
  ctx.stroke();
  ctx.fillStyle = INK;
  ctx.fill(STACHE);
  ctx.restore();
}

export async function renderDossier(input: DossierInput): Promise<Blob> {
  await fontsReady();
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  // Background and folder.
  ctx.fillStyle = HONEY;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = INK;
  roundRect(ctx, 70, 138, 940, 1120, 34);
  ctx.fill();
  ctx.fillStyle = MANILA;
  roundRect(ctx, 60, 120, 940, 1120, 34);
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = INK;
  ctx.stroke();
  // Folder tab.
  ctx.fillStyle = MANILA;
  roundRect(ctx, 100, 76, 330, 80, 20);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = MANILA;
  ctx.fillRect(106, 118, 318, 40);

  ctx.fillStyle = INK;
  ctx.font = '700 30px "Courier Prime", monospace';
  ctx.textAlign = 'left';
  ctx.fillText('TOP SECRET', 130, 128);
  ctx.textAlign = 'right';
  ctx.fillText(`CASE ${input.caseNumber}`, 960, 200);

  ctx.textAlign = 'left';
  ctx.font = '88px "Lilita One", sans-serif';
  ctx.fillText('Are they a honeypot?', 110, 300);

  // Polaroid.
  ctx.save();
  ctx.translate(540, 650);
  ctx.rotate((-3 * Math.PI) / 180);
  ctx.fillStyle = 'rgba(27,27,31,0.9)';
  ctx.fillRect(-300 + 12, -280 + 14, 600, 640);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(-300, -280, 600, 640);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 5;
  ctx.strokeRect(-300, -280, 600, 640);
  drawPhoto(ctx, input.photo, -270, -250, 540);
  drawDisguise(ctx, -270, -250, 540);
  ctx.fillStyle = INK;
  ctx.font = '700 30px "Courier Prime", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('EXHIBIT A: THE SUSPECT', 0, 335);
  ctx.restore();

  // Stamp.
  ctx.save();
  ctx.translate(690, 790);
  ctx.rotate((-12 * Math.PI) / 180);
  ctx.font = '150px "Lilita One", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const sw = ctx.measureText('SPY').width + 70;
  ctx.fillStyle = 'rgba(255,244,214,0.9)';
  roundRect(ctx, -sw / 2, -84, sw, 168, 20);
  ctx.fill();
  ctx.lineWidth = 12;
  ctx.strokeStyle = RED;
  ctx.stroke();
  ctx.lineWidth = 4;
  roundRect(ctx, -sw / 2 - 13, -97, sw + 26, 194, 28);
  ctx.stroke();
  ctx.fillStyle = RED;
  ctx.fillText('SPY', 0, 10);
  ctx.restore();

  // Evidence.
  ctx.fillStyle = INK;
  ctx.textAlign = 'left';
  ctx.font = '700 30px "Courier Prime", monospace';
  ctx.fillText('VERDICT: SPY  ·  CONFIDENCE: 100%', 110, 1080);
  ctx.font = '28px "Courier Prime", monospace';
  // Whole items only: four lines fit inside the folder.
  let y = 1128;
  for (const item of input.evidence) {
    const lines = wrap(ctx, `▸ ${item}`, 860);
    if (y + (lines.length - 1) * 34 > 1226) continue;
    for (const line of lines) {
      ctx.fillText(line, 110, y);
      y += 34;
    }
  }

  // Footer.
  ctx.fillStyle = INK;
  ctx.font = '44px "Lilita One", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('aretheyahoneypot.com', W / 2, 1312);

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not render dossier'))), 'image/png'));
}
