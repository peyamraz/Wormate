import { useState, useEffect, useCallback, useRef } from 'react';
import { GameCanvas } from './GameCanvas';
import type { GameState } from './GameCanvas';
import type { PlayerStatus } from './gameEngine';
import { gameAudio } from './gameAudio';
import { OnlineClient } from './network/OnlineClient';
import type { ConnectionInfo } from './network/OnlineClient';
import { validName, validRoom } from './network/protocol';
import { clearSession, createPracticeSession, getSession, setOnlineSession } from './session';
import type { GuestSession } from './session';
import { Trophy, Play, Pause, RotateCcw, Volume2, VolumeX, Zap, Magnet, Users, Bot, Crown, Globe, ShieldCheck, Copy, Check, LoaderCircle, LogOut } from 'lucide-react';

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
  const [room, setRoom] = useState(() => {
    const value = new URLSearchParams(window.location.search).get('room');
    return validRoom(value) ? value : 'SWEET';
  });
  const [endpoint, setEndpoint] = useState(() => (new URLSearchParams(window.location.search).get('arena') ?? '').slice(0, 240));
  const [guest, setGuest] = useState<GuestSession | null>(null);
  const [connection, setConnection] = useState<ConnectionInfo | null>(null);
  const [notice, setNotice] = useState('');
  const [copied, setCopied] = useState('');
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

      {/* UI Overlays */}
      {(gameState === 'menu' || gameState === 'connecting') && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-slate-900/25 p-4">
          <div className="absolute top-5 left-6 flex items-center gap-2 text-[10px] font-bold tracking-[0.2em] text-slate-300">
            <span className="h-1.5 w-1.5 rounded-full bg-teal-300 motion-safe:animate-pulse" />
            LIVE DEMO
          </div>
          <div className="state-panel pointer-events-auto max-h-[calc(100dvh-4rem)] w-full max-w-md overflow-y-auto rounded-3xl border border-slate-600/60 bg-slate-800/90 p-6 text-center shadow-2xl backdrop-blur-sm sm:p-8">
            <h1 className="text-5xl sm:text-6xl font-black mb-2 bg-gradient-to-br from-yellow-400 via-orange-500 to-red-500 bg-clip-text text-transparent italic tracking-tighter">
              WORMATE
            </h1>
            <p className="text-slate-400 mb-5 font-medium">Eat. Grow. Dominate.</p>
            <fieldset disabled={gameState === 'connecting'} className="mb-5 text-left disabled:opacity-60">
              <legend className="sr-only">Choose a game mode</legend>
              <div className="mb-4 grid grid-cols-2 gap-1 rounded-xl bg-slate-950/55 p-1">
                {(['online', 'practice'] as const).map(option => (
                  <button key={option} type="button" aria-pressed={mode === option} onClick={() => { setMode(option); setNotice(''); }} className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-xs font-bold transition-colors ${mode === option ? 'bg-slate-600 text-white' : 'text-slate-400 hover:text-white'}`}>
                    {option === 'online' ? <Globe size={15} /> : <Bot size={15} />}{option === 'online' ? 'Live Arena' : 'Practice'}
                  </button>
                ))}
              </div>
              <div className={`grid gap-3 ${mode === 'online' ? 'grid-cols-[1fr_100px]' : ''}`}>
                <label className="text-[10px] font-bold tracking-wider text-slate-400">NICKNAME
                  <input value={nickname} onChange={event => setNickname(event.target.value)} maxLength={16} autoComplete="off" spellCheck={false} className="mt-1.5 w-full rounded-lg border border-slate-600 bg-slate-950/45 px-3 py-2.5 text-sm font-medium tracking-normal text-white outline-none focus:border-cyan-400" />
                </label>
                {mode === 'online' && <label className="text-[10px] font-bold tracking-wider text-slate-400">ROOM CODE
                  <input value={room} onChange={event => setRoom(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} maxLength={12} autoComplete="off" spellCheck={false} className="mt-1.5 w-full rounded-lg border border-slate-600 bg-slate-950/45 px-3 py-2.5 font-mono text-sm tracking-normal text-cyan-200 outline-none focus:border-cyan-400" />
                </label>}
              </div>
              {mode === 'online' && <details className="mt-3 text-xs text-slate-400">
                <summary className="cursor-pointer py-1">Server connection &amp; privacy</summary>
                <label className="mt-2 block">Arena server (optional)
                  <input value={endpoint} onChange={event => setEndpoint(event.target.value)} maxLength={240} placeholder="wss://game.example.com/arena" autoComplete="off" spellCheck={false} className="mt-1.5 w-full rounded-lg border border-slate-600 bg-slate-950/45 px-3 py-2.5 text-xs text-white outline-none focus:border-cyan-400" />
                </label>
                <p className="mt-2 leading-relaxed">Use the same server and room on both devices. Live play needs the included Node server; a static preview alone cannot host an arena.</p>
                <p className="mt-2 leading-relaxed">Guest IDs stay in memory during the session. Leaving deletes the ID. A lost connection is removed by the server heartbeat within about 30 seconds.</p>
              </details>}
            </fieldset>
            {notice && <p role="alert" className="mb-4 rounded-lg border border-amber-400/30 bg-amber-400/10 p-3 text-left text-xs leading-relaxed text-amber-100">{notice}</p>}
            
            <button 
              onClick={() => { void startGame(); }}
              disabled={gameState === 'connecting'}
              className="group relative w-full py-4 px-8 bg-orange-500 hover:bg-orange-400 disabled:opacity-70 disabled:cursor-wait text-white rounded-2xl font-bold text-lg transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-3 shadow-lg shadow-orange-500/30"
            >
              {gameState === 'connecting' ? <LoaderCircle className="animate-spin" /> : <Play className="fill-current" />}
              {gameState === 'connecting' ? 'CONNECTING...' : mode === 'online' ? 'JOIN LIVE ARENA' : 'PLAY WITH BOTS'}
            </button>
            {gameState === 'connecting' && <button onClick={returnToMenu} className="mt-2 px-4 py-2 text-xs text-slate-400 hover:text-white">Cancel connection</button>}

            <p className="mt-4 text-xs leading-relaxed text-slate-300">
              Grab SPEED, CHOMP, and glowing 2x-100x gems. Rarer multipliers last less.
              <span className="desktop-controls mt-1 text-slate-400">Mouse or WASD to steer. Hold Space to boost.</span>
              <span className="mobile-controls mt-1 text-slate-400">Drag to steer. Hold BOOST to go faster.</span>
            </p>

            <div className="mt-6 p-5 bg-slate-900/50 rounded-2xl border border-slate-700">
              <div className="flex items-center justify-center gap-2 mb-4 text-slate-300 font-bold uppercase tracking-widest text-sm">
                <Trophy className="w-4 h-4 text-yellow-400" />
                Local High Scores
              </div>
              <div className="space-y-2">
                {highScores.length > 0 ? (
                  highScores.map((s, i) => (
                    <div key={i} className="flex justify-between items-center py-1 px-4 bg-slate-800/50 rounded-lg border border-slate-700/50">
                      <span className="text-slate-500 font-mono">#{i + 1}</span>
                      <span className="font-bold text-slate-200">{s.toLocaleString()}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-slate-500 italic text-sm py-2">No scores yet!</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {gameState === 'paused' && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm">
          <div role="dialog" aria-modal="true" aria-labelledby="paused-title" className="state-panel max-h-[calc(100dvh-2rem)] overflow-y-auto text-center p-8 bg-slate-800 rounded-3xl shadow-2xl border border-slate-700 max-w-xs w-full mx-4">
            <h2 id="paused-title" className="text-4xl font-black mb-4 text-white">{isOnline ? 'LIVE ARENA' : 'PAUSED'}</h2>
            {isOnline && <p className="mb-5 text-sm leading-relaxed text-amber-200">The arena keeps running. Your worm can still collide while this menu is open.</p>}
            <button 
              onClick={togglePause}
              className="w-full py-4 px-8 bg-orange-500 hover:bg-orange-400 text-white rounded-2xl font-bold text-lg transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-3 mb-4 shadow-lg shadow-orange-500/30"
            >
              <Play className="fill-current" />
              RESUME
            </button>
            <button 
              onClick={returnToMenu}
              className="w-full py-4 px-8 bg-slate-700 hover:bg-slate-600 text-white rounded-2xl font-bold text-lg transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-3 shadow-lg"
            >
              QUIT TO MENU
            </button>
            <p className="mt-4 text-xs text-slate-400">{isOnline ? 'Esc to return. Your session ID stays the same.' : 'Esc to resume. R to restart.'}</p>
          </div>
        </div>
      )}

      {gameState === 'gameover' && (
        <div className="absolute inset-0 flex items-center justify-center bg-red-950/35 backdrop-blur-[2px]">
          <div role="dialog" aria-modal="true" aria-labelledby="gameover-title" className="state-panel max-h-[calc(100dvh-2rem)] overflow-y-auto text-center p-8 bg-slate-800 rounded-3xl shadow-2xl border border-slate-700 max-w-sm w-full mx-4">
            <h2 id="gameover-title" className="text-5xl font-black mb-2 text-white italic tracking-tighter">GAME OVER</h2>
            <div className="text-slate-400 mb-8 text-sm font-medium">{deathReason}</div>
            
            <div className="mb-8 p-6 bg-slate-900/50 rounded-2xl border border-slate-700">
              <div className="text-slate-500 uppercase tracking-widest text-xs font-bold mb-1">Final Score</div>
              <div className="text-5xl font-black text-orange-500">{score.toLocaleString()}</div>
            </div>

            <button 
              onClick={() => { void startGame(); }}
              disabled={Boolean(isOnline && clientRef.current?.awaitingRespawn)}
              className="group relative w-full py-4 px-8 bg-orange-500 hover:bg-orange-400 disabled:opacity-60 text-white rounded-2xl font-bold text-xl transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-3 shadow-lg shadow-orange-500/30"
            >
              <RotateCcw />
              TRY AGAIN
            </button>
            {notice && <p role="status" className="mt-3 text-xs text-amber-200">{notice}</p>}
            <button onClick={returnToMenu} className="mt-5 rounded-lg px-4 py-2 text-xs font-bold tracking-wider text-slate-300 transition-colors hover:text-white">
              BACK TO MENU
            </button>
          </div>
        </div>
      )}

      {/* HUD */}
      {(gameState === 'playing' || gameState === 'paused') && (
        <>
          <div className="absolute top-4 left-3 flex max-w-[calc(100%_-_13rem)] flex-col items-start gap-2 pointer-events-none sm:top-6 sm:left-6 sm:max-w-[50%]">
            <div className="px-3 py-2 bg-slate-800/80 backdrop-blur-md rounded-full border border-slate-700 flex items-center gap-2 shadow-xl">
              <div className="h-2 w-2 shrink-0 rounded-full bg-cyan-400 animate-pulse" />
              <span key={score} className="score-pop font-black text-lg tabular-nums sm:text-xl" title={score.toLocaleString()} aria-label={`Score: ${score}`}>
                <span className="sm:hidden">{compactScore.format(score)}</span><span className="hidden sm:inline">{score.toLocaleString()}</span>
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {status.speedSeconds > 0 && (
                <div className="flex items-center gap-1 rounded-full border border-sky-400/40 bg-sky-500/80 px-3 py-1 text-[11px] font-black tracking-wide">
                  <Zap size={12} fill="currentColor" /> SPEED {status.speedSeconds}s
                </div>
              )}
              {status.chompSeconds > 0 && (
                <div className="flex items-center gap-1 rounded-full border border-orange-300/40 bg-orange-500/80 px-3 py-1 text-[11px] font-black tracking-wide">
                  <Magnet size={12} /> CHOMP {status.chompSeconds}s
                </div>
              )}
              {status.multiplier > 1 && (
                <div className="rounded-full border border-yellow-300/40 bg-yellow-400 px-3 py-1 text-[11px] font-black tracking-wide text-slate-900">
                  {status.multiplier}x {status.multiplierSeconds}s
                </div>
              )}
              {status.combo > 2 && (
                <div className="rounded-full border border-pink-300/40 bg-pink-500/80 px-3 py-1 text-[11px] font-black tracking-wide">
                  COMBO {status.combo}
                </div>
              )}
            </div>
          </div>

          {guest && <div className="pointer-events-auto absolute bottom-24 left-3 max-w-[calc(100%-7rem)] sm:bottom-14 sm:left-6">
            <div className="flex items-center gap-1.5 text-[10px] font-bold tracking-wide text-cyan-200">
              <ShieldCheck size={13} />{isOnline ? `LIVE / ${guest.room}` : 'PRACTICE / LOCAL'}
              {isOnline && <span className="text-slate-400">{connection?.latency ?? 0} ms</span>}
            </div>
            <div className="mt-1 flex items-center gap-2 text-[10px] text-slate-400">
              <span className="select-text font-mono" title={guest.id}>ID {guest.id.slice(0, 8)}</span>
              <button onClick={() => { void copy(guest.id, 'id'); }} className="p-2 hover:text-white" aria-label="Copy temporary session ID">{copied === 'id' ? <Check size={13} /> : <Copy size={13} />}</button>
              {isOnline && <button onClick={shareRoom} className="py-2 hover:text-white">{copied === 'room' ? 'Copied' : 'Invite a friend'}</button>}
            </div>
            {notice && <p role="status" className="max-w-64 select-text break-all text-[10px] leading-relaxed text-amber-200">{notice}</p>}
          </div>}

          <div className="absolute top-4 right-3 flex w-44 flex-col items-end gap-2 sm:top-6 sm:right-6 sm:w-56">
            <div className="flex gap-2">
              {isOnline && <button onClick={returnToMenu} aria-label="Leave arena and delete session" title="Leave and delete session" className="rounded-full border border-slate-600/70 bg-slate-800/85 p-2.5 text-slate-300 hover:text-white"><LogOut size={20} /></button>}
              <button 
                onClick={togglePause}
                aria-label={gameState === 'paused' ? 'Resume game' : 'Pause game'}
                title="Pause / resume (Esc)"
                className="p-2.5 bg-slate-800/85 backdrop-blur-md text-white rounded-full border border-slate-600/70 hover:bg-slate-700 transition-colors shadow-xl"
              >
                {gameState === 'paused' ? <Play size={20} /> : <Pause size={20} />}
              </button>
              <button 
                onClick={event => { setMuted(!muted); gameAudio.unlock(); event.currentTarget.blur(); }}
                aria-label={muted ? 'Enable sound' : 'Mute sound'}
                title={muted ? 'Enable sound' : 'Mute sound'}
                className="p-2.5 bg-slate-800/85 backdrop-blur-md text-white rounded-full border border-slate-600/70 hover:bg-slate-700 transition-colors shadow-xl"
              >
                {muted ? <VolumeX size={20} /> : <Volume2 size={20} />}
              </button>
            </div>

            <section aria-label="Live arena leaderboard" className="pointer-events-none w-full overflow-hidden rounded-2xl border border-slate-600/60 bg-slate-900/78 shadow-xl backdrop-blur-md">
              <header className="flex items-center justify-between border-b border-slate-600/50 px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <Users size={14} className="text-cyan-300" />
                  <div className="leading-none">
                    <div className="text-[9px] font-extrabold tracking-[0.16em] text-slate-400">{isOnline ? guest?.room : 'PRACTICE'}</div>
                    <div className="mt-1 text-xs font-black text-white">{isOnline ? `${status.connectedCount} CONNECTED` : `${status.activeCount} ACTIVE`}</div>
                  </div>
                </div>
                <div className="text-right text-[9px] font-bold leading-4 text-slate-400">
                  <div>{status.humanCount} PLAYER</div>
                  <div>{status.botCount} BOTS</div>
                </div>
              </header>

              <div className="px-2 py-2">
                <div className="mb-1 flex items-center justify-between px-2 text-[9px] font-bold tracking-widest text-slate-500">
                  <span>PLAYERS</span>
                  <span>SCORE</span>
                </div>
                <ol className="space-y-0.5">
                  {status.leaderboard.map((entry, index) => {
                    const separatedPlayer = entry.isPlayer && index >= 5;
                    return (
                      <li
                        key={entry.id}
                        className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-[11px] ${entry.isPlayer ? 'bg-cyan-400/15 text-cyan-50' : 'text-slate-300'} ${separatedPlayer ? 'mt-2 border-t border-dashed border-slate-600 pt-2' : ''}`}
                      >
                        <span className={`w-4 text-center font-black ${entry.rank === 1 ? 'text-yellow-300' : 'text-slate-500'}`}>
                          {entry.rank === 1 ? <Crown size={13} fill="currentColor" /> : entry.rank}
                        </span>
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-white/30" style={{ backgroundColor: entry.color }} />
                        <span className="min-w-0 flex-1 truncate font-bold">{entry.name}</span>
                        {entry.isBot ? <Bot size={10} className="shrink-0 text-slate-500" /> : !entry.isPlayer && <Users size={10} className="shrink-0 text-cyan-300" />}
                        <span className="font-mono font-black tabular-nums text-white">{entry.score.toLocaleString()}</span>
                      </li>
                    );
                  })}
                </ol>
              </div>
            </section>
          </div>
          {gameState === 'playing' && (
            <div className="pointer-events-none absolute bottom-6 left-6 text-xs leading-6 text-slate-400">
              <span className="desktop-controls">Mouse / WASD to steer &middot; Space to boost &middot; Esc for {isOnline ? 'menu' : 'pause'}</span>
              <span className="mobile-controls">Drag anywhere<br />to steer your worm.</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
