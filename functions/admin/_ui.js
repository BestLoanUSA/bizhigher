/**
 * 관리자 페이지 화면 — 단일 HTML, 외부 의존 없음(폰트만). 360px 우선.
 * 설계: 2026-10-18 디자인 캔버스 (관제탑 · 고객 여정 · 검증 큐 · 폰).
 * 원칙: 모든 화면에서 "지금 내가 누를 버튼 하나"가 가장 크다. 색 = 공을 든 사람
 *   🟢 AI가 끝냄 · 🔵 내 차례 · 🟠 고객 차례 · 🔴 막힘
 * 데이터는 전부 /admin/api/* ([[path]].js).
 */

const CSS = `
:root{--blue:#0A4DF5;--blue-50:#EEF3FF;--navy:#0A1B4D;--ink:#111318;--ink-600:#4B5563;--ink-400:#6B7280;--line:#E5E7EB;--line-2:#F0F1F4;--bg:#F3F4F7;--red:#D3382F;--green:#0B9E58;--amber:#B45309;--amber-bg:#FEF3C7;--orange:#F59E0B;--purple:#6D28D9;--purple-bg:#EDE9FE}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}
body{margin:0;font-family:Pretendard,'Apple SD Gothic Neo','Malgun Gothic',system-ui,sans-serif;background:var(--bg);color:var(--ink);font-size:15px;line-height:1.5}
a{color:var(--blue);text-decoration:none}button{font:inherit;cursor:pointer}input,textarea,select{font:inherit}
.top{position:sticky;top:0;z-index:5;background:#fff;border-bottom:1px solid var(--line);display:flex;align-items:center;gap:10px;padding:10px 16px}
.logo{font-weight:800;font-size:17px;letter-spacing:-.01em;color:var(--ink)}.logo b{color:var(--blue)}.logo small{font-weight:600;color:var(--ink-400);margin-left:6px;font-size:12px}
.top .sp{flex:1}.top a.out{font-size:12px;color:var(--ink-400)}
.tabs{display:flex;gap:4px;overflow-x:auto;padding:8px 12px;background:#fff;border-bottom:1px solid var(--line);scrollbar-width:none}.tabs::-webkit-scrollbar{display:none}
.tabs a{flex:0 0 auto;padding:7px 13px;border-radius:999px;font-size:13.5px;font-weight:600;color:var(--ink-600);display:inline-flex;align-items:center;gap:5px}.tabs a.on{background:var(--navy);color:#fff}
.cnt{display:inline-block;min-width:18px;padding:0 5px;border-radius:999px;background:var(--red);color:#fff;font-size:11px;text-align:center;line-height:18px}
main{padding:16px;max-width:1100px;margin:0 auto}
h1{font-size:20px;margin:4px 0 12px;letter-spacing:-.01em}h2{font-size:15px;margin:0;font-weight:800}
.sec{background:#fff;border:1px solid var(--line);border-radius:16px;padding:6px 16px 10px;margin-bottom:14px}.sec-h{display:flex;align-items:center;gap:10px;padding:10px 0 6px;flex-wrap:wrap}.sec-h .m{font-size:12px;color:var(--ink-400)}
.hero{display:flex;flex-wrap:wrap;gap:10px;margin-bottom:14px}
.hero .big{flex:2 1 300px;background:var(--navy);color:#fff;border-radius:16px;padding:16px 18px;display:flex;flex-direction:column;gap:6px}.hero .big .l{font-size:12px;opacity:.8;font-weight:600;letter-spacing:.04em}.hero .big .n{font-size:38px;font-weight:800;line-height:1}.hero .big .n small{font-size:14px;opacity:.85;font-weight:500;margin-left:8px}
.chip{display:inline-block;padding:4px 10px;border-radius:999px;background:rgba(255,255,255,.14);font-size:12.5px;font-weight:600}
.tile{flex:1 1 140px;background:#fff;border:1px solid var(--line);border-radius:16px;padding:14px 16px;color:inherit}.tile .l{font-size:12px;color:var(--ink-400);font-weight:600}.tile .n{font-size:28px;font-weight:800;line-height:1.2}.tile .s{font-size:11.5px;color:var(--ink-400)}
.row{display:flex;align-items:center;gap:12px;padding:11px 0;border-top:1px solid var(--line-2);flex-wrap:wrap;color:var(--ink)}.row:first-child{border-top:0}
.dot{width:10px;height:10px;border-radius:50%;display:inline-block;flex:0 0 10px}.dot.s{width:8px;height:8px;flex-basis:8px}
.tag{padding:3px 9px;border-radius:6px;font-size:11.5px;font-weight:700;white-space:nowrap}.tag.verify{background:var(--purple-bg);color:var(--purple)}.tag.approve{background:#DBEAFE;color:#1D4ED8}.tag.manual{background:#E0F2FE;color:#0369A1}
.btn{display:inline-block;background:var(--blue);color:#fff;border:0;border-radius:10px;padding:9px 14px;font-weight:700;font-size:13.5px;white-space:nowrap}.btn.ghost{background:#fff;color:var(--ink);border:1.5px solid var(--line)}.btn.sm{padding:6px 11px;font-size:12.5px}.btn.lg{padding:14px 18px;font-size:15px;font-weight:800;border-radius:12px;white-space:normal;text-align:center}.btn.danger{color:var(--red)}.btn.white{background:#fff;color:var(--navy)}.btn:disabled{opacity:.5}
.due{font-size:12px;font-weight:700;white-space:nowrap}.due.over{color:var(--red)}.due.today{color:var(--red)}.due.soon{color:var(--amber)}.due.later{color:var(--ink-400)}.due.none{color:var(--ink-400)}
.bar{position:relative;display:block;height:12px;border-radius:999px;background:#EEF0F4;overflow:hidden}.bar i{position:absolute;left:0;top:0;bottom:0;border-radius:999px}.bar em{position:absolute;top:0;bottom:0;width:2px;background:#fff}
.av{width:40px;height:40px;border-radius:12px;color:#fff;display:inline-flex;align-items:center;justify-content:center;font-weight:800;font-size:15px;flex:0 0 40px}
.cust{display:flex;align-items:center;gap:14px;padding:13px 0;border-top:1px solid var(--line-2);color:var(--ink);flex-wrap:wrap}.cust:first-child{border-top:0}
.cust .nm{width:160px;flex:0 0 160px;min-width:0}.cust .nm b{display:block;font-size:14.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.cust .nm span{display:block;font-size:12px;color:var(--ink-400)}
.cust .pr{flex:1 1 220px;min-width:160px;display:flex;flex-direction:column;gap:5px}.cust .pr .t{display:flex;justify-content:space-between;font-size:11.5px;color:var(--ink-400)}.cust .pr .t b{color:var(--ink);font-size:13px}
.cust .nx{width:220px;flex:0 0 220px;min-width:0}.cust .nx span{display:block;font-size:12px;color:var(--ink-400)}.cust .nx b{display:flex;align-items:center;gap:6px;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:600}
.legend{display:flex;gap:12px;font-size:11.5px;color:var(--ink-400);padding:0 0 8px;flex-wrap:wrap}.legend span{display:inline-flex;align-items:center;gap:5px}
.chips{display:flex;gap:6px;overflow-x:auto;padding-bottom:6px;scrollbar-width:none}.chips::-webkit-scrollbar{display:none}.chips a,.chips button{flex:0 0 auto;border:1px solid var(--line);background:#fff;border-radius:999px;padding:6px 12px;font-size:12.5px;font-weight:600;color:var(--ink-600)}.chips .on{background:var(--blue);border-color:var(--blue);color:#fff}
@media(max-width:640px){.cust .nm{width:auto;flex:1 1 140px}.cust .nx{width:100%;flex-basis:100%}}
/* 여정 */
.jh{display:flex;align-items:flex-start;gap:14px;flex-wrap:wrap}.jh .pct{text-align:right}.jh .pct b{font-size:44px;font-weight:800;line-height:1;color:var(--blue)}.jh .pct span{display:block;font-size:12px;color:var(--ink-400)}
.ms{position:relative;padding:8px 0 2px}.ms .ln{position:absolute;left:24px;right:24px;top:19px;height:4px;background:var(--line);border-radius:2px}.ms .ln i{position:absolute;left:0;top:0;bottom:0;background:var(--blue);border-radius:2px}
.ms .g{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:6px;position:relative}.ms .g div{display:flex;flex-direction:column;align-items:center;gap:5px;text-align:center}.ms .c{width:26px;height:26px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;color:#fff;border:3px solid}.ms .l{font-size:12px;font-weight:700}.ms .s{font-size:10.5px;color:var(--ink-400)}
@media(max-width:640px){.ms .g{grid-template-columns:repeat(3,minmax(0,1fr));row-gap:14px}.ms .ln{display:none}}
.lanes{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-bottom:14px}@media(max-width:800px){.lanes{grid-template-columns:1fr}}
.lane{background:#fff;border:1px solid var(--line);border-top:4px solid;border-radius:14px;padding:12px 14px;min-width:0}.lane.mine{border-color:var(--blue);box-shadow:0 8px 24px rgba(10,77,245,.10)}.lane .h{display:flex;align-items:baseline;gap:8px;font-size:14px;font-weight:800}.lane .h small{font-size:12px;color:var(--ink-400);font-weight:500}
.li{display:flex;gap:8px;align-items:center;padding:8px 0;border-top:1px solid var(--line-2);font-size:13px}.li .m{flex:1;min-width:0}.li .m small{display:block;font-size:11.5px;color:var(--ink-400)}
.svc{display:flex;align-items:center;gap:12px;padding:9px 0;border-top:1px solid var(--line-2);flex-wrap:wrap}.svc .n{width:170px;flex:0 0 170px;font-size:13.5px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.svc .bar{flex:1 1 160px;min-width:100px;height:10px}.svc .p{width:40px;font-size:12.5px;font-weight:800;text-align:right}.svc .st{width:220px;flex:0 0 220px;display:inline-flex;align-items:center;gap:6px;font-size:12px;color:var(--ink-600);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
@media(max-width:640px){.svc .st{width:100%;flex-basis:100%}}
.now{background:var(--navy);color:#fff;border-radius:16px;padding:16px 18px;display:flex;flex-direction:column;gap:8px;margin-bottom:14px}@media(min-width:800px){.now{flex-direction:row;align-items:center;flex-wrap:wrap}.now .l{flex-basis:100%}.now .t{flex:1 1 300px}.now .d{flex:1 1 260px}.now .s{flex-basis:100%}}.now .l{font-size:12px;opacity:.8;font-weight:600;letter-spacing:.04em}.now .t{font-size:17px;font-weight:800;line-height:1.35}.now .d{font-size:13px;opacity:.9}.now .s{font-size:11.5px;opacity:.7}
.two{display:flex;gap:14px;align-items:flex-start;flex-wrap:wrap}.two .main{flex:1 1 520px;min-width:0}.two .side{flex:0 1 340px;min-width:280px}
@media(max-width:900px){.two .side{flex-basis:100%}}
.tl{list-style:none;margin:0;padding:0}.tl li{padding:8px 0;border-top:1px solid var(--line-2);font-size:13px}.tl li:first-child{border-top:0}.tl .w{font-size:11.5px;color:var(--ink-400)}
.kv{display:grid;grid-template-columns:84px 1fr;gap:5px 10px;font-size:13.5px}.kv dt{color:var(--ink-400);font-size:12.5px}.kv dd{margin:0;word-break:break-word}
pre.notes{white-space:pre-wrap;font:inherit;font-size:13.5px;background:var(--bg);border-radius:10px;padding:10px 12px;margin:0}
.in{width:100%;border:1.5px solid var(--line);border-radius:10px;padding:10px 12px;font-size:15px;background:#fff}textarea.in{min-height:72px;resize:vertical}.frm{display:flex;flex-direction:column;gap:8px}.frm .h{display:flex;gap:8px}.frm .h .in{flex:1}
.ph{font-size:13px;font-weight:800;color:var(--navy);margin:12px 0 2px;padding-top:10px;border-top:2px solid var(--line);cursor:pointer;list-style:none}.ph::-webkit-details-marker{display:none}.ph::before{content:'▸ ';color:var(--ink-400)}details[open]>.ph::before{content:'▾ '}details:first-of-type>.ph{border-top:0;padding-top:0}
.sv{font-size:12px;font-weight:700;color:var(--ink-400);margin:8px 0 2px}
.tk{display:flex;gap:8px;align-items:flex-start;padding:8px 0;border-top:1px solid var(--line-2)}.tk .ic{flex:0 0 18px;font-size:14px;line-height:1.5}.tk .m{flex:1;min-width:0}.tk .t{font-size:14px}.tk.done .t,.tk.skipped .t{color:var(--ink-400);text-decoration:line-through}.tk .b{font-size:12px;color:var(--ink-600);margin-top:2px}.tk .b.red{color:var(--red)}.tk .b.nx{color:var(--green)}
.tk .r{flex:0 0 auto;display:flex;flex-direction:column;align-items:flex-end;gap:4px}.tk select{font-size:12px;border:1px solid var(--line);border-radius:8px;padding:4px 6px;background:#fff}.tk .mn{font-size:11px;color:var(--ink-400)}.tk.review{background:#FDF4FF;margin:0 -16px;padding:8px 16px}.tk.hl{outline:2px solid var(--blue);outline-offset:-2px;border-radius:8px}
.vf{display:inline-block;font-size:10.5px;font-weight:800;padding:2px 6px;border-radius:6px;background:var(--purple-bg);color:var(--purple);margin-left:4px;vertical-align:middle}
.pp{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:10px}@media(min-width:720px){.pp{grid-template-columns:repeat(6,1fr)}}.pp div{background:var(--bg);border-radius:10px;padding:8px 10px}.pp b{display:block;font-size:17px}.pp span{font-size:11.5px;color:var(--ink-600)}
/* 검증 큐 */
.rv{background:#fff;border:1px solid var(--line);border-radius:16px;overflow:hidden;margin-bottom:12px}.rv .h{display:flex;align-items:center;gap:10px;padding:12px 18px;border-bottom:1px solid var(--line-2);flex-wrap:wrap;font-size:13.5px}.rv .b{padding:16px 18px;display:flex;flex-direction:column;gap:12px}.rv .f{display:flex;gap:10px;padding:12px 18px;border-top:1px solid var(--line-2);flex-wrap:wrap;align-items:center}
.prev{border:1px solid var(--line);border-radius:12px;padding:14px 16px;background:#FAFAFB;font-size:14px;line-height:1.7;white-space:pre-wrap;max-height:460px;overflow:auto}
.frame{border:1px solid var(--line);border-radius:12px;overflow:hidden;background:#fff}.frame iframe{width:100%;height:min(520px,70vh);border:0;display:block}
.cks{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}@media(max-width:640px){.cks{grid-template-columns:1fr}}.cks label{display:flex;gap:8px;align-items:flex-start;padding:9px 11px;border:1px solid var(--line);border-radius:10px;font-size:13px;cursor:pointer;background:#fff}.cks input{margin-top:3px}
.qi{display:flex;gap:10px;align-items:center;padding:9px 0;border-top:1px solid var(--line-2);font-size:13px;color:var(--ink)}.qi:first-child{border-top:0}.qi .n{width:22px;height:22px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;flex:0 0 22px}.qi .m{flex:1;min-width:0}.qi .m small{display:block;font-size:11.5px;color:var(--ink-400)}
.sw{display:flex;align-items:center;gap:10px;padding:8px 0;border-top:1px solid var(--line-2);font-size:13px;cursor:pointer}.sw input{width:18px;height:18px}.sw small{display:block;font-size:11.5px;color:var(--ink-400)}
.muted{color:var(--ink-400);font-size:13px}.empty{padding:28px 0;text-align:center;color:var(--ink-400)}
.alert{background:var(--amber-bg);border:1px solid #FCD34D;color:#92400E;border-radius:12px;padding:10px 14px;font-size:13.5px;margin-bottom:12px}.alert.err{background:#FEE2E2;border-color:#FCA5A5;color:#991B1B}.alert.ok{background:#D1FAE5;border-color:#6EE7B7;color:#065F46}
.back{display:inline-block;font-size:13px;margin-bottom:8px;color:var(--ink-600)}
.toast{position:fixed;left:50%;bottom:20px;transform:translateX(-50%);background:var(--navy);color:#fff;padding:10px 16px;border-radius:999px;font-size:13.5px;opacity:0;transition:opacity .2s;pointer-events:none;max-width:90vw;z-index:9}.toast.on{opacity:1}
.pill{display:inline-block;font-size:11.5px;font-weight:700;padding:3px 9px;border-radius:999px;background:var(--blue-50);color:var(--blue);white-space:nowrap}
.pill.new{background:#FEE2E2;color:var(--red)}.pill.info{background:var(--amber-bg);color:var(--amber)}.pill.working{background:var(--blue-50);color:var(--blue)}.pill.qa{background:var(--purple-bg);color:var(--purple)}.pill.ready{background:#D1FAE5;color:#047857}.pill.done{background:#E5E7EB;color:var(--ink-600)}.pill.hold{background:#F3F4F6;color:var(--ink-400)}
.pill.active,.pill.paid{background:#D1FAE5;color:#047857}.pill.past_due,.pill.incomplete{background:#FEE2E2;color:var(--red)}.pill.canceled,.pill.refunded{background:#E5E7EB;color:var(--ink-600)}
.login{max-width:360px;margin:14vh auto 0;padding:0 16px}.login .sec{padding:24px}
.aibox{background:#F0FDF4;border:1px solid #86EFAC;border-radius:14px;padding:12px 14px;margin-bottom:14px}.aibox.stuck{background:#FEF2F2;border-color:#FCA5A5}.aibox .h{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-weight:800;font-size:14px}.aibox .h small{font-weight:500;color:var(--ink-600);font-size:12px}
.sum{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:6px 0 10px}@media(min-width:720px){.sum{grid-template-columns:repeat(6,1fr)}}.sum div{background:var(--bg);border-radius:10px;padding:8px 10px}.sum b{display:block;font-size:18px}.sum span{font-size:11.5px;color:var(--ink-600)}
.res{margin-top:6px;border:1px solid var(--line);border-radius:10px;background:#FAFAFB;padding:10px 12px;font-size:13px;white-space:pre-wrap;max-height:260px;overflow:auto}
details.ai>summary{cursor:pointer;list-style:none}details.ai>summary::-webkit-details-marker{display:none}details.ai>summary .more{font-size:11.5px;color:var(--blue);margin-left:4px}
.badge-stuck{display:inline-block;padding:2px 7px;border-radius:6px;background:#FEE2E2;color:var(--red);font-size:11px;font-weight:800;margin-left:6px;vertical-align:middle}

`;

const FONT = `<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">`;

export function loginHtml({ error, unconfigured } = {}) {
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>BizHigher 관리자</title>${FONT}<style>${CSS}</style></head><body>
<div class="login"><div class="logo" style="margin-bottom:14px">Biz<b>Higher</b><small>ADMIN</small></div>
<div class="sec">${unconfigured
    ? `<div class="alert">아직 잠겨 있습니다. Cloudflare Pages → Settings → Environment variables (Production) 에 <b>ADMIN_PASSWORD</b> 를 넣고 재배포하면 열립니다.</div>`
    : `<form method="post" action="/admin/login" class="frm">${error ? `<div class="alert err">${error}</div>` : ''}
<input class="in" type="password" name="password" placeholder="비밀번호" autofocus autocomplete="current-password" required>
<button class="btn lg" type="submit">들어가기</button></form>`}
</div><p class="muted" style="text-align:center;margin-top:14px">bizhigher.com 운영 전용</p></div></body></html>`;
}

export function appHtml({ user, noDb } = {}) {
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>BizHigher 관리자</title>${FONT}<style>${CSS}</style></head><body>
<header class="top"><a class="logo" href="#/">Biz<b>Higher</b><small>ADMIN</small></a><span class="sp"></span><span class="muted" style="font-size:12px" id="clock"></span><a class="out" href="/admin/logout">나가기</a></header>
<nav class="tabs" id="tabs">
<a href="#/" data-t="">관제탑</a><a href="#/review" data-t="review">검증 큐 <span class="cnt" id="rv-cnt" style="display:none">0</span></a><a href="#/customers" data-t="customers">고객</a><a href="#/leads" data-t="leads">리드</a><a href="#/playbook" data-t="playbook">플레이북</a><a href="#/more" data-t="more">더보기</a>
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
const toDate = (s) => { if (!s) return null; const d = new Date(/Z|[+-]\d\d:?\d\d$/.test(s) ? s : s.replace(' ', 'T') + 'Z'); return isNaN(d) ? null : d; };
function when(s) { const d = toDate(s); return d ? d.toLocaleString('ko-KR', { timeZone: LA, month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : (s || ''); }
function day(s) { const d = toDate(s); return d ? d.toLocaleDateString('ko-KR', { timeZone: LA, month: 'numeric', day: 'numeric' }) : (s || ''); }
const hrs = (m) => (m >= 60 ? (m / 60).toFixed(m % 60 ? 1 : 0) + '시간' : m + '분');
const COLOR = { auto: '#0B9E58', ai: '#0B9E58', david: '#0A4DF5', customer: '#F59E0B', blocked: '#D3382F', none: '#D1D5DB' };
const AV = ['#0A1B4D', '#0A4DF5', '#0B9E58', '#6D28D9', '#B45309', '#4B5563', '#0369A1', '#9F1239'];
const avColor = (name) => AV[[...String(name || '')].reduce((a, c) => a + c.charCodeAt(0), 0) % AV.length];
const initial = (name) => { const s = String(name || '?').replace(/\s*\(데모\)/, '').trim(); return s[0] || '?'; };
const dueHtml = (di) => di && di.label ? '<span class="due ' + esc(di.tone) + '">' + esc(di.label) + '</span>' : '';
const kindTag = (k) => '<span class="tag ' + (k === '검증' ? 'verify' : k === '승인' ? 'approve' : 'manual') + '">' + esc(k) + '</span>';
let WHO = {}, STATUSES = [], TASK_STATUSES = [];
const stLabel = (k) => (STATUSES.find((s) => s[0] === k) || [k, k])[1];
const stPill = (k) => '<span class="pill ' + esc(k) + '">' + esc(stLabel(k)) + '</span>';
const oPill = (k) => k ? '<span class="pill ' + esc(k) + '">' + esc({ paid: '결제됨', active: '구독 중', past_due: '미납', canceled: '해지', refunded: '환불', incomplete: '미완료' }[k] || k) + '</span>' : '';
async function copyText(text) { try { await navigator.clipboard.writeText(text); return true; } catch { const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); return true; } catch { return false; } finally { ta.remove(); } } }
function toast(m) { const t = $('#toast'); t.textContent = m; t.classList.add('on'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('on'), 2200); }
async function api(path, body) {
  const r = await fetch('/admin/api/' + path, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {});
  if (r.status === 401) { location.href = '/admin/'; return null; }
  const j = await r.json().catch(() => ({ ok: false, error: 'bad json' }));
  if (!j.ok) throw new Error(j.error || '오류');
  if (j.who) WHO = j.who; if (j.statuses) STATUSES = j.statuses; if (j.taskStatuses) TASK_STATUSES = j.taskStatuses;
  return j;
}
const app = $('#app');
function setTab(t) { document.querySelectorAll('#tabs a').forEach((a) => a.classList.toggle('on', a.dataset.t === t)); }
function qs() { return new URLSearchParams(location.hash.split('?')[1] || ''); }
$('#clock').textContent = new Date().toLocaleString('ko-KR', { timeZone: LA, month: 'long', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit' });
async function updateReviewCount(n) { const el = $('#rv-cnt'); if (n == null) { try { const d = await api('review'); n = d.items.length; } catch { n = 0; } } el.textContent = n; el.style.display = n ? '' : 'none'; }

/* ---------- 라우팅 ---------- */
async function route() {
  const h = location.hash.replace(/^#\/?/, '').split('?')[0];
  const [v, id] = h.split('/');
  setTab(v === 'jobs' ? 'customers' : (v || ''));
  try {
    if (!v) await tower();
    else if (v === 'review') await review();
    else if (v === 'customers') await customers();
    else if (v === 'jobs' && id) await journey(id);
    else if (v === 'leads') await leads();
    else if (v === 'playbook') await playbook(qs().get('slug') || 'local-premium-annual');
    else if (v === 'more') await more();
    else app.innerHTML = '<div class="empty">없는 페이지</div>';
  } catch (e) { app.innerHTML = '<div class="alert err">' + esc(e.message) + '</div>'; }
  window.scrollTo(0, 0);
}
let towerSort = (() => { try { return localStorage.getItem('bh.sort') || 'due'; } catch { return 'due'; } })();
let towerFilter = 'all';
let rvTab = 0;
window.addEventListener('hashchange', route);
route(); updateReviewCount();

/* ---------- 관제탑 ---------- */
async function tower() {
  const d = await api('tower?sort=' + towerSort); if (!d) return;
  updateReviewCount(d.todo.filter((t) => t.kind !== '직접').length);
  const todo = d.todo;
  const list = applyFilter(d.customers);
  app.innerHTML =
    (d.lastStripeEvent ? '' : '<div class="alert">Stripe 웹훅 이벤트가 아직 없습니다. 실제 결제가 들어와도 여기 안 보이면 STRIPE_WEBHOOK_SECRET 설정을 확인하세요. (데모 데이터로 화면을 먼저 볼 수 있습니다)</div>') +
    '<section class="hero">' +
      '<a class="big" href="#/review"><span class="l">오늘 내 차례</span><span class="n">' + todo.length + '<small>건 · 예상 ' + hrs(d.todoMin) + '</small></span><span style="display:flex;gap:6px;flex-wrap:wrap;margin-top:4px">' + ['검증', '승인', '직접'].map((k) => '<span class="chip">' + k + ' ' + todo.filter((t) => t.kind === k).length + '</span>').join('') + '</span></a>' +
      tile(d.aiDone24h, 'AI가 끝냄 (24시간)', '단계 · 고객 ' + d.aiDoneJobs + '곳', 'var(--green)', '#/customers') +
      tile(d.customerWait, '고객 차례', '고객 ' + d.customerWaitJobs + '곳 · 리마인더 자동', 'var(--amber)', '#/customers?f=customer') +
      tile(d.aiStuck, 'AI 차례인데 멈춤', d.aiPending + '단계 대기 · 지시서 복사해 실행', d.aiStuck ? 'var(--red)' : 'inherit', '#/customers?f=stuck') +
      tile(d.blocked, '막힌 고객', d.blockedTasks + '단계 · GBP API · fal.ai 등', d.blocked ? 'var(--red)' : 'inherit', '#/customers?f=blocked') +
      tile(money(d.monthRevenueCents), '이달 입금 · 활성 구독', '구독 ' + d.activeSubs + ' · MRR ' + money(d.mrrCents), 'inherit', '#/more') +
    '</section>' +
    '<section class="sec"><div class="sec-h"><h2>내가 누를 것 — 마감 순</h2><span class="m">하나 끝내면 다음이 올라온다</span></div>' +
      (todo.length ? todo.map(todoRow).join('') : '<div class="empty">지금 내 차례인 단계가 없습니다. AI와 고객이 일하는 중입니다.</div>') + '</section>' +
    '<section class="sec"><div class="sec-h"><h2>고객 보드 — 0%에서 100%까지</h2><span class="sp" style="flex:1"></span>' +
      '<div class="chips">' + [['all', '전체 ' + d.customers.length], ['mine', '내 차례 ' + d.customers.filter((c) => isMine(c)).length], ['customer', '고객 차례 ' + d.customers.filter((c) => c.counts.customer).length], ['blocked', '막힘 ' + d.customers.filter((c) => c.counts.blockedAll).length], ['soon', '마감 임박 ' + d.customers.filter((c) => c.dueInfo.rank <= 1).length]].map(([k, l]) => '<button data-f="' + k + '" class="' + (towerFilter === k ? 'on' : '') + '">' + l + '</button>').join('') + '</div>' +
      '<div class="chips"><button data-s="due" class="' + (towerSort === 'due' ? 'on' : '') + '">마감 순</button><button data-s="progress" class="' + (towerSort === 'progress' ? 'on' : '') + '">진행률 낮은 순</button></div></div>' +
      legendHtml() + (list.length ? list.map(custRow).join('') : '<div class="empty">' + (d.customers.length ? '필터에 해당하는 고객이 없습니다' : '진행 중인 고객이 없습니다') + '</div>') +
      '<div style="margin:12px 0 4px;display:flex;gap:8px;flex-wrap:wrap"><button class="btn ghost sm" id="demo-one">데모: New Optix Premium 새 주문 1곳</button><button class="btn ghost sm" id="demo-add">데모 고객 4곳 (진행 중 상태)</button><button class="btn ghost sm" id="demo-clear">데모 삭제</button></div>' +
    '</section>' +
    (d.lastStripeEvent ? '<p class="muted">마지막 Stripe 이벤트: ' + esc(d.lastStripeEvent.type) + ' · ' + when(d.lastStripeEvent.at) + '</p>' : '');
  app.querySelectorAll('[data-f]').forEach((b) => b.onclick = () => { towerFilter = b.dataset.f; tower(); });
  app.querySelectorAll('[data-s]').forEach((b) => b.onclick = () => { towerSort = b.dataset.s; try { localStorage.setItem('bh.sort', towerSort); } catch {} tower(); });
  $('#demo-one').onclick = async () => { try { const r = await api('demo', { only: 'new optix', fresh: true }); toast('데모 주문 생성 — 이어서 결제 후 질문지를 써 주세요'); if (r.intake_url && confirm('데모 주문이 생겼습니다.\n\n실제 고객처럼 "결제 후 질문지"를 David가 직접 써야 다음 단계가 열립니다. 지금 질문지 페이지를 열까요? (이메일은 데모 주소로 미리 채워집니다)')) { window.open(r.intake_url, '_blank'); } location.hash = '#/jobs/' + r.jobs[0]; } catch (e) { toast('오류: ' + e.message); } };
  $('#demo-add').onclick = async () => { try { const r = await api('demo', {}); toast('데모 고객 ' + r.jobs.length + '곳 생성'); tower(); } catch (e) { toast('오류: ' + e.message); } };
  $('#demo-clear').onclick = async () => { if (!confirm('데모 고객·주문·질문지를 모두 삭제할까요?')) return; try { const r = await api('demo/clear', {}); toast('삭제 ' + r.removed + '건'); tower(); } catch (e) { toast('오류: ' + e.message); } };
  function applyFilter(cs) { return cs.filter((c) => towerFilter === 'all' || (towerFilter === 'mine' && isMine(c)) || (towerFilter === 'customer' && c.counts.customer) || (towerFilter === 'blocked' && c.counts.blockedAll) || (towerFilter === 'soon' && c.dueInfo.rank <= 1)); }
}
const isMine = (c) => c.next && (c.next.who === 'david' || c.next.status === 'review');
function tile(n, l, s, color, href) { return '<a class="tile" href="' + href + '"><div class="l">' + l + '</div><div class="n" style="color:' + color + '">' + n + '</div><div class="s">' + s + '</div></a>'; }
function todoRow(t) {
  return '<div class="row"><span class="dot" style="background:#0A4DF5"></span><b style="width:110px;flex:0 0 110px;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc((t.business || '').replace(' (데모)', '')) + '</b>' +
    '<span style="flex:1 1 240px;font-size:14px;min-width:0">' + esc(t.title) + '<span class="muted" style="font-size:12px"> · ' + esc(t.service_name || '') + '</span></span>' + kindTag(t.kind) +
    '<span class="muted" style="font-size:12px;width:48px;text-align:right">' + (t.min || 0) + '분</span>' + dueHtml(t.dueInfo) + '<a class="btn" href="' + t.href + '">' + esc(t.cta) + '</a></div>';
}
function legendHtml() { return '<div class="legend"><span><i class="dot s" style="background:#0B9E58"></i>AI 완료</span><span><i class="dot s" style="background:#0A4DF5"></i>내 차례</span><span><i class="dot s" style="background:#F59E0B"></i>고객 차례</span><span><i class="dot s" style="background:#D3382F"></i>막힘</span><span style="margin-left:auto">막대 구간: 온보딩 · 셋업 · 월간 운영(180일)</span></div>'; }
function custRow(c) {
  const n = c.next;
  const nextColor = n ? (n.status === 'review' || n.who === 'david' ? COLOR.david : n.who === 'customer' ? COLOR.customer : n.who === 'blocked' || n.status === 'blocked' ? COLOR.blocked : COLOR.auto) : COLOR.none;
  const nextText = n ? (n.who === 'customer' ? '고객: ' : n.who === 'auto' || (n.who === 'ai' && n.status !== 'review') ? 'AI: ' : '') + n.title + (n.min && n.who !== 'customer' ? ' (' + n.min + '분)' : '') : '전부 완료';
  const barColor = c.pct >= 90 ? '#0B9E58' : c.counts.customer && !isMine(c) ? '#F59E0B' : '#0A4DF5';
  return '<a class="cust" href="#/jobs/' + c.id + '"><span class="av" style="background:' + avColor(c.business) + '">' + esc(initial(c.business)) + '</span>' +
    '<span class="nm"><b>' + esc(c.business) + (c.aiStuck ? '<span class="badge-stuck">AI ' + c.stuckDays + '일 멈춤</span>' : '') + '</b><span>' + esc(c.service_name) + ' · D+' + c.day + '</span></span>' +
    '<span class="pr"><span class="t"><span>' + esc(c.phase) + '</span><b>' + c.pct + '%</b></span><span class="bar"><i style="width:' + c.pct + '%;background:' + barColor + '"></i><em style="left:10%"></em><em style="left:40%"></em></span><span style="display:flex;gap:4px">' + c.dots.map((x) => '<i class="dot s" style="background:' + x + '"></i>').join('') + '</span></span>' +
    '<span class="nx"><span>다음</span><b><i class="dot s" style="background:' + nextColor + '"></i>' + esc(nextText) + '</b></span>' + dueHtml(c.dueInfo) + '</a>';
}

/* ---------- 고객 목록 (완료 포함) ---------- */
async function customers() {
  const f = qs().get('f') || 'open';
  const d = await api('tower?sort=' + towerSort + '&scope=all'); if (!d) return;
  const rows = d.customers.filter((c) => f === 'all' || (f === 'open' && c.status !== 'done' && c.status !== 'hold') || (f === 'customer' && c.counts.customer) || (f === 'blocked' && c.counts.blockedAll) || (f === 'stuck' && c.aiStuck) || (f === 'done' && (c.status === 'done' || c.status === 'hold')));
  app.innerHTML = '<h1>고객</h1><div class="sec"><div class="sec-h"><div class="chips">' + [['open', '진행 중'], ['stuck', 'AI 멈춤'], ['customer', '고객 차례'], ['blocked', '막힘'], ['done', '완료·보류'], ['all', '전체']].map(([k, l]) => '<a href="#/customers?f=' + k + '" class="' + (f === k ? 'on' : '') + '">' + l + '</a>').join('') + '</div><span class="sp" style="flex:1"></span><div class="chips"><button data-s="due" class="' + (towerSort === 'due' ? 'on' : '') + '">마감 순</button><button data-s="progress" class="' + (towerSort === 'progress' ? 'on' : '') + '">진행률 낮은 순</button></div></div>' + legendHtml() + (rows.length ? rows.map(custRow).join('') : '<div class="empty">없음</div>') + '</div>';
  app.querySelectorAll('[data-s]').forEach((b) => b.onclick = () => { towerSort = b.dataset.s; try { localStorage.setItem('bh.sort', towerSort); } catch {} customers(); });
}

/* ---------- 고객 여정 ---------- */
async function journey(id) {
  const d = await api('jobs/' + id); if (!d) return;
  const unsent = (d.deliverables || []).filter((x) => !x.sent_at); const portal = d.portal || '';
  const { job, order, payments, intake, events, deliverables, tasks, lanes, services, milestones, next, summary, history, intakeCandidates, aiPending, stuck, stuckDays, brief, progressSummary: ps } = d;
  const isAiNext = next && (next.who === 'auto' || (next.who === 'ai' && next.status !== 'review'));
  const hl = qs().get('task');
  const biz = job.business || (order && order.customer_name) || '(업체명 없음)';
  const msState = { done: ['#0B9E58', '#0B9E58', '✓', '#111318'], now: ['#0A4DF5', '#BFDBFE', '', '#0A4DF5'], todo: ['#ffffff', '#D1D5DB', '', '#6B7280'], skip: ['#ffffff', '#E5E7EB', '–', '#9CA3AF'] };
  const intakeUrl = !intake ? '/thanks/?service=' + encodeURIComponent(job.service_slug || '') + '&email=' + encodeURIComponent(job.customer_email || '') + '&business=' + encodeURIComponent(job.business || '') + (order && order.customer_phone ? '&phone=' + encodeURIComponent(order.customer_phone) : '') : '';
  const intakeBtn = intakeUrl ? '<a class="btn lg white" target="_blank" rel="noopener" href="' + intakeUrl + '">질문지 쓰기 (새 탭 · 이메일 미리 채움)</a><span class="s">고객 대신 David가 써도 됩니다 — 같은 이메일이라 이 작업에 자동으로 붙습니다. 데모라면 실제 가게 정보·사진으로 쓰세요</span>' : '';
  const nowCard = next && isAiNext ? '<div class="now" style="background:' + (stuck ? '#7F1D1D' : 'var(--navy)') + '"><span class="l">지금 할 일 — AI 차례' + (stuck ? ' · ' + stuckDays + '일째 멈춤' : '') + '</span><span class="t">' + esc(next.title) + '</span><span class="d">AI 단계는 저절로 돌지 않습니다. 아래 버튼으로 지시서를 복사해 claude.ai(fulfillment)에 붙여넣으면 AI가 이 작업의 AI 단계 ' + aiPending.length + '개를 만들어 검증 큐에 올립니다.</span><button class="btn lg white" id="copy-brief">AI 실행 지시 복사 (' + aiPending.length + '단계)</button><span class="s">루틴이 붙으면 이 단계는 매일 자동으로 돕니다 (CLAUDE.md §19-16)</span></div>' : next ? '<div class="now"><span class="l">지금 할 일</span><span class="t">' + esc(next.title) + '</span><span class="d">' + (next.who === 'customer' ? '고객이 해야 합니다. 리마인더는 자동으로 나갑니다.' : next.status === 'review' ? 'AI가 만든 결과물을 보고 승인하면 다음 단계가 올라옵니다.' + (next.min ? ' 약 ' + next.min + '분.' : '') : next.who === 'david' ? 'David가 직접 하는 단계입니다.' + (next.min ? ' 약 ' + next.min + '분.' : '') : next.status === 'blocked' || next.who === 'blocked' ? '외부 승인·결정이 필요해 멈춰 있습니다.' : 'AI가 진행 중입니다. 끝나면 검증 큐에 올라옵니다.') + '</span>' +
    (next.status === 'review' ? '<a class="btn lg white" href="#/review?task=' + next.id + '">검증 시작 →</a>' : next.who === 'david' && next.status !== 'blocked' ? '<button class="btn lg white" data-done="' + next.id + '">끝냈어요 ✓</button>' : next.who === 'customer' && intakeBtn ? intakeBtn : '') +
    '<span class="s">' + (next.status === 'review' ? '승인하면 → 결과물 목록 등록 · 발송 대기 · 타임라인 기록 · 다음 단계가 내 차례로' : '완료 처리하면 다음 단계가 자동으로 올라옵니다') + '</span></div>' : '<div class="now"><span class="l">지금 할 일</span><span class="t">없음 — 모든 단계가 끝났습니다</span></div>';

  app.innerHTML = '<a class="back" href="#/">← 관제탑</a>' +
    '<section class="sec" style="padding:18px 18px 14px"><div class="jh"><span class="av" style="width:52px;height:52px;font-size:20px;flex-basis:52px;background:' + avColor(biz) + '">' + esc(initial(biz)) + '</span>' +
      '<div style="flex:1 1 300px;min-width:0"><h1 style="margin:0;font-size:22px">' + esc(biz) + '</h1><div style="font-size:13px;color:var(--ink-600)">' + esc(job.service_name || job.service_slug || '상품 미확인') + (order ? ' · ' + money(order.amount_cents) + (order.mode === 'subscription' ? '/' + esc(order.interval || 'month') : '') : '') + ' · 시작 ' + day(job.created_at) + ' · <b>D+' + job.day + ' / 180일</b> · ' + stPill(job.status) + ' ' + dueHtml(job.dueInfo) + (job.due_date ? ' <span class="muted">(마감 ' + esc(job.due_date) + ')</span>' : '') + '</div>' +
      '<div style="font-size:12.5px;color:var(--ink-600);margin-top:4px">' + (intake ? esc(intake.contact_name || '') + ' · <a href="tel:' + esc(intake.phone) + '">' + esc(intake.phone || '') + '</a> · ' : '') + (job.customer_email ? '<a href="mailto:' + esc(job.customer_email) + '">' + esc(job.customer_email) + '</a>' : '') + '</div></div>' +
      '<div class="pct"><b>' + job.pct + '%</b><span>딜리버리 진행률</span></div></div>' +
      '<div class="ms"><div class="ln"><i style="width:' + Math.max(0, Math.min(100, (milestones.filter((m) => m.state === 'done').length / 5) * 100)) + '%"></i></div><div class="g">' + milestones.map((m, i) => { const s = msState[m.state] || msState.todo; return '<div><span class="c" style="background:' + s[0] + ';border-color:' + s[1] + '">' + (s[2] || (i + 1)) + '</span><span class="l" style="color:' + s[3] + '">' + esc(m.label) + '</span><span class="s">' + esc(m.sub || '') + '</span></div>'; }).join('') + '</div></div></section>' +

    nowCard +
    '<section class="sec"><div class="sec-h"><h2>어디까지 됐나</h2><span class="m">단계 ' + tasks.length + '개 중</span></div>' +
      '<div class="sum"><div><b style="color:var(--green)">' + ps.done + '</b><span>완료</span></div><div><b style="color:var(--purple)">' + ps.review + '</b><span>검증 대기</span></div><div><b>' + ps.remaining + '</b><span>남음</span></div><div><b style="color:var(--green)">' + (ps.byOwner.auto.done + ps.byOwner.ai.done) + '/' + (ps.byOwner.auto.done + ps.byOwner.ai.done + ps.byOwner.auto.left + ps.byOwner.ai.left) + '</b><span>AI 단계</span></div><div><b style="color:var(--blue)">' + ps.byOwner.david.done + '/' + (ps.byOwner.david.done + ps.byOwner.david.left) + '</b><span>David 단계</span></div><div><b style="color:var(--amber)">' + ps.byOwner.customer.done + '/' + (ps.byOwner.customer.done + ps.byOwner.customer.left) + '</b><span>고객 단계</span></div></div>' +
      '<div style="display:flex;flex-direction:column;gap:6px">' + ps.byPhase.map((p) => '<div style="display:flex;align-items:center;gap:10px;font-size:13px"><span style="width:150px;flex:0 0 150px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(p.label.split(' — ')[0]) + '</span><span class="bar" style="flex:1;height:8px"><i style="width:' + Math.round((p.done / p.total) * 100) + '%;background:' + (p.done === p.total ? '#0B9E58' : '#0A4DF5') + '"></i></span><span style="width:60px;text-align:right;font-weight:700">' + p.done + '/' + p.total + '</span></div>').join('') + '</div>' +
      '<details style="margin-top:10px"><summary class="ph" style="border-top:0;padding-top:4px">완료된 것 ' + ps.done + '개 — 내용 보기</summary>' + tasks.filter((t) => t.status === 'done' || t.status === 'skipped').map((t) => aiItem(t, true)).join('') + '</details>' +
      '<details style="margin-top:4px"><summary class="ph" style="border-top:0;padding-top:4px">남은 것 ' + (ps.remaining + ps.review) + '개 — 누가 하나</summary>' + tasks.filter((t) => t.status !== 'done' && t.status !== 'skipped').map((t) => '<div class="li"><span class="ic">' + ((WHO[t.who] || {}).icon || '') + '</span><span class="m">' + esc(t.title) + '<small>' + esc(t.service_name) + ' · ' + esc((WHO[t.who] || {}).label || t.who) + (t.status === 'review' ? ' · 검증 대기' : t.status === 'doing' ? ' · 진행 중' : t.status === 'blocked' ? ' · 막힘' : '') + (t.david_min ? ' · ' + t.david_min + '분' : '') + '</small></span></div>').join('') + '</details>' +
    '</section>' +
    (aiPending.length ? '<div class="aibox' + (stuck ? ' stuck' : '') + '"><div class="h">AI가 할 차례 ' + aiPending.length + '단계' + (stuck ? '<span class="badge-stuck">' + stuckDays + '일째 멈춤</span>' : '') + '<small>저절로 돌지 않음 — 지시서를 복사해 claude.ai에 붙여넣거나 루틴이 실행</small><span style="flex:1"></span><button class="btn sm" id="copy-brief-2">지시서 복사</button></div>' + aiPending.map((t) => '<div class="li"><span class="ic">' + ((WHO[t.who] || {}).icon || '') + '</span><span class="m">' + esc(t.title) + '<small>' + esc(t.service_name) + (t.revise_note ? ' · 수정 요청: ' + esc(t.revise_note) : '') + (t.status === 'doing' ? ' · 진행 중' : '') + '</small></span></div>').join('') + '</div>' : '') +
    '<section class="lanes">' +
      '<div class="lane" style="border-color:#0B9E58"><div class="h">AI가 했음 <small>전체 ' + lanes.ai.length + '개 · 최근 완료 순 · 눌러서 내용 확인·수정</small></div>' + (lanes.ai.length ? lanes.ai.slice(0, 8).map((t) => aiItem(t, false)).join('') + (lanes.ai.length > 8 ? '<details style="margin-top:6px"><summary class="ph" style="border-top:0;padding-top:4px;color:var(--blue)">더 보기 ' + (lanes.ai.length - 8) + '개</summary>' + lanes.ai.slice(8).map((t) => aiItem(t, false)).join('') + '</details>' : '') : '<div class="muted" style="padding:8px 0">아직 없음</div>') + '</div>' +
      '<div class="lane mine"><div class="h" style="color:#0A4DF5">내 차례 <small>' + lanes.mine.length + '단계 · ' + lanes.mine.reduce((a, t) => a + (t.david_min || 0), 0) + '분</small></div>' + (lanes.mine.length ? lanes.mine.map((t) => '<div class="li">' + kindTag(t.status === 'review' ? (t.verify ? '검증' : '승인') : '직접') + '<span class="m">' + esc(t.title) + '<small>' + esc(t.service_name) + (t.david_min ? ' · ' + t.david_min + '분' : '') + '</small></span>' + (t.status === 'review' ? '<a class="btn sm" href="#/review?task=' + t.id + '">' + (t.verify ? '검증' : '승인') + '</a>' : '<button class="btn sm ghost" data-done="' + t.id + '">완료</button>') + '</div>').join('') : '<div class="muted" style="padding:8px 0">지금은 없음</div>') + '</div>' +
      '<div class="lane" style="border-color:#F59E0B"><div class="h" style="color:#B45309">고객 차례 <small>' + lanes.customer.length + '건 · 리마인더 자동</small></div>' + (lanes.customer.length ? lanes.customer.map((t) => '<div class="li"><span class="m">' + esc(t.title) + '<small>' + esc(t.service_name) + (t.block ? ' · ' + esc(t.block) : '') + '</small></span><button class="btn sm ghost" data-received="' + t.id + '">받았음</button></div>').join('') : '<div class="muted" style="padding:8px 0">기다리는 것 없음</div>') +
        (lanes.received && lanes.received.length ? '<details style="margin-top:10px"><summary class="ph" style="border-top:0;padding-top:4px;color:#B45309">받은 것 ' + lanes.received.length + '개 — 메모·되돌리기</summary>' + lanes.received.map((t) => '<div class="li" style="align-items:flex-start"><span class="m">' + esc(t.title) + '<small>' + esc(t.service_name) + ' · ' + when(t.done_at) + (t.note ? '</small><small style="display:block;color:var(--ink-900);white-space:pre-wrap">📝 ' + esc(t.note) : '') + '</small></span><span style="display:flex;gap:4px;flex-direction:column"><button class="btn sm ghost" data-recv-note="' + t.id + '">메모</button><button class="btn sm ghost" data-undo="' + t.id + '">되돌리기</button></span></div>').join('') + '</details>' : '') +
        (lanes.blocked.length ? '<div class="h" style="color:#D3382F;margin-top:10px">막힘 <small>' + lanes.blocked.length + '</small></div>' + lanes.blocked.map((t) => '<div class="li"><span class="m">' + esc(t.title) + '<small>' + esc(t.block || '') + '</small></span></div>').join('') : '') + '</div>' +
    '</section>' +

    '<section class="two"><div class="main">' +
      '<div class="sec"><div class="sec-h"><h2>서비스별 진행 — ' + services.length + '개</h2><span class="m">자동+AI ' + summary.autoPct + '% · David 셋업 ' + hrs(summary.setupMin) + ' · 월 ' + hrs(summary.monthMin) + '</span></div>' +
        services.map((s) => { const n = s.next; const dot = !n ? COLOR.auto : n.status === 'review' || n.who === 'david' ? COLOR.david : n.who === 'customer' ? COLOR.customer : n.status === 'blocked' || n.who === 'blocked' ? COLOR.blocked : COLOR.auto; const bar = s.pct >= 100 ? '#0B9E58' : s.pct === 0 ? '#D1D5DB' : dot === COLOR.customer ? '#F59E0B' : '#0A4DF5'; return '<div class="svc"><span class="n">' + esc(s.name) + '</span><span class="bar"><i style="width:' + s.pct + '%;background:' + bar + '"></i></span><span class="p">' + s.pct + '%</span><span class="st"><i class="dot s" style="background:' + dot + '"></i>' + esc(!n ? '완료 ' + s.done + '/' + s.total : (n.status === 'review' ? '내 차례 · ' : n.who === 'david' ? '내 차례 · ' : n.who === 'customer' ? '고객 차례 · ' : n.status === 'blocked' || n.who === 'blocked' ? '막힘 · ' : 'AI · ') + n.title) + '</span></div>'; }).join('') + '</div>' +
      '<div class="sec"><details' + (hl ? ' open' : '') + '><summary class="ph" style="border-top:0;padding-top:4px">전체 단계 ' + tasks.length + '개 (상태 직접 바꾸기)</summary>' + taskList(tasks, WHO, d.phases, TASK_STATUSES, true, hl) + '<div style="margin-top:8px"><button class="btn ghost sm" id="tasks-seed">플레이북 다시 생성</button></div></details></div>' +
      '<div class="sec"><div class="sec-h"><h2>결제 · 질문지</h2></div>' + (order ? '<dl class="kv">' + kv('상품', esc(order.service_name || order.service_slug || '미확인')) + kv('금액', money(order.amount_cents) + ' ' + (order.mode === 'subscription' ? '/ ' + esc(order.interval || 'month') : '일회성')) + kv('상태', oPill(order.status) + (order.cancel_at_period_end ? ' <span class="muted">기간 종료 시 해지 예약</span>' : '')) + kv('납부', (order.paid_count || 0) + '회' + (order.last_paid_at ? ' · 최근 ' + day(order.last_paid_at) : '') + (order.current_period_end ? ' · 다음 갱신 ' + day(order.current_period_end) : '')) + kv('Stripe', (order.stripe_customer_id ? '<a target="_blank" href="https://dashboard.stripe.com/customers/' + esc(order.stripe_customer_id) + '">고객</a>' : '') + (order.stripe_subscription_id ? ' · <a target="_blank" href="https://dashboard.stripe.com/subscriptions/' + esc(order.stripe_subscription_id) + '">구독</a>' : '') + (order.stripe_payment_intent ? ' · <a target="_blank" href="https://dashboard.stripe.com/payments/' + esc(order.stripe_payment_intent) + '">결제</a>' : '') + (order.stripe_session_id && order.stripe_session_id.startsWith('demo_') ? '<span class="muted">데모</span>' : '')) + '</dl>' : '<div class="muted">Stripe 결제 기록 없음 — 이메일 신청이거나 웹훅 이전 주문</div>') +
        (intake ? '<dl class="kv" style="margin-top:10px">' + kv('업체', esc(intake.business)) + kv('담당자', esc(intake.contact_name)) + kv('링크', linkify(intake.links)) + kv('제출', when(intake.created_at)) + '</dl>' + (intake.notes ? '<pre class="notes" style="margin-top:8px">' + linkify(intake.notes) + '</pre>' : '') : '<div class="muted" style="margin-top:8px">질문지 미제출' + (intakeUrl ? ' — <a class="btn sm" target="_blank" rel="noopener" href="' + intakeUrl + '">질문지 쓰기 (새 탭)</a>' : '') + (intakeCandidates.length ? ' — 같은 이메일: ' + intakeCandidates.map((c) => '<button class="btn ghost sm" data-link-intake="' + c.id + '">#' + c.id + ' ' + esc(c.business) + '</button>').join(' ') : '') + '</div>') +
        '<div class="frm" style="margin-top:10px"><div class="h"><input class="in" id="due" type="date" value="' + esc(job.due_date || '') + '"><button class="btn ghost sm" id="due-save">마감 저장</button></div><div class="h"><input class="in" id="biz" placeholder="업체명" value="' + esc(job.business || '') + '"><button class="btn ghost sm" id="biz-save">업체명 저장</button></div><div class="h"><select class="in" id="jst">' + STATUSES.map(([k, l]) => '<option value="' + k + '"' + (k === job.status ? ' selected' : '') + '>' + esc(l) + '</option>').join('') + '</select><button class="btn ghost sm" id="jst-save">작업 상태 저장</button></div></div></div>' +
    '</div><div class="side">' +
      (d.site ? '<div class="sec"><div class="sec-h"><h2>웹사이트</h2><a class="btn ghost sm" target="_blank" rel="noopener" href="' + esc(d.site.preview_url) + '">미리보기 열기</a></div><div class="muted" style="font-size:13px">' + esc(d.site.preview_url) + (d.site.preview_host ? ' · 서브도메인 ' + esc(d.site.preview_host.replace('https://', '')) + '(배포 시 자동 등록)' : '') + '</div><div class="muted" style="font-size:13px">스펙 v' + d.site.version + ' · ' + day(d.site.updated_at) + (d.site.domain ? ' · 도메인 ' + esc(d.site.domain) + (d.site.live ? ' (색인 허용)' : '') : ' · 도메인 미연결(임시 주소, 검색 비노출)') + '</div><div class="frm" style="margin-top:8px"><div class="h"><input class="in" id="site-domain" placeholder="고객 도메인 (예 newoptix.com)" value="' + esc(d.site.domain || '') + '"><button class="btn sm" id="site-domain-save">연결</button></div><span class="muted" style="font-size:12px">고객이 DNS(CNAME → bizhigher-sites.pages.dev)를 바꾼 뒤 누르세요. 다음 루틴 빌드부터 그 도메인이 canonical 이 됩니다</span></div></div>' : '') +
      '<div class="sec"><div class="sec-h"><h2>결과물 · 고객 전달</h2><a class="btn ghost sm" target="_blank" rel="noopener" href="' + esc(portal) + '?preview=1">고객 페이지 미리보기</a></div>' +
        (unsent.length ? '<div class="now" style="padding:12px 14px;margin:6px 0 10px"><span class="l">전달 안 된 결과물 ' + unsent.length + '건' + (unsent.filter((x) => !x.summary).length ? ' · 요약 없음 ' + unsent.filter((x) => !x.summary).length + '건(다음 루틴이 씀)' : '') + '</span><button class="btn lg white" id="send-packet">고객에게 묶음 보내기 (' + unsent.length + '건)</button><span class="s">한 통으로 갑니다: 고객 페이지 링크 + 결과물 목록·요약' + (unsent.some((x) => x.needs_approval) ? ' + 승인 요청(7일 무응답 시 승인)' : '') + '. 보낸 뒤 고객이 페이지에서 승인·수정 요청하면 타임라인에 올라옵니다</span></div>' : '<div class="muted" style="margin:4px 0 8px">전달할 결과물 없음 — 승인된 고객 전달 단계가 생기면 여기 쌓입니다</div>') +
        (deliverables.length ? '<ul class="tl">' + deliverables.map((x) => '<li style="display:flex;gap:8px;align-items:center"><span style="flex:1">' + (x.url ? '<a target="_blank" href="' + esc(x.url) + '">' + esc(x.title) + '</a>' : esc(x.title)) + (x.sent_at ? ' <span class="w">전달 ' + day(x.sent_at) + '</span>' : ' <span class="w" style="color:var(--amber)">전달 전</span>') + (x.needs_approval ? (x.approved_at ? ' <span class="w" style="color:var(--green)">고객 승인 ' + day(x.approved_at) + '</span>' : x.revise_note ? ' <span class="w" style="color:#D3382F">고객 수정 요청</span>' : ' <span class="w">승인 대기</span>') : '') + (x.summary ? '<small style="display:block;color:var(--ink-600)">' + esc(x.summary.slice(0, 160)) + '</small>' : '') + '</span><button class="btn ghost sm" data-sent="' + x.id + '" data-v="' + (x.sent_at ? 0 : 1) + '">' + (x.sent_at ? '취소' : '보냈음') + '</button></li>').join('') + '</ul>' : '') +
        '<div class="frm" style="margin-top:8px"><input class="in" id="dl-title" placeholder="결과물 제목 (Drive 파일 등 직접 추가)"><div class="h"><input class="in" id="dl-url" placeholder="링크"><button class="btn sm" id="dl-add">추가</button></div></div></div>' +
      '<div class="sec"><div class="sec-h"><h2>타임라인</h2></div><div class="frm" style="margin-bottom:8px"><textarea class="in" id="note" placeholder="메모 (통화 내용, 다음 할 일…)"></textarea><div><button class="btn sm" id="note-add">메모 남기기</button></div></div><ul class="tl">' + events.map((e) => '<li><span class="w">' + when(e.created_at) + '</span><br>' + (e.kind === 'status' ? '<b>' + esc(stLabel(e.from_status)) + ' → ' + esc(stLabel(e.to_status)) + '</b> ' : '') + esc(e.note) + '</li>').join('') + '</ul></div>' +
      (history.length ? '<div class="sec"><div class="sec-h"><h2>이 고객의 다른 작업</h2></div>' + history.map((h) => '<a class="row" href="#/jobs/' + h.id + '"><span style="flex:1">' + esc(h.service_name || h.service_slug || '') + '</span>' + stPill(h.status) + '<span class="muted">' + day(h.created_at) + '</span></a>').join('') + '</div>' : '') +
    '</div></section>';

  const reload = () => journey(id);
  const act = async (fn, msg) => { try { await fn(); toast(msg); reload(); } catch (e) { toast('오류: ' + e.message); } };
  for (const bid of ['copy-brief', 'copy-brief-2']) { const b = $('#' + bid); if (b) b.onclick = async () => toast((await copyText(brief)) ? '지시서 복사됨 — claude.ai에 붙여넣으세요' : '복사 실패 — 아래 지시서를 직접 선택하세요'); }
  app.querySelectorAll('[data-reopen]').forEach((b) => b.onclick = () => { const note = prompt('무엇을 고칠까요? (AI가 다시 합니다)'); if (!note) return; act(() => api('tasks/' + b.dataset.reopen + '/reopen', { note }), '다시 열림 — AI 차례로'); });
  app.querySelectorAll('[data-edit]').forEach((b) => b.onclick = () => { const box = app.querySelector('[data-editbox="' + b.dataset.edit + '"]'); box.style.display = box.style.display === 'none' ? '' : 'none'; });
  app.querySelectorAll('[data-editsave]').forEach((b) => b.onclick = () => { const box = app.querySelector('[data-editbox="' + b.dataset.editsave + '"]'); act(() => api('tasks/' + b.dataset.editsave + '/edit', { text: box.querySelector('textarea').value, url: box.querySelector('input').value }), '결과물 저장'); });
  app.querySelectorAll('[data-done]').forEach((b) => b.onclick = () => act(() => api('tasks/' + b.dataset.done + '/status', { status: 'done' }), '완료 — 다음 단계로'));
  app.querySelectorAll('[data-received]').forEach((b) => b.onclick = () => { const note = prompt('고객에게 무엇을 받았나요? (선택 — 예: 매장 사진 12장, 로고 PNG, GBP 관리자 초대 완료)\n나중에 "받은 것"에서 고치거나 되돌릴 수 있습니다.'); if (note === null) return; act(() => api('tasks/' + b.dataset.received + '/status', { status: 'done', note: note.trim() }), '받았음 — 아래 "받은 것"에서 수정·되돌리기 가능'); });
  app.querySelectorAll('[data-recv-note]').forEach((b) => b.onclick = () => { const t = (d.tasks || []).find((x) => x.id == b.dataset.recvNote) || {}; const note = prompt('받은 내용 메모', t.note || ''); if (note === null) return; act(() => api('tasks/' + b.dataset.recvNote + '/note', { note: note.trim() }), '메모 저장'); });
  app.querySelectorAll('[data-undo]').forEach((b) => b.onclick = () => { if (!confirm('"받았음"을 취소하고 다시 고객 차례로 돌릴까요?')) return; act(() => api('tasks/' + b.dataset.undo + '/undo', {}), '되돌림 — 다시 고객 차례'); });
  app.querySelectorAll('select[data-task]').forEach((sel) => sel.onchange = () => act(() => api('tasks/' + sel.dataset.task + '/status', { status: sel.value }), '단계 저장'));
  app.querySelectorAll('[data-sent]').forEach((b) => b.onclick = () => act(() => api('jobs/' + id + '/deliverable/' + b.dataset.sent, { sent: b.dataset.v === '1' }), '저장'));
  app.querySelectorAll('[data-link-intake]').forEach((b) => b.onclick = () => act(() => api('jobs/' + id + '/link-intake', { intake_id: Number(b.dataset.linkIntake) }), '질문지 연결'));
  $('#due-save').onclick = () => act(() => api('jobs/' + id + '/due', { due_date: $('#due').value }), '마감 저장');
  $('#biz-save').onclick = () => act(() => api('jobs/' + id + '/business', { business: $('#biz').value }), '업체명 저장');
  $('#jst-save').onclick = () => act(() => api('jobs/' + id + '/status', { status: $('#jst').value }), '작업 상태 저장');
  $('#dl-add').onclick = () => act(() => api('jobs/' + id + '/deliverable', { title: $('#dl-title').value, url: $('#dl-url').value }), '결과물 추가');
  if ($('#site-domain-save')) $('#site-domain-save').onclick = () => act(() => api('sites/' + d.site.slug + '/domain', { domain: $('#site-domain').value }), '도메인 저장 — 다음 빌드에 반영');
  if ($('#send-packet')) $('#send-packet').onclick = () => { const note = prompt('고객에게 덧붙일 한마디 (선택)'); if (note === null) return; act(() => api('jobs/' + id + '/send-packet', { note: note.trim() }), '고객에게 보냈습니다 — 고객 페이지 링크 포함'); };
  $('#note-add').onclick = () => act(() => api('jobs/' + id + '/note', { note: $('#note').value }), '메모 저장');
  $('#tasks-seed').onclick = () => act(() => api('jobs/' + id + '/tasks/seed', { slug: job.service_slug }), '플레이북 생성');
  if (hl) { const el = app.querySelector('.tk.hl'); if (el) setTimeout(() => el.scrollIntoView({ block: 'center' }), 50); }
}
function kv(k, v) { return '<dt>' + k + '</dt><dd>' + (v || '<span class="muted">—</span>') + '</dd>'; }
/* 완료된 단계 1건 — 결과물 펼쳐 보기 + 수정 요청 + 직접 고치기 */
function aiItem(t, showWho) {
  const has = !!(t.result_text || t.result_url);
  const w = WHO[t.who] || { icon: '', label: t.who };
  const head = '<span style="color:#0B9E58;font-weight:800">✓</span><span class="m">' + esc(t.title) + (has ? '<span class="more">내용 보기 ▾</span>' : '') + '<small>' + esc(t.service_name) + (showWho ? ' · ' + esc(w.label) : '') + ' · ' + day(t.done_at) + (t.note ? ' · ' + esc(t.note) : '') + '</small></span>';
  if (!has) return '<div class="li">' + head + '</div>';
  const body = (t.result_url ? '<div style="margin-top:6px"><a class="btn ghost sm" target="_blank" href="' + esc(t.result_url) + '">' + (/drive\.google/.test(t.result_url) ? 'Drive에서 열기' : '열기') + ' ↗</a> <span class="muted" style="font-size:12px">' + esc(t.result_url) + '</span></div>' : '') +
    (t.result_kind === 'images' || t.result_kind === 'video' ? '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:6px;margin-top:6px">' + mediaUrls(t.result_text).map((u) => mediaTag(u, 8)).join('') + '</div>' : '') +
    (t.result_text ? (t.result_kind === 'html' ? '<div class="frame" style="margin-top:6px"><iframe sandbox="" srcdoc="' + esc(t.result_text) + '" title="결과물"></iframe></div>' : '<div class="res">' + esc(t.result_text) + '</div>') : '') +
    (t.self_check ? '<div class="muted" style="font-size:12px;margin-top:4px">AI 자기 점검: ' + esc(t.self_check) + '</div>' : '') +
    '<div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap"><button class="btn ghost sm" data-reopen="' + t.id + '">수정 요청 (AI 재작업)</button><button class="btn ghost sm" data-edit="' + t.id + '">직접 고치기</button></div>' +
    '<div data-editbox="' + t.id + '" style="display:none;margin-top:8px" class="frm"><textarea class="in" style="min-height:140px;font-size:13px">' + esc(t.result_text || '') + '</textarea><div class="h"><input class="in" placeholder="링크" value="' + esc(t.result_url || '') + '"><button class="btn sm" data-editsave="' + t.id + '">저장</button></div></div>';
  return '<details class="ai"><summary class="li">' + head + '</summary><div style="padding:0 0 8px 26px">' + body + '</div></details>';
}
/* 결과물 본문에서 이미지·영상 URL 추출 + 태그 (영상은 재생 가능) */
function mediaUrls(s) { return (s || '').match(/https?:\/\/\S+\.(?:jpe?g|png|webp|gif|mp4|webm)/gi) || []; }
function mediaTag(u, r) { return /\.(mp4|webm)$/i.test(u) ? '<video src="' + esc(u) + '" controls preload="metadata" playsinline style="width:100%;border-radius:' + r + 'px;border:1px solid var(--line);display:block;background:#000"></video>' : '<a href="' + esc(u) + '" target="_blank"><img src="' + esc(u) + '" alt="" style="width:100%;border-radius:' + r + 'px;border:1px solid var(--line);display:block"></a>'; }
function linkify(s) { return esc(s || '').replace(/(https?:\/\/[^\s,]+)/g, '<a target="_blank" href="$1">$1</a>'); }

function taskList(tasks, who, phases, taskStatuses, editable, hl) {
  let out = '';
  for (const [ph, label] of phases) {
    const rows = tasks.filter((t) => (t.phase || t.ph) === ph);
    if (!rows.length) continue;
    const open = rows.filter((t) => t.status !== 'done' && t.status !== 'skipped').length;
    out += '<details' + (ph === 'onboarding' || ph === 'setup' || !editable || rows.some((t) => String(t.id) === hl) ? ' open' : '') + '><summary class="ph">' + esc(label) + ' <span class="muted" style="font-weight:500">' + rows.length + (editable ? '단계 · 남은 ' + open : '단계') + '</span></summary>';
    let svc = null;
    for (const t of rows) {
      const sn = t.service_name || t.serviceName || '';
      if (sn !== svc) { svc = sn; out += '<div class="sv">' + esc(sn) + '</div>'; }
      const w = who[t.who] || { icon: '', label: t.who };
      const st = t.status || (t.who === 'blocked' ? 'blocked' : 'todo');
      const min = t.david_min != null ? t.david_min : t.min;
      out += '<div class="tk ' + esc(st) + (String(t.id) === hl ? ' hl' : '') + '"><div class="ic">' + w.icon + '</div><div class="m"><div class="t">' + esc(t.title || t.t) + (t.verify ? '<span class="vf">검증</span>' : '') + '</div>' +
        (t.block ? '<div class="b ' + (t.who === 'blocked' ? 'red' : '') + '">' + esc(t.block) + '</div>' : '') + (t.next ? '<div class="b nx">→ ' + esc(t.next) + '</div>' : '') + (t.note ? '<div class="b">📝 ' + esc(t.note) + '</div>' : '') + (t.revise_note ? '<div class="b">✎ ' + esc(t.revise_note) + '</div>' : '') + '</div>' +
        '<div class="r">' + (editable ? '<select data-task="' + t.id + '">' + taskStatuses.map(([k, l]) => '<option value="' + k + '"' + (k === st ? ' selected' : '') + '>' + esc(l) + '</option>').join('') + '</select>' : '<span class="pill" style="background:var(--bg);color:var(--ink-600)">' + esc(w.label) + '</span>') +
        (min ? '<span class="mn">David ' + min + '분' + ({ weekly: '/주', daily: '/일', monthly: '/월' }[t.phase || t.ph] || '') + '</span>' : '') + '</div></div>';
    }
    out += '</details>';
  }
  return out;
}

/* ---------- 검증 큐 ---------- */
async function review() {
  const d = await api('review'); if (!d) return;
  updateReviewCount(d.items.length);
  const want = qs().get('task');
  let idx = want ? d.items.findIndex((t) => String(t.id) === want) : 0; if (idx < 0) idx = 0;
  const cur = d.items[idx];
  const toneBtn = (k, i) => i < idx ? ['#D1FAE5', '#065F46'] : i === idx ? ['#0A4DF5', '#ffffff'] : ['#E5E7EB', '#4B5563'];
  app.innerHTML = '<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px"><a class="back" href="#/" style="margin:0">← 관제탑</a><span class="sp" style="flex:1"></span><span class="muted">남은 <b style="color:var(--ink)">' + d.items.length + '</b>건 · 예상 ' + d.totalMin + '분</span><button class="btn ghost sm" id="rv-sync" title="Places 공개 리뷰를 지금 읽어 새 리뷰가 있으면 답글 단계를 만든다 (평소엔 루틴이 하루 1회)">새 리뷰 확인</button></div>' +
    '<section class="two"><div class="main">' + (cur ? reviewCard(cur) : '<div class="sec" style="padding:36px 20px;text-align:center"><div style="font-size:40px;font-weight:800;color:var(--green)">0</div><div style="font-weight:700;font-size:16px">검증할 것이 없습니다</div><div class="muted" style="margin-top:4px">AI가 만든 결과물이 생기면 여기 올라옵니다. 발송 대기 결과물은 각 고객의 "결과물 · 발송"에서 보세요.</div><a class="btn" style="margin-top:14px" href="#/">관제탑으로</a></div>') +
    '</div><div class="side">' +
      '<div class="sec"><div class="sec-h"><h2>큐 — 마감 순</h2></div>' + (d.items.length ? d.items.map((t, i) => { const [bg, fg] = toneBtn(t.kind, i); return '<a class="qi" href="#/review?task=' + t.id + '"><span class="n" style="background:' + bg + ';color:' + fg + '">' + (i + 1) + '</span><span class="m"><b>' + esc((t.business || '').replace(' (데모)', '')) + '</b> · ' + esc(t.service_name) + '<small>' + esc(t.title) + ' · ' + (t.david_min || 0) + '분 · ' + esc(t.dueInfo.label || '') + '</small></span></a>'; }).join('') : '<div class="muted">비어 있음</div>') + '</div>' +
      '<div class="sec"><div class="sec-h"><h2>자동 승인 (검수 없이 내보냄)</h2></div><div class="muted" style="font-size:12px;padding-bottom:4px">켜면 그 단계는 큐에 안 올라오고 바로 완료되며 타임라인에 "자동 승인"으로 남는다. 고객에게 가는 것은 묶음 보내기 전 미리보기로 한 번 더 본다. (2026-10-22: 위험 낮은 4개부터 켬)</div>' + d.autoRules.map((r) => '<label class="sw"><input type="checkbox" data-rule="' + esc(r.key) + '"' + (r.on ? ' checked' : '') + '><span style="flex:1">' + esc(r.label) + '<small>' + esc(r.desc) + '</small></span></label>').join('') + '</div>' +
    '</div></section>';
  if (cur) {
    const after = (r, msg) => { toast(msg); updateReviewCount(); location.hash = r.next ? '#/review?task=' + r.next : '#/review'; if (!r.next || String(r.next) === want) review(); };
    $('#rv-approve').onclick = async () => { const b = $('#rv-approve'); b.disabled = true; try { const r = await api('tasks/' + cur.id + '/approve', { note: ($('#rv-note') || {}).value || '' }); after(r, '승인됨 · ' + (cur.business || '').replace(' (데모)', '') + ' → 결과물 등록 · 발송 대기'); } catch (e) { toast('오류: ' + e.message); b.disabled = false; } };
    $('#rv-revise').onclick = () => { const p = $('#rv-revise-panel'); p.style.display = p.style.display === 'none' ? '' : 'none'; if (p.style.display !== 'none') $('#rv-revise-text').focus(); };
    $('#rv-revise-send').onclick = async () => { try { const r = await api('tasks/' + cur.id + '/revise', { note: $('#rv-revise-text').value }); after(r, '재작성 요청됨 · AI가 고치면 큐로 돌아옵니다'); } catch (e) { toast('오류: ' + e.message); } };
    $('#rv-edit').onclick = () => { const b = $('#rv-editbox'); b.style.display = b.style.display === 'none' ? '' : 'none'; if (b.style.display !== 'none') $('#rv-edit-text').focus(); };
    $('#rv-edit-cancel').onclick = () => { $('#rv-editbox').style.display = 'none'; };
    $('#rv-edit-save').onclick = async () => { try { await api('tasks/' + cur.id + '/edit', { text: $('#rv-edit-text').value, url: $('#rv-edit-url').value }); toast('결과물 저장됨'); review(); } catch (e) { toast('오류: ' + e.message); } };
    $('#rv-reject').onclick = async () => { const note = prompt('반려 사유 (선택)') ; if (note === null) return; try { const r = await api('tasks/' + cur.id + '/reject', { note }); after(r, '반려됨 · 타임라인에 기록'); } catch (e) { toast('오류: ' + e.message); } };
    app.querySelectorAll('[data-rtab]').forEach((b) => b.onclick = () => { rvTab = Number(b.dataset.rtab); review(); });
  }
  if ($('#rv-sync')) $('#rv-sync').onclick = async () => { try { const r = await api('reviews/sync', { force: true }); toast('리뷰 확인: 가게 ' + r.fetched + '곳 조회 · 새 답글 단계 ' + r.newTasks + '건' + (r.baseline ? ' · 기준선 ' + r.baseline + '건' : '') + (r.skipped.length ? ' · 건너뜀 ' + r.skipped.map((x) => x[1]).join(',') : '')); if (r.newTasks) toast('AI가 다음 루틴에서 답글 초안을 씁니다 (바로 원하면 "루틴 돌려줘")'); } catch (e) { toast('오류: ' + e.message); } };
  app.querySelectorAll('[data-rule]').forEach((cb) => cb.onchange = async () => { const rules = d.autoRules.map((r) => ({ ...r, on: r.key === cb.dataset.rule ? cb.checked : r.on })); try { await api('settings', { settings: { autoRules: rules, autoRulesVersion: 2 } }); toast('저장'); } catch (e) { toast('오류: ' + e.message); } });
}
function reviewCard(t) {
  const checks = t.checks || [];
  const url = t.result_url || '';
  const embeddable = /^https:\/\/([a-z0-9-]+\.)*(bizhigher-site\.pages\.dev|bizhigher-sites\.pages\.dev|bizhigher\.com)(\/|$)/i.test(url);
  let preview = '';
  if (t.result_kind === 'html' && t.result_text) preview = '<div class="frame"><iframe sandbox="" srcdoc="' + esc(t.result_text) + '" title="결과물 미리보기"></iframe></div>';
  else if (url && embeddable) preview = '<div class="frame"><iframe src="' + esc(url) + '" title="결과물 미리보기" loading="lazy"></iframe></div>';
  const imgs = mediaUrls(t.result_text);
  if ((t.result_kind === 'images' || t.result_kind === 'video') && imgs.length) preview += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:8px">' + imgs.map((u) => mediaTag(u, 10)).join('') + '</div>';
  if (t.result_text && t.result_kind !== 'html') preview += '<div class="prev">' + esc(t.result_text) + '</div>';
  if (url) preview += '<div><a class="btn ghost sm" target="_blank" href="' + esc(url) + '">' + (/drive\.google/.test(url) ? 'Drive에서 열기' : /\.pdf($|\?)/i.test(url) ? 'PDF 열기' : '새 탭에서 열기') + ' ↗</a> <span class="muted" style="font-size:12px">' + esc(url) + '</span></div>';
  if (!preview) preview = '<div class="prev muted">결과물이 아직 붙지 않았습니다. 결과물이 Drive에 있으면 고객 여정 화면에서 링크를 추가하세요.</div>';
  return '<div class="rv"><div class="h">' + kindTag(t.kind) + '<b>' + esc((t.business || '').replace(' (데모)', '')) + '</b><span class="muted">·</span><span>' + esc(t.service_name) + '</span><span class="sp" style="flex:1"></span><span class="muted" style="font-size:12px">AI 생성 ' + when(t.requested_at) + ' · 예상 ' + (t.david_min || 0) + '분 · 마감 ' + dueHtml(t.dueInfo) + '</span></div>' +
    '<div class="b"><h1 style="margin:0;font-size:19px">' + esc(t.title) + '</h1>' + (t.revise_note ? '<div class="alert">이전 수정 요청: ' + esc(t.revise_note) + '</div>' : '') + (t.key === 'rr-live' && t.note ? '<div class="prev" style="background:#FFFBEB;white-space:pre-wrap">' + esc(t.note) + '</div><div class="muted" style="font-size:12px">아래 답글을 복사해 GBP 앱·웹에서 이 리뷰에 붙여넣고 게시한 뒤 "승인"을 누르세요. 고치고 싶으면 "직접 고치기"로 수정 후 게시.</div>' : '') + preview +
      (checks.length ? '<div class="cks">' + checks.map((c) => '<label><input type="checkbox"><span>' + esc(c) + '</span></label>').join('') + '</div>' : '') +
      (t.self_check ? '<div class="muted" style="font-size:12px">AI 자기 점검: ' + esc(t.self_check) + '</div>' : '') +
      '<div id="rv-editbox" style="display:none" class="frm"><label style="font-weight:700;font-size:13.5px">결과물 직접 고치기 — 저장하면 이 내용이 결과물이 됩니다</label><textarea class="in" id="rv-edit-text" style="min-height:220px;font-size:13.5px">' + esc(t.result_text || '') + '</textarea><div class="h"><input class="in" id="rv-edit-url" placeholder="링크" value="' + esc(url) + '"><button class="btn sm" id="rv-edit-save">저장</button><button class="btn sm ghost" id="rv-edit-cancel">취소</button></div></div>' +
      '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><button class="btn ghost sm" id="rv-edit">✎ 직접 고치기</button><span class="muted" style="font-size:12px">작은 수정은 여기서 바로. 다시 만들게 하려면 아래 "수정 요청"</span></div>' +
      '<input class="in" id="rv-note" placeholder="승인 메모 (선택) — 결과물 끝에 [David 승인 메모]로 붙고 타임라인에 남음"></div>' +
    '<div class="f"><button class="btn lg" id="rv-approve" style="flex:1 1 220px">승인 → 결과물 등록 · 발송 대기 · 다음 건</button><button class="btn lg ghost" id="rv-revise">수정 요청 (AI 재작성)</button><button class="btn lg ghost danger" id="rv-reject">반려</button>' +
      '<span class="muted" style="font-size:12px;flex-basis:100%">승인 후 자동: 결과물 목록 등록 → Gmail 초안은 fulfillment 루틴이 생성(발송은 David) → 타임라인 기록 → 다음 단계가 내 차례로</span></div>' +
    '<div id="rv-revise-panel" style="display:none;padding:12px 18px;border-top:1px solid var(--line-2)"><div class="frm"><label for="rv-revise-text" style="font-weight:700;font-size:13.5px">무엇을 고칠까요? (AI가 바로 다시 씁니다)</label><textarea class="in" id="rv-revise-text" placeholder="예: 영문 설명이 너무 딱딱해요. 가족 손님 느낌으로."></textarea><div><button class="btn" id="rv-revise-send">재작성 요청</button></div></div></div></div>';
}

/* ---------- 리드 ---------- */
async function leads() {
  const d = await api('leads'); if (!d) return;
  app.innerHTML = '<h1>리드</h1><div class="sec"><div class="sec-h"><h2>무료 진단 신청</h2></div>' + (d.leads.length ? d.leads.map((l) => '<div class="row"><span style="flex:1;min-width:0"><b>' + esc(l.business) + '</b><span class="muted" style="display:block;font-size:12.5px">' + esc(l.location || '') + ' · <a href="mailto:' + esc(l.email) + '">' + esc(l.email) + '</a></span></span>' + (l.report_id ? '<a class="btn ghost sm" target="_blank" href="/report/' + esc(l.report_id) + '">리포트</a>' : '<span class="muted">리포트 없음</span>') + '<span class="muted">' + day(l.created_at) + '</span></div>').join('') : '<div class="empty">아직 신청이 없습니다</div>') + '</div>' +
    '<div class="sec"><div class="sec-h"><h2>무료 도구 이용자</h2></div>' + (d.toolLeads && d.toolLeads.length ? d.toolLeads.map((l) => '<div class="row"><span style="flex:1;min-width:0"><b>' + esc(l.business || l.email || '') + '</b><span class="muted" style="display:block;font-size:12.5px">' + esc(l.tool || '') + ' · <a href="mailto:' + esc(l.email) + '">' + esc(l.email) + '</a>' + (l.phone ? ' · ' + esc(l.phone) : '') + '</span></span><span class="muted">' + day(l.created_at) + '</span></div>').join('') : '<div class="empty">아직 없음</div>') + '</div>';
}

/* ---------- 더보기: 주문 · 질문지 · 리포트 ---------- */
async function more() {
  const [o, i, r] = await Promise.all([api('orders'), api('intakes'), api('reports')]);
  app.innerHTML = '<h1>더보기</h1>' +
    '<div class="sec"><div class="sec-h"><h2>주문 <span class="muted" style="font-weight:500;font-size:12px">Stripe 웹훅 기준</span></h2></div>' + (o.orders.length ? o.orders.map((x) => '<a class="row" href="' + (x.job_id ? '#/jobs/' + x.job_id : '#/more') + '"><span style="flex:1;min-width:0"><b>' + esc(x.customer_name || x.customer_email || '') + '</b><span class="muted" style="display:block;font-size:12.5px">' + esc(x.service_name || x.service_slug || '상품 미확인') + ' · ' + money(x.amount_cents) + (x.mode === 'subscription' ? '/' + esc(x.interval || 'month') : '') + '</span></span>' + oPill(x.status) + '<span class="muted">' + day(x.created_at) + '</span></a>').join('') : '<div class="empty">아직 주문이 없습니다</div>') + '</div>' +
    '<div class="sec"><div class="sec-h"><h2>질문지</h2></div>' + (i.intakes.length ? i.intakes.map((x) => '<div class="row"><span style="flex:1;min-width:0"><b>' + esc(x.business) + '</b><span class="muted" style="display:block;font-size:12.5px">' + esc(x.service || '상품 미지정') + ' · ' + esc(x.contact_name || '') + ' · ' + esc(x.phone || '') + '</span></span>' + (x.job_id ? '<a class="btn ghost sm" href="#/jobs/' + x.job_id + '">작업 #' + x.job_id + '</a>' : '<button class="btn sm" data-mk="' + x.id + '">작업 만들기</button>') + '<span class="muted">' + day(x.created_at) + '</span></div>').join('') : '<div class="empty">아직 질문지가 없습니다</div>') + '</div>' +
    '<div class="sec"><div class="sec-h"><h2>발급된 리포트</h2></div>' + (r.reports.length ? r.reports.map((x) => '<a class="row" target="_blank" href="/report/' + esc(x.id) + '"><span style="flex:1;min-width:0"><b>' + esc(x.business) + '</b><span class="muted" style="display:block;font-size:12.5px">' + esc(x.location || '') + '</span></span>' + (x.total != null ? '<b style="color:' + (x.total >= 75 ? 'var(--green)' : x.total >= 55 ? 'var(--blue)' : 'var(--red)') + '">' + x.total + '점</b>' : '') + '<span class="muted">' + day(x.created_at) + '</span></a>').join('') : '<div class="empty">아직 리포트가 없습니다</div>') + '</div>';
  app.querySelectorAll('[data-mk]').forEach((b) => b.onclick = async () => { try { const r = await api('jobs/from-intake', { intake_id: Number(b.dataset.mk) }); location.hash = '#/jobs/' + r.job_id; } catch (e) { toast('오류: ' + e.message); } });
}

/* ---------- 플레이북 ---------- */
async function playbook(slug) {
  const d = await api('playbook?slug=' + encodeURIComponent(slug)); if (!d) return;
  const PL = { 'local-starter': 'Starter', 'local-growth': 'Growth', 'local-premium': 'Premium' }, PER = { monthly: '월간', six: '6개월', annual: '12개월' };
  const pname = (s) => { const m = /^(local-\w+)-(\w+)$/.exec(s); return m ? PL[m[1]] + ' ' + PER[m[2]] : (d.catalog.find((c) => c.slug === s) || {}).name || s; };
  const sm = d.summary || {};
  app.innerHTML = '<h1>자동화 지도</h1><p class="muted" style="margin:-6px 0 12px">상품을 고르면 고객이 들어왔을 때 돌아가는 단계와 지금 누가 하는지, David 시간이 얼마나 드는지 보입니다. 숫자는 functions/api/_playbook.js 기준 추정치입니다.</p>' +
    '<div class="chips">' + d.packages.map((p) => '<a href="#/playbook?slug=' + p.slug + '" class="' + (p.slug === slug ? 'on' : '') + '">' + esc(pname(p.slug)) + '</a>').join('') + '</div>' +
    '<div class="chips">' + d.catalog.map((c) => '<a href="#/playbook?slug=' + c.slug + '" class="' + (c.slug === slug ? 'on' : '') + '">' + esc(c.name) + '</a>').join('') + '</div>' +
    '<div class="sec"><div class="sec-h"><h2>패키지 비교 — David 실투입</h2></div>' + d.packages.map((p) => '<a class="row" href="#/playbook?slug=' + p.slug + '"><span style="flex:1;min-width:0"><b>' + esc(pname(p.slug)) + '</b><span class="muted" style="display:block;font-size:12.5px">' + p.total + '단계 · 자동+AI ' + p.autoPct + '% · 검증 ' + p.verify + ' · 막힘 ' + p.blocked + '</span></span><span style="text-align:right;font-size:12.5px"><b>' + hrs(p.setupMin) + '</b> 셋업<br><b>' + hrs(p.monthMin) + '</b>/월</span></a>').join('') + '</div>' +
    (d.tasks.length ? '<div class="sec"><div class="sec-h"><h2>' + esc(pname(slug)) + ' — ' + d.tasks.length + '단계</h2></div><div class="pp"><div><b>' + sm.autoPct + '%</b><span>자동+AI 비율</span></div><div><b>' + sm.verify + '</b><span>David 검증 단계</span></div><div><b>' + hrs(sm.setupMin) + '</b><span>David 셋업 시간</span></div><div><b>' + hrs(sm.monthMin) + '/월</b><span>David 월간 시간</span></div><div><b>' + sm.by.blocked + '</b><span>막힘</span></div><div><b>' + sm.by.customer + '</b><span>고객 대기</span></div></div>' + taskList(d.tasks, d.who, d.phases, [], false) + '</div>' : '<div class="empty">해당 상품의 플레이북이 없습니다</div>');
}
`;

function esc(s) { return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
