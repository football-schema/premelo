// European cup results from openfootball's champions-league repository (CC0: https://github.com/openfootball/champions-league),
// Football.TXT like
//   ▪ Group, Matchday 1
//     Tue Sep 19 2023
//       18:45  AC Milan (ITA)          v Newcastle United FC (ENG)  0-0
//              BSC Young Boys (SUI)    v RB Leipzig (GER)         1-3 (1-1)
// These are what tie the five countries' pools together: the only matches between clubs of different countries.
import { EUROPE as NAMES } from './teams.mjs';

const MONTHS = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12 };
export const COUNTRIES = { ENG: 'pl', ESP: 'laliga', GER: 'bundesliga', ITA: 'seriea', FRA: 'ligue1' };

// a club as premelo knows it: football-data's name for the five countries' clubs, else "<name> (<country>)"
export function club(name, country) {
  const n = name.trim();
  return COUNTRIES[country] ? (NAMES[`${n} (${country})`] ?? `?${n} (${country})`) : `${n} (${country})`;
}

// the score after 90 minutes: "2-1 (1-0)" is 2-1; "3-2 pen. 1-1 a.e.t. (1-1, 0-0)" and "2-3 a.e.t. (1-1, 0-1)" were 1-1
export function score(rest) {
  const s = rest.trim();
  if (/a\.e\.t\./.test(s)) { const m = /\((\d+)-(\d+)/.exec(s.slice(s.indexOf('a.e.t.'))); return m ? [Number(m[1]), Number(m[2])] : null; }
  const m = /^(\d+)-(\d+)/.exec(s);
  return m ? [Number(m[1]), Number(m[2])] : null;
}

// season: '2023-24'; comp: 'cl', 'el' or 'conf'. Returns { date, season, div: 'EU', comp, home, away, hg, ag, neutral }:
// the final is at a neutral ground
export function parse(text, season, comp) {
  const out = [];
  const first = Number(season.slice(0, 4));
  let date = null, stage = '', late = false;
  for (const raw of text.split('\n')) {
    const line = raw.replace(/\s+$/, '');
    if (line.startsWith('▪')) { stage = line; continue; }
    const d = /^\s+(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\w*\s+([A-Z][a-z]{2})\s+(\d{1,2})(?:\s+(\d{4}))?\s*$/.exec(line);
    if (d) {
      // a date without its year: July to December in the season's first year, January to June in its second, and
      // July or August in the second too once the file has got there (2019-20 finished in August 2020). Files that
      // list the group stage group by group go back to September for each group, so the order alone can't tell.
      const mo = MONTHS[d[1]], year = d[3] ? Number(d[3]) : mo >= 7 && !late ? first : first + 1;
      if (year > first) late = true;
      date = `${year}-${String(mo).padStart(2, '0')}-${d[2].padStart(2, '0')}`;
      continue;
    }
    const m = /^\s+(?:\d{1,2}[.:]\d{2}\s+)?(.+?)\s+\(([A-Z]{3})\)\s+v\s+(.+?)\s+\(([A-Z]{3})\)\s+(\d+-\d+.*)$/.exec(line);
    const sc = m && score(m[5]);
    if (!sc || !date) continue;
    out.push({ date, season, div: 'EU', comp, home: club(m[1], m[2]), away: club(m[3], m[4]), hg: sc[0], ag: sc[1], neutral: /^▪\s*(Finals, )?Final\s*$/.test(stage) });
  }
  return out;
}
