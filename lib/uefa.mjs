// European cup results from UEFA's own match data (match.uefa.com, fetched by scripts/fetch-uefa.mjs): every
// Champions League, UEFA Cup / Europa League and Conference League match since 1993-94, qualifiers included.
// These tie the five countries' pools together: the only matches between clubs of different countries.
// UEFA's team ids are stable, so a club keeps one identity whatever it is called that season.
import { UEFA } from './teams.mjs';

// a club as premelo knows it: football-data's name for the five countries' clubs (and Monaco), else "<name> (<country>)"
export const clubOf = (t) => UEFA[t.id] ?? `${t.name} (${t.country})`;

// matches played in one place, so at a neutral ground: single-match finals, the quarter- and semi-finals of the August
// 2020 tournaments, and the preliminary rounds' mini-tournaments (2020's single-leg qualifiers were at one club's home)
const neutral = (m) => m.type === 'SINGLE' && /^(Final|Semi-finals|Quarter-finals|Preliminary Round (Semi-)?Final)$/.test(m.round ?? '');

// cache/uefa/<comp>-<year>.json -> { date, season, div: 'EU', comp, home, away, hg, ag, neutral }, finished matches with a
// 90-minute score only: awarded, abandoned and cancelled matches have none
export function parse(list, comp) {
  const out = [];
  for (const m of list) {
    if (m.status !== 'FINISHED' || !m.regular || !m.date || !m.home?.id || !m.away?.id) continue;
    const y = Number(m.date.slice(0, 4)), start = Number(m.date.slice(5, 7)) >= 7 ? y : y - 1;
    out.push({ date: m.date, season: `${String(start).slice(2)}${String(start + 1).slice(2)}`, div: 'EU', comp, home: clubOf(m.home), away: clubOf(m.away), hg: m.regular.home, ag: m.regular.away, neutral: neutral(m) });
  }
  return out;
}
