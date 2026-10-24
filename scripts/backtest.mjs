// How good are the ratings? Every Premier League match from 2000-01 on is predicted from the ratings the day
// before it, and scored against what happened (log loss and Brier score, lower is better) next to the bookmakers'
// prices for the same match with their margin taken out, and a baseline that knows only how often home sides win.
//   node scripts/backtest.mjs          score the settings in params.json, write data/backtest.json
//   node scripts/backtest.mjs --tune   search the settings first and write the best to params.json
// Needs cache/ (node scripts/fetch.mjs): the odds are football-data's, so they're read here and not published.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { seasons, label } from '../lib/seasons.mjs';
import { matches, byDate } from '../lib/results.mjs';
import { run } from '../lib/elo.mjs';
import { table } from '../lib/goals.mjs';

const FROM = '0001';
const params = JSON.parse(readFileSync('params.json', 'utf8'));
const list = seasons().flatMap((s) => ['E0', 'E1'].flatMap((d) => existsSync(`cache/${s}-${d}.csv`) ? matches(readFileSync(`cache/${s}-${d}.csv`, 'utf8'), s, d, { odds: true }) : [])).sort(byDate);
const inEval = (m) => m.div === 'E0' && (m.season >= FROM ? m.season < '90' : false); // codes from 0001 sort below 9394
const outcome = (m) => (m.hg > m.ag ? 0 : m.hg === m.ag ? 1 : 2);

// the Premier League matches with the rating gap before each
function gaps(elo) {
  const out = [];
  run(list, elo, { each: (m, { dr }) => { if (inEval(m)) out.push({ m, dr, o: outcome(m) }); } });
  return out;
}
const logloss = (rows, prob) => rows.reduce((t, r) => t - Math.log(Math.max(1e-9, prob(r)[r.o])), 0) / rows.length;
// ranked probability score, the field's usual measure: home, draw, away taken as ordered
const rps = (rows, prob) => rows.reduce((t, r) => { const p = prob(r), c1 = p[0] - (r.o === 0), c2 = p[0] + p[1] - (r.o <= 1); return t + (c1 ** 2 + c2 ** 2) / 2; }, 0) / rows.length;
const brier = (rows, prob) => rows.reduce((t, r) => { const p = prob(r); return t + p.reduce((s, x, i) => s + (x - (i === r.o)) ** 2, 0); }, 0) / rows.length;
const devig = (o) => { const s = o.reduce((t, x) => t + 1 / x, 0); return o.map((x) => 1 / x / s); };

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

if (process.argv.includes('--tune')) {
  let best = null;
  for (const margin of ['wfe', 'log']) for (const k of [6, 8, 10, 12, 14, 16]) for (const hfa of [60, 70, 80]) for (const regress of [0, 0.1, 0.2]) for (const hfaEmpty of [0, 30]) {
    const elo = { ...params.elo, k, hfa, hfaEmpty, margin, regress }, f = fitGoals(gaps(elo));
    if (!best || f.ll < best.ll) { best = { ...f, elo }; console.log(`log loss ${f.ll.toFixed(4)}  k ${k} hfa ${hfa}/${hfaEmpty} ${margin} regress ${regress}  c ${f.goals.c} draw ${f.goals.draw}`); }
  }
  params.elo = best.elo; params.goals = best.goals;
  writeFileSync('params.json', JSON.stringify(params, null, 2) + '\n');
}

const rows = gaps(params.elo), t = table(params.goals);
const model = (r) => t(r.dr), market = (r) => devig(r.m.odds);
const seasonsSeen = [...new Set(rows.map((r) => r.m.season))];
const per = seasonsSeen.map((s) => {
  const rs = rows.filter((r) => r.m.season === s), ro = rs.filter((r) => r.m.odds);
  const before = rows.filter((r) => r.m.season < s && r.m.season >= FROM || (s < '90' && r.m.season < s)); // base rate from earlier seasons only
  const freq = [0, 1, 2].map((i) => (before.length ? before.filter((r) => r.o === i).length / before.length : [0.46, 0.27, 0.27][i]));
  return {
    season: label(s), matches: rs.length,
    model: { logloss: +logloss(ro, model).toFixed(4), rps: +rps(ro, model).toFixed(4), brier: +brier(ro, model).toFixed(4) },
    market: ro.length ? { logloss: +logloss(ro, market).toFixed(4), rps: +rps(ro, market).toFixed(4), brier: +brier(ro, market).toFixed(4) } : null,
    baseline: { logloss: +logloss(ro, () => freq).toFixed(4), rps: +rps(ro, () => freq).toFixed(4) },
    withOdds: ro.length,
  };
});
const ro = rows.filter((r) => r.m.odds);
const all = { matches: ro.length, model: { logloss: +logloss(ro, model).toFixed(4), rps: +rps(ro, model).toFixed(4), brier: +brier(ro, model).toFixed(4) }, market: { logloss: +logloss(ro, market).toFixed(4), rps: +rps(ro, market).toFixed(4), brier: +brier(ro, market).toFixed(4) } };
// calibration: matches bucketed by the model's home-win chance, how often the home side won
const cal = Array.from({ length: 10 }, (_, i) => { const b = ro.filter((r) => Math.min(9, Math.floor(model(r)[0] * 10)) === i); return b.length ? { bucket: `${i * 10}-${i * 10 + 10}%`, matches: b.length, predicted: +(b.reduce((s, r) => s + model(r)[0], 0) / b.length).toFixed(3), actual: +(b.filter((r) => r.o === 0).length / b.length).toFixed(3) } : null; }).filter(Boolean);
writeFileSync('data/backtest.json', JSON.stringify({ updated: new Date().toISOString().slice(0, 10), from: label(FROM), params, all, seasons: per, calibration: cal }, null, 1) + '\n');
console.log(`log loss: model ${all.model.logloss} · market ${all.market.logloss}   RPS: model ${all.model.rps} · market ${all.market.rps}   (${all.matches} Premier League matches)`);
for (const s of per) console.log(s.season, s.model.logloss, s.market?.logloss, s.baseline.logloss);
