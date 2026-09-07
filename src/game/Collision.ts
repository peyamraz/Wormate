import { WormState, GameState } from './types';
import { distanceToBorder, distanceSq } from './World';
import { getHeadRadius, getBodyRadius } from './Worm';

/**
 * Collision — Çarpışma tespiti
 * 1. Head-to-segment (worm'lar arası)
 * 2. Head-to-border (dünya sınırı)
 */

export interface CollisionResult {
  killed: WormState[];
  deaths: { worm: WormState; killer?: WormState }[];
}

/** Tüm çarpışmaları kontrol eder */
export function checkCollisions(state: GameState): CollisionResult {
  const result: CollisionResult = { killed: [], deaths: [] };
  const aliveWorms = state.worms.filter(w => w.alive);

  for (const worm of aliveWorms) {
    // 1. Sınır kontrolü
    const head = worm.segments[0];
    const distToBorder = distanceToBorder(head);
    if (distToBorder <= 0) {
      result.deaths.push({ worm });
      result.killed.push(worm);
      continue;
    }

    // 2. Diğer worm'ların gövdelerine çarpma
    for (const other of aliveWorms) {
      if (other === worm) continue;

      // Hızlı eleme: head'ler çok uzaksa atla
      const headDistSq = distanceSq(worm.segments[0], other.segments[0]);
      const maxCheckDist = 300;
      if (headDistSq > maxCheckDist * maxCheckDist) continue;

      // Detaylı kontrol: diğer worm'un her segmenti
      const headRadius = getHeadRadius(worm);
      const bodyRadius = getBodyRadius(other);
      const collisionDist = headRadius + bodyRadius;
      const collisionDistSq = collisionDist * collisionDist;

      // Sadece yakın segmentleri kontrol et (performans)
      const checkCount = Math.min(other.segments.length, 100);
      for (let i = 0; i < checkCount; i++) {
        const seg = other.segments[i];
        const dx = head.x - seg.x;
        const dy = head.y - seg.y;
        const distSq = dx * dx + dy * dy;

        if (distSq < collisionDistSq) {
          result.deaths.push({ worm, killer: other });
          result.killed.push(worm);
          break;
        }
      }
    }
  }

  return result;
}

/** Worm'un sınır yakınlığını kontrol eder (AI için) */
export function isNearBorder(worm: WormState, threshold: number): boolean {
  const head = worm.segments[0];
  return distanceToBorder(head) < threshold;
}

/** Yakındaki tehlikeli worm'ları bulur (AI için) */
export function findNearbyDanger(
  worm: WormState,
  allWorms: WormState[],
  range: number
): WormState | null {
  const head = worm.segments[0];
  const rangeSq = range * range;

  for (const other of allWorms) {
    if (other === worm || !other.alive) continue;
    const otherHead = other.segments[0];
    const dx = head.x - otherHead.x;
    const dy = head.y - otherHead.y;
    if (dx * dx + dy * dy < rangeSq) {
      return other;
    }
  }
  return null;
}
