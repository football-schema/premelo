// The leagues premelo rates, in football-data's codes: each league runs its top divisions with its own settings, and the
// European cups tie them together into one scale.
export const LEAGUES = {
  pl: { uefa: 'ENG', name: 'Premier League', country: 'England', short: 'Premier League', divs: ['E0', 'E1'], second: 'Championship', third: 'League One' },
  laliga: { uefa: 'ESP', name: 'La Liga', country: 'Spain', short: 'La Liga', divs: ['SP1', 'SP2'], second: 'Segunda División', third: 'Primera Federación' },
  bundesliga: { uefa: 'GER', name: 'Bundesliga', country: 'Germany', short: 'Bundesliga', divs: ['D1', 'D2'], second: '2. Bundesliga', third: '3. Liga' },
  seriea: { uefa: 'ITA', name: 'Serie A', country: 'Italy', short: 'Serie A', divs: ['I1', 'I2'], second: 'Serie B', third: 'Serie C' },
  ligue1: { uefa: 'FRA', name: 'Ligue 1', country: 'France', short: 'Ligue 1', divs: ['F1', 'F2'], second: 'Ligue 2', third: 'National' },
  // the next six by European pedigree: their top divisions (two in Scotland's case), so their clubs are rated at home too
  primeira: { name: 'Primeira Liga', country: 'Portugal', short: 'Portugal', divs: ['P1'], uefa: 'POR' },
  eredivisie: { name: 'Eredivisie', country: 'Netherlands', short: 'Netherlands', divs: ['N1'], uefa: 'NED' },
  proleague: { name: 'Pro League', country: 'Belgium', short: 'Belgium', divs: ['B1'], uefa: 'BEL' },
  superlig: { name: 'Süper Lig', country: 'Turkey', short: 'Turkey', divs: ['T1'], uefa: 'TUR' },
  scotland: { name: 'Scottish Premiership', country: 'Scotland', short: 'Scotland', divs: ['SC0', 'SC1'], second: 'Championship', uefa: 'SCO' },
  superleague: { name: 'Super League', country: 'Greece', short: 'Greece', divs: ['G1'], uefa: 'GRE' },
  // from football-data's extra-leagues files (new/<code>.csv): 2012 on only, so no holdout to score them on
  austria: { name: 'Austrian Bundesliga', country: 'Austria', short: 'Austria', divs: ['AUT'], uefa: 'AUT', extra: true },
  switzerland: { name: 'Swiss Super League', country: 'Switzerland', short: 'Switzerland', divs: ['SWZ'], uefa: 'SUI', extra: true },
  denmark: { name: 'Danish Superliga', country: 'Denmark', short: 'Denmark', divs: ['DNK'], uefa: 'DEN', extra: true },
  norway: { name: 'Eliteserien', country: 'Norway', short: 'Norway', divs: ['NOR'], uefa: 'NOR', extra: true },
  sweden: { name: 'Allsvenskan', country: 'Sweden', short: 'Sweden', divs: ['SWE'], uefa: 'SWE', extra: true },
  poland: { name: 'Ekstraklasa', country: 'Poland', short: 'Poland', divs: ['POL'], uefa: 'POL', extra: true },
  romania: { name: 'Liga I', country: 'Romania', short: 'Romania', divs: ['ROU'], uefa: 'ROU', extra: true },
  ireland: { name: 'League of Ireland', country: 'Ireland', short: 'Ireland', divs: ['IRL'], uefa: 'IRL', extra: true },
  finland: { name: 'Veikkausliiga', country: 'Finland', short: 'Finland', divs: ['FIN'], uefa: 'FIN', extra: true },
};
export const IDS = Object.keys(LEAGUES);

// a pending sanction the table offers as a button: the projection run once for each outcome (a deduction of `cut` points
// from this season's total, or expulsion: the club's results expunged and its matches dropped) and the results mixed by
// the outcomes' chances. The chances are an editorial estimate of the final outcome, appeals included, not bookmaker prices.
export const SCENARIOS = {
  E0: {
    club: 'Man City', label: 'City sanction',
    note: 'An independent commission found Manchester City guilty of almost all of the Premier League\'s 115 charges in September 2026; no sanction has been set and City say they will appeal.',
    outcomes: [
      { label: 'No points deduction', cut: 0, p: 0.08 }, { label: '1–9 points', cut: 5, p: 0.07 }, { label: '10–19 points', cut: 15, p: 0.15 },
      { label: '20–39 points', cut: 30, p: 0.25 }, { label: '40–59 points', cut: 50, p: 0.25 }, { label: '60+ points', cut: 70, p: 0.15 },
      { label: 'Expulsion', cut: 'expelled', p: 0.05 },
    ],
  },
};

// the divisions played as a plain double round-robin, whose remaining matches are known and so can be projected, with
// their places: top (the top-four column), up (automatic promotion) and down (direct relegation). The leagues left out
// split into championship and relegation rounds, or play each other more than twice.
export const PLACES = {
  E0: { top: 4, down: 3 }, E1: { up: 2, down: 3 }, SP1: { top: 4, down: 3 }, SP2: { up: 2, down: 4 },
  D1: { top: 4, down: 2 }, D2: { up: 2, down: 2 }, I1: { top: 4, down: 3 }, I2: { up: 2, down: 3 },
  F1: { top: 4, down: 2 }, F2: { up: 2, down: 2 }, P1: { top: 4, down: 2 }, N1: { top: 4, down: 2 },
  T1: { top: 4, down: 3 }, POL: { top: 4, down: 3 }, NOR: { top: 4, down: 2 }, SWE: { top: 4, down: 2 },
};
export const leagueOf = (div) => IDS.find((id) => LEAGUES[id].divs.includes(div));

// a league's matches from the season files in cache/ (football-data's own and its extra-leagues files)
import { existsSync, readFileSync } from 'node:fs';
import { seasons } from './seasons.mjs';
import { matches, matchesExtra, byDate } from './results.mjs';
export function load(id, { odds = false, only = null } = {}) {
  const l = LEAGUES[id];
  if (l.extra) { const f = `cache/new/${l.divs[0]}.csv`; return existsSync(f) ? matchesExtra(readFileSync(f, 'utf8'), l.divs[0], { odds }).filter((m) => !only || m.season === only || m.season === only.slice(2) + only.slice(2)).sort(byDate) : []; }
  return (only ? [only] : seasons()).flatMap((s) => l.divs.flatMap((d) => existsSync(`cache/${s}-${d}.csv`) ? matches(readFileSync(`cache/${s}-${d}.csv`, 'utf8'), s, d, { odds }) : [])).sort(byDate);
}
