/**
 * 주문·작업 공용 모듈 — Stripe 웹훅, 인테이크, 관리자 페이지가 함께 쓴다.
 * `_`로 시작하므로 라우팅되지 않는다 (CLAUDE.md §14).
 *
 * 테이블 (D1 bizhigher-db) — ensureSchema()가 없으면 만든다. 전부 IF NOT EXISTS 라 몇 번 돌려도 안전.
 *   stripe_events  처리한 Stripe 이벤트 id (중복 방지)
 *   orders         Stripe 결제·구독 1건 = 주문 1건
 *   payments       실제 입금 내역 (일회성 1건, 구독은 매달 1건)
 *   jobs           주문 1건당 작업 1건. 질문지(intakes)와 연결. 상태 파이프라인은 JOB_STATUSES
 *   job_events     상태 변경·메모 타임라인
 *   deliverables   결과물 링크(Drive 등)와 발송 시각
 */

export const JOB_STATUSES = [
  ['new', '신규'],
  ['info', '정보 확인'],
  ['working', '제작 중'],
  ['qa', 'QA 대기'],
  ['ready', '발송 대기'],
  ['done', '완료'],
  ['hold', '보류'],
];
export const ORDER_STATUSES = ['paid', 'active', 'past_due', 'canceled', 'refunded', 'incomplete'];

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS stripe_events (
    id TEXT PRIMARY KEY,
    type TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    stripe_session_id TEXT UNIQUE,
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT UNIQUE,
    stripe_payment_intent TEXT,
    stripe_payment_link TEXT,
    stripe_link_url TEXT,
    service_slug TEXT,
    service_name TEXT,
    period TEXT,
    mode TEXT,
    amount_cents INTEGER DEFAULT 0,
    currency TEXT DEFAULT 'usd',
    interval TEXT,
    status TEXT DEFAULT 'paid',
    cancel_at_period_end INTEGER DEFAULT 0,
    current_period_end TEXT,
    paid_count INTEGER DEFAULT 0,
    last_paid_at TEXT,
    customer_email TEXT,
    customer_name TEXT,
    customer_phone TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`,
  `CREATE INDEX IF NOT EXISTS idx_orders_email ON orders(customer_email)`,
  `CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER,
    stripe_id TEXT UNIQUE,
    amount_cents INTEGER DEFAULT 0,
    currency TEXT DEFAULT 'usd',
    reason TEXT,
    paid_at TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER,
    intake_id INTEGER,
    business TEXT,
    service_slug TEXT,
    service_name TEXT,
    customer_email TEXT,
    status TEXT DEFAULT 'new',
    due_date TEXT,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`,
  `CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status)`,
  `CREATE TABLE IF NOT EXISTS job_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id INTEGER,
    kind TEXT,
    from_status TEXT,
    to_status TEXT,
    note TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS job_tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id INTEGER,
    key TEXT,
    service TEXT,
    service_name TEXT,
    title TEXT,
    phase TEXT,
    who TEXT,
    david_min INTEGER DEFAULT 0,
    verify INTEGER DEFAULT 0,
    block TEXT,
    next TEXT,
    status TEXT DEFAULT 'todo',
    note TEXT,
    sort INTEGER DEFAULT 0,
    done_at TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )`,
  `CREATE INDEX IF NOT EXISTS idx_job_tasks_job ON job_tasks(job_id)`,
  `CREATE TABLE IF NOT EXISTS deliverables (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id INTEGER,
    title TEXT,
    url TEXT,
    sent_at TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )`,
];

import { tasksFor } from './_playbook.js';

// 기존 테이블에 나중에 추가된 컬럼 — CREATE TABLE IF NOT EXISTS 는 컬럼을 못 더하므로 PRAGMA 로 확인 후 ALTER
const EXTRA_COLUMNS = {
  deliverables: [['drafted_at', 'TEXT']], // Gmail 초안이 만들어진 시각 (루틴이 기록)
  job_tasks: [
    ['result_kind', 'TEXT'],      // text | html | link
    ['result_text', 'TEXT'],      // 페이지 안에서 보여줄 결과물 본문(텍스트/HTML)
    ['result_url', 'TEXT'],       // Drive·프리뷰 링크
    ['checks', 'TEXT'],           // JSON 배열 — David 확인 포인트
    ['self_check', 'TEXT'],       // AI 자기 점검 한 줄
    ['requested_at', 'TEXT'],     // 검증 요청 시각
    ['revise_note', 'TEXT'],      // 수정 요청 내용
    ['decided_at', 'TEXT'],
  ],
};

let schemaReady = false;
export async function ensureSchema(db) {
  if (schemaReady) return;
  await db.batch(SCHEMA.map((sql) => db.prepare(sql)));
  await db.prepare(`CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT, updated_at TEXT DEFAULT (datetime('now')))`).run();
  for (const [table, cols] of Object.entries(EXTRA_COLUMNS)) {
    const have = new Set(((await db.prepare(`PRAGMA table_info(${table})`).all()).results || []).map((r) => r.name));
    for (const [name, type] of cols) if (!have.has(name)) await db.prepare(`ALTER TABLE ${table} ADD COLUMN ${name} ${type}`).run();
  }
  schemaReady = true;
}

/* ---------- 진행률·다음 할 일 (관제탑·여정 화면이 쓴다) ---------- */

const CLOSED = new Set(['done', 'skipped']);
export function taskWeight(t) { return 10 + Math.round((Number(t.david_min) || 0) / 2); } // 단계 수와 David 시간을 반반 섞는다

/** 0~100. 단계마다 10점 + David 분/2 — 자동 단계도 진전으로 보이되 큰 수동 단계는 더 무겁게 */
export function jobProgress(tasks) {
  if (!tasks || !tasks.length) return 0;
  let total = 0, done = 0;
  for (const t of tasks) { const w = taskWeight(t); total += w; if (CLOSED.has(t.status)) done += w; else if (t.status === 'review') done += w * 0.7; }
  return total ? Math.round((done / total) * 100) : 0;
}

/** 지금 단계(가장 앞선 미완료 phase) 안의 열린 단계들 — 고객 대기·막힘 집계는 이 범위로 센다 */
export function currentPhaseTasks(tasks) {
  const open = (tasks || []).filter((t) => !CLOSED.has(t.status));
  if (!open.length) return [];
  const ph = open[0].phase;
  return open.filter((t) => t.phase === ph);
}

/** AI가 지금 할 수 있는 단계 — 같은 서비스 안에서 앞선 단계가 모두 끝난 AI(auto·ai) 단계 (지금 phase 기준) */
export function aiReady(tasks) {
  const cur = currentPhaseTasks(tasks);
  return cur.filter((t) => {
    if (!(t.who === 'auto' || t.who === 'ai') || !(t.status === 'todo' || t.status === 'doing')) return false;
    return !(tasks || []).some((x) => x.service === t.service && x.sort < t.sort && !CLOSED.has(x.status));
  });
}

/** 다음에 공을 든 사람과 단계 — sort 순으로 첫 미완료 */
export function nextAction(tasks) {
  const open = (tasks || []).filter((t) => !CLOSED.has(t.status));
  if (!open.length) return null;
  // 내 차례(검증 대기·David 수동 진행)가 있으면 그게 먼저, 그다음 sort 순
  const mine = open.find((t) => t.status === 'review' || ((t.who === 'david' || t.who === 'ai') && t.status === 'doing'));
  const t = mine || open[0];
  return { id: t.id, title: t.title, who: t.status === 'review' ? 'david' : t.who === 'ai' && t.status !== 'review' ? 'auto' : t.who, kind: t.status === 'review' ? (t.verify ? '검증' : '승인') : t.who === 'david' ? '직접' : t.who === 'customer' ? '고객' : t.who === 'blocked' || t.status === 'blocked' ? '막힘' : 'AI', min: t.david_min || 0, status: t.status };
}

/** 최근 단계 8개의 주인 색 점 — 관제탑 막대 아래 */
export function recentDots(tasks) {
  const closed = (tasks || []).filter((t) => CLOSED.has(t.status)).slice(-5);
  const open = (tasks || []).filter((t) => !CLOSED.has(t.status)).slice(0, 8 - closed.length);
  const color = (t) => CLOSED.has(t.status) ? (t.who === 'david' ? '#0A4DF5' : '#0B9E58') : t.status === 'review' || t.who === 'david' ? '#0A4DF5' : t.who === 'customer' ? '#F59E0B' : t.status === 'blocked' || t.who === 'blocked' ? '#D3382F' : '#D1D5DB';
  return [...closed, ...open].map(color);
}

/** 온보딩 / 셋업 / 월간 운영 n개월차 */
export function jobPhase(job, tasks) {
  const open = (tasks || []).filter((t) => !CLOSED.has(t.status));
  const ph = open.length ? open[0].phase : 'monthly';
  const months = job && job.created_at ? Math.max(1, Math.floor((Date.now() - new Date(job.created_at.replace(' ', 'T') + 'Z').getTime()) / (30 * 864e5)) + 1) : 1;
  if (ph === 'onboarding') return '온보딩 — 고객 입력·권한';
  if (ph === 'setup') return '셋업 — 첫 결과물 준비';
  return `월간 운영 ${months}개월차`;
}

/* ---------- 카탈로그 (빌드가 dist/data/stripe-links.json 으로 쓴다) ---------- */

export async function loadCatalog(env, requestUrl) {
  try {
    const res = await env.ASSETS.fetch(new URL('/data/stripe-links.json', requestUrl).toString());
    if (res.ok) return await res.json();
  } catch {}
  return { byUrl: {}, bySlug: {} };
}

export function catalogLookup(catalog, { linkUrl, slug }) {
  if (linkUrl && catalog.byUrl && catalog.byUrl[linkUrl]) return catalog.byUrl[linkUrl];
  if (slug && catalog.bySlug && catalog.bySlug[slug]) return catalog.bySlug[slug];
  return null;
}

/* ---------- 작업 ---------- */

export function addBusinessDays(from, days) {
  const d = new Date(from);
  let left = Math.max(0, days | 0);
  while (left > 0) {
    d.setUTCDate(d.getUTCDate() + 1);
    const w = d.getUTCDay();
    if (w !== 0 && w !== 6) left--;
  }
  return d.toISOString().slice(0, 10);
}

export async function createJobForOrder(db, order, { deliveryDays } = {}) {
  const email = (order.customer_email || '').toLowerCase();
  // 질문지가 먼저 들어와 만들어진 "주문 없는 작업"이 있으면 거기에 붙인다 (같은 이메일, 30일 내, 미연결)
  let job = null;
  if (email) {
    job = await db
      .prepare(
        `SELECT * FROM jobs WHERE order_id IS NULL AND lower(customer_email) = ? AND created_at >= datetime('now','-30 days') ORDER BY id DESC LIMIT 1`
      )
      .bind(email)
      .first();
  }
  if (job) {
    await db
      .prepare(`UPDATE jobs SET order_id = ?, service_slug = COALESCE(service_slug, ?), service_name = COALESCE(service_name, ?), updated_at = datetime('now') WHERE id = ?`)
      .bind(order.id, order.service_slug, order.service_name, job.id)
      .run();
    await addEvent(db, job.id, 'system', null, null, `Stripe 주문 #${order.id} 연결됨 (${order.service_name || order.service_slug || '상품 미확인'})`);
    await seedTasks(db, job.id, order.service_slug || job.service_slug);
    return job.id;
  }
  const due = deliveryDays ? addBusinessDays(new Date(), deliveryDays) : null;
  const r = await db
    .prepare(
      `INSERT INTO jobs (order_id, business, service_slug, service_name, customer_email, status, due_date) VALUES (?, ?, ?, ?, ?, 'new', ?)`
    )
    .bind(order.id, order.customer_name || '', order.service_slug || '', order.service_name || '', email, due)
    .run();
  const id = r.meta && r.meta.last_row_id;
  await addEvent(db, id, 'system', null, 'new', `결제 확인 — ${order.service_name || order.service_slug || '상품 미확인'} $${((order.amount_cents || 0) / 100).toFixed(0)}`);
  await seedTasks(db, id, order.service_slug);
  return id;
}

/** 질문지(intake)를 작업에 붙인다. 주문이 있으면 그 작업에, 없으면 질문지만으로 작업을 만든다. */
export async function attachIntake(db, intake, { deliveryDays } = {}) {
  const email = (intake.email || '').toLowerCase();
  let job = null;
  if (email) {
    job = await db
      .prepare(
        `SELECT * FROM jobs WHERE intake_id IS NULL AND lower(customer_email) = ? AND created_at >= datetime('now','-30 days') ORDER BY id DESC LIMIT 1`
      )
      .bind(email)
      .first();
  }
  const due = addBusinessDays(new Date(), deliveryDays || 3);
  if (job) {
    await db
      .prepare(
        `UPDATE jobs SET intake_id = ?, business = CASE WHEN business IS NULL OR business = '' THEN ? ELSE business END,
         service_slug = CASE WHEN service_slug IS NULL OR service_slug = '' THEN ? ELSE service_slug END,
         due_date = COALESCE(due_date, ?), status = CASE WHEN status = 'new' THEN 'info' ELSE status END, updated_at = datetime('now') WHERE id = ?`
      )
      .bind(intake.id, intake.business || '', intake.service || '', due, job.id)
      .run();
    await addEvent(db, job.id, 'system', job.status, job.status === 'new' ? 'info' : job.status, `질문지 #${intake.id} 제출됨 — 딜리버리 기한 시작`);
    await seedTasks(db, job.id, job.service_slug || intake.service);
    await db.prepare(`UPDATE job_tasks SET status = 'done', done_at = datetime('now') WHERE job_id = ? AND key = 'ob-2'`).bind(job.id).run();
    return job.id;
  }
  const r = await db
    .prepare(
      `INSERT INTO jobs (intake_id, business, service_slug, service_name, customer_email, status, due_date) VALUES (?, ?, ?, ?, ?, 'info', ?)`
    )
    .bind(intake.id, intake.business || '', intake.service || '', intake.service_name || '', email, due)
    .run();
  const id = r.meta && r.meta.last_row_id;
  await addEvent(db, id, 'system', null, 'info', `질문지 #${intake.id} 제출됨 (Stripe 결제 기록 없음 — 이메일 신청이거나 웹훅 미수신)`);
  await seedTasks(db, id, intake.service);
  await db.prepare(`UPDATE job_tasks SET status = 'done', done_at = datetime('now') WHERE job_id = ? AND key = 'ob-2'`).bind(id).run();
  return id;
}

/** 플레이북 단계를 job_tasks 로 펼친다. 이미 있으면 건너뛴다(force 면 todo 상태만 교체). */
export async function seedTasks(db, jobId, slug, { force } = {}) {
  if (!jobId) return 0;
  const tasks = tasksFor(slug);
  if (!tasks.length) return 0;
  const existing = await db.prepare(`SELECT COUNT(*) n FROM job_tasks WHERE job_id = ?`).bind(jobId).first();
  if (existing && existing.n && !force) return 0;
  if (force) await db.prepare(`DELETE FROM job_tasks WHERE job_id = ? AND status = 'todo'`).bind(jobId).run();
  const keep = force ? new Set(((await db.prepare(`SELECT key FROM job_tasks WHERE job_id = ?`).bind(jobId).all()).results || []).map((r) => r.key)) : new Set();
  const stmts = tasks
    .filter((t) => !keep.has(t.k))
    .map((t) =>
      db
        .prepare(`INSERT INTO job_tasks (job_id, key, service, service_name, title, phase, who, david_min, verify, block, next, status, sort) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`)
        .bind(jobId, t.k, t.service, t.serviceName, t.t, t.ph, t.who, t.min || 0, t.verify ? 1 : 0, t.block || '', t.next || '', t.who === 'blocked' ? 'blocked' : 'todo', t.sort)
    );
  for (let i = 0; i < stmts.length; i += 50) await db.batch(stmts.slice(i, i + 50));
  // 자동 단계 중 이미 끝난 것: 결제 기록(ob-1)
  await db.prepare(`UPDATE job_tasks SET status = 'done', done_at = datetime('now') WHERE job_id = ? AND key = 'ob-1'`).bind(jobId).run();
  await addEvent(db, jobId, 'system', null, null, `플레이북 ${tasks.length}단계 생성 (${slug})`);
  return stmts.length;
}

export async function addEvent(db, jobId, kind, from, to, note) {
  if (!jobId) return;
  await db
    .prepare(`INSERT INTO job_events (job_id, kind, from_status, to_status, note) VALUES (?, ?, ?, ?, ?)`)
    .bind(jobId, kind, from, to, note || '')
    .run();
}
