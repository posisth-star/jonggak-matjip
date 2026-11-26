import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderTabs, renderList, renderLoading, renderError } from '../src/ui.js';
import { CATEGORIES } from '../src/categories.js';

const r = (o) => ({ id: '1', name: '종각국수', subCategory: '국수', distanceM: 420, walkMin: 7, phone: '02-123-4567',
  kakaoUrl: 'http://place.map.kakao.com/1', naverUrl: 'https://map.naver.com/p/search/x', ...o });

test('renderList shows card fields and both links', () => {
  const html = renderList([r()]);
  for (const s of ['종각국수', '국수', '도보 7분', '02-123-4567', '네이버에서 보기', '카카오맵에서 보기',
    'href="https://map.naver.com/p/search/x"', 'href="http://place.map.kakao.com/1"']) assert.ok(html.includes(s), s);
  assert.equal(html.match(/target="_blank" rel="noopener"/g).length, 2);
});
test('renderList omits phone when empty', () => {
  assert.ok(!renderList([r({ phone: '' })]).includes('tel:'));
});
test('renderList shows count summary', () => {
  assert.ok(renderList([r(), r({ id: '2' })]).includes('2곳 · 카카오 추천 상위 45곳'));
});
test('escapes name', () => {
  const html = renderList([r({ name: '<b>A&B</b>' })]);
  assert.ok(html.includes('&lt;b&gt;A&amp;B&lt;/b&gt;'));
  assert.ok(!html.includes('<b>A'));
});
test('renderList shows empty message', () => {
  assert.ok(renderList([]).includes('이 종류는 주변에 맛집 정보가 없어요.'));
});
test('renderError', () => {
  const html = renderError();
  assert.ok(html.includes('식당 정보를 불러오지 못했어요'));
  assert.ok(html.includes('id="retry"') && html.includes('다시 시도'));
});
test('renderLoading', () => assert.ok(renderLoading().includes('불러오는 중')));
test('renderTabs marks active tab', () => {
  const html = renderTabs(CATEGORIES, 'chinese');
  assert.equal(html.match(/aria-selected="true"/g).length, 1);
  assert.match(html, /data-key="chinese"[^>]*aria-selected="true"/);
});

test('renderList empty with walk filter suggests widening', () => {
  const html = renderList([], { maxWalk: 5 });
  assert.ok(html.includes('도보 5분 안에는 식당이 없어요'));
});
test('renderList summary mentions walk filter', () => {
  assert.ok(renderList([r()], { maxWalk: 10 }).includes('1곳 · 추천 상위 중 도보 10분 이내'));
});

test('top mode shows rank badge and summary', () => {
  const html = renderList([r({ rank: 2 })]);
  assert.ok(html.includes('추천 2위'));
  assert.ok(html.includes('1곳 · 카카오 추천 상위 45곳'));
});
test('top mode with walk filter summary', () => {
  assert.ok(renderList([r({ rank: 1 })], { maxWalk: 10 }).includes('1곳 · 추천 상위 중 도보 10분 이내'));
});
test('no rank badge without rank', () => {
  assert.ok(!renderList([r()]).includes('class="rank"'));
});
