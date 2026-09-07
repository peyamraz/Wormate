import { useEffect, useRef, useState, useCallback } from 'react';
import {
  GameState,
  WORLD_WIDTH,
  WORLD_HEIGHT,
} from './game/types';
import {
  createInitialState,
  createPlayerWorm,
  updateGame,
  screenToWorld,
} from './game/engine';
import { renderGame } from './game/renderer';

type Screen = 'menu' | 'playing' | 'gameover';

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameStateRef = useRef<GameState | null>(null);
  const animFrameRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const mouseRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const boostingRef = useRef<boolean>(false);

  const [screen, setScreen] = useState<Screen>('menu');
  const [playerName, setPlayerName] = useState('Oyuncu');
  const [finalScore, setFinalScore] = useState(0);
  const [score, setScore] = useState(0);
  const [leaderboard, setLeaderboard] = useState<{ name: string; score: number }[]>([]);
  const [wormLength, setWormLength] = useState(0);

  const startGame = useCallback(() => {
    const state = createInitialState();
    const player = createPlayerWorm(playerName || 'Oyuncu');
    state.worms.push(player);
    state.player = player;
    state.camera.x = player.segments[0].x;
    state.camera.y = player.segments[0].y;
    gameStateRef.current = state;
    setScreen('playing');
    setScore(0);
    setWormLength(player.segments.length);
  }, [playerName]);

  const restartGame = useCallback(() => {
    setScreen('menu');
  }, []);

  // Game loop
  useEffect(() => {
    if (screen !== 'playing') return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    lastTimeRef.current = performance.now();

    const loop = (time: number) => {
      const state = gameStateRef.current;
      if (!state) return;

      const dt = Math.min(time - lastTimeRef.current, 50);
      lastTimeRef.current = time;

      // Calculate mouse angle
      const worldMouse = screenToWorld(
        mouseRef.current.x,
        mouseRef.current.y,
        state.camera.x,
        state.camera.y,
        state.camera.zoom,
        canvas.width,
        canvas.height
      );
      state.mouseWorld = worldMouse;

      if (state.player && state.player.alive) {
        const head = state.player.segments[0];
        state.mouseAngle = Math.atan2(
          worldMouse.y - head.y,
          worldMouse.x - head.x
        );
        state.player.boosting = boostingRef.current;
      }

      // Update
      updateGame(state, dt);

      // Update React state periodically
      if (state.player) {
        setScore(state.player.score);
        setWormLength(state.player.segments.length);
      }
      setLeaderboard([...state.leaderboard]);

      // Render
      renderGame(ctx, state, canvas.width, canvas.height, time);

      // Check game over
      if (state.gameOver && state.player) {
        setFinalScore(state.player.score);
        setScreen('gameover');
        return;
      }

      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [screen]);

  // Mouse/Touch handlers
  useEffect(() => {
    if (screen !== 'playing') return;

    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (e.button === 0) boostingRef.current = true;
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (e.button === 0) boostingRef.current = false;
    };

    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      if (e.touches.length > 0) {
        mouseRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
      if (e.touches.length > 1) {
        boostingRef.current = true;
      }
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        mouseRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
      if (e.touches.length > 1) {
        boostingRef.current = true;
      }
    };

    const handleTouchEnd = () => {
      boostingRef.current = false;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        boostingRef.current = true;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        boostingRef.current = false;
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchstart', handleTouchStart, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [screen]);

  return (
    <div className="w-full h-full relative overflow-hidden bg-[#0f0f1a]">
      {/* Game Canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ cursor: screen === 'playing' ? 'none' : 'default' }}
      />

      {/* Menu Screen */}
      {screen === 'menu' && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <div className="absolute inset-0 bg-gradient-to-b from-[#1a1a2e] via-[#16213e] to-[#0f0f1a]" />
          {/* Animated background dots */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {Array.from({ length: 20 }).map((_, i) => (
              <div
                key={i}
                className="absolute rounded-full opacity-20"
                style={{
                  width: `${8 + Math.random() * 12}px`,
                  height: `${8 + Math.random() * 12}px`,
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                  backgroundColor: ['#ff6b6b', '#4ecdc4', '#f9ca24', '#a29bfe', '#fd79a8', '#00b894'][i % 6],
                  animation: `float ${3 + Math.random() * 4}s ease-in-out infinite`,
                  animationDelay: `${Math.random() * 3}s`,
                }}
              />
            ))}
          </div>
          <div className="relative z-20 flex flex-col items-center gap-6 p-8">
            {/* Title */}
            <div className="text-center mb-4">
              <h1 className="text-6xl md:text-8xl font-black text-transparent bg-clip-text bg-gradient-to-r from-green-400 via-cyan-400 to-purple-500 drop-shadow-lg">
                Worm.io
              </h1>
              <p className="text-gray-400 text-lg mt-2">Solucan Savaşı</p>
            </div>

            {/* Animated worms decoration */}
            <div className="flex gap-3 mb-4">
              {['🟢', '🔵', '🟡', '🟣', '🔴'].map((emoji, i) => (
                <span
                  key={i}
                  className="text-3xl animate-bounce"
                  style={{ animationDelay: `${i * 0.15}s` }}
                >
                  {emoji}
                </span>
              ))}
            </div>

            {/* Name Input */}
            <div className="flex flex-col items-center gap-2">
              <label className="text-gray-300 text-sm font-medium">İsminiz</label>
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                maxLength={15}
                className="px-6 py-3 bg-white/10 border border-white/20 rounded-xl text-white text-center text-lg
                  focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent
                  placeholder-gray-500 w-64 backdrop-blur-sm"
                placeholder="İsminizi girin..."
              />
            </div>

            {/* Play Button */}
            <button
              onClick={startGame}
              className="px-12 py-4 bg-gradient-to-r from-green-500 to-cyan-500 text-white font-bold text-xl
                rounded-full shadow-lg shadow-green-500/30 hover:shadow-green-500/50
                hover:scale-105 active:scale-95 transition-all duration-200
                border border-green-400/30"
            >
              🎮 OYNA
            </button>

            {/* Controls Info */}
            <div className="mt-4 text-center text-gray-400 text-sm space-y-1">
              <p>🖱️ <span className="text-gray-300">Mouse</span> — Yön kontrolü</p>
              <p>🖱️ <span className="text-gray-300">Sol Tık / Space</span> — Hızlanma (Boost)</p>
              <p>📱 <span className="text-gray-300">2 Parmak</span> — Mobil Boost</p>
            </div>
          </div>
        </div>
      )}

      {/* Game HUD */}
      {screen === 'playing' && (
        <>
          {/* Score Display */}
          <div className="absolute top-4 left-4 z-10">
            <div className="bg-black/50 backdrop-blur-sm rounded-xl px-5 py-3 border border-white/10">
              <div className="text-white font-bold text-2xl">{score}</div>
              <div className="text-gray-400 text-xs">Uzunluk: {wormLength}</div>
            </div>
          </div>

          {/* Leaderboard */}
          <div className="absolute top-4 right-4 z-10">
            <div className="bg-black/50 backdrop-blur-sm rounded-xl px-4 py-3 border border-white/10 min-w-[180px]">
              <h3 className="text-white font-bold text-sm mb-2 text-center border-b border-white/10 pb-1">
                🏆 Sıralama
              </h3>
              <div className="space-y-1">
                {leaderboard.slice(0, 8).map((entry, i) => (
                  <div
                    key={i}
                    className={`flex justify-between text-xs ${
                      entry.name === playerName ? 'text-cyan-300 font-bold' : 'text-gray-300'
                    }`}
                  >
                    <span className="truncate max-w-[100px]">
                      {i + 1}. {entry.name}
                    </span>
                    <span className="text-gray-400">{entry.score}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Boost indicator */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10">
            <div className="bg-black/40 backdrop-blur-sm rounded-full px-4 py-2 border border-white/10 text-gray-300 text-xs">
              Space / Tıkla = Boost ⚡
            </div>
          </div>
        </>
      )}

      {/* Game Over Screen */}
      {screen === 'gameover' && (
        <div className="absolute inset-0 flex items-center justify-center z-20">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div className="relative z-30 flex flex-col items-center gap-6 p-8 bg-[#1a1a2e]/90 rounded-2xl border border-white/10 shadow-2xl max-w-sm w-full mx-4">
            <div className="text-6xl">💀</div>
            <h2 className="text-3xl font-black text-white">Oyun Bitti!</h2>
            <div className="text-center">
              <p className="text-gray-400 text-sm">Skorunuz</p>
              <p className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500">
                {finalScore}
              </p>
              <p className="text-gray-400 text-sm mt-2">Uzunluk: {wormLength}</p>
            </div>

            {/* Final leaderboard position */}
            {leaderboard.length > 0 && (
              <div className="w-full bg-white/5 rounded-lg p-3">
                <p className="text-gray-400 text-xs text-center mb-2">En İyi Sıralama</p>
                <div className="space-y-1">
                  {leaderboard.slice(0, 5).map((entry, i) => (
                    <div
                      key={i}
                      className={`flex justify-between text-xs ${
                        entry.name === playerName ? 'text-cyan-300 font-bold' : 'text-gray-400'
                      }`}
                    >
                      <span>{i + 1}. {entry.name}</span>
                      <span>{entry.score}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3 w-full">
              <button
                onClick={startGame}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-green-500 to-cyan-500 text-white font-bold
                  rounded-xl shadow-lg hover:scale-105 active:scale-95 transition-all"
              >
                🔄 Tekrar Oyna
              </button>
              <button
                onClick={restartGame}
                className="px-6 py-3 bg-white/10 text-white font-bold rounded-xl border border-white/20
                  hover:bg-white/20 hover:scale-105 active:scale-95 transition-all"
              >
                🏠 Menü
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
