"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { sounds } from "@/lib/booth-sounds";
import Mascot, { type MascotMood } from "../mascot";
import { u } from "../units";
import SpeechBubble from "./speech-bubble";

type Mark = "X" | "O" | null;
type Result = { who: "X" | "O" | "draw"; line: number[] | null } | null;

const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

const THINKING = ["Hmm… 🤔", "Let me think…", "Ooh, tricky!", "I see you…"];
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
function snapMove(b: Mark[]): number {
  const empty = b.flatMap((m, i) => (m ? [] : [i]));
  const finishing = (who: Mark) =>
    empty.find((i) => {
      const t = [...b];
      t[i] = who;
      return judge(t)?.who === who;
    });
  const win = finishing("O");
  if (win !== undefined) return win;
  const block = finishing("X");
  if (block !== undefined && Math.random() < 0.85) return block;
  if (Math.random() < 0.3) return pick(empty);
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
  const [turn, setTurn] = useState<"you" | "snap" | "over">("you");
  const [result, setResult] = useState<Result>(null);
  const [score, setScore] = useState({ you: 0, snap: 0 });
  const [bubble, setBubble] = useState("Wanna play? You go first!");
  const [mood, setMood] = useState<MascotMood>("idle");
  const [youStart, setYouStart] = useState(true);

  const finish = useCallback((r: Result) => {
    if (!r) return false;
    setResult(r);
    setTurn("over");
    if (r.who === "X") {
      setScore((s) => ({ ...s, you: s.you + 1 }));
      setBubble(pick(YOU_WIN));
      setMood("sad");
      sounds.success();
    } else if (r.who === "O") {
      setScore((s) => ({ ...s, snap: s.snap + 1 }));
      setBubble(pick(SNAP_WINS));
      setMood("excited");
    } else {
      setBubble(pick(DRAWS));
      setMood("idle");
    }
    return true;
  }, []);

  // Snap's turn
  useEffect(() => {
    if (turn !== "snap") return;
    setMood("thinking");
    setBubble(pick(THINKING));
    const id = setTimeout(() => {
      const next = [...board];
      next[snapMove(board)] = "O";
      sounds.tap();
      setBoard(next);
      if (!finish(judge(next))) {
        setTurn("you");
        setMood("idle");
        setBubble("Your turn!");
      }
    }, 650 + Math.random() * 550);
    return () => clearTimeout(id);
    // board is frozen while it's Snap's turn
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turn, finish]);

  // Next round
  useEffect(() => {
    if (turn !== "over") return;
    const id = setTimeout(() => {
      const nextYouStart = !youStart;
      setYouStart(nextYouStart);
      setBoard(Array(9).fill(null));
      setResult(null);
      setMood("idle");
      setBubble(nextYouStart ? "Your move!" : "My turn first!");
      setTurn(nextYouStart ? "you" : "snap");
    }, 2300);
    return () => clearTimeout(id);
  }, [turn, youStart]);

  const play = (i: number) => {
    if (turn !== "you" || board[i]) return;
    sounds.tap();
    const next = [...board];
    next[i] = "X";
    setBoard(next);
    if (!finish(judge(next))) setTurn("snap");
  };

  const line = result?.line;

  return (
    <div className="flex h-full w-full items-center justify-center landscape:flex-row portrait:flex-col" style={{ gap: u(3), padding: u(2) }}>
      {/* Snap + bubble + score: a column beside the board, or a row above it in portrait */}
      <div className="flex shrink-0 items-center landscape:w-[30%] landscape:flex-col short:w-[26%] portrait:w-full portrait:justify-center" style={{ gap: u(1) }}>
        <div className="flex flex-col items-center portrait:order-2 portrait:items-start" style={{ gap: u(1) }}>
          <SpeechBubble text={bubble} />
          <div className="flex landscape:hidden" style={{ gap: u(1) }}>
            <span className="chip whitespace-nowrap bg-[var(--purple)] text-white">You {score.you}</span>
            <span className="chip whitespace-nowrap bg-[var(--orange)] text-white">Snap {score.snap}</span>
          </div>
        </div>
        <Mascot mood={mood} className="h-[34vh] short:h-[26vh] portrait:h-[17vh]" />
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
    </div>
  );
}
