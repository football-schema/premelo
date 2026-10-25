#!/usr/bin/env node
// premelo's Premier League ratings and predictions in the Football Schema's forecast vocabulary, so any project can
// read and score them: each points at the match, club or season in matchday's data, the dataset they are about.
//
//   node scripts/export-schema.mjs
//     reads  data/pl/ratings.json, data/pl/fixtures.json and matchday's Dataset (lib/matchday.mjs)
//     writes data/pl/forecasts.jsonld   a ForecastModel, a Rating per club, a MatchForecast per coming match,
//                                       a SeasonProjection per club (as things stand, and under the open scenario)
//            data/dataset.jsonld        premelo's own Dataset, which includes it
import { readFileSync, writeFileSync } from 'node:fs';
import { loadSchema, loadLinked } from 'football-schema/model.js';
import { validate } from 'football-schema/validate.js';
import schemaPkg from 'football-schema/package.json' with { type: 'json' };
import { DATASET, nameFor } from '../lib/matchday.mjs';

const CONTEXT = 'https://football-schema.github.io/schema/context.jsonld';
const ratings = JSON.parse(readFileSync('data/pl/ratings.json', 'utf8'));
const { updated, fixtures } = JSON.parse(readFileSync('data/pl/fixtures.json', 'utf8'));

// matchday's season, and its clubs and matches under premelo's names
const md = await loadLinked(DATASET);
const season = md.nodes.find((n) => n['@type'] === 'Season' && n.label === ratings.season.replace('-', '/') && n.coverage !== 'partial');
if (!season) throw new Error(`matchday has no season ${ratings.season}`);
const known = new Set(ratings.clubs.map((c) => c.club));
const clubIri = new Map(season.clubs.map((iri) => [nameFor(md.byId.get(iri), known), iri]));
const name = (iri) => nameFor(md.byId.get(iri), known);
const matchIri = new Map(season.matches.map((id) => md.byId.get(id)).map((m) => [`${name(m.homeTeam)}|${name(m.awayTeam)}`, m['@id']]));

const model = '#model';
const graph = [{
  '@id': model, '@type': 'ForecastModel', name: 'premelo',
  modelVersion: ratings.through,
  method: 'Elo ratings for twenty European leagues on one scale, blended with an attack and defence goals model into a Poisson score grid; season projections from 10,000 simulations.',
  seeAlso: 'https://github.com/football-schema/premelo#readme',
}];
const top = ratings.clubs.filter((c) => c.div === 'top' && clubIri.has(c.club));
for (const c of top) graph.push({ '@type': 'Rating', club: clubIri.get(c.club), model, value: c.elo, asOf: ratings.through, rank: c.rank });

let skipped = 0;
for (const f of fixtures) {
  const fixture = matchIri.get(`${f.home}|${f.away}`);
  // a forecast counts only if it was made before kick-off
  if (!fixture || f.kickoff <= updated) { skipped++; continue; }
  graph.push({
    '@type': 'MatchForecast', fixture, model, issued: updated,
    homeWin: f.H, draw: f.D, awayWin: f.A,
    expectedHomeGoals: f.xg[0], expectedAwayGoals: f.xg[1], bothTeamsScore: f.btts,
    goalLines: [{ '@type': 'GoalLine', line: 2.5, over: f.O25 }],
    scores: f.scores.map(([s, chance]) => { const [home, away] = s.split('-').map(Number); return { '@type': 'ScoreChance', home, away, chance }; }),
  });
}

const projection = (c, p, scenario) => ({
  '@type': 'SeasonProjection', club: clubIri.get(c.club), season: season['@id'], model, issued: ratings.updated,
  expectedPoints: p.pts, positions: p.pos, ...(scenario ? { scenario } : {}),
});
const what = ratings.projected?.top?.what;
for (const c of top) {
  if (c.proj) graph.push(projection(c, c.proj));
  const alt = what?.clubs?.[c.slug];
  if (alt) graph.push(projection(c, alt, `${what.label}: ${what.note}`));
}

const doc = (nodes) => JSON.stringify({ '@context': CONTEXT, '@graph': nodes }, null, 1) + '\n';
writeFileSync('data/pl/forecasts.jsonld', doc(graph));
writeFileSync('data/dataset.jsonld', doc([{
  '@id': '#this', '@type': 'Dataset', name: 'premelo: Premier League ratings and forecasts',
  publisher: 'premelo (https://github.com/football-schema/premelo)', updated: ratings.updated, schemaVersion: schemaPkg.version,
  includes: ['pl/forecasts.jsonld'], source: [DATASET, 'https://www.football-data.co.uk'], seeAlso: 'https://football-schema.github.io/premelo/',
}]));

// check what was written, with the matchday documents it points at
const problems = validate(await loadSchema(), await loadLinked(new URL('../data/dataset.jsonld', import.meta.url)));
const count = (t) => graph.filter((n) => n['@type'] === t).length;
console.log(`schema export: ${count('Rating')} ratings, ${count('MatchForecast')} match forecasts (${skipped} skipped), ${count('SeasonProjection')} season projections; ${problems.length} problems${problems.length ? `, e.g. ${problems[0]}` : ''}`);
