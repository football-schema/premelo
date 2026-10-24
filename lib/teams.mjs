// Clubs: football-data's name (the key everywhere in premelo) -> display name, and the three-letter codes matchday
// uses. A name missing here displays as it is.
export const NAMES = {
  'Man City': 'Manchester City', 'Man United': 'Manchester United', "Nott'm Forest": 'Nottingham Forest', Tottenham: 'Tottenham Hotspur',
  Newcastle: 'Newcastle United', Brighton: 'Brighton & Hove Albion', Bournemouth: 'AFC Bournemouth', Leeds: 'Leeds United',
  Coventry: 'Coventry City', Ipswich: 'Ipswich Town', Hull: 'Hull City', 'West Ham': 'West Ham United', Wolves: 'Wolverhampton Wanderers',
  Leicester: 'Leicester City', Norwich: 'Norwich City', Cardiff: 'Cardiff City', Swansea: 'Swansea City', Stoke: 'Stoke City',
  'West Brom': 'West Bromwich Albion', QPR: 'Queens Park Rangers', 'Sheffield Weds': 'Sheffield Wednesday', Birmingham: 'Birmingham City',
  Blackburn: 'Blackburn Rovers', Bolton: 'Bolton Wanderers', Charlton: 'Charlton Athletic', Derby: 'Derby County', Wigan: 'Wigan Athletic',
  Luton: 'Luton Town', Huddersfield: 'Huddersfield Town', Bradford: 'Bradford City', Oldham: 'Oldham Athletic', Peterboro: 'Peterborough United',
  Plymouth: 'Plymouth Argyle', Preston: 'Preston North End', Rotherham: 'Rotherham United', Scunthorpe: 'Scunthorpe United',
  Southend: 'Southend United', Stockport: 'Stockport County', Swindon: 'Swindon Town', Tranmere: 'Tranmere Rovers', Walsall: 'Walsall',
  Wycombe: 'Wycombe Wanderers', Yeovil: 'Yeovil Town', Burton: 'Burton Albion', Colchester: 'Colchester United', Crewe: 'Crewe Alexandra',
  Doncaster: 'Doncaster Rovers', Grimsby: 'Grimsby Town', Lincoln: 'Lincoln City', 'Notts County': 'Notts County', Oxford: 'Oxford United',
  Reading: 'Reading', Gillingham: 'Gillingham', Barnsley: 'Barnsley', Bury: 'Bury', Millwall: 'Millwall', Portsmouth: 'Portsmouth',
  Middlesbrough: 'Middlesbrough', 'Port Vale': 'Port Vale', Wimbledon: 'Wimbledon', Wrexham: 'Wrexham', 'Bristol City': 'Bristol City',
};
export const display = (club) => NAMES[club] ?? club;

// matchday's codes -> football-data's names
export const TLA = {
  ARS: 'Arsenal', AVL: 'Aston Villa', BHA: 'Brighton', BOU: 'Bournemouth', BRE: 'Brentford', BUR: 'Burnley', CHE: 'Chelsea', COV: 'Coventry',
  CRY: 'Crystal Palace', EVE: 'Everton', FUL: 'Fulham', HUL: 'Hull', IPS: 'Ipswich', LEE: 'Leeds', LEI: 'Leicester', LIV: 'Liverpool',
  MCI: 'Man City', MUN: 'Man United', NEW: 'Newcastle', NFO: "Nott'm Forest", SHU: 'Sheffield United', SOU: 'Southampton', SUN: 'Sunderland',
  TOT: 'Tottenham', WHU: 'West Ham', WOL: 'Wolves', LUT: 'Luton', NOR: 'Norwich', WAT: 'Watford', MID: 'Middlesbrough', WBA: 'West Brom',
};

// a club's page: lower case, letters and digits
export const slug = (club) => club.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
