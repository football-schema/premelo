// cache/ (football-data's season files) -> data/results.csv, every match of the Premier League and the Championship.
//   node scripts/import.mjs            every cached season
//   node scripts/import.mjs --current  replace only this season's matches (the nightly update)
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { seasons, currentSeason } from '../lib/seasons.mjs';
import { matches, toCsv, fromCsv, byDate } from '../lib/results.mjs';

const FILE = 'data/results.csv';
const only = process.argv.includes('--current') ? currentSeason() : null;
const read = (season) => ['E0', 'E1'].flatMap((div) => { const f = `cache/${season}-${div}.csv`; return existsSync(f) ? matches(readFileSync(f, 'utf8'), season, div) : []; });

let list;
if (only) list = [...fromCsv(readFileSync(FILE, 'utf8')).filter((m) => m.season !== only), ...read(only)];
else list = seasons().flatMap(read);
list.sort(byDate);
mkdirSync('data', { recursive: true });
writeFileSync(FILE, toCsv(list));
console.log(`${list.length} matches in ${FILE}, ${list[0].date} to ${list.at(-1).date}`);
