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
import { SkinPreview } from './SkinPreview';
import { t } from './i18n';
import {
  SHOP_GLASSES, SHOP_HATS, SHOP_SKINS,
  buyGlasses, buyHat, buySkin, earnCoins, equip, readCoins, readLoadout, readOwned,
  skinName, hatName, glassesName,
} from './shop';
import type { GlassesId, HatId, Loadout, Owned, SkinCategory } from './shop';
import { Trophy, Play, Pause, RotateCcw, Volume2, VolumeX, Zap, Magnet, Crown, Globe, ShieldCheck, Copy, Check, LoaderCircle, LogOut, ChevronDown, ChevronUp, Bot, Coins, ShoppingBag, User, LogIn, Palette, Glasses, X } from 'lucide-react';

const EMPTY_STATUS: PlayerStatus = {
  score: 0,
  size: 0,
  sizeRank: 0,
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

function deathText(reason: string): string {
  if (reason === 'You bumped into another worm.') return t.deathBump;
  if (reason === 'You reached the edge of the arena.') return t.deathEdge;
  return reason;
}

// Skorlar bilinçli olarak SADECE oturumluk tutulur: sekmeye her gelişte boş başlar.
// Kalıcı olan tek şey mağaza cüzdanıdır (wormate_coins). Eski localStorage anahtarı bir kez temizlenir.
function readHighScores(): number[] {
  try { localStorage.removeItem('wormate_highscores'); } catch { /* yoksay */ }
  return [];
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
  const [coins, setCoins] = useState(readCoins);
  const [owned, setOwned] = useState<Owned>(readOwned);
  const [loadout, setLoadout] = useState<Loadout>(readLoadout);
  const [shopTab, setShopTab] = useState<'skin' | 'hat' | 'glasses'>('skin');
  const [shopOpen, setShopOpen] = useState(false);
  const [shopCat, setShopCat] = useState<'all' | SkinCategory>('all');
  const visibleSkins = shopCat === 'all' ? SHOP_SKINS : SHOP_SKINS.filter(s => s.category === shopCat);
  const [menuTab, setMenuTab] = useState<'shop' | 'account'>('shop');
  const clientRef = useRef<OnlineClient | null>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isOnline = guest?.mode === 'online';

  const handleGameOver = useCallback((finalScore: number, reason: string) => {
    setScore(finalScore);
    setDeathReason(reason);
    setHighScores(previous => [...previous, finalScore].sort((a, b) => b - a).slice(0, 5));
    setCoins(earnCoins(finalScore));
    setGameState('gameover');
  }, []);

  const startGame = useCallback(async () => {
    if (gameState === 'connecting') return;
    gameAudio.unlock();
    releaseButtonFocus();
    const client = clientRef.current;
    if (client?.ready && getSession()?.mode === 'online') {
      if (client.restart()) setNotice(t.waitingRespawn);
      return;
    }
    const name = nickname.normalize('NFKC').trim();
    if (!validName(name)) { setNotice(t.noticeName); return; }
    setNotice('');
    if (mode === 'online') {
      if (!validRoom(room)) { setNotice(t.noticeRoom); return; }
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
          setNotice(error instanceof Error ? error.message : t.srvUnreachable);
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
    } catch { setNotice(t.copyManual.replace('{v}', value)); }
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
  const sizeBest = status.leaderboard.reduce((m, e) => Math.max(m, e.size), 0);
  const sizeLeader = status.leaderboard.find(e => e.size === sizeBest && sizeBest > 0);

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
          <div className="w-full max-w-md max-h-[92dvh] overflow-y-auto bg-slate-900/90 border border-slate-800 p-8 rounded-3xl shadow-2xl flex flex-col items-center text-center">
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
                  {t.nickname}
                </label>
                <input
                  type="text"
                  maxLength={16}
                  value={nickname}
                  onChange={e => setNickname(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white font-bold focus:outline-none focus:border-orange-500 transition-colors"
                  placeholder={t.nicknamePh}
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
                  <Globe size={16} /> {t.liveArena}
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
                  <Bot size={16} /> {t.practice}
                </button>
              </div>
            </div>

            {/* Mağaza / Oturum paneli */}
            <div className="w-full mb-6 overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/70">
              <div className="flex items-center gap-1.5 border-b border-slate-800/80 bg-slate-900/60 p-2">
                <button
                  type="button"
                  onClick={() => setMenuTab('shop')}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl border py-2 text-xs font-black uppercase tracking-wider transition-all ${menuTab === 'shop' ? 'border-orange-500/60 bg-orange-500/20 text-orange-300 shadow-lg shadow-orange-500/10' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
                >
                  <ShoppingBag size={14} /> {t.shop}
                </button>
                <button
                  type="button"
                  onClick={() => setMenuTab('account')}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl border py-2 text-xs font-black uppercase tracking-wider transition-all ${menuTab === 'account' ? 'border-cyan-500/60 bg-cyan-500/20 text-cyan-300 shadow-lg shadow-cyan-500/10' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
                >
                  <LogIn size={14} /> {t.account}
                </button>
                <span className="flex shrink-0 items-center gap-1 rounded-full bg-yellow-400/15 border border-yellow-400/30 px-2.5 py-1 text-xs font-black text-yellow-300">
                  <Coins size={12} /> {coins.toLocaleString()}
                </span>
              </div>
              <div className="p-4">
              {menuTab === 'shop' ? (
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={() => { setShopTab('skin'); setShopOpen(true); }}
                  className="flex flex-col items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900 p-3 transition-all hover:border-cyan-500/50 active:scale-95"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-cyan-500/15 text-cyan-300"><Palette size={18} /></span>
                  <span className="text-[11px] font-black text-slate-200">{t.skinTab}</span>
                  <span className="text-[10px] font-bold text-slate-500 tabular-nums">{owned.skins.length}/{SHOP_SKINS.length}</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setShopTab('hat'); setShopOpen(true); }}
                  className="flex flex-col items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900 p-3 transition-all hover:border-amber-500/50 active:scale-95"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-500/15 text-amber-300"><Crown size={18} /></span>
                  <span className="text-[11px] font-black text-slate-200">{t.hatTab}</span>
                  <span className="text-[10px] font-bold text-slate-500 tabular-nums">{owned.hats.length}/{SHOP_HATS.length}</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setShopTab('glasses'); setShopOpen(true); }}
                  className="flex flex-col items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900 p-3 transition-all hover:border-violet-500/50 active:scale-95"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-violet-500/15 text-violet-300"><Glasses size={18} /></span>
                  <span className="text-[11px] font-black text-slate-200">{t.glassesTab}</span>
                  <span className="text-[10px] font-bold text-slate-500 tabular-nums">{owned.glasses.length}/{SHOP_GLASSES.length}</span>
                </button>
              </div>
              ) : (
              <div className="space-y-2">
                <button
                  type="button"
                  className="flex w-full items-center gap-3 rounded-xl border border-cyan-400/50 bg-cyan-500/10 p-3 text-left transition-all hover:bg-cyan-500/15"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-500/20 text-cyan-300">
                    <User size={20} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-black text-white">{t.guest}</span>
                    <span className="block truncate text-[11px] font-medium text-slate-400">
                      {nickname ? t.guestWithName.replace('{n}', nickname) : t.guestPlain} · {t.sessionNote}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1 rounded-full bg-cyan-500/20 border border-cyan-400/40 px-2.5 py-1 text-[10px] font-black text-cyan-300">
                    <Check size={11} /> {t.active}
                  </span>
                </button>
                <button
                  type="button"
                  disabled
                  title={t.googleSoon}
                  className="flex w-full cursor-not-allowed items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/70 p-3 text-left opacity-70"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white">
                    <svg viewBox="0 0 24 24" width={20} height={20} aria-hidden="true">
                      <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z" />
                      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z" />
                      <path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z" />
                      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75z" />
                    </svg>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-black text-slate-300">Google</span>
                    <span className="block truncate text-[11px] font-medium text-slate-500">{t.googleDesc}</span>
                  </span>
                  <span className="shrink-0 rounded-full bg-amber-400/15 border border-amber-400/40 px-2.5 py-1 text-[10px] font-black text-amber-300">
                    {t.googleSoon}
                  </span>
                </button>
                <p className="pt-1 text-center text-[10px] font-medium text-slate-500">{t.googleNote}</p>
              </div>
              )}
              </div>
            </div>

            {/* Öne çıkan mağaza sayfası: kategoriler veri güdümlü, ekleme tek yerden */}
            {shopOpen && (
              <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm" onClick={() => setShopOpen(false)}>
                <div className="flex max-h-[88dvh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-slate-700 bg-slate-900 shadow-2xl" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center gap-2 border-b border-slate-800 bg-slate-950/60 p-3">
                    <ShoppingBag size={16} className="text-orange-400" />
                    <span className="text-sm font-black uppercase tracking-wider text-white">{t.shop}</span>
                    <span className="flex items-center gap-1 rounded-full bg-yellow-400/15 border border-yellow-400/30 px-2.5 py-1 text-xs font-black text-yellow-300">
                      <Coins size={12} /> {coins.toLocaleString()}
                    </span>
                    <button type="button" onClick={() => setShopOpen(false)} aria-label={t.cancel} className="ml-auto rounded-lg border border-slate-700 p-1.5 text-slate-300 hover:text-white">
                      <X size={16} />
                    </button>
                  </div>
                  <div className="flex gap-1.5 p-3 pb-0">
                    {([
                      { id: 'skin', title: t.skinTab, count: `${owned.skins.length}/${SHOP_SKINS.length}`, on: 'border-cyan-500/60 bg-cyan-500/20 text-cyan-300' },
                      { id: 'hat', title: t.hatTab, count: `${owned.hats.length}/${SHOP_HATS.length}`, on: 'border-amber-500/60 bg-amber-500/20 text-amber-300' },
                      { id: 'glasses', title: t.glassesTab, count: `${owned.glasses.length}/${SHOP_GLASSES.length}`, on: 'border-violet-500/60 bg-violet-500/20 text-violet-300' },
                    ] as const).map(p => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setShopTab(p.id)}
                        className={`flex-1 rounded-lg border py-1.5 text-xs font-black uppercase tracking-wider transition-all ${shopTab === p.id ? p.on : 'border-transparent text-slate-400 hover:text-slate-200'}`}
                      >
                        {p.title} · {p.count}
                      </button>
                    ))}
                  </div>
                  <div className="overflow-y-auto p-3">
                    {shopTab === 'skin' && (
                      <div className="mb-2 flex gap-1 overflow-x-auto pb-0.5">
                        {([
                          { id: 'all', title: t.catAll },
                          { id: 'basit', title: t.catBasit },
                          { id: 'cizgili', title: t.catCizgili },
                          { id: 'desenli', title: t.catDesenli },
                          { id: 'bayraklar', title: t.catBayraklar },
                        ] as const).map(c => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => setShopCat(c.id)}
                            className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-black transition-all ${shopCat === c.id ? 'border-orange-500/60 bg-orange-500/20 text-orange-300' : 'border-slate-700 text-slate-400'}`}
                          >
                            {c.title}
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
                      {shopTab === 'skin' && visibleSkins.map(item => {
                        const has = owned.skins.includes(item.id);
                        const worn = loadout.skin === item.id;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => {
                              if (has) { setLoadout(equip('skin', item.id)); return; }
                              const r = buySkin(item.id);
                              setCoins(r.coins); setOwned(r.owned);
                              if (r.ok) setLoadout(equip('skin', item.id));
                            }}
                            className={`rounded-xl border p-2 text-left transition-all ${worn ? 'border-cyan-400 bg-cyan-500/15' : 'border-slate-800 bg-slate-950 hover:border-slate-600'}`}
                          >
                            <SkinPreview color={item.color} pattern={item.pattern} />
                            <span className="block truncate text-center text-[10px] font-bold text-slate-200">{skinName(item)}</span>
                            <span className={`block text-center text-[10px] font-black ${worn ? 'text-cyan-300' : has ? 'text-slate-400' : coins >= item.price ? 'text-yellow-300' : 'text-slate-500'}`}>
                              {worn ? t.equipped : has ? t.equip : `🪙 ${item.price}`}
                            </span>
                          </button>
                        );
                      })}
                      {shopTab === 'hat' && SHOP_HATS.map(item => {
                        const has = (owned.hats as string[]).includes(item.id);
                        const worn = loadout.hat === item.id;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => {
                              if (has) { setLoadout(equip('hat', item.id)); return; }
                              const r = buyHat(item.id as HatId);
                              setCoins(r.coins); setOwned(r.owned);
                              if (r.ok) setLoadout(equip('hat', item.id));
                            }}
                            className={`rounded-xl border p-2 text-left transition-all ${worn ? 'border-cyan-400 bg-cyan-500/15' : 'border-slate-800 bg-slate-950 hover:border-slate-600'}`}
                          >
                            <span className="block truncate text-center text-[10px] font-bold text-slate-200">{hatName(item.id)}</span>
                            <span className={`block text-center text-[10px] font-black ${worn ? 'text-cyan-300' : has ? 'text-slate-400' : coins >= item.price ? 'text-yellow-300' : 'text-slate-500'}`}>
                              {worn ? t.equipped : has ? t.equip : `🪙 ${item.price}`}
                            </span>
                          </button>
                        );
                      })}
                      {shopTab === 'glasses' && SHOP_GLASSES.map(item => {
                        const has = (owned.glasses as string[]).includes(item.id);
                        const worn = loadout.glasses === item.id;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => {
                              if (has) { setLoadout(equip('glasses', item.id)); return; }
                              const r = buyGlasses(item.id as GlassesId);
                              setCoins(r.coins); setOwned(r.owned);
                              if (r.ok) setLoadout(equip('glasses', item.id));
                            }}
                            className={`rounded-xl border p-2 text-left transition-all ${worn ? 'border-cyan-400 bg-cyan-500/15' : 'border-slate-800 bg-slate-950 hover:border-slate-600'}`}
                          >
                            <span className="block truncate text-center text-[10px] font-bold text-slate-200">{glassesName(item.id)}</span>
                            <span className={`block text-center text-[10px] font-black ${worn ? 'text-cyan-300' : has ? 'text-slate-400' : coins >= item.price ? 'text-yellow-300' : 'text-slate-500'}`}>
                              {worn ? t.equipped : has ? t.equip : `🪙 ${item.price}`}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    <p className="mt-2 text-center text-[10px] text-slate-500 font-medium">{t.goldNote}</p>
                  </div>
                </div>
              </div>
            )}

            {notice && (
              <div role="alert" className="w-full mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs font-medium">
                {notice}
              </div>
            )}

            <button
              onClick={() => { void startGame(); }}
              className="w-full py-4 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-white rounded-2xl font-black text-xl tracking-wider uppercase shadow-lg shadow-orange-500/25 transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-3"
            >
              <Play fill="currentColor" size={20} /> {t.playNow}
            </button>

            {highScores.length > 0 && (
              <div className="mt-6 w-full pt-6 border-t border-slate-800/80">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-400 mb-3">
                    <span className="flex items-center gap-1.5"><Trophy size={14} className="text-yellow-400" /> {t.sessionScores}</span>
                    <span>{t.thisVisit}</span>
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
            <div className="text-lg font-bold text-white">{t.connecting}</div>
            <p className="text-xs text-slate-400">{t.joiningRoom.replace('{r}', room)}</p>
            <button
              onClick={returnToMenu}
              className="mt-2 text-xs font-bold text-slate-400 hover:text-white px-4 py-2 rounded-lg border border-slate-800 hover:bg-slate-800 transition-colors"
            >
              {t.cancel}
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
            <h2 className="text-2xl font-black text-white mb-1">{t.gameOver}</h2>
            <p className="text-xs text-slate-400 mb-6 font-medium">{deathReason ? deathText(deathReason) : t.betterLuck}</p>

            <div className="w-full mb-6 p-4 bg-slate-950/80 rounded-2xl border border-slate-800">
              <div className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500 mb-1">{t.finalScore}</div>
              <div className="text-3xl font-black text-orange-400">{score.toLocaleString()}</div>
            </div>

            <button 
              onClick={() => { void startGame(); }}
              disabled={Boolean(isOnline && clientRef.current?.awaitingRespawn)}
              className="w-full py-4 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 disabled:opacity-50 text-white rounded-2xl font-black text-lg tracking-wider transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 shadow-lg shadow-orange-500/25"
            >
              <RotateCcw size={18} /> {t.playAgain}
            </button>
            {notice && <p role="status" className="mt-3 text-xs text-amber-200">{notice}</p>}
            <button onClick={returnToMenu} className="mt-4 text-xs font-bold tracking-wider text-slate-400 hover:text-white transition-colors py-1">
              {t.backToMenu}
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
              <span key={score} className="score-pop font-mono text-base font-black tabular-nums text-white sm:text-lg" title={score.toLocaleString()} aria-label={`${t.scoreTag}: ${score}`}>
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
                <div className={`rounded-full border border-yellow-300/40 bg-yellow-400/90 px-2.5 py-0.5 text-[10px] font-black tracking-wide text-slate-950 backdrop-blur-xs ${status.multiplierSeconds <= 3 ? 'animate-pulse' : ''}`}>
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
                <span>{isOnline ? guest.room : t.practice.toUpperCase()}</span>
                {isOnline && <span className="text-slate-400 font-mono font-normal">({connection?.latency ?? 0}ms)</span>}
                <button onClick={() => { void copy(guest.id, 'id'); }} className="ml-1 p-0.5 hover:text-white" aria-label="Copy temporary session ID">{copied === 'id' ? <Check size={11} /> : <Copy size={11} />}</button>
                {isOnline && <button onClick={shareRoom} className="hover:text-white underline">{copied === 'room' ? t.copied : t.invite}</button>}
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
                  aria-label={t.leaveArena}
                  title={t.leaveArena}
                  className="rounded-full border border-white/10 bg-slate-950/40 p-1.5 text-slate-300 shadow-md backdrop-blur-md transition-all hover:bg-red-500/20 hover:text-red-300 active:scale-95 sm:p-2"
                >
                  <LogOut size={14} className="sm:size-4" />
                </button>
              )}
              <button 
                onClick={togglePause}
                aria-label={gameState === 'paused' ? t.resume : t.pause}
                title={`${t.pause} (Esc)`}
                className="rounded-full border border-white/10 bg-slate-950/40 p-1.5 text-white shadow-md backdrop-blur-md transition-all hover:bg-slate-800/60 active:scale-95 sm:p-2"
              >
                {gameState === 'paused' ? <Play size={14} className="sm:size-4" /> : <Pause size={14} className="sm:size-4" />}
              </button>
              <button 
                onClick={event => { setMuted(!muted); gameAudio.unlock(); event.currentTarget.blur(); }}
                aria-label={muted ? t.unmute : t.mute}
                title={muted ? t.unmute : t.mute}
                className="rounded-full border border-white/10 bg-slate-950/40 p-1.5 text-white shadow-md backdrop-blur-md transition-all hover:bg-slate-800/60 active:scale-95 sm:p-2"
              >
                {muted ? <VolumeX size={14} className="sm:size-4" /> : <Volume2 size={14} className="sm:size-4" />}
              </button>
              {/* Collapse/Expand Toggle Button */}
              <button
                onClick={() => setCollapsedLeaderboard(!collapsedLeaderboard)}
                aria-label={collapsedLeaderboard ? t.expandLb : t.collapseLb}
                title={collapsedLeaderboard ? t.expandLb : t.collapseLb}
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
                  <span className="truncate max-w-[4rem]">{topLeader?.name === 'YOU' ? t.you : (topLeader?.name ?? t.leader)}</span>
                </div>
                {userRankEntry && (
                  <div className="font-mono font-black text-cyan-300">
                    #{userRankEntry.rank}
                  </div>
                )}
              </div>
            ) : (
              // Full Modern Sleek Leaderboard
              <section aria-label="Leaderboard" className="pointer-events-none w-full overflow-hidden rounded-xl border border-white/10 bg-slate-950/35 shadow-xl backdrop-blur-md transition-all">
                {/* Header info */}
                <header className="flex items-center justify-between border-b border-white/10 px-2 py-1.5 sm:px-3 sm:py-2">
                  <div className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-[9px] font-black tracking-wider text-slate-300 uppercase sm:text-[10px]">
                      {isOnline ? guest?.room : t.solo}
                    </span>
                  </div>
                  <div className="text-[8px] font-bold text-slate-400 sm:text-[9px]">
                    {isOnline ? `${status.connectedCount} ${t.live}` : `${status.activeCount} ${t.bots}`}
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
                      const isBiggest = entry.size === sizeBest && sizeBest > 0;

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
                            {entry.name === 'YOU' ? t.you : entry.name}
                            {isBiggest && <span title={t.sizeLeader}> 🐉</span>}
                          </span>

                          {/* Size */}
                          <span className="font-mono tabular-nums text-slate-400 shrink-0" title={`${t.sizeTag}: ${entry.size}`}>
                            {entry.size}
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
                  {sizeLeader && topLeader && sizeLeader.id !== topLeader.id && (
                    <div className="mt-1 rounded-lg border border-emerald-400/20 bg-emerald-500/10 px-2 py-1 text-[9px] font-bold text-emerald-200 sm:text-[10px]">
                      🐉 {t.sizeLeader} <span className="truncate">{sizeLeader.name === 'YOU' ? t.you : sizeLeader.name}</span> ({sizeLeader.size})
                    </div>
                  )}
                  {userRankEntry && (
                    <div className="mt-1 px-1 text-[8px] font-bold text-slate-400 sm:text-[9px]">
                      {t.scoreTag} #{userRankEntry.rank} &middot; {t.sizeTag} #{status.sizeRank} ({status.size})
                    </div>
                  )}
                </div>
              </section>
            )}
          </div>

          {gameState === 'playing' && (
            <div className="pointer-events-none absolute bottom-5 left-5 text-[10px] text-slate-500">
              <span className="desktop-controls">{t.controlsHint}</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
