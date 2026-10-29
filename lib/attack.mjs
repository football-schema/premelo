// A second model to blend with the Elo: attack and defence ratings in goals, updated online. Each club has an attack and
// a defence (log scale); a match's expected goals are e^(home rate + attack − opponent's defence) and e^(away rate +
// attack − opponent's defence), and after it both move by k × (goals − expected), the Poisson likelihood's gradient.
// Each division's home and away scoring rates are learnt the same way, slowly (kb), which is how the model follows home
// advantage as it changes (it has fallen since about 2015, and a fixed home advantage can't). Seasons start as the Elo's
// do: clubs pulled towards their division's average by r, arrivals taking the average of the clubs that left.
// Tested out of sample (tuned to 2014-15, scored 2015-16 to 2025-26) it beat the Elo alone, and the blend of the two
// beat both: log loss −0.004 against the Elo.

export const DEFAULTS = { k: 0.02, r: 0, kb: 0.002, draw: 0.15, shots: 0, conv: 0.3, kh: 0, st: 0, w: 0 };
// w: the market's view, learnt from as the Elo does (lib/elo.mjs w). Where a match has prices and the caller a `ratio`
// (odds -> the log of home goals over away goals they mean), once the match is predicted both clubs' attacks and defences
// move so the log ratio goes w of the way to the market's, the expected total left alone.
// shots: where a match has shots on target (m.sot), the goals the update learns from are (1 − shots) × the goals scored
// + shots × conv × the shots on target, the goals the chances were worth. Goals are noisy; shots on target less so.
// SHOTS: for a league whose files have no shots on target in the seasons it's tuned on (Portugal, the Netherlands,
// Belgium, Turkey and Greece have them from 2017-18), the setting most of the leagues with them chose.
export const SHOTS = { shots: 0.3, conv: 0.32 };
// kh: each club's own home advantage on top of its division's, learnt as it goes, kh × (home side's goals − expected −
// (away side's goals − expected)) after each of its home matches (some grounds are harder to visit than others).
// st: the clubs' part of a prediction (attack − defence) stretched by 1 + st. Ratings learnt online lag behind and sit
// a little close to the average; the update itself is unchanged.

// walks one league's matches in date order; each(m, [lh, la]) sees every match with its expected goals before it
export function run(list, params = {}, { each, divs, ratio } = {}) {
  const p = { ...DEFAULTS, ...params };
  const att = new Map(), def = new Map(), home = new Map(), away = new Map(), hc = new Map();
  const ha = (c) => hc.get(c) ?? 0;
  // expected goals: the update's, and the prediction's with the clubs' part stretched by st
  const xg = (h, a, div, s = 1) => [Math.exp(home.get(div) + s * (att.get(h) - def.get(a) + ha(h))), Math.exp(away.get(div) + s * (att.get(a) - def.get(h) - ha(h)))];
  const bySeason = new Map();
  for (const m of list) (bySeason.get(m.season) ?? bySeason.set(m.season, new Map()).get(m.season)).set(m.home, m.div).set(m.away, m.div);
  const mean = (cs, R) => cs.reduce((t, c) => t + R.get(c), 0) / cs.length;
  let last = null, season = null;
  for (const m of list) {
    if (m.season !== season) {
      const now = bySeason.get(m.season);
      if (last) {
        const gone = [...last.keys()].filter((c) => !now.has(c));
        const ga = gone.length ? mean(gone, att) : -0.2, gd = gone.length ? mean(gone, def) : -0.2;
        for (const c of now.keys()) if (!last.has(c)) { att.set(c, ga); def.set(c, gd); }
        for (const dv of new Set(now.values())) {
          const cs = [...now].filter(([, d]) => d === dv).map(([c]) => c), ma = mean(cs, att), md = mean(cs, def);
          for (const c of cs) { att.set(c, att.get(c) + p.r * (ma - att.get(c))); def.set(c, def.get(c) + p.r * (md - def.get(c))); }
        }
      } else for (const [c, d] of now) { const s = divs && d !== divs[0] ? -0.15 : 0; att.set(c, s); def.set(c, s); }
      last = now; season = m.season;
    }
    if (!home.has(m.div)) { home.set(m.div, Math.log(1.5)); away.set(m.div, Math.log(1.1)); }
    let [lh, la] = xg(m.home, m.away, m.div);
    each?.(m, p.st ? xg(m.home, m.away, m.div, 1 + p.st) : [lh, la]);
    if (p.w && m.odds && ratio) {
      const d = p.w * (ratio(m.odds) - Math.log(lh / la)) / 4;
      att.set(m.home, att.get(m.home) + d); def.set(m.away, def.get(m.away) - d); att.set(m.away, att.get(m.away) - d); def.set(m.home, def.get(m.home) + d);
      [lh, la] = xg(m.home, m.away, m.div); // the result then counts from there
    }
    const [gh, ga] = m.sot && p.shots ? [(1 - p.shots) * m.hg + p.shots * p.conv * m.sot[0], (1 - p.shots) * m.ag + p.shots * p.conv * m.sot[1]] : [m.hg, m.ag];
    const eh = gh - lh, ea = ga - la;
    att.set(m.home, att.get(m.home) + p.k * eh); def.set(m.away, def.get(m.away) - p.k * eh);
    att.set(m.away, att.get(m.away) + p.k * ea); def.set(m.home, def.get(m.home) - p.k * ea);
    if (p.kh) hc.set(m.home, ha(m.home) + p.kh * (eh - ea));
    home.set(m.div, home.get(m.div) + p.kb * eh); away.set(m.div, away.get(m.div) + p.kb * ea);
  }
  // expected goals for a coming match in division div
  const expect = (h, a, div) => (att.has(h) && att.has(a) && home.has(div) ? xg(h, a, div, 1 + p.st) : null);
  return { att, def, home, away, hc, expect, params: p };
}
