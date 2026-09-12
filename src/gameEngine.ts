import { BONUSES, BONUS_BY_KIND, GAME_CONFIG as CONFIG, TREATS } from './constants';
import { bonusLabel } from './i18n';
import type { BonusKind, TreatKind, WormPattern } from './constants';
import type { WorldEvent } from './network/protocol';

export interface Point {
  x: number;
  y: number;
}

export interface Viewport {
  width: number;
  height: number;
}

export interface Food extends Point {
  id: number;
  kind: TreatKind;
  variant: number;
  color: string;
  radius: number;
  value: number;
  phase: number;
  rotation: number;
  isTreasure: boolean;
  bornAt: number;
}

export interface SnackBite extends Food {
  life: number;
  target: Worm;
}

export interface SnackRing extends Point {
  color: string;
  life: number;
  radius: number;
}

export interface LootTrail {
  points: Point[];
  life: number;
  width: number;
}

export interface FloatingScore extends Point {
  value: number;
  life: number;
  color: string;
  label?: string;
}

export interface BonusOrb extends Point {
  id: number;
  kind: BonusKind;
  phase: number;
  bornAt: number;
}

export interface PlayerStatus {
  score: number;
  size: number;
  sizeRank: number;
  multiplier: number;
  multiplierSeconds: number;
  speedSeconds: number;
  chompSeconds: number;
  combo: number;
  activeCount: number;
  humanCount: number;
  botCount: number;
  connectedCount: number;
  leaderboard: LeaderboardEntry[];
}

export interface LeaderboardEntry {
  id: string;
  name: string;
  score: number;
  size: number;
  color: string;
  rank: number;
  isPlayer: boolean;
  isBot: boolean;
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const distanceSquared = (a: Point, b: Point) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;

// Daire içine kelepçele: arena dışı ölümcül olduğu için spawn'lar ve yemler hep içeride tutulur.
export function clampToArena(x: number, y: number, pad: number): Point {
  const dx = x - CONFIG.ARENA_CENTER;
  const dy = y - CONFIG.ARENA_CENTER;
  const d = Math.hypot(dx, dy);
  const max = CONFIG.ARENA_RADIUS - pad;
  if (d <= max) return { x, y };
  const k = max / Math.max(1, d);
  return { x: CONFIG.ARENA_CENTER + dx * k, y: CONFIG.ARENA_CENTER + dy * k };
}

export function distToEdge(x: number, y: number): number {
  return CONFIG.ARENA_RADIUS - Math.hypot(x - CONFIG.ARENA_CENTER, y - CONFIG.ARENA_CENTER);
}

export const GRID_CELL_SIZE = 160;
export const GRID_COLS = 33;
export const GRID_ROWS = 33;
export const TOTAL_GRID_CELLS = GRID_COLS * GRID_ROWS;

export function getCameraZoom(length: number, viewport: Viewport) {
  const screenScale = clamp(Math.min(viewport.width, viewport.height) / 650, 0.72, 1);
  const growth = Math.max(1, length / CONFIG.WORM_START_LENGTH);
  // Üstel bilinçli küçük tutuldu: dev solucan ekranda dev görünsün, kamera boyu maskelemesin.
  return Math.max(CONFIG.CAMERA_MIN_ZOOM, CONFIG.CAMERA_START_ZOOM * screenScale / growth ** 0.26);
}

export class Worm {
  id: string;
  name: string;
  segments: Point[];
  angle: number;
  radius = CONFIG.WORM_START_RADIUS;
  color: string;
  pattern: WormPattern;
  hat = 'none';
  glasses = 'none';
  facePhase: number;
  isBoosting = false;
  score = 0;
  isDead = false;
  isHuman = false;
  deathReason = 'You bumped into another worm.';
  spawnProtection: number;
  growthPulse = 0;
  swallowWaves: number[] = [];
  appetite = 0;
  lookOffset = 0;
  targetAngle: number;
  decisionTicks = 0;
  boostTicks = 0;
  speedTicks = 0;
  chompTicks = 0;
  multiplier = 1;
  multiplierTicks = 0;
  combo = 0;
  comboTicks = 0;

  constructor(id: string, x: number, y: number, color: string, angle = 0, length = CONFIG.WORM_START_LENGTH, name = 'YOU', pattern: WormPattern = 'solid') {
    this.id = id;
    this.name = name;
    this.angle = angle;
    this.targetAngle = angle;
    this.color = color;
    this.pattern = pattern;
    this.facePhase = Math.floor(Math.random() * 280);
    this.radius = CONFIG.WORM_START_RADIUS * Math.min(2.1, Math.max(1, length / CONFIG.WORM_START_LENGTH) ** 0.34);
    this.spawnProtection = id === 'player' ? CONFIG.SPAWN_PROTECTION_TICKS : 90;
    this.decisionTicks = Math.floor(Math.random() * 10);
    this.segments = Array.from({ length }, (_, i) => ({
      x: x - Math.cos(angle) * i * CONFIG.WORM_SEGMENT_SPACING,
      y: y - Math.sin(angle) * i * CONFIG.WORM_SEGMENT_SPACING,
    }));
  }

  update(targetAngle: number, boosting: boolean) {
    if (this.isDead) return;
    const difference = Math.atan2(Math.sin(targetAngle - this.angle), Math.cos(targetAngle - this.angle));
    this.angle += clamp(difference * 0.3, -CONFIG.WORM_TURN_SPEED, CONFIG.WORM_TURN_SPEED);
    this.angle = Math.atan2(Math.sin(this.angle), Math.cos(this.angle));
    this.lookOffset += (clamp(difference, -0.8, 0.8) - this.lookOffset) * 0.15;
    this.isBoosting = boosting;
    const rush = this.speedTicks > 0 ? 1.55 : 1;
    const speed = (boosting ? CONFIG.WORM_BOOST_SPEED : CONFIG.WORM_SPEED) * rush;
    const head = this.segments[0];
    head.x += Math.cos(this.angle) * speed;
    head.y += Math.sin(this.angle) * speed;

    if (distToEdge(head.x, head.y) < this.radius) {
      this.isDead = true;
      return;
    }

    // Fixed segment spacing keeps the body length stable when boosting.
    for (let i = 1; i < this.segments.length; i++) {
      const previous = this.segments[i - 1];
      const segment = this.segments[i];
      const dx = previous.x - segment.x;
      const dy = previous.y - segment.y;
      const distance = Math.hypot(dx, dy);
      if (distance > CONFIG.WORM_SEGMENT_SPACING) {
        const follow = (distance - CONFIG.WORM_SEGMENT_SPACING) / distance;
        segment.x += dx * follow;
        segment.y += dy * follow;
      }
    }

    this.spawnProtection = Math.max(0, this.spawnProtection - 1);
    this.speedTicks = Math.max(0, this.speedTicks - 1);
    this.chompTicks = Math.max(0, this.chompTicks - 1);
    this.multiplierTicks = Math.max(0, this.multiplierTicks - 1);
    if (this.multiplierTicks === 0) this.multiplier = 1;
    this.comboTicks = Math.max(0, this.comboTicks - 1);
    if (this.comboTicks === 0) this.combo = 0;
    this.growthPulse *= 0.88;
    this.appetite *= 0.85;
    for (let i = this.swallowWaves.length - 1; i >= 0; i--) {
      this.swallowWaves[i] += 1.5;
      if (this.swallowWaves[i] > this.segments.length + 8) this.swallowWaves.splice(i, 1);
    }
    const growth = Math.max(1, this.segments.length / CONFIG.WORM_START_LENGTH);
    const targetRadius = CONFIG.WORM_START_RADIUS * Math.min(2.1, growth ** 0.34);
    this.radius += (targetRadius - this.radius) * 0.06;
    if (boosting && this.segments.length > CONFIG.WORM_START_LENGTH) {
      this.boostTicks++;
      if (this.boostTicks >= CONFIG.BOOST_CONSUMPTION_TICKS) {
        this.segments.pop();
        this.boostTicks = 0;
      }
    } else {
      this.boostTicks = 0;
    }
  }

  grow(amount: number, awarded = amount * 10) {
    const tail = this.segments[this.segments.length - 1];
    const count = Math.min(amount * CONFIG.GROWTH_PER_FOOD, CONFIG.WORM_MAX_LENGTH - this.segments.length);
    for (let i = 0; i < count; i++) this.segments.push({ ...tail });
    this.score = Math.min(999999999, this.score + Math.max(0, awarded));
    this.growthPulse = 1;
    this.appetite = 1;
    this.swallowWaves.push(0);
    if (this.swallowWaves.length > 4) this.swallowWaves.shift();
  }

  applyBonus(kind: BonusKind) {
    const bonus = BONUS_BY_KIND[kind];
    if (kind === 'speed') this.speedTicks = Math.max(this.speedTicks, bonus.ticks);
    if (kind === 'chomp') this.chompTicks = Math.max(this.chompTicks, bonus.ticks);
    if (bonus.multiplier > 1) {
      if (bonus.multiplier > this.multiplier || this.multiplierTicks <= 0) {
        this.multiplier = bonus.multiplier;
        this.multiplierTicks = bonus.ticks;
      } else if (bonus.multiplier === this.multiplier) {
        this.multiplierTicks = Math.max(this.multiplierTicks, bonus.ticks);
      }
    }
  }
}

export class Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life = 1;
  color: string;
  size: number;
  shape: 'crumb' | 'sprinkle' | 'sparkle';
  rotation: number;
  spin: number;

  constructor(x: number, y: number, color: string, force = 1) {
    this.x = x;
    this.y = y;
    const angle = Math.random() * Math.PI * 2;
    const speed = (1 + Math.random() * 2.5) * force;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.color = color;
    this.size = 1.5 + Math.random() * 2.5;
    this.shape = Math.random() < 0.2 ? 'sparkle' : Math.random() < 0.6 ? 'sprinkle' : 'crumb';
    this.rotation = Math.random() * Math.PI * 2;
    this.spin = (Math.random() - 0.5) * 0.25;
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.vx *= 0.94;
    this.vy = this.vy * 0.94 + 0.025;
    this.rotation += this.spin;
    this.life -= 0.035;
  }
}

export class GameEngine {
  player: Worm;
  humans = new Map<string, Worm>();
  onlineArena: boolean;
  worldEvents: WorldEvent[] = [];
  bots: Worm[] = [];
  foods: Food[] = [];
  foodGrid: Food[][] = Array.from({ length: TOTAL_GRID_CELLS }, () => []);
  particles: Particle[] = [];
  floatingScores: FloatingScore[] = [];
  snackBites: SnackBite[] = [];
  snackRings: SnackRing[] = [];
  lootTrails: LootTrail[] = [];
  bonuses: BonusOrb[] = [];
  pickupEvent: BonusKind | null = null;
  camera: Point & { zoom: number };
  viewport: Viewport;
  isDemo: boolean;
  ticks = 0;
  shake = 0;
  deathReason = 'You bumped into another worm.';
  private nextBotId = 0;
  private nextFoodId = 0;
  private nextBonusId = 0;

  constructor(viewport: Viewport = { width: 1280, height: 800 }, isDemo = false, mode: 'local' | 'online' | 'view' = 'local') {
    this.viewport = viewport;
    this.isDemo = isDemo;
    this.onlineArena = mode === 'online';
    const x = CONFIG.CANVAS_WIDTH / 2;
    const y = CONFIG.CANVAS_HEIGHT / 2;
    this.player = new Worm('player', x, y, CONFIG.COLORS[0]);
    this.player.isHuman = true;
    if (this.onlineArena) this.player.isDead = true;
    this.camera = { x, y, zoom: getCameraZoom(this.player.segments.length, viewport) };
    if (mode === 'view') return;
    for (let i = 0; i < (this.onlineArena ? 10 : CONFIG.BOT_COUNT); i++) this.spawnBot(i < 4 || isDemo);

    // A visible snack trail guarantees that the first few seconds are rewarding.
    for (let i = 1; i <= 20; i++) this.addFood(x + i * 28, y + Math.sin(i * 0.45) * 12);
    for (let group = 0; group < 7; group++) {
      const direction = group * Math.PI * 2 / 7;
      const cx = x + Math.cos(direction) * (230 + Math.random() * 180);
      const cy = y + Math.sin(direction) * (230 + Math.random() * 180);
      for (let i = 0; i < 9; i++) {
        this.addFood(cx + (i - 4) * 23, cy + Math.sin(i * 0.65) * 36);
      }
    }
    for (let i = 0; i < 85; i++) {
      this.addFood(x + (Math.random() - 0.5) * 850, y + (Math.random() - 0.5) * 850);
    }
    if (isDemo) {
      const rx = viewport.width / (this.camera.zoom * 2) * 0.87;
      const ry = viewport.height / (this.camera.zoom * 2) * 0.78;
      for (let i = 0; i < 55; i++) {
        const angle = i / 55 * Math.PI * 2;
        this.addFood(x + Math.cos(angle) * rx, y + Math.sin(angle) * ry, 3, true);
      }
    }
    while (this.foods.length < CONFIG.FOOD_COUNT) this.spawnFood(false);
    this.addBonus(x + 210, y - 40, 'speed');
    this.addBonus(x + 250, y + 70, 'chomp');
    this.addBonus(x + 160, y + 110, 'x2');
    this.addBonus(x - 240, y - 80, 'x5');
    while (this.bonuses.length < CONFIG.BONUS_TARGET_COUNT) this.spawnBonus();
    this.rebuildFoodGrid();
  }

  rebuildFoodGrid() {
    for (let i = 0; i < TOTAL_GRID_CELLS; i++) this.foodGrid[i].length = 0;
    for (let i = 0; i < this.foods.length; i++) {
      const food = this.foods[i];
      const cx = clamp(Math.floor(food.x / GRID_CELL_SIZE), 0, GRID_COLS - 1);
      const cy = clamp(Math.floor(food.y / GRID_CELL_SIZE), 0, GRID_ROWS - 1);
      this.foodGrid[cy * GRID_COLS + cx].push(food);
    }
  }

  allWorms() { return [...(this.onlineArena ? this.humans.values() : [this.player]), ...this.bots]; }

  addHuman(id: string, name: string, style?: { color: string; pattern: WormPattern; hat: string; glasses: string }): Worm {
    if (this.humans.has(id)) throw new Error('Duplicate session');
    const living = this.allWorms().filter(worm => !worm.isDead);
    let point = { x: CONFIG.ARENA_CENTER, y: CONFIG.ARENA_CENTER };
    let clearance = -1;
    for (let attempt = 0; attempt < 100; attempt++) {
      const candidate = attempt < 60
        ? { x: 1900 + Math.random() * 1400, y: 1900 + Math.random() * 1400 }
        : { x: 220 + Math.random() * 4760, y: 220 + Math.random() * 4760 };
      const inside = clampToArena(candidate.x, candidate.y, 140);
      let nearest = Infinity;
      for (const worm of living) {
        for (let i = 0; i < worm.segments.length; i += 3) nearest = Math.min(nearest, distanceSquared(inside, worm.segments[i]));
      }
      if (nearest > clearance) { clearance = nearest; point = inside; }
      if (clearance > 220 ** 2) break;
    }
    if (clearance < 90 ** 2) throw new Error('Arena is crowded. Try again.');
    const worm = new Worm(id, point.x, point.y, style?.color ?? CONFIG.COLORS[this.humans.size % CONFIG.COLORS.length], 0, CONFIG.WORM_START_LENGTH, name, style?.pattern ?? 'solid');
    worm.isHuman = true;
    worm.hat = style?.hat ?? 'none';
    worm.glasses = style?.glasses ?? 'none';
    worm.spawnProtection = CONFIG.SPAWN_PROTECTION_TICKS;
    this.humans.set(id, worm);
    for (let i = 1; i <= 12; i++) this.addFood(point.x + i * 25, point.y + Math.sin(i * 0.5) * 10);
    this.rebuildFoodGrid();
    return worm;
  }

  removeHuman(id: string) {
    this.humans.delete(id);
    this.worldEvents = this.worldEvents.filter(event => event.playerId !== id);
  }

  restartHuman(id: string) {
    const previous = this.humans.get(id);
    if (!previous?.isDead) return false;
    this.humans.delete(id);
    try {
      const fresh = this.addHuman(id, previous.name, { color: previous.color, pattern: previous.pattern, hat: previous.hat, glasses: previous.glasses });
      fresh.color = previous.color;
      fresh.pattern = previous.pattern;
      this.worldEvents = this.worldEvents.filter(event => event.playerId !== id);
      return true;
    }
    catch { this.humans.set(id, previous); return false; }
  }

  spawnBot(nearby = false) {
    const id = this.nextBotId++;
    const head = this.player.segments[0];
    let x = 0;
    let y = 0;
    let angle = 0;

    if (nearby) {
      const halfWidth = this.viewport.width / (this.camera.zoom * 2);
      const halfHeight = this.viewport.height / (this.camera.zoom * 2);
      const phase = this.viewport.height > this.viewport.width ? Math.PI / 2 : 0;
      const positionAngle = phase + (this.isDemo ? id / CONFIG.BOT_COUNT * Math.PI * 2 : id * Math.PI / 2) + 0.25;
      let dx = Math.cos(positionAngle) * Math.min(halfWidth * 0.8, 470);
      let dy = Math.sin(positionAngle) * Math.min(halfHeight * 0.8, 330);
      const safeScale = Math.max(1, 180 / Math.max(1, Math.hypot(dx, dy)));
      dx *= safeScale;
      dy *= safeScale;
      x = head.x + dx;
      y = head.y + dy;
      angle = Math.atan2(dy, dx) + Math.PI / 2;
    } else {
      let foundSafePosition = false;
      for (let attempt = 0; attempt < 40; attempt++) {
        if (attempt < 28) {
          const direction = Math.random() * Math.PI * 2;
          const distance = 440 + Math.random() * 500;
          x = head.x + Math.cos(direction) * distance;
          y = head.y + Math.sin(direction) * distance;
        } else {
          x = 300 + Math.random() * (CONFIG.CANVAS_WIDTH - 600);
          y = 300 + Math.random() * (CONFIG.CANVAS_HEIGHT - 600);
        }
        if (x < 300 || y < 300 || x > CONFIG.CANVAS_WIDTH - 300 || y > CONFIG.CANVAS_HEIGHT - 300) continue;
        const offscreen = Math.abs(x - this.camera.x) > this.viewport.width / (2 * this.camera.zoom) + 140
          || Math.abs(y - this.camera.y) > this.viewport.height / (2 * this.camera.zoom) + 140;
        const clearOfBody = this.player.segments.every(segment => distanceSquared({ x, y }, segment) > 150 ** 2);
        if (distanceSquared({ x, y }, head) > 400 ** 2 && offscreen && clearOfBody) {
          foundSafePosition = true;
          break;
        }
      }
      if (!foundSafePosition) {
        x = head.x < CONFIG.CANVAS_WIDTH / 2 ? CONFIG.CANVAS_WIDTH - 300 : 300;
        y = head.y < CONFIG.CANVAS_HEIGHT / 2 ? CONFIG.CANVAS_HEIGHT - 300 : 300;
      }
      angle = Math.atan2(CONFIG.CANVAS_HEIGHT / 2 - y, CONFIG.CANVAS_WIDTH / 2 - x);
    }

    const at = clampToArena(x, y, 170);
    this.bots.push(new Worm(
      `bot-${id}`, at.x, at.y, CONFIG.COLORS[1 + id % (CONFIG.COLORS.length - 1)], angle,
      26 + id % 5 * 7, CONFIG.BOT_NAMES[id % CONFIG.BOT_NAMES.length],
      id % 5 === 2 ? 'candy' : id % 5 === 4 ? 'freckles' : 'solid',
    ));
  }

  private addFood(x: number, y: number, value?: number, isTreasure = false) {
    if (this.foods.length >= CONFIG.MAX_FOOD_COUNT) return;
    const treat = TREATS[Math.floor(Math.random() * TREATS.length)];
    const variant = Math.floor(Math.random() * CONFIG.FOOD_COLORS.length);
    const { x: fx, y: fy } = clampToArena(x, y, 40);
    const food: Food = {
      id: this.nextFoodId++,
      x: fx,
      y: fy,
      kind: treat.kind,
      variant,
      color: treat.kind === 'cookie' ? '#f0b56f' : CONFIG.FOOD_COLORS[variant],
      radius: CONFIG.FOOD_RADIUS * treat.size * (isTreasure ? 1.1 : 1),
      value: value ?? treat.value,
      phase: Math.random() * Math.PI * 2,
      rotation: (Math.random() - 0.5) * 0.6,
      isTreasure,
      bornAt: this.ticks,
    };
    this.foods.push(food);
    const cx = clamp(Math.floor(fx / GRID_CELL_SIZE), 0, GRID_COLS - 1);
    const cy = clamp(Math.floor(fy / GRID_CELL_SIZE), 0, GRID_ROWS - 1);
    this.foodGrid[cy * GRID_COLS + cx].push(food);
  }

  spawnFood(nearPlayer = true) {
    const players = this.onlineArena ? [...this.humans.values()].filter(worm => !worm.isDead) : [this.player];
    const head = (players[Math.floor(Math.random() * players.length)] ?? this.player).segments[0];
    if (nearPlayer && Math.random() < 0.55) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 130 + Math.random() * 650;
      this.addFood(head.x + Math.cos(angle) * radius, head.y + Math.sin(angle) * radius);
    } else {
      this.addFood(Math.random() * CONFIG.CANVAS_WIDTH, Math.random() * CONFIG.CANVAS_HEIGHT);
    }
  }

  private rollBonusKind(): BonusKind {
    let roll = Math.random();
    for (const bonus of BONUSES) {
      roll -= bonus.weight;
      if (roll <= 0) return bonus.kind;
    }
    return 'speed';
  }

  private addBonus(x: number, y: number, kind = this.rollBonusKind()) {
    if (this.bonuses.length >= CONFIG.BONUS_MAX_COUNT) return;
    const at = clampToArena(x, y, 90);
    this.bonuses.push({
      id: this.nextBonusId++,
      x: at.x,
      y: at.y,
      kind,
      phase: Math.random() * Math.PI * 2,
      bornAt: this.ticks,
    });
  }

  spawnBonus(nearPlayer = true) {
    const players = this.onlineArena ? [...this.humans.values()].filter(worm => !worm.isDead) : [this.player];
    const head = (players[Math.floor(Math.random() * players.length)] ?? this.player).segments[0];
    const angle = Math.random() * Math.PI * 2;
    const radius = nearPlayer ? 180 + Math.random() * 420 : 400 + Math.random() * 900;
    this.addBonus(head.x + Math.cos(angle) * radius, head.y + Math.sin(angle) * radius);
  }

  /** Keeps the map lively by dropping a fresh orb in a human's play space. */
  private spawnBonusNearPlayer() {
    const players = this.onlineArena ? [...this.humans.values()].filter(worm => !worm.isDead) : [this.player];
    if (!players.length) return;
    const head = (players[Math.floor(Math.random() * players.length)] ?? this.player).segments[0];
    const angle = Math.random() * Math.PI * 2;
    const radius = 240 + Math.random() * 280;
    this.addBonus(head.x + Math.cos(angle) * radius, head.y + Math.sin(angle) * radius);
  }

  getStatus(viewer = this.player): PlayerStatus {
    const ranked = this.allWorms()
      .filter(worm => !worm.isDead)
      .sort((a, b) => b.score - a.score || b.segments.length - a.segments.length || a.id.localeCompare(b.id))
      .map((worm, index): LeaderboardEntry => ({
        id: worm.id,
        name: worm === viewer ? 'YOU' : worm.name,
        score: worm.score,
        size: worm.segments.length,
        color: worm.color,
        rank: index + 1,
        isPlayer: worm === viewer,
        isBot: !worm.isHuman,
      }));
    const leaders = ranked.slice(0, 5);
    const playerEntry = ranked.find(entry => entry.isPlayer);
    if (playerEntry && !leaders.some(entry => entry.isPlayer)) leaders.push(playerEntry);
    const bySize = [...ranked].sort((a, b) => b.size - a.size || b.score - a.score);
    const sizeRank = Math.max(1, bySize.findIndex(entry => entry.isPlayer) + 1);

    return {
      score: viewer.score,
      size: viewer.segments.length,
      sizeRank,
      multiplier: viewer.multiplier,
      multiplierSeconds: Math.ceil(viewer.multiplierTicks / 60),
      speedSeconds: Math.ceil(viewer.speedTicks / 60),
      chompSeconds: Math.ceil(viewer.chompTicks / 60),
      combo: viewer.combo,
      activeCount: ranked.length,
      humanCount: ranked.filter(entry => !entry.isBot).length,
      botCount: ranked.filter(entry => entry.isBot).length,
      connectedCount: this.onlineArena ? this.humans.size : 1,
      leaderboard: leaders,
    };
  }

  private pullSnacks(worm = this.player) {
    // Every human worm has a gentle magnetic field so treats drift toward the
    // mouth as the snake closes in; CHOMP widens and strengthens the field.
    const chomping = worm.chompTicks > 0;
    const head = worm.segments[0];
    const range = chomping ? 170 : 120;
    const rangeSq = range * range;
    const minCx = clamp(Math.floor((head.x - range) / GRID_CELL_SIZE), 0, GRID_COLS - 1);
    const maxCx = clamp(Math.floor((head.x + range) / GRID_CELL_SIZE), 0, GRID_COLS - 1);
    const minCy = clamp(Math.floor((head.y - range) / GRID_CELL_SIZE), 0, GRID_ROWS - 1);
    const maxCy = clamp(Math.floor((head.y + range) / GRID_CELL_SIZE), 0, GRID_ROWS - 1);

    for (let cy = minCy; cy <= maxCy; cy++) {
      for (let cx = minCx; cx <= maxCx; cx++) {
        const cell = this.foodGrid[cy * GRID_COLS + cx];
        for (let i = 0; i < cell.length; i++) {
          const food = cell[i];
          const dx = head.x - food.x;
          const dy = head.y - food.y;
          const distSq = dx * dx + dy * dy;
          if (distSq < 16 || distSq > rangeSq) continue;
          const distance = Math.sqrt(distSq);
          const pull = (chomping ? 6.2 : 2.4) * (1 - distance / range);
          food.x += (dx / distance) * pull;
          food.y += (dy / distance) * pull;
        }
      }
    }

    if (!chomping) return;
    for (const bonus of this.bonuses) {
      const dx = head.x - bonus.x;
      const dy = head.y - bonus.y;
      const distSq = dx * dx + dy * dy;
      if (distSq < 16 || distSq > (range * 0.8) ** 2) continue;
      const distance = Math.sqrt(distSq);
      const pull = 3.4 * (1 - distance / (range * 0.8));
      bonus.x += (dx / distance) * pull;
      bonus.y += (dy / distance) * pull;
    }
  }

  private collectBonuses(worm = this.player) {
    const head = worm.segments[0];
    const reach = worm.radius + 18 + (worm.chompTicks > 0 ? 10 : 0);
    for (let i = this.bonuses.length - 1; i >= 0; i--) {
      const bonus = this.bonuses[i];
      if (distanceSquared(head, bonus) > reach ** 2) continue;
      const info = BONUS_BY_KIND[bonus.kind];
      worm.applyBonus(bonus.kind);
      worm.score = Math.min(999999999, worm.score + 50);
      if (worm === this.player) this.pickupEvent = bonus.kind;
      this.recordEvent({ type: 'bonus', playerId: worm.id, x: bonus.x, y: bonus.y, color: info.color, value: 50, bonus: bonus.kind });
      this.bonuses.splice(i, 1);
      this.createExplosion(bonus.x, bonus.y, info.color, info.multiplier >= 10 ? 22 : 12, 1.6, true);
      this.floatingScores.push({
        x: bonus.x,
        y: bonus.y - 28,
        value: 50,
        color: info.color,
        life: 1,
        label: bonusLabel(bonus.kind),
      });
      if (this.floatingScores.length > 16) this.floatingScores.shift();
      this.shake = Math.max(this.shake, info.multiplier >= 10 ? 8 : 3.2);
    }
  }

  private steerBot(bot: Worm) {
    if (--bot.decisionTicks > 0) return;
    bot.decisionTicks = 12 + Math.floor(Math.random() * 8);
    const head = bot.segments[0];
    const margin = 160;

    if (distToEdge(head.x, head.y) < margin) {
      bot.targetAngle = Math.atan2(CONFIG.ARENA_CENTER - head.y, CONFIG.ARENA_CENTER - head.x);
      return;
    }
    const protectedPlayer = this.allWorms().find(worm => worm.isHuman && !worm.isDead && worm.spawnProtection > 0 && distanceSquared(head, worm.segments[0]) < 235 ** 2);
    if (protectedPlayer) {
      bot.targetAngle = Math.atan2(head.y - protectedPlayer.segments[0].y, head.x - protectedPlayer.segments[0].x);
      return;
    }

    const lookAhead = { x: head.x + Math.cos(bot.angle) * 48, y: head.y + Math.sin(bot.angle) * 48 };
    const worms = this.allWorms();
    for (const other of worms) {
      if (other === bot || other.isDead) continue;
      const clearance = (bot.radius + other.radius + 26) ** 2;
      const otherHead = other.segments[0];
      const maxReach = other.segments.length * CONFIG.WORM_SEGMENT_SPACING + 70;
      if (distanceSquared(lookAhead, otherHead) > maxReach * maxReach) continue;

      for (let i = 0; i < other.segments.length; i += 4) {
        const segment = other.segments[i];
        if (distanceSquared(lookAhead, segment) < clearance) {
          bot.targetAngle = Math.atan2(head.y - segment.y, head.x - segment.x);
          return;
        }
      }
    }

    const botCx = clamp(Math.floor(head.x / GRID_CELL_SIZE), 0, GRID_COLS - 1);
    const botCy = clamp(Math.floor(head.y / GRID_CELL_SIZE), 0, GRID_ROWS - 1);
    let nearest: Food | undefined;
    let best = 340 ** 2;

    for (let ring = 0; ring <= 2; ring++) {
      const minCx = Math.max(0, botCx - ring);
      const maxCx = Math.min(GRID_COLS - 1, botCx + ring);
      const minCy = Math.max(0, botCy - ring);
      const maxCy = Math.min(GRID_ROWS - 1, botCy + ring);
      for (let cy = minCy; cy <= maxCy; cy++) {
        for (let cx = minCx; cx <= maxCx; cx++) {
          if (ring > 0 && cx > minCx && cx < maxCx && cy > minCy && cy < maxCy) continue;
          const cell = this.foodGrid[cy * GRID_COLS + cx];
          for (let i = 0; i < cell.length; i++) {
            const food = cell[i];
            const dist = distanceSquared(head, food);
            if (dist < best) {
              best = dist;
              nearest = food;
            }
          }
        }
      }
      if (nearest) break;
    }

    bot.targetAngle = nearest
      ? Math.atan2(nearest.y - head.y, nearest.x - head.x)
      : bot.targetAngle + (Math.random() - 0.5) * 0.8;
  }

  private updateDemo() {
    const center = { x: CONFIG.CANVAS_WIDTH / 2, y: CONFIG.CANVAS_HEIGHT / 2 };
    const rx = Math.min(580, this.viewport.width / (this.camera.zoom * 2) * 0.85);
    const ry = Math.min(420, this.viewport.height / (this.camera.zoom * 2) * 0.9);
    [this.player, ...this.bots].forEach((worm, i) => {
      const phase = this.ticks * 0.003 + i * 2.4;
      const x = center.x + Math.cos(phase) * rx;
      const y = center.y + Math.sin(phase * 1.15) * ry;
      worm.update(Math.atan2(y - worm.segments[0].y, x - worm.segments[0].x), false);
      worm.spawnProtection = 0;
    });
    this.camera.zoom += (getCameraZoom(CONFIG.WORM_START_LENGTH, this.viewport) - this.camera.zoom) * CONFIG.CAMERA_ZOOM_SMOOTHING;
  }

  update(playerTargetAngle: number, playerIsBoosting: boolean) {
    this.stepWorld(new Map([[this.player.id, { angle: playerTargetAngle, boost: playerIsBoosting }]]));
  }

  stepOnline(inputs: ReadonlyMap<string, { angle: number; boost: boolean }>) {
    if (this.onlineArena) this.stepWorld(inputs);
  }

  private stepWorld(inputs: ReadonlyMap<string, { angle: number; boost: boolean }>) {
    this.ticks++;
    this.updateEffects();
    if (this.isDemo) {
      this.updateDemo();
      return;
    }
    if (!this.onlineArena && this.player.isDead) return;

    // Fast check: if foods array changed from outside (e.g. in test setup), rebuild grid
    let totalInGrid = 0;
    for (let i = 0; i < TOTAL_GRID_CELLS; i++) totalInGrid += this.foodGrid[i].length;
    if (totalInGrid !== this.foods.length) this.rebuildFoodGrid();

    const worms = this.allWorms();
    for (const worm of worms) {
      if (worm.isDead) continue;
      if (worm.isHuman) {
        const input = inputs.get(worm.id);
        worm.update(input?.angle ?? worm.angle, input?.boost ?? false);
      } else {
        this.steerBot(worm);
        worm.update(worm.targetAngle, false);
      }
      if (worm.isDead) {
        worm.deathReason = 'You reached the edge of the arena.';
        this.burstWorm(worm);
      } else if (worm.isHuman) {
        this.pullSnacks(worm);
        this.collectBonuses(worm);
      }
    }

    // Rotate food priority; resolve all collisions before marking any victim dead.
    const offset = this.ticks % Math.max(1, worms.length);
    const victims = new Set<Worm>();
    const eatenFoodIds = new Set<number>();

    for (let n = 0; n < worms.length; n++) {
      const worm = worms[(n + offset) % worms.length];
      if (worm.isDead) continue;
      const head = worm.segments[0];
      const chompBonus = worm.isHuman && worm.chompTicks > 0 ? 22 : 0;
      const reach = worm.radius + (CONFIG.FOOD_RADIUS * 1.15) + (worm.isHuman ? 5 : 0) + chompBonus;
      const searchRadius = reach + 35;
      const minCx = clamp(Math.floor((head.x - searchRadius) / GRID_CELL_SIZE), 0, GRID_COLS - 1);
      const maxCx = clamp(Math.floor((head.x + searchRadius) / GRID_CELL_SIZE), 0, GRID_COLS - 1);
      const minCy = clamp(Math.floor((head.y - searchRadius) / GRID_CELL_SIZE), 0, GRID_ROWS - 1);
      const maxCy = clamp(Math.floor((head.y + searchRadius) / GRID_CELL_SIZE), 0, GRID_ROWS - 1);

      for (let cy = minCy; cy <= maxCy; cy++) {
        for (let cx = minCx; cx <= maxCx; cx++) {
          const cell = this.foodGrid[cy * GRID_COLS + cx];
          for (let i = cell.length - 1; i >= 0; i--) {
            const food = cell[i];
            if (eatenFoodIds.has(food.id)) continue;
            const itemReach = worm.radius + food.radius + (worm.isHuman ? 5 : 0) + chompBonus;
            const distance = distanceSquared(head, food);
            if (distance < (itemReach + 35) ** 2) worm.appetite = Math.max(worm.appetite, 0.6);
            if (distance > itemReach ** 2) continue;

            if (worm.isHuman) {
              worm.combo = worm.comboTicks > 0 ? Math.min(20, worm.combo + 1) : 1;
              worm.comboTicks = 24;
            }
            const awarded = worm.isHuman
              ? (food.value * 10 + worm.combo) * worm.multiplier
              : food.value * 10;
            worm.grow(food.value, awarded);
            eatenFoodIds.add(food.id);
            cell.splice(i, 1);

            if (worm.isHuman) this.recordEvent({ type: 'eat', playerId: worm.id, x: food.x, y: food.y, color: food.color, value: awarded, food: { ...food } });
            if (worm === this.player) {
              this.snackBites.push({ ...food, life: 1, target: worm });
              if (this.snackBites.length > 20) this.snackBites.shift();
              this.snackRings.push({ x: food.x, y: food.y, radius: food.radius, color: food.value >= 3 ? '#ffdf8b' : food.color, life: 1 });
              if (this.snackRings.length > 20) this.snackRings.shift();
              this.createExplosion(food.x, food.y, food.color, food.value >= 3 ? 12 : 7, 1, true);
              const label = worm.multiplier > 1 ? `${worm.multiplier}x` : food.value >= 3 ? 'SWEET!' : worm.combo > 4 ? `COMBO ${worm.combo}` : undefined;
              this.floatingScores.push({ x: food.x, y: food.y - 24, value: awarded, color: worm.multiplier >= 10 ? '#ffd166' : food.value >= 3 ? '#ffe39a' : food.color, life: 1, label });
              if (this.floatingScores.length > 16) this.floatingScores.shift();
              this.shake = Math.max(this.shake, food.value > 1 ? 2.8 : 1.2);
            }
          }
        }
      }

      if (worm.spawnProtection > 0) continue;
      for (const other of worms) {
        if (worm === other || other.isDead || other.spawnProtection > 0) continue;
        const collisionRadius = (worm.radius + other.radius) * 0.82;
        const otherHead = other.segments[0];
        const maxReach = other.segments.length * CONFIG.WORM_SEGMENT_SPACING + collisionRadius + 20;
        if (distanceSquared(head, otherHead) > maxReach * maxReach) continue;

        for (let i = 0; i < other.segments.length; i += 2) {
          if (distanceSquared(head, other.segments[i]) < collisionRadius ** 2) {
            victims.add(worm);
            break;
          }
        }
        if (victims.has(worm)) break;
      }
    }

    if (eatenFoodIds.size > 0) {
      this.foods = this.foods.filter(food => !eatenFoodIds.has(food.id));
    }

    for (const worm of victims) {
      worm.isDead = true;
      this.burstWorm(worm);
    }

    this.bots = this.bots.filter(bot => !bot.isDead);
    while (this.bots.length < (this.onlineArena ? 10 : CONFIG.BOT_COUNT)) this.spawnBot();
    while (this.foods.length < CONFIG.FOOD_COUNT) this.spawnFood();

    // Denser bonus flow: top the map back up quickly, keep orbs on the field
    // longer, and periodically drop one right in a player's neighborhood.
    this.bonuses = this.bonuses.filter(bonus => this.ticks - bonus.bornAt < CONFIG.BONUS_LIFETIME_TICKS);
    if (this.ticks % CONFIG.BONUS_RESPAWN_TICKS === 0 && this.bonuses.length < CONFIG.BONUS_TARGET_COUNT) this.spawnBonus(true);
    if (this.ticks % CONFIG.BONUS_NEAR_PLAYER_TICKS === 0) this.spawnBonusNearPlayer();

    if ((this.player.isBoosting || this.player.speedTicks > 0) && this.ticks % 3 === 0) {
      const tail = this.player.segments[this.player.segments.length - 1];
      this.createExplosion(tail.x, tail.y, this.player.speedTicks > 0 ? '#38bdf8' : this.player.color, 1);
    }
    const head = this.player.segments[0];
    this.deathReason = this.player.deathReason;
    this.camera.x += (head.x - this.camera.x) * 0.2;
    this.camera.y += (head.y - this.camera.y) * 0.2;
    const targetZoom = getCameraZoom(this.player.segments.length, this.viewport);
    this.camera.zoom += (targetZoom - this.camera.zoom) * CONFIG.CAMERA_ZOOM_SMOOTHING;
  }

  private burstWorm(worm: Worm) {
    const head = worm.segments[0];
    this.recordEvent({ type: 'death', playerId: worm.id, x: head.x, y: head.y, color: worm.color, value: 0 });
    this.createExplosion(head.x, head.y, worm.color, worm === this.player ? 65 : 12, 2);
    this.lootTrails.push({ points: worm.segments.filter((_, i) => i % 3 === 0).map(point => ({ ...point })), life: 1, width: worm.radius * 2 });
    if (this.lootTrails.length > 4) this.lootTrails.shift();
    for (let i = 0; i < worm.segments.length; i += 4) {
      this.addFood(worm.segments[i].x + (Math.random() - 0.5) * 10, worm.segments[i].y + (Math.random() - 0.5) * 10, 3, true);
    }
    if (worm === this.player) this.shake = 15;
  }

  updateEffects() {
    this.shake *= 0.86;
    for (let i = this.snackBites.length - 1; i >= 0; i--) {
      this.snackBites[i].life -= 1 / 13;
      if (this.snackBites[i].life <= 0) this.snackBites.splice(i, 1);
    }
    for (let i = this.snackRings.length - 1; i >= 0; i--) {
      this.snackRings[i].life -= 0.055;
      if (this.snackRings[i].life <= 0) this.snackRings.splice(i, 1);
    }
    for (let i = this.lootTrails.length - 1; i >= 0; i--) {
      this.lootTrails[i].life -= 0.015;
      if (this.lootTrails[i].life <= 0) this.lootTrails.splice(i, 1);
    }
    for (let i = this.particles.length - 1; i >= 0; i--) {
      this.particles[i].update();
      if (this.particles[i].life <= 0) {
        this.particles[i] = this.particles[this.particles.length - 1];
        this.particles.pop();
      }
    }
    for (let i = this.floatingScores.length - 1; i >= 0; i--) {
      const text = this.floatingScores[i];
      text.y -= 0.55;
      text.life -= 0.022;
      if (text.life <= 0) this.floatingScores.splice(i, 1);
    }
  }

  private recordEvent(event: WorldEvent) {
    if (!this.onlineArena) return;
    this.worldEvents.push(event);
    if (this.worldEvents.length > 128) this.worldEvents.shift();
  }

  createExplosion(x: number, y: number, color: string, count: number, force = 1, festive = false) {
    for (let i = 0; i < count && this.particles.length < 160; i++) {
      const tint = festive && i % 3 === 0 ? CONFIG.FOOD_COLORS[Math.floor(Math.random() * CONFIG.FOOD_COLORS.length)] : color;
      this.particles.push(new Particle(x, y, tint, force));
    }
  }
}
