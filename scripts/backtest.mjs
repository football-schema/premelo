// How good are the predictions? Every top-division match from 2000-01 on is predicted from what was known before it, and
// scored against what happened (log loss, RPS and Brier score: lower is better) next to the bookmakers' prices for the
// same match with their margin taken out, and a baseline that knows only how often home sides win.
// A prediction is the Elo's (all leagues and the European cups together, lib/elo.mjs runAll) blended with the attack and
// defence model's (lib/attack.mjs), in proportions tuned per league.
//
// Honest scoring: the headline is a holdout. `--holdout` tunes every setting on 2000-01 to 2011-12 only, into
// params-holdout.json, and those frozen settings are scored on 2012-13 onwards, which nothing was tuned on, against
// the bookmakers' closing prices (football-data has them from 2012-13). The published model (params.json) is then
// tuned on everything, and its in-sample scores are reported beside the holdout's, never instead of them.
//   node scripts/backtest.mjs                               score -> data/<league>/backtest.json, data/europe.json
//   node scripts/backtest.mjs --tune [league…] [--holdout]  search a league's settings first
//   node scripts/backtest.mjs --tune-europe [--holdout]     search the European settings, judged on every match
// (side by side: TUNED=cache/tuned node scripts/backtest.mjs --tune laliga & … then merge cache/tuned/*.json)
// Every gap means the same in every league: the Elo goals model's c is params.common.c for all of them.
// Needs cache/ (node scripts/fetch.mjs): the odds are football-data's, so they're read here and not published.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { seasons, label } from '../lib/seasons.mjs';
import { matches, byDate, fromCsv } from '../lib/results.mjs';
import { run, runAll } from '../lib/elo.mjs';
import { run as runAttack } from '../lib/attack.mjs';
import { table, x12 } from '../lib/goals.mjs';
import { LEAGUES, IDS } from '../lib/leagues.mjs';

const FROM = 2000, HOLD = 2012; // first season scored; first season of the holdout, by the year each starts
const year = (code) => { const y = Number(code.slice(0, 2)); return y >= 90 ? 1900 + y : 2000 + y; };
const outcome = (m) => (m.hg > m.ag ? 0 : m.hg === m.ag ? 1 : 2);
const logloss = (rows, prob) => rows.reduce((t, r) => t - Math.log(Math.max(1e-9, prob(r)[r.o])), 0) / rows.length;
// ranked probability score, the field's usual measure: home, draw, away taken as ordered
const rps = (rows, prob) => rows.reduce((t, r) => { const p = prob(r), c1 = p[0] - (r.o === 0), c2 = p[0] + p[1] - (r.o <= 1); return t + (c1 ** 2 + c2 ** 2) / 2; }, 0) / rows.length;
const brier = (rows, prob) => rows.reduce((t, r) => { const p = prob(r); return t + p.reduce((s, x, i) => s + (x - (i === r.o)) ** 2, 0); }, 0) / rows.length;
const devig = (o) => { const s = o.reduce((t, x) => t + 1 / x, 0); return o.map((x) => 1 / x / s); };
const scores = (rows, prob) => ({ logloss: +logloss(rows, prob).toFixed(4), rps: +rps(rows, prob).toFixed(4), brier: +brier(rows, prob).toFixed(4) });
const blend = (w, a, b) => [0, 1, 2].map((i) => w * a[i] + (1 - w) * b[i]);

const argv = process.argv.slice(2), named = argv.filter((a) => IDS.includes(a)), holdout = argv.includes('--holdout');
const FILE = holdout ? 'params-holdout.json' : 'params.json';
const params = JSON.parse(readFileSync(existsSync(FILE) ? FILE : 'params.json', 'utf8'));
const save = (key, value) => { const now = JSON.parse(readFileSync(existsSync(FILE) ? FILE : 'params.json', 'utf8')); now[key] = value; writeFileSync(FILE, JSON.stringify(now, null, 2) + '\n'); };
const C = params.common.c;
const lists = Object.fromEntries(IDS.map((id) => [id, seasons().flatMap((s) => LEAGUES[id].divs.flatMap((d) => existsSync(`cache/${s}-${d}.csv`) ? matches(readFileSync(`cache/${s}-${d}.csv`, 'utf8'), s, d, { odds: true }) : [])).sort(byDate)]));
const europe = fromCsv(readFileSync('data/europe.csv', 'utf8')).map((m) => ({ ...m, neutral: m.div === 'EUN', div: 'EU' })); // scripts/import.mjs makes it from UEFA's data
const top = (id) => (m) => m.div === LEAGUES[id].divs[0] && year(m.season) >= FROM;
const tuning = (id) => (m) => top(id)(m) && (!holdout || year(m.season) < HOLD); // what --tune may look at
const leaguesFor = (p) => Object.fromEntries(IDS.map((id) => [id, { list: lists[id], params: p[id].elo, divs: LEAGUES[id].divs }]));
const DRAWS = [0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35];

// the Elo goal model's settings for one league's ratings: mu from its matches, the draw boost searched, c common
function fitGoals(rows) {
  const mu = rows.reduce((t, r) => t + r.m.hg + r.m.ag, 0) / rows.length;
  let best = null;
  for (const draw of DRAWS) {
    const t = table({ mu, c: C, draw }), ll = logloss(rows, (r) => t(r.dr));
    if (!best || ll < best.ll) best = { ll, goals: { mu: +mu.toFixed(3), c: C, draw } };
  }
  return best;
}
// the attack/defence model's expected goals for every match of a league, keyed by the match
function attackGoals(id, a) { const out = new Map(); runAttack(lists[id], a, { divs: LEAGUES[id].divs, each: (m, xg) => out.set(m, xg) }); return out; }

if (argv.includes('--tune')) {
  for (const id of named.length ? named : IDS) {
    const divs = LEAGUES[id].divs, pick = tuning(id);
    const gaps = (elo) => { const out = []; run(lists[id], elo, { divs, each: (m, { dr }) => { if (pick(m)) out.push({ m, dr, o: outcome(m) }); } }); return out; };
    // 1. the Elo
    let best = null;
    for (const margin of ['wfe', 'log']) for (const k of [8, 10, 12, 14, 16, 20, 24]) for (const hfa of [50, 60, 70, 80, 90, 100]) for (const regress of [0, 0.1, 0.2]) for (const hfaEmpty of [0, 30]) {
      const elo = { ...params[id].elo, k, hfa, hfaEmpty, margin, regress, kH: 0 }, f = fitGoals(gaps(elo));
      if (!best || f.ll < best.ll) { best = { ...f, elo }; console.log(`${id} elo ${f.ll.toFixed(4)}  k ${k} hfa ${hfa}/${hfaEmpty} ${margin} regress ${regress}  draw ${f.goals.draw}`); }
    }
    // 2. home advantage learnt as it goes
    for (const kH of [0.05, 0.1, 0.2, 0.3, 0.5]) {
      const elo = { ...best.elo, kH }, f = fitGoals(gaps(elo));
      if (f.ll < best.ll) { best = { ...f, elo }; console.log(`${id} elo ${f.ll.toFixed(4)}  kH ${kH}`); }
    }
    // 3. the attack/defence model
    const eloRows = gaps(best.elo), t = table(best.goals);
    let att = null;
    for (const k of [0.01, 0.015, 0.02, 0.03]) for (const r of [0, 0.1, 0.2]) for (const kb of [0.002, 0.005]) {
      const xg = attackGoals(id, { k, r, kb });
      for (const draw of DRAWS) {
        const ll = logloss(eloRows, (row) => x12(xg.get(row.m), draw));
        if (!att || ll < att.ll) att = { ll, a: { k, r, kb, draw }, xg };
      }
    }
    console.log(`${id} attack/defence ${att.ll.toFixed(4)}  ${JSON.stringify(att.a)}`);
    // 4. the blend
    let w = null;
    for (let x = 0; x <= 1.0001; x += 0.1) {
      const ll = logloss(eloRows, (row) => blend(x, t(row.dr), x12(att.xg.get(row.m), att.a.draw)));
      if (!w || ll < w.ll) w = { ll, x: +x.toFixed(1) };
    }
    console.log(`${id} blend ${w.ll.toFixed(4)}  Elo ${w.x}, attack/defence ${+(1 - w.x).toFixed(1)}`);
    params[id] = { elo: best.elo, goals: best.goals, attack: att.a, blend: w.x };
    // TUNED=<dir>: each league's settings to <dir>/<league>.json, for leagues tuned side by side to merge after
    if (process.env.TUNED) writeFileSync(`${process.env.TUNED}/${id}${holdout ? '.holdout' : ''}.json`, JSON.stringify(params[id], null, 2) + '\n');
    else save(id, params[id]);
  }
  process.exit(0);
}

const euGoals = { mu: 2.8, c: C, draw: 0.15 };
// every match since 2000 that --tune may look at, each predicted by the Elo from the ratings before it: the European ones
// with an average league's goals and draws, the domestic top-division ones with their league's. European results move
// the ratings domestic matches are predicted from, so the European settings are judged on both.
function judged(eu) {
  const tE = table(euGoals), tL = Object.fromEntries(IDS.map((id) => [id, table(params[id].goals)]));
  let sum = 0, n = 0;
  runAll(leaguesFor(params), { list: europe, params: eu }, { each: (m, { dr, league }) => {
    if (league === 'EU' ? m.date < `${FROM}-07-01` || (holdout && m.date >= `${HOLD}-07-01`) : !tuning(league)(m)) return;
    sum -= Math.log(Math.max(1e-9, (league === 'EU' ? tE : tL[league])(dr)[outcome(m)])); n++;
  } });
  return sum / n;
}
if (argv.includes('--tune-europe')) {
  let best = null;
  for (const k of [12, 16, 20]) for (const kLeague of [2, 4, 6, 8]) for (const margin of ['log', 'wfe']) for (const hfa of [70, 90, 110]) for (const other of [100, 200, 300]) {
    const eu = { ...params.europe, k, kLeague, margin, hfa, other }, ll = judged(eu);
    if (!best || ll < best.ll) { best = { ll, eu }; console.log(`log loss ${ll.toFixed(5)}  k ${k} kLeague ${kLeague} ${margin} hfa ${hfa} other ${other}`); }
  }
  params.europe = best.eu; save('europe', best.eu);
  if (holdout) process.exit(0);
}

// every top-division match's prediction under one set of settings: the Elo's, the attack/defence model's, and the blend
function predict(p) {
  const rows = Object.fromEntries([...IDS, 'EU'].map((id) => [id, []]));
  runAll(leaguesFor(p), { list: europe, params: p.europe }, { each: (m, { dr, league }) => { if (league === 'EU' || top(league)(m)) rows[league].push({ m, dr, o: outcome(m) }); } });
  for (const id of IDS) {
    const t = table(p[id].goals), xg = p[id].attack ? attackGoals(id, p[id].attack) : null, w = p[id].blend ?? 1;
    for (const r of rows[id]) { r.elo = t(r.dr); r.model = xg ? blend(w, r.elo, x12(xg.get(r.m), p[id].attack.draw)) : r.elo; }
  }
  return rows;
}
const rows = predict(params), held = existsSync('params-holdout.json') ? predict(JSON.parse(readFileSync('params-holdout.json', 'utf8'))) : null;
const model = (r) => r.model, elo = (r) => r.elo, market = (r) => devig(r.m.odds);
const summary = []; // for the README
for (const id of IDS) {
  const league = LEAGUES[id], all = rows[id];
  const per = [...new Set(all.map((r) => r.m.season))].map((s) => {
    const ro = all.filter((r) => r.m.season === s && r.m.odds);
    const before = all.filter((r) => year(r.m.season) < year(s)); // base rates from earlier seasons only
    const freq = [0, 1, 2].map((i) => (before.length ? before.filter((r) => r.o === i).length / before.length : [0.46, 0.27, 0.27][i]));
    return { season: label(s), matches: all.filter((r) => r.m.season === s).length, withOdds: ro.length, model: scores(ro, model), market: ro.length ? scores(ro, market) : null, baseline: scores(ro, () => freq) };
  });
  const ro = all.filter((r) => r.m.odds);
  const inSample = { matches: ro.length, model: scores(ro, model), elo: scores(ro, elo), market: scores(ro, market) };
  // the headline: settings frozen at the end of 2011-12, scored on every match since with the closing prices
  const ht = held?.[id].filter((r) => year(r.m.season) >= HOLD && r.m.odds);
  const test = ht?.length ? { from: label(`${String(HOLD).slice(2)}${String(HOLD + 1).slice(2)}`), matches: ht.length, model: scores(ht, model), elo: scores(ht, elo), market: scores(ht, market) } : null;
  // calibration: matches bucketed by the model's home-win chance, how often the home side won
  const cal = Array.from({ length: 10 }, (_, i) => { const b = ro.filter((r) => Math.min(9, Math.floor(model(r)[0] * 10)) === i); return b.length ? { bucket: `${i * 10}-${i * 10 + 10}%`, matches: b.length, predicted: +(b.reduce((s, r) => s + model(r)[0], 0) / b.length).toFixed(3), actual: +(b.filter((r) => r.o === 0).length / b.length).toFixed(3) } : null; }).filter(Boolean);
  writeFileSync(`data/${id}/backtest.json`, JSON.stringify({ updated: new Date().toISOString().slice(0, 10), league: league.name, from: `${FROM}-${String(FROM + 1).slice(2)}`, test, all: inSample, params: params[id], common: params.common, europe: params.europe, seasons: per, calibration: cal }, null, 1) + '\n');
  summary.push({ id, name: league.name, test, all: inSample });
  console.log(`${league.name.padEnd(21)} holdout ${test ? `${test.model.logloss} (Elo ${test.elo.logloss}) v market ${test.market.logloss}` : '—'} · in-sample ${inSample.model.logloss} v ${inSample.market.logloss} · ${ro.length} matches`);
}
const te = table(euGoals), eu = rows.EU;
const freq = [eu.filter((r) => r.o === 0).length, eu.filter((r) => r.o === 1).length, eu.filter((r) => r.o === 2).length].map((n) => n / eu.length);
writeFileSync('data/europe.json', JSON.stringify({ updated: new Date().toISOString().slice(0, 10), matches: eu.length, from: eu[0]?.m.date, model: scores(eu, (r) => te(r.dr)), baseline: scores(eu, () => freq), params: params.europe }, null, 1) + '\n');
console.log(`European cups: log loss ${scores(eu, (r) => te(r.dr)).logloss} v ${scores(eu, () => freq).logloss} for base rates · ${eu.length} matches`);
const ht = summary.filter((s) => s.test), tot = (k, f) => ht.reduce((t, s) => t + s.test[k][f] * s.test.matches, 0) / ht.reduce((t, s) => t + s.test.matches, 0);
if (ht.length) console.log(`All leagues, holdout: log loss ${tot('model', 'logloss').toFixed(4)} (Elo ${tot('elo', 'logloss').toFixed(4)}) v market ${tot('market', 'logloss').toFixed(4)} · RPS ${tot('model', 'rps').toFixed(4)} v ${tot('market', 'rps').toFixed(4)}`);
