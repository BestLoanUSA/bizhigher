/**
 * /tools/ 무료 도구 공용 모듈 — 라우팅되지 않는 내부 모듈(_ 접두사)
 *
 * 남용 방지: 도구별 "IP당 하루 한도" + "사이트 전체 하루 한도"를 D1 tool_usage에 센다.
 *   - IP는 원문을 저장하지 않고 일자별 솔트로 해시한다(하루 지나면 같은 IP도 다른 값)
 *   - TOOLS_OFF="ai-check,menu-to-web" 처럼 쉼표 목록을 넣으면 그 도구만 끈다(재배포 1회 필요)
 *   - TOOLS_DAILY_SCALE=0.5 처럼 넣으면 모든 전체 한도를 그 배수로 줄인다
 * 구글 Places 결과는 화면에 보여주기만 하고 저장하지 않는다(CLAUDE.md §14).
 */

/* 도구별 한도 — perIp: IP 1개 하루 최대, global: 사이트 전체 하루 최대 */
export const LIMITS = {
  'review-link': { perIp: 20, global: 1000 },
  'review-reply': { perIp: 15, global: 600 },
  'nap-check': { perIp: 8, global: 300 },
  'ai-check': { perIp: 3, global: 150 },
  'gbp-post': { perIp: 15, global: 600 },
  'menu-to-web': { perIp: 5, global: 200 },
  'bilingual-intro': { perIp: 15, global: 600 },
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

async function ensureUsageTable(env) {
  await env.DB.prepare(
    'CREATE TABLE IF NOT EXISTS tool_usage (day TEXT NOT NULL, who TEXT NOT NULL, tool TEXT NOT NULL, n INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (day, who, tool))'
  ).run();
}

/**
 * 한도 확인 후 1회 차감. 통과하면 { ok: true }, 아니면 { ok: false, reason }.
 * D1이 없거나 실패하면 도구를 막지 않는다(전체 한도는 비용 상한이라 D1 장애 시엔 보수적으로 막는다).
 */
export async function takeQuota(env, request, tool) {
  const off = String(env.TOOLS_OFF || '').split(',').map((x) => x.trim()).filter(Boolean);
  if (off.includes(tool)) return { ok: false, reason: 'off' };
  const lim = LIMITS[tool];
  if (!lim) return { ok: false, reason: 'unknown' };
  if (!env.DB) return { ok: false, reason: 'busy' };
  const scale = Number(env.TOOLS_DAILY_SCALE || 1);
  const globalMax = Math.max(0, Math.floor(lim.global * (Number.isFinite(scale) ? scale : 1)));
  const day = new Date().toISOString().slice(0, 10);
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const who = await sha256(`${day}|${ip}|bizhigher-tools`);
  try {
    await ensureUsageTable(env);
    const row = await env.DB.prepare(
      "SELECT COALESCE(SUM(CASE WHEN who = ? THEN n ELSE 0 END), 0) AS mine, COALESCE(SUM(n), 0) AS total FROM tool_usage WHERE day = ? AND tool = ?"
    ).bind(who, day, tool).first();
    if (row && row.mine >= lim.perIp) return { ok: false, reason: 'ip' };
    if (row && row.total >= globalMax) return { ok: false, reason: 'global' };
    await env.DB.prepare(
      'INSERT INTO tool_usage (day, who, tool, n) VALUES (?, ?, ?, 1) ON CONFLICT(day, who, tool) DO UPDATE SET n = n + 1'
    ).bind(day, who, tool).run();
    return { ok: true, left: lim.perIp - ((row && row.mine) || 0) - 1 };
  } catch {
    return { ok: false, reason: 'busy' };
  }
}

export const QUOTA_MSG = {
  off: '이 도구는 잠시 쉬고 있습니다. 무료 진단을 이용해 주세요.',
  ip: '오늘 사용 가능한 횟수를 모두 쓰셨습니다. 내일 다시 이용해 주세요.',
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
 *   id·displayName·formattedAddress → Text Search Pro (월 무료 한도 공유: 무료 진단과 같은 키)
 *   nationalPhoneNumber·websiteUri·regularOpeningHours → Enterprise (무료 한도가 더 작다)
 * 필요한 필드만 요청할 것.
 */
export async function placesSearch(env, textQuery, fields, pageSize) {
  if (!env.GOOGLE_PLACES_API_KEY) throw new Error('no-places');
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': env.GOOGLE_PLACES_API_KEY,
      'X-Goog-FieldMask': fields.map((f) => 'places.' + f).join(','),
    },
    // ko로 요청하면 업체명이 번역돼 버린다(audit.js 참고)
    body: JSON.stringify({ textQuery, languageCode: 'en', pageSize: pageSize || 5 }),
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
