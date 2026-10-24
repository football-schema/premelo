// premelo's page: everything comes from the JSON the build writes into data/.
import { markets } from './lib/goals.mjs';
// Routes: #/<league> (the table), #/<league>/fixtures, #/<league>/club/<slug>, #/europe[/fixtures], #/h2h/<league>:<slug>/<league>:<slug>,
// #/method[/<league>].
// The Premier League is the default, so #/, #/fixtures and #/club/<slug> are its pages.
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const pct = (x) => Math.round(x * 100);
const signed = (n) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0');
const cache = new Map();
// data is checked with the server on every load (GitHub Pages caches for ten minutes), so new page code never meets old data
const get = (path) => cache.get(path) ?? cache.set(path, fetch(path, { cache: 'no-cache' }).then((r) => { if (!r.ok) throw new Error(`${path}: ${r.status}`); return r.json(); })).get(path);
const day = (iso) => new Date(iso).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
const time = (iso) => new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
const fullDate = (iso) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
// as lib/teams.mjs makes them
const slugOf = (club) => club.replace(/ß/g, 'ss').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

let LEAGUES = [], league = 'pl';
const L = () => LEAGUES.find((l) => l.id === league) ?? LEAGUES[0];
const path = (p) => `data/${league}/${p}`;
const home = (id = league) => (id === 'pl' ? '#/' : `#/${id}`);

function spark(values, w = 90, h = 22) {
  if (!values?.length) return '';
  const lo = Math.min(...values), hi = Math.max(...values), span = hi - lo || 1;
  const pts = values.map((v, i) => `${(i / (values.length - 1 || 1)) * (w - 4) + 2},${h - 2 - ((v - lo) / span) * (h - 4)}`).join(' ');
  const [lx, ly] = pts.split(' ').at(-1).split(',');
  return `<svg class="spark" width="${w + 3}" height="${h}" viewBox="0 0 ${w + 3} ${h}" aria-hidden="true"><polyline points="${pts}" fill="none" stroke="var(--accent)" stroke-width="1.5" stroke-linejoin="round"/><circle cx="${lx}" cy="${ly}" r="2.5" fill="var(--accent)"/></svg>`;
}
// form as Flashscore shows it: the next match in grey, then the last five league results, newest first, each with its
// score and opponent on hover
const formWord = { W: 'won', D: 'drew', L: 'lost' };
const form = (f, next) => {
  const day = (d) => new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }), last = [...f].reverse();
  const nx = next ? `${next.ha === 'a' ? 'at' : 'v'} ${next.opp}, ${day(next.kickoff)}: ${pct(next.win)}% to win` : '';
  const said = `${next ? `Next ${nx}. ` : ''}Last ${f.length} league matches, newest first: ${last.map((m) => `${formWord[m.r]} ${m.gf}–${m.ga} ${m.ha === 'a' ? 'at' : 'v'} ${m.opp}`).join(', ')}`;
  return `<span class="form" role="img" aria-label="${esc(said)}">${next ? `<span class="N" aria-hidden="true" title="Next: ${esc(nx)}">?</span>` : ''}${last.map((m) => `<span class="${m.r}" aria-hidden="true" title="${m.r} ${m.gf}–${m.ga} ${m.ha === 'a' ? 'at' : 'v'} ${esc(m.opp)} · ${day(m.date)}">${m.r}</span>`).join('')}</span>`;
};
const bar = (f) => `<div class="bar" role="img" aria-label="${esc(f.homeName)} ${pct(f.H)}%, draw ${pct(f.D)}%, ${esc(f.awayName)} ${pct(f.A)}%">
  <span class="ph" style="flex:${f.H}">${pct(f.H)}</span><span class="pd" style="flex:${f.D}">${pct(f.D)}</span><span class="pa" style="flex:${f.A}">${pct(f.A)}</span></div>`;
const clubLink = (slug, name, id = league) => `<a href="#/${id}/club/${slug}">${esc(name)}</a>`;
// one side of a fixture: a link to the club in its own league (a European fixture says which), or, for a club from an
// unrated league, its name and country
const side = (f, h) => {
  const lg = h ? f.homeLeague : f.awayLeague, slug = h ? f.homeSlug : f.awaySlug, name = h ? f.homeName : f.awayName;
  if (lg === undefined) return clubLink(slug, name);
  return lg ? clubLink(slug, name, lg) : `${esc(name)} <span class="muted small">${esc(h ? f.homeCountry : f.awayCountry)}</span>`;
};

// grouped by matchweek where there is one (the Premier League's, from matchday), else by day
function fixtureRows(list) {
  let group = null, out = '<div class="bar-key"><span></span><span></span><span></span><span><i>Home</i><i>Draw</i><i>Away</i></span></div>';
  for (const f of list) {
    const g = f.gw ? `Matchweek ${f.gw}` : `${day(f.kickoff)}${f.compName ? ` · ${f.compName}` : ''}`;
    if (g !== group) { group = g; out += `<div class="gw">${esc(g)}</div>`; }
    out += `<div class="fx"><div class="when">${day(f.kickoff)}<br>${f.tbc ? 'TBC' : time(f.kickoff)}</div>
      <div class="h"><div class="t">${side(f, true)}</div><div class="xg">${f.elo[0]} · xG ${f.xg[0].toFixed(1)}</div></div>
      <div><div class="t">${side(f, false)}</div><div class="xg">${f.elo[1]} · xG ${f.xg[1].toFixed(1)}</div></div>
      ${bar(f)}</div>`;
  }
  return out;
}

let division = 'top', order = 'elo';
// a projected chance, as sports sites print them: – for none, <1% and >99% at the ends; the cell tinted by it
const chance = (x, tone) => x == null ? '<td class="n hide-s"></td>' : `<td class="n proj${tone === 'down' ? ' dn' : ''}" style="--p:${Math.round(Math.sqrt(x) * 100)}%">${x === 0 ? '<span class="muted">–</span>' : x < 0.005 ? '<1%' : x >= 0.995 ? '>99%' : `${pct(x)}%`}</td>`;
async function viewTable() {
  const [r, fx] = await Promise.all([get(path('ratings.json')), get(path('fixtures.json'))]);
  const l = L(), pj = r.projected?.[division], rows = r.clubs.filter((c) => c.div === division), what = pj?.what;
  if (order === 'what' && !what) order = 'table';
  // with the sanction button on, each club's projection is the one mixed over the sanction's outcomes
  const projOf = (c) => (order === 'what' ? what.clubs[c.slug] : c.proj);
  if (order !== 'elo') rows.sort((a, b) => (a.table?.pos ?? 99) - (b.table?.pos ?? 99));
  const next = fx.fixtures[0]?.gw ? fx.fixtures.filter((f) => f.gw === fx.fixtures[0].gw) : fx.fixtures.filter((f) => Date.parse(f.kickoff) < Date.parse(fx.fixtures[0].kickoff) + 5 * 86400_000);
  const third = pj?.top ? `Top ${pj.top}` : 'Up';
  // a position's badge colour, as Flashscore marks its zones: the top (or promotion) places blue, the relegation places red
  const zone = (n) => (!pj ? '' : n <= (pj.top ?? pj.up) ? ' zt' : n > pj.clubs - pj.down ? ' zd' : '');
  $('main').innerHTML = `<h1>${esc(l.name)} Elo</h1>
    <p class="sub">Ratings after every result since ${l.extra ? 2012 : 1993}, through ${fullDate(r.through)}, on one scale for all ${LEAGUES.length} leagues, which <a href="#/europe">the European cups</a> tie together. A 100-point gap makes the stronger side about a 64% favourite on neutral ground.</p>
    <div class="card"><div class="controls">${l.second ? `<div class="tabs"><button data-d="top" class="${division === 'top' ? 'on' : ''}">${esc(l.name)}</button><button data-d="second" class="${division === 'second' ? 'on' : ''}">${esc(l.second)}</button></div>` : ''}
    <div class="tabs"><button data-o="elo" class="${order === 'elo' ? 'on' : ''}">By Elo</button><button data-o="table" class="${order === 'table' ? 'on' : ''}">By position</button>${what ? `<button data-o="what" class="${order === 'what' ? 'on' : ''}">${esc(what.label)}</button>` : ''}</div></div>
    <div class="scroll"><table class="league"><tr><th class="n">#</th><th>Club</th><th class="n">Elo</th><th class="n hide-s">30 days</th><th class="hide-m">Last 20</th><th class="hide-s" title="Next match, then the last 5 league matches, newest first">Form</th>
      <th class="n sep hide-s" title="League position">Pos</th><th class="n hide-s" title="Played">P</th><th class="n" title="Points">Pts</th>
      ${pj ? `<th class="n sep hide-s" title="Average final points over 10,000 simulations of the rest of the season">Proj. pts</th><th class="n" title="Chance of finishing first">Title</th><th class="n hide-s" title="${pj.top ? `Chance of finishing in the top ${pj.top}` : `Chance of finishing in the top ${pj.up}, the automatic promotion places`}">${third}</th><th class="n hide-s" title="Chance of finishing in the bottom ${pj.down}, the direct relegation places">Down</th>` : ''}</tr>
    ${rows.map((c) => `<tr${order === 'what' && c.slug === what.club ? ' class="what"' : ''}><td class="n muted">${c.rank}</td><td>${clubLink(c.slug, c.name)}</td><td class="n"><b>${c.elo}</b></td>
      <td class="n hide-s ${c.change30 > 0 ? 'up' : c.change30 < 0 ? 'down' : 'muted'}">${signed(c.change30)}</td><td class="hide-m">${spark(c.spark)}</td><td class="hide-s">${form(c.form, c.next)}</td>
      <td class="n sep hide-s">${c.table ? `<span class="pos${zone(c.table.pos)}">${c.table.pos}</span>` : ''}</td><td class="n hide-s muted">${c.table?.p ?? ''}</td><td class="n"><b>${c.table?.pts ?? ''}</b></td>
      ${pj ? `<td class="n sep hide-s">${projOf(c) ? Math.round(projOf(c).pts) : ''}</td>${chance(projOf(c)?.first)}${chance(pj.top ? projOf(c)?.top : projOf(c)?.up).replace('class="n proj', 'class="n hide-s proj')}${chance(projOf(c)?.down, 'down').replace('class="n proj', 'class="n hide-s proj')}` : ''}</tr>`).join('')}</table></div>
    ${order === 'what' ? `<p class="small" style="margin:12px 0 0"><b>${esc(what.label)}:</b> ${esc(what.note)} The projection is run for each outcome below and mixed by its chance; a deduction comes off this season's points (the middle of each range: ${what.outcomes.filter((o) => o.cut !== 'expelled' && o.cut).map((o) => o.cut).join(', ')}), and expulsion expunges the club's results and drops its matches. City's projected points leave expulsion out.</p>
    <p class="small muted" style="margin:6px 0 0">Outcome chances, an editorial estimate of the final outcome with appeals, not bookmaker prices: ${what.outcomes.map((o) => `${esc(o.label)} ${pct(o.p)}%`).join(' · ')}.</p>` : ''}
    <p class="small muted" style="margin:12px 0 0">${pj ? `Projection: the ${pj.left} remaining matches played out 10,000 times from each match's chances, the ratings moving with each simulated result. Ties split on goal difference, then goals scored; ${order === 'what' ? 'other ' : ''}points deductions and play-offs aren't modelled.` : `${esc(division === 'top' ? l.name : l.second)} isn't projected: its season splits into further rounds, or its clubs meet more than twice, so the remaining fixtures aren't known yet.`} Pos, P and Pts: the league table from the results here.</p></div>
    ${next.length ? `<div class="card"><h2>Next up</h2>${fixtureRows(next)}<p class="small muted" style="margin:10px 0 0">Bars: home win · draw · away win, in %. <a href="#/${league}/fixtures">Every fixture</a></p></div>` : ''}`;
  $('main').querySelectorAll('[data-d]').forEach((b) => (b.onclick = () => { division = b.dataset.d; viewTable(); }));
  $('main').querySelectorAll('[data-o]').forEach((b) => (b.onclick = () => { order = b.dataset.o; viewTable(); }));
}

async function viewFixtures() {
  const fx = await get(path('fixtures.json')), l = L();
  $('main').innerHTML = `<h1>${esc(l.name)} fixtures</h1><p class="sub">${league === 'pl' ? `The rest of the ${esc(fx.season)} season` : 'The coming week or so'}, from today's ratings. Home win · draw · away win, in %. Matches further off will move as results come in.</p>
    <div class="card">${fx.fixtures.length ? fixtureRows(fx.fixtures) : '<p class="muted">No fixtures listed yet.</p>'}</div>`;
}

// a club's rating since 1993: one line, its second-division seasons shaded, a crosshair that snaps to the nearest match
function ratingChart(h, el) {
  const W = 940, H = 300, Lm = 44, R = 12, T = 10, B = 26;
  const t = h.map((x) => Date.parse(x[0])), v = h.map((x) => x[1]);
  const t0 = t[0], t1 = t.at(-1), lo = Math.floor((Math.min(...v) - 20) / 50) * 50, hi = Math.ceil((Math.max(...v) + 20) / 50) * 50;
  const X = (x) => Lm + ((x - t0) / (t1 - t0 || 1)) * (W - Lm - R), Y = (y) => T + (1 - (y - lo) / (hi - lo)) * (H - T - B);
  const grid = []; for (let y = lo; y <= hi; y += hi - lo > 400 ? 100 : 50) grid.push(y);
  const years = []; for (let y = new Date(t0).getUTCFullYear() + 1; y <= new Date(t1).getUTCFullYear(); y++) years.push(y);
  const step = Math.ceil(years.length / 10);
  const bands = []; let start = null;
  h.forEach((x, i) => { if (x[6] === 'second' && start === null) start = i; if ((x[6] !== 'second' || i === h.length - 1) && start !== null) { bands.push([t[start], t[x[6] === 'second' ? i : i - 1]]); start = null; } });
  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Elo rating over time">
    ${bands.map(([a, b]) => `<rect class="e1" x="${X(a)}" y="${T}" width="${Math.max(2, X(b) - X(a))}" height="${H - T - B}"/>`).join('')}
    <g class="grid">${grid.map((y) => `<line x1="${Lm}" x2="${W - R}" y1="${Y(y)}" y2="${Y(y)}"/>`).join('')}</g>
    <g class="axis">${grid.map((y) => `<text x="${Lm - 6}" y="${Y(y) + 4}" text-anchor="end">${y}</text>`).join('')}
    ${years.filter((_, i) => i % step === 0).map((y) => `<text x="${X(Date.UTC(y, 0, 1))}" y="${H - 6}" text-anchor="middle">${y}</text>`).join('')}</g>
    <polygon class="area" points="${X(t0)},${H - B} ${h.map((x, i) => `${X(t[i]).toFixed(1)},${Y(v[i]).toFixed(1)}`).join(' ')} ${X(t1)},${H - B}"/>
    <polyline class="line" points="${h.map((x, i) => `${X(t[i]).toFixed(1)},${Y(v[i]).toFixed(1)}`).join(' ')}"/>
    ${(() => { const i = v.indexOf(Math.max(...v)); return `<circle class="peak" cx="${X(t[i])}" cy="${Y(v[i])}" r="4"/><text x="${X(t[i])}" y="${Y(v[i]) - 9}" text-anchor="middle" class="axis" style="fill:var(--text2);font-size:11px">${v[i]}</text>`; })()}
    <line class="hair" y1="${T}" y2="${H - B}" style="display:none"/><circle class="dot" r="4.5" style="display:none"/>
    <rect x="${Lm}" y="${T}" width="${W - Lm - R}" height="${H - T - B}" fill="transparent"/></svg><div class="tip"></div>`;
  const svg = el.querySelector('svg'), hair = svg.querySelector('.hair'), dot = svg.querySelector('.dot'), tip = el.querySelector('.tip'), second = L().second;
  const show = (clientX) => {
    const box = svg.getBoundingClientRect(), x = ((clientX - box.left) / box.width) * W, at = t0 + ((x - Lm) / (W - Lm - R)) * (t1 - t0);
    let a = 0, b = t.length - 1;
    while (a < b) { const mid = (a + b) >> 1; if (t[mid] < at) a = mid + 1; else b = mid; }
    const i = a > 0 && Math.abs(t[a - 1] - at) < Math.abs(t[a] - at) ? a - 1 : a;
    const m = h[i], px = X(t[i]), py = Y(v[i]);
    hair.setAttribute('x1', px); hair.setAttribute('x2', px); hair.style.display = ''; dot.setAttribute('cx', px); dot.setAttribute('cy', py); dot.style.display = '';
    tip.textContent = '';
    const bold = document.createElement('b'); bold.textContent = m[1];
    tip.append(bold, ` · ${fullDate(m[0])}`, document.createElement('br'), `${m[5] === 'a' ? 'at' : 'v'} ${m[2]} ${m[3]}-${m[4]}${m[6] === 'second' ? ` · ${second}` : m[6] === 'europe' ? ' · Europe' : ''}`);
    tip.style.display = 'block';
    const sx = (px / W) * box.width, sy = (py / H) * box.height;
    tip.style.left = `${Math.min(box.width - tip.offsetWidth, Math.max(0, sx - tip.offsetWidth / 2))}px`; tip.style.top = `${Math.max(0, sy - tip.offsetHeight - 12)}px`;
  };
  svg.addEventListener('pointermove', (e) => show(e.clientX));
  svg.addEventListener('pointerleave', () => { hair.style.display = dot.style.display = tip.style.display = 'none'; });
}

// a match's opponent: a link to its page, in its own league for a European match; clubs from unrated leagues have none
const opponent = (x) => (x[6] !== 'europe' ? clubLink(slugOf(x[2]), x[2]) : x[7] ? `<a href="#/${x[7]}/club/${slugOf(x[2])}">${esc(x[2])}</a>` : esc(x[2]));
const ordinal = (n) => `${n}${['th', 'st', 'nd', 'rd'][n % 10 > 3 || [11, 12, 13].includes(n % 100) ? 0 : n % 10]}`;
async function viewClub(slug) {
  const [r, fx] = await Promise.all([get(path('ratings.json')), get(path('fixtures.json'))]);
  const c = await get(path(`clubs/${slug}.json`)), l = L();
  const now = r.clubs.find((x) => x.slug === slug), h = c.history;
  const best = h.reduce((a, x) => (x[1] > a[1] ? x : a)), worst = h.reduce((a, x) => (x[1] < a[1] ? x : a));
  const euFx = await get('data/europe-fixtures.json').catch(() => ({ fixtures: [] }));
  const mine = [...fx.fixtures, ...euFx.fixtures.map((f) => ({ ...f, gw: null }))].filter((f) => f.home === c.club || f.away === c.club).sort((a, b) => a.kickoff.localeCompare(b.kickoff)).slice(0, 6);
  const recent = h.slice(-10).reverse();
  $('main').innerHTML = `<h1>${esc(c.name)}</h1>
    <p class="sub">${now ? `${now.div === 'top' ? esc(l.name) : esc(l.second)} · ${ordinal(now.rank)} of ${r.clubs.filter((x) => x.div === now.div).length}` : `Outside ${esc(l.country)}'s ${l.second ? 'top two divisions' : 'top division'} this season`} · ${h.filter((x) => x[6] !== 'europe').length} league matches since ${h[0][0].slice(0, 4)}${h.some((x) => x[6] === 'europe') ? ` and ${h.filter((x) => x[6] === 'europe').length} in Europe` : ''}</p>
    <p style="margin:-6px 0 12px"><a href="#/h2h/${league}:${slug}/${league === 'pl' && slug === 'arsenal' ? 'laliga:barcelona' : 'pl:arsenal'}">Compare with another club →</a></p>
    <div class="stats"><div><b>${now?.elo ?? h.at(-1)[1]}</b>Elo now</div><div><b>${best[1]}</b>Highest · ${best[0].slice(0, 4)}</div><div><b>${worst[1]}</b>Lowest · ${worst[0].slice(0, 4)}</div>${now ? `<div><b class="${now.change30 > 0 ? 'up' : now.change30 < 0 ? 'down' : ''}">${signed(now.change30)}</b>Last 30 days</div>` : ''}</div>
    <div class="card"><h2>Rating since ${h[0][0].slice(0, 4)}</h2><div class="chart" id="chart"></div>${l.second && h.some((x) => x[6] === 'second') ? `<p class="small muted" style="margin:8px 0 0">Shaded: seasons in the ${esc(l.second)}.</p>` : ''}</div>
    ${mine.length ? `<div class="card"><h2>Coming up</h2>${fixtureRows(mine)}</div>` : ''}
    <div class="card"><h2>Last 10 matches</h2><table><tr><th>Date</th><th>Opponent</th><th class="n">Score</th><th class="n">Elo after</th><th class="n">Change</th></tr>
    ${recent.map((x, i) => { const prev = h[h.length - 2 - i]?.[1] ?? x[1], d = x[1] - prev; return `<tr><td class="muted">${fullDate(x[0])}${x[6] === 'europe' ? ' · Europe' : ''}</td><td>${x[5] === 'a' ? '@ ' : x[5] === 'n' ? 'v ' : ''}${opponent(x)}</td><td class="n">${x[3]}-${x[4]}</td><td class="n">${x[1]}</td><td class="n ${d > 0 ? 'up' : d < 0 ? 'down' : 'muted'}">${signed(d)}</td></tr>`; }).join('')}</table></div>`;
  ratingChart(h, $('chart'));
}

// the coming European matches: on one scale they can be priced like any other
let comp = 'cl';
async function viewEuropeFixtures() {
  const fx = await get('data/europe-fixtures.json'), comps = [['cl', 'Champions League'], ['el', 'Europa League'], ['conf', 'Conference League']];
  const list = fx.fixtures.filter((f) => f.comp === comp);
  $('main').innerHTML = `<h1>European fixtures</h1><p class="sub">The coming Champions League, Europa League and Conference League matches, from today's ratings: every club on one scale, so a match between countries is priced like any other. Home win · draw · away win, in %.</p>
    <div class="card"><div class="tabs">${comps.map(([id, n]) => `<button data-c="${id}" class="${id === comp ? 'on' : ''}">${n}</button>`).join('')}</div>
    ${list.length ? fixtureRows(list) : '<p class="muted">No matches listed yet.</p>'}</div>`;
  $('main').querySelectorAll('[data-c]').forEach((b) => (b.onclick = () => { comp = b.dataset.c; viewEuropeFixtures(); }));
}

// every league's top division together: one scale, so one table (the top 50 until asked for the rest)
let showAll = false;
async function viewEurope() {
  const all = await Promise.all(LEAGUES.map((l) => get(`data/${l.id}/ratings.json`).then((r) => r.clubs.filter((c) => c.div === 'top').map((c) => ({ ...c, league: l.id, leagueName: l.name })))));
  const clubs = all.flat().sort((a, b) => b.elo - a.elo), eu = await get('data/europe.json');
  const avg = LEAGUES.map((l, i) => [l, Math.round(all[i].reduce((t, c) => t + c.elo, 0) / all[i].length)]).sort((a, b) => b[1] - a[1]);
  $('main').innerHTML = `<h1>Europe</h1>
    <p class="sub">Every top-division club of the ${LEAGUES.length} leagues on one scale. What sets one country against another is the ${eu.matches.toLocaleString()} European cup matches since ${eu.from.slice(0, 4)} (Champions League, UEFA Cup / Europa League and Conference League, qualifiers included): each result moves the clubs that played and, a little, their whole league.</p>
    <div class="card"><table><tr><th class="n">#</th><th>Club</th><th class="hide-s">League</th><th class="n">Elo</th><th class="n">30 days</th><th class="hide-s">Last 20</th></tr>
    ${clubs.slice(0, showAll ? clubs.length : 50).map((c, i) => `<tr><td class="n muted">${i + 1}</td><td><a href="#/${c.league}/club/${c.slug}">${esc(c.name)}</a></td><td class="hide-s muted">${esc(c.leagueName)}</td><td class="n"><b>${c.elo}</b></td>
      <td class="n ${c.change30 > 0 ? 'up' : c.change30 < 0 ? 'down' : 'muted'}">${signed(c.change30)}</td><td class="hide-s">${spark(c.spark)}</td></tr>`).join('')}</table>
    ${showAll ? '' : `<p style="margin:10px 0 0;text-align:center"><button class="more" id="showAll">Show all ${clubs.length} clubs</button></p>`}</div>
    <div class="card"><h2>League strength</h2><table><tr><th>League</th><th class="n">Average top-division Elo</th></tr>${avg.map(([l, a]) => `<tr><td><a href="${home(l.id)}">${esc(l.name)}</a></td><td class="n"><b>${a}</b></td></tr>`).join('')}</table></div>`;
  $('showAll')?.addEventListener('click', () => { showAll = true; viewEurope(); });
}

// this week: how premelo did this season (settings frozen since 2012), the week's upsets and movers, and every result
async function viewWeek() {
  const [sc, mv] = await Promise.all([get('data/scorecard.json'), get('data/movers.json')]);
  const name = (id) => LEAGUES.find((l) => l.id === id)?.name ?? id;
  const link = (lg, sl, n) => `<a href="#/${lg}/club/${sl}">${esc(n)}</a>`;
  const main = sc.leagues.filter((l) => !l.extra && l.withOdds), n = main.reduce((t, l) => t + l.withOdds, 0);
  const w = (k) => main.reduce((t, l) => t + l[k].logloss * l.withOdds, 0) / n;
  const result = (r) => `<tr><td class="muted small">${new Date(r.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}<br>${esc(name(r.league))}</td><td class="h">${link(r.league, r.homeSlug, r.homeName)}</td><td class="n"><b>${r.hg}-${r.ag}</b></td><td>${link(r.league, r.awaySlug, r.awayName)}</td><td style="width:180px">${bar({ homeName: r.homeName, awayName: r.awayName, H: r.p[0], D: r.p[1], A: r.p[2] })}</td><td class="n ${r.chance < 0.25 ? 'down' : 'muted'}">${pct(r.chance)}%</td></tr>`;
  const mover = (m) => `<tr><td>${link(m.league, m.slug, m.name)}<div class="muted small">${esc(m.leagueName)}</div></td><td class="n">${m.elo}</td><td class="n ${m.change > 0 ? 'up' : 'down'}">${signed(m.change)}</td></tr>`;
  $('main').innerHTML = `<h1>This week</h1>
    <p class="sub">How premelo did, from ${new Date(sc.week.from).toLocaleDateString(undefined, { day: 'numeric', month: 'long' })} to ${new Date(sc.week.to).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}. Every prediction here was made from the ratings before the match, with settings frozen at the end of ${esc(sc.frozen)}: nothing was tuned on this season.</p>
    <div class="card"><h2>This season so far</h2>
    <div class="stats"><div><b>${w('modelOnOdds').toFixed(3)}</b>premelo log loss</div><div><b>${w('market').toFixed(3)}</b>closing odds</div><div><b>${n.toLocaleString()}</b>matches</div></div>
    <table><tr><th>League</th><th class="n">Matches</th><th class="n hide-s">Favourite won</th><th class="n">premelo</th><th class="n">Closing odds</th></tr>
    ${sc.leagues.filter((l) => l.matches).map((l) => `<tr><td>${esc(l.name)}${l.extra ? ' <span class="muted small">(settings from all seasons)</span>' : ''}</td><td class="n">${l.matches}</td><td class="n hide-s">${pct(l.called / l.matches)}%</td><td class="n ${l.modelOnOdds && l.market && l.modelOnOdds.logloss < l.market.logloss ? 'up' : ''}">${l.modelOnOdds?.logloss.toFixed(3) ?? '–'}</td><td class="n">${l.market?.logloss.toFixed(3) ?? '–'}</td></tr>`).join('')}</table>
    <p class="small muted" style="margin:10px 0 0">Log loss: lower is better. Green where premelo beat the closing odds. "Favourite won": how often the result premelo rated likeliest happened.</p></div>
    <div class="card"><h2>Upsets</h2><p class="small muted" style="margin:0 0 8px">The week's results premelo rated least likely, with the chance it gave them.</p><table>${sc.upsets.map(result).join('')}</table></div>
    <div class="cols"><div class="card"><h2>Up</h2><table>${mv.up.map(mover).join('')}</table></div><div class="card"><h2>Down</h2><table>${mv.down.map(mover).join('')}</table></div></div>
    <div class="card"><h2>Every result this week</h2><table>${sc.recent.map(result).join('')}</table></div>`;
}

// any two clubs: their chances three ways (each at home, and at a neutral ground), their ratings over time, their meetings
let EUROPE = null;
async function viewH2H(a = 'pl:arsenal', b = 'laliga:barcelona') {
  const all = await Promise.all(LEAGUES.map((l) => get(`data/${l.id}/ratings.json`).then((r) => r.clubs.map((c) => ({ ...c, league: l.id, leagueName: l.name })))));
  const clubs = all.flat(), find = (k) => { const [lg, sl] = k.split(':'); return clubs.find((c) => c.league === lg && c.slug === sl); };
  const A = find(a) ?? find('pl:arsenal'), B = find(b) ?? find('laliga:barcelona');
  const [ha, hb] = await Promise.all([get(`data/${A.league}/clubs/${A.slug}.json`), get(`data/${B.league}/clubs/${B.slug}.json`)]);
  const g = EUROPE.goals, mk = (dr) => markets(dr, g);
  const ways = [[`${A.name} at home`, mk(A.elo + EUROPE.hfa - B.elo)], ['Neutral ground', mk(A.elo - B.elo)], [`${B.name} at home`, mk(A.elo - EUROPE.hfa - B.elo)]];
  const options = (sel) => LEAGUES.map((l, i) => `<optgroup label="${esc(l.name)}">${all[i].filter((c) => c.div === 'top').map((c) => `<option value="${c.league}:${c.slug}" ${c === sel ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</optgroup>`).join('');
  const met = ha.history.filter((x) => x[2] === hb.club).slice(-10).reverse();
  $('main').innerHTML = `<h1>Head to head</h1><p class="sub">Any two clubs of the ${LEAGUES.length} leagues, on one scale. Chances from today's ratings, with a European cup match's home advantage.</p>
    <div class="card"><div class="pick"><select id="pa">${options(A)}</select><span class="muted">v</span><select id="pb">${options(B)}</select></div>
    <div class="stats" style="margin-top:14px"><div><b>${A.elo}</b>${esc(A.name)} · ${esc(A.leagueName)}</div><div><b>${B.elo}</b>${esc(B.name)} · ${esc(B.leagueName)}</div><div><b>${signed(A.elo - B.elo)}</b>Gap</div></div>
    ${ways.map(([t, m]) => `<div class="gw">${esc(t)}</div><div class="fx" style="grid-template-columns:minmax(0,1fr) minmax(0,1fr) 210px"><div class="h"><div class="t">${esc(A.name)}</div><div class="xg">xG ${m.xg[0].toFixed(1)}</div></div><div><div class="t">${esc(B.name)}</div><div class="xg">xG ${m.xg[1].toFixed(1)}</div></div>${bar({ homeName: A.name, awayName: B.name, H: m.H, D: m.D, A: m.A })}</div>`).join('')}</div>
    <div class="card"><h2>Ratings since 1993</h2><div class="legend"><span class="ka"></span>${esc(A.name)}<span class="kb"></span>${esc(B.name)}</div><div class="chart" id="chart"></div></div>
    <div class="card"><h2>Their meetings</h2>${met.length ? `<table><tr><th>Date</th><th>Where</th><th class="n">Score</th></tr>${met.map((x) => `<tr><td class="muted">${fullDate(x[0])}${x[6] === 'europe' ? ' · Europe' : ''}</td><td>${x[5] === 'h' ? `at ${esc(A.name)}` : x[5] === 'a' ? `at ${esc(B.name)}` : 'neutral ground'}</td><td class="n">${esc(A.name)} ${x[3]}-${x[4]} ${esc(B.name)}</td></tr>`).join('')}</table>` : '<p class="muted">They haven\'t met in the league or the European cups since 1993.</p>'}</div>`;
  pairChart(ha.history, hb.history, $('chart'), [A.name, B.name]);
  const go = () => { location.hash = `#/h2h/${$('pa').value}/${$('pb').value}`; };
  $('pa').onchange = go; $('pb').onchange = go;
}

// two clubs' ratings on one chart, a line each, labelled at the end; a crosshair reads both at a date
function pairChart(h1, h2, el, names) {
  const W = 940, H = 300, Lm = 44, R = 90, T = 10, B = 26;
  const series = [h1, h2].map((h) => h.map((x) => [Date.parse(x[0]), x[1]]));
  const ts = series.flat().map((p) => p[0]), vs = series.flat().map((p) => p[1]);
  const t0 = Math.min(...ts), t1 = Math.max(...ts), lo = Math.floor((Math.min(...vs) - 20) / 100) * 100, hi = Math.ceil((Math.max(...vs) + 20) / 100) * 100;
  const X = (x) => Lm + ((x - t0) / (t1 - t0 || 1)) * (W - Lm - R), Y = (y) => T + (1 - (y - lo) / (hi - lo)) * (H - T - B);
  const grid = []; for (let y = lo; y <= hi; y += 100) grid.push(y);
  const years = []; for (let y = new Date(t0).getUTCFullYear() + 1; y <= new Date(t1).getUTCFullYear(); y++) years.push(y);
  const step = Math.ceil(years.length / 10), cls = ['la', 'lb'];
  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Both clubs' ratings over time">
    <g class="grid">${grid.map((y) => `<line x1="${Lm}" x2="${W - R}" y1="${Y(y)}" y2="${Y(y)}"/>`).join('')}</g>
    <g class="axis">${grid.map((y) => `<text x="${Lm - 6}" y="${Y(y) + 4}" text-anchor="end">${y}</text>`).join('')}
    ${years.filter((_, i) => i % step === 0).map((y) => `<text x="${X(Date.UTC(y, 0, 1))}" y="${H - 6}" text-anchor="middle">${y}</text>`).join('')}</g>
    ${series.map((s, i) => `<polyline class="line ${cls[i]}" points="${s.map(([t, v]) => `${X(t).toFixed(1)},${Y(v).toFixed(1)}`).join(' ')}"/>`).join('')}
    ${series.map((s, i) => { const [t, v] = s.at(-1); return `<text x="${X(t) + 6}" y="${Y(v) + 4}" class="end ${cls[i]}">${esc(names[i])}</text>`; }).join('')}
    <line class="hair" y1="${T}" y2="${H - B}" style="display:none"/>
    <rect x="${Lm}" y="${T}" width="${W - Lm - R}" height="${H - T - B}" fill="transparent"/></svg><div class="tip"></div>`;
  const svg = el.querySelector('svg'), hair = svg.querySelector('.hair'), tip = el.querySelector('.tip');
  const at = (s, t) => { let r = null; for (const p of s) { if (p[0] > t) break; r = p[1]; } return r; };
  svg.addEventListener('pointermove', (e) => {
    const box = svg.getBoundingClientRect(), x = ((e.clientX - box.left) / box.width) * W, t = t0 + ((x - Lm) / (W - Lm - R)) * (t1 - t0);
    if (x < Lm || x > W - R) return;
    hair.setAttribute('x1', x); hair.setAttribute('x2', x); hair.style.display = '';
    tip.textContent = '';
    const head = document.createElement('b'); head.textContent = new Date(t).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
    tip.append(head);
    series.forEach((s, i) => { tip.append(document.createElement('br'), `${names[i]}: ${at(s, t) ?? '–'}`); });
    tip.style.display = 'block';
    const sx = (x / W) * box.width;
    tip.style.left = `${Math.min(box.width - tip.offsetWidth, Math.max(0, sx - tip.offsetWidth / 2))}px`; tip.style.top = '0px';
  });
  svg.addEventListener('pointerleave', () => { hair.style.display = tip.style.display = 'none'; });
}

async function viewMethod() {
  const all = await Promise.all(LEAGUES.map((l) => get(`data/${l.id}/backtest.json`).then((b) => ({ ...b, id: l.id }))));
  const b = all.find((x) => x.id === league) ?? all[0], p = b.params, eu = await get('data/europe.json');
  const tested = all.filter((x) => x.test), n = tested.reduce((t, x) => t + x.test.matches, 0);
  const avg = (k, f) => tested.reduce((t, x) => t + x.test[k][f] * x.test.matches, 0) / n;
  const row = (s) => `<tr><td>${s.season}</td><td class="n">${s.withOdds}</td><td class="n">${s.model.logloss.toFixed(3)}</td><td class="n">${s.market?.logloss.toFixed(3) ?? '–'}</td><td class="n hide-s">${s.model.rps.toFixed(4)}</td><td class="n hide-s">${s.market?.rps.toFixed(4) ?? '–'}</td><td class="n hide-s">${s.baseline.logloss.toFixed(3)}</td></tr>`;
  $('main').innerHTML = `<div class="prose"><h1>Method</h1>
    <p><b>Ratings.</b> Each league runs its top divisions (two where the data has them), every match since 1993-94. After each match both clubs move by <code>K × margin × (result − expected)</code>: the result is 1, ½ or 0, the expected score is <code>1 / (1 + 10<sup>−gap/400</sup>)</code>, and the home side's gap includes a home advantage that is learnt as it goes, since it has fallen over the years. Between seasons each club is pulled part of the way to its division's average; a club arriving from below takes the average rating of the clubs that left.</p>
    <p><b>One scale.</b> The ${LEAGUES.length} leagues are one pool. The European cups (${eu.matches.toLocaleString()} Champions League, UEFA Cup / Europa League and Conference League matches since 1993-94, qualifiers included, from UEFA's match data) are the only matches between countries: each moves the two clubs and, a little, both clubs' whole leagues (or countries, for clubs from elsewhere), since only the clubs at the top ever play in Europe. The same rating gap means the same chances in every league.</p>
    <p><b>Predictions.</b> Two models, blended per league. The Elo's gap becomes expected goals, <code>μ/2 · e<sup>±gap/c</sup></code> each; a second model rates each club's attack and defence in goals, updated after every match by how far its goals beat or missed what was expected. Each gives a grid of Poisson scores (0-0 and 1-1 made a little likelier), and the two grids are mixed. Home, draw and away, the goal lines and the likeliest scores all come from that one grid.</p>
    <p><b>Scoring, honestly.</b> Every setting was tuned on 2000-01 to 2011-12 only, then frozen and scored on every match since, which nothing was tuned on, against the bookmakers' closing prices with their margin taken out. The published model is tuned on everything; its in-sample scores are flattering and shown only below. More in the <a href="https://github.com/football-schema/premelo#readme">README</a>.</p></div>
    <div class="card"><h2>Out of sample: ${n.toLocaleString()} top-division matches since ${esc(tested[0]?.test.from ?? '')}</h2>
    <div class="stats"><div><b>${avg('model', 'logloss').toFixed(3)}</b>premelo log loss</div><div><b>${avg('elo', 'logloss').toFixed(3)}</b>Elo alone</div><div><b>${avg('market', 'logloss').toFixed(3)}</b>closing odds</div><div><b>${avg('model', 'rps').toFixed(4)}</b>premelo RPS</div><div><b>${avg('market', 'rps').toFixed(4)}</b>closing odds</div></div>
    <p class="small muted" style="margin:0 0 10px">Lower is better. A baseline that knows only how often home sides win scores about 1.07. Nothing published reliably beats closing odds; results-only models land about 0.01 to 0.03 behind.</p>
    <table><tr><th>League</th><th class="n">Matches</th><th class="n">premelo</th><th class="n hide-s">Elo alone</th><th class="n">Closing odds</th><th class="n hide-s">RPS</th><th class="n hide-s">RPS odds</th></tr>
    ${tested.map((x) => `<tr><td><a href="#/method/${x.id}">${esc(x.league)}</a></td><td class="n">${x.test.matches.toLocaleString()}</td><td class="n">${x.test.model.logloss.toFixed(3)}</td><td class="n hide-s">${x.test.elo.logloss.toFixed(3)}</td><td class="n">${x.test.market.logloss.toFixed(3)}</td><td class="n hide-s">${x.test.model.rps.toFixed(4)}</td><td class="n hide-s">${x.test.market.rps.toFixed(4)}</td></tr>`).join('')}</table></div>
    ${all.some((x) => !x.test) ? `<div class="card"><h2>Leagues from 2012: in sample only</h2><p class="small muted" style="margin:0 0 10px">football-data's files for these start in 2012, so there is nothing before the holdout to tune them on, and their scores below are in sample (flattering).</p>
    <table><tr><th>League</th><th class="n">Matches</th><th class="n">premelo</th><th class="n">Closing odds</th></tr>${all.filter((x) => !x.test).map((x) => `<tr><td><a href="#/method/${x.id}">${esc(x.league)}</a></td><td class="n">${x.all.matches.toLocaleString()}</td><td class="n">${x.all.model.logloss.toFixed(3)}</td><td class="n">${x.all.market.logloss.toFixed(3)}</td></tr>`).join('')}</table></div>` : ''}
    <div class="card"><h2>${esc(b.league)}: the published model, season by season (in sample)</h2>
    <div class="tabs" style="flex-wrap:wrap">${all.map((x) => `<button data-l="${x.id}" class="${x.id === b.id ? 'on' : ''}">${esc(x.league)}</button>`).join('')}</div>
    <p class="small muted" style="margin:0 0 10px">Elo: K ${p.elo.k}, home advantage ${p.elo.hfa} to start${p.elo.kH ? `, learnt at ${p.elo.kH}` : ''} (${p.elo.hfaEmpty} without crowds), margin ${p.elo.margin === 'log' ? '1 + ln n' : 'World Football Elo'}, ${pct(p.elo.regress)}% back to the mean between seasons. ${p.attack ? `Attack/defence: k ${p.attack.k}. Blend: ${pct(p.blend)}% Elo.` : ''} Before 2012-13 the bookmakers' prices are the median opening ones, a weaker benchmark than closing prices. Baseline: only how often home sides, draws and away sides won in earlier seasons.</p>
    <table><tr><th>Season</th><th class="n">Matches</th><th class="n">premelo</th><th class="n">Bookmakers</th><th class="n hide-s">RPS</th><th class="n hide-s">RPS bookmakers</th><th class="n hide-s">Baseline</th></tr>${b.seasons.map(row).join('')}</table></div>
    <div class="card"><h2>Calibration: ${esc(b.league)} home wins</h2><p class="small muted" style="margin:0 0 10px">Matches grouped by premelo's home-win chance: how often the home side then won.</p>
    <table><tr><th>Predicted</th><th class="n">Matches</th><th class="n">Average predicted</th><th class="n">Home won</th></tr>${b.calibration.map((c) => `<tr><td>${c.bucket}</td><td class="n">${c.matches}</td><td class="n">${pct(c.predicted)}%</td><td class="n">${pct(c.actual)}%</td></tr>`).join('')}</table></div>`;
  $('main').querySelectorAll('[data-l]').forEach((x) => (x.onclick = () => { location.hash = `#/method/${x.dataset.l}`; }));
}

function nav(page) {
  $('leagues').innerHTML = `<a href="#/europe" class="${page === 'europe' ? 'on' : ''}">Europe</a>` + LEAGUES.map((l) => `<a href="${page === 'method' ? `#/method/${l.id}` : page === 'fixtures' ? `#/${l.id}/fixtures` : home(l.id)}" class="${l.id === league && page !== 'europe' ? 'on' : ''}${l.extra ? ' minor' : ''}" title="${esc(l.name)}">${esc(l.short ?? l.name)}</a>`).join('');
  const eu = page === 'europe', euFx = eu && location.hash.endsWith('/fixtures');
  $('nav').innerHTML = `<a href="${eu ? '#/europe' : home()}" class="${(page === 'table' || page === 'club' || (eu && !euFx)) ? 'on' : ''}">Table</a><a href="${eu ? '#/europe/fixtures' : `#/${league}/fixtures`}" class="${page === 'fixtures' || euFx ? 'on' : ''}">Fixtures</a><a href="#/week" class="${page === 'week' ? 'on' : ''}">This week</a><a href="#/h2h" class="${page === 'h2h' ? 'on' : ''}">Compare</a><a href="#/method/${league}" class="${page === 'method' ? 'on' : ''}">Method</a>`;
}

async function route() {
  if (!LEAGUES.length) { const d = await get('data/leagues.json'); LEAGUES = d.leagues; EUROPE = d.europe; }
  let parts = (location.hash || '#/').slice(2).split('/').filter(Boolean);
  if (parts[0] === 'method') { league = LEAGUES.some((l) => l.id === parts[1]) ? parts[1] : league; parts = ['method']; }
  else if (parts[0] === 'europe') parts = ['europe', parts[1]];
  else if (parts[0] === 'h2h') parts = ['h2h', parts[1], parts[2]];
  else if (parts[0] === 'week') parts = ['week'];
  else if (LEAGUES.some((l) => l.id === parts[0])) league = parts.shift();
  else league = 'pl';
  const [page = 'table', arg] = parts;
  if (page === 'table') division = division === 'second' && parts.length ? division : 'top';
  nav(page);
  try {
    if (page === 'fixtures') await viewFixtures();
    else if (page === 'method') await viewMethod();
    else if (page === 'europe') await (arg === 'fixtures' ? viewEuropeFixtures() : viewEurope());
    else if (page === 'h2h') await viewH2H(parts[1], parts[2]);
    else if (page === 'week') await viewWeek();
    else if (page === 'club' && arg) await viewClub(arg);
    else await viewTable();
  } catch (e) { $('main').innerHTML = `<p class="pad muted">Couldn't load: ${esc(e.message)}</p>`; }
  scrollTo(0, 0);
}
addEventListener('hashchange', route);
route();
