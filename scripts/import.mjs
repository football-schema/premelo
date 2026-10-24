// cache/ (football-data's season files) -> data/<league>/results.csv, every match of each league's top two divisions.
//   node scripts/import.mjs            every cached season
//   node scripts/import.mjs --current  replace only this season's matches (after a matchday)
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { seasons, currentSeason } from '../lib/seasons.mjs';
import { matches, toCsv, fromCsv, byDate } from '../lib/results.mjs';
import { LEAGUES } from '../lib/leagues.mjs';

const only = process.argv.includes('--current') ? currentSeason() : null;
for (const [id, league] of Object.entries(LEAGUES)) {
  const file = `data/${id}/results.csv`;
  const read = (season) => league.divs.flatMap((div) => { const f = `cache/${season}-${div}.csv`; return existsSync(f) ? matches(readFileSync(f, 'utf8'), season, div) : []; });
  const list = only ? [...fromCsv(readFileSync(file, 'utf8')).filter((m) => m.season !== only), ...read(only)] : seasons().flatMap(read);
  list.sort(byDate);
  mkdirSync(`data/${id}`, { recursive: true });
  writeFileSync(file, toCsv(list));
  console.log(`${league.name}: ${list.length} matches, ${list[0].date} to ${list.at(-1).date}`);
}
