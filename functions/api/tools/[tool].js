/**
 * 무료 도구 API — POST /api/tools/{tool}
 * 도구 목록·한도는 _shared.js의 LIMITS. 화면은 build.js가 만드는 /tools/{tool}/ 페이지.
 * 모든 도구는 이메일(필수)·전화(선택)를 받아 tool_leads에 남긴다 — 무료 도구의 대가. 입력 내용·결과는 저장하지 않는다.
 * 광고 예산 계산기는 계산은 브라우저에서 하고, 여기서는 리드 기록과 횟수만 처리한다.
 */
import { json, originAllowed, takeQuota, QUOTA_MSG, claude, jsonOf, textOf, placesSearch, clip, POLICY, saveLead, validEmail } from './_shared.js';
import { notify, esc } from '../_notify.js';

const HANDLERS = {
  'review-link': reviewLink,
  'review-reply': reviewReply,
  'nap-check': napCheck,
  'ai-check': aiCheck,
  'gbp-post': gbpPost,
  'menu-to-web': menuToWeb,
  'bilingual-intro': bilingualIntro,
  'ads-budget': adsBudget,
  'local-rank': localRank,
};

const TOOL_NAMES = {
  'review-link': '리뷰 링크·QR', 'review-reply': '리뷰 답글', 'nap-check': '가게 정보 일치', 'ai-check': 'AI 추천 체크',
  'gbp-post': '프로필 게시물', 'menu-to-web': '웹 메뉴 변환', 'bilingual-intro': '한/영 소개문', 'ads-budget': '광고 예산 계산', 'local-rank': '로컬 순위 체크',
};

export async function onRequestPost(context) {
  const { request, env, params } = context;
  const tool = String(params.tool || '');
  const handler = HANDLERS[tool];
  if (!handler) return json({ ok: false, error: 'not-found' }, 404);
  if (!originAllowed(request)) return json({ ok: false, error: 'forbidden' }, 403);

  let input;
  try {
    const raw = await request.text();
    if (raw.length > 6 * 1024 * 1024) return json({ ok: false, error: '파일이 너무 큽니다.' }, 413);
    input = JSON.parse(raw);
  } catch {
    return json({ ok: false, error: '입력값을 확인해 주세요.' }, 400);
  }

  const email = clip(input && input.email, 200).toLowerCase();
  const phone = clip(input && input.phone, 40);
  if (!validEmail(email)) return json({ ok: false, error: '이메일을 정확히 입력해 주세요.' }, 400);

  // 입력 검증 실패는 횟수를 차감하지 않는다 — 각 도구가 외부 API를 부르기 직전에 charge()를 호출한다.
  // charge(key)의 key를 바꾸면 같은 도구 안에서도 다른 한도로 센다(예: 로컬 순위의 가게 찾기 단계)
  let q = null;
  const charge = async (key) => {
    const qk = key || tool;
    const r = await takeQuota(env, request, qk, email);
    if (!r.ok) throw Object.assign(new Error('quota'), { quota: r.reason });
    if (qk !== tool) return; // 보조 단계는 리드·남은 횟수에 반영하지 않는다
    q = r;
    const business = clip(input.business || input.bizName || input.query, 120);
    const first = await saveLead(env, { email, phone, tool, business });
    if (first) {
      context.waitUntil(notify(env, `🧰 무료 도구 새 이용자 — ${TOOL_NAMES[tool] || tool}`, [
        ['도구', esc(TOOL_NAMES[tool] || tool)],
        ['이메일', esc(email)],
        ['전화', esc(phone || '-')],
        ['업체', esc(business || '-')],
      ]));
    }
  };

  try {
    const result = await handler(input || {}, env, charge);
    if (result && result.error) return json({ ok: false, error: result.error }, 400);
    return json({ ok: true, left: q ? q.left : null, ...result });
  } catch (e) {
    if (e && e.quota) return json({ ok: false, error: QUOTA_MSG[e.quota] || QUOTA_MSG.busy }, 429);
    const msg = String((e && e.message) || e);
    const friendly = msg === 'no-key' || msg === 'no-places'
      ? '도구 준비 중입니다. 잠시 후 다시 이용해 주세요.'
      : msg === 'refusal'
        ? '이 내용으로는 결과를 만들 수 없습니다. 입력을 바꿔 다시 시도해 주세요.'
        : '일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.';
    return json({ ok: false, error: friendly }, 502);
  }
}

/* ---------- 1. 구글 리뷰 링크 ---------- */
async function reviewLink(input, env, charge) {
  const query = clip(input.query, 200);
  if (query.length < 2) return { error: '업체명과 도시를 입력해 주세요.' };
  await charge();
  const places = await placesSearch(env, query, ['id', 'displayName', 'formattedAddress'], 5);
  return {
    candidates: places.map((p) => ({
      id: p.id,
      name: (p.displayName && p.displayName.text) || '',
      address: p.formattedAddress || '',
    })),
  };
}

/* ---------- 2. 리뷰 답글 ---------- */
async function reviewReply(input, env, charge) {
  const review = clip(input.review, 3000);
  if (review.length < 3) return { error: '리뷰 내용을 붙여 넣어 주세요.' };
  const stars = Math.min(5, Math.max(1, parseInt(input.stars, 10) || 5));
  const lang = ['ko', 'en', 'both'].includes(input.lang) ? input.lang : 'both';
  const bizType = clip(input.bizType, 60) || '가게';
  const bizName = clip(input.bizName, 80);
  const langRule = lang === 'ko' ? '한국어 답글만 (en은 빈 문자열)' : lang === 'en' ? '영어 답글만 (ko는 빈 문자열)' : '한국어와 영어 둘 다';
  await charge();
  const resp = await claude(env, {
    max_tokens: 1800,
    system: `너는 미국 한인 소상공인의 구글 리뷰 답글을 대신 써 주는 담당자다.
${POLICY}
- 별점 1~3이면: 변명·반박 없이 사과와 개선 의지를 짧게, 구체적 해결은 공개 답글이 아니라 전화·이메일로 따로 연락 달라고 안내한다. 보상·환불 약속을 공개적으로 하지 않는다
- 별점 4~5이면: 리뷰에 나온 구체적 내용을 하나 짚어 감사하고, 다시 방문을 자연스럽게 청한다
- 손님 이름이나 직원 실명을 새로 만들어 넣지 않는다
- 각 답글은 2~4문장
반드시 JSON만 출력: {"replies":[{"tone":"정중","ko":"...","en":"..."},{"tone":"친근","ko":"...","en":"..."},{"tone":"간결","ko":"...","en":"..."}],"note":"사장님이 알아둘 점 1문장(없으면 빈 문자열)"}`,
    messages: [{
      role: 'user',
      content: `업종: ${bizType}\n가게 이름: ${bizName || '(미입력 — 이름을 쓰지 말 것)'}\n별점: ${stars}\n언어: ${langRule}\n리뷰:\n"""${review}"""`,
    }],
  });
  const out = jsonOf(resp);
  return { replies: (out.replies || []).slice(0, 3), note: clip(out.note, 300) };
}

/* ---------- 3. NAP 일관성 체크 ---------- */
const UA = 'BizHigherResearchBot/1.0 (+https://bizhigher.com/data/)';

function digits(s) {
  const d = String(s || '').replace(/\D/g, '');
  return d.length === 11 && d[0] === '1' ? d.slice(1) : d;
}

async function siteSignals(url) {
  let u;
  try {
    u = new URL(/^https?:\/\//i.test(url) ? url : 'https://' + url);
  } catch {
    return { checked: false, error: '웹사이트 주소 형식이 올바르지 않습니다.' };
  }
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(u.toString(), { headers: { 'User-Agent': UA, Accept: 'text/html' }, redirect: 'follow', signal: ctrl.signal });
    if (!res.ok) return { checked: true, reachable: false, status: res.status, url: u.toString() };
    const html = (await res.text()).slice(0, 600 * 1024);
    const text = html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');
    const phones = new Set();
    (html.match(/href=["']tel:([^"']+)/gi) || []).forEach((m) => phones.add(digits(m.replace(/^href=["']tel:/i, ''))));
    (text.match(/(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g) || []).forEach((m) => phones.add(digits(m)));
    const zips = [...new Set(text.match(/\b(?:[A-Z]{2})\s+(\d{5})(?:-\d{4})?\b/g) || [])].map((m) => m.slice(-5)).slice(0, 5);
    const hasSchema = /"@type"\s*:\s*"(LocalBusiness|Restaurant|Store|MedicalBusiness|Dentist|ProfessionalService|BeautySalon|[A-Za-z]*Store)"/.test(html);
    return {
      checked: true,
      reachable: true,
      url: res.url || u.toString(),
      phones: [...phones].filter((p) => p.length === 10).slice(0, 6),
      zips,
      hasTelLink: /href=["']tel:/i.test(html),
      hasSchema,
      text: text.slice(0, 20000),
    };
  } catch (e) {
    return { checked: true, reachable: false, error: e.name === 'AbortError' ? 'timeout' : 'fetch-failed', url: u.toString() };
  } finally {
    clearTimeout(t);
  }
}

async function napCheck(input, env, charge) {
  const business = clip(input.business, 120);
  const location = clip(input.location, 120);
  if (!business || !location) return { error: '업체명과 도시를 입력해 주세요.' };
  await charge();
  const places = await placesSearch(env, `${business} ${location}`, ['id', 'displayName', 'formattedAddress', 'nationalPhoneNumber', 'websiteUri', 'regularOpeningHours'], 3);
  const google = places.map((p) => ({
    id: p.id,
    name: (p.displayName && p.displayName.text) || '',
    address: p.formattedAddress || '',
    phone: p.nationalPhoneNumber || '',
    website: p.websiteUri || '',
    hours: (p.regularOpeningHours && p.regularOpeningHours.weekdayDescriptions) || [],
  }));
  const siteUrl = clip(input.website, 300) || (google[0] && google[0].website) || '';
  let site = null;
  if (siteUrl) {
    site = await siteSignals(siteUrl);
    if (site.text) {
      // 업체명·우편번호가 사이트 본문에 있는지만 판단하고 본문 자체는 돌려주지 않는다
      const low = site.text.toLowerCase();
      site.nameFound = google[0] ? low.includes(google[0].name.toLowerCase().slice(0, 30)) : null;
      delete site.text;
    }
  }
  return { google, site };
}

/* ---------- 4. AI 추천 체크 ---------- */
function norm(s) {
  return String(s || '').toLowerCase().replace(/[^0-9a-z가-힣]/g, '');
}

async function aiCheck(input, env, charge) {
  const business = clip(input.business, 100);
  const city = clip(input.city, 80);
  const category = clip(input.category, 60);
  if (!business || !city || !category) return { error: '업체명·도시·업종을 모두 입력해 주세요.' };
  const lang = input.lang === 'en' ? 'en' : 'ko';
  const question = lang === 'en'
    ? `Can you recommend a good ${category} in ${city}? Give me your top picks.`
    : `${city}에서 괜찮은 ${category} 추천해 줘. 몇 군데 골라서 이유도 같이 알려줘.`;
  const body = {
    max_tokens: 1500,
    system: 'You are a helpful local search assistant. Use web search to find current, real businesses and recommend up to 5 with one-line reasons. Answer in the same language as the question. Do not invent businesses.',
    tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3, user_location: { type: 'approximate', country: 'US' } }],
    messages: [{ role: 'user', content: question }],
  };
  await charge();
  let resp = await claude(env, body);
  // 서버 도구가 길어지면 pause_turn으로 멈출 수 있다 — 한 번만 이어서 받는다
  if (resp.stop_reason === 'pause_turn') {
    resp = await claude(env, { ...body, messages: [...body.messages, { role: 'assistant', content: resp.content }] });
  }
  const answer = textOf(resp);
  const sources = [];
  (resp.content || []).forEach((b) => {
    if (b.type === 'web_search_tool_result' && Array.isArray(b.content)) {
      b.content.forEach((r) => { if (r.url && sources.length < 8) sources.push({ title: r.title || r.url, url: r.url }); });
    }
  });
  const key = norm(business);
  const mentioned = key.length >= 2 && norm(answer).includes(key);
  return { question, answer: answer.slice(0, 4000), mentioned, sources };
}

/* ---------- 5. 구글 프로필 게시물 ---------- */
async function gbpPost(input, env, charge) {
  const news = clip(input.news, 800);
  if (news.length < 3) return { error: '이번 주 소식을 한 줄 이상 적어 주세요.' };
  const lang = ['ko', 'en', 'both'].includes(input.lang) ? input.lang : 'both';
  await charge();
  const resp = await claude(env, {
    max_tokens: 1800,
    system: `너는 미국 한인 소상공인의 구글 비즈니스 프로필 '게시물'을 쓰는 담당자다.
${POLICY}
- 구글 게시물 정책: 전화번호를 본문에 넣지 않는다(버튼 사용), 과도한 대문자·이모지 남발 금지, 본문은 1,500자 이내지만 실제로는 300자 안팎이 읽힌다
- 첫 100자 안에 핵심(무엇이, 언제, 누구에게)을 넣는다
- 이미지에 넣을 큰 문구(imageText)는 한국어 12자·영어 25자 이내
- cta는 구글 버튼 중 하나: "예약", "주문", "자세히 알아보기", "전화", "가입"
언어: ${lang === 'ko' ? '한국어만(en은 빈 문자열)' : lang === 'en' ? '영어만(ko는 빈 문자열)' : '한국어와 영어 둘 다'}
반드시 JSON만 출력: {"posts":[{"type":"소식","imageText":"...","ko":"...","en":"...","cta":"..."},{"type":"이벤트 또는 혜택","imageText":"...","ko":"...","en":"...","cta":"..."}],"tip":"사진 고르는 팁 1문장"}`,
    messages: [{
      role: 'user',
      content: `업종: ${clip(input.bizType, 60) || '가게'}\n가게 이름: ${clip(input.bizName, 80) || '(미입력 — 이름을 쓰지 말 것)'}\n이번 소식: ${news}\n혜택/기간(있으면): ${clip(input.offer, 300) || '없음'}`,
    }],
  });
  const out = jsonOf(resp);
  return { posts: (out.posts || []).slice(0, 2), tip: clip(out.tip, 300) };
}

/* ---------- 6. 메뉴판 → 웹 메뉴 ---------- */
async function menuToWeb(input, env, charge) {
  const text = clip(input.text, 8000);
  const img = typeof input.image === 'string' ? input.image : '';
  const mt = ['image/jpeg', 'image/png', 'image/webp'].includes(input.mediaType) ? input.mediaType : 'image/jpeg';
  if (!img && text.length < 5) return { error: '메뉴판 사진을 올리거나 메뉴를 붙여 넣어 주세요.' };
  if (img && img.length > 5 * 1024 * 1024) return { error: '사진이 너무 큽니다. 더 작은 사진으로 다시 시도해 주세요.' };
  const content = [];
  if (img) content.push({ type: 'image', source: { type: 'base64', media_type: mt, data: img } });
  content.push({
    type: 'text',
    text: `${text ? `메뉴 텍스트:\n"""${text}"""\n\n` : ''}위 메뉴판을 웹페이지용 구조로 옮겨라.
- 보이는 그대로 옮기고, 읽을 수 없는 가격·글자는 추측하지 말고 빈 문자열로 둔다
- 한국어 메뉴명이 있으면 name에, 영어 이름이 있거나 자연스러운 영어 이름을 붙일 수 있으면 nameEn에(직역보다 미국 손님이 알아듣는 표기, 예: 순두부찌개 → Soft Tofu Stew)
- price는 "$12.99" 형식 문자열
반드시 JSON만 출력: {"sections":[{"name":"섹션명","items":[{"name":"","nameEn":"","price":"","desc":""}]}],"unreadable":0}`,
  });
  await charge();
  const resp = await claude(env, { max_tokens: 6000, messages: [{ role: 'user', content }] });
  const out = jsonOf(resp);
  const sections = (out.sections || []).slice(0, 30).map((s) => ({
    name: clip(s.name, 80),
    items: (s.items || []).slice(0, 80).map((i) => ({ name: clip(i.name, 120), nameEn: clip(i.nameEn, 120), price: clip(i.price, 30), desc: clip(i.desc, 300) })),
  }));
  return { sections, unreadable: Number(out.unreadable) || 0 };
}

/* ---------- 7. 이중 언어 가게 소개문 ---------- */
async function bilingualIntro(input, env, charge) {
  const intro = clip(input.intro, 2000);
  if (intro.length < 10) return { error: '가게 소개를 두세 문장 이상 적어 주세요.' };
  await charge();
  const resp = await claude(env, {
    max_tokens: 2000,
    system: `너는 미국 한인 소상공인의 구글 비즈니스 프로필 '비즈니스 설명'을 한국어·영어로 다듬는 담당자다.
${POLICY}
- 구글 설명 정책: 750자 이내, URL·전화번호·가격·할인·프로모션 문구 금지, 다른 업체 비교 금지
- 영어(en)는 한국어를 직역하지 말고 현지 손님이 읽기 자연스럽게. 첫 250자 안에 업종·지역·대표 강점을 넣는다(검색 미리보기에 보이는 부분)
- 한국어(ko)는 한인 손님용으로 다듬은 버전
- keywords: 손님이 실제 검색할 법한 영어 표현 5개
반드시 JSON만 출력: {"en":"...","ko":"...","keywords":["..."]}`,
    messages: [{
      role: 'user',
      content: `업종: ${clip(input.bizType, 60)}\n가게 이름: ${clip(input.bizName, 80)}\n지역: ${clip(input.city, 80)}\n사장님이 쓴 소개:\n"""${intro}"""`,
    }],
  });
  const out = jsonOf(resp);
  return { en: clip(out.en, 750), ko: clip(out.ko, 750), keywords: (out.keywords || []).slice(0, 6).map((k) => clip(k, 60)) };
}

/* ---------- 8. 광고 예산 계산기 — 계산은 브라우저, 여기선 리드·횟수만 ---------- */
async function adsBudget(input, env, charge) {
  await charge();
  return {};
}

/* ---------- 9. 로컬 순위 체크 (지도 순위 그리드) ----------
 * 1단계 find: 가게 찾기(이름·주소·좌표 — Text Search Pro 1회, 별도 한도 'local-rank-find')
 * 2단계 run : 가게 주변 7×7 지점마다 "키워드"를 검색해 우리 가게 순위를 센다.
 *   지점 검색은 places.id만 요청 → Text Search Essentials(IDs Only) SKU, 구글 기준 무료·무제한.
 *   중심점 1곳만 Pro로 상위 3곳 이름을 가져온다.
 * 주의: Places API 순위는 실제 구글 지도 앱 순위의 근사치다(개인화·광고 제외). 화면에 명시한다.
 */
const GRID = 7;

async function localRank(input, env, charge) {
  if (input.step === 'find') {
    const query = clip(input.query, 200);
    if (query.length < 2) return { error: '업체명과 도시를 입력해 주세요.' };
    await charge('local-rank-find');
    const places = await placesSearch(env, query, ['id', 'displayName', 'formattedAddress', 'location'], 5);
    return {
      candidates: places.filter((p) => p.location).map((p) => ({
        id: p.id, name: (p.displayName && p.displayName.text) || '', address: p.formattedAddress || '',
        lat: p.location.latitude, lng: p.location.longitude,
      })),
    };
  }
  const placeId = clip(input.placeId, 200);
  const keyword = clip(input.keyword, 80);
  const lat = Number(input.lat), lng = Number(input.lng);
  const radiusMi = [0.5, 1, 2, 3, 5].includes(Number(input.radius)) ? Number(input.radius) : 2;
  if (!placeId || !keyword || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return { error: '가게를 먼저 고르고 검색 키워드를 입력해 주세요.' };
  }
  await charge();
  const half = (GRID - 1) / 2;
  const step = radiusMi / half; // 지점 간격(마일)
  const dLat = step / 69.0;
  const dLng = step / (69.0 * Math.cos((lat * Math.PI) / 180));
  const biasM = Math.max(400, Math.round(step * 1609.34 * 0.7));
  const points = [];
  for (let r = 0; r < GRID; r++) {
    for (let c = 0; c < GRID; c++) {
      points.push({ r, c, lat: lat + (half - r) * dLat, lng: lng + (c - half) * dLng });
    }
  }
  const rankAt = async (pt) => {
    try {
      const res = await placesSearch(env, keyword, ['id'], 20, {
        locationBias: { circle: { center: { latitude: pt.lat, longitude: pt.lng }, radius: biasM } },
        rankPreference: 'RELEVANCE',
      });
      const i = res.findIndex((p) => p.id === placeId);
      return i >= 0 ? i + 1 : 0; // 0 = 20위 밖
    } catch {
      return -1; // 조회 실패
    }
  };
  const ranks = new Array(points.length);
  for (let i = 0; i < points.length; i += 10) {
    const chunk = points.slice(i, i + 10);
    const out = await Promise.all(chunk.map(rankAt));
    out.forEach((v, k) => { ranks[i + k] = v; });
  }
  // 중심점 상위 3곳 이름 (Pro 1회)
  let leaders = [];
  try {
    const top = await placesSearch(env, keyword, ['id', 'displayName'], 3, {
      locationBias: { circle: { center: { latitude: lat, longitude: lng }, radius: biasM } },
    });
    leaders = top.map((p) => ({ name: (p.displayName && p.displayName.text) || '', isYou: p.id === placeId }));
  } catch { /* 없어도 그리드는 보여준다 */ }
  const grid = [];
  for (let r = 0; r < GRID; r++) grid.push(ranks.slice(r * GRID, r * GRID + GRID));
  const found = ranks.filter((v) => v > 0);
  return {
    grid,
    radiusMi,
    keyword,
    avg: found.length ? Math.round((found.reduce((a, b) => a + b, 0) / found.length) * 10) / 10 : null,
    top3: ranks.filter((v) => v > 0 && v <= 3).length,
    outside: ranks.filter((v) => v === 0).length,
    total: ranks.length,
    leaders,
  };
}
