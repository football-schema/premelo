// Fetches football-data.co.uk's season files for every league's top two divisions (lib/leagues.mjs) into cache/,
// one request a second. Files already cached are kept, except the current season's, which is fetched again.
//   node scripts/fetch.mjs            every season since 1993-94
//   node scripts/fetch.mjs --current  this season only (what the nightly update does)
// Then the European cups from openfootball. football-data's files are theirs: they stay in cache/ and aren't published. What's published is derived from them:
// the results (facts) and our own ratings.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { seasons, currentSeason } from '../lib/seasons.mjs';
import { LEAGUES } from '../lib/leagues.mjs';

const DIVS = Object.values(LEAGUES).flatMap((l) => l.divs);
const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms));
mkdirSync('cache', { recursive: true });

const list = process.argv.includes('--current') ? [currentSeason()] : seasons();
for (const season of list) {
  for (const div of DIVS) {
    const file = `cache/${season}-${div}.csv`;
    if (existsSync(file) && season !== currentSeason()) continue;
    const url = `https://www.football-data.co.uk/mmz4281/${season}/${div}.csv`;
    const r = await fetch(url, { headers: { 'user-agent': 'premelo (Premier League Elo; github.com/football-schema/premelo)' } });
    // a season they don't have answers 404 or 300 (Serie B before 1997-98, for one)
    if (r.status === 404 || r.status === 300) { console.log(`${season} ${div}: not published`); await sleep(1000); continue; }
    if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
    const body = Buffer.from(await r.arrayBuffer());
    if (!/^(\uFEFF)?Div,/.test(body.toString('utf8', 0, 10))) { console.log(`${season} ${div}: not a season file, skipped`); await sleep(1000); continue; }
    writeFileSync(file, body);
    console.log(`${season} ${div}: fetched`);
    await sleep(1000);
  }
}

// the European cups from openfootball (CC0): the Champions League from 2011-12, the Europa and Conference Leagues from 2020-21
mkdirSync('cache/europe', { recursive: true });
const RAW = 'https://raw.githubusercontent.com/openfootball/champions-league/master';
const euSeasons = list.map((c) => { const y = Number(c.slice(0, 2)); const start = y >= 90 ? 1900 + y : 2000 + y; return `${start}-${c.slice(2)}`; }).filter((s) => s >= '2011-12');
for (const season of euSeasons) for (const comp of ['cl', 'el', 'conf']) {
  const file = `cache/europe/${season}-${comp}.txt`;
  if (existsSync(file) && season !== euSeasons.at(-1) && !process.argv.includes('--current')) continue;
  const r = await fetch(`${RAW}/${season}/${comp}.txt`);
  if (r.ok) { writeFileSync(file, await r.text()); console.log(`${season} ${comp}: fetched`); }
  await sleep(300);
}
