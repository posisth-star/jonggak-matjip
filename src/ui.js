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
  <div class="meta">${x.subCategory ? `<span class="sub">${esc(x.subCategory)}</span>` : ''}${x.street ? `<span class="addr">📍 ${esc(x.street)}</span>` : ''}${phone}</div>
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

// 로딩: 주먹밥 캐릭터가 돋보기로 맛집을 찾는 동안 진행률 바가 차오른다
const BUDDY = '<svg class="buddy" viewBox="0 0 120 110" width="96" height="88" aria-hidden="true"><ellipse cx="60" cy="102" rx="30" ry="5" fill="#000" opacity=".08"/><g class="buddy-body"><path d="M60 12 C86 12 104 42 104 66 C104 88 86 98 60 98 C34 98 16 88 16 66 C16 42 34 12 60 12 Z" fill="#fffdf7" stroke="#3a3a36" stroke-width="3"/><rect x="30" y="70" width="60" height="24" rx="6" fill="#2f3a2f"/><circle cx="45" cy="56" r="4.5" fill="#3a3a36"/><circle cx="75" cy="56" r="4.5" fill="#3a3a36"/><circle cx="46.5" cy="54.5" r="1.5" fill="#fff"/><circle cx="76.5" cy="54.5" r="1.5" fill="#fff"/><ellipse cx="36" cy="65" rx="6" ry="3.5" fill="#ffb4a2" opacity=".8"/><ellipse cx="84" cy="65" rx="6" ry="3.5" fill="#ffb4a2" opacity=".8"/><path d="M53 63 Q60 69 67 63" fill="none" stroke="#3a3a36" stroke-width="2.5" stroke-linecap="round"/><g class="buddy-glass"><circle cx="96" cy="34" r="11" fill="#dff3ff" stroke="#d9480f" stroke-width="4"/><line x1="88" y1="42" x2="78" y2="53" stroke="#d9480f" stroke-width="5" stroke-linecap="round"/></g></g></svg>';
export function renderLoading(done = 0, total = 0) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return `<div class="loading">${BUDDY}<p class="loading-text">맛집을 찾고 있어요…</p>
  <div class="progress" role="progressbar" aria-label="맛집 찾는 중" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><div class="progress-fill" style="width:${pct}%"></div></div></div>`;
}

export function renderError() {
  return '<p class="notice error">식당 정보를 불러오지 못했어요. <button type="button" id="retry" class="btn">다시 시도</button></p>';
}
