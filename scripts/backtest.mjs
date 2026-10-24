// How good are the ratings? Every top-division match from 2000-01 on is predicted from the ratings before it, and
// scored against what happened (log loss, RPS and Brier score: lower is better) next to the bookmakers' prices for
// the same match with their margin taken out, and a baseline that knows only how often home sides win.
// The ratings are the published ones: all five leagues and the European cups run together (lib/elo.mjs runAll).
//   node scripts/backtest.mjs                    score -> data/<league>/backtest.json, data/europe.json
//   node scripts/backtest.mjs --tune [league…]   search a league's settings first (on its own matches) -> params.json
//   node scripts/backtest.mjs --tune-europe      search the European settings, judged on the European matches
// (side by side: TUNED=cache/tuned node scripts/backtest.mjs --tune laliga & … then merge cache/tuned/*.json)
// Every gap means the same in every league: the goals model's c is params.common.c for all of them.
// Needs cache/ (node scripts/fetch.mjs): the odds are football-data's, so they're read here and not published.
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { seasons, label } from '../lib/seasons.mjs';
import { matches, byDate } from '../lib/results.mjs';
import { run, runAll } from '../lib/elo.mjs';
import { table } from '../lib/goals.mjs';
import { parse as parseEurope } from '../lib/europe.mjs';
import { LEAGUES, IDS } from '../lib/leagues.mjs';

const FROM = 2000; // first season scored, by the year it starts
const year = (code) => { const y = Number(code.slice(0, 2)); return y >= 90 ? 1900 + y : 2000 + y; };
const outcome = (m) => (m.hg > m.ag ? 0 : m.hg === m.ag ? 1 : 2);
const logloss = (rows, prob) => rows.reduce((t, r) => t - Math.log(Math.max(1e-9, prob(r)[r.o])), 0) / rows.length;
// ranked probability score, the field's usual measure: home, draw, away taken as ordered
const rps = (rows, prob) => rows.reduce((t, r) => { const p = prob(r), c1 = p[0] - (r.o === 0), c2 = p[0] + p[1] - (r.o <= 1); return t + (c1 ** 2 + c2 ** 2) / 2; }, 0) / rows.length;
const brier = (rows, prob) => rows.reduce((t, r) => { const p = prob(r); return t + p.reduce((s, x, i) => s + (x - (i === r.o)) ** 2, 0); }, 0) / rows.length;
const devig = (o) => { const s = o.reduce((t, x) => t + 1 / x, 0); return o.map((x) => 1 / x / s); };
const scores = (rows, prob) => ({ logloss: +logloss(rows, prob).toFixed(4), rps: +rps(rows, prob).toFixed(4), brier: +brier(rows, prob).toFixed(4) });

const params = JSON.parse(readFileSync('params.json', 'utf8'));
const C = params.common.c;
const lists = Object.fromEntries(IDS.map((id) => [id, seasons().flatMap((s) => LEAGUES[id].divs.flatMap((d) => existsSync(`cache/${s}-${d}.csv`) ? matches(readFileSync(`cache/${s}-${d}.csv`, 'utf8'), s, d, { odds: true }) : [])).sort(byDate)]));
const europe = readdirSync('cache/europe').sort().flatMap((f) => { const [a, b, comp] = f.replace('.txt', '').split('-'); return parseEurope(readFileSync(`cache/europe/${f}`, 'utf8'), `${a}-${b}`, comp); });

// the goal model's settings for one league's ratings: mu from its matches, the draw boost searched, c common
function fitGoals(rows) {
  const mu = rows.reduce((t, r) => t + r.m.hg + r.m.ag, 0) / rows.length;
  let best = null;
  for (const draw of [0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35]) {
    const t = table({ mu, c: C, draw }), ll = logloss(rows, (r) => t(r.dr));
    if (!best || ll < best.ll) best = { ll, goals: { mu: +mu.toFixed(3), c: C, draw } };
  }
  return best;
}
const scored = (id) => (m) => m.div === LEAGUES[id].divs[0] && year(m.season) >= FROM;
const leaguesFor = (p) => Object.fromEntries(IDS.map((id) => [id, { list: lists[id], params: p[id].elo, divs: LEAGUES[id].divs }]));

const argv = process.argv.slice(2), named = argv.filter((a) => IDS.includes(a));
if (argv.includes('--tune')) {
  for (const id of named.length ? named : IDS) {
    const gaps = (elo) => { const out = []; run(lists[id], elo, { divs: LEAGUES[id].divs, each: (m, { dr }) => { if (scored(id)(m)) out.push({ m, dr, o: outcome(m) }); } }); return out; };
    let best = null;
    for (const margin of ['wfe', 'log']) for (const k of [8, 10, 12, 14, 16, 20, 24]) for (const hfa of [50, 60, 70, 80, 90]) for (const regress of [0, 0.1, 0.2]) for (const hfaEmpty of [0, 30]) {
      const elo = { ...params[id].elo, k, hfa, hfaEmpty, margin, regress }, f = fitGoals(gaps(elo));
      if (!best || f.ll < best.ll) { best = { ...f, elo }; console.log(`${id} log loss ${f.ll.toFixed(4)}  k ${k} hfa ${hfa}/${hfaEmpty} ${margin} regress ${regress}  draw ${f.goals.draw}`); }
    }
    params[id] = { elo: best.elo, goals: best.goals };
    // TUNED=<dir>: each league's settings to <dir>/<league>.json, for leagues tuned side by side to merge after
    if (process.env.TUNED) writeFileSync(`${process.env.TUNED}/${id}.json`, JSON.stringify(params[id], null, 2) + '\n');
    else { const now = JSON.parse(readFileSync('params.json', 'utf8')); now[id] = params[id]; writeFileSync('params.json', JSON.stringify(now, null, 2) + '\n'); }
  }
  process.exit(0);
}

// the European matches predicted from the ratings before each, with an average league's goals and draws
function europeRows(eu) {
  const rows = [];
  runAll(leaguesFor(params), { list: europe, params: eu }, { each: (m, { dr, league }) => { if (league === 'EU') rows.push({ m, dr, o: outcome(m) }); } });
  return rows;
}
const euGoals = { mu: 2.8, c: C, draw: 0.15 };
if (argv.includes('--tune-europe')) {
  const t = table(euGoals);
  let best = null;
  for (const k of [10, 20, 30, 40]) for (const kLeague of [0, 1, 2, 4, 6]) for (const hfa of [50, 70, 90]) for (const other of [50, 100, 200]) {
    const eu = { ...params.europe, k, kLeague, hfa, other }, ll = logloss(europeRows(eu), (r) => t(r.dr));
    if (!best || ll < best.ll) { best = { ll, eu }; console.log(`europe log loss ${ll.toFixed(4)}  k ${k} kLeague ${kLeague} hfa ${hfa} other ${other}`); }
  }
  params.europe = best.eu;
  const now = JSON.parse(readFileSync('params.json', 'utf8')); now.europe = best.eu; writeFileSync('params.json', JSON.stringify(now, null, 2) + '\n');
}

// one run of everything, as published: every league's top-division matches and the European ones, each with its gap
const rows = Object.fromEntries([...IDS, 'EU'].map((id) => [id, []]));
runAll(leaguesFor(params), { list: europe, params: params.europe }, { each: (m, { dr, league }) => { if (league === 'EU' || scored(league)(m)) rows[league].push({ m, dr, o: outcome(m) }); } });
for (const id of IDS) {
  const league = LEAGUES[id], p = params[id], t = table(p.goals), all = rows[id];
  const model = (r) => t(r.dr), market = (r) => devig(r.m.odds);
  const per = [...new Set(all.map((r) => r.m.season))].map((s) => {
    const ro = all.filter((r) => r.m.season === s && r.m.odds);
    const before = all.filter((r) => year(r.m.season) < year(s)); // base rates from earlier seasons only
    const freq = [0, 1, 2].map((i) => (before.length ? before.filter((r) => r.o === i).length / before.length : [0.46, 0.27, 0.27][i]));
    return { season: label(s), matches: all.filter((r) => r.m.season === s).length, withOdds: ro.length, model: scores(ro, model), market: ro.length ? scores(ro, market) : null, baseline: scores(ro, () => freq) };
  });
  const ro = all.filter((r) => r.m.odds);
  const total = { matches: ro.length, model: scores(ro, model), market: scores(ro, market) };
  // calibration: matches bucketed by the model's home-win chance, how often the home side won
  const cal = Array.from({ length: 10 }, (_, i) => { const b = ro.filter((r) => Math.min(9, Math.floor(model(r)[0] * 10)) === i); return b.length ? { bucket: `${i * 10}-${i * 10 + 10}%`, matches: b.length, predicted: +(b.reduce((s, r) => s + model(r)[0], 0) / b.length).toFixed(3), actual: +(b.filter((r) => r.o === 0).length / b.length).toFixed(3) } : null; }).filter(Boolean);
  writeFileSync(`data/${id}/backtest.json`, JSON.stringify({ updated: new Date().toISOString().slice(0, 10), league: league.name, from: `${FROM}-${String(FROM + 1).slice(2)}`, params: p, common: params.common, europe: params.europe, all: total, seasons: per, calibration: cal }, null, 1) + '\n');
  console.log(`${league.name}: log loss ${total.model.logloss} v market ${total.market.logloss} · RPS ${total.model.rps} v ${total.market.rps} · ${total.matches} matches`);
}
const te = table(euGoals), eu = rows.EU;
const freq = [eu.filter((r) => r.o === 0).length, eu.filter((r) => r.o === 1).length, eu.filter((r) => r.o === 2).length].map((n) => n / eu.length);
writeFileSync('data/europe.json', JSON.stringify({ updated: new Date().toISOString().slice(0, 10), matches: eu.length, from: eu[0]?.m.date, model: scores(eu, (r) => te(r.dr)), baseline: scores(eu, () => freq), params: params.europe }, null, 1) + '\n');
console.log(`European cups: log loss ${scores(eu, (r) => te(r.dr)).logloss} v ${scores(eu, () => freq).logloss} for base rates · ${eu.length} matches`);
