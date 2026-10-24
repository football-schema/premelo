// Fetches football-data.co.uk's season files for every league's top two divisions (lib/leagues.mjs) into cache/,
// one request a second. Files already cached are kept, except the current season's, which is fetched again.
//   node scripts/fetch.mjs            every season since 1993-94
//   node scripts/fetch.mjs --current  this season only (what the nightly update does)
// (The European cups come from UEFA: scripts/fetch-uefa.mjs.) football-data's files are theirs: they stay in cache/ and aren't published. What's published is derived from them:
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
    const url = `https://football-data.co.uk/mmz4281/${season}/${div}.csv`;
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

