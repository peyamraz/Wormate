import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { GameEngine, TOTAL_GRID_CELLS } from '../src/gameEngine';
import type { Food } from '../src/gameEngine';
import { GAME_CONFIG } from '../src/constants';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function makeFood(id: number, x: number, y: number): Food {
  return {
    id, x, y, kind: 'donut', variant: 0, color: GAME_CONFIG.FOOD_COLORS[0],
    radius: 10, value: 1, phase: 0, rotation: 0, isTreasure: false, bornAt: 0,
  };
}

function gridTotal(view: GameEngine) {
  let total = 0;
  for (let i = 0; i < TOTAL_GRID_CELLS; i++) total += view.foodGrid[i].length;
  return total;
}

test('view food grid stays in sync after snapshot foods replace (receive must rebuild grid)', () => {
  const view = new GameEngine({ width: 1280, height: 720 }, false, 'view');
  assert.equal(view.foods.length, 0);

  // First snapshot: 60 foods spread across the arena, mirroring OnlineClient.receive().
  const first = Array.from({ length: 60 }, (_, i) => makeFood(1000 + i, 60 + (i * 53) % 3000, 80 + (i * 91) % 3000));
  view.foods = first;
  view.rebuildFoodGrid();
  assert.equal(gridTotal(view), first.length);
  for (const food of first) {
    assert.ok(view.foodGrid.some(cell => cell.includes(food)), `food ${food.id} must be indexed in the grid`);
  }

  // Second snapshot replaces the array: stale cells must not linger.
  const second = first.slice(0, 12);
  view.foods = second;
  view.rebuildFoodGrid();
  assert.equal(gridTotal(view), second.length);
  const everyIndexed = second.every(food => view.foodGrid.some(cell => cell.includes(food)));
  assert.equal(everyIndexed, true);
  const stale = first.slice(12).some(food => view.foodGrid.some(cell => cell.includes(food)));
  assert.equal(stale, false, 'foods removed by the snapshot must leave the grid');

  // Empty snapshot clears the grid entirely.
  view.foods = [];
  view.rebuildFoodGrid();
  assert.equal(gridTotal(view), 0);
});

test('OnlineClient.receive rebuilds the food grid right after assigning snapshot foods', () => {
  const source = readFileSync(join(root, 'src/network/OnlineClient.ts'), 'utf8');
  const assign = 'this.view.foods = snapshot.foods;';
  const rebuild = 'this.view.rebuildFoodGrid();';
  const assignAt = source.indexOf(assign);
  const rebuildAt = source.indexOf(rebuild);
  assert.ok(assignAt >= 0, 'receive() must assign snapshot foods to the view');
  assert.ok(rebuildAt > assignAt, 'receive() must call rebuildFoodGrid() after assigning snapshot foods');
  const between = source.slice(assignAt + assign.length, rebuildAt);
  assert.ok(!between.includes('this.view.bonuses'), 'grid rebuild must happen before moving on to bonuses');
});
