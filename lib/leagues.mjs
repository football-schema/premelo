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
};
export const IDS = Object.keys(LEAGUES);
export const leagueOf = (div) => IDS.find((id) => LEAGUES[id].divs.includes(div));
