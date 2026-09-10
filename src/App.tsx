import { useState, useEffect, useCallback, useRef } from 'react';
import { GameCanvas } from './GameCanvas';
import type { GameState } from './GameCanvas';
import { VERSION } from './constants';
import type { PlayerStatus } from './gameEngine';
import { gameAudio } from './gameAudio';
import { OnlineClient } from './network/OnlineClient';
import type { ConnectionInfo } from './network/OnlineClient';
import { validName, validRoom } from './network/protocol';
import { clearSession, createPracticeSession, getSession, setOnlineSession } from './session';
import type { GuestSession } from './session';
import { Trophy, Play, Pause, RotateCcw, Volume2, VolumeX, Zap, Magnet, Crown, Globe, ShieldCheck, Copy, Check, LoaderCircle, LogOut, ChevronDown, ChevronUp, Bot } from 'lucide-react';

const EMPTY_STATUS: PlayerStatus = {
  score: 0,
  multiplier: 1,
  multiplierSeconds: 0,
  speedSeconds: 0,
  chompSeconds: 0,
  combo: 0,
  activeCount: 0,
  humanCount: 0,
  botCount: 0,
  connectedCount: 0,
  leaderboard: [],
};
const compactScore = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });

function readHighScores(): number[] {
  try {
    const raw = localStorage.getItem('wormate_highscores') ?? '[]';
    if (raw.length > 4096) return [];
    const saved: unknown = JSON.parse(raw);
    return Array.isArray(saved)
      ? saved.filter((value): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= 999999999).sort((a, b) => b - a).slice(0, 5)
      : [];
  } catch {
    return [];
  }
}

function releaseButtonFocus() {
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
}

export default function App() {
  const [gameState, setGameState] = useState<GameState>('menu');
  const [score, setScore] = useState(0);
  const [status, setStatus] = useState<PlayerStatus>(EMPTY_STATUS);
  const [highScores, setHighScores] = useState<number[]>(readHighScores);
  const [muted, setMuted] = useState(false);
  const [sessionId, setSessionId] = useState(0);
  const [deathReason, setDeathReason] = useState('');
  const [mode, setMode] = useState<'online' | 'practice'>('online');
  const [nickname, setNickname] = useState('Guest');
  const [room] = useState(() => {
    const value = new URLSearchParams(window.location.search).get('room');
    return validRoom(value) ? value : 'SWEET';
  });
  const [endpoint] = useState(() => (new URLSearchParams(window.location.search).get('arena') ?? '').slice(0, 240));
  const [guest, setGuest] = useState<GuestSession | null>(null);
  const [connection, setConnection] = useState<ConnectionInfo | null>(null);
  const [notice, setNotice] = useState('');
  const [copied, setCopied] = useState('');
  const [collapsedLeaderboard, setCollapsedLeaderboard] = useState(false);
  const clientRef = useRef<OnlineClient | null>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isOnline = guest?.mode === 'online';

  useEffect(() => {
    try {
      localStorage.setItem('wormate_highscores', JSON.stringify(highScores));
    } catch {
      // The game remains playable if local storage is unavailable.
    }
  }, [highScores]);

  const handleGameOver = useCallback((finalScore: number, reason: string) => {
    setScore(finalScore);
    setDeathReason(reason);
    setHighScores(previous => [...previous, finalScore].sort((a, b) => b - a).slice(0, 5));
    setGameState('gameover');
  }, []);

  const startGame = useCallback(async () => {
    if (gameState === 'connecting') return;
    gameAudio.unlock();
    releaseButtonFocus();
    const client = clientRef.current;
    if (client?.ready && getSession()?.mode === 'online') {
      if (client.restart()) setNotice('Waiting for the server to respawn your worm...');
      return;
    }
    const name = nickname.normalize('NFKC').trim();
    if (!validName(name)) { setNotice('Use 1-16 letters, numbers, spaces, underscores or hyphens for your name.'); return; }
    setNotice('');
    if (mode === 'online') {
      if (!validRoom(room)) { setNotice('Room codes use 3-12 uppercase letters or numbers.'); return; }
      clientRef.current?.close();
      clearSession();
      setGuest(null);
      setGameState('connecting');
      let knownRun = 0;
      const candidate = new OnlineClient(info => {
        if (clientRef.current !== candidate) return;
        setConnection(info);
        if (info.message) setNotice(info.message);
        if (info.state === 'connected' && candidate.run > knownRun) {
          knownRun = candidate.run;
          if (knownRun > 1) {
            setScore(candidate.status?.score ?? 0);
            setStatus(candidate.status ?? EMPTY_STATUS);
            setNotice(''); setGameState('playing');
          }
        }
        if (info.state === 'disconnected') {
          clearSession(); setGuest(null); clientRef.current = null;
          setGameState('menu'); setSessionId(previous => previous + 1); setStatus(EMPTY_STATUS);
        }
      });
      clientRef.current = candidate;
      try {
        await candidate.connect(endpoint, name, room);
        if (clientRef.current !== candidate || !candidate.ready) return;
        setGuest(setOnlineSession(candidate.id, name, candidate.room));
        setScore(0); setStatus(candidate.status ?? EMPTY_STATUS);
        setSessionId(previous => previous + 1); setGameState('playing');
      } catch (error) {
        if (clientRef.current === candidate) {
          clientRef.current = null; clearSession(); setGuest(null); setGameState('menu');
          setNotice(error instanceof Error ? error.message : 'Connection failed.');
        }
      }
      return;
    }
    const existing = getSession();
    setGuest(existing?.mode === 'practice' ? existing : createPracticeSession(name));
    setSessionId(previous => previous + 1);
    setScore(0);
    setStatus(EMPTY_STATUS);
    setGameState('playing');
  }, [gameState, mode, nickname, room, endpoint]);

  const togglePause = useCallback(() => {
    releaseButtonFocus();
    setGameState(prev => prev === 'playing' ? 'paused' : prev === 'paused' ? 'playing' : prev);
  }, []);

  const returnToMenu = useCallback(() => {
    const client = clientRef.current;
    clientRef.current = null;
    client?.close();
    clearSession(); setGuest(null); setConnection(null); setNotice(''); setStatus(EMPTY_STATUS);
    setCopied('');
    if (copyTimer.current) clearTimeout(copyTimer.current);
    setSessionId(previous => previous + 1);
    setGameState('menu');
  }, []);

  useEffect(() => {
    const leave = () => returnToMenu();
    window.addEventListener('pagehide', leave);
    return () => {
      window.removeEventListener('pagehide', leave);
      clientRef.current?.close(); clearSession();
      if (copyTimer.current) clearTimeout(copyTimer.current);
    };
  }, [returnToMenu]);

  const copy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(''), 2000);
    } catch { setNotice(`Copy manually: ${value}`); }
    releaseButtonFocus();
  };

  const shareRoom = () => {
    const url = new URL(window.location.href);
    url.search = ''; url.hash = '';
    url.searchParams.set('room', guest?.room ?? room);
    if (endpoint) url.searchParams.set('arena', endpoint);
    void copy(url.href, 'room');
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || (event.target instanceof HTMLElement && event.target.closest('input, textarea, select'))) return;
      if (event.code === 'Escape' || event.code === 'KeyP') {
        event.preventDefault();
        togglePause();
      } else if ((event.code === 'KeyR' && ['playing', 'paused', 'gameover'].includes(gameState)) || (event.code === 'Enter' && (gameState === 'menu' || gameState === 'gameover'))) {
        if (event.code === 'Enter' && event.target instanceof HTMLElement && event.target.closest('button')) return;
        event.preventDefault();
        void startGame();
      }
    };
    const autoPause = () => setGameState(previous => previous === 'playing' ? 'paused' : previous);
    const visibilityChange = () => { if (document.hidden) autoPause(); };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('blur', autoPause);
    document.addEventListener('visibilitychange', visibilityChange);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('blur', autoPause);
      document.removeEventListener('visibilitychange', visibilityChange);
    };
  }, [gameState, startGame, togglePause]);

  const topLeader = status.leaderboard[0];
  const userRankEntry = status.leaderboard.find(e => e.isPlayer);

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-slate-900 font-sans text-white select-none">
      <GameCanvas
        key={sessionId}
        state={gameState}
        muted={muted}
        onGameOver={handleGameOver}
        onScoreUpdate={setScore}
        onStatusUpdate={setStatus}
        online={isOnline ? clientRef.current : null}
        guest={guest}
      />

      {/* Main Menu */}
      {gameState === 'menu' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-4 bg-slate-950/40 backdrop-blur-xs">
          <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 p-8 rounded-3xl shadow-2xl flex flex-col items-center text-center">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-4xl">🍬</span>
              <h1 className="text-4xl font-black bg-gradient-to-r from-pink-500 via-orange-400 to-yellow-400 bg-clip-text text-transparent">
                WORMATE
              </h1>
              <span className="text-4xl">🍩</span>
            </div>
            <p className="text-slate-400 text-sm mb-6 font-medium">Sweet Arena &middot; Realtime Multiplayer</p>

            <div className="w-full space-y-4 mb-6">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 text-left">
                  Nickname
                </label>
                <input
                  type="text"
                  maxLength={16}
                  value={nickname}
                  onChange={e => setNickname(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white font-bold focus:outline-none focus:border-orange-500 transition-colors"
                  placeholder="Enter name..."
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setMode('online')}
                  className={`flex-1 py-3 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 border transition-all ${
                    mode === 'online'
                      ? 'bg-orange-500/20 border-orange-500 text-orange-400 shadow-lg shadow-orange-500/10'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <Globe size={16} /> Live Arena
                </button>
                <button
                  type="button"
                  onClick={() => setMode('practice')}
                  className={`flex-1 py-3 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 border transition-all ${
                    mode === 'practice'
                      ? 'bg-orange-500/20 border-orange-500 text-orange-400 shadow-lg shadow-orange-500/10'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <Bot size={16} /> Practice
                </button>
              </div>
            </div>

            {notice && (
              <div role="alert" className="w-full mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs font-medium">
                {notice}
              </div>
            )}

            <button
              onClick={() => { void startGame(); }}
              className="w-full py-4 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-white rounded-2xl font-black text-xl tracking-wider uppercase shadow-lg shadow-orange-500/25 transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-3"
            >
              <Play fill="currentColor" size={20} /> PLAY NOW
            </button>

            {highScores.length > 0 && (
              <div className="mt-6 w-full pt-6 border-t border-slate-800/80">
                <div className="flex items-center justify-between text-xs font-bold text-slate-400 mb-3">
                  <span className="flex items-center gap-1.5"><Trophy size={14} className="text-yellow-400" /> High Scores</span>
                  <span>Personal Best</span>
                </div>
                <div className="space-y-1.5">
                  {highScores.map((s, idx) => (
                    <div key={idx} className="flex justify-between items-center text-xs py-1 px-2.5 rounded-lg bg-slate-950/60 border border-slate-800/40 font-mono">
                      <span className="text-slate-500 font-bold">#{idx + 1}</span>
                      <span className="font-bold text-slate-200">{s.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <p className="mt-5 text-[10px] font-mono tracking-widest text-slate-600">v{VERSION}</p>
          </div>
        </div>
      )}

      {/* Connecting Overlay */}
      {gameState === 'connecting' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm z-50">
          <div className="flex flex-col items-center gap-4 bg-slate-900/90 border border-slate-800 p-8 rounded-3xl shadow-2xl">
            <LoaderCircle size={40} className="animate-spin text-orange-500" />
            <div className="text-lg font-bold text-white">Connecting to arena...</div>
            <p className="text-xs text-slate-400">Joining room {room}</p>
            <button
              onClick={returnToMenu}
              className="mt-2 text-xs font-bold text-slate-400 hover:text-white px-4 py-2 rounded-lg border border-slate-800 hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Game Over Modal */}
      {gameState === 'gameover' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs z-50">
          <div className="w-full max-w-sm bg-slate-900/95 border border-slate-800 p-8 rounded-3xl shadow-2xl flex flex-col items-center text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-4 text-3xl">
              💀
            </div>
            <h2 className="text-2xl font-black text-white mb-1">GAME OVER</h2>
            <p className="text-xs text-slate-400 mb-6 font-medium">{deathReason || 'Better luck next time!'}</p>

            <div className="w-full mb-6 p-4 bg-slate-950/80 rounded-2xl border border-slate-800">
              <div className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500 mb-1">Final Score</div>
              <div className="text-3xl font-black text-orange-400">{score.toLocaleString()}</div>
            </div>

            <button 
              onClick={() => { void startGame(); }}
              disabled={Boolean(isOnline && clientRef.current?.awaitingRespawn)}
              className="w-full py-4 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 disabled:opacity-50 text-white rounded-2xl font-black text-lg tracking-wider transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 shadow-lg shadow-orange-500/25"
            >
              <RotateCcw size={18} /> PLAY AGAIN
            </button>
            {notice && <p role="status" className="mt-3 text-xs text-amber-200">{notice}</p>}
            <button onClick={returnToMenu} className="mt-4 text-xs font-bold tracking-wider text-slate-400 hover:text-white transition-colors py-1">
              BACK TO MENU
            </button>
          </div>
        </div>
      )}

      {/* Modern In-Game HUD */}
      {(gameState === 'playing' || gameState === 'paused') && (
        <>
          {/* Top Left: Score & Active Buffs (Clean Glass Badge) */}
          <div className="pointer-events-none absolute top-3 left-3 flex max-w-[calc(100%-11rem)] flex-col items-start gap-1.5 sm:top-5 sm:left-5 sm:max-w-[45%]">
            <div className="flex items-center gap-2 rounded-full border border-white/10 bg-slate-950/45 px-3 py-1.5 shadow-lg backdrop-blur-md">
              <div className="h-2 w-2 shrink-0 rounded-full bg-cyan-400 animate-pulse ring-2 ring-cyan-400/20" />
              <span key={score} className="score-pop font-mono text-base font-black tabular-nums text-white sm:text-lg" title={score.toLocaleString()} aria-label={`Score: ${score}`}>
                <span className="sm:hidden">{compactScore.format(score)}</span>
                <span className="hidden sm:inline">{score.toLocaleString()}</span>
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {status.speedSeconds > 0 && (
                <div className="flex items-center gap-1 rounded-full border border-sky-400/30 bg-sky-500/65 px-2.5 py-0.5 text-[10px] font-black tracking-wide text-white backdrop-blur-xs">
                  <Zap size={10} fill="currentColor" /> {status.speedSeconds}s
                </div>
              )}
              {status.chompSeconds > 0 && (
                <div className="flex items-center gap-1 rounded-full border border-orange-300/30 bg-orange-500/65 px-2.5 py-0.5 text-[10px] font-black tracking-wide text-white backdrop-blur-xs">
                  <Magnet size={10} /> {status.chompSeconds}s
                </div>
              )}
              {status.multiplier > 1 && (
                <div className="rounded-full border border-yellow-300/40 bg-yellow-400/90 px-2.5 py-0.5 text-[10px] font-black tracking-wide text-slate-950 backdrop-blur-xs">
                  {status.multiplier}x {status.multiplierSeconds}s
                </div>
              )}
              {status.combo > 2 && (
                <div className="rounded-full border border-pink-300/30 bg-pink-500/70 px-2.5 py-0.5 text-[10px] font-black tracking-wide text-white backdrop-blur-xs">
                  COMBO {status.combo}
                </div>
              )}
            </div>
          </div>

          {/* Bottom Left: Session & Ping Badge */}
          {guest && (
            <div className="pointer-events-auto absolute bottom-20 left-3 max-w-[calc(100%-6.5rem)] sm:bottom-6 sm:left-5">
              <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-slate-950/35 px-2.5 py-1 text-[9px] font-bold text-cyan-200 backdrop-blur-xs">
                <ShieldCheck size={11} className="text-cyan-400" />
                <span>{isOnline ? guest.room : 'PRACTICE'}</span>
                {isOnline && <span className="text-slate-400 font-mono font-normal">({connection?.latency ?? 0}ms)</span>}
                <button onClick={() => { void copy(guest.id, 'id'); }} className="ml-1 p-0.5 hover:text-white" aria-label="Copy temporary session ID">{copied === 'id' ? <Check size={11} /> : <Copy size={11} />}</button>
                {isOnline && <button onClick={shareRoom} className="hover:text-white underline">{copied === 'room' ? 'Copied' : 'Invite'}</button>}
              </div>
            </div>
          )}

          {/* Top Right: Modern Glass Controls & Leaderboard */}
          <div className="absolute top-3 right-3 flex w-36 flex-col items-end gap-1.5 sm:top-5 sm:right-5 sm:w-52">
            {/* Quick Action Toolbar (Translucent Glass Pills) */}
            <div className="flex items-center gap-1.5 pointer-events-auto">
              {isOnline && (
                <button
                  onClick={returnToMenu}
                  aria-label="Leave arena"
                  title="Leave arena"
                  className="rounded-full border border-white/10 bg-slate-950/40 p-1.5 text-slate-300 shadow-md backdrop-blur-md transition-all hover:bg-red-500/20 hover:text-red-300 active:scale-95 sm:p-2"
                >
                  <LogOut size={14} className="sm:size-4" />
                </button>
              )}
              <button 
                onClick={togglePause}
                aria-label={gameState === 'paused' ? 'Resume' : 'Pause'}
                title="Pause (Esc)"
                className="rounded-full border border-white/10 bg-slate-950/40 p-1.5 text-white shadow-md backdrop-blur-md transition-all hover:bg-slate-800/60 active:scale-95 sm:p-2"
              >
                {gameState === 'paused' ? <Play size={14} className="sm:size-4" /> : <Pause size={14} className="sm:size-4" />}
              </button>
              <button 
                onClick={event => { setMuted(!muted); gameAudio.unlock(); event.currentTarget.blur(); }}
                aria-label={muted ? 'Unmute' : 'Mute'}
                title={muted ? 'Unmute' : 'Mute'}
                className="rounded-full border border-white/10 bg-slate-950/40 p-1.5 text-white shadow-md backdrop-blur-md transition-all hover:bg-slate-800/60 active:scale-95 sm:p-2"
              >
                {muted ? <VolumeX size={14} className="sm:size-4" /> : <Volume2 size={14} className="sm:size-4" />}
              </button>
              {/* Collapse/Expand Toggle Button */}
              <button
                onClick={() => setCollapsedLeaderboard(!collapsedLeaderboard)}
                aria-label={collapsedLeaderboard ? 'Expand leaderboard' : 'Minimize leaderboard'}
                title={collapsedLeaderboard ? 'Expand leaderboard' : 'Minimize leaderboard'}
                className="rounded-full border border-white/10 bg-slate-950/40 p-1.5 text-slate-300 shadow-md backdrop-blur-md transition-all hover:bg-slate-800/60 active:scale-95 sm:p-2"
              >
                {collapsedLeaderboard ? <ChevronDown size={14} className="sm:size-4" /> : <ChevronUp size={14} className="sm:size-4" />}
              </button>
            </div>

            {/* Leaderboard Card: Glassmorphic, Translucent & Compact */}
            {collapsedLeaderboard ? (
              // Collapsed Mini-Badge on Mobile
              <div
                onClick={() => setCollapsedLeaderboard(false)}
                className="pointer-events-auto flex w-full cursor-pointer items-center justify-between rounded-xl border border-white/10 bg-slate-950/35 px-2 py-1.5 text-[9px] shadow-lg backdrop-blur-md transition-all hover:bg-slate-950/50"
              >
                <div className="flex items-center gap-1 font-bold text-amber-300">
                  <Crown size={11} fill="currentColor" />
                  <span className="truncate max-w-[4rem]">{topLeader?.name ?? 'Leader'}</span>
                </div>
                {userRankEntry && (
                  <div className="font-mono font-black text-cyan-300">
                    #{userRankEntry.rank}
                  </div>
                )}
              </div>
            ) : (
              // Full Modern Sleek Leaderboard
              <section aria-label="Live arena leaderboard" className="pointer-events-none w-full overflow-hidden rounded-xl border border-white/10 bg-slate-950/35 shadow-xl backdrop-blur-md transition-all">
                {/* Header info */}
                <header className="flex items-center justify-between border-b border-white/10 px-2 py-1.5 sm:px-3 sm:py-2">
                  <div className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-[9px] font-black tracking-wider text-slate-300 uppercase sm:text-[10px]">
                      {isOnline ? guest?.room : 'SOLO'}
                    </span>
                  </div>
                  <div className="text-[8px] font-bold text-slate-400 sm:text-[9px]">
                    {isOnline ? `${status.connectedCount} LIVE` : `${status.activeCount} BOTS`}
                  </div>
                </header>

                {/* Player List */}
                <div className="p-1 sm:p-1.5">
                  <ol className="space-y-0.5">
                    {status.leaderboard.map((entry, index) => {
                      const separatedPlayer = entry.isPlayer && index >= 5;
                      const isFirst = entry.rank === 1;
                      const isSecond = entry.rank === 2;
                      const isThird = entry.rank === 3;

                      return (
                        <li
                          key={entry.id}
                          className={`flex items-center gap-1.5 rounded-lg px-1.5 py-0.5 text-[9px] transition-colors sm:px-2 sm:py-1 sm:text-[10px] ${
                            entry.isPlayer 
                              ? 'bg-cyan-500/20 text-cyan-200 ring-1 ring-cyan-400/40 font-bold' 
                              : 'text-slate-300'
                          } ${separatedPlayer ? 'mt-1 border-t border-dashed border-white/10 pt-1' : ''}`}
                        >
                          {/* Rank Icon / Number */}
                          <span className={`w-3.5 text-center font-black shrink-0 ${
                            isFirst ? 'text-amber-400' : isSecond ? 'text-slate-300' : isThird ? 'text-amber-600' : 'text-slate-500'
                          }`}>
                            {isFirst ? <Crown size={10} fill="currentColor" className="inline sm:size-3" /> : entry.rank}
                          </span>

                          {/* Color Dot Avatar */}
                          <span 
                            className="h-2 w-2 shrink-0 rounded-full ring-1 ring-white/40 shadow-xs sm:h-2.5 sm:w-2.5" 
                            style={{ backgroundColor: entry.color }} 
                          />

                          {/* Name */}
                          <span className="min-w-0 flex-1 truncate font-semibold">
                            {entry.name}
                          </span>

                          {/* Score (Compact on mobile, localized on desktop) */}
                          <span className="font-mono font-black tabular-nums text-white/90 shrink-0">
                            <span className="sm:hidden">{compactScore.format(entry.score)}</span>
                            <span className="hidden sm:inline">{entry.score.toLocaleString()}</span>
                          </span>
                        </li>
                      );
                    })}
                  </ol>
                </div>
              </section>
            )}
          </div>

          {gameState === 'playing' && (
            <div className="pointer-events-none absolute bottom-5 left-5 text-[10px] text-slate-500">
              <span className="desktop-controls">WASD / Mouse to steer &middot; Space to boost</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
