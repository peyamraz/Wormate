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
    engine.start(playerName || 'Oyuncu');
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
      const bgGrad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      bgGrad.addColorStop(0, 'rgba(30, 30, 60, 0.8)');
      bgGrad.addColorStop(1, 'rgba(10, 10, 30, 0.9)');
      ctx.fillStyle = bgGrad;
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
      ctx.fill();

      // Sınır
      ctx.strokeStyle = 'rgba(255, 100, 100, 0.6)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2);
      ctx.stroke();

      // Worm'lar
      for (const worm of state.worms) {
        if (!worm.alive) continue;
        const head = worm.segments[0];
        const mx = (head.x - WORLD_CENTER.x) * scale + size / 2;
        const my = (head.y - WORLD_CENTER.y) * scale + size / 2;

        if (worm.config.isPlayer) {
          // Oyuncu — parlak beyaz
          ctx.fillStyle = '#ffffff';
          ctx.shadowColor = '#ffffff';
          ctx.shadowBlur = 8;
          ctx.beginPath();
          ctx.arc(mx, my, 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
        } else {
          // AI — kendi rengi
          ctx.fillStyle = worm.config.color;
          ctx.beginPath();
          ctx.arc(mx, my, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Leaderboard güncelle
      setLeaderboard(state.leaderboard);
    }, 100);

    return () => clearInterval(interval);
  }, [screen]);

  // Menü ekranı
  if (screen === 'menu') {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-900 via-indigo-900 to-blue-900">
        <div className="text-center p-8 bg-black/40 backdrop-blur-md rounded-3xl shadow-2xl border border-white/10 max-w-md w-full mx-4">
          <h1 className="text-6xl font-bold mb-2 bg-gradient-to-r from-pink-400 via-purple-400 to-indigo-400 bg-clip-text text-transparent">
            🐛 Worm.io
          </h1>
          <p className="text-white/60 mb-8 text-sm">Tatlıları topla, büyü ve rakiplerini yen!</p>

          <input
            type="text"
            placeholder="İsminizi girin..."
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            className="w-full px-4 py-3 mb-4 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-purple-400 text-center text-lg"
            maxLength={15}
          />

          <button
            onClick={startGame}
            className="w-full py-4 bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white font-bold text-xl rounded-xl shadow-lg transform hover:scale-105 transition-all duration-200 mb-6"
          >
            🎮 OYUNA BAŞLA
          </button>

          {highScore > 0 && (
            <div className="text-white/70 text-sm">
              🏆 En Yüksek Skor: <span className="font-bold text-yellow-400">{highScore}</span>
            </div>
          )}

          <div className="mt-6 text-white/50 text-xs space-y-1">
            <p>🖱️ Fare ile yön kontrolü</p>
            <p>⚡ Tıkla veya SPACE ile hızlan</p>
            <p>🍪 Kurabiye, şeker ve tatlıları topla</p>
          </div>
        </div>
      </div>
    );
  }

  // Oyun bitti ekranı
  if (screen === 'gameover') {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-red-900 via-purple-900 to-indigo-900">
        <div className="text-center p-8 bg-black/40 backdrop-blur-md rounded-3xl shadow-2xl border border-white/10 max-w-md w-full mx-4">
          <h2 className="text-5xl font-bold mb-4 text-red-400">💀 Oyun Bitti!</h2>
          
          <div className="space-y-3 mb-6">
            <div className="bg-white/10 rounded-xl p-4">
              <div className="text-white/60 text-sm">Skorunuz</div>
              <div className="text-4xl font-bold text-white">{finalScore}</div>
            </div>
            
            {finalScore >= highScore && finalScore > 0 && (
              <div className="bg-yellow-500/20 border border-yellow-400/50 rounded-xl p-3">
                <div className="text-yellow-400 font-bold">🎉 Yeni Rekor!</div>
              </div>
            )}
            
            <div className="bg-white/10 rounded-xl p-3">
              <div className="text-white/60 text-sm">En Yüksek Skor</div>
              <div className="text-2xl font-bold text-yellow-400">{highScore}</div>
            </div>
          </div>

          <button
            onClick={startGame}
            className="w-full py-4 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold text-xl rounded-xl shadow-lg transform hover:scale-105 transition-all duration-200 mb-3"
          >
            🔄 Tekrar Oyna
          </button>
          
          <button
            onClick={() => setScreen('menu')}
            className="w-full py-3 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl transition-all duration-200"
          >
            🏠 Ana Menü
          </button>
        </div>
      </div>
    );
  }

  // Oyun ekranı
  return (
    <div className="w-full h-full relative overflow-hidden">
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
      
      {/* Skor paneli */}
      <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-md rounded-2xl p-4 text-white border border-white/10">
        <div className="text-sm text-white/60 mb-1">Skor</div>
        <div className="text-3xl font-bold">{score}</div>
        <div className="text-xs text-white/50 mt-2">Uzunluk: {length}</div>
        <div className="text-xs text-white/50">Sıra: #{rank}</div>
      </div>

      {/* Leaderboard */}
      <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-md rounded-2xl p-4 text-white border border-white/10 min-w-[200px]">
        <div className="text-sm font-bold mb-2 text-white/80">🏆 Lider Tablosu</div>
        <div className="space-y-1">
          {leaderboard.slice(0, 5).map((entry, i) => (
            <div
              key={i}
              className={`flex justify-between text-sm ${
                entry.isPlayer ? 'text-yellow-400 font-bold' : 'text-white/70'
              }`}
            >
              <span className="truncate mr-2">
                {i + 1}. {entry.name}
              </span>
              <span>{entry.score}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Minimap */}
      <canvas
        ref={minimapRef}
        width={150}
        height={150}
        className="absolute bottom-4 right-4 rounded-full border-2 border-white/20 shadow-lg"
      />

      {/* Boost göstergesi */}
      <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-md rounded-xl px-4 py-2 text-white border border-white/10">
        <div className="text-xs text-white/60">Hızlanmak için</div>
        <div className="text-sm font-bold">🖱️ Tıkla veya SPACE</div>
      </div>
    </div>
  );
}

export default App;
