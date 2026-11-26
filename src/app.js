// 페이지 진입점: SDK 로드 → 탭 전환 → 정렬 → 렌더
import { CATEGORIES } from './categories.js';
import { sortRestaurants, filterByWalk } from './places-logic.js';
import { createFetcher, withTimeout } from './kakao.js';
import { renderTabs, renderList, renderLoading, renderError } from './ui.js';

const $ = (id) => document.getElementById(id);
// range: 검색 범위(10·15분), maxWalk: 그 안에서 더 좁히는 필터(5분)
const state = { active: CATEGORIES[0].key, sortBy: 'rank', range: 10, maxWalk: 0, data: null, fetchFor: null };

export function loadKakaoSdk(appKey) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(appKey)}&libraries=services&autoload=false`;
    s.onload = () => (window.kakao?.maps ? window.kakao.maps.load(resolve) : reject(new Error('카카오 SDK가 비어 있어요')));
    s.onerror = () => reject(new Error('카카오 SDK를 불러오지 못했어요'));
    document.head.appendChild(s);
  });
}

function paint() {
  $('tabs').innerHTML = renderTabs(CATEGORIES, state.active);
  if (state.data) $('list').innerHTML = renderList(sortRestaurants(filterByWalk(state.data, state.maxWalk), state.sortBy), { maxWalk: state.maxWalk, range: state.range });
}

async function show(key) {
  state.active = key;
  const { range } = state;
  state.data = null;
  paint();
  $('list').innerHTML = renderLoading();
  try {
    const data = await state.fetchFor(key, range);
    if (state.active !== key || state.range !== range) return; // 그 사이 탭이나 범위가 바뀌었으면 무시
    state.data = data;
    paint();
  } catch (e) {
    console.error(e);
    if (state.active === key && state.range === range) $('list').innerHTML = renderError();
  }
}

// 다시 시도: SDK가 준비됐으면 현재 탭만 재호출, 아니면 새로고침
document.addEventListener('click', (ev) => {
  if (ev.target.id !== 'retry') return;
  if (state.fetchFor) show(state.active);
  else location.reload();
});

async function main() {
  $('tabs').innerHTML = renderTabs(CATEGORIES, state.active);
  $('list').innerHTML = renderLoading();
  let key;
  try {
    ({ KAKAO_JS_KEY: key } = await import('../config.js'));
    await withTimeout(loadKakaoSdk(key), 10000, '카카오 SDK 로드 시간 초과');
  } catch (e) {
    console.error(e);
    $('list').innerHTML = renderError();
    return;
  }
  const { services, LatLng, LatLngBounds } = window.kakao.maps;
  const places = new services.Places();
  const sdk = {
    toBounds: (r) => new LatLngBounds(new LatLng(r.sw.lat, r.sw.lng), new LatLng(r.ne.lat, r.ne.lng)),
    sortAccuracy: services.SortBy.ACCURACY,
    Status: services.Status,
  };
  state.fetchFor = createFetcher(places.keywordSearch.bind(places), sdk);

  $('tabs').addEventListener('click', (ev) => {
    const btn = ev.target.closest('[data-key]');
    if (btn && (btn.dataset.key !== state.active || !state.data)) show(btn.dataset.key);
  });
  $('sortBy')?.addEventListener('change', (ev) => { state.sortBy = ev.target.value; paint(); });
  $('maxWalk')?.addEventListener('change', (ev) => {
    const v = Number(ev.target.value);
    const range = v === 15 ? 15 : 10;      // 15분은 범위를 넓혀 다시 검색
    state.maxWalk = v === 5 ? 5 : 0;       // 5분은 10분 목록에서 걸러내기
    if (range !== state.range) { state.range = range; show(state.active); } else paint();
  });
  show(state.active);
}

main();
