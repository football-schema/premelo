// A second model to blend with the Elo: attack and defence ratings in goals, updated online. Each club has an attack and
// a defence (log scale); a match's expected goals are e^(home rate + attack − opponent's defence) and e^(away rate +
// attack − opponent's defence), and after it both move by k × (goals − expected), the Poisson likelihood's gradient.
// Each division's home and away scoring rates are learnt the same way, slowly (kb), which is how the model follows home
// advantage as it changes (it has fallen since about 2015, and a fixed home advantage can't). Seasons start as the Elo's
// do: clubs pulled towards their division's average by r, arrivals taking the average of the clubs that left.
// Tested out of sample (tuned to 2014-15, scored 2015-16 to 2025-26) it beat the Elo alone, and the blend of the two
// beat both: log loss −0.004 against the Elo.

export const DEFAULTS = { k: 0.02, r: 0, kb: 0.002, draw: 0.15 };

// walks one league's matches in date order; each(m, [lh, la]) sees every match with its expected goals before it
export function run(list, params = {}, { each, divs } = {}) {
  const p = { ...DEFAULTS, ...params };
  const att = new Map(), def = new Map(), home = new Map(), away = new Map();
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
    const lh = Math.exp(home.get(m.div) + att.get(m.home) - def.get(m.away)), la = Math.exp(away.get(m.div) + att.get(m.away) - def.get(m.home));
    each?.(m, [lh, la]);
    const eh = m.hg - lh, ea = m.ag - la;
    att.set(m.home, att.get(m.home) + p.k * eh); def.set(m.away, def.get(m.away) - p.k * eh);
    att.set(m.away, att.get(m.away) + p.k * ea); def.set(m.home, def.get(m.home) - p.k * ea);
    home.set(m.div, home.get(m.div) + p.kb * eh); away.set(m.div, away.get(m.div) + p.kb * ea);
  }
  // expected goals for a coming match in division div
  const expect = (h, a, div) => (att.has(h) && att.has(a) && home.has(div) ? [Math.exp(home.get(div) + att.get(h) - def.get(a)), Math.exp(away.get(div) + att.get(a) - def.get(h))] : null);
  return { att, def, home, away, expect, params: p };
}
