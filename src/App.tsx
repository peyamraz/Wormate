import { useState, useRef, useEffect, useCallback } from 'react';
import { GameEngine } from './game/GameEngine';
import { WORLD_SIZE, WORLD_RADIUS, WORLD_CENTER } from './game/types';

type Screen = 'menu' | 'playing' | 'gameover';

function App() {
  const [screen, setScreen] = useState<Screen>('menu');
  const [playerName, setPlayerName] = useState('');
  const [score, setScore] = useState(0);
  const [length, setLength] = useState(10);
  const [rank, setRank] = useState(0);
  const [finalScore, setFinalScore] = useState(0);
  const [highScore, setHighScore] = useState(
    parseInt(localStorage.getItem('worm_highscore') || '0')
  );
  const [leaderboard, setLeaderboard] = useState<{ name: string; score: number; isPlayer: boolean }[]>([]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const minimapRef = useRef<HTMLCanvasElement>(null);

  // Canvas boyut ayarı
  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current) {
        canvasRef.current.width = window.innerWidth;
        canvasRef.current.height = window.innerHeight;
        if (engineRef.current) {
          engineRef.current.resize(window.innerWidth, window.innerHeight);
        }
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Oyunu başlat
  const startGame = useCallback(() => {
    if (!canvasRef.current) return;

    const engine = new GameEngine(canvasRef.current);
    engineRef.current = engine;

    engine.setOnGameOver((s, hs) => {
      setFinalScore(s);
      setHighScore(hs);
      setScreen('gameover');
    });

    engine.setOnScoreUpdate((s, l, r) => {
      setScore(s);
      setLength(l);
      setRank(r);
    });

    engine.resize(window.innerWidth, window.innerHeight);
    engine.start(playerName || 'Player');
    setScreen('playing');
  }, [playerName]);

  // Minimap render
  useEffect(() => {
    if (screen !== 'playing') return;

    const interval = setInterval(() => {
      const engine = engineRef.current;
      const minimap = minimapRef.current;
      if (!engine || !minimap) return;

      const state = engine.getState();
      const ctx = minimap.getContext('2d');
      if (!ctx) return;

      const size = 150;
      const scale = size / (WORLD_RADIUS * 2);

      ctx.clearRect(0, 0, size, size);

      // Arka plan
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
      ctx.fill();

      // Sınır
      ctx.strokeStyle = 'rgba(255, 100, 100, 0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2);
      ctx.stroke();

      // Worm'lar
      for (const worm of state.worms) {
        if (!worm.alive) continue;
        const head = worm.segments[0];
        const mx = (head.x - WORLD_CENTER.x) * scale + size / 2;
        const my = (head.y - WORLD_CENTER.y) * scale + size / 2;

        ctx.fillStyle = worm.config.isPlayer ? '#ffffff' : worm.config.color;
        ctx.beginPath();
        ctx.arc(mx, my, worm.config.isPlayer ? 4 : 2, 0, Math.PI * 2);
        ctx.fill();
      }

      // Liderlik tablosu
      setLeaderboard(state.leaderboard);
    }, 200);

    return () => clearInterval(interval);
  }, [screen]);

  // Temizlik
  useEffect(() => {
    return () => {
      if (engineRef.current) {
        engineRef.current.destroy();
      }
    };
  }, []);

  return (
    <div className="w-full h-full relative overflow-hidden bg-[#0f0f1a]">
      {/* Game Canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ display: screen === 'playing' ? 'block' : 'none' }}
      />

      {/* Menu Screen */}
      {screen === 'menu' && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <div className="absolute inset-0 overflow-hidden">
            <div className="bg-blob bg-blob-1" />
            <div className="bg-blob bg-blob-2" />
            <div className="bg-blob bg-blob-3" />
          </div>
          <div className="relative bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-10 max-w-md w-full mx-4 shadow-2xl">
            <div className="text-center mb-8">
              <h1 className="text-5xl font-black bg-gradient-to-r from-emerald-400 via-cyan-400 to-purple-400 bg-clip-text text-transparent mb-2">
                🐛 Worm.io
              </h1>
              <p className="text-white/50 text-sm">Ye, Büyü, Hayatta Kal</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-white/60 text-xs uppercase tracking-wider mb-1 block">
                  İsim
                </label>
                <input
                  type="text"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  placeholder="Solucan adın..."
                  maxLength={15}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-emerald-400/50 transition-colors"
                  onKeyDown={(e) => e.key === 'Enter' && startGame()}
                />
              </div>

              <button
                onClick={startGame}
                className="w-full bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-white font-bold py-4 rounded-xl transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-emerald-500/20"
              >
                OYNA
              </button>
            </div>

            {highScore > 0 && (
              <div className="mt-6 text-center">
                <p className="text-white/40 text-xs">En Yüksek Skor</p>
                <p className="text-2xl font-bold text-amber-400">{highScore}</p>
              </div>
            )}

            <div className="mt-6 text-center text-white/30 text-xs space-y-1">
              <p>🖱️ Fare ile yön kontrolü</p>
              <p>🖱️ Sol tık veya Space ile boost</p>
              <p>📱 Mobilde 2 parmak ile boost</p>
            </div>
          </div>
        </div>
      )}

      {/* Game UI Overlay */}
      {screen === 'playing' && (
        <>
          {/* Skor */}
          <div className="absolute top-4 left-4 z-10">
            <div className="bg-black/40 backdrop-blur-sm rounded-xl px-4 py-2 border border-white/10">
              <div className="text-white/60 text-xs">Skor</div>
              <div className="text-2xl font-bold text-white">{score}</div>
              <div className="text-white/40 text-xs">Uzunluk: {length}</div>
            </div>
          </div>

          {/* Liderlik Tablosu */}
          <div className="absolute top-4 right-4 z-10">
            <div className="bg-black/40 backdrop-blur-sm rounded-xl px-4 py-3 border border-white/10 min-w-[180px]">
              <div className="text-white/60 text-xs uppercase tracking-wider mb-2">
                🏆 Liderlik
              </div>
              <div className="space-y-1">
                {leaderboard.slice(0, 8).map((entry, i) => (
                  <div
                    key={i}
                    className={`flex justify-between text-sm ${
                      entry.isPlayer ? 'text-emerald-400 font-bold' : 'text-white/70'
                    }`}
                  >
                    <span className="truncate max-w-[100px]">
                      {i + 1}. {entry.name}
                    </span>
                    <span>{entry.score}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Minimap */}
          <div className="absolute bottom-4 right-4 z-10">
            <canvas
              ref={minimapRef}
              width={150}
              height={150}
              className="rounded-full border border-white/20"
            />
          </div>

          {/* Boost göstergesi */}
          <div className="absolute bottom-4 left-4 z-10">
            <div className="bg-black/40 backdrop-blur-sm rounded-xl px-4 py-2 border border-white/10">
              <div className="text-white/40 text-xs">Sıralama</div>
              <div className="text-xl font-bold text-cyan-400">
                #{rank || '—'}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Game Over Screen */}
      {screen === 'gameover' && (
        <div className="absolute inset-0 flex items-center justify-center z-20 bg-black/60 backdrop-blur-sm">
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-10 max-w-md w-full mx-4 shadow-2xl text-center">
            <div className="text-6xl mb-4">💀</div>
            <h2 className="text-3xl font-bold text-white mb-2">Oyun Bitti!</h2>

            <div className="my-8 space-y-4">
              <div>
                <p className="text-white/40 text-xs uppercase tracking-wider">Skorun</p>
                <p className="text-4xl font-bold text-emerald-400">{finalScore}</p>
              </div>

              {finalScore >= highScore && finalScore > 0 && (
                <div className="bg-amber-500/20 border border-amber-500/30 rounded-xl px-4 py-2">
                  <p className="text-amber-400 font-bold">🎉 Yeni Rekor!</p>
                </div>
              )}

              <div>
                <p className="text-white/40 text-xs uppercase tracking-wider">En Yüksek Skor</p>
                <p className="text-2xl font-bold text-amber-400">{highScore}</p>
              </div>
            </div>

            <div className="space-y-3">
              <button
                onClick={startGame}
                className="w-full bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-white font-bold py-4 rounded-xl transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98]"
              >
                TEKRAR OYNA
              </button>
              <button
                onClick={() => setScreen('menu')}
                className="w-full bg-white/5 hover:bg-white/10 text-white/70 font-bold py-3 rounded-xl transition-all duration-200 border border-white/10"
              >
                ANA MENÜ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
