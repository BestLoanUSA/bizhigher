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
  `CREATE TABLE IF NOT EXISTS deliverables (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id INTEGER,
    title TEXT,
    url TEXT,
    sent_at TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )`,
];

let schemaReady = false;
export async function ensureSchema(db) {
  if (schemaReady) return;
  await db.batch(SCHEMA.map((sql) => db.prepare(sql)));
  schemaReady = true;
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
  return id;
}

export async function addEvent(db, jobId, kind, from, to, note) {
  if (!jobId) return;
  await db
    .prepare(`INSERT INTO job_events (job_id, kind, from_status, to_status, note) VALUES (?, ?, ?, ?, ?)`)
    .bind(jobId, kind, from, to, note || '')
    .run();
}
