"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, useAnimate } from "framer-motion";
import { sounds } from "@/lib/booth-sounds";
import type { MascotMood } from "../mascot";
import SnapRig, { type Expression } from "../snap-rig";
import GloveHand from "../glove-hand";
import { u } from "../units";
import SpeechBubble from "./speech-bubble";

type Mark = "X" | "O" | null;
type Result = { who: "X" | "O" | "draw"; line: number[] | null } | null;
type Pt = { x: number; y: number };

const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

const THINKING = ["Hmm… 🤔", "Let me think…", "Ooh, tricky!", "I see you…"];
const NUDGES = ["Your turn! Tap a square 👇", "Go on, tap one!", "Your move! 😄"];
const SNAP_WINS = ["Gotcha! 📸", "Snap wins! 😎", "Say cheese! 🧀"];
const YOU_WIN = ["No way! 😵", "You got me!", "Rematch!! 😤"];
const DRAWS = ["Tie! Again? 🤝", "Even steven!"];

function judge(b: Mark[]): Result {
  for (const line of LINES) {
    const [a, c, d] = line;
    if (b[a] && b[a] === b[c] && b[a] === b[d]) return { who: b[a] as "X" | "O", line };
  }
  return b.every(Boolean) ? { who: "draw", line: null } : null;
}

/** Beatable AI: wins if it can, usually blocks, likes the center. */
function bestMove(b: Mark[], me: "X" | "O", sloppy: number): number {
  const them = me === "O" ? "X" : "O";
  const empty = b.flatMap((m, i) => (m ? [] : [i]));
  const finishing = (who: Mark) =>
    empty.find((i) => {
      const t = [...b];
      t[i] = who;
      return judge(t)?.who === who;
    });
  const win = finishing(me);
  if (win !== undefined) return win;
  const block = finishing(them);
  if (block !== undefined && Math.random() > sloppy * 0.5) return block;
  if (Math.random() < sloppy) return pick(empty);
  if (!b[4]) return 4;
  const corners = [0, 2, 6, 8].filter((i) => !b[i]);
  return corners.length ? pick(corners) : pick(empty);
}

function XMark() {
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full">
      <defs>
        <linearGradient id="xg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#7c5cfc" />
          <stop offset="1" stopColor="#ff6b9d" />
        </linearGradient>
      </defs>
      {["M28 28 L72 72", "M72 28 L28 72"].map((d, i) => (
        <motion.path
          key={d}
          d={d}
          stroke="url(#xg)"
          strokeWidth="14"
          strokeLinecap="round"
          fill="none"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.22, delay: i * 0.16, ease: "easeOut" }}
        />
      ))}
    </svg>
  );
}

function OMark() {
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
      <motion.circle
        cx="50"
        cy="50"
        r="24"
        stroke="#ff9f43"
        strokeWidth="14"
        strokeLinecap="round"
        fill="none"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.45, ease: "easeInOut" }}
      />
    </svg>
  );
}

const center = (i: number) => [(i % 3) * 100 + 50, Math.floor(i / 3) * 100 + 50];

export default function TicTacToe() {
  const [board, setBoard] = useState<Mark[]>(Array(9).fill(null));
  const [turn, setTurn] = useState<"you" | "snap" | "over">("snap");
  const [result, setResult] = useState<Result>(null);
  const [score, setScore] = useState({ you: 0, snap: 0 });
  const [bubble, setBubble] = useState("I'll go first! 😎");
  const [mood, setMood] = useState<MascotMood>("idle");
  const [face, setFace] = useState<Expression>("grin");
  const [look, setLook] = useState<Pt>({ x: 0.6, y: 0.2 });
  const [cheer, setCheer] = useState(0);
  const [round, setRound] = useState(0);

  const rootRef = useRef<HTMLDivElement>(null);
  const snapRef = useRef<HTMLDivElement>(null);
  const cellRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [gloveScope, animateGlove] = useAnimate<HTMLDivElement>();
  const [gloveSize, setGloveSize] = useState(80);
  const nudging = useRef(false);

  // ---- geometry helpers (all relative to the game root)
  const rel = (el: Element | null): Pt & { w: number; h: number } => {
    const root = rootRef.current!.getBoundingClientRect();
    const r = el!.getBoundingClientRect();
    return { x: r.left - root.left + r.width / 2, y: r.top - root.top + r.height / 2, w: r.width, h: r.height };
  };
  const snapHand = (): Pt => {
    const s = rel(snapRef.current);
    return { x: s.x + s.w * 0.45, y: s.y + s.h * 0.05 };
  };
  const lookAt = (target: Pt) => {
    const s = rel(snapRef.current);
    const fx = s.x + s.w * 0.08, fy = s.y - s.h * 0.2; // face
    const dx = target.x - fx, dy = target.y - fy;
    const len = Math.max(1, Math.hypot(dx, dy));
    setLook({ x: dx / len, y: Math.max(-0.6, Math.min(1, dy / len)) });
  };
  const tip = (g: number) => ({ x: g * 0.38, y: g * 1.2 * 0.04 });
  const angleTo = (from: Pt, to: Pt) => (Math.atan2(to.x - from.x, -(to.y - from.y)) * 180) / Math.PI;

  // glove scales with the board
  useEffect(() => {
    const measure = () => {
      const c = cellRefs.current[0];
      if (c) setGloveSize(c.getBoundingClientRect().width * 0.8);
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (rootRef.current) ro.observe(rootRef.current);
    return () => ro.disconnect();
  }, []);

  const finish = useCallback((r: Result) => {
    if (!r) return false;
    setResult(r);
    setTurn("over");
    if (r.who === "X") {
      setScore((s) => ({ ...s, you: s.you + 1 }));
      setBubble(pick(YOU_WIN));
      setMood("sad");
      setFace("sad");
      sounds.success();
    } else if (r.who === "O") {
      setScore((s) => ({ ...s, snap: s.snap + 1 }));
      setBubble(pick(SNAP_WINS));
      setMood("excited");
      setFace("happy");
      setCheer((c) => c + 1);
    } else {
      setBubble(pick(DRAWS));
      setMood("idle");
      setFace("surprised");
    }
    return true;
  }, []);

  // ---- Snap's turn: think, reach over with the glove, tap, retreat
  useEffect(() => {
    if (turn !== "snap" || !rootRef.current) return;
    let cancelled = false;
    (async () => {
      setMood("thinking");
      setFace("thinking");
      setBubble(board.every((m) => !m) ? "I'll go first! 😎" : pick(THINKING));
      const move = bestMove(board, "O", 0.3);
      const cell = rel(cellRefs.current[move]);
      // eyes dart around, then settle on the chosen square
      lookAt({ x: cell.x + (Math.random() - 0.5) * cell.w * 3, y: cell.y - cell.h });
      await wait(700);
      if (cancelled) return;
      lookAt(cell);
      await wait(500);
      if (cancelled || !gloveScope.current) return;

      const g = gloveSize;
      const t = tip(g);
      const home = snapHand();
      const rot = angleTo(home, cell);
      setFace("grin");
      await animateGlove(gloveScope.current, { x: home.x - t.x, y: home.y - t.y, rotate: rot, opacity: 0, scale: 0.6 }, { duration: 0 });
      await animateGlove(gloveScope.current, { x: cell.x - t.x, y: cell.y - t.y, opacity: 1, scale: 1 }, { duration: 0.6, ease: [0.3, 0.9, 0.4, 1] });
      if (cancelled) return;
      await animateGlove(gloveScope.current, { scale: 0.82 }, { duration: 0.09 });
      const next = [...board];
      next[move] = "O";
      sounds.tap();
      setBoard(next);
      await animateGlove(gloveScope.current, { scale: 1 }, { duration: 0.12 });
      animateGlove(gloveScope.current, { x: home.x - t.x, y: home.y - t.y, opacity: 0, scale: 0.6 }, { duration: 0.4, ease: "easeIn" });
      if (cancelled) return;
      if (!finish(judge(next))) {
        setTurn("you");
        setMood("idle");
        setFace("smile");
        setBubble("Your turn!");
      }
    })();
    return () => {
      cancelled = true;
    };
    // board is frozen while it's Snap's turn
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turn, round]);

  // ---- nudge: if you dawdle, the glove points at a good square
  useEffect(() => {
    if (turn !== "you") return;
    let cancelled = false;
    const id = setTimeout(async () => {
      if (cancelled || !gloveScope.current) return;
      nudging.current = true;
      const hintIdx = bestMove(board, "X", 0);
      const cell = rel(cellRefs.current[hintIdx]);
      const g = gloveSize;
      const t = tip(g);
      // fingertip on the square, hand resting toward the middle of the board
      const mid = rel(cellRefs.current[4]);
      const target = { x: cell.x, y: cell.y + cell.h * 0.1 };
      const rot = hintIdx === 4 ? -35 : angleTo(mid, cell);
      const back = { x: Math.sin((rot * Math.PI) / 180) * -g * 0.9, y: Math.cos((rot * Math.PI) / 180) * g * 0.9 };
      setBubble(pick(NUDGES));
      setFace("grin");
      lookAt(cell);
      await animateGlove(gloveScope.current, { x: target.x - t.x + back.x, y: target.y - t.y + back.y, rotate: rot, opacity: 0, scale: 0.7 }, { duration: 0 });
      if (cancelled || !nudging.current) return;
      await animateGlove(gloveScope.current, { x: target.x - t.x, y: target.y - t.y, opacity: 1, scale: 1 }, { duration: 0.45, ease: "easeOut" });
      if (cancelled || !nudging.current) return;
      animateGlove(
        gloveScope.current,
        { x: [target.x - t.x, target.x - t.x + back.x * 0.15, target.x - t.x], y: [target.y - t.y, target.y - t.y + back.y * 0.15, target.y - t.y], scale: [1, 0.9, 1] },
        { duration: 0.7, repeat: Infinity, ease: "easeInOut" }
      );
    }, 2200);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turn, board]);

  const hideGlove = () => {
    nudging.current = false;
    if (gloveScope.current) animateGlove(gloveScope.current, { opacity: 0, scale: 0.6 }, { duration: 0.15 });
  };

  // ---- next round: Snap always opens
  useEffect(() => {
    if (turn !== "over") return;
    const id = setTimeout(() => {
      setBoard(Array(9).fill(null));
      setResult(null);
      setMood("idle");
      setFace("grin");
      setRound((r) => r + 1);
      setTurn("snap");
    }, 2600);
    return () => clearTimeout(id);
  }, [turn]);

  const play = (i: number) => {
    if (turn !== "you" || board[i]) return;
    hideGlove();
    sounds.tap();
    lookAt(rel(cellRefs.current[i]));
    const next = [...board];
    next[i] = "X";
    setBoard(next);
    // did you just block Snap?
    const asSnap = [...board];
    asSnap[i] = "O";
    const snapCouldWin = judge(asSnap)?.who === "O";
    if (!finish(judge(next))) {
      if (snapCouldWin) {
        setFace("surprised");
        setBubble("Hey! I was gonna go there! 😮");
      }
      setTurn("snap");
    }
  };

  const line = result?.line;

  return (
    <div ref={rootRef} className="relative flex h-full w-full items-center justify-center landscape:flex-row portrait:flex-col" style={{ gap: u(3), padding: u(2) }}>
      {/* Snap + bubble + score: a column beside the board, or a row above it in portrait */}
      <div className="flex shrink-0 items-center landscape:w-[30%] landscape:flex-col short:w-[26%] portrait:w-full portrait:justify-center" style={{ gap: u(1) }}>
        <div className="flex flex-col items-center portrait:order-2 portrait:items-start" style={{ gap: u(1) }}>
          <SpeechBubble text={bubble} />
          <div className="flex landscape:hidden" style={{ gap: u(1) }}>
            <span className="chip whitespace-nowrap bg-[var(--purple)] text-white">You {score.you}</span>
            <span className="chip whitespace-nowrap bg-[var(--orange)] text-white">Snap {score.snap}</span>
          </div>
        </div>
        <div ref={snapRef}>
          <SnapRig mood={mood} expression={face} look={look} cheerKey={cheer} className="h-[34vh] short:h-[26vh] portrait:h-[17vh]" />
        </div>
        <div className="flex portrait:hidden" style={{ gap: u(1) }}>
          <span className="chip whitespace-nowrap bg-[var(--purple)] text-white">You {score.you}</span>
          <span className="chip whitespace-nowrap bg-[var(--orange)] text-white">Snap {score.snap}</span>
        </div>
      </div>

      {/* Board: always a square that fits the space left */}
      <div className="flex min-h-0 min-w-0 flex-1 items-center justify-center self-stretch" style={{ containerType: "size" }}>
        <div
          className="relative grid grid-cols-3 grid-rows-3"
          style={{ width: "min(100cqw, 100cqh)", height: "min(100cqw, 100cqh)", gap: u(1) }}
        >
          {board.map((m, i) => (
            <motion.button
              key={i}
              ref={(el) => {
                cellRefs.current[i] = el;
              }}
              className="card relative flex items-center justify-center"
              style={{ padding: u(0.6), borderRadius: u(1.6) }}
              whileTap={turn === "you" && !m ? { scale: 0.9 } : undefined}
              animate={line?.includes(i) ? { scale: [1, 1.12, 1], backgroundColor: result?.who === "X" ? "#efe9ff" : "#fff1e0" } : { scale: 1, backgroundColor: "#ffffff" }}
              transition={{ duration: 0.4 }}
              onClick={() => play(i)}
            >
              {m === "X" && <XMark />}
              {m === "O" && <OMark />}
            </motion.button>
          ))}
          {line && (
            <svg viewBox="0 0 300 300" className="pointer-events-none absolute inset-0 h-full w-full">
              <motion.line
                x1={center(line[0])[0]}
                y1={center(line[0])[1]}
                x2={center(line[2])[0]}
                y2={center(line[2])[1]}
                stroke={result?.who === "X" ? "#7c5cfc" : "#ff9f43"}
                strokeWidth="10"
                strokeLinecap="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
              />
            </svg>
          )}
        </div>
      </div>

      {/* Snap's glove: fingertip is the transform origin so it can aim anywhere */}
      <div
        ref={gloveScope}
        className="pointer-events-none absolute left-0 top-0 z-20 drop-shadow-[0_8px_10px_rgba(26,26,46,0.25)]"
        style={{ width: gloveSize, height: gloveSize * 1.2, opacity: 0, transformOrigin: `${gloveSize * 0.38}px ${gloveSize * 0.048}px` }}
      >
        <GloveHand className="h-full w-full" />
      </div>
    </div>
  );
}
