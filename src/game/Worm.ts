import {
  WormState, WormConfig, Segment, Point,
  WORM_BASE_SPEED, WORM_BOOST_SPEED, TURN_RATE,
  SEGMENT_DISTANCE, INITIAL_LENGTH, MAX_SEGMENTS,
  WORM_COLORS, AI_NAMES, BOOST_SEGMENT_COST,
} from './types';
import { randomWorldPoint } from './World';

let wormIdCounter = 0;

/** Yeni bir worm oluşturur (oyuncu veya AI) */
export function createWorm(config: WormConfig): WormState {
  const spawn = randomWorldPoint(300);
  const angle = Math.random() * Math.PI * 2;

  const segments: Segment[] = [];
  for (let i = 0; i < INITIAL_LENGTH; i++) {
    segments.push({
      x: spawn.x - Math.cos(angle) * i * SEGMENT_DISTANCE,
      y: spawn.y - Math.sin(angle) * i * SEGMENT_DISTANCE,
    });
  }

  return {
    config,
    segments,
    angle,
    targetAngle: angle,
    speed: WORM_BASE_SPEED,
    baseSpeed: WORM_BASE_SPEED,
    boosting: false,
    alive: true,
    score: 0,
    boostTimer: 0,
    aiDecisionTimer: 0,
    aiTarget: null,
    aiBehavior: 'wander',
  };
}

/** Oyuncu worm'u oluşturur */
export function createPlayerWorm(name: string): WormState {
  const [color, color2] = WORM_COLORS[Math.floor(Math.random() * WORM_COLORS.length)];
  return createWorm({
    id: `player_${++wormIdCounter}`,
    name: name || 'Player',
    color,
    color2,
    isPlayer: true,
    behavior: 'passive',
  });
}

/** AI worm oluşturur */
export function createAIWorm(index: number): WormState {
  const [color, color2] = WORM_COLORS[index % WORM_COLORS.length];
  const behaviors: ('passive' | 'aggressive' | 'random')[] = ['passive', 'aggressive', 'random'];
  const behavior = behaviors[Math.floor(Math.random() * behaviors.length)];

  const worm = createWorm({
    id: `ai_${++wormIdCounter}`,
    name: AI_NAMES[index % AI_NAMES.length],
    color,
    color2,
    isPlayer: false,
    behavior,
  });

  // AI'ya rastgele başlangıç boyutu ver (bazıları büyük başlasın)
  const extraSegments = Math.floor(Math.random() * 20);
  const lastSeg = worm.segments[worm.segments.length - 1];
  for (let i = 0; i < extraSegments; i++) {
    worm.segments.push({
      x: lastSeg.x - Math.cos(worm.angle) * (INITIAL_LENGTH + i) * SEGMENT_DISTANCE,
      y: lastSeg.y - Math.sin(worm.angle) * (INITIAL_LENGTH + i) * SEGMENT_DISTANCE,
    });
  }
  worm.score = extraSegments * 5;

  return worm;
}

/** Worm'u hareket ettirir — head ilerler, gövde takip eder */
export function moveWorm(worm: WormState): void {
  if (!worm.alive) return;

  // Açıyı hedefe doğru yumuşak çevir
  const angleDiff = normalizeAngle(worm.targetAngle - worm.angle);
  const turnAmount = Math.max(-TURN_RATE, Math.min(TURN_RATE, angleDiff));
  worm.angle += turnAmount;
  worm.angle = normalizeAngle(worm.angle);

  // Head'i ilerlet
  const head = worm.segments[0];
  const newHead: Segment = {
    x: head.x + Math.cos(worm.angle) * worm.speed,
    y: head.y + Math.sin(worm.angle) * worm.speed,
  };

  // Segmentleri kaydır (her segment bir öncekinin eski pozisyonuna gider)
  worm.segments.unshift(newHead);

  // Segment mesafesini koru — fazla segmentleri kaldır
  enforceSegmentDistance(worm);

  // Boost mantığı
  if (worm.boosting && worm.segments.length > INITIAL_LENGTH) {
    worm.boostTimer++;
    if (worm.boostTimer >= BOOST_SEGMENT_COST) {
      worm.boostTimer = 0;
      // Son segmenti sil (boost yakıtı)
      worm.segments.pop();
    }
  }

  // Max segment limiti
  if (worm.segments.length > MAX_SEGMENTS) {
    worm.segments.length = MAX_SEGMENTS;
  }
}

/** Segmentler arası mesafeyi zorla — eşit aralıklı hale getir */
function enforceSegmentDistance(worm: WormState): void {
  const segs = worm.segments;
  // Her segment, bir öncekinden SEGMENT_DISTANCE uzakta olmalı
  for (let i = 1; i < segs.length; i++) {
    const prev = segs[i - 1];
    const curr = segs[i];
    const dx = curr.x - prev.x;
    const dy = curr.y - prev.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > SEGMENT_DISTANCE) {
      const ratio = SEGMENT_DISTANCE / dist;
      segs[i] = {
        x: prev.x + dx * ratio,
        y: prev.y + dy * ratio,
      };
    }
  }
}

/** Worm'u büyüt — sonuna segment ekle (büyüme eğrisi ile) */
export function growWorm(worm: WormState, amount: number): void {
  const lastSeg = worm.segments[worm.segments.length - 1];
  const prevSeg = worm.segments.length > 1 ? worm.segments[worm.segments.length - 2] : lastSeg;
  const dx = lastSeg.x - prevSeg.x;
  const dy = lastSeg.y - prevSeg.y;
  const angle = Math.atan2(dy, dx);

  // Büyüme eğrisi: büyük worm'lar daha az segment kazanır
  // 0-50 segment: tam miktar
  // 50-150: %75
  // 150-300: %50
  // 300+: %25
  let effectiveAmount = amount;
  const currentLen = worm.segments.length;
  if (currentLen > 300) effectiveAmount = Math.max(1, Math.floor(amount * 0.25));
  else if (currentLen > 150) effectiveAmount = Math.max(1, Math.floor(amount * 0.5));
  else if (currentLen > 50) effectiveAmount = Math.max(1, Math.floor(amount * 0.75));

  for (let i = 0; i < effectiveAmount; i++) {
    worm.segments.push({
      x: lastSeg.x + Math.cos(angle) * (i + 1) * SEGMENT_DISTANCE,
      y: lastSeg.y + Math.sin(angle) * (i + 1) * SEGMENT_DISTANCE,
    });
  }

  // Skor her zaman tam gelir
  worm.score += amount * 5;
}

/** Worm başının yarıçapını döner (skora göre büyür) */
export function getHeadRadius(worm: WormState): number {
  return 8 + Math.min(worm.segments.length * 0.02, 8);
}

/** Worm gövde segmentinin yarıçapını döner */
export function getBodyRadius(worm: WormState): number {
  return 6 + Math.min(worm.segments.length * 0.015, 6);
}

/** Worm'u öldür — tüm segmentleri food olarak döner */
export function killWorm(worm: WormState): { x: number; y: number; value: number }[] {
  worm.alive = false;
  const foodDrops: { x: number; y: number; value: number }[] = [];

  // Her 3 segmentte bir food bırak
  for (let i = 0; i < worm.segments.length; i += 3) {
    foodDrops.push({
      x: worm.segments[i].x,
      y: worm.segments[i].y,
      value: 3, // big food
    });
  }

  return foodDrops;
}

/** Açıyı -PI ile PI arasına normalize eder */
function normalizeAngle(angle: number): number {
  while (angle > Math.PI) angle -= Math.PI * 2;
  while (angle < -Math.PI) angle += Math.PI * 2;
  return angle;
}

/** Worm hızını günceller (boost durumuna göre) */
export function updateWormSpeed(worm: WormState): void {
  if (worm.boosting && worm.segments.length > INITIAL_LENGTH) {
    worm.speed = WORM_BOOST_SPEED;
  } else {
    worm.speed = WORM_BASE_SPEED;
    worm.boosting = false;
  }
}
