/**
 * 결제 후 인테이크 질문지 제출 — POST /api/intake
 * D1 intakes 테이블에 저장. David가 확인 후 작업 시작.
 */
export async function onRequestPost(context) {
  const { request, env } = context;
  let data;
  try {
    data = await request.json();
  } catch {
    return json({ ok: false, error: 'invalid' }, 400);
  }
  const service = (data.service || '').trim().slice(0, 100);
  const business = (data.business || '').trim().slice(0, 200);
  const contactName = (data.contact_name || '').trim().slice(0, 100);
  const phone = (data.phone || '').trim().slice(0, 50);
  const email = (data.email || '').trim().slice(0, 200);
  const links = (data.links || '').trim().slice(0, 1000);
  const notes = (data.notes || '').trim().slice(0, 3000);

  if (!business || !email || !email.includes('@')) {
    return json({ ok: false, error: 'invalid' }, 400);
  }

  try {
    await env.DB.prepare(
      'INSERT INTO intakes (service, business, contact_name, phone, email, links, notes) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind(service, business, contactName, phone, email, links, notes).run();
  } catch {
    return json({ ok: false, error: 'server' }, 500);
  }
  return json({ ok: true });
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
