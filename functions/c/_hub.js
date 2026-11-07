/**
 * 사장님 시작 허브 — 로그인했지만 아직 BizHigher 작업이 없는 사장님의 /my/ (2026-11-07 David 요청)
 *   "리포트를 안 뽑았거나 서비스·플랜을 안 골랐으면 그 페이지에서 차례대로 실행을 유도 — 다음 할 것, 추가 정보,
 *    받을 것, 준비할 것을 미리 알려서 사전 준비"
 * 순서: ① 가게 정보(owner_profiles) → ② 60초 무료 진단(audit_leads.email 로 내 리포트 찾기) → ③ 추천 서비스·플랜(리포트 약점 기준)
 *       → 결제하면 받는 것 · 지금 준비해 둘 것(체크리스트, 이 브라우저에 기억)
 * 아래 "더 받기"(moreHtml)는 고객 대시보드에도 붙는다: 무료 도구 하루 10회 · 새 가이드(NEW) · 카카오톡 채널 · 새 글 소식 받기
 * 데이터: hub = dist/data/hub.json(build.js — 블로그·도구·플랜·서비스, 가격은 services.json 그대로)
 */
import { BASE_CSS, DASH_CSS, SSO_ICON, LOGO_HTML, acctMenu } from './_dash.js';

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const enc = encodeURIComponent;

/* 진단 영역 → 추천 서비스 (CLAUDE.md §5 추천 매핑) */
const AREA_RECS = {
  exposure: ['google-profile-optimization', 'local-listing-setup'],
  reviews: ['review-qr-kit', 'review-reply'],
  website: ['website'],
  completeness: ['google-profile-optimization'],
  competitive: ['seo-blog-pack'],
};
export { HUB_CSS };
export const CATEGORIES = ['식당', '카페·베이커리', '뷰티·미용', '안경점', '치과·병원', '한의원', '학원·교육', '부동산', '융자·보험', '기타'];
export const GOALS = ['새 손님 늘리기', '구글 지도 위로 올리기', '리뷰 늘리기', '광고 시작하기', '웹사이트 만들기'];
const PREP = [
  ['photos', '가게 사진 10~20장', '음식·매장 안·외관·사장님 사진. 휴대폰 사진이면 충분합니다'],
  ['gbp', '구글 비즈니스 프로필 관리자 초대', '프로필 → 사용자 → hello@bizhigher.com 을 관리자로 추가 (2분)'],
  ['hours', '영업시간·휴무일', '명절·연말 특별 영업시간이 있으면 함께'],
  ['menu', '메뉴판·가격표', '사진이나 PDF 그대로'],
  ['logo', '로고 파일 (있으면)', 'PNG·JPG·AI 무엇이든'],
  ['sns', '인스타그램·페이스북 주소', '없으면 비워 두셔도 됩니다'],
  ['site', '웹사이트 관리자 정보 (있으면)', '새로 만드는 경우엔 필요 없습니다'],
  ['budget', '광고를 하신다면 월 예산 범위', '광고비는 사장님 카드에서 바로 나갑니다'],
];
const money = (n) => '$' + Number(n).toLocaleString('en-US');

function steps(cur, done) {
  const names = ['가게 정보', '무료 진단', '플랜 고르기', '시작 준비'];
  return `<ol class="hb-steps">${names.map((n, i) => `<li class="${done[i] ? 'ok' : ''}${cur === i ? ' cur' : ''}"><i>${done[i] ? '✓' : i + 1}</i><span>${n}</span></li>`).join('')}</ol>`;
}

export function profileForm(profile, account, open, back = '') {
  const p = profile || {};
  const sel = (name, list, v) => `<select name="${name}"><option value="">선택</option>${list.map((x) => `<option${x === v ? ' selected' : ''}>${esc(x)}</option>`).join('')}</select>`;
  const needEmail = !(account && account.e);
  return `<form method="post" class="hb-form" id="profile-form"><input type="hidden" name="action" value="profile">${back ? `<input type="hidden" name="back" value="${esc(back)}">` : ''}
<div class="hb-grid2"><label>가게 이름 <b>필수</b><input name="business" required maxlength="120" value="${esc(p.business)}" placeholder="예: 하나 안경원"></label>
<label>도시 <b>필수</b><input name="city" required maxlength="120" value="${esc(p.city)}" placeholder="예: Garden Grove, CA"></label>
<label>업종${sel('category', CATEGORIES, p.category)}</label>
<label>전화 <em>선택</em><input name="phone" type="tel" maxlength="40" value="${esc(p.phone)}" placeholder="(714) 555-0123"></label>
<label>웹사이트 <em>선택</em><input name="website" maxlength="300" value="${esc(p.website)}" placeholder="없으면 비워 두세요"></label>
${needEmail ? `<label>연락받을 이메일 <b>필수</b><input name="email" type="email" required maxlength="120" value="${esc(p.email)}" placeholder="you@example.com"></label>` : `<label>이메일<input value="${esc(account.e)}" disabled></label>`}</div>
<fieldset class="hb-goals"><legend>가장 원하는 것</legend>${GOALS.map((g) => `<label><input type="radio" name="goal" value="${esc(g)}"${p.goal === g ? ' checked' : ''}>${esc(g)}</label>`).join('')}</fieldset>
<label class="hb-check"><input type="checkbox" name="news_optin" value="1"${p.news_optin || !profile ? ' checked' : ''}> 새 마케팅 가이드 소식 받기 (월 1~2회 모아서, 언제든 해제)</label>
<button class="btn" type="submit">${open ? '저장하고 다음 단계로' : '가게 정보 고치기'}</button></form>`;
}

function reportCardHtml(r) {
  if (!r || !r.scores) return '';
  const C = 2 * Math.PI * 40, t = r.scores.total;
  return `<div class="hb-rep"><div class="hb-ring"><svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="40" fill="none" stroke="#EEF1F6" stroke-width="11"/><circle cx="50" cy="50" r="40" fill="none" stroke="${t >= 75 ? '#10B981' : t >= 55 ? '#0A4DF5' : '#F59E0B'}" stroke-width="11" stroke-linecap="round" stroke-dasharray="${(C * t / 100).toFixed(1)} 400" transform="rotate(-90 50 50)"/><text x="50" y="57" text-anchor="middle">${t}</text></svg><span>/ 100점</span></div>
<div class="hb-areas">${r.scores.areas.map((a) => { const pct = Math.round((a.score / (a.max || 20)) * 100); return `<div class="${pct < 60 ? 'weak' : ''}"><span>${esc(a.label)}</span><i><u style="width:${pct}%"></u></i><b>${a.score}/${a.max}</b></div>`; }).join('')}</div>
<div class="hb-rep-foot"><span>${esc(r.business)} · ${esc(String(r.created_at || '').slice(0, 10))}</span>${r.expired ? '<em>30일이 지나 세부 내용은 정리됐습니다 — 점수만 남아 있어요</em>' : `<a href="${esc(r.href || '/report/' + r.id)}" target="_blank" rel="noopener">리포트 전체 보기 →</a>`}</div></div>`;
}

function recommend(report, hub) {
  const svc = new Map((hub.services || []).map((s) => [s.slug, s]));
  let slugs = [], weak = [];
  if (report && report.scores) {
    weak = report.scores.areas.filter((a) => a.score / (a.max || 20) < 0.6);
    slugs = [...(report.recs || []), ...weak.sort((a, b) => a.score / a.max - b.score / b.max).flatMap((a) => AREA_RECS[a.key] || [])];
  }
  slugs = [...new Set(slugs)].filter((s) => svc.has(s)).slice(0, 3);
  return { list: slugs.map((s) => svc.get(s)), weak, pkgFirst: weak.length >= 3 };
}

function plansHtml(hub, highlight) {
  return `<div class="hb-plans">${(hub.packages || []).map((k) => `<a class="hb-plan${k.slug === highlight ? ' hot' : ''}" href="/package/${esc(k.slug)}/">${k.slug === highlight ? '<span class="hb-tag">추천</span>' : k.popular ? '<span class="hb-tag soft">인기</span>' : ''}<b>${esc(k.name)}</b><span class="tl">${esc(k.tagline || '')}</span>
<span class="pr"><strong>${money(k.prices.six)}</strong>/월 · 6개월</span><span class="pr2">월간 ${money(k.prices.monthly)} · 12개월 ${money(k.prices.annual)}</span>
<ul>${(k.includes || []).map((x) => `<li>${esc(x)}</li>`).join('')}</ul><i>자세히 보고 시작하기 →</i></a>`).join('')}</div>`;
}

/** 아래 "더 받기" — 허브와 고객 대시보드 공용 */
export function moreHtml({ hub, blogSeen, newsOn, kakaoChannel, loggedIn = true, demo = false }) {
  if (!hub) return '';
  const week = Date.now() - 7 * 86400000;
  const isNew = (p) => (blogSeen ? p.date > blogSeen : Date.parse(p.date) >= week);
  const posts = (hub.posts || []).slice(0, 4);
  const ch = String(kakaoChannel || '').replace(/\/+$/, '');
  return `<section class="ob-sec" id="more"><div class="ob-h"><h2>로그인 회원이 더 받는 것</h2></div><div class="hb-more">
<div class="card hb-m"><h3>🧰 무료 도구 <span class="hb-pill">하루 10회</span></h3><p class="muted">로그인하면 이메일 입력 없이 도구마다 하루 10회까지 (로그인 전 2회).</p>
<ul class="hb-tools">${(hub.tools || []).map((t) => `<li><a href="/tools/${esc(t.slug)}/"><b>${esc(t.name)}</b><span>${esc(t.desc)}</span></a></li>`).join('')}</ul><a class="hb-link" href="/tools/">무료 도구 ${hub.toolsTotal || ''}개 전체 →</a></div>
<div class="card hb-m"><h3>📰 새 마케팅 가이드</h3><ul class="hb-posts">${posts.map((p) => `<li><a href="/blog/${esc(p.slug)}/">${p.img ? `<img src="${esc(p.img)}" alt="${esc(p.alt)}" loading="lazy" width="80" height="60">` : ''}<span><em>${esc(p.category)}${isNew(p) ? ' <u>NEW</u>' : ''}</em><b>${esc(p.title)}</b></span></a></li>`).join('')}</ul>
<form method="post" class="hb-news"><input type="hidden" name="action" value="news"><input type="hidden" name="on" value="${newsOn ? '0' : '1'}"><span>${newsOn ? '✓ 새 글 소식 받는 중' : '새 글 소식 받기 (월 1~2회)'}</span><button class="btn ghost" type="submit"${demo ? ' disabled' : ''}>${newsOn ? '해제' : '받기'}</button></form></div>
<div class="card hb-m hb-talk"><h3>💬 언제든 물어보세요</h3>${ch ? `<p class="muted">카카오톡 채널을 추가해 두면 진행 상황·궁금한 점을 카톡으로 바로 주고받을 수 있습니다.</p><a class="sso k" href="${esc(ch)}/friend" target="_blank" rel="noopener">${SSO_ICON.kakao}카카오톡 채널 추가</a><a class="btn ghost" href="${esc(ch)}/chat" target="_blank" rel="noopener">1:1 채팅하기</a>` : `<p class="muted">마케팅 고민, 견적 없는 가격 질문 무엇이든 편하게 보내 주세요. 영업일 하루 안에 답합니다.</p>`}<a class="hb-link" href="mailto:${esc(hub.email || 'hello@bizhigher.com')}">${esc(hub.email || 'hello@bizhigher.com')} →</a></div>
</div></section>`;
}

/**
 * 시작 허브 전체 페이지
 * @param account 세션 {n,e,p} · profile owner_profiles · reports reportsForEmail() · hub hub.json
 */
export function hubHtml({ account, profile, reports = [], hub = {}, blogSeen = '', msg = '', kakaoChannel = '', demo = false }) {
  const name = esc((account && (account.n || account.e)) || '사장님');
  const has1 = !!(profile && profile.business && profile.city && (account && account.e || profile.email));
  const report = reports[0] || null;
  const has2 = !!report;
  const cur = !has1 ? 0 : !has2 ? 1 : 2;
  const done = [has1, has2, false, false];
  const email = (account && account.e) || (profile && profile.email) || '';
  const auditHref = has1 ? `/free-audit/#business=${enc(profile.business)}&location=${enc(profile.city)}&email=${enc(email)}&auto=1` : '/free-audit/';
  const rec = recommend(report, hub);
  const pkgHi = rec.pkgFirst || !report ? 'local-growth' : '';
  const biz = esc((profile && profile.business) || '');
  const acct = acctMenu(account, { demo });

  const s1 = `<section class="card hb-step${cur === 0 ? ' now' : ''}" id="s1"><div class="hb-sh"><i>${has1 ? '✓' : '1'}</i><div><h2>가게 정보</h2><p>${has1 ? `${biz} · ${esc(profile.city)}${profile.category ? ' · ' + esc(profile.category) : ''}` : '1분이면 됩니다. 무료 진단과 추천, 결제 뒤 질문지에 그대로 씁니다.'}</p></div></div>
${has1 ? `<details${cur === 0 ? ' open' : ''}><summary>고치기</summary>${profileForm(profile, account, false)}</details>` : profileForm(profile, account, true)}</section>`;

  const s2 = `<section class="card hb-step${cur === 1 ? ' now' : ''}" id="s2"><div class="hb-sh"><i>${has2 ? '✓' : '2'}</i><div><h2>60초 무료 진단</h2><p>${has2 ? '내 가게 점수와 가장 급한 문제입니다.' : '구글 지도·리뷰·웹사이트·경쟁 가게를 100점 만점으로 봅니다. 가입·결제 없이 60초.'}</p></div></div>
${has2 ? reportCardHtml(report) + `<p class="hb-sub"><a href="${esc(auditHref)}">다시 진단하기 →</a></p>` : `<a class="btn hb-big${has1 ? '' : ' off'}" href="${esc(auditHref)}">${has1 ? `${biz} 무료 진단 시작하기 →` : '먼저 1단계 가게 정보를 저장해 주세요'}</a><p class="hb-sub">진단이 끝나면 이 페이지에 점수와 추천이 자동으로 붙습니다.</p>`}</section>`;

  const recList = rec.list.length ? `<div class="hb-recs">${rec.list.map((s) => `<a href="/service/${esc(s.slug)}/"><b>${esc(s.name)}</b><span>${esc(s.short)}</span><em>${esc(s.price)}${s.priceSub ? ` <small>${esc(s.priceSub)}</small>` : ''}</em></a>`).join('')}</div>` : '';
  const s3 = `<section class="card hb-step${cur === 2 ? ' now' : ''}" id="s3"><div class="hb-sh"><i>3</i><div><h2>${report ? '진단 결과로 고른 다음 할 일' : '플랜 고르기'}</h2><p>${rec.pkgFirst ? `약한 영역이 ${rec.weak.length}개라 하나씩 사는 것보다 <b>패키지가 더 저렴</b>합니다.` : report && rec.list.length ? '점수가 가장 낮은 곳부터 고치는 서비스입니다. 셋 이상이면 패키지가 더 저렴합니다.' : '진단을 받으면 우리 가게에 맞는 순서로 골라 드립니다. 먼저 둘러보셔도 됩니다.'}</p></div></div>
${rec.pkgFirst ? plansHtml(hub, pkgHi) + recList : recList + plansHtml(hub, pkgHi)}
<p class="hb-sub">모든 상품 정찰제 · 견적 미팅 없음 · 언제든 셀프 해지. 6·12개월 플랜은 셋업 선물이 붙습니다 — <a href="/pricing/">가격 한눈에 보기</a></p></section>`;

  const s4 = `<section class="card hb-step" id="s4"><div class="hb-sh"><i>4</i><div><h2>결제하면 이렇게 진행됩니다 · 미리 준비해 두세요</h2><p>준비물이 미리 있으면 첫 결과물이 하루 이틀 빨라집니다.</p></div></div>
<div class="hb-two"><ol class="hb-flow"><li><b>결제 (1분)</b><span>Stripe 결제 — 카드번호는 저희가 보관하지 않습니다</span></li><li><b>질문지 (5분)</b><span>가게 정보·사진 올리기. 위에 적은 내용을 다시 묻지 않게 합니다</span></li><li><b>영업일 3일 안 첫 결과물</b><span>이 페이지 "결정할 것"에 올라옵니다 — 버튼 한 번으로 승인</span></li><li><b>매달 리포트</b><span>점수·지도 순위·리뷰·손님 반응을 이 페이지에서 실시간으로</span></li></ol>
<ul class="hb-prep" id="hb-prep">${PREP.map(([k, t, d]) => `<li><label><input type="checkbox" data-k="${k}"><span><b>${esc(t)}</b><em>${esc(d)}</em></span></label></li>`).join('')}</ul></div></section>`;

  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${name} — BizHigher 비즈니스</title>
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">
<style>${BASE_CSS}${DASH_CSS}${HUB_CSS}</style></head><body>
<header class="ob-top"><div class="ob-in">${LOGO_HTML}<span class="ob-biz">${biz || '비즈니스'}</span>${acct}</div></header>
<section class="ob-hello"><div class="ob-in"><p class="ob-eye">BizHigher 비즈니스${demo ? ' · 데모' : ''}</p><h1>${name}님, 반갑습니다</h1><p class="ob-sub">${cur === 0 ? '세 단계면 우리 가게에 맞는 다음 할 일이 나옵니다.' : cur === 1 ? '이제 60초 무료 진단만 받으면 됩니다.' : '진단이 끝났습니다. 다음 할 일을 골라 보세요.'}</p>${steps(cur, done)}</div></section>
${demo ? '<div class="ob-demo"><div class="ob-in"><b>데모 화면</b><span>아직 고객이 아닌 사장님이 로그인하면 보는 화면입니다. 저장 버튼은 처리되지 않습니다.</span><a href="/my/demo">고객 화면 데모 →</a></div></div>' : ''}
<div class="ob-main">${msg ? `<div class="flash">${esc(msg)}</div>` : ''}${s1}${s2}${s3}${s4}
${moreHtml({ hub, blogSeen, newsOn: !!(profile && profile.news_optin), kakaoChannel, demo })}</div>
<footer>궁금한 점은 <a href="mailto:hello@bizhigher.com">hello@bizhigher.com</a> · <a href="/privacy/">개인정보처리방침</a></footer>
<script>(function(){try{var K='bh_prep',s=JSON.parse(localStorage.getItem(K)||'{}');document.querySelectorAll('#hb-prep input[data-k]').forEach(function(c){c.checked=!!s[c.dataset.k];c.addEventListener('change',function(){s[c.dataset.k]=c.checked;try{localStorage.setItem(K,JSON.stringify(s));}catch(e){}});});}catch(e){}})();</script>
</body></html>`;
}

const HUB_CSS = `
.hb-steps{list-style:none;display:flex;gap:6px;margin:16px 0 0;padding:0;flex-wrap:wrap;position:relative;z-index:1}.hb-steps li{display:flex;align-items:center;gap:7px;font-size:13px;font-weight:700;color:#9DB4EE;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.14);border-radius:999px;padding:6px 12px 6px 6px}.hb-steps i{font-style:normal;width:22px;height:22px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;background:rgba(255,255,255,.12);color:#fff;font-size:12px}.hb-steps li.ok{color:#A7F3D0}.hb-steps li.ok i{background:#10B981}.hb-steps li.cur{background:#FBBF24;border-color:#FBBF24;color:#1F1300}.hb-steps li.cur i{background:#1F1300;color:#FBBF24}
.hb-step{margin-top:16px}.hb-step.now{border-color:#FCD34D;box-shadow:0 0 0 3px rgba(251,191,36,.2)}.hb-sh{display:flex;gap:12px;align-items:flex-start;margin-bottom:12px}.hb-sh>i{font-style:normal;flex:none;width:32px;height:32px;border-radius:10px;background:#EEF3FF;color:#0A4DF5;font-weight:900;display:flex;align-items:center;justify-content:center}.hb-step.now .hb-sh>i{background:#FBBF24;color:#1F1300}.hb-sh h2{margin:2px 0 3px;font-size:18px;font-weight:900}.hb-sh p{margin:0;color:var(--muted);font-size:14px;line-height:1.5}
.hb-form{display:grid;gap:12px}.hb-grid2{display:grid;grid-template-columns:1fr 1fr;gap:10px 14px}.hb-form label{display:flex;flex-direction:column;gap:5px;font-size:13px;font-weight:700;color:#374151}.hb-form label b{font-size:11px;color:#DC2626;font-weight:700}.hb-form label em{font-size:11px;color:var(--muted);font-style:normal;font-weight:500}.hb-form input:not([type=radio]):not([type=checkbox]),.hb-form select{height:44px;border:1.5px solid var(--line);border-radius:10px;padding:0 12px;font:inherit;font-size:15px;background:#fff}.hb-form input:disabled{background:#F3F4F7;color:var(--muted)}
.hb-goals{border:0;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:6px}.hb-goals legend{font-size:13px;font-weight:700;color:#374151;margin-bottom:6px}.hb-goals label{flex-direction:row!important;align-items:center;gap:6px!important;border:1.5px solid var(--line);border-radius:999px;padding:7px 12px;font-weight:600!important;cursor:pointer}.hb-goals label:has(input:checked){border-color:#0A4DF5;background:#EEF3FF;color:#0A4DF5}.hb-goals input{margin:0}
.hb-check{flex-direction:row!important;align-items:center;gap:8px!important;font-weight:600!important}.hb-form .btn{justify-self:start}.hb-step details>summary{cursor:pointer;color:#0A4DF5;font-weight:700;margin-bottom:10px}
.hb-big{display:block;text-align:center;padding:16px;font-size:16px}.hb-big.off{background:#E5E7EB;color:#6B7280;pointer-events:none}.hb-sub{font-size:13px;color:var(--muted);margin:10px 0 0}.hb-sub a{color:#0A4DF5;font-weight:700}
.hb-rep{display:grid;grid-template-columns:120px 1fr;gap:16px;align-items:center}.hb-ring{display:flex;flex-direction:column;align-items:center}.hb-ring svg{width:110px}.hb-ring text{font-size:24px;font-weight:900;fill:#111318}.hb-ring span{font-size:12px;color:var(--muted)}.hb-areas{display:grid;gap:7px}.hb-areas div{display:grid;grid-template-columns:84px 1fr 42px;gap:8px;align-items:center;font-size:13px}.hb-areas i{height:8px;border-radius:999px;background:#EEF1F6;overflow:hidden}.hb-areas u{display:block;height:100%;background:#0A4DF5;border-radius:999px}.hb-areas .weak u{background:#F59E0B}.hb-areas .weak span{color:#B45309;font-weight:700}.hb-areas b{text-align:right}.hb-rep-foot{grid-column:1/-1;display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;font-size:13px;color:var(--muted)}.hb-rep-foot a{color:#0A4DF5;font-weight:800}.hb-rep-foot em{font-style:normal}
.hb-recs{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px;margin-bottom:12px}.hb-recs a{display:flex;flex-direction:column;gap:4px;padding:14px;border:1.5px solid #FCD34D;background:#FFFBEB;border-radius:14px;color:inherit;text-decoration:none}.hb-recs b{font-size:15px}.hb-recs span{font-size:13px;color:#4B5563;line-height:1.45}.hb-recs em{font-style:normal;font-weight:900;font-size:17px;margin-top:auto}.hb-recs small{font-size:12px;font-weight:600;color:var(--muted)}
.hb-plans{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-bottom:6px}.hb-plan{position:relative;display:flex;flex-direction:column;gap:4px;padding:16px 14px;border:1.5px solid var(--line);border-radius:16px;color:inherit;text-decoration:none;background:#fff}.hb-plan.hot{border-color:#0A4DF5;box-shadow:0 0 0 3px rgba(10,77,245,.12)}.hb-plan b{font-size:17px;font-weight:900}.hb-plan .tl{font-size:12.5px;color:var(--muted);line-height:1.4;min-height:34px}.hb-plan .pr{font-size:13px;color:#374151;margin-top:6px}.hb-plan .pr strong{font-size:24px;font-weight:900;color:#0A1B4D}.hb-plan .pr2{font-size:12px;color:var(--muted)}.hb-plan ul{margin:8px 0 6px;padding-left:16px;font-size:13px;line-height:1.5;color:#374151}.hb-plan i{font-style:normal;margin-top:auto;font-weight:800;color:#0A4DF5;font-size:13.5px}.hb-tag{position:absolute;top:-10px;right:12px;background:#0A4DF5;color:#fff;font-size:11.5px;font-weight:800;border-radius:999px;padding:3px 10px}.hb-tag.soft{background:#EEF3FF;color:#0A4DF5}
.hb-two{display:grid;grid-template-columns:1fr 1fr;gap:16px;align-items:start}.hb-flow{margin:0;padding:0;list-style:none;counter-reset:f;display:grid;gap:10px}.hb-flow li{counter-increment:f;display:flex;flex-direction:column;padding-left:36px;position:relative;font-size:14px}.hb-flow li::before{content:counter(f);position:absolute;left:0;top:0;width:26px;height:26px;border-radius:50%;background:#0A1B4D;color:#fff;font-weight:800;font-size:13px;display:flex;align-items:center;justify-content:center}.hb-flow span{color:var(--muted);font-size:13px;line-height:1.45}
.hb-prep{list-style:none;margin:0;padding:0;display:grid;gap:6px}.hb-prep label{display:flex;gap:10px;align-items:flex-start;padding:9px 11px;border:1px solid var(--line);border-radius:10px;cursor:pointer;font-size:14px}.hb-prep label:has(input:checked){background:#ECFDF5;border-color:#A7F3D0}.hb-prep input{margin-top:3px;width:17px;height:17px;flex:none}.hb-prep span{display:flex;flex-direction:column}.hb-prep em{font-style:normal;font-size:12.5px;color:var(--muted)}.hb-prep label:has(input:checked) b{text-decoration:line-through;color:#047857}
.hb-more{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;align-items:start}.hb-m h3{margin:0 0 6px;font-size:16px;display:flex;align-items:center;gap:8px}.hb-pill{font-size:11.5px;font-weight:800;background:#ECFDF5;color:#047857;border-radius:999px;padding:2px 8px}.hb-m .muted{margin:0 0 10px;font-size:13.5px;line-height:1.5}
.hb-tools{list-style:none;margin:0 0 8px;padding:0;display:grid;gap:4px}.hb-tools a{display:flex;flex-direction:column;padding:8px 10px;border-radius:10px;color:inherit;text-decoration:none}.hb-tools a:hover{background:#F5F8FF}.hb-tools b{font-size:14px}.hb-tools span{font-size:12px;color:var(--muted);display:-webkit-box;-webkit-line-clamp:1;-webkit-box-orient:vertical;overflow:hidden}
.hb-posts{list-style:none;margin:0 0 10px;padding:0;display:grid;gap:8px}.hb-posts a{display:flex;gap:10px;align-items:center;color:inherit;text-decoration:none}.hb-posts img{width:72px;height:54px;object-fit:cover;border-radius:8px;flex:none;background:#EEF1F6}.hb-posts span{display:flex;flex-direction:column;min-width:0}.hb-posts em{font-style:normal;font-size:11.5px;color:var(--muted);font-weight:700}.hb-posts u{text-decoration:none;background:#EF4444;color:#fff;border-radius:4px;padding:0 5px;font-size:10.5px;margin-left:3px}.hb-posts b{font-size:13.5px;line-height:1.4;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}.hb-posts a:hover b{color:#0A4DF5}
.hb-news{display:flex;align-items:center;justify-content:space-between;gap:8px;border-top:1px solid var(--line);padding-top:10px;font-size:13.5px;font-weight:700}.hb-news .btn{padding:8px 14px;font-size:13px}.hb-link{display:inline-block;font-size:13.5px;font-weight:800;color:#0A4DF5;text-decoration:none;margin-top:4px}
.hb-talk .sso{width:100%;margin-bottom:8px}.hb-talk .btn{display:block;text-align:center;margin-bottom:8px}
@media (max-width:900px){.hb-more{grid-template-columns:1fr}.hb-plans{grid-template-columns:1fr}.hb-two{grid-template-columns:1fr}}
@media (max-width:560px){.hb-grid2{grid-template-columns:1fr}.hb-rep{grid-template-columns:1fr}.hb-ring{flex-direction:row;gap:10px;justify-content:center}.hb-steps li span{display:none}.hb-steps li.cur span{display:inline}}
`;
