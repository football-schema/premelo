// data/<league>/results.csv (+ the newest results and the coming fixtures) -> the published ratings and predictions:
//   data/<league>/ratings.json        every club of the league's top two divisions this season, rated and ranked
//   data/<league>/clubs/<slug>.json   a club's rating after each of its matches since 1993
//   data/<league>/fixtures.json       the coming top-division fixtures, each with its probabilities
//   data/leagues.json                 the leagues, for the page's switcher
//   card.svg, card.png                the link-preview card, with the Premier League's top six as they stand
// The Premier League's newest results and its whole fixture list come from matchday; the other leagues' fixtures
// from football-data's fixtures.csv, which has the next week or so.
//   node scripts/build.mjs [--offline]   (--offline: from the results files alone, no fixtures)
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { fromCsv, byDate, parseCsv, isoDate } from '../lib/results.mjs';
import { run } from '../lib/elo.mjs';
import { markets } from '../lib/goals.mjs';
import { display, slug, canonical } from '../lib/teams.mjs';
import { currentSeason, label, ukToUtc } from '../lib/seasons.mjs';
import { fetchSeason } from '../lib/matchday.mjs';
import { LEAGUES } from '../lib/leagues.mjs';
import { writeCard } from './card.mjs';

const params = JSON.parse(readFileSync('params.json', 'utf8'));
const season = currentSeason(), offline = process.argv.includes('--offline');
const r1 = (x) => Math.round(x * 10) / 10, r3 = (x) => Math.round(x * 1000) / 1000;
const pair = (m) => `${m.home}|${m.away}`;

const upcoming = offline ? [] : await fetch('https://www.football-data.co.uk/fixtures.csv', { headers: { 'user-agent': 'premelo (github.com/football-schema/premelo)' } })
  .then((r) => (r.ok ? r.text() : '')).then((t) => (t ? parseCsv(t) : [])).catch(() => []);

const index = [];
for (const [id, league] of Object.entries(LEAGUES)) {
  const p = params[id], top = league.divs[0], list = fromCsv(readFileSync(`data/${id}/results.csv`, 'utf8'));
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
    fixtures = upcoming.filter((r) => r.Div === top && isoDate(r.Date)).map((r) => ({ kickoff: ukToUtc(isoDate(r.Date), r.Time || undefined), home: canonical(r.HomeTeam), away: canonical(r.AwayTeam), tbc: !r.Time }))
      .filter((f) => !done.has(pair(f)));
  }
  // a match more than two hours past kick-off is played, whether or not its result is in yet
  fixtures = fixtures.filter((f) => Date.parse(f.kickoff) > Date.now() - 2 * 3600_000).sort((a, b) => a.kickoff.localeCompare(b.kickoff));

  const { ratings, history, divisions } = run(list, p.elo, { history: true, divs: league.divs });
  const today = list.at(-1).date, monthAgo = new Date(Date.parse(today) - 30 * 86400_000).toISOString().slice(0, 10);
  const seasonStart = `${label(season).slice(0, 4)}-07-01`;
  const ratingOn = (h, date) => { let r = null; for (const x of h) { if (x[0] > date) break; r = x[1]; } return r; };
  const clubs = [...divisions].map(([club, div]) => {
    const h = history.get(club), played = h.filter((x) => x[0] >= seasonStart).length;
    const form = h.slice(-5).map((x) => (x[3] > x[4] ? 'W' : x[3] === x[4] ? 'D' : 'L')).join('');
    const before = ratingOn(h, monthAgo) ?? h[0][1];
    return { club, name: display(club), slug: slug(club), div: div === top ? 'top' : 'second', elo: Math.round(ratings.get(club)), change30: Math.round(ratings.get(club) - before), played, form, spark: h.slice(-20).map((x) => x[1]) };
  }).sort((a, b) => b.elo - a.elo);
  for (const div of ['top', 'second']) clubs.filter((c) => c.div === div).forEach((c, i) => { c.rank = i + 1; });

  rmSync(`data/${id}/clubs`, { recursive: true, force: true });
  mkdirSync(`data/${id}/clubs`, { recursive: true });
  for (const [club, h] of history) writeFileSync(`data/${id}/clubs/${slug(club)}.json`, JSON.stringify({ club, name: display(club), history: h.map((x) => [...x.slice(0, 6), x[6] === top ? 'top' : 'second']) }) + '\n');

  const preds = fixtures.map((f) => {
    const eh = ratings.get(f.home), ea = ratings.get(f.away);
    if (eh == null || ea == null) { console.log(`${league.name}: no rating for ${eh == null ? f.home : f.away}, fixture left out`); return null; }
    const dr = eh + p.elo.hfa - ea, m = markets(dr, p.goals);
    return { kickoff: f.kickoff, gw: f.gw, tbc: f.tbc || undefined, home: f.home, away: f.away, homeSlug: slug(f.home), awaySlug: slug(f.away), homeName: display(f.home), awayName: display(f.away),
      elo: [Math.round(eh), Math.round(ea)], dr: Math.round(dr), H: r3(m.H), D: r3(m.D), A: r3(m.A), xg: m.xg.map(r1), O25: r3(m.O25), btts: r3(m.btts), scores: m.scores.map(([s, q]) => [s, r3(q)]) };
  }).filter(Boolean);

  const updated = new Date().toISOString();
  writeFileSync(`data/${id}/ratings.json`, JSON.stringify({ updated, league: id, name: league.name, through: today, season: label(season), params: p, clubs }, null, 1) + '\n');
  if (!offline || id !== 'pl') writeFileSync(`data/${id}/fixtures.json`, JSON.stringify({ updated, league: id, season: label(season), fixtures: preds }, null, 1) + '\n');
  if (id === 'pl') writeCard({ through: today, clubs: clubs.map((c) => ({ ...c, div: c.div === 'top' ? 'E0' : 'E1' })) });
  index.push({ id, name: league.name, country: league.country, second: league.second, through: today, top: clubs.filter((c) => c.div === 'top').slice(0, 3).map((c) => [c.name, c.elo]) });
  console.log(`${league.name}: ${clubs.length} clubs through ${today}; top ${clubs.slice(0, 3).map((c) => `${c.name} ${c.elo}`).join(', ')}; ${preds.length} fixtures`);
}
writeFileSync('data/leagues.json', JSON.stringify({ updated: new Date().toISOString(), leagues: index }, null, 1) + '\n');
