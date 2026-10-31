"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import ImageRevealSlider from "@/components/image-reveal";

/**
 * The web app's before/after reveal slider, sized to fill whatever square
 * fits the booth panel, with a pop-in burst like the web app's sticker reveal.
 */
export default function BoothReveal({ photo, sticker }: { photo: string | null; sticker: string }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [side, setSide] = useState(0);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const measure = () => setSide(Math.floor(Math.min(el.clientWidth, el.clientHeight) * 0.94));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={boxRef} className="relative flex h-full w-full items-center justify-center">
      {[...Array(10)].map((_, i) => (
        <motion.div
          key={i}
          className="pointer-events-none absolute h-4 w-4 rounded-full"
          style={{ background: ["#7C5CFC", "#FF6B9D", "#FF9F43", "#45E3FF", "#FECA57", "#2ED573"][i % 6] }}
          initial={{ scale: 0, x: 0, y: 0, opacity: 1 }}
          animate={{
            scale: [0, 1.6, 0],
            x: Math.cos((i * 36 * Math.PI) / 180) * side * 0.6,
            y: Math.sin((i * 36 * Math.PI) / 180) * side * 0.6,
            opacity: [1, 1, 0],
          }}
          transition={{ duration: 0.9, delay: 0.2 + i * 0.04, ease: "easeOut" }}
        />
      ))}
      {side > 0 && (
        <motion.div
          style={{ width: side }}
          initial={{ scale: 0.3, rotate: -12, opacity: 0 }}
          animate={{ scale: 1, rotate: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 180, damping: 14 }}
        >
          {photo ? (
            <ImageRevealSlider beforeSrc={photo} afterSrc={sticker} altBefore="You" altAfter="Sticker" height={side} className="!rounded-[28px] border-[6px] border-white" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={sticker} alt="Your sticker" className="die-cut w-full" />
          )}
        </motion.div>
      )}
    </div>
  );
}
