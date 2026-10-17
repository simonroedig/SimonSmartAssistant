// Still copies of the animated weather icons (public/weather/still/): the wall display
// shows them while nobody is using it, so the browser has nothing to redraw.
//   node scripts/still-weather-icons.mjs
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const dir = join(import.meta.dirname, "..", "public", "weather");
const out = join(dir, "still");
mkdirSync(out, { recursive: true });

let count = 0;
for (const file of readdirSync(dir)) {
  if (!file.endsWith(".svg")) continue;
  const svg = readFileSync(join(dir, file), "utf8")
    // <animate …/> and <animate …>…</animate> (also animateTransform): the first frame stays.
    .replace(/<(animate\w*|set)\b[^>]*\/>/g, "")
    .replace(/<(animate\w*|set)\b[^>]*>[\s\S]*?<\/\1>/g, "");
  writeFileSync(join(out, file), svg);
  count++;
}
console.log(`${count} still icons in public/weather/still`);
