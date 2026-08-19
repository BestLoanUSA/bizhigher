/**
 * 무료 진단 폼 제출 처리 — Cloudflare Pages Function
 * POST /api/audit  { business, location, email }
 * D1 데이터베이스 "bizhigher-db"의 audit_leads 테이블에 저장합니다.
 * (Pages 프로젝트 설정에서 D1 바인딩 이름을 DB 로 연결해야 합니다 — README 참고)
 */
export async function onRequestPost(context) {
  try {
    const data = await context.request.json();
    const business = (data.business || '').trim().slice(0, 200);
    const location = (data.location || '').trim().slice(0, 300);
    const email = (data.email || '').trim().slice(0, 200);

    if (!business || !location || !email || !email.includes('@')) {
      return json({ ok: false, error: 'invalid' }, 400);
    }

    await context.env.DB.prepare(
      'INSERT INTO audit_leads (business, location, email) VALUES (?, ?, ?)'
    )
      .bind(business, location, email)
      .run();

    return json({ ok: true });
  } catch (err) {
    return json({ ok: false, error: 'server' }, 500);
  }
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
