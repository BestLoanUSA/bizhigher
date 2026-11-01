/**
 * 고객 리포트 템플릿 — report.json → 로고·표지·요약·지표 카드·표·차트·다음 달 계획이 들어간 HTML(자체 완결) + 레터 PDF + 1쪽 미리보기 PNG
 * (2026-11-01 David 요청: "고객에게 전달될 리포트가 보여지길 — 로고가 들어간 깔끔한 리포트")
 *
 * report.json 형식 (루틴이 쓴다 — 지어낸 숫자 금지, 없으면 칸을 비우거나 manual 로 넘긴다):
 * {
 *   "type": "monthly|setup|before-after|reviews|ads|listings|custom",
 *   "title": "10월 월간 리포트", "subtitle": "구글 노출 · 리뷰 · 광고", "period": "2026-10-01 ~ 10-31", "date": "2026-11-01",
 *   "business": { "name": "New Optix", "name_ko": "뉴옵틱스", "city": "Garden Grove", "logo": "https://…/a/logo.png", "color": "#0A4DF5" },
 *   "summary": ["한 줄 요약", "…"],                                    // 표지 아래 "이번 달 한눈에" 2~4줄
 *   "kpis": [{ "label": "구글 평점", "value": "4.7", "delta": "+0.1", "note": "리뷰 14개", "good": true }],
 *   "sections": [
 *     { "title": "이번 달 한 일", "items": ["…"] },
 *     { "title": "리뷰", "table": { "head": ["날짜", "별점", "요지", "답글"], "rows": [["10/03", "★5", "…", "게시"]] } },
 *     { "title": "조회 추이", "chart": { "label": "프로필 조회", "labels": ["8월", "9월", "10월"], "values": [120, 180, 240] } },
 *     { "title": "비포 / 애프터", "before": [{ "label": "리뷰 수", "value": "14" }], "after": [{ "label": "리뷰 수", "value": "22" }] },
 *     { "title": "사진", "images": ["https://…/a/x.jpg"] },
 *     { "title": "다음 달 계획", "items": ["…"], "text": "문단(선택)" },
 *     { "title": "David 가 채울 칸", "manual": [{ "label": "GBP 조회수", "value": "" }] }   // 값이 비면 점선 칸으로 보인다
 *   ],
 *   "notes": "작은 글씨 주석(출처·측정 기준)", "cta": "다음 달에도 같은 리포트를 드립니다. 궁금한 점은 답장 주세요."
 * }
 */
'use strict';
const fs = require('fs');
const path = require('path');
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
  if (s.items && s.items.length) body += `<ul>${s.items.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`;
  if (s.table) body += table(s.table);
  if (s.chart) body += chartSvg(s.chart);
  if (s.before || s.after) body += `<div class="ba"><div class="col"><div class="h">Before</div>${(s.before || []).map(kpiCard).join('')}</div><div class="arrow">→</div><div class="col after"><div class="h">After</div>${(s.after || []).map(kpiCard).join('')}</div></div>`;
  if (s.images && s.images.length) body += `<div class="imgs">${s.images.slice(0, 6).map((u) => `<img src="${esc(u)}" alt="">`).join('')}</div>`;
  if (s.manual && s.manual.length) body += `<div class="manual">${s.manual.map((m) => `<div class="mrow"><span class="ml">${esc(m.label)}</span><span class="mv ${m.value ? '' : 'empty'}">${esc(m.value || '')}</span></div>`).join('')}<div class="mnote">비어 있는 칸은 담당자가 확인 후 채웁니다</div></div>`;
  if (s.note) body += `<p class="small">${esc(s.note)}</p>`;
  return `<section class="sec"><h2><span class="num">${String(i + 1).padStart(2, '0')}</span>${esc(s.title)}</h2>${body}</section>`;
}

/** report.json → HTML 문자열(자체 완결). fontHead 는 PDF 렌더 때 _fonts.js 가 주는 @font-face 블록(없으면 구글 폰트 링크) */
function renderHtml(r, { fontHead = '' } = {}) {
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
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;padding:26px 48px 6px}
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
@page{size:letter;margin:0}@media print{html,body{background:#fff}.page{max-width:none}.cover{padding-top:52px}.sec,.kpis{break-inside:avoid}}`;
  const fonts = fontHead || `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700;800&display=swap">`;
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(r.title || '리포트')} — ${esc(b.name || '')}</title>${fonts}<style>${css}</style></head><body><div class="page">
<header class="cover">${BRAND}<div class="biz">${b.logo ? `<img src="${esc(b.logo)}" alt="">` : ''}<div class="nm">${name}${b.city ? ` <span class="en">· ${esc(b.city)}</span>` : ''}</div></div>
<h1>${esc(r.title || '리포트')}</h1>${r.subtitle ? `<p class="sub">${esc(r.subtitle)}</p>` : ''}
<div class="meta">${r.period ? `<span>기간 <b>${esc(r.period)}</b></span>` : ''}${r.date ? `<span>발행 <b>${esc(r.date)}</b></span>` : ''}<span>작성 <b>BizHigher</b></span></div></header>
${r.summary && r.summary.length ? `<section class="summary"><h2>한눈에 보기</h2><ul>${r.summary.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></section>` : ''}
${r.kpis && r.kpis.length ? `<div class="kpis">${r.kpis.map(kpiCard).join('')}</div>` : ''}
${(r.sections || []).map(section).join('')}
${r.cta ? `<div class="cta">${esc(r.cta)}</div>` : ''}
<footer class="foot"><span>${esc(r.notes || '수치는 구글·사이트·광고 계정의 공개·계정 데이터를 기준으로 하며, 측정 기준이 바뀌면 리포트에 적습니다.')}</span><span>BizHigher · hello@bizhigher.com · bizhigher.com</span></footer>
</div></body></html>`;
}

/** HTML·PDF·미리보기 PNG 를 out 폴더에 쓴다 */
async function renderFiles(r, out, { name = 'report' } = {}) {
  fs.mkdirSync(out, { recursive: true });
  const htmlFile = path.join(out, name + '.html'); fs.writeFileSync(htmlFile, renderHtml(r));
  const { launch } = require('./_photos.js'); const { installFonts, waitFonts } = require('./_fonts.js');
  const browser = await launch();
  try {
    const page = await browser.newPage(); await page.setViewportSize({ width: 860, height: 1100 });
    const head = await installFonts(page, ['sans']).catch(() => '');
    await page.setContent(renderHtml(r, { fontHead: head }), { waitUntil: 'load' });
    try { await page.waitForLoadState('networkidle', { timeout: 8000 }); } catch {}
    try { await waitFonts(page, ["700 20px 'Noto Sans KR'"]); } catch {}
    await page.waitForTimeout(200);
    const pdf = path.join(out, name + '.pdf'); await page.pdf({ path: pdf, format: 'Letter', printBackground: true, preferCSSPageSize: true });
    const png = path.join(out, name + '-preview.png'); await page.screenshot({ path: png, type: 'png', clip: { x: 0, y: 0, width: 860, height: 1100 } });
    await page.close();
    return { html: htmlFile, pdf, preview: png };
  } finally { await browser.close(); }
}

module.exports = { renderHtml, renderFiles, LOGO };
