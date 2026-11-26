import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeGrid, collectArea, createFetcher } from '../src/kakao.js';
import { CATEGORIES, CENTER, RADIUS_M } from '../src/categories.js';

const sdk = { toBounds: (r) => r, Status: { OK: 'OK', ZERO_RESULT: 'ZERO', ERROR: 'ERR' } };
const korean = CATEGORIES.find(c => c.key === 'korean');
const cafe = CATEGORIES.find(c => c.key === 'cafe');
const M_LAT = 1 / 111320, M_LNG = 1 / (111320 * Math.cos(CENTER.lat * Math.PI / 180));
const at = (dxM, dyM) => ({ lat: CENTER.lat + dyM * M_LAT, lng: CENTER.lng + dxM * M_LNG });
const place = (id, p, cat = '음식점 > 한식 > 국수') =>
  ({ id: String(id), place_name: 'P' + id, category_name: cat, x: String(p.lng), y: String(p.lat), phone: '', place_url: 'u' + id });

// bounds 안의 장소를 카카오처럼 돌려주는 가짜 keywordSearch (최대 45건 노출)
function fakeSearch(places, { status } = {}) {
  const calls = [];
  const fn = (query, cb, o) => {
    calls.push({ query, o });
    setTimeout(() => {
      if (status) return cb([], status, {});
      const r = o.bounds;
      const inside = places.filter(p => +p.y >= r.sw.lat && +p.y < r.ne.lat && +p.x >= r.sw.lng && +p.x < r.ne.lng);
      const visible = inside.slice(0, 45);
      const page = visible.slice((o.page - 1) * 15, o.page * 15);
      if (!page.length) return cb([], 'ZERO', { totalCount: 0, hasNextPage: false });
      cb(page, 'OK', { totalCount: Math.min(inside.length, 45), hasNextPage: o.page * 15 < visible.length });
    }, 0);
  };
  fn.calls = calls;
  return fn;
}

// 반경 안에 고르게 흩어진 장소 n개 (결정적)
function spread(n, maxR = RADIUS_M * 0.95) {
  return Array.from({ length: n }, (_, i) => {
    const a = i * 2.399963, r = maxR * Math.sqrt((i + 0.5) / n);
    return place(i, at(r * Math.cos(a), r * Math.sin(a)));
  });
}

test('makeGrid covers the circle bounding square with cells touching the circle', () => {
  const cells = makeGrid(CENTER, RADIUS_M, 4);
  assert.ok(cells.length > 0 && cells.length <= 16);
  const minLat = Math.min(...cells.map(c => c.sw.lat)), maxLat = Math.max(...cells.map(c => c.ne.lat));
  assert.ok(Math.abs((maxLat - minLat) / M_LAT - 2 * RADIUS_M) < 2);
});

test('collects far more than 45 when area is dense', async () => {
  const places = spread(400);
  const docs = await collectArea(fakeSearch(places), korean, sdk, { center: CENTER, radiusM: RADIUS_M });
  assert.equal(new Set(docs.map(d => d.id)).size, 400);
});

test('sparse area: one page per cell, no subdivision', async () => {
  const s = fakeSearch(spread(10));
  await collectArea(s, korean, sdk, { center: CENTER, radiusM: RADIUS_M });
  assert.ok(s.calls.length <= 16, String(s.calls.length));
});

test('passes category group code and keyword', async () => {
  const s = fakeSearch(spread(5));
  await collectArea(s, cafe, sdk, { center: CENTER, radiusM: RADIUS_M });
  assert.equal(s.calls[0].query, '카페');
  assert.equal(s.calls[0].o.category_group_code, 'CE7');
});

test('stops at maxRequests and returns what it has', async () => {
  const cluster = Array.from({ length: 500 }, (_, i) => place(i, at((i % 10) * 0.5, Math.floor(i / 10) * 0.5)));
  const s = fakeSearch(cluster);
  const docs = await collectArea(s, korean, sdk, { center: CENTER, radiusM: RADIUS_M, maxRequests: 30 });
  assert.ok(s.calls.length <= 30, String(s.calls.length));
  assert.ok(docs.length >= 45);
});

test('fetcher drops places outside radius and other categories, sorted input deduped', async () => {
  const places = [place(1, at(100, 0)), place(2, at(0, 1590)), place(3, at(1200, 1200)), place(4, at(50, 0), '음식점 > 중식 > 중국요리')];
  const out = await createFetcher(fakeSearch(places), sdk)('korean');
  assert.deepEqual(out.map(x => x.id).sort(), ['1', '2']);
});

test('fetcher rejects on ERROR status', async () => {
  await assert.rejects(createFetcher(fakeSearch([], { status: 'ERR' }), sdk)('korean'));
});

test('caches per key', async () => {
  const s = fakeSearch(spread(5));
  const f = createFetcher(s, sdk);
  await f('korean');
  const n = s.calls.length;
  await f('korean');
  assert.equal(s.calls.length, n);
});

test('retries after failure', async () => {
  let fail = true;
  const ok = fakeSearch(spread(5));
  const s = (q, cb, o) => (fail ? setTimeout(() => cb([], 'ERR', {}), 0) : ok(q, cb, o));
  const f = createFetcher(s, sdk);
  await assert.rejects(f('korean'));
  fail = false;
  assert.equal((await f('korean')).length, 5);
});

test('times out when callback never comes', async () => {
  await assert.rejects(collectArea(() => {}, korean, sdk, { center: CENTER, radiusM: RADIUS_M, timeoutMs: 20 }), /시간 초과/);
});

test('rejects when keywordSearch throws', async () => {
  const s = () => { throw new Error('boom'); };
  await assert.rejects(collectArea(s, korean, sdk, { center: CENTER, radiusM: RADIUS_M }), /boom/);
});

test('subdivides when a cell hits the 45 cap even though totalCount is capped', async () => {
  const places = spread(2000);
  const docs = await collectArea(fakeSearch(places), korean, sdk, { center: CENTER, radiusM: RADIUS_M, maxRequests: 3000 });
  assert.equal(new Set(docs.map(d => d.id)).size, 2000);
});
