/**
 * 비즈니스 로그인 — 구글·카카오 OAuth (2026-11-07)
 *   GET /auth/google[?link={고객 페이지 토큰}]   → 구글 계정 고르기
 *   GET /auth/google/callback                    → 계정 확인 → 세션 쿠키 → /my/
 *   GET /auth/kakao[?link=…] · /auth/kakao/callback  (같은 흐름)
 *   GET /auth/logout                             → 세션 지우고 /login/
 *   ?next=/경로 — 로그인 뒤 돌아갈 곳(우리 사이트 안만, 무료 도구 페이지가 쓴다)
 *   카카오는 KAKAO_JS_KEY 가 있으면 SDK 간편로그인(휴대폰 카카오톡 앱이 바로 열림, 아이디 입력 없음)
 * link 가 있으면 그 고객 페이지의 작업을 이 계정에 잇는다(이메일이 달라도·카카오가 이메일을 안 줘도 다음부터 바로 열린다).
 * 상태값(state)은 서명한 짧은 쿠키(10분)로 확인한다 — 다른 사이트가 콜백을 위조하지 못하게.
 * 우리가 받는 것은 계정 id·이메일·이름뿐이다. 구글·카카오 토큰은 저장하지 않는다.
 */
import { providers, sign, verify, readCookie, cookie, upsertLogin, linkJob, safeNext, SESSION_COOKIE, STATE_COOKIE, SESSION_DAYS } from '../api/_owner.js';
import { addEvent, tokenFromPath } from '../api/_orders.js';

const back = (request, path, setCookies = []) => {
  const h = new Headers({ Location: new URL(path, request.url).toString(), 'Cache-Control': 'no-store' });
  for (const c of setCookies) h.append('Set-Cookie', c);
  return new Response(null, { status: 302, headers: h });
};
const randomState = () => { const b = new Uint8Array(18); crypto.getRandomValues(b); return btoa(String.fromCharCode(...b)).replace(/[^A-Za-z0-9]/g, '').slice(0, 24); };
const form = (o) => new URLSearchParams(Object.entries(o).filter(([, v]) => v != null && v !== '')).toString();
const jwtPayload = (t) => { try { const p = String(t).split('.')[1]; return JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(p.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((p.length + 3) % 4)), (c) => c.charCodeAt(0)))); } catch { return null; } };

const AUTH = {
  google: (cfg, redirect, state) => `https://accounts.google.com/o/oauth2/v2/auth?${form({ client_id: cfg.id, redirect_uri: redirect, response_type: 'code', scope: 'openid email profile', state, prompt: 'select_account', access_type: 'online' })}`,
  kakao: (cfg, redirect, state) => `https://kauth.kakao.com/oauth/authorize?${form({ client_id: cfg.id, redirect_uri: redirect, response_type: 'code', state })}`,
};

/* 코드 → 계정 정보 {subject, email, verified, name} */
async function identity(p, cfg, code, redirect) {
  if (p === 'google') {
    const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: form({ code, client_id: cfg.id, client_secret: cfg.secret, redirect_uri: redirect, grant_type: 'authorization_code' }) });
    const j = await r.json().catch(() => ({}));
    if (!j.id_token) throw new Error('token-' + String(j.error || r.status).slice(0, 30));
    // 토큰 창구에서 TLS 로 직접 받은 id_token 이라 서명 대신 발급자·대상·만료를 확인한다(OIDC Core 3.1.3.7)
    const c = j.id_token ? jwtPayload(j.id_token) : null;
    if (!c || c.aud !== cfg.id || !/^(https:\/\/)?accounts\.google\.com$/.test(c.iss) || c.exp * 1000 < Date.now()) throw new Error('claims');
    return { subject: String(c.sub), email: c.email || '', verified: c.email_verified === true || c.email_verified === 'true', name: c.name || c.given_name || '' };
  }
  if (p === 'kakao') {
    // 간편로그인(SDK)으로 받은 코드는 JavaScript 키로 발급된다. 카카오의 키별 설정(2025~)에서는 REST 키로 바꾸면 거절될 수 있어
    // REST 키로 먼저 해 보고 안 되면 JavaScript 키(+ 그 키의 시크릿 KAKAO_JS_CLIENT_SECRET)로 한 번 더 (2026-11-07)
    const tryToken = async (id, secret) => { const r = await fetch('https://kauth.kakao.com/oauth/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' }, body: form({ grant_type: 'authorization_code', client_id: id, client_secret: secret, redirect_uri: redirect, code }) }); const j = await r.json().catch(() => ({})); return { j, code: String(j.error_code || j.error || r.status).slice(0, 20) }; };
    let t = await tryToken(cfg.id, cfg.secret);
    if (!t.j.access_token && cfg.jsKey) { const t2 = await tryToken(cfg.jsKey, cfg.jsSecret); if (t2.j.access_token) t = t2; else t.code += '_js-' + t2.code; }
    const j = t.j;
    if (!j.access_token) throw new Error('token-' + t.code);
    const me = await fetch('https://kapi.kakao.com/v2/user/me', { headers: { Authorization: `Bearer ${j.access_token}` } }).then((x) => x.json()).catch(() => null);
    if (!me || !me.id) throw new Error('me');
    const a = me.kakao_account || {};
    return { subject: String(me.id), email: a.email || '', verified: !!(a.email && a.is_email_valid && a.is_email_verified), name: (a.profile && a.profile.nickname) || (me.properties && me.properties.nickname) || '' };
  }
  return null;
}

/* 카카오 간편로그인 중간 화면 — 휴대폰이면 카카오톡 앱이 바로 열리고(throughTalk), PC·앱 없음이면 SDK 가 웹 로그인으로 넘긴다 */
function talkPage(jsKey, redirect, state, webUrl, setCookie) {
  const j = (v) => JSON.stringify(v).replace(/</g, '\\u003c');
  const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>카카오로 로그인 중… | BizHigher</title>
<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:-apple-system,'Apple SD Gothic Neo',sans-serif;background:#FEE500;color:#191919}.b{text-align:center;padding:24px}.s{width:34px;height:34px;border:4px solid rgba(0,0,0,.15);border-top-color:#191919;border-radius:50%;margin:0 auto 16px;animation:r 1s linear infinite}@keyframes r{to{transform:rotate(360deg)}}a{color:#191919;font-weight:700}</style></head>
<body><div class="b"><div class="s"></div><p>카카오톡으로 로그인하는 중…</p><p style="font-size:13px;opacity:.7">카카오톡이 열리지 않으면 <a id="w" href="${webUrl.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}">여기를 눌러 주세요</a></p></div>
<script src="https://t1.kakaocdn.net/kakao_js_sdk/2.7.4/kakao.min.js" integrity="sha384-DKYJZ8NLiK8MN4/C5P2dtSmLQ4KwPaoqAfyA/DfmEc1VDxu4yyC7wy6K1Hs90nka" crossorigin="anonymous"></script>
<script>(function(){var web=${j(webUrl)};try{Kakao.init(${j(jsKey)});Kakao.Auth.authorize({redirectUri:${j(redirect)},state:${j(state)},throughTalk:true});}catch(e){location.replace(web);}})();</script></body></html>`;
  const h = new Headers({ 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex', 'Referrer-Policy': 'same-origin' });
  h.append('Set-Cookie', setCookie);
  return new Response(html, { status: 200, headers: h });
}

export async function onRequestGet({ request, env, params }) {
  const parts = [].concat(params.path || []);
  const [p, step] = parts;
  const url = new URL(request.url);

  if (p === 'logout') return back(request, '/login/?out=1', [cookie(SESSION_COOKIE, '', 0)]);
  if (!AUTH[p]) return back(request, '/login/');
  const cfg = providers(env)[p];
  if (!cfg || !env.DB) return back(request, `/login/?err=setup&p=${p}`);
  const redirect = `${url.origin}/auth/${p}/callback`;

  if (!step) {
    const link = tokenFromPath(url.searchParams.get('link') || '');
    // state = 서명한 값 자체(2026-11-07). 카카오톡 앱이 로그인 뒤 처음과 다른 브라우저로 돌아오면 상태 쿠키가 없어 "시간이 지났어요"로 튕겼다 —
    // 이제 쿠키가 없어도 state 의 서명·만료로 확인하고, 쿠키가 있으면 같은 시작인지(nonce)까지 맞춘다
    const signed = await sign(env, { s: randomState(), p, link: link.length >= 16 ? link : '', next: safeNext(url.searchParams.get('next')), exp: Date.now() + 10 * 60000 });
    if (!signed) return back(request, `/login/?err=setup&p=${p}`);
    const state = signed;
    // 카카오 간편로그인(2026-11-07): JavaScript 키가 있으면 SDK 가 휴대폰의 카카오톡 앱을 바로 열어 아이디 입력 없이 동의만 받는다.
    // 인가 코드는 같으므로 콜백·토큰 교환(REST 키)은 그대로. 앱이 없거나 PC 면 SDK 가 웹 로그인으로 넘기고, SDK 자체가 안 뜨면 기존 웹 로그인으로
    const jsKey = String(env.KAKAO_JS_KEY || '').trim();
    if (p === 'kakao' && jsKey) return talkPage(jsKey, redirect, state, AUTH.kakao(cfg, redirect, state), cookie(STATE_COOKIE, signed, 600));
    return back(request, AUTH[p](cfg, redirect, state), [cookie(STATE_COOKIE, signed, 600)]);
  }
  if (step !== 'callback') return back(request, '/login/');

  const st = await verify(env, url.searchParams.get('state') || '');
  const ck = await verify(env, readCookie(request, STATE_COOKIE));
  const clear = cookie(STATE_COOKIE, '', 0);
  if (url.searchParams.get('error')) return back(request, `/login/?err=cancel&p=${p}&why=${encodeURIComponent(String(url.searchParams.get('error')).slice(0, 30))}`, [clear]);
  if (!st || st.p !== p) return back(request, `/login/?err=state&p=${p}&why=${st ? 'provider' : 'expired'}`, [clear]);
  if (ck && ck.s !== st.s) return back(request, `/login/?err=state&p=${p}&why=mismatch`, [clear]);
  // 실패 원인 코드(why)를 로그인 화면에 작게 보여 준다 — 사장님이 캡처를 보내면 바로 원인을 안다
  let who = null, why = '';
  try { who = await identity(p, cfg, url.searchParams.get('code') || '', redirect); } catch (e) { why = String((e && e.message) || 'x').replace(/[^\w-]/g, '').slice(0, 40); }
  if (!who) return back(request, `/login/?err=fail&p=${p}&why=${encodeURIComponent(why || 'x')}`, [clear]);

  const login = await upsertLogin(env.DB, { provider: p, ...who });
  let ok = '';
  if (st.link) {
    const job = await env.DB.prepare(`SELECT id FROM jobs WHERE portal_token = ?`).bind(st.link).first().catch(() => null);
    if (job && (await linkJob(env.DB, login.id, job.id, 'link'))) {
      await addEvent(env.DB, job.id, 'customer', null, null, `🔑 비즈니스 로그인 연결 — ${p === 'google' ? 'Google' : '카카오'}${who.email ? ` (${who.email})` : ''}`).catch(() => {});
      ok = '?ok=linked';
    }
  }
  // 세션의 e 는 제공자가 확인한 이메일만(확인 안 된 이메일로 남의 작업·도구 리드에 붙지 않게)
  const s = await sign(env, { lid: login.id, n: who.name || '', e: who.verified ? who.email || '' : '', p, exp: Date.now() + SESSION_DAYS * 86400000 });
  const dest = st.next && !ok ? st.next : '/my/' + ok;
  return back(request, dest, [clear, cookie(SESSION_COOKIE, s, SESSION_DAYS * 86400)]);
}
