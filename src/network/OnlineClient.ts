import { GameEngine, getCameraZoom, Worm } from '../gameEngine';
import type { PlayerStatus } from '../gameEngine';
import { BONUS_BY_KIND } from '../constants';
import { readLoadout, skinById } from '../shop';
import { NETWORK } from './protocol';
import type { ArenaSnapshot, ClientMessage, WireWorm } from './protocol';
import { parseServerMessage } from './validation';

export interface ConnectionInfo {
  state: 'connecting' | 'connected' | 'disconnected';
  id: string;
  room: string;
  latency: number;
  message: string;
}

export function arenaUrl(custom = '') {
  const configured = custom.trim() || import.meta.env.VITE_ARENA_URL;
  const fallback = new URL(NETWORK.PATH, window.location.href);
  fallback.protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  if (!configured && import.meta.env.DEV && ['localhost', '127.0.0.1'].includes(fallback.hostname)) fallback.port = '3001';
  const url = new URL(configured || fallback.href);
  if (url.protocol === 'https:') url.protocol = 'wss:';
  if (url.protocol === 'http:') url.protocol = 'ws:';
  if (url.pathname === '/') url.pathname = NETWORK.PATH;
  if (!['ws:', 'wss:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== NETWORK.PATH || url.href.length > 240) throw new Error('Use a ws:// or wss:// server address ending in /arena.');
  if (window.location.protocol === 'https:' && url.protocol !== 'wss:') throw new Error('HTTPS pages require a secure wss:// arena server.');
  return url.href;
}

export class OnlineClient {
  readonly view = new GameEngine({ width: window.innerWidth, height: window.innerHeight }, false, 'view');
  id = '';
  room = '';
  run = 0;
  ready = false;
  awaitingRespawn = false;
  status: PlayerStatus | null = null;
  private socket: WebSocket | null = null;
  private targets: WireWorm[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private deadline: ReturnType<typeof setTimeout> | null = null;
  private restartDeadline: ReturnType<typeof setTimeout> | null = null;
  private resizeTimer: ReturnType<typeof setTimeout> | null = null;
  private lastPacket = 0;
  private lastStateTick = -1;
  private lastSent = 0;
  private seq = 0;
  private latency = 0;
  private ended = false;
  private rejectConnect: ((error: Error) => void) | null = null;

  constructor(private readonly notify: (info: ConnectionInfo) => void) {}

  connect(endpoint: string, name: string, room: string): Promise<void> {
    this.notify({ state: 'connecting', id: '', room, latency: 0, message: '' });
    return new Promise((resolve, reject) => {
      this.rejectConnect = reject;
      try { this.socket = new WebSocket(arenaUrl(endpoint)); }
      catch (error) { this.fail(error instanceof Error ? error.message : 'Cannot connect.'); return; }
      const ws = this.socket;
      this.deadline = setTimeout(() => this.fail('Arena server did not respond. Start the Node server or check its address and allowed origins.'), 8000);
      ws.onopen = () => {
        this.send({ type: 'join', v: 1, name, room, ...this.viewport() });
      };
      ws.onerror = () => this.fail('Cannot reach the live arena. Check the server address, TLS and allowed origins. Practice mode is still available.');
      ws.onclose = () => this.fail('Connection ended. Your temporary session has been removed. Join again for a new ID.');
      ws.onmessage = event => {
        if (typeof event.data !== 'string') { this.fail('Unsupported server response.'); return; }
        const message = parseServerMessage(event.data);
        if (!message) { this.fail('Invalid arena response. The connection was closed for safety.'); return; }
        this.lastPacket = performance.now();
        if (message.type === 'welcome') {
          if (this.id) { this.fail('Unexpected session response.'); return; }
          this.id = message.id;
          this.room = message.room;
          this.sendStyle();
        } else if (message.type === 'state') {
          if (!this.id || message.you !== this.id) { this.fail('Session mismatch.'); return; }
          if (message.tick < this.lastStateTick || message.run < this.run) return;
          const first = !this.ready;
          this.receive(message);
          if (first) {
            this.ready = true;
            this.rejectConnect = null;
            if (this.deadline) clearTimeout(this.deadline);
            this.timer = setInterval(() => {
              if (!document.hidden && performance.now() - this.lastPacket > 30000) { this.fail('The connection timed out. Rejoin to start a new session.'); return; }
              this.send({ type: 'ping', at: Math.floor(performance.now()) });
            }, 5000);
            this.notifyConnected();
            resolve();
          }
        } else if (message.type === 'pong') {
          this.latency = Math.round(Math.max(0, performance.now() - message.at));
          this.notifyConnected();
        } else if (message.type === 'error') {
          if (!this.ready) this.fail(message.message);
          else {
            this.awaitingRespawn = false;
            if (this.restartDeadline) clearTimeout(this.restartDeadline);
            this.notifyConnected(message.message);
          }
        }
      };
    });
  }

  private viewport() {
    return { width: Math.max(320, Math.min(1920, this.view.viewport.width)), height: Math.max(240, Math.min(1080, this.view.viewport.height)) };
  }
  resize(width: number, height: number) {
    this.view.viewport = { width, height };
    if (this.resizeTimer) clearTimeout(this.resizeTimer);
    this.resizeTimer = setTimeout(() => {
      if (this.ready) this.send({ type: 'viewport', ...this.viewport() });
    }, 220);
  }
  private cameraZoom() {
    const displayScale = Math.max(1, this.view.viewport.width / 1920, this.view.viewport.height / 1080);
    return getCameraZoom(this.view.player.segments.length, this.viewport()) * displayScale;
  }
  sendStyle() {
    if (!this.ready && !this.id) return;
    const loadout = readLoadout();
    const skin = skinById(loadout.skin);
    this.send({ type: 'style', color: skin.color, pattern: skin.pattern, hat: loadout.hat, glasses: loadout.glasses });
  }
  sendInput(angle: number, boost: boolean, force = false) {
    const now = performance.now();
    if (!this.ready || this.ended || (!force && now - this.lastSent < 32)) return;
    this.lastSent = now;
    this.send({ type: 'input', seq: ++this.seq, angle: Math.atan2(Math.sin(angle), Math.cos(angle)), boost: Boolean(boost) });
  }
  restart() {
    if (!this.ready || !this.view.player.isDead || this.awaitingRespawn) return false;
    this.awaitingRespawn = true;
    this.send({ type: 'restart' });
    this.restartDeadline = setTimeout(() => {
      this.awaitingRespawn = false;
      this.notifyConnected('Respawn was not confirmed. Please try again.');
    }, 4000);
    return true;
  }
  private send(message: ClientMessage) {
    if (this.socket?.readyState === WebSocket.OPEN && this.socket.bufferedAmount < 4096) this.socket.send(JSON.stringify(message));
  }
  private notifyConnected(message = '') {
    this.notify({ state: 'connected', id: this.id, room: this.room, latency: this.latency, message });
  }
  private fail(message: string) {
    if (this.ended) return;
    const reject = this.rejectConnect;
    this.rejectConnect = null;
    this.close(false);
    reject?.(new Error(message));
    this.notify({ state: 'disconnected', id: '', room: '', latency: 0, message });
  }
  close(voluntary = true) {
    if (this.ended) return;
    if (voluntary) this.send({ type: 'leave' });
    this.ended = true;
    this.ready = false;
    this.id = '';
    this.room = '';
    this.status = null;
    this.targets = [];
    this.view.player.id = '';
    this.view.player.name = 'Guest';
    this.view.bots = [];
    this.view.snackBites = [];
    this.view.floatingScores = [];
    this.view.particles = [];
    if (this.timer) clearInterval(this.timer);
    if (this.deadline) clearTimeout(this.deadline);
    if (this.restartDeadline) clearTimeout(this.restartDeadline);
    if (this.resizeTimer) clearTimeout(this.resizeTimer);
    if (this.socket) {
      this.socket.onmessage = null; this.socket.onopen = null; this.socket.onclose = null;
      this.socket.onerror = () => {};
      try { this.socket.close(1000, 'Leaving arena'); } catch { /* Closing an already failed handshake is harmless. */ }
      this.socket = null;
    }
    if (voluntary && this.rejectConnect) {
      this.rejectConnect(new Error('Connection cancelled.'));
      this.rejectConnect = null;
    }
  }

  private receive(snapshot: ArenaSnapshot) {
    const freshRun = snapshot.run !== this.run;
    this.run = snapshot.run;
    this.lastStateTick = snapshot.tick;
    this.status = snapshot.status;
    this.targets = snapshot.worms;
    const known = new Map([this.view.player, ...this.view.bots].map(worm => [worm.id, worm]));
    const worms: Worm[] = [];
    for (const target of snapshot.worms) {
      let worm = known.get(target.id);
      const created = !worm || (target.id === this.id && freshRun);
      if (created || !worm) worm = new Worm(target.id, target.points[0], target.points[1], target.color, target.angle, target.points.length / 2, target.name, target.pattern);
      const previousLength = worm.segments.length;
      for (const key of ['angle', 'radius', 'score', 'spawnProtection', 'speedTicks', 'chompTicks', 'multiplier', 'multiplierTicks', 'combo', 'facePhase', 'growthPulse', 'appetite', 'lookOffset'] as const) worm[key] = target[key];
      worm.hat = target.hat; worm.glasses = target.glasses;
      worm.name = target.name; worm.color = target.color; worm.pattern = target.pattern;
      worm.isDead = target.isDead; worm.isHuman = target.isHuman; worm.isBoosting = target.isBoosting;
      worm.deathReason = target.deathReason;
      worm.segments.length = target.points.length / 2;
      for (let i = 0; i < worm.segments.length; i++) {
        if (!worm.segments[i] || !this.ready || created) worm.segments[i] = { x: target.points[i * 2], y: target.points[i * 2 + 1] };
      }
      if (target.points.length / 2 > previousLength) worm.swallowWaves.push(0);
      if (target.id === this.id) this.view.player = worm;
      else worms.push(worm);
    }
    this.view.bots = worms;
    this.view.foods = snapshot.foods;
    this.view.rebuildFoodGrid();
    this.view.bonuses = snapshot.bonuses;
    this.view.ticks = snapshot.tick;
    this.view.deathReason = this.view.player.deathReason;
    if (freshRun) {
      this.awaitingRespawn = false;
      if (this.restartDeadline) clearTimeout(this.restartDeadline);
      this.view.particles = []; this.view.snackBites = []; this.view.floatingScores = []; this.view.shake = 0;
      this.view.camera = { ...this.view.player.segments[0], zoom: this.cameraZoom() };
    }
    for (const event of snapshot.events) {
      const own = event.playerId === this.id;
      if (event.type === 'death') {
        this.view.createExplosion(event.x, event.y, event.color, own ? 60 : 18, 2);
        if (own) this.view.shake = 15;
      } else if (own) {
        this.view.createExplosion(event.x, event.y, event.color, 9, 1, true);
        this.view.floatingScores.push({ x: event.x, y: event.y - 24, value: event.value, color: event.color, life: 1, label: event.bonus ? BONUS_BY_KIND[event.bonus].label : undefined });
        if (event.food) this.view.snackBites.push({ ...event.food, target: this.view.player, life: 1 });
        if (event.bonus) this.view.pickupEvent = event.bonus;
        this.view.player.swallowWaves.push(0);
      }
    }
    this.view.floatingScores = this.view.floatingScores.slice(-16);
    this.view.snackBites = this.view.snackBites.slice(-20);
    if (freshRun && this.ready) this.notifyConnected();
  }

  stepView(elapsed: number) {
    if (!this.ready) return;
    const blend = 1 - Math.exp(-Math.min(elapsed, 80) / 35);
    const worms = new Map([this.view.player, ...this.view.bots].map(worm => [worm.id, worm]));
    for (const target of this.targets) {
      const worm = worms.get(target.id);
      if (!worm) continue;
      for (let i = 0; i < worm.segments.length; i++) {
        worm.segments[i].x += (target.points[i * 2] - worm.segments[i].x) * blend;
        worm.segments[i].y += (target.points[i * 2 + 1] - worm.segments[i].y) * blend;
      }
      worm.swallowWaves = worm.swallowWaves.slice(-4).map(wave => wave + elapsed / NETWORK.TICK_MS * 1.5).filter(wave => wave <= worm.segments.length + 8);
    }
    const head = this.view.player.segments[0];
    this.view.camera.x += (head.x - this.view.camera.x) * blend;
    this.view.camera.y += (head.y - this.view.camera.y) * blend;
    this.view.camera.zoom += (this.cameraZoom() - this.view.camera.zoom) * (1 - Math.exp(-elapsed / 500));
  }
}