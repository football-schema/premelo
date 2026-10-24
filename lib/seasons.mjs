// Seasons as football-data names them: '9394' for 1993-94 … '2627' for 2026-27. A season starts in July.
export const FIRST = 1993;
export const code = (start) => `${String(start % 100).padStart(2, '0')}${String((start + 1) % 100).padStart(2, '0')}`;
export const startOf = (now = new Date()) => (now.getUTCMonth() >= 6 ? now.getUTCFullYear() : now.getUTCFullYear() - 1);
export const currentSeason = (now) => code(startOf(now));
export const seasons = (now) => Array.from({ length: startOf(now) - FIRST + 1 }, (_, i) => code(FIRST + i));
export const label = (c) => { const y = Number(c.slice(0, 2)); return `${y >= 90 ? 1900 + y : 2000 + y}-${c.slice(2)}`; };
