// What a fixture's context says beyond the two clubs' strength: a shift to the rating gap, in points, from what is known
// before kick-off. Tested out of sample (tuned on 2000-01 to 2011-12, scored 2012-13 on) against the bookmakers' prices,
// the model's gap to the market widens late in the season, and the table explains part of it:
//   relegated, mid, champ: a club already relegated, safe and out of the European race (mid), or already champion plays
//     below its rating (dead rubbers: rotation, nothing to play for), and the other side gains
//   danger: a club fighting relegation in the last six rounds, within three points of the drop, plays above it
//   promoted: a club just up from the second tier is better than the Elo's guess for it (the relegated clubs' average)
//     in its first five matches
//   early: home advantage is smaller in the first three rounds
// Rest days, a midweek European trip before a league match and a European match coming next were tried too and carried
// nothing the ratings didn't (football-data has no domestic cups, so a club's rest is only partly known).
// The table features need a double round-robin with known places (lib/leagues.mjs PLACES); the rest apply everywhere.
import { standings } from './table.mjs';
import { PLACES } from './leagues.mjs';

export const DEFAULTS = { relegated: 0, mid: 0, champ: 0, danger: 0, promoted: 0, early: 0 };
const prior = (s) => { const y = Number(s.slice(0, 2)) - 1, w = (n) => String((n + 100) % 100).padStart(2, '0'); return `${w(y)}${w(y + 1)}`; };

// each top-division match of one league's list (date order) -> its features, home-positive: +1 when the context favours
// the home side, −1 the away side ('early' is 1 for every match it covers)
export function features(list, top) {
  const out = new Map(), seasons = new Map();
  for (const m of list) if (m.div === top) (seasons.get(m.season) ?? seasons.set(m.season, []).get(m.season)).push(m);
  const pl = PLACES[top];
  for (const [season, games] of seasons) {
    const clubs = new Set(games.flatMap((m) => [m.home, m.away])), n = clubs.size, total = 2 * (n - 1);
    const before = seasons.get(prior(season)), last = before && new Set(before.flatMap((m) => [m.home, m.away]));
    const played = new Map(), done = [];
    const status = (st, at, c) => {
      if (!pl || n <= pl.top + pl.down + 2) return {};
      const s = at.get(c), R = total - s.p, maxOf = (x) => x.pts + 3 * (total - x.p);
      const safe = s.pos <= n - pl.down && s.pts > Math.max(...st.slice(n - pl.down).map(maxOf));
      const relegated = maxOf(s) < st[n - pl.down - 1].pts;
      const mid = safe && maxOf(s) < st[pl.top + 1].pts; // can't reach the sixth place or so: the last European places
      const champ = s.pos === 1 && s.pts > maxOf(st[1]);
      const danger = !safe && !relegated && R <= 6 && s.pts - st[n - pl.down].pts <= 3;
      return { relegated, mid, champ, danger };
    };
    for (let i = 0; i < games.length;) {
      const d = games[i].date; let j = i;
      while (j < games.length && games[j].date === d) j++;
      const st = pl ? standings(clubs, done) : null, at = st && new Map(st.map((s) => [s.club, s]));
      for (const m of games.slice(i, j)) {
        const h = st ? status(st, at, m.home) : {}, a = st ? status(st, at, m.away) : {};
        const ph = played.get(m.home) ?? 0, pa = played.get(m.away) ?? 0, up = (c, p) => !!last && !last.has(c) && p < 5;
        out.set(m, { relegated: !!a.relegated - !!h.relegated, mid: !!a.mid - !!h.mid, champ: !!a.champ - !!h.champ, danger: !!h.danger - !!a.danger,
          promoted: up(m.home, ph) - up(m.away, pa), early: Math.max(ph, pa) < 3 ? 1 : 0 });
      }
      // a coming fixture (no score yet) is priced from the table as it stands and doesn't count as played
      for (const m of games.slice(i, j)) if (m.hg != null) { done.push(m); played.set(m.home, (played.get(m.home) ?? 0) + 1); played.set(m.away, (played.get(m.away) ?? 0) + 1); }
      i = j;
    }
  }
  return out;
}

// the shift to the home side's gap, in points: each feature times its weight (params.context)
export const shift = (f, w = DEFAULTS) => (f ? Object.keys(DEFAULTS).reduce((t, k) => t + (w[k] ?? 0) * f[k], 0) : 0);
