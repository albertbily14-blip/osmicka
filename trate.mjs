// Generátor tratí pro autodráhu Osmička.
// Najde všechny uzavřené okruhy z dílků: rovinka (S), zatáčka 45° doleva/doprava (L/R), křížení (X, projede se dvakrát).
// Geometrie odvozená z originální osmičky: poloměr zatáčky (střed dráhy) = 1,5 délky rovinky, křížení = 1 rovinka,
// šířka dráhy ≈ 1 rovinka, stopy jsou ±0,25 od středu.
// Spuštění: node tools/trate.mjs > tools/trate.json

const R = 1.5, W = 0.95, D = 0.25, EPS = 1e-6;
const MAX_C = +(process.argv[2] ?? 16), MAX_S = +(process.argv[3] ?? 6); // S včetně startovní rovinky
const cos8 = [...Array(8)].map((_, h) => Math.cos(h * Math.PI / 4));
const sin8 = [...Array(8)].map((_, h) => Math.sin(h * Math.PI / 4));

function step(m, x, y, h) {
  if (m === "S" || m === "X") return [x + cos8[h], y + sin8[h], h];
  if (m === "L") { const h2 = (h + 1) & 7; return [x + R * (sin8[h2] - sin8[h]), y + R * (cos8[h] - cos8[h2]), h2]; }
  const h2 = (h + 7) & 7; return [x + R * (sin8[h] - sin8[h2]), y + R * (cos8[h2] - cos8[h]), h2];
}
// samples along a move (for drawing / self-intersection)
function samples(m, x, y, h, n = 8) {
  const out = [];
  for (let k = 1; k <= n; k++) {
    const t = k / n;
    if (m === "S" || m === "X") out.push([x + cos8[h] * t, y + sin8[h] * t]);
    else {
      const s = m === "L" ? 1 : -1, a0 = h * Math.PI / 4, a = a0 + s * t * Math.PI / 4;
      const cx = x - s * R * Math.sin(a0), cy = y + s * R * Math.cos(a0);
      out.push([cx + s * R * Math.sin(a), cy - s * R * Math.cos(a)]);
    }
  }
  return out;
}

const swap = s => s.replace(/[LR]/g, c => (c === "L" ? "R" : "L"));
const rev = s => swap([...s].reverse().join(""));
function canon(s) {
  let best = null;
  for (const v of [s, swap(s), rev(s), rev(swap(s))]) for (let i = 0; i < v.length; i++) {
    const r = v.slice(i) + v.slice(0, i); if (best === null || r < best) best = r;
  }
  return best;
}

function valid(seq) {
  // walk, sample, check X geometry and self-intersection
  let x = 0, y = 0, h = 0; const pts = []; const xs = [];
  for (let i = 0; i < seq.length; i++) {
    const m = seq[i];
    if (m === "X") xs.push({ cx: x + cos8[h] / 2, cy: y + sin8[h] / 2, h });
    for (const p of samples(m, x, y, h)) pts.push([p[0], p[1], i]);
    [x, y, h] = step(m, x, y, h);
  }
  if (xs.length === 2) {
    const [a, b] = xs; if (Math.hypot(a.cx - b.cx, a.cy - b.cy) > 1e-4) return false;
    const dh = (a.h - b.h + 8) % 8; if (dh !== 2 && dh !== 6) return false;
  }
  const n = pts.length, per = 8, total = seq.length;
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    let gap = Math.abs(i - j); gap = Math.min(gap, n - gap);
    if (gap < per * 1.6) continue;                      // neighbours along the path
    const d = Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1]);
    if (d >= W) continue;
    if (xs.length === 2) {
      const c = xs[0], di = Math.hypot(pts[i][0] - c.cx, pts[i][1] - c.cy), dj = Math.hypot(pts[j][0] - c.cx, pts[j][1] - c.cy);
      if (di < 1.0 && dj < 1.0) continue;               // the crossing itself
    }
    return false;
  }
  return true;
}

const found = new Map();
const seq = ["S"]; // the start straight is always first
function dfs(x, y, h, c, s, xUsed, sx, sy, cx, cy) {
  const len = seq.length;
  if (len > 1 && h === 0 && Math.hypot(x, y) < EPS) {
    // non-crossing layouts must close for any curve radius (straights and curves cancel separately)
    const robust = xUsed === 0 ? Math.hypot(sx, sy) < EPS && Math.hypot(cx, cy) < EPS : xUsed === 2;
    if (robust) {
      const str = seq.join("");
      const k = canon(str);
      if (!found.has(k) && valid(str)) found.set(k, str);
    }
    if (xUsed !== 1) {} // keep exploring longer loops too
  }
  const remC = MAX_C - c, remS = MAX_S - s, remX = xUsed === 1 ? 1 : (xUsed === 0 ? 2 : 0);
  const rem = remC + remS + remX;
  if (rem === 0) return;
  if (Math.hypot(x, y) > rem * 1.15 + EPS) return;
  const hd = Math.min(h, 8 - h); if (hd > remC) return;
  if (xUsed === 1 && remX < 1) return;
  for (const m of ["L", "R", "S", "X"]) {
    if ((m === "L" || m === "R") && c >= MAX_C) continue;
    if (m === "S" && s >= MAX_S) continue;
    if (m === "X" && xUsed >= 2) continue;
    const [x2, y2, h2] = step(m, x, y, h);
    let sx2 = sx, sy2 = sy, cx2 = cx, cy2 = cy;
    if (m === "S" || m === "X") { sx2 += x2 - x; sy2 += y2 - y; } else { cx2 += x2 - x; cy2 += y2 - y; }
    seq.push(m);
    dfs(x2, y2, h2, c + (m === "L" || m === "R"), s + (m === "S"), xUsed + (m === "X"), sx2, sy2, cx2, cy2);
    seq.pop();
  }
}
const t0 = Date.now();
dfs(cos8[0], 0, 0, 0, 1, 0, 1, 0, 0, 0);

const tracks = [...found.values()].map(str => {
  const nL = [...str].filter(c => c === "L").length, nR = [...str].filter(c => c === "R").length;
  const nS = [...str].filter(c => c === "S").length, nX = str.includes("X") ? 1 : 0;
  const straight = nS + (nX ? 2 : 0), arc = Math.PI / 4;
  const left = straight + nL * arc * (R - D) + nR * arc * (R + D);   // lane on the left of the travel direction
  const right = straight + nL * arc * (R + D) + nR * arc * (R - D);
  return { seq: str, curves: nL + nR, straights: nS, crossover: nX, reverse: Math.min(nL, nR), laneA: +left.toFixed(3), laneB: +right.toFixed(3) };
}).sort((a, b) => a.curves + a.straights - (b.curves + b.straights) || a.seq.localeCompare(b.seq));
console.error(`${tracks.length} tratí za ${Date.now() - t0} ms`);
console.log(JSON.stringify(tracks));
