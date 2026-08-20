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

  // 업종 표기: 가능하면 한국어로 (리포트·프롬프트 표시용)
  if (biz.found && biz.primaryTypeId) {
    biz.primaryType = koTypeLabel(biz.primaryTypeId) || biz.primaryType;
  }

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
      distanceMi: c.distanceKm != null ? Math.round(c.distanceKm * 6.21) / 10 : null,
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
    // languageCode 'en': ko로 요청하면 구글이 업체명을 한국어로 번역해버림 ("New Optix" → "새로운 안경")
    body: JSON.stringify({ textQuery, languageCode: 'en', pageSize: pageSize || 5 }),
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

/** 업체명에서 업종 추론 (결정적 키워드맵 — [정규식, 한국어 표기, 영어 검색어]) */
const NAME_KEYWORDS = [
  [/안경|optic|optix|eyewear|vision|glasses/i, '안경점', 'optometrist'],
  [/치과|dental/i, '치과', 'dentist'],
  [/한의원|acupunc|한방/i, '한의원', 'acupuncture'],
  [/약국|pharmac/i, '약국', 'pharmacy'],
  [/부동산|realty|real ?estate/i, '부동산 중개', 'real estate agency'],
  [/미용실|헤어|hair/i, '미용실', 'hair salon'],
  [/네일|nail/i, '네일샵', 'nail salon'],
  [/피부|스킨|skin|에스테틱|spa/i, '피부 관리', 'skin care'],
  [/세탁|cleaner|laundry/i, '세탁소', 'dry cleaner'],
  [/학원|academy|tutor/i, '학원', 'tutoring center'],
  [/보험|insurance/i, '보험', 'insurance agency'],
  [/융자|loan|mortgage|lending/i, '융자', 'mortgage lender'],
  [/변호사|law|attorney|legal/i, '변호사', 'attorney'],
  [/회계|cpa|tax|accounting/i, '회계사', 'accountant'],
  [/식당|맛집|restaurant|순두부|bbq|국밥|grill|kitchen|식탁/i, '식당', 'restaurant'],
  [/카페|커피|cafe|coffee/i, '카페', 'coffee shop'],
  [/베이커리|빵집|bakery|제과/i, '베이커리', 'bakery'],
  [/마켓|마트|market|grocery/i, '마켓', 'grocery store'],
  [/정비|오토|auto|tire|body ?shop/i, '자동차 정비', 'auto repair'],
  [/치킨|chicken/i, '치킨집', 'chicken restaurant'],
  [/태권도|martial|taekwondo/i, '태권도장', 'taekwondo'],
  [/여행사|travel/i, '여행사', 'travel agency'],
  [/사진|photo|studio/i, '사진관', 'photo studio'],
  [/꽃|flower|florist/i, '꽃집', 'florist'],
];

function inferKeywordFromName(name) {
  for (const [re, ko, en] of NAME_KEYWORDS) if (re.test(name)) return { ko, en };
  return null;
}

/** 구글 타입 ID → 한국어 표기 (리포트 표시용) */
const KO_TYPE_LABEL = {
  optician: '안경점', optometrist: '검안사', eye_care_center: '안경·검안', ophthalmologist: '안과',
  sunglasses_store: '선글라스 매장', dentist: '치과', dental_clinic: '치과', orthodontist: '교정치과',
  doctor: '병원', medical_clinic: '클리닉', chiropractor: '카이로프랙틱', acupuncture_clinic: '한의원',
  hair_salon: '미용실', barber_shop: '이발소', beauty_salon: '뷰티샵', nail_salon: '네일샵',
  skin_care_clinic: '피부 관리', spa: '스파', massage: '마사지', real_estate_agency: '부동산 중개',
  insurance_agency: '보험', accounting: '회계', tax_consultant: '세무', lawyer: '변호사',
  legal_services: '법률 서비스', gym: '헬스장', pilates_studio: '필라테스', yoga_studio: '요가',
  supermarket: '슈퍼마켓', grocery_store: '마켓', asian_grocery_store: '아시안 마켓',
  cafe: '카페', coffee_shop: '커피숍', bakery: '베이커리', dessert_shop: '디저트숍',
  car_repair: '자동차 정비', tire_shop: '타이어샵', laundry: '세탁소', dry_cleaning_service: '세탁소',
  veterinary_care: '동물병원', pet_groomer: '펫 미용', pharmacy: '약국', drugstore: '약국',
  restaurant: '식당', korean_restaurant: '한식당',
};

function koTypeLabel(typeId) {
  if (!typeId) return null;
  if (KO_TYPE_LABEL[typeId]) return KO_TYPE_LABEL[typeId];
  if (typeId.endsWith('_restaurant')) return '식당';
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
          content: `업체명: "${biz.name}" (주소: ${biz.address || '미상'}). 이 업체의 업종을 추론해, 구글 지도에서 경쟁사를 찾을 검색 키워드를 한국어와 영어로 JSON으로만 답하라. 예: {"ko":"안경점","en":"optometrist"}`,
        }],
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const text = (data.content && data.content[0] && data.content[0].text) || '';
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return null;
    const p = JSON.parse(m[0]);
    return p.ko || p.en ? { ko: p.ko || null, en: p.en || null } : null;
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

  // 검색 키워드 결정 (영어 + 한국어 둘 다) — 미국에서는 영어 검색이 실제 주변 업체를
  // 가장 잘 잡고, 한국어 검색은 한국어 상호 업체를 보완한다.
  let kws = { ko: null, en: null };
  if (!generic && biz.primaryTypeId) {
    kws.en = biz.primaryTypeId.replace(/_/g, ' ');
    kws.ko = koTypeLabel(biz.primaryTypeId);
  } else {
    const inferred = inferKeywordFromName(biz.name) || (await inferKeywordWithClaude(biz, env));
    if (inferred) {
      kws = inferred;
      biz.inferredIndustry = inferred.ko || inferred.en;
    }
  }
  if (!kws.en && !kws.ko) return [];

  // 쿼리 후보: "키워드 + 도시" 우선, 그다음 키워드 단독(좌표 바이어스만)
  const city = cityFromAddress(biz.address);
  const queries = [];
  for (const k of [kws.en, kws.ko]) {
    if (!k) continue;
    if (city) queries.push(`${k} ${city}`);
    queries.push(k);
  }

  // 12km → (부족 시) 25km. 쿼리를 순서대로 시도하며 id로 중복 제거.
  const seen = new Map();
  for (const radius of [12000, 25000]) {
    for (const q of queries) {
      if (seen.size >= 6) break;
      const found = await searchByKeywordNear(biz, q, radius, key).catch(() => []);
      for (const r of found) if (!seen.has(r.id)) seen.set(r.id, r);
    }
    if (seen.size >= 2) break;
  }
  const candidates = [...seen.values()];
  if (candidates.length === 0) return [];

  // 업종 패밀리 필터: 정상 분류면 그 타입의 패밀리, 부실 분류면 결과의 지배적 업종으로 보정
  let family = !generic ? typeFamily(biz.primaryTypeId) : null;
  if (!family) {
    const counts = {};
    for (const c of candidates) counts[c.typeId] = (counts[c.typeId] || 0) + 1;
    const dominant = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
    family = typeFamily(dominant);
  }
  return candidates.filter((c) => family.includes(c.typeId));
}

/** formattedAddress에서 도시명 추출 — "9520 Garden Grove Blvd, Garden Grove, CA 92844, 미국" → "Garden Grove" */
function cityFromAddress(address) {
  if (!address) return null;
  const parts = address.split(',').map((s) => s.trim());
  // 주(州)+우편번호 파트("CA 92844") 바로 앞이 도시
  const stateIdx = parts.findIndex((p) => /^[A-Z]{2}\s*\d{5}/.test(p));
  if (stateIdx > 0) return parts[stateIdx - 1];
  return parts.length >= 3 ? parts[1] : null;
}

/** 두 좌표 간 직선 거리 (km) — locationBias가 뚫려도 여기서 걸러진다 */
function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function searchByKeywordNear(biz, keyword, radius, key) {
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': key,
      'X-Goog-FieldMask':
        'places.id,places.displayName,places.rating,places.userRatingCount,places.primaryType,places.location',
    },
    body: JSON.stringify({
      textQuery: keyword, // 업종 키워드로 검색 (예: "optometrist Garden Grove", "안경점")
      languageCode: 'en',
      pageSize: 20,
      locationBias: {
        circle: { center: { latitude: biz.lat, longitude: biz.lng }, radius },
      },
    }),
  });
  if (!res.ok) return [];
  const data = await res.json();
  const maxKm = radius / 1000;
  const candidates = (data.places || [])
    .filter((p) => p.id !== biz.id && p.primaryType && !GENERIC_TYPES.has(p.primaryType))
    .map((p) => ({
      id: p.id,
      name: (p.displayName && p.displayName.text) || '',
      rating: p.rating || 0,
      reviewCount: p.userRatingCount || 0,
      typeId: p.primaryType,
      distanceKm:
        p.location && p.location.latitude != null
          ? haversineKm(biz.lat, biz.lng, p.location.latitude, p.location.longitude)
          : null,
    }))
    // 핵심 수정: locationBias는 "권장"일 뿐 강제가 아니라서 유명한 원거리 업체
    // (예: LA 서독안경)가 섞여 들어온다 → 실제 좌표 거리로 하드 필터.
    .filter((p) => p.distanceKm != null && p.distanceKm <= maxKm);
  return candidates;
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
