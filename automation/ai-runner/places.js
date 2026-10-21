#!/usr/bin/env node
/**
 * 경쟁사 갭 분석용 Places 조회 (루틴 세션용, 의존성 없음). 환경변수 GOOGLE_PLACES_API_KEY.
 * 진단용 실시간 조회만 — 결과를 저장·재게시하지 않는다 (CLAUDE.md §14).
 *
 *   node automation/ai-runner/places.js competitors --query "optical store Garden Grove CA" [--me ChIJ…place_id] [--n 3]
 *   → 우리 가게(있으면) + 상위 n곳: 이름·평점·리뷰 수·카테고리·웹사이트·영업시간 유무·최근 리뷰 5건 날짜 → 마크다운 표 + JSON
 */
const args = process.argv.slice(2);
const cmd = args[0];
const opt = (k, d) => { const i = args.indexOf('--' + k); return i > -1 && args[i + 1] != null && !args[i + 1].startsWith('--') ? args[i + 1] : d; };
const KEY = process.env.GOOGLE_PLACES_API_KEY;
const FIELDS = 'id,displayName,rating,userRatingCount,primaryType,types,websiteUri,regularOpeningHours,nationalPhoneNumber,formattedAddress,reviews';

async function details(id) {
  const r = await fetch(`https://places.googleapis.com/v1/places/${id}?languageCode=en`, { headers: { 'X-Goog-Api-Key': KEY, 'X-Goog-FieldMask': FIELDS } });
  if (!r.ok) throw new Error('details ' + r.status + ' ' + (await r.text()).slice(0, 200));
  return r.json();
}
function row(p) {
  const reviews = (p.reviews || []).map((x) => (x.publishTime || '').slice(0, 10)).filter(Boolean).sort().reverse();
  return { id: p.id, name: p.displayName && p.displayName.text, rating: p.rating, reviewCount: p.userRatingCount, primaryType: p.primaryType, types: (p.types || []).slice(0, 6), website: p.websiteUri || '', hours: !!p.regularOpeningHours, phone: p.nationalPhoneNumber || '', address: p.formattedAddress || '', latestReviews: reviews.slice(0, 5) };
}

(async () => {
  if (!KEY) throw new Error('GOOGLE_PLACES_API_KEY 가 없습니다 (bizhigher 환경변수)');
  if (cmd !== 'competitors') { console.log('사용법: competitors --query "…" [--me place_id] [--n 3]'); return; }
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
