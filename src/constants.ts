export const VERSION = '1.5.0';

export const GAME_CONFIG = {
  CANVAS_WIDTH: 5200,
  CANVAS_HEIGHT: 5200,
  // Dairesel arena: merkez + yarıçap (kare ızgara sadece mekansal indeks içindir).
  ARENA_CENTER: 2600,
  ARENA_RADIUS: 2600,
  WORM_START_LENGTH: 28,
  WORM_MAX_LENGTH: 900,
  WORM_START_RADIUS: 14,
  WORM_MAX_RADIUS_MULT: 3.2,
  WORM_SEGMENT_SPACING: 5,
  WORM_SPEED: 2.2,
  WORM_BOOST_SPEED: 4.1,
  WORM_TURN_SPEED: 0.18,
  FOOD_COUNT: 2400,
  MAX_FOOD_COUNT: 3000,
  FOOD_RADIUS: 10,
  BONUS_TARGET_COUNT: 8,
  BONUS_MAX_COUNT: 14,
  BONUS_RESPAWN_TICKS: 45,
  BONUS_NEAR_PLAYER_TICKS: 150,
  BONUS_LIFETIME_TICKS: 5400,
  GROWTH_PER_FOOD: 2,
  BOOST_CONSUMPTION_TICKS: 16,
  KILL_SCORE: 150,
  BOT_COUNT: 22,
  SPAWN_PROTECTION_TICKS: 300,
  CAMERA_START_ZOOM: 2,
  CAMERA_MIN_ZOOM: 0.7,
  CAMERA_ZOOM_SMOOTHING: 0.025,
  FOOD_COLORS: ['#ff75b5', '#51dbe4', '#b698f4', '#ffb84e', '#a8df68', '#ffedb8'],
  COLORS: [
    '#19c9d9', '#fb923c', '#a78bfa', '#f472b6', '#facc15', '#38bdf8',
    '#a3e635', '#fb7185', '#818cf8', '#34d399', '#fbbf24', '#e879f9'
  ],
  BOT_NAMES: ['Mint', 'Pixel', 'Peaches', 'Sunny', 'Sky', 'Kiwi', 'Cherry', 'Nova', 'Jelly', 'Mango', 'Noodle', 'Bubbles', 'Coco', 'Ziggy', 'Sprout'],
};

export const TREATS = [
  { kind: 'donut', size: 1, value: 2 },
  { kind: 'cake', size: 1.15, value: 3 },
  { kind: 'macaron', size: 0.95, value: 2 },
  { kind: 'popsicle', size: 1.05, value: 2 },
  { kind: 'cookie', size: 0.95, value: 1 },
  { kind: 'gummy', size: 1, value: 1 },
  { kind: 'cupcake', size: 1.1, value: 3 },
  { kind: 'candy', size: 0.95, value: 1 },
  { kind: 'icecream', size: 1.1, value: 2 },
  { kind: 'watermelon', size: 1.1, value: 2 },
  { kind: 'gingerbread', size: 1.15, value: 3 },
  { kind: 'berry', size: 0.95, value: 2 },
  { kind: 'orange', size: 1.0, value: 2 },
  { kind: 'croissant', size: 1.1, value: 3 },
] as const;

export type TreatKind = typeof TREATS[number]['kind'];
export type FlagSkin = 'flag-tr' | 'flag-az' | 'flag-de' | 'flag-fr' | 'flag-us' | 'flag-br' | 'flag-gb' | 'flag-it';
export type WormPattern = 'solid' | 'candy' | 'freckles' | 'stripes' | 'dots' | FlagSkin;
export type BonusKind = 'speed' | 'chomp' | 'x2' | 'x5' | 'x10' | 'x100' | 'coin' | 'wide';

export const BONUSES: {
  kind: BonusKind;
  label: string;
  color: string;
  ticks: number;
  weight: number;
  multiplier: number;
}[] = [
  { kind: 'speed', label: 'SPEED', color: '#38bdf8', ticks: 480, weight: 0.18, multiplier: 1 },
  { kind: 'chomp', label: 'CHOMP', color: '#fb923c', ticks: 480, weight: 0.14, multiplier: 1 },
  { kind: 'x2', label: '2x', color: '#a3e635', ticks: 720, weight: 0.24, multiplier: 2 },
  { kind: 'x5', label: '5x', color: '#facc15', ticks: 540, weight: 0.14, multiplier: 5 },
  { kind: 'x10', label: '10x', color: '#f472b6', ticks: 360, weight: 0.08, multiplier: 10 },
  { kind: 'x100', label: '100x', color: '#ffd166', ticks: 180, weight: 0.01, multiplier: 100 },
  { kind: 'coin', label: 'ALTIN', color: '#ffd700', ticks: 0, weight: 0.13, multiplier: 1 },
  { kind: 'wide', label: 'GENİŞ', color: '#8b5cf6', ticks: 480, weight: 0.08, multiplier: 1 },
];

export const BONUS_BY_KIND = Object.fromEntries(BONUSES.map(bonus => [bonus.kind, bonus])) as Record<BonusKind, typeof BONUSES[number]>;

export const WORM_PATTERNS: WormPattern[] = [
  'solid', 'candy', 'freckles', 'stripes', 'dots',
  'flag-tr', 'flag-az', 'flag-de', 'flag-fr', 'flag-us', 'flag-br', 'flag-gb', 'flag-it',
];