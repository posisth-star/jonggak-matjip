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
  assert.ok(renderList([r(), r({ id: '2' })]).includes('2곳 · 한국빌딩에서 도보 10분 이내 · 카카오 추천순'));
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
test('renderLoading', () => assert.ok(renderLoading().includes('맛집을 찾고 있어요')));
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
  assert.ok(renderList([r()], { maxWalk: 10 }).includes('1곳 · 한국빌딩에서 도보 10분 이내 · 카카오 추천순'));
});

test('top mode shows rank badge and summary', () => {
  const html = renderList([r({ rank: 2 })]);
  assert.ok(html.includes('추천 2위'));
  assert.ok(html.includes('1곳 · 한국빌딩에서 도보 10분 이내 · 카카오 추천순'));
});
test('top mode with walk filter summary', () => {
  assert.ok(renderList([r({ rank: 1 })], { maxWalk: 10 }).includes('1곳 · 한국빌딩에서 도보 10분 이내 · 카카오 추천순'));
});
test('no rank badge without rank', () => {
  assert.ok(!renderList([r()]).includes('class="rank"'));
});

test('summary shows the selected range', () => {
  assert.ok(renderList([r()], { range: 15 }).includes('한국빌딩에서 도보 15분 이내'));
  assert.ok(renderList([r()], { range: 10, maxWalk: 5 }).includes('한국빌딩에서 도보 5분 이내'));
});

test('card shows street name when present', () => {
  assert.ok(renderList([r({ street: '종로12길' })]).includes('종로12길'));
  assert.ok(!renderList([r({ street: '' })]).includes('class="addr"'));
});

test('loading shows the character, the message and a progress bar', () => {
  const html = renderLoading(3, 9);
  assert.ok(html.includes('맛집을 찾고 있어요'));
  assert.ok(html.includes('<svg'));
  assert.ok(html.includes('role="progressbar"') && html.includes('aria-valuenow="33"'));
  assert.ok(html.includes('width:33%'));
  assert.ok(renderLoading().includes('aria-valuenow="0"'));
});

test('shuffled list says it is random picks from each menu', () => {
  const html = renderList([r()], { shuffled: true });
  assert.ok(html.includes('1곳 · 한국빌딩에서 도보 10분 이내 · 메뉴별 상위 5곳 무작위'));
  assert.ok(!html.includes('카카오 추천순'));
  // 가까운 순 등으로 다시 정렬하면 '무작위'는 빼고 '메뉴별 상위 5곳'만
  const sorted = renderList([r()], { picked: true });
  assert.ok(sorted.includes('1곳 · 한국빌딩에서 도보 10분 이내 · 메뉴별 상위 5곳</p>'));
});
