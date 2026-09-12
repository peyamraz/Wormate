import { useEffect, useRef } from 'react';
import { Zap } from 'lucide-react';
import { GameEngine } from './gameEngine';
import type { PlayerStatus } from './gameEngine';
import { drawGame } from './gameRenderer';
import { prepareGameArt } from './gameArt';
import { gameAudio } from './gameAudio';
import { t } from './i18n';
import { readLoadout, skinById, creditCoins, COIN_VALUE } from './shop';
import type { OnlineClient } from './network/OnlineClient';
import type { GuestSession } from './session';

export type GameState = 'menu' | 'connecting' | 'playing' | 'paused' | 'gameover';

interface GameCanvasProps {
  state: GameState;
  muted: boolean;
  onGameOver: (score: number, reason: string) => void;
  onScoreUpdate: (score: number) => void;
  onStatusUpdate: (status: PlayerStatus) => void;
  online: OnlineClient | null;
  guest: GuestSession | null;
}

interface Controls {
  angle: number;
  mouseBoost: boolean;
  touchBoost: boolean;
  keys: Set<string>;
  pointerId: number | null;
  stick: { x: number; y: number; dx: number; dy: number } | null;
}

const STEP = 1000 / 60;
const MAX_CATCHUP = STEP * 3;
const CONTROL_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ShiftLeft', 'ShiftRight']);

function clearControls(input: Controls) {
  input.keys.clear();
  input.mouseBoost = false;
  input.touchBoost = false;
  input.pointerId = null;
  input.stick = null;
}

export function GameCanvas({ state, muted, onGameOver, onScoreUpdate, onStatusUpdate, online, guest }: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const propsRef = useRef({ state, muted, onGameOver, onScoreUpdate, onStatusUpdate });
  const inputRef = useRef<Controls>({ angle: 0, mouseBoost: false, touchBoost: false, keys: new Set(), pointerId: null, stick: null });

  useEffect(() => {
    propsRef.current = { state, muted, onGameOver, onScoreUpdate, onStatusUpdate };
    if (state !== 'playing') clearControls(inputRef.current);
  }, [state, muted, onGameOver, onScoreUpdate, onStatusUpdate]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d', { alpha: false, desynchronized: true });
    if (!canvas || !ctx) return;
    prepareGameArt(ctx);
    const input = inputRef.current;
    const rect = canvas.getBoundingClientRect();
    const engine = online?.view ?? new GameEngine({ width: rect.width, height: rect.height }, ['menu', 'connecting'].includes(propsRef.current.state));
    if (!online && guest) { engine.player.id = guest.id; engine.player.name = guest.name; }
    if (!online) {
      const loadout = readLoadout();
      const skin = skinById(loadout.skin);
      engine.player.color = skin.color;
      engine.player.pattern = skin.pattern;
      engine.player.hat = loadout.hat;
      engine.player.glasses = loadout.glasses;
      engine.player.eyes = loadout.eyes;
      engine.player.mouth = loadout.mouth;
    }
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    let dpr = 1;
    let frame = 0;
    let lastTime = 0;
    let accumulator = 0;
    let sentGameOver = false;
    let lastScore = 0;
    let lastReportedScore = 0;
    let lastScoreUpdateTime = 0;
    let lastStatusKey = '';
    let lastPublished = 0;
    let lastCombo = 0;
    let lastMult = 1;
    let lastKillFlash = 0;
    let previousRun = online?.run ?? 0;
    let previousState = propsRef.current.state;

    const resize = () => {
      const bounds = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(bounds.width * dpr);
      canvas.height = Math.round(bounds.height * dpr);
      engine.viewport = { width: bounds.width, height: bounds.height };
      online?.resize(bounds.width, bounds.height);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    const aimAt = (clientX: number, clientY: number) => {
      const bounds = canvas.getBoundingClientRect();
      const head = engine.player.segments[0];
      const headX = bounds.left + bounds.width / 2 + (head.x - engine.camera.x) * engine.camera.zoom;
      const headY = bounds.top + bounds.height / 2 + (head.y - engine.camera.y) * engine.camera.zoom;
      const dx = clientX - headX;
      const dy = clientY - headY;
      if (dx * dx + dy * dy > 100) input.angle = Math.atan2(dy, dx);
    };

    const pointerDown = (event: PointerEvent) => {
      if (propsRef.current.state !== 'playing') return;
      gameAudio.unlock();
      if (event.pointerType === 'mouse') {
        // Sol + sağ tık basılı tutma = boost (sağ tık menüsü canvas'ta zaten engelli).
        if (event.button !== 0 && event.button !== 2) return;
        aimAt(event.clientX, event.clientY);
        input.mouseBoost = true;
      } else if (input.pointerId === null) {
        input.pointerId = event.pointerId;
        const bounds = canvas.getBoundingClientRect();
        input.stick = { x: event.clientX - bounds.left, y: event.clientY - bounds.top, dx: 0, dy: 0 };
        canvas.setPointerCapture(event.pointerId);
      }
    };
    const pointerMove = (event: PointerEvent) => {
      if (propsRef.current.state !== 'playing') return;
      if (event.pointerType === 'mouse') {
        aimAt(event.clientX, event.clientY);
      } else if (input.pointerId === event.pointerId && input.stick) {
        const bounds = canvas.getBoundingClientRect();
        const dx = event.clientX - bounds.left - input.stick.x;
        const dy = event.clientY - bounds.top - input.stick.y;
        const distance = Math.hypot(dx, dy);
        const scale = distance > 42 ? 42 / distance : 1;
        input.stick.dx = dx * scale;
        input.stick.dy = dy * scale;
        if (distance > 6) input.angle = Math.atan2(dy, dx);
      }
    };
    const pointerUp = (event: PointerEvent) => {
      // Diğer tuş hâlâ basılıysa boost sürsün (sol basılıyken sağı bırakma vb.).
      if (event.pointerType === 'mouse') input.mouseBoost = (event.buttons & 3) !== 0;
      if (event.pointerId === input.pointerId) {
        input.pointerId = null;
        input.stick = null;
      }
    };
    const keyDown = (event: KeyboardEvent) => {
      if (propsRef.current.state !== 'playing' || !CONTROL_KEYS.has(event.code)) return;
      if (event.target instanceof HTMLElement && event.target.closest('button, input, textarea, select')) return;
      event.preventDefault();
      input.keys.add(event.code);
      if (!event.repeat) gameAudio.unlock();
    };
    const keyUp = (event: KeyboardEvent) => { input.keys.delete(event.code); };
    const resetInput = () => { clearControls(input); online?.sendInput(input.angle, false, true); };
    const visibilityChange = () => { lastTime = 0; accumulator = 0; resetInput(); };
    const preventMenu = (event: Event) => event.preventDefault();

    canvas.addEventListener('pointerdown', pointerDown);
    canvas.addEventListener('pointermove', pointerMove);
    canvas.addEventListener('lostpointercapture', pointerUp);
    canvas.addEventListener('contextmenu', preventMenu);
    window.addEventListener('pointerup', pointerUp);
    window.addEventListener('pointercancel', pointerUp);
    window.addEventListener('keydown', keyDown);
    window.addEventListener('keyup', keyUp);
    window.addEventListener('blur', resetInput);
    document.addEventListener('visibilitychange', visibilityChange);

    const animate = (time: number) => {
      const current = propsRef.current;
      if (current.state !== previousState) {
        accumulator = 0;
        lastTime = time;
        if (current.state === 'paused') engine.shake = 0;
        previousState = current.state;
      }
      const elapsed = lastTime ? Math.min(time - lastTime, MAX_CATCHUP) : STEP;
      lastTime = time;
      if (!document.hidden) {
        const horizontal = Number(input.keys.has('ArrowRight') || input.keys.has('KeyD')) - Number(input.keys.has('ArrowLeft') || input.keys.has('KeyA'));
        const vertical = Number(input.keys.has('ArrowDown') || input.keys.has('KeyS')) - Number(input.keys.has('ArrowUp') || input.keys.has('KeyW'));
        if (horizontal || vertical) input.angle = Math.atan2(vertical, horizontal);
        const boost = current.state === 'playing' && (input.mouseBoost || input.touchBoost || input.keys.has('Space') || input.keys.has('ShiftLeft') || input.keys.has('ShiftRight'));
        if (online) {
          if (previousRun !== online.run) {
            previousRun = online.run;
            sentGameOver = false;
            lastScore = 0;
            lastCombo = 0;
            lastMult = 1;
            lastKillFlash = engine.killFlash;
            lastReportedScore = 0;
            lastStatusKey = '';
            clearControls(input);
            input.angle = engine.player.angle;
          }
          online.sendInput(input.angle, boost);
          online.stepView(elapsed);
        }
        accumulator += elapsed;
        while (accumulator >= STEP) {
          accumulator -= STEP;
          if (online) {
            engine.ticks++;
            engine.updateEffects();
          } else if (current.state === 'menu' || current.state === 'connecting' || (current.state === 'playing' && !sentGameOver)) {
            engine.update(input.angle, boost);
          } else if (current.state === 'gameover' || sentGameOver) {
            engine.updateEffects();
          }
        }
        if (current.state === 'playing' || (online && current.state === 'paused')) {
          if (engine.pickupEvent) {
            if (!current.muted) gameAudio.bonus(engine.pickupEvent);
            if (engine.pickupEvent === 'coin') creditCoins(COIN_VALUE);
            engine.pickupEvent = null;
          }
          if (engine.killFlash !== lastKillFlash) {
            lastKillFlash = engine.killFlash;
            if (!current.muted) gameAudio.takedown();
          }
          if (engine.player.score !== lastScore) {
            const increased = engine.player.score > lastScore;
            lastScore = engine.player.score;
            if (!current.muted && increased) {
              if (engine.player.chompTicks > 0) gameAudio.gulp();
              else if (engine.player.speedTicks > 0) gameAudio.zip();
              else gameAudio.eat(lastScore);
            }
            if (time - lastScoreUpdateTime > 50) {
              lastScoreUpdateTime = time;
              lastReportedScore = lastScore;
              current.onScoreUpdate(lastScore);
            }
          }
          // Süper toplama: kombo dönüm noktaları + yüksek çarpana geçiş
          const comboNow = engine.player.combo;
          if (comboNow !== lastCombo) {
            if (comboNow > lastCombo && (comboNow === 8 || comboNow === 12 || comboNow === 16 || comboNow === 20)) {
              const head = engine.player.segments[0];
              engine.snackRings.push({ x: head.x, y: head.y, radius: engine.player.radius * 2, color: '#ffd166', life: 1 });
              if (engine.snackRings.length > 20) engine.snackRings.shift();
              engine.floatingScores.push({ x: head.x, y: head.y - 44, value: comboNow * 5, color: '#ffd166', life: 1, label: t.frenzyCombo.replace('{n}', String(comboNow)) });
              if (engine.floatingScores.length > 16) engine.floatingScores.shift();
              engine.createExplosion(head.x, head.y, '#ffd166', 26, 1.8, true);
              engine.shake = Math.max(engine.shake, 6 + comboNow * 0.25);
              if (!current.muted) gameAudio.frenzy(comboNow);
            }
            lastCombo = comboNow;
          }
          const multNow = engine.player.multiplier;
          if (multNow >= 5 && multNow > lastMult) {
            const head = engine.player.segments[0];
            engine.createExplosion(head.x, head.y, '#fff3b0', 30, 2, true);
            engine.floatingScores.push({ x: head.x, y: head.y - 56, value: multNow * 10, color: '#fff3b0', life: 1, label: t.frenzyMult.replace('{n}', String(multNow)) });
            if (engine.floatingScores.length > 16) engine.floatingScores.shift();
            engine.shake = Math.max(engine.shake, 8);
            if (!current.muted) gameAudio.frenzy(16);
          }
          if (lastMult > 1 && multNow === 1) {            const head = engine.player.segments[0];
            engine.floatingScores.push({ x: head.x, y: head.y - 40, value: 0, color: '#94a3b8', life: 1, label: t.multEnded });
            if (engine.floatingScores.length > 16) engine.floatingScores.shift();
            if (!current.muted) gameAudio.expired();
          }
          lastMult = multNow;
          if (time - lastPublished > 100) {
            lastPublished = time;
            const status = online ? online.status : engine.getStatus();
            if (status) {
              const statusKey = `${status.score}:${status.size}:${status.sizeRank}:${status.multiplier}:${status.multiplierSeconds}:${status.speedSeconds}:${status.chompSeconds}:${status.giantSeconds}:${status.combo}:${status.activeCount}:${status.humanCount}:${status.botCount}:${status.connectedCount}:${status.leaderboard[0]?.score ?? 0}:${status.leaderboard.reduce((m, e) => Math.max(m, e.size), 0)}`;
              if (statusKey !== lastStatusKey) {
                lastStatusKey = statusKey;
                current.onStatusUpdate(status);
                if (lastReportedScore !== lastScore) {
                  lastReportedScore = lastScore;
                  current.onScoreUpdate(lastScore);
                }
              }
            }
          }
          if (engine.player.isDead && !sentGameOver && !online?.awaitingRespawn) {
            sentGameOver = true;
            clearControls(input);
            current.onScoreUpdate(engine.player.score);
            if (!current.muted) gameAudio.gameOver();
            current.onGameOver(engine.player.score, engine.deathReason);
          }
        }
        drawGame(ctx, engine, dpr, motionQuery.matches);
        if (input.stick && current.state === 'playing') {
          const stick = input.stick;
          ctx.fillStyle = '#cbd5e115';
          ctx.strokeStyle = '#cbd5e140';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(stick.x, stick.y, 52, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = '#fdba7490';
          ctx.beginPath();
          ctx.arc(stick.x + stick.dx, stick.y + stick.dy, 21, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      clearControls(input);
      canvas.removeEventListener('pointerdown', pointerDown);
      canvas.removeEventListener('pointermove', pointerMove);
      canvas.removeEventListener('lostpointercapture', pointerUp);
      canvas.removeEventListener('contextmenu', preventMenu);
      window.removeEventListener('pointerup', pointerUp);
      window.removeEventListener('pointercancel', pointerUp);
      window.removeEventListener('keydown', keyDown);
      window.removeEventListener('keyup', keyUp);
      window.removeEventListener('blur', resetInput);
      document.removeEventListener('visibilitychange', visibilityChange);
    };
  }, [online, guest?.id]);

  return (
    <>
      <canvas ref={canvasRef} className="fixed inset-0 block h-full w-full touch-none bg-slate-900 will-change-transform" aria-label={t.arenaAria} />
      {state === 'playing' && (
        <button
          className="touch-boost fixed bottom-7 right-6 z-10 flex h-20 w-20 touch-none flex-col items-center justify-center gap-1 rounded-full border border-orange-300/40 bg-orange-500/85 text-white shadow-lg active:scale-95 active:bg-orange-400"
          aria-label="Hold to boost"
          onPointerDown={event => {
            event.preventDefault();
            event.currentTarget.setPointerCapture(event.pointerId);
            inputRef.current.touchBoost = true;
            gameAudio.unlock();
            try { navigator.vibrate?.(15); } catch { /* dokunsal geri bildirim opsiyonel */ }
          }}
          onPointerUp={() => { inputRef.current.touchBoost = false; }}
          onPointerCancel={() => { inputRef.current.touchBoost = false; }}
          onLostPointerCapture={() => { inputRef.current.touchBoost = false; }}
          onKeyDown={event => { if (event.code === 'Space' || event.code === 'Enter') inputRef.current.touchBoost = true; }}
          onKeyUp={() => { inputRef.current.touchBoost = false; }}
          onBlur={() => { inputRef.current.touchBoost = false; }}
        >
          <Zap size={23} fill="currentColor" />
          <span className="text-[10px] font-extrabold tracking-widest">{t.boostBtn}</span>
        </button>
      )}
    </>
  );
}
