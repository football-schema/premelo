// cache/ -> data/<league>/results.csv, every match of each league (football-data's season files and extra-leagues
// files), and cache/uefa/ (UEFA's European cup matches) -> data/europe.csv, a neutral-ground match's div being EUN.
//   node scripts/import.mjs
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { toCsv, byDate } from '../lib/results.mjs';
import { LEAGUES, load } from '../lib/leagues.mjs';
import { parse as parseUefa } from '../lib/uefa.mjs';

for (const [id, league] of Object.entries(LEAGUES)) {
  const list = load(id);
  if (!list.length) { console.log(`${league.name}: nothing in cache/`); continue; }
  mkdirSync(`data/${id}`, { recursive: true });
  writeFileSync(`data/${id}/results.csv`, toCsv(list));
  console.log(`${league.name}: ${list.length} matches, ${list[0].date} to ${list.at(-1).date}`);
}

const eu = existsSync('cache/uefa') ? readdirSync('cache/uefa').filter((f) => f.endsWith('.json')).sort().flatMap((f) => parseUefa(JSON.parse(readFileSync(`cache/uefa/${f}`, 'utf8')), f.split('-')[0])) : [];
if (eu.length) {
  writeFileSync('data/europe.csv', toCsv(eu.map((m) => ({ ...m, div: m.neutral ? 'EUN' : 'EU' })).sort(byDate)));
  console.log(`European cups: ${eu.length} matches, ${eu.map((m) => m.date).sort()[0]} on`);
}
