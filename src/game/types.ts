// ===== Temel Veri Yapıları =====

export interface Point {
  x: number;
  y: number;
}

export interface Segment {
  x: number;
  y: number;
}

export interface WormConfig {
  id: string;
  name: string;
  color: string;
  color2: string;
  isPlayer: boolean;
  behavior: 'passive' | 'aggressive' | 'random';
}

export interface WormState {
  config: WormConfig;
  segments: Segment[];
  angle: number;
  targetAngle: number;
  speed: number;
  baseSpeed: number;
  boosting: boolean;
  alive: boolean;
  score: number;
  boostTimer: number;
  // AI state
  aiDecisionTimer: number;
  aiTarget: Point | null;
  aiBehavior: 'food' | 'hunt' | 'flee' | 'wander';
}

export interface FoodItem {
  id: string;
  x: number;
  y: number;
  radius: number;
  color: string;
  value: number;
  type: 'normal' | 'big';
  pulsePhase: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  radius: number;
}

export interface GameState {
  worms: WormState[];
  foods: FoodItem[];
  particles: Particle[];
  tick: number;
  worldSize: number;
  worldRadius: number;
  worldCenter: Point;
  camera: {
    x: number;
    y: number;
    zoom: number;
    targetZoom: number;
  };
  player: WormState | null;
  gameOver: boolean;
  leaderboard: { name: string; score: number; isPlayer: boolean }[];
  mouseAngle: number;
  highScore: number;
}

// ===== Sabitler =====

export const WORLD_SIZE = 4000;
export const WORLD_RADIUS = 2000;
export const WORLD_CENTER: Point = { x: WORLD_SIZE / 2, y: WORLD_SIZE / 2 };

export const MAX_FOOD = 500;
export const MIN_FOOD = 400;
export const MAX_AI_WORMS = 15;
export const MAX_SEGMENTS = 500;

export const WORM_BASE_SPEED = 3;
export const WORM_BOOST_SPEED = 6;
export const TURN_RATE = 0.08;
export const SEGMENT_DISTANCE = 8;

export const INITIAL_LENGTH = 10;
export const HEAD_RADIUS_BASE = 8;
export const SEGMENT_RADIUS_BASE = 6;

export const FOOD_RADIUS = 4;
export const BIG_FOOD_RADIUS = 8;
export const FOOD_VALUE_NORMAL = 1;
export const FOOD_VALUE_BIG = 3;

export const BOOST_SEGMENT_COST = 5; // her 5 tick'te 1 segment

export const AI_VISION_RANGE = 300;
export const AI_DANGER_RANGE = 150;
export const AI_BORDER_RANGE = 300;

// Renk paletleri
export const WORM_COLORS: [string, string][] = [
  ['#ff6b6b', '#ee5a5a'],
  ['#4ecdc4', '#45b7aa'],
  ['#45b7d1', '#3da8c0'],
  ['#f7dc6f', '#f0d264'],
  ['#bb8fce', '#a87fc0'],
  ['#85c1e9', '#76b3dc'],
  ['#82e0aa', '#73d29b'],
  ['#f8c471', '#f0b663'],
  ['#f1948a', '#e3857c'],
  ['#d7bde2', '#c9aed4'],
];

export const FOOD_COLORS = [
  '#ff6b6b', '#4ecdc4', '#45b7d1', '#f7dc6f',
  '#bb8fce', '#85c1e9', '#82e0aa', '#f8c471',
];

export const AI_NAMES = [
  'Slinky', 'Wiggles', 'Noodle', 'Squiggly', 'Twisty',
  'Coily', 'Slinky', 'Ziggy', 'Loop', 'Spiral',
  'Curl', 'Wave', 'Ripple', 'Flow', 'Dash',
];
