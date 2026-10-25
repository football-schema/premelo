// This season's Premier League fixtures and latest results from matchday (https://melvin.me/public/matchday/),
// published in the Football Schema vocabulary. football-data's files run a few days behind, so matchday's results
// fill the gap, and its fixtures are what the predictions are for. One address is all it takes: matchday's Dataset,
// which football-schema's loadLinked() follows to the season, its matches and its clubs.
import { loadSchema, loadLinked } from 'football-schema/model.js';
import { validate } from 'football-schema/validate.js';

export const DATASET = process.env.MATCHDAY ?? 'https://melvin.me/public/matchday/data/dataset.jsonld';
const score = (s) => (s && Number.isInteger(s.home) && Number.isInteger(s.away) ? [s.home, s.away] : null);

// a club as premelo names it (football-data's names): the first of its short name and the other names it goes by
// that premelo has results under, else its short name
export const nameFor = (club, known) => [club.shortName, ...(club.altNames ?? []), club.name].find((n) => known.has(n)) ?? club.shortName;

// one Match node -> { kickoff, gw, home, away, status, ft }; name maps a club IRI to premelo's name for it
export function parseMatch(m, name) {
  return { kickoff: new Date(m.kickoff).toISOString(), gw: m.matchweek, home: name(m.homeTeam), away: name(m.awayTeam), status: m.status, ft: score(m.fullTime), tbc: m.timeConfirmed === false };
}

// label: the season as premelo names it, '2026-27'; known: the club names premelo has results under
export async function fetchSeason(label, known = new Set()) {
  const g = await loadLinked(DATASET);
  const problems = validate(await loadSchema(), g);
  if (problems.length) console.log(`matchday: ${problems.length} problems in its data, e.g. ${problems[0]}`);
  const season = g.nodes.find((n) => n['@type'] === 'Season' && n.label === label.replace('-', '/'));
  if (!season) throw new Error(`matchday has no season ${label} (${DATASET})`);
  const name = (iri) => nameFor(g.byId.get(iri), known);
  return season.matches.map((id) => g.byId.get(id)).filter(Boolean).map((m) => parseMatch(m, name));
}
