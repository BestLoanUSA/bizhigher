/* 자동 생성 — automation/ai-runner/_report.js 의 @@report-core 구간(build.js 가 빌드마다 다시 쓴다). 직접 고치지 말 것 */
// @@report-core-start — 여기부터 @@report-core-end 까지는 fs·path 없이 도는 순수 함수만(build.js 가 functions/api/_report-view.js 로 복사한다)
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const LOGO = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="34" height="34" aria-hidden="true"><rect width="64" height="64" rx="15" fill="#0A4DF5"/><path d="M15 44 h9 v-9 h9 v-9 h6.5" stroke="#fff" stroke-width="6.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M38.5 15.5 h10 v10" stroke="#fff" stroke-width="6.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const BRAND = `<span class="brand">${LOGO}<b>Biz<i>Higher</i></b></span>`;

function kpiCard(k) {
  const d = k.delta ? `<span class="delta ${/^[-−]/.test(String(k.delta)) ? (k.good === false ? 'down' : 'down') : k.good === false ? 'down' : 'up'}">${esc(k.delta)}</span>` : '';
  return `<div class="kpi"><div class="l">${esc(k.label)}</div><div class="v">${esc(k.value ?? '–')}${d}</div>${k.note ? `<div class="n">${esc(k.note)}</div>` : ''}${k.trend ? spark(k.trend) : ''}</div>`;
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
  let body = blockBody(s);
  if (s.blocks && s.blocks.length) body += `<div class="blocks${Number(s.cols) === 3 ? ' c3' : ''}">${s.blocks.map((b) => `<div class="blk${Number(b.span) >= 2 ? ' s' + Number(b.span) : ''}">${b.h ? `<h3>${esc(b.h)}</h3>` : ''}${blockBody(b)}</div>`).join('')}</div>`;
  return `<section class="sec" id="s${i + 1}"><h2><span class="num">${String(i + 1).padStart(2, '0')}</span>${esc(s.title)}</h2>${body}</section>`;
}
function blockBody(s) {
  let body = '';
  if (s.text) body += `<p>${esc(s.text).replace(/\n/g, '<br>')}</p>`;
  if (s.tiles && s.tiles.length) body += `<div class="tiles">${s.tiles.map((t) => `<div class="tile"><b>${esc(t.n)}</b><span>${esc(t.label)}</span></div>`).join('')}</div>`;
  if (s.items && s.items.length && !s.gallery) body += `<ul>${s.items.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`;
  if (s.table) body += table(s.table);
  if (s.chart) body += chartSvg(s.chart);
  if (s.before || s.after) body += `<div class="ba"><div class="col"><div class="h">Before</div>${(s.before || []).map(kpiCard).join('')}</div><div class="arrow">→</div><div class="col after"><div class="h">After</div>${(s.after || []).map(kpiCard).join('')}</div></div>`;
  if (s.images && s.images.length) body += `<div class="imgs">${s.images.slice(0, 6).map((u) => `<img src="${esc(u)}" alt="">`).join('')}</div>`;
  if (s.manual && s.manual.length) body += `<div class="manual">${s.manual.map((m) => `<div class="mrow"><span class="ml">${esc(m.label)}</span><span class="mv ${m.value ? '' : 'empty'}">${esc(m.value || '')}</span></div>`).join('')}<div class="mnote">비어 있는 칸은 담당자가 확인 후 채웁니다</div></div>`;
  if (s.progress != null) body += `<div class="prog"><div class="lbl"><span>${esc(s.progressLabel || '전체 진행')}</span><b>${esc(s.progress)}%</b></div><div class="bar"><i style="width:${Math.max(0, Math.min(100, Number(s.progress) || 0))}%"></i></div></div>`;
  if (s.steps && s.steps.length) body += `<div class="steps">${s.steps.map((x) => `<div class="step${x.you ? ' you' : ''}"><b>${esc(x.tag || (x.you ? '사장님 차례' : '진행 예정'))}</b><span>${esc(x.text)}</span></div>`).join('')}</div>`;
  if (s.scores) body += scoresHtml(s.scores);
  if (s.grids) body += gridsHtml(s.grids);
  if (s.gauge) body += gaugeSvg(s.gauge);
  if (s.radar) body += radarSvg(s.radar);
  if (s.lines) body += linesSvg(s.lines);
  if (s.funnel) body += funnelHtml(s.funnel);
  if (s.rank) body += rankHtml(s.rank);
  if (s.stars) body += starsHtml(s.stars);
  if (s.words) body += wordsHtml(s.words);
  if (s.checks) body += checksHtml(s.checks);
  if (s.gallery) body += galleryHtml(s.gallery) + (s.items && s.items.length ? `<ul class="gitems">${s.items.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : '');
  if (s.timeline) body += timelineHtml(s.timeline);
  if (s.note) body += `<p class="small">${esc(s.note)}</p>`;
  return body;
}

/* ---- v2 그림들 (전부 SVG·HTML, 스크립트 없음 — PDF·고객 페이지 iframe 에서도 그대로) ---- */
const PAL = ['var(--c)', '#14B8A6', '#F59E0B', '#8B5CF6', '#EF4444'];
const num = (v) => Number(String(v).replace(/[^0-9.-]/g, '')) || 0;
function spark(vals) {
  const v = vals.map(num); if (v.length < 2) return '';
  const W = 120, H = 30, mn = Math.min(...v), mx = Math.max(...v), r = mx - mn || 1;
  const pts = v.map((x, i) => [(i / (v.length - 1)) * (W - 4) + 2, H - 3 - ((x - mn) / r) * (H - 8)]);
  const d = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  const last = pts[pts.length - 1];
  return `<svg class="spark" viewBox="0 0 ${W} ${H}" aria-hidden="true"><path d="${d} L${W - 2} ${H} L2 ${H}Z" fill="var(--tint)"/><path d="${d}" fill="none" stroke="var(--c)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><circle cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="3" fill="var(--c)"/></svg>`;
}
function gaugeSvg(g) {
  const max = num(g.max) || 100, v = Math.max(0, Math.min(max, num(g.value))), b = g.before != null ? Math.max(0, Math.min(max, num(g.before))) : null;
  const R = 70, C = 2 * Math.PI * R, arc = (x) => `${((x / max) * C * 0.75).toFixed(1)} ${C.toFixed(1)}`;
  return `<div class="gauge"><svg viewBox="0 0 180 170" role="img" aria-label="${esc(g.label || '점수')} ${esc(g.value)}/${max}"><g transform="rotate(135 90 90)"><circle cx="90" cy="90" r="${R}" fill="none" stroke="#EEF1F6" stroke-width="14" stroke-dasharray="${arc(max)}" stroke-linecap="round"/>${b != null ? `<circle cx="90" cy="90" r="${R}" fill="none" stroke="#C9D2E3" stroke-width="14" stroke-dasharray="${arc(b)}" stroke-linecap="round"/>` : ''}<circle cx="90" cy="90" r="${R}" fill="none" stroke="url(#gg)" stroke-width="14" stroke-dasharray="${arc(v)}" stroke-linecap="round" style="mix-blend-mode:multiply"/></g><defs><linearGradient id="gg" x1="0" x2="1"><stop offset="0" stop-color="#14B8A6"/><stop offset="1" stop-color="var(--c)"/></linearGradient></defs><text x="90" y="92" text-anchor="middle" class="gv">${esc(g.value)}</text><text x="90" y="116" text-anchor="middle" class="gm">/ ${max}</text></svg>${b != null ? `<div class="gfrom"><s>${esc(g.before)}</s> → <b>${esc(g.value)}</b><span class="delta up">+${(num(g.value) - num(g.before)).toFixed(0)}</span></div>` : ''}${g.label ? `<div class="glabel">${esc(g.label)}</div>` : ''}</div>`;
}
function radarSvg(r) {
  const ax = r.axes || [], n = ax.length; if (n < 3) return '';
  const max = num(r.max) || 20, cx = 150, cy = 118, R = 84;
  const pt = (i, f) => { const a = -Math.PI / 2 + (i / n) * 2 * Math.PI; return [cx + Math.cos(a) * R * f, cy + Math.sin(a) * R * f]; };
  const poly = (vals) => vals.map((v, i) => pt(i, Math.max(0, Math.min(1, num(v) / max))).map((x) => x.toFixed(1)).join(',')).join(' ');
  const rings = [0.25, 0.5, 0.75, 1].map((f) => `<polygon points="${ax.map((_, i) => pt(i, f).map((x) => x.toFixed(1)).join(',')).join(' ')}" fill="none" stroke="#E3E7EE"/>`).join('');
  const spokes = ax.map((_, i) => { const p = pt(i, 1); return `<line x1="${cx}" y1="${cy}" x2="${p[0].toFixed(1)}" y2="${p[1].toFixed(1)}" stroke="#E3E7EE"/>`; }).join('');
  const labels = ax.map((l, i) => { const p = pt(i, 1.2); const a = p[0] < cx - 5 ? 'end' : p[0] > cx + 5 ? 'start' : 'middle'; return `<text x="${p[0].toFixed(1)}" y="${(p[1] + 4).toFixed(1)}" text-anchor="${a}" class="rl">${esc(l)} <tspan class="rv">${esc((r.after || [])[i] ?? '')}</tspan></text>`; }).join('');
  return `<svg class="radar" viewBox="-46 0 392 236" role="img" aria-label="영역별 점수">${rings}${spokes}${r.before ? `<polygon points="${poly(r.before)}" fill="#94A3B833" stroke="#94A3B8" stroke-width="1.5" stroke-dasharray="4 3"/>` : ''}<polygon points="${poly(r.after || [])}" fill="color-mix(in srgb,var(--c) 22%,transparent)" stroke="var(--c)" stroke-width="2.5" stroke-linejoin="round"/>${(r.after || []).map((v, i) => { const p = pt(i, Math.min(1, num(v) / max)); return `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="3.5" fill="var(--c)"/>`; }).join('')}${labels}</svg>${r.before ? `<div class="legend"><span><i style="background:#94A3B8"></i>${esc(r.beforeLabel || '시작')}</span><span><i style="background:var(--c)"></i>${esc(r.afterLabel || '지금')}</span></div>` : ''}`;
}
function linesSvg(c) {
  const ser = c.series || [], labels = c.labels || []; if (!ser.length || labels.length < 2) return '';
  const W = 640, H = 210, pl = 46, pr = 56, pt = 14, pb = 28, all = ser.flatMap((x) => x.values.map(num)), mx = Math.max(1, ...all) * 1.1;
  const X = (i) => pl + (i / (labels.length - 1)) * (W - pl - pr), Y = (v) => H - pb - (num(v) / mx) * (H - pb - pt);
  const grid = [0.25, 0.5, 0.75, 1].map((f) => `<line x1="${pl}" x2="${W - pr}" y1="${(H - pb - f * (H - pb - pt)).toFixed(1)}" y2="${(H - pb - f * (H - pb - pt)).toFixed(1)}" stroke="#EEF1F6"/><text x="${pl - 6}" y="${(H - pb - f * (H - pb - pt) + 4).toFixed(1)}" text-anchor="end" class="cl">${Math.round(mx * f)}</text>`).join('');
  const lines = ser.map((s, k) => { const col = s.color || PAL[k % PAL.length]; const d = s.values.map((v, i) => (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(v).toFixed(1)).join(' '); const lv = s.values[s.values.length - 1];
    return `${k === 0 ? `<path d="${d} L${X(labels.length - 1).toFixed(1)} ${H - pb} L${pl} ${H - pb}Z" fill="color-mix(in srgb,${col} 12%,transparent)"/>` : ''}<path d="${d}" fill="none" stroke="${col}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"/>${s.values.map((v, i) => `<circle cx="${X(i).toFixed(1)}" cy="${Y(v).toFixed(1)}" r="${i === s.values.length - 1 ? 4.5 : 2.5}" fill="${i === s.values.length - 1 ? col : '#fff'}" stroke="${col}" stroke-width="2"/>`).join('')}<text x="${(X(labels.length - 1) + 9).toFixed(1)}" y="${(Y(lv) + 4).toFixed(1)}" class="lv" fill="${col}">${esc(lv)}</text>`; }).join('');
  return `<svg class="chart lines" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(ser.map((s) => s.label).join('·'))} 추이">${grid}${labels.map((l, i) => `<text x="${X(i).toFixed(1)}" y="${H - 8}" text-anchor="middle" class="cl">${esc(l)}</text>`).join('')}${lines}</svg><div class="legend">${ser.map((s, k) => `<span><i style="background:${s.color || PAL[k % PAL.length]}"></i>${esc(s.label)}</span>`).join('')}</div>`;
}
function funnelHtml(f) {
  const top = num(f[0] && f[0].value) || 1;
  return `<div class="funnel">${f.map((x, i) => { const w = 24 + 76 * Math.sqrt(num(x.value) / top); const pct = i ? Math.round((num(x.value) / num(f[i - 1].value)) * 100) : null;
    return `<div class="fr"><div class="fbar" style="width:${w.toFixed(1)}%;background:color-mix(in srgb,var(--c) ${100 - i * 18}%,#14B8A6)"><b>${esc(Number(num(x.value)).toLocaleString('en-US'))}</b></div><span class="fl">${esc(x.label)}${pct != null ? ` <em>${pct}%</em>` : ''}</span></div>`; }).join('')}</div>`;
}
function rankHtml(r) {
  const items = r.items || [], mx = Math.max(1, ...items.map((x) => num(x.value)));
  return `<div class="rank">${items.map((x, i) => `<div class="rr${x.me ? ' me' : ''}"><span class="ri">${i + 1}</span><span class="rm"><span class="rn">${esc(x.label)}${x.sub ? ` <em>${esc(x.sub)}</em>` : ''}</span><span class="rb"><i style="width:${((num(x.value) / mx) * 100).toFixed(1)}%"></i></span></span><b>${esc(x.value)}${r.unit ? `<small>${esc(r.unit)}</small>` : ''}</b></div>`).join('')}</div>`;
}
function starsHtml(st) {
  const d = (st.dist || []).map(num), tot = d.reduce((a, b) => a + b, 0) || 1;
  return `<div class="stars"><div class="savg"><b>${esc(st.avg)}</b><span class="st">${'★'.repeat(Math.round(num(st.avg)))}<i>${'★'.repeat(5 - Math.round(num(st.avg)))}</i></span><small>리뷰 ${esc(st.total)}개</small></div><div class="sdist">${d.map((n, i) => `<div class="sd"><span>${5 - i}★</span><span class="sdb"><i style="width:${((n / tot) * 100).toFixed(1)}%;${i >= 3 ? 'background:#F59E0B' : ''}"></i></span><em>${n}</em></div>`).join('')}</div>${st.replied || st.speed ? `<div class="sfacts">${st.replied ? `<span><b>${esc(st.replied)}</b>답글</span>` : ''}${st.speed ? `<span><b>${esc(st.speed)}</b>답글까지</span>` : ''}${st.newCount ? `<span><b>${esc(st.newCount)}</b>새 리뷰</span>` : ''}</div>` : ''}</div>`;
}
function wordsHtml(ws) {
  const mx = Math.max(1, ...ws.map((x) => num(x.n)));
  return `<div class="words">${ws.map((x, i) => { const f = num(x.n) / mx; return `<span style="font-size:${(13 + f * 15).toFixed(1)}px;background:color-mix(in srgb,${PAL[i % 4]} ${(8 + f * 14).toFixed(0)}%,#fff);color:color-mix(in srgb,${PAL[i % 4]} 80%,#0F172A)">${esc(x.w)}<em>${esc(x.n)}</em></span>`; }).join('')}</div>`;
}
function checksHtml(cs) {
  const ic = { ok: '✓', part: '△', no: '✕' };
  return `<div class="checks">${cs.map((c) => `<div class="ck ${esc(c.state || 'no')}"><i>${ic[c.state] || '✕'}</i><span><b>${esc(c.label)}</b>${c.note ? `<em>${esc(c.note)}</em>` : ''}</span></div>`).join('')}</div>`;
}
function galleryHtml(g) {
  return `<div class="gallery">${g.slice(0, 4).map((x) => `<figure><img src="${esc(x.src)}" alt="${esc(x.cap || '')}"><figcaption>${esc(x.cap || '')}</figcaption></figure>`).join('')}</div>`;
}
function timelineHtml(t) {
  return `<ol class="tline">${t.map((x) => `<li><b>${esc(x.when)}</b><span>${esc(x.text)}</span></li>`).join('')}</ol>`;
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
.cover.has-photo{padding-right:calc(48px + 38%)}.cover.has-photo::before{display:none}.cphoto{position:absolute;right:0;top:0;bottom:0;width:38%;height:100%;object-fit:cover;-webkit-mask-image:linear-gradient(90deg,transparent,#000 22%);mask-image:linear-gradient(90deg,transparent,#000 22%)}
.spark{display:block;width:100%;height:30px;margin-top:8px}
.blocks{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin:4px 0 12px}.blk{border:1px solid var(--line);border-radius:16px;padding:14px 16px;min-width:0;background:#fff}.blk.wide{grid-column:1/-1}.blk h3{font-size:13px;margin:0 0 8px;color:var(--ink2);letter-spacing:.02em;font-weight:700}.blk>*:last-child{margin-bottom:0}
.gauge{display:flex;flex-direction:column;align-items:center}.gauge svg{width:180px;height:auto}.gauge .gv{font-size:44px;font-weight:800;fill:var(--ink);letter-spacing:-1px}.gauge .gm{font-size:13px;fill:var(--ink3)}.gfrom{font-size:14px;color:var(--ink2);margin-top:-8px}.gfrom s{color:var(--ink3)}.gfrom b{font-size:17px}.glabel{font-size:12px;color:var(--ink3);margin-top:4px}
.radar{width:100%;max-width:360px;display:block;margin:0 auto}.radar .rl{font-size:11.5px;fill:var(--ink2);font-weight:600}.radar .rv{fill:var(--c);font-weight:800}
.legend{display:flex;gap:14px;justify-content:center;font-size:12px;color:var(--ink3)}.legend i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:5px;vertical-align:-1px}
.lines .lv{font-size:12.5px;font-weight:800}
.funnel{display:grid;gap:7px}.fr{display:grid;grid-template-columns:1fr;gap:2px}.fbar{height:30px;border-radius:9px;display:flex;align-items:center;padding:0 12px;color:#fff;font-size:14px;min-width:64px}.fl{font-size:12.5px;color:var(--ink2)}.fl em{font-style:normal;font-weight:800;color:var(--c);margin-left:4px}
.rank{display:grid;gap:8px}.rr{display:grid;grid-template-columns:20px minmax(0,1.4fr) 1fr auto;gap:10px;align-items:center;font-size:13.5px}.ri{font-weight:800;color:var(--ink3);text-align:center}.rn{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.rn em{display:block;font-style:normal;color:var(--ink3);font-size:11.5px;font-weight:500;line-height:1.3}.rb{height:9px;border-radius:9px;background:#EEF1F6;overflow:hidden}.rb i{display:block;height:100%;background:#C9D2E3;border-radius:9px}.rr b{font-size:14px;text-align:right}.rr b small{font-size:11px;color:var(--ink3);font-weight:500;margin-left:2px}.rr.me{background:var(--tint);border-radius:10px;padding:5px 6px;margin:0 -6px}.rr.me .rb i{background:var(--c)}.rr.me .rn{font-weight:800}.rr.me .ri{color:var(--c)}
.stars{display:grid;grid-template-columns:auto 1fr;gap:6px 18px;align-items:center}.savg{display:flex;flex-direction:column;align-items:center}.savg b{font-size:44px;font-weight:800;line-height:1;letter-spacing:-1px}.savg .st{color:#F59E0B;font-size:15px;letter-spacing:1px}.savg .st i{font-style:normal;color:#E3E7EE}.savg small{font-size:12px;color:var(--ink3)}.sdist{display:grid;gap:4px}.sd{display:grid;grid-template-columns:26px 1fr 30px;gap:8px;align-items:center;font-size:12px;color:var(--ink2)}.sdb{height:8px;border-radius:8px;background:#EEF1F6;overflow:hidden}.sdb i{display:block;height:100%;background:var(--c);border-radius:8px}.sd em{font-style:normal;text-align:right}.sfacts{grid-column:1/-1;display:flex;gap:8px;margin-top:8px}.sfacts span{flex:1;background:#F6F8FB;border-radius:10px;padding:8px 10px;font-size:12px;color:var(--ink3);display:flex;flex-direction:column}.sfacts b{font-size:17px;color:var(--ink)}
.words{display:flex;flex-wrap:wrap;gap:7px;align-items:center}.words span{border-radius:999px;padding:5px 12px;font-weight:700;line-height:1.25}.words em{font-style:normal;font-size:11px;opacity:.6;margin-left:5px;font-weight:600}
.checks{display:grid;gap:7px}.ck{display:flex;gap:10px;align-items:center;border-radius:11px;padding:8px 10px;background:#F6F8FB}.ck i{flex:none;width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-style:normal;font-weight:800;font-size:12px;color:#fff}.ck span{display:flex;flex-direction:column;font-size:13.5px;line-height:1.35}.ck em{font-style:normal;font-size:12px;color:var(--ink3)}.ck.ok i{background:#10B981}.ck.part i{background:#F59E0B}.ck.no i{background:#EF4444}
.gallery{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}.gallery figure{margin:0;border-radius:13px;overflow:hidden;border:1px solid var(--line);background:#fff}.gallery img{display:block;width:100%;aspect-ratio:4/3;object-fit:cover}.gallery figcaption{font-size:12px;color:var(--ink2);padding:7px 10px;font-weight:600}
.tline{list-style:none;margin:0;padding:0 0 0 14px;border-left:2px solid var(--tint);display:grid;gap:10px}.tline li{position:relative;display:grid;grid-template-columns:76px 1fr;gap:10px;font-size:14px}.tline li::before{content:'';position:absolute;left:-22px;top:6px;width:12px;height:12px;box-sizing:border-box;border-radius:50%;background:#fff;border:3px solid var(--c)}.tline b{color:var(--c);font-size:13px}
.blk .tiles{grid-template-columns:repeat(auto-fit,minmax(84px,1fr))}.blk .grids{gap:14px;grid-template-columns:repeat(2,minmax(0,290px));justify-content:center}.blk .gbox{padding:8px}.blk .gg{gap:3px}.blk .gc{font-size:10.5px;border-radius:5px}
@media (max-width:600px){.chart .cl{font-size:21px}.chart .cv,.lines .lv{font-size:23px}.chart .ct{font-size:19px}.gh{flex-direction:column;gap:0;font-size:12px}.blk .grids{grid-template-columns:1fr 1fr;gap:8px}.blk .gc{font-size:9px}.blocks{grid-template-columns:1fr}.cover.has-photo{padding-right:20px;padding-top:200px}.cphoto{left:0;right:0;width:100%;height:180px;bottom:auto;-webkit-mask-image:linear-gradient(180deg,#000 60%,transparent);mask-image:linear-gradient(180deg,#000 60%,transparent)}.stars{grid-template-columns:1fr}.tline li{grid-template-columns:1fr;gap:0}}
/* v3 압축(2026-11-06) */
.gitems{margin:10px 0 0!important;font-size:14px!important}.blocks.c3 .blk:not(.s2):not(.s3) .tiles{grid-template-columns:1fr 1fr;gap:6px}.blocks.c3 .blk:not(.s2):not(.s3) .tile{flex-direction:row;align-items:baseline;gap:8px;padding:8px 10px}.blocks.c3 .blk:not(.s2):not(.s3) .tile b{font-size:20px}.blocks.c3 .blk:not(.s2):not(.s3) .tile span{font-size:12px;line-height:1.3}
.cover{padding:30px 48px 24px}.cover .biz{margin-top:22px}.cover h1{font-size:36px;margin:8px 0 4px}.cover .meta{margin-top:14px}.summary{padding:16px 48px}.summary ul{font-size:15.5px}.kpis{padding:18px 48px 4px}.kpi{padding:12px 14px}.kpi .v{font-size:27px}
.sec{padding:18px 48px 4px}.sec h2{font-size:19px;margin:0 0 10px}.blocks{gap:12px}.blk{padding:12px 14px}.blk h3{margin:0 0 6px}
.blocks.c3{grid-template-columns:repeat(3,minmax(0,1fr))}.blk.s2{grid-column:span 2}.blk.s3{grid-column:1/-1}.blocks:not(.c3) .blk.s2{grid-column:1/-1}
.rr{grid-template-columns:18px minmax(0,1fr) auto;gap:10px}.rm{display:flex;flex-direction:column;gap:4px;min-width:0}.rr .rb{height:7px}
.gauge svg{width:150px}.gauge .gv{font-size:42px}.radar{max-width:300px}
.blk .grids{grid-template-columns:repeat(2,minmax(0,236px))}.blk .grids-k{margin-bottom:6px}.blk .glegend{margin:8px 0 0}
.gallery img{aspect-ratio:16/9}.blk .tiles{grid-template-columns:repeat(auto-fit,minmax(78px,1fr));gap:8px}.blk .tile{padding:10px 12px}.blk .tile b{font-size:24px}
.blocks.c3 .stars{grid-template-columns:1fr}.blocks.c3 .savg{flex-direction:row;gap:10px;align-items:baseline;justify-content:flex-start}.blocks.c3 .sfacts{flex-wrap:wrap}.blocks.c3 .sfacts span{flex:1 1 40%}
.blocks.c3 .words span{padding:4px 10px}
@media (max-width:600px){.blocks.c3{grid-template-columns:1fr}.blk.s2,.blk.s3{grid-column:auto}.cover,.summary,.kpis,.sec{padding-left:20px;padding-right:20px}}
@page{size:letter;margin:0}@media print{html,body{background:#fff}.page{max-width:none}.cover{padding-top:52px}.sec,.kpis{break-inside:avoid}}`;
  const fonts = fontHead || `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700;800&display=swap">`;
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(r.title || '리포트')} — ${esc(b.name || '')}</title>${robots ? `<meta name="robots" content="${esc(robots)}">` : ''}${fonts}<style>${css}</style></head><body><div class="page">${r.sample ? `<div class="ribbon">예시 리포트 · 가상의 업체와 예시 수치로 만들었습니다 · 실제 고객 리포트와 같은 판형</div>` : ''}
<header class="cover${b.photo ? ' has-photo' : ''}">${b.photo ? `<img class="cphoto" src="${esc(b.photo)}" alt="">` : ''}${BRAND}<div class="biz">${b.logo ? `<img src="${esc(b.logo)}" alt="">` : ''}<div class="nm">${name}${b.city ? ` <span class="en">· ${esc(b.city)}</span>` : ''}</div></div>
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
