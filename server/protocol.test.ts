import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { parseClientMessage, NETWORK } from '../src/network/protocol';
import { parseServerMessage } from '../src/network/validation';
import { allowedOrigins, TokenBucket } from './security';
import { createPracticeSession, getSession, clearSession } from '../src/session';
import { GAME_CONFIG } from '../src/constants';
import { GameEngine, Worm } from '../src/gameEngine';
import { serializeWorm } from './arenaServer';

const input = { type: 'input', seq: 1, angle: 1, boost: true };
test('only validated intent is accepted; no IDs, scores, coordinates, or unknown fields', () => {
  assert.deepEqual(parseClientMessage(JSON.stringify(input)), input);
  for (const forged of [
    { ...input, id: randomUUID() }, { ...input, score: 999999 }, { ...input, x: 1 },
    { ...input, seq: -1 }, { ...input, seq: 0.5 }, { ...input, angle: 100 },
    { ...input, angle: null }, { ...input, boost: 'true' },
    { type: 'teleport' }, { type: 'restart', score: 100 },
  ]) assert.equal(parseClientMessage(JSON.stringify(forged)), null);
  for (const raw of ['{', '[]', 'null', ' '.repeat(NETWORK.MAX_MESSAGE_BYTES + 1), '{"type":"input","seq":1,"angle":1e999,"boost":true}']) assert.equal(parseClientMessage(raw), null);
});

test('guest names, room codes, protocol version and viewport are constrained', () => {
  const join = { type: 'join', v: 1, name: 'Guest 2', room: 'SWEET', width: 1280, height: 720 };
  assert.deepEqual(parseClientMessage(JSON.stringify(join)), join);
  for (const bad of [
    { ...join, name: '<script>' }, { ...join, name: 'A\u202eB' }, { ...join, name: 'x'.repeat(17) },
    { ...join, room: '../room' }, { ...join, width: 1000000 }, { ...join, v: 2 },
    { ...join, id: randomUUID() }, { ...join, name: '' },
  ]) assert.equal(parseClientMessage(JSON.stringify(bad)), null);
});

test('style cosmetics are validated: known skin, hat and glasses only', () => {
  const style = { type: 'style', color: GAME_CONFIG.COLORS[0], pattern: 'flag-tr', hat: 'crown', glasses: 'sun', eyes: 'angry', mouth: 'teeth' };
  assert.deepEqual(parseClientMessage(JSON.stringify(style)), style);
  for (const bad of [
    { ...style, color: '#ff0000' }, { ...style, pattern: 'flag-xx' }, { ...style, hat: 'tophat' },
    { ...style, glasses: 'laser' }, { ...style, eyes: 'cyclops' }, { ...style, mouth: 'beak' },
    { ...style, score: 100 }, { ...style, id: randomUUID() },
  ]) assert.equal(parseClientMessage(JSON.stringify(bad)), null);
});

test('worm snapshots carry hat and glasses and survive validation', () => {
  const world = new GameEngine(undefined, false, 'online');
  const worm = world.addHuman(randomUUID(), 'Guest', { color: GAME_CONFIG.COLORS[1], pattern: 'stripes', hat: 'crown', glasses: 'sun', eyes: 'angry', mouth: 'teeth' });
  const message = {
    type: 'state', v: 1, tick: 1, run: 1, you: worm.id,
    worms: [serializeWorm(worm)], foods: [], bonuses: [], status: world.getStatus(worm), events: [],
  };
  const parsed = parseServerMessage(JSON.stringify(message));
  assert.ok(parsed && parsed.type === 'state');
  if (parsed.type === 'state') {
    assert.equal(parsed.worms[0].hat, 'crown');
    assert.equal(parsed.worms[0].glasses, 'sun');
    assert.equal(parsed.worms[0].eyes, 'angry');
    assert.equal(parsed.worms[0].mouth, 'teeth');
  }
});

test('worm coordinates follow the enlarged arena bounds', () => {
  const world = new GameEngine(undefined, false, 'online');
  const worm = world.addHuman(randomUUID(), 'Guest');
  const base = () => ({
    type: 'state', v: 1, tick: 1, run: 1, you: worm.id,
    worms: [{ ...serializeWorm(worm) }], foods: [], bonuses: [],
    status: world.getStatus(worm), events: [],
  });
  const near = base();
  near.worms[0].points = near.worms[0].points.map((_, i) => i % 2 === 0 ? 3900 : 2000);
  assert.ok(parseServerMessage(JSON.stringify(near)), 'cember icindeki nokta kabul edilmeli');
  const far = base();
  far.worms[0].points = far.worms[0].points.map((_, i) => i % 2 === 0 ? 5800 : 2600);
  assert.equal(parseServerMessage(JSON.stringify(far)), null, 'cember disindaki nokta reddedilmeli');
});

test('kill notices survive network validation', () => {
  const world = new GameEngine(undefined, false, 'online');
  const worm = world.addHuman(randomUUID(), 'Guest');
  const message = {
    type: 'state', v: 1, tick: 1, run: 1, you: worm.id,
    worms: [serializeWorm(worm)], foods: [], bonuses: [], status: world.getStatus(worm),
    events: [{ type: 'kill', playerId: worm.id, x: 2000, y: 2000, color: worm.color, value: 150 }],
  };
  assert.ok(parseServerMessage(JSON.stringify(message)), 'kill olayi kabul edilmeli');
  // Motorun gercek urettigi kill olayi da paketten gecmeli (renk allowlist sarti).
  const killer = world.addHuman(randomUUID(), 'Hunter');
  killer.spawnProtection = 0;
  worm.spawnProtection = 0;
  worm.angle = Math.PI;
  worm.segments = [{ x: 2600, y: 2600 }, { x: 2595, y: 2600 }, { x: 2590, y: 2600 }];
  killer.segments = [{ x: 2570, y: 2600 }, { x: 2570, y: 3500 }, { x: 2565, y: 3500 }];
  killer.angle = 0;
  world.stepOnline(new Map([[worm.id, { angle: Math.PI, boost: false }], [killer.id, { angle: 0, boost: false }]]));
  const kill = world.worldEvents.find(e => e.type === 'kill');
  assert.ok(kill, 'motor kill olayi uretmeli');
  const withKill = { ...message, you: killer.id, worms: [serializeWorm(killer)], status: world.getStatus(killer), events: [kill] };
  assert.ok(parseServerMessage(JSON.stringify(withKill)), 'gercek kill olayi paketten gecmeli');
});

test('giant worms are thinned in snapshots without breaking validation', () => {
  const giant = new Worm(randomUUID(), 2600, 2600, GAME_CONFIG.COLORS[0], 0, 700, 'Giant');
  giant.segments.forEach(p => { p.x = 2600; p.y = 2600; });
  const wire = serializeWorm(giant);
  assert.ok(wire.points.length < 1400, 'paket sismemeli');
  assert.equal(wire.points.length % 2, 0);
  const world = new GameEngine(undefined, false, 'online');
  const viewer = world.addHuman(randomUUID(), 'Guest');
  const message = {
    type: 'state', v: 1, tick: 1, run: 1, you: viewer.id,
    worms: [serializeWorm(viewer), wire],
    foods: [], bonuses: [], status: world.getStatus(viewer), events: [],
  };
  assert.ok(parseServerMessage(JSON.stringify(message)), 'seyreltilmis solucan kabul edilmeli');
});

test('origin allowlist fails closed and production requires HTTPS', () => {
  assert.deepEqual([...allowedOrigins('https://game.example.com', true)], ['https://game.example.com']);
  for (const origin of ['', '*', 'https://game.example.com/path', 'http://game.example.com']) assert.throws(() => allowedOrigins(origin, true));
});

test('message budget is bounded, refills with elapsed time and rejects a flood', () => {
  const budget = new TokenBucket(2, 1, 0);
  assert.equal(budget.take(0), true);
  assert.equal(budget.take(0), true);
  assert.equal(budget.take(0), false);
  assert.equal(budget.take(500), false);
  assert.equal(budget.take(1000), true);
});

test('local identity is random, stable in memory and explicitly deleted', () => {
  const first = createPracticeSession('Guest');
  assert.equal(getSession()?.id, first.id);
  assert.match(first.id, /^[0-9a-f-]{36}$/);
  clearSession();
  assert.equal(getSession(), null);
  assert.notEqual(createPracticeSession('Guest').id, first.id);
  clearSession();
});

test('client rejects an unsupported version or oversized server packet', () => {
  assert.equal(parseServerMessage('{"type":"welcome","v":2,"id":"fake","room":"SWEET"}'), null);
  assert.equal(parseServerMessage(' '.repeat(NETWORK.MAX_STATE_BYTES + 1)), null);
  const welcome = { type: 'welcome', v: 1, id: randomUUID(), room: 'SWEET' };
  assert.deepEqual(parseServerMessage(JSON.stringify(welcome)), welcome);
});

test('bonus cap follows BONUS_MAX_COUNT (regression: validator must not hardcode 10)', () => {
  const world = new GameEngine(undefined, false, 'online');
  const worm = world.addHuman(randomUUID(), 'Guest');
  const makeBonuses = (count: number) =>
    Array.from({ length: count }, (_, i) => ({ id: i + 1, x: 1900 + i * 3, y: 2000, kind: 'speed', phase: 0, bornAt: 0 }));
  const base = () => ({
    type: 'state', v: 1, tick: 1, run: 1, you: worm.id,
    worms: [serializeWorm(worm)], foods: [], status: world.getStatus(worm), events: [],
  });
  assert.ok(
    parseServerMessage(JSON.stringify({ ...base(), bonuses: makeBonuses(GAME_CONFIG.BONUS_MAX_COUNT) })),
    `exactly BONUS_MAX_COUNT (${GAME_CONFIG.BONUS_MAX_COUNT}) bonuses must be accepted`,
  );
  assert.equal(
    parseServerMessage(JSON.stringify({ ...base(), bonuses: makeBonuses(GAME_CONFIG.BONUS_MAX_COUNT + 1) })),
    null,
    'bonuses beyond BONUS_MAX_COUNT must be rejected',
  );
  if (GAME_CONFIG.BONUS_MAX_COUNT > 10) {
    assert.ok(
      parseServerMessage(JSON.stringify({ ...base(), bonuses: makeBonuses(11) })),
      '11 bonuses must be accepted while the cap is above the old hardcoded 10',
    );
  }
});
