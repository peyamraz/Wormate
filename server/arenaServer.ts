import { createServer } from 'node:http';
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { WebSocket, WebSocketServer } from 'ws';
import { GameEngine, getCameraZoom } from '../src/gameEngine';
import type { Point, Viewport, Worm } from '../src/gameEngine';
import { NETWORK, parseClientMessage } from '../src/network/protocol';
import type { ArenaSnapshot, ServerMessage, WireWorm } from '../src/network/protocol';
import { TokenBucket, clientAddress } from './security';

interface Session {
  id: string;
  room: Room;
  viewport: Viewport;
  input: { angle: number; boost: boolean };
  lastInput: number;
  lastSeq: number;
  lastRestart: number;
  lastViewport: number;
  run: number;
}
interface Room {
  code: string;
  world: GameEngine;
  members: Set<WebSocket>;
}
interface Connection {
  ip: string;
  budget: TokenBucket;
  lastPong: number;
  joinTimer: ReturnType<typeof setTimeout>;
  session: Session | null;
}
export interface ArenaServerOptions {
  origins: Set<string>;
  indexPath?: string;
  production?: boolean;
  trustedProxies?: Set<string>;
  maxPerIp?: number;
  heartbeatMs?: number;
}

const round = (value: number) => Math.round(value * 10) / 10;
export function serializeWorm(worm: Worm): WireWorm {
  // Dev solucanlar paketi şişirmesin: 600 segment üstü seyreltilir (görselde kayıp yok).
  const segs = worm.segments;
  const stride = segs.length > 600 ? 2 : 1;
  const points: number[] = [];
  for (let i = 0; i < segs.length; i += stride) {
    points.push(round(segs[i].x), round(segs[i].y));
  }
  return {
    id: worm.id, name: worm.name, color: worm.color, pattern: worm.pattern,
    angle: worm.angle, radius: worm.radius, score: worm.score, isDead: worm.isDead,
    isHuman: worm.isHuman, spawnProtection: worm.spawnProtection, isBoosting: worm.isBoosting,
    speedTicks: worm.speedTicks, chompTicks: worm.chompTicks, multiplier: worm.multiplier,
    multiplierTicks: worm.multiplierTicks, combo: worm.combo, facePhase: worm.facePhase,
    growthPulse: worm.growthPulse, appetite: worm.appetite, lookOffset: worm.lookOffset,
    hat: worm.hat, glasses: worm.glasses, eyes: worm.eyes, mouth: worm.mouth,
    deathReason: worm.deathReason,
    points,
  };
}

export function createArenaServer(options: ArenaServerOptions) {
  const rooms = new Map<string, Room>();
  const connections = new Map<WebSocket, Connection>();
  const ipLimits = new Map<string, { bucket: TokenBucket; seen: number }>();
  const trusted = options.trustedProxies ?? new Set<string>();
  const heartbeatMs = options.heartbeatMs ?? NETWORK.HEARTBEAT_MS;
  let html: string | null = null;
  try { if (options.indexPath) html = readFileSync(options.indexPath, 'utf8'); } catch { /* /health and the arena remain available before a frontend build. */ }
  const scriptHashes = [...(html?.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi) ?? [])]
    .map(match => `'sha256-${createHash('sha256').update(match[1]).digest('base64')}'`).join(' ');
  const socketOrigins = [...options.origins].map(origin => origin.replace(/^http/, 'ws')).join(' ');
  const csp = `default-src 'none'; script-src ${scriptHashes || "'none'"}; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' ${socketOrigins}; font-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'`;

  const http = createServer({ maxHeaderSize: 8192, requestTimeout: 10000, headersTimeout: 5000, keepAliveTimeout: 5000 }, (request, response) => {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('X-Frame-Options', 'DENY');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    response.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Content-Security-Policy', csp);
    if (options.production) response.setHeader('Strict-Transport-Security', 'max-age=31536000');
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.writeHead(405, { Allow: 'GET, HEAD' }); response.end(); return;
    }
    let path: string;
    try { path = new URL(request.url ?? '/', 'http://local').pathname; }
    catch { response.writeHead(400); response.end(); return; }
    if (path === '/health') {
      response.setHeader('Content-Type', 'application/json');
      response.end(request.method === 'HEAD' ? undefined : JSON.stringify({ service: 'wormate-arena', version: 1 }));
    } else if (path === '/' || path === '/index.html') {
      response.writeHead(html ? 200 : 503, { 'Content-Type': html ? 'text/html; charset=utf-8' : 'text/plain; charset=utf-8' });
      response.end(request.method === 'HEAD' ? undefined : html ?? 'Frontend build not found. Run npm run build, then restart this server.');
    } else {
      response.writeHead(404); response.end();
    }
  });
  http.maxConnections = 256;
  const wss = new WebSocketServer({ noServer: true, maxPayload: NETWORK.MAX_MESSAGE_BYTES, perMessageDeflate: false });

  function release(ws: WebSocket) {
    const connection = connections.get(ws);
    if (!connection) return;
    clearTimeout(connection.joinTimer);
    if (connection.session) {
      const { id, room } = connection.session;
      room.world.removeHuman(id);
      room.members.delete(ws);
      if (room.members.size === 0) rooms.delete(room.code);
      connection.session = null;
    }
    connections.delete(ws);
  }
  function reject(ws: WebSocket, message: string, code = 1008) {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'error', message }));
    release(ws);
    ws.close(code, message.slice(0, 90));
    const deadline = setTimeout(() => ws.terminate(), 1000);
    deadline.unref();
  }
  function send(ws: WebSocket, message: ServerMessage) {
    if (ws.readyState !== WebSocket.OPEN) return;
    if (ws.bufferedAmount > NETWORK.MAX_STATE_BYTES) { release(ws); ws.terminate(); return; }
    if (ws.bufferedAmount > 128 * 1024 && message.type === 'state') return;
    const text = JSON.stringify(message);
    if (text.length <= NETWORK.MAX_STATE_BYTES) ws.send(text);
  }

  http.on('upgrade', (request, socket, head) => {
    const onSocketError = () => socket.destroy();
    socket.on('error', onSocketError);
    const deny = (code: number) => {
      socket.end(`HTTP/1.1 ${code} Rejected\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
      const timeout = setTimeout(() => socket.destroy(), 1000);
      timeout.unref();
      socket.once('close', () => clearTimeout(timeout));
    };
    if (request.method !== 'GET' || request.url !== NETWORK.PATH || !request.headers.origin || !options.origins.has(request.headers.origin)) { deny(403); return; }
    if (wss.clients.size >= NETWORK.MAX_PLAYERS * NETWORK.MAX_ROOMS + 8) { deny(503); return; }
    const ip = clientAddress(request, trusted);
    const now = performance.now();
    let limit = ipLimits.get(ip);
    if (!limit) {
      if (ipLimits.size >= 4096) { deny(503); return; }
      limit = { bucket: new TokenBucket(8, 0.5, now), seen: now };
      ipLimits.set(ip, limit);
    }
    limit.seen = now;
    const sameIp = [...connections.values()].filter(connection => connection.ip === ip).length;
    if (!limit.bucket.take(now) || sameIp >= (options.maxPerIp ?? 12)) { deny(429); return; }
    wss.handleUpgrade(request, socket, head, ws => {
      socket.removeListener('error', onSocketError);
      wss.emit('connection', ws, request);
    });
  });

  wss.on('connection', (ws, request) => {
    const connection: Connection = {
      ip: clientAddress(request, trusted), budget: new TokenBucket(90, 45), lastPong: performance.now(), session: null,
      joinTimer: setTimeout(() => reject(ws, 'Join timed out.'), NETWORK.JOIN_TIMEOUT_MS),
    };
    connections.set(ws, connection);
    ws.on('error', () => { release(ws); ws.terminate(); });
    ws.on('close', () => release(ws));
    ws.on('pong', () => { connection.lastPong = performance.now(); });
    ws.on('message', (data, binary) => {
      if (!connections.has(ws)) return;
      if (binary || !connection.budget.take()) { reject(ws, 'Message limit exceeded.'); return; }
      const message = parseClientMessage(data.toString());
      if (!message) { reject(ws, 'Invalid message.'); return; }
      if (message.type === 'leave') { release(ws); ws.close(1000, 'Session deleted.'); return; }
      if (message.type === 'join') {
        if (connection.session) { reject(ws, 'Already joined.'); return; }
        let room = rooms.get(message.room);
        if (!room) {
          if (rooms.size >= NETWORK.MAX_ROOMS) { reject(ws, 'All rooms are busy.'); return; }
          room = { code: message.room, world: new GameEngine(undefined, false, 'online'), members: new Set() };
          rooms.set(room.code, room);
        }
        if (room.members.size >= NETWORK.MAX_PLAYERS) { reject(ws, 'Room is full.'); return; }
        const id = randomUUID();
        try { room.world.addHuman(id, message.name); }
        catch { if (!room.members.size) rooms.delete(room.code); reject(ws, 'Arena is crowded. Try again.'); return; }
        connection.session = {
          id, room, viewport: { width: message.width, height: message.height }, input: { angle: 0, boost: false },
          lastInput: performance.now(), lastSeq: -1, lastRestart: 0, lastViewport: 0, run: 1,
        };
        room.members.add(ws);
        clearTimeout(connection.joinTimer);
        send(ws, { type: 'welcome', v: 1, id, room: room.code });
        snapshot(ws, connection.session);
        return;
      }
      const session = connection.session;
      if (!session) { reject(ws, 'Join first.'); return; }
      if (message.type === 'input') {
        if (message.seq <= session.lastSeq) return;
        session.lastSeq = message.seq;
        session.lastInput = performance.now();
        session.input = { angle: message.angle, boost: message.boost };
      } else if (message.type === 'viewport') {
        const now = performance.now();
        if (now - session.lastViewport < 200) return;
        session.lastViewport = now;
        session.viewport = { width: message.width, height: message.height };
      } else if (message.type === 'style') {
        const worm = session.room.world.humans.get(session.id);
        if (!worm || worm.isDead) return;
        worm.color = message.color;
        worm.pattern = message.pattern as Worm['pattern'];
        worm.hat = message.hat;
        worm.glasses = message.glasses;
        worm.eyes = message.eyes;
        worm.mouth = message.mouth;
      } else if (message.type === 'restart') {
        const now = performance.now();
        if (session.lastRestart > 0 && now - session.lastRestart < 1000) {
          send(ws, { type: 'error', message: 'Please wait a moment before respawning again.' }); return;
        }
        session.lastRestart = now;
        if (session.room.world.restartHuman(session.id)) {
          session.run++;
          session.input = { angle: 0, boost: false };
          session.lastInput = now;
          snapshot(ws, session);
        } else send(ws, { type: 'error', message: 'Respawn is only available after game over. Try again shortly.' });
      } else if (message.type === 'ping') send(ws, { type: 'pong', at: message.at });
    });
  });

  function snapshot(ws: WebSocket, session: Session) {
    const world = session.room.world;
    const viewer = world.humans.get(session.id);
    if (!viewer) return;
    const center = viewer.segments[0];
    const zoom = getCameraZoom(viewer.segments.length, session.viewport);
    const halfWidth = session.viewport.width / (2 * zoom) + 180;
    const halfHeight = session.viewport.height / (2 * zoom) + 180;
    const visible = (point: Point) => Math.abs(point.x - center.x) <= halfWidth && Math.abs(point.y - center.y) <= halfHeight;
    // En kötü durumu sınırla: görünür yemekler 500 ile cap'lenir, paket şişmez.
    const foods: ArenaSnapshot['foods'] = [];
    for (const food of world.foods) {
      if (foods.length >= NETWORK.MAX_SNAPSHOT_FOODS) break;
      if (visible(food)) foods.push({ ...food, x: round(food.x), y: round(food.y) });
    }
    const message: ArenaSnapshot = {
      type: 'state', v: 1, tick: world.ticks, run: session.run, you: session.id,
      worms: world.allWorms().filter(worm => worm === viewer || (!worm.isDead && worm.segments.some(visible))).map(serializeWorm),
      foods, bonuses: world.bonuses.filter(visible), status: world.getStatus(viewer),
      events: world.worldEvents.filter(event => event.playerId === session.id || (event.type === 'death' && visible(event))).slice(-32),
    };
    send(ws, message);
  }

  let lastTick = performance.now();
  let accumulator = 0;
  const simulation = setInterval(() => {
    const now = performance.now();
    accumulator += Math.min(now - lastTick, NETWORK.TICK_MS * 5);
    lastTick = now;
    while (accumulator >= NETWORK.TICK_MS) {
      accumulator -= NETWORK.TICK_MS;
      for (const room of rooms.values()) {
        const inputs = new Map<string, { angle: number; boost: boolean }>();
        for (const ws of room.members) {
          const session = connections.get(ws)?.session;
          if (session) inputs.set(session.id, { angle: session.input.angle, boost: now - session.lastInput < 500 && session.input.boost });
        }
        room.world.stepOnline(inputs);
        if (room.world.ticks % NETWORK.SNAPSHOT_TICKS === 0) {
          for (const ws of room.members) {
            const session = connections.get(ws)?.session;
            if (session) snapshot(ws, session);
          }
          room.world.worldEvents.length = 0;
        }
      }
    }
  }, 8);
  const heartbeat = setInterval(() => {
    const now = performance.now();
    for (const [ws, connection] of connections) {
      if (now - connection.lastPong > heartbeatMs * 2) { release(ws); ws.terminate(); }
      else if (ws.readyState === WebSocket.OPEN) ws.ping();
    }
    for (const [ip, state] of ipLimits) if (now - state.seen > 120000) ipLimits.delete(ip);
  }, heartbeatMs);

  return {
    http,
    listen(port = 3001, host = '127.0.0.1'): Promise<number> {
      return new Promise((resolve, reject) => {
        http.once('error', reject);
        http.listen(port, host, () => { http.removeListener('error', reject); resolve((http.address() as AddressInfo).port); });
      });
    },
    stats() { return { connections: connections.size, sessions: [...connections.values()].filter(item => item.session).length, rooms: rooms.size }; },
    async close() {
      clearInterval(simulation); clearInterval(heartbeat);
      for (const ws of connections.keys()) { release(ws); ws.terminate(); }
      rooms.clear(); ipLimits.clear();
      await new Promise<void>(resolve => wss.close(() => resolve()));
      http.closeAllConnections();
      if (http.listening) await new Promise<void>(resolve => http.close(() => resolve()));
    },
  };
}