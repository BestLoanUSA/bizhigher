/* 자동 생성 — automation/ai-runner/_report.js 의 @@report-core 구간(build.js 가 빌드마다 다시 쓴다). 직접 고치지 말 것 */
// @@report-core-start — 여기부터 @@report-core-end 까지는 fs·path 없이 도는 순수 함수만(build.js 가 functions/api/_report-view.js 로 복사한다)
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const LOGO = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="34" height="34" aria-hidden="true"><rect width="64" height="64" rx="15" fill="#0A4DF5"/><path d="M15 44 h9 v-9 h9 v-9 h6.5" stroke="#fff" stroke-width="6.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M38.5 15.5 h10 v10" stroke="#fff" stroke-width="6.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const BRAND = `<span class="brand">${LOGO}<b>Biz<i>Higher</i></b></span>`;

function kpiCard(k) {
  const d = k.delta ? `<span class="delta ${/^[-−]/.test(String(k.delta)) ? (k.good === false ? 'down' : 'down') : k.good === false ? 'down' : 'up'}">${esc(k.delta)}</span>` : '';
  return `<div class="kpi"><div class="l">${esc(k.label)}</div><div class="v">${esc(k.value ?? '–')}${d}</div>${k.note ? `<div class="n">${esc(k.note)}</div>` : ''}</div>`;
}
function chartSvg(c) {
  const vals = (c.values || []).map(Number); const n = vals.length; if (!n) return '';
  const W = 640, H = 220, padL = 44, padB = 34, padT = 18; const max = Math.max(1, ...vals) * 1.15; const bw = (W - padL - 16) / n;
  const bars = vals.map((v, i) => { const h = (v / max) * (H - padB - padT); const x = padL + i * bw + bw * 0.18, y = H - padB - h;
    return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${(bw * 0.64).toFixed(1)}" height="${h.toFixed(1)}" rx="6" fill="${i === n - 1 ? 'var(--c)' : '#C9D4F5'}"/><text x="${(x + bw * 0.32).toFixed(1)}" y="${(y - 6).toFixed(1)}" text-anchor="middle" class="cv">${esc(v)}</text><text x="${(x + bw * 0.32).toFixed(1)}" y="${H - 12}" text-anchor="middle" class="cl">${esc((c.labels || [])[i] ?? '')}</text>`; }).join('');
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(c.label || '')}"><line x1="${padL}" y1="${H - padB}" x2="${W - 10}" y2="${H - padB}" stroke="#E3E7EE"/>${bars}${c.label ? `<text x="${padL}" y="12" class="ct">${esc(c.label)}</text>` : ''}</svg>`;
}
function table(t) {
  return `<table><thead><tr>${(t.head || []).map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${(t.rows || []).map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
}
function section(s, i) {
  let body = '';
  if (s.text) body += `<p>${esc(s.text).replace(/\n/g, '<br>')}</p>`;
  if (s.tiles && s.tiles.length) body += `<div class="tiles">${s.tiles.map((t) => `<div class="tile"><b>${esc(t.n)}</b><span>${esc(t.label)}</span></div>`).join('')}</div>`;
  if (s.items && s.items.length) body += `<ul>${s.items.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`;
  if (s.table) body += table(s.table);
  if (s.chart) body += chartSvg(s.chart);
  if (s.before || s.after) body += `<div class="ba"><div class="col"><div class="h">Before</div>${(s.before || []).map(kpiCard).join('')}</div><div class="arrow">→</div><div class="col after"><div class="h">After</div>${(s.after || []).map(kpiCard).join('')}</div></div>`;
  if (s.images && s.images.length) body += `<div class="imgs">${s.images.slice(0, 6).map((u) => `<img src="${esc(u)}" alt="">`).join('')}</div>`;
  if (s.manual && s.manual.length) body += `<div class="manual">${s.manual.map((m) => `<div class="mrow"><span class="ml">${esc(m.label)}</span><span class="mv ${m.value ? '' : 'empty'}">${esc(m.value || '')}</span></div>`).join('')}<div class="mnote">비어 있는 칸은 담당자가 확인 후 채웁니다</div></div>`;
  if (s.progress != null) body += `<div class="prog"><div class="lbl"><span>${esc(s.progressLabel || '전체 진행')}</span><b>${esc(s.progress)}%</b></div><div class="bar"><i style="width:${Math.max(0, Math.min(100, Number(s.progress) || 0))}%"></i></div></div>`;
  if (s.steps && s.steps.length) body += `<div class="steps">${s.steps.map((x) => `<div class="step${x.you ? ' you' : ''}"><b>${esc(x.tag || (x.you ? '사장님 차례' : '진행 예정'))}</b><span>${esc(x.text)}</span></div>`).join('')}</div>`;
  if (s.scores) body += scoresHtml(s.scores);
  if (s.grids) body += gridsHtml(s.grids);
  if (s.note) body += `<p class="small">${esc(s.note)}</p>`;
  return `<section class="sec" id="s${i + 1}"><h2><span class="num">${String(i + 1).padStart(2, '0')}</span>${esc(s.title)}</h2>${body}</section>`;
}

/* 진단 점수 — 영역마다 시작(옅은 막대)과 지금(진한 막대), 합계는 위에 크게 */
function scoresHtml(sc) {
  const items = sc.items || [];
  const tot = (k) => items.reduce((n, x) => n + (Number(x[k]) || 0), 0), max = items.reduce((n, x) => n + (Number(x.max) || 20), 0) || 100;
  const hasB = items.some((x) => x.before != null);
  return `<div class="scores"><div class="stot">${hasB ? `<div><span>${esc(sc.beforeLabel || '시작')}</span><b class="was">${tot('before')}</b></div><i>→</i>` : ''}<div><span>${esc(sc.afterLabel || '지금')}</span><b>${tot('after')}</b><em>/ ${max}</em></div></div>
${items.map((x) => { const m = Number(x.max) || 20; const a = Math.max(0, Math.min(100, (Number(x.after) / m) * 100)), b = Math.max(0, Math.min(100, (Number(x.before) / m) * 100));
  return `<div class="srow"><span class="sl">${esc(x.label)}</span><span class="sbar">${hasB ? `<i class="sb" style="width:${b.toFixed(1)}%"></i>` : ''}<i class="sa" style="width:${a.toFixed(1)}%"></i></span><span class="sv">${hasB ? `<s>${esc(x.before)}</s> ` : ''}<b>${esc(x.after)}</b>/${m}</span></div>`; }).join('')}
${hasB ? `<div class="slegend"><span><i class="sb"></i>${esc(sc.beforeLabel || '시작')}</span><span><i class="sa"></i>${esc(sc.afterLabel || '지금')}</span></div>` : ''}</div>`;
}
/* 지도 순위 그리드 — places.js grid 의 7×7(0=20위 밖, -1=조회 실패). 1~3위 진한색 → 20위 밖 회색 */
function gridsHtml(g) {
  const cell = (v) => { const c = v < 0 ? 'na' : v === 0 ? 'out' : v <= 3 ? 'r1' : v <= 7 ? 'r2' : v <= 12 ? 'r3' : 'r4'; return `<span class="gc ${c}">${v < 0 ? '·' : v === 0 ? '20+' : v}</span>`; };
  const stat = (gr) => { const f = gr.flat(); const top3 = f.filter((v) => v > 0 && v <= 3).length; return `3위 안 <b>${top3}</b>/${f.length}지점`; };
  const one = (gr, label, cls) => gr ? `<div class="gbox ${cls || ''}"><div class="gh"><span>${esc(label)}</span><span>${stat(gr)}</span></div><div class="gg">${gr.map((r, i) => r.map((v, j) => (i === 3 && j === 3 ? cell(v).replace('class="gc', 'class="gc me') : cell(v))).join('')).join('')}</div></div>` : '';
  return `<div class="grids-k">검색어 <b>"${esc(g.keyword || '')}"</b>${g.radius ? ` · ${esc(g.radius)}` : ''} · 가운데 칸이 가게</div><div class="grids">${one(g.before, g.beforeLabel || '시작', 'was')}${one(g.after, g.afterLabel || '지금')}</div>
<div class="glegend"><span class="gc r1">1~3</span><span class="gc r2">4~7</span><span class="gc r3">8~12</span><span class="gc r4">13~20</span><span class="gc out">20+</span><em>구글 Places 검색 결과로 계산한 근사치 — 실제 지도 앱은 검색하는 사람에 따라 다를 수 있습니다</em></div>`;
}

/** report.json → HTML 문자열(자체 완결). fontHead 는 PDF 렌더 때 _fonts.js 가 주는 @font-face 블록(없으면 구글 폰트 링크) */
function renderHtml(r, { fontHead = '', robots = '' } = {}) {
  const b = r.business || {}; const color = /^#[0-9a-f]{6}$/i.test(b.color || '') ? b.color : '#0A4DF5';
  const name = b.name_ko && b.name ? `${esc(b.name_ko)} <span class="en">${esc(b.name)}</span>` : esc(b.name || b.name_ko || '');
  const css = `
:root{--c:${color};--ink:#0F172A;--ink2:#475569;--ink3:#94A3B8;--line:#E3E7EE;--paper:#fff;--tint:${color}12}
*{box-sizing:border-box}html,body{margin:0;background:#F3F5F9;color:var(--ink);font-family:'Noto Sans KR','Apple SD Gothic Neo','Malgun Gothic',system-ui,sans-serif;line-height:1.6;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.page{max-width:860px;margin:0 auto;background:var(--paper)}
.cover{padding:44px 48px 36px;border-bottom:1px solid var(--line);position:relative;overflow:hidden}
.cover::before{content:'';position:absolute;right:-120px;top:-120px;width:360px;height:360px;border-radius:50%;background:var(--tint)}
.brand{display:inline-flex;align-items:center;gap:10px;font-weight:800;font-size:20px;letter-spacing:-.01em}.brand b{font-weight:800}.brand i{font-style:normal;color:#0A4DF5}
.cover .biz{margin-top:38px;display:flex;align-items:center;gap:16px}.cover .biz img{height:56px;width:auto;border-radius:12px;border:1px solid var(--line);background:#fff;padding:4px}
.cover .nm{font-size:22px;font-weight:700;color:var(--ink2)}.cover .nm .en{font-weight:500;color:var(--ink3);margin-left:6px;font-size:16px}
.cover h1{font-size:40px;line-height:1.2;letter-spacing:-.02em;margin:14px 0 8px;font-weight:800}.cover .sub{font-size:17px;color:var(--ink2);margin:0}
.cover .meta{margin-top:22px;display:flex;gap:18px;flex-wrap:wrap;font-size:13.5px;color:var(--ink3)}.cover .meta b{color:var(--ink2);font-weight:600}
.summary{padding:26px 48px;background:var(--tint);border-bottom:1px solid var(--line)}.summary h2{font-size:13px;letter-spacing:.12em;text-transform:uppercase;color:var(--c);margin:0 0 10px}
.summary ul{margin:0;padding-left:20px;font-size:16.5px}.summary li{margin:4px 0}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(128px,1fr));gap:12px;padding:26px 48px 6px}
.kpi{border:1px solid var(--line);border-radius:14px;padding:14px 16px;background:#fff}.kpi .l{font-size:13px;color:var(--ink3)}.kpi .v{font-size:30px;font-weight:800;letter-spacing:-.02em;line-height:1.15;margin-top:2px}
.kpi .n{font-size:12.5px;color:var(--ink2);margin-top:4px}.delta{font-size:13px;font-weight:700;margin-left:8px;padding:2px 8px;border-radius:999px;vertical-align:middle}.delta.up{background:#ECFDF5;color:#047857}.delta.down{background:#FEF2F2;color:#B91C1C}
.sec{padding:26px 48px 8px;break-inside:avoid}.sec h2{font-size:21px;margin:0 0 10px;display:flex;align-items:center;gap:12px;letter-spacing:-.01em}.sec h2 .num{font-size:12px;font-weight:800;color:var(--c);background:var(--tint);border-radius:8px;padding:3px 8px;letter-spacing:.06em}
.sec p{margin:0 0 10px;font-size:15.5px;color:var(--ink2)}.sec ul{margin:0 0 10px;padding-left:20px;font-size:15.5px}.sec li{margin:4px 0}
table{width:100%;border-collapse:collapse;font-size:14px;margin:6px 0 12px}th{text-align:left;font-weight:700;color:var(--ink2);border-bottom:2px solid var(--line);padding:8px 10px;font-size:12.5px;letter-spacing:.02em}td{border-bottom:1px solid var(--line);padding:9px 10px;vertical-align:top}
.chart{width:100%;height:auto;margin:4px 0 12px}.chart .cv{font-size:13px;font-weight:700;fill:var(--ink)}.chart .cl{font-size:12px;fill:var(--ink3)}.chart .ct{font-size:12px;fill:var(--ink3);letter-spacing:.06em}
.ba{display:grid;grid-template-columns:1fr auto 1fr;gap:14px;align-items:start;margin:4px 0 12px}.ba .col{display:grid;gap:10px}.ba .h{font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:var(--ink3);font-weight:700}.ba .after .h{color:var(--c)}.ba .arrow{align-self:center;font-size:28px;color:var(--ink3)}
.imgs{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:4px 0 12px}.imgs img{width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:10px;border:1px solid var(--line)}
.manual{border:1px dashed #CBD5E1;border-radius:12px;padding:12px 14px;margin:4px 0 12px;background:#FAFBFD}.mrow{display:flex;justify-content:space-between;gap:12px;padding:6px 0;border-bottom:1px solid var(--line);font-size:14.5px}.mrow:last-of-type{border:0}.ml{color:var(--ink2)}.mv{font-weight:700;min-width:120px;text-align:right}.mv.empty{border-bottom:1.5px dashed #CBD5E1;min-height:18px}.mnote{font-size:12px;color:var(--ink3);margin-top:6px}
.small{font-size:12.5px!important;color:var(--ink3)!important}
.cta{margin:26px 48px 0;padding:18px 20px;border-radius:14px;background:var(--ink);color:#fff;font-size:15.5px}.cta b{color:#fff}
.foot{padding:22px 48px 34px;font-size:12.5px;color:var(--ink3);display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;border-top:1px solid var(--line);margin-top:26px}
@media (max-width:600px){.cover,.summary,.kpis,.sec,.foot{padding-left:20px;padding-right:20px}.cover h1{font-size:30px}.cta{margin:20px}.ba{grid-template-columns:1fr}.ba .arrow{transform:rotate(90deg);justify-self:center}.imgs{grid-template-columns:repeat(2,1fr)}}
.scores{border:1px solid var(--line);border-radius:14px;padding:16px 18px;margin:4px 0 12px}.stot{display:flex;align-items:flex-end;gap:16px;margin-bottom:12px}.stot div{display:flex;flex-direction:column}.stot span{font-size:12px;color:var(--ink3);font-weight:700}.stot b{font-size:40px;font-weight:800;line-height:1;letter-spacing:-.03em}.stot b.was{color:var(--ink3)}.stot em{font-style:normal;font-size:14px;color:var(--ink3);margin-left:2px}.stot div:last-child{flex-direction:row;align-items:baseline;flex-wrap:wrap}.stot div:last-child span{width:100%}.stot i{font-style:normal;font-size:24px;color:var(--ink3);padding-bottom:4px}
.srow{display:grid;grid-template-columns:96px 1fr 76px;gap:12px;align-items:center;padding:7px 0;font-size:14px}.sl{font-weight:600}.sbar{position:relative;height:12px;border-radius:999px;background:#EEF1F6;overflow:hidden}.sbar i{position:absolute;left:0;top:0;bottom:0;border-radius:999px}.sb{background:#C9D2E3}.sa{background:var(--c);height:6px!important;top:3px!important}.sv{text-align:right;color:var(--ink3);font-size:13px}.sv b{color:var(--ink);font-size:15px}.sv s{color:var(--ink3)}
.slegend{display:flex;gap:14px;font-size:12px;color:var(--ink3);margin-top:8px}.slegend i{display:inline-block;width:18px;height:6px;border-radius:9px;margin-right:6px;vertical-align:middle;position:static}
.grids-k{font-size:14px;color:var(--ink2);margin:0 0 10px}.grids{display:grid;grid-template-columns:1fr 1fr;gap:16px}.gbox{border:1px solid var(--line);border-radius:14px;padding:12px}.gbox.was{opacity:.85}.gh{display:flex;justify-content:space-between;font-size:13px;color:var(--ink2);margin-bottom:8px;font-weight:600}.gh b{color:var(--ink)}
.gg{display:grid;grid-template-columns:repeat(7,1fr);gap:4px}.gc{display:flex;align-items:center;justify-content:center;aspect-ratio:1;border-radius:7px;font-size:12px;font-weight:700}.gc.r1{background:var(--c);color:#fff}.gc.r2{background:color-mix(in srgb,var(--c) 55%,#fff);color:#fff}.gc.r3{background:color-mix(in srgb,var(--c) 25%,#fff);color:var(--ink)}.gc.r4{background:#EEF1F6;color:var(--ink2)}.gc.out,.gc.na{background:#F6F7FA;color:#B6BFCC;font-size:10px}.gc.me{outline:2.5px solid var(--ink);outline-offset:1px}
.glegend{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:10px 0 12px;font-size:11px}.glegend .gc{width:auto;aspect-ratio:auto;padding:2px 8px}.glegend em{font-style:normal;color:var(--ink3);font-size:11.5px;margin-left:4px}
.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(96px,1fr));gap:10px;margin:4px 0 12px}.tile{border:1px solid var(--line);border-radius:14px;padding:14px;display:flex;flex-direction:column;gap:2px}.tile b{font-size:28px;font-weight:800;letter-spacing:-.02em;line-height:1.1;color:var(--c)}.tile span{font-size:13px;color:var(--ink2)}
.cover .meta .live{display:inline-flex;align-items:center;gap:6px;color:#047857;font-weight:600}.cover .meta .live i{width:8px;height:8px;border-radius:50%;background:#10B981;box-shadow:0 0 0 4px rgba(16,185,129,.18)}
.steps{display:grid;gap:8px;margin:4px 0 12px}.step{display:flex;gap:12px;align-items:center;border:1px solid var(--line);border-radius:12px;padding:10px 14px;font-size:14.5px}.step b{flex:none;font-size:11.5px;font-weight:800;padding:3px 8px;border-radius:999px;background:var(--tint);color:var(--c)}.step.you{border-color:#F59E0B;background:#FFFBEB}.step.you b{background:#FEF3C7;color:#B45309}
.prog{margin:4px 0 14px}.prog .bar{height:12px;border-radius:999px;background:#EEF1F6;overflow:hidden}.prog .bar i{display:block;height:100%;border-radius:999px;background:var(--c)}.prog .lbl{display:flex;justify-content:space-between;font-size:13px;color:var(--ink2);margin-bottom:6px}.prog .lbl b{color:var(--ink);font-size:15px}
.ribbon{background:var(--ink);color:#fff;font-size:12.5px;text-align:center;padding:7px 12px;letter-spacing:.02em}
@media (max-width:600px){.grids{grid-template-columns:1fr}.srow{grid-template-columns:78px 1fr 64px;gap:8px}.gc{font-size:10.5px;border-radius:5px}}
@page{size:letter;margin:0}@media print{html,body{background:#fff}.page{max-width:none}.cover{padding-top:52px}.sec,.kpis{break-inside:avoid}}`;
  const fonts = fontHead || `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700;800&display=swap">`;
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(r.title || '리포트')} — ${esc(b.name || '')}</title>${robots ? `<meta name="robots" content="${esc(robots)}">` : ''}${fonts}<style>${css}</style></head><body><div class="page">${r.sample ? `<div class="ribbon">예시 리포트 · 가상의 업체와 예시 수치로 만들었습니다 · 실제 고객 리포트와 같은 판형</div>` : ''}
<header class="cover">${BRAND}<div class="biz">${b.logo ? `<img src="${esc(b.logo)}" alt="">` : ''}<div class="nm">${name}${b.city ? ` <span class="en">· ${esc(b.city)}</span>` : ''}</div></div>
<h1>${esc(r.title || '리포트')}</h1>${r.subtitle ? `<p class="sub">${esc(r.subtitle)}</p>` : ''}
<div class="meta">${r.live ? `<span class="live"><i></i>실시간 · <b>${esc(r.live)}</b> 기준</span>` : ''}${r.period ? `<span>기간 <b>${esc(r.period)}</b></span>` : ''}${r.date ? `<span>발행 <b>${esc(r.date)}</b></span>` : ''}<span>작성 <b>BizHigher</b></span></div></header>
${r.summary && r.summary.length ? `<section class="summary"><h2>한눈에 보기</h2><ul>${r.summary.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></section>` : ''}
${r.kpis && r.kpis.length ? `<div class="kpis">${r.kpis.map(kpiCard).join('')}</div>` : ''}
${(r.sections || []).map((s, i) => section(s, i)).join('')}
${r.cta ? `<div class="cta">${esc(r.cta)}</div>` : ''}
<footer class="foot"><span>${esc(r.notes || '수치는 구글·사이트·광고 계정의 공개·계정 데이터를 기준으로 하며, 측정 기준이 바뀌면 리포트에 적습니다.')}</span><span>BizHigher · hello@bizhigher.com · bizhigher.com</span></footer>
</div></body></html>`;
}


export { renderHtml, LOGO };
