/**
 * 무료 진단 폼 처리 + AI 진단 엔진 — Cloudflare Pages Function
 * POST /api/audit  { business, location, email }
 *
 * 흐름: 리드 저장(항상) → Places 데이터 수집 → 룰 채점 → Claude 해석 → 리포트 저장 → 리포트 URL 반환
 * 환경변수(Pages Settings → Environment variables):
 *   GOOGLE_PLACES_API_KEY  (필수 — 없으면 리드만 저장)
 *   ANTHROPIC_API_KEY      (선택 — 없으면 템플릿 해석으로 대체)
 *   CLAUDE_MODEL           (선택 — 기본 claude-haiku-4-5)
 */
import { computeScores, templateAnalysis, buildClaudePrompt } from './_engine.js';
import { notify, esc } from './_notify.js';

export async function onRequestPost(context) {
  const { request, env } = context;
  let data;
  try {
    data = await request.json();
  } catch {
    return json({ ok: false, error: 'invalid' }, 400);
  }
  const business = (data.business || '').trim().slice(0, 200);
  const location = (data.location || '').trim().slice(0, 300);
  const email = (data.email || '').trim().slice(0, 200);
  if (!business || !location || !email || !email.includes('@')) {
    return json({ ok: false, error: 'invalid' }, 400);
  }

  // 1) 리드는 무조건 저장
  let leadId = null;
  try {
    const r = await env.DB.prepare(
      'INSERT INTO audit_leads (business, location, email) VALUES (?, ?, ?)'
    ).bind(business, location, email).run();
    leadId = r.meta && r.meta.last_row_id;
  } catch {
    return json({ ok: false, error: 'server' }, 500);
  }

  // 2) 진단 리포트 생성 (실패해도 리드는 살아있음)
  let reportUrl = null;
  try {
    if (env.GOOGLE_PLACES_API_KEY) {
      const report = await generateReport(business, location, env);
      const id = crypto.randomUUID().replace(/-/g, '').slice(0, 12);
      await env.DB.prepare(
        'INSERT INTO reports (id, lead_id, business, location, report_json) VALUES (?, ?, ?, ?, ?)'
      ).bind(id, leadId, business, location, JSON.stringify(report)).run();
      reportUrl = '/report/' + id;
    }
  } catch (err) {
    // 조용히 폴백 — 폼은 성공 처리, 리드로 후속
  }
  // 3) David에게 알림 (비동기 — 응답을 지연시키지 않음)
  const reportLink = reportUrl
    ? `<a href="https://bizhigher.com${reportUrl}">리포트 보기</a>`
    : '리포트 생성 안 됨 (수동 확인 필요)';
  context.waitUntil(
    notify(env, `🔔 새 진단 신청 — ${business}`, [
      ['업체명', esc(business)],
      ['위치', esc(location)],
      ['이메일', esc(email)],
      ['리포트', reportLink],
    ])
  );

  return json({ ok: true, reportUrl });
}

/* ---------- 리포트 생성 오케스트레이션 ---------- */

async function generateReport(business, location, env) {
  const key = env.GOOGLE_PLACES_API_KEY;

  // A. 우리 가게 찾기
  const found = await placesSearch(`${business} ${location}`, key, 3);
  const place = found[0] || null;
  const biz = place
    ? {
        found: true,
        name: place.name,
        rating: place.rating,
        reviewCount: place.reviewCount,
        photoCount: place.photoCount,
        websiteUri: place.websiteUri,
        hasHours: place.hasHours,
        primaryType: place.primaryType,
        address: place.address,
        phone: place.phone,
        websiteReachable: false,
      }
    : { found: false, name: business };

  // B. 웹사이트 접근 확인 (5초 제한)
  if (biz.found && biz.websiteUri) {
    biz.websiteReachable = await checkReachable(biz.websiteUri);
  }

  // C. 동네 경쟁 업체 (같은 업종 검색, 자기 자신 제외, 리뷰 수 상위 3곳)
  let competitors = [];
  if (biz.found) {
    const catQuery = `${biz.primaryType || business.split(' ')[0]} ${location}`;
    const nearby = await placesSearch(catQuery, key, 10);
    competitors = nearby
      .filter((p) => p.id !== place.id)
      .sort((a, b) => (b.reviewCount || 0) - (a.reviewCount || 0))
      .slice(0, 3);
  }

  // D. 룰 채점 (결정적)
  const scores = computeScores(biz, competitors);

  // E. 해석 — Claude 우선, 실패 시 템플릿
  let analysis = null;
  if (env.ANTHROPIC_API_KEY) {
    analysis = await claudeAnalysis(biz, scores, competitors, env).catch(() => null);
  }
  if (!analysis) analysis = templateAnalysis(biz, scores, competitors);

  return {
    v: 1,
    business: {
      name: biz.name,
      rating: biz.rating || null,
      reviewCount: biz.reviewCount || 0,
      photoCount: biz.photoCount || 0,
      website: biz.websiteUri || null,
      address: biz.address || null,
      found: biz.found,
    },
    location,
    scores,
    competitors: competitors.map((c) => ({
      name: c.name,
      rating: c.rating || null,
      reviewCount: c.reviewCount || 0,
    })),
    analysis,
    generatedAt: new Date().toISOString(),
  };
}

/* ---------- Google Places API (New) ---------- */

async function placesSearch(textQuery, key, pageSize) {
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': key,
      'X-Goog-FieldMask':
        'places.id,places.displayName,places.rating,places.userRatingCount,places.websiteUri,places.regularOpeningHours,places.photos,places.formattedAddress,places.primaryTypeDisplayName,places.nationalPhoneNumber',
    },
    body: JSON.stringify({ textQuery, languageCode: 'ko', pageSize: pageSize || 5 }),
  });
  if (!res.ok) throw new Error('places ' + res.status);
  const data = await res.json();
  return (data.places || []).map((p) => ({
    id: p.id,
    name: (p.displayName && p.displayName.text) || '',
    rating: p.rating || 0,
    reviewCount: p.userRatingCount || 0,
    photoCount: (p.photos || []).length,
    websiteUri: p.websiteUri || null,
    hasHours: !!p.regularOpeningHours,
    primaryType: (p.primaryTypeDisplayName && p.primaryTypeDisplayName.text) || null,
    address: p.formattedAddress || null,
    phone: p.nationalPhoneNumber || null,
  }));
}

async function checkReachable(url) {
  try {
    const res = await Promise.race([
      fetch(url, { method: 'GET', redirect: 'follow' }),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 5000)),
    ]);
    return res.ok;
  } catch {
    return false;
  }
}

/* ---------- Claude API 해석 ---------- */

async function claudeAnalysis(biz, scores, competitors, env) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: env.CLAUDE_MODEL || 'claude-haiku-4-5',
      max_tokens: 1500,
      messages: [{ role: 'user', content: buildClaudePrompt(biz, scores, competitors) }],
    }),
  });
  if (!res.ok) throw new Error('claude ' + res.status);
  const data = await res.json();
  const text = (data.content && data.content[0] && data.content[0].text) || '';
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('no json');
  const parsed = JSON.parse(match[0]);
  if (!parsed.summary || !Array.isArray(parsed.problems)) throw new Error('bad shape');
  return parsed;
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
