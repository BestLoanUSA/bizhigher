/**
 * 고객 사이트 문의 폼 수신 — POST /api/site-contact (automation/sites/render.js 의 contact 섹션이 여기로 보낸다)
 * 정적 사이트(bizhigher-sites)에는 DB 가 없으므로 본 프로젝트 Functions 가 받는다. JS 없이도 동작하는 일반 폼 POST(교차 출처 내비게이션이라 CORS 불필요).
 * 저장: D1 site_leads + 작업 타임라인 "📩 사이트 문의" + David 알림(notify). 고객(사업주)에게는 스펙 contact.forward_to 가 있을 때만 전달 메일(§12-3 예외 — 사업주 자신의 사이트 리드).
 * 스팸: 허니팟(website) · 작성 2초 미만 거부 · IP 해시 하루 20건 · 메시지 길이 제한
 */
import { ensureSchema, addEvent } from './_orders.js';
import { notify, sendEmail, esc } from './_notify.js';

const ALLOWED_RETURN = /^https:\/\/([a-z0-9-]+\.)*(sites\.bizhigher\.com|bizhigher-sites\.pages\.dev)(\/|$)/i;
async function sha256(s) { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)); return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('').slice(0, 24); }
const html = (s, status = 200) => new Response(s, { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
const fail = (msg, back) => html(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="font-family:sans-serif;padding:40px;max-width:520px;margin:auto"><p>${esc(msg)}</p>${back ? `<p><a href="${esc(back)}">← 돌아가기</a></p>` : ''}</body>`, 400);

export async function onRequestPost({ request, env }) {
  const form = await request.formData().catch(() => null);
  if (!form) return fail('잘못된 요청입니다.');
  const g = (k, n = 200) => String(form.get(k) || '').trim().slice(0, n);
  const slug = g('slug', 40).toLowerCase(); const name = g('name', 80); const phone = g('phone', 40); const email = g('email', 120); const message = g('message', 2000);
  let returnTo = g('return_to', 300); if (!ALLOWED_RETURN.test(returnTo)) returnTo = '';
  const back = returnTo ? returnTo.replace(/\?sent=1$/, '') : '';
  if (g('website', 50)) return Response.redirect(returnTo || 'https://bizhigher.com/', 303); // 허니팟 — 봇에게는 성공처럼
  const t = Number(g('_t', 20)); if (t && Date.now() - t < 2000) return fail('너무 빨리 제출되었습니다. 다시 시도해 주세요.', back);
  if (!/^[a-z0-9-]{1,40}$/.test(slug) || !name || !message) return fail('이름과 문의 내용을 적어 주세요.', back);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail('이메일 형식을 확인해 주세요.', back);
  if (!env.DB) return fail('잠시 후 다시 시도해 주세요.', back);
  await ensureSchema(env.DB);
  const site = await env.DB.prepare(`SELECT s.id, s.job_id, s.slug, s.spec, j.business FROM sites s LEFT JOIN jobs j ON j.id = s.job_id WHERE s.slug = ?`).bind(slug).first();
  if (!site) return fail('사이트를 찾을 수 없습니다.', back);
  const ip = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || '';
  const ipHash = await sha256(ip + '|site-contact|' + new Date().toISOString().slice(0, 10));
  const cnt = await env.DB.prepare(`SELECT COUNT(*) AS n FROM site_leads WHERE ip_hash = ? AND created_at >= datetime('now', '-1 day')`).bind(ipHash).first();
  if (cnt && cnt.n >= 20) return fail('오늘은 더 보낼 수 없습니다. 전화로 문의해 주세요.', back);
  const page = (request.headers.get('referer') || '').slice(0, 300);
  await env.DB.prepare(`INSERT INTO site_leads (site_id, job_id, slug, name, phone, email, message, page, ip_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(site.id, site.job_id, slug, name, phone, email, message, page, ipHash).run();
  if (site.job_id) await addEvent(env.DB, site.job_id, 'customer', null, null, `📩 사이트 문의 — ${name}${phone ? ' · ' + phone : ''}${email ? ' · ' + email : ''}: ${message.slice(0, 140)}`).catch(() => {});
  let spec = {}; try { spec = JSON.parse(site.spec || '{}'); } catch {}
  const biz = spec.name || site.business || slug;
  const rows = [['사이트', `${esc(biz)} (${esc(slug)})`], ['이름', esc(name)], ['전화', phone ? `<a href="tel:${esc(phone)}">${esc(phone)}</a>` : '-'], ['이메일', email ? `<a href="mailto:${esc(email)}">${esc(email)}</a>` : '-'], ['내용', esc(message).replace(/\n/g, '<br>')], ['페이지', esc(page || '-')]];
  await notify(env, `📩 사이트 문의 — ${biz} · ${name}`, rows).catch(() => {});
  // 사업주에게 전달 — 스펙 contact.forward_to 가 있을 때만(David 가 스펙에 넣는다). 발신은 CUSTOMER_FROM
  const fwd = spec.contact && typeof spec.contact.forward_to === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(spec.contact.forward_to) ? spec.contact.forward_to : '';
  if (fwd) await sendEmail(env, { to: fwd, subject: `[${biz}] 웹사이트 문의 — ${name}`, html: `<div style="font-family:sans-serif;max-width:560px"><p>웹사이트(${esc(slug)})로 문의가 들어왔습니다.</p><table style="border-collapse:collapse">${rows.map(([l, v]) => `<tr><td style="padding:6px 12px;color:#6b7280;font-size:13px;vertical-align:top">${esc(l)}</td><td style="padding:6px 12px;font-size:14px">${v}</td></tr>`).join('')}</table><p style="color:#6b7280;font-size:12px">이 메일에 답장하면 문의하신 분이 아니라 BizHigher 로 갑니다. 손님에게는 위 전화·이메일로 직접 연락해 주세요.</p></div>` }).catch(() => {});
  return Response.redirect(returnTo || 'https://bizhigher.com/', 303);
}

export async function onRequestGet() { return html('<!doctype html><meta charset="utf-8"><p style="font-family:sans-serif;padding:40px">이 주소는 문의 폼 전송용입니다.</p>', 405); }
