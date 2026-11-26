import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toRestaurant, walkMinutes, naverSearchUrl, matchesCategory, sortRestaurants, dedupeById } from '../src/places-logic.js';

const NAVER = 'https://map.naver.com/p/search/';
const r = (o) => ({ id: '1', name: 'A', subCategory: '', distanceM: 100, walkMin: 2, phone: '', kakaoUrl: '', naverUrl: '', ...o });

test('walkMinutes: 1000m → 16분', () => assert.equal(walkMinutes(1000), 16));
test('toRestaurant parses distance and subCategory', () => {
  const x = toRestaurant({ id: '1', place_name: 'A', category_name: '음식점 > 한식 > 국수', distance: '420', phone: '02-1', place_url: 'http://place.map.kakao.com/1' });
  assert.equal(x.distanceM, 420);
  assert.equal(x.subCategory, '국수');
  assert.equal(x.walkMin, 7);
  assert.equal(x.kakaoUrl, 'http://place.map.kakao.com/1');
  assert.equal(x.naverUrl, naverSearchUrl('A'));
  assert.equal(x.phone, '02-1');
});
test('naverSearchUrl appends 종각', () =>
  assert.equal(naverSearchUrl('김밥천국'), NAVER + encodeURIComponent('김밥천국 종각')));
test('naverSearchUrl encodes', () => {
  const path = naverSearchUrl('A&B <#1>').slice(NAVER.length);
  for (const ch of ['&', '#', ' ', '<']) assert.ok(!path.includes(ch), ch);
});
test('matchesCategory', () => {
  assert.equal(matchesCategory('음식점 > 한식 > 국수', { match: '한식' }), true);
  assert.equal(matchesCategory('음식점 > 중식 > 중국요리', { match: '한식' }), false);
  assert.equal(matchesCategory('음식점 > 카페', { match: null }), true);
  assert.equal(matchesCategory('음식점', { match: '한식' }), false);
});
test('sort distance and name', () => {
  const list = [r({ id: 'a', name: '다', distanceM: 300 }), r({ id: 'b', name: '가', distanceM: 500 }), r({ id: 'c', name: '나', distanceM: 100 })];
  assert.deepEqual(sortRestaurants(list, 'distance').map(x => x.id), ['c', 'a', 'b']);
  assert.deepEqual(sortRestaurants(list, 'name').map(x => x.id), ['b', 'c', 'a']);
  assert.deepEqual(list.map(x => x.id), ['a', 'b', 'c']);
});
test('dedupeById keeps first', () => {
  const out = dedupeById([r({ id: 'x', name: '첫' }), r({ id: 'x', name: '둘' }), r({ id: 'y' })]);
  assert.deepEqual(out.map(x => x.name), ['첫', 'A']);
});
