import sharp from "sharp";
const [,, src, out] = process.argv;
const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
for (let i = 0; i < data.length; i += 4) {
  const r = data[i], g = data[i + 1], b = data[i + 2];
  const m = Math.min(r, b) - g;
  const a = 1 - sm(40, 190, m);
  if (a <= 0.001) { data[i + 3] = 0; continue; }
  // Un-blend the magenta from edge pixels.
  const un = (c, k) => Math.max(0, Math.min(255, (c - (1 - a) * k) / a));
  data[i] = un(r, 255); data[i + 1] = un(g, 0); data[i + 2] = un(b, 255);
  // Kill residual spill: no pixel in the hand should be more magenta than grey.
  const mx = Math.max(data[i + 1], Math.min(data[i], data[i + 2]));
  if (Math.min(data[i], data[i + 2]) > data[i + 1]) { data[i] = Math.min(data[i], mx); data[i + 2] = Math.min(data[i + 2], mx); }
  data[i + 3] = Math.round(a * 255);
}
await sharp(data, { raw: info }).png().toFile(out);
console.log(info.width, info.height);
