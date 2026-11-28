"use client";

import { useState } from "react";
import { CarolGames } from "@/components/booth/games/carol-games";

const STICKERS = ["/events/carol/host-left.webp", "/events/carol/host-right.webp", "/events/carol/host-santa.webp", "/events/carol/host-middle.webp"];
const HERO = "/events/carol/host-middle.webp";
const HOSTS = [
  { name: "Fred", img: "/events/carol/host-left.webp" },
  { name: "Augustine", img: "/events/carol/host-middle.webp" },
  { name: "Alex", img: "/events/carol/host-right.webp" },
];

export default function GamesLabClient({ durationMs }: { durationMs?: number }) {
  const [run, setRun] = useState(0);
  const [done, setDone] = useState(false);
  if (done) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4" data-testid="lab-done">
        <div className="t-h2">onDone fired ✓</div>
        <button
          type="button"
          className="btn btn-main"
          onClick={() => {
            setDone(false);
            setRun((r) => r + 1);
          }}
        >
          Play again
        </button>
      </div>
    );
  }
  return <CarolGames key={run} stickers={STICKERS} hero={HERO} hosts={HOSTS} name="Sam" durationMs={durationMs} onDone={() => setDone(true)} />;
}
