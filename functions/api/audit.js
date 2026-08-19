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
    ? { ...place, found: true, websiteReachable: false }
    : { found: false, name: business };

  // B. 웹사이트 접근 확인 (5초 제한)
  if (biz.found && biz.websiteUri) {
    biz.websiteReachable = await checkReachable(biz.websiteUri);
  }

  // C. 동네 경쟁 업체 — 같은 업종 타입만 (안경점↔안경점, 식당↔식당)
  //    업종 타입 정보가 없으면 경쟁 비교를 아예 생략 (엉뚱한 비교보다 생략이 낫다)
  let competitors = [];
  if (biz.found) {
    competitors = (await competitorsNearby(biz, key).catch(() => []))
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
      category: biz.primaryType || null,
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
        'places.id,places.displayName,places.rating,places.userRatingCount,places.websiteUri,places.regularOpeningHours,places.photos,places.formattedAddress,places.primaryType,places.primaryTypeDisplayName,places.nationalPhoneNumber,places.location',
    },
    body: JSON.stringify({ textQuery, languageCode: 'ko', pageSize: pageSize || 5 }),
  });
  if (!res.ok) throw new Error('places ' + res.status);
  const data = await res.json();
  return (data.places || []).map(mapPlace);
}

function mapPlace(p) {
  return {
    id: p.id,
    name: (p.displayName && p.displayName.text) || '',
    rating: p.rating || 0,
    reviewCount: p.userRatingCount || 0,
    photoCount: (p.photos || []).length,
    websiteUri: p.websiteUri || null,
    hasHours: !!p.regularOpeningHours,
    primaryType: (p.primaryTypeDisplayName && p.primaryTypeDisplayName.text) || null,
    primaryTypeId: p.primaryType || null,
    address: p.formattedAddress || null,
    phone: p.nationalPhoneNumber || null,
    lat: p.location && p.location.latitude,
    lng: p.location && p.location.longitude,
  };
}

/**
 * 업종 패밀리 — 구글이 같은 업계를 여러 세부 타입으로 쪼개놓기 때문에
 * (예: 안경점 = optician / optometrist / eye_care_center ...)
 * 같은 계열을 묶어서 검색해야 진짜 경쟁사가 다 잡힌다.
 */
const TYPE_FAMILIES = [
  ['optician', 'optometrist', 'eye_care_center', 'ophthalmologist', 'sunglasses_store'],
  ['dentist', 'dental_clinic', 'orthodontist', 'pediatric_dentist'],
  ['doctor', 'medical_clinic', 'wellness_center', 'chiropractor', 'acupuncture_clinic'],
  ['hair_salon', 'hair_care', 'barber_shop'],
  ['beauty_salon', 'nail_salon', 'skin_care_clinic', 'spa', 'massage'],
  ['real_estate_agency', 'real_estate_consultant'],
  ['insurance_agency', 'financial_consultant', 'accounting', 'tax_consultant'],
  ['lawyer', 'legal_services', 'notary_public'],
  ['gym', 'fitness_center', 'pilates_studio', 'yoga_studio', 'martial_arts_school'],
  ['supermarket', 'grocery_store', 'asian_grocery_store', 'butcher_shop'],
  ['cafe', 'coffee_shop', 'bakery', 'dessert_shop', 'tea_house', 'bubble_tea_store'],
  ['car_repair', 'auto_body_shop', 'tire_shop', 'oil_change_service'],
  ['laundry', 'dry_cleaning_service'],
  ['veterinary_care', 'pet_groomer'],
  ['pharmacy', 'drugstore'],
];

function typeFamily(t) {
  if (!t) return null;
  for (const fam of TYPE_FAMILIES) if (fam.includes(t)) return fam;
  // 식당류: 같은 요리 타입 우선, 부족하면 일반 식당으로 확장 (아래 2차 검색)
  if (t === 'restaurant' || t.endsWith('_restaurant')) return [t];
  return [t];
}

/**
 * 동종 업종 경쟁사 검색 — Nearby Search + 업종 패밀리 필터
 * 결과가 3곳 미만이면 검색 반경을 넓혀 한 번 더 시도.
 */
async function competitorsNearby(biz, key) {
  if (!biz.primaryTypeId || biz.lat == null) return [];
  const family = typeFamily(biz.primaryTypeId);
  if (!family) return [];

  let results = await nearbyByTypes(biz, family, 15000, key);

  // 부족하면: 반경 30km 확장 / 식당류는 일반 restaurant까지 확장
  if (results.length < 3) {
    const broadened =
      biz.primaryTypeId.endsWith('_restaurant') ? [...family, 'restaurant'] : family;
    const wider = await nearbyByTypes(biz, broadened, 30000, key);
    const seen = new Set(results.map((r) => r.id));
    for (const r of wider) if (!seen.has(r.id)) results.push(r);
  }
  return results;
}

async function nearbyByTypes(biz, types, radius, key) {
  const res = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': key,
      'X-Goog-FieldMask':
        'places.id,places.displayName,places.rating,places.userRatingCount,places.primaryType',
    },
    body: JSON.stringify({
      includedPrimaryTypes: types.slice(0, 5),
      maxResultCount: 20,
      languageCode: 'ko',
      rankPreference: 'POPULARITY',
      locationRestriction: {
        circle: { center: { latitude: biz.lat, longitude: biz.lng }, radius },
      },
    }),
  });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.places || [])
    .filter((p) => p.id !== biz.id)
    .map((p) => ({
      id: p.id,
      name: (p.displayName && p.displayName.text) || '',
      rating: p.rating || 0,
      reviewCount: p.userRatingCount || 0,
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
