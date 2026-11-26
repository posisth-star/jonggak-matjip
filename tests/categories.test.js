import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CATEGORIES, CENTER, RADIUS_M } from '../src/categories.js';

test('categories have unique keys', () => {
  const keys = CATEGORIES.map(c => c.key);
  assert.equal(new Set(keys).size, keys.length);
});
test('every category has query and groupCode', () => {
  for (const c of CATEGORIES) {
    assert.ok(c.query, c.key);
    assert.ok(['FD6', 'CE7'].includes(c.groupCode), c.key);
  }
});
test('only cafe uses CE7 with null match', () => {
  for (const c of CATEGORIES) {
    if (c.key === 'cafe') { assert.equal(c.groupCode, 'CE7'); assert.equal(c.match, null); }
    else { assert.equal(c.groupCode, 'FD6'); assert.ok(c.match); }
  }
});
test('category order matches spec', () => {
  assert.deepEqual(CATEGORIES.map(c => c.label), ['한식', '중식', '일식', '양식', '분식', '아시아음식', '카페']);
});
test('center and radius match spec', () => {
  assert.equal(RADIUS_M, 1600);
  assert.ok(Math.abs(CENTER.lat - 37.5702) < 0.002);
  assert.ok(Math.abs(CENTER.lng - 126.9831) < 0.002);
});
