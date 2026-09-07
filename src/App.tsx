import { useState, useRef, useEffect, useCallback } from 'react';
import { GameEngine } from './game/GameEngine';
import { WORLD_SIZE, WORLD_RADIUS, WORLD_CENTER } from './game/types';

type Screen = 'menu' | 'playing' | 'gameover';

function App() {
  const [screen, setScreen] = useState<Screen>('menu');
  const [playerName, setPlayerName] = useState('');
  const [selectedSkin, setSelectedSkin] = useState(0);
  const [score, setScore] = useState(0);
  const [length, setLength] = useState(10);
  const [rank, setRank] = useState(0);
  const [finalScore, setFinalScore] = useState(0);
  const [highScore, setHighScore] = useState(
    parseInt(localStorage.getItem('worm_highscore') || '0')
  );
  const [leaderboard, setLeaderboard] = useState<{ name: string; score: number; isPlayer: boolean }[]>([]);

  // Skin renkleri
  const skins = [
    { name: 'Gökkuşağı', emoji: '🌈', colors: ['#FF6B6B', '#4ECDC4'] },
    { name: 'Ateş', emoji: '🔥', colors: ['#FF4500', '#FFD700'] },
    { name: 'Okyanus', emoji: '🌊', colors: ['#00CED1', '#1E90FF'] },
    { name: 'Orman', emoji: '🌿', colors: ['#32CD32', '#228B22'] },
    { name: 'Galaksi', emoji: '🌌', colors: ['#9370DB', '#4B0082'] },
    { name: 'Pembe', emoji: '🌸', colors: ['#FF69B4', '#FF1493'] },
  ];

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
    engine.start(playerName || 'Oyuncu', selectedSkin);
    setScreen('playing');
  }, [playerName, selectedSkin]);

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
          ctx.fillStyle = '#ffffff';
          ctx.shadowColor = '#ffffff';
          ctx.shadowBlur = 8;
          ctx.beginPath();
          ctx.arc(mx, my, 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
        } else {
          ctx.fillStyle = worm.config.color;
          ctx.beginPath();
          ctx.arc(mx, my, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      setLeaderboard(state.leaderboard);
    }, 100);

    return () => clearInterval(interval);
  }, [screen]);

  // Menü ekranı
  if (screen === 'menu') {
    return (
      <div className="w-full h-full relative overflow-hidden">
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" style={{ display: 'none' }} />
        
        {/* Arka plan */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
          <div className="absolute inset-0 opacity-20">
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl animate-pulse"></div>
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-pink-500 rounded-full mix-blend-multiply filter blur-3xl animate-pulse" style={{animationDelay: '2s'}}></div>
          </div>
        </div>

        {/* İçerik */}
        <div className="relative z-10 w-full h-full flex items-center justify-center p-4">
          <div className="max-w-md w-full">
            {/* Logo */}
            <div className="text-center mb-8">
              <div className="text-8xl mb-4 animate-bounce">🐛</div>
              <h1 className="text-6xl font-black mb-2 bg-gradient-to-r from-yellow-300 via-pink-400 to-purple-500 bg-clip-text text-transparent">
                WORM.IO
              </h1>
              <p className="text-white/80 text-lg font-medium">
                Tatlıları topla, büyü ve kazan!
              </p>
            </div>

            {/* Ana kart */}
            <div className="bg-white/10 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 p-6 space-y-5">
              {/* İsim girişi */}
              <div>
                <label className="block text-white/90 text-sm font-semibold mb-2">
                  Oyuncu Adı
                </label>
                <input
                  type="text"
                  placeholder="İsminizi girin..."
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  className="w-full px-4 py-3 bg-white/10 border border-white/30 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-purple-400 text-center font-medium transition-all"
                  maxLength={15}
                />
              </div>

              {/* Skin seçimi */}
              <div>
                <label className="block text-white/90 text-sm font-semibold mb-3">
                  Solucan Rengi
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {skins.map((skin, i) => (
                    <button
                      key={i}
                      onClick={() => setSelectedSkin(i)}
                      className={`p-3 rounded-xl border-2 transition-all duration-200 ${
                        selectedSkin === i
                          ? 'bg-white/20 border-white scale-105 shadow-lg'
                          : 'bg-white/5 border-white/20 hover:bg-white/10 hover:border-white/40'
                      }`}
                    >
                      <div className="text-2xl mb-1">{skin.emoji}</div>
                      <div className="text-white/80 text-xs font-medium">{skin.name}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Başla butonu */}
              <button
                onClick={startGame}
                className="w-full py-4 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold text-xl rounded-xl shadow-lg transform hover:scale-105 transition-all duration-200"
              >
                OYUNA BAŞLA
              </button>

              {/* High score */}
              {highScore > 0 && (
                <div className="bg-yellow-500/20 border border-yellow-400/50 rounded-xl p-3 text-center">
                  <div className="text-yellow-300 text-sm font-semibold">En Yüksek Skor</div>
                  <div className="text-yellow-400 text-2xl font-black">{highScore}</div>
                </div>
              )}
            </div>

            {/* Kontroller */}
            <div className="mt-6 grid grid-cols-3 gap-3">
              <div className="bg-white/5 backdrop-blur-sm rounded-xl p-3 text-center border border-white/10">
                <div className="text-2xl mb-1">🖱️</div>
                <div className="text-white/70 text-xs font-medium">Fare ile yön</div>
              </div>
              <div className="bg-white/5 backdrop-blur-sm rounded-xl p-3 text-center border border-white/10">
                <div className="text-2xl mb-1">⚡</div>
                <div className="text-white/70 text-xs font-medium">Tıkla hızlan</div>
              </div>
              <div className="bg-white/5 backdrop-blur-sm rounded-xl p-3 text-center border border-white/10">
                <div className="text-2xl mb-1">🍪</div>
                <div className="text-white/70 text-xs font-medium">Tatlı topla</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Oyun bitti ekranı
  if (screen === 'gameover') {
    return (
      <div className="w-full h-full relative overflow-hidden">
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" style={{ display: 'none' }} />
        
        {/* Arka plan */}
        <div className="absolute inset-0 bg-gradient-to-br from-red-900 via-purple-900 to-slate-900">
          <div className="absolute inset-0 opacity-20">
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-red-500 rounded-full mix-blend-multiply filter blur-3xl animate-pulse"></div>
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl animate-pulse" style={{animationDelay: '2s'}}></div>
          </div>
        </div>

        {/* İçerik */}
        <div className="relative z-10 w-full h-full flex items-center justify-center p-4">
          <div className="max-w-md w-full">
            {/* Başlık */}
            <div className="text-center mb-8">
              <div className="text-7xl mb-4 animate-bounce">💀</div>
              <h2 className="text-5xl font-black mb-2 bg-gradient-to-r from-red-400 via-pink-400 to-purple-400 bg-clip-text text-transparent">
                Oyun Bitti!
              </h2>
              <p className="text-white/70 text-base">Ama harika bir oyun oldu!</p>
            </div>

            {/* Skor kartları */}
            <div className="bg-white/10 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 p-6 space-y-4 mb-6">
              {/* Ana skor */}
              <div className="bg-gradient-to-br from-white/20 to-white/5 rounded-xl p-5 border border-white/20">
                <div className="text-white/60 text-sm font-semibold mb-1">Skorunuz</div>
                <div className="text-5xl font-black text-white">{finalScore}</div>
              </div>
              
              {/* Rekor bildirimi */}
              {finalScore >= highScore && finalScore > 0 && (
                <div className="bg-yellow-500/20 border border-yellow-400/50 rounded-xl p-3 text-center animate-pulse">
                  <div className="text-yellow-300 font-bold">🎉 Yeni Rekor!</div>
                </div>
              )}
              
              {/* En yüksek skor */}
              <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                <div className="text-white/60 text-sm font-semibold mb-1">En Yüksek Skor</div>
                <div className="text-3xl font-black text-yellow-400">{highScore}</div>
              </div>
            </div>

            {/* Butonlar */}
            <div className="space-y-3">
              <button
                onClick={startGame}
                className="w-full py-4 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold text-xl rounded-xl shadow-lg transform hover:scale-105 transition-all duration-200"
              >
                Tekrar Oyna
              </button>

              <button
                onClick={() => setScreen('menu')}
                className="w-full py-3 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-xl transition-all duration-200 border border-white/20"
              >
                Ana Menü
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Oyun ekranı
  return (
    <div className="w-full h-full relative overflow-hidden">
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
      
      {/* Skor paneli - Sol üst */}
      <div className="absolute top-4 left-4 bg-black/70 backdrop-blur-xl rounded-2xl p-5 text-white border border-white/20 shadow-2xl">
        <div className="text-white/60 text-xs font-semibold mb-1">SKOR</div>
        <div className="text-5xl font-black bg-gradient-to-r from-yellow-300 to-orange-400 bg-clip-text text-transparent">{score}</div>
        <div className="mt-3 space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-white/50 text-xs">Uzunluk:</span>
            <span className="text-white font-bold text-sm">{length}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-white/50 text-xs">Sıra:</span>
            <span className="text-white font-bold text-sm">#{rank}</span>
          </div>
        </div>
      </div>

      {/* Leaderboard - Sağ üst */}
      <div className="absolute top-4 right-4 bg-black/70 backdrop-blur-xl rounded-2xl p-5 text-white border border-white/20 shadow-2xl min-w-[220px]">
        <div className="text-white font-bold text-sm mb-3 flex items-center gap-2">
          <span className="text-xl">🏆</span>
          <span>LİDER TABLOSU</span>
        </div>
        <div className="space-y-2">
          {leaderboard.slice(0, 5).map((entry, i) => (
            <div
              key={i}
              className={`flex justify-between items-center text-sm px-3 py-2 rounded-xl ${
                entry.isPlayer 
                  ? 'bg-yellow-500/30 border border-yellow-400/50 text-yellow-300 font-bold' 
                  : 'bg-white/5 border border-white/10 text-white/80'
              }`}
            >
              <span className="flex items-center gap-2">
                <span className="font-bold text-xs opacity-60">{i + 1}.</span>
                <span className="truncate max-w-[120px]">{entry.name}</span>
              </span>
              <span className="font-bold">{entry.score}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Minimap - Sağ alt */}
      <div className="absolute bottom-4 right-4">
        <div className="bg-black/70 backdrop-blur-xl rounded-full p-2 border border-white/20 shadow-2xl">
          <canvas
            ref={minimapRef}
            width={150}
            height={150}
            className="rounded-full"
          />
        </div>
      </div>

      {/* Boost göstergesi - Sol alt */}
      <div className="absolute bottom-4 left-4 bg-black/70 backdrop-blur-xl rounded-2xl px-5 py-3 text-white border border-white/20 shadow-2xl">
        <div className="text-white/60 text-xs font-semibold mb-1">HIZLANMAK İÇİN</div>
        <div className="text-sm font-bold">🖱️ Tıkla veya SPACE</div>
      </div>
    </div>
  );
}

export default App;
