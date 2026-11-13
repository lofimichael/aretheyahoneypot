interface Particle { x: number; y: number; vx: number; vy: number; rot: number; vr: number; life: number; size: number; kind: string; color: string; }

const COLORS = ['#ffc21a', '#e63946', '#2ec4b6', '#ff8fc7', '#fff4d6', '#1b1b1f'];
const EMOJI = ['🍯', '🕶️', '🍯', '🕵️'];

export function burst(canvas: HTMLCanvasElement, originX: number, originY: number, count = 90): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(window.innerWidth * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const parts: Particle[] = Array.from({ length: count }, (_, i) => {
    const angle = Math.random() * Math.PI * 2;
    const speed = 4 + Math.random() * 9;
    return {
      x: originX,
      y: originY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 6,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.4,
      life: 1,
      size: i % 6 === 0 ? 26 + Math.random() * 10 : 7 + Math.random() * 7,
      kind: i % 6 === 0 ? EMOJI[i % EMOJI.length] : 'rect',
      color: COLORS[i % COLORS.length],
    };
  });

  let last = performance.now();
  const frame = (now: number) => {
    const dt = Math.min(2, (now - last) / 16.67);
    last = now;
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    let alive = 0;
    for (const p of parts) {
      if (p.life <= 0) continue;
      p.vy += 0.32 * dt;
      p.vx *= 0.985;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      p.life -= 0.009 * dt;
      if (p.y > window.innerHeight + 40) p.life = 0;
      if (p.life <= 0) continue;
      alive++;
      ctx.save();
      ctx.globalAlpha = Math.min(1, p.life * 2);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      if (p.kind === 'rect') {
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      } else {
        ctx.font = `${p.size}px system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(p.kind, 0, 0);
      }
      ctx.restore();
    }
    if (alive > 0) requestAnimationFrame(frame);
    else ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
  };
  requestAnimationFrame(frame);
}
