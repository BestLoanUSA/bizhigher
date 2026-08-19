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
    competitors = (await competitorsNearby(biz, env, key).catch(() => []))
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
      categoryGeneric: !!biz.categoryGeneric,
      inferredIndustry: biz.inferredIndustry || null,
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
  // 식당류: 같은 요리 타입 + 일반 식당까지 한 패밀리로 (한식당의 경쟁자는 옆의 다른 식당들)
  if (t === 'restaurant' || t.endsWith('_restaurant')) return [t, 'restaurant'];
  return [t];
}

/** 경쟁사 매칭에 쓸모없는 두루뭉술한 타입들 — 이런 분류는 "업종 미인식"으로 취급 */
const GENERIC_TYPES = new Set([
  'store', 'point_of_interest', 'establishment', 'shopping_mall', 'shopping_center',
  'corporate_office', 'business_center', 'general_contractor', 'food', 'health',
]);

/** 업체명에서 업종 추론 (결정적 키워드맵 — 한/영) */
const NAME_KEYWORDS = [
  [/안경|optic|optix|eyewear|vision|glasses/i, '안경점'],
  [/치과|dental/i, '치과'],
  [/한의원|acupunc|한방/i, '한의원'],
  [/약국|pharmac/i, '약국'],
  [/부동산|realty|real ?estate/i, '부동산 중개'],
  [/미용실|헤어|hair/i, '미용실'],
  [/네일|nail/i, '네일샵'],
  [/피부|스킨|skin|에스테틱|spa/i, '피부 관리'],
  [/세탁|cleaner|laundry/i, '세탁소'],
  [/학원|academy|tutor/i, '학원'],
  [/보험|insurance/i, '보험'],
  [/융자|loan|mortgage|lending/i, '융자'],
  [/변호사|law|attorney|legal/i, '변호사'],
  [/회계|cpa|tax|accounting/i, '회계사'],
  [/식당|맛집|restaurant|순두부|bbq|국밥|grill|kitchen|식탁/i, '식당'],
  [/카페|커피|cafe|coffee/i, '카페'],
  [/베이커리|빵집|bakery|제과/i, '베이커리'],
  [/마켓|마트|market|grocery/i, '마켓'],
  [/정비|오토|auto|tire|body ?shop/i, '자동차 정비'],
  [/치킨|chicken/i, '치킨집'],
  [/태권도|martial|taekwondo/i, '태권도장'],
  [/여행사|travel/i, '여행사'],
  [/사진|photo|studio/i, '사진관'],
  [/꽃|flower|florist/i, '꽃집'],
];

function inferKeywordFromName(name) {
  for (const [re, kw] of NAME_KEYWORDS) if (re.test(name)) return kw;
  return null;
}

/** Claude로 업종 추론 (키워드맵 실패 시 폴백) */
async function inferKeywordWithClaude(biz, env) {
  if (!env.ANTHROPIC_API_KEY) return null;
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: env.CLAUDE_MODEL || 'claude-haiku-4-5',
        max_tokens: 60,
        messages: [{
          role: 'user',
          content: `업체명: "${biz.name}" (주소: ${biz.address || '미상'}). 이 업체의 업종을 추론해 구글 지도에서 경쟁사를 찾을 한국어 검색 키워드 하나만 JSON으로 답하라. 예: {"keyword":"안경점"}. JSON만 출력.`,
        }],
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const text = (data.content && data.content[0] && data.content[0].text) || '';
    const m = text.match(/\{[\s\S]*\}/);
    return m ? (JSON.parse(m[0]).keyword || null) : null;
  } catch {
    return null;
  }
}

/**
 * 동종 업종 경쟁사 검색 (v5)
 * 방식: 구글이 분류한 업종 이름(예: "안경점")으로 가게 좌표 주변을 텍스트 검색한 뒤,
 * 결과의 업종 타입이 우리 가게와 같은 패밀리인 것만 통과시킨다.
 * — Nearby 타입 필터가 지원하지 않는 업종(안경점 등)에서도 작동
 * — 패밀리 필터 덕분에 베이커리·마트가 섞이는 것이 구조적으로 불가능
 */
async function competitorsNearby(biz, env, key) {
  if (biz.lat == null) return [];
  const generic = !biz.primaryTypeId || GENERIC_TYPES.has(biz.primaryTypeId);
  biz.categoryGeneric = generic;

  // 검색 키워드 결정: 정상 분류면 구글 업종명, 부실 분류면 업체명에서 추론
  let keyword = null;
  if (!generic && biz.primaryType) {
    keyword = biz.primaryType;
  } else {
    keyword = inferKeywordFromName(biz.name) || (await inferKeywordWithClaude(biz, env));
    biz.inferredIndustry = keyword;
  }
  if (!keyword) return [];

  // 타깃 패밀리: 정상 분류면 그 타입의 패밀리, 부실 분류면 검색 결과의 지배적 업종으로 자동 보정
  const targetFamily = !generic ? typeFamily(biz.primaryTypeId) : null;

  let results = await searchByKeywordNear(biz, keyword, 20000, key, targetFamily);
  if (results.length < 2) {
    const wider = await searchByKeywordNear(biz, keyword, 50000, key, targetFamily);
    const seen = new Set(results.map((r) => r.id));
    for (const r of wider) if (!seen.has(r.id)) results.push(r);
  }
  return results;
}

async function searchByKeywordNear(biz, keyword, radius, key, targetFamily) {
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': key,
      'X-Goog-FieldMask':
        'places.id,places.displayName,places.rating,places.userRatingCount,places.primaryType',
    },
    body: JSON.stringify({
      textQuery: keyword, // 업종 키워드로 검색 (예: "안경점", "치과", "네일샵")
      languageCode: 'ko',
      pageSize: 20,
      locationBias: {
        circle: { center: { latitude: biz.lat, longitude: biz.lng }, radius },
      },
    }),
  });
  if (!res.ok) return [];
  const data = await res.json();
  const candidates = (data.places || [])
    .filter((p) => p.id !== biz.id && p.primaryType && !GENERIC_TYPES.has(p.primaryType))
    .map((p) => ({
      id: p.id,
      name: (p.displayName && p.displayName.text) || '',
      rating: p.rating || 0,
      reviewCount: p.userRatingCount || 0,
      typeId: p.primaryType,
    }));
  if (candidates.length === 0) return [];

  // 타깃 패밀리가 없으면(업종 미인식 케이스) 검색 결과의 지배적 업종 패밀리로 자동 보정
  let family = targetFamily;
  if (!family) {
    const counts = {};
    for (const c of candidates) counts[c.typeId] = (counts[c.typeId] || 0) + 1;
    const dominant = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
    family = typeFamily(dominant);
  }
  return candidates.filter((c) => family.includes(c.typeId));
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
