/**
 * 비즈니스 로그인 사장님 페이지 (2026-11-07)
 *   GET  /my/             로그인 → 작업이 있으면 대시보드(_dash.js, 작업 여럿이면 ?job=ID) + 아래 "더 받기"
 *                         작업이 없으면 시작 허브(_hub.js): 가게 정보 → 무료 진단 → 추천·플랜 → 준비물. 로그인 안 했으면 /login/
 *   POST /my/             action=profile(가게 정보) · news(새 글 소식) · 그 밖은 고객 페이지와 같은 버튼 처리(handleAction, ?job=ID)
 *   GET  /my/demo         데모 고객(가상의 순두부 하우스, D1 없이 _demo.js) · /my/demo/start = 아직 고객이 아닌 사장님 데모
 * 데이터 hub.json(build.js) 은 정적 파일이라 env.ASSETS 로 읽는다. 카카오톡 채널 버튼은 KAKAO_CHANNEL_URL 이 있을 때만
 */
import { session, jobsForLogin, getProfile, saveProfile, setNewsOptin, touchBlogSeen, reportsForEmail, ownerEmail } from '../api/_owner.js';
import { load, dashboardHtml, handleAction, html, MSG } from '../c/[token].js';
import { DEMO_PATH, DEMO_ACCOUNT } from '../c/_demo.js';
import { ensurePortalToken } from '../api/_orders.js';
import { hubHtml, moreHtml } from '../c/_hub.js';
import { accountHtml } from '../c/_account.js';

const go = (request, path) => Response.redirect(new URL(path, request.url).toString(), 303);
const ANCHOR = { approve: '#decide', choice: '#decide', revise: '#decide', reply: '#decide', site: '#site', demo: '#decide', linked: '' };

let HUB = null;
async function hubData(env, request) {
  if (HUB) return HUB;
  try { const r = await env.ASSETS.fetch(new URL('/data/hub.json', request.url).toString()); if (r.ok) HUB = await r.json(); } catch {}
  return HUB || {};
}
const channel = (env) => String(env.KAKAO_CHANNEL_URL || '').trim();

/* 아직 고객이 아닌 사장님 데모 — 가게 정보와 진단까지 마친 상태 */
const DEMO_START = {
  profile: { business: '하나 안경원', city: 'Fullerton, CA', category: '안경점', phone: '', website: '', goal: '새 손님 늘리기', news_optin: 1 },
  reports: [{ id: 'demo', href: '/sample-report/', business: '하나 안경원', location: 'Fullerton, CA', created_at: new Date(Date.now() - 2 * 86400000).toISOString(), expired: false,
    scores: { total: 52, areas: [{ key: 'exposure', label: '구글 노출', score: 9, max: 20 }, { key: 'reviews', label: '리뷰·평판', score: 8, max: 20 }, { key: 'website', label: '웹사이트', score: 11, max: 20 }, { key: 'completeness', label: '정보 완성도', score: 15, max: 20 }, { key: 'competitive', label: '경쟁사 대비', score: 9, max: 20 }] },
    recs: ['google-profile-optimization', 'review-qr-kit'] }],
};

async function pick(request, env) {
  const s = await session(request, env);
  if (!s || !env.DB) return { redirect: '/login/' };
  const jobs = await jobsForLogin(env.DB, s.lid);
  if (!jobs.length) return { s, jobs };
  const want = Number(new URL(request.url).searchParams.get('job'));
  const job = jobs.find((j) => j.id === want) || jobs[0];
  job.portal_token = await ensurePortalToken(env.DB, job);
  return { s, jobs, job };
}

export async function onRequestGet({ request, env, params }) {
  const parts = [].concat(params.path || []);
  const u = new URL(request.url);
  const hub = await hubData(env, request);
  if (parts[0] === 'demo' && parts[1] === 'account') {
    return html(accountHtml({ account: DEMO_ACCOUNT, login: { created_at: new Date(Date.now() - 184 * 86400000).toISOString() }, profile: { ...DEMO_START.profile, business: '순두부 하우스', city: 'Garden Grove, CA', category: '식당' }, jobs: [{ id: 0, business: '순두부 하우스', service_name: 'Local Growth · 6개월 플랜' }], kakaoChannel: channel(env), ok: u.searchParams.get('ok') || '', demo: true }));
  }
  if (parts[0] === 'account') {
    const s = await session(request, env).catch(() => null);
    if (!s || !env.DB) return go(request, '/login/?next=' + encodeURIComponent('/my/account'));
    const [profile, jobs, login] = await Promise.all([getProfile(env.DB, s.lid).catch(() => null), jobsForLogin(env.DB, s.lid).catch(() => []), env.DB.prepare('SELECT created_at FROM owner_logins WHERE id = ?').bind(s.lid).first().catch(() => null)]);
    return html(accountHtml({ account: s, login, profile, jobs, kakaoChannel: channel(env), ok: u.searchParams.get('ok') || '' }));
  }
  if (parts[0] === 'demo' && parts[1] === 'start') {
    return html(hubHtml({ account: DEMO_ACCOUNT, ...DEMO_START, hub, kakaoChannel: channel(env), msg: MSG[u.searchParams.get('ok')] || '', demo: true }));
  }
  if (parts[0] === 'demo') {
    const data = await load(env, DEMO_PATH, u.origin);
    return html(await dashboardHtml(env, data, { url: request.url, mode: 'demo', account: DEMO_ACCOUNT, extra: moreHtml({ hub, kakaoChannel: channel(env), demo: true }) }));
  }
  if (parts.length) return go(request, '/my/');
  const r = await pick(request, env);
  if (r.redirect) return go(request, r.redirect);
  const profile = await getProfile(env.DB, r.s.lid).catch(() => null);
  const latest = (hub.posts && hub.posts[0] && hub.posts[0].date) || '';
  const blogSeen = await touchBlogSeen(env.DB, r.s.lid, latest).catch(() => '');
  const more = { hub, blogSeen, newsOn: !!(profile && profile.news_optin), kakaoChannel: channel(env) };
  if (!r.job) {
    const reports = await reportsForEmail(env.DB, ownerEmail(r.s, profile));
    return html(hubHtml({ account: r.s, profile, reports, hub, blogSeen, kakaoChannel: channel(env), msg: MSG[u.searchParams.get('ok')] || '' }));
  }
  const data = await load(env, r.job.portal_token, u.origin);
  if (!data) return html(hubHtml({ account: r.s, profile, hub, blogSeen, kakaoChannel: channel(env) }));
  return html(await dashboardHtml(env, data, { url: request.url, mode: 'owner', account: r.s, jobs: r.jobs, jobId: r.job.id, extra: moreHtml(more) }));
}

export async function onRequestPost({ request, env, params, waitUntil }) {
  const parts = [].concat(params.path || []);
  if (parts[0] === 'demo') return go(request, parts[1] === 'start' ? '/my/demo/start?ok=demo' : parts[1] === 'account' ? '/my/demo/account?ok=demo' : '/my/demo?ok=demo#decide');
  const s = await session(request, env).catch(() => null);
  if (!s || !env.DB) return go(request, '/login/');
  const form = await request.formData().catch(() => null);
  if (!form) return html('bad request', 400);
  const action = String(form.get('action') || '');
  if (action === 'profile') {
    const o = {}; for (const k of ['business', 'city', 'category', 'phone', 'website', 'email', 'goal', 'news_optin']) o[k] = form.get(k) || '';
    if (!String(o.business).trim() || !String(o.city).trim()) return go(request, '/my/#s1');
    await saveProfile(env.DB, s.lid, o);
    return go(request, form.get('back') === 'account' ? '/my/account?ok=profile#biz' : '/my/?ok=profile#s2');
  }
  if (action === 'news') {
    await setNewsOptin(env.DB, s.lid, String(form.get('on')) === '1');
    if (form.get('back') === 'account') return go(request, '/my/account?ok=news#news');
    const job = new URL(request.url).searchParams.get('job');
    return go(request, `/my/?${job ? 'job=' + encodeURIComponent(job) + '&' : ''}ok=news#more`);
  }
  const r = await pick(request, env);
  if (r.redirect) return go(request, r.redirect);
  if (!r.job) return go(request, '/my/');
  const data = await load(env, r.job.portal_token, new URL(request.url).origin);
  if (!data) return html('bad request', 400);
  const res = await handleAction(env, data, form, waitUntil, `사장님 페이지(${s.p === 'kakao' ? '카카오' : 'Google'} 로그인)`);
  if (res.error) return html(res.error, res.status || 400);
  return go(request, `/my/?job=${r.job.id}&ok=${res.ok}${ANCHOR[res.ok] || ''}`);
}
