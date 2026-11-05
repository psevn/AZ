import { useEffect, useRef } from "react";

type Comet = { x: number; y: number; vx: number; vy: number; length: number; width: number; hue: number; life: number };

function makeComet(width: number, height: number, initial = false): Comet {
  const fromLeft = Math.random() > 0.5;
  const angle = (Math.random() * 0.42 + 0.16) * (Math.PI / 2);
  const speed = 34 + Math.random() * 48;
  const direction = Math.random() > 0.5 ? 1 : -1;
  return {
    x: initial ? Math.random() * width : fromLeft ? -80 : width + 80,
    y: initial ? Math.random() * height : Math.random() * height * 0.82,
    vx: Math.cos(angle) * speed * (fromLeft ? 1 : -1),
    vy: Math.sin(angle) * speed * direction,
    length: 48 + Math.random() * 78,
    width: 1 + Math.random() * 1.1,
    hue: Math.random() > 0.5 ? 190 : 258,
    life: 0
  };
}

export default function UniverseEffects() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const shell = canvas?.parentElement;
    const context = canvas?.getContext("2d", { alpha: true });
    if (!canvas || !shell || !context) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const finePointer = window.matchMedia("(pointer: fine)").matches;
    let width = 0;
    let height = 0;
    let pixelRatio = 1;
    let frame = 0;
    let previousTime = 0;
    let comets: Comet[] = [];

    const resize = () => {
      const rect = shell.getBoundingClientRect();
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      // Cap backing resolution to protect integrated graphics and low-memory devices.
      pixelRatio = Math.min(window.devicePixelRatio || 1, 1.35);
      canvas.width = Math.round(width * pixelRatio);
      canvas.height = Math.round(height * pixelRatio);
      canvas.style.width = width + "px";
      canvas.style.height = height + "px";
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      comets = Array.from({ length: width < 600 ? 2 : 4 }, () => makeComet(width, height, true));
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(shell);

    const drawComet = (comet: Comet) => {
      const tailX = comet.x - (comet.vx / Math.max(1, Math.hypot(comet.vx, comet.vy))) * comet.length;
      const tailY = comet.y - (comet.vy / Math.max(1, Math.hypot(comet.vx, comet.vy))) * comet.length;
      const gradient = context.createLinearGradient(tailX, tailY, comet.x, comet.y);
      gradient.addColorStop(0, "rgba(103,219,243,0)");
      gradient.addColorStop(0.55, `hsla(${comet.hue}, 95%, 67%, .12)`);
      gradient.addColorStop(1, `hsla(${comet.hue}, 100%, 82%, .9)`);
      context.save();
      context.globalCompositeOperation = "lighter";
      context.strokeStyle = gradient;
      context.lineWidth = comet.width;
      context.lineCap = "round";
      context.beginPath();
      context.moveTo(tailX, tailY);
      context.lineTo(comet.x, comet.y);
      context.stroke();
      const glow = context.createRadialGradient(comet.x, comet.y, 0, comet.x, comet.y, 12);
      glow.addColorStop(0, "rgba(226,250,255,.9)");
      glow.addColorStop(0.22, `hsla(${comet.hue},100%,72%,.35)`);
      glow.addColorStop(1, "rgba(103,219,243,0)");
      context.fillStyle = glow;
      context.beginPath();
      context.arc(comet.x, comet.y, 12, 0, Math.PI * 2);
      context.fill();
      context.restore();
    };

    const animate = (time: number) => {
      const delta = Math.min(0.04, previousTime ? (time - previousTime) / 1000 : 0.016);
      previousTime = time;
      context.clearRect(0, 0, width, height);

      for (const comet of comets) {
        comet.x += comet.vx * delta;
        comet.y += comet.vy * delta;
        comet.life += delta;
        drawComet(comet);
      }
      comets = comets.map(comet => {
        const margin = comet.length + 100;
        if (comet.x < -margin || comet.x > width + margin || comet.y < -margin || comet.y > height + margin) {
          return makeComet(width, height);
        }
        return comet;
      });

      frame = window.requestAnimationFrame(animate);
    };

    if (!reducedMotion) frame = window.requestAnimationFrame(animate);
    else {
      context.clearRect(0, 0, width, height);
    }

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      context.clearRect(0, 0, width, height);
    };
  }, []);

  return <canvas ref={canvasRef} className="universe-effects-canvas" aria-hidden="true" />;
}
