// 카카오 장소 결과 변환, 종류 필터, 정렬, 지도 링크 (DOM·SDK 없는 순수 로직)
const NAVER_SEARCH = 'https://map.naver.com/p/search/';
const DETOUR = 1.3;          // 직선거리 → 실제 걷는 거리 보정
const WALK_M_PER_MIN = 80;   // 분당 걷는 거리

export function walkMinutes(distanceM) {
  return Math.round((distanceM * DETOUR) / WALK_M_PER_MIN);
}

export function naverSearchUrl(name) {
  return NAVER_SEARCH + encodeURIComponent(`${name} 종각`);
}

export function matchesCategory(categoryName, category) {
  if (category.match == null) return true;
  const second = String(categoryName ?? '').split(' > ')[1] ?? '';
  return second.includes(category.match);
}

export function toRestaurant(doc) {
  const parts = String(doc.category_name ?? '').split(' > ');
  const distanceM = Number(doc.distance) || 0;
  return {
    id: String(doc.id),
    name: doc.place_name,
    subCategory: parts[parts.length - 1] ?? '',
    distanceM,
    walkMin: walkMinutes(distanceM),
    phone: doc.phone ?? '',
    kakaoUrl: doc.place_url,
    naverUrl: naverSearchUrl(doc.place_name),
  };
}

export function sortRestaurants(list, sortBy) {
  const copy = [...list];
  if (sortBy === 'name') copy.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  else copy.sort((a, b) => a.distanceM - b.distanceM);
  return copy;
}

export function dedupeById(list) {
  const seen = new Set();
  return list.filter(x => (seen.has(x.id) ? false : seen.add(x.id)));
}
