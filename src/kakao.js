// 카카오 장소 검색: 종류별로 카카오 추천(정확도) 순 상위 45곳을 받는다.
// 장소 정보는 저장하지 않고 페이지가 열려 있는 동안 메모리에만 둔다.
import { CATEGORIES, CENTER, RADIUS_M } from './categories.js';
import { toRestaurant, matchesCategory, dedupeById } from './places-logic.js';

const PAGE_SIZE = 15;
const MAX_VISIBLE = 45;       // 카카오가 한 검색에 노출하는 최대 건수
const DEFAULT_TIMEOUT_MS = 10000;

export function withTimeout(promise, ms, message = '시간 초과') {
  let timer;
  const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(message)), ms); });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// 반경을 감싸는 정사각형 범위
export function squareAround(center, radiusM) {
  const dLat = radiusM / 111320;
  const dLng = radiusM / (111320 * Math.cos((center.lat * Math.PI) / 180));
  return { sw: { lat: center.lat - dLat, lng: center.lng - dLng }, ne: { lat: center.lat + dLat, lng: center.lng + dLng } };
}

// 카카오 정확도(추천) 순 상위 45곳을 순서대로 받는다.
// 중심점(location)을 주면 카카오가 가까운 곳을 우대하므로, 범위(bounds)만 주고 반경 밖은 나중에 거른다.
export function searchTop(keywordSearch, category, sdk, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const search = new Promise((resolve, reject) => {
    const docs = [];
    const fetchPage = (page) => {
      try {
        const options = { bounds: sdk.toBounds(squareAround(CENTER, RADIUS_M)), category_group_code: category.groupCode, sort: sdk.sortAccuracy, size: PAGE_SIZE, page };
        keywordSearch(category.query, (result, status, pagination) => {
          if (status === sdk.Status.OK) {
            docs.push(...result);
            if (pagination?.hasNextPage && page * PAGE_SIZE < MAX_VISIBLE) fetchPage(page + 1);
            else resolve(docs);
          } else if (status === sdk.Status.ZERO_RESULT) resolve(docs);
          else reject(new Error(`카카오 장소 검색 실패: ${status}`));
        }, options);
      } catch (e) {
        reject(e);
      }
    };
    fetchPage(1);
  });
  return withTimeout(search, timeoutMs, '카카오 장소 검색 시간 초과');
}

export function createFetcher(keywordSearch, sdk, options = {}) {
  const cache = new Map();
  return (categoryKey) => {
    if (cache.has(categoryKey)) return cache.get(categoryKey);
    const category = CATEGORIES.find((c) => c.key === categoryKey);
    if (!category) return Promise.reject(new Error(`알 수 없는 종류: ${categoryKey}`));
    const p = searchTop(keywordSearch, category, sdk, options.timeoutMs).then((docs) =>
      dedupeById(
        docs.filter((d) => matchesCategory(d.category_name, category))
          .map((d) => toRestaurant(d))
          .filter((r) => r.distanceM <= RADIUS_M),
      ).map((r, i) => ({ ...r, rank: i + 1 })));
    cache.set(categoryKey, p);
    p.catch(() => cache.delete(categoryKey));
    return p;
  };
}
