/**
 * Stripe 웹훅 — POST /api/stripe-webhook
 * 결제·구독 이벤트를 D1 orders/payments 에 기록하고 작업(jobs)을 만든다. 관리자 페이지(/admin/)의 데이터 원천.
 *
 * 환경변수
 *   STRIPE_WEBHOOK_SECRET  필수 — Stripe 대시보드 → Developers → Webhooks 의 서명 비밀(whsec_…)
 *   STRIPE_SECRET_KEY      선택 — 있으면 Payment Link URL·상품명·주기를 조회해 상품을 정확히 매핑. 없으면 금액·이메일만 기록
 *
 * 받는 이벤트 (대시보드에서 이 6개만 선택)
 *   checkout.session.completed · invoice.paid · invoice.payment_failed
 *   customer.subscription.updated · customer.subscription.deleted · charge.refunded
 */
import { notify, esc } from './_notify.js';
import { ensureSchema, loadCatalog, catalogLookup, createJobForOrder } from './_orders.js';

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!env.STRIPE_WEBHOOK_SECRET) return text('STRIPE_WEBHOOK_SECRET 미설정', 503);

  const raw = await request.text();
  const sig = request.headers.get('stripe-signature') || '';
  if (!(await verify(raw, sig, env.STRIPE_WEBHOOK_SECRET))) return text('bad signature', 400);

  let event;
  try { event = JSON.parse(raw); } catch { return text('bad json', 400); }

  await ensureSchema(env.DB);

  // 중복 전달 방지 — 같은 이벤트 id 는 한 번만
  const dup = await env.DB.prepare('INSERT OR IGNORE INTO stripe_events (id, type) VALUES (?, ?)').bind(event.id, event.type).run();
  if (!dup.meta || dup.meta.changes === 0) return text('duplicate', 200);

  try {
    switch (event.type) {
      case 'checkout.session.completed': await onCheckout(context, event.data.object); break;
      case 'invoice.paid': await onInvoicePaid(env, event.data.object); break;
      case 'invoice.payment_failed': await setSubStatus(env, event.data.object.subscription, 'past_due'); break;
      case 'customer.subscription.updated': await onSubUpdated(env, event.data.object); break;
      case 'customer.subscription.deleted': await setSubStatus(env, event.data.object.id, 'canceled'); break;
      case 'charge.refunded': await onRefund(env, event.data.object); break;
      default: break; // 그 외 이벤트는 기록만 하고 무시
    }
  } catch (e) {
    // 처리 실패를 Stripe 에 알려 재전송 받는다 (이벤트 id 기록은 지워서 재시도 가능하게)
    await env.DB.prepare('DELETE FROM stripe_events WHERE id = ?').bind(event.id).run().catch(() => {});
    return text('error: ' + (e && e.message), 500);
  }
  return text('ok', 200);
}

/* ---------- 이벤트별 처리 ---------- */

async function onCheckout(context, s) {
  const { env, request } = context;
  const db = env.DB;
  const cd = s.customer_details || {};
  const email = (cd.email || s.customer_email || '').toLowerCase();

  // 상품 매핑: Payment Link → URL → 카탈로그(slug·기간·납기)
  let linkUrl = null, lineName = null, interval = null;
  if (env.STRIPE_SECRET_KEY) {
    if (s.payment_link) {
      const pl = await stripeGet(env, `/v1/payment_links/${s.payment_link}`);
      if (pl && pl.url) linkUrl = pl.url;
    }
    const li = await stripeGet(env, `/v1/checkout/sessions/${s.id}/line_items?limit=3&expand[]=data.price.product`);
    const first = li && li.data && li.data[0];
    if (first) {
      lineName = first.description || (first.price && first.price.product && first.price.product.name) || null;
      const rec = first.price && first.price.recurring;
      if (rec) interval = rec.interval_count > 1 ? `${rec.interval_count} ${rec.interval}` : rec.interval;
    }
  }
  const catalog = await loadCatalog(env, request.url);
  const slugFromUrl = s.success_url && /[?&]service=([a-z0-9-]+)/i.exec(s.success_url);
  const item = catalogLookup(catalog, { linkUrl, slug: slugFromUrl && slugFromUrl[1] });

  const order = {
    stripe_session_id: s.id,
    stripe_customer_id: s.customer || null,
    stripe_subscription_id: s.subscription || null,
    stripe_payment_intent: s.payment_intent || null,
    stripe_payment_link: s.payment_link || null,
    stripe_link_url: linkUrl,
    service_slug: item ? item.slug : (slugFromUrl ? slugFromUrl[1] : null),
    service_name: item ? item.name : lineName,
    period: item ? item.period || null : null,
    mode: s.mode || 'payment',
    amount_cents: s.amount_total || 0,
    currency: s.currency || 'usd',
    interval: interval || (item && item.interval) || null,
    status: s.mode === 'subscription' ? 'active' : (s.payment_status === 'paid' ? 'paid' : 'incomplete'),
    customer_email: email,
    customer_name: cd.name || '',
    customer_phone: cd.phone || '',
  };

  // 구독 이벤트(invoice.paid)가 먼저 와서 만든 주문이 있으면 갱신, 아니면 신규
  const existing = order.stripe_subscription_id
    ? await db.prepare('SELECT id FROM orders WHERE stripe_subscription_id = ?').bind(order.stripe_subscription_id).first()
    : null;
  let orderId;
  if (existing) {
    orderId = existing.id;
    await db
      .prepare(
        `UPDATE orders SET stripe_session_id=?, stripe_customer_id=?, stripe_payment_intent=?, stripe_payment_link=?, stripe_link_url=?, service_slug=?, service_name=?, period=?, mode=?, amount_cents=?, currency=?, interval=?, customer_email=?, customer_name=?, customer_phone=?, updated_at=datetime('now') WHERE id=?`
      )
      .bind(order.stripe_session_id, order.stripe_customer_id, order.stripe_payment_intent, order.stripe_payment_link, order.stripe_link_url, order.service_slug, order.service_name, order.period, order.mode, order.amount_cents, order.currency, order.interval, order.customer_email, order.customer_name, order.customer_phone, orderId)
      .run();
  } else {
    const r = await db
      .prepare(
        `INSERT INTO orders (stripe_session_id, stripe_customer_id, stripe_subscription_id, stripe_payment_intent, stripe_payment_link, stripe_link_url, service_slug, service_name, period, mode, amount_cents, currency, interval, status, customer_email, customer_name, customer_phone)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
      )
      .bind(order.stripe_session_id, order.stripe_customer_id, order.stripe_subscription_id, order.stripe_payment_intent, order.stripe_payment_link, order.stripe_link_url, order.service_slug, order.service_name, order.period, order.mode, order.amount_cents, order.currency, order.interval, order.status, order.customer_email, order.customer_name, order.customer_phone)
      .run();
    orderId = r.meta.last_row_id;
  }
  order.id = orderId;

  // 일회성 결제는 여기서 입금 1건 기록 (구독은 invoice.paid 가 기록)
  if (order.mode !== 'subscription' && s.payment_status === 'paid') {
    await db
      .prepare(`INSERT OR IGNORE INTO payments (order_id, stripe_id, amount_cents, currency, reason, paid_at) VALUES (?,?,?,?,?,datetime('now'))`)
      .bind(orderId, s.payment_intent || s.id, s.amount_total || 0, s.currency || 'usd', 'one_time')
      .run();
    await db.prepare(`UPDATE orders SET paid_count = paid_count + 1, last_paid_at = datetime('now') WHERE id = ?`).bind(orderId).run();
  }

  const hasJob = await db.prepare('SELECT id FROM jobs WHERE order_id = ?').bind(orderId).first();
  if (!hasJob) await createJobForOrder(db, order, { deliveryDays: item && item.deliveryDays });

  context.waitUntil(
    notify(env, `💰 결제 완료 — ${order.service_name || order.service_slug || '상품 미확인'} · $${(order.amount_cents / 100).toFixed(0)}`, [
      ['상품', esc(order.service_name || order.service_slug || '(미확인 — 관리자 페이지에서 확인)')],
      ['기간', esc(order.period || order.interval || (order.mode === 'subscription' ? '구독' : '일회성'))],
      ['금액', `$${(order.amount_cents / 100).toFixed(2)} ${esc(order.currency.toUpperCase())}`],
      ['고객', esc(order.customer_name)],
      ['이메일', esc(order.customer_email)],
      ['연락처', esc(order.customer_phone)],
      ['관리', `<a href="https://bizhigher.com/admin/#/orders">관리자 페이지에서 보기</a>`],
    ])
  );
}

async function onInvoicePaid(env, inv) {
  const db = env.DB;
  if (!inv.subscription) return; // 구독이 아닌 인보이스는 무시
  let order = await db.prepare('SELECT id, paid_count FROM orders WHERE stripe_subscription_id = ?').bind(inv.subscription).first();
  if (!order) {
    // checkout.session.completed 보다 먼저 온 경우 — 최소 정보로 주문을 만들어 두면 checkout 이 채운다
    const r = await db
      .prepare(`INSERT INTO orders (stripe_subscription_id, stripe_customer_id, mode, amount_cents, currency, status, customer_email, customer_name) VALUES (?,?,?,?,?,'active',?,?)`)
      .bind(inv.subscription, inv.customer || null, 'subscription', inv.amount_paid || 0, inv.currency || 'usd', (inv.customer_email || '').toLowerCase(), inv.customer_name || '')
      .run();
    order = { id: r.meta.last_row_id, paid_count: 0 };
  }
  const ins = await db
    .prepare(`INSERT OR IGNORE INTO payments (order_id, stripe_id, amount_cents, currency, reason, paid_at) VALUES (?,?,?,?,?,?)`)
    .bind(order.id, inv.id, inv.amount_paid || 0, inv.currency || 'usd', inv.billing_reason || 'subscription', new Date((inv.status_transitions && inv.status_transitions.paid_at || inv.created) * 1000).toISOString())
    .run();
  if (ins.meta && ins.meta.changes) {
    await db
      .prepare(`UPDATE orders SET status = 'active', paid_count = paid_count + 1, last_paid_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`)
      .bind(order.id)
      .run();
    // 2회차 납부 — 월 분납 플랜은 이때 웹사이트 제작 시작 (CLAUDE.md §4)
    if (order.paid_count + 1 === 2) {
      const job = await db.prepare('SELECT id FROM jobs WHERE order_id = ? ORDER BY id DESC LIMIT 1').bind(order.id).first();
      if (job) await db.prepare(`INSERT INTO job_events (job_id, kind, note) VALUES (?, 'system', '2회차 납부 확인 — 분납 플랜이면 웹사이트·랜딩 제작 시작 가능')`).bind(job.id).run();
    }
  }
}

async function onSubUpdated(env, sub) {
  const map = { active: 'active', trialing: 'active', past_due: 'past_due', unpaid: 'past_due', canceled: 'canceled', incomplete: 'incomplete', incomplete_expired: 'canceled', paused: 'past_due' };
  const status = map[sub.status] || sub.status;
  const periodEnd = sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null;
  await env.DB
    .prepare(`UPDATE orders SET status = ?, cancel_at_period_end = ?, current_period_end = COALESCE(?, current_period_end), updated_at = datetime('now') WHERE stripe_subscription_id = ?`)
    .bind(status, sub.cancel_at_period_end ? 1 : 0, periodEnd, sub.id)
    .run();
}

async function setSubStatus(env, subId, status) {
  if (!subId) return;
  await env.DB.prepare(`UPDATE orders SET status = ?, updated_at = datetime('now') WHERE stripe_subscription_id = ?`).bind(status, subId).run();
}

async function onRefund(env, charge) {
  if (!charge.payment_intent) return;
  const full = charge.amount_refunded >= charge.amount;
  await env.DB
    .prepare(`UPDATE orders SET status = CASE WHEN ? THEN 'refunded' ELSE status END, updated_at = datetime('now') WHERE stripe_payment_intent = ?`)
    .bind(full ? 1 : 0, charge.payment_intent)
    .run();
  const o = await env.DB.prepare('SELECT id FROM orders WHERE stripe_payment_intent = ?').bind(charge.payment_intent).first();
  if (o) {
    const job = await env.DB.prepare('SELECT id, status FROM jobs WHERE order_id = ? ORDER BY id DESC LIMIT 1').bind(o.id).first();
    if (job) await env.DB.prepare(`INSERT INTO job_events (job_id, kind, note) VALUES (?, 'system', ?)`).bind(job.id, `환불 ${full ? '전액' : '부분'} $${(charge.amount_refunded / 100).toFixed(2)}`).run();
  }
}

/* ---------- 유틸 ---------- */

async function stripeGet(env, path) {
  try {
    const res = await fetch('https://api.stripe.com' + path, { headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` } });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

// Stripe-Signature: t=…,v1=…  → HMAC-SHA256(secret, `${t}.${raw}`) 이 v1 중 하나와 같아야 하고 t 는 5분 이내
async function verify(raw, header, secret) {
  const parts = Object.create(null);
  for (const kv of header.split(',')) {
    const i = kv.indexOf('=');
    if (i < 0) continue;
    const k = kv.slice(0, i).trim(), v = kv.slice(i + 1).trim();
    (parts[k] = parts[k] || []).push(v);
  }
  const t = parts.t && parts.t[0];
  const sigs = parts.v1 || [];
  if (!t || !sigs.length) return false;
  if (Math.abs(Date.now() / 1000 - Number(t)) > 300) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${t}.${raw}`));
  const expected = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return sigs.some((s) => timingSafeEqual(s, expected));
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

function text(body, status) {
  return new Response(body, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
