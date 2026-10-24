// The league table from a season's results, and where each club is likely to finish: the season's remaining matches
// played out many times from their probabilities. Within each simulated season the ratings keep moving with its
// simulated results, as FiveThirtyEight's "hot" simulations did: a club that starts winning is rated higher for its
// later matches. Holding ratings fixed instead makes the projection too sure of itself. Backtested on the big five's
// 2005-06 to 2024-25 seasons from seven rounds in, fixed ratings said 85% for relegations that happened 76% of the time;
// moving ratings were better on the title (log loss 1.057 against 1.071), the top four and relegation.
// Clubs level on points are split by goal difference, then goals scored; head-to-head rules, points deductions and
// play-offs aren't modelled.

// the table: every club's record, best first
export function standings(clubs, results) {
  const t = new Map([...clubs].map((c) => [c, { club: c, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 }]));
  for (const m of results) {
    const h = t.get(m.home), a = t.get(m.away);
    if (!h || !a) continue;
    h.p++; a.p++; h.gf += m.hg; h.ga += m.ag; a.gf += m.ag; a.ga += m.hg;
    if (m.hg > m.ag) { h.w++; a.l++; h.pts += 3; } else if (m.hg < m.ag) { a.w++; h.l++; a.pts += 3; } else { h.d++; a.d++; h.pts++; a.pts++; }
  }
  const rows = [...t.values()].sort(order);
  rows.forEach((r, i) => { r.pos = i + 1; });
  return rows;
}
const order = (a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf || a.club.localeCompare(b.club);

// a double round-robin's matches still to play: every pairing, each way round, that hasn't been played yet
export function remaining(clubs, results) {
  const done = new Set(results.map((m) => `${m.home}|${m.away}`)), out = [];
  for (const h of clubs) for (const a of clubs) if (h !== a && !done.has(`${h}|${a}`)) out.push({ home: h, away: a });
  return out;
}

// a seeded generator (mulberry32), so the same results give the same projection
export function rng(seed = 1) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const poisson = (l, rand) => { const L = Math.exp(-l); let k = 0, p = rand(); while (p > L) { k++; p *= rand(); } return k; };

// plays the rest of the season n times. games: the remaining matches, each with H, D, A and xg [home, away] as published
// and dr, the Elo gap (home advantage included) they were priced at. The result is drawn from H/D/A, the score, for goal
// difference, from the expected goals given that result. With hot = { k, margin, price }, each simulated result moves
// the two clubs' ratings by the Elo's own rule, and a later match's chances move by as much as the Elo's chances
// (price(dr) -> [H, D, xgH, xgA]) move between its gap today and its gap in that simulation. Returns each club's
// average final points and its chance of each finishing place.
import { expectedScore, marginFactor } from './elo.mjs';
export function simulate(table, games, { n = 10000, seed = 1, hot = null } = {}) {
  const rand = rng(seed), clubs = table.map((r) => r.club), idx = new Map(clubs.map((c, i) => [c, i])), k = clubs.length;
  const pos = clubs.map(() => new Float64Array(k)), pts = new Float64Array(k);
  const g = games.map((m) => ({ h: idx.get(m.home), a: idx.get(m.away), cH: m.H, cD: m.H + m.D, xg: m.xg, dr: m.dr, e0: hot && hot.price(m.dr) }));
  const P = new Int32Array(k), GD = new Int32Array(k), GF = new Int32Array(k), drift = new Float64Array(k), rank = clubs.map((_, i) => i);
  const memo = new Map(), price = (dr) => { const r = Math.round(dr); return memo.get(r) ?? memo.set(r, hot.price(r)).get(r); };
  const clamp = (x, lo, hi) => Math.min(Math.max(x, lo), hi);
  for (let s = 0; s < n; s++) {
    table.forEach((r, i) => { P[i] = r.pts; GD[i] = r.gf - r.ga; GF[i] = r.gf; drift[i] = 0; });
    for (const m of g) {
      let cH = m.cH, cD = m.cD, lh = m.xg[0], la = m.xg[1];
      const dr = hot ? m.dr + drift[m.h] - drift[m.a] : 0;
      if (hot && (drift[m.h] || drift[m.a])) {
        const e = price(dr), e0 = m.e0;
        cH = clamp(cH + e[0] - e0[0], 0.01, 0.98); cD = clamp(cD + e[0] + e[1] - e0[0] - e0[1], cH + 0.01, 0.99);
        lh = Math.max(lh + e[2] - e0[2], 0.1); la = Math.max(la + e[3] - e0[3], 0.1);
      }
      const u = rand(), res = u < cH ? 1 : u < cD ? 0 : -1;
      let hg, ag, tries = 0;
      do { hg = poisson(lh, rand); ag = poisson(la, rand); } while (Math.sign(hg - ag) !== res && ++tries < 30);
      if (Math.sign(hg - ag) !== res) [hg, ag] = res > 0 ? [1, 0] : res < 0 ? [0, 1] : [1, 1];
      GD[m.h] += hg - ag; GD[m.a] += ag - hg; GF[m.h] += hg; GF[m.a] += ag;
      if (res > 0) P[m.h] += 3; else if (res < 0) P[m.a] += 3; else { P[m.h]++; P[m.a]++; }
      if (hot) { const d = hot.k * marginFactor(hg - ag, hot.margin) * ((res + 1) / 2 - expectedScore(dr)); drift[m.h] += d; drift[m.a] -= d; }
    }
    rank.sort((x, y) => P[y] - P[x] || GD[y] - GD[x] || GF[y] - GF[x] || x - y);
    rank.forEach((c, i) => { pos[c][i]++; });
    for (let i = 0; i < k; i++) pts[i] += P[i];
  }
  return new Map(clubs.map((c, i) => [c, { pts: pts[i] / n, pos: [...pos[i]].map((x) => x / n) }]));
}
