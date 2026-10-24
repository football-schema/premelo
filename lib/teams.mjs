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
  // Spain
  'Ath Bilbao': 'Athletic Club', 'Ath Madrid': 'Atlético Madrid', Betis: 'Real Betis', Sociedad: 'Real Sociedad', Celta: 'Celta Vigo',
  Espanol: 'Espanyol', Vallecano: 'Rayo Vallecano', Alaves: 'Alavés', Cadiz: 'Cádiz', Almeria: 'Almería', 'La Coruna': 'Deportivo La Coruña',
  'Sp Gijon': 'Sporting Gijón', Santander: 'Racing Santander', Malaga: 'Málaga', Leganes: 'Leganés', Gimnastic: 'Gimnàstic',
  Cordoba: 'Córdoba', Mirandes: 'Mirandés', Logrones: 'Logroñés', Elche: 'Elche', Oviedo: 'Real Oviedo', Valladolid: 'Real Valladolid', Zaragoza: 'Real Zaragoza',
  // Germany
  'Bayern Munich': 'Bayern Munich', Dortmund: 'Borussia Dortmund', "M'gladbach": "Borussia M'gladbach", 'Ein Frankfurt': 'Eintracht Frankfurt',
  'FC Koln': '1. FC Köln', Leverkusen: 'Bayer Leverkusen', Hertha: 'Hertha BSC', Mainz: 'Mainz 05', Nurnberg: '1. FC Nürnberg',
  'Greuther Furth': 'Greuther Fürth', 'Fortuna Dusseldorf': 'Fortuna Düsseldorf', Hamburg: 'Hamburger SV', Hannover: 'Hannover 96',
  Stuttgart: 'VfB Stuttgart', Bochum: 'VfL Bochum', Wolfsburg: 'VfL Wolfsburg', Freiburg: 'SC Freiburg', Augsburg: 'FC Augsburg',
  Bielefeld: 'Arminia Bielefeld', Osnabruck: 'VfL Osnabrück', 'Munich 1860': '1860 Munich', Wehen: 'Wehen Wiesbaden', Darmstadt: 'Darmstadt 98',
  // Italy
  Inter: 'Inter', Milan: 'AC Milan', Roma: 'AS Roma', Verona: 'Hellas Verona', Spal: 'SPAL', Sudtirol: 'Südtirol', Chievo: 'Chievo Verona',
  // France
  'Paris SG': 'Paris Saint-Germain', 'St Etienne': 'Saint-Étienne', Nimes: 'Nîmes', Lyon: 'Olympique Lyonnais', Marseille: 'Olympique de Marseille',
};
export const display = (club) => NAMES[club] ?? club;

// one club under two names in football-data's files
export const ALIASES = { Leonesa: 'Cultural Leonesa' };
export const canonical = (club) => ALIASES[club] ?? club;

// matchday's codes -> football-data's names
export const TLA = {
  ARS: 'Arsenal', AVL: 'Aston Villa', BHA: 'Brighton', BOU: 'Bournemouth', BRE: 'Brentford', BUR: 'Burnley', CHE: 'Chelsea', COV: 'Coventry',
  CRY: 'Crystal Palace', EVE: 'Everton', FUL: 'Fulham', HUL: 'Hull', IPS: 'Ipswich', LEE: 'Leeds', LEI: 'Leicester', LIV: 'Liverpool',
  MCI: 'Man City', MUN: 'Man United', NEW: 'Newcastle', NFO: "Nott'm Forest", SHU: 'Sheffield United', SOU: 'Southampton', SUN: 'Sunderland',
  TOT: 'Tottenham', WHU: 'West Ham', WOL: 'Wolves', LUT: 'Luton', NOR: 'Norwich', WAT: 'Watford', MID: 'Middlesbrough', WBA: 'West Brom',
};

// a club's page: lower case, plain letters and digits ('Preußen Münster' -> preussen-munster)
export const slug = (club) => club.replace(/ß/g, 'ss').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
