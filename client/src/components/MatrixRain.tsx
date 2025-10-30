import React, { useRef, useEffect } from 'react';

type Props = { animated?: boolean };

export default function MatrixRain({ animated = true }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    // Respect reduced motion preference
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;

    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    let width = 0;
    let height = 0;
    let columns: number;
    let fontSize = 14;
    let drops: number[] = [];

    const chars = '01\u25A0\u25A1\u2665\u2663\u2666\u2660';
    const neonGreen = '#39ff9a';
    const neonCyan = '#5be7ff';
    const neonPurple = '#b26bff';

    function resize() {
      const dpr = Math.max(1, window.devicePixelRatio || 1);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      fontSize = Math.max(10, Math.min(18, Math.floor(Math.min(18, width / 90))));
      ctx.font = `${fontSize}px monospace`;

      columns = Math.ceil(width / fontSize);
      // populate drops (y positions) randomly
      drops = new Array(columns).fill(0).map(() => Math.random() * height);
    }

    // single-frame draw (static mode)
    function drawOnce() {
      ctx.fillStyle = 'rgba(3,6,8,0.12)';
      ctx.fillRect(0, 0, width, height);

      for (let i = 0; i < columns; i++) {
        const x = i * fontSize;
        const y = drops[i];

        const t = i % 3;
        let color = neonGreen;
        if (t === 1) color = neonCyan;
        else if (t === 2) color = neonPurple;

        ctx.fillStyle = color;
        const text = chars.charAt(Math.floor(Math.random() * chars.length));
        ctx.fillText(text, x, y);
      }
    }

    // animated draw loop (original behavior)
    function drawLoop() {
      ctx.fillStyle = 'rgba(3,6,8,0.12)';
      ctx.fillRect(0, 0, width, height);

      for (let i = 0; i < columns; i++) {
        const x = i * fontSize;
        const y = drops[i];

        const t = i % 3;
        let color = neonGreen;
        if (t === 1) color = neonCyan;
        else if (t === 2) color = neonPurple;

        ctx.fillStyle = color;
        const text = chars.charAt(Math.floor(Math.random() * chars.length));
        ctx.fillText(text, x, y);

        const step = fontSize * (0.6 + Math.random() * 0.8);
        if (y > height && Math.random() > 0.975) {
          drops[i] = 0;
        } else {
          drops[i] = y + step;
        }
      }

      rafRef.current = requestAnimationFrame(drawLoop);
    }

    // setup
    resize();
    window.addEventListener('resize', resize);

    if (animated) {
      // start animation loop
      rafRef.current = requestAnimationFrame(drawLoop);
    } else {
      // static: draw one frame and redraw on resize
      drawOnce();
    }

    return () => {
      window.removeEventListener('resize', resize);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [animated]);

  // canvas sits behind everything and doesn't receive pointer events
  return <canvas ref={canvasRef} className="matrix-canvas" aria-hidden="true" />;
}