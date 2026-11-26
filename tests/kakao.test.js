import { test } from 'node:test';
import assert from 'node:assert/strict';
import { searchAllPages, createFetcher } from '../src/kakao.js';
import { CATEGORIES } from '../src/categories.js';

const sdk = { location: 'LOC', sortDistance: 'DIST', Status: { OK: 'OK', ZERO_RESULT: 'ZERO', ERROR: 'ERR' } };
const korean = CATEGORIES.find(c => c.key === 'korean');
const cafe = CATEGORIES.find(c => c.key === 'cafe');
const doc = (id, cat = '음식점 > 한식 > 국수') => ({ id, place_name: 'P' + id, category_name: cat, distance: '100', phone: '', place_url: 'u' + id });

// pages: 페이지별 결과 배열. status 지정 가능.
function fakeSearch(pages, { status } = {}) {
  const calls = [];
  const fn = (query, cb, options) => {
    calls.push({ query, options });
    const i = options.page - 1;
    setTimeout(() => {
      if (status) return cb([], status, { hasNextPage: false });
      cb(pages[i] ?? [], pages[i] ? 'OK' : 'ZERO', { hasNextPage: i + 1 < pages.length });
    }, 0);
  };
  fn.calls = calls;
  return fn;
}
const page15 = (p) => Array.from({ length: 15 }, (_, i) => doc(`${p}-${i}`));

test('collects 3 pages then stops', async () => {
  const s = fakeSearch([page15(1), page15(2), page15(3), page15(4)]);
  const docs = await searchAllPages(s, korean, sdk);
  assert.equal(docs.length, 45);
  assert.equal(s.calls.length, 3);
  assert.deepEqual(s.calls[0].options, { location: 'LOC', radius: 1600, category_group_code: 'FD6', sort: 'DIST', size: 15, page: 1 });
  assert.equal(s.calls[0].query, '한식');
});
test('stops when no next page', async () => {
  const s = fakeSearch([page15(1)]);
  assert.equal((await searchAllPages(s, korean, sdk)).length, 15);
  assert.equal(s.calls.length, 1);
});
test('ZERO_RESULT on first page → empty', async () => {
  assert.deepEqual(await searchAllPages(fakeSearch([]), korean, sdk), []);
});
test('cafe uses CE7', async () => {
  const s = fakeSearch([[doc('c', '음식점 > 카페')]]);
  await searchAllPages(s, cafe, sdk);
  assert.equal(s.calls[0].options.category_group_code, 'CE7');
});
test('fetcher rejects on ERROR status', async () => {
  const f = createFetcher(fakeSearch([], { status: 'ERR' }), sdk);
  await assert.rejects(f('korean'));
});
test('caches per key', async () => {
  const s = fakeSearch([[doc('1')]]);
  const f = createFetcher(s, sdk);
  await f('korean'); await f('korean');
  assert.equal(s.calls.length, 1);
});
test('retries after failure', async () => {
  let fail = true;
  const calls = [];
  const s = (q, cb, o) => { calls.push(o); setTimeout(() => fail ? cb([], 'ERR', {}) : cb([doc('1')], 'OK', { hasNextPage: false }), 0); };
  const f = createFetcher(s, sdk);
  await assert.rejects(f('korean'));
  fail = false;
  assert.equal((await f('korean')).length, 1);
  assert.equal(calls.length, 2);
});
test('filters other categories and dedupes', async () => {
  const s = fakeSearch([[doc('1'), doc('2', '음식점 > 중식 > 중국요리'), doc('1')]]);
  const out = await createFetcher(s, sdk)('korean');
  assert.deepEqual(out.map(x => x.id), ['1']);
  assert.equal(out[0].name, 'P1');
});
