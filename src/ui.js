// 화면 조각을 HTML 문자열로 만드는 순수 함수들
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
  <div class="card-head"><h3>${esc(x.name)}</h3><span class="walk">도보 ${x.walkMin}분</span></div>
  <div class="meta">${x.subCategory ? `<span class="sub">${esc(x.subCategory)}</span>` : ''}${phone}</div>
  <div class="links">${link(x.naverUrl, '네이버에서 보기')}${link(x.kakaoUrl, '카카오맵에서 보기')}</div>
</li>`;
}

export function renderList(list) {
  if (!list.length) return '<p class="notice">이 종류는 주변에 등록된 식당이 없어요.</p>';
  return `<p class="summary">${list.length}곳 · 종각역 반경 1.6km</p><ul class="cards">${list.map(renderCard).join('')}</ul>`;
}

export function renderLoading() {
  return '<p class="notice">식당 정보를 모으는 중이에요… (처음엔 몇 초 걸려요)</p>';
}

export function renderError() {
  return '<p class="notice error">식당 정보를 불러오지 못했어요. <button type="button" id="retry" class="btn">다시 시도</button></p>';
}
