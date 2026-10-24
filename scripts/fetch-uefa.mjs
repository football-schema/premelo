// UEFA's own match data (match.uefa.com, the API behind uefa.com): every Champions League, UEFA Cup / Europa League and
// Conference League match since 1993-94, qualifiers included, into cache/uefa/<competition>-<season start>.json.
// One request a second; finished seasons are kept, the current one is fetched again.
//   node scripts/fetch-uefa.mjs [--current]
// Only the results are used: dates, clubs, 90-minute scores, whether the match was a final.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { startOf } from '../lib/seasons.mjs';

const COMPS = { cl: 1, el: 14, conf: 2019 }; // 14 holds the UEFA Cup before it became the Europa League
const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms));
mkdirSync('cache/uefa', { recursive: true });
const now = startOf(), first = process.argv.includes('--current') ? now : 1993;
for (let y = first; y <= now; y++) for (const [name, id] of Object.entries(COMPS)) {
  const file = `cache/uefa/${name}-${y}.json`;
  if (existsSync(file) && y !== now) continue;
  if (name === 'conf' && y < 2021) continue;
  const out = [];
  for (let offset = 0; ; offset += 100) {
    const url = `https://match.uefa.com/v5/matches?competitionId=${id}&fromDate=${y}-07-01&toDate=${y + 1}-06-30&limit=100&offset=${offset}&order=ASC`;
    const r = await fetch(url, { headers: { 'user-agent': 'premelo (github.com/football-schema/premelo)', accept: 'application/json' } });
    if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
    const page = await r.json();
    // keep only what's used
    for (const m of page) out.push({ id: m.id, date: m.kickOffTime?.date, status: m.status, round: m.round?.metaData?.name ?? null, type: m.type ?? null,
      home: { id: m.homeTeam?.id, name: m.homeTeam?.internationalName, country: m.homeTeam?.countryCode }, away: { id: m.awayTeam?.id, name: m.awayTeam?.internationalName, country: m.awayTeam?.countryCode },
      regular: m.score?.regular ?? null, total: m.score?.total ?? null });
    await sleep(1000);
    if (page.length < 100) break;
  }
  writeFileSync(file, JSON.stringify(out) + '\n');
  console.log(`${name} ${y}-${String(y + 1).slice(2)}: ${out.length} matches`);
}
