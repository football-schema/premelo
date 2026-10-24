// The link-preview card (card.svg, and card.png when rsvg-convert is installed): the Premier League's top six as
// they stand, each with its Elo and the line of its last 20 ratings. Run by the build.
import { writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
export function card(ratings) {
  const top = ratings.clubs.filter((c) => c.div === 'E0').slice(0, 6);
  const through = new Date(ratings.through).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const rows = top.map((c, i) => {
    const y = 268 + i * 52, s = c.spark, lo = Math.min(...s), hi = Math.max(...s), span = hi - lo || 1;
    const pts = s.map((v, j) => `${(820 + (j / (s.length - 1)) * 300).toFixed(1)},${(y - 4 - ((v - lo) / span) * 22).toFixed(1)}`).join(' ');
    const ch = c.change30 > 0 ? `+${c.change30}` : c.change30 < 0 ? `−${-c.change30}` : '0';
    return `<text x="80" y="${y}" fill="#77766f">${i + 1}</text><text x="122" y="${y}" fill="#0b0b0b">${esc(c.name)}</text>
  <text x="640" y="${y}" fill="#0b0b0b" font-weight="bold" text-anchor="end">${c.elo}</text>
  <text x="760" y="${y}" fill="${c.change30 > 0 ? '#1a7f3c' : c.change30 < 0 ? '#c0392b' : '#77766f'}" text-anchor="end">${ch}</text>
  <polyline points="${pts}" fill="none" stroke="#2a78d6" stroke-width="3" stroke-linejoin="round"/>
  <line x1="80" x2="1120" y1="${y + 18}" y2="${y + 18}" stroke="#e4e3df" stroke-width="2"/>`;
  }).join('\n  ');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" font-family="DejaVu Sans, sans-serif">
  <rect width="1200" height="630" fill="#fcfcfb"/>
  <text x="80" y="112" font-size="72" fill="#0b0b0b" letter-spacing="-1.5"><tspan fill="#2a78d6" font-weight="bold">prem</tspan>elo</text>
  <text x="80" y="164" font-size="30" fill="#52514e">Premier League Elo, from every result since 1993</text>
  <g font-size="20" fill="#77766f"><text x="122" y="214">Club</text><text x="640" y="214" text-anchor="end">Elo</text><text x="760" y="214" text-anchor="end">30 days</text><text x="820" y="214">Last 20 matches</text></g>
  <line x1="80" x2="1120" y1="230" y2="230" stroke="#e4e3df" stroke-width="2"/>
  <g font-size="28">
  ${rows}
  </g>
  <text x="80" y="600" font-size="20" fill="#77766f">Through ${esc(through)} · chances for every coming match · checked against the bookmakers</text>
</svg>
`;
}

export function writeCard(ratings) {
  writeFileSync('card.svg', card(ratings));
  try { execFileSync('rsvg-convert', ['-w', '1200', '-h', '630', 'card.svg', '-o', 'card.png']); return true; }
  catch { console.log('card.png not redrawn: rsvg-convert is not installed'); return false; }
}
