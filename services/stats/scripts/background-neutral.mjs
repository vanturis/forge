// Renders src/assets/background-neutral.webp from the owner's picture src/assets/background.webp:
// the blue cast of the dark surfaces is taken out, the orange of the glowing edges stays. The website
// (stage of the start page, closing block) and scripts/og-images.mjs use the gray version only.
// Run in services/stats: node scripts/background-neutral.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

// sharp is no direct dependency; Next brings it along.
const require = createRequire(import.meta.url);
const sharp = createRequire(require.resolve("next/package.json"))("sharp");

sharp.cache(false);
const assets = fileURLToPath(new URL("../src/assets/", import.meta.url));

const smooth = (from, to, x) => {
  const t = Math.min(1, Math.max(0, (x - from) / (to - from)));
  return t * t * (3 - 2 * t);
};

const { data, info } = await sharp(readFileSync(`${assets}background.webp`)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
for (let i = 0; i < data.length; i += 3) {
  const r = data[i];
  const g = data[i + 1];
  const b = data[i + 2];
  const gray = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  // warm pixels (red well above blue: the edges and their haze) keep their colour, everything else turns gray
  const warm = smooth(6, 48, r - b);
  data[i] = Math.round(gray + (r - gray) * warm);
  data[i + 1] = Math.round(gray + (g - gray) * warm);
  data[i + 2] = Math.round(gray + (b - gray) * warm);
}

// Full size at a high quality: a smaller or stronger compressed file shows bands on the dark gradients.
const out = await sharp(data, { raw: { width: info.width, height: info.height, channels: 3 } }).webp({ quality: 95, smartSubsample: true }).toBuffer();
writeFileSync(`${assets}background-neutral.webp`, out);
console.log("background-neutral.webp", info.width, info.height, out.length);
