import { test } from 'node:test';
import assert from 'node:assert/strict';
import { searchTop, createFetcher } from '../src/kakao.js';
import { CATEGORIES, CENTER, RADIUS_M } from '../src/categories.js';

const sdk = { toBounds: (r) => r, sortAccuracy: 'ACC', Status: { OK: 'OK', ZERO_RESULT: 'ZERO', ERROR: 'ERR' } };
const korean = CATEGORIES.find(c => c.key === 'korean');
const cafe = CATEGORIES.find(c => c.key === 'cafe');
const doc = (id, distance = 100, cat = '음식점 > 한식 > 국수') =>
  ({ id: String(id), place_name: 'P' + id, category_name: cat, distance: String(distance), phone: '', place_url: 'u' + id, x: String(CENTER.lng), y: String(CENTER.lat) });

// 카카오처럼 순서대로 최대 45건을 15건씩 돌려주는 가짜 keywordSearch
function fakeRanked(docs, { status } = {}) {
  const calls = [];
  const fn = (q, cb, o) => {
    calls.push({ q, o });
    setTimeout(() => {
      if (status) return cb([], status, {});
      const visible = docs.slice(0, 45), page = visible.slice((o.page - 1) * 15, o.page * 15);
      if (!page.length) return cb([], 'ZERO', { totalCount: 0, hasNextPage: false });
      cb(page, 'OK', { totalCount: visible.length, hasNextPage: o.page * 15 < visible.length });
    }, 0);
  };
  fn.calls = calls;
  return fn;
}
const ranked = (n) => Array.from({ length: n }, (_, i) => doc('r' + i, 10 * i));

test('searchTop asks accuracy order within square bounds (no center) and keeps order over 3 pages', async () => {
  const s = fakeRanked(ranked(60));
  const docs = await searchTop(s, korean, sdk);
  assert.equal(docs.length, 45);
  assert.equal(s.calls.length, 3);
  const o = s.calls[0].o;
  assert.equal(o.location, undefined); // 중심점을 주면 카카오가 가까운 곳을 우대하므로 주지 않는다
  assert.equal(o.radius, undefined);
  assert.deepEqual({ ...o, bounds: undefined }, { bounds: undefined, category_group_code: 'FD6', sort: 'ACC', size: 15, page: 1 });
  const M = 111320, dLng = RADIUS_M / (M * Math.cos(CENTER.lat * Math.PI / 180));
  assert.ok(Math.abs(o.bounds.sw.lat - (CENTER.lat - RADIUS_M / M)) < 1e-6);
  assert.ok(Math.abs(o.bounds.ne.lng - (CENTER.lng + dLng)) < 1e-6);
  assert.equal(s.calls[0].q, '한식');
  assert.equal(docs[44].id, 'r44');
});
test('stops when no next page', async () => {
  const s = fakeRanked(ranked(10));
  assert.equal((await searchTop(s, korean, sdk)).length, 10);
  assert.equal(s.calls.length, 1);
});
test('ZERO_RESULT → empty', async () => {
  assert.deepEqual(await searchTop(fakeRanked([]), korean, sdk), []);
});
test('cafe uses CE7', async () => {
  const s = fakeRanked([doc('c', 10, '음식점 > 카페')]);
  await searchTop(s, cafe, sdk);
  assert.equal(s.calls[0].o.category_group_code, 'CE7');
});
test('fetcher adds rank in Kakao order, drops other categories and outside radius', async () => {
  const docs = [doc('a', 100), doc('x', 50, '음식점 > 중식 > 중국요리'), doc('b', 1700), doc('c', 900), doc('a', 100)];
  const out = await createFetcher(fakeRanked(docs), sdk)('korean');
  assert.deepEqual(out.map(x => [x.id, x.rank]), [['a', 1], ['c', 2]]);
});
test('fetcher rejects on ERROR status', async () => {
  await assert.rejects(createFetcher(fakeRanked([], { status: 'ERR' }), sdk)('korean'));
});
test('caches per key', async () => {
  const s = fakeRanked(ranked(5));
  const f = createFetcher(s, sdk);
  await f('korean'); await f('korean');
  assert.equal(s.calls.length, 1);
});
test('retries after failure', async () => {
  let fail = true;
  const ok = fakeRanked(ranked(5));
  const s = (q, cb, o) => (fail ? setTimeout(() => cb([], 'ERR', {}), 0) : ok(q, cb, o));
  const f = createFetcher(s, sdk);
  await assert.rejects(f('korean'));
  fail = false;
  assert.equal((await f('korean')).length, 5);
});
test('times out when callback never comes', async () => {
  await assert.rejects(searchTop(() => {}, korean, sdk, 20), /시간 초과/);
});
test('rejects when keywordSearch throws on a later page', async () => {
  let n = 0;
  const s = (q, cb) => { if (++n === 2) throw new Error('boom'); setTimeout(() => cb(ranked(15), 'OK', { hasNextPage: true }), 0); };
  await assert.rejects(searchTop(s, korean, sdk, 1000), /boom/);
});
