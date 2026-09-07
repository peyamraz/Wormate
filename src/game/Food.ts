import {
  FoodItem, FOOD_RADIUS, BIG_FOOD_RADIUS,
  FOOD_VALUE_NORMAL, FOOD_VALUE_BIG, FOOD_COLORS,
  MAX_FOOD, MIN_FOOD,
} from './types';
import { randomWorldPoint } from './World';

let foodIdCounter = 0;

/** Normal yemek oluşturur */
export function createFood(): FoodItem {
  const pos = randomWorldPoint(50);
  return {
    id: `food_${++foodIdCounter}`,
    x: pos.x,
    y: pos.y,
    radius: FOOD_RADIUS,
    color: FOOD_COLORS[Math.floor(Math.random() * FOOD_COLORS.length)],
    value: FOOD_VALUE_NORMAL,
    type: 'normal',
    pulsePhase: Math.random() * Math.PI * 2,
  };
}

/** Büyük yemek oluşturur (ölen worm'dan) */
export function createBigFood(x: number, y: number): FoodItem {
  return {
    id: `food_${++foodIdCounter}`,
    x: x + (Math.random() - 0.5) * 20,
    y: y + (Math.random() - 0.5) * 20,
    radius: BIG_FOOD_RADIUS,
    color: FOOD_COLORS[Math.floor(Math.random() * FOOD_COLORS.length)],
    value: FOOD_VALUE_BIG,
    type: 'big',
    pulsePhase: Math.random() * Math.PI * 2,
  };
}

/** Ölen worm'dan yemek parçaları oluşturur */
export function createFoodFromWormDeath(drops: { x: number; y: number; value: number }[]): FoodItem[] {
  return drops.map(drop => createBigFood(drop.x, drop.y));
}

/** Yemek miktarını kontrol eder ve eksikleri tamamlar */
export function maintainFoodLevel(foods: FoodItem[]): FoodItem[] {
  const newFoods: FoodItem[] = [];
  while (foods.length + newFoods.length < MIN_FOOD) {
    newFoods.push(createFood());
  }
  return newFoods;
}

/** Yemeğin toplanıp toplanamayacağını kontrol eder */
export function canCollectFood(
  headX: number, headY: number, headRadius: number,
  food: FoodItem
): boolean {
  const dx = headX - food.x;
  const dy = headY - food.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  return dist < headRadius + food.radius;
}

/** Yemeklerin pulse animasyonunu günceller */
export function updateFoodPulse(foods: FoodItem[], time: number): void {
  for (const food of foods) {
    food.pulsePhase = time * 0.003 + parseFloat(food.id.split('_')[1]) * 0.1;
  }
}
