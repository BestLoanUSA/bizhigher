/**
 * 관리자 페이지 화면 — 단일 HTML, 외부 의존 없음(폰트만). 360px 우선.
 * 데이터는 전부 /admin/api/* 에서 가져온다 ([[path]].js).
 */

const CSS = `
:root{--blue:#0A4DF5;--blue-50:#EEF3FF;--navy:#0A1B4D;--ink:#111318;--ink-600:#4B5563;--ink-400:#9CA3AF;--line:#E5E7EB;--bg:#F6F7F9;--red:#D3382F;--green:#0B9E58;--amber:#B45309;--amber-50:#FEF3C7}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}
body{margin:0;font-family:Pretendard,'Apple SD Gothic Neo','Malgun Gothic',system-ui,sans-serif;background:var(--bg);color:var(--ink);font-size:15px;line-height:1.5}
a{color:var(--blue);text-decoration:none}button{font:inherit;cursor:pointer}input,textarea,select{font:inherit}
.top{position:sticky;top:0;z-index:5;background:#fff;border-bottom:1px solid var(--line);display:flex;align-items:center;gap:10px;padding:10px 16px}
.logo{font-weight:800;font-size:17px;letter-spacing:-.01em}.logo b{color:var(--blue)}.logo small{font-weight:600;color:var(--ink-400);margin-left:6px;font-size:12px}
.top .sp{flex:1}.top a.out{font-size:12px;color:var(--ink-400)}
.tabs{display:flex;gap:4px;overflow-x:auto;padding:8px 12px;background:#fff;border-bottom:1px solid var(--line);scrollbar-width:none}.tabs::-webkit-scrollbar{display:none}
.tabs a{flex:0 0 auto;padding:7px 12px;border-radius:999px;font-size:13.5px;font-weight:600;color:var(--ink-600)}.tabs a.on{background:var(--navy);color:#fff}
main{padding:16px;max-width:980px;margin:0 auto}
h1{font-size:20px;margin:4px 0 14px;letter-spacing:-.01em}h2{font-size:15px;margin:22px 0 10px;color:var(--ink-600);font-weight:700}
.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}@media(min-width:720px){.grid{grid-template-columns:repeat(4,1fr)}}
.tile{background:#fff;border:1px solid var(--line);border-radius:14px;padding:14px}.tile .n{font-size:26px;font-weight:800;letter-spacing:-.02em;line-height:1.1}.tile .l{font-size:12.5px;color:var(--ink-600);margin-top:4px}.tile.warn .n{color:var(--red)}.tile.good .n{color:var(--green)}.tile a{display:block;color:inherit}
.card{background:#fff;border:1px solid var(--line);border-radius:14px;padding:14px;margin-bottom:12px}
.row{display:flex;gap:10px;align-items:flex-start;padding:12px 0;border-top:1px solid var(--line);color:var(--ink)}.row:first-child{border-top:0}.row .m{flex:1;min-width:0}.row .t{font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.row .s{font-size:13px;color:var(--ink-600);margin-top:2px}.row .r{text-align:right;font-size:12.5px;color:var(--ink-400);flex:0 0 auto}
.list{background:#fff;border:1px solid var(--line);border-radius:14px;padding:0 14px}
.pill{display:inline-block;font-size:11.5px;font-weight:700;padding:3px 9px;border-radius:999px;background:var(--blue-50);color:var(--blue);white-space:nowrap}
.pill.new{background:#FEE2E2;color:var(--red)}.pill.info{background:var(--amber-50);color:var(--amber)}.pill.working{background:var(--blue-50);color:var(--blue)}.pill.qa{background:#EDE9FE;color:#6D28D9}.pill.ready{background:#D1FAE5;color:#047857}.pill.done{background:#E5E7EB;color:var(--ink-600)}.pill.hold{background:#F3F4F6;color:var(--ink-400)}
.pill.active,.pill.paid{background:#D1FAE5;color:#047857}.pill.past_due,.pill.incomplete{background:#FEE2E2;color:var(--red)}.pill.canceled,.pill.refunded{background:#E5E7EB;color:var(--ink-600)}
.due{font-size:12px;font-weight:700}.due.over{color:var(--red)}.due.today{color:var(--amber)}
.chips{display:flex;gap:6px;overflow-x:auto;padding-bottom:8px;margin-bottom:8px;scrollbar-width:none}.chips::-webkit-scrollbar{display:none}.chips a,.chips button{flex:0 0 auto;border:1px solid var(--line);background:#fff;border-radius:999px;padding:6px 12px;font-size:13px;font-weight:600;color:var(--ink-600)}.chips .on{background:var(--blue);border-color:var(--blue);color:#fff}
.kv{display:grid;grid-template-columns:88px 1fr;gap:6px 10px;font-size:14px}.kv dt{color:var(--ink-400);font-size:13px}.kv dd{margin:0;word-break:break-word}
.st{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin:10px 0}.st button{border:1px solid var(--line);background:#fff;border-radius:10px;padding:9px 4px;font-size:12.5px;font-weight:700;color:var(--ink-600)}.st button.on{background:var(--navy);border-color:var(--navy);color:#fff}
.btn{display:inline-block;background:var(--blue);color:#fff;border:0;border-radius:10px;padding:9px 14px;font-weight:700;font-size:14px}.btn.ghost{background:#fff;color:var(--ink);border:1.5px solid var(--line)}.btn.sm{padding:6px 10px;font-size:12.5px}.btn:disabled{opacity:.5}
.in{width:100%;border:1.5px solid var(--line);border-radius:10px;padding:10px 12px;font-size:15px;background:#fff}textarea.in{min-height:72px;resize:vertical}
.frm{display:flex;flex-direction:column;gap:8px}.frm .h{display:flex;gap:8px}.frm .h .in{flex:1}
.tl{list-style:none;margin:0;padding:0}.tl li{padding:9px 0;border-top:1px solid var(--line);font-size:14px}.tl li:first-child{border-top:0}.tl .w{font-size:12px;color:var(--ink-400)}.tl .note{white-space:pre-wrap}
pre.notes{white-space:pre-wrap;font:inherit;font-size:14px;background:var(--bg);border-radius:10px;padding:10px 12px;margin:0}
.muted{color:var(--ink-400);font-size:13px}.empty{padding:28px 0;text-align:center;color:var(--ink-400)}
.alert{background:var(--amber-50);border:1px solid #FCD34D;color:#92400E;border-radius:12px;padding:10px 14px;font-size:13.5px;margin-bottom:12px}.alert.err{background:#FEE2E2;border-color:#FCA5A5;color:#991B1B}
.back{display:inline-block;font-size:13px;margin-bottom:8px;color:var(--ink-600)}
.toast{position:fixed;left:50%;bottom:20px;transform:translateX(-50%);background:var(--navy);color:#fff;padding:10px 16px;border-radius:999px;font-size:13.5px;opacity:0;transition:opacity .2s;pointer-events:none;max-width:90vw}.toast.on{opacity:1}
.login{max-width:360px;margin:14vh auto 0;padding:0 16px}.login .card{padding:24px}
.pp{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:10px}@media(min-width:720px){.pp{grid-template-columns:repeat(6,1fr)}}.pp div{background:var(--bg);border-radius:10px;padding:8px 10px}.pp b{display:block;font-size:17px}.pp span{font-size:11.5px;color:var(--ink-600)}
.lg{display:flex;flex-wrap:wrap;gap:6px 12px;font-size:12px;color:var(--ink-600);margin:6px 0 10px}
.ph{font-size:13px;font-weight:800;color:var(--navy);margin:14px 0 4px;padding-top:10px;border-top:2px solid var(--line);cursor:pointer;list-style:none}.ph::-webkit-details-marker{display:none}.ph::before{content:'▸ ';color:var(--ink-400)}details[open]>.ph::before{content:'▾ '}details:first-of-type>.ph{border-top:0;padding-top:0}
.sv{font-size:12px;font-weight:700;color:var(--ink-400);margin:8px 0 2px;letter-spacing:.02em}
.tk{display:flex;gap:8px;align-items:flex-start;padding:8px 0;border-top:1px solid var(--line)}.tk .ic{flex:0 0 18px;font-size:14px;line-height:1.5}.tk .m{flex:1;min-width:0}.tk .t{font-size:14px}.tk.done .t{color:var(--ink-400);text-decoration:line-through}.tk .b{font-size:12px;color:var(--ink-600);margin-top:2px}.tk .b.red{color:var(--red)}.tk .b.nx{color:var(--green)}
.tk .r{flex:0 0 auto;display:flex;flex-direction:column;align-items:flex-end;gap:4px}.tk select{font-size:12px;border:1px solid var(--line);border-radius:8px;padding:4px 6px;background:#fff}.tk .mn{font-size:11px;color:var(--ink-400)}
.vf{display:inline-block;font-size:10.5px;font-weight:800;padding:2px 6px;border-radius:6px;background:#EDE9FE;color:#6D28D9;margin-left:4px;vertical-align:middle}.tk.review{background:#FDF4FF;margin:0 -14px;padding:8px 14px}
.bn{background:#FFF7ED;border:1px solid #FED7AA;border-radius:12px;padding:10px 14px;margin-bottom:12px;font-size:13.5px}.bn li{margin:4px 0}

`;

const FONT = `<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">`;

export function loginHtml({ error, unconfigured } = {}) {
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>BizHigher 관리자</title>${FONT}<style>${CSS}</style></head><body>
<div class="login"><div class="logo" style="margin-bottom:14px">Biz<b>Higher</b><small>ADMIN</small></div>
<div class="card">${unconfigured
    ? `<div class="alert">아직 잠겨 있습니다. Cloudflare Pages → Settings → Environment variables (Production) 에 <b>ADMIN_PASSWORD</b> 를 넣고 재배포하면 열립니다.</div>`
    : `<form method="post" action="/admin/login" class="frm">${error ? `<div class="alert err">${error}</div>` : ''}
<input class="in" type="password" name="password" placeholder="비밀번호" autofocus autocomplete="current-password" required>
<button class="btn" type="submit">들어가기</button></form>`}
</div><p class="muted" style="text-align:center;margin-top:14px">bizhigher.com 운영 전용</p></div></body></html>`;
}

export function appHtml({ user, noDb } = {}) {
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>BizHigher 관리자</title>${FONT}<style>${CSS}</style></head><body>
<header class="top"><a class="logo" href="#/">Biz<b>Higher</b><small>ADMIN</small></a><span class="sp"></span><span class="muted" style="font-size:12px">${esc(user || '')}</span><a class="out" href="/admin/logout">나가기</a></header>
<nav class="tabs" id="tabs">
<a href="#/" data-t="">대시보드</a><a href="#/jobs" data-t="jobs">작업</a><a href="#/orders" data-t="orders">주문</a><a href="#/intakes" data-t="intakes">질문지</a><a href="#/leads" data-t="leads">리드</a><a href="#/reports" data-t="reports">리포트</a><a href="#/playbook" data-t="playbook">플레이북</a>
</nav>
<main id="app">${noDb ? '<div class="alert err">이 배포에는 D1 바인딩(DB)이 없습니다. 프리뷰 환경이면 정상이고, Production 에서는 Settings → Functions → D1 bindings 를 확인하세요.</div>' : '<div class="empty">불러오는 중…</div>'}</main>
<div class="toast" id="toast"></div>
<script>${APP_JS}</script></body></html>`;
}

const APP_JS = String.raw`
const $ = (s, el) => (el || document).querySelector(s);
const esc = (s) => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const money = (c) => '$' + ((c || 0) / 100).toLocaleString('en-US', { maximumFractionDigits: 0 });
const LA = 'America/Los_Angeles';
function when(s) { if (!s) return ''; const d = new Date(/Z|[+-]\d\d:?\d\d$/.test(s) ? s : s.replace(' ', 'T') + 'Z'); if (isNaN(d)) return s; return d.toLocaleString('ko-KR', { timeZone: LA, month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }); }
function day(s) { if (!s) return ''; const d = new Date(/Z|[+-]\d\d:?\d\d$/.test(s) ? s : s.replace(' ', 'T') + 'Z'); return isNaN(d) ? s : d.toLocaleDateString('ko-KR', { timeZone: LA, month: 'numeric', day: 'numeric' }); }
const todayLA = () => new Date().toLocaleDateString('en-CA', { timeZone: LA });
let STATUSES = [];
const stLabel = (k) => (STATUSES.find((s) => s[0] === k) || [k, k])[1];
const stPill = (k) => '<span class="pill ' + esc(k) + '">' + esc(stLabel(k)) + '</span>';
const PERIOD = { monthly: '월간', six: '6개월', annual: '12개월 선결제', installment: '12개월 약정 · 월 분납' };
const per = (k) => PERIOD[k] || k;
const oPill = (k) => k ? '<span class="pill ' + esc(k) + '">' + esc({ paid: '결제됨', active: '구독 중', past_due: '미납', canceled: '해지', refunded: '환불', incomplete: '미완료' }[k] || k) + '</span>' : '';
function dueTag(d, status) { if (!d || status === 'done' || status === 'hold') return ''; const t = todayLA(); const c = d < t ? 'over' : d === t ? 'today' : ''; return '<span class="due ' + c + '">마감 ' + esc(d.slice(5).replace('-', '/')) + (c === 'over' ? ' 지남' : c === 'today' ? ' 오늘' : '') + '</span>'; }
function toast(m) { const t = $('#toast'); t.textContent = m; t.classList.add('on'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('on'), 1800); }
async function api(path, body) {
  const r = await fetch('/admin/api/' + path, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {});
  if (r.status === 401) { location.href = '/admin/'; return null; }
  const j = await r.json().catch(() => ({ ok: false, error: 'bad json' }));
  if (!j.ok) throw new Error(j.error || '오류');
  if (j.statuses) STATUSES = j.statuses;
  return j;
}
const app = $('#app');
function setTab(t) { document.querySelectorAll('#tabs a').forEach((a) => a.classList.toggle('on', a.dataset.t === t)); }

/* ---------- 라우팅 ---------- */
async function route() {
  const h = location.hash.replace(/^#\/?/, '').split('?')[0];
  const [v, id] = h.split('/');
  setTab(v || '');
  try {
    if (!v) await dashboard();
    else if (v === 'jobs' && id) await jobDetail(id);
    else if (v === 'jobs') await jobs(new URLSearchParams(location.hash.split('?')[1] || '').get('s') || 'open');
    else if (v === 'orders') await orders();
    else if (v === 'intakes') await intakes();
    else if (v === 'leads') await leads();
    else if (v === 'reports') await reports();
    else if (v === 'playbook') await playbook(new URLSearchParams(location.hash.split('?')[1] || '').get('slug') || 'local-premium-annual');
    else app.innerHTML = '<div class="empty">없는 페이지</div>';
  } catch (e) { app.innerHTML = '<div class="alert err">' + esc(e.message) + '</div>'; }
  window.scrollTo(0, 0);
}
window.addEventListener('hashchange', route);
route();

/* ---------- 대시보드 ---------- */
async function dashboard() {
  const d = await api('summary'); if (!d) return;
  const open = (d.jobs.new || 0) + (d.jobs.info || 0) + (d.jobs.working || 0) + (d.jobs.qa || 0) + (d.jobs.ready || 0);
  const noStripe = !d.lastStripeEvent;
  app.innerHTML = '<h1>오늘</h1>' +
    (noStripe ? '<div class="alert">Stripe 웹훅 이벤트가 아직 한 건도 없습니다. 결제가 들어와도 여기 안 보이면 웹훅 설정(STRIPE_WEBHOOK_SECRET)을 확인하세요.</div>' : '') +
    '<div class="grid">' +
    tile(d.jobs.new || 0, '신규 주문', '#/jobs?s=new', d.jobs.new ? 'warn' : '') +
    tile(open, '진행 중 작업', '#/jobs') +
    tile(d.overdue, '마감 지남', '#/jobs', d.overdue ? 'warn' : 'good') +
    tile(d.dueToday, '오늘 마감', '#/jobs', d.dueToday ? 'warn' : '') +
    tile(money(d.monthRevenueCents), '이달 입금 (' + d.monthPayments + '건)', '#/orders') +
    tile(d.activeSubs + '<small style="font-size:13px;color:var(--ink-400)"> · ' + money(d.mrrCents) + '/월</small>', '활성 구독', '#/orders') +
    tile(d.pastDue, '미납 구독', '#/orders', d.pastDue ? 'warn' : '') +
    tile(d.unlinkedIntakes, '작업 없는 질문지', '#/intakes', d.unlinkedIntakes ? 'warn' : '') +
    tile(d.leads7d, '7일 진단 신청', '#/leads') +
    tile(d.reviewPending, '내가 검증할 단계', '#/jobs', d.reviewPending ? 'warn' : '') +
    tile(d.blockedTasks, '막힌 단계', '#/jobs', d.blockedTasks ? 'warn' : '') +
    tile(d.customerWait, '고객 대기 단계', '#/jobs') +
    '</div>' +
    '<div style="margin:12px 0;display:flex;gap:8px;flex-wrap:wrap"><button class="btn ghost sm" id="demo-add">데모 주문 만들기 (New Optix · Premium 12개월)</button><button class="btn ghost sm" id="demo-clear">데모 삭제</button><a class="btn ghost sm" href="#/playbook">자동화 지도 보기</a></div>' +
    '<h2>최근 활동</h2><div class="list">' + (d.recent.length ? d.recent.map((e) => '<a class="row" href="#/jobs/' + e.job_id + '"><div class="m"><div class="t" style="font-weight:600;white-space:normal">' + esc(e.note) + '</div><div class="s">작업 #' + e.job_id + '</div></div><div class="r">' + when(e.created_at) + '</div></a>').join('') : '<div class="empty">아직 활동이 없습니다</div>') + '</div>' +
    (d.lastStripeEvent ? '<p class="muted" style="margin-top:12px">마지막 Stripe 이벤트: ' + esc(d.lastStripeEvent.type) + ' · ' + when(d.lastStripeEvent.at) + '</p>' : '');
  $('#demo-add').onclick = async () => { try { const r = await api('demo', { slug: 'local-premium-annual' }); toast('데모 작업 #' + r.job_id); location.hash = '#/jobs/' + r.job_id; } catch (e) { toast('오류: ' + e.message); } };
  $('#demo-clear').onclick = async () => { if (!confirm('데모 주문·작업·질문지를 모두 삭제할까요?')) return; try { const r = await api('demo/clear', {}); toast('삭제 ' + r.removed + '건'); dashboard(); } catch (e) { toast('오류: ' + e.message); } };
}
function tile(n, l, href, cls) { return '<div class="tile ' + (cls || '') + '"><a href="' + href + '"><div class="n">' + n + '</div><div class="l">' + l + '</div></a></div>'; }

/* ---------- 작업 ---------- */
async function jobs(filter) {
  const d = await api('jobs?status=' + encodeURIComponent(filter)); if (!d) return;
  const chips = [['open', '진행 중'], ['', '전체']].concat(STATUSES);
  app.innerHTML = '<h1>작업</h1><div class="chips">' + chips.map(([k, l]) => '<a href="#/jobs?s=' + k + '" class="' + (k === filter ? 'on' : '') + '">' + esc(l) + '</a>').join('') + '</div>' +
    '<div class="list">' + (d.jobs.length ? d.jobs.map(jobRow).join('') : '<div class="empty">해당하는 작업이 없습니다</div>') + '</div>';
}
function jobRow(j) {
  const biz = j.business || j.i_business || j.customer_name || j.customer_email || '(업체명 없음)';
  const svc = j.service_name || j.o_service_name || j.service_slug || '상품 미확인';
  return '<a class="row" href="#/jobs/' + j.id + '"><div class="m"><div class="t">' + esc(biz) + '</div><div class="s">' + esc(svc) + (j.amount_cents ? ' · ' + money(j.amount_cents) : '') + (j.intake_id ? '' : ' · <span style="color:var(--amber)">질문지 없음</span>') + '</div></div>' +
    '<div class="r">' + stPill(j.status) + '<div style="margin-top:4px">' + (dueTag(j.due_date, j.status) || '<span class="muted">#' + j.id + '</span>') + '</div></div></a>';
}

async function jobDetail(id) {
  const d = await api('jobs/' + id); if (!d) return;
  const { job, order, payments, intake, events, deliverables, history, intakeCandidates } = d;
  const biz = job.business || (intake && intake.business) || (order && order.customer_name) || '(업체명 없음)';
  const svc = job.service_name || (order && order.service_name) || job.service_slug || '상품 미확인';
  app.innerHTML = '<a class="back" href="#/jobs">← 작업 목록</a>' +
    '<h1 style="margin-bottom:4px">' + esc(biz) + '</h1><div style="margin-bottom:12px">' + esc(svc) + ' · ' + stPill(job.status) + ' ' + dueTag(job.due_date, job.status) + '</div>' +
    '<div class="card"><div class="muted" style="margin-bottom:4px">상태 변경</div><div class="st">' + STATUSES.map(([k, l]) => '<button data-st="' + k + '" class="' + (k === job.status ? 'on' : '') + '">' + esc(l) + '</button>').join('') + '</div>' +
    '<div class="frm"><div class="h"><input class="in" id="due" type="date" value="' + esc(job.due_date || '') + '"><button class="btn ghost sm" id="due-save">마감 저장</button></div>' +
    '<div class="h"><input class="in" id="biz" placeholder="업체명" value="' + esc(job.business || '') + '"><button class="btn ghost sm" id="biz-save">업체명 저장</button></div></div></div>' +

    pipelineHtml(d) +

    '<h2>결제</h2><div class="card">' + (order ? '<dl class="kv">' +
      kv('상품', esc(order.service_name || order.service_slug || '미확인')) +
      kv('금액', money(order.amount_cents) + ' ' + (order.mode === 'subscription' ? '/ ' + esc(order.interval || 'month') : '일회성')) +
      kv('상태', oPill(order.status) + (order.cancel_at_period_end ? ' <span class="muted">기간 종료 시 해지 예약</span>' : '')) +
      kv('납부', (order.paid_count || 0) + '회' + (order.last_paid_at ? ' · 최근 ' + day(order.last_paid_at) : '') + (order.current_period_end ? ' · 다음 갱신 ' + day(order.current_period_end) : '')) +
      kv('고객', esc(order.customer_name || '') + (order.customer_phone ? ' · <a href="tel:' + esc(order.customer_phone) + '">' + esc(order.customer_phone) + '</a>' : '')) +
      kv('이메일', '<a href="mailto:' + esc(order.customer_email) + '">' + esc(order.customer_email) + '</a>') +
      kv('Stripe', (order.stripe_customer_id ? '<a target="_blank" href="https://dashboard.stripe.com/customers/' + esc(order.stripe_customer_id) + '">고객</a>' : '') + (order.stripe_subscription_id ? ' · <a target="_blank" href="https://dashboard.stripe.com/subscriptions/' + esc(order.stripe_subscription_id) + '">구독</a>' : '') + (order.stripe_payment_intent ? ' · <a target="_blank" href="https://dashboard.stripe.com/payments/' + esc(order.stripe_payment_intent) + '">결제</a>' : '')) +
      kv('결제일', when(order.created_at)) + '</dl>' +
      (payments.length ? '<div class="muted" style="margin-top:10px">입금 내역</div><ul class="tl">' + payments.map((p) => '<li>' + money(p.amount_cents) + ' <span class="w">' + esc(p.reason || '') + ' · ' + when(p.paid_at) + '</span></li>').join('') + '</ul>' : '')
      : '<div class="muted">Stripe 결제 기록이 없습니다. 이메일 신청이거나 웹훅이 오기 전에 질문지가 먼저 들어온 경우입니다.' + (job.customer_email ? ' (' + esc(job.customer_email) + ')' : '') + '</div>') + '</div>' +

    '<h2>질문지</h2><div class="card">' + (intake ? '<dl class="kv">' +
      kv('업체', esc(intake.business)) + kv('담당자', esc(intake.contact_name)) +
      kv('연락처', '<a href="tel:' + esc(intake.phone) + '">' + esc(intake.phone) + '</a>') +
      kv('이메일', '<a href="mailto:' + esc(intake.email) + '">' + esc(intake.email) + '</a>') +
      kv('링크', linkify(intake.links)) + kv('상품', esc(intake.service || '')) + kv('제출', when(intake.created_at)) + '</dl>' +
      (intake.notes ? '<div class="muted" style="margin:10px 0 4px">요청사항</div><pre class="notes">' + esc(intake.notes) + '</pre>' : '')
      : '<div class="muted">아직 질문지가 제출되지 않았습니다. 딜리버리 기한은 질문지 제출 시점부터입니다.</div>' +
        (intakeCandidates.length ? '<div style="margin-top:10px">같은 이메일의 질문지: ' + intakeCandidates.map((c) => '<button class="btn ghost sm" data-link-intake="' + c.id + '">#' + c.id + ' ' + esc(c.business) + ' (' + day(c.created_at) + ')</button>').join(' ') + '</div>' : '')) + '</div>' +

    '<h2>결과물</h2><div class="card">' + (deliverables.length ? '<ul class="tl">' + deliverables.map((x) => '<li style="display:flex;gap:8px;align-items:center"><span style="flex:1">' + (x.url ? '<a target="_blank" href="' + esc(x.url) + '">' + esc(x.title) + '</a>' : esc(x.title)) + (x.sent_at ? ' <span class="w">발송 ' + when(x.sent_at) + '</span>' : '') + '</span><button class="btn ghost sm" data-sent="' + x.id + '" data-v="' + (x.sent_at ? 0 : 1) + '">' + (x.sent_at ? '발송 취소' : '발송함') + '</button></li>').join('') + '</ul>' : '<div class="muted">아직 결과물 링크가 없습니다</div>') +
      '<div class="frm" style="margin-top:10px"><input class="in" id="dl-title" placeholder="결과물 제목 (예: 프로필 최적화 리포트)"><div class="h"><input class="in" id="dl-url" placeholder="Drive 링크"><button class="btn sm" id="dl-add">추가</button></div></div></div>' +

    '<h2>타임라인</h2><div class="card"><div class="frm" style="margin-bottom:10px"><textarea class="in" id="note" placeholder="메모 (고객 통화 내용, 다음 할 일…)"></textarea><div><button class="btn sm" id="note-add">메모 남기기</button></div></div>' +
      '<ul class="tl">' + events.map((e) => '<li>' + (e.kind === 'status' ? '<b>' + esc(stLabel(e.from_status) ) + ' → ' + esc(stLabel(e.to_status)) + '</b> ' : '') + '<span class="note">' + esc(e.note) + '</span><div class="w">' + when(e.created_at) + '</div></li>').join('') + '</ul></div>' +

    (history.length ? '<h2>이 고객의 다른 작업</h2><div class="list">' + history.map((h) => '<a class="row" href="#/jobs/' + h.id + '"><div class="m"><div class="t">' + esc(h.service_name || h.service_slug || '') + '</div><div class="s">' + esc(h.business || '') + '</div></div><div class="r">' + stPill(h.status) + '<div>' + day(h.created_at) + '</div></div></a>').join('') + '</div>' : '');

  const reload = () => jobDetail(id);
  const act = async (fn, msg) => { try { await fn(); toast(msg); reload(); } catch (e) { toast('오류: ' + e.message); } };
  app.querySelectorAll('select[data-task]').forEach((sel) => sel.onchange = () => act(() => api('jobs/' + id + '/task/' + sel.dataset.task, { status: sel.value }), '단계 저장'));
  const seedBtn = $('#tasks-seed'); if (seedBtn) seedBtn.onclick = () => act(() => api('jobs/' + id + '/tasks/seed', { slug: job.service_slug }), '플레이북 생성');
  app.querySelectorAll('[data-st]').forEach((b) => b.onclick = () => { if (b.dataset.st === job.status) return; const note = (b.dataset.st === 'hold' || b.dataset.st === 'done') ? (prompt('메모 (선택)') || '') : ''; act(() => api('jobs/' + id + '/status', { status: b.dataset.st, note }), '상태: ' + stLabel(b.dataset.st)); });
  $('#due-save').onclick = () => act(() => api('jobs/' + id + '/due', { due_date: $('#due').value }), '마감 저장');
  $('#biz-save').onclick = () => act(() => api('jobs/' + id + '/business', { business: $('#biz').value }), '업체명 저장');
  $('#dl-add').onclick = () => act(() => api('jobs/' + id + '/deliverable', { title: $('#dl-title').value, url: $('#dl-url').value }), '결과물 추가');
  $('#note-add').onclick = () => act(() => api('jobs/' + id + '/note', { note: $('#note').value }), '메모 저장');
  app.querySelectorAll('[data-sent]').forEach((b) => b.onclick = () => act(() => api('jobs/' + id + '/deliverable/' + b.dataset.sent, { sent: b.dataset.v === '1' }), '저장'));
  app.querySelectorAll('[data-link-intake]').forEach((b) => b.onclick = () => act(() => api('jobs/' + id + '/link-intake', { intake_id: Number(b.dataset.linkIntake) }), '질문지 연결'));
}
function kv(k, v) { return '<dt>' + k + '</dt><dd>' + (v || '<span class="muted">—</span>') + '</dd>'; }

/* ---------- 서비스 파이프라인 (플레이북) ---------- */
const hrs = (m) => (m >= 60 ? (m / 60).toFixed(m % 60 ? 1 : 0) + '시간' : m + '분');
function pipelineHtml(d) {
  const { tasks, pipeline: p, who, phases, taskStatuses, job } = d;
  if (!tasks || !tasks.length) return '<h2>서비스 파이프라인</h2><div class="card"><div class="muted">이 작업에는 플레이북이 없습니다' + (job.service_slug ? ' (' + esc(job.service_slug) + ')' : ' — 상품 slug 미확인') + '.</div><div style="margin-top:8px"><button class="btn ghost sm" id="tasks-seed">플레이북 생성</button></div></div>';
  const bn = tasks.filter((t) => t.status !== 'done' && t.status !== 'skipped' && (t.who === 'blocked' || (t.who === 'david' && t.david_min >= 60) || (t.who === 'customer' && t.block)));
  return '<h2>서비스 파이프라인 <span class="muted" style="font-weight:500;font-size:12px">' + p.done + '/' + p.total + ' 완료</span></h2><div class="card">' +
    '<div class="pp">' + pp(p.autoPct + '%', '자동+AI 비율') + pp(p.verify, 'David 검증 단계') + pp(hrs(p.setupMin), 'David 셋업 시간') + pp(hrs(p.monthMin) + '/월', 'David 월간 시간') + pp(p.by.blocked, '막힘') + pp(p.by.customer, '고객 대기') + '</div>' +
    legend(who) +
    (bn.length ? '<div class="bn"><b>병목 ' + bn.length + '곳</b><ul style="margin:4px 0 0;padding-left:18px">' + bn.map((t) => '<li>' + who[t.who].icon + ' ' + esc(t.title) + (t.block ? ' — <span class="muted">' + esc(t.block) + '</span>' : '') + '</li>').join('') + '</ul></div>' : '') +
    taskList(tasks, who, phases, taskStatuses, true) + '</div>';
}
function pp(v, l) { return '<div><b>' + v + '</b><span>' + l + '</span></div>'; }
function legend(who) { return '<div class="lg">' + Object.entries(who).map(([k, w]) => '<span>' + w.icon + ' ' + esc(w.label) + ' <span class="muted">' + esc(w.desc) + '</span></span>').join('') + '<span><span class="vf">검증</span> David가 보고 승인해야 고객에게 나감</span></div>'; }
function taskList(tasks, who, phases, taskStatuses, editable) {
  let out = '';
  for (const [ph, label] of phases) {
    const rows = tasks.filter((t) => (t.phase || t.ph) === ph);
    if (!rows.length) continue;
    const open = rows.filter((t) => t.status !== 'done' && t.status !== 'skipped').length;
    out += '<details' + (ph === 'onboarding' || ph === 'setup' || !editable ? ' open' : '') + '><summary class="ph">' + esc(label) + ' <span class="muted" style="font-weight:500">' + rows.length + (editable ? '단계 · 남은 ' + open : '단계') + '</span></summary>';
    let svc = null;
    for (const t of rows) {
      const sn = t.service_name || t.serviceName || '';
      if (sn !== svc) { svc = sn; out += '<div class="sv">' + esc(sn) + '</div>'; }
      const w = who[t.who] || { icon: '', label: t.who };
      const st = t.status || (t.who === 'blocked' ? 'blocked' : 'todo');
      const min = t.david_min != null ? t.david_min : t.min;
      out += '<div class="tk ' + esc(st) + '"><div class="ic">' + w.icon + '</div><div class="m"><div class="t">' + esc(t.title || t.t) + (t.verify ? '<span class="vf">검증</span>' : '') + '</div>' +
        (t.block ? '<div class="b ' + (t.who === 'blocked' ? 'red' : '') + '">' + esc(t.block) + '</div>' : '') + (t.next ? '<div class="b nx">→ ' + esc(t.next) + '</div>' : '') + (t.note ? '<div class="b">📝 ' + esc(t.note) + '</div>' : '') + '</div>' +
        '<div class="r">' + (editable ? '<select data-task="' + t.id + '">' + taskStatuses.map(([k, l]) => '<option value="' + k + '"' + (k === st ? ' selected' : '') + '>' + esc(l) + '</option>').join('') + '</select>' : '<span class="pill ' + esc(t.who) + '" style="background:var(--bg);color:var(--ink-600)">' + esc(w.label) + '</span>') +
        (min ? '<span class="mn">David ' + min + '분' + ({ weekly: '/주', daily: '/일', monthly: '/월' }[t.phase || t.ph] || '') + '</span>' : '') + '</div></div>';
    }
    out += '</details>';
  }
  return out;
}

/* ---------- 플레이북 탭 ---------- */
async function playbook(slug) {
  const d = await api('playbook?slug=' + encodeURIComponent(slug)); if (!d) return;
  const pkgs = d.packages;
  const PL = { 'local-starter': 'Starter', 'local-growth': 'Growth', 'local-premium': 'Premium' }, PER = { monthly: '월간', six: '6개월', annual: '12개월' };
  const pname = (s) => { const m = /^(local-\w+)-(\w+)$/.exec(s); return m ? PL[m[1]] + ' ' + PER[m[2]] : (d.catalog.find((c) => c.slug === s) || {}).name || s; };
  const sm = d.summary || {};
  app.innerHTML = '<h1>자동화 지도</h1><p class="muted" style="margin:-6px 0 12px">상품을 고르면 고객이 들어왔을 때 돌아가는 단계와 지금 누가 하는지, David 시간이 얼마나 드는지 보입니다. 숫자는 functions/api/_playbook.js 기준 추정치입니다.</p>' +
    '<div class="chips">' + pkgs.map((p) => '<a href="#/playbook?slug=' + p.slug + '" class="' + (p.slug === slug ? 'on' : '') + '">' + esc(pname(p.slug)) + '</a>').join('') + '</div>' +
    '<div class="chips">' + d.catalog.map((c) => '<a href="#/playbook?slug=' + c.slug + '" class="' + (c.slug === slug ? 'on' : '') + '">' + esc(c.name) + '</a>').join('') + '</div>' +
    '<h2>패키지 비교 — David 실투입</h2><div class="list">' + pkgs.map((p) => '<a class="row" href="#/playbook?slug=' + p.slug + '"><div class="m"><div class="t">' + esc(pname(p.slug)) + '</div><div class="s">' + p.total + '단계 · 자동+AI ' + p.autoPct + '% · 검증 ' + p.verify + ' · 막힘 ' + p.blocked + '</div></div><div class="r"><b>' + hrs(p.setupMin) + '</b> 셋업<div><b>' + hrs(p.monthMin) + '</b>/월</div></div></a>').join('') + '</div>' +
    (d.tasks.length ? '<h2>' + esc(pname(slug)) + ' — ' + d.tasks.length + '단계</h2><div class="card"><div class="pp">' + pp(sm.autoPct + '%', '자동+AI 비율') + pp(sm.verify, 'David 검증 단계') + pp(hrs(sm.setupMin), 'David 셋업 시간') + pp(hrs(sm.monthMin) + '/월', 'David 월간 시간') + pp(sm.by.blocked, '막힘') + pp(sm.by.customer, '고객 대기') + '</div>' + legend(d.who) + taskList(d.tasks, d.who, d.phases, [], false) + '</div>' : '<div class="empty">해당 상품의 플레이북이 없습니다</div>');
}
function linkify(s) { return esc(s || '').replace(/(https?:\/\/[^\s,]+)/g, '<a target="_blank" href="$1">$1</a>'); }

/* ---------- 주문 ---------- */
async function orders() {
  const d = await api('orders'); if (!d) return;
  app.innerHTML = '<h1>주문 <span class="muted" style="font-size:13px;font-weight:500">Stripe 웹훅 기준</span></h1><div class="list">' + (d.orders.length ? d.orders.map((o) =>
    '<a class="row" href="' + (o.job_id ? '#/jobs/' + o.job_id : '#/orders') + '"><div class="m"><div class="t">' + esc(o.customer_name || o.customer_email || '') + '</div><div class="s">' + esc(o.service_name || o.service_slug || '상품 미확인') + '' + ' · ' + money(o.amount_cents) + (o.mode === 'subscription' ? '/' + esc(o.interval || 'month') : '') + '</div></div><div class="r">' + oPill(o.status) + '<div>' + day(o.created_at) + '</div></div></a>').join('') : '<div class="empty">아직 주문이 없습니다</div>') + '</div>';
}

/* ---------- 질문지 ---------- */
async function intakes() {
  const d = await api('intakes'); if (!d) return;
  app.innerHTML = '<h1>질문지</h1><div class="list">' + (d.intakes.length ? d.intakes.map((i) =>
    '<div class="row"><div class="m"><div class="t">' + esc(i.business) + '</div><div class="s">' + esc(i.service || '상품 미지정') + ' · ' + esc(i.contact_name || '') + ' · ' + esc(i.phone || '') + '</div></div><div class="r">' + (i.job_id ? '<a class="btn ghost sm" href="#/jobs/' + i.job_id + '">작업 #' + i.job_id + '</a>' : '<button class="btn sm" data-mk="' + i.id + '">작업 만들기</button>') + '<div>' + day(i.created_at) + '</div></div></div>').join('') : '<div class="empty">아직 질문지가 없습니다</div>') + '</div>';
  app.querySelectorAll('[data-mk]').forEach((b) => b.onclick = async () => { try { const r = await api('jobs/from-intake', { intake_id: Number(b.dataset.mk) }); location.hash = '#/jobs/' + r.job_id; } catch (e) { toast('오류: ' + e.message); } });
}

/* ---------- 리드 · 리포트 ---------- */
async function leads() {
  const d = await api('leads'); if (!d) return;
  app.innerHTML = '<h1>무료 진단 신청</h1><div class="list">' + (d.leads.length ? d.leads.map((l) =>
    '<div class="row"><div class="m"><div class="t">' + esc(l.business) + '</div><div class="s">' + esc(l.location || '') + ' · <a href="mailto:' + esc(l.email) + '">' + esc(l.email) + '</a></div></div><div class="r">' + (l.report_id ? '<a class="btn ghost sm" target="_blank" href="/report/' + esc(l.report_id) + '">리포트</a>' : '<span class="muted">리포트 없음</span>') + '<div>' + day(l.created_at) + '</div></div></div>').join('') : '<div class="empty">아직 신청이 없습니다</div>') + '</div>' +
    '<h1 style="margin-top:28px">무료 도구 이용자</h1><div class="list">' + ((d.toolLeads || []).length ? d.toolLeads.map((l) =>
    '<div class="row"><div class="m"><div class="t"><a href="mailto:' + esc(l.email) + '">' + esc(l.email) + '</a></div><div class="s">' + esc(l.business || '업체명 없음') + (l.phone ? ' · <a href="tel:' + esc(l.phone) + '">' + esc(l.phone) + '</a>' : '') + ' · ' + esc(l.tools || '') + '</div></div><div class="r"><span class="muted">' + l.uses + '회</span><div>' + day(l.last_at) + '</div></div></div>').join('') : '<div class="empty">아직 이용자가 없습니다</div>') + '</div>';
}
async function reports() {
  const d = await api('reports'); if (!d) return;
  app.innerHTML = '<h1>발급된 리포트</h1><div class="list">' + (d.reports.length ? d.reports.map((r) =>
    '<a class="row" target="_blank" href="/report/' + esc(r.id) + '"><div class="m"><div class="t">' + esc(r.business) + '</div><div class="s">' + esc(r.location || '') + '</div></div><div class="r">' + (r.total != null ? '<b style="color:' + (r.total >= 75 ? 'var(--green)' : r.total >= 55 ? 'var(--blue)' : 'var(--red)') + '">' + r.total + '점</b>' : '') + '<div>' + day(r.created_at) + '</div></div></a>').join('') : '<div class="empty">아직 리포트가 없습니다</div>') + '</div>';
}
`;

function esc(s) { return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
