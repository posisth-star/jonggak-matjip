// 카카오 장소 검색 래퍼: 페이지 이어 받기 + 종류별 메모리 캐시 (장소 정보는 저장하지 않음)
import { CATEGORIES, RADIUS_M } from './categories.js';
import { toRestaurant, matchesCategory, dedupeById } from './places-logic.js';

const MAX_PAGES = 3;
const DEFAULT_TIMEOUT_MS = 10000;

export function withTimeout(promise, ms, message = '시간 초과') {
  let timer;
  const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(message)), ms); });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

export function searchAllPages(keywordSearch, category, sdk, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const search = new Promise((resolve, reject) => {
    const docs = [];
    const fetchPage = (page) => {
      const options = { location: sdk.location, radius: RADIUS_M, category_group_code: category.groupCode, sort: sdk.sortDistance, size: 15, page };
      try {
      keywordSearch(category.query, (result, status, pagination) => {
        if (status === sdk.Status.OK) {
          docs.push(...result);
          if (page < MAX_PAGES && pagination?.hasNextPage) fetchPage(page + 1);
          else resolve(docs);
        } else if (status === sdk.Status.ZERO_RESULT) {
          resolve(docs);
        } else {
          reject(new Error(`카카오 장소 검색 실패: ${status}`));
        }
      }, options);
      } catch (e) {
        reject(e);
      }
    };
    fetchPage(1);
  });
  return withTimeout(search, timeoutMs, '카카오 장소 검색 시간 초과');
}

export function createFetcher(keywordSearch, sdk, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const cache = new Map();
  return (categoryKey) => {
    if (cache.has(categoryKey)) return cache.get(categoryKey);
    const category = CATEGORIES.find((c) => c.key === categoryKey);
    if (!category) return Promise.reject(new Error(`알 수 없는 종류: ${categoryKey}`));
    const p = searchAllPages(keywordSearch, category, sdk, timeoutMs)
      .then((docs) => dedupeById(docs.filter((d) => matchesCategory(d.category_name, category)).map(toRestaurant)));
    cache.set(categoryKey, p);
    p.catch(() => cache.delete(categoryKey));
    return p;
  };
}
