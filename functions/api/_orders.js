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
  // 고객 웹사이트 스펙 (docs/customer-sites-design-ko.md) — 원본은 이 행, 파일은 루틴이 빌드·배포
  `CREATE TABLE IF NOT EXISTS sites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id INTEGER,
    slug TEXT UNIQUE,
    spec TEXT,
    domain TEXT,
    live INTEGER DEFAULT 0,
    version INTEGER DEFAULT 1,
    updated_at TEXT DEFAULT (datetime('now')),
    published_at TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS site_versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    site_id INTEGER,
    version INTEGER,
    spec TEXT,
    note TEXT,
    changed TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )`,
  `CREATE INDEX IF NOT EXISTS idx_site_versions ON site_versions(site_id, version)`,
  `CREATE TABLE IF NOT EXISTS site_leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    site_id INTEGER,
    job_id INTEGER,
    slug TEXT,
    name TEXT,
    phone TEXT,
    email TEXT,
    message TEXT,
    page TEXT,
    ip_hash TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )`,
  `CREATE INDEX IF NOT EXISTS idx_site_leads ON site_leads(site_id, created_at)`,
  `CREATE TABLE IF NOT EXISTS assets (
    id TEXT PRIMARY KEY,
    job_id INTEGER,
    task_id INTEGER,
    content_type TEXT,
    bytes INTEGER,
    label TEXT,
    data BLOB,
    created_at TEXT DEFAULT (datetime('now'))
  )`,
  `CREATE INDEX IF NOT EXISTS idx_assets_job ON assets(job_id)`,
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
  jobs: [['portal_token', 'TEXT']],        // 고객 결과물 페이지 /c/{token} (없으면 처음 열 때 생성)
  deliverables: [['drafted_at', 'TEXT'], ['task_id', 'INTEGER'], ['kind', 'TEXT'], ['summary', 'TEXT'], ['needs_approval', 'INTEGER'], ['approved_at', 'TEXT'], ['revise_note', 'TEXT'], ['packet_id', 'TEXT'], ['options', 'TEXT'], ['choice', 'TEXT'], ['choice_at', 'TEXT']], // 고객 페이지·묶음 발송·승인 · options/choice = 고객이 고르는 승인(2026-10-27)
  assets: [['r2_key', 'TEXT']],           // R2 에 넣었으면 객체 키(a/{id}.jpg). 없으면 data(BLOB) 가 D1 에 있다
  job_tasks: [
    ['result_kind', 'TEXT'],      // text | html | link
    ['result_text', 'TEXT'],      // 페이지 안에서 보여줄 결과물 본문(텍스트/HTML)
    ['result_url', 'TEXT'],       // Drive·프리뷰 링크
    ['checks', 'TEXT'],           // JSON 배열 — David 확인 포인트
    ['self_check', 'TEXT'],       // AI 자기 점검 한 줄
    ['requested_at', 'TEXT'],     // 검증 요청 시각
    ['revise_note', 'TEXT'],      // 수정 요청 내용
    ['decided_at', 'TEXT'],
    ['options', 'TEXT'],         // JSON [{key,label,image,note,styles[],default}] — 고객이 고르는 선택지(시안·세트). 승인 시 deliverables.options 로 복사
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

/* 고객 결과물 페이지 토큰 — 없으면 만든다 */
export async function ensurePortalToken(db, job) {
  if (job.portal_token) return job.portal_token;
  const t = [...crypto.getRandomValues(new Uint8Array(24))].map((x) => 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[x % 62]).join('');
  await db.prepare(`UPDATE jobs SET portal_token = ? WHERE id = ? AND portal_token IS NULL`).bind(t, job.id).run();
  const row = await db.prepare(`SELECT portal_token FROM jobs WHERE id = ?`).bind(job.id).first();
  return (row && row.portal_token) || t;
}

/* ---------- 고객이 고르는 승인 (2026-10-27) — 시안·세트·버전처럼 선택지가 있는 결과물 ----------
 * options = [{ key:'B', label:'네이비·골드', image:'https://…/a/….jpg', note:'…', styles:['luxe','mono'], default:true }]
 * 고객 페이지는 선택지마다 [이 디자인으로 진행] 버튼, 관리자는 David 가 대신 고를 수 있다. 선택값은 deliverables.choice 와
 * 같은 서비스의 다음 AI 단계 note "[고객 선택] key — label" 로 전달된다(루틴이 읽는다). 인쇄물·광고 소재·영상·사이트 공통 */
export function parseOptions(s) {
  try { const a = typeof s === 'string' ? JSON.parse(s) : s; return Array.isArray(a) ? a.filter((o) => o && o.key).map((o) => ({ key: String(o.key).slice(0, 20), label: String(o.label || o.key).slice(0, 120), image: o.image ? String(o.image).slice(0, 1000) : '', video: o.video ? String(o.video).slice(0, 1000) : '', note: o.note ? String(o.note).slice(0, 400) : '', styles: Array.isArray(o.styles) ? o.styles.map(String) : [], default: !!o.default, patch: o.patch && typeof o.patch === 'object' && !Array.isArray(o.patch) ? o.patch : null })).slice(0, 8) : []; } catch { return []; }
}
/* 선택지 필드: key·label·image(썸네일, 필수에 가깝다)·video(mp4 — 고객 페이지에서 재생)·note·styles[](사이트 스타일과 맞추는 무응답 기본값)·default·
 * patch(사이트 스펙 부분 패치 — 고르는 순간 patchSiteSpec 으로 적용, 예 {"theme":{"style":"luxe"}}. 웹사이트 스타일 선택이 쓴다) */

/* ---------- 사이트 스펙 부분 패치 (관리자 sites/:slug/patch · 선택지 patch 공용) ---------- */
export function deepPatch(base, patch) {
  const out = { ...(base || {}) };
  for (const [k, v] of Object.entries(patch || {})) {
    if (v === null) delete out[k];
    else if (v && typeof v === 'object' && !Array.isArray(v) && out[k] && typeof out[k] === 'object' && !Array.isArray(out[k])) out[k] = deepPatch(out[k], v);
    else out[k] = v;
  }
  return out;
}
export function specDiff(a, b, prefix = '') {
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
/** 저장된 사이트 스펙에 부분 패치 → 새 버전 + site_versions + settings.sitesDirty(다음 루틴 실행에 재배포) + 타임라인. 사이트가 없으면 null */
export async function patchSiteSpec(db, { jobId, slug, patch, note }) {
  const s = slug ? await db.prepare(`SELECT * FROM sites WHERE slug = ?`).bind(String(slug)).first() : await db.prepare(`SELECT * FROM sites WHERE job_id = ? ORDER BY id DESC LIMIT 1`).bind(Number(jobId)).first();
  if (!s) return null;
  const cur = parseJsonSafe(s.spec, {});
  const next = deepPatch(cur, patch || {}); next.slug = s.slug;
  const changed = specDiff(cur, next);
  if (!changed.length) return { slug: s.slug, version: s.version, changed: [] };
  const text = JSON.stringify(next).slice(0, 400000);
  await db.prepare(`UPDATE sites SET spec = ?, version = version + 1, updated_at = datetime('now') WHERE id = ?`).bind(text, s.id).run();
  const row = await db.prepare(`SELECT * FROM sites WHERE id = ?`).bind(s.id).first();
  await db.prepare(`INSERT INTO site_versions (site_id, version, spec, note, changed) VALUES (?, ?, ?, ?, ?)`).bind(s.id, row.version, text, String(note || '부분 패치').slice(0, 300), JSON.stringify(changed.slice(0, 60))).run();
  await markSitesDirty(db);
  await addEvent(db, s.job_id, 'task', null, null, `🌐 사이트 스펙 v${row.version} — ${changed.slice(0, 6).join(', ')}${note ? ' (' + String(note).slice(0, 80) + ')' : ''} · 다음 루틴 실행에 재배포`);
  return { slug: s.slug, version: row.version, changed };
}
async function markSitesDirty(db) {
  const row = await db.prepare(`SELECT value FROM settings WHERE key = 'admin'`).first();
  const cur = row ? parseJsonSafe(row.value, {}) : {};
  await db.prepare(`INSERT INTO settings (key, value, updated_at) VALUES ('admin', ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`).bind(JSON.stringify({ ...cur, sitesDirty: true })).run();
}
function parseJsonSafe(s, d) { try { return s ? JSON.parse(s) : d; } catch { return d; } }
/** 무응답(7일) 기본값: 사이트 스타일과 맞는 선택지 → default 표시 → 첫 항목 (David 결정 2026-10-27: 사이트 스타일로 자동) */
export function pickDefaultOption(options, siteStyle) {
  if (!options || !options.length) return null;
  const st = String(siteStyle || '').toLowerCase();
  return (st && options.find((o) => (o.styles || []).map((x) => String(x).toLowerCase()).includes(st))) || options.find((o) => o.default) || options[0];
}
async function siteStyleOf(db, jobId) {
  try { const r = await db.prepare(`SELECT spec FROM sites WHERE job_id = ?`).bind(jobId).first(); const sp = r && r.spec ? JSON.parse(r.spec) : null; return (sp && sp.theme && (sp.theme.style || sp.theme.mood)) || ''; } catch { return ''; }
}

/* 결과물 승인 — 고객 페이지 클릭·David 대신 선택·7일 무응답 간주 셋 다 이 함수. 같은 서비스의 다음 "고객 차례" 단계를 완료로.
 * 선택지가 있으면 choice(키)를 기록하고 다음 AI 단계 note 에 "[고객 선택]"을 남긴다. choice 가 없으면 기본값(pickDefaultOption) */
export async function approveDeliverable(db, d, { source, note, choice }) {
  const options = parseOptions(d.options);
  let picked = null;
  if (options.length) {
    picked = options.find((o) => o.key === String(choice || '')) || pickDefaultOption(options, await siteStyleOf(db, d.job_id));
    await db.prepare(`UPDATE deliverables SET approved_at = datetime('now'), revise_note = NULL, choice = ?, choice_at = datetime('now') WHERE id = ?`).bind(picked.key, d.id).run();
  } else {
    await db.prepare(`UPDATE deliverables SET approved_at = datetime('now'), revise_note = NULL WHERE id = ?`).bind(d.id).run();
  }
  const task = d.task_id ? await db.prepare(`SELECT id, service, sort FROM job_tasks WHERE id = ?`).bind(d.task_id).first() : null;
  if (task) {
    // 바로 다음 단계가 "고객 차례"(승인·선택 대기 단계, 예 qr-2b·web-2b·sv-2b·post-3)일 때만 완료로. 더 뒤의 고객 단계(예 web-3 도메인 연결)는 건드리지 않는다
    const nxt = await db.prepare(`SELECT id, who, status FROM job_tasks WHERE job_id = ? AND service = ? AND sort > ? ORDER BY sort ASC LIMIT 1`).bind(d.job_id, task.service, task.sort).first();
    if (nxt && nxt.who === 'customer' && nxt.status === 'todo') await db.prepare(`UPDATE job_tasks SET status = 'done', done_at = datetime('now'), note = ? WHERE id = ?`).bind(note, nxt.id).run();
    if (picked) { // 선택값을 같은 서비스의 다음 단계(고객 차례가 아닌 것 — AI 면 루틴이, David 면 관리자에서 읽는다)에 넘긴다: task.note 의 "[고객 선택]"
      const ai = await db.prepare(`SELECT id, note FROM job_tasks WHERE job_id = ? AND service = ? AND sort > ? AND who != 'customer' AND status IN ('todo','doing') ORDER BY sort ASC LIMIT 1`).bind(d.job_id, task.service, task.sort).first();
      const tag = `[고객 선택] ${picked.key} — ${picked.label}${source === 'auto' ? ' (무응답 기본값)' : source === 'david' ? ' (David 대신 선택)' : ''}`;
      if (ai) await db.prepare(`UPDATE job_tasks SET note = ? WHERE id = ?`).bind((ai.note && !/\[고객 선택\]/.test(ai.note) ? ai.note + '\n' : '') + tag, ai.id).run();
    }
  }
  if (picked && picked.patch) { // 선택지에 사이트 스펙 패치가 붙어 있으면(웹사이트 스타일 선택) 그 자리에서 적용 — 다음 루틴 실행이 재배포한다
    try { await patchSiteSpec(db, { jobId: d.job_id, patch: picked.patch, note: `고객 선택 ${picked.key} — ${picked.label}` }); } catch (e) { await addEvent(db, d.job_id, 'system', null, null, `⚠ 선택지 패치 실패 — ${String(e.message || e).slice(0, 160)}`); }
  }
  const who = source === 'auto' ? '⏱ 7일 무응답 → 승인 간주(약관 §2)' : source === 'david' ? '👍 David 가 고객 대신 승인' : '👍 고객 승인 (고객 페이지)';
  await addEvent(db, d.job_id, 'customer', null, null, `${who} — ${d.title}${picked ? ` · 선택: ${picked.key} ${picked.label}` : ''}`);
  return picked;
}

/* 7일 무응답 승인 간주 (약관 §2) — 보낸 지 7일 지난 승인 대기 결과물. 루틴 큐·관제탑을 열 때 돈다. 수정 요청이 걸린 건 건드리지 않는다. 선택지가 있으면 사이트 스타일 기본값으로 */
export async function sweepAutoApprovals(db) {
  const rows = (await db.prepare(`SELECT d.* FROM deliverables d JOIN jobs j ON j.id = d.job_id WHERE d.needs_approval = 1 AND d.approved_at IS NULL AND (d.revise_note IS NULL OR d.revise_note = '') AND d.sent_at IS NOT NULL AND d.sent_at <= datetime('now', '-7 days') AND j.status NOT IN ('done','hold') LIMIT 50`).all()).results || [];
  for (const d of rows) await approveDeliverable(db, d, { source: 'auto', note: '7일 무응답 — 승인 간주(약관)' });
  return rows.length;
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

/** AI가 지금 할 수 있는 단계 — 온보딩이 끝났고, 같은 서비스 안에서 앞선 단계가 모두 끝난 AI(auto·ai) 단계.
 *  (2026-10-21) phase 전체가 아니라 서비스 단위로 본다 — 한 서비스의 셋업이 David 차례에서 멈춰 있어도 다른 서비스의 월간 단계는 돈다 */
export function aiReady(tasks) {
  const all = tasks || [];
  // 공통 온보딩(ob-*: 결제·질문지·프로필·자료·킥오프)만 전체 게이트. 서비스별 온보딩(gpo-1 초대, ads-1 계정 등)은 그 서비스 안에서만 막는다
  if (all.some((x) => x.service === 'common' && !CLOSED.has(x.status))) return [];
  return all.filter((t) => {
    if (!(t.who === 'auto' || t.who === 'ai') || !(t.status === 'todo' || t.status === 'doing')) return false;
    return !all.some((x) => x.service === t.service && x.sort < t.sort && !CLOSED.has(x.status));
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
  if (!job && email) {
    // 결제 없는 재제출: 같은 이메일로 30일 안에 만든 작업이 이미 질문지를 갖고 있으면 그 작업의 질문지를 최신 것으로 바꾼다 (작업을 또 만들지 않는다)
    const prev = await db.prepare(`SELECT * FROM jobs WHERE lower(customer_email) = ? AND created_at >= datetime('now','-30 days') AND status NOT IN ('done') ORDER BY id DESC LIMIT 1`).bind(email).first();
    if (prev) {
      await db.prepare(`UPDATE jobs SET intake_id = ?, updated_at = datetime('now') WHERE id = ?`).bind(intake.id, prev.id).run();
      await addEvent(db, prev.id, 'system', prev.status, prev.status, `질문지 #${intake.id} 다시 제출됨 — 이전 질문지 #${prev.intake_id || '-'} 대신 이 내용을 씁니다`);
      await db.prepare(`UPDATE job_tasks SET status = 'done', done_at = COALESCE(done_at, datetime('now')) WHERE job_id = ? AND key = 'ob-2'`).bind(prev.id).run();
      return prev.id;
    }
  }
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
