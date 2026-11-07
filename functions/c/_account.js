/**
 * 계정·설정 — /my/account (2026-11-07 David: "설정 같은 섹션과 필요하고 관계있는 것들을 모아 놓고, 로그아웃은 찾아서 하게")
 * 순서: 계정(로그인 방법·이메일) → 가게 정보(owner_profiles, 시작 허브와 같은 폼) → 진행 중인 서비스(연결된 작업)
 *       → 알림·소식 → 도움말(문의·카카오톡 채널·약관) → 로그아웃(맨 아래) · 계정 삭제 요청 안내
 * 상단 아바타 메뉴(_dash.js acctMenu)가 이 페이지로 온다. 데모는 /my/demo/account(저장 안 됨)
 */
import { BASE_CSS, DASH_CSS, LOGO_HTML, acctMenu, SSO_ICON } from './_dash.js';
import { profileForm, HUB_CSS } from './_hub.js';

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const MSG = { profile: '가게 정보를 저장했습니다.', news: '알림 설정을 바꿨습니다.', demo: '데모 화면이라 저장되지 않았습니다.' };
const PROV = { google: 'Google', kakao: '카카오', demo: '데모' };

export function accountHtml({ account, login, profile, jobs = [], kakaoChannel = '', ok = '', demo = false }) {
  const name = esc(account.n || account.e || '사장님');
  const prov = PROV[account.p] || '';
  const since = login && login.created_at ? String(login.created_at).slice(0, 10) : '';
  const email = account.e || (profile && profile.email) || '';
  const newsOn = !!(profile && profile.news_optin);
  const ch = String(kakaoChannel || '').replace(/\/+$/, '');
  const home = demo ? '/my/demo' : '/my/';

  const sec = (id, icon, title, body) => `<section class="card ac-sec" id="${id}"><h2><i>${icon}</i>${title}</h2>${body}</section>`;
  const rows = (pairs) => `<dl class="ac-dl">${pairs.filter(Boolean).map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>`;

  const s1 = sec('account', '👤', '계정', rows([
    ['이름', name],
    ['로그인 방법', `<span class="ac-prov ac-${esc(account.p)}">${account.p === 'google' ? SSO_ICON.google : account.p === 'kakao' ? SSO_ICON.kakao : ''}${prov}</span>`],
    ['이메일', email ? esc(email) : '<span class="muted">없음 — 아래 가게 정보에 연락받을 이메일을 적어 주세요</span>'],
    since && ['처음 로그인', esc(since)],
  ]) + '<p class="muted ac-note">구글과 카카오를 둘 다 쓰고 싶으시면, 메일로 받으신 고객 페이지 위쪽의 [Google로 연결]·[카카오로 연결]을 누르면 같은 가게로 이어집니다.</p>');

  const s2 = sec('biz', '🏪', '가게 정보', '<p class="muted ac-note">무료 진단·추천·결제 뒤 질문지에 그대로 씁니다.</p>' + profileForm(profile, account, false, 'account'));

  const s3 = sec('services', '📦', '진행 중인 서비스', jobs.length
    ? `<ul class="ac-jobs">${jobs.map((j) => `<li><a href="${demo ? '/my/demo' : `/my/?job=${j.id}`}"><b>${esc(String(j.business || '').replace(/\s*\(데모\)/, ''))}</b><span>${esc(j.service_name || '')}</span><i>열기 →</i></a></li>`).join('')}</ul><p class="muted ac-note">구독 해지·결제 카드 변경은 결제 영수증 메일의 "구독 관리" 링크(Stripe)에서 언제든 직접 하실 수 있습니다.</p>`
    : `<p class="muted">아직 진행 중인 서비스가 없습니다.</p><a class="btn" href="${home}">무료 진단부터 시작하기 →</a>`);

  const s4 = sec('news', '🔔', '알림·소식', `<form method="post" class="ac-row"><input type="hidden" name="action" value="news"><input type="hidden" name="back" value="account"><input type="hidden" name="on" value="${newsOn ? '0' : '1'}"><span><b>새 마케팅 가이드 소식</b><em>월 1~2회, 새 글을 모아서 보내 드립니다. 언제든 해제할 수 있습니다.</em></span><button class="btn ${newsOn ? 'ghost' : ''}" type="submit">${newsOn ? '받는 중 · 해제' : '받기'}</button></form>
<p class="muted ac-note">결과물·승인 요청 안내는 이 설정과 상관없이, 진행 중인 서비스가 있을 때 담당자가 필요한 때만 보내 드립니다.</p>`);

  const s5 = sec('help', '💬', '도움말', `<div class="ac-help">${ch ? `<a class="sso k" href="${esc(ch)}/chat" target="_blank" rel="noopener">${SSO_ICON.kakao}카카오톡 1:1 채팅</a>` : ''}<a class="btn ghost" href="mailto:hello@bizhigher.com">hello@bizhigher.com 으로 문의</a></div>
<ul class="ac-links"><li><a href="/#faq">자주 묻는 질문</a></li><li><a href="/pricing/">가격 한눈에 보기</a></li><li><a href="/terms/">이용약관</a></li><li><a href="/privacy/">개인정보처리방침</a></li></ul>`);

  const s6 = `<section class="card ac-sec ac-out" id="logout"><h2><i>🚪</i>로그아웃</h2><p class="muted">이 기기에서만 로그아웃됩니다. 다음에 다시 ${prov || '구글·카카오'}로 클릭 한 번이면 들어오실 수 있어요.</p>
${demo ? '<a class="btn ghost" href="/login/">로그인 화면으로</a>' : '<a class="btn ac-out-btn" href="/auth/logout">로그아웃</a>'}
<p class="muted ac-note">계정과 가게 정보를 지우고 싶으시면 <a href="mailto:hello@bizhigher.com?subject=${encodeURIComponent('BizHigher 계정 삭제 요청')}">hello@bizhigher.com</a> 으로 알려 주세요. 영업일 3일 안에 지우고 알려 드립니다.</p></section>`;

  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>계정·설정 — BizHigher 비즈니스</title>
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">
<style>${BASE_CSS}${DASH_CSS}${HUB_CSS}${AC_CSS}</style></head><body>
<header class="ob-top"><div class="ob-in">${LOGO_HTML}<span class="ob-biz">계정·설정</span>${acctMenu(account, { demo })}</div></header>
<nav class="ob-nav" aria-label="설정 메뉴"><a href="${home}">← 내 페이지</a><a href="#account">계정</a><a href="#biz">가게 정보</a><a href="#services">서비스</a><a href="#news">알림</a><a href="#help">도움말</a></nav>
${demo ? '<div class="ob-demo"><div class="ob-in"><b>데모 화면</b><span>저장 버튼은 처리되지 않습니다.</span></div></div>' : ''}
<div class="ob-main ac-main">${MSG[ok] ? `<div class="flash">${esc(MSG[ok])}</div>` : ''}<h1 class="ac-h1">계정·설정</h1>${s1}${s2}${s3}${s4}${s5}${s6}</div>
<footer>BizHigher 비즈니스 · <a href="mailto:hello@bizhigher.com">hello@bizhigher.com</a></footer></body></html>`;
}

const AC_CSS = `
.ac-main{max-width:760px}.ac-h1{font-size:24px;font-weight:900;margin:22px 2px 4px;letter-spacing:-.02em}
.ac-sec{margin-top:14px;scroll-margin-top:64px}.ac-sec h2{display:flex;align-items:center;gap:8px;font-size:17px;margin:0 0 12px}.ac-sec h2 i{font-style:normal}
.ac-dl{display:grid;grid-template-columns:110px 1fr;gap:10px 14px;margin:0;font-size:15px}.ac-dl dt{color:var(--muted);font-weight:700}.ac-dl dd{margin:0;word-break:break-all}
.ac-prov{display:inline-flex;align-items:center;gap:6px;font-weight:700}.ac-prov svg{width:18px;height:18px}.ac-note{font-size:13px;margin:12px 0 0;line-height:1.55}.ac-note a{color:#0A4DF5;font-weight:700}
.ac-jobs{list-style:none;margin:0;padding:0;display:grid;gap:8px}.ac-jobs a{display:grid;grid-template-columns:1fr auto;gap:2px 10px;padding:12px 14px;border:1px solid var(--line);border-radius:12px;color:inherit;text-decoration:none}.ac-jobs a:hover{border-color:#0A4DF5}.ac-jobs span{grid-column:1;font-size:13px;color:var(--muted)}.ac-jobs i{grid-row:1/3;grid-column:2;align-self:center;font-style:normal;font-weight:800;color:#0A4DF5;font-size:13.5px}
.ac-row{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}.ac-row span{display:flex;flex-direction:column;gap:2px;flex:1 1 240px}.ac-row em{font-style:normal;font-size:13px;color:var(--muted)}
.ac-help{display:flex;flex-wrap:wrap;gap:8px}.ac-help .sso{flex:1 1 220px}.ac-help .btn{flex:1 1 220px;text-align:center}.ac-links{list-style:none;margin:14px 0 0;padding:0;display:flex;flex-wrap:wrap;gap:6px 16px;font-size:14px}.ac-links a{color:#374151;font-weight:600}
.ac-out{border-color:#FECACA}.ac-out-btn{background:#fff;color:#DC2626;border:1.5px solid #FCA5A5}.ac-out-btn:hover{background:#FEF2F2}
@media (max-width:560px){.ac-dl{grid-template-columns:1fr;gap:2px}.ac-dl dd{margin-bottom:8px}}
`;
