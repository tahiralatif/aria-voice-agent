"use client";
import { useEffect, useRef } from "react";

type Levels = () => { mic: number; out: number };
type Win = { x: number; y: number; ph: number };
type Bld = { x: number; w: number; h: number; wins: Win[]; tower?: boolean };

function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function build(w: number, h: number): Bld[] {
  const r = rng(7);
  const out: Bld[] = [];
  let x = -10;
  const towerX = w * 0.62;
  while (x < w + 10) {
    const bw = 22 + r() * 34;
    const near = Math.abs(x + bw / 2 - towerX);
    const bh = h * (0.1 + r() * 0.2) * (near < w * 0.18 ? 1.5 : 1);
    const wins: Win[] = [];
    for (let wx = 5; wx < bw - 5; wx += 8) for (let wy = 8; wy < bh - 6; wy += 11) wins.push({ x: wx, y: wy, ph: r() * 100 });
    out.push({ x, w: bw, h: bh, wins });
    x += bw + 1 + r() * 4;
  }
  const th = h * 0.62;
  const tw = 26;
  const wins: Win[] = [];
  for (let wy = 14; wy < th - 20; wy += 12) {
    const span = Math.max(1, Math.floor((tw - 6) * (1 - (wy / th) * 0.8) / 7));
    for (let i = 0; i < span; i++) wins.push({ x: tw / 2 + (i - (span - 1) / 2) * 7 - 1.5, y: wy, ph: r() * 100 });
  }
  out.push({ x: towerX - tw / 2, w: tw, h: th, wins, tower: true });
  return out;
}

export default function Skyline({ getLevels, live }: { getLevels: Levels; live: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const liveRef = useRef(live);
  useEffect(() => { liveRef.current = live; }, [live]);

  useEffect(() => {
    const cv = ref.current!;
    const ctx = cv.getContext("2d")!;
    let w = 0, h = 0, blds: Bld[] = [], raf = 0;
    const smooth = { mic: 0, out: 0 };
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = cv.clientWidth;
      h = cv.clientHeight;
      cv.width = w * dpr;
      cv.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      blds = build(w, h * 0.78);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(cv);

    const draw = (ms: number) => {
      const t = ms / 1000;
      const lv = getLevels();
      smooth.out += (lv.out - smooth.out) * 0.25;
      smooth.mic += (lv.mic - smooth.mic) * 0.25;
      const idle = liveRef.current ? 0 : 1;
      const breathe = 0.5 + 0.5 * Math.sin(t * (idle ? 0.7 : 1.4));
      const horizon = h * 0.78;

      const sky = ctx.createLinearGradient(0, 0, 0, horizon);
      sky.addColorStop(0, "#0b1020");
      sky.addColorStop(0.45, "#2a2250");
      sky.addColorStop(0.8, "#a8506b");
      sky.addColorStop(1, "#f2a65a");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, horizon);

      // stars
      const sr = rng(99);
      for (let i = 0; i < 70; i++) {
        const sx = sr() * w, sy = sr() * horizon * 0.5, tw = 0.4 + 0.6 * Math.sin(t * 1.3 + i);
        ctx.fillStyle = `rgba(255,240,220,${0.15 + 0.35 * tw})`;
        ctx.fillRect(sx, sy, 1.4, 1.4);
      }

      // sun glow, pulses with Aria's voice
      const gx = w * 0.2, gy = horizon - 6;
      const gr = h * (0.28 + 0.05 * breathe + smooth.out * 0.18);
      const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr);
      g.addColorStop(0, "rgba(255,214,150,0.95)");
      g.addColorStop(0.35, "rgba(242,166,90,0.45)");
      g.addColorStop(1, "rgba(242,166,90,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, horizon);

      // buildings
      const towerCx = blds[blds.length - 1].x + blds[blds.length - 1].w / 2;
      for (const b of blds) {
        const top = horizon - b.h;
        ctx.fillStyle = b.tower ? "#10142b" : "#141a33";
        if (b.tower) {
          ctx.beginPath();
          ctx.moveTo(b.x - 4, horizon);
          ctx.lineTo(b.x + 4, top + b.h * 0.35);
          ctx.lineTo(b.x + b.w / 2 - 2, top + 30);
          ctx.lineTo(b.x + b.w / 2, top - h * 0.1);
          ctx.lineTo(b.x + b.w / 2 + 2, top + 30);
          ctx.lineTo(b.x + b.w - 4, top + b.h * 0.35);
          ctx.lineTo(b.x + b.w + 4, horizon);
          ctx.closePath();
          ctx.fill();
        } else {
          ctx.fillRect(b.x, top, b.w, b.h);
        }
        for (const win of b.wins) {
          const wx = b.x + win.x, wy = top + win.y;
          const dist = Math.abs(wx - towerCx) / w;
          const wave = smooth.out * (0.5 + 0.5 * Math.sin(t * 7 - dist * 14 + win.ph));
          const base = 0.1 + 0.18 * Math.sin(t * 0.5 + win.ph) ** 2 * (reduce ? 0 : 1);
          const mic = smooth.mic * (0.5 + 0.5 * Math.sin(t * 9 + win.ph)) * 0.6;
          const a = Math.min(1, base + wave + mic * 0.4 + (idle ? 0 : 0.05));
          ctx.fillStyle = mic > wave && smooth.mic > 0.15 ? `rgba(94,214,200,${a})` : `rgba(255,205,120,${a})`;
          ctx.fillRect(wx, wy, 3, 5);
        }
      }
      // beacon
      ctx.fillStyle = `rgba(255,120,90,${0.4 + 0.6 * (Math.sin(t * 3) > 0 ? 1 : 0.2)})`;
      ctx.beginPath();
      ctx.arc(towerCx, horizon - blds[blds.length - 1].h - h * 0.1, 2.2, 0, 7);
      ctx.fill();

      // water
      const water = ctx.createLinearGradient(0, horizon, 0, h);
      water.addColorStop(0, "#241b3d");
      water.addColorStop(1, "#080b18");
      ctx.fillStyle = water;
      ctx.fillRect(0, horizon, w, h - horizon);
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, horizon, w, h - horizon);
      ctx.clip();
      ctx.globalAlpha = 0.22;
      ctx.translate(0, horizon * 2);
      ctx.scale(1, -1);
      ctx.drawImage(cv, 0, 0, cv.width, horizon * (cv.height / h), 0, 0, w, horizon);
      ctx.restore();
      ctx.globalAlpha = 1;
      for (let i = 0; i < 14; i++) {
        const y = horizon + 6 + i * ((h - horizon) / 14);
        const amp = 2 + smooth.mic * 14 + smooth.out * 6;
        ctx.strokeStyle = `rgba(${smooth.mic > smooth.out ? "94,214,200" : "242,166,90"},${0.05 + 0.12 * (1 - i / 14)})`;
        ctx.beginPath();
        for (let x = 0; x <= w; x += 12) {
          const yy = y + Math.sin(x * 0.02 + t * 1.5 + i) * amp * (i / 14 + 0.2);
          if (x === 0) ctx.moveTo(x, yy);
          else ctx.lineTo(x, yy);
        }
        ctx.stroke();
      }
      raf = reduce ? window.setTimeout(() => draw(performance.now()), 250) : requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(raf);
      ro.disconnect();
    };
  }, [getLevels]);

  return <canvas ref={ref} className="skyline" aria-hidden="true" />;
}
