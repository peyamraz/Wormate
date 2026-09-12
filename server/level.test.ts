import { test } from 'node:test';
import assert from 'node:assert/strict';
import { levelForXp, levelProgress, xpForLevel } from '../src/level';

test('level thresholds grow triangularly', () => {
  assert.equal(xpForLevel(1), 0);
  assert.equal(xpForLevel(2), 500);
  assert.equal(xpForLevel(3), 1500);
  assert.equal(levelForXp(0), 1);
  assert.equal(levelForXp(499), 1);
  assert.equal(levelForXp(500), 2);
  assert.equal(levelForXp(5000), 5);
});

test('progress splits current level from the next threshold', () => {
  const p = levelProgress(600);
  assert.equal(p.level, 2);
  assert.equal(p.cur, 100);
  assert.equal(p.need, 1000);
  assert.ok(p.cur < p.need);
});
