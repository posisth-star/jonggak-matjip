import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CATEGORIES, CENTER, RADIUS_M, RANGES, ORIGIN_NAME, WALK_LIMIT_MIN } from '../src/categories.js';
import { walkMinutes, matchesCategory } from '../src/places-logic.js';

const cat = (k) => CATEGORIES.find(c => c.key === k);
const path = (p) => `음식점 > ${p}`;

test('tab order and labels (배달앱식 메뉴 탭)', () => {
  assert.deepEqual(CATEGORIES.map(c => c.label),
    ['추천', '국밥·탕', '한정식·찌개', '면 요리', '고기·구이', '중식', '돈까스·회·일식', '양식·피자·버거', '분식', '아시안', '샐러드·도시락']);
});
test('every tab: unique key, restaurants only, 1+ search words; 전체 has no path filter', () => {
  assert.equal(new Set(CATEGORIES.map(c => c.key)).size, CATEGORIES.length);
  for (const c of CATEGORIES) {
    assert.equal(c.groupCode, 'FD6', c.key);
    assert.ok(Array.isArray(c.queries) && c.queries.length >= 1 && c.queries.every(Boolean), c.key);
    if (c.key === 'all') assert.equal(c.paths, null);
    else assert.ok(c.paths.length >= 1, c.key);
  }
});
test('tabs match the right Kakao categories', () => {
  const yes = [
    ['meat', '한식 > 육류,고기 > 갈비'], ['soup', '한식 > 국밥'], ['soup', '한식 > 순대'], ['soup', '한식 > 해장국'],
    ['hansik', '한식 > 한정식'], ['hansik', '한식 > 찌개,전골'], ['hansik', '한식 > 해물,생선'], ['hansik', '한식'],
    ['noodle', '한식 > 국수 > 칼국수'], ['noodle', '한식 > 냉면'], ['noodle', '일식 > 일본식라면'],
    ['chinese', '중식 > 중국요리'], ['chinese', '중식 > 양꼬치'], ['japanese', '일식 > 돈까스,우동'], ['japanese', '일식 > 초밥,롤'],
    ['western', '양식 > 이탈리안'], ['western', '양식 > 햄버거'], ['snack', '분식 > 떡볶이'], ['asian', '아시아음식 > 동남아음식'],
    ['light', '샐러드'], ['light', '도시락 > 본도시락'], ['light', '패스트푸드 > 샌드위치'], ['light', '한식 > 죽'],
  ];
  for (const [k, p] of yes) assert.equal(matchesCategory(path(p), cat(k)), true, `${k} ← ${p}`);
  const no = [
    ['meat', '한식 > 국밥'], ['soup', '한식 > 육류,고기'], ['hansik', '한식 > 국밥'], ['hansik', '한식 > 육류,고기'],
    ['noodle', '일식 > 초밥,롤'], ['western', '패스트푸드 > 버거킹'], ['light', '패스트푸드 > 맥도날드'], ['chinese', '한식'],
  ];
  for (const [k, p] of no) assert.equal(matchesCategory(path(p), cat(k)), false, `${k} ✗ ${p}`);
});
test('전체 excludes fast food, snacks/bakery, food shops; every tab excludes bars', () => {
  assert.equal(matchesCategory(path('패스트푸드 > 버거킹'), cat('all')), false);
  assert.equal(matchesCategory(path('간식 > 제과,베이커리'), cat('all')), false);
  assert.equal(matchesCategory(path('한식 > 국밥'), cat('all')), true);
  for (const c of CATEGORIES) assert.equal(matchesCategory(path('술집 > 호프,요리주점'), c), false, c.key);
});
test('origin is 한국빌딩 (서울 종로구 종로 34)', () => {
  assert.ok(Math.abs(CENTER.lat - 37.5698358) < 0.0002);
  assert.ok(Math.abs(CENTER.lng - 126.9811326) < 0.0002);
  assert.match(ORIGIN_NAME, /한국빌딩/);
});
test('default range is 10 minutes; 15-minute range is also available', () => {
  assert.equal(WALK_LIMIT_MIN, 10);
  assert.equal(RANGES[10], RADIUS_M);
  assert.ok(walkMinutes(RANGES[10]) <= 10 && walkMinutes(RANGES[10] + 40) > 10);
  assert.ok(walkMinutes(RANGES[15]) <= 15 && walkMinutes(RANGES[15] + 40) > 15);
});

// ---- 직장인 점심 기준: 고급·호텔·뷔페, 참치회·횟집·일식집 제외 ----
import { isExcludedName } from '../src/places-logic.js';
test('lunch filter: buffets, family restaurants, tuna/sashimi and 일식집 are excluded from every tab', () => {
  for (const c of CATEGORIES) {
    for (const p of ['뷔페', '패밀리레스토랑 > 애슐리', '일식 > 참치회', '일식 > 일식집', '한식 > 해물,생선 > 회']) {
      assert.equal(matchesCategory(path(p), c), false, `${c.key} ✗ ${p}`);
    }
  }
  assert.equal(matchesCategory(path('한식 > 해물,생선'), cat('hansik')), true);
  assert.equal(matchesCategory(path('일식 > 초밥,롤'), cat('japanese')), true);
});
test('lunch filter: pricey names are excluded', () => {
  for (const n of ['참치공방 을지로점', '포시즌스호텔 서울 유유안', '오마카세 오사이초밥 광화문점', '울프강스테이크하우스 광화문점', '어떤 다이닝', '파파이스 광화문점'])
    assert.equal(isExcludedName(n), true, n);
  for (const n of ['진중 우육면관 본점', '스시소라 광화문점', '청진옥'])
    assert.equal(isExcludedName(n), false, n);
});
