// data/<league>/results.csv (+ the newest results and the coming fixtures) -> the published ratings and predictions:
//   data/<league>/ratings.json        every club of the league's top two divisions this season, rated and ranked
//   data/<league>/clubs/<slug>.json   a club's rating after each of its matches since 1993
//   data/<league>/fixtures.json       the coming top-division fixtures, each with its probabilities
//   data/leagues.json                 the leagues, for the page's switcher
//   card.svg, card.png                the link-preview card, with the top six of the five leagues as they stand
// The Premier League's newest results and its whole fixture list come from matchday; the other leagues' fixtures
// from football-data's fixtures.csv, which has the next week or so.
//   node scripts/build.mjs [--offline]   (--offline: from the results files alone, no fixtures)
import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync, existsSync } from 'node:fs';
import { fromCsv, byDate, parseCsv, isoDate } from '../lib/results.mjs';
import { runAll } from '../lib/elo.mjs';
import { goals, grid, gridOf, blended, markets } from '../lib/goals.mjs';
import { run as runAttack } from '../lib/attack.mjs';
import { display, slug, canonical } from '../lib/teams.mjs';
import { currentSeason, label, ukToUtc, startOf } from '../lib/seasons.mjs';
import { clubOf } from '../lib/uefa.mjs';
import { fetchSeason } from '../lib/matchday.mjs';
import { LEAGUES, PLACES, SCENARIOS, load } from '../lib/leagues.mjs';
import { standings, remaining, simulate } from '../lib/table.mjs';
import { writeCard } from './card.mjs';

const params = JSON.parse(readFileSync('params.json', 'utf8'));
const season = currentSeason(), offline = process.argv.includes('--offline');
const r1 = (x) => Math.round(x * 10) / 10, r3 = (x) => Math.round(x * 1000) / 1000;
const pair = (m) => `${m.home}|${m.away}`;

// the next week or so: fixtures.csv for football-data's own leagues, new_league_fixtures.csv for the extra ones (by country)
const getCsv = (url) => fetch(url, { headers: { 'user-agent': 'premelo (github.com/football-schema/premelo)' } }).then((r) => (r.ok ? r.text() : '')).then((t) => (t ? parseCsv(t) : [])).catch(() => []);
const upcoming = offline ? [] : await getCsv('https://football-data.co.uk/fixtures.csv');
const upcomingExtra = offline ? [] : await getCsv('https://football-data.co.uk/new_league_fixtures.csv');

// the European cups: data/europe.csv (from UEFA's match data), which ties the countries together
const europe = existsSync('data/europe.csv') ? fromCsv(readFileSync('data/europe.csv', 'utf8')).map((m) => ({ ...m, neutral: m.div === 'EUN', div: 'EU' })) : [];

const index = [], leagues = {}, upcomingBy = {};
for (const [id, league] of Object.entries(LEAGUES)) {
  // the season files in cache/ where they're here (they carry shots on target, which the attack/defence model learns
  // from and which aren't published), else the published results
  const cached = load(id), top = league.divs[0], list = cached.length ? cached : fromCsv(readFileSync(`data/${id}/results.csv`, 'utf8'));
  let fixtures = [];
  if (!offline && id === 'pl') {
    // matchday's results that football-data hasn't got yet (each pairing is played once a season)
    const md = await fetchSeason(label(season));
    const have = new Set(list.filter((m) => m.season === season && m.div === top).map(pair));
    const extra = md.filter((m) => m.status === 'finished' && m.ft && !have.has(pair(m))).map((m) => ({ date: m.kickoff.slice(0, 10), season, div: top, home: m.home, away: m.away, hg: m.ft[0], ag: m.ft[1] }));
    if (extra.length) console.log(`${extra.length} newer results from matchday: ${extra.map((m) => `${m.home} ${m.hg}-${m.ag} ${m.away}`).join(', ')}`);
    list.push(...extra); list.sort(byDate);
    const done = new Set(list.filter((m) => m.season === season && m.div === top).map(pair));
    fixtures = md.filter((m) => m.status !== 'finished' && m.status !== 'postponed' && !done.has(pair(m)));
  } else if (!offline) {
    const done = new Set(list.filter((m) => m.season === season && m.div === top).map(pair));
    const rows = league.extra ? upcomingExtra.filter((r) => r.Country === league.country).map((r) => ({ ...r, HomeTeam: r.Home, AwayTeam: r.Away })) : upcoming.filter((r) => r.Div === top);
    fixtures = rows.filter((r) => isoDate(r.Date)).map((r) => ({ kickoff: ukToUtc(isoDate(r.Date), r.Time || undefined), home: canonical(r.HomeTeam), away: canonical(r.AwayTeam), tbc: !r.Time }))
      .filter((f) => !done.has(pair(f)));
  }
  // a match more than two hours past kick-off is played, whether or not its result is in yet
  fixtures = fixtures.filter((f) => Date.parse(f.kickoff) > Date.now() - 2 * 3600_000).sort((a, b) => a.kickoff.localeCompare(b.kickoff));
  leagues[id] = { list, params: params[id].elo, divs: league.divs }; upcomingBy[id] = fixtures;
}

// every league and the European cups in one run: one scale, countries set against each other by their clubs' European results
const { ratings, history, divisions: byLeague, hfa: hfaNow } = runAll(leagues, { list: europe, params: params.europe }, { history: true });
const attack = Object.fromEntries(Object.entries(leagues).map(([id, l]) => [id, runAttack(l.list, params[id].attack ?? {}, { divs: l.divs })]));
const leagueOfClub = new Map(Object.entries(leagues).flatMap(([id, l]) => l.list.flatMap((m) => [[m.home, id], [m.away, id]])));
const where = (div, top) => (div === 'EU' ? 'europe' : div === top ? 'top' : 'second');
for (const [id, league] of Object.entries(LEAGUES)) {
  const p = params[id], top = league.divs[0], list = leagues[id].list, fixtures = upcomingBy[id], divisions = byLeague[id];
  const today = list.at(-1).date, monthAgo = new Date(Date.parse(today) - 30 * 86400_000).toISOString().slice(0, 10);
  const seasonStart = `${label(season).slice(0, 4)}-07-01`;
  const ratingOn = (h, date) => { let r = null; for (const x of h) { if (x[0] > date) break; r = x[1]; } return r; };
  const clubs = [...divisions].map(([club, div]) => {
    const h = history.get(club), played = h.filter((x) => x[0] >= seasonStart).length;
    // form: the last five league matches only (a league table's readers take it as league form), oldest first
    const form = h.filter((x) => league.divs.includes(x[6])).slice(-5).map((x) => ({ r: x[3] > x[4] ? 'W' : x[3] === x[4] ? 'D' : 'L', opp: display(x[2]), oppSlug: slug(x[2]), gf: x[3], ga: x[4], ha: x[5], date: x[0] }));
    const before = ratingOn(h, monthAgo) ?? h[0][1];
    return { club, name: display(club), slug: slug(club), div: div === top ? 'top' : 'second', elo: Math.round(ratings.get(club)), change30: Math.round(ratings.get(club) - before), played, form, spark: h.slice(-20).map((x) => x[1]) };
  }).sort((a, b) => b.elo - a.elo);
  for (const div of ['top', 'second']) clubs.filter((c) => c.div === div).forEach((c, i) => { c.rank = i + 1; });

  rmSync(`data/${id}/clubs`, { recursive: true, force: true });
  mkdirSync(`data/${id}/clubs`, { recursive: true });
    // a European match also says which league the opponent is from (none for clubs outside the big five), for the link
  const mine = new Set(list.flatMap((m) => [m.home, m.away]));
  for (const club of mine) writeFileSync(`data/${id}/clubs/${slug(club)}.json`, JSON.stringify({ club, name: display(club), history: history.get(club).map((x) => x[6] === 'EU' ? [...x.slice(0, 6), 'europe', leagueOfClub.get(x[2]) ?? null] : [...x.slice(0, 6), where(x[6], top)]) }) + '\n');

  // a match's chances: the Elo's grid and the attack/defence model's, blended as tuned (lib/attack.mjs)
  const price = (home, away, div = top) => {
    const eh = ratings.get(home), ea = ratings.get(away);
    if (eh == null || ea == null) return null;
    const dr = eh + hfaNow[id] - ea, elo = { grid: grid(dr, p.goals), xg: goals(dr, p.goals) }, xa = attack[id].expect(home, away, div);
    return { eh, ea, dr, m: xa && p.attack ? blended(elo, { grid: gridOf(xa, p.attack.draw), xg: xa }, p.blend ?? 1) : blended(elo, elo, 1) };
  };
  const preds = fixtures.map((f) => {
    const q = price(f.home, f.away);
    if (!q) { console.log(`${league.name}: no rating for ${ratings.get(f.home) == null ? f.home : f.away}, fixture left out`); return null; }
    const { eh, ea, dr, m } = q;
    return { kickoff: f.kickoff, gw: f.gw, tbc: f.tbc || undefined, home: f.home, away: f.away, homeSlug: slug(f.home), awaySlug: slug(f.away), homeName: display(f.home), awayName: display(f.away),
      elo: [Math.round(eh), Math.round(ea)], dr: Math.round(dr), H: r3(m.H), D: r3(m.D), A: r3(m.A), xg: m.xg.map(r1), O25: r3(m.O25), btts: r3(m.btts), scores: m.scores.map(([s, q]) => [s, r3(q)]) };
  }).filter(Boolean);

  // each top-division club's next match, for the grey chip ahead of its form
  for (const c of clubs) {
    const f = preds.find((x) => x.home === c.club || x.away === c.club);
    if (f) c.next = { opp: f.home === c.club ? f.awayName : f.homeName, oppSlug: f.home === c.club ? f.awaySlug : f.homeSlug, ha: f.home === c.club ? 'h' : 'a', kickoff: f.kickoff, win: f.home === c.club ? f.H : f.A, draw: f.D };
  }
  // each division's table this season and, where its remaining matches are known (PLACES), where its clubs will finish
  const projected = {};
  for (const div of league.divs) {
    const games = list.filter((m) => m.div === div), now = games.at(-1)?.season, results = games.filter((m) => m.season === now);
    const members = [...divisions].filter(([, d]) => d === div).map(([c]) => c), table = standings(members, results);
    const places = PLACES[div], left = places ? remaining(members, results).map((f) => { const q = price(f.home, f.away, div); return q && { ...f, H: q.m.H, D: q.m.D, A: q.m.A, xg: q.m.xg, dr: q.dr }; }) : [];
    // ratings keep moving inside each simulated season by the Elo's own K and margin (lib/table.mjs says why)
    const eloPrice = (dr) => { const m = markets(dr, p.goals); return [m.H, m.D, ...goals(dr, p.goals)]; };
    const sim = places && left.every(Boolean) ? simulate(table, left, { n: 10000, seed: results.length + 1, hot: { k: p.elo.k, margin: p.elo.margin, price: eloPrice } }) : null;
    if (sim) projected[div === top ? 'top' : 'second'] = { ...places, left: left.length, clubs: members.length };
    // a pending sanction (SCENARIOS): the projection for each outcome, mixed by the outcomes' chances
    const what = SCENARIOS[div], hotOpts = { n: 10000, seed: results.length + 1, hot: { k: p.elo.k, margin: p.elo.margin, price: eloPrice } };
    if (sim && what && members.includes(what.club)) {
      const mix = new Map(members.map((c) => [c, { pts: 0, w: 0, first: 0, top: 0, up: 0, down: 0 }]));
      for (const o of what.outcomes) {
        const out = o.cut === 'expelled';
        const t = out ? standings(members.filter((c) => c !== what.club), results.filter((m) => m.home !== what.club && m.away !== what.club))
          : table.map((r) => (r.club === what.club ? { ...r, pts: r.pts - o.cut } : r));
        const s2 = simulate(t, out ? left.filter((m) => m.home !== what.club && m.away !== what.club) : left, hotOpts), k = t.length;
        if (out) mix.get(what.club).down += o.p;
        for (const [c, f] of s2) {
          const x = mix.get(c), sum = (a, b) => f.pos.slice(a, b).reduce((u, v) => u + v, 0);
          x.pts += o.p * f.pts; x.w += o.p; x.first += o.p * sum(0, 1); x.down += o.p * sum(k - places.down, k);
          if (places.top) x.top += o.p * sum(0, places.top); if (places.up) x.up += o.p * sum(0, places.up);
        }
      }
      projected[div === top ? 'top' : 'second'].what = { club: slug(what.club), label: what.label, note: what.note, outcomes: what.outcomes,
        clubs: Object.fromEntries([...mix].map(([c, x]) => [slug(c), { pts: r1(x.pts / x.w), first: r3(x.first), top: places.top ? r3(x.top) : undefined, up: places.up ? r3(x.up) : undefined, down: r3(x.down) }])) };
    }

    for (const r of table) {
      const c = clubs.find((x) => x.club === r.club);
      if (!c) continue;
      c.table = { pos: r.pos, p: r.p, w: r.w, d: r.d, l: r.l, gf: r.gf, ga: r.ga, pts: r.pts };
      const f = sim?.get(r.club), sum = (a, b) => r3(f.pos.slice(a, b).reduce((t, x) => t + x, 0));
      if (f) c.proj = { pts: r1(f.pts), first: sum(0, 1), top: places.top ? sum(0, places.top) : undefined, up: places.up ? sum(0, places.up) : undefined, down: sum(table.length - places.down, table.length) };
    }
  }

  const updated = new Date().toISOString();
  writeFileSync(`data/${id}/ratings.json`, JSON.stringify({ updated, league: id, name: league.name, through: today, season: label(season), params: p, projected, clubs }, null, 1) + '\n');
  if (!offline || id !== 'pl') writeFileSync(`data/${id}/fixtures.json`, JSON.stringify({ updated, league: id, season: label(season), fixtures: preds }, null, 1) + '\n');
  index.push({ id, name: league.name, short: league.extra ? league.short : league.name, country: league.country, second: league.second, extra: !!league.extra, through: today, top: clubs.filter((c) => c.div === 'top').slice(0, 3).map((c) => [c.name, c.elo]) });
  console.log(`${league.name}: ${clubs.length} clubs through ${today}; top ${clubs.slice(0, 3).map((c) => `${c.name} ${c.elo}`).join(', ')}; ${preds.length} fixtures`);
}
// the coming European matches (UEFA's data, cache/uefa/<comp>-<this season>.json), priced from the one scale: Europe's
// home advantage (none at a neutral ground) and an average league's goals model. Clubs never rated are left out.
const COMP = { cl: 'Champions League', el: 'Europa League', conf: 'Conference League' };
const leagueOfClub2 = new Map(Object.entries(leagues).flatMap(([id, l]) => l.list.flatMap((m) => [[m.home, id], [m.away, id]])));
const shown = (c) => (leagueOfClub2.has(c) ? display(c) : c.replace(/ \(\w+\)$/, ''));
const europeFixtures = [];
for (const comp of Object.keys(COMP)) {
  const f = `cache/uefa/${comp}-${startOf()}.json`;
  if (!existsSync(f)) continue;
  for (const m of JSON.parse(readFileSync(f, 'utf8'))) {
    if (m.status !== 'UPCOMING' || !m.home?.id || !m.away?.id) continue;
    const home = clubOf(m.home), away = clubOf(m.away), eh = ratings.get(home), ea = ratings.get(away);
    if (eh == null || ea == null) continue;
    const neutral = m.type === 'SINGLE' && /final/i.test(m.round ?? ''), dr = eh + (neutral ? 0 : params.europe.hfa) - ea;
    const g = blended({ grid: grid(dr, params.europeGoals), xg: goals(dr, params.europeGoals) }, { grid: grid(dr, params.europeGoals), xg: goals(dr, params.europeGoals) }, 1);
    const lh = leagueOfClub2.get(home) ?? null, la = leagueOfClub2.get(away) ?? null;
    europeFixtures.push({ kickoff: m.time ?? `${m.date}T19:00:00Z`, tbc: !m.time || undefined, comp, compName: COMP[comp], round: m.round, neutral: neutral || undefined,
      home, away, homeName: shown(home), awayName: shown(away), homeLeague: lh, awayLeague: la, homeSlug: lh ? slug(home) : null, awaySlug: la ? slug(away) : null,
      homeCountry: m.home.country, awayCountry: m.away.country, elo: [Math.round(eh), Math.round(ea)], dr: Math.round(dr),
      H: r3(g.H), D: r3(g.D), A: r3(g.A), xg: g.xg.map(r1), O25: r3(g.O25), btts: r3(g.btts), scores: g.scores.map(([sc, q]) => [sc, r3(q)]) });
  }
}
europeFixtures.sort((a, b) => a.kickoff.localeCompare(b.kickoff));
writeFileSync('data/europe-fixtures.json', JSON.stringify({ updated: new Date().toISOString(), fixtures: europeFixtures }, null, 1) + '\n');
console.log(`Europe: ${europeFixtures.length} coming matches priced`);

// the week's movers: every top-division club's rating now against seven days before its league's latest result
const moves = [];
for (const [id, l] of Object.entries(LEAGUES)) {
  const r = JSON.parse(readFileSync(`data/${id}/ratings.json`, 'utf8')), weekAgo = new Date(Date.parse(r.through) - 7 * 86400000).toISOString().slice(0, 10);
  for (const c of r.clubs.filter((c) => c.div === 'top')) {
    const h = history.get(c.club); let before = null;
    for (const x of h) { if (x[0] > weekAgo) break; before = x[1]; }
    if (before != null && h.at(-1)[0] > weekAgo) moves.push({ league: id, leagueName: l.name, slug: c.slug, name: c.name, elo: c.elo, change: c.elo - before });
  }
}
moves.sort((a, b) => b.change - a.change);
writeFileSync('data/movers.json', JSON.stringify({ updated: new Date().toISOString(), up: moves.slice(0, 10), down: moves.slice(-10).reverse() }, null, 1) + '\n');

const tops = [];
for (const id of Object.keys(LEAGUES)) for (const c of JSON.parse(readFileSync(`data/${id}/ratings.json`, 'utf8')).clubs) if (c.div === 'top') tops.push({ ...c, leagueName: LEAGUES[id].name });
writeCard({ through: index.map((l) => l.through).sort().at(-1), clubs: tops.sort((a, b) => b.elo - a.elo) });
// what the page needs to price any two clubs against each other (the head-to-head page): Europe's home advantage and goals model
writeFileSync('data/leagues.json', JSON.stringify({ updated: new Date().toISOString(), leagues: index, europe: { hfa: params.europe.hfa, goals: params.europeGoals } }, null, 1) + '\n');
