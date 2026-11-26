// 화면 조각을 HTML 문자열로 만드는 순수 함수들
import { ORIGIN_NAME, WALK_LIMIT_MIN } from './categories.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const link = (href, text) =>
  `<a class="btn" href="${esc(href)}" target="_blank" rel="noopener">${text}</a>`;

export function renderTabs(categories, activeKey) {
  return categories.map((c) => {
    const on = c.key === activeKey;
    return `<button type="button" role="tab" class="tab${on ? ' active' : ''}" data-key="${esc(c.key)}" aria-selected="${on}">${esc(c.label)}</button>`;
  }).join('');
}

function renderCard(x) {
  const phone = x.phone ? `<a class="phone" href="tel:${esc(x.phone)}">${esc(x.phone)}</a>` : '';
  return `<li class="card">
  <div class="card-head"><h3>${x.rank ? `<span class="rank">추천 ${x.rank}위</span> ` : ''}${esc(x.name)}</h3><span class="walk">도보 ${x.walkMin}분</span></div>
  <div class="meta">${x.subCategory ? `<span class="sub">${esc(x.subCategory)}</span>` : ''}${phone}</div>
  <div class="links">${link(x.naverUrl, '네이버에서 보기')}${link(x.kakaoUrl, '카카오맵에서 보기')}</div>
</li>`;
}

export function renderList(list, { maxWalk = 0, range = WALK_LIMIT_MIN } = {}) {
  if (!list.length) {
    return maxWalk > 0
      ? `<p class="notice">도보 ${maxWalk}분 안에는 식당이 없어요. 거리를 넓혀 보세요.</p>`
      : '<p class="notice">이 종류는 주변에 맛집 정보가 없어요.</p>';
  }
  const scope = `${ORIGIN_NAME}에서 도보 ${maxWalk > 0 ? maxWalk : range}분 이내 · 카카오 추천순`;
  return `<p class="summary">${list.length}곳 · ${scope}</p><ul class="cards">${list.map(renderCard).join('')}</ul>`;
}

export function renderLoading() {
  return '<p class="notice">맛집 정보를 불러오는 중이에요…</p>';
}

export function renderError() {
  return '<p class="notice error">식당 정보를 불러오지 못했어요. <button type="button" id="retry" class="btn">다시 시도</button></p>';
}
