import sharp from "sharp";

/**
 * Clean a sticker for the cutter: AI images leave faint haze and tiny specks
 * around the border, and a traced cut path would cut each speck as its own
 * sticker (messy, and paper bits can jam). Drops near-invisible alpha and any
 * blob smaller than 0.3% of the sticker. Real detached bits (music notes,
 * hearts) are far bigger and stay. Returns { png, removed }.
 */
export async function cleanStickerBuffer(input) {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height, C = info.channels;
  const solid = (i) => data[i * C + 3] > 48;
  const label = new Int32Array(W * H).fill(-1);
  const sizes = [];
  for (let i = 0; i < W * H; i++) {
    if (label[i] !== -1 || !solid(i)) continue;
    const id = sizes.length, stack = [i];
    let n = 0;
    label[i] = id;
    while (stack.length) {
      const p = stack.pop();
      n++;
      const x = p % W, y = (p / W) | 0;
      for (const q of [x > 0 ? p - 1 : -1, x < W - 1 ? p + 1 : -1, y > 0 ? p - W : -1, y < H - 1 ? p + W : -1]) {
        if (q >= 0 && label[q] === -1 && solid(q)) {
          label[q] = id;
          stack.push(q);
        }
      }
    }
    sizes.push(n);
  }
  const min = Math.max(200, Math.max(0, ...sizes) * 0.003);
  let removed = 0;
  sizes.forEach((s) => s < min && removed++);
  for (let i = 0; i < W * H; i++) {
    const l = label[i];
    if (l === -1 || sizes[l] < min) data[i * C + 3] = 0;
  }
  const png = await sharp(data, { raw: { width: W, height: H, channels: C } }).png().toBuffer();
  return { png, removed };
}
