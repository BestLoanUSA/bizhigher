/**
 * BizHigher Worker — 정적 사이트 서빙 + 진단 폼 API
 * 정적 파일(dist/)은 Cloudflare가 자동으로 서빙하고,
 * 파일에 없는 경로(/api/*)만 이 Worker로 들어옵니다.
 */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // 무료 진단 폼 제출 → D1 저장
    if (url.pathname === '/api/audit' && request.method === 'POST') {
      try {
        const data = await request.json();
        const business = (data.business || '').trim().slice(0, 200);
        const location = (data.location || '').trim().slice(0, 300);
        const email = (data.email || '').trim().slice(0, 200);

        if (!business || !location || !email || !email.includes('@')) {
          return json({ ok: false, error: 'invalid' }, 400);
        }

        await env.DB.prepare(
          'INSERT INTO audit_leads (business, location, email) VALUES (?, ?, ?)'
        )
          .bind(business, location, email)
          .run();

        return json({ ok: true });
      } catch (err) {
        return json({ ok: false, error: 'server' }, 500);
      }
    }

    // 그 외 요청은 정적 자산으로 (없으면 404.html)
    return env.ASSETS.fetch(request);
  },
};

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
