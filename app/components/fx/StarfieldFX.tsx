"use client";

import { useEffect, useRef } from "react";
import type { Phase } from "@/lib/types";

/** Canvas starfield for the Deep Space theme — the "geek bar" backdrop.
 *
 * One <canvas> draws everything (a dense field of additively-blended twinkling
 * stars + periodic shooting stars) in a single paint, which is far cheaper on a
 * Raspberry Pi than hundreds of animated DOM nodes. The big soft galaxy/nebula
 * stays CSS (see globals.css); this layer is the sharp, glowing star detail.
 *
 * Performance guardrails:
 *  - device pixel ratio capped at 1.5,
 *  - star count scaled to viewport area (hard cap ~560),
 *  - the rAF loop throttles to ~32 fps and pauses when the tab is hidden,
 *  - `prefers-reduced-motion` paints a single static frame and never loops.
 */
export function StarfieldFX({ phase }: { phase: Phase }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const phaseRef = useRef<Phase>(phase);

  // Keep the ref in sync so the rAF loop reads the live phase without restarting.
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    let w = 0;
    let h = 0;

    type Star = {
      x: number;
      y: number;
      r: number;
      base: number; // base alpha
      tw: number; // twinkle phase
      twSpeed: number; // twinkle speed
      depth: number; // 0 (far) .. 1 (near) — drives drift + parallax
      hue: number; // colour (mostly blue-white, some warm/teal)
    };
    type Shooter = {
      x: number;
      y: number;
      vx: number;
      vy: number;
      life: number;
      max: number;
      len: number;
    };
    type Palette = { light: string; base: string; dark: string };
    type Ring = { inner: number; outer: number; tilt: number; flatten: number; color: string };
    type Planet = {
      x: number;
      y: number;
      r: number;
      depth: number;
      pal: Palette;
      bands: boolean;
      ring: Ring | null;
    };

    let stars: Star[] = [];
    let planets: Planet[] = [];
    const shooters: Shooter[] = [];

    // Fixed cast of planets (positions are fractions of the viewport, radius a
    // fraction of its smaller side), kept out of dead-centre so they don't sit
    // behind the clock. `color` for rings is an "r,g,b" triplet.
    const PLANET_DEFS = [
      // ringed gas giant (Saturn-ish), upper right
      { fx: 0.82, fy: 0.23, rf: 0.085, depth: 0.55, pal: { light: "#f7e6ba", base: "#d8b277", dark: "#65461f" }, bands: true,
        ring: { innerF: 1.45, outerF: 2.35, tilt: -0.42, flatten: 0.34, color: "224,204,160" } },
      // ice giant (Neptune-ish), lower left
      { fx: 0.14, fy: 0.72, rf: 0.06, depth: 0.4, pal: { light: "#d2ecff", base: "#5790d8", dark: "#172a57" }, bands: true,
        ring: null },
      // small rusty world (Mars-ish), lower centre-right
      { fx: 0.66, fy: 0.86, rf: 0.034, depth: 0.3, pal: { light: "#f2b78f", base: "#b9583a", dark: "#451b11" }, bands: false,
        ring: null },
    ];

    const rand = (a: number, b: number) => a + Math.random() * (b - a);

    const seedStars = () => {
      const area = w * h;
      const count = Math.min(Math.round(area / 2600), 560); // dense field
      stars = Array.from({ length: count }, () => {
        const depth = Math.random();
        // a few stars get a colour cast (teal / warm); most are blue-white
        const roll = Math.random();
        const hue = roll > 0.9 ? rand(160, 190) : roll < 0.12 ? rand(28, 45) : rand(205, 235);
        return {
          x: Math.random() * w,
          y: Math.random() * h,
          r: rand(0.6, 2.4) * (0.55 + depth),
          base: rand(0.45, 1) * (0.6 + depth * 0.45),
          tw: rand(0, Math.PI * 2),
          twSpeed: rand(0.5, 2.6),
          depth,
          hue,
        };
      });
    };

    const sizeOf = () => {
      const rect = canvas.getBoundingClientRect();
      // fall back to the parent / window if layout hasn't settled yet
      const cw = rect.width || canvas.clientWidth || canvas.parentElement?.clientWidth || window.innerWidth;
      const ch = rect.height || canvas.clientHeight || canvas.parentElement?.clientHeight || window.innerHeight;
      return { cw: Math.max(1, cw), ch: Math.max(1, ch) };
    };

    const resize = () => {
      const { cw, ch } = sizeOf();
      w = cw;
      h = ch;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      seedStars();
      seedPlanets();
    };

    const seedPlanets = () => {
      const min = Math.min(w, h);
      planets = PLANET_DEFS.map((d) => {
        const r = Math.max(16, min * d.rf);
        return {
          x: d.fx * w,
          y: d.fy * h,
          r,
          depth: d.depth,
          pal: d.pal,
          bands: d.bands,
          ring: d.ring
            ? {
                inner: r * d.ring.innerF,
                outer: r * d.ring.outerF,
                tilt: d.ring.tilt,
                flatten: d.ring.flatten,
                color: d.ring.color,
              }
            : null,
        };
      });
    };

    // "#rrggbb" + alpha → rgba() string.
    const hexA = (hex: string, a: number) => {
      const n = parseInt(hex.slice(1), 16);
      return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
    };

    const drawRing = (cx: number, cy: number, p: Planet, half: "back" | "front") => {
      const ring = p.ring;
      if (!ring) return;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(ring.tilt);
      const start = half === "back" ? Math.PI : 0;
      const end = half === "back" ? Math.PI * 2 : Math.PI;
      ctx.beginPath();
      ctx.ellipse(0, 0, ring.outer, ring.outer * ring.flatten, 0, start, end);
      ctx.ellipse(0, 0, ring.inner, ring.inner * ring.flatten, 0, end, start, true);
      ctx.closePath();
      const grad = ctx.createLinearGradient(-ring.outer, 0, ring.outer, 0);
      grad.addColorStop(0, `rgba(${ring.color}, 0.04)`);
      grad.addColorStop(0.5, `rgba(${ring.color}, 0.6)`);
      grad.addColorStop(1, `rgba(${ring.color}, 0.04)`);
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.restore();
    };

    const drawSphere = (cx: number, cy: number, p: Planet) => {
      const { r, pal } = p;
      // atmospheric glow
      const atmo = ctx.createRadialGradient(cx, cy, r * 0.92, cx, cy, r * 1.28);
      atmo.addColorStop(0, hexA(pal.base, 0.32));
      atmo.addColorStop(1, hexA(pal.base, 0));
      ctx.fillStyle = atmo;
      ctx.beginPath();
      ctx.arc(cx, cy, r * 1.28, 0, Math.PI * 2);
      ctx.fill();
      // body, lit from the upper-left
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      const body = ctx.createRadialGradient(cx - r * 0.4, cy - r * 0.4, r * 0.1, cx, cy, r);
      body.addColorStop(0, pal.light);
      body.addColorStop(0.55, pal.base);
      body.addColorStop(1, pal.dark);
      ctx.fillStyle = body;
      ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
      // gas-giant banding
      if (p.bands) {
        for (let b = -3; b <= 3; b++) {
          ctx.globalAlpha = 0.1;
          ctx.fillStyle = b % 2 === 0 ? pal.light : pal.dark;
          const by = cy + (b / 3.5) * r;
          ctx.fillRect(cx - r, by - r * 0.07, r * 2, r * 0.14);
        }
        ctx.globalAlpha = 1;
      }
      // terminator shadow on the lower-right
      const sh = ctx.createRadialGradient(cx + r * 0.55, cy + r * 0.55, r * 0.2, cx, cy, r * 1.05);
      sh.addColorStop(0, "rgba(0,0,0,0)");
      sh.addColorStop(1, "rgba(0,0,0,0.5)");
      ctx.fillStyle = sh;
      ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
      ctx.restore();
    };

    const drawPlanet = (p: Planet, sway: number) => {
      const cx = p.x + sway * p.depth;
      drawRing(cx, p.y, p, "back");
      drawSphere(cx, p.y, p);
      drawRing(cx, p.y, p, "front");
    };

    const spawnShooter = () => {
      const fromLeft = Math.random() < 0.6;
      const x = fromLeft ? rand(-0.1 * w, 0.4 * w) : rand(0.6 * w, 1.1 * w);
      const y = rand(-0.05 * h, 0.4 * h);
      const speed = rand(460, 780);
      const angle = fromLeft ? rand(0.32, 0.62) : Math.PI - rand(0.32, 0.62);
      shooters.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0,
        max: rand(0.6, 1.0),
        len: rand(150, 280),
      });
    };

    const drawStar = (s: Star, alpha: number, x: number) => {
      const color = `hsla(${s.hue}, 90%, 85%, ${Math.max(0, alpha)})`;
      // soft glow halo
      ctx.globalAlpha = 1;
      const glow = ctx.createRadialGradient(x, s.y, 0, x, s.y, s.r * 4.5);
      glow.addColorStop(0, color);
      glow.addColorStop(1, `hsla(${s.hue}, 90%, 70%, 0)`);
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(x, s.y, s.r * 4.5, 0, Math.PI * 2);
      ctx.fill();
      // bright core
      ctx.fillStyle = `hsla(${s.hue}, 95%, 95%, ${Math.max(0, alpha)})`;
      ctx.beginPath();
      ctx.arc(x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    };

    const drawStatic = () => {
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = "lighter";
      for (const s of stars) drawStar(s, s.base, s.x);
      ctx.globalCompositeOperation = "source-over";
      for (const p of planets) drawPlanet(p, 0);
      ctx.globalAlpha = 1;
    };

    resize();

    const ro = new ResizeObserver(() => {
      resize();
      if (reduceMotion) drawStatic();
    });
    ro.observe(canvas);

    if (reduceMotion) {
      drawStatic();
      return () => ro.disconnect();
    }

    let raf = 0;
    let last = 0;
    let t = 0;
    let nextShot = rand(1.2, 3);
    const frameMin = 1 / 32; // throttle to ~32fps
    let running = true;

    const frame = (ts: number) => {
      raf = requestAnimationFrame(frame);
      if (!running) return;
      const nowS = ts / 1000;
      const dt = last ? nowS - last : 0;
      if (last && dt < frameMin) return; // skip — hold the throttle
      last = nowS;
      t += dt || 0.016;

      const active = phaseRef.current !== "idle";
      const sway = Math.sin(t * 0.07) * 16; // gentle auto-parallax (kiosks have no mouse)

      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = "lighter"; // stars add up into a glow

      for (const s of stars) {
        s.x += s.depth * 6 * (dt || 0.016);
        if (s.x - 4 > w) s.x = -4;
        const px = s.x + sway * s.depth;
        const a = s.base * (0.5 + 0.5 * Math.sin(t * s.twSpeed + s.tw));
        drawStar(s, a, px);
      }

      // planets — solid bodies drifting very slowly across the far starfield
      ctx.globalCompositeOperation = "source-over";
      for (const p of planets) {
        p.x += p.depth * 1.4 * (dt || 0.016);
        if (p.x - p.r * 3 > w) p.x = -p.r * 3;
        drawPlanet(p, sway);
      }

      // shooting stars
      ctx.globalCompositeOperation = "lighter";
      nextShot -= dt || 0.016;
      const maxShooters = active ? 3 : 2;
      if (nextShot <= 0 && shooters.length < maxShooters) {
        spawnShooter();
        nextShot = active ? rand(1.4, 3.5) : rand(2.5, 6);
      }
      for (let i = shooters.length - 1; i >= 0; i--) {
        const sh = shooters[i];
        sh.life += dt || 0.016;
        sh.x += sh.vx * (dt || 0.016);
        sh.y += sh.vy * (dt || 0.016);
        const p = sh.life / sh.max;
        if (p >= 1) {
          shooters.splice(i, 1);
          continue;
        }
        const fade = Math.sin(Math.min(p, 1) * Math.PI);
        const mag = Math.hypot(sh.vx, sh.vy) || 1;
        const tailX = sh.x - (sh.vx / mag) * sh.len;
        const tailY = sh.y - (sh.vy / mag) * sh.len;
        const grad = ctx.createLinearGradient(sh.x, sh.y, tailX, tailY);
        grad.addColorStop(0, `rgba(255,255,255,${0.95 * fade})`);
        grad.addColorStop(0.4, `rgba(170,205,255,${0.5 * fade})`);
        grad.addColorStop(1, "rgba(120,160,255,0)");
        ctx.strokeStyle = grad;
        ctx.lineWidth = 2.2;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(sh.x, sh.y);
        ctx.lineTo(tailX, tailY);
        ctx.stroke();
        ctx.fillStyle = `rgba(255,255,255,${0.95 * fade})`;
        ctx.beginPath();
        ctx.arc(sh.x, sh.y, 2, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
    };

    const onVisibility = () => {
      running = !document.hidden;
      last = 0; // avoid a big dt jump when resuming
    };
    document.addEventListener("visibilitychange", onVisibility);
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return <canvas ref={canvasRef} className="fx-canvas" aria-hidden />;
}
