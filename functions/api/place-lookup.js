/**
 * 결제 후 질문지 "구글에서 내 가게 찾기" — POST /api/place-lookup {query, email}
 * Places Text Search 로 후보 최대 5곳(상호·주소·전화·웹사이트·카테고리·영업시간·평점·리뷰 수·place_id·지도 링크)을 돌려준다.
 * 고객이 자기 가게를 골라 질문지에 넣는 용도. 서버는 결과를 저장하지 않는다 (CLAUDE.md §14).
 * 한도: IP·이메일 하루 10회(tool_usage 'intake-place').
 */
import { placesSearch, takeQuota, json, clip } from './tools/_shared.js';

const FIELDS = ['id', 'displayName', 'formattedAddress', 'nationalPhoneNumber', 'websiteUri', 'primaryTypeDisplayName', 'primaryType', 'types', 'rating', 'userRatingCount', 'regularOpeningHours', 'googleMapsUri', 'businessStatus'];

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); } catch { return json({ ok: false, error: 'invalid' }, 400); }
  const query = clip(body.query, 120);
  if (query.length < 2) return json({ ok: false, error: 'invalid' }, 400);
  if (!env.GOOGLE_PLACES_API_KEY) return json({ ok: false, error: 'off' }, 503);
  const q = await takeQuota(env, request, 'intake-place', clip(body.email, 200));
  if (!q.ok) return json({ ok: false, error: q.reason === 'user' || q.reason === 'global' ? 'quota' : 'busy' }, 429);
  try {
    const places = await placesSearch(env, query, FIELDS, 5);
    const items = places.map((p) => ({
      place_id: p.id,
      name: p.displayName && p.displayName.text,
      address: p.formattedAddress || '',
      phone: p.nationalPhoneNumber || '',
      website: p.websiteUri || '',
      category: (p.primaryTypeDisplayName && p.primaryTypeDisplayName.text) || p.primaryType || '',
      types: (p.types || []).filter((t) => !/establishment|point_of_interest/.test(t)).slice(0, 6),
      rating: p.rating || null,
      reviews: p.userRatingCount || 0,
      hours: (p.regularOpeningHours && p.regularOpeningHours.weekdayDescriptions) || [],
      maps: p.googleMapsUri || '',
      status: p.businessStatus || '',
    }));
    return json({ ok: true, items });
  } catch (e) {
    return json({ ok: false, error: 'busy' }, 502);
  }
}
