import { Point, WORLD_SIZE, WORLD_RADIUS, WORLD_CENTER } from './types';

/**
 * World — Dünya koordinat sistemi ve sınır kontrolleri.
 * Dünya daireseldir: WORLD_CENTER etrafında WORLD_RADIUS yarıçaplı daire.
 */

/** Noktanın dünya içinde olup olmadığını kontrol eder */
export function isInsideWorld(p: Point): boolean {
  const dx = p.x - WORLD_CENTER.x;
  const dy = p.y - WORLD_CENTER.y;
  return dx * dx + dy * dy <= WORLD_RADIUS * WORLD_RADIUS;
}

/** Noktanın dünya sınırına olan mesafesini döner (negatif = dışarıda) */
export function distanceToBorder(p: Point): number {
  const dx = p.x - WORLD_CENTER.x;
  const dy = p.y - WORLD_CENTER.y;
  return WORLD_RADIUS - Math.sqrt(dx * dx + dy * dy);
}

/** Dünya içinde rastgele bir nokta üretir */
export function randomWorldPoint(margin: number = 200): Point {
  // Kutu içinde üret, daire içinde değilse tekrar dene
  for (let i = 0; i < 50; i++) {
    const x = margin + Math.random() * (WORLD_SIZE - margin * 2);
    const y = margin + Math.random() * (WORLD_SIZE - margin * 2);
    if (isInsideWorld({ x, y })) {
      return { x, y };
    }
  }
  // Fallback: merkez etrafında
  const angle = Math.random() * Math.PI * 2;
  const r = Math.random() * (WORLD_RADIUS - margin);
  return {
    x: WORLD_CENTER.x + Math.cos(angle) * r,
    y: WORLD_CENTER.y + Math.sin(angle) * r,
  };
}

/** Dünya merkezine doğru açı hesaplar */
export function angleToCenter(p: Point): number {
  return Math.atan2(WORLD_CENTER.y - p.y, WORLD_CENTER.x - p.x);
}

/** İki nokta arası mesafe */
export function distance(a: Point, b: Point): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/** İki nokta arası kare mesafe (sqrt atlamak için) */
export function distanceSq(a: Point, b: Point): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

/** Dünya boyutunu döner */
export function getWorldSize(): number {
  return WORLD_SIZE;
}

export function getWorldRadius(): number {
  return WORLD_RADIUS;
}

export function getWorldCenter(): Point {
  return { ...WORLD_CENTER };
}
