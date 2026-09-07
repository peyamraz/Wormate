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

  // Her 2 tick'te bir karar ver (çok hızlı tepki)
  worm.aiDecisionTimer++;
  if (worm.aiDecisionTimer < 2) return;
  worm.aiDecisionTimer = 0;

  const head = worm.segments[0];
  const allWorms = state.worms.filter(w => w.alive && w !== worm);

  // 1. Tehlike kaçışı (en yüksek öncelik)
  const danger = findNearbyDanger(worm, state.worms, AI_DANGER_RANGE);
  if (danger) {
    const dangerHead = danger.segments[0];
    const fleeAngle = Math.atan2(head.y - dangerHead.y, head.x - dangerHead.x);
    worm.targetAngle = fleeAngle;
    worm.boosting = true;
    worm.aiBehavior = 'flee';
    return;
  }

  // 2. Sınır kaçışı
  if (isNearBorder(worm, AI_BORDER_RANGE)) {
    worm.targetAngle = angleToCenter(head);
    worm.boosting = true;
    worm.aiBehavior = 'flee';
    return;
  }

  // 3. Agresif av - büyük worm'lar küçükleri kovalasın
  if (worm.config.behavior === 'aggressive') {
    const target = findAggressiveTarget(worm, allWorms);
    if (target) {
      const targetHead = target.segments[0];
      const dist = Math.sqrt((head.x - targetHead.x) ** 2 + (head.y - targetHead.y) ** 2);
      
      // Hedefin önüne geçmeye çalış (intercept)
      const interceptX = targetHead.x + Math.cos(target.angle) * 80;
      const interceptY = targetHead.y + Math.sin(target.angle) * 80;
      worm.targetAngle = Math.atan2(interceptY - head.y, interceptX - head.x);
      worm.boosting = dist < 300;
      worm.aiBehavior = 'hunt';
      return;
    }
  }

  // 4. Yemek takibi - ana davranış
  const nearestFood = findNearestFood(worm, state.foods);
  if (nearestFood) {
    worm.targetAngle = Math.atan2(nearestFood.y - head.y, nearestFood.x - head.x);
    // Büyük yemeklere doğru hızlan
    worm.boosting = nearestFood.value > 2;
    worm.aiBehavior = 'food';
    return;
  }

  // 5. Rastgele dolaş (yemek yoksa)
  if (Math.random() < 0.3) {
    worm.targetAngle += (Math.random() - 0.5) * 1.2;
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
    // Kendinden küçük veya eşit worm'ları hedefle (daha esnek)
    if (other.segments.length > mySize * 1.5) continue;

    const otherHead = other.segments[0];
    const dist = distance(head, otherHead);

    // Çok geniş görüş menzili - Wormate.io tarzı
    if (dist < AI_VISION_RANGE * 2 && dist < bestDist) {
      bestDist = dist;
      bestTarget = other;
    }
  }

  return bestTarget;
}

/** En yakın yemeği bul - geniş menzil */
function findNearestFood(worm: WormState, foods: FoodItem[]): FoodItem | null {
  const head = worm.segments[0];
  let nearest: FoodItem | null = null;
  let nearestDistSq = (AI_VISION_RANGE * 2) * (AI_VISION_RANGE * 2); // 600px menzil

  for (const food of foods) {
    const distSq = distanceSq(head, food);
    if (distSq < nearestDistSq) {
      nearestDistSq = distSq;
      nearest = food;
    }
  }

  return nearest;
}
