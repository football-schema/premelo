// From a rating gap to a match: each side's goals are Poisson, the home side expecting mu/2 × e^(dr/c) and the away
// side mu/2 × e^(−dr/c), with low-scoring draws a little more likely than independent goals make them (draw).
// Every market follows from the one score grid: home/draw/away, goal lines, both teams to score, correct score.
// Browser and Node, no I/O.

const FACT = [1, 1, 2, 6, 24, 120, 720, 5040, 40320, 362880, 3628800];
const pois = (l, k) => Math.exp(-l) * l ** k / FACT[k];

export const DEFAULTS = { mu: 2.7, c: 900, draw: 0.08 };

export function goals(dr, p = DEFAULTS) {
  return [p.mu / 2 * Math.exp(dr / p.c), p.mu / 2 * Math.exp(-dr / p.c)];
}

// the score grid, 0-10 goals a side, normalised
export const grid = (dr, p = DEFAULTS) => gridOf(goals(dr, p), p.draw);
export function gridOf([lh, la], draw) {
  const g = [];
  let tot = 0;
  for (let i = 0; i <= 10; i++) {
    g.push([]);
    for (let j = 0; j <= 10; j++) { let x = pois(lh, i) * pois(la, j); if (i === j && i <= 1) x *= 1 + draw; g[i].push(x); tot += x; }
  }
  return g.map((r) => r.map((x) => x / tot));
}

export const markets = (dr, p = DEFAULTS) => marketsOf(goals(dr, p), p.draw);
// every market from expected goals [home, away] directly (the attack/defence model's)
export const marketsOf = (xg, draw) => fromGrid(gridOf(xg, draw), xg);
// two models together: their score grids mixed, w of the first (expected goals mixed the same way)
export const blended = (a, b, w) => fromGrid(a.grid.map((row, i) => row.map((x, j) => w * x + (1 - w) * b.grid[i][j])), [0, 1].map((i) => w * a.xg[i] + (1 - w) * b.xg[i]));
export function fromGrid(g, [lh, la]) {
  let H = 0, D = 0, A = 0, O15 = 0, O25 = 0, O35 = 0, btts = 0;
  for (let i = 0; i <= 10; i++) for (let j = 0; j <= 10; j++) {
    const x = g[i][j];
    if (i > j) H += x; else if (i === j) D += x; else A += x;
    if (i + j > 1.5) O15 += x; if (i + j > 2.5) O25 += x; if (i + j > 3.5) O35 += x;
    if (i && j) btts += x;
  }
  const scores = [];
  for (let i = 0; i <= 5; i++) for (let j = 0; j <= 5; j++) scores.push([`${i}-${j}`, g[i][j]]);
  scores.sort((a, b) => b[1] - a[1]);
  return { xg: [lh, la], H, D, A, O15, O25, O35, btts, scores: scores.slice(0, 6) };
}

// home/draw/away for every gap from -1000 to 1000 points, one apart: what the backtest looks up
export function table(p = DEFAULTS) {
  const t = [];
  for (let dr = -1000; dr <= 1000; dr++) { const m = markets(dr, p); t.push([m.H, m.D, m.A]); }
  return (dr) => t[Math.max(0, Math.min(2000, Math.round(dr) + 1000))];
}
// home/draw/away from expected goals
export const x12 = (xg, draw) => { const m = marketsOf(xg, draw); return [m.H, m.D, m.A]; };
// the other way: the gap a match's bookmaker prices [home, draw, away] mean, as the gap whose expected score (home win +
// half the draw) is theirs. For Elo's market weight (lib/elo.mjs w). The margin comes out by the power method (each 1/price
// raised to the one power that makes them sum to 1), which takes more of it off the longshots than dividing through does:
// bookmakers load their margin there, and the early files' prices carry 10-14% of it (the closing prices since, 2-3%).
export const fair = (odds) => {
  const q = odds.map((x) => 1 / x);
  let lo = 0.5, hi = 2;
  for (let i = 0; i < 30; i++) { const g = (lo + hi) / 2; if (q[0] ** g + q[1] ** g + q[2] ** g > 1) lo = g; else hi = g; }
  return q.map((x) => x ** lo);
};
export function implied(p = DEFAULTS) {
  const e = [];
  for (let dr = -1000; dr <= 1000; dr++) { const m = markets(dr, p); e.push(m.H + m.D / 2); }
  return (odds) => {
    const q = fair(odds), x = (q[0] + q[1] / 2) / (q[0] + q[1] + q[2]);
    let lo = 0, hi = 2000;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (e[mid] < x) lo = mid; else hi = mid; }
    return lo - 1000 + (x - e[lo]) / (e[hi] - e[lo] || 1);
  };
}
