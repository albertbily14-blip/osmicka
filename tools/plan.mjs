// Nakreslí plánky tratí jako SVG (pro README).
// Spuštění: node tools/plan.mjs  → docs/trate.svg (tratě z jedné krabice s osmičkou)
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const R = 1.5, D = 0.25, W = 0.95;
const STD = "SLLLLLLSXSRRRRRRSX";
const tracks = JSON.parse(readFileSync(new URL("./trate-vyber.json", import.meta.url)));

const count = s => ({ c: (s.match(/[LR]/g) || []).length, s: (s.match(/S/g) || []).length - 1, x: s.includes("X") ? 1 : 0 });
const bends = s => { let n = 0, last = ""; for (const ch of s + s) if (ch === "L" || ch === "R") { if (last && ch !== last) n++; last = ch; } return n / 2; };
// same naming as the app
const names = {}, cnt = {};
for (const t of tracks) {
  const p = count(t.s); const base = p.x ? "Osmička" : bends(t.s) === 0 ? "Ovál" : p.c >= 16 ? "Klikatice" : "Ledvina";
  if (t.s === STD) { names[t.s] = "Osmička z krabice"; continue; }
  cnt[base] = (cnt[base] || 0) + 1; names[t.s] = `${base} ${cnt[base]}`;
}

function geom(seq) {
  const pts = []; let x = 0, y = 0, h = 0;
  for (const m of seq) {
    const a0 = h * Math.PI / 4, n = m === "S" || m === "X" ? 4 : 6;
    for (let k = 0; k <= n; k++) {
      const t = k / n; let px, py, a;
      if (m === "S" || m === "X") { px = x + Math.cos(a0) * t; py = y + Math.sin(a0) * t; a = a0; }
      else { const s = m === "L" ? 1 : -1; a = a0 + s * t * Math.PI / 4; const cx = x - s * R * Math.sin(a0), cy = y + s * R * Math.cos(a0); px = cx + s * R * Math.sin(a); py = cy - s * R * Math.cos(a); }
      if (k > 0 || !pts.length) pts.push([px, py, a]);
      if (k === n) { x = px; y = py; }
    }
    if (m === "L") h = (h + 1) & 7; else if (m === "R") h = (h + 7) & 7;
  }
  return pts;
}
const f = v => v.toFixed(3);
function plan(seq, ox, oy, size) {
  const pts = geom(seq), xs = pts.map(p => p[0]), ys = pts.map(p => -p[1]), pad = W / 2 + .1;
  const minx = Math.min(...xs) - pad, maxx = Math.max(...xs) + pad, miny = Math.min(...ys) - pad, maxy = Math.max(...ys) + pad;
  const sc = size / Math.max(maxx - minx, maxy - miny), dx = ox + (size - (maxx - minx) * sc) / 2, dy = oy + (size - (maxy - miny) * sc) / 2;
  const P = (x, y) => `${f(dx + (x - minx) * sc)} ${f(dy + (y - miny) * sc)}`;
  const line = off => "M" + pts.map(p => P(p[0] - Math.sin(p[2]) * off, -(p[1] + Math.cos(p[2]) * off))).join("L") + "Z";
  return `<path d="${line(0)}" fill="none" stroke="#4a5260" stroke-width="${f((W + .06) * sc)}" stroke-linejoin="round"/>
<path d="${line(0)}" fill="none" stroke="#353b45" stroke-width="${f(W * sc)}" stroke-linejoin="round"/>
<path d="${line(D)}" fill="none" stroke="#f7c916" stroke-width="${f(.05 * sc)}"/>
<path d="${line(-D)}" fill="none" stroke="#3fb0ff" stroke-width="${f(.05 * sc)}"/>
<rect x="${f(dx + (.5 - minx) * sc - .05 * sc)}" y="${f(dy + (-W / 2 - miny) * sc)}" width="${f(.1 * sc)}" height="${f(W * sc)}" fill="#eef1f5"/>`;
}

// tracks buildable from one boxed figure-8 set: 12 curves, 3 straights + start, 1 crossover
const own = tracks.filter(t => { const p = count(t.s); return p.c <= 12 && p.s <= 3 && p.x <= 1; })
  .sort((a, b) => b.s.length - a.s.length);
const oval = own.find(t => names[t.s].startsWith("Ovál"));
const pick = [own.find(t => t.s === STD), oval, ...own.filter(t => t.s !== STD && t !== oval)].slice(0, 6);
const cols = 3, cell = 220, gap = 16, top = 0, lab = 34;
const w = cols * cell + (cols - 1) * gap, hgt = Math.ceil(pick.length / cols) * (cell + lab + gap) - gap;
let body = "";
pick.forEach((t, i) => {
  const x = (i % cols) * (cell + gap), y = top + Math.floor(i / cols) * (cell + lab + gap);
  body += `<rect x="${x}" y="${y}" width="${cell}" height="${cell + lab}" rx="12" fill="#15181d"/>`;
  body += plan(t.s, x + 14, y + 10, cell - 28);
  body += `<text x="${x + cell / 2}" y="${y + cell + 20}" text-anchor="middle" font-family="Arial Narrow, Arial, sans-serif" font-weight="700" font-size="16" fill="#eef1f5">${names[t.s]}</text>`;
});
mkdirSync(new URL("../docs/", import.meta.url), { recursive: true });
writeFileSync(new URL("../docs/trate.svg", import.meta.url),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${hgt}" width="${w}" height="${hgt}">${body}</svg>\n`);
console.log("docs/trate.svg:", pick.map(t => names[t.s]).join(", "));
