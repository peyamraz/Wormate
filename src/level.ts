// Seviye/XP: toplam skor birikir (localStorage, cüzdan gibi kalıcı).
// Eşik üçgensel: L(n) için 250*n*(n-1) toplam XP gerekir.
const XP_KEY = 'wormate_xp';

export function xpForLevel(level: number): number {
  const n = Math.max(1, Math.floor(level));
  return 250 * n * (n - 1);
}

export function levelForXp(total: number): number {
  const xp = Math.max(0, Math.floor(total));
  let level = 1;
  while (xpForLevel(level + 1) <= xp) level++;
  return Math.min(level, 999);
}

export function levelProgress(total: number): { level: number; cur: number; need: number } {
  const level = levelForXp(total);
  const cur = total - xpForLevel(level);
  const need = xpForLevel(level + 1) - xpForLevel(level);
  return { level, cur, need };
}

export function readXp(): number {
  try {
    const v = Number(localStorage.getItem(XP_KEY) ?? 0);
    return Number.isSafeInteger(v) && v >= 0 && v <= 999999999 ? v : 0;
  } catch { return 0; }
}

export function addXp(score: number): { total: number; level: number; leveledUp: boolean } {
  const before = levelForXp(readXp());
  const gain = Number.isSafeInteger(score) && score > 0 ? Math.min(999999, score) : 0;
  const total = Math.min(999999999, readXp() + gain);
  try { localStorage.setItem(XP_KEY, String(total)); } catch { /* yoksay */ }
  const level = levelForXp(total);
  return { total, level, leveledUp: level > before };
}
