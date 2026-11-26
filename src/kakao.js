// 카카오 장소 검색: 탭의 검색어마다 카카오 추천(정확도) 순 상위 45곳을 받아 합친다.
// 장소 정보는 저장하지 않고 페이지가 열려 있는 동안 메모리에만 둔다.
import { CATEGORIES, CENTER, RADIUS_M, RANGES } from './categories.js';
import { toRestaurant, matchesCategory, dedupeById, isExcludedName } from './places-logic.js';

const PAGE_SIZE = 15;
const MAX_VISIBLE = 45;       // 카카오가 한 검색에 노출하는 최대 건수
const DEFAULT_TIMEOUT_MS = 10000;

export function withTimeout(promise, ms, message = '시간 초과') {
  let timer;
  const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(message)), ms); });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// 여러 순위 목록을 1위끼리, 2위끼리… 번갈아 합친다
export function mergeRanked(lists) {
  const out = [];
  const longest = Math.max(0, ...lists.map((l) => l.length));
  for (let i = 0; i < longest; i++) for (const l of lists) if (i < l.length) out.push(l[i]);
  return out;
}

// 피셔-예이츠 섞기(random은 테스트에서 바꿔 끼울 수 있게 받는다)
export function shuffle(list, random = Math.random) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const PICKS_PER_TAB = 5; // 추천 탭: 메뉴 탭마다 상위 몇 곳을 뽑을지

// 반경을 감싸는 정사각형 범위
export function squareAround(center, radiusM) {
  const dLat = radiusM / 111320;
  const dLng = radiusM / (111320 * Math.cos((center.lat * Math.PI) / 180));
  return { sw: { lat: center.lat - dLat, lng: center.lng - dLng }, ne: { lat: center.lat + dLat, lng: center.lng + dLng } };
}

// 카카오 정확도(추천) 순 상위 45곳을 순서대로 받는다.
// 중심점(location)을 주면 카카오가 가까운 곳을 우대하므로, 범위(bounds)만 주고 반경 밖은 나중에 거른다.
export function searchTop(keywordSearch, query, groupCode, sdk, timeoutMs = DEFAULT_TIMEOUT_MS, radiusM = RADIUS_M) {
  const search = new Promise((resolve, reject) => {
    const docs = [];
    const fetchPage = (page) => {
      try {
        const options = { bounds: sdk.toBounds(squareAround(CENTER, radiusM)), category_group_code: groupCode, sort: sdk.sortAccuracy, size: PAGE_SIZE, page };
        keywordSearch(query, (result, status, pagination) => {
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
  const fetchTab = (categoryKey, rangeMin = 10, { onProgress } = {}) => {
    const radiusM = RANGES[rangeMin] ?? RADIUS_M;
    const cacheKey = `${rangeMin}:${categoryKey}`;
    if (cache.has(cacheKey)) return cache.get(cacheKey);
    const category = CATEGORIES.find((c) => c.key === categoryKey);
    if (!category) return Promise.reject(new Error(`알 수 없는 종류: ${categoryKey}`));
    let p;
    if (category.aggregate) {
      // 추천: 메뉴 탭을 모두 받아(각 탭은 캐시에 남음) 탭마다 상위 5곳을 모아 무작위로 섞는다.
      // 카카오 순서는 검색 정확도일 뿐 인기 순위가 아니라서 'N위'는 달지 않는다.
      const tabs = CATEGORIES.filter((c) => !c.aggregate);
      let done = 0;
      p = Promise.all(tabs.map((t) => fetchTab(t.key, rangeMin).then((list) => { done += 1; onProgress?.(done, tabs.length); return list; })))
        .then((lists) => shuffle(dedupeById(lists.flatMap((l) => l.slice(0, PICKS_PER_TAB))), options.random)
          .map(({ rank, ...r }) => r));
    } else {
      // 탭의 검색어마다 상위 45곳을 받아, 1위끼리·2위끼리 번갈아 합친다
      p = Promise.all(category.queries.map((q) =>
        searchTop(keywordSearch, q, category.groupCode, sdk, options.timeoutMs, radiusM)
          .then((docs) => docs.filter((d) => matchesCategory(d.category_name, category) && !isExcludedName(d.place_name)))))
        .then((lists) => dedupeById(mergeRanked(lists).map((d) => toRestaurant(d)).filter((r) => r.distanceM <= radiusM))
          .map((r, i) => ({ ...r, rank: i + 1 })));
    }
    cache.set(cacheKey, p);
    p.catch(() => cache.delete(cacheKey));
    return p;
  };
  return fetchTab;
}
