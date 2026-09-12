import { GAME_CONFIG as CONFIG } from './constants';
import type { FlagSkin, WormPattern } from './constants';
import { t } from './i18n';

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';
export type HatId = 'none' | 'crown' | 'cowboy' | 'party' | 'beanie' | 'helmet' | 'wizard';
export type GlassesId = 'none' | 'sun' | 'cool' | 'heart' | 'mono' | 'star';
export type EyeId = 'normal' | 'sleepy' | 'angry' | 'star';
export type MouthId = 'smile' | 'teeth' | 'open';
export type SkinCategory = 'basit' | 'cizgili' | 'desenli' | 'bayraklar';

export interface ShopSkin {
  id: string;
  price: number;
  rarity: Rarity;
  color: string;
  pattern: WormPattern;
  category: SkinCategory;
}

export interface ShopHat { id: HatId; price: number; rarity: Rarity; }
export interface ShopGlasses { id: GlassesId; price: number; rarity: Rarity; }
export interface ShopEyes { id: EyeId; price: number; rarity: Rarity; }
export interface ShopMouth { id: MouthId; price: number; rarity: Rarity; }

export interface Loadout { skin: string; hat: HatId; glasses: GlassesId; eyes: EyeId; mouth: MouthId; }

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

// Görünen adlar o anki dile göre üretilir (mağaza adları sözlükte yaşar).
const FLAG_COUNTRY: Record<FlagSkin, string> = {
  'flag-tr': t.cTR, 'flag-az': t.cAZ, 'flag-de': t.cDE, 'flag-fr': t.cFR,
  'flag-us': t.cUS, 'flag-br': t.cBR, 'flag-gb': t.cGB, 'flag-it': t.cIT,
};

function patternWord(pattern: WormPattern): string {
  switch (pattern) {
    case 'solid': return t.patSolid;
    case 'candy': return t.patCandy;
    case 'freckles': return t.patFreckles;
    case 'stripes': return t.patStripes;
    case 'dots': return t.patDots;
    default: return pattern;
  }
}

export function skinName(skin: ShopSkin): string {
  if (skin.pattern.startsWith('flag-')) {
    return `${t.flagWord}: ${FLAG_COUNTRY[skin.pattern as FlagSkin] ?? skin.pattern}`;
  }
  const n = Number(skin.id.split('-').pop());
  const suffix = Number.isFinite(n) ? ` ${n + 1}` : '';
  return `${patternWord(skin.pattern)}${suffix}`;
}

const HAT_NAMES: Record<HatId, string> = {
  none: t.hatNone, party: t.hatParty, beanie: t.hatBeanie, cowboy: t.hatCowboy,
  helmet: t.hatHelmet, wizard: t.hatWizard, crown: t.hatCrown,
};
const GLASSES_NAMES: Record<GlassesId, string> = {
  none: t.glNone, cool: t.glCool, sun: t.glSun, mono: t.glMono, star: t.glStar, heart: t.glHeart,
};

export function hatName(id: HatId): string { return HAT_NAMES[id]; }
export function glassesName(id: GlassesId): string { return GLASSES_NAMES[id]; }

const EYE_NAMES: Record<EyeId, string> = { normal: t.eyeNormal, sleepy: t.eyeSleepy, angry: t.eyeAngry, star: t.eyeStar };
const MOUTH_NAMES: Record<MouthId, string> = { smile: t.mouthSmile, teeth: t.mouthTeeth, open: t.mouthOpen };

export function eyeName(id: EyeId): string { return EYE_NAMES[id]; }
export function mouthName(id: MouthId): string { return MOUTH_NAMES[id]; }

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
      id: `solid-${i}`, price: i === 0 ? 0 : 120,
      rarity: 'common', color, pattern: 'solid', category: 'basit',
    });
  });
  // 2) Desenler — her renkte candy/freckles/stripes/dots
  const patterns: WormPattern[] = ['candy', 'freckles', 'stripes', 'dots'];
  const patternPrice: Record<string, number> = { candy: 250, freckles: 250, stripes: 350, dots: 350 };
  CONFIG.COLORS.slice(0, 6).forEach((color, i) => {
    for (const pattern of patterns) {
      skins.push({
        id: `${pattern}-${i}`,
        price: patternPrice[pattern], rarity: rarityFor(patternPrice[pattern]),
        color, pattern, category: pattern === 'stripes' ? 'cizgili' : 'desenli',
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
      id: flag,
      price: flagNames[flag], rarity: rarityFor(flagNames[flag]),
      color: stripes[0], pattern: flag, category: 'bayraklar',
    });
  }
  return skins;
}

export const SHOP_SKINS: ShopSkin[] = buildSkins();

export const SHOP_HATS: ShopHat[] = [
  { id: 'none', price: 0, rarity: 'common' },
  { id: 'party', price: 200, rarity: 'common' },
  { id: 'beanie', price: 350, rarity: 'rare' },
  { id: 'cowboy', price: 600, rarity: 'epic' },
  { id: 'helmet', price: 700, rarity: 'epic' },
  { id: 'wizard', price: 900, rarity: 'legendary' },
  { id: 'crown', price: 1000, rarity: 'legendary' },
];

export const SHOP_GLASSES: ShopGlasses[] = [
  { id: 'none', price: 0, rarity: 'common' },
  { id: 'cool', price: 150, rarity: 'common' },
  { id: 'sun', price: 300, rarity: 'rare' },
  { id: 'mono', price: 450, rarity: 'epic' },
  { id: 'star', price: 650, rarity: 'epic' },
  { id: 'heart', price: 800, rarity: 'legendary' },
];

export const SHOP_EYES: ShopEyes[] = [
  { id: 'normal', price: 0, rarity: 'common' },
  { id: 'sleepy', price: 250, rarity: 'rare' },
  { id: 'angry', price: 400, rarity: 'epic' },
  { id: 'star', price: 700, rarity: 'legendary' },
];

export const SHOP_MOUTHS: ShopMouth[] = [
  { id: 'smile', price: 0, rarity: 'common' },
  { id: 'teeth', price: 250, rarity: 'rare' },
  { id: 'open', price: 500, rarity: 'epic' },
];

// ---------- cüzdan + envanter (localStorage) ----------
const COINS_KEY = 'wormate_coins';
const OWNED_KEY = 'wormate_owned';
const LOADOUT_KEY = 'wormate_loadout';

// Ekonomi: skor/50 cüzdana eklenir + arenadaki ALTIN küpü başına COIN_VALUE.
export const COIN_VALUE = 10;

export function readCoins(): number {
  try {
    const v = Number(localStorage.getItem(COINS_KEY) ?? 0);
    return Number.isSafeInteger(v) && v >= 0 && v <= 999999999 ? v : 0;
  } catch { return 0; }
}

export function earnCoins(score: number): number {
  const gain = Math.max(0, Math.min(999999, Math.floor(score / 50)));
  if (!gain) return readCoins();
  const total = Math.min(999999999, readCoins() + gain);
  try { localStorage.setItem(COINS_KEY, String(total)); } catch { /* oynanabilir kal */ }
  return total;
}

export function creditCoins(amount: number): number {
  const gain = Number.isSafeInteger(amount) && amount > 0 ? Math.min(999, amount) : 0;
  if (!gain) return readCoins();
  const total = Math.min(999999999, readCoins() + gain);
  try { localStorage.setItem(COINS_KEY, String(total)); } catch { /* yoksay */ }
  return total;
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw || raw.length > 8192) return fallback;
    return { ...fallback, ...(JSON.parse(raw) as Partial<T>) };
  } catch { return fallback; }
}

export interface Owned { skins: string[]; hats: HatId[]; glasses: GlassesId[]; eyes: EyeId[]; mouths: MouthId[]; }

export function readOwned(): Owned {
  const v = readJson<Owned>(OWNED_KEY, { skins: ['solid-0'], hats: ['none'], glasses: ['none'], eyes: ['normal'], mouths: ['smile'] });
  return {
    skins: Array.isArray(v.skins) ? v.skins.filter(s => typeof s === 'string').slice(0, 200) : ['solid-0'],
    hats: Array.isArray(v.hats) ? v.hats.filter(h => typeof h === 'string').slice(0, 20) as HatId[] : ['none'],
    glasses: Array.isArray(v.glasses) ? v.glasses.filter(g => typeof g === 'string').slice(0, 20) as GlassesId[] : ['none'],
    eyes: Array.isArray(v.eyes) ? v.eyes.filter(e => typeof e === 'string').slice(0, 20) as EyeId[] : ['normal'],
    mouths: Array.isArray(v.mouths) ? v.mouths.filter(m => typeof m === 'string').slice(0, 20) as MouthId[] : ['smile'],
  };
}

export function readLoadout(): Loadout {
  return readJson<Loadout>(LOADOUT_KEY, { skin: 'solid-0', hat: 'none', glasses: 'none', eyes: 'normal', mouth: 'smile' });
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

export function buyEyes(id: EyeId): { coins: number; owned: Owned; ok: boolean } {
  const item = SHOP_EYES.find(e => e.id === id);
  const coins = readCoins();
  const owned = readOwned();
  if (!item || owned.eyes.includes(id) || coins < item.price) return { coins, owned, ok: false };
  const next = { coins: coins - item.price, owned: { ...owned, eyes: [...owned.eyes, id] } };
  try { localStorage.setItem(COINS_KEY, String(next.coins)); } catch { /* yoksay */ }
  writeJson(OWNED_KEY, next.owned);
  return { ...next, ok: true };
}

export function buyMouth(id: MouthId): { coins: number; owned: Owned; ok: boolean } {
  const item = SHOP_MOUTHS.find(m => m.id === id);
  const coins = readCoins();
  const owned = readOwned();
  if (!item || owned.mouths.includes(id) || coins < item.price) return { coins, owned, ok: false };
  const next = { coins: coins - item.price, owned: { ...owned, mouths: [...owned.mouths, id] } };
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
  if (part === 'eyes' && !(owned.eyes as string[]).includes(id)) return cur;
  if (part === 'mouth' && !(owned.mouths as string[]).includes(id)) return cur;
  const next = { ...cur, [part]: id };
  writeJson(LOADOUT_KEY, next);
  return next;
}

export function skinById(id: string): ShopSkin {
  return SHOP_SKINS.find(s => s.id === id) ?? SHOP_SKINS[0];
}
