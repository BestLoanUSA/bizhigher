/**
 * 관리자 인증 — 두 가지 중 하나
 *   1) Cloudflare Access (권장, 나중에): ADMIN_ACCESS_TEAM(예: bizhigher) + ADMIN_ACCESS_AUD(앱 Audience 태그)
 *      → Cf-Access-Jwt-Assertion JWT 를 Access 공개키로 검증
 *   2) 비밀번호 (지금 바로): ADMIN_PASSWORD → 로그인 폼 → HMAC 서명 쿠키(30일)
 * 둘 다 없으면 503. 프리뷰 배포에는 환경변수가 없으므로 자동으로 잠긴다.
 */

const COOKIE = 'bh_admin';
const DAY = 86400;

export async function authenticate(request, env) {
  if (env.ADMIN_ACCESS_TEAM && env.ADMIN_ACCESS_AUD) {
    const jwt = request.headers.get('cf-access-jwt-assertion') || cookie(request, 'CF_Authorization');
    const claims = jwt ? await verifyAccessJwt(jwt, env.ADMIN_ACCESS_TEAM, env.ADMIN_ACCESS_AUD) : null;
    if (claims) return { ok: true, user: claims.email || 'access', mode: 'access' };
    if (!env.ADMIN_PASSWORD) return { ok: false, mode: 'access' };
  }
  if (env.ADMIN_PASSWORD) {
    const c = cookie(request, COOKIE);
    if (c && (await verifyCookie(c, env.ADMIN_PASSWORD))) return { ok: true, user: 'admin', mode: 'password' };
    return { ok: false, mode: 'password' };
  }
  return { ok: false, mode: 'unconfigured' };
}

export async function login(password, env) {
  if (!env.ADMIN_PASSWORD || !password) return null;
  if (!timingSafeEqual(String(password), String(env.ADMIN_PASSWORD))) return null;
  const exp = Math.floor(Date.now() / 1000) + 30 * DAY;
  const sig = await hmac(env.ADMIN_PASSWORD, String(exp));
  return `${COOKIE}=${exp}.${sig}; Path=/admin; HttpOnly; Secure; SameSite=Lax; Max-Age=${30 * DAY}`;
}

export function logoutCookie() {
  return `${COOKIE}=; Path=/admin; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

async function verifyCookie(value, password) {
  const [exp, sig] = value.split('.');
  if (!exp || !sig) return false;
  if (Number(exp) < Date.now() / 1000) return false;
  const expected = await hmac(password, exp);
  return timingSafeEqual(sig, expected);
}

/* ---------- Cloudflare Access JWT (RS256) ---------- */

let certCache = { at: 0, keys: [] };
async function verifyAccessJwt(token, team, aud) {
  try {
    const [h, p, s] = token.split('.');
    if (!h || !p || !s) return null;
    const header = JSON.parse(b64url(h));
    const payload = JSON.parse(b64url(p));
    if (header.alg !== 'RS256') return null;
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) return null;
    const auds = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (!auds.includes(aud)) return null;
    if (payload.iss && payload.iss !== `https://${team}.cloudflareaccess.com`) return null;

    if (Date.now() - certCache.at > 3600e3 || !certCache.keys.length) {
      const res = await fetch(`https://${team}.cloudflareaccess.com/cdn-cgi/access/certs`);
      const j = await res.json();
      certCache = { at: Date.now(), keys: j.keys || [] };
    }
    const jwk = certCache.keys.find((k) => k.kid === header.kid);
    if (!jwk) return null;
    const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64urlBytes(s), new TextEncoder().encode(`${h}.${p}`));
    return ok ? payload : null;
  } catch { return null; }
}

/* ---------- 유틸 ---------- */

function cookie(request, name) {
  const h = request.headers.get('cookie') || '';
  for (const part of h.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return v.join('=');
  }
  return null;
}

async function hmac(secret, msg) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode('bh-admin:' + secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(msg));
  return [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

function b64url(s) { return new TextDecoder().decode(b64urlBytes(s)); }
function b64urlBytes(s) {
  const b = atob(s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '='));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
}
