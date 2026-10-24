import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv, isoDate, matches, oddsOf, toCsv, fromCsv } from '../lib/results.mjs';
import { run, runAll, marginFactor, expectedScore } from '../lib/elo.mjs';
import { parse as parseEurope, score as score90 } from '../lib/europe.mjs';
import { markets, table } from '../lib/goals.mjs';
import { seasons, currentSeason, label, ukToUtc } from '../lib/seasons.mjs';
import { slug, canonical } from '../lib/teams.mjs';
import { LEAGUES, leagueOf } from '../lib/leagues.mjs';
import { parseMatch } from '../lib/matchday.mjs';

test('season codes run from 1993-94 to the season under way, which starts in July', () => {
  assert.equal(currentSeason(new Date('2026-10-24')), '2627');
  assert.equal(currentSeason(new Date('2027-06-30')), '2627');
  assert.equal(currentSeason(new Date('2027-07-01')), '2728');
  const all = seasons(new Date('2026-10-24'));
  assert.equal(all[0], '9394'); assert.equal(all[7], '0001'); assert.equal(all.at(-1), '2627'); assert.equal(all.length, 34);
  assert.equal(label('9900'), '1999-00'); assert.equal(label('2627'), '2026-27');
});

test('football-data rows: both date styles, quoted fields with commas, odds by the median bookmaker', () => {
  assert.equal(isoDate('14/08/93'), '1993-08-14'); assert.equal(isoDate('21/08/2026'), '2026-08-21'); assert.equal(isoDate(''), null);
  const csv = '﻿Div,Date,HomeTeam,AwayTeam,FTHG,FTAG,FTR,Referee,B365H,B365D,B365A,WHH,WHD,WHA,IWH,IWD,IWA\r\n'
    + 'E0,05/03/02,Arsenal,Derby,1,0,H,"Barber, G. P.",1.2,5.2,11,13,1.2,5,1.25,4.5,9\r\n'
    + 'E0,06/03/02,Leeds,Hull,,,,,,,,,,,,,\r\n';
  const [m, ...rest] = matches(csv, '0102', 'E0', { odds: true });
  assert.equal(rest.length, 0, 'an unplayed match is skipped');
  assert.deepEqual({ ...m, odds: undefined }, { date: '2002-03-05', season: '0102', div: 'E0', home: 'Arsenal', away: 'Derby', hg: 1, ag: 0, odds: undefined });
  assert.deepEqual(m.odds, [1.25, 4.5, 9], 'the median outvotes the bookmaker with its prices in the wrong columns');
  assert.deepEqual(oddsOf({ PSCH: '2', PSCD: '3.5', PSCA: '4', B365H: '9', B365D: '9', B365A: '9' }), [2, 3.5, 4], 'closing prices first');
  assert.equal(parseCsv(csv)[0].Referee, 'Barber, G. P.');
  assert.deepEqual(fromCsv(toCsv([m])), [{ ...m, odds: undefined }].map(({ odds, ...x }) => x));
});

test('Elo: points only change hands, a bigger win moves more, home advantage counts', () => {
  assert.equal(marginFactor(1, 'log'), 1); assert.ok(marginFactor(3, 'log') > marginFactor(2, 'log'));
  assert.equal(marginFactor(2, 'wfe'), 1.5); assert.equal(marginFactor(-4, 'wfe'), 15 / 8);
  assert.equal(expectedScore(0), 0.5); assert.ok(Math.abs(expectedScore(100) - 0.64) < 0.01);
  const games = [
    { date: '1993-08-14', season: '9394', div: 'E0', home: 'A', away: 'B', hg: 2, ag: 0 },
    { date: '1993-08-21', season: '9394', div: 'E0', home: 'B', away: 'A', hg: 1, ag: 1 },
    { date: '1994-08-20', season: '9495', div: 'E0', home: 'A', away: 'B', hg: 0, ag: 1 },
  ];
  const seen = [];
  const { ratings } = run(games, { k: 20, hfa: 60, regress: 0 }, { each: (m, x) => seen.push(x) });
  assert.ok(Math.abs(ratings.get('A') + ratings.get('B') - 3200) < 1e-9, 'zero sum');
  assert.ok(Math.abs(seen[0].dr - (seen[0].home + 60 - seen[0].away)) < 1e-9);
  assert.ok(seen[0].home > seen[0].away, 'the warm-up season already put A ahead');
});

test('a club up from League One takes the rating of the clubs that went down to it', () => {
  const g = (season, date, div, home, away, hg, ag) => ({ season, date, div, home, away, hg, ag });
  const list = [
    g('9394', '1993-08-14', 'E0', 'Top', 'Mid', 1, 0), g('9394', '1993-08-14', 'E1', 'Low', 'Down', 3, 0),
    g('9495', '1994-08-20', 'E0', 'Top', 'Mid', 1, 1), g('9495', '1994-08-20', 'E1', 'Low', 'Up', 0, 0),
  ];
  let up = null, down = null;
  run(list, { regress: 0 }, { each: (m, x) => { if (m.away === 'Down') down = x.away; if (m.away === 'Up') up = x.away; } });
  assert.ok(down !== null && up !== null);
  assert.ok(up < 1450, 'Down lost its matches, so the club replacing it starts below the Championship start');
});

test('the goals model: probabilities add up, a bigger gap favours the home side more, an even match is symmetric', () => {
  const p = { mu: 2.7, c: 500, draw: 0.2 };
  const even = markets(0, p), strong = markets(200, p);
  assert.ok(Math.abs(even.H + even.D + even.A - 1) < 1e-9);
  assert.ok(Math.abs(even.H - even.A) < 1e-9);
  assert.ok(strong.H > even.H && strong.A < even.A && strong.xg[0] > strong.xg[1]);
  assert.ok(strong.O25 > 0 && strong.O25 < 1 && strong.btts > 0);
  assert.deepEqual(table(p)(200), [strong.H, strong.D, strong.A]);
});

test('a matchday match becomes a fixture under football-data\'s club names', () => {
  const m = parseMatch({ kickoff: '2026-10-24T11:30:00Z', matchweek: 8, status: 'scheduled', homeTeam: '../../clubs/AVL.jsonld#this', awayTeam: '../../clubs/MCI.jsonld#this' });
  assert.deepEqual(m, { kickoff: '2026-10-24T11:30:00.000Z', gw: 8, home: 'Aston Villa', away: 'Man City', status: 'scheduled', ft: null, tbc: false });
});

test('UK kick-off times become UTC on either side of the clocks changing', () => {
  assert.equal(ukToUtc('2026-10-24', '15:00'), '2026-10-24T14:00:00.000Z'); // British Summer Time
  assert.equal(ukToUtc('2026-10-31', '15:00'), '2026-10-31T15:00:00.000Z'); // Greenwich Mean Time
  assert.equal(ukToUtc('2026-12-26'), '2026-12-26T15:00:00.000Z');
});

test('club pages have plain addresses, and one club under two names is one club', () => {
  assert.equal(slug('Preußen Münster'), 'preussen-munster'); assert.equal(slug("Nott'm Forest"), 'nott-m-forest'); assert.equal(slug('Ath Madrid'), 'ath-madrid');
  assert.equal(canonical('Leonesa'), 'Cultural Leonesa'); assert.equal(canonical('Arsenal'), 'Arsenal');
  assert.equal(leagueOf('SP2'), 'laliga'); assert.equal(Object.keys(LEAGUES).length, 5);
});

test('a country whose second division starts later still rates the clubs coming up', () => {
  const g = (season, date, div, home, away, hg, ag) => ({ season, date, div, home, away, hg, ag });
  const list = [g('9394', '1993-08-29', 'I1', 'Juve', 'Bari', 3, 0), g('9495', '1994-08-28', 'I1', 'Juve', 'Novo', 1, 0)];
  let novo = null;
  run(list, { regress: 0 }, { divs: ['I1', 'I2'], each: (m, x) => { if (m.away === 'Novo') novo = x.away; } });
  assert.ok(Number.isFinite(novo) && novo < 1600, 'Novo takes the relegated Bari\'s rating');
});

test('European cup results: 90-minute scores, years across the new year, finals at neutral grounds, clubs under football-data names', () => {
  assert.deepEqual(score90('2-1 (1-0)'), [2, 1]); assert.deepEqual(score90('3-2 pen. 1-1 a.e.t. (1-1, 0-0)'), [1, 1]); assert.deepEqual(score90('2-3 a.e.t. (1-1, 0-1)'), [1, 1]);
  const txt = `= UEFA Champions League 2019/20

▪ Group A
  Wed Sep 18 2019
    21:00  FC Barcelona (ESP)      v SSC Napoli (ITA)         2-1 (1-0)
▪ Group B
  Tue Sep 17
    21:00  FK Crvena Zvezda (SRB)  v FC Bayern München (GER)  0-3
▪ Round of 16
  Tue Feb 25
    21:00  Chelsea FC (ENG)        v Bayern München (GER)     0-3 (0-0)
▪ Final
  Sun Aug 23
    21:00  Paris Saint-Germain (FRA) v Bayern München (GER)   0-1 (0-0)
`;
  const ms = parseEurope(txt, '2019-20', 'cl');
  assert.deepEqual(ms.map((m) => m.date), ['2019-09-18', '2019-09-17', '2020-02-25', '2020-08-23']);
  assert.deepEqual(ms.map((m) => m.neutral), [false, false, false, true]);
  assert.deepEqual([ms[0].home, ms[0].away, ms[1].home, ms[1].away, ms[3].home], ['Barcelona', 'Napoli', 'FK Crvena Zvezda (SRB)', 'Bayern Munich', 'Paris SG']);
});

test('a European win lifts the winner\'s whole league a little and leaves every gap inside it as it was', () => {
  const g = (date, div, home, away, hg, ag) => ({ season: '1112', date, div, home, away, hg, ag });
  const leagues = {
    a: { list: [g('2011-08-20', 'A1', 'A', 'B', 1, 1)], params: { k: 20 }, divs: ['A1', 'A2'] },
    b: { list: [g('2011-08-20', 'B1', 'C', 'D', 1, 1)], params: { k: 20 }, divs: ['B1', 'B2'] },
  };
  const eu = { list: [{ date: '2011-09-14', season: '1112', div: 'EU', home: 'A', away: 'C', hg: 3, ag: 0 }], params: { k: 20, kLeague: 5, hfa: 0 } };
  const { ratings: R0 } = runAll(leagues, null);
  const { ratings: R } = runAll(leagues, eu);
  assert.ok(R.get('B') > R0.get('B') && R.get('D') < R0.get('D'), 'B and D moved with their leagues');
  assert.ok(Math.abs((R.get('B') - R0.get('B')) + (R.get('D') - R0.get('D'))) < 1e-9, 'what one league gains the other loses');
  assert.ok(R.get('A') - R.get('B') > R0.get('A') - R0.get('B'), 'A gained on B too: it won');
});
