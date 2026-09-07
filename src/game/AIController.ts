import { WormState, FoodItem, GameState, AI_VISION_RANGE, AI_DANGER_RANGE, AI_BORDER_RANGE } from './types';
import { angleToCenter, distance, distanceSq } from './World';
import { findNearbyDanger, isNearBorder } from './Collision';

/**
 * AIController — AI karar motoru
 * Her AI worm için öncelik sırasına göre karar verir:
 * 1. Tehlike kaçışı (en yüksek öncelik)
 * 2. Sınır kaçışı
 * 3. Yemek takibi
 * 4. Tuzak kurma (agresif AI)
 */

export function updateAI(worm: WormState, state: GameState): void {
  if (!worm.alive || worm.config.isPlayer) return;

  // Her 3 tick'te bir karar ver (performans)
  worm.aiDecisionTimer++;
  if (worm.aiDecisionTimer < 3) return;
  worm.aiDecisionTimer = 0;

  const head = worm.segments[0];
  const allWorms = state.worms.filter(w => w.alive && w !== worm);

  // 1. Tehlike kaçışı (en yüksek öncelik)
  const danger = findNearbyDanger(worm, state.worms, AI_DANGER_RANGE);
  if (danger) {
    const dangerHead = danger.segments[0];
    // Tehlikeden kaç — ters yöne git
    const fleeAngle = Math.atan2(head.y - dangerHead.y, head.x - dangerHead.x);
    worm.targetAngle = fleeAngle;
    worm.boosting = true;
    worm.aiBehavior = 'flee';
    return;
  }

  // 2. Sınır kaçışı
  if (isNearBorder(worm, AI_BORDER_RANGE)) {
    worm.targetAngle = angleToCenter(head);
    worm.boosting = false;
    worm.aiBehavior = 'flee';
    return;
  }

  worm.boosting = false;

  // 3. Tuzak kurma (agresif AI)
  if (worm.config.behavior === 'aggressive') {
    const target = findAggressiveTarget(worm, allWorms);
    if (target) {
      // Hedefin önüne geçmeye çalış (intercept)
      const targetHead = target.segments[0];
      const interceptX = targetHead.x + Math.cos(target.angle) * 100;
      const interceptY = targetHead.y + Math.sin(target.angle) * 100;
      worm.targetAngle = Math.atan2(interceptY - head.y, interceptX - head.x);
      worm.boosting = true;
      worm.aiBehavior = 'hunt';
      return;
    }
  }

  // 4. Yemek takibi
  const nearestFood = findNearestFood(worm, state.foods);
  if (nearestFood) {
    worm.targetAngle = Math.atan2(nearestFood.y - head.y, nearestFood.x - head.x);
    worm.aiBehavior = 'food';
    return;
  }

  // 5. Rastgele dolaş (yemek yoksa)
  if (worm.config.behavior === 'random' || Math.random() < 0.1) {
    worm.targetAngle += (Math.random() - 0.5) * 0.5;
    worm.aiBehavior = 'wander';
  }
}

/** Agresif AI için hedef bul — kendinden küçük worm'lar */
function findAggressiveTarget(worm: WormState, allWorms: WormState[]): WormState | null {
  const head = worm.segments[0];
  const mySize = worm.segments.length;
  let bestTarget: WormState | null = null;
  let bestDist = Infinity;

  for (const other of allWorms) {
    // Sadece kendinden küçük veya eşit worm'ları hedefle
    if (other.segments.length > mySize * 1.2) continue;

    const otherHead = other.segments[0];
    const dist = distance(head, otherHead);

    // Görüş menzili içindeki en yakın hedef
    if (dist < AI_VISION_RANGE && dist < bestDist) {
      bestDist = dist;
      bestTarget = other;
    }
  }

  return bestTarget;
}

/** En yakın yemeği bul */
function findNearestFood(worm: WormState, foods: FoodItem[]): FoodItem | null {
  const head = worm.segments[0];
  let nearest: FoodItem | null = null;
  let nearestDistSq = AI_VISION_RANGE * AI_VISION_RANGE;

  for (const food of foods) {
    const distSq = distanceSq(head, food);
    if (distSq < nearestDistSq) {
      nearestDistSq = distSq;
      nearest = food;
    }
  }

  return nearest;
}
