// How good are the ratings? Every top-division match from 2000-01 on is predicted from the ratings before it, and
// scored against what happened (log loss, RPS and Brier score: lower is better) next to the bookmakers' prices for
// the same match with their margin taken out, and a baseline that knows only how often home sides win.
//   node scripts/backtest.mjs [league…]          score the settings in params.json -> data/<league>/backtest.json
//   node scripts/backtest.mjs --tune [league…]   search the settings first and write the best to params.json
//   (side by side: TUNED=cache/tuned node scripts/backtest.mjs --tune laliga & … then merge cache/tuned/*.json)
// Every league when none is named. Needs cache/ (node scripts/fetch.mjs): the odds are football-data's, so they're
// read here and not published.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { seasons, label } from '../lib/seasons.mjs';
import { matches, byDate } from '../lib/results.mjs';
import { run } from '../lib/elo.mjs';
import { table } from '../lib/goals.mjs';
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

// the goal model's settings for one set of ratings: mu from the matches themselves, c and draw searched
function fitGoals(rows) {
  const mu = rows.reduce((t, r) => t + r.m.hg + r.m.ag, 0) / rows.length;
  let best = null;
  for (let c = 250; c <= 900; c += 25) for (const draw of [0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3]) {
    const t = table({ mu, c, draw }), ll = logloss(rows, (r) => t(r.dr));
    if (!best || ll < best.ll) best = { ll, goals: { mu: +mu.toFixed(3), c, draw } };
  }
  return best;
}

const tune = process.argv.includes('--tune'), named = process.argv.slice(2).filter((a) => IDS.includes(a));
for (const id of named.length ? named : IDS) {
  const league = LEAGUES[id], params = JSON.parse(readFileSync('params.json', 'utf8'));
  const list = seasons().flatMap((s) => league.divs.flatMap((d) => existsSync(`cache/${s}-${d}.csv`) ? matches(readFileSync(`cache/${s}-${d}.csv`, 'utf8'), s, d, { odds: true }) : [])).sort(byDate);
  // the top division's matches with the rating gap before each
  const gaps = (elo) => {
    const out = [];
    run(list, elo, { divs: league.divs, each: (m, { dr }) => { if (m.div === league.divs[0] && year(m.season) >= FROM) out.push({ m, dr, o: outcome(m) }); } });
    return out;
  };

  if (tune) {
    let best = null;
    for (const margin of ['wfe', 'log']) for (const k of [8, 10, 12, 14, 16, 20]) for (const hfa of [50, 60, 70, 80, 90]) for (const regress of [0, 0.1, 0.2]) for (const hfaEmpty of [0, 30]) {
      const elo = { ...params[id].elo, k, hfa, hfaEmpty, margin, regress }, f = fitGoals(gaps(elo));
      if (!best || f.ll < best.ll) { best = { ...f, elo }; console.log(`${id} log loss ${f.ll.toFixed(4)}  k ${k} hfa ${hfa}/${hfaEmpty} ${margin} regress ${regress}  c ${f.goals.c} draw ${f.goals.draw}`); }
    }
    params[id] = { elo: best.elo, goals: best.goals };
    // TUNED=<dir>: each league's settings to <dir>/<league>.json, for leagues tuned side by side to merge after
    if (process.env.TUNED) writeFileSync(`${process.env.TUNED}/${id}.json`, JSON.stringify(params[id], null, 2) + '\n');
    else { const now = JSON.parse(readFileSync('params.json', 'utf8')); now[id] = params[id]; writeFileSync('params.json', JSON.stringify(now, null, 2) + '\n'); }
  }

  const p = params[id], rows = gaps(p.elo), t = table(p.goals);
  const model = (r) => t(r.dr), market = (r) => devig(r.m.odds);
  const per = [...new Set(rows.map((r) => r.m.season))].map((s) => {
    const rs = rows.filter((r) => r.m.season === s), ro = rs.filter((r) => r.m.odds);
    const before = rows.filter((r) => year(r.m.season) < year(s)); // base rates from earlier seasons only
    const freq = [0, 1, 2].map((i) => (before.length ? before.filter((r) => r.o === i).length / before.length : [0.46, 0.27, 0.27][i]));
    return { season: label(s), matches: rs.length, withOdds: ro.length, model: scores(ro, model), market: ro.length ? scores(ro, market) : null, baseline: scores(ro, () => freq) };
  });
  const ro = rows.filter((r) => r.m.odds);
  const all = { matches: ro.length, model: scores(ro, model), market: scores(ro, market) };
  // calibration: matches bucketed by the model's home-win chance, how often the home side won
  const cal = Array.from({ length: 10 }, (_, i) => { const b = ro.filter((r) => Math.min(9, Math.floor(model(r)[0] * 10)) === i); return b.length ? { bucket: `${i * 10}-${i * 10 + 10}%`, matches: b.length, predicted: +(b.reduce((s, r) => s + model(r)[0], 0) / b.length).toFixed(3), actual: +(b.filter((r) => r.o === 0).length / b.length).toFixed(3) } : null; }).filter(Boolean);
  writeFileSync(`data/${id}/backtest.json`, JSON.stringify({ updated: new Date().toISOString().slice(0, 10), league: league.name, from: `${FROM}-${String(FROM + 1).slice(2)}`, params: p, all, seasons: per, calibration: cal }, null, 1) + '\n');
  console.log(`${league.name}: log loss ${all.model.logloss} v market ${all.market.logloss} · RPS ${all.model.rps} v ${all.market.rps} · ${all.matches} matches`);
}
