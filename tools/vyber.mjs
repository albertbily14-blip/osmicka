// Vybere z tools/trate.json zajímavé tratě do aplikace a vypíše je jako JSON (tools/trate-vyber.json).
// Kritéria: férovost drah (stejná délka obou stop), technické esíčka, malý zábor místa.
import { readFileSync, writeFileSync } from "node:fs";
const R = 1.5, W = 1.0;
const all = JSON.parse(readFileSync(new URL("./trate.json", import.meta.url)));
const c8 = [...Array(8)].map((_, h) => Math.cos(h * Math.PI / 4)), s8 = [...Array(8)].map((_, h) => Math.sin(h * Math.PI / 4));
function bbox(seq) {
  let x = 0, y = 0, h = 0, minx = 0, maxx = 0, miny = 0, maxy = 0;
  for (const m of seq) {
    for (let k = 1; k <= 8; k++) {
      let px, py;
      if (m === "S" || m === "X") { px = x + c8[h] * k / 8; py = y + s8[h] * k / 8; }
      else { const s = m === "L" ? 1 : -1, a0 = h * Math.PI / 4, a = a0 + s * k / 8 * Math.PI / 4, cx = x - s * R * Math.sin(a0), cy = y + s * R * Math.cos(a0); px = cx + s * R * Math.sin(a); py = cy - s * R * Math.cos(a); }
      minx = Math.min(minx, px); maxx = Math.max(maxx, px); miny = Math.min(miny, py); maxy = Math.max(maxy, py);
      if (k === 8) { x = px; y = py; }
    }
    if (m === "L") h = (h + 1) & 7; else if (m === "R") h = (h + 7) & 7;
  }
  const w = maxx - minx + W, d = maxy - miny + W;
  return [Math.max(w, d), Math.min(w, d)];
}
// count direction changes (S-bends) = "technical" feel
const bends = s => { let n = 0, last = ""; for (const c of s + s) if (c === "L" || c === "R") { if (last && c !== last) n++; last = c; } return n / 2; };
const groups = {};
for (const t of all) {
  const [a, b] = bbox(t.seq);
  t.size = [+a.toFixed(2), +b.toFixed(2)];
  t.diff = Math.abs(t.laneA - t.laneB);
  t.bends = bends(t.seq);
  const k = `${t.curves}/${t.straights}/${t.crossover}`;
  (groups[k] ||= []).push(t);
}
const pick = [];
for (const [k, list] of Object.entries(groups)) {
  list.sort((p, q) => p.diff - q.diff || q.bends - p.bends || p.size[0] * p.size[1] - q.size[0] * q.size[1]);
  // keep variety: no two picks with the same (diff, bends, rounded area)
  const seen = new Set(); const out = [];
  for (const t of list) {
    const sig = `${t.diff.toFixed(2)}|${t.bends}|${Math.round(t.size[0] * t.size[1])}`;
    if (seen.has(sig)) continue; seen.add(sig); out.push(t);
    if (out.length >= (t.crossover ? 4 : 5)) break;
  }
  pick.push(...out);
}
pick.sort((p, q) => p.curves + p.straights - (q.curves + q.straights) || p.crossover - q.crossover || p.diff - q.diff);
const slim = pick.map(t => ({ s: t.seq, a: t.laneA, b: t.laneB, z: t.size }));
writeFileSync(new URL("./trate-vyber.json", import.meta.url), JSON.stringify(slim));
console.log(pick.length, "tratí;", JSON.stringify(slim).length, "bajtů");
for (const t of pick) console.log(t.seq.padEnd(26), t.curves, t.straights, t.crossover ? "X" : " ", "diff", t.diff.toFixed(2), "bends", t.bends, "size", t.size.join("×"));
