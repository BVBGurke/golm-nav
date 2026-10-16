import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
const nodes = new Map(), byId = new Map();
for (const f of readdirSync("scripts/data").filter(f => f.endsWith(".xml")).sort()) {
  const xml = readFileSync(`scripts/data/${f}`, "utf8");
  for (const m of xml.matchAll(/<node id="(\d+)"[^>]*?lat="(-?[\d.]+)"[^>]*?lon="(-?[\d.]+)"/g)) nodes.set(m[1], [+m[2], +m[3]]);
  for (const m of xml.matchAll(/<way id="(\d+)"[^>]*>([\s\S]*?)<\/way>/g)) {
    if (byId.has(m[1])) continue;
    const refs = [...m[2].matchAll(/<nd ref="(\d+)"/g)].map(x => x[1]);
    const tags = {}; for (const t of m[2].matchAll(/<tag k="([^"]+)" v="([^"]*)"/g)) tags[t[1]] = t[2];
    byId.set(m[1], { id: m[1], refs, tags, node: false });
  }
  for (const mm of xml.matchAll(/<node id="(\d+)"[^>]*>([\s\S]*?)<\/node>/g)) {
    if (byId.has(mm[1])) continue;
    const tags = {}; for (const t of mm[2].matchAll(/<tag k="([^"]+)" v="([^"]*)"/g)) tags[t[1]] = t[2];
    if (Object.keys(tags).length) byId.set(mm[1], { id: mm[1], refs: [mm[1]], tags, node: true });
  }
}
const dec = (s) => s.replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&gt;/g, ">").replace(/&lt;/g, "<");
const KEY = /^(amenity|shop|leisure|tourism|office|public_transport|railway|healthcare|sport)$/;
const out = [];
for (const [, o] of byId) {
  const t = o.tags;
  const name = t.name || t.ref || t.operator;
  if (!name) continue;
  const source = Object.keys(t).find(k => KEY.test(k));
  if (!source) continue;
  const kind = t[source];
  if (/^(yes|no|house|residential|university|dormitory|apartments|garage|garages|carport|roof|shed|hut|construction|service)$/.test(kind)) continue;
  const pt = o.node ? nodes.get(o.id) : nodes.get(o.refs[0]);
  if (!pt) continue;
  out.push({ id: o.id, name: dec(name), kind, at: [+pt[0].toFixed(5), +pt[1].toFixed(5)], node: o.node, extra: [t.cuisine, t.opening_hours, t.operator, t.ref].filter(Boolean).map(dec).join(" / ") });
}
mkdirSync("out", { recursive: true });
writeFileSync("out/pois_raw.json", JSON.stringify(out));
console.log("places", out.length);
