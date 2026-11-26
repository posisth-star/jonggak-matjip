// 페이지 진입점: SDK 로드 → 탭 전환 → 정렬 → 렌더
import { CATEGORIES, CENTER } from './categories.js';
import { sortRestaurants } from './places-logic.js';
import { createFetcher } from './kakao.js';
import { renderTabs, renderList, renderLoading, renderError } from './ui.js';

const $ = (id) => document.getElementById(id);
const state = { active: CATEGORIES[0].key, sortBy: 'distance', data: null, fetchFor: null };

export function loadKakaoSdk(appKey) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(appKey)}&libraries=services&autoload=false`;
    s.onload = () => (window.kakao?.maps ? window.kakao.maps.load(resolve) : reject(new Error('SDK 없음')));
    s.onerror = () => reject(new Error('카카오 SDK를 불러오지 못했어요'));
    document.head.appendChild(s);
  });
}

function paint() {
  $('tabs').innerHTML = renderTabs(CATEGORIES, state.active);
  if (state.data) $('list').innerHTML = renderList(sortRestaurants(state.data, state.sortBy));
}

async function show(key) {
  state.active = key;
  state.data = null;
  paint();
  $('list').innerHTML = renderLoading();
  try {
    const data = await state.fetchFor(key);
    if (state.active !== key) return; // 그 사이 다른 탭을 눌렀으면 무시
    state.data = data;
    paint();
  } catch (e) {
    console.error(e);
    if (state.active === key) $('list').innerHTML = renderError();
  }
}

async function main() {
  $('tabs').innerHTML = renderTabs(CATEGORIES, state.active);
  $('list').innerHTML = renderLoading();
  let key;
  try {
    ({ KAKAO_JS_KEY: key } = await import('../config.js'));
    await loadKakaoSdk(key);
  } catch (e) {
    console.error(e);
    $('list').innerHTML = renderError();
    return;
  }
  const { services, LatLng } = window.kakao.maps;
  const places = new services.Places();
  const sdk = { location: new LatLng(CENTER.lat, CENTER.lng), sortDistance: services.SortBy.DISTANCE, Status: services.Status };
  state.fetchFor = createFetcher(places.keywordSearch.bind(places), sdk);

  $('tabs').addEventListener('click', (ev) => {
    const btn = ev.target.closest('[data-key]');
    if (btn && btn.dataset.key !== state.active) show(btn.dataset.key);
  });
  $('sortBy').addEventListener('change', (ev) => { state.sortBy = ev.target.value; paint(); });
  show(state.active);
}

main();
