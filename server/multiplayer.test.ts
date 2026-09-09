import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { WebSocket } from 'ws';
import { createArenaServer } from './arenaServer';
import { parseServerMessage } from '../src/network/validation';
import type { ServerMessage } from '../src/network/protocol';

const ORIGIN = 'http://localhost:3001';

class Mailbox {
  private messages: ServerMessage[] = [];
  private waits: Array<{ predicate: (message: ServerMessage) => boolean; resolve: (message: ServerMessage) => void; reject: (error: Error) => void }> = [];
  constructor(readonly socket: WebSocket) {
    socket.on('message', data => {
      const message = parseServerMessage(data.toString());
      if (!message) { for (const wait of this.waits.splice(0)) wait.reject(new Error('Server emitted an invalid snapshot')); return; }
      const match = this.waits.findIndex(wait => wait.predicate(message));
      if (match >= 0) this.waits.splice(match, 1)[0].resolve(message);
      else { this.messages.push(message); this.messages = this.messages.slice(-64); }
    });
    socket.on('error', error => { for (const wait of this.waits.splice(0)) wait.reject(error); });
  }
  next(predicate: (message: ServerMessage) => boolean, timeout = 8000): Promise<ServerMessage> {
    const index = this.messages.findIndex(predicate);
    if (index >= 0) return Promise.resolve(this.messages.splice(index, 1)[0]);
    return new Promise((resolve, reject) => {
      const wait = {
        predicate,
        resolve: (message: ServerMessage) => { clearTimeout(timer); resolve(message); },
        reject: (error: Error) => { clearTimeout(timer); reject(error); },
      };
      const timer = setTimeout(() => { this.waits = this.waits.filter(item => item !== wait); reject(new Error('Message timed out')); }, timeout);
      this.waits.push(wait);
    });
  }
  send(value: unknown) { this.socket.send(JSON.stringify(value)); }
}

async function guest(port: number, name: string, room = 'SWEET', autoPong = true) {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/arena`, { origin: ORIGIN, autoPong });
  const inbox = new Mailbox(ws);
  await once(ws, 'open');
  inbox.send({ type: 'join', v: 1, name, room, width: 1280, height: 720 });
  const welcome = await inbox.next(message => message.type === 'welcome');
  assert.ok(welcome.type === 'welcome');
  return { ws, inbox, id: welcome.id };
}

test('two real sockets share an arena, receive distinct IDs, and leave cleanly', { timeout: 15000 }, async () => {
  const server = createArenaServer({ origins: new Set([ORIGIN]) });
  const port = await server.listen(0);
  try {
    const a = await guest(port, 'Alice');
    const b = await guest(port, 'Bob');
    assert.notEqual(a.id, b.id);
    const aState = await a.inbox.next(message => message.type === 'state' && message.status.connectedCount === 2);
    const bState = await b.inbox.next(message => message.type === 'state' && message.status.connectedCount === 2);
    assert.ok(aState.type === 'state' && bState.type === 'state');
    assert.equal(aState.you, a.id);
    assert.equal(bState.you, b.id);
    assert.equal(aState.status.humanCount, 2);
    assert.equal(aState.status.botCount, 6);
    assert.deepEqual(server.stats(), { connections: 2, sessions: 2, rooms: 1 });

    const closed = once(a.ws, 'close');
    a.inbox.send({ type: 'leave' });
    await closed;
    const after = await b.inbox.next(message => message.type === 'state' && message.status.connectedCount === 1);
    assert.ok(after.type === 'state');
    assert.equal(after.you, b.id);
    assert.equal(after.worms.some(worm => worm.id === a.id), false);

    const closedB = once(b.ws, 'close');
    b.inbox.send({ type: 'leave' });
    await closedB;
    assert.deepEqual(server.stats(), { connections: 0, sessions: 0, rooms: 0 });
    const again = await guest(port, 'Alice');
    assert.notEqual(again.id, a.id, 'leaving must not resurrect a deleted identity');
  } finally { await server.close(); }
});

test('forged score/identity messages disconnect only their sender', { timeout: 15000 }, async () => {
  const server = createArenaServer({ origins: new Set([ORIGIN]) });
  const port = await server.listen(0);
  try {
    const honest = await guest(port, 'Alice');
    const attacker = await guest(port, 'Bob');
    const closed = once(attacker.ws, 'close');
    attacker.inbox.send({ type: 'input', seq: 1, angle: 0, boost: false, id: honest.id, score: 999999999 });
    const [code] = await closed;
    assert.equal(code, 1008);
    const state = await honest.inbox.next(message => message.type === 'state' && message.status.connectedCount === 1 && message.tick > 0);
    assert.ok(state.type === 'state');
    assert.ok(state.status.score < 999999999);
    assert.equal(server.stats().sessions, 1);
  } finally { await server.close(); }
});

test('network respawn retains the server UUID and does not create a second session', { timeout: 25000 }, async () => {
  const server = createArenaServer({ origins: new Set([ORIGIN]) });
  const port = await server.listen(0);
  let inputTimer: ReturnType<typeof setInterval> | undefined;
  try {
    const player = await guest(port, 'Runner');
    let seq = 0;
    inputTimer = setInterval(() => player.inbox.send({ type: 'input', seq: ++seq, angle: 0, boost: true }), 34);
    const death = await player.inbox.next(message => message.type === 'state' && message.worms.some(worm => worm.id === player.id && worm.isDead), 15000);
    assert.ok(death.type === 'state');
    assert.equal(server.stats().sessions, 1, 'game over does not delete the active session');
    player.inbox.send({ type: 'restart' });
    const restarted = await player.inbox.next(message => message.type === 'state' && message.run === 2);
    assert.ok(restarted.type === 'state');
    assert.equal(restarted.you, player.id);
    assert.equal(restarted.status.score, 0);
    assert.equal(restarted.worms.find(worm => worm.id === player.id)?.isDead, false);
    assert.equal(server.stats().sessions, 1);
  } finally {
    if (inputTimer) clearInterval(inputTimer);
    await server.close();
  }
});

test('room isolation and explicit origin rejection', { timeout: 15000 }, async () => {
  const server = createArenaServer({ origins: new Set([ORIGIN]) });
  const port = await server.listen(0);
  try {
    const a = await guest(port, 'Alice', 'ALPHA');
    const b = await guest(port, 'Bob', 'BRAVO');
    const state = await a.inbox.next(message => message.type === 'state');
    assert.ok(state.type === 'state');
    assert.equal(state.status.connectedCount, 1);
    assert.equal(state.worms.some(worm => worm.id === b.id), false);
    const status = await new Promise<number | undefined>(resolve => {
      const denied = new WebSocket(`ws://127.0.0.1:${port}/arena`, { origin: 'https://untrusted.example' });
      denied.on('error', () => {});
      denied.on('unexpected-response', (_request, response) => { response.resume(); resolve(response.statusCode); denied.terminate(); });
    });
    assert.equal(status, 403);
    assert.equal(server.stats().sessions, 2);
  } finally { await server.close(); }
});

test('heartbeat removes a silent connection and releases its room', { timeout: 10000 }, async () => {
  const server = createArenaServer({ origins: new Set([ORIGIN]), heartbeatMs: 100 });
  const port = await server.listen(0);
  try {
    const client = await guest(port, 'Silent', 'SWEET', false);
    await once(client.ws, 'close');
    assert.equal(server.stats().sessions, 0);
    assert.equal(server.stats().rooms, 0);
  } finally { await server.close(); }
});

test('oversized payloads and message floods are bounded', { timeout: 15000 }, async () => {
  const server = createArenaServer({ origins: new Set([ORIGIN]) });
  const port = await server.listen(0);
  try {
    const client = await guest(port, 'Large');
    let closed = once(client.ws, 'close');
    client.ws.send('x'.repeat(2048));
    await closed;
    await delay(30);
    assert.equal(server.stats().sessions, 0);
    const flood = await guest(port, 'Fast');
    closed = once(flood.ws, 'close');
    for (let seq = 0; seq < 150; seq++) flood.inbox.send({ type: 'input', seq, angle: 0, boost: false });
    await closed;
    assert.equal(server.stats().sessions, 0);
  } finally { await server.close(); }
});

test('HTTP service exposes no source files or session IDs', { timeout: 10000 }, async () => {
  const server = createArenaServer({ origins: new Set([ORIGIN]) });
  const port = await server.listen(0);
  try {
    const health = await fetch(`http://127.0.0.1:${port}/health`);
    assert.deepEqual(await health.json(), { service: 'wormate-arena', version: 1 });
    assert.equal(health.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(health.headers.get('x-frame-options'), 'DENY');
    for (const path of ['/server/index.ts', '/.env', '/package.json', '/sessions']) {
      const response = await fetch(`http://127.0.0.1:${port}${path}`);
      assert.equal(response.status, 404);
      await response.text();
    }
  } finally { await server.close(); }
});