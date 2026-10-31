/** Tiny synthesized booth sounds — no audio files to load. */

let ctx: AudioContext | null = null;

function audio() {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

function tone(freq: number, ms: number, type: OscillatorType = "sine", gain = 0.18, delay = 0) {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + delay / 1000;
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000);
  osc.connect(g).connect(a.destination);
  osc.start(t);
  osc.stop(t + ms / 1000 + 0.02);
}

export const sounds = {
  /** Call on the first tap so later sounds are allowed to play. */
  unlock: () => void audio(),
  tap: () => tone(660, 70, "triangle", 0.12),
  tick: () => tone(880, 120, "sine", 0.2),
  shutter: () => {
    const a = audio();
    if (!a) return;
    const len = a.sampleRate * 0.12;
    const buf = a.createBuffer(1, len, a.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    const src = a.createBufferSource();
    const g = a.createGain();
    g.gain.value = 0.5;
    src.buffer = buf;
    src.connect(g).connect(a.destination);
    src.start();
  },
  success: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 160, "triangle", 0.16, i * 90)),
};
