/**
 * Cartoon white glove in the classic "pointing hand" pose: index finger out
 * on the thumb side, the other three fingers curled. Rotate the wrapper to aim
 * it (never straight up); the fingertip is at (38, 5) of the 100×120 box.
 */
export default function GloveHand({ className, style }: { className?: string; style?: React.CSSProperties }) {
  const ink = "#171523";
  return (
    <svg viewBox="0 0 100 120" className={className} style={style}>
      <g stroke={ink} strokeWidth="3.5" strokeLinejoin="round" strokeLinecap="round" fill="#fff">
        {/* cuff */}
        <path d="M30 92 Q52 85 74 92 L76 111 Q53 119 28 111 Z" />
        <path d="M32 101 Q53 95 73 101" fill="none" strokeWidth="2.5" />
        {/* palm */}
        <path d="M30 58 C24 70 25 84 33 93 L71 93 C79 85 83 72 80 61 C78 53 71 49 62 49 L45 50 C38 51 32 53 30 58 Z" />
        {/* index finger, on the thumb side */}
        <path d="M31 58 L31 15 C31 3 45 3 45 15 L45 53" />
        {/* curled middle, ring and little fingers */}
        <ellipse cx="60" cy="57" rx="12" ry="8.5" />
        <ellipse cx="64" cy="68.5" rx="12" ry="8" />
        <ellipse cx="63" cy="79.5" rx="10.5" ry="7" />
        {/* thumb folded across the front */}
        <path d="M27 67 C33 61 47 60 54 65 C57 70 53 75 46 75 C39 75 32 75 27 72 Z" />
      </g>
      <path d="M34 16 C34 9 37 7 39 7" stroke="#e2ddf3" strokeWidth="3" fill="none" strokeLinecap="round" />
    </svg>
  );
}
