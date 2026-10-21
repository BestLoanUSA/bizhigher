#!/usr/bin/env node
/**
 * 경쟁사 갭 분석용 Places 조회 (루틴 세션용, 의존성 없음). 환경변수 GOOGLE_PLACES_API_KEY.
 * 진단용 실시간 조회만 — 결과를 저장·재게시하지 않는다 (CLAUDE.md §14).
 *
 *   node automation/ai-runner/places.js lookup --query "New Optix Garden Grove CA" [--pick 1]
 *   → 우리 가게 후보(최대 5곳) 중 1곳(기본 첫 번째)의 공개 정보 전부: 상호·주소·전화·웹사이트·카테고리·영업시간·평점·리뷰 수·최근 리뷰 날짜·place_id·지도 링크·사진 수·소개문 → 마크다운 + JSON
 *   node automation/ai-runner/places.js competitors --query "optical store Garden Grove CA" [--me ChIJ…place_id] [--n 3]
 *   → 우리 가게(있으면) + 상위 n곳: 이름·평점·리뷰 수·카테고리·웹사이트·영업시간 유무·최근 리뷰 5건 날짜 → 마크다운 표 + JSON
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
  if (cmd !== 'competitors') { console.log('사용법: lookup --query "상호 도시 주" [--pick N] | competitors --query "…" [--me place_id] [--n 3]'); return; }
  const q = opt('query'); if (!q) throw new Error('--query 필요');
  const n = Number(opt('n', 3));
  const r = await fetch('https://places.googleapis.com/v1/places:searchText', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': KEY, 'X-Goog-FieldMask': 'places.id,places.displayName,places.rating,places.userRatingCount' }, body: JSON.stringify({ textQuery: q, languageCode: 'en', maxResultCount: Math.min(10, n + 3) }) });
  if (!r.ok) throw new Error('searchText ' + r.status + ' ' + (await r.text()).slice(0, 200));
  const found = (await r.json()).places || [];
  const me = opt('me');
  const comps = found.filter((p) => p.id !== me).slice(0, n);
  const out = { me: me ? row(await details(me)) : null, competitors: [] };
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
