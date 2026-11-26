import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CATEGORIES, CENTER, RADIUS_M, ORIGIN_NAME, WALK_LIMIT_MIN } from '../src/categories.js';
import { walkMinutes } from '../src/places-logic.js';

test('categories have unique keys', () => {
  const keys = CATEGORIES.map(c => c.key);
  assert.equal(new Set(keys).size, keys.length);
});
test('every category has query and groupCode', () => {
  for (const c of CATEGORIES) {
    assert.ok(c.query, c.key);
    assert.equal(c.groupCode, 'FD6', c.key);
  }
});
test('all categories are restaurants (FD6); only 전체 has null match', () => {
  for (const c of CATEGORIES) {
    if (c.key === 'all') { assert.equal(c.groupCode, 'FD6'); assert.equal(c.match, null); }
    else { assert.equal(c.groupCode, 'FD6'); assert.ok(c.match); }
  }
});
test('category order matches spec', () => {
  assert.deepEqual(CATEGORIES.map(c => c.label), ['전체', '한식', '중식', '일식', '양식', '분식', '아시아음식']);
});
test('origin is 알파빌딩 (서울 종로구 종로 34)', () => {
  assert.ok(Math.abs(CENTER.lat - 37.5698358) < 0.0002);
  assert.ok(Math.abs(CENTER.lng - 126.9811326) < 0.0002);
  assert.match(ORIGIN_NAME, /알파빌딩/);
});
test('radius is the 20-minute walk boundary', () => {
  assert.equal(WALK_LIMIT_MIN, 20);
  assert.ok(walkMinutes(RADIUS_M) <= 20);
  assert.ok(walkMinutes(RADIUS_M + 40) > 20);
});
