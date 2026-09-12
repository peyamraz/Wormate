export const VERSION = '1.5.0';

export const GAME_CONFIG = {
  CANVAS_WIDTH: 4000,
  CANVAS_HEIGHT: 4000,
  WORM_START_LENGTH: 28,
  WORM_MAX_LENGTH: 280,
  WORM_START_RADIUS: 14,
  WORM_SEGMENT_SPACING: 5,
  WORM_SPEED: 2.2,
  WORM_BOOST_SPEED: 4.1,
  WORM_TURN_SPEED: 0.18,
  FOOD_COUNT: 1500,
  MAX_FOOD_COUNT: 1900,
  FOOD_RADIUS: 10,
  BONUS_TARGET_COUNT: 18,
  BONUS_MAX_COUNT: 30,
  BONUS_RESPAWN_TICKS: 45,
  BONUS_NEAR_PLAYER_TICKS: 150,
  BONUS_LIFETIME_TICKS: 5400,
  GROWTH_PER_FOOD: 2,
  BOOST_CONSUMPTION_TICKS: 16,
  BOT_COUNT: 18,
  SPAWN_PROTECTION_TICKS: 300,
  CAMERA_START_ZOOM: 2,
  CAMERA_MIN_ZOOM: 0.82,
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
] as const;

export type TreatKind = typeof TREATS[number]['kind'];
export type FlagSkin = 'flag-tr' | 'flag-az' | 'flag-de' | 'flag-fr' | 'flag-us' | 'flag-br' | 'flag-gb' | 'flag-it';
export type WormPattern = 'solid' | 'candy' | 'freckles' | 'stripes' | 'dots' | FlagSkin;
export type BonusKind = 'speed' | 'chomp' | 'x2' | 'x5' | 'x10' | 'x100';

export const BONUSES: {
  kind: BonusKind;
  label: string;
  color: string;
  ticks: number;
  weight: number;
  multiplier: number;
}[] = [
  { kind: 'speed', label: 'SPEED', color: '#38bdf8', ticks: 480, weight: 0.34, multiplier: 1 },
  { kind: 'chomp', label: 'CHOMP', color: '#fb923c', ticks: 480, weight: 0.26, multiplier: 1 },
  { kind: 'x2', label: '2x', color: '#a3e635', ticks: 720, weight: 0.22, multiplier: 2 },
  { kind: 'x5', label: '5x', color: '#facc15', ticks: 540, weight: 0.12, multiplier: 5 },
  { kind: 'x10', label: '10x', color: '#f472b6', ticks: 360, weight: 0.05, multiplier: 10 },
  { kind: 'x100', label: '100x', color: '#ffd166', ticks: 180, weight: 0.01, multiplier: 100 },
];

export const BONUS_BY_KIND = Object.fromEntries(BONUSES.map(bonus => [bonus.kind, bonus])) as Record<BonusKind, typeof BONUSES[number]>;

export const WORM_PATTERNS: WormPattern[] = [
  'solid', 'candy', 'freckles', 'stripes', 'dots',
  'flag-tr', 'flag-az', 'flag-de', 'flag-fr', 'flag-us', 'flag-br', 'flag-gb', 'flag-it',
];