import {
  FoodItem, FOOD_RADIUS, BIG_FOOD_RADIUS,
  FOOD_VALUE_NORMAL, FOOD_VALUE_BIG,
  MAX_FOOD, MIN_FOOD,
} from './types';
import { randomWorldPoint } from './World';

let foodIdCounter = 0;

// Tatlı temaları - her biri farklı renk kombinasyonları
const COOKIE_THEMES = [
  { color: '#D2691E', color2: '#8B4513' }, // çikolatalı kurabiye
  { color: '#F4A460', color2: '#D2691E' }, // vanilyalı kurabiye
  { color: '#DEB887', color2: '#A0522D' }, // tereyağlı kurabiye
];

const CANDY_THEMES = [
  { color: '#FF69B4', color2: '#FF1493' }, // pembe şeker
  { color: '#00CED1', color2: '#008B8B' }, // mint şeker
  { color: '#FFD700', color2: '#FFA500' }, // altın şeker
  { color: '#9370DB', color2: '#6A0DAD' }, // mor şeker
  { color: '#FF6347', color2: '#DC143C' }, // kırmızı şeker
  { color: '#32CD32', color2: '#228B22' }, // yeşil şeker
];

const DONUT_THEMES = [
  { color: '#FFB6C1', color2: '#FF69B4' }, // çilekli donut
  { color: '#8B4513', color2: '#654321' }, // çikolatalı donut
  { color: '#FFFFFF', color2: '#FFB6C1' }, // beyaz glaze
  { color: '#90EE90', color2: '#32CD32' }, // matcha donut
];

const CUPCAKE_THEMES = [
  { color: '#FFB6C1', color2: '#FF1493' }, // çilekli cupcake
  { color: '#87CEEB', color2: '#4169E1' }, // blueberry cupcake
  { color: '#DDA0DD', color2: '#9370DB' }, // mor cupcake
  { color: '#FFD700', color2: '#FF8C00' }, // karamelli cupcake
];

/** Rastgele yemek tipi seçer */
function randomFoodType(): 'cookie' | 'candy' | 'donut' | 'cupcake' {
  const types: ('cookie' | 'candy' | 'donut' | 'cupcake')[] = ['cookie', 'candy', 'donut', 'cupcake'];
  return types[Math.floor(Math.random() * types.length)];
}

/** Yemek tipine göre renk teması seçer */
function getThemeForType(type: 'cookie' | 'candy' | 'donut' | 'cupcake'): { color: string; color2: string } {
  switch (type) {
    case 'cookie':
      return COOKIE_THEMES[Math.floor(Math.random() * COOKIE_THEMES.length)];
    case 'candy':
      return CANDY_THEMES[Math.floor(Math.random() * CANDY_THEMES.length)];
    case 'donut':
      return DONUT_THEMES[Math.floor(Math.random() * DONUT_THEMES.length)];
    case 'cupcake':
      return CUPCAKE_THEMES[Math.floor(Math.random() * CUPCAKE_THEMES.length)];
  }
}

/** Normal yemek oluşturur - kurabiye/şeker/donut/cupcake */
export function createFood(): FoodItem {
  const pos = randomWorldPoint(50);
  const type = randomFoodType();
  const theme = getThemeForType(type);
  
  return {
    id: `food_${++foodIdCounter}`,
    x: pos.x,
    y: pos.y,
    radius: FOOD_RADIUS,
    color: theme.color,
    color2: theme.color2,
    value: FOOD_VALUE_NORMAL,
    type,
    pulsePhase: Math.random() * Math.PI * 2,
    rotation: Math.random() * Math.PI * 2,
    rotationSpeed: (Math.random() - 0.5) * 0.02,
  };
}

/** Büyük yemek oluşturur (ölen worm'dan) */
export function createBigFood(x: number, y: number): FoodItem {
  const type = randomFoodType();
  const theme = getThemeForType(type);
  
  return {
    id: `food_${++foodIdCounter}`,
    x: x + (Math.random() - 0.5) * 20,
    y: y + (Math.random() - 0.5) * 20,
    radius: BIG_FOOD_RADIUS,
    color: theme.color,
    color2: theme.color2,
    value: FOOD_VALUE_BIG,
    type: 'big',
    pulsePhase: Math.random() * Math.PI * 2,
    rotation: Math.random() * Math.PI * 2,
    rotationSpeed: (Math.random() - 0.5) * 0.01,
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

/** Yemeklerin animasyonlarını günceller */
export function updateFoodAnimation(foods: FoodItem[], time: number): void {
  for (const food of foods) {
    food.pulsePhase = time * 0.003 + parseFloat(food.id.split('_')[1]) * 0.1;
    food.rotation += food.rotationSpeed;
  }
}
