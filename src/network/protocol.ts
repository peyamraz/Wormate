import type { BonusKind } from '../constants';
import { GAME_CONFIG as CONFIG, WORM_PATTERNS } from '../constants';
import { SHOP_GLASSES, SHOP_HATS } from '../shop';
import type { BonusOrb, Food, PlayerStatus, Point, Worm } from '../gameEngine';

export const NETWORK = {
  VERSION: 1,
  PATH: '/arena',
  TICK_MS: 1000 / 60,
  SNAPSHOT_TICKS: 3,
  MAX_SNAPSHOT_FOODS: 500,
  MAX_PLAYERS: 16,
  MAX_ROOMS: 4,
  MAX_MESSAGE_BYTES: 1024,
  MAX_STATE_BYTES: 512 * 1024,
  HEARTBEAT_MS: 15000,
  JOIN_TIMEOUT_MS: 5000,
} as const;

export type ClientMessage =
  | { type: 'join'; v: 1; name: string; room: string; width: number; height: number }
  | { type: 'input'; seq: number; angle: number; boost: boolean }
  | { type: 'viewport'; width: number; height: number }
  | { type: 'style'; color: string; pattern: string; hat: string; glasses: string }
  | { type: 'restart' }
  | { type: 'leave' }
  | { type: 'ping'; at: number };

export interface WorldEvent extends Point {
  type: 'eat' | 'bonus' | 'death' | 'kill';
  playerId: string;
  color: string;
  value: number;
  bonus?: BonusKind;
  food?: Food;
}

export type WireWorm = Pick<Worm,
  'id' | 'name' | 'color' | 'pattern' | 'angle' | 'radius' | 'score' | 'isDead' |
  'isHuman' | 'spawnProtection' | 'isBoosting' | 'speedTicks' | 'chompTicks' |
  'multiplier' | 'multiplierTicks' | 'combo' | 'facePhase' | 'growthPulse' | 'appetite' | 'lookOffset' |
  'hat' | 'glasses'
> & { points: number[]; deathReason: string };

export interface ArenaSnapshot {
  type: 'state';
  v: 1;
  tick: number;
  run: number;
  you: string;
  worms: WireWorm[];
  foods: Food[];
  bonuses: BonusOrb[];
  status: PlayerStatus;
  events: WorldEvent[];
}

export type ServerMessage =
  | { type: 'welcome'; v: 1; id: string; room: string }
  | ArenaSnapshot
  | { type: 'pong'; at: number }
  | { type: 'error'; message: string };

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, keys: string[]) {
  return Object.keys(value).length === keys.length && keys.every(key => Object.prototype.hasOwnProperty.call(value, key));
}

export function validName(value: unknown): value is string {
  return typeof value === 'string' && value === value.trim() && /^[\p{L}\p{N} _-]{1,16}$/u.test(value);
}

export function validRoom(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Z0-9]{3,12}$/.test(value);
}

const finiteBetween = (value: unknown, low: number, high: number): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= low && value <= high;

export function parseClientMessage(raw: string): ClientMessage | null {
  if (raw.length > NETWORK.MAX_MESSAGE_BYTES) return null;
  let value: unknown;
  try { value = JSON.parse(raw); } catch { return null; }
  if (!isRecord(value)) return null;
  const viewport = () => finiteBetween(value.width, 320, 1920) && finiteBetween(value.height, 240, 1080);
  switch (value.type) {
    case 'join':
      if (exactKeys(value, ['type', 'v', 'name', 'room', 'width', 'height']) && value.v === 1 && validName(value.name) && validRoom(value.room) && viewport()) return value as ClientMessage;
      break;
    case 'input':
      if (exactKeys(value, ['type', 'seq', 'angle', 'boost']) && finiteBetween(value.seq, 0, Number.MAX_SAFE_INTEGER) && Number.isInteger(value.seq) && finiteBetween(value.angle, -Math.PI, Math.PI) && typeof value.boost === 'boolean') return value as ClientMessage;
      break;
    case 'viewport':
      if (exactKeys(value, ['type', 'width', 'height']) && viewport()) return value as ClientMessage;
      break;
    case 'style':
      if (exactKeys(value, ['type', 'color', 'pattern', 'hat', 'glasses'])
        && typeof value.color === 'string' && (CONFIG.COLORS as string[]).includes(value.color)
        && typeof value.pattern === 'string' && (WORM_PATTERNS as string[]).includes(value.pattern)
        && typeof value.hat === 'string' && SHOP_HATS.some(h => h.id === value.hat)
        && typeof value.glasses === 'string' && SHOP_GLASSES.some(g => g.id === value.glasses)) return value as ClientMessage;
      break;
    case 'restart':
    case 'leave':
      if (exactKeys(value, ['type'])) return value as ClientMessage;
      break;
    case 'ping':
      if (exactKeys(value, ['type', 'at']) && finiteBetween(value.at, 0, Number.MAX_SAFE_INTEGER)) return value as ClientMessage;
      break;
  }
  return null;
}