/**
 * 관리자 페이지 — /admin/  (HTML 앱 + JSON API)
 * 인증은 _auth.js (ADMIN_PASSWORD 또는 Cloudflare Access). 검색엔진 noindex.
 *
 *   GET  /admin/                       앱 (미인증이면 로그인 폼)
 *   POST /admin/login · /admin/logout
 *   GET  /admin/api/summary            대시보드 숫자
 *   GET  /admin/api/jobs?status=       작업 목록 (주문·질문지 조인)
 *   GET  /admin/api/jobs/:id           작업 상세 (주문·입금·질문지·타임라인·결과물)
 *   POST /admin/api/jobs/:id/status    {status, note}
 *   POST /admin/api/jobs/:id/note      {note}
 *   POST /admin/api/jobs/:id/due       {due_date}
 *   POST /admin/api/jobs/:id/deliverable        {title, url}
 *   POST /admin/api/jobs/:id/deliverable/:did   {sent: true|false}
 *   POST /admin/api/jobs/:id/link-intake        {intake_id}
 *   POST /admin/api/jobs/from-intake            {intake_id}
 *   GET  /admin/api/orders · /admin/api/intakes · /admin/api/leads · /admin/api/reports
 *   POST /admin/api/jobs/:id/task/:tid        {status|note}   플레이북 단계 상태
 *   POST /admin/api/jobs/:id/tasks/seed       {force}         플레이북 (재)생성
 *   GET  /admin/api/playbook?slug=             상품별 자동화 지도 (작업 없이 보기)
 *   POST /admin/api/demo {slug}               데모 주문·질문지·작업 생성 (New Optix) / POST /admin/api/demo/clear 삭제
 */
export const TASK_STATUSES = [['todo', '대기'], ['doing', '진행'], ['review', '검증 대기'], ['done', '완료'], ['blocked', '막힘'], ['skipped', '해당 없음']];
import { authenticate, login, logoutCookie } from './_auth.js';
import { ensureSchema, JOB_STATUSES, addEvent, seedTasks, createJobForOrder, attachIntake, loadCatalog } from '../api/_orders.js';
import { PLAYBOOK, COMMON_ONBOARDING, WHO, PHASES, tasksFor, summarize } from '../api/_playbook.js';
import { appHtml, loginHtml } from './_ui.js';

const NOINDEX = { 'X-Robots-Tag': 'noindex, nofollow', 'Cache-Control': 'no-store' };

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
  if (path === 'logout') {
    return new Response(null, { status: 303, headers: { Location: '/admin/', 'Set-Cookie': logoutCookie(), ...NOINDEX } });
  }

  if (!auth.ok) {
    if (path.startsWith('api')) return json({ ok: false, error: 'unauthorized' }, 401);
    if (auth.mode === 'unconfigured') return html(loginHtml({ unconfigured: true }), 503);
    return html(loginHtml({}), 401);
  }

  if (!env.DB) return path.startsWith('api') ? json({ ok: false, error: 'DB 바인딩 없음 (프리뷰 환경)' }, 503) : html(appHtml({ user: auth.user, noDb: true }));

  if (path === '' ) return html(appHtml({ user: auth.user }));
  if (!path.startsWith('api')) return new Response('not found', { status: 404, headers: NOINDEX });

  try {
    await ensureSchema(env.DB);
    const seg = path.split('/').slice(1); // after "api"
    const body = request.method === 'POST' ? await request.json().catch(() => ({})) : {};
    const out = await api(env, request.method, seg, body, url);
    if (out === undefined) return json({ ok: false, error: 'not found' }, 404);
    return json({ ok: true, ...out });
  } catch (e) {
    return json({ ok: false, error: String(e && e.message || e) }, 500);
  }
}

/* ---------- API ---------- */

async function api(env, method, seg, body, url) {
  const db = env.DB;
  const [res, id, sub, subId] = seg;

  if (res === 'summary' && method === 'GET') {
    const q = async (sql, ...b) => (await db.prepare(sql).bind(...b).first()) || {};
    const jobs = await db.prepare(`SELECT status, COUNT(*) n FROM jobs GROUP BY status`).all();
    const byStatus = {};
    for (const r of jobs.results || []) byStatus[r.status] = r.n;
    const overdue = await q(`SELECT COUNT(*) n FROM jobs WHERE status NOT IN ('done','hold') AND due_date IS NOT NULL AND due_date < date('now')`);
    const dueToday = await q(`SELECT COUNT(*) n FROM jobs WHERE status NOT IN ('done','hold') AND due_date = date('now')`);
    const month = await q(`SELECT COALESCE(SUM(amount_cents),0) c, COUNT(*) n FROM payments WHERE paid_at >= date('now','start of month')`);
    const subs = await q(`SELECT COUNT(*) n, COALESCE(SUM(amount_cents),0) c FROM orders WHERE mode='subscription' AND status='active'`);
    const pastDue = await q(`SELECT COUNT(*) n FROM orders WHERE status='past_due'`);
    const leads = (await hasColumn(db, 'audit_leads', 'created_at'))
      ? await safeFirst(db, `SELECT COUNT(*) n FROM audit_leads WHERE created_at >= datetime('now','-7 days')`)
      : await safeFirst(db, `SELECT COUNT(*) n FROM audit_leads`);
    const intakes = await safeFirst(db, `SELECT COUNT(*) n FROM intakes WHERE id NOT IN (SELECT intake_id FROM jobs WHERE intake_id IS NOT NULL)`);
    const lastEvent = await q(`SELECT created_at, type FROM stripe_events ORDER BY created_at DESC LIMIT 1`);
    const recent = await db.prepare(`SELECT id, kind, note, created_at, job_id FROM job_events ORDER BY id DESC LIMIT 12`).all();
    const review = await q(`SELECT COUNT(*) n FROM job_tasks t JOIN jobs j ON j.id = t.job_id WHERE t.status = 'review' AND j.status NOT IN ('done','hold')`);
    const blocked = await q(`SELECT COUNT(*) n FROM job_tasks t JOIN jobs j ON j.id = t.job_id WHERE t.status = 'blocked' AND j.status NOT IN ('done','hold')`);
    const customerWait = await q(`SELECT COUNT(*) n FROM job_tasks t JOIN jobs j ON j.id = t.job_id WHERE t.who = 'customer' AND t.status IN ('todo','doing') AND j.status NOT IN ('done','hold')`);
    return {
      jobs: byStatus, overdue: overdue.n || 0, dueToday: dueToday.n || 0,
      monthRevenueCents: month.c || 0, monthPayments: month.n || 0,
      activeSubs: subs.n || 0, mrrCents: subs.c || 0, pastDue: pastDue.n || 0,
      leads7d: (leads && leads.n) || 0, unlinkedIntakes: (intakes && intakes.n) || 0,
      lastStripeEvent: lastEvent.created_at ? { at: lastEvent.created_at, type: lastEvent.type } : null,
      recent: recent.results || [],
      reviewPending: review.n || 0, blockedTasks: blocked.n || 0, customerWait: customerWait.n || 0,
      statuses: JOB_STATUSES,
    };
  }

  if (res === 'jobs' && method === 'GET' && !id) {
    const status = url.searchParams.get('status') || '';
    const where = status === 'open' ? `WHERE j.status NOT IN ('done','hold')` : status ? `WHERE j.status = ?` : '';
    const stmt = db.prepare(
      `SELECT j.*, o.amount_cents, o.status order_status, o.mode, o.period, o.customer_name, o.customer_phone o_phone, o.service_name o_service_name,
              i.contact_name, i.phone i_phone, i.business i_business
       FROM jobs j LEFT JOIN orders o ON o.id = j.order_id LEFT JOIN intakes i ON i.id = j.intake_id
       ${where} ORDER BY CASE WHEN j.status IN ('done','hold') THEN 1 ELSE 0 END, COALESCE(j.due_date,'9999') ASC, j.id DESC LIMIT 300`
    );
    const r = await (status && status !== 'open' ? stmt.bind(status) : stmt).all();
    return { jobs: r.results || [], statuses: JOB_STATUSES };
  }

  if (res === 'jobs' && id === 'from-intake' && method === 'POST') {
    const intake = await db.prepare(`SELECT * FROM intakes WHERE id = ?`).bind(Number(body.intake_id)).first();
    if (!intake) throw new Error('질문지를 찾을 수 없습니다');
    const dup = await db.prepare(`SELECT id FROM jobs WHERE intake_id = ?`).bind(intake.id).first();
    if (dup) return { job_id: dup.id };
    const r = await db
      .prepare(`INSERT INTO jobs (intake_id, business, service_slug, customer_email, status) VALUES (?, ?, ?, ?, 'info')`)
      .bind(intake.id, intake.business || '', intake.service || '', (intake.email || '').toLowerCase())
      .run();
    await addEvent(db, r.meta.last_row_id, 'system', null, 'info', `질문지 #${intake.id}로 작업 생성 (관리자)`);
    return { job_id: r.meta.last_row_id };
  }

  if (res === 'jobs' && id && method === 'GET') {
    const job = await db.prepare(`SELECT * FROM jobs WHERE id = ?`).bind(Number(id)).first();
    if (!job) return undefined;
    const order = job.order_id ? await db.prepare(`SELECT * FROM orders WHERE id = ?`).bind(job.order_id).first() : null;
    const payments = job.order_id ? (await db.prepare(`SELECT * FROM payments WHERE order_id = ? ORDER BY paid_at DESC`).bind(job.order_id).all()).results : [];
    const intake = job.intake_id ? await db.prepare(`SELECT * FROM intakes WHERE id = ?`).bind(job.intake_id).first() : null;
    const events = (await db.prepare(`SELECT * FROM job_events WHERE job_id = ? ORDER BY id DESC`).bind(job.id).all()).results;
    const deliverables = (await db.prepare(`SELECT * FROM deliverables WHERE job_id = ? ORDER BY id ASC`).bind(job.id).all()).results;
    // 같은 이메일의 다른 작업·주문 (고객 이력)
    const history = job.customer_email
      ? (await db.prepare(`SELECT id, business, service_name, service_slug, status, created_at FROM jobs WHERE lower(customer_email) = ? AND id != ? ORDER BY id DESC LIMIT 10`).bind(job.customer_email.toLowerCase(), job.id).all()).results
      : [];
    // 연결 후보 질문지 (미연결, 같은 이메일)
    const intakeCandidates = !job.intake_id && job.customer_email
      ? (await safeAll(db, `SELECT id, service, business, contact_name, created_at FROM intakes WHERE lower(email) = ? AND id NOT IN (SELECT intake_id FROM jobs WHERE intake_id IS NOT NULL) ORDER BY id DESC LIMIT 5`, job.customer_email.toLowerCase()))
      : [];
    const tasks = (await db.prepare(`SELECT * FROM job_tasks WHERE job_id = ? ORDER BY sort ASC, id ASC`).bind(job.id).all()).results;
    const pipeline = summarize(tasks.map((t) => ({ who: t.who, verify: !!t.verify, min: t.david_min, ph: t.phase, block: t.block })));
    const doneMin = tasks.filter((t) => t.status === 'done').reduce((a, t) => a + (t.david_min || 0), 0);
    return { job, order, payments, intake, events, deliverables, history, intakeCandidates, tasks, pipeline: { ...pipeline, doneMin, done: tasks.filter((t) => t.status === 'done').length }, who: WHO, phases: PHASES, taskStatuses: TASK_STATUSES, statuses: JOB_STATUSES };
  }

  if (res === 'jobs' && id && method === 'POST') {
    const jid = Number(id);
    const job = await db.prepare(`SELECT * FROM jobs WHERE id = ?`).bind(jid).first();
    if (!job) return undefined;
    if (sub === 'status') {
      const to = String(body.status || '');
      if (!JOB_STATUSES.some(([k]) => k === to)) throw new Error('잘못된 상태');
      await db.prepare(`UPDATE jobs SET status = ?, updated_at = datetime('now') WHERE id = ?`).bind(to, jid).run();
      await addEvent(db, jid, 'status', job.status, to, String(body.note || '').slice(0, 2000));
      return {};
    }
    if (sub === 'note') {
      const note = String(body.note || '').trim().slice(0, 4000);
      if (!note) throw new Error('메모가 비어 있습니다');
      await addEvent(db, jid, 'note', null, null, note);
      return {};
    }
    if (sub === 'due') {
      const d = String(body.due_date || '').slice(0, 10);
      if (d && !/^\d{4}-\d{2}-\d{2}$/.test(d)) throw new Error('날짜 형식 YYYY-MM-DD');
      await db.prepare(`UPDATE jobs SET due_date = ?, updated_at = datetime('now') WHERE id = ?`).bind(d || null, jid).run();
      await addEvent(db, jid, 'note', null, null, `마감 ${d || '해제'}`);
      return {};
    }
    if (sub === 'business') {
      const b = String(body.business || '').trim().slice(0, 200);
      await db.prepare(`UPDATE jobs SET business = ?, updated_at = datetime('now') WHERE id = ?`).bind(b, jid).run();
      return {};
    }
    if (sub === 'deliverable' && !subId) {
      const title = String(body.title || '').trim().slice(0, 200), link = String(body.url || '').trim().slice(0, 1000);
      if (!title) throw new Error('제목이 비어 있습니다');
      const r = await db.prepare(`INSERT INTO deliverables (job_id, title, url) VALUES (?, ?, ?)`).bind(jid, title, link).run();
      await addEvent(db, jid, 'deliverable', null, null, `결과물 추가: ${title}`);
      return { id: r.meta.last_row_id };
    }
    if (sub === 'deliverable' && subId) {
      const sent = body.sent ? `datetime('now')` : 'NULL';
      await db.prepare(`UPDATE deliverables SET sent_at = ${sent} WHERE id = ? AND job_id = ?`).bind(Number(subId), jid).run();
      if (body.sent) await addEvent(db, jid, 'deliverable', null, null, `결과물 발송 완료 (#${subId})`);
      return {};
    }
    if (sub === 'task' && subId) {
      const t = await db.prepare(`SELECT * FROM job_tasks WHERE id = ? AND job_id = ?`).bind(Number(subId), jid).first();
      if (!t) throw new Error('단계를 찾을 수 없습니다');
      if (body.status !== undefined) {
        const to = String(body.status);
        if (!TASK_STATUSES.some(([k]) => k === to)) throw new Error('잘못된 단계 상태');
        await db.prepare(`UPDATE job_tasks SET status = ?, done_at = CASE WHEN ? = 'done' THEN datetime('now') ELSE NULL END WHERE id = ?`).bind(to, to, t.id).run();
        if (to === 'done' || to === 'review' || to === 'blocked') await addEvent(db, jid, 'task', null, null, `${to === 'done' ? '✔' : to === 'review' ? '👀 검증 요청' : '⛔'} ${t.title}`);
      }
      if (body.note !== undefined) await db.prepare(`UPDATE job_tasks SET note = ? WHERE id = ?`).bind(String(body.note || '').slice(0, 2000), t.id).run();
      return {};
    }
    if (sub === 'tasks' && subId === 'seed') {
      const n = await seedTasks(db, jid, body.slug || job.service_slug, { force: !!body.force });
      return { added: n };
    }
    if (sub === 'link-intake') {
      const iid = Number(body.intake_id);
      const intake = await db.prepare(`SELECT id, business FROM intakes WHERE id = ?`).bind(iid).first();
      if (!intake) throw new Error('질문지를 찾을 수 없습니다');
      await db.prepare(`UPDATE jobs SET intake_id = ?, business = CASE WHEN business = '' OR business IS NULL THEN ? ELSE business END, updated_at = datetime('now') WHERE id = ?`).bind(iid, intake.business || '', jid).run();
      await addEvent(db, jid, 'system', null, null, `질문지 #${iid} 연결 (관리자)`);
      return {};
    }
    return undefined;
  }

  if (res === 'playbook' && method === 'GET') {
    const slug = url.searchParams.get('slug') || '';
    const tasks = slug ? tasksFor(slug) : [];
    const catalog = Object.entries(PLAYBOOK).map(([k, v]) => ({ slug: k, name: v.name, ...summarize(v.steps) , bottlenecks: undefined }));
    const packages = [];
    for (const pkg of ['local-starter', 'local-growth', 'local-premium']) for (const per of ['monthly', 'six', 'annual']) {
      const sm = summarize(tasksFor(`${pkg}-${per}`));
      packages.push({ slug: `${pkg}-${per}`, total: sm.total, autoPct: sm.autoPct, setupMin: sm.setupMin, monthMin: sm.monthMin, verify: sm.verify, blocked: sm.by.blocked });
    }
    return { slug, tasks, summary: slug ? { ...summarize(tasks), bottlenecks: undefined } : null, catalog, packages, who: WHO, phases: PHASES, common: COMMON_ONBOARDING };
  }

  if (res === 'demo' && method === 'POST' && id === 'clear') {
    const jobs = (await db.prepare(`SELECT id, order_id, intake_id FROM jobs WHERE business LIKE '%(데모)%'`).all()).results || [];
    for (const j of jobs) {
      await db.batch([
        db.prepare(`DELETE FROM job_tasks WHERE job_id = ?`).bind(j.id),
        db.prepare(`DELETE FROM job_events WHERE job_id = ?`).bind(j.id),
        db.prepare(`DELETE FROM deliverables WHERE job_id = ?`).bind(j.id),
        db.prepare(`DELETE FROM payments WHERE order_id = ?`).bind(j.order_id || -1),
        db.prepare(`DELETE FROM orders WHERE id = ? AND stripe_session_id LIKE 'demo_%'`).bind(j.order_id || -1),
        db.prepare(`DELETE FROM jobs WHERE id = ?`).bind(j.id),
      ]);
      if (j.intake_id) await safeRun(db, `DELETE FROM intakes WHERE id = ? AND business LIKE '%(데모)%'`, j.intake_id);
    }
    return { removed: jobs.length };
  }
  if (res === 'demo' && method === 'POST') {
    // New Optix 가 Premium 에 가입했다고 가정한 데모 — 실제 Stripe 없이 같은 코드 경로를 탄다
    const slug = String(body.slug || 'local-premium-annual');
    const catalog = await loadCatalog(env, url.toString());
    const item = catalog.bySlug[slug] || { name: slug, deliveryDays: 7 };
    const prices = { 'local-premium-monthly': 759, 'local-premium-six': 619 * 6, 'local-premium-annual': 479 * 12, 'local-premium-installment': 519, 'local-growth-annual': 279 * 12, 'local-starter-annual': 139 * 12 };
    const sid = 'demo_' + Date.now();
    const r = await db
      .prepare(`INSERT INTO orders (stripe_session_id, service_slug, service_name, period, mode, amount_cents, currency, interval, status, customer_email, customer_name, customer_phone, paid_count, last_paid_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,1,datetime('now'))`)
      .bind(sid, slug, item.name, item.period || null, /monthly|installment/.test(slug) ? 'subscription' : 'payment', (prices[slug] || 759) * 100, 'usd', item.interval || null, /monthly|installment/.test(slug) ? 'active' : 'paid', 'demo@newoptix.example', 'New Optix (데모)', '(714) 000-0000')
      .run();
    const orderId = r.meta.last_row_id;
    await db.prepare(`INSERT INTO payments (order_id, stripe_id, amount_cents, currency, reason, paid_at) VALUES (?,?,?,?,?,datetime('now'))`).bind(orderId, 'demo_pi_' + orderId, (prices[slug] || 759) * 100, 'usd', 'demo').run();
    const order = { id: orderId, service_slug: slug, service_name: item.name, amount_cents: (prices[slug] || 759) * 100, customer_email: 'demo@newoptix.example', customer_name: 'New Optix (데모)' };
    const jobId = await createJobForOrder(db, order, { deliveryDays: item.deliveryDays });
    // 질문지도 들어왔다고 가정 (automation/gbp/biz/new-optix.json 내용)
    const intakeId = await safeInsertIntake(db, {
      service: slug, business: 'New Optix (데모)', contact_name: '최 사장', phone: '(714) 000-0000', email: 'demo@newoptix.example',
      links: 'https://maps.google.com/?cid=NEWOPTIX (구글 프로필) · 웹사이트 미정 · 인스타 @newoptix',
      notes: '업종: 안경점·검안 (Garden Grove, CA)\n한 줄 소개: 한국어 상담이 편한 가든그로브 안경점\n서비스: 안경·선글라스 / 콘택트렌즈 / 검안 예약 / 렌즈 교체\n톤: 정중하고 간결한 존댓말, 과장 없이\n금지 표현: 최저가, 100% 보장, 무조건\n언어: 한/영\n게시물 주제: 이달의 프레임, 영업시간·주차 안내, 콘택트렌즈 관리 팁, 자외선과 선글라스, 검안 예약 안내, 렌즈 선택 가이드, 손님 후기 감사, 시즌 인사\n\n[데모] 실제 주문이 아닙니다. 대시보드의 "데모 삭제"로 지울 수 있습니다.',
    });
    if (intakeId) await attachIntake(db, { id: intakeId, service: slug, service_name: item.name, business: 'New Optix (데모)', email: 'demo@newoptix.example' }, { deliveryDays: item.deliveryDays });
    await db.prepare(`UPDATE jobs SET business = 'New Optix (데모)' WHERE id = ?`).bind(jobId).run();
    return { job_id: jobId, order_id: orderId, intake_id: intakeId };
  }

  if (res === 'orders' && method === 'GET') {
    const r = await db.prepare(`SELECT o.*, (SELECT id FROM jobs WHERE order_id = o.id ORDER BY id DESC LIMIT 1) job_id FROM orders o ORDER BY o.id DESC LIMIT 300`).all();
    return { orders: r.results || [] };
  }
  if (res === 'intakes' && method === 'GET') {
    const rows = await safeAll(db, `SELECT i.*, (SELECT id FROM jobs WHERE intake_id = i.id LIMIT 1) job_id FROM intakes i ORDER BY i.id DESC LIMIT 300`);
    return { intakes: rows };
  }
  if (res === 'leads' && method === 'GET') {
    const rows = await safeAll(db, `SELECT l.*, (SELECT id FROM reports WHERE lead_id = l.id ORDER BY rowid DESC LIMIT 1) report_id FROM audit_leads l ORDER BY l.id DESC LIMIT 300`);
    // 무료 도구(/tools/) 이용 리드 — 테이블은 첫 도구 이용 때 자동 생성되므로 없으면 빈 목록
    const toolLeads = await safeAll(db, `SELECT email, MAX(phone) phone, MAX(business) business, GROUP_CONCAT(DISTINCT tool) tools, COUNT(*) uses, MAX(created_at) last_at FROM tool_leads GROUP BY email ORDER BY last_at DESC LIMIT 300`);
    return { leads: rows, toolLeads };
  }
  if (res === 'reports' && method === 'GET') {
    const created = (await hasColumn(db, 'reports', 'created_at')) ? 'created_at' : `NULL created_at`;
    const rows = await safeAll(db, `SELECT id, lead_id, business, location, ${created}, substr(report_json, 1, 400) head FROM reports ORDER BY rowid DESC LIMIT 200`);
    for (const r of rows) {
      const m = /"total"\s*:\s*(\d+)/.exec(r.head || '');
      r.total = m ? Number(m[1]) : null;
      delete r.head;
    }
    return { reports: rows };
  }
  return undefined;
}

async function safeAll(db, sql, ...bind) {
  try { return (await db.prepare(sql).bind(...bind).all()).results || []; } catch (e) {
    if (/no such table/.test(String(e))) return [];
    throw e;
  }
}
// 기존 테이블(audit_leads·reports·intakes)은 스키마를 이 코드가 만들지 않았으므로 컬럼 유무를 확인하고 쓴다
const colCache = {};
async function hasColumn(db, table, col) {
  if (!colCache[table]) {
    try { colCache[table] = ((await db.prepare(`PRAGMA table_info(${table})`).all()).results || []).map((r) => r.name); } catch { colCache[table] = []; }
  }
  return colCache[table].includes(col);
}
async function safeRun(db, sql, ...bind) { try { await db.prepare(sql).bind(...bind).run(); } catch {} }
async function safeInsertIntake(db, i) {
  try {
    const r = await db.prepare(`INSERT INTO intakes (service, business, contact_name, phone, email, links, notes) VALUES (?,?,?,?,?,?,?)`).bind(i.service, i.business, i.contact_name, i.phone, i.email, i.links, i.notes).run();
    return r.meta && r.meta.last_row_id;
  } catch { return null; }
}
async function safeFirst(db, sql, ...bind) {
  try { return await db.prepare(sql).bind(...bind).first(); } catch { return null; }
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...NOINDEX } });
}
function html(body, status = 200) {
  return new Response(body, { status, headers: { 'Content-Type': 'text/html; charset=utf-8', ...NOINDEX } });
}
