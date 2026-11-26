// 페이지 진입점: SDK 로드 → 탭 전환 → 정렬 → 렌더
import { CATEGORIES } from './categories.js';
import { sortRestaurants, filterByWalk } from './places-logic.js';
import { createFetcher, withTimeout } from './kakao.js';
import { renderTabs, renderList, renderLoading, renderError } from './ui.js';

const $ = (id) => document.getElementById(id);
// range: 검색 범위(10분), maxWalk: 그 안에서 더 좁히는 필터(5분)
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

// 탭이 오른쪽으로 더 있으면 끝을 흐리게 표시
function updateTabFade() {
  const t = $('tabs');
  t.parentElement.classList.toggle('more', t.scrollLeft + t.clientWidth < t.scrollWidth - 4);
}

function paint() {
  // 탭을 다시 그려도 키보드 포커스가 사라지지 않게, 포커스가 있던 탭을 기억했다가 되돌린다
  const focusedKey = document.activeElement?.closest?.('#tabs [data-key]')?.dataset.key;
  $('tabs').innerHTML = renderTabs(CATEGORIES, state.active);
  if (focusedKey) $('tabs').querySelector(`[data-key="${focusedKey}"]`)?.focus({ preventScroll: true });
  updateTabFade();
  // 추천 탭은 메뉴별 상위 5곳을 섞은 목록: 기본 정렬이면 '무작위', 다른 정렬이면 '메뉴별 상위 5곳'으로 표시
  const picked = !!CATEGORIES.find((c) => c.key === state.active)?.aggregate;
  if (state.data) $('list').innerHTML = renderList(sortRestaurants(filterByWalk(state.data, state.maxWalk), state.sortBy), {
    maxWalk: state.maxWalk, range: state.range, shuffled: picked && state.sortBy === 'rank', picked,
  });
}

async function show(key) {
  state.active = key;
  const { range } = state;
  state.data = null;
  paint();
  $('list').innerHTML = renderLoading();
  // 추천 탭은 9개 탭을 모두 받으므로, 받는 만큼 진행률 바를 채운다
  const onProgress = (done, total) => {
    if (state.active !== key || state.data) return;
    const pct = Math.round((done / total) * 100);
    const bar = $('list').querySelector('.progress');
    if (bar) { bar.setAttribute('aria-valuenow', String(pct)); bar.firstElementChild.style.width = `${pct}%`; }
  };
  try {
    const data = await state.fetchFor(key, range, { onProgress });
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

  $('tabs').addEventListener('scroll', updateTabFade, { passive: true });
  window.addEventListener('resize', updateTabFade);
  $('tabs').addEventListener('click', (ev) => {
    const btn = ev.target.closest('[data-key]');
    if (btn && (btn.dataset.key !== state.active || !state.data)) show(btn.dataset.key);
  });
  $('sortBy')?.addEventListener('change', (ev) => { state.sortBy = ev.target.value; paint(); });
  $('maxWalk')?.addEventListener('change', (ev) => {
    state.maxWalk = Number(ev.target.value) === 5 ? 5 : 0; // 5분은 10분 목록에서 걸러내기
    paint();
  });
  show(state.active);
}

main();
