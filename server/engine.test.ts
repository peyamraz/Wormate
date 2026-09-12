import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { GameEngine, Worm } from '../src/gameEngine';
import { BONUSES, GAME_CONFIG } from '../src/constants';
import { serializeWorm } from './arenaServer';
import { parseServerMessage } from '../src/network/validation';

test('human identity survives game over and restart but is removed on leave', () => {
  const world = new GameEngine(undefined, false, 'online');
  const id = randomUUID();
  const worm = world.addHuman(id, 'Guest');
  assert.equal(world.restartHuman(id), false, 'cannot farm spawn shields by restarting alive');
  worm.isDead = true;
  assert.equal(world.getStatus(worm).connectedCount, 1);
  assert.equal(world.restartHuman(id), true);
  assert.equal(world.humans.get(id)?.id, id);
  assert.equal(world.humans.get(id)?.name, 'Guest');
  assert.equal(world.humans.get(id)?.color, worm.color);
  assert.equal(world.humans.get(id)?.score, 0);
  world.removeHuman(id);
  assert.equal(world.humans.has(id), false);
  assert.equal(world.getStatus().connectedCount, 0);
});

test('camera keeps big worms visibly bigger instead of masking growth', async () => {
  const { getCameraZoom } = await import('../src/gameEngine');
  const view = { width: 1280, height: 800 };
  const small = getCameraZoom(28, view);
  const big = getCameraZoom(280, view);
  assert.ok(big < small, 'camera must still pull back when growing');
  assert.ok(big > 0.82, 'but not collapse to the minimum zoom');
  assert.ok(big / small > 0.45, 'growth must stay visible on screen');
});

test('leaderboard carries body size and ranks the size race separately', () => {
  const world = new GameEngine(undefined, false, 'online');
  const a = world.addHuman(randomUUID(), 'Alice');
  const b = world.addHuman(randomUUID(), 'Bob');
  world.bots = [];
  a.grow(10, 50);
  const status = world.getStatus(b);
  const rowA = status.leaderboard.find(entry => entry.id === a.id);
  assert.ok(rowA && rowA.size === a.segments.length && rowA.size > 28);
  assert.equal(status.size, b.segments.length);
  assert.equal(status.sizeRank, 2);
  assert.equal(world.getStatus(a).sizeRank, 1);
});

test('rapid eating builds combo up to the frenzy cap', () => {
  const world = new GameEngine(undefined, false, 'online');
  const a = world.addHuman(randomUUID(), 'Alice');
  world.bots = []; world.bonuses = [];
  const feedAtHead = () => {
    const h = a.segments[0];
    world.foods = [{ id: 500001, x: h.x, y: h.y, kind: 'donut', variant: 0, color: GAME_CONFIG.FOOD_COLORS[0], radius: 10, value: 1, phase: 0, rotation: 0, isTreasure: false, bornAt: 0 }];
    world.stepOnline(new Map([[a.id, { angle: 0, boost: false }]]));
  };
  feedAtHead();
  feedAtHead();
  assert.ok(a.combo >= 2, 'back-to-back bites must raise combo for the frenzy effect');
  for (let i = 0; i < 40; i++) feedAtHead();
  assert.equal(a.combo, 20, 'combo must cap at 20');
});

test('arena boundary is circular: edge kills, center lives', () => {
  const edge = new Worm(randomUUID(), 5190, 2600, GAME_CONFIG.COLORS[0]);
  edge.update(0, false);
  assert.equal(edge.isDead, true, 'cember disina cikan olmeli');
  const middle = new Worm(randomUUID(), 2600, 2600, GAME_CONFIG.COLORS[0]);
  middle.update(0, false);
  assert.equal(middle.isDead, false, 'merkez yasamali');
});

test('multiplier countdown is visible in status seconds', () => {
  const world = new GameEngine(undefined, false, 'online');
  const a = world.addHuman(randomUUID(), 'Alice');
  world.bots = [];
  a.applyBonus('x2');
  assert.equal(world.getStatus(a).multiplierSeconds, 12);
  for (let i = 0; i < 61; i++) a.update(a.angle, false);
  assert.equal(world.getStatus(a).multiplierSeconds, 11);
});

test('score fattens the worm even at full length', () => {
  const worm = new Worm(randomUUID(), 2600, 2600, GAME_CONFIG.COLORS[0]);
  worm.score = 1000000;
  for (let i = 0; i < 60; i++) worm.update(0, false);
  assert.ok(worm.radius > GAME_CONFIG.WORM_START_RADIUS * 1.5, `1M skor fil gibi yapmali (r=${worm.radius.toFixed(1)})`);
});

test('sustained boost consumes body segments as fuel', () => {
  const worm = new Worm(randomUUID(), 1600, 1600, GAME_CONFIG.COLORS[0]);
  worm.grow(20, 0);
  const before = worm.segments.length;
  for (let i = 0; i < 40; i++) worm.update(0, true);
  assert.ok(worm.segments.length < before, 'holding boost must burn segments');
});

test('coin bonus grants no timed effect but scores', () => {
  const world = new GameEngine(undefined, false, 'online');
  const a = world.addHuman(randomUUID(), 'Alice');
  a.applyBonus('coin');
  assert.equal(a.multiplier, 1);
  assert.equal(a.speedTicks, 0);
  assert.equal(a.chompTicks, 0);
  assert.equal(a.score, 0);
});

test('killer earns score, loot and a kill notice', () => {
  const world = new GameEngine(undefined, false, 'online');
  const a = world.addHuman(randomUUID(), 'Alice');
  const b = world.addHuman(randomUUID(), 'Bob');
  world.bots = []; world.foods = []; world.bonuses = [];
  a.spawnProtection = b.spawnProtection = 0;
  a.segments = [{ x: 2600, y: 2600 }, { x: 2595, y: 2600 }, { x: 2590, y: 2600 }, { x: 2585, y: 2600 }];
  b.segments = [{ x: 2570, y: 2600 }, { x: 2570, y: 3500 }, { x: 2565, y: 3500 }];
  a.angle = Math.PI;
  world.stepOnline(new Map([[a.id, { angle: Math.PI, boost: false }], [b.id, { angle: 0, boost: false }]]));
  assert.equal(b.isDead, true, 'kurban olmeli');
  assert.equal(a.isDead, false, 'katil yasamali');
  assert.ok(a.score >= GAME_CONFIG.KILL_SCORE, 'katil odullenmeli');
  assert.ok(world.worldEvents.some(e => e.type === 'kill' && e.playerId === a.id), 'kill bildirimi olmali');
  assert.ok(world.bonuses.some(bonus => bonus.kind === 'coin'), 'olum altin dusurmeli');
  assert.ok(world.foods.length > 0, 'olum loot birakmali');
});

test('food and multipliers are awarded to the actual eater in the shared world', () => {
  const world = new GameEngine(undefined, false, 'online');
  const a = world.addHuman(randomUUID(), 'Alice');
  const b = world.addHuman(randomUUID(), 'Bob');
  world.bots = [];
  world.bonuses = [];
  a.segments.forEach((p, i) => { p.x = 1400 - i * 5; p.y = 1500; });
  b.segments.forEach((p, i) => { p.x = 2100 - i * 5; p.y = 2100; });
  a.applyBonus('x5');
  world.foods = [{ id: 999999, x: 1404, y: 1500, kind: 'donut', variant: 0, color: GAME_CONFIG.FOOD_COLORS[0], radius: 10, value: 2, phase: 0, rotation: 0, isTreasure: false, bornAt: 0 }];
  world.stepOnline(new Map([[a.id, { angle: 0, boost: false }], [b.id, { angle: 0, boost: false }]]));
  assert.equal(a.score, 105);
  assert.equal(b.score, 0);
  assert.equal(world.foods.some(food => food.id === 999999), false);
  assert.ok(world.worldEvents.some(event => event.type === 'eat' && event.playerId === a.id));
  assert.equal(world.getStatus(a).humanCount, 2);
});

test('simultaneous head collisions do not favor insertion order', () => {
  const world = new GameEngine(undefined, false, 'online');
  const a = world.addHuman(randomUUID(), 'Alice');
  const b = world.addHuman(randomUUID(), 'Bob');
  world.bots = []; world.foods = []; world.bonuses = [];
  a.spawnProtection = b.spawnProtection = 0;
  a.segments = [{ x: 1500, y: 1500 }];
  b.segments = [{ x: 1525, y: 1500 }];
  a.angle = 0; b.angle = Math.PI;
  world.stepOnline(new Map([[a.id, { angle: 0, boost: false }], [b.id, { angle: Math.PI, boost: false }]]));
  assert.equal(a.isDead, true);
  assert.equal(b.isDead, true);
});

test('bonus expiration and bounded growth prevent indefinite amplification', () => {
  const worm = new Worm(randomUUID(), 1600, 1600, GAME_CONFIG.COLORS[0]);
  worm.applyBonus('x100');
  worm.applyBonus('x2');
  assert.equal(worm.multiplier, 100);
  assert.equal(worm.multiplierTicks, BONUSES.find(bonus => bonus.kind === 'x100')?.ticks);
  for (let i = 0; i < 180; i++) worm.update(0, false);
  assert.equal(worm.multiplier, 1);
  worm.grow(100000, 9999999999);
  assert.equal(worm.segments.length, GAME_CONFIG.WORM_MAX_LENGTH);
  assert.equal(worm.score, 999999999);
});

test('all bonus colors, including 100x, survive network validation', () => {
  const world = new GameEngine(undefined, false, 'online');
  const worm = world.addHuman(randomUUID(), 'Guest');
  for (const bonus of BONUSES) {
    const message = {
      type: 'state', v: 1, tick: 1, run: 1, you: worm.id,
      worms: [serializeWorm(worm)], foods: [], bonuses: [], status: world.getStatus(worm),
      events: [{ type: 'bonus', playerId: worm.id, ...worm.segments[0], value: 50, color: bonus.color, bonus: bonus.kind }],
    };
    assert.ok(parseServerMessage(JSON.stringify(message)), `${bonus.kind} must be accepted`);
  }
});