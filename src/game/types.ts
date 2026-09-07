export interface Point {
  x: number;
  y: number;
}

export interface Worm {
  id: string;
  name: string;
  segments: Point[];
  angle: number;
  targetAngle: number;
  speed: number;
  baseSpeed: number;
  boosting: boolean;
  color: string;
  secondaryColor: string;
  score: number;
  alive: boolean;
  isPlayer: boolean;
  eyeDirection: number;
  // AI fields
  aiTarget?: Point;
  aiTimer?: number;
  aiBehavior?: 'food' | 'hunt' | 'flee';
}

export interface Food {
  id: string;
  x: number;
  y: number;
  radius: number;
  color: string;
  value: number;
  type: 'normal' | 'super' | 'powerup_speed' | 'powerup_magnet' | 'powerup_growth';
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
  worms: Worm[];
  foods: Food[];
  particles: Particle[];
  worldWidth: number;
  worldHeight: number;
  camera: { x: number; y: number; zoom: number; targetZoom: number };
  player: Worm | null;
  gameOver: boolean;
  leaderboard: { name: string; score: number }[];
  mouseAngle: number;
  mouseWorld: Point;
}

export const WORLD_WIDTH = 6000;
export const WORLD_HEIGHT = 6000;
export const MAX_FOOD = 800;
export const MAX_WORMS = 15;
export const SEGMENT_DISTANCE = 8;
export const WORM_BASE_SPEED = 3;
export const WORM_BOOST_SPEED = 6;
export const TURN_SPEED = 0.08;
export const MIN_LENGTH = 10;
export const FOOD_RADIUS = 5;
export const SUPER_FOOD_RADIUS = 8;

export const WORM_COLORS = [
  { primary: '#ff6b6b', secondary: '#ee5a24' },
  { primary: '#4ecdc4', secondary: '#2d98da' },
  { primary: '#f9ca24', secondary: '#f0932b' },
  { primary: '#a29bfe', secondary: '#6c5ce7' },
  { primary: '#fd79a8', secondary: '#e84393' },
  { primary: '#00b894', secondary: '#00cec9' },
  { primary: '#fdcb6e', secondary: '#e17055' },
  { primary: '#74b9ff', secondary: '#0984e3' },
  { primary: '#55efc4', secondary: '#00b894' },
  { primary: '#fab1a0', secondary: '#e17055' },
];

export const AI_NAMES = [
  'Slither', 'Wiggly', 'Noodle', 'Slinky', 'Coil',
  'Viper', 'Python', 'Anaconda', 'Cobra', 'Mamba',
  'Wormy', 'Squiggles', 'Twisty', 'Slinky', 'Zigzag',
  'Turbo', 'Flash', 'Blaze', 'Shadow', 'Storm',
];
