/**
 * 비즈니스 로그인 — 구글·카카오 계정으로 /my/ 에 들어온다 (2026-11-07 David 요청: "클릭 한두 번 내 로그인")
 *
 * 비밀번호를 만들지 않는다. 구글·카카오가 "이 사람이 누구인지"만 알려 주고, 우리는 그 계정을 작업(jobs)과 잇는다.
 *   ① 이메일로 자동 연결 — 구글(또는 이메일 동의를 받은 카카오)이 확인한 이메일 = 결제·질문지 이메일(jobs.customer_email)
 *   ② 링크로 연결 — 메일로 받은 고객 페이지(/c/{token})의 [Google로 연결]·[카카오로 연결] → owner_links 에 한 줄
 *      (카카오는 이메일을 안 주는 경우가 많고, 결제 이메일과 다른 구글 계정을 쓰는 사장님도 있다)
 * 세션은 서명한 쿠키 하나(bh_owner, 30일). 서명 키 OWNER_SESSION_SECRET — 없으면 ADMIN_PASSWORD 에서 따로 파생한 키
 * 테이블(자동 생성): owner_logins(제공자·계정 id·이메일·이름) · owner_links(로그인 ↔ 작업)
 * 환경변수·설정 절차: docs/owner-login-setup-ko.md
 */
const enc = new TextEncoder();
export const SESSION_COOKIE = 'bh_owner';
export const STATE_COOKIE = 'bh_oauth';
export const SESSION_DAYS = 30;

const b64u = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = (s) => Uint8Array.from(atob(String(s).replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((String(s).length + 3) % 4)), (c) => c.charCodeAt(0));

async function hmacKey(env) {
  const secret = env.OWNER_SESSION_SECRET || (env.ADMIN_PASSWORD ? 'from-admin:' + env.ADMIN_PASSWORD : '');
  if (!secret) return null;
  return crypto.subtle.importKey('raw', enc.encode('bh-owner:' + secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}
/** 값 서명 — payload.exp(ms)가 지나면 verify 가 null */
export async function sign(env, payload) {
  const k = await hmacKey(env);
  if (!k) return null;
  const body = b64u(enc.encode(JSON.stringify(payload)));
  return body + '.' + b64u(await crypto.subtle.sign('HMAC', k, enc.encode(body)));
}
export async function verify(env, value) {
  try {
    const [body, mac] = String(value || '').split('.');
    if (!body || !mac) return null;
    const k = await hmacKey(env);
    if (!k || !(await crypto.subtle.verify('HMAC', k, unb64u(mac), enc.encode(body)))) return null;
    const p = JSON.parse(new TextDecoder().decode(unb64u(body)));
    return p && p.exp > Date.now() ? p : null;
  } catch { return null; }
}

export function readCookie(request, name) {
  const h = request.headers.get('cookie') || '';
  for (const part of h.split(';')) { const i = part.indexOf('='); if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim(); }
  return '';
}
export const cookie = (name, value, maxAgeSec) => `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAgeSec}`;

/** 로그인한 사장님 — {lid, n, e, p} 또는 null */
export async function session(request, env) {
  const v = readCookie(request, SESSION_COOKIE);
  return v ? verify(env, v) : null;
}

export async function ensureOwnerSchema(db) {
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS owner_logins (id INTEGER PRIMARY KEY AUTOINCREMENT, provider TEXT NOT NULL, subject TEXT NOT NULL, email TEXT, email_verified INTEGER DEFAULT 0, name TEXT, created_at TEXT DEFAULT (datetime('now')), last_at TEXT, UNIQUE(provider, subject))`),
    db.prepare(`CREATE TABLE IF NOT EXISTS owner_links (login_id INTEGER NOT NULL, job_id INTEGER NOT NULL, via TEXT, created_at TEXT DEFAULT (datetime('now')), PRIMARY KEY (login_id, job_id))`),
  ]);
}

/** 로그인 기록 — 같은 제공자·계정이면 이름·이메일·마지막 접속만 갱신 */
export async function upsertLogin(db, { provider, subject, email, verified, name }) {
  await ensureOwnerSchema(db);
  await db.prepare(`INSERT INTO owner_logins (provider, subject, email, email_verified, name, last_at) VALUES (?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(provider, subject) DO UPDATE SET email = excluded.email, email_verified = excluded.email_verified, name = excluded.name, last_at = datetime('now')`)
    .bind(provider, subject, email || null, verified ? 1 : 0, name || null).run();
  return db.prepare(`SELECT * FROM owner_logins WHERE provider = ? AND subject = ?`).bind(provider, subject).first();
}

/** 이 로그인이 볼 수 있는 작업 — 링크로 이은 것 + 확인된 이메일이 같은 것. 최신순 */
export async function jobsForLogin(db, lid) {
  await ensureOwnerSchema(db);
  const login = await db.prepare(`SELECT * FROM owner_logins WHERE id = ?`).bind(lid).first();
  if (!login) return [];
  const email = login.email_verified && login.email ? String(login.email).toLowerCase() : '';
  const rows = (await db.prepare(`SELECT id, business, service_name, status, portal_token, created_at FROM jobs
    WHERE id IN (SELECT job_id FROM owner_links WHERE login_id = ?) ${email ? 'OR lower(customer_email) = ?' : ''} ORDER BY id DESC LIMIT 20`)
    .bind(...(email ? [lid, email] : [lid])).all()).results || [];
  return rows;
}

export async function linkJob(db, lid, jobId, via) {
  await ensureOwnerSchema(db);
  const r = await db.prepare(`INSERT OR IGNORE INTO owner_links (login_id, job_id, via) VALUES (?, ?, ?)`).bind(lid, jobId, via).run();
  return !!(r && r.meta && r.meta.changes);
}

/** 제공자 설정 — 키가 없으면 그 버튼은 "준비 중"으로 */
export function providers(env) {
  // 대시보드에 붙여 넣을 때 끝에 줄바꿈·공백이 딸려 들어온다(2026-11-07 카카오 키 끝 \n 으로 client_id=…%0A) — 항상 다듬어 쓴다
  const v = (k) => String(env[k] || '').trim();
  return {
    google: v('GOOGLE_OAUTH_CLIENT_ID') && v('GOOGLE_OAUTH_CLIENT_SECRET') ? { id: v('GOOGLE_OAUTH_CLIENT_ID'), secret: v('GOOGLE_OAUTH_CLIENT_SECRET') } : null,
    kakao: v('KAKAO_REST_API_KEY') ? { id: v('KAKAO_REST_API_KEY'), secret: v('KAKAO_CLIENT_SECRET') } : null,
  };
}

/* ── 로그인했지만 아직 고객이 아닌 사장님(2026-11-07 David: "아직 리포트·서비스·플랜이 없으면 차례대로 실행을 유도") ──
   owner_profiles: 로그인 1개당 가게 정보 1줄 — 무료 진단·추천·결제 질문지 미리 채우기에 쓴다. 카카오처럼 이메일이 없으면 여기 email 을 받는다 */
export async function ensureProfileSchema(db) {
  await ensureOwnerSchema(db);
  await db.prepare(`CREATE TABLE IF NOT EXISTS owner_profiles (login_id INTEGER PRIMARY KEY, business TEXT, city TEXT, category TEXT, phone TEXT, website TEXT, email TEXT, goal TEXT, news_optin INTEGER DEFAULT 0, blog_seen TEXT, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT)`).run();
}
export async function getProfile(db, lid) {
  await ensureProfileSchema(db);
  return (await db.prepare(`SELECT * FROM owner_profiles WHERE login_id = ?`).bind(lid).first()) || null;
}
const PROFILE_FIELDS = ['business', 'city', 'category', 'phone', 'website', 'email', 'goal'];
export async function saveProfile(db, lid, input) {
  await ensureProfileSchema(db);
  const v = {};
  for (const k of PROFILE_FIELDS) v[k] = String(input[k] || '').trim().slice(0, k === 'website' ? 300 : 120) || null;
  if (v.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.email)) v.email = null;
  if (v.website && !/^https?:\/\//i.test(v.website)) v.website = 'https://' + v.website;
  const news = input.news_optin ? 1 : 0;
  await db.prepare(`INSERT INTO owner_profiles (login_id, business, city, category, phone, website, email, goal, news_optin, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(login_id) DO UPDATE SET business = excluded.business, city = excluded.city, category = excluded.category, phone = excluded.phone, website = excluded.website, email = COALESCE(excluded.email, owner_profiles.email), goal = excluded.goal, news_optin = excluded.news_optin, updated_at = datetime('now')`)
    .bind(lid, v.business, v.city, v.category, v.phone, v.website, v.email, v.goal, news).run();
}
export async function setNewsOptin(db, lid, on) {
  await ensureProfileSchema(db);
  await db.prepare(`INSERT INTO owner_profiles (login_id, news_optin, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT(login_id) DO UPDATE SET news_optin = excluded.news_optin, updated_at = datetime('now')`).bind(lid, on ? 1 : 0).run();
}
/** 마지막으로 본 블로그 날짜 — 새 글 표시(NEW)용. 이전 값을 돌려주고 오늘로 바꾼다 */
export async function touchBlogSeen(db, lid, latest) {
  const p = await getProfile(db, lid);
  const prev = (p && p.blog_seen) || '';
  if (latest && latest !== prev) await db.prepare(`INSERT INTO owner_profiles (login_id, blog_seen) VALUES (?, ?) ON CONFLICT(login_id) DO UPDATE SET blog_seen = excluded.blog_seen`).bind(lid, latest).run();
  return prev;
}
/** 이 사장님 이메일로 받은 무료 진단 리포트(최신 3개) — audit_leads.email ↔ reports.lead_id.
    점수와 리포트가 짚은 문제의 추천 서비스(analysis.problems[].serviceSlug)만 꺼낸다 — 구글 데이터는 화면에 다시 쓰지 않는다 */
export async function reportsForEmail(db, email) {
  if (!email) return [];
  try {
    const rows = (await db.prepare(`SELECT r.id, r.business, r.location, r.created_at, r.report_json FROM reports r JOIN audit_leads l ON l.id = r.lead_id WHERE lower(l.email) = lower(?) ORDER BY r.created_at DESC LIMIT 3`).bind(email).all()).results || [];
    return rows.map((r) => {
      let rep = null; try { rep = JSON.parse(r.report_json); } catch {}
      const sc = rep && rep.scores;
      const probs = (rep && rep.analysis && rep.analysis.problems) || [];
      return {
        id: r.id, business: r.business, location: r.location, created_at: r.created_at,
        scores: sc ? { total: sc.total || 0, areas: (sc.areas || []).map((a) => ({ key: a.key, label: a.label, score: a.score, max: a.max })) } : null,
        recs: [...new Set(probs.map((x) => x && x.serviceSlug).filter(Boolean))].slice(0, 3),
        expired: !!(rep && rep.expired),
      };
    });
  } catch { return []; }
}
/** 로그인 사장님의 연락 이메일 — 확인된 로그인 이메일 → 프로필에 적은 이메일 */
export function ownerEmail(s, profile) {
  return (s && s.e) || (profile && profile.email) || '';
}
/** 로그인 뒤 돌아갈 곳 — 우리 사이트 안의 경로만 */
export function safeNext(v) {
  const s = String(v || '');
  return /^\/(?!\/)[\w\-./?=&%#]*$/.test(s) && s.length < 200 ? s : '';
}
