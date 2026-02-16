"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { hapticSuccess } from "@/lib/haptics";

interface ImageRevealSliderProps {
  beforeSrc: string;
  afterSrc: string;
  altBefore?: string;
  altAfter?: string;
  initial?: number;
  height?: number;
  showGlow?: boolean;
  className?: string;
}

export default function ImageRevealSlider({
  beforeSrc,
  afterSrc,
  altBefore = "Original",
  altAfter = "Styled",
  initial = 50,
  height = 420,
  showGlow,
  className,
}: ImageRevealSliderProps) {
  const [position, setPosition] = useState(initial);
  const [isDragging, setIsDragging] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [imagesLoaded, setImagesLoaded] = useState({
    before: false,
    after: false,
  });
  const containerRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(null);
  const hasPlayedHaptic = useRef(false);

  const allImagesLoaded = imagesLoaded.before && imagesLoaded.after;

  // Glow intensity: 0 at 50%, 1 at 100%
  const glowIntensity = showGlow ? Math.max(0, (position - 50) / 50) : 0;

  useEffect(() => {
    const beforeImg = new Image();
    const afterImg = new Image();

    beforeImg.onload = () =>
      setImagesLoaded((prev) => ({ ...prev, before: true }));
    afterImg.onload = () =>
      setImagesLoaded((prev) => ({ ...prev, after: true }));

    beforeImg.src = beforeSrc;
    afterImg.src = afterSrc;
  }, [beforeSrc, afterSrc]);

  // Haptic on first reveal
  useEffect(() => {
    if (showGlow && allImagesLoaded && !hasPlayedHaptic.current) {
      hasPlayedHaptic.current = true;
      hapticSuccess();
    }
  }, [showGlow, allImagesLoaded]);

  const getClipPath = useCallback(() => {
    return `inset(0 ${100 - position}% 0 0)`;
  }, [position]);

  const updatePosition = useCallback((newPosition: number) => {
    const clamped = Math.max(1, Math.min(99, newPosition));
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => setPosition(clamped));
  }, []);

  const getPositionFromEvent = useCallback(
    (clientX: number) => {
      if (!containerRef.current) return position;
      const rect = containerRef.current.getBoundingClientRect();
      return ((clientX - rect.left) / rect.width) * 100;
    },
    [position]
  );

  const animateToPosition = useCallback((target: number) => {
    setIsAnimating(true);
    setPosition(Math.max(1, Math.min(99, target)));
    setTimeout(() => setIsAnimating(false), 300);
  }, []);

  const handleTap = useCallback(
    (clientX: number) => {
      if (isDragging) return;
      const newPos = getPositionFromEvent(clientX);
      const snapPoints = [25, 50, 75];
      const nearest = snapPoints.reduce((prev, curr) =>
        Math.abs(curr - newPos) < Math.abs(prev - newPos) ? curr : prev
      );
      animateToPosition(nearest);
    },
    [isDragging, getPositionFromEvent, animateToPosition]
  );

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (
      e.target === handleRef.current ||
      (e.target as Element).closest("[data-handle]")
    ) {
      setIsDragging(true);
      e.preventDefault();
    }
  }, []);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging) return;
      e.preventDefault();
      updatePosition(getPositionFromEvent(e.clientX));
    },
    [isDragging, getPositionFromEvent, updatePosition]
  );

  const handleMouseUp = useCallback(() => {
    if (isDragging) setIsDragging(false);
  }, [isDragging]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (
      e.target === handleRef.current ||
      (e.target as Element).closest("[data-handle]")
    ) {
      setIsDragging(true);
      e.preventDefault();
    }
  }, []);

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (!isDragging) return;
      e.preventDefault();
      updatePosition(getPositionFromEvent(e.touches[0].clientX));
    },
    [isDragging, getPositionFromEvent, updatePosition]
  );

  const handleTouchEnd = useCallback(() => {
    if (isDragging) setIsDragging(false);
  }, [isDragging]);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.addEventListener("touchmove", handleTouchMove, {
        passive: false,
      });
      document.addEventListener("touchend", handleTouchEnd);

      return () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        document.removeEventListener("touchmove", handleTouchMove);
        document.removeEventListener("touchend", handleTouchEnd);
      };
    }
  }, [
    isDragging,
    handleMouseMove,
    handleMouseUp,
    handleTouchMove,
    handleTouchEnd,
  ]);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  if (!afterSrc) {
    return (
      <div
        className={cn(
          "relative rounded-2xl bg-muted flex items-center justify-center",
          className
        )}
        style={{ height }}
      >
        <p className="text-muted-foreground text-sm">No image yet</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative overflow-hidden rounded-2xl bg-white cursor-pointer select-none transition-shadow duration-300",
        glowIntensity > 0 ? "shadow-glow-lg" : "shadow-lg",
        className
      )}
      style={{
        height,
        boxShadow: glowIntensity > 0
          ? `0 0 ${30 * glowIntensity}px ${10 * glowIntensity}px rgba(124, 92, 252, ${0.3 * glowIntensity}), 0 0 ${60 * glowIntensity}px ${20 * glowIntensity}px rgba(255, 107, 157, ${0.15 * glowIntensity})`
          : undefined,
      }}
      onClick={(e) => handleTap(e.clientX)}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
    >
      {!allImagesLoaded && (
        <div className="absolute inset-0 bg-muted animate-pulse flex items-center justify-center">
          <div className="text-muted-foreground text-sm">
            Loading images...
          </div>
        </div>
      )}

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={beforeSrc}
        alt={altBefore}
        className={cn(
          "absolute inset-0 w-full h-full object-cover",
          !allImagesLoaded && "opacity-0"
        )}
        draggable={false}
      />

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={afterSrc}
        alt={altAfter}
        className={cn(
          "absolute inset-0 w-full h-full object-cover transition-all",
          isAnimating ? "duration-300 ease-in-out" : "duration-0",
          !allImagesLoaded && "opacity-0"
        )}
        style={{
          clipPath: getClipPath(),
          transform: isDragging ? "translateZ(0)" : "none",
        }}
        draggable={false}
      />

      {/* Sticker sheen overlay — visible when sticker side is revealed */}
      {showGlow && glowIntensity > 0 && (
        <div
          className="sticker-sheen absolute inset-0 pointer-events-none"
          style={{
            clipPath: getClipPath(),
            opacity: glowIntensity * 0.6,
          }}
        />
      )}

      {allImagesLoaded && (
        <>
          <div
            className="absolute top-4 left-4 bg-black/50 text-white px-3 py-1 rounded-lg text-sm font-semibold transition-opacity duration-200"
            style={{ opacity: position < 80 ? 1 : 0 }}
          >
            {altBefore}
          </div>
          <div
            className="absolute top-4 right-4 bg-black/50 text-white px-3 py-1 rounded-lg text-sm font-semibold transition-opacity duration-200"
            style={{ opacity: position > 20 ? 1 : 0 }}
          >
            {altAfter}
          </div>

          <div
            className={cn(
              "absolute top-0 bottom-0 w-0.5 bg-white shadow-lg transition-all",
              isAnimating ? "duration-300 ease-in-out" : "duration-0"
            )}
            style={{
              left: `${position}%`,
              transform: "translateX(-50%)",
            }}
          />

          <div
            ref={handleRef}
            data-handle
            role="slider"
            tabIndex={0}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(position)}
            aria-label="Image comparison slider"
            className={cn(
              "absolute w-10 h-10 rounded-full bg-white border-2 border-primary shadow-lg flex items-center justify-center cursor-grab active:cursor-grabbing focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-all",
              isAnimating ? "duration-300 ease-in-out" : "duration-0",
              isDragging && "scale-110 shadow-xl"
            )}
            style={{
              left: `${position}%`,
              top: "50%",
              transform: "translate(-50%, -50%)",
            }}
          >
            <div className="w-1 h-4 bg-primary rounded-full" />
          </div>
        </>
      )}
    </div>
  );
}
