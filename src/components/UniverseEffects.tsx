import { useEffect, useRef } from "react";

type Comet = { x: number; y: number; vx: number; vy: number; length: number; width: number; hue: number; life: number };
type Ripple = { x: number; y: number; age: number; strength: number };

function makeComet(width: number, height: number, initial = false): Comet {
  const fromLeft = Math.random() > 0.5;
  const angle = (Math.random() * 0.42 + 0.16) * (Math.PI / 2);
  const speed = 34 + Math.random() * 48;
  const direction = Math.random() > 0.5 ? 1 : -1;
  return {
    x: initial ? Math.random() * width : fromLeft ? -80 : width + 80,
    y: initial ? Math.random() * height : Math.random() * height * 0.82,
    vx: Math.cos(angle) * speed * (fromLeft ? 1 : -1) * direction,
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
    let lastRippleX = -1000;
    let lastRippleY = -1000;
    let pointerInside = false;
    let pointerX = 0;
    let pointerY = 0;
    let comets: Comet[] = [];
    const ripples: Ripple[] = [];

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

    const addRipple = (x: number, y: number, strength: number) => {
      if (ripples.length >= 16) ripples.shift();
      ripples.push({ x, y, age: 0, strength });
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!finePointer || reducedMotion || event.pointerType === "touch") return;
      const rect = shell.getBoundingClientRect();
      pointerX = event.clientX - rect.left;
      pointerY = event.clientY - rect.top;
      pointerInside = pointerX >= 0 && pointerY >= 0 && pointerX <= width && pointerY <= height;
      const dx = pointerX - lastRippleX;
      const dy = pointerY - lastRippleY;
      const distance = Math.hypot(dx, dy);
      if (pointerInside && distance > 13) {
        const steps = Math.min(3, Math.floor(distance / 13));
        for (let i = 1; i <= steps; i++) {
          const amount = i / steps;
          addRipple(lastRippleX < 0 ? pointerX : lastRippleX + dx * amount, lastRippleY < 0 ? pointerY : lastRippleY + dy * amount, 0.55 + Math.random() * 0.25);
        }
        lastRippleX = pointerX;
        lastRippleY = pointerY;
      }
    };
    const onPointerLeave = () => {
      pointerInside = false;
      lastRippleX = -1000;
      lastRippleY = -1000;
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(shell);
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    shell.addEventListener("pointerleave", onPointerLeave);

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

    const drawRipple = (ripple: Ripple) => {
      const progress = ripple.age;
      const radius = 8 + progress * 76;
      const fade = (1 - progress) * ripple.strength;
      context.save();
      context.translate(ripple.x, ripple.y);
      context.globalCompositeOperation = "screen";
      // A soft lens-like wash suggests light bending over a dark water surface.
      const lens = context.createRadialGradient(0, 0, radius * 0.12, 0, 0, radius * 1.18);
      lens.addColorStop(0, "rgba(103,219,243,0)");
      lens.addColorStop(0.68, `rgba(103,219,243,${0.018 * fade})`);
      lens.addColorStop(0.88, `rgba(165,225,255,${0.075 * fade})`);
      lens.addColorStop(1, "rgba(103,219,243,0)");
      context.fillStyle = lens;
      context.beginPath();
      context.ellipse(0, 0, radius * 1.2, radius * 0.72, -0.28, 0, Math.PI * 2);
      context.fill();

      for (let ring = 0; ring < 2; ring++) {
        const r = radius * (0.58 + ring * 0.42);
        context.beginPath();
        context.ellipse(0, 0, r * 1.2, r * 0.72, -0.28, 0, Math.PI * 2);
        context.strokeStyle = ring === 0
          ? `rgba(150,235,255,${0.28 * fade})`
          : `rgba(123,111,255,${0.13 * fade})`;
        context.lineWidth = ring === 0 ? 1.05 : 0.7;
        context.shadowBlur = 8;
        context.shadowColor = "rgba(103,219,243,.45)";
        context.stroke();
      }

      // Broken specular arcs create a subtle refraction / caustic impression.
      context.beginPath();
      context.arc(0, 0, radius * 0.9, Math.PI * 1.05, Math.PI * 1.62);
      context.strokeStyle = `rgba(222,249,255,${0.3 * fade})`;
      context.lineWidth = 1.4;
      context.shadowBlur = 10;
      context.stroke();
      context.beginPath();
      context.arc(0, 0, radius * 1.12, Math.PI * 0.08, Math.PI * 0.55);
      context.strokeStyle = `rgba(103,219,243,${0.2 * fade})`;
      context.lineWidth = 1;
      context.stroke();
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

      if (pointerInside && !reducedMotion) {
        // A tiny moving highlight follows the pointer, while the ripples remain behind it.
        const shimmer = context.createRadialGradient(pointerX, pointerY, 0, pointerX, pointerY, 34);
        shimmer.addColorStop(0, "rgba(205,246,255,.07)");
        shimmer.addColorStop(0.45, "rgba(103,219,243,.035)");
        shimmer.addColorStop(1, "rgba(103,219,243,0)");
        context.fillStyle = shimmer;
        context.beginPath();
        context.arc(pointerX, pointerY, 34, 0, Math.PI * 2);
        context.fill();
      }

      for (let i = ripples.length - 1; i >= 0; i--) {
        const ripple = ripples[i];
        ripple.age += delta / 1.45;
        if (ripple.age >= 1) ripples.splice(i, 1);
        else drawRipple(ripple);
      }
      frame = window.requestAnimationFrame(animate);
    };

    if (!reducedMotion) frame = window.requestAnimationFrame(animate);
    else {
      context.clearRect(0, 0, width, height);
    }

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("pointermove", onPointerMove);
      shell.removeEventListener("pointerleave", onPointerLeave);
      ripples.length = 0;
      context.clearRect(0, 0, width, height);
    };
  }, []);

  return <canvas ref={canvasRef} className="universe-effects-canvas" aria-hidden="true" />;
}
