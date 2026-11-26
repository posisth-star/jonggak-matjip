// 카카오 장소 검색 래퍼: 페이지 이어 받기 + 종류별 메모리 캐시 (장소 정보는 저장하지 않음)
import { CATEGORIES, RADIUS_M } from './categories.js';
import { toRestaurant, matchesCategory, dedupeById } from './places-logic.js';

const MAX_PAGES = 3;

export function searchAllPages(keywordSearch, category, sdk) {
  return new Promise((resolve, reject) => {
    const docs = [];
    const fetchPage = (page) => {
      const options = { location: sdk.location, radius: RADIUS_M, category_group_code: category.groupCode, sort: sdk.sortDistance, size: 15, page };
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
    };
    fetchPage(1);
  });
}

export function createFetcher(keywordSearch, sdk) {
  const cache = new Map();
  return (categoryKey) => {
    if (cache.has(categoryKey)) return cache.get(categoryKey);
    const category = CATEGORIES.find((c) => c.key === categoryKey);
    if (!category) return Promise.reject(new Error(`알 수 없는 종류: ${categoryKey}`));
    const p = searchAllPages(keywordSearch, category, sdk)
      .then((docs) => dedupeById(docs.filter((d) => matchesCategory(d.category_name, category)).map(toRestaurant)));
    cache.set(categoryKey, p);
    p.catch(() => cache.delete(categoryKey));
    return p;
  };
}
