// Elo for English clubs, one pool across the Premier League and the Championship, World Football Elo style:
// each result moves both clubs by K × goal-margin factor × (result − expected), the home side's expected
// score including a home advantage. The settings in params.json are tuned by scripts/backtest.mjs.
//
// Between seasons: every club is pulled a little towards its new division's average (REGRESS), and a club
// arriving from outside the two divisions (up from the third tier, where we have no results) takes over the
// average rating of the clubs that left them, which is to say went down the other way.

export const DEFAULTS = { k: 20, hfa: 65, hfaEmpty: 30, margin: 'wfe', regress: 0.1, start: { top: 1600, second: 1450 } };

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

// walks the matches in date order. each(m, { dr, home, away }) sees every match with the ratings before it,
// dr being the home side's edge in points, home advantage included. Returns the ratings at the end and,
// with history, every club's rating after each of its matches. divs: the league's divisions, top first.
export function run(list, params = {}, { each, history = false, divs = ['E0', 'E1'] } = {}) {
  const p = { ...DEFAULTS, ...params, start: { ...DEFAULTS.start, ...params.start } };
  const R = new Map(), hist = history ? new Map() : null;
  let season = null, last = new Map(); // club -> division last season
  const newSeason = (s, games) => {
    const now = new Map();
    for (const m of games) { now.set(m.home, m.div); now.set(m.away, m.div); }
    if (season === null) {
      // no history before 1993: start from flat ratings, play the first season through once to spread them, and
      // start again from where that leaves them
      for (const [club, div] of now) R.set(club, div === divs[0] ? p.start.top : p.start.second);
      for (const m of games) play(m);
    } else {
      // the clubs that left the pool last season: their ratings are what the arrivals get. (Before a country's
      // second division is in the files, those are the clubs relegated from the top.)
      const gone = [...last].filter(([c]) => !now.has(c)).map(([c]) => R.get(c));
      const arrival = gone.length ? mean(gone) : p.start.second;
      for (const [club] of now) if (!last.has(club)) R.set(club, arrival);
      for (const div of new Set(now.values())) {
        const clubs = [...now].filter(([, d]) => d === div).map(([c]) => c), avg = mean(clubs.map((c) => R.get(c)));
        for (const c of clubs) R.set(c, R.get(c) + p.regress * (avg - R.get(c)));
      }
    }
    season = s; last = now;
  };
  // one match: both ratings move; seen(dr, rh, ra) gets the ratings before it
  function play(m, seen) {
    const rh = R.get(m.home), ra = R.get(m.away), dr = rh + (empty(m.date) ? p.hfaEmpty : p.hfa) - ra;
    seen?.(dr, rh, ra);
    const w = m.hg > m.ag ? 1 : m.hg === m.ag ? 0.5 : 0;
    const delta = p.k * marginFactor(m.hg - m.ag, p.margin) * (w - expectedScore(dr));
    R.set(m.home, rh + delta); R.set(m.away, ra - delta);
    return { rh, ra, dr, delta };
  }
  // a season's clubs are known from its own matches, so group them first
  const bySeason = new Map();
  for (const m of list) (bySeason.get(m.season) ?? bySeason.set(m.season, []).get(m.season)).push(m);
  for (const [s, games] of bySeason) {
    newSeason(s, games);
    for (const m of games) {
      const { rh, ra, dr, delta } = play(m, (dr, rh, ra) => each?.(m, { dr, home: rh, away: ra }));
      if (hist) {
        (hist.get(m.home) ?? hist.set(m.home, []).get(m.home)).push([m.date, Math.round(rh + delta), m.away, m.hg, m.ag, 'h', m.div]);
        (hist.get(m.away) ?? hist.set(m.away, []).get(m.away)).push([m.date, Math.round(ra - delta), m.home, m.ag, m.hg, 'a', m.div]);
      }
    }
  }
  return { ratings: R, history: hist, divisions: last, season, params: p };
}
