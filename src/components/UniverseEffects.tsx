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

type DustParticle = {
  x: number;
  y: number;
  radius: number;
  opacity: number;
  drift: number;
  phase: number;
  tint: number;
};

function makeLayer(
  width: number,
  height: number,
  count: number,
  speed: number,
  radius: number
): StarLayer {
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

function makeDust(width: number, height: number, count: number): DustParticle[] {
  return Array.from({ length: count }, () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    radius: 0.35 + Math.random() * 0.7,
    opacity: 0.08 + Math.random() * 0.13,
    drift: (Math.random() - 0.5) * 0.18,
    phase: Math.random() * Math.PI * 2,
    tint: Math.random()
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
    let dust: DustParticle[] = [];

    const draw = (time = 0) => {
      context.clearRect(0, 0, width, height);

      for (const layer of layers) {
        for (const star of layer.stars) {
          context.fillStyle = `rgba(205, 231, 255, ${star.opacity})`;
          context.beginPath();
          context.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
          context.fill();
        }
      }

      for (const particle of dust) {
        const shimmer =
          0.78 + Math.sin(time * 0.00045 + particle.phase) * 0.22;
        const opacity = particle.opacity * shimmer;
        const color =
          particle.tint > 0.55
            ? `rgba(164, 145, 255, ${opacity})`
            : `rgba(120, 220, 255, ${opacity})`;

        context.fillStyle = color;
        context.beginPath();
        context.arc(
          particle.x,
          particle.y,
          particle.radius,
          0,
          Math.PI * 2
        );
        context.fill();
      }
    };

    const resize = () => {
      const rect = shell.getBoundingClientRect();

      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);

      // Keep rendering inexpensive on integrated graphics and low-memory devices.
      pixelRatio = Math.min(window.devicePixelRatio || 1, 1.1);

      canvas.width = Math.round(width * pixelRatio);
      canvas.height = Math.round(height * pixelRatio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

      const compact = width < 600;
      const scale = compact ? 0.62 : Math.min(1, width / 1100);

      layers = [
        makeLayer(width, height, Math.round(13 * scale), 2.2, 0.75),
        makeLayer(width, height, Math.round(21 * scale), 5.2, 1.05),
        makeLayer(width, height, Math.round(30 * scale), 9.5, 1.35)
      ];

      // Sparse particles add depth without expensive blur or gradients.
      dust = makeDust(width, height, Math.round(26 * scale));

      draw();
    };

    const stop = () => {
      if (frame) window.cancelAnimationFrame(frame);
      frame = 0;
      previousTime = 0;
    };

    const animate = (time: number) => {
      if (document.hidden || motionQuery.matches) {
        stop();
        return;
      }

      if (previousTime && time - previousTime < frameInterval) {
        frame = window.requestAnimationFrame(animate);
        return;
      }

      const delta = Math.min(
        0.05,
        previousTime ? (time - previousTime) / 1000 : 0.033
      );
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

      for (const particle of dust) {
        particle.y += 1.4 * delta;
        particle.x += particle.drift * delta;

        if (particle.y > height + 2) {
          particle.y = -2;
          particle.x = Math.random() * width;
        }

        if (particle.x < -2) particle.x = width + 2;
        else if (particle.x > width + 2) particle.x = -2;
      }

      draw(time);
      frame = window.requestAnimationFrame(animate);
    };

    const start = () => {
      if (motionQuery.matches || document.hidden || frame) return;

      previousTime = 0;
      frame = window.requestAnimationFrame(animate);
    };

    const onMotionChange = () => {
      if (motionQuery.matches) {
        stop();
        draw();
      } else {
        start();
      }
    };

    const onVisibilityChange = () => {
      if (document.hidden) stop();
      else start();
    };

    resize();

    const observer = new ResizeObserver(resize);
    observer.observe(shell);

    document.addEventListener("visibilitychange", onVisibilityChange);
    motionQuery.addEventListener("change", onMotionChange);

    start();

    return () => {
      stop();
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      motionQuery.removeEventListener("change", onMotionChange);
      context.clearRect(0, 0, width, height);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="universe-effects-canvas"
      aria-hidden="true"
    />
  );
}
