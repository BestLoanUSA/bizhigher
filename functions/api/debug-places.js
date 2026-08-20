/**
 * 내부 진단용 — GET /api/debug-places?t=bh26dbg&q=optometrist+Garden+Grove&lat=33.7746&lng=-117.9415&r=12000&lang=en
 * Places searchText가 실제로 무엇을 반환하는지 확인 (경쟁사 매칭 품질 튜닝용).
 * 외부 노출 방지: 토큰(t) 불일치 시 404.
 */
export async function onRequestGet(context) {
  const { env, request } = context;
  const u = new URL(request.url);
  if (u.searchParams.get('t') !== 'bh26dbg') return new Response('Not found', { status: 404 });
  if (!env.GOOGLE_PLACES_API_KEY) return json({ error: 'no key' });

  const q = u.searchParams.get('q') || 'optometrist Garden Grove';
  const lat = parseFloat(u.searchParams.get('lat') || '33.7746');
  const lng = parseFloat(u.searchParams.get('lng') || '-117.9415');
  const radius = parseInt(u.searchParams.get('r') || '12000', 10);
  const lang = u.searchParams.get('lang') || 'en';

  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': env.GOOGLE_PLACES_API_KEY,
      'X-Goog-FieldMask':
        'places.id,places.displayName,places.rating,places.userRatingCount,places.primaryType,places.location,places.formattedAddress',
    },
    body: JSON.stringify({
      textQuery: q, languageCode: lang, pageSize: 20,
      locationBias: { circle: { center: { latitude: lat, longitude: lng }, radius } },
    }),
  });
  if (!res.ok) return json({ error: 'places ' + res.status });
  const data = await res.json();
  const R = 6371;
  const dist = (la, ln) => {
    const dLat = ((la - lat) * Math.PI) / 180, dLng = ((ln - lng) * Math.PI) / 180;
    const a = Math.sin(dLat/2)**2 + Math.cos(lat*Math.PI/180)*Math.cos(la*Math.PI/180)*Math.sin(dLng/2)**2;
    return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)) * 10) / 10;
  };
  return json({
    query: q, lang, radius,
    results: (data.places || []).map((p) => ({
      name: p.displayName && p.displayName.text,
      type: p.primaryType || null,
      rating: p.rating || null,
      reviews: p.userRatingCount || 0,
      km: p.location ? dist(p.location.latitude, p.location.longitude) : null,
      addr: p.formattedAddress || null,
    })),
  });
}

function json(obj) {
  return new Response(JSON.stringify(obj, null, 2), {
    headers: { 'Content-Type': 'application/json' },
  });
}
