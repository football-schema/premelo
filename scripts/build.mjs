// data/results.csv (+ matchday's newer results) -> the published ratings and predictions:
//   data/ratings.json        every club of this season's Premier League and Championship, rated and ranked
//   data/clubs/<slug>.json   a club's rating after each of its matches since 1993
//   data/fixtures.json       the Premier League's remaining fixtures, each with its probabilities
//   card.svg, card.png       the link-preview card, with the top six as they stand
//   node scripts/build.mjs [--offline]   (--offline: without matchday, from results.csv alone)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fromCsv, byDate } from '../lib/results.mjs';
import { run } from '../lib/elo.mjs';
import { markets } from '../lib/goals.mjs';
import { display, slug } from '../lib/teams.mjs';
import { currentSeason, label } from '../lib/seasons.mjs';
import { fetchSeason } from '../lib/matchday.mjs';
import { writeCard } from './card.mjs';

const params = JSON.parse(readFileSync('params.json', 'utf8'));
const season = currentSeason(), list = fromCsv(readFileSync('data/results.csv', 'utf8'));
const r1 = (x) => Math.round(x * 10) / 10, r3 = (x) => Math.round(x * 1000) / 1000;

// matchday's results that football-data hasn't got yet (each pairing is played once a season)
let fixtures = [];
if (!process.argv.includes('--offline')) {
  const md = await fetchSeason(label(season));
  const have = new Set(list.filter((m) => m.season === season && m.div === 'E0').map((m) => `${m.home}|${m.away}`));
  const extra = md.filter((m) => m.status === 'finished' && m.ft && !have.has(`${m.home}|${m.away}`))
    .map((m) => ({ date: m.kickoff.slice(0, 10), season, div: 'E0', home: m.home, away: m.away, hg: m.ft[0], ag: m.ft[1] }));
  if (extra.length) console.log(`${extra.length} newer results from matchday: ${extra.map((m) => `${m.home} ${m.hg}-${m.ag} ${m.away}`).join(', ')}`);
  list.push(...extra); list.sort(byDate);
  const done = new Set(list.filter((m) => m.season === season && m.div === 'E0').map((m) => `${m.home}|${m.away}`));
  fixtures = md.filter((m) => m.status !== 'finished' && m.status !== 'postponed' && !done.has(`${m.home}|${m.away}`)).sort((a, b) => a.kickoff.localeCompare(b.kickoff));
}

const { ratings, history, divisions } = run(list, params.elo, { history: true });
const today = list.at(-1).date, monthAgo = new Date(Date.parse(today) - 30 * 86400_000).toISOString().slice(0, 10);
const seasonStart = `${label(season).slice(0, 4)}-07-01`;
const ratingOn = (h, date) => { let r = null; for (const x of h) { if (x[0] > date) break; r = x[1]; } return r; };

const clubs = [...divisions].map(([club, div]) => {
  const h = history.get(club), played = h.filter((x) => x[0] >= seasonStart).length;
  const form = h.slice(-5).map((x) => (x[3] > x[4] ? 'W' : x[3] === x[4] ? 'D' : 'L')).join('');
  const before = ratingOn(h, monthAgo) ?? h[0][1];
  return { club, name: display(club), slug: slug(club), div, elo: Math.round(ratings.get(club)), change30: Math.round(ratings.get(club) - before), played, form, spark: h.slice(-20).map((x) => x[1]) };
}).sort((a, b) => b.elo - a.elo);
for (const div of ['E0', 'E1']) clubs.filter((c) => c.div === div).forEach((c, i) => { c.rank = i + 1; });
clubs.forEach((c, i) => { c.overall = i + 1; });

mkdirSync('data/clubs', { recursive: true });
for (const [club, h] of history) writeFileSync(`data/clubs/${slug(club)}.json`, JSON.stringify({ club, name: display(club), history: h }) + '\n');

const preds = fixtures.map((f) => {
  const eh = ratings.get(f.home), ea = ratings.get(f.away);
  if (eh == null || ea == null) return null;
  const dr = eh + params.elo.hfa - ea, m = markets(dr, params.goals);
  return { kickoff: f.kickoff, gw: f.gw, tbc: f.tbc || undefined, home: f.home, away: f.away, homeName: display(f.home), awayName: display(f.away), elo: [Math.round(eh), Math.round(ea)], dr: Math.round(dr),
    H: r3(m.H), D: r3(m.D), A: r3(m.A), xg: m.xg.map(r1), O25: r3(m.O25), btts: r3(m.btts), scores: m.scores.map(([s, p]) => [s, r3(p)]) };
}).filter(Boolean);

const updated = new Date().toISOString();
writeFileSync('data/ratings.json', JSON.stringify({ updated, through: today, season: label(season), params, clubs }, null, 1) + '\n');
writeCard({ through: today, clubs });
writeFileSync('data/fixtures.json', JSON.stringify({ updated, season: label(season), fixtures: preds }, null, 1) + '\n');
console.log(`${clubs.length} clubs rated through ${today}; top: ${clubs.slice(0, 5).map((c) => `${c.name} ${c.elo}`).join(', ')}; ${preds.length} fixtures predicted`);
