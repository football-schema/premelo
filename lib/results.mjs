// Results from football-data's season files, in one shape: { date, season, div, home, away, hg, ag }.
// Shots on target come along as m.sot = [home, away] where the file has them (read, never published).
// Teams keep football-data's names (they're stable across all the seasons); lib/teams.mjs has the display names.
// The odds are read only for the backtest, never published: the market's closing prices where the file has
// them, else the median bookmaker's.
import { canonical } from './teams.mjs';

// one line's fields; a quoted field may hold commas ("Barber, G. P." among 2001-02's referees)
export const fields = (l) => [...l.matchAll(/(?:^|,)(?:"([^"]*)"|([^,]*))/g)].map((m) => m[1] ?? m[2]);
export function parseCsv(text) {
  const rows = text.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim() && !/^,+$/.test(l)).map(fields);
  const head = rows[0].map((h) => h.trim());
  return rows.slice(1).map((r) => Object.fromEntries(head.map((h, i) => [h, (r[i] ?? '').trim()]).filter(([h]) => h)));
}

// dd/mm/yy or dd/mm/yyyy -> yyyy-mm-dd
export function isoDate(d) {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/.exec(d);
  if (!m) return null;
  const y = m[3].length === 4 ? Number(m[3]) : Number(m[3]) + (Number(m[3]) >= 90 ? 1900 : 2000);
  return `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}

// the bookmaker prices to judge the model against: the closing prices (Pinnacle's, then the average) where the file
// has them; else, outcome by outcome, the median of every bookmaker in it, which also outvotes the odd early row
// with one bookmaker's prices in the wrong columns
const CLOSING = [['PSCH', 'PSCD', 'PSCA'], ['AvgCH', 'AvgCD', 'AvgCA']];
const BOOKS = ['PS', 'B365', 'BW', 'IW', 'LB', 'WH', 'VC', 'SJ', 'GB', 'SB', 'SY', 'BS', 'Avg', 'BbAv'];
const median = (xs) => { const s = [...xs].sort((a, b) => a - b), n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };
export function oddsOf(row) {
  for (const k of CLOSING) { const o = k.map((c) => Number(row[c])); if (o.every((x) => x > 1)) return o; }
  const books = BOOKS.map((b) => ['H', 'D', 'A'].map((x) => Number(row[b + x]))).filter((o) => o.every((x) => x > 1));
  return books.length ? [0, 1, 2].map((i) => median(books.map((o) => o[i]))) : null;
}

export function matches(text, season, div, { odds = false } = {}) {
  const out = [];
  for (const r of parseCsv(text)) {
    const date = isoDate(r.Date), hg = r.FTHG === '' ? NaN : Number(r.FTHG), ag = r.FTAG === '' ? NaN : Number(r.FTAG);
    if (!date || !r.HomeTeam || !r.AwayTeam || !Number.isInteger(hg) || !Number.isInteger(ag)) continue;
    if (r.Div && r.Div !== div) continue; // a file with another division's rows in it (9394/P1.csv is Spain's)
    const m = { date, season, div, home: canonical(r.HomeTeam), away: canonical(r.AwayTeam), hg, ag };
    if (odds) { const o = oddsOf(r); if (o) m.odds = o; }
    // shots on target, where the file has them: for the attack/defence model, never published
    const hst = Number(r.HST), ast = Number(r.AST);
    if (r.HST !== undefined && r.HST !== '' && r.AST !== '' && Number.isInteger(hst) && Number.isInteger(ast)) m.sot = [hst, ast];
    out.push(m);
  }
  return out;
}

// football-data's "extra leagues" files (new/AUT.csv and the like): every season in one file, from 2012, with
// Season as "2012/2013" or, for leagues played in a calendar year, "2012". Same shape as matches(), div being the file's code.
export function matchesExtra(text, div, { odds = false } = {}) {
  const out = [];
  for (const r of parseCsv(text)) {
    const date = isoDate(r.Date), hg = r.HG === '' ? NaN : Number(r.HG), ag = r.AG === '' ? NaN : Number(r.AG);
    const sm = /^(\d{4})(?:\/(\d{4}))?$/.exec(r.Season ?? '');
    if (!date || !sm || !r.Home || !r.Away || !Number.isInteger(hg) || !Number.isInteger(ag)) continue;
    const season = sm[2] ? `${sm[1].slice(2)}${sm[2].slice(2)}` : `${sm[1].slice(2)}${sm[1].slice(2)}`; // a calendar year: '2013' -> '1313'
    const m = { date, season, div, home: canonical(r.Home), away: canonical(r.Away), hg, ag };
    if (odds) { const o = oddsOf(r); if (o) m.odds = o; }
    out.push(m);
  }
  return out;
}

// results.csv, the published file: one match a line, in date order
export const HEAD = 'date,season,div,home,away,hg,ag';
export const toCsv = (list) => [HEAD, ...list.map((m) => [m.date, m.season, m.div, m.home, m.away, m.hg, m.ag].join(','))].join('\n') + '\n';
export const fromCsv = (text) => text.trim().split('\n').slice(1).map((l) => { const [date, season, div, home, away, hg, ag] = l.split(','); return { date, season, div, home, away, hg: Number(hg), ag: Number(ag) }; });
export const byDate = (a, b) => a.date.localeCompare(b.date) || a.div.localeCompare(b.div) || a.home.localeCompare(b.home);
