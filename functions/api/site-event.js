/**
 * 고객 사이트 전환 이벤트 비콘 — POST /api/site-event (automation/sites/render.js 가 sendBeacon 으로 보낸다)
 * GA4 없이도 리포트의 핵심 숫자(페이지 보기·전화 클릭·길찾기·예약·문의 제출)를 우리 쪽에서 센다 (2026-11-01).
 * 저장: D1 site_events 에 (사이트·날짜·이벤트·페이지)당 1행, n 증가 — 개인정보·IP 없음. 본문은 text/plain JSON(프리플라이트 없음).
 * 남용 방지: 이벤트 5종만, slug 는 실제 사이트만, 페이지 경로 200자, 응답 204.
 */
import { ensureSchema } from './_orders.js';

const EVENTS = new Set(['page_view', 'phone_click', 'directions_click', 'booking_click', 'contact_submit']);
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'content-type', 'Cache-Control': 'no-store' };

export async function onRequestOptions() { return new Response(null, { status: 204, headers: CORS }); }
export async function onRequestGet() { return new Response('site-event beacon', { status: 405, headers: CORS }); }
export async function onRequestPost({ request, env }) {
  let body = null;
  try { body = JSON.parse((await request.text()).slice(0, 2000)); } catch { return new Response(null, { status: 204, headers: CORS }); }
  const slug = String((body && body.slug) || '').toLowerCase().slice(0, 40); const event = String((body && body.event) || '');
  let page = String((body && body.page) || '/').slice(0, 200); if (!page.startsWith('/')) page = '/';
  if (!/^[a-z0-9-]{1,40}$/.test(slug) || !EVENTS.has(event) || !env.DB) return new Response(null, { status: 204, headers: CORS });
  try {
    await ensureSchema(env.DB);
    const site = await env.DB.prepare(`SELECT id, job_id FROM sites WHERE slug = ?`).bind(slug).first();
    if (!site) return new Response(null, { status: 204, headers: CORS });
    const day = new Date().toISOString().slice(0, 10);
    await env.DB.prepare(`INSERT INTO site_events (site_id, job_id, slug, day, event, page, n) VALUES (?, ?, ?, ?, ?, ?, 1) ON CONFLICT(site_id, day, event, page) DO UPDATE SET n = n + 1`).bind(site.id, site.job_id, slug, day, event, page).run();
  } catch {}
  return new Response(null, { status: 204, headers: CORS });
}
