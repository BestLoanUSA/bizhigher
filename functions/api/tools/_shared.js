/**
 * /tools/ 무료 도구 공용 모듈 — 라우팅되지 않는 내부 모듈(_ 접두사)
 *
 * 남용 방지: 도구별 "IP당 하루 한도" + "사이트 전체 하루 한도"를 D1 tool_usage에 센다.
 *   - IP는 원문을 저장하지 않고 일자별 솔트로 해시한다(하루 지나면 같은 IP도 다른 값)
 *   - TOOLS_OFF="ai-check,menu-to-web" 처럼 쉼표 목록을 넣으면 그 도구만 끈다(재배포 1회 필요)
 *   - TOOLS_DAILY_SCALE=0.5 처럼 넣으면 모든 전체 한도를 그 배수로 줄인다
 * 구글 Places 결과는 화면에 보여주기만 하고 저장하지 않는다(CLAUDE.md §14).
 */

/* 도구별 한도 — perUser: IP 1개·이메일 1개 각각 하루 최대(둘 중 하나라도 넘으면 막는다), global: 사이트 전체 하루 최대
   2026-10-07 David 결정: 모든 도구 하루 3회 미만 → perUser 2 */
export const LIMITS = {
  'review-link': { perUser: 2, global: 300 },
  'review-reply': { perUser: 2, global: 200 },
  'ads-budget': { perUser: 2, global: 1000 },
  'nap-check': { perUser: 2, global: 100 },
  'local-rank': { perUser: 2, global: 150 },
  'ai-check': { perUser: 2, global: 60 },
  'gbp-post': { perUser: 2, global: 200 },
  'menu-to-web': { perUser: 2, global: 80 },
  'bilingual-intro': { perUser: 2, global: 200 },
  // 로컬 순위의 1단계(가게 찾기)는 횟수 안내 대상이 아닌 보조 한도
  'local-rank-find': { perUser: 6, global: 500 },
};

export function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

/* 다른 사이트에서 우리 API를 직접 끌어다 쓰는 것을 막는 최소 장치 — 브라우저 Origin 확인 */
export function originAllowed(request) {
  const o = request.headers.get('Origin') || '';
  if (!o) return false;
  try {
    const h = new URL(o).hostname;
    return h === 'bizhigher.com' || h === 'www.bizhigher.com' || h.endsWith('.bizhigher-site.pages.dev') || h === 'bizhigher-site.pages.dev' || h === 'localhost' || h === '127.0.0.1';
  } catch {
    return false;
  }
}

async function sha256(s) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 24);
}

async function ensureTables(env) {
  await env.DB.batch([
    env.DB.prepare('CREATE TABLE IF NOT EXISTS tool_usage (day TEXT NOT NULL, who TEXT NOT NULL, tool TEXT NOT NULL, n INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (day, who, tool))'),
    env.DB.prepare('CREATE TABLE IF NOT EXISTS tool_leads (id INTEGER PRIMARY KEY AUTOINCREMENT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, email TEXT NOT NULL, phone TEXT, tool TEXT NOT NULL, business TEXT)'),
  ]);
}

/**
 * 한도 확인 후 1회 차감. 통과하면 { ok: true }, 아니면 { ok: false, reason }.
 * IP와 이메일을 각각 센다(who = 'i:해시' / 'e:해시'). 전체 한도는 IP 줄만 합산한다.
 * 해시는 일자별 솔트라 하루가 지나면 같은 IP·이메일도 다른 값이 된다 — 원본은 남지 않는다.
 * D1이 없거나 실패하면 비용 상한을 지킬 수 없으므로 막는다.
 */
export async function takeQuota(env, request, tool, email) {
  const off = String(env.TOOLS_OFF || '').split(',').map((x) => x.trim()).filter(Boolean);
  if (off.includes(tool)) return { ok: false, reason: 'off' };
  const lim = LIMITS[tool];
  if (!lim) return { ok: false, reason: 'unknown' };
  if (!env.DB) return { ok: false, reason: 'busy' };
  const scale = Number(env.TOOLS_DAILY_SCALE || 1);
  const globalMax = Math.max(0, Math.floor(lim.global * (Number.isFinite(scale) ? scale : 1)));
  const day = new Date().toISOString().slice(0, 10);
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const whoIp = 'i:' + (await sha256(`${day}|${ip}|bizhigher-tools`));
  const whoEm = 'e:' + (await sha256(`${day}|${String(email || '').toLowerCase()}|bizhigher-tools`));
  try {
    await ensureTables(env);
    const row = await env.DB.prepare(
      "SELECT COALESCE(SUM(CASE WHEN who = ? THEN n ELSE 0 END), 0) AS ip, COALESCE(SUM(CASE WHEN who = ? THEN n ELSE 0 END), 0) AS em, COALESCE(SUM(CASE WHEN who LIKE 'i:%' THEN n ELSE 0 END), 0) AS total FROM tool_usage WHERE day = ? AND tool = ?"
    ).bind(whoIp, whoEm, day, tool).first();
    const used = Math.max((row && row.ip) || 0, (row && row.em) || 0);
    if (used >= lim.perUser) return { ok: false, reason: 'user' };
    if (row && row.total >= globalMax) return { ok: false, reason: 'global' };
    const up = 'INSERT INTO tool_usage (day, who, tool, n) VALUES (?, ?, ?, 1) ON CONFLICT(day, who, tool) DO UPDATE SET n = n + 1';
    await env.DB.batch([env.DB.prepare(up).bind(day, whoIp, tool), env.DB.prepare(up).bind(day, whoEm, tool)]);
    return { ok: true, left: lim.perUser - used - 1 };
  } catch {
    return { ok: false, reason: 'busy' };
  }
}

/* 도구 이용 리드 저장 — 이메일 처음 보이면 true(알림 보낼지 판단용). 입력 내용·결과는 저장하지 않는다 */
export async function saveLead(env, { email, phone, tool, business }) {
  try {
    const seen = await env.DB.prepare('SELECT 1 FROM tool_leads WHERE email = ? LIMIT 1').bind(email).first();
    await env.DB.prepare('INSERT INTO tool_leads (email, phone, tool, business) VALUES (?, ?, ?, ?)').bind(email, phone || null, tool, business || null).run();
    return !seen;
  } catch {
    return false;
  }
}

export function validEmail(s) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(s || '').trim()) && String(s).length <= 200;
}

export const QUOTA_MSG = {
  off: '이 도구는 잠시 쉬고 있습니다. 무료 진단을 이용해 주세요.',
  user: '이 도구는 하루 2회까지 무료입니다. 내일 다시 이용해 주세요.',
  global: '오늘 이 도구 이용이 많아 잠시 마감했습니다. 내일 다시 이용해 주세요.',
  busy: '잠시 후 다시 시도해 주세요.',
  unknown: '알 수 없는 도구입니다.',
};

/* ---------- Claude ---------- */

/**
 * Messages API 호출. 기존 진단(audit.js)과 같은 방식(fetch + CLAUDE_MODEL, 기본 claude-haiku-4-5).
 * 반환: 응답 JSON 전체 (content 배열은 호출한 쪽에서 해석)
 */
export async function claude(env, body) {
  if (!env.ANTHROPIC_API_KEY) throw new Error('no-key');
  const payload = { model: env.CLAUDE_MODEL || 'claude-haiku-4-5', max_tokens: 2000, ...body };
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('claude ' + res.status);
  return res.json();
}

export function textOf(resp) {
  return (resp.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
}

/* 응답 텍스트에서 첫 JSON 객체를 꺼낸다 — 모델이 앞뒤에 설명을 붙여도 견딘다 */
export function jsonOf(resp) {
  if (resp.stop_reason === 'refusal') throw new Error('refusal');
  const t = textOf(resp);
  const s = t.indexOf('{');
  const e = t.lastIndexOf('}');
  if (s < 0 || e <= s) throw new Error('no-json');
  return JSON.parse(t.slice(s, e + 1));
}

/* ---------- Google Places (New) ---------- */

/**
 * fieldMask에 따라 과금 등급이 달라진다:
 *   id만 → Text Search Essentials (IDs Only): 구글 기준 무료·무제한 (로컬 순위 그리드)
 *   id·displayName·formattedAddress·location → Text Search Pro (월 5,000건 무료, 이후 1,000건당 $32 — 무료 진단과 공유)
 *   nationalPhoneNumber·websiteUri·regularOpeningHours → Enterprise (월 1,000건 무료, 이후 1,000건당 $35)
 * 필요한 필드만 요청할 것.
 */
export async function placesSearch(env, textQuery, fields, pageSize, extra) {
  if (!env.GOOGLE_PLACES_API_KEY) throw new Error('no-places');
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': env.GOOGLE_PLACES_API_KEY,
      'X-Goog-FieldMask': fields.map((f) => 'places.' + f).join(','),
    },
    // ko로 요청하면 업체명이 번역돼 버린다(audit.js 참고)
    body: JSON.stringify({ textQuery, languageCode: 'en', pageSize: pageSize || 5, ...(extra || {}) }),
  });
  if (!res.ok) throw new Error('places ' + res.status);
  const data = await res.json();
  return data.places || [];
}

export function clip(v, n) {
  return String(v == null ? '' : v).trim().slice(0, n);
}

/* 프롬프트 공통 규칙 — 모든 생성형 도구에 붙는다 */
export const POLICY = `반드시 지킬 규칙:
- 리뷰를 조건으로 한 할인·선물·보상 제안, 리뷰를 골라 받는 방식(리뷰 게이팅), 가짜 리뷰 유도는 절대 쓰지 않는다 (구글·옐프 정책 위반)
- 병원·치과·한의원·의료 업종이면 상대가 환자였다는 사실을 확인하거나 암시하지 않고, 진료 내용·개인정보를 언급하지 않는다 (HIPAA)
- 사실이 아닌 수치·수상·인증·보장을 지어내지 않는다. 입력에 없는 정보는 쓰지 않는다
- 존댓말, 과장 없이 담백하게`;
