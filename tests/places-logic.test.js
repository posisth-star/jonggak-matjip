import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toRestaurant, walkMinutes, naverSearchUrl, naverHint, matchesCategory, sortRestaurants, dedupeById } from '../src/places-logic.js';

const NAVER = 'https://map.naver.com/p/search/';
const r = (o) => ({ id: '1', name: 'A', subCategory: '', distanceM: 100, walkMin: 2, phone: '', kakaoUrl: '', naverUrl: '', ...o });

test('walkMinutes: 1000m → 16분', () => assert.equal(walkMinutes(1000), 16));
test('toRestaurant parses distance and subCategory', () => {
  const x = toRestaurant({ id: '1', place_name: 'A', category_name: '음식점 > 한식 > 국수', distance: '420', phone: '02-1', place_url: 'http://place.map.kakao.com/1' });
  assert.equal(x.distanceM, 420);
  assert.equal(x.subCategory, '국수');
  assert.equal(x.walkMin, 7);
  assert.equal(x.kakaoUrl, 'http://place.map.kakao.com/1');
  assert.equal(x.naverUrl, naverSearchUrl('A', '종각'));
  assert.equal(x.phone, '02-1');
});
test('naverSearchUrl joins name and location hint', () =>
  assert.equal(naverSearchUrl('청진옥', '종로3길'), NAVER + encodeURIComponent('청진옥 종로3길')));
test('naverHint prefers road name, then 동 name, then 종각', () => {
  assert.equal(naverHint({ road_address_name: '서울 종로구 종로3길 32', address_name: '서울 종로구 청진동 1' }), '종로3길');
  assert.equal(naverHint({ road_address_name: '', address_name: '서울 종로구 관철동 13-1' }), '관철동');
  assert.equal(naverHint({}), '종각');
});
test('toRestaurant uses road name in Naver link', () => {
  const x = toRestaurant({ id: '7', place_name: '청진옥', category_name: '음식점 > 한식 > 해장국', distance: '300', road_address_name: '서울 종로구 종로3길 32', address_name: '서울 종로구 청진동 1', place_url: 'u' });
  assert.equal(x.naverUrl, NAVER + encodeURIComponent('청진옥 종로3길'));
});
test('naverSearchUrl encodes', () => {
  const path = naverSearchUrl('A&B <#1>', '종각').slice(NAVER.length);
  for (const ch of ['&', '#', ' ', '<']) assert.ok(!path.includes(ch), ch);
});
test('matchesCategory with paths', () => {
  assert.equal(matchesCategory('음식점 > 한식 > 국수 > 칼국수', { paths: ['한식 > 국수'] }), true);
  assert.equal(matchesCategory('음식점 > 한식 > 국수', { paths: ['한식 > 국밥'] }), false);
  assert.equal(matchesCategory('음식점 > 한식', { paths: ['한식='] }), true);
  assert.equal(matchesCategory('음식점 > 한식 > 국밥', { paths: ['한식='] }), false);
  assert.equal(matchesCategory('음식점 > 분식', { paths: null }), true);
  assert.equal(matchesCategory('음식점', { paths: ['한식'] }), false);
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

import { distanceBetween } from '../src/places-logic.js';
test('distanceBetween: 위도 0.008983도 ≈ 1000m', () => {
  const d = distanceBetween({ lat: 37.5702, lng: 126.9831 }, { lat: 37.579183, lng: 126.9831 });
  assert.ok(Math.abs(d - 1000) < 5, String(d));
});
test('toRestaurant computes distance from coords when distance missing', () => {
  const x = toRestaurant({ id: '9', place_name: 'B', category_name: '음식점 > 한식', x: '126.9831', y: '37.579183', place_url: 'u' }, { lat: 37.5702, lng: 126.9831 });
  assert.ok(Math.abs(x.distanceM - 1000) < 5);
  assert.equal(x.walkMin, 16);
});

import { filterByWalk } from '../src/places-logic.js';
test('filterByWalk keeps walkMin <= max, 0 means all', () => {
  const list = [r({ id: 'a', walkMin: 3 }), r({ id: 'b', walkMin: 10 }), r({ id: 'c', walkMin: 11 })];
  assert.deepEqual(filterByWalk(list, 10).map(x => x.id), ['a', 'b']);
  assert.deepEqual(filterByWalk(list, 0).map(x => x.id), ['a', 'b', 'c']);
});

test('sort by rank, missing rank last', () => {
  const list = [r({ id: 'a', rank: 3 }), r({ id: 'b' }), r({ id: 'c', rank: 1 })];
  assert.deepEqual(sortRestaurants(list, 'rank').map(x => x.id), ['c', 'a', 'b']);
});

import { CATEGORIES as CATS } from '../src/categories.js';
test('전체 category excludes fast food, bakery/snacks and food shops', () => {
  const all = CATS.find(c => c.key === 'all');
  assert.equal(matchesCategory('음식점 > 패스트푸드 > 버거킹', all), false);
  assert.equal(matchesCategory('음식점 > 간식 > 제과,베이커리', all), false);
  assert.equal(matchesCategory('음식점 > 식품판매', all), false);
  assert.equal(matchesCategory('음식점 > 한식 > 국밥', all), true);
});

test('bars are excluded from every category (lunch only)', () => {
  for (const c of CATS) assert.equal(matchesCategory('음식점 > 술집 > 호프,요리주점', c), false, c.key);
  assert.equal(matchesCategory('음식점 > 술집 > 일본식주점', CATS.find(c => c.key === 'all')), false);
  assert.equal(matchesCategory('음식점 > 한식 > 국밥', CATS.find(c => c.key === 'all')), true);
});

test('toRestaurant keeps a short street name to tell branches apart', () => {
  const a = toRestaurant({ id: '1', place_name: '명동칼국수', category_name: '음식점 > 한식 > 국수', distance: '500', road_address_name: '서울 종로구 종로12길 15', address_name: '서울 종로구 관철동 1', place_url: 'u' });
  const b = toRestaurant({ id: '2', place_name: '명동칼국수', category_name: '음식점 > 한식 > 국수', distance: '500', road_address_name: '', address_name: '서울 중구 다동 1', place_url: 'u' });
  const c = toRestaurant({ id: '3', place_name: 'X', category_name: '음식점 > 한식', distance: '1', place_url: 'u' });
  assert.equal(a.street, '종로12길');
  assert.equal(b.street, '다동');
  assert.equal(c.street, '');
});
