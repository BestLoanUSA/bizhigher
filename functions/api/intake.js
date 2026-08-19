/**
 * 결제 후 인테이크 질문지 제출 — POST /api/intake
 * D1 intakes 테이블에 저장. David가 확인 후 작업 시작.
 */
import { notify, esc } from './_notify.js';

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

  // David에게 주문 알림 (비동기)
  context.waitUntil(
    notify(env, `💰 새 주문 — ${service || '상품 미지정'} · ${business}`, [
      ['상품', esc(service || '(미지정)')],
      ['업체명', esc(business)],
      ['담당자', esc(contactName)],
      ['연락처', esc(phone)],
      ['이메일', esc(email)],
      ['링크', esc(links)],
      ['요청사항', esc(notes)],
    ])
  );

  return json({ ok: true });
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
