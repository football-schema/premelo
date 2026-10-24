// Fetches football-data.co.uk's season files for the Premier League (E0) and the Championship (E1) into cache/,
// one request a second. Files already cached are kept, except the current season's, which is fetched again.
//   node scripts/fetch.mjs            every season since 1993-94
//   node scripts/fetch.mjs --current  this season only (what the nightly update does)
// The files are football-data's: they stay in cache/ and aren't published. What's published is derived from them:
// the results (facts) and our own ratings.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { seasons, currentSeason } from '../lib/seasons.mjs';

const DIVS = ['E0', 'E1'];
const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms));
mkdirSync('cache', { recursive: true });

const list = process.argv.includes('--current') ? [currentSeason()] : seasons();
for (const season of list) {
  for (const div of DIVS) {
    const file = `cache/${season}-${div}.csv`;
    if (existsSync(file) && season !== currentSeason()) continue;
    const url = `https://www.football-data.co.uk/mmz4281/${season}/${div}.csv`;
    const r = await fetch(url, { headers: { 'user-agent': 'premelo (Premier League Elo; github.com/melvincarvalho/premelo)' } });
    if (r.status === 404) { console.log(`${season} ${div}: not published yet`); continue; }
    if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
    writeFileSync(file, Buffer.from(await r.arrayBuffer()));
    console.log(`${season} ${div}: fetched`);
    await sleep(1000);
  }
}
