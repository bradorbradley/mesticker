"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { sounds } from "@/lib/booth-sounds";
import { u } from "../units";

/**
 * Snap Toss — pull Snap back in the slingshot, let go, land him in the bucket.
 * Canvas physics; the bucket moves after every score.
 */

type Vec = { x: number; y: number };
type Particle = Vec & { vx: number; vy: number; life: number; color: string; size: number; rot: number };
type Popup = Vec & { text: string; life: number };

const COLORS = ["#7c5cfc", "#ff6b9d", "#feca57", "#45e3ff", "#2ed573", "#ff9f43"];
const CHEERS = ["Swish!", "Nice shot!", "Bullseye!", "Snap-tastic!", "Wow!"];

export default function SnapToss() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [hint, setHint] = useState(true);

  useEffect(() => {
    try {
      setBest(Number(localStorage.getItem("mesticker-toss-best")) || 0);
    } catch {}
  }, []);

  useEffect(() => {
    const wrap = wrapRef.current!;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const img = new Image();
    img.src = "/booth/mascot.webp";

    let W = 0, H = 0, S = 0; // S = Snap's height in px
    let dpr = 1;
    const anchor: Vec = { x: 0, y: 0 };
    const p = { x: 0, y: 0, vx: 0, vy: 0, rot: 0, vr: 0, squash: 1, state: "ready" as "ready" | "drag" | "fly" | "scored" | "rest", t: 0 };
    const bucket = { x: 0, y: 0, w: 0, h: 0, wobble: 0 };
    let particles: Particle[] = [];
    let popups: Popup[] = [];
    let streak = 0;
    let localScore = 0;
    let pointerId: number | null = null;

    const ground = () => H * 0.93;
    const radius = () => S * 0.32;
    const maxPull = () => Math.min(W, H) * 0.24;
    const gravity = () => H * 2.2;
    const power = () => Math.sqrt(W * gravity()) / maxPull() * 1.05;

    const placeBucket = (first = false) => {
      bucket.w = S * 1.25;
      bucket.h = S * 0.85;
      const minX = W * (first ? 0.68 : 0.5);
      bucket.x = minX + Math.random() * (W * 0.9 - minX);
      bucket.y = ground() - bucket.h - Math.random() * H * 0.28;
    };
    const resetSnap = () => {
      Object.assign(p, { x: anchor.x, y: anchor.y, vx: 0, vy: 0, rot: 0, vr: 0, squash: 1, state: "ready", t: 0 });
    };

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = wrap.clientWidth;
      H = wrap.clientHeight;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      canvas.style.width = `${W}px`;
      canvas.style.height = `${H}px`;
      S = Math.min(W, H) * 0.26;
      anchor.x = W * 0.17;
      anchor.y = ground() - S * 1.25;
      placeBucket(true);
      resetSnap();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    resize();

    const burst = (x: number, y: number, n = 36) => {
      for (let i = 0; i < n; i++) {
        const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.2;
        const sp = H * (0.6 + Math.random() * 0.9);
        particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1, color: COLORS[i % COLORS.length], size: S * (0.05 + Math.random() * 0.05), rot: Math.random() * 6 });
      }
    };

    // ---- input
    const pos = (e: PointerEvent): Vec => {
      const r = canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const down = (e: PointerEvent) => {
      if (p.state !== "ready") return;
      const q = pos(e);
      if (Math.hypot(q.x - p.x, q.y - p.y) > S * 1.1) return;
      pointerId = e.pointerId;
      canvas.setPointerCapture(e.pointerId);
      p.state = "drag";
      setHint(false);
      sounds.unlock();
    };
    const move = (e: PointerEvent) => {
      if (p.state !== "drag" || e.pointerId !== pointerId) return;
      const q = pos(e);
      let dx = q.x - anchor.x, dy = q.y - anchor.y;
      const len = Math.hypot(dx, dy);
      if (len > maxPull()) {
        dx = (dx / len) * maxPull();
        dy = (dy / len) * maxPull();
      }
      p.x = anchor.x + dx;
      p.y = anchor.y + dy;
    };
    const up = (e: PointerEvent) => {
      if (p.state !== "drag" || e.pointerId !== pointerId) return;
      pointerId = null;
      const dx = anchor.x - p.x, dy = anchor.y - p.y;
      if (Math.hypot(dx, dy) < maxPull() * 0.12) {
        resetSnap();
        return;
      }
      p.vx = dx * power();
      p.vy = dy * power();
      p.vr = p.vx / W * 9;
      p.squash = 0.7;
      p.state = "fly";
      sounds.tick();
    };
    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", up);

    // ---- simulation
    const rimL = () => ({ x: bucket.x - bucket.w / 2, y: bucket.y });
    const rimR = () => ({ x: bucket.x + bucket.w / 2, y: bucket.y });

    const step = (dt: number) => {
      bucket.wobble *= Math.pow(0.02, dt);
      if (p.state === "fly") {
        const prevY = p.y;
        p.vy += gravity() * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.vr * dt * 6;
        p.squash += (1 - p.squash) * Math.min(1, dt * 10);
        const r = radius();

        // rim collisions
        for (const rim of [rimL(), rimR()]) {
          const dx = p.x - rim.x, dy = p.y - rim.y;
          const d = Math.hypot(dx, dy);
          if (d < r && d > 0) {
            const nx = dx / d, ny = dy / d;
            const dot = p.vx * nx + p.vy * ny;
            if (dot < 0) {
              p.vx -= 1.6 * dot * nx;
              p.vy -= 1.6 * dot * ny;
              p.vx *= 0.7;
              p.vy *= 0.7;
              bucket.wobble = 1;
              sounds.tap();
            }
            p.x = rim.x + nx * r;
            p.y = rim.y + ny * r;
          }
        }

        // scored: crossed the rim line going down, inside the opening
        const inside = p.x > rimL().x + r * 0.35 && p.x < rimR().x - r * 0.35;
        if (prevY < bucket.y && p.y >= bucket.y && p.vy > 0 && inside) {
          p.state = "scored";
          p.t = 0;
          streak += 1;
          localScore += streak >= 3 ? 2 : 1;
          setScore(localScore);
          setBest((b) => {
            const nb = Math.max(b, localScore);
            try {
              localStorage.setItem("mesticker-toss-best", String(nb));
            } catch {}
            return nb;
          });
          bucket.wobble = 1.4;
          burst(bucket.x, bucket.y);
          popups.push({ x: bucket.x, y: bucket.y - S * 0.6, text: streak >= 3 ? `🔥 ${streak} in a row! +2` : `${CHEERS[Math.floor(Math.random() * CHEERS.length)]} +1`, life: 1 });
          sounds.success();
        }

        // ground
        if (p.y > ground() - r) {
          p.y = ground() - r;
          p.vy *= -0.42;
          p.vx *= 0.75;
          p.vr *= 0.6;
          if (Math.abs(p.vy) < H * 0.12) {
            p.state = "rest";
            p.t = 0;
            if (streak > 0) popups.push({ x: p.x, y: p.y - S, text: "So close!", life: 1 });
            streak = 0;
          }
        }
        if (p.x < -S * 2 || p.x > W + S * 2) {
          p.state = "rest";
          p.t = 0.5;
          streak = 0;
        }
      } else if (p.state === "scored") {
        p.t += dt;
        // slide into the bucket
        p.x += (bucket.x - p.x) * Math.min(1, dt * 8);
        p.y += (bucket.y + bucket.h * 0.25 - p.y) * Math.min(1, dt * 8);
        p.rot *= 0.9;
        if (p.t > 1) {
          placeBucket();
          resetSnap();
        }
      } else if (p.state === "rest") {
        p.t += dt;
        p.vx *= 0.9;
        p.x += p.vx * dt;
        if (p.t > 0.8) resetSnap();
      }

      for (const q of particles) {
        q.vy += gravity() * 0.5 * dt;
        q.x += q.vx * dt;
        q.y += q.vy * dt;
        q.rot += dt * 8;
        q.life -= dt * 0.8;
      }
      particles = particles.filter((q) => q.life > 0);
      for (const q of popups) {
        q.y -= H * 0.12 * dt;
        q.life -= dt * 0.7;
      }
      popups = popups.filter((q) => q.life > 0);
    };

    // ---- drawing
    const drawSnap = (x: number, y: number, rot: number, squash: number, alpha = 1) => {
      if (!img.complete) return;
      const h = S, w = (S * 571) / 900;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(x, y);
      ctx.rotate(rot);
      ctx.scale(2 - squash, squash);
      ctx.drawImage(img, -w / 2, -h / 2, w, h);
      ctx.restore();
    };

    const drawSlingshot = (front: boolean) => {
      const fork = S * 0.42;
      const base = { x: anchor.x, y: ground() };
      const tipL = { x: anchor.x - fork, y: anchor.y - S * 0.1 };
      const tipR = { x: anchor.x + fork, y: anchor.y - S * 0.1 };
      ctx.lineCap = "round";
      if (!front) {
        ctx.strokeStyle = "#5b3fd6";
        ctx.lineWidth = S * 0.13;
        ctx.beginPath();
        ctx.moveTo(base.x, base.y);
        ctx.lineTo(anchor.x, anchor.y + S * 0.45);
        ctx.lineTo(tipL.x, tipL.y);
        ctx.moveTo(anchor.x, anchor.y + S * 0.45);
        ctx.lineTo(tipR.x, tipR.y);
        ctx.stroke();
      }
      if (p.state === "drag" || p.state === "ready") {
        ctx.strokeStyle = front ? "#ff6b9d" : "#e35a8a";
        ctx.lineWidth = S * 0.06;
        ctx.beginPath();
        const tip = front ? tipL : tipR;
        ctx.moveTo(tip.x, tip.y);
        ctx.lineTo(p.x, p.y + S * 0.1);
        ctx.stroke();
      }
    };

    const drawBucket = (front: boolean) => {
      const { x, y, w, h } = bucket;
      const wob = Math.sin(performance.now() / 50) * bucket.wobble * S * 0.04;
      ctx.save();
      ctx.translate(x + wob, y);
      if (!front) {
        // inside back wall
        ctx.fillStyle = "#4b33b8";
        ctx.beginPath();
        ctx.ellipse(0, 0, w / 2, w * 0.14, 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        const g = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
        g.addColorStop(0, "#7c5cfc");
        g.addColorStop(1, "#ff6b9d");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(-w / 2, 0);
        ctx.lineTo(-w * 0.38, h);
        ctx.quadraticCurveTo(0, h + w * 0.1, w * 0.38, h);
        ctx.lineTo(w / 2, 0);
        ctx.ellipse(0, 0, w / 2, w * 0.14, 0, 0, Math.PI, false);
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.9)";
        ctx.lineWidth = S * 0.05;
        ctx.beginPath();
        ctx.ellipse(0, 0, w / 2, w * 0.14, 0, 0, Math.PI, false);
        ctx.stroke();
        ctx.fillStyle = "#fff";
        ctx.font = `700 ${S * 0.26}px Fredoka, sans-serif`;
        ctx.textAlign = "center";
        ctx.fillText("★", 0, h * 0.62);
      }
      ctx.restore();
    };

    const drawTrajectory = () => {
      if (p.state !== "drag") return;
      let x = p.x, y = p.y;
      const vx = (anchor.x - p.x) * power();
      let vy = (anchor.y - p.y) * power();
      ctx.fillStyle = "rgba(124,92,252,0.55)";
      for (let i = 0; i < 16; i++) {
        for (let k = 0; k < 4; k++) {
          vy += gravity() * 0.012;
          x += vx * 0.012;
          y += vy * 0.012;
        }
        if (y > ground()) break;
        ctx.beginPath();
        ctx.arc(x, y, S * 0.045 * (1 - i / 22), 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const draw = () => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      // ground
      const g = ctx.createLinearGradient(0, ground() - 10, 0, H);
      g.addColorStop(0, "#e4dcff");
      g.addColorStop(1, "#d3c6ff");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.roundRect(-20, ground(), W + 40, H, 24);
      ctx.fill();
      // pedestal so the bucket never floats
      const footY = bucket.y + bucket.h;
      if (ground() - footY > 4) {
        ctx.fillStyle = "#c9bbff";
        ctx.beginPath();
        ctx.roundRect(bucket.x - S * 0.09, footY - 2, S * 0.18, ground() - footY + 4, S * 0.04);
        ctx.fill();
        ctx.fillStyle = "#b3a1ff";
        ctx.beginPath();
        ctx.ellipse(bucket.x, ground(), S * 0.34, S * 0.07, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      // bucket shadow
      ctx.fillStyle = "rgba(91,63,214,0.12)";
      ctx.beginPath();
      ctx.ellipse(bucket.x, ground() + 4, bucket.w * 0.55, bucket.w * 0.08, 0, 0, Math.PI * 2);
      ctx.fill();

      drawTrajectory();
      drawSlingshot(false);
      drawBucket(false);
      if (p.state === "scored") drawSnap(p.x, p.y, p.rot, p.squash, Math.max(0, 1 - p.t * 1.2));
      drawBucket(true);
      if (p.state !== "scored") drawSnap(p.x, p.y, p.rot, p.squash, p.state === "rest" ? Math.max(0, 1 - p.t / 0.8) : 1);
      drawSlingshot(true);

      for (const q of particles) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, q.life);
        ctx.translate(q.x, q.y);
        ctx.rotate(q.rot);
        ctx.fillStyle = q.color;
        ctx.fillRect(-q.size / 2, -q.size / 3, q.size, q.size * 0.66);
        ctx.restore();
      }
      for (const q of popups) {
        ctx.save();
        ctx.globalAlpha = Math.min(1, q.life * 2);
        ctx.font = `700 ${S * 0.3}px Fredoka, sans-serif`;
        ctx.textAlign = "center";
        ctx.lineWidth = S * 0.08;
        ctx.strokeStyle = "#fff";
        ctx.strokeText(q.text, q.x, q.y);
        ctx.fillStyle = "#7c5cfc";
        ctx.fillText(q.text, q.x, q.y);
        ctx.restore();
      }
    };

    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      step(dt);
      draw();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointercancel", up);
    };
  }, []);

  return (
    <div ref={wrapRef} className="relative h-full w-full overflow-hidden">
      <canvas ref={canvasRef} className="absolute inset-0 touch-none" />
      <div className="pointer-events-none absolute right-0 top-0 flex" style={{ gap: u(1), padding: u(1.5) }}>
        <span className="chip whitespace-nowrap bg-[var(--purple)] text-white">Score {score}</span>
        <span className="chip whitespace-nowrap bg-white text-[var(--ink)]">Best {best}</span>
      </div>
      <AnimatePresence>
        {hint && (
          <motion.div
            className="t-h3 pointer-events-none absolute left-[8%] top-[8%] card"
            style={{ padding: "0.5em 0.9em" }}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: [0, -6, 0] }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ y: { duration: 1.4, repeat: Infinity } }}
          >
            👆 Pull Snap back &amp; let go!
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
