/**
 * 사장님 페이지 — 구글·카카오로 로그인한 사장님의 대시보드 (2026-11-07)
 *   GET  /my/            로그인 → 내 가게 대시보드(작업이 여럿이면 위에서 고른다, ?job=ID). 로그인 안 했으면 /login/
 *   POST /my/?job=ID     승인·선택·수정 요청·답변 — 고객 페이지(/c/{token})와 같은 처리(handleAction)
 *   GET  /my/demo        데모 사장님(가상의 순두부 하우스, D1 없이 _demo.js) · POST 는 처리하지 않고 안내만
 * 화면은 /c/{token} 과 같다(_dash.js). 연결된 가게가 없으면 연결 방법을 안내한다.
 */
import { session, jobsForLogin } from '../api/_owner.js';
import { load, dashboardHtml, handleAction, html } from '../c/[token].js';
import { DEMO_PATH, DEMO_ACCOUNT } from '../c/_demo.js';
import { ensurePortalToken } from '../api/_orders.js';

const go = (request, path) => Response.redirect(new URL(path, request.url).toString(), 303);
const ANCHOR = { approve: '#decide', choice: '#decide', revise: '#decide', reply: '#decide', site: '#site', demo: '#decide', linked: '' };

function noJobsPage(acct) {
  const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>연결된 가게가 없습니다 | BizHigher</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">
<style>body{margin:0;font-family:Pretendard,-apple-system,sans-serif;background:#F3F4F7;color:#111318}.w{max-width:520px;margin:48px auto;padding:0 16px}.c{background:#fff;border:1px solid #E5E7EB;border-radius:18px;padding:26px 22px}h1{font-size:22px;margin:0 0 8px}p,li{font-size:15px;line-height:1.65;color:#374151}ol{padding-left:20px}a.b{display:inline-block;margin:6px 8px 0 0;background:#0A4DF5;color:#fff;border-radius:999px;padding:11px 18px;font-weight:700;text-decoration:none}a.g{background:#fff;color:#0A4DF5;border:1.5px solid #0A4DF5}small{color:#6B7280}</style></head>
<body><div class="w"><div class="c"><h1>아직 연결된 가게가 없습니다</h1>
<p><b>${esc(acct.n || acct.e || '이 계정')}</b>${acct.e ? ` (${esc(acct.e)})` : ''} 으로 로그인하셨습니다. 이 계정에 이어진 BizHigher 작업을 찾지 못했어요.</p>
<ol><li>결제·질문지에 쓰신 이메일과 같은 <b>구글 계정</b>이면 바로 연결됩니다.</li><li>다른 계정이거나 카카오로 들어오셨다면, 받으신 메일의 <b>고객 페이지 링크</b>를 열고 위쪽의 [Google로 연결]·[카카오로 연결]을 한 번 눌러 주세요. 다음부터는 이 로그인으로 바로 열립니다.</li></ol>
<p><a class="b" href="/auth/logout">다른 계정으로 로그인</a><a class="b g" href="/my/demo">데모 화면 보기</a></p>
<p><small>도움이 필요하시면 <a href="mailto:hello@bizhigher.com">hello@bizhigher.com</a></small></p></div></div></body></html>`;
}

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
  const origin = new URL(request.url).origin;
  if (parts[0] === 'demo') {
    const data = await load(env, DEMO_PATH, origin);
    return html(await dashboardHtml(env, data, { url: request.url, mode: 'demo', account: DEMO_ACCOUNT }));
  }
  if (parts.length) return go(request, '/my/');
  const r = await pick(request, env);
  if (r.redirect) return go(request, r.redirect);
  if (!r.job) return html(noJobsPage(r.s));
  const data = await load(env, r.job.portal_token, origin);
  if (!data) return html(noJobsPage(r.s));
  return html(await dashboardHtml(env, data, { url: request.url, mode: 'owner', account: r.s, jobs: r.jobs, jobId: r.job.id }));
}

export async function onRequestPost({ request, env, params, waitUntil }) {
  const parts = [].concat(params.path || []);
  if (parts[0] === 'demo') return go(request, '/my/demo?ok=demo#decide');
  const r = await pick(request, env);
  if (r.redirect) return go(request, r.redirect);
  if (!r.job) return go(request, '/my/');
  const data = await load(env, r.job.portal_token, new URL(request.url).origin);
  const form = await request.formData().catch(() => null);
  if (!data || !form) return html('bad request', 400);
  const res = await handleAction(env, data, form, waitUntil, `사장님 페이지(${r.s.p === 'kakao' ? '카카오' : 'Google'} 로그인)`);
  if (res.error) return html(res.error, res.status || 400);
  return go(request, `/my/?job=${r.job.id}&ok=${res.ok}${ANCHOR[res.ok] || ''}`);
}
