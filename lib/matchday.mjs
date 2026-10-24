// This season's Premier League fixtures and latest results from matchday (https://melvin.me/public/matchday/),
// one JSON-LD document a matchweek in the Football Schema vocabulary. football-data's files run a few days
// behind, so matchday's results fill the gap, and its fixtures are what the predictions are for.
import { TLA } from './teams.mjs';

export const BASE = process.env.MATCHDAY ?? 'https://melvin.me/public/matchday/data';
const code = (ref) => /([A-Z]{3})\.jsonld/.exec(ref ?? '')?.[1];
const score = (s) => (s && Number.isInteger(s.home) && Number.isInteger(s.away) ? [s.home, s.away] : null);

// one Match node -> { kickoff, gw, home, away, status, ft }, clubs under football-data's names
export function parseMatch(m) {
  const h = code(m.homeTeam), a = code(m.awayTeam);
  return { kickoff: new Date(m.kickoff).toISOString(), gw: m.matchweek, home: TLA[h] ?? h, away: TLA[a] ?? a, status: m.status, ft: score(m.fullTime), tbc: m.timeConfirmed === false };
}

// label: the season as matchday names it, '2026-27'
export async function fetchSeason(label) {
  const get = async (i) => {
    const r = await fetch(`${BASE}/matches/${label}/mw${String(i).padStart(2, '0')}.jsonld`, { signal: AbortSignal.timeout(20_000) });
    if (!r.ok) throw new Error(`matchday mw${i}: HTTP ${r.status}`);
    return ((await r.json())['@graph'] ?? []).filter((n) => n['@type'] === 'Match').map(parseMatch);
  };
  const out = [];
  for (let i = 1; i <= 38; i++) out.push(...await get(i)); // one at a time: it's someone's own site
  return out;
}
