#!/usr/bin/env node
/**
 * 경쟁사 갭 분석용 Places 조회 (루틴 세션용, 의존성 없음). 환경변수 GOOGLE_PLACES_API_KEY.
 * 진단용 실시간 조회만 — 결과를 저장·재게시하지 않는다 (CLAUDE.md §14).
 *
 *   node automation/ai-runner/places.js lookup --query "New Optix Garden Grove CA" [--pick 1]
 *   → 우리 가게 후보(최대 5곳) 중 1곳(기본 첫 번째)의 공개 정보 전부: 상호·주소·전화·웹사이트·카테고리·영업시간·평점·리뷰 수·최근 리뷰 날짜·place_id·지도 링크·사진 수·소개문 → 마크다운 + JSON
 *   node automation/ai-runner/places.js competitors --query "optical store Garden Grove CA" [--me ChIJ…place_id] [--n 3]
 *   → 우리 가게(있으면) + 상위 n곳: 이름·평점·리뷰 수·카테고리·웹사이트·영업시간 유무·최근 리뷰 5건 날짜 → 마크다운 표 + JSON
 *
 * 2026-11-04 추가 (구글 프로필 월간 관리 gbp-care · 월간 리포트 mr-6)
 *   node automation/ai-runner/places.js grid --me place_id --keyword "optometrist" [--keyword "안경점"] [--radius 2] [--prev prev.json]
 *   → 가게 주변 7×7 지점마다 키워드 검색 순위(무료 도구 local-rank 와 같은 계산, 지점 검색은 IDs Only = 구글 기준 무료).
 *     키워드당 평균 순위·3위 안 지점 수·20위 밖 지점 수 + 그리드 표. --prev(지난달 이 명령의 JSON)가 있으면 전월 대비.
 *     근사치다(실제 앱은 개인화·광고로 다름) — 리포트에 그렇게 적는다. 결과 숫자는 우리가 잰 측정값이라 리포트에 남겨도 된다
 *   node automation/ai-runner/places.js watch --me place_id --expect expect.json
 *   → 구글에 지금 보이는 프로필이 고객이 준 정보(expect: {name,phone,website,address,category,hours[]})와 같은지. 다르면 종료 2
 *     (구글 자동 수정·남의 수정 제안이 프로필을 바꾸는 일이 흔하다)
 *   node automation/ai-runner/places.js spam --query "dentist Garden Grove CA" [--me place_id] [--city "Garden Grove"]
 *   → 검색 상위 20곳 중 스팸 의심 후보: 상호에 업종·도시 키워드를 덧붙임 · 같은 주소에 같은 업종 여러 개 · 같은 이름 여러 개 · 영업 중단.
 *     의심일 뿐 — David 가 지도에서 확인한 뒤 '수정 제안' 또는 Business Redressal Complaint Form 으로 신고한다
 */
const args = process.argv.slice(2);
const cmd = args[0];
const opt = (k, d) => { const i = args.indexOf('--' + k); return i > -1 && args[i + 1] != null && !args[i + 1].startsWith('--') ? args[i + 1] : d; };
const KEY = process.env.GOOGLE_PLACES_API_KEY;
const FIELDS = 'id,displayName,rating,userRatingCount,primaryType,types,websiteUri,regularOpeningHours,nationalPhoneNumber,formattedAddress,reviews';
const FULL = FIELDS + ',primaryTypeDisplayName,googleMapsUri,businessStatus,editorialSummary,photos,priceLevel,internationalPhoneNumber,addressComponents,utcOffsetMinutes';

async function details(id, fields = FIELDS) {
  const r = await fetch(`https://places.googleapis.com/v1/places/${id}?languageCode=en`, { headers: { 'X-Goog-Api-Key': KEY, 'X-Goog-FieldMask': fields } });
  if (!r.ok) throw new Error('details ' + r.status + ' ' + (await r.text()).slice(0, 200));
  return r.json();
}
function row(p) {
  const reviews = (p.reviews || []).map((x) => (x.publishTime || '').slice(0, 10)).filter(Boolean).sort().reverse();
  return { id: p.id, name: p.displayName && p.displayName.text, rating: p.rating, reviewCount: p.userRatingCount, primaryType: p.primaryType, types: (p.types || []).slice(0, 6), website: p.websiteUri || '', hours: !!p.regularOpeningHours, phone: p.nationalPhoneNumber || '', address: p.formattedAddress || '', latestReviews: reviews.slice(0, 5) };
}

(async () => {
  if (!KEY) throw new Error('GOOGLE_PLACES_API_KEY 가 없습니다 (bizhigher 환경변수)');
  if (cmd === 'lookup') {
    const q = opt('query'); if (!q) throw new Error('--query 필요');
    const r = await fetch('https://places.googleapis.com/v1/places:searchText', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': KEY, 'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress' }, body: JSON.stringify({ textQuery: q, languageCode: 'en', maxResultCount: 5 }) });
    if (!r.ok) throw new Error('searchText ' + r.status + ' ' + (await r.text()).slice(0, 200));
    const found = (await r.json()).places || [];
    if (!found.length) { console.log('[Places에서 찾지 못함] ' + q + '\n' + JSON.stringify({ candidates: [] })); return; }
    const pick = Math.max(1, Number(opt('pick', 1))) - 1;
    const p = await details(found[Math.min(pick, found.length - 1)].id, FULL);
    const reviews = (p.reviews || []).map((x) => (x.publishTime || '').slice(0, 10)).filter(Boolean).sort().reverse();
    const out = {
      place_id: p.id, name: p.displayName && p.displayName.text, address: p.formattedAddress || '', phone: p.nationalPhoneNumber || '', intlPhone: p.internationalPhoneNumber || '',
      website: p.websiteUri || '', maps: p.googleMapsUri || '', status: p.businessStatus || '', category: (p.primaryTypeDisplayName && p.primaryTypeDisplayName.text) || p.primaryType || '',
      types: (p.types || []).filter((t) => !/establishment|point_of_interest/.test(t)), rating: p.rating ?? null, reviewCount: p.userRatingCount ?? 0, latestReviews: reviews.slice(0, 5),
      hours: (p.regularOpeningHours && p.regularOpeningHours.weekdayDescriptions) || [], photoCount: (p.photos || []).length, summary: (p.editorialSummary && p.editorialSummary.text) || '', priceLevel: p.priceLevel || '',
      candidates: found.map((f) => ({ place_id: f.id, name: f.displayName && f.displayName.text, address: f.formattedAddress || '' })),
    };
    const md = ['| 항목 | 값 (Places 공개 정보, ' + new Date().toISOString().slice(0, 10) + ') |', '|---|---|',
      '| 상호 | ' + (out.name || '-') + ' |', '| 주소 | ' + (out.address || '-') + ' |', '| 전화 | ' + (out.phone || '-') + ' |', '| 웹사이트 | ' + (out.website || '없음') + ' |',
      '| 기본 카테고리 | ' + (out.category || '-') + ' |', '| 추가 카테고리 | ' + (out.types.join(', ') || '-') + ' |', '| 영업시간 | ' + (out.hours.join(' / ') || '등록 안 됨') + ' |',
      '| 평점 / 리뷰 수 | ' + (out.rating ?? '-') + ' / ' + out.reviewCount + ' |', '| 최근 리뷰 5건 날짜 | ' + (out.latestReviews.join(', ') || '-') + ' |', '| 사진 수(API 기준) | ' + out.photoCount + ' |',
      '| 소개문 | ' + (out.summary || '없음') + ' |', '| 영업 상태 | ' + (out.status || '-') + ' |', '| place_id | ' + out.place_id + ' |', '| 지도 링크 | ' + (out.maps || '-') + ' |'].join('\n');
    const cand = found.length > 1 ? '\n\n후보 ' + found.length + '곳 (다른 곳이면 --pick N): ' + out.candidates.map((c, i) => (i + 1) + '. ' + c.name + ' — ' + c.address).join(' · ') : '';
    console.log(md + cand + '\n\n' + JSON.stringify(out));
    return;
  }
  if (cmd === 'grid') return grid();
  if (cmd === 'watch') return watch();
  if (cmd === 'spam') return spam();
  if (cmd !== 'competitors') { console.log('사용법: lookup --query "상호 도시 주" [--pick N] | competitors --query "…" [--me place_id] [--n 3] | grid --me id --keyword k [--keyword k2] [--radius 2] [--prev f] | watch --me id --expect f | spam --query "…" [--me id] [--city c]'); return; }
  const q = opt('query'); if (!q) throw new Error('--query 필요');
  const n = Number(opt('n', 3));
  const r = await fetch('https://places.googleapis.com/v1/places:searchText', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': KEY, 'X-Goog-FieldMask': 'places.id,places.displayName,places.rating,places.userRatingCount,places.primaryType' }, body: JSON.stringify({ textQuery: q, languageCode: 'en', maxResultCount: 10 }) });
  if (!r.ok) throw new Error('searchText ' + r.status + ' ' + (await r.text()).slice(0, 200));
  const found = (await r.json()).places || [];
  const me = opt('me');
  // 대형 일반 소매(마트·쇼핑몰 등)는 검색어와 상관없이 상위에 끼어든다(2026-11-03 데모: 안경점 경쟁사 3곳 중 1곳이 한인 마트). 우리 가게가 그 업종이 아니면 뺀다. --keep-all 로 끔
  const BIG = new Set(['asian_grocery_store', 'grocery_store', 'supermarket', 'hypermarket', 'shopping_mall', 'department_store', 'convenience_store', 'discount_store', 'warehouse_store', 'market', 'food_store', 'gas_station']);
  const meRow = me ? row(await details(me)) : null;
  const keepAll = args.includes('--keep-all') || (meRow && BIG.has(meRow.primaryType));
  const skipped = keepAll ? [] : found.filter((p) => p.id !== me && BIG.has(p.primaryType)).map((p) => p.displayName && p.displayName.text);
  const comps = found.filter((p) => p.id !== me && (keepAll || !BIG.has(p.primaryType))).slice(0, n);
  if (skipped.length) console.error('[대형 소매 제외] ' + skipped.join(', '));
  const out = { me: meRow, competitors: [] };
  for (const c of comps) out.competitors.push(row(await details(c.id)));
  const all = [out.me, ...out.competitors].filter(Boolean);
  const md = ['| 항목 | ' + all.map((p) => p.name + (p === out.me ? ' (우리)' : '')).join(' | ') + ' |', '|---|' + all.map(() => '---').join('|') + '|',
    '| 기본 카테고리 | ' + all.map((p) => p.primaryType || '-').join(' | ') + ' |',
    '| 평점 / 리뷰 수 | ' + all.map((p) => `${p.rating ?? '-'} / ${p.reviewCount ?? '-'}`).join(' | ') + ' |',
    '| 최근 리뷰 5건 날짜 | ' + all.map((p) => p.latestReviews.join(', ') || '-').join(' | ') + ' |',
    '| 웹사이트 | ' + all.map((p) => (p.website ? '있음' : '없음')).join(' | ') + ' |',
    '| 영업시간 등록 | ' + all.map((p) => (p.hours ? '있음' : '없음')).join(' | ') + ' |',
    '| 추가 카테고리 | ' + all.map((p) => p.types.filter((t) => t !== p.primaryType && !/establishment|point_of_interest|store|health/.test(t)).join(', ') || '-').join(' | ') + ' |'].join('\n');
  console.log(md + '\n\n' + JSON.stringify(out));
})().catch((e) => { console.error('오류:', e.message); process.exit(1); });

function optAll(k) { const out = []; args.forEach((a, i) => { if (a === '--' + k && args[i + 1] && !args[i + 1].startsWith('--')) out.push(args[i + 1]); }); return out; }
async function searchText(body, mask) {
  const r = await fetch('https://places.googleapis.com/v1/places:searchText', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': KEY, 'X-Goog-FieldMask': mask }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error('searchText ' + r.status + ' ' + (await r.text()).slice(0, 200));
  return (await r.json()).places || [];
}

/* 지도 순위 그리드 — functions/api/tools/[tool].js localRank 와 같은 계산(7×7, 지점 검색 IDs Only) */
async function grid() {
  const me = opt('me'); const kws = optAll('keyword');
  if (!me || !kws.length) throw new Error('--me place_id 와 --keyword 가 필요합니다(여러 개면 --keyword 를 반복)');
  const radiusMi = [0.5, 1, 2, 3, 5].includes(Number(opt('radius', 2))) ? Number(opt('radius', 2)) : 2;
  const p = await details(me, 'id,displayName,location');
  if (!p.location) throw new Error('가게 좌표를 못 찾았습니다');
  const lat = p.location.latitude, lng = p.location.longitude;
  const G = 7, half = 3, step = radiusMi / half;
  const dLat = step / 69.0, dLng = step / (69.0 * Math.cos((lat * Math.PI) / 180));
  const biasM = Math.max(400, Math.round(step * 1609.34 * 0.7));
  const prev = opt('prev') ? JSON.parse(require('fs').readFileSync(opt('prev'), 'utf8')) : null;
  const out = { place_id: me, name: p.displayName && p.displayName.text, date: new Date().toISOString().slice(0, 10), radiusMi, keywords: [] };
  for (const kw of kws) {
    const pts = []; for (let r = 0; r < G; r++) for (let c = 0; c < G; c++) pts.push({ lat: lat + (half - r) * dLat, lng: lng + (c - half) * dLng });
    const ranks = [];
    for (let i = 0; i < pts.length; i += 10) {
      ranks.push(...await Promise.all(pts.slice(i, i + 10).map(async (pt) => {
        try {
          const res = await searchText({ textQuery: kw, languageCode: 'en', maxResultCount: 20, rankPreference: 'RELEVANCE', locationBias: { circle: { center: { latitude: pt.lat, longitude: pt.lng }, radius: biasM } } }, 'places.id');
          const i = res.findIndex((x) => x.id === me); return i >= 0 ? i + 1 : 0;
        } catch { return -1; }
      })));
    }
    let leaders = [];
    try { leaders = (await searchText({ textQuery: kw, languageCode: 'en', maxResultCount: 3, locationBias: { circle: { center: { latitude: lat, longitude: lng }, radius: biasM } } }, 'places.id,places.displayName')).map((x) => (x.displayName && x.displayName.text) + (x.id === me ? ' (우리)' : '')); } catch { /* 없어도 된다 */ }
    const found = ranks.filter((v) => v > 0);
    out.keywords.push({ keyword: kw, grid: Array.from({ length: G }, (_, r) => ranks.slice(r * G, r * G + G)), avg: found.length ? Math.round((found.reduce((a, b) => a + b, 0) / found.length) * 10) / 10 : null, top3: ranks.filter((v) => v > 0 && v <= 3).length, outside: ranks.filter((v) => v === 0).length, total: ranks.length, leaders });
  }
  const cell = (v) => (v < 0 ? '·' : v === 0 ? '20+' : v <= 3 ? `**${v}**` : String(v));
  const diff = (k, key, better) => { const pk = prev && (prev.keywords || []).find((x) => x.keyword === k.keyword); if (!pk || pk[key] == null || k[key] == null) return ''; const d = Math.round((k[key] - pk[key]) * 10) / 10; if (!d) return ' (전월과 같음)'; return ` (전월 ${pk[key]} → ${(better(d) ? '▲ 좋아짐 ' : '▼ ')}${d > 0 ? '+' : ''}${d})`; };
  const md = [`# 지도 순위 그리드 — ${out.name} (${out.date}, 반경 ${radiusMi}마일, 7×7=49지점)`, '',
    '> Google Places 검색 결과로 계산한 근사치입니다. 실제 지도 앱은 검색하는 사람·광고에 따라 다를 수 있습니다. 가운데 칸이 가게 위치, 위쪽이 북쪽.', ''];
  for (const k of out.keywords) {
    md.push(`## "${k.keyword}"`, '', `- 평균 순위(찾힌 지점): **${k.avg ?? '—'}**${diff(k, 'avg', (d) => d < 0)}`, `- 3위 안 지점: **${k.top3}/${k.total}**${diff(k, 'top3', (d) => d > 0)}`, `- 20위 밖 지점: ${k.outside}/${k.total}${diff(k, 'outside', (d) => d < 0)}`, k.leaders.length ? `- 가게 위치에서 상위 3곳: ${k.leaders.join(' · ')}` : '', '',
      '| | ' + Array.from({ length: G }, (_, i) => i + 1).join(' | ') + ' |', '|---|' + Array(G).fill('---').join('|') + '|',
      ...k.grid.map((row, r) => `| ${r + 1} | ` + row.map(cell).join(' | ') + ' |'), '');
  }
  console.log(md.filter((x, i, a) => !(x === '' && a[i - 1] === '')).join('\n') + '\n\n' + JSON.stringify(out));
}

/* 프로필 변경 감시 — 고객이 준 정보와 구글에 지금 보이는 정보 비교 */
async function watch() {
  const me = opt('me'); const f = opt('expect');
  if (!me || !f) throw new Error('--me place_id 와 --expect expect.json 이 필요합니다');
  const ex = JSON.parse(require('fs').readFileSync(f, 'utf8'));
  const p = await details(me, 'id,displayName,nationalPhoneNumber,websiteUri,formattedAddress,primaryTypeDisplayName,primaryType,regularOpeningHours,businessStatus');
  const digits = (s) => String(s || '').replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '');
  const host = (s) => String(s || '').toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '');
  const words = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9가-힣 ]/g, ' ').replace(/\b(suite|ste|unit|street|st|avenue|ave|boulevard|blvd|road|rd|drive|dr|usa|united states)\b/g, ' ').replace(/\s+/g, ' ').trim();
  const now = { name: p.displayName && p.displayName.text, phone: p.nationalPhoneNumber || '', website: p.websiteUri || '', address: p.formattedAddress || '', category: (p.primaryTypeDisplayName && p.primaryTypeDisplayName.text) || p.primaryType || '', hours: (p.regularOpeningHours && p.regularOpeningHours.weekdayDescriptions) || [], status: p.businessStatus || '' };
  const rows = [];
  const cmp = (label, a, b, same) => { if (a == null || a === '' || (Array.isArray(a) && !a.length)) return; const ok = same(a, b); rows.push({ label, ok, expect: Array.isArray(a) ? a.join(' / ') : a, now: Array.isArray(b) ? b.join(' / ') : (b || '(없음)') }); };
  cmp('상호', ex.name, now.name, (a, b) => words(a) === words(b));
  cmp('전화', ex.phone, now.phone, (a, b) => digits(a) === digits(b));
  cmp('웹사이트', ex.website, now.website, (a, b) => host(a) === host(b));
  cmp('주소', ex.address, now.address, (a, b) => { const A = words(a).split(' ').slice(0, 4).join(' '); return words(b).startsWith(A) || words(b).includes(A); });
  cmp('기본 카테고리', ex.category, now.category, (a, b) => words(a) === words(b));
  cmp('영업시간', ex.hours, now.hours, (a, b) => words((a || []).join(' ')) === words((b || []).join(' ')));
  if (now.status && now.status !== 'OPERATIONAL') rows.push({ label: '영업 상태', ok: false, expect: 'OPERATIONAL', now: now.status });
  const bad = rows.filter((r) => !r.ok);
  const md = [`# 프로필 변경 감시 — ${now.name} (${new Date().toISOString().slice(0, 10)})`, '', bad.length ? `**⚠ 변경 감지 ${bad.length}건** — GBP 에서 확인하고 되돌리거나 고객에게 확인` : '✓ 고객이 준 정보와 같음', '',
    '| 항목 | 고객 정보 | 지금 구글 | |', '|---|---|---|---|', ...rows.map((r) => `| ${r.label} | ${r.expect} | ${r.now} | ${r.ok ? '✓' : '⚠'} |`)].join('\n');
  console.log(md + '\n\n' + JSON.stringify({ place_id: me, changed: bad.map((r) => r.label) }));
  if (bad.length) process.exitCode = 2;
}

/* 경쟁사 스팸 의심 후보 — 규칙 기반, David 가 지도에서 확인 후 신고 */
async function spam() {
  const q = opt('query'); if (!q) throw new Error('--query 필요');
  const me = opt('me');
  const city = (opt('city') || (q.match(/ in ([A-Za-z .]+?)(,| [A-Z]{2}$|$)/) || q.match(/([A-Z][a-z]+(?: [A-Z][a-z]+)*),? [A-Z]{2}$/) || [])[1] || '').trim().toLowerCase();
  const found = await searchText({ textQuery: q, languageCode: 'en', maxResultCount: 20 }, 'places.id,places.displayName,places.formattedAddress,places.primaryType,places.primaryTypeDisplayName,places.businessStatus,places.googleMapsUri');
  const cat = (q.replace(new RegExp(city, 'i'), '').replace(/\b[A-Z]{2}\b/, '').replace(/[,]/g, ' ').trim().toLowerCase().split(/\s+/)).filter((w) => w.length > 2 && !/^(near|best|the|and|for)$/.test(w));
  // 같은 뜻의 한/영 단어는 한 개념으로 센다 — "Olympic Acupuncture 올림픽 한의원" 같은 이중 언어 상호는 정상(한인 업소에 흔함). clinic·center 같은 일반어는 세지 않는다
  const CONCEPTS = {
    dental: ['dentist', 'dental', '치과'], implant: ['implant', '임플란트'], ortho: ['orthodont', 'invisalign', 'braces', '교정'], cosmetic: ['cosmetic', 'whitening', 'botox', 'filler', 'laser', '미용치과', '성형'],
    eye: ['optomet', 'optical', 'optician', 'eyewear', 'eyeglass', 'eye exam', 'contact lens', '안경', '렌즈', '안과'], acu: ['acupunct', 'herb', 'oriental medicine', '한의원', '한방', '침뜸'], chiro: ['chiropract', '카이로'],
    hair: ['hair', '헤어', '미용실'], nail: ['nail', 'manicure', 'pedicure', '네일'], spa: ['spa', 'massage', '마사지'], lash: ['lash', 'brow', '속눈썹'], food: ['restaurant', 'bbq', 'grill', 'soul food', '식당', '맛집'], cafe: ['cafe', 'coffee', 'bakery', '카페', '베이커리'],
    edu: ['tutor', 'academy', 'learning center', 'sat prep', '학원', '과외'], realty: ['realtor', 'real estate', 'realty', '부동산'], loan: ['loan', 'mortgage', 'lender', '융자'], ins: ['insurance', '보험'], law: ['lawyer', 'attorney', 'law firm', '변호사'],
    home: ['plumb', 'locksmith', 'roofing', 'hvac'], promo: ['% off', 'discount', 'free ', 'new customer', 'best ', '#1', 'cheap', '할인'],
  };
  for (const w of cat) if (!/^(salon|clinic|center|service|services|shop|store|korean)$/.test(w) && !Object.values(CONCEPTS).some((ws) => ws.some((x) => x.includes(w) || w.includes(x)))) CONCEPTS['q:' + w] = [w];
  const concepts = (t) => { const x = String(t || '').toLowerCase(); return Object.keys(CONCEPTS).filter((k) => CONCEPTS[k].some((w) => x.includes(w))); };
  const norm = (s) => String(s || '').toLowerCase();
  const addrKey = (s) => norm(s).replace(/\b(suite|ste|unit)\b\.?/g, '#').replace(/[^a-z0-9#]/g, ''); // 호수까지 같아야 같은 주소(한 건물 여러 사무실은 정상)
  const sus = [];
  const byAddr = {}, byName = {};
  for (const p of found) { if (p.id === me) continue; const a = addrKey(p.formattedAddress); (byAddr[a + '|' + p.primaryType] = byAddr[a + '|' + p.primaryType] || []).push(p); const n = norm(p.displayName && p.displayName.text).replace(/[^a-z0-9가-힣]/g, ''); (byName[n] = byName[n] || []).push(p); }
  for (const p of found) {
    if (p.id === me) continue;
    const name = (p.displayName && p.displayName.text) || ''; const n = norm(name); const why = [];
    // 도시명 + 업종 1~2개("Garden Grove Optometry", "Ruby Nails & Spa Fullerton")·한/영 병기는 흔한 진짜 상호라 잡지 않는다
    const nCity = city ? n.replace(city, ' ') : n;
    const cs = concepts(nCity);
    if (cs.includes('promo')) why.push('상호에 홍보 문구(할인·best 등) — 상호 규정 위반');
    if (cs.filter((c) => c !== 'promo').length >= 3) why.push(`상호에 서로 다른 업종·서비스어 ${cs.filter((c) => c !== 'promo').length}개(${cs.filter((c) => c !== 'promo').join(', ')})`);
    const parts = name.split(/\s[-|–—:ㅣ]\s?|\s?\|\s?|ㅣ/); const head = parts[0]; const tail = parts.slice(1).join(' ');
    const newInTail = tail ? concepts(tail).filter((c) => c !== 'promo' && !concepts(head).includes(c)) : [];
    if (newInTail.length) why.push(`상호 뒤 구분 기호 다음에 업종·설명어(${newInTail.join(', ')}) — 지점명·한글 상호만 붙인 것은 정상`);
    const paren = (name.match(/[(\[（【][^)\]）】]+[)\]）】]/g) || []).join(' ');
    if (paren && (paren.split(/[,，·/]/).length >= 3 || concepts(paren).length >= 2)) why.push(`괄호 안에 키워드 나열 "${paren.slice(0, 40)}"`);
    const sameAddr = byAddr[addrKey(p.formattedAddress) + '|' + p.primaryType] || [];
    if (sameAddr.length > 1) { const nk = n.replace(/[^a-z0-9가-힣]/g, ''); const dupName = (byName[nk] || []).length > 1; why.push(dupName ? `같은 주소에 같은 이름 ${sameAddr.length}곳(중복 프로필)` : `같은 주소·같은 업종 ${sameAddr.length}곳(같은 호수 — 가상 사무실·중복 의심, 공동 개업일 수 있음)`); }
    if (p.businessStatus && p.businessStatus !== 'OPERATIONAL') why.push('영업 중단 표시(' + p.businessStatus + ')인데 검색에 남음');
    if (why.length) sus.push({ name, address: p.formattedAddress || '', category: (p.primaryTypeDisplayName && p.primaryTypeDisplayName.text) || p.primaryType || '', why, maps: p.googleMapsUri || '' });
  }
  const md = [`# 경쟁사 스팸 의심 후보 — "${q}" 상위 ${found.length}곳 (${new Date().toISOString().slice(0, 10)})`, '',
    sus.length ? `의심 ${sus.length}곳. **규칙으로 고른 후보일 뿐이다** — 실제 간판·웹사이트 상호와 같으면 스팸이 아니다(합법적 상호). 지도에서 확인한 뒤 '수정 제안'(상호) 또는 Business Redressal Complaint Form(https://support.google.com/business/contact/business_redressal_form)으로 신고.` : '✓ 의심 후보 없음', '',
    ...(sus.length ? ['| 상호 | 주소 | 카테고리 | 의심 이유 | 지도 |', '|---|---|---|---|---|', ...sus.map((s) => `| ${s.name} | ${s.address} | ${s.category} | ${s.why.join(' · ')} | ${s.maps} |`)] : [])].join('\n');
  console.log(md + '\n\n' + JSON.stringify({ query: q, suspects: sus }));
}
