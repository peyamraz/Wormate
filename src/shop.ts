import { GAME_CONFIG as CONFIG } from './constants';
import type { FlagSkin, WormPattern } from './constants';

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';
export type HatId = 'none' | 'crown' | 'cowboy' | 'party' | 'beanie' | 'helmet' | 'wizard';
export type GlassesId = 'none' | 'sun' | 'cool' | 'heart' | 'mono' | 'star';

export interface ShopSkin {
  id: string;
  name: string;
  price: number;
  rarity: Rarity;
  color: string;
  pattern: WormPattern;
}

export interface ShopHat { id: HatId; name: string; price: number; rarity: Rarity; }
export interface ShopGlasses { id: GlassesId; name: string; price: number; rarity: Rarity; }

export interface Loadout { skin: string; hat: HatId; glasses: GlassesId; }

// Bayrak şerit renkleri (üstten alta). Worm.color taban olarak ilk renk kullanılır.
export const FLAG_STRIPES: Record<FlagSkin, string[]> = {
  'flag-tr': ['#e30a17', '#e30a17', '#ffffff'],
  'flag-az': ['#00b5e2', '#ef3340', '#00a651'],
  'flag-de': ['#000000', '#dd0000', '#ffce00'],
  'flag-fr': ['#0055a4', '#ffffff', '#ef4135'],
  'flag-us': ['#b31942', '#ffffff', '#0a3161'],
  'flag-br': ['#009b3a', '#ffdf00', '#002776'],
  'flag-gb': ['#012169', '#ffffff', '#c8102e'],
  'flag-it': ['#009246', '#ffffff', '#ce2b37'],
};

const PATTERN_TR: Record<string, string> = {
  solid: 'Sade', candy: 'Şeker', freckles: 'Benekli', stripes: 'Çizgili', dots: 'Puantiye',
  'flag-tr': 'Türkiye', 'flag-az': 'Azerbaycan', 'flag-de': 'Almanya', 'flag-fr': 'Fransa',
  'flag-us': 'ABD', 'flag-br': 'Brezilya', 'flag-gb': 'İngiltere', 'flag-it': 'İtalya',
};

function rarityFor(price: number): Rarity {
  if (price >= 800) return 'legendary';
  if (price >= 450) return 'epic';
  if (price >= 200) return 'rare';
  return 'common';
}

function buildSkins(): ShopSkin[] {
  const skins: ShopSkin[] = [];
  // 1) Sade renkler — ilk renk bedava (varsayılan), diğerleri ucuz
  CONFIG.COLORS.forEach((color, i) => {
    skins.push({
      id: `solid-${i}`, name: `Sade ${i + 1}`, price: i === 0 ? 0 : 120,
      rarity: i === 0 ? 'common' : 'common', color, pattern: 'solid',
    });
  });
  // 2) Desenler — her renkte candy/freckles/stripes/dots
  const patterns: WormPattern[] = ['candy', 'freckles', 'stripes', 'dots'];
  const patternPrice: Record<string, number> = { candy: 250, freckles: 250, stripes: 350, dots: 350 };
  CONFIG.COLORS.slice(0, 6).forEach((color, i) => {
    for (const pattern of patterns) {
      skins.push({
        id: `${pattern}-${i}`, name: `${PATTERN_TR[pattern]} ${i + 1}`,
        price: patternPrice[pattern], rarity: rarityFor(patternPrice[pattern]),
        color, pattern,
      });
    }
  });
  // 3) Ülke bayrakları
  const flags = Object.keys(FLAG_STRIPES) as FlagSkin[];
  const flagNames: Record<string, number> = {
    'flag-tr': 300, 'flag-az': 300, 'flag-de': 400, 'flag-fr': 400,
    'flag-us': 500, 'flag-br': 500, 'flag-gb': 600, 'flag-it': 600,
  };
  for (const flag of flags) {
    const stripes = FLAG_STRIPES[flag];
    skins.push({
      id: flag, name: `Bayrak: ${PATTERN_TR[flag]}`,
      price: flagNames[flag], rarity: rarityFor(flagNames[flag]),
      color: stripes[0], pattern: flag,
    });
  }
  return skins;
}

export const SHOP_SKINS: ShopSkin[] = buildSkins();

export const SHOP_HATS: ShopHat[] = [
  { id: 'none', name: 'Şapkasız', price: 0, rarity: 'common' },
  { id: 'party', name: 'Parti Şapkası', price: 200, rarity: 'common' },
  { id: 'beanie', name: 'Bere', price: 350, rarity: 'rare' },
  { id: 'cowboy', name: 'Kovboy Şapkası', price: 600, rarity: 'epic' },
  { id: 'helmet', name: 'Kask', price: 700, rarity: 'epic' },
  { id: 'wizard', name: 'Sihirbaz Şapkası', price: 900, rarity: 'legendary' },
  { id: 'crown', name: 'Kral Tacı', price: 1000, rarity: 'legendary' },
];

export const SHOP_GLASSES: ShopGlasses[] = [
  { id: 'none', name: 'Gözlüksüz', price: 0, rarity: 'common' },
  { id: 'cool', name: 'Havalı Gözlük', price: 150, rarity: 'common' },
  { id: 'sun', name: 'Güneş Gözlüğü', price: 300, rarity: 'rare' },
  { id: 'mono', name: 'Monokl', price: 450, rarity: 'epic' },
  { id: 'star', name: 'Yıldız Gözlük', price: 650, rarity: 'epic' },
  { id: 'heart', name: 'Kalp Gözlük', price: 800, rarity: 'legendary' },
];

// ---------- cüzdan + envanter (localStorage) ----------
const COINS_KEY = 'wormate_coins';
const OWNED_KEY = 'wormate_owned';
const LOADOUT_KEY = 'wormate_loadout';

export function readCoins(): number {
  try {
    const v = Number(localStorage.getItem(COINS_KEY) ?? 0);
    return Number.isSafeInteger(v) && v >= 0 && v <= 999999999 ? v : 0;
  } catch { return 0; }
}

export function earnCoins(score: number): number {
  const gain = Math.max(0, Math.min(999999, Math.floor(score / 10)));
  if (!gain) return readCoins();
  const total = Math.min(999999999, readCoins() + gain);
  try { localStorage.setItem(COINS_KEY, String(total)); } catch { /* oynanabilir kal */ }
  return total;
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw || raw.length > 8192) return fallback;
    return { ...fallback, ...(JSON.parse(raw) as Partial<T>) };
  } catch { return fallback; }
}

export interface Owned { skins: string[]; hats: HatId[]; glasses: GlassesId[]; }

export function readOwned(): Owned {
  const v = readJson<Owned>(OWNED_KEY, { skins: ['solid-0'], hats: ['none'], glasses: ['none'] });
  return {
    skins: Array.isArray(v.skins) ? v.skins.filter(s => typeof s === 'string').slice(0, 200) : ['solid-0'],
    hats: Array.isArray(v.hats) ? v.hats.filter(h => typeof h === 'string').slice(0, 20) as HatId[] : ['none'],
    glasses: Array.isArray(v.glasses) ? v.glasses.filter(g => typeof g === 'string').slice(0, 20) as GlassesId[] : ['none'],
  };
}

export function readLoadout(): Loadout {
  return readJson<Loadout>(LOADOUT_KEY, { skin: 'solid-0', hat: 'none', glasses: 'none' });
}

function writeJson(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* yoksay */ }
}

export function buySkin(id: string): { coins: number; owned: Owned; ok: boolean } {
  const item = SHOP_SKINS.find(s => s.id === id);
  const coins = readCoins();
  const owned = readOwned();
  if (!item || owned.skins.includes(id) || coins < item.price) return { coins, owned, ok: false };
  const next = { coins: coins - item.price, owned: { ...owned, skins: [...owned.skins, id] } };
  try { localStorage.setItem(COINS_KEY, String(next.coins)); } catch { /* yoksay */ }
  writeJson(OWNED_KEY, next.owned);
  return { ...next, ok: true };
}

export function buyHat(id: HatId): { coins: number; owned: Owned; ok: boolean } {
  const item = SHOP_HATS.find(h => h.id === id);
  const coins = readCoins();
  const owned = readOwned();
  if (!item || owned.hats.includes(id) || coins < item.price) return { coins, owned, ok: false };
  const next = { coins: coins - item.price, owned: { ...owned, hats: [...owned.hats, id] } };
  try { localStorage.setItem(COINS_KEY, String(next.coins)); } catch { /* yoksay */ }
  writeJson(OWNED_KEY, next.owned);
  return { ...next, ok: true };
}

export function buyGlasses(id: GlassesId): { coins: number; owned: Owned; ok: boolean } {
  const item = SHOP_GLASSES.find(g => g.id === id);
  const coins = readCoins();
  const owned = readOwned();
  if (!item || owned.glasses.includes(id) || coins < item.price) return { coins, owned, ok: false };
  const next = { coins: coins - item.price, owned: { ...owned, glasses: [...owned.glasses, id] } };
  try { localStorage.setItem(COINS_KEY, String(next.coins)); } catch { /* yoksay */ }
  writeJson(OWNED_KEY, next.owned);
  return { ...next, ok: true };
}

export function equip(part: keyof Loadout, id: string): Loadout {
  const owned = readOwned();
  const cur = readLoadout();
  if (part === 'skin' && !owned.skins.includes(id)) return cur;
  if (part === 'hat' && !(owned.hats as string[]).includes(id)) return cur;
  if (part === 'glasses' && !(owned.glasses as string[]).includes(id)) return cur;
  const next = { ...cur, [part]: id };
  writeJson(LOADOUT_KEY, next);
  return next;
}

export function skinById(id: string): ShopSkin {
  return SHOP_SKINS.find(s => s.id === id) ?? SHOP_SKINS[0];
}
