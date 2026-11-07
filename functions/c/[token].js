/**
 * 고객 결과물 페이지 — GET /c/{token} · POST /c/{token} (승인·선택·수정 요청·답변)
 * 작업(jobs.portal_token)마다 하나. 메일 링크로 여는 화면 — 추측 불가능한 24자 토큰이 곧 열쇠. 검색 금지(noindex).
 * 화면은 사장님 대시보드(_dash.js) — 로그인 사장님 페이지(/my/)·데모(/my/demo)와 같다(2026-11-07).
 * 보여 주는 것: 고객에게 전달된(sent_at) 결과물만. ?preview=1 은 David 미리보기(전달 전 것도 표시).
 * 승인이 필요한 결과물(needs_approval)은 [승인] / [수정 요청] 버튼 → job_tasks 에 반영돼 루틴이 다음 단계를 돈다.
 * 데모 토큰(_demo.js DEMO_TOKEN)은 D1 대신 고정 데이터로 그리고, 버튼은 처리하지 않는다.
 */
import { ensureSchema, addEvent, approveDeliverable, parseOptions, tokenFromPath } from '../api/_orders.js';
import { wakeRoutine } from '../api/_runner.js';
import { customerTitle } from '../api/_playbook.js';
import { notify } from '../api/_notify.js';
import { liveReportHtml, reportPeriods, storedReport } from './_live.js';
import { portalHtml } from './_portal.js';
import { renderDashboard, reportCard } from './_dash.js';
import { DEMO_TOKEN, demoDb } from './_demo.js';

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export async function load(env, token, origin) {
  const t = tokenFromPath(token); // /c/{업체명}-{토큰} 또는 옛 /c/{토큰}
  const demo = t === DEMO_TOKEN;
  const db = demo ? demoDb(origin) : env.DB;
  if (t.length < 16 || !db) return null;
  if (!demo) await ensureSchema(db); // 데모 DB 로 부르면 진짜 D1 의 스키마 준비 표시가 먼저 켜져 버린다
  const job = await db.prepare(`SELECT * FROM jobs WHERE portal_token = ?`).bind(t).first();
  if (!job) return null;
  const site = await db.prepare(`SELECT * FROM sites WHERE job_id = ?`).bind(job.id).first().catch(() => null);
  const siteTask = site ? await db.prepare(`SELECT id, status, revise_note FROM job_tasks WHERE job_id = ? AND key = 'web-2' ORDER BY id DESC LIMIT 1`).bind(job.id).first().catch(() => null) : null;
  const ds = (await db.prepare(`SELECT * FROM deliverables WHERE job_id = ? ORDER BY id DESC`).bind(job.id).all()).results || [];
  const taskIds = ds.map((d) => d.task_id).filter(Boolean);
  const tasks = taskIds.length ? (await db.prepare(`SELECT id, key, service, sort, result_kind, result_text, result_url FROM job_tasks WHERE id IN (${taskIds.map(() => '?').join(',')})`).bind(...taskIds).all()).results || [] : [];
  const byId = new Map(tasks.map((x) => [x.id, x]));
  const all = (await db.prepare(`SELECT id, key, title, service, service_name, who, status, phase, done_at, sort FROM job_tasks WHERE job_id = ? ORDER BY sort, id`).bind(job.id).all().catch(() => ({ results: [] }))).results || [];
  if (site && !demo) { delete site.spec; } // 스펙 JSON 은 포털이 따로 읽는다
  return { db, demo, job, site, siteTask, tasks: all, ds: ds.map((d) => ({ ...d, task: byId.get(d.task_id) || null })) };
}

const MSG = {
  approve: '승인해 주셔서 감사합니다. 예정대로 진행하겠습니다.',
  choice: '골라 주셔서 감사합니다. 그 디자인으로 나머지를 만들어 올려드리겠습니다.',
  revise: '수정 요청을 받았습니다. 반영해서 다시 올려드리겠습니다.',
  site: '웹사이트 수정 요청을 받았습니다. 반영되면 같은 주소에서 보실 수 있습니다.',
  reply: '답변 감사합니다. 확인해서 반영하겠습니다.',
  linked: '연결됐습니다. 다음부터는 bizhigher.com/login 에서 구글·카카오로 바로 들어오실 수 있습니다.',
  demo: '데모 화면이라 실제로 처리되지는 않았습니다. 실제 사장님 페이지에서는 이 버튼으로 바로 승인·선택·수정 요청이 됩니다.',
};

/**
 * 대시보드 HTML — /c/{token} 과 /my/ 가 같이 쓴다. ?view=report 면 리포트만(전체 화면·인쇄)
 * @returns {Promise<string>}
 */
export async function dashboardHtml(env, data, { url, mode = 'token', account, jobs, jobId }) {
  const u = new URL(url);
  const preview = mode === 'token' && u.searchParams.get('preview') === '1';
  const ds = preview ? data.ds : data.ds.filter((d) => d.sent_at);
  const token = data.demo ? `sundubu-house-${DEMO_TOKEN}` : data.job.portal_token;
  // 실시간 리포트(2026-11-06) — ?r=YYYY-MM 은 저장된 월간 리포트, ?view=report 는 리포트만 전체 화면(인쇄용)
  const sel = /^\d{4}-\d{2}$/.test(u.searchParams.get('r') || '') ? u.searchParams.get('r') : '';
  let report = null, periods = [];
  try { periods = await reportPeriods(data.db, data.job.id); report = await liveReportHtml(data.db, data.job, data.site, sel); } catch (e) { report = null; }
  if (u.searchParams.get('view') === 'report' && report) return report;
  // 마케팅 포털(2026-11-07) — 홈의 순두부 하우스 포털과 같은 형태로 이 고객의 실제 결과물·리포트를 한 화면에
  let portal = '';
  try { const base = periods.length ? await storedReport(data.db, data.job.id, periods[0]) : null; portal = await portalHtml(data.db, { job: data.job, ds, site: data.site, base, period: periods[0] || '', token, preview }); } catch (e) { portal = ''; }
  return renderDashboard({ job: data.job, ds, tasks: data.tasks, site: data.site, siteTask: data.siteTask, env, msg: MSG[u.searchParams.get('ok')] || '', preview, mode, token, account, jobs, jobId,
    report: reportCard(report, { periods, sel, preview, token }), portal });
}

/**
 * 버튼 처리 — 승인·선택·수정 요청·답변·웹사이트 수정 요청. /c/{token} 과 /my/ 가 같이 쓴다
 * @returns {Promise<{ok?: string, error?: string, status?: number}>}
 */
export async function handleAction(env, data, form, waitUntil, via = '고객 페이지') {
  if (data.demo) return { ok: 'demo' };
  const wake = (why) => { try { const p = wakeRoutine(env.DB, env, why); if (waitUntil) waitUntil(p); } catch {} }; // 고객 행동으로 AI 차례가 열리면 루틴을 깨운다
  const id = Number(form.get('id')); const action = String(form.get('action') || ''); const note = String(form.get('note') || '').trim().slice(0, 2000);
  const db = data.db;
  if (action === 'site-revise') {
    if (!data.site) return { error: 'bad request', status: 400 };
    if (!note) return { error: '수정 내용을 적어 주세요', status: 400 };
    const t = await db.prepare(`SELECT id, status, revise_note FROM job_tasks WHERE job_id = ? AND key = 'web-2' ORDER BY id DESC LIMIT 1`).bind(data.job.id).first().catch(() => null);
    const tagged = '[고객 수정 요청] ' + note;
    if (t) await db.prepare(`UPDATE job_tasks SET status = 'doing', claimed_at = NULL, revise_note = ?, done_at = NULL WHERE id = ?`).bind(t.status === 'doing' && t.revise_note ? t.revise_note + '\n' + tagged : tagged, t.id).run();
    await addEvent(db, data.job.id, 'customer', null, null, `✎ 웹사이트 수정 요청 (${via}) — ${note.slice(0, 200)}${t ? '' : ' (web-2 단계 없음 — 수동 처리)'}`);
    wake('고객 웹사이트 수정 요청');
    return { ok: 'site' };
  }
  if (action === 'reply') {
    const r = data.ds.find((x) => x.id === id && x.sent_at);
    if (!r) return { error: 'bad request', status: 400 };
    if (!note) return { error: '내용을 적어 주세요', status: 400 };
    const day = new Date().toISOString().slice(0, 10);
    const merged = (r.customer_reply ? r.customer_reply + '\n' : '') + `[${day}] ${note}`;
    await db.prepare(`UPDATE deliverables SET customer_reply = ?, reply_at = datetime('now') WHERE id = ?`).bind(merged.slice(0, 8000), r.id).run();
    // 고객 프로필(ob-3) 맨 앞에 붙인다 — 뒤 AI 단계가 모두 done_results 로 프로필을 읽으므로 답이 다음 결과물에 바로 반영된다(뒤에 붙이면 4000자 자르기에 잘린다)
    const tag = `[고객 답변 ${day} — ${customerTitle(r.task && r.task.key, r.title)}] ${note}`;
    await db.prepare(`UPDATE job_tasks SET result_text = ? || char(10) || char(10) || COALESCE(result_text, '') WHERE job_id = ? AND key = 'ob-3'`).bind(tag.slice(0, 2000), data.job.id).run().catch(() => {});
    await addEvent(db, data.job.id, 'customer', null, null, `💬 고객 답변 (${via}) — ${r.title}: ${note.slice(0, 300)}`);
    const biz = (data.job.business || '').replace(/\s*\(데모\)/, '');
    const p = notify(env, `[BizHigher] ${biz} — 고객 답변 도착`, [['결과물', esc(customerTitle(r.task && r.task.key, r.title))], ['답변', esc(note).replace(/\n/g, '<br>')], ['반영', '고객 프로필(ob-3) 맨 앞에 붙였습니다 — 다음 AI 단계부터 읽습니다. 웹사이트·구글 프로필에 바로 고칠 내용이면 관리자 "AI에게 수정 요청"으로 넘겨 주세요']]).catch(() => {});
    if (waitUntil) waitUntil(p);
    return { ok: 'reply' };
  }
  const d = data.ds.find((x) => x.id === id && x.sent_at);
  if (!d || !d.needs_approval) return { error: 'bad request', status: 400 };
  if (action === 'approve') {
    const options = parseOptions(d.options); const choice = String(form.get('choice') || '').slice(0, 20);
    if (options.length && !options.some((o) => o.key === choice)) return { error: '디자인을 하나 골라 주세요', status: 400 };
    await approveDeliverable(db, d, { source: 'customer', note: `${via}에서 승인` + (choice ? ' — 선택 ' + choice : ''), choice });
    wake(choice ? `고객 선택 ${choice} — ${d.title.slice(0, 50)}` : `고객 승인 — ${d.title.slice(0, 50)}`);
    return { ok: choice ? 'choice' : 'approve' };
  }
  if (action === 'revise') {
    if (!note) return { error: '수정 내용을 적어 주세요', status: 400 };
    await db.prepare(`UPDATE deliverables SET revise_note = ?, approved_at = NULL WHERE id = ?`).bind(note, d.id).run();
    if (d.task) await db.prepare(`UPDATE job_tasks SET status = 'doing', claimed_at = NULL, revise_note = ?, done_at = NULL WHERE id = ?`).bind('[고객 수정 요청] ' + note, d.task.id).run();
    await addEvent(db, data.job.id, 'customer', null, null, `✎ 고객 수정 요청 (${via}) — ${d.title}: ${note}`);
    wake(`고객 수정 요청 — ${d.title.slice(0, 50)}`);
    return { ok: 'revise' };
  }
  return { error: 'bad request', status: 400 };
}

export const html = (s, status = 200) => new Response(s, { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex', 'Referrer-Policy': 'same-origin' } });
const ANCHOR = { approve: '#decide', choice: '#decide', revise: '#decide', reply: '#decide', site: '#site', demo: '#decide' };

export async function onRequestGet({ params, env, request }) {
  const data = await load(env, params.token, new URL(request.url).origin);
  if (!data) return html('<!doctype html><meta charset="utf-8"><p style="font-family:sans-serif;padding:40px">페이지를 찾을 수 없습니다. 링크를 다시 확인해 주세요.</p>', 404);
  return html(await dashboardHtml(env, data, { url: request.url, mode: data.demo ? 'demo' : 'token' }));
}

export async function onRequestPost({ params, env, request, waitUntil }) {
  const data = await load(env, params.token, new URL(request.url).origin);
  if (!data) return html('not found', 404);
  const form = await request.formData().catch(() => null);
  if (!form) return html('bad request', 400);
  const r = await handleAction(env, data, form, waitUntil);
  if (r.error) return html(r.error, r.status || 400);
  return Response.redirect(new URL(`/c/${params.token}?ok=${r.ok}${ANCHOR[r.ok] || ''}`, request.url).toString(), 303);
}
