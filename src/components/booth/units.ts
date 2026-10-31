/** Size in booth units (see --u in booth.css): scales with the screen. */
export const u = (n: number) => `calc(var(--u) * ${n})`;
