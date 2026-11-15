// Renders the hero picture of the start page (src/assets/smithy-1536.webp and smithy-960.webp) from the
// owner's pixel art src/assets/smithy-source.webp: blurred a little, as much as the picture of the closing
// block (closing-smithy.webp) looks on the page, so both read as the same backdrop.
// Run in services/stats: node scripts/hero-smithy.mjs
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

// sharp is no direct dependency; Next brings it along.
const require = createRequire(import.meta.url);
const sharp = createRequire(require.resolve("next/package.json"))("sharp");

sharp.cache(false);
const assets = fileURLToPath(new URL("../src/assets/", import.meta.url));

/** Blur at the full width of 1536px; the page shows the picture at about 0.6 of it. */
const SIGMA = 3.8;
const WIDTHS = [1536, 960];

for (const width of WIDTHS) {
  const info = await sharp(`${assets}smithy-source.webp`)
    .blur(SIGMA)
    .resize({ width })
    .webp({ quality: 82 })
    .toFile(`${assets}smithy-${width}.webp`);
  console.log(`smithy-${width}.webp  ${info.width} x ${info.height}  ${Math.round(info.size / 1024)} KB`);
}
