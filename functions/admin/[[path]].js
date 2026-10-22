/**
 * 관리자 페이지 — /admin/  (HTML 앱 + JSON API)
 * 인증은 _auth.js (ADMIN_PASSWORD 또는 Cloudflare Access). 검색엔진 noindex.
 *
 * 화면 (설계: 2026-10-18 디자인 캔버스)
 *   GET  /admin/                          앱 — 관제탑 · 검증 큐 · 고객 여정 · 리드 · 플레이북 · 더보기
 *   POST /admin/login · /admin/logout
 * API
 *   GET  /admin/api/tower?sort=due|progress   관제탑: 오늘 내 차례 큐 + 고객 보드(진행률·다음 할 일·점)
 *   GET  /admin/api/review                    검증 큐: status=review 인 단계 전부 (결과물 미리보기 포함)
 *   POST /admin/api/tasks/:tid/approve|revise|reject   {note}
 *   POST /admin/api/tasks/:tid/result         {kind, text, url, checks[], self_check} — AI(fulfillment)가 결과물을 붙이고 검증 요청
 *   POST /admin/api/tasks/:tid/status         {status, note}
 *   GET  /admin/api/jobs?status= · GET /admin/api/jobs/:id (여정: 마일스톤·레인·서비스별 진행·타임라인)
 *   POST /admin/api/jobs/:id/status|note|due|business|deliverable|deliverable/:did|link-intake|tasks/seed
 *   POST /admin/api/jobs/from-intake          {intake_id}
 *   GET  /admin/api/orders · intakes · leads · reports · playbook?slug=
 *   GET/POST /admin/api/settings              자동 승인 규칙 등 {key: value}
 *   POST /admin/api/demo {only?: 'newoptix', fresh?: true} · /admin/api/demo/clear — only 는 업체 키워드로 1곳만, fresh 는 미리 채운 단계 없이 "방금 결제한" 상태
 *   GET  /admin/api/runner/queue              AI 실행 루틴용: AI가 지금 할 수 있는 단계 + 고객 컨텍스트 + Gmail 초안 대기 결과물
 *   POST /admin/api/deliverables/:id/drafted  루틴이 Gmail 초안을 만든 뒤 기록
 *   POST /admin/api/deliverables/:id/draft-to-david  고객용 초안 본문을 Resend로 David(NOTIFY_EMAIL)에게 보낸다 — 고객 발송 아님, David가 전달
 *   POST /admin/api/assets {job_id, task_id, label, content_type, base64}  이미지 저장 → 공개 URL /a/{id}.jpg
 */
import { authenticate, login, logoutCookie } from './_auth.js';
import { notify, sendEmail, esc as escHtml } from '../api/_notify.js';
import { syncReviews } from '../api/_reviews.js';
import { ensureSchema, JOB_STATUSES, addEvent, seedTasks, createJobForOrder, attachIntake, loadCatalog, jobProgress, nextAction, recentDots, jobPhase, currentPhaseTasks, aiReady, ensurePortalToken, sweepAutoApprovals } from '../api/_orders.js';
import { PLAYBOOK, COMMON_ONBOARDING, WHO, PHASES, tasksFor, summarize, DELIVER_KEYS, APPROVAL_KEYS } from '../api/_playbook.js';
import { appHtml, loginHtml } from './_ui.js';

export const TASK_STATUSES = [['todo', '대기'], ['doing', '진행'], ['review', '검증 대기'], ['done', '완료'], ['blocked', '막힘'], ['skipped', '해당 없음']];
const NOINDEX = { 'X-Robots-Tag': 'noindex, nofollow', 'Cache-Control': 'no-store' };
const CLOSED = new Set(['done', 'skipped']);

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/admin\/?/, '').replace(/\/$/, '');
  const auth = await authenticate(request, env);

  if (path === 'login' && request.method === 'POST') {
    const form = await request.formData();
    const cookie = await login(form.get('password'), env);
    if (!cookie) return html(loginHtml({ error: '비밀번호가 맞지 않습니다.' }), 401);
    return new Response(null, { status: 303, headers: { Location: '/admin/', 'Set-Cookie': cookie, ...NOINDEX } });
  }
  if (path === 'logout') return new Response(null, { status: 303, headers: { Location: '/admin/', 'Set-Cookie': logoutCookie(), ...NOINDEX } });

  if (!auth.ok) {
    if (path.startsWith('api')) return json({ ok: false, error: 'unauthorized' }, 401);
    if (auth.mode === 'unconfigured') return html(loginHtml({ unconfigured: true }), 503);
    return html(loginHtml({}), 401);
  }
  if (!env.DB) return path.startsWith('api') ? json({ ok: false, error: 'DB 바인딩 없음 (프리뷰 환경)' }, 503) : html(appHtml({ user: auth.user, noDb: true }));
  if (path === '') return html(appHtml({ user: auth.user }));
  if (!path.startsWith('api')) return new Response('not found', { status: 404, headers: NOINDEX });

  try {
    await ensureSchema(env.DB);
    const seg = path.split('/').slice(1);
    const isMultipart = (request.headers.get('content-type') || '').includes('multipart/form-data');
    const body = request.method === 'POST' && !isMultipart ? await request.json().catch(() => ({})) : {};
    if (isMultipart) body.__form = await request.formData().catch(() => null); // 자산 업로드(영상·큰 파일)
    const out = await api(env, request.method, seg, body, url);
    if (out === undefined) return json({ ok: false, error: 'not found' }, 404);
    return json({ ok: true, ...out });
  } catch (e) {
    return json({ ok: false, error: String((e && e.message) || e) }, e && e.status ? e.status : 500);
  }
}

const bad = (m) => { const e = new Error(m); e.status = 400; return e; };

/* ---------- 공용 조회 ---------- */

async function tasksByJob(db, jobIds) {
  if (!jobIds.length) return {};
  const out = {};
  for (let i = 0; i < jobIds.length; i += 80) {
    const ids = jobIds.slice(i, i + 80);
    const r = await db.prepare(`SELECT * FROM job_tasks WHERE job_id IN (${ids.map(() => '?').join(',')}) ORDER BY sort ASC, id ASC`).bind(...ids).all();
    for (const t of r.results || []) (out[t.job_id] = out[t.job_id] || []).push(t);
  }
  return out;
}

function todayLA() { return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' }); }
function dueLabel(d) {
  if (!d) return { label: '', tone: 'none', rank: 9e9 };
  const t = todayLA();
  const diff = Math.round((new Date(d) - new Date(t)) / 864e5);
  if (diff < 0) return { label: `${-diff}일 지남`, tone: 'over', rank: diff };
  if (diff === 0) return { label: '오늘', tone: 'today', rank: 0 };
  if (diff === 1) return { label: '내일', tone: 'soon', rank: 1 };
  return { label: d.slice(5).replace('-', '/'), tone: 'later', rank: diff };
}

/** 내 차례 큐 항목 — 검증 대기(review) · David 수동(진행/대기 중 가장 앞) */
function myQueue(jobs, tasksMap) {
  const items = [];
  for (const j of jobs) {
    if (j.status === 'done' || j.status === 'hold') continue;
    const ts = tasksMap[j.id] || [];
    for (const t of ts) {
      if (t.status === 'review') items.push({ ...pick(t), job_id: j.id, business: j.business, kind: t.verify ? '검증' : '승인', cta: t.verify ? '검증' : '승인', href: '#/review?task=' + t.id });
    }
    const manual = ts.find((t) => t.who === 'david' && (t.status === 'doing' || t.status === 'todo') && !ts.some((x) => x.sort < t.sort && !CLOSED.has(x.status) && x.status !== 'blocked' && x.who !== 'customer'));
    if (manual) items.push({ ...pick(manual), job_id: j.id, business: j.business, kind: '직접', cta: '열기', href: '#/jobs/' + j.id + '?task=' + manual.id });
  }
  for (const it of items) { const jd = jobs.find((j) => j.id === it.job_id); it.due = jd ? jd.due_date : null; Object.assign(it, { dueInfo: dueLabel(it.due) }); }
  items.sort((a, b) => (a.kind === '직접') - (b.kind === '직접') || a.dueInfo.rank - b.dueInfo.rank || a.id - b.id);
  return items;
  function pick(t) { return { id: t.id, title: t.title, service_name: t.service_name, min: t.david_min || 0, verify: !!t.verify, requested_at: t.requested_at }; }
}

function boardRow(j, ts) {
  const next = nextAction(ts);
  const pct = jobProgress(ts);
  const open = ts.filter((t) => !CLOSED.has(t.status));
  const cur = currentPhaseTasks(ts);
  const aiPending = aiReady(ts).length;
  const lastMove = ts.map((t) => t.done_at || t.requested_at || '').filter(Boolean).sort().pop() || j.updated_at || j.created_at;
  const stuckDays = lastMove ? Math.floor((Date.now() - new Date(String(lastMove).replace(' ', 'T') + 'Z').getTime()) / 864e5) : 0;
  const aiStuck = !!(next && (next.who === 'auto' || (next.who === 'ai' && next.status !== 'review')) && stuckDays >= 1);
  return {
    id: j.id, aiPending, aiStuck, stuckDays, business: j.business || j.customer_name || j.customer_email || '(업체명 없음)', service_name: j.service_name || j.o_service_name || j.service_slug || '상품 미확인', service_slug: j.service_slug,
    status: j.status, due_date: j.due_date, dueInfo: dueLabel(j.due_date), created_at: j.created_at,
    day: j.created_at ? Math.max(1, Math.floor((Date.now() - new Date(j.created_at.replace(' ', 'T') + 'Z').getTime()) / 864e5) + 1) : 1,
    pct, phase: jobPhase(j, ts), dots: recentDots(ts), next,
    counts: { total: ts.length, done: ts.length - open.length, review: ts.filter((t) => t.status === 'review').length, customer: cur.filter((t) => t.who === 'customer' && t.status !== 'blocked').length, blocked: cur.filter((t) => t.status === 'blocked').length, blockedAll: open.filter((t) => t.status === 'blocked').length },
    amount_cents: j.amount_cents || 0, order_status: j.order_status,
  };
}

/* ---------- API ---------- */

async function api(env, method, seg, body, url) {
  const db = env.DB;
  const [res, id, sub, subId] = seg;
  const q = async (sql, ...b) => (await db.prepare(sql).bind(...b).first()) || {};

  /* 관제탑 */
  if (res === 'tower' && method === 'GET') {
    const sort = url.searchParams.get('sort') === 'progress' ? 'progress' : 'due';
    const scope = url.searchParams.get('scope') || 'open';
    const jobs = (await db.prepare(`SELECT j.*, o.amount_cents, o.status order_status, o.customer_name, o.service_name o_service_name FROM jobs j LEFT JOIN orders o ON o.id = j.order_id ${scope === 'all' ? '' : `WHERE j.status NOT IN ('done','hold')`} ORDER BY j.id DESC LIMIT 300`).all()).results || [];
    const tmap = await tasksByJob(db, jobs.map((j) => j.id));
    const rows = jobs.map((j) => boardRow(j, tmap[j.id] || []));
    rows.sort(sort === 'progress' ? (a, b) => a.pct - b.pct || a.dueInfo.rank - b.dueInfo.rank : (a, b) => a.dueInfo.rank - b.dueInfo.rank || a.pct - b.pct);
    const todo = myQueue(jobs, tmap);
    const since = new Date(Date.now() - 864e5).toISOString().slice(0, 19).replace('T', ' ');
    const aiDone = await q(`SELECT COUNT(*) n, COUNT(DISTINCT job_id) jobs FROM job_tasks WHERE status = 'done' AND done_at >= ? AND who IN ('auto','ai')`, since);
    const custWait = rows.reduce((a, r) => a + r.counts.customer, 0);
    const custLate = rows.filter((r) => r.counts.customer).length;
    const blocked = rows.filter((r) => r.counts.blockedAll).length;
    const month = await q(`SELECT COALESCE(SUM(amount_cents),0) c, COUNT(*) n FROM payments WHERE paid_at >= date('now','start of month')`);
    const subs = await q(`SELECT COUNT(*) n, COALESCE(SUM(amount_cents),0) c FROM orders WHERE mode='subscription' AND status='active'`);
    const lastEvent = await q(`SELECT created_at, type FROM stripe_events ORDER BY created_at DESC LIMIT 1`);
    const leads = await safeFirst(db, `SELECT COUNT(*) n FROM audit_leads WHERE created_at >= datetime('now','-7 days')`);
    return {
      sort, scope, todo, todoMin: todo.reduce((a, t) => a + (t.min || 0), 0), customers: rows,
      aiDone24h: aiDone.n || 0, aiDoneJobs: aiDone.jobs || 0, customerWait: custWait, customerWaitJobs: custLate, blocked, blockedTasks: rows.reduce((a, r) => a + r.counts.blockedAll, 0),
      aiStuck: rows.filter((r) => r.aiStuck).length, aiPending: rows.reduce((a, r) => a + r.aiPending, 0),
      monthRevenueCents: month.c || 0, monthPayments: month.n || 0, activeSubs: subs.n || 0, mrrCents: subs.c || 0,
      leads7d: (leads && leads.n) || 0, lastStripeEvent: lastEvent.created_at ? { at: lastEvent.created_at, type: lastEvent.type } : null,
      who: WHO, statuses: JOB_STATUSES,
    };
  }

  /* 검증 큐 */
  if (res === 'review' && method === 'GET') {
    const swept = await sweepAutoApprovals(db);
    const rows = (await db.prepare(`SELECT t.*, j.business, j.due_date, j.service_name job_service FROM job_tasks t JOIN jobs j ON j.id = t.job_id WHERE t.status = 'review' AND j.status NOT IN ('done','hold') ORDER BY COALESCE(j.due_date,'9999') ASC, t.requested_at ASC, t.id ASC`).all()).results || [];
    const items = rows.map((t) => ({ ...t, checks: parseJson(t.checks, []), kind: t.verify ? '검증' : '승인', dueInfo: dueLabel(t.due_date) }));
    const settings = await getSettings(db);
    return { items, totalMin: items.reduce((a, t) => a + (t.david_min || 0), 0), autoRules: settings.autoRules || defaultAutoRules(), who: WHO, swept };
  }

  /* 단계 액션 */
  if (res === 'tasks' && id && method === 'POST') {
    const t = await db.prepare(`SELECT * FROM job_tasks WHERE id = ?`).bind(Number(id)).first();
    if (!t) return undefined;
    const note = String(body.note || '').trim().slice(0, 4000);
    if (sub === 'approve') {
      // 승인 메모는 결과물에 "[David 승인 메모]"로 덧붙여 후속 단계·루틴이 반드시 읽게 한다
      await db.prepare(`UPDATE job_tasks SET status = 'done', done_at = datetime('now'), decided_at = datetime('now'), note = CASE WHEN ? != '' THEN ? ELSE note END,
        result_text = CASE WHEN ? != '' THEN COALESCE(result_text, '') || char(10) || char(10) || '[David 승인 메모] ' || ? ELSE result_text END WHERE id = ?`).bind(note, note, note, note, t.id).run();
      // 결과물 링크가 있으면 결과물 목록에 올리고 "발송 대기"로. Gmail 초안은 fulfillment 루틴이 이 행을 보고 만든다(고객 자동 발송 금지 §12)
      if (DELIVER_KEYS.has(t.key)) await ensureDeliverable(db, t); // 고객에게 가는 결과물인 단계만 — 내부 작업물은 올리지 않는다
      await addEvent(db, t.job_id, 'task', null, null, `✔ 승인 — ${t.title}${note ? ' · ' + note : ''}`);
      await autoAdvance(db, t.job_id);
      return { next: await nextReview(db, t.id) };
    }
    if (sub === 'revise') {
      if (!note) throw bad('무엇을 고칠지 적어 주세요');
      await db.prepare(`UPDATE job_tasks SET status = 'doing', revise_note = ?, decided_at = datetime('now') WHERE id = ?`).bind(note, t.id).run();
      await addEvent(db, t.job_id, 'task', null, null, `✎ 수정 요청 — ${t.title}: ${note}`);
      return { next: await nextReview(db, t.id) };
    }
    if (sub === 'reject') {
      await db.prepare(`UPDATE job_tasks SET status = 'todo', note = ?, decided_at = datetime('now') WHERE id = ?`).bind(note ? '반려: ' + note : '반려', t.id).run();
      await addEvent(db, t.job_id, 'task', null, null, `⛔ 반려 — ${t.title}${note ? ': ' + note : ''}`);
      return { next: await nextReview(db, t.id) };
    }
    if (sub === 'edit') {
      // David가 AI 결과물을 직접 고친다 (상태는 그대로)
      await db.prepare(`UPDATE job_tasks SET result_text = COALESCE(?, result_text), result_url = COALESCE(?, result_url), result_kind = COALESCE(?, result_kind) WHERE id = ?`)
        .bind(body.text != null ? String(body.text).slice(0, 200000) : null, body.url != null ? String(body.url).slice(0, 1000) : null, body.kind != null ? String(body.kind) : null, t.id).run();
      await addEvent(db, t.job_id, 'task', null, null, `✎ 결과물 직접 수정 — ${t.title}`);
      return {};
    }
    if (sub === 'note') {
      await db.prepare(`UPDATE job_tasks SET note = ? WHERE id = ?`).bind(String(body.note || '').slice(0, 2000), t.id).run();
      return {};
    }
    if (sub === 'undo') {
      // "받았음"·"완료"를 되돌린다 — 다시 대기로. 타임라인에 남긴다
      await db.prepare(`UPDATE job_tasks SET status = 'todo', done_at = NULL WHERE id = ?`).bind(t.id).run();
      await addEvent(db, t.job_id, 'task', null, null, `↩ 완료 취소 — ${t.title}${note ? ': ' + note : ''}`);
      return {};
    }
    if (sub === 'reopen') {
      // 완료된 AI 단계를 다시 열어 수정 요청
      if (!note) throw bad('무엇을 고칠지 적어 주세요');
      await db.prepare(`UPDATE job_tasks SET status = 'doing', revise_note = ?, done_at = NULL, decided_at = datetime('now') WHERE id = ?`).bind(note, t.id).run();
      await addEvent(db, t.job_id, 'task', null, null, `↩ 다시 열어 수정 요청 — ${t.title}: ${note}`);
      return {};
    }
    if (sub === 'result') {
      // AI(fulfillment 스킬·루틴)가 결과물을 붙이고 검증을 요청한다
      const kind = ['text', 'html', 'link', 'images', 'video'].includes(body.kind) ? body.kind : (body.url && !body.text ? 'link' : 'text');
      const checks = Array.isArray(body.checks) ? body.checks.slice(0, 6).map((c) => String(c).slice(0, 200)) : [];
      const text = String(body.text || '').slice(0, 200000); const selfCheck = String(body.self_check || '').slice(0, 500);
      await db
        .prepare(`UPDATE job_tasks SET result_kind = ?, result_text = ?, result_url = ?, checks = ?, self_check = ?, status = 'review', requested_at = datetime('now') WHERE id = ?`)
        .bind(kind, text, String(body.url || '').slice(0, 1000), JSON.stringify(checks), selfCheck, t.id)
        .run();
      // 자동 승인 규칙(검증 큐 탭에서 켜고 끔) — 켜진 규칙의 단계는 큐를 건너뛴다
      const rule = await autoRuleFor(db, { ...t, result_text: text, self_check: selfCheck });
      if (rule) {
        await db.prepare(`UPDATE job_tasks SET status = 'done', done_at = datetime('now'), decided_at = datetime('now'), note = ? WHERE id = ?`).bind('자동 승인 — 규칙: ' + rule.label, t.id).run();
        if (DELIVER_KEYS.has(t.key)) await ensureDeliverable(db, t);
        await addEvent(db, t.job_id, 'task', null, null, `✅ 자동 승인(${rule.label}) — ${t.title}`);
        await autoAdvance(db, t.job_id);
        return { autoApproved: true, rule: rule.key };
      }
      await addEvent(db, t.job_id, 'task', null, null, `👀 검증 요청 — ${t.title}`);
      return {};
    }
    if (sub === 'status') {
      const to = String(body.status || '');
      if (!TASK_STATUSES.some(([k]) => k === to)) throw bad('잘못된 단계 상태');
      await db.prepare(`UPDATE job_tasks SET status = ?, done_at = CASE WHEN ? = 'done' THEN datetime('now') ELSE done_at END WHERE id = ?`).bind(to, to, t.id).run();
      if (note) await db.prepare(`UPDATE job_tasks SET note = ? WHERE id = ?`).bind(note, t.id).run();
      if (to === 'done') { if (DELIVER_KEYS.has(t.key)) await ensureDeliverable(db, t); await addEvent(db, t.job_id, 'task', null, null, `✔ ${t.title}${t.who === 'customer' && note ? ' — 받은 것: ' + note : ''}`); await autoAdvance(db, t.job_id); }
      else if (to === 'review') await addEvent(db, t.job_id, 'task', null, null, `👀 검증 요청 — ${t.title}`);
      else if (to === 'blocked') await addEvent(db, t.job_id, 'task', null, null, `⛔ 막힘 — ${t.title}`);
      return {};
    }
    return undefined;
  }

  /* AI 실행 루틴 큐 */
  /* 고객 웹사이트 스펙 — 루틴 sites.js 가 spec(저장)·build(전체 읽기)에 쓴다. 설계 docs/customer-sites-design-ko.md */
  if (res === 'sites' && !id && method === 'GET') {
    const sites = (await db.prepare(`SELECT s.*, j.business FROM sites s LEFT JOIN jobs j ON j.id = s.job_id ORDER BY s.id ASC`).all()).results || [];
    return { sites: sites.map((s) => ({ ...s, spec: parseJson(s.spec, {}) })) };
  }
  if (res === 'sites' && !id && method === 'POST') {
    const jobId = Number(body.job_id); const spec = body.spec && typeof body.spec === 'object' ? body.spec : null;
    if (!jobId || !spec) throw bad('job_id 와 spec(JSON) 이 필요합니다');
    if (!spec.name) throw bad('spec.name(상호)이 필요합니다');
    const job = await db.prepare(`SELECT * FROM jobs WHERE id = ?`).bind(jobId).first();
    if (!job) throw bad('작업이 없습니다');
    const existing = await db.prepare(`SELECT * FROM sites WHERE job_id = ?`).bind(jobId).first();
    const slugify = (x) => String(x || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
    let slug = existing ? existing.slug : slugify(spec.slug || spec.name) || ('site-' + jobId);
    if (!existing) { // 다른 작업과 겹치면 뒤에 번호
      let n = 1; const base = slug;
      while (await db.prepare(`SELECT id FROM sites WHERE slug = ?`).bind(slug).first()) slug = `${base}-${++n}`;
    }
    spec.slug = slug;
    const text = JSON.stringify(spec).slice(0, 400000);
    const changed = existing ? specDiff(parseJson(existing.spec, {}), spec) : [];
    if (existing && !changed.length) { const row0 = await db.prepare(`SELECT * FROM sites WHERE id = ?`).bind(existing.id).first(); return { slug, version: row0.version, domain: row0.domain || '', live: !!row0.live, changed: [], unchanged: true, preview_url: `https://${env.SITES_PROJECT || 'bizhigher-sites'}.pages.dev/${slug}/`, preview_host: `https://${slug}.sites.bizhigher.com` }; }
    if (existing) await db.prepare(`UPDATE sites SET spec = ?, version = version + 1, updated_at = datetime('now') WHERE id = ?`).bind(text, existing.id).run();
    else await db.prepare(`INSERT INTO sites (job_id, slug, spec) VALUES (?, ?, ?)`).bind(jobId, slug, text).run();
    const row = await db.prepare(`SELECT * FROM sites WHERE slug = ?`).bind(slug).first();
    await db.prepare(`INSERT INTO site_versions (site_id, version, spec, note, changed) VALUES (?, ?, ?, ?, ?)`).bind(row.id, row.version, text, String(body.note || (existing ? '갱신' : '생성')).slice(0, 300), JSON.stringify(changed.slice(0, 60))).run();
    await setSettingsPartial(db, { sitesDirty: true }); // 다음 루틴 실행에서 needs-deploy = yes
    await addEvent(db, jobId, 'task', null, null, `🌐 사이트 스펙 ${existing ? '갱신 v' + row.version + (changed.length ? ' — ' + changed.slice(0, 6).join(', ') + (changed.length > 6 ? ' 외 ' + (changed.length - 6) : '') : '') : '생성'} — https://${env.SITES_PROJECT || 'bizhigher-sites'}.pages.dev/${slug}/`);
    return { slug, version: row.version, domain: row.domain || '', live: !!row.live, changed, preview_url: `https://${env.SITES_PROJECT || 'bizhigher-sites'}.pages.dev/${slug}/`, preview_host: `https://${slug}.sites.bizhigher.com` };
  }
  if (res === 'sites' && id && sub === 'versions' && method === 'GET') {
    const s = await db.prepare(`SELECT id FROM sites WHERE slug = ?`).bind(String(id)).first(); if (!s) return undefined;
    const rows = (await db.prepare(`SELECT id, version, note, changed, created_at, spec FROM site_versions WHERE site_id = ? ORDER BY version DESC LIMIT 30`).bind(s.id).all()).results || [];
    return { versions: rows.map((v) => ({ ...v, changed: parseJson(v.changed, []), spec: parseJson(v.spec, {}) })) };
  }
  if (res === 'sites' && id && sub === 'leads' && method === 'GET') {
    const s = await db.prepare(`SELECT id FROM sites WHERE slug = ?`).bind(String(id)).first(); if (!s) return undefined;
    const rows = (await db.prepare(`SELECT id, name, phone, email, message, page, created_at FROM site_leads WHERE site_id = ? ORDER BY id DESC LIMIT 100`).bind(s.id).all()).results || [];
    return { leads: rows };
  }
  if (res === 'sites' && id && sub === 'patch' && method === 'POST') {
    // 부분 패치(깊은 병합, null 은 삭제) → 새 버전. 관리자 "스타일 바꾸기"·루틴 sites.js patch 가 쓴다
    const s = await db.prepare(`SELECT * FROM sites WHERE slug = ?`).bind(String(id)).first(); if (!s) return undefined;
    const patch = body.patch && typeof body.patch === 'object' ? body.patch : null; if (!patch) throw bad('patch(JSON) 이 필요합니다');
    const next = deepPatch(parseJson(s.spec, {}), patch); next.slug = s.slug;
    const changed = specDiff(parseJson(s.spec, {}), next); if (!changed.length) return { slug: s.slug, version: s.version, changed: [] };
    const text = JSON.stringify(next).slice(0, 400000);
    await db.prepare(`UPDATE sites SET spec = ?, version = version + 1, updated_at = datetime('now') WHERE id = ?`).bind(text, s.id).run();
    const row = await db.prepare(`SELECT * FROM sites WHERE id = ?`).bind(s.id).first();
    await db.prepare(`INSERT INTO site_versions (site_id, version, spec, note, changed) VALUES (?, ?, ?, ?, ?)`).bind(s.id, row.version, text, String(body.note || '부분 패치').slice(0, 300), JSON.stringify(changed.slice(0, 60))).run();
    await setSettingsPartial(db, { sitesDirty: true });
    await addEvent(db, s.job_id, 'task', null, null, `🌐 사이트 스펙 v${row.version} — ${changed.slice(0, 6).join(', ')}${body.note ? ' (' + String(body.note).slice(0, 80) + ')' : ''} · 다음 루틴 실행에 재배포`);
    return { slug: s.slug, version: row.version, changed };
  }
  if (res === 'sites' && id && sub === 'revise' && method === 'POST') {
    // 수정 요청 → web-2(사이트 생성) 단계를 다시 열어 루틴이 스펙을 패치·재배포하게 한다 (고객 페이지·관리자 공용)
    const s = await db.prepare(`SELECT * FROM sites WHERE slug = ?`).bind(String(id)).first(); if (!s) return undefined;
    const note = String(body.note || '').trim().slice(0, 2000); if (!note) throw bad('수정 내용이 필요합니다');
    const r = await reopenSiteTask(db, s.job_id, (body.source === 'customer' ? '[고객 수정 요청] ' : '') + note);
    await addEvent(db, s.job_id, body.source === 'customer' ? 'customer' : 'david', null, null, `✎ 웹사이트 수정 요청${body.source === 'customer' ? ' (고객 페이지)' : ''} — ${note.slice(0, 200)}${r ? '' : ' (web-2 단계 없음 — 수동 처리)'}`);
    return { ok: true, reopened: !!r };
  }
  if (res === 'sites' && id && method === 'GET') {
    const s = await db.prepare(`SELECT * FROM sites WHERE slug = ? OR job_id = ?`).bind(String(id), Number(id) || 0).first();
    return s ? { ...s, spec: parseJson(s.spec, {}) } : undefined;
  }
  if (res === 'sites' && id && sub === 'domain' && method === 'POST') {
    // 고객 도메인 등록: D1 에 기록(+live). Pages 프로젝트에 도메인 추가는 CLOUDFLARE_API_TOKEN 이 있을 때만 시도 (없으면 David 가 대시보드에서 추가)
    const s = await db.prepare(`SELECT * FROM sites WHERE slug = ?`).bind(String(id)).first();
    if (!s) return undefined;
    const domain = String(body.domain || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^www\./, '');
    if (domain && !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) throw bad('도메인 형식이 아닙니다');
    let cf = 'skipped';
    if (domain && env.CLOUDFLARE_API_TOKEN && env.CLOUDFLARE_ACCOUNT_ID) {
      const project = env.SITES_PROJECT || 'bizhigher-sites';
      for (const d of [domain, 'www.' + domain]) {
        const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/pages/projects/${project}/domains`, { method: 'POST', headers: { Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ name: d }) }).catch(() => null);
        cf = r && (r.ok || r.status === 409) ? 'added' : `error ${r ? r.status : 'network'}`;
        if (!r || !(r.ok || r.status === 409)) break;
      }
    }
    await db.prepare(`UPDATE sites SET domain = ?, live = ?, updated_at = datetime('now') WHERE id = ?`).bind(domain || null, domain && body.live !== false ? 1 : 0, s.id).run();
    await addEvent(db, s.job_id, 'task', null, null, domain ? `🌐 도메인 연결 ${domain} (Pages: ${cf}) — 다음 빌드부터 색인 허용` : '🌐 도메인 해제');
    return { domain, live: !!(domain && body.live !== false), cloudflare: cf };
  }
  if (res === 'reviews' && id === 'sync' && method === 'POST') {
    // 새 리뷰 확인 (Places, 작업당 하루 1회 · force 면 즉시). 검증 큐 탭 버튼과 루틴 큐가 부른다
    return await syncReviews(db, env, { force: !!body.force });
  }
  if (res === 'runner' && id === 'queue' && method === 'GET') {
    await sweepAutoApprovals(db);
    let reviewSync = null; try { reviewSync = await syncReviews(db, env); } catch (e) { reviewSync = { error: String(e && e.message || e) }; }
    const limit = Math.min(50, Number(url.searchParams.get('limit')) || 20);
    const jobs = (await db.prepare(`SELECT j.*, o.service_name o_service_name, o.customer_name FROM jobs j LEFT JOIN orders o ON o.id = j.order_id WHERE j.status NOT IN ('done','hold') ORDER BY COALESCE(j.due_date,'9999') ASC, j.id ASC LIMIT 200`).all()).results || [];
    const tmap = await tasksByJob(db, jobs.map((j) => j.id));
    const items = [];
    for (const j of jobs) {
      const ready = aiReady(await syncPlaybook(db, j, tmap[j.id] || []));
      if (!ready.length) continue;
      const intake = j.intake_id ? await db.prepare(`SELECT * FROM intakes WHERE id = ?`).bind(j.intake_id).first() : null;
      const profile = j.customer_email ? await safeFirst(db, `SELECT * FROM customer_profiles WHERE lower(email) = ? ORDER BY rowid DESC LIMIT 1`, j.customer_email.toLowerCase()) : null;
      const done = (tmap[j.id] || []).filter((t) => CLOSED.has(t.status) && (t.result_text || t.result_url)).map((t) => ({ key: t.key, title: t.title, result_text: (t.result_text || '').slice(0, 4000), result_url: t.result_url }));
      for (const t of ready) {
        if (items.length >= limit) break;
        items.push({ task: { id: t.id, key: t.key, service: t.service, service_name: t.service_name, title: t.title, phase: t.phase, who: t.who, verify: !!t.verify, status: t.status, revise_note: t.revise_note, note: t.note, prev_result_text: t.result_text || '' },
          job: { id: j.id, business: j.business, service_slug: j.service_slug, service_name: j.service_name || j.o_service_name, customer_email: j.customer_email, due_date: j.due_date, created_at: j.created_at, intake, profile, done_results: done } });
      }
    }
    // 고객용 요약(summary)이 없는 결과물 — 루틴이 요약만 쓴다. 발송은 David가 관리자 "고객에게 묶음 보내기"로 (고객 페이지 /c/{token})
    const drafts = (await db.prepare(`SELECT d.*, j.business, j.customer_email, j.service_name, t.result_kind, substr(t.result_text, 1, 3000) AS result_text FROM deliverables d JOIN jobs j ON j.id = d.job_id LEFT JOIN job_tasks t ON t.id = d.task_id WHERE d.sent_at IS NULL AND (d.summary IS NULL OR d.summary = '') AND j.status NOT IN ('done','hold') AND (COALESCE(t.result_text,'') != '' OR COALESCE(d.url,'') != '') ORDER BY d.id ASC LIMIT 20`).all()).results || [];
    return { items, pendingDrafts: drafts, reviewSync, rules: ['고객에게 자동 발송 금지 — Gmail 초안까지', 'verify 단계는 status review, 아니면 done', '경쟁사 갭 분석 선행(노출·SEO)', '리뷰 대가·게이팅·가짜 리뷰 금지', '의료·치과 환자 암시 금지', '실행 플랜은 180일', '웹 산출물 360px 실측'] };
  }
  if (res === 'assets' && method === 'POST') {
    const TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'video/mp4': 'mp4', 'video/webm': 'webm', 'application/pdf': 'pdf' };
    let bin, ctIn, label, jobIn, taskIn;
    if (body.__form) {
      const form = body.__form;
      const f = form.get('file');
      if (!f || typeof f === 'string' || !f.size) throw bad('file 이 비어 있습니다');
      bin = new Uint8Array(await f.arrayBuffer()); ctIn = f.type; label = String(form.get('label') || f.name || ''); jobIn = form.get('job_id'); taskIn = form.get('task_id');
    } else {
      const b64 = String(body.base64 || '');
      if (!b64) throw bad('base64 가 비어 있습니다');
      bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)); ctIn = body.content_type; label = String(body.label || ''); jobIn = body.job_id; taskIn = body.task_id;
    }
    const max = env.R2_ASSETS ? 60 * 1024 * 1024 : 900000;
    if (bin.byteLength > max) throw bad(env.R2_ASSETS ? '파일이 60MB를 넘습니다' : '이미지가 900KB를 넘습니다 — R2 바인딩이 없어 D1에 저장합니다');
    const ct = TYPES[ctIn] ? ctIn : 'image/jpeg';
    body.job_id = jobIn; body.task_id = taskIn; body.label = label;
    const aid = [...crypto.getRandomValues(new Uint8Array(16))].map((x) => 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[x % 62]).join('');
    const ext = TYPES[ct];
    // R2 바인딩(R2_ASSETS)이 있으면 객체 저장소에, 없으면 D1 BLOB 에 — 서빙(/a/)이 둘 다 읽는다
    let r2Key = null;
    if (env.R2_ASSETS) { r2Key = `a/${aid}.${ext}`; await env.R2_ASSETS.put(r2Key, bin, { httpMetadata: { contentType: ct, cacheControl: 'public, max-age=31536000, immutable' } }); }
    await db.prepare(`INSERT INTO assets (id, job_id, task_id, content_type, bytes, label, data, r2_key) VALUES (?,?,?,?,?,?,?,?)`).bind(aid, Number(body.job_id) || null, Number(body.task_id) || null, ct, bin.byteLength, String(body.label || '').slice(0, 200), r2Key ? null : bin.buffer, r2Key).run();
    return { id: aid, url: `${url.origin}/a/${aid}.${ext}`, store: r2Key ? 'r2' : 'd1' };
  }
  if (res === 'deliverables' && id && sub === 'summary' && method === 'POST') {
    const d = await db.prepare(`SELECT * FROM deliverables WHERE id = ?`).bind(Number(id)).first();
    if (!d) return undefined;
    await db.prepare(`UPDATE deliverables SET summary = ? WHERE id = ?`).bind(String(body.text || '').trim().slice(0, 2000), d.id).run();
    return {};
  }
  if (res === 'jobs' && id && sub === 'send-packet' && method === 'POST') {
    // David 가 누른다: 전달 안 된 결과물 전부를 한 통으로 고객에게 (고객 페이지 링크 + 요약). 루틴은 호출하지 않는다 (§12 자동 발송 금지)
    const j = await db.prepare(`SELECT * FROM jobs WHERE id = ?`).bind(Number(id)).first();
    if (!j) return undefined;
    if (!env.RESEND_API_KEY) throw bad('RESEND_API_KEY 가 없어 보낼 수 없습니다');
    if (!j.customer_email) throw bad('고객 이메일이 없습니다');
    const ds = (await db.prepare(`SELECT * FROM deliverables WHERE job_id = ? AND sent_at IS NULL ORDER BY id ASC`).bind(j.id).all()).results || [];
    if (!ds.length) throw bad('전달할 결과물이 없습니다');
    const token = await ensurePortalToken(db, j);
    const portal = `${url.origin}/c/${token}`;
    const biz = (j.business || '').replace(/\s*\(데모\)/, '');
    const needs = ds.filter((d) => d.needs_approval && !d.approved_at);
    const subject = `[BizHigher] ${biz} — 결과물 ${ds.length}건${needs.length ? ' · 확인 부탁드립니다' : ''}`;
    const list = ds.map((d) => `<li style="margin:0 0 10px"><b>${escHtml(d.title)}</b>${d.needs_approval && !d.approved_at ? ' <span style="color:#B45309">(확인 필요)</span>' : ''}${d.summary ? `<br><span style="color:#374151">${escHtml(d.summary)}</span>` : ''}</li>`).join('');
    const htmlBody = `<div style="font-family:'Apple SD Gothic Neo','Malgun Gothic',sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111318;line-height:1.6">
      <div style="font-size:18px;font-weight:800;margin-bottom:14px">Biz<span style="color:#0A4DF5">Higher</span></div>
      <p>${escHtml(biz)} 사장님, 안녕하세요.</p>
      <p>이번에 준비된 결과물 ${ds.length}건을 아래 페이지에 올려 두었습니다.${needs.length ? ` 그중 <b>${needs.length}건은 확인이 필요합니다.</b> 페이지에서 내용을 보시고 "이대로 진행"을 눌러 주시거나 수정 요청을 남겨 주세요. <b>7일 안에 회신이 없으면 승인된 것으로 보고 예정대로 진행합니다.</b>` : ''}</p>
      <p style="margin:18px 0"><a href="${portal}" style="display:inline-block;background:#0A4DF5;color:#fff;text-decoration:none;padding:12px 20px;border-radius:999px;font-weight:700">결과물 보기 →</a></p>
      <ul style="padding-left:18px">${list}</ul>
      ${body.note ? `<p style="background:#F6F7F9;border-radius:12px;padding:12px">${escHtml(String(body.note).slice(0, 2000))}</p>` : ''}
      <p>수정은 언제든 이 메일에 회신하시거나 페이지에서 요청하실 수 있습니다(수정 1회 무료). 전화로 확인하셔도 됩니다.</p>
      <p>BizHigher 드림 · <a href="https://bizhigher.com">bizhigher.com</a> · hello@bizhigher.com</p></div>`;
    const ok = await sendEmail(env, { to: j.customer_email, bcc: env.NOTIFY_EMAIL || undefined, subject, html: htmlBody });
    if (!ok) throw bad('메일 발송 실패 — Resend 응답 오류 (도메인 인증·발신 주소 확인)');
    const pid = 'pk_' + Date.now().toString(36);
    await db.prepare(`UPDATE deliverables SET sent_at = datetime('now'), packet_id = ? WHERE job_id = ? AND sent_at IS NULL`).bind(pid, j.id).run();
    await addEvent(db, j.id, 'deliverable', null, null, `📨 고객에게 결과물 ${ds.length}건 묶음 발송 (${j.customer_email}) — 고객 페이지 ${portal}`);
    return { count: ds.length, portal };
  }
  if (res === 'jobs' && id && sub === 'draft-batch' && method === 'POST') {
    // 한 작업의 초안 대기 결과물을 한 통으로 David 메일에 — 결과물마다 메일이 가던 것을 묶는다 (2026-10-21)
    const j = await db.prepare(`SELECT * FROM jobs WHERE id = ?`).bind(Number(id)).first();
    if (!j) return undefined;
    if (!env.RESEND_API_KEY) throw bad('RESEND_API_KEY 가 없어 초안을 보낼 수 없습니다');
    const ds = (await db.prepare(`SELECT * FROM deliverables WHERE job_id = ? AND sent_at IS NULL AND drafted_at IS NULL ORDER BY id ASC`).bind(j.id).all()).results || [];
    if (!ds.length) throw bad('초안 대기 결과물이 없습니다');
    const subject = `[초안 → 고객에게 전달] ${j.business || ''} — 결과물 ${ds.length}건`;
    await notify(env, subject, [
      ['받는 고객', escHtml(j.customer_email || '(이메일 없음)')],
      ['결과물 ' + ds.length + '건', ds.map((d) => (d.url ? `<a href="${escHtml(d.url)}">${escHtml(d.title)}</a>` : escHtml(d.title) + ' <span style="color:#6b7280">(관리자 페이지에서 확인)</span>')).join('<br>')],
      ['본문 (복사해 고객에게 보내세요)', `<pre style="white-space:pre-wrap;font:inherit">${escHtml(String(body.text || '').slice(0, 20000))}</pre>`],
    ], { footer: 'David 전용 초안 메일입니다 — 고객에게는 자동 발송되지 않습니다. 위 본문만 복사해 보내고 관리자 페이지에서 "보냈음"을 누르세요.' });
    await db.prepare(`UPDATE deliverables SET drafted_at = datetime('now') WHERE job_id = ? AND sent_at IS NULL AND drafted_at IS NULL`).bind(j.id).run();
    await addEvent(db, j.id, 'deliverable', null, null, `✉ 고객용 초안(결과물 ${ds.length}건 묶음)을 David 메일로 전달`);
    return { count: ds.length };
  }
  if (res === 'deliverables' && id && sub === 'draft-to-david' && method === 'POST') {
    const d = await db.prepare(`SELECT d.*, j.business, j.customer_email, j.service_name FROM deliverables d JOIN jobs j ON j.id = d.job_id WHERE d.id = ?`).bind(Number(id)).first();
    if (!d) return undefined;
    if (!env.RESEND_API_KEY) throw bad('RESEND_API_KEY 가 없어 초안을 보낼 수 없습니다');
    const subject = `[초안 → 고객에게 전달] [BizHigher] ${d.service_name || ''} 결과물이 도착했습니다 — ${d.business || ''}`;
    const bodyText = String(body.text || '').slice(0, 20000);
    await notify(env, subject, [
      ['받는 고객', escHtml(d.customer_email || '(이메일 없음)')],
      ['결과물', d.url ? `<a href="${escHtml(d.url)}">${escHtml(d.title)}</a>` : escHtml(d.title)],
      ['본문 (복사해 고객에게 보내세요)', `<pre style="white-space:pre-wrap;font:inherit">${escHtml(bodyText)}</pre>`],
    ], { footer: 'David 전용 초안 메일입니다 — 고객에게는 자동 발송되지 않습니다. 위 본문만 복사해 보내고 관리자 페이지에서 "보냈음"을 누르세요.' });
    await db.prepare(`UPDATE deliverables SET drafted_at = datetime('now') WHERE id = ?`).bind(d.id).run();
    await addEvent(db, d.job_id, 'deliverable', null, null, `✉ 고객용 초안을 David 메일로 전달 — ${d.title}`);
    return {};
  }
  if (res === 'deliverables' && id && sub === 'drafted' && method === 'POST') {
    const d = await db.prepare(`SELECT * FROM deliverables WHERE id = ?`).bind(Number(id)).first();
    if (!d) return undefined;
    await db.prepare(`UPDATE deliverables SET drafted_at = datetime('now') WHERE id = ?`).bind(d.id).run();
    await addEvent(db, d.job_id, 'deliverable', null, null, `✉ Gmail 초안 생성 — ${d.title}${body.note ? ' · ' + String(body.note).slice(0, 200) : ''}`);
    return {};
  }

  /* 설정 */
  if (res === 'settings' && method === 'GET') return { settings: await getSettings(db) };
  if (res === 'settings' && method === 'GET') return { settings: await getSettings(db) };
  if (res === 'settings' && method === 'POST') {
    const cur = await getSettings(db);
    const next = { ...cur, ...(body.settings || {}) };
    await db.prepare(`INSERT INTO settings (key, value, updated_at) VALUES ('admin', ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`).bind(JSON.stringify(next)).run();
    return { settings: next };
  }

  /* 작업 목록 */
  if (res === 'jobs' && method === 'GET' && !id) {
    const status = url.searchParams.get('status') || '';
    const where = status === 'open' ? `WHERE j.status NOT IN ('done','hold')` : status ? `WHERE j.status = ?` : '';
    const stmt = db.prepare(`SELECT j.*, o.amount_cents, o.status order_status, o.customer_name, o.service_name o_service_name FROM jobs j LEFT JOIN orders o ON o.id = j.order_id ${where} ORDER BY j.id DESC LIMIT 300`);
    const jobs = (await (status && status !== 'open' ? stmt.bind(status) : stmt).all()).results || [];
    const tmap = await tasksByJob(db, jobs.map((j) => j.id));
    return { jobs: jobs.map((j) => boardRow(j, tmap[j.id] || [])), statuses: JOB_STATUSES, who: WHO };
  }

  if (res === 'jobs' && id === 'from-intake' && method === 'POST') {
    const intake = await db.prepare(`SELECT * FROM intakes WHERE id = ?`).bind(Number(body.intake_id)).first();
    if (!intake) throw bad('질문지를 찾을 수 없습니다');
    const dup = await db.prepare(`SELECT id FROM jobs WHERE intake_id = ?`).bind(intake.id).first();
    if (dup) return { job_id: dup.id };
    const r = await db.prepare(`INSERT INTO jobs (intake_id, business, service_slug, customer_email, status) VALUES (?, ?, ?, ?, 'info')`).bind(intake.id, intake.business || '', intake.service || '', (intake.email || '').toLowerCase()).run();
    await addEvent(db, r.meta.last_row_id, 'system', null, 'info', `질문지 #${intake.id}로 작업 생성 (관리자)`);
    await seedTasks(db, r.meta.last_row_id, intake.service);
    return { job_id: r.meta.last_row_id };
  }

  /* 고객 여정 */
  if (res === 'jobs' && id && method === 'GET') {
    const job = await db.prepare(`SELECT * FROM jobs WHERE id = ?`).bind(Number(id)).first();
    if (!job) return undefined;
    const order = job.order_id ? await db.prepare(`SELECT * FROM orders WHERE id = ?`).bind(job.order_id).first() : null;
    const payments = job.order_id ? (await db.prepare(`SELECT * FROM payments WHERE order_id = ? ORDER BY paid_at DESC`).bind(job.order_id).all()).results : [];
    const intake = job.intake_id ? await db.prepare(`SELECT * FROM intakes WHERE id = ?`).bind(job.intake_id).first() : null;
    const events = (await db.prepare(`SELECT * FROM job_events WHERE job_id = ? ORDER BY id DESC LIMIT 60`).bind(job.id).all()).results;
    const deliverables = (await db.prepare(`SELECT * FROM deliverables WHERE job_id = ? ORDER BY id ASC`).bind(job.id).all()).results;
    const tasks = await syncPlaybook(db, job, ((await db.prepare(`SELECT * FROM job_tasks WHERE job_id = ? ORDER BY sort ASC, id ASC`).bind(job.id).all()).results || []).map((t) => ({ ...t, checks: parseJson(t.checks, []) })));
    const history = job.customer_email ? (await db.prepare(`SELECT id, business, service_name, service_slug, status, created_at FROM jobs WHERE lower(customer_email) = ? AND id != ? ORDER BY id DESC LIMIT 10`).bind(job.customer_email.toLowerCase(), job.id).all()).results : [];
    const intakeCandidates = !job.intake_id && job.customer_email ? await safeAll(db, `SELECT id, service, business, contact_name, created_at FROM intakes WHERE lower(email) = ? AND id NOT IN (SELECT intake_id FROM jobs WHERE intake_id IS NOT NULL) ORDER BY id DESC LIMIT 5`, job.customer_email.toLowerCase()) : [];

    // 레인
    const since = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 19).replace('T', ' ');
    // 레인은 "지금 단계"(가장 앞선 미완료 phase)만 보여준다 — 먼 미래의 단계는 아래 서비스별 진행과 전체 단계에서 본다
    const cur = currentPhaseTasks(tasks);
    const lanes = {
      // 최근 완료 순 12개 (플레이북 순서가 아니라 시간 순 — 방금 끝난 게 맨 위)
      ai: tasks.filter((t) => CLOSED.has(t.status) && t.who !== 'david' && t.who !== 'customer').sort((a, b) => String(b.done_at || '').localeCompare(String(a.done_at || ''))),
      mine: tasks.filter((t) => t.status === 'review' || (t.who === 'david' && t.status === 'doing') || (cur.includes(t) && t.who === 'david' && t.status === 'todo')).slice(0, 8),
      customer: cur.filter((t) => t.who === 'customer' && t.status !== 'blocked').slice(0, 8),
      received: tasks.filter((t) => t.who === 'customer' && t.status === 'done').sort((a, b) => String(b.done_at || '').localeCompare(String(a.done_at || ''))).slice(0, 12),
      blocked: tasks.filter((t) => t.status === 'blocked').slice(0, 8),
    };
    // 서비스별 진행
    const byService = [];
    for (const t of tasks) { let s = byService.find((x) => x.service === t.service); if (!s) { s = { service: t.service, name: t.service_name, tasks: [] }; byService.push(s); } s.tasks.push(t); }
    const services = byService.map((s) => ({ service: s.service, name: s.name, pct: jobProgress(s.tasks), next: nextAction(s.tasks), total: s.tasks.length, done: s.tasks.filter((t) => CLOSED.has(t.status)).length }));
    // 마일스톤
    const pct = jobProgress(tasks);
    const has = (ph) => tasks.some((t) => t.phase === ph);
    const phaseDone = (ph) => tasks.filter((t) => t.phase === ph).every((t) => CLOSED.has(t.status));
    const firstDeliverable = deliverables[0];
    const milestones = [
      { key: 'paid', label: '결제', state: order ? 'done' : (job.order_id ? 'done' : 'todo'), sub: order ? (order.created_at || '').slice(5, 10).replace('-', '/') + ' · 자동' : '기록 없음' },
      { key: 'intake', label: '정보 입력', state: intake ? 'done' : 'todo', sub: intake ? (intake.created_at || '').slice(5, 10).replace('-', '/') + ' · 질문지' : '질문지 대기' },
      { key: 'setup', label: '셋업', state: !has('setup') ? 'skip' : phaseDone('setup') ? 'done' : (phaseDone('onboarding') || tasks.some((t) => t.phase === 'setup' && t.status !== 'todo')) ? 'now' : 'todo', sub: has('setup') ? `${tasks.filter((t) => t.phase === 'setup' && CLOSED.has(t.status)).length}/${tasks.filter((t) => t.phase === 'setup').length} 단계` : '해당 없음' },
      { key: 'first', label: '첫 결과물', state: firstDeliverable ? 'done' : 'todo', sub: firstDeliverable ? (firstDeliverable.created_at || '').slice(5, 10).replace('-', '/') : (job.due_date ? '예정 ' + job.due_date.slice(5).replace('-', '/') : '') },
      { key: 'monthly', label: '월간 운영', state: !has('monthly') && !has('weekly') && !has('daily') ? 'skip' : tasks.some((t) => ['monthly', 'weekly', 'daily'].includes(t.phase) && CLOSED.has(t.status)) ? 'now' : 'todo', sub: has('monthly') ? jobPhase(job, tasks).replace(/^.*— /, '') : '해당 없음' },
      { key: 'report', label: '180일 리포트', state: job.status === 'done' ? 'done' : 'todo', sub: job.created_at ? new Date(new Date(job.created_at.replace(' ', 'T') + 'Z').getTime() + 180 * 864e5).toISOString().slice(0, 10).replace(/-/g, '/') : '' },
    ];
    const summary = summarize(tasks.map((t) => ({ who: t.who, verify: !!t.verify, min: t.david_min, ph: t.phase, block: t.block })));
    // AI 차례: 지금 단계에서 AI(auto·ai)가 해야 하는데 아직 결과물이 없는 단계 — 이건 저절로 돌지 않는다(§12-1), fulfillment 루틴/David 호출이 실행한다
    const aiPending = aiReady(tasks);
    const lastMove = tasks.map((t) => t.done_at || t.requested_at || '').concat(events.map((e) => e.created_at || '')).filter(Boolean).sort().pop() || job.created_at;
    const stuckDays = lastMove ? Math.floor((Date.now() - new Date(String(lastMove).replace(' ', 'T') + 'Z').getTime()) / 864e5) : 0;
    const nx = nextAction(tasks);
    const stuck = !!(nx && (nx.who === 'auto' || (nx.who === 'ai' && nx.status !== 'review')) && stuckDays >= 1);
    const brief = aiBrief(job, intake, order, aiPending, url);
    const doneList = tasks.filter((t) => CLOSED.has(t.status));
    const progressSummary = {
      done: doneList.length, review: tasks.filter((t) => t.status === 'review').length,
      remaining: tasks.filter((t) => !CLOSED.has(t.status) && t.status !== 'review').length,
      byOwner: ['auto', 'ai', 'david', 'customer', 'blocked'].reduce((a, w) => { a[w] = { done: doneList.filter((t) => t.who === w).length, left: tasks.filter((t) => t.who === w && !CLOSED.has(t.status)).length }; return a; }, {}),
      byPhase: PHASES.map(([k, l]) => ({ key: k, label: l, done: tasks.filter((t) => t.phase === k && CLOSED.has(t.status)).length, total: tasks.filter((t) => t.phase === k).length })).filter((p) => p.total),
    };
    const portal = `${url.origin}/c/${await ensurePortalToken(db, job)}`;
    const siteRow = await db.prepare(`SELECT id, slug, domain, live, version, updated_at, spec FROM sites WHERE job_id = ?`).bind(job.id).first().catch(() => null);
    if (siteRow) { const sp = parseJson(siteRow.spec, {}); siteRow.tier = sp.tier === 'business' ? 'business' : 'onepage'; siteRow.style = (sp.theme && (sp.theme.style || sp.theme.mood)) || ''; siteRow.forward_to = (sp.contact && sp.contact.forward_to) || ''; delete siteRow.spec; siteRow.leads = ((await db.prepare(`SELECT COUNT(*) AS n FROM site_leads WHERE site_id = ?`).bind(siteRow.id).first().catch(() => null)) || {}).n || 0; }
    return { portal, site: siteRow ? { ...siteRow, preview_url: `https://${env.SITES_PROJECT || 'bizhigher-sites'}.pages.dev/${siteRow.slug}/`, preview_host: `https://${siteRow.slug}.sites.bizhigher.com` } : null, job: { ...job, pct, phase: jobPhase(job, tasks), dueInfo: dueLabel(job.due_date), day: job.created_at ? Math.max(1, Math.floor((Date.now() - new Date(job.created_at.replace(' ', 'T') + 'Z').getTime()) / 864e5) + 1) : 1 }, order, payments, intake, events, deliverables, tasks, lanes, services, milestones, next: nextAction(tasks), summary: { ...summary, bottlenecks: undefined }, history, intakeCandidates, aiPending, stuck, stuckDays, lastMove, brief, progressSummary, who: WHO, phases: PHASES, taskStatuses: TASK_STATUSES, statuses: JOB_STATUSES };
  }

  if (res === 'jobs' && id && method === 'POST') {
    const jid = Number(id);
    const job = await db.prepare(`SELECT * FROM jobs WHERE id = ?`).bind(jid).first();
    if (!job) return undefined;
    if (sub === 'status') {
      const to = String(body.status || '');
      if (!JOB_STATUSES.some(([k]) => k === to)) throw bad('잘못된 상태');
      await db.prepare(`UPDATE jobs SET status = ?, updated_at = datetime('now') WHERE id = ?`).bind(to, jid).run();
      await addEvent(db, jid, 'status', job.status, to, String(body.note || '').slice(0, 2000));
      return {};
    }
    if (sub === 'note') { const note = String(body.note || '').trim().slice(0, 4000); if (!note) throw bad('메모가 비어 있습니다'); await addEvent(db, jid, 'note', null, null, note); return {}; }
    if (sub === 'due') { const d = String(body.due_date || '').slice(0, 10); if (d && !/^\d{4}-\d{2}-\d{2}$/.test(d)) throw bad('날짜 형식 YYYY-MM-DD'); await db.prepare(`UPDATE jobs SET due_date = ?, updated_at = datetime('now') WHERE id = ?`).bind(d || null, jid).run(); await addEvent(db, jid, 'note', null, null, `마감 ${d || '해제'}`); return {}; }
    if (sub === 'business') { await db.prepare(`UPDATE jobs SET business = ?, updated_at = datetime('now') WHERE id = ?`).bind(String(body.business || '').trim().slice(0, 200), jid).run(); return {}; }
    if (sub === 'deliverable' && !subId) { const title = String(body.title || '').trim().slice(0, 200), link = String(body.url || '').trim().slice(0, 1000); if (!title) throw bad('제목이 비어 있습니다'); const r = await db.prepare(`INSERT INTO deliverables (job_id, title, url) VALUES (?, ?, ?)`).bind(jid, title, link).run(); await addEvent(db, jid, 'deliverable', null, null, `결과물 추가: ${title}`); return { id: r.meta.last_row_id }; }
    if (sub === 'deliverable' && subId) { await db.prepare(`UPDATE deliverables SET sent_at = ${body.sent ? "datetime('now')" : 'NULL'} WHERE id = ? AND job_id = ?`).bind(Number(subId), jid).run(); if (body.sent) await addEvent(db, jid, 'deliverable', null, null, `결과물 발송 완료 (#${subId})`); return {}; }
    if (sub === 'tasks' && subId === 'seed') return { added: await seedTasks(db, jid, body.slug || job.service_slug, { force: !!body.force }) };
    if (sub === 'link-intake') { const iid = Number(body.intake_id); const intake = await db.prepare(`SELECT id, business FROM intakes WHERE id = ?`).bind(iid).first(); if (!intake) throw bad('질문지를 찾을 수 없습니다'); await db.prepare(`UPDATE jobs SET intake_id = ?, business = CASE WHEN business = '' OR business IS NULL THEN ? ELSE business END, updated_at = datetime('now') WHERE id = ?`).bind(iid, intake.business || '', jid).run(); await addEvent(db, jid, 'system', null, null, `질문지 #${iid} 연결 (관리자)`); return {}; }
    return undefined;
  }

  /* 플레이북 */
  if (res === 'playbook' && method === 'GET') {
    const slug = url.searchParams.get('slug') || '';
    const tasks = slug ? tasksFor(slug) : [];
    const catalog = Object.entries(PLAYBOOK).map(([k, v]) => ({ slug: k, name: v.name, ...summarize(v.steps), bottlenecks: undefined }));
    const packages = [];
    for (const pkg of ['local-starter', 'local-growth', 'local-premium']) for (const per of ['monthly', 'six', 'annual']) { const sm = summarize(tasksFor(`${pkg}-${per}`)); packages.push({ slug: `${pkg}-${per}`, total: sm.total, autoPct: sm.autoPct, setupMin: sm.setupMin, monthMin: sm.monthMin, verify: sm.verify, blocked: sm.by.blocked }); }
    return { slug, tasks, summary: slug ? { ...summarize(tasks), bottlenecks: undefined } : null, catalog, packages, who: WHO, phases: PHASES, common: COMMON_ONBOARDING };
  }

  /* 데모 */
  if (res === 'demo' && method === 'POST' && id === 'clear') {
    // 업체명에 (데모)가 있거나, 데모 이메일(@….example)로 만들어진 작업(질문지 재제출로 생긴 것 포함)
    const jobs = (await db.prepare(`SELECT id, order_id, intake_id FROM jobs WHERE business LIKE '%(데모)%' OR lower(customer_email) LIKE '%@%.example'`).all()).results || [];
    for (const j of jobs) {
      await db.batch([
        db.prepare(`DELETE FROM job_tasks WHERE job_id = ?`).bind(j.id), db.prepare(`DELETE FROM job_events WHERE job_id = ?`).bind(j.id), db.prepare(`DELETE FROM deliverables WHERE job_id = ?`).bind(j.id),
        db.prepare(`DELETE FROM payments WHERE order_id = ?`).bind(j.order_id || -1), db.prepare(`DELETE FROM orders WHERE id = ? AND stripe_session_id LIKE 'demo_%'`).bind(j.order_id || -1), db.prepare(`DELETE FROM jobs WHERE id = ?`).bind(j.id),
      ]);
      if (j.intake_id) await safeRun(db, `DELETE FROM intakes WHERE id = ? AND (business LIKE '%(데모)%' OR lower(email) LIKE '%@%.example')`, j.intake_id);
    }
    await safeRun(db, `DELETE FROM intakes WHERE lower(email) LIKE '%@%.example'`);
    return { removed: jobs.length };
  }
  if (res === 'demo' && method === 'POST') {
    const catalog = await loadCatalog(env, url.toString());
    const made = [];
    const only = String(body.only || '').toLowerCase();
    let list = demoCustomers();
    if (only) list = list.filter((d) => d.business.toLowerCase().includes(only) || d.slug.includes(only));
    if (!list.length) throw bad('해당 데모 고객이 없습니다: ' + only);
    for (const d of list) {
      // fresh: 결제 직후처럼 온보딩부터 전부 비운다 — 루틴이 처음부터 처리하는 것을 보기 위함
      const x = body.fresh ? { ...d, daysAgo: 0, done: [], doneResults: {}, doing: [], review: {}, noIntake: true } : d;
      made.push(await seedDemo(db, catalog, x));
    }
    const first = list[0];
    return { jobs: made, intake_url: body.fresh ? `/thanks/?service=${encodeURIComponent(first.slug)}&email=${encodeURIComponent(first.email)}&business=${encodeURIComponent(first.business)}&contact=${encodeURIComponent(first.contact)}&phone=${encodeURIComponent(first.phone)}` : null };
  }

  /* 목록들 */
  if (res === 'orders' && method === 'GET') return { orders: (await db.prepare(`SELECT o.*, (SELECT id FROM jobs WHERE order_id = o.id ORDER BY id DESC LIMIT 1) job_id FROM orders o ORDER BY o.id DESC LIMIT 300`).all()).results || [] };
  if (res === 'intakes' && method === 'GET') return { intakes: await safeAll(db, `SELECT i.*, (SELECT id FROM jobs WHERE intake_id = i.id LIMIT 1) job_id FROM intakes i ORDER BY i.id DESC LIMIT 300`) };
  if (res === 'leads' && method === 'GET') {
    const leads = await safeAll(db, `SELECT l.*, (SELECT id FROM reports WHERE lead_id = l.id ORDER BY rowid DESC LIMIT 1) report_id FROM audit_leads l ORDER BY l.id DESC LIMIT 300`);
    const toolLeads = await safeAll(db, `SELECT * FROM tool_leads ORDER BY rowid DESC LIMIT 200`);
    return { leads, toolLeads };
  }
  if (res === 'reports' && method === 'GET') {
    const created = (await hasColumn(db, 'reports', 'created_at')) ? 'created_at' : `NULL created_at`;
    const rows = await safeAll(db, `SELECT id, lead_id, business, location, ${created}, substr(report_json, 1, 400) head FROM reports ORDER BY rowid DESC LIMIT 200`);
    for (const r of rows) { const m = /"total"\s*:\s*(\d+)/.exec(r.head || ''); r.total = m ? Number(m[1]) : null; delete r.head; }
    return { reports: rows };
  }
  return undefined;
}

/* ---------- 승인 뒤 자동 진행: 다음 단계가 자동(auto)이면 그대로 '진행'으로 올려 AI 차례임을 표시 ---------- */
async function autoAdvance(db, jobId) {
  const ts = (await db.prepare(`SELECT * FROM job_tasks WHERE job_id = ? ORDER BY sort ASC, id ASC`).bind(jobId).all()).results || [];
  const next = ts.find((t) => !CLOSED.has(t.status) && t.status !== 'blocked');
  if (next && next.status === 'todo' && (next.who === 'auto' || next.who === 'ai')) await db.prepare(`UPDATE job_tasks SET status = 'doing' WHERE id = ?`).bind(next.id).run();
  // 작업 상태도 따라간다
  const pct = jobProgress(ts);
  const job = await db.prepare(`SELECT status FROM jobs WHERE id = ?`).bind(jobId).first();
  if (job && job.status === 'new' && pct > 0) await db.prepare(`UPDATE jobs SET status = 'working', updated_at = datetime('now') WHERE id = ?`).bind(jobId).run();
}
async function nextReview(db, afterId) {
  const r = await db.prepare(`SELECT t.id FROM job_tasks t JOIN jobs j ON j.id = t.job_id WHERE t.status = 'review' AND j.status NOT IN ('done','hold') AND t.id != ? ORDER BY COALESCE(j.due_date,'9999') ASC, t.requested_at ASC, t.id ASC LIMIT 1`).bind(afterId).first();
  return r ? r.id : null;
}

/* ---------- AI 실행 지시서 — David가 claude.ai(fulfillment)에 붙여넣거나 루틴이 읽는다 ---------- */
function aiBrief(job, intake, order, aiPending, url) {
  const origin = url.origin;
  const lines = [];
  lines.push(`# BizHigher 작업 지시 — ${job.business || ''} (작업 #${job.id})`);
  lines.push(`상품: ${job.service_name || job.service_slug || ''} · 시작 ${String(job.created_at || '').slice(0, 10)} · 마감 ${job.due_date || '미정'}`);
  if (intake) {
    lines.push('', '## 고객 정보 (질문지)');
    lines.push(`업체: ${intake.business || ''} · 담당 ${intake.contact_name || ''} · ${intake.phone || ''} · ${intake.email || ''}`);
    if (intake.links) lines.push(`링크: ${intake.links}`);
    if (intake.notes) lines.push('', intake.notes);
  } else lines.push('', '(질문지 미제출 — customer_profiles 또는 David에게 확인)');
  lines.push('', `## 지금 AI가 할 단계 ${aiPending.length}개 (순서대로)`);
  if (!aiPending.length) lines.push('(없음 — 다음 단계는 David 또는 고객 차례)');
  for (const t of aiPending) {
    lines.push(`- [task ${t.id}] ${t.service_name} — ${t.title}${t.verify ? ' (David 검증 필요 → status review)' : ' (검증 불필요 → status done)'}${t.revise_note ? '\n  수정 요청: ' + t.revise_note : ''}`);
  }
  lines.push('', '## 결과물 올리는 법 (둘 중 하나)');
  lines.push(`1) API: POST ${origin}/admin/api/tasks/{task_id}/result  body {"kind":"text|html|link|images","text":"결과물 본문(images면 /a/….jpg URL 한 줄씩)","url":"Drive/프리뷰 링크","checks":["David 확인 포인트 1","2","3"],"self_check":"금지 표현 0건 · 가격 0건 …"} (관리자 로그인 쿠키 필요)`);
  lines.push(`2) D1 bizhigher-db: UPDATE job_tasks SET status='review', result_kind=?, result_text=?, result_url=?, checks=?(JSON), self_check=?, requested_at=datetime('now') WHERE id={task_id}; 검증 불필요 단계는 status='done', done_at=datetime('now')`);
  lines.push('', '규칙: 고객 자동 발송 금지(Gmail 초안까지) · 경쟁사 갭 분석 선행 · 리뷰 대가·가짜 리뷰 금지 · 의료업 환자 암시 금지 · 실행 플랜은 180일 · 웹 산출물 360px 실측 (CLAUDE.md §12)');
  return lines.join('\n');
}

/* ---------- 설정 ---------- */
/* 자동 승인 규칙 — 켜진 규칙의 단계는 검증 큐를 건너뛰고 바로 완료된다(타임라인에 "자동 승인"). 고객에게 가는 것은 어차피 "묶음 보내기" 전에 David가 미리보기로 한 번 더 본다.
 * 2026-10-22 David 결정(B-2): 위험 낮은 것부터 켠다 — 기본 on 4개. 나머지는 관리자 검증 큐 탭에서 켜고 끈다. guard 가 있으면 결과물이 그 조건을 만족할 때만 */
const AUTO_RULES_VERSION = 2;
function defaultAutoRules() {
  return [
    { key: 'kickoff', label: '킥오프 안내 메일 (ob-5)', desc: '템플릿 기반 · 어차피 묶음 보내기 전에 미리보기로 봄', tasks: ['ob-5'], on: true },
    { key: 'nap-docs', label: 'NAP 표준 문서·등록 리포트 (lls-3·lls-7)', desc: '질문지·Places 공개 정보 그대로 정리한 것', tasks: ['lls-3', 'lls-7'], on: true },
    { key: 'review-auto', label: '별 4~5 일반 리뷰 답글 (rr-1·rr-7)', desc: '"사람 승인 필요" 표시가 하나도 없을 때만. 별 1~3·환불·위생·법적은 큐로', tasks: ['rr-1', 'rr-7'], guard: 'no-human-flag', on: true },
    { key: 'creative-brief', label: '크리에이티브 브리프 (ac-1)', desc: '내부 기획 문서 · 소재는 별도 검수', tasks: ['ac-1'], on: true },
    { key: 'profile', label: '고객 프로필 (ob-3)', desc: '뒤 단계가 전부 이걸 읽으므로 당분간 David가 본다', tasks: ['ob-3'], on: false },
    { key: 'body-text', label: '블로그·게시물·콘텐츠 팩 본문 (gpo-3·llp-2·seo-4·post-2)', desc: '금지 표현·가격 언급 0건(self_check)일 때만', tasks: ['gpo-3', 'llp-2', 'seo-4', 'post-2'], guard: 'clean-self-check', on: false },
    { key: 'ad-copy', label: '광고 설계안·CSV (ads-2)', desc: '예산·키워드가 돈과 직결 — 당분간 끔', tasks: ['ads-2'], on: false },
    { key: 'report', label: '리포트류 (gpo-5·mr-4·am-5·ads-5·rr-7 제외)', desc: '숫자 검증 필요 — 당분간 끔', tasks: ['gpo-5', 'mr-4', 'am-5', 'ads-5'], on: false },
    { key: 'qa', label: 'QA 리포트·인쇄 PDF (web-4·llp-4·qr-3)', desc: 'David가 수정 목록을 보고 고쳐야 하는 단계라 끔', tasks: ['web-4', 'llp-4', 'qr-3'], on: false },
  ];
}
function ruleGuardOk(rule, t) {
  const text = String(t.result_text || '') + '\n' + String(t.self_check || '');
  if (rule.guard === 'no-human-flag') return !/사람 승인 필요|HUMAN|\[확인 필요\]/.test(text) || /사람 승인 필요\s*0\s*건/.test(text);
  if (rule.guard === 'clean-self-check') return /금지 표현\s*0\s*건/.test(text) && /가격 언급\s*0\s*건/.test(text) && !/\[확인 필요\]/.test(text);
  return true;
}
async function autoRuleFor(db, t) {
  const s = await getSettings(db);
  return (s.autoRules || []).find((r) => r.on && Array.isArray(r.tasks) && r.tasks.includes(t.key) && ruleGuardOk(r, t)) || null;
}
/* 스펙 깊은 병합(null 은 삭제)·바뀐 키 경로 — automation/ai-runner/sites.js 와 같은 규칙 */
function deepPatch(base, patch) {
  const out = { ...(base || {}) };
  for (const [k, v] of Object.entries(patch || {})) {
    if (v === null) delete out[k];
    else if (v && typeof v === 'object' && !Array.isArray(v) && out[k] && typeof out[k] === 'object' && !Array.isArray(out[k])) out[k] = deepPatch(out[k], v);
    else out[k] = v;
  }
  return out;
}
function specDiff(a, b, prefix = '') {
  const keys = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]); const out = [];
  for (const k of keys) {
    if (k === 'slug') continue;
    const x = a ? a[k] : undefined, y = b ? b[k] : undefined; const p = prefix ? prefix + '.' + k : k;
    if (JSON.stringify(x) === JSON.stringify(y)) continue;
    if (x && y && typeof x === 'object' && typeof y === 'object' && !Array.isArray(x) && !Array.isArray(y)) out.push(...specDiff(x, y, p));
    else out.push(p + (x === undefined ? ' (추가)' : y === undefined ? ' (삭제)' : Array.isArray(y) ? ` (${(x || []).length}→${y.length}개)` : ''));
  }
  return out;
}
async function setSettingsPartial(db, patch) {
  const cur = await getSettings(db); const next = { ...cur, ...patch };
  await db.prepare(`INSERT INTO settings (key, value, updated_at) VALUES ('admin', ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`).bind(JSON.stringify(next)).run();
}
/** 웹사이트 수정 요청 → web-2 단계를 doing + revise_note 로 되돌린다(완료된 것도). 없으면 null */
async function reopenSiteTask(db, jobId, note) {
  const t = await db.prepare(`SELECT id, status, revise_note FROM job_tasks WHERE job_id = ? AND key = 'web-2' ORDER BY id DESC LIMIT 1`).bind(jobId).first();
  if (!t) return null;
  const merged = t.status === 'doing' && t.revise_note ? t.revise_note + '\n' + note : note; // 이미 열려 있으면 요청을 이어 붙인다
  await db.prepare(`UPDATE job_tasks SET status = 'doing', revise_note = ?, done_at = NULL WHERE id = ?`).bind(merged, t.id).run();
  return t;
}
async function getSettings(db) {
  const row = await db.prepare(`SELECT value FROM settings WHERE key = 'admin'`).first();
  const s = row ? parseJson(row.value, {}) : {};
  if (!s.autoRules || s.autoRulesVersion !== AUTO_RULES_VERSION) { s.autoRules = defaultAutoRules(); s.autoRulesVersion = AUTO_RULES_VERSION; }
  return s;
}

/* ---------- 데모 데이터 (New Optix 외 가상 업체) ---------- */
function demoCustomers() {
  const packContent = `New Optix는 가든그로브에서 한국어 상담이 편한 안경점입니다. 얼굴형과 생활 습관에 맞는 프레임을 함께 고르고, 콘택트렌즈와 선글라스, 렌즈 교체까지 한 곳에서 해결합니다. 검안 예약은 전화로 받습니다.

주차가 편한 매장에서 한국어와 영어로 상담하며, 대부분의 안경은 영업일 기준 일주일 안에 받아 보실 수 있습니다. [영업시간] · [주소]

— English —
New Optix is a Korean-speaking optical shop in Garden Grove. We help you choose frames that fit your face and daily life, and handle contact lenses, sunglasses and lens replacement in one visit. Eye exam appointments by phone.

[카테고리 교정안] 기본: 안경점 (Optician) · 추가: 선글라스 매장, 콘택트렌즈 공급업체 · 검토: 검안의(Optometrist)는 면허 확인 후
[서비스 20개] 단초점 안경 · 누진 다초점 · 블루라이트 차단 렌즈 · 선글라스 도수 · 스포츠 고글 · 어린이 안경 · 콘택트렌즈 피팅 · 일회용 렌즈 · 난시용 렌즈 · 렌즈 교체 · 프레임 수리 · 코받침 교체 · 안경 세척 · 검안 예약 · 보험 청구 안내 · 프레임 조정 · 안경 케이스 · 렌즈 코팅 · 자외선 차단 · 한국어 상담
[Q&A 10세트] 보험 되나요? / 검안 예약은? / 렌즈 제작 기간은? / 주차는? / 한국어 상담 가능? / 어린이 안경? / 렌즈만 교체? / 선글라스 도수? / 콘택트렌즈 첫 착용? / 영업시간?
[첫 게시물 4건] 이달의 프레임 · 영업시간·주차 안내 · 콘택트렌즈 관리 팁 · 자외선과 선글라스`;
  return [
    { slug: 'local-premium-annual', business: 'New Optix (데모)', email: 'demo@newoptix.example', phone: '(714) 000-0000', contact: '최 사장', daysAgo: 12, price: 479 * 12,
      links: '구글 프로필 (관리자 초대 완료) · 웹사이트 미정 · 인스타 @newoptix',
      notes: '업종: 안경점·검안 (Garden Grove, CA)\n한 줄 소개: 한국어 상담이 편한 가든그로브 안경점\n서비스: 안경·선글라스 / 콘택트렌즈 / 검안 예약 / 렌즈 교체\n톤: 정중하고 간결한 존댓말, 과장 없이\n금지 표현: 최저가, 100% 보장, 무조건\n언어: 한/영\n\n[데모] 실제 주문이 아닙니다.',
      done: ['ob-3', 'ob-4', 'ob-5', 'gpo-1', 'gpo-2', 'qr-1', 'lls-2', 'lls-3', 'lls-4', 'an-1', 'an-2', 'ads-1', 'web-1', 'post-1', 'seo-1', 'rr-1'],
      doneResults: {
        'gpo-2': { kind: 'text', text: '경쟁사 갭 분석 — Garden Grove 안경점 3곳 (Places, 2026-10-17)\n\n| 항목 | New Optix | A안경 | B Optical | C Vision |\n|---|---|---|---|---|\n| 기본 카테고리 | 안경점 | 안경점 | 검안의 | 안경점 |\n| 추가 카테고리 | 없음 | 선글라스 매장 | 안경점·콘택트렌즈 | 선글라스 매장 |\n| 리뷰 수 / 평점 | 41 / 4.6 | 118 / 4.7 | 203 / 4.5 | 77 / 4.8 |\n| 최근 90일 신규 리뷰 | 2 | 9 | 14 | 6 |\n| 게시물 활동 | 없음 | 주 1회 | 없음 | 월 2회 |\n| 예약 속성 | 없음 | 온라인 예약 | 온라인 예약 | 없음 |\n\n우선순위: 전원 보유 = 추가 카테고리(필수) · 2곳 = 온라인 예약 속성(강력 권장) · 1곳 = 주 1회 게시물(차별화 기회). 리뷰 속도 목표: 월 4건(현재 0.7건).', self_check: 'Places 조회 3곳 · 수동 보강 2항목(속성·게시물)' },
        'ob-3': { kind: 'text', text: '고객 프로필 저장 — customer_profiles #demo\n업종 안경점·검안 · 도시 Garden Grove CA · 언어 한/영 · 톤 정중하고 간결한 존댓말 · 금지 표현 최저가/100% 보장/무조건 · 경쟁사 3곳 · 타깃 키워드: 가든그로브 안경, Garden Grove optical, 한인 안경점, 콘택트렌즈 가든그로브' },
        'qr-1': { kind: 'link', url: 'https://search.google.com/local/writereview?placeid=ChIJdemo-newoptix', text: 'place_id 확인 → 리뷰 링크 생성 → QR(오류정정 H, #0A4DF5) 생성 · 스캔 테스트 3회 OK' },
      },
      review: { 'gpo-3': { kind: 'text', text: packContent, checks: ['카테고리 교정안이 맞는가 (안경점 → 검안의 추가?)', '검안·처방을 확인하거나 암시하는 표현이 없는가', '영문 설명 톤이 매장 분위기와 맞는가'], self_check: '금지 표현 0건 · 가격 언급 0건 · 검안·처방 표현 0건 · 글자 수 706/750 · 경쟁사 상호 0건' },
        'qr-2': { kind: 'link', url: 'https://drive.google.com/drive/folders/demo-newoptix-qr', text: '테이블텐트 4×6 양면 · 포스터 레터 · 카운터 카드 5×7 · 스티커 2.5" × 6 — 한/영 "리뷰 한 줄이 큰 힘이 됩니다 / Your review means a lot!"', checks: ['리뷰 대가 문구가 없는가', 'QR 스캔이 리뷰 작성 화면으로 가는가', '브랜드 색이 간판과 맞는가'], self_check: 'QR 스캔 테스트 3회 OK · 재단선 3mm · 오탈자 0건' } },
      doing: ['ads-2', 'lls-5'] },
    { slug: 'local-growth-annual', business: '한남 치킨 (데모)', email: 'demo@hannam.example', phone: '(213) 000-0001', contact: '박 사장', daysAgo: 31, price: 279 * 12,
      links: 'https://maps.google.com/?cid=demo-hannam · 인스타 @hannamchicken', notes: '업종: 치킨·배달 (Koreatown LA)\n톤: 친근한 존댓말\n[데모]',
      done: ['ob-3', 'ob-4', 'ob-5', 'gpo-1', 'gpo-2', 'gpo-3', 'gpo-4', 'gpo-5', 'qr-1', 'qr-2', 'qr-3', 'lls-2', 'lls-3', 'lls-4', 'lls-5', 'an-1', 'an-2', 'an-3', 'llp-1', 'llp-2', 'llp-3', 'llp-4', 'web-1'],
      review: { 'web-2': { kind: 'link', url: 'https://hannam-chicken.bizhigher-site.pages.dev', text: '5페이지(홈·메뉴·매장·이벤트·문의) · 한/영 · 문의 폼 Resend 연결 테스트 OK · 360px 실측 완료 · 속도 98점', checks: ['메뉴·가격이 고객 질문지와 같은가', '사진 배치가 실제 매장 사진인가', '전화·지도 버튼이 폰에서 눌리는가'], self_check: '깨진 링크 0 · 이미지 alt 100% · 한글 오탈자 0건' } },
      doing: [] },
    { slug: 'local-starter-six', business: '가든 네일 (데모)', email: 'demo@gardennail.example', phone: '(714) 000-0002', contact: '김 원장', daysAgo: 74, price: 179 * 6,
      links: 'https://maps.google.com/?cid=demo-gardennail · 인스타 @garden.nail.gg', notes: '업종: 네일샵 (Garden Grove)\n[데모]',
      done: ['ob-3', 'ob-4', 'ob-5', 'gpo-1', 'gpo-2', 'gpo-3', 'gpo-4', 'gpo-5', 'qr-1', 'qr-2', 'qr-3', 'lls-1', 'lls-2', 'lls-3', 'lls-4', 'lls-5', 'lls-6', 'lls-7', 'post-1', 'rr-1', 'cp-3', 'mr-1'],
      review: { 'post-2': { kind: 'text', text: '11월 게시물 캘린더 8건\n\n11/3 가을 네일 컬러 5가지 — 사진: 샘플 팁 5개 나란히\n11/6 손톱 관리 팁 3가지 — 사진: 큐티클 오일\n11/10 예약 안내 (문자·전화) — 이미지: 템플릿\n11/13 손님 후기 감사 — 사진: 리뷰 캡처 (이름 가림)\n11/17 젤 vs 일반 매니큐어 — 사진: 비교\n11/20 추수감사절 영업시간 — [고객 확인]\n11/24 연말 예약 오픈 — 이미지: 템플릿\n11/27 블랙프라이데이 — 할인율 [고객 확인]', checks: ['할인 문구가 고객이 승인한 것인가', '추수감사절 영업시간이 맞는가', '사진이 필요한 건에 촬영 가이드가 붙었는가'], self_check: '금지 표현 0 · 리뷰 대가 문구 0 · 키워드(가든그로브 네일) 8/8 삽입' } },
      doing: ['ac-2'] },
    { slug: 'local-premium-six', business: '미소 한의원 (데모)', email: 'demo@miso.example', phone: '(213) 000-0003', contact: '이 원장', daysAgo: 4, price: 619 * 6,
      links: '', notes: '업종: 한의원 (LA)\n주의: 의료 — 환자 여부 암시 금지(HIPAA)\n[데모]',
      done: ['ob-3'], review: {}, doing: [] },
  ];
}
async function seedDemo(db, catalog, d) {
  const item = catalog.bySlug[d.slug] || { name: d.slug, deliveryDays: 7 };
  const sid = 'demo_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
  const createdAt = new Date(Date.now() - d.daysAgo * 864e5).toISOString().slice(0, 19).replace('T', ' ');
  const sub = /monthly|installment/.test(d.slug);
  const r = await db.prepare(`INSERT INTO orders (stripe_session_id, service_slug, service_name, period, mode, amount_cents, currency, interval, status, customer_email, customer_name, customer_phone, paid_count, last_paid_at, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,1,?,?)`)
    .bind(sid, d.slug, item.name, item.period || null, sub ? 'subscription' : 'payment', d.price * 100, 'usd', item.interval || null, sub ? 'active' : 'paid', d.email, d.business, d.phone, createdAt, createdAt).run();
  const orderId = r.meta.last_row_id;
  await db.prepare(`INSERT INTO payments (order_id, stripe_id, amount_cents, currency, reason, paid_at) VALUES (?,?,?,?,?,?)`).bind(orderId, 'demo_pi_' + orderId, d.price * 100, 'usd', 'demo', createdAt).run();
  const jobId = await createJobForOrder(db, { id: orderId, service_slug: d.slug, service_name: item.name, amount_cents: d.price * 100, customer_email: d.email, customer_name: d.business }, { deliveryDays: item.deliveryDays });
  // fresh(결제 직후) 데모는 질문지를 넣지 않는다 — David가 /thanks/ 질문지를 직접 써서 같은 이메일로 붙인다 (실제 흐름과 동일)
  const intakeId = d.noIntake ? null : await safeInsertIntake(db, { service: d.slug, business: d.business, contact_name: d.contact, phone: d.phone, email: d.email, links: d.links, notes: d.notes });
  if (intakeId) await attachIntake(db, { id: intakeId, service: d.slug, service_name: item.name, business: d.business, email: d.email }, { deliveryDays: item.deliveryDays });
  await db.prepare(`UPDATE jobs SET business = ?, created_at = ?, due_date = ? WHERE id = ?`).bind(d.business, createdAt, new Date(Date.now() + (d.daysAgo > 30 ? 0 : 3) * 864e5).toISOString().slice(0, 10), jobId).run();
  for (const k of d.done) await db.prepare(`UPDATE job_tasks SET status = 'done', done_at = datetime('now', ?) WHERE job_id = ? AND key = ?`).bind(`-${Math.floor(Math.random() * 20)} hours`, jobId, k).run();
  for (const [k, rv] of Object.entries(d.doneResults || {})) await db.prepare(`UPDATE job_tasks SET result_kind = ?, result_text = ?, result_url = ?, self_check = ? WHERE job_id = ? AND key = ?`).bind(rv.kind, rv.text || '', rv.url || '', rv.self_check || '', jobId, k).run();
  for (const k of d.doing) await db.prepare(`UPDATE job_tasks SET status = 'doing' WHERE job_id = ? AND key = ?`).bind(jobId, k).run();
  for (const [k, rv] of Object.entries(d.review)) {
    await db.prepare(`UPDATE job_tasks SET status = 'review', result_kind = ?, result_text = ?, result_url = ?, checks = ?, self_check = ?, requested_at = datetime('now','-3 hours') WHERE job_id = ? AND key = ?`)
      .bind(rv.kind, rv.text || '', rv.url || '', JSON.stringify(rv.checks || []), rv.self_check || '', jobId, k).run();
  }
  if (d.done.length) await db.prepare(`UPDATE jobs SET status = 'working' WHERE id = ? AND status IN ('new','info')`).bind(jobId).run();
  return jobId;
}

/* 플레이북이 바뀌어 더는 '막힘'이 아닌 단계를 풀어 준다 (예: fal.ai 연결로 sv-2, 마스터 목록 작성으로 lls-1). 작업을 열거나 루틴 큐를 뽑을 때 호출 */
async function syncPlaybook(db, job, tasks) {
  const blocked = (tasks || []).filter((t) => t.status === 'blocked');
  if (!blocked.length) return tasks;
  let defs = [];
  try { defs = tasksFor(job.service_slug || ''); } catch { return tasks; }
  const byKey = new Map(defs.map((d) => [d.k, d]));
  for (const t of blocked) {
    const d = byKey.get(t.key);
    if (!d || d.who === 'blocked') continue;
    await db.prepare(`UPDATE job_tasks SET status = 'todo', who = ?, block = ?, next = ? WHERE id = ?`).bind(d.who, d.block || '', d.next || '', t.id).run();
    await addEvent(db, job.id, 'task', null, null, `🔓 막힘 해제 — ${t.title} (플레이북 갱신 → ${(WHO[d.who] && WHO[d.who].label) || d.who})`);
    Object.assign(t, { status: 'todo', who: d.who, block: d.block || '', next: d.next || '' });
  }
  return tasks;
}

/* 결과물 목록에 1번만 올린다 (같은 작업·같은 제목이 있으면 건너뜀) */
async function ensureDeliverable(db, t) {
  const dup = await db.prepare(`SELECT id, revise_note FROM deliverables WHERE job_id = ? AND title = ? LIMIT 1`).bind(t.job_id, t.title.slice(0, 200)).first();
  if (dup) {
    // 같은 단계를 다시 승인(고객 수정 요청 반영 등) → 새 결과물로 취급: 전달 전·요약 없음·승인 전으로 되돌려 다음 묶음에 다시 들어가게
    await db.prepare(`UPDATE deliverables SET task_id = ?, kind = ?, url = CASE WHEN ? != '' THEN ? ELSE url END, sent_at = NULL, packet_id = NULL, summary = NULL, approved_at = NULL, revise_note = NULL WHERE id = ?`).bind(t.id, t.result_kind || null, t.result_url || '', t.result_url || '', dup.id).run();
    return dup.id;
  }
  const r = await db.prepare(`INSERT INTO deliverables (job_id, title, url, task_id, kind, needs_approval) VALUES (?, ?, ?, ?, ?, ?)`).bind(t.job_id, t.title.slice(0, 200), t.result_url || '', t.id, t.result_kind || null, APPROVAL_KEYS.has(t.key) ? 1 : 0).run();
  return r.meta && r.meta.last_row_id;
}

/* ---------- 유틸 ---------- */
function parseJson(s, d) { try { return s ? JSON.parse(s) : d; } catch { return d; } }
async function safeAll(db, sql, ...bind) { try { return (await db.prepare(sql).bind(...bind).all()).results || []; } catch (e) { if (/no such table/.test(String(e))) return []; throw e; } }
async function safeRun(db, sql, ...bind) { try { await db.prepare(sql).bind(...bind).run(); } catch {} }
async function safeFirst(db, sql, ...bind) { try { return await db.prepare(sql).bind(...bind).first(); } catch { return null; } }
async function safeInsertIntake(db, i) { try { const r = await db.prepare(`INSERT INTO intakes (service, business, contact_name, phone, email, links, notes) VALUES (?,?,?,?,?,?,?)`).bind(i.service, i.business, i.contact_name, i.phone, i.email, i.links, i.notes).run(); return r.meta && r.meta.last_row_id; } catch { return null; } }
const colCache = {};
async function hasColumn(db, table, col) { if (!colCache[table]) { try { colCache[table] = ((await db.prepare(`PRAGMA table_info(${table})`).all()).results || []).map((r) => r.name); } catch { colCache[table] = []; } } return colCache[table].includes(col); }
function json(obj, status = 200) { return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...NOINDEX } }); }
function html(body, status = 200) { return new Response(body, { status, headers: { 'Content-Type': 'text/html; charset=utf-8', ...NOINDEX } }); }
