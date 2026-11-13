// The "WIA is processing" theatre: glyph rain behind the page and a terminal that types fake analysis.

const GLYPHS = '01アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホ0123456789ABCDEF#$%&SPYWIA';

export function createRain(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d');
  const size = 18;
  let drops: number[] = [];
  let running = false;
  let token = 0;
  let last = 0;

  const resize = () => {
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drops = Array.from({ length: Math.ceil(window.innerWidth / size) }, () => Math.floor(Math.random() * -40));
  };

  const frame = (now: number) => {
    if (!running || !ctx) return;
    if (now - last > 55) {
      last = now;
      // Fade previous glyphs out instead of painting a background, so the page shows through.
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = 'rgba(0,0,0,0.16)';
      ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
      ctx.globalCompositeOperation = 'source-over';
      ctx.font = `700 ${size - 2}px "Courier Prime", ui-monospace, monospace`;
      ctx.textAlign = 'center';
      for (let i = 0; i < drops.length; i++) {
        const y = drops[i] * size;
        if (y >= 0) {
          const ch = GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
          ctx.fillStyle = '#1c8f84';
          ctx.fillText(ch, i * size + size / 2, y - size);
          ctx.fillStyle = '#1b1b1f';
          ctx.fillText(GLYPHS[Math.floor(Math.random() * GLYPHS.length)], i * size + size / 2, y);
        }
        drops[i] += 1;
        if (y > window.innerHeight && Math.random() > 0.96) drops[i] = Math.floor(Math.random() * -8);
      }
    }
    requestAnimationFrame(frame);
  };

  return {
    start() {
      token++;
      if (!ctx) return;
      if (!running) {
        running = true;
        resize();
        requestAnimationFrame(frame);
      }
      canvas.classList.add('on');
    },
    stop() {
      const mine = ++token;
      canvas.classList.remove('on');
      setTimeout(() => {
        if (mine !== token || !ctx) return;
        running = false;
        ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      }, 700);
    },
  };
}

const rand = (min: number, max: number) => Math.floor(min + Math.random() * (max - min + 1));
const bar = (pct: number) => `${'#'.repeat(Math.round(pct / 10))}${'-'.repeat(10 - Math.round(pct / 10))}`;

const SCRIPT: Array<() => string> = [
  () => '$ wia scan ./suspect --paranoia=max',
  () => 'loading counterintelligence.dll ....... ok',
  () => { const p = rand(41, 97); return `decrypting cheekbones [${bar(p)}] ${p}%`; },
  () => `cross-referencing ${rand(1200, 9800).toLocaleString('en-US')} LinkedIn endorsements`,
  () => `scanning for trench coats ............. ${rand(2, 9)} found`,
  () => `pinging WIA HQ ........................ ${rand(11, 88)}ms`,
  () => `honeypot_score = 0.${'9'.repeat(rand(5, 9))}`,
  () => '$ sudo enhance --enhance --ENHANCE',
  () => 'brute-forcing alibi ................... failed',
  () => 'grep -r "innocent" ./suspect .......... 0 results',
  () => `analyzing smile: suspicious (0.${'9'.repeat(rand(3, 6))})`,
  () => 'rot13(motive) = "fcl"',
  () => 'compiling dossier.pdf ................. ok',
  () => `checking for second phone ............. ${rand(1, 3)} found`,
  () => 'spinning up wheel.service ............. ok',
  () => `hashing vibes: 0x${rand(0x1000000, 0xfffffff).toString(16).toUpperCase()}`,
];

export function createTerminal(el: HTMLElement) {
  const maxLines = 7;
  let lines: string[] = [];
  let queue: string[] = [];
  let typing = '';
  let running = false;
  let lastFrame = 0;

  const render = () => {
    el.textContent = [...lines, typing + (running ? '█' : '')].slice(-maxLines).join('\n');
  };

  const frame = (now: number) => {
    if (!running) return;
    const dt = Math.min(64, now - (lastFrame || now));
    lastFrame = now;
    let budget = Math.max(1, Math.round(dt / 6)); // roughly 160 characters per second
    while (budget-- > 0) {
      if (!queue.length) queue.push(SCRIPT[Math.floor(Math.random() * SCRIPT.length)]());
      const next = queue[0];
      if (typing.length < next.length) {
        typing = next.slice(0, typing.length + 1);
      } else {
        lines.push(typing);
        lines = lines.slice(-maxLines);
        typing = '';
        queue.shift();
      }
    }
    render();
    requestAnimationFrame(frame);
  };

  return {
    start(reducedMotion: boolean) {
      lines = [];
      typing = '';
      queue = [SCRIPT[0](), SCRIPT[1]()];
      el.hidden = false;
      if (reducedMotion) {
        lines = SCRIPT.slice(0, maxLines).map((f) => f());
        render();
        return;
      }
      if (!running) {
        running = true;
        lastFrame = 0;
        requestAnimationFrame(frame);
      }
    },
    finish(verdict: string) {
      running = false;
      if (typing) lines.push(typing);
      typing = '';
      lines.push(`VERDICT: ${verdict}`);
      render();
    },
    hide() {
      running = false;
      el.hidden = true;
      el.textContent = '';
    },
  };
}
