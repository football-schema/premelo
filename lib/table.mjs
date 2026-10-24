// The league table from a season's results, and where each club is likely to finish: the season's remaining matches
// played out many times from their probabilities, the ratings held where they stand today (as FiveThirtyEight's
// projections did). Clubs level on points are split by goal difference, then goals scored; head-to-head rules, points
// deductions and play-offs aren't modelled.

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

// plays the rest of the season n times. games: the remaining matches, each with H, D, A and xg [home, away]. The result
// is drawn from H/D/A, so the projection agrees with the published chances; the score, for goal difference, from the
// expected goals given that result. Returns each club's average final points and its chance of each finishing place.
export function simulate(table, games, { n = 10000, seed = 1 } = {}) {
  const rand = rng(seed), clubs = table.map((r) => r.club), idx = new Map(clubs.map((c, i) => [c, i])), k = clubs.length;
  const pos = clubs.map(() => new Float64Array(k)), pts = new Float64Array(k);
  const g = games.map((m) => ({ h: idx.get(m.home), a: idx.get(m.away), cH: m.H, cD: m.H + m.D, xg: m.xg }));
  const P = new Int32Array(k), GD = new Int32Array(k), GF = new Int32Array(k), rank = clubs.map((_, i) => i);
  for (let s = 0; s < n; s++) {
    table.forEach((r, i) => { P[i] = r.pts; GD[i] = r.gf - r.ga; GF[i] = r.gf; });
    for (const m of g) {
      const u = rand(), res = u < m.cH ? 1 : u < m.cD ? 0 : -1;
      let hg, ag, tries = 0;
      do { hg = poisson(m.xg[0], rand); ag = poisson(m.xg[1], rand); } while (Math.sign(hg - ag) !== res && ++tries < 30);
      if (Math.sign(hg - ag) !== res) [hg, ag] = res > 0 ? [1, 0] : res < 0 ? [0, 1] : [1, 1];
      GD[m.h] += hg - ag; GD[m.a] += ag - hg; GF[m.h] += hg; GF[m.a] += ag;
      if (res > 0) P[m.h] += 3; else if (res < 0) P[m.a] += 3; else { P[m.h]++; P[m.a]++; }
    }
    rank.sort((x, y) => P[y] - P[x] || GD[y] - GD[x] || GF[y] - GF[x] || x - y);
    rank.forEach((c, i) => { pos[c][i]++; });
    for (let i = 0; i < k; i++) pts[i] += P[i];
  }
  return new Map(clubs.map((c, i) => [c, { pts: pts[i] / n, pos: [...pos[i]].map((x) => x / n) }]));
}
