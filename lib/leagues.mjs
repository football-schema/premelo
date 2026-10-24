// The leagues premelo rates: each country is its own Elo pool of its top two divisions, in football-data's codes.
// Ratings compare clubs within a country only: without European cup results nothing ties one pool to another.
export const LEAGUES = {
  pl: { name: 'Premier League', country: 'England', short: 'Premier League', divs: ['E0', 'E1'], second: 'Championship', third: 'League One' },
  laliga: { name: 'La Liga', country: 'Spain', short: 'La Liga', divs: ['SP1', 'SP2'], second: 'Segunda División', third: 'Primera Federación' },
  bundesliga: { name: 'Bundesliga', country: 'Germany', short: 'Bundesliga', divs: ['D1', 'D2'], second: '2. Bundesliga', third: '3. Liga' },
  seriea: { name: 'Serie A', country: 'Italy', short: 'Serie A', divs: ['I1', 'I2'], second: 'Serie B', third: 'Serie C' },
  ligue1: { name: 'Ligue 1', country: 'France', short: 'Ligue 1', divs: ['F1', 'F2'], second: 'Ligue 2', third: 'National' },
};
export const IDS = Object.keys(LEAGUES);
export const leagueOf = (div) => IDS.find((id) => LEAGUES[id].divs.includes(div));
