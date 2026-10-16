// Pull the React Bits TS+Tailwind sources straight out of their registry.
import { writeFileSync, mkdirSync, readFileSync } from "node:fs";

const DEST = process.argv[2];
const NAMES = ["Silk", "SplitText", "ShinyText", "CountUp", "SpotlightCard", "GlareHover", "Magnet", "AnimatedList", "LatticeLoader", "GlassSurface", "PillNav", "ScrollReveal"];

mkdirSync(`${DEST}/bits`, { recursive: true });
const manifest = [];
for (const name of NAMES) {
  const reg = JSON.parse(readFileSync(`scripts/data/${name}.json`, "utf8"));
  const file = reg.files[0];
  const src = file.content.replace(/@\/components\//g, "@/bits/").replace(/@\/lib\//g, "@/lib/").replace(/\.\.\/lib\//g, "../lib/");
  writeFileSync(`${DEST}/bits/${name}.tsx`, src);
  manifest.push({ name, deps: reg.dependencies ?? [], bytes: src.length });
  console.log(`${name.padEnd(14)} ${String(src.length).padStart(6)} B  deps: ${(reg.dependencies ?? []).join(" ") || "—"}`);
}
writeFileSync(`${DEST}/bits/MANIFEST.json`, JSON.stringify({ source: "reactbits.dev registry (reactbits.dev/r/<Name>-TS-TW.json)", license: "MIT / open source — see reactbits.dev", components: manifest }, null, 2));
