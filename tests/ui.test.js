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
  assert.ok(renderList([r(), r({ id: '2' })]).includes('2곳 · 가까운 순 최대 45곳'));
});
test('escapes name', () => {
  const html = renderList([r({ name: '<b>A&B</b>' })]);
  assert.ok(html.includes('&lt;b&gt;A&amp;B&lt;/b&gt;'));
  assert.ok(!html.includes('<b>A'));
});
test('renderList shows empty message', () => {
  assert.ok(renderList([]).includes('이 종류는 주변에 등록된 식당이 없어요.'));
});
test('renderError', () => assert.ok(renderError().includes('식당 정보를 불러오지 못했어요')));
test('renderLoading', () => assert.ok(renderLoading().includes('불러오는 중')));
test('renderTabs marks active tab', () => {
  const html = renderTabs(CATEGORIES, 'chinese');
  assert.equal(html.match(/aria-selected="true"/g).length, 1);
  assert.match(html, /data-key="chinese"[^>]*aria-selected="true"/);
});
