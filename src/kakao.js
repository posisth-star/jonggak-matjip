// 카카오 장소 검색: 반경을 격자로 나눠 구역별로 검색하고, 45건 한도를 넘는 구역은 4등분해 다시 검색한다.
// 장소 정보는 저장하지 않고 페이지가 열려 있는 동안 메모리에만 둔다.
import { CATEGORIES, CENTER, RADIUS_M } from './categories.js';
import { toRestaurant, matchesCategory, dedupeById } from './places-logic.js';

const PAGE_SIZE = 15;
const MAX_VISIBLE = 45;       // 카카오가 한 검색에 노출하는 최대 건수
const DEFAULT_TIMEOUT_MS = 10000;
const M_PER_DEG_LAT = 111320;

export function withTimeout(promise, ms, message = '시간 초과') {
  let timer;
  const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(message)), ms); });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// 원을 감싸는 정사각형을 n×n으로 나누고, 원에 닿는 칸만 돌려준다.
export function makeGrid(center, radiusM, n = 4) {
  const dLat = radiusM / M_PER_DEG_LAT;
  const dLng = radiusM / (M_PER_DEG_LAT * Math.cos((center.lat * Math.PI) / 180));
  const cells = [];
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const sw = { lat: center.lat - dLat + (2 * dLat * i) / n, lng: center.lng - dLng + (2 * dLng * j) / n };
      const ne = { lat: center.lat - dLat + (2 * dLat * (i + 1)) / n, lng: center.lng - dLng + (2 * dLng * (j + 1)) / n };
      // 원 중심에서 칸까지 가장 가까운 점이 반경 안이면 포함
      const nearLat = Math.min(Math.max(center.lat, sw.lat), ne.lat);
      const nearLng = Math.min(Math.max(center.lng, sw.lng), ne.lng);
      const dy = (nearLat - center.lat) / dLat, dx = (nearLng - center.lng) / dLng;
      if (dx * dx + dy * dy <= 1) cells.push({ sw, ne });
    }
  }
  return cells;
}

function splitRect({ sw, ne }) {
  const mid = { lat: (sw.lat + ne.lat) / 2, lng: (sw.lng + ne.lng) / 2 };
  return [
    { sw, ne: mid },
    { sw: { lat: sw.lat, lng: mid.lng }, ne: { lat: mid.lat, lng: ne.lng } },
    { sw: { lat: mid.lat, lng: sw.lng }, ne: { lat: ne.lat, lng: mid.lng } },
    { sw: mid, ne },
  ];
}

function searchPage(keywordSearch, category, sdk, rect, page, timeoutMs) {
  const call = new Promise((resolve, reject) => {
    const options = { bounds: sdk.toBounds(rect), category_group_code: category.groupCode, size: PAGE_SIZE, page };
    keywordSearch(category.query, (result, status, pagination) => {
      if (status === sdk.Status.OK) resolve({ docs: result, total: pagination?.totalCount ?? result.length, hasNext: !!pagination?.hasNextPage });
      else if (status === sdk.Status.ZERO_RESULT) resolve({ docs: [], total: 0, hasNext: false });
      else reject(new Error(`카카오 장소 검색 실패: ${status}`));
    }, options);
  });
  return withTimeout(call, timeoutMs, '카카오 장소 검색 시간 초과');
}

export async function collectArea(keywordSearch, category, sdk, {
  center = CENTER, radiusM = RADIUS_M, gridN = 4, maxDepth = 3, maxRequests = 400, concurrency = 6, timeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) {
  const queue = makeGrid(center, radiusM, gridN).map((rect) => ({ rect, depth: 0 }));
  const docs = [];
  let requests = 0;

  async function handle({ rect, depth }) {
    requests++;
    const first = await searchPage(keywordSearch, category, sdk, rect, 1, timeoutMs);
    if (first.total > MAX_VISIBLE && depth < maxDepth && requests + 4 <= maxRequests) {
      queue.push(...splitRect(rect).map((r) => ({ rect: r, depth: depth + 1 })));
      return;
    }
    docs.push(...first.docs);
    let page = 1, hasNext = first.hasNext;
    while (hasNext && page * PAGE_SIZE < MAX_VISIBLE && requests < maxRequests) {
      page++;
      requests++;
      const next = await searchPage(keywordSearch, category, sdk, rect, page, timeoutMs);
      docs.push(...next.docs);
      hasNext = next.hasNext;
    }
  }

  // 단계별로 처리: 이번 단계 칸들을 동시에 최대 concurrency개씩 검색하고, 쪼개진 칸은 다음 단계로
  while (queue.length && requests < maxRequests) {
    const wave = queue.splice(0);
    let next = 0;
    const worker = async () => {
      while (next < wave.length && requests < maxRequests) await handle(wave[next++]);
    };
    await Promise.all(Array.from({ length: concurrency }, worker));
  }
  return docs;
}

export function createFetcher(keywordSearch, sdk, options = {}) {
  const cache = new Map();
  return (categoryKey) => {
    if (cache.has(categoryKey)) return cache.get(categoryKey);
    const category = CATEGORIES.find((c) => c.key === categoryKey);
    if (!category) return Promise.reject(new Error(`알 수 없는 종류: ${categoryKey}`));
    const p = collectArea(keywordSearch, category, sdk, options).then((docs) =>
      dedupeById(
        docs.filter((d) => matchesCategory(d.category_name, category))
          .map((d) => toRestaurant(d))
          .filter((r) => r.distanceM <= RADIUS_M),
      ));
    cache.set(categoryKey, p);
    p.catch(() => cache.delete(categoryKey));
    return p;
  };
}
