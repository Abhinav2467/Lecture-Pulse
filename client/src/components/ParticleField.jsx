import { useEffect, useRef } from 'react';

const MAX_PARTICLES = 2500;

// Two slow sine-wave ribbons. y/amp/thick are fractions of the canvas height.
const RIBBONS = [
  { y: 0.33, amp: 0.105, freq: 1.15, speed: 0.045, phase: 0.4, thick: 0.1, drift: 0.008 },
  { y: 0.45, amp: 0.13, freq: 0.82, speed: -0.032, phase: 2.3, thick: 0.13, drift: -0.006 },
];

/**
 * Plain 2D-canvas particle field (no WebGL): tiny white dots forming two
 * flowing ribbons. DPR-aware, paused while the tab is hidden, and a single
 * static frame under prefers-reduced-motion.
 */
export default function ParticleField({ intensity = 1 }) {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas.getContext('2d');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let width = 0;
    let height = 0;
    let particles = [];
    let frame = 0;
    let elapsed = 14; // start mid-flow rather than from a flat line
    let last = performance.now();

    function draw() {
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = '#fff';
      for (const p of particles) {
        const ribbon = RIBBONS[p.ribbon];
        let u = (p.u + elapsed * ribbon.drift * p.pace) % 1;
        if (u < 0) u += 1;
        const angle = u * Math.PI * 2 * ribbon.freq + elapsed * ribbon.speed * Math.PI * 2 + ribbon.phase;
        // The band twists: it pinches to a line and opens again, which reads as depth.
        const twist = Math.cos(angle * 0.5 + elapsed * 0.11 + p.ribbon * 1.7);
        const centre =
          ribbon.y * height +
          Math.sin(angle) * ribbon.amp * height +
          Math.sin(angle * 2.3 + elapsed * 0.17) * ribbon.amp * height * 0.2;
        const x = (u * 1.16 - 0.08) * width;
        const y = centre + p.v * ribbon.thick * height * (0.16 + 0.84 * Math.abs(twist));
        const depth = 0.5 + 0.5 * Math.sin(angle * 0.5 + p.v * 2.4 + elapsed * 0.11);
        const edge = Math.min(1, Math.sin(u * Math.PI) * 2.2); // fade out at both ends
        ctx.globalAlpha = Math.min(1, p.alpha * (0.3 + 0.7 * depth) * edge * intensity);
        const size = p.size * (0.7 + 0.6 * depth);
        ctx.fillRect(x, y, size, size);
      }
      ctx.globalAlpha = 1;
    }

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.min(MAX_PARTICLES, Math.round((width * height) / 520));
      particles = Array.from({ length: count }, (_, i) => ({
        ribbon: i % RIBBONS.length,
        u: Math.random(),
        // Sum of three uniforms: denser towards the middle of the band.
        v: (Math.random() + Math.random() + Math.random() - 1.5) / 1.5,
        size: 0.7 + Math.random() * 1.1,
        alpha: 0.3 + Math.random() * 0.7,
        pace: 0.6 + Math.random() * 0.8,
      }));
      draw();
    }

    function tick(now) {
      elapsed += Math.min(0.05, (now - last) / 1000);
      last = now;
      draw();
      frame = requestAnimationFrame(tick);
    }

    function start() {
      if (reduced || frame) return;
      last = performance.now();
      frame = requestAnimationFrame(tick);
    }

    function stop() {
      cancelAnimationFrame(frame);
      frame = 0;
    }

    const onVisibility = () => (document.hidden ? stop() : start());
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    document.addEventListener('visibilitychange', onVisibility);
    resize();
    if (!document.hidden) start();

    return () => {
      stop();
      observer.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [intensity]);

  return <canvas ref={ref} className="particles" aria-hidden="true" />;
}
