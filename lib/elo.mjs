// Elo for Europe's big five leagues, World Football Elo style: each result moves both clubs by
// K × goal-margin factor × (result − expected), the home side's expected score including a home advantage.
// Each league runs its own top two divisions with its own settings; the European cups are the only matches
// between clubs of different countries, so they are what sets one country's level against another's (as ClubElo
// does). The settings in params.json are tuned by scripts/backtest.mjs.
//
// Between seasons: every club is pulled a little towards its new division's average (regress), and a club
// arriving from outside the two divisions (up from the third tier, where we have no results) takes over the
// average rating of the clubs that left them, which is to say went down the other way. Neither moves a league's
// average: only European results do.

export const DEFAULTS = { k: 20, hfa: 65, hfaEmpty: 30, margin: 'wfe', regress: 0.1, start: { top: 1600, second: 1450 } };
// European matches: their own K and home advantage (none in a final), and where a club from outside the big five
// starts, in points below the average of the five top divisions when it is first met. A European result also moves
// the whole of each club's league by kLeague: Spanish clubs beating English ones says something about Spain, not just
// about the clubs that played, and only the clubs at the top ever play in Europe. A shift of a whole league changes
// no gap inside it, so it leaves domestic predictions alone.
export const EUROPE = { k: 30, hfa: 70, margin: 'log', other: 150, kLeague: 0 };

// matches played without crowds, from the restarts of May and June 2020 to the end of 2020-21: home advantage nearly went
// (McCarrick et al. 2021 measured +0.29 goals a game falling to +0.15), so those matches get hfaEmpty
export const empty = (date) => date >= '2020-05-15' && date <= '2021-05-31';

export const expectedScore = (dr) => 1 / (1 + 10 ** (-dr / 400));

// how much more a win by n goals counts than a one-goal win
export function marginFactor(n, kind) {
  n = Math.abs(n);
  if (kind === 'none' || n <= 1) return 1;
  if (kind === 'log') return 1 + Math.log(n); // 2 -> 1.69, 3 -> 2.10
  return n === 2 ? 1.5 : (11 + n) / 8; // 'wfe', World Football Elo: 2 -> 1.5, 3 -> 1.75, 4 -> 1.875
}

const mean = (xs) => xs.reduce((t, x) => t + x, 0) / xs.length;
const settings = (p = {}) => ({ ...DEFAULTS, ...p, start: { ...DEFAULTS.start, ...p.start } });

// walks every league's matches and the European ones together, in date order.
//   leagues: { id: { list, params, divs } }, divs being the league's divisions, top first
//   europe:  { list, params } or null; its matches have div 'EU' and may be neutral
// each(m, { dr, home, away, league }) sees every match with the ratings before it, dr being the home side's edge
// in points, home advantage included. Returns the ratings at the end, each league's clubs by division this season
// and, with history, every club's rating after each of its matches.
export function runAll(leagues, europe = null, { each, history = false } = {}) {
  const R = new Map(), hist = history ? new Map() : null;
  const state = {}, all = [];
  for (const [id, { list, params, divs }] of Object.entries(leagues)) {
    // a season's clubs are known from its own matches, so group them first
    const seasons = new Map();
    for (const m of list) { const s = seasons.get(m.season) ?? seasons.set(m.season, { games: [], clubs: new Map() }).get(m.season); s.games.push(m); s.clubs.set(m.home, m.div); s.clubs.set(m.away, m.div); }
    state[id] = { p: settings(params), divs, seasons, season: null, last: new Map() };
    for (const m of list) all.push([m, id]);
  }
  const eu = europe ? { ...EUROPE, ...europe.params } : null;
  for (const m of europe?.list ?? []) all.push([m, 'EU']);
  const leagueOf = new Map(Object.entries(state).flatMap(([id, L]) => [...L.seasons.values()].flatMap((s) => [...s.clubs.keys()].map((c) => [c, id]))));
  const shift = (id, d) => { if (!id || !d) return; for (const c of state[id].last.keys()) R.set(c, R.get(c) + d); };
  all.sort((a, b) => a[0].date.localeCompare(b[0].date)); // stable: each league's own order kept within a day

  // one match: both ratings move by k; seen(dr, rh, ra) gets the ratings before it
  const play = (m, k, hfa, margin, seen) => {
    const rh = R.get(m.home), ra = R.get(m.away), dr = rh + hfa - ra;
    seen?.(dr, rh, ra);
    const w = m.hg > m.ag ? 1 : m.hg === m.ag ? 0.5 : 0;
    const delta = k * marginFactor(m.hg - m.ag, margin) * (w - expectedScore(dr));
    R.set(m.home, rh + delta); R.set(m.away, ra - delta);
    return { rh, ra, dr, delta };
  };
  const domestic = (L, m, seen) => play(m, L.p.k, empty(m.date) ? L.p.hfaEmpty : L.p.hfa, L.p.margin, seen);
  const newSeason = (L, s) => {
    const { clubs: now, games } = L.seasons.get(s);
    if (L.season === null) {
      // no history before 1993: start from flat ratings, play the first season through once to spread them, and
      // start again from where that leaves them
      for (const [club, div] of now) R.set(club, div === L.divs[0] ? L.p.start.top : L.p.start.second);
      for (const m of games) domestic(L, m);
    } else {
      // the clubs that left the pool last season: their ratings are what the arrivals get. (Before a country's
      // second division is in the files, those are the clubs relegated from the top.)
      const gone = [...L.last].filter(([c]) => !now.has(c)).map(([c]) => R.get(c));
      const arrival = gone.length ? mean(gone) : L.p.start.second;
      for (const [club] of now) if (!L.last.has(club)) R.set(club, arrival);
      for (const div of new Set(now.values())) {
        const clubs = [...now].filter(([, d]) => d === div).map(([c]) => c), avg = mean(clubs.map((c) => R.get(c)));
        for (const c of clubs) R.set(c, R.get(c) + L.p.regress * (avg - R.get(c)));
      }
    }
    L.season = s; L.last = now;
  };
  // the average of the five top divisions as they stand: where a club from elsewhere starts from
  const topAverage = () => mean(Object.values(state).flatMap((L) => [...L.last].filter(([, d]) => d === L.divs[0]).map(([c]) => R.get(c))));
  // each club's rating after the match
  const record = (m) => {
    if (!hist) return;
    (hist.get(m.home) ?? hist.set(m.home, []).get(m.home)).push([m.date, Math.round(R.get(m.home)), m.away, m.hg, m.ag, m.neutral ? 'n' : 'h', m.div]);
    (hist.get(m.away) ?? hist.set(m.away, []).get(m.away)).push([m.date, Math.round(R.get(m.away)), m.home, m.ag, m.hg, m.neutral ? 'n' : 'a', m.div]);
  };

  for (const [m, id] of all) {
    if (id === 'EU') {
      for (const c of [m.home, m.away]) if (!R.has(c)) R.set(c, topAverage() - eu.other);
      const hfa = m.neutral || empty(m.date) ? 0 : eu.hfa;
      const { dr } = play(m, eu.k, hfa, eu.margin, (dr, rh, ra) => each?.(m, { dr, home: rh, away: ra, league: 'EU' }));
      const lh = leagueOf.get(m.home), la = leagueOf.get(m.away);
      if (eu.kLeague && lh !== la) {
        const d = eu.kLeague * marginFactor(m.hg - m.ag, eu.margin) * ((m.hg > m.ag ? 1 : m.hg === m.ag ? 0.5 : 0) - expectedScore(dr));
        shift(lh, d); shift(la, -d);
      }
      record(m);
      continue;
    }
    const L = state[id];
    if (m.season !== L.season) newSeason(L, m.season);
    domestic(L, m, (dr, rh, ra) => each?.(m, { dr, home: rh, away: ra, league: id }));
    record(m);
  }
  return { ratings: R, history: hist, divisions: Object.fromEntries(Object.entries(state).map(([id, L]) => [id, L.last])) };
}

// one league on its own: what tuning a league's settings runs
export function run(list, params = {}, { each, history = false, divs = ['E0', 'E1'] } = {}) {
  const r = runAll({ one: { list, params, divs } }, null, { each, history });
  return { ratings: r.ratings, history: r.history, divisions: r.divisions.one, params: settings(params) };
}
