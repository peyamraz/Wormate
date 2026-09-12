import { BONUSES, GAME_CONFIG as CONFIG, TREATS, WORM_PATTERNS } from '../constants';
import { SHOP_GLASSES, SHOP_HATS } from '../shop';
import { isRecord, NETWORK, validName, validRoom } from './protocol';
import type { ServerMessage } from './protocol';

const number = (value: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): value is number => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
const text = (value: unknown, max: number): value is string => typeof value === 'string' && value.length <= max;
const uuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value);
const identifier = (value: unknown) => uuid(value) || (typeof value === 'string' && /^bot-\d{1,10}$/.test(value));
const color = (value: unknown) => typeof value === 'string' && [...CONFIG.COLORS, ...CONFIG.FOOD_COLORS, ...BONUSES.map(bonus => bonus.color), '#f0b56f'].includes(value);
const bonusKind = (value: unknown) => BONUSES.some(bonus => bonus.kind === value);
const point = (value: Record<string, unknown>) => number(value.x, -100, CONFIG.CANVAS_WIDTH + 100) && number(value.y, -100, CONFIG.CANVAS_HEIGHT + 100);

function food(value: unknown) {
  return isRecord(value) && point(value) && number(value.id) && TREATS.some(treat => treat.kind === value.kind)
    && number(value.variant, 0, CONFIG.FOOD_COLORS.length - 1) && Number.isInteger(value.variant)
    && color(value.color) && number(value.radius, 1, 20) && number(value.value, 1, 3)
    && number(value.phase, 0, Math.PI * 2) && number(value.rotation, -1, 1)
    && typeof value.isTreasure === 'boolean' && number(value.bornAt);
}

export function parseServerMessage(raw: string): ServerMessage | null {
  if (raw.length > NETWORK.MAX_STATE_BYTES) return null;
  let message: unknown;
  try { message = JSON.parse(raw); } catch { return null; }
  if (!isRecord(message)) return null;
  if (message.type === 'error' && text(message.message, 200)) return { type: 'error', message: message.message };
  if (message.type === 'pong' && number(message.at)) return { type: 'pong', at: message.at };
  if (message.type === 'welcome' && message.v === 1 && uuid(message.id) && validRoom(message.room)) return { type: 'welcome', v: 1, id: message.id, room: message.room };
  if (message.type !== 'state' || message.v !== 1 || !uuid(message.you) || !number(message.tick) || !number(message.run, 1)) return null;
  if (!Array.isArray(message.worms) || message.worms.length > 32 || message.worms.length < 1) return null;
  const wormIds = new Set<string>();
  for (const worm of message.worms) {
    if (!isRecord(worm) || !identifier(worm.id) || typeof worm.id !== 'string' || wormIds.has(worm.id) || !validName(worm.name) || !color(worm.color)) return null;
    wormIds.add(worm.id);
    if (typeof worm.pattern !== 'string' || !(WORM_PATTERNS as string[]).includes(worm.pattern) || !text(worm.deathReason, 160)) return null;
    if (!['isDead', 'isHuman', 'isBoosting'].every(key => typeof worm[key] === 'boolean')) return null;
    if (!['score', 'spawnProtection', 'speedTicks', 'chompTicks', 'multiplierTicks', 'combo', 'facePhase'].every(key => number(worm[key], 0, 999999999))) return null;
    if (!number(worm.radius, 1, 40) || !number(worm.angle, -1e8, 1e8) || typeof worm.multiplier !== 'number' || ![1, 2, 5, 10, 100].includes(worm.multiplier)) return null;
    if (!number(worm.growthPulse, 0, 1) || !number(worm.appetite, 0, 1) || !number(worm.lookOffset, -1, 1)) return null;
    if (typeof worm.hat !== 'string' || !SHOP_HATS.some(h => h.id === worm.hat)) return null;
    if (typeof worm.glasses !== 'string' || !SHOP_GLASSES.some(g => g.id === worm.glasses)) return null;
    if (!Array.isArray(worm.points) || worm.points.length < 2 || worm.points.length > CONFIG.WORM_MAX_LENGTH * 2 || worm.points.length % 2 || !worm.points.every(p => number(p, -500, 3700))) return null;
  }
  if (!wormIds.has(message.you)) return null;
  if (!Array.isArray(message.foods) || message.foods.length > CONFIG.MAX_FOOD_COUNT || !message.foods.every(food)) return null;
  if (!Array.isArray(message.bonuses) || message.bonuses.length > CONFIG.BONUS_MAX_COUNT || !message.bonuses.every(b => isRecord(b) && point(b) && number(b.id) && bonusKind(b.kind) && number(b.phase, 0, Math.PI * 2) && number(b.bornAt))) return null;
  const status = message.status;
  if (!isRecord(status) || !['score', 'size', 'multiplier', 'multiplierSeconds', 'speedSeconds', 'chompSeconds', 'combo'].every(key => number(status[key], 0, 999999999))) return null;
  if (!['activeCount', 'humanCount', 'botCount', 'connectedCount', 'sizeRank'].every(key => number(status[key], 0, 32))) return null;
  if (!Array.isArray(status.leaderboard) || status.leaderboard.length > 6 || !status.leaderboard.every(row => isRecord(row) && identifier(row.id) && validName(row.name) && color(row.color) && number(row.rank, 1, 32) && number(row.score, 0, 999999999) && number(row.size, 1, 400) && typeof row.isBot === 'boolean' && typeof row.isPlayer === 'boolean')) return null;
  if (!Array.isArray(message.events) || message.events.length > 32 || !message.events.every(event => isRecord(event) && ['eat', 'bonus', 'death'].includes(String(event.type)) && identifier(event.playerId) && point(event) && color(event.color) && number(event.value, 0, 999999999) && (event.bonus === undefined || bonusKind(event.bonus)) && (event.food === undefined || food(event.food)))) return null;
  return message as unknown as ServerMessage;
}