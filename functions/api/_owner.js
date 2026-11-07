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
