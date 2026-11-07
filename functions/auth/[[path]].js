/**
 * 비즈니스 로그인 — 구글·카카오 OAuth (2026-11-07)
 *   GET /auth/google[?link={고객 페이지 토큰}]   → 구글 계정 고르기
 *   GET /auth/google/callback                    → 계정 확인 → 세션 쿠키 → /my/
 *   GET /auth/kakao[?link=…] · /auth/kakao/callback  (같은 흐름)
 *   GET /auth/logout                             → 세션 지우고 /login/
 * link 가 있으면 그 고객 페이지의 작업을 이 계정에 잇는다(이메일이 달라도·카카오가 이메일을 안 줘도 다음부터 바로 열린다).
 * 상태값(state)은 서명한 짧은 쿠키(10분)로 확인한다 — 다른 사이트가 콜백을 위조하지 못하게.
 * 우리가 받는 것은 계정 id·이메일·이름뿐이다. 구글·카카오 토큰은 저장하지 않는다.
 */
import { providers, sign, verify, readCookie, cookie, upsertLogin, linkJob, SESSION_COOKIE, STATE_COOKIE, SESSION_DAYS } from '../api/_owner.js';
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
    // 토큰 창구에서 TLS 로 직접 받은 id_token 이라 서명 대신 발급자·대상·만료를 확인한다(OIDC Core 3.1.3.7)
    const c = j.id_token ? jwtPayload(j.id_token) : null;
    if (!c || c.aud !== cfg.id || !/^(https:\/\/)?accounts\.google\.com$/.test(c.iss) || c.exp * 1000 < Date.now()) return null;
    return { subject: String(c.sub), email: c.email || '', verified: c.email_verified === true || c.email_verified === 'true', name: c.name || c.given_name || '' };
  }
  if (p === 'kakao') {
    const r = await fetch('https://kauth.kakao.com/oauth/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' }, body: form({ grant_type: 'authorization_code', client_id: cfg.id, client_secret: cfg.secret, redirect_uri: redirect, code }) });
    const j = await r.json().catch(() => ({}));
    if (!j.access_token) return null;
    const me = await fetch('https://kapi.kakao.com/v2/user/me', { headers: { Authorization: `Bearer ${j.access_token}` } }).then((x) => x.json()).catch(() => null);
    if (!me || !me.id) return null;
    const a = me.kakao_account || {};
    return { subject: String(me.id), email: a.email || '', verified: !!(a.email && a.is_email_valid && a.is_email_verified), name: (a.profile && a.profile.nickname) || (me.properties && me.properties.nickname) || '' };
  }
  return null;
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
    const state = randomState();
    const signed = await sign(env, { s: state, p, link: link.length >= 16 ? link : '', exp: Date.now() + 10 * 60000 });
    if (!signed) return back(request, `/login/?err=setup&p=${p}`);
    return back(request, AUTH[p](cfg, redirect, state), [cookie(STATE_COOKIE, signed, 600)]);
  }
  if (step !== 'callback') return back(request, '/login/');

  const st = await verify(env, readCookie(request, STATE_COOKIE));
  const clear = cookie(STATE_COOKIE, '', 0);
  if (url.searchParams.get('error')) return back(request, '/login/?err=cancel', [clear]);
  if (!st || st.p !== p || st.s !== url.searchParams.get('state')) return back(request, '/login/?err=state', [clear]);
  const who = await identity(p, cfg, url.searchParams.get('code') || '', redirect).catch(() => null);
  if (!who) return back(request, `/login/?err=fail&p=${p}`, [clear]);

  const login = await upsertLogin(env.DB, { provider: p, ...who });
  let ok = '';
  if (st.link) {
    const job = await env.DB.prepare(`SELECT id FROM jobs WHERE portal_token = ?`).bind(st.link).first().catch(() => null);
    if (job && (await linkJob(env.DB, login.id, job.id, 'link'))) {
      await addEvent(env.DB, job.id, 'customer', null, null, `🔑 비즈니스 로그인 연결 — ${p === 'google' ? 'Google' : '카카오'}${who.email ? ` (${who.email})` : ''}`).catch(() => {});
      ok = '?ok=linked';
    }
  }
  const s = await sign(env, { lid: login.id, n: who.name || '', e: who.email || '', p, exp: Date.now() + SESSION_DAYS * 86400000 });
  return back(request, '/my/' + ok, [clear, cookie(SESSION_COOKIE, s, SESSION_DAYS * 86400)]);
}
