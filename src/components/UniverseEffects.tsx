import { useEffect, useRef } from "react";

type Star = {
  x: number;
  y: number;
  radius: number;
  opacity: number;
  drift: number;
};

type StarLayer = {
  stars: Star[];
  speed: number;
};

type Comet = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  length: number;
  opacity: number;
  remaining: number;
  delay: number;
};

type DustParticle = {
  x: number;
  y: number;
  radius: number;
  opacity: number;
  drift: number;
  phase: number;
  tint: "cyan" | "violet";
};

function makeLayer(width: number, height: number, count: number, speed: number, radius: number): StarLayer {
  return {
    speed,
    stars: Array.from({ length: count }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      radius: radius * (0.65 + Math.random() * 0.7),
      opacity: 0.18 + Math.random() * 0.42,
      drift: (Math.random() - 0.5) * 0.12
    }))
  };
}

function makeComet(width: number, height: number, delay = Math.random() * 2.5): Comet {
  const angle = 0.42 + Math.random() * 0.28;
  const speed = 190 + Math.random() * 90;
  return {
    x: Math.random() * width * 0.88,
    y: Math.random() * height * 0.72,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    length: 58 + Math.random() * 46,
    opacity: 0.22 + Math.random() * 0.18,
    remaining: 1.8 + Math.random() * 1.2,
    delay
  };
}

function makeDust(width: number, height: number, count: number): DustParticle[] {
  return Array.from({ length: count }, () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    radius: 0.35 + Math.random() * 0.65,
    opacity: 0.035 + Math.random() * 0.055,
    drift: 0.08 + Math.random() * 0.22,
    phase: Math.random() * Math.PI * 2,
    tint: Math.random() > 0.5 ? "cyan" : "violet"
  }));
}

export default function UniverseEffects() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const shell = canvas?.parentElement;
    const context = canvas?.getContext("2d", { alpha: true });
    if (!canvas || !shell || !context) return;

    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const frameInterval = 1000 / 30;
    let width = 0;
    let height = 0;
    let pixelRatio = 1;
    let frame = 0;
    let previousTime = 0;
    let layers: StarLayer[] = [];
    let comets: Comet[] = [];
    let dustParticles: DustParticle[] = [];

    const draw = () => {
      context.clearRect(0, 0, width, height);
      for (const layer of layers) {
        for (const star of layer.stars) {
          context.fillStyle = `rgba(205, 231, 255, ${star.opacity})`;
          context.beginPath();
          context.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
          context.fill();
        }
      }

      for (const particle of dustParticles) {
        const shimmer = motionQuery.matches ? 1 : 0.82 + Math.sin(particle.phase) * 0.18;
        const tint = particle.tint === "cyan" ? "105, 225, 242" : "157, 125, 255";
        context.fillStyle = `rgba(${tint}, ${particle.opacity * shimmer})`;
        context.beginPath();
        context.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
        context.fill();
      }

      // Draw sparse, low-opacity comets after the stars but on the same
      // background canvas, so all application content remains above them.
      for (const comet of comets) {
        if (comet.delay > 0 || comet.remaining <= 0) continue;
        const tailX = comet.x - (comet.vx / Math.hypot(comet.vx, comet.vy)) * comet.length;
        const tailY = comet.y - (comet.vy / Math.hypot(comet.vx, comet.vy)) * comet.length;
        const gradient = context.createLinearGradient(tailX, tailY, comet.x, comet.y);
        gradient.addColorStop(0, "rgba(32,230,242,0)");
        gradient.addColorStop(0.72, `rgba(32,230,242,${comet.opacity * 0.42})`);
        gradient.addColorStop(1, `rgba(224,250,255,${comet.opacity})`);
        context.strokeStyle = gradient;
        context.lineWidth = 1.15;
        context.beginPath();
        context.moveTo(tailX, tailY);
        context.lineTo(comet.x, comet.y);
        context.stroke();
        context.fillStyle = `rgba(230,250,255,${comet.opacity * 0.78})`;
        context.beginPath();
        context.arc(comet.x, comet.y, 1.35, 0, Math.PI * 2);
        context.fill();
      }
    };

    const resize = () => {
      const rect = shell.getBoundingClientRect();
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      pixelRatio = Math.min(window.devicePixelRatio || 1, 1.1);
      canvas.width = Math.round(width * pixelRatio);
      canvas.height = Math.round(height * pixelRatio);
      canvas.style.width = width + "px";
      canvas.style.height = height + "px";
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

      const compact = width < 600;
      const scale = compact ? 0.62 : Math.min(1, width / 1100);
      layers = [
        makeLayer(width, height, Math.round(13 * scale), 2.2, 0.75),
        makeLayer(width, height, Math.round(21 * scale), 5.2, 1.05),
        makeLayer(width, height, Math.round(30 * scale), 9.5, 1.35)
      ];
      comets = Array.from({ length: compact ? 2 : 3 }, (_, index) =>
        makeComet(width, height, index * 0.8 + Math.random() * 0.35)
      );
      dustParticles = makeDust(width, height, Math.round(26 * scale));
      draw();
    };

    const stop = () => {
      if (frame) window.cancelAnimationFrame(frame);
      frame = 0;
      previousTime = 0;
    };

    const animate = (time: number) => {
      if (document.hidden) {
        stop();
        return;
      }
      if (previousTime && time - previousTime < frameInterval) {
        frame = window.requestAnimationFrame(animate);
        return;
      }
      const delta = Math.min(0.05, previousTime ? (time - previousTime) / 1000 : 0.033);
      previousTime = time;

      for (const layer of layers) {
        for (const star of layer.stars) {
          star.y += layer.speed * delta;
          star.x += star.drift * layer.speed * delta;
          if (star.y > height + 2) {
            star.y = -2;
            star.x = Math.random() * width;
          }
          if (star.x < -2) star.x = width + 2;
          else if (star.x > width + 2) star.x = -2;
        }
      }

      for (const particle of dustParticles) {
        particle.y += particle.drift * delta;
        particle.phase += delta * 0.7;
        if (particle.y > height + 2) {
          particle.y = -2;
          particle.x = Math.random() * width;
        }
      }

      for (let index = 0; index < comets.length; index += 1) {
        const comet = comets[index];
        if (comet.delay > 0) {
          comet.delay -= delta;
          continue;
        }
        comet.x += comet.vx * delta;
        comet.y += comet.vy * delta;
        comet.remaining -= delta;
        if (comet.remaining <= 0 || comet.x > width + comet.length || comet.y > height + comet.length) {
          comets[index] = makeComet(width, height, 1.1 + Math.random() * 2.2);
        }
      }
      draw();
      frame = window.requestAnimationFrame(animate);
    };

    const start = () => {
      if (motionQuery.matches || document.hidden || frame) return;
      previousTime = 0;
      frame = window.requestAnimationFrame(animate);
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(shell);
    const onVisibilityChange = () => {
      if (document.hidden) stop();
      else start();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    const onMotionChange = () => {
      if (motionQuery.matches) {
        stop();
        draw();
      } else {
        start();
      }
    };
    motionQuery.addEventListener("change", onMotionChange);
    if (!motionQuery.matches) start();

    return () => {
      stop();
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      motionQuery.removeEventListener("change", onMotionChange);
      context.clearRect(0, 0, width, height);
    };
  }, []);

  return <canvas ref={canvasRef} className="universe-effects-canvas" aria-hidden="true" />;
}
