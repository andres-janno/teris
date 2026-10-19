// src/landing/dust.ts — hero hõljuvad tolmukübemed (sama efekt mis sisselogimislehe LoginBackdrop.tsx-is, ilma Reactita).
interface Mote {
  x: number;
  y: number;
  r: number;
  vx: number;
  vy: number;
  phase: number;
  speed: number;
  alpha: number;
}

// Päike on foto vasakus ülanurgas — kübemed on seal heledamad.
const SUN = { x: 0.14, y: 0.08 };

const makeMote = (w: number, h: number, anywhere: boolean): Mote => ({
  x: Math.random() * w,
  y: anywhere ? Math.random() * h : h + 10,
  r: 0.6 + Math.random() * Math.random() * 2.6,
  vx: 0.06 + Math.random() * 0.22,
  vy: -(0.04 + Math.random() * 0.16),
  phase: Math.random() * Math.PI * 2,
  speed: 0.004 + Math.random() * 0.01,
  alpha: 0.25 + Math.random() * 0.55
});

export function startDust(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext('2d');
  if (!ctx || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  let w = 0;
  let h = 0;
  let motes: Mote[] = [];
  let raf = 0;

  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = canvas.clientWidth;
    h = canvas.clientHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const count = Math.round(Math.min(110, (w * h) / 16000));
    motes = Array.from({ length: count }, () => makeMote(w, h, true));
  };

  const draw = () => {
    ctx.clearRect(0, 0, w, h);
    const sx = SUN.x * w;
    const sy = SUN.y * h;
    const reach = Math.hypot(w, h) * 0.75;
    for (const m of motes) {
      m.phase += m.speed;
      m.x += m.vx + Math.sin(m.phase) * 0.18;
      m.y += m.vy + Math.cos(m.phase * 0.7) * 0.08;
      if (m.y < -10 || m.x > w + 10) Object.assign(m, makeMote(w, h, false), { x: Math.random() * w * 0.9 - w * 0.1 });

      const light = 1 - Math.min(1, Math.hypot(m.x - sx, m.y - sy) / reach);
      const twinkle = 0.65 + 0.35 * Math.sin(m.phase * 2.3);
      const a = m.alpha * twinkle * (0.35 + 0.65 * light);
      const glow = m.r * 4;
      const g = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, glow);
      g.addColorStop(0, `rgba(255, 238, 190, ${a})`);
      g.addColorStop(0.35, `rgba(255, 210, 130, ${a * 0.45})`);
      g.addColorStop(1, 'rgba(255, 200, 120, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(m.x, m.y, glow, 0, Math.PI * 2);
      ctx.fill();
    }
    raf = requestAnimationFrame(draw);
  };

  resize();
  window.addEventListener('resize', resize);
  // Hero väljaspool vaadet: animatsioon peatub, et mitte koormata protsessorit
  new IntersectionObserver(([entry]) => {
    cancelAnimationFrame(raf);
    if (entry.isIntersecting) raf = requestAnimationFrame(draw);
  }).observe(canvas);
}
