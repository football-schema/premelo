// premelo's page: everything comes from the JSON the build writes into data/.
// Routes: #/<league> (the table), #/<league>/fixtures, #/<league>/club/<slug>, #/method[/<league>].
// The Premier League is the default, so #/, #/fixtures and #/club/<slug> are its pages.
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const pct = (x) => Math.round(x * 100);
const signed = (n) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0');
const cache = new Map();
const get = (path) => cache.get(path) ?? cache.set(path, fetch(path).then((r) => { if (!r.ok) throw new Error(`${path}: ${r.status}`); return r.json(); })).get(path);
const day = (iso) => new Date(iso).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
const time = (iso) => new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
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
  return `<svg class="spark" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true"><polyline points="${pts}" fill="none" stroke="var(--accent)" stroke-width="1.5" stroke-linejoin="round"/></svg>`;
}
const form = (f) => `<span class="form">${[...f].map((r) => `<span class="${r}">${r}</span>`).join('')}</span>`;
const bar = (f) => `<div class="bar" role="img" aria-label="${esc(f.homeName)} ${pct(f.H)}%, draw ${pct(f.D)}%, ${esc(f.awayName)} ${pct(f.A)}%">
  <span class="ph" style="flex:${f.H}">${pct(f.H)}</span><span class="pd" style="flex:${f.D}">${pct(f.D)}</span><span class="pa" style="flex:${f.A}">${pct(f.A)}</span></div>`;
const clubLink = (slug, name) => `<a href="#/${league}/club/${slug}">${esc(name)}</a>`;

// grouped by matchweek where there is one (the Premier League's, from matchday), else by day
function fixtureRows(list) {
  let group = null, out = '';
  for (const f of list) {
    const g = f.gw ? `Matchweek ${f.gw}` : day(f.kickoff);
    if (g !== group) { group = g; out += `<div class="gw">${esc(g)}</div>`; }
    out += `<div class="fx"><div class="when">${day(f.kickoff)}<br>${f.tbc ? 'TBC' : time(f.kickoff)}</div>
      <div class="h"><div class="t">${clubLink(f.homeSlug, f.homeName)}</div><div class="xg">${f.elo[0]} · xG ${f.xg[0].toFixed(1)}</div></div>
      <div><div class="t">${clubLink(f.awaySlug, f.awayName)}</div><div class="xg">${f.elo[1]} · xG ${f.xg[1].toFixed(1)}</div></div>
      ${bar(f)}</div>`;
  }
  return out;
}

let division = 'top';
async function viewTable() {
  const [r, fx] = await Promise.all([get(path('ratings.json')), get(path('fixtures.json'))]);
  const l = L(), rows = r.clubs.filter((c) => c.div === division);
  const next = fx.fixtures[0]?.gw ? fx.fixtures.filter((f) => f.gw === fx.fixtures[0].gw) : fx.fixtures.filter((f) => Date.parse(f.kickoff) < Date.parse(fx.fixtures[0].kickoff) + 5 * 86400_000);
  $('main').innerHTML = `<h1>${esc(l.name)} Elo</h1>
    <p class="sub">Ratings after every result since 1993, through ${fullDate(r.through)}. A 100-point gap makes the stronger side about a 64% favourite on neutral ground. Ratings compare clubs within ${esc(l.country)} only.</p>
    <div class="card"><div class="tabs"><button data-d="top" class="${division === 'top' ? 'on' : ''}">${esc(l.name)}</button><button data-d="second" class="${division === 'second' ? 'on' : ''}">${esc(l.second)}</button></div>
    <table><tr><th class="n">#</th><th>Club</th><th class="n">Elo</th><th class="n">30 days</th><th class="hide-s">Last 20</th><th class="hide-s">Form</th></tr>
    ${rows.map((c) => `<tr><td class="n muted">${c.rank}</td><td>${clubLink(c.slug, c.name)}</td><td class="n"><b>${c.elo}</b></td>
      <td class="n ${c.change30 > 0 ? 'up' : c.change30 < 0 ? 'down' : 'muted'}">${signed(c.change30)}</td><td class="hide-s">${spark(c.spark)}</td><td class="hide-s">${form(c.form)}</td></tr>`).join('')}</table></div>
    ${next.length ? `<div class="card"><h2>Next up</h2>${fixtureRows(next)}<p class="small muted" style="margin:10px 0 0">Bars: home win · draw · away win, in %. <a href="#/${league}/fixtures">Every fixture</a></p></div>` : ''}`;
  $('main').querySelectorAll('[data-d]').forEach((b) => (b.onclick = () => { division = b.dataset.d; viewTable(); }));
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
    <polyline class="line" points="${h.map((x, i) => `${X(t[i]).toFixed(1)},${Y(v[i]).toFixed(1)}`).join(' ')}"/>
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
    tip.append(bold, ` · ${fullDate(m[0])}`, document.createElement('br'), `${m[5] === 'h' ? 'v' : 'at'} ${m[2]} ${m[3]}-${m[4]}${m[6] === 'second' ? ` · ${second}` : ''}`);
    tip.style.display = 'block';
    const sx = (px / W) * box.width, sy = (py / H) * box.height;
    tip.style.left = `${Math.min(box.width - tip.offsetWidth, Math.max(0, sx - tip.offsetWidth / 2))}px`; tip.style.top = `${Math.max(0, sy - tip.offsetHeight - 12)}px`;
  };
  svg.addEventListener('pointermove', (e) => show(e.clientX));
  svg.addEventListener('pointerleave', () => { hair.style.display = dot.style.display = tip.style.display = 'none'; });
}

const ordinal = (n) => `${n}${['th', 'st', 'nd', 'rd'][n % 10 > 3 || [11, 12, 13].includes(n % 100) ? 0 : n % 10]}`;
async function viewClub(slug) {
  const [r, fx] = await Promise.all([get(path('ratings.json')), get(path('fixtures.json'))]);
  const c = await get(path(`clubs/${slug}.json`)), l = L();
  const now = r.clubs.find((x) => x.slug === slug), h = c.history;
  const best = h.reduce((a, x) => (x[1] > a[1] ? x : a)), worst = h.reduce((a, x) => (x[1] < a[1] ? x : a));
  const mine = fx.fixtures.filter((f) => f.home === c.club || f.away === c.club).slice(0, 6);
  const recent = h.slice(-10).reverse();
  $('main').innerHTML = `<h1>${esc(c.name)}</h1>
    <p class="sub">${now ? `${now.div === 'top' ? esc(l.name) : esc(l.second)} · ${ordinal(now.rank)} of ${r.clubs.filter((x) => x.div === now.div).length}` : `Outside ${esc(l.country)}'s top two divisions this season`} · ${h.length} league matches since ${h[0][0].slice(0, 4)}</p>
    <div class="stats"><div><b>${h.at(-1)[1]}</b>Elo now</div><div><b>${best[1]}</b>Highest · ${best[0].slice(0, 4)}</div><div><b>${worst[1]}</b>Lowest · ${worst[0].slice(0, 4)}</div>${now ? `<div><b class="${now.change30 > 0 ? 'up' : now.change30 < 0 ? 'down' : ''}">${signed(now.change30)}</b>Last 30 days</div>` : ''}</div>
    <div class="card"><h2>Rating since ${h[0][0].slice(0, 4)}</h2><div class="chart" id="chart"></div><p class="small muted" style="margin:8px 0 0">Shaded: seasons in the ${esc(l.second)}.</p></div>
    ${mine.length ? `<div class="card"><h2>Coming up</h2>${fixtureRows(mine)}</div>` : ''}
    <div class="card"><h2>Last 10 matches</h2><table><tr><th>Date</th><th>Opponent</th><th class="n">Score</th><th class="n">Elo after</th><th class="n">Change</th></tr>
    ${recent.map((x, i) => { const prev = h[h.length - 2 - i]?.[1] ?? x[1], d = x[1] - prev; return `<tr><td class="muted">${fullDate(x[0])}</td><td>${x[5] === 'h' ? '' : '@ '}${clubLink(slugOf(x[2]), x[2])}</td><td class="n">${x[3]}-${x[4]}</td><td class="n">${x[1]}</td><td class="n ${d > 0 ? 'up' : d < 0 ? 'down' : 'muted'}">${signed(d)}</td></tr>`; }).join('')}</table></div>`;
  ratingChart(h, $('chart'));
}

async function viewMethod() {
  const all = await Promise.all(LEAGUES.map((l) => get(`data/${l.id}/backtest.json`).then((b) => ({ ...b, id: l.id }))));
  const b = all.find((x) => x.id === league) ?? all[0], p = b.params;
  const row = (s) => `<tr><td>${s.season}</td><td class="n">${s.withOdds}</td><td class="n">${s.model.logloss.toFixed(3)}</td><td class="n">${s.market?.logloss.toFixed(3) ?? '–'}</td><td class="n hide-s">${s.model.rps.toFixed(4)}</td><td class="n hide-s">${s.market?.rps.toFixed(4) ?? '–'}</td><td class="n hide-s">${s.baseline.logloss.toFixed(3)}</td></tr>`;
  $('main').innerHTML = `<div class="prose"><h1>Method</h1>
    <p>Each country is one Elo pool of its top two divisions, run over every league match since 1993. After each match both clubs move by <code>K × margin × (result − expected)</code>: the result is 1, ½ or 0, the expected score is <code>1 / (1 + 10<sup>−gap/400</sup>)</code>, and the home side's gap includes a home advantage (a separate one for the matches played without crowds, May 2020 to May 2021). A bigger win counts for more.</p>
    <p>Between seasons each club is pulled part of the way to its division's average. A club arriving from the third tier, where there are no results here, takes the average rating of the clubs that left the other way. The first season is played through once as a warm-up.</p>
    <p>For a match, the rating gap becomes expected goals: <code>μ/2 · e<sup>±gap/c</sup></code> each, μ being the league's goals a match, and Poisson scores, with 0-0 and 1-1 made a little likelier. Home, draw and away, the goal lines and the likeliest scores all come from that one grid.</p>
    <p>Every setting is chosen per league by the backtest: the one that predicted best, judged by log loss. Ratings compare clubs within a country: without European cup results nothing ties one country's pool to another's. More in the <a href="https://github.com/football-schema/premelo#readme">README</a>.</p></div>
    <div class="card"><h2>Five leagues against their bookmakers</h2><p class="small muted" style="margin:0 0 10px">Every top-division match from 2000-01, predicted from the ratings before it, next to the bookmakers' prices with their margin taken out. Lower is better.</p>
    <table><tr><th>League</th><th class="n">Matches</th><th class="n">premelo</th><th class="n">Bookmakers</th><th class="n hide-s">RPS</th><th class="n hide-s">RPS bookmakers</th><th class="n hide-s">K · home</th></tr>
    ${all.map((x) => `<tr><td><a href="#/method/${x.id}">${esc(x.league)}</a></td><td class="n">${x.all.matches.toLocaleString()}</td><td class="n">${x.all.model.logloss.toFixed(3)}</td><td class="n">${x.all.market.logloss.toFixed(3)}</td><td class="n hide-s">${x.all.model.rps.toFixed(4)}</td><td class="n hide-s">${x.all.market.rps.toFixed(4)}</td><td class="n hide-s">${x.params.elo.k} · ${x.params.elo.hfa}</td></tr>`).join('')}</table></div>
    <div class="card"><h2>${esc(b.league)}, season by season</h2>
    <div class="tabs">${all.map((x) => `<button data-l="${x.id}" class="${x.id === b.id ? 'on' : ''}">${esc(x.league)}</button>`).join('')}</div>
    <p class="small muted" style="margin:0 0 10px">K ${p.elo.k}, home advantage ${p.elo.hfa} (${p.elo.hfaEmpty} without crowds), margin ${p.elo.margin === 'log' ? '1 + ln n' : 'World Football Elo'}, ${pct(p.elo.regress)}% back to the mean between seasons; goals μ ${p.goals.mu}, c ${p.goals.c}, draws +${pct(p.goals.draw)}%. Baseline: only how often home sides, draws and away sides won in earlier seasons.</p>
    <table><tr><th>Season</th><th class="n">Matches</th><th class="n">premelo</th><th class="n">Bookmakers</th><th class="n hide-s">RPS</th><th class="n hide-s">RPS bookmakers</th><th class="n hide-s">Baseline</th></tr>${b.seasons.map(row).join('')}</table></div>
    <div class="card"><h2>Calibration: ${esc(b.league)} home wins</h2><p class="small muted" style="margin:0 0 10px">Matches grouped by premelo's home-win chance: how often the home side then won.</p>
    <table><tr><th>Predicted</th><th class="n">Matches</th><th class="n">Average predicted</th><th class="n">Home won</th></tr>${b.calibration.map((c) => `<tr><td>${c.bucket}</td><td class="n">${c.matches}</td><td class="n">${pct(c.predicted)}%</td><td class="n">${pct(c.actual)}%</td></tr>`).join('')}</table></div>`;
  $('main').querySelectorAll('[data-l]').forEach((x) => (x.onclick = () => { location.hash = `#/method/${x.dataset.l}`; }));
}

function nav(page) {
  $('leagues').innerHTML = LEAGUES.map((l) => `<a href="${page === 'method' ? `#/method/${l.id}` : page === 'fixtures' ? `#/${l.id}/fixtures` : home(l.id)}" class="${l.id === league ? 'on' : ''}">${esc(l.name)}</a>`).join('');
  $('nav').innerHTML = `<a href="${home()}" class="${page === 'table' || page === 'club' ? 'on' : ''}">Table</a><a href="#/${league}/fixtures" class="${page === 'fixtures' ? 'on' : ''}">Fixtures</a><a href="#/method/${league}" class="${page === 'method' ? 'on' : ''}">Method</a>`;
}

async function route() {
  if (!LEAGUES.length) LEAGUES = (await get('data/leagues.json')).leagues;
  let parts = (location.hash || '#/').slice(2).split('/').filter(Boolean);
  if (parts[0] === 'method') { league = LEAGUES.some((l) => l.id === parts[1]) ? parts[1] : league; parts = ['method']; }
  else if (LEAGUES.some((l) => l.id === parts[0])) league = parts.shift();
  else league = 'pl';
  const [page = 'table', arg] = parts;
  if (page === 'table') division = division === 'second' && parts.length ? division : 'top';
  nav(page);
  try {
    if (page === 'fixtures') await viewFixtures();
    else if (page === 'method') await viewMethod();
    else if (page === 'club' && arg) await viewClub(arg);
    else await viewTable();
  } catch (e) { $('main').innerHTML = `<p class="pad muted">Couldn't load: ${esc(e.message)}</p>`; }
  scrollTo(0, 0);
}
addEventListener('hashchange', route);
route();
