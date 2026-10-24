// The link-preview card (card.svg, and card.png when rsvg-convert is installed): Europe's top six as
// they stand, each with its league, its Elo and the line of its last 20 ratings. Run by the build.
import { writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
export function card(ratings) {
  const top = ratings.clubs.slice(0, 6);
  const through = new Date(ratings.through).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const rows = top.map((c, i) => {
    const y = 296 + i * 49, s = c.spark, lo = Math.min(...s), hi = Math.max(...s), span = hi - lo || 1;
    const pts = s.map((v, j) => `${(820 + (j / (s.length - 1)) * 290).toFixed(1)},${(y - 4 - ((v - lo) / span) * 22).toFixed(1)}`).join(' ');
    const [ex, ey] = pts.split(' ').at(-1).split(',');
    const ch = c.change30 > 0 ? `+${c.change30}` : c.change30 < 0 ? `−${-c.change30}` : '0';
    return `<text x="80" y="${y}" fill="#617067">${i + 1}</text><text x="122" y="${y}" fill="#17251e" font-weight="600">${esc(c.name)} <tspan fill="#617067" font-size="20" font-weight="normal">${esc(c.leagueName)}</tspan></text>
  <text x="640" y="${y}" fill="#17251e" font-weight="bold" text-anchor="end">${c.elo}</text>
  <text x="760" y="${y}" fill="${c.change30 > 0 ? '#167450' : c.change30 < 0 ? '#b54439' : '#617067'}" text-anchor="end">${ch}</text>
  <polyline points="${pts}" fill="none" stroke="#167451" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/><circle cx="${ex}" cy="${ey}" r="5" fill="#167451"/>
  ${i < top.length - 1 ? `<line x1="80" x2="1120" y1="${y + 18}" y2="${y + 18}" stroke="#dfe5dc" stroke-width="2"/>` : ''}`;
  }).join('\n  ');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" font-family="DejaVu Sans, sans-serif">
  <defs><linearGradient id="hd" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#10291f"/><stop offset="1" stop-color="#1a3d2d"/></linearGradient></defs>
  <rect width="1200" height="630" fill="#f4f6f1"/>
  <rect width="1200" height="190" fill="url(#hd)"/>
  <rect y="190" width="1200" height="6" fill="#c8f36a"/>
  <rect x="80" y="52" width="84" height="84" rx="22" fill="#c8f36a"/>
  <path d="M97 114L117 94L131 103L151 75" fill="none" stroke="#15291f" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/><circle cx="151" cy="75" r="7" fill="#15291f"/>
  <text x="190" y="112" font-size="66" fill="#f4f8f4" letter-spacing="-2"><tspan fill="#c8f36a" font-weight="bold">prem</tspan>elo</text>
  <text x="1120" y="108" font-size="26" fill="#bdcfc3" text-anchor="end">Football Elo for Europe, from every</text>
  <text x="1120" y="142" font-size="26" fill="#bdcfc3" text-anchor="end">result since 1993</text>
  <g font-size="16" fill="#617067" font-weight="bold" letter-spacing="1.5"><text x="122" y="240">CLUB</text><text x="640" y="240" text-anchor="end">ELO</text><text x="760" y="240" text-anchor="end">30 DAYS</text><text x="820" y="240">LAST 20 MATCHES</text></g>
  <g font-size="27">
  ${rows}
  </g>
  <text x="80" y="606" font-size="19" fill="#617067">Through ${esc(through)} · chances for every coming match · tested against the bookmakers</text>
</svg>
`;
}

export function writeCard(ratings) {
  writeFileSync('card.svg', card(ratings));
  try { execFileSync('rsvg-convert', ['-w', '1200', '-h', '630', 'card.svg', '-o', 'card.png']); return true; }
  catch { console.log('card.png not redrawn: rsvg-convert is not installed'); return false; }
}
