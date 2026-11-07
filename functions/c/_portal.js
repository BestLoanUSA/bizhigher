/**
 * 고객 페이지 맨 위 "마케팅 포털" (2026-11-07 David 요청: "우리가 손님에게 보내는 실제 리포트도 저런 형태로")
 * 홈의 순두부 하우스 포털과 같은 벤토 격자를 이 고객의 실제 데이터로 채운다. 타일은 데이터가 있을 때만 — 지어내지 않는다.
 *   진행률(작업 단계) · 승인 대기(전달된 결과물 중 needs_approval) · 웹사이트(sites.spec) · 결과물 이미지·영상(전달된 deliverables)
 *   · 마지막 월간 리포트(job_reports)의 진단 점수·지도 순위·지표·별점·AI 검색·다음 달 계획 · 최근 30일 한 일
 * 타일을 누르면 아래 해당 카드(#d{id})나 리포트로 간다. 스크립트 없음 — CSS 격자(grid-auto-flow: dense)
 */
import { customerTitle } from '../api/_playbook.js';
import { jobProgress } from '../api/_orders.js';

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const parse = (s) => { try { return JSON.parse(s); } catch { return null; } };
const IMG = /https?:\/\/[^\s<>"')\]]+\.(?:jpe?g|png|webp|gif)(?:\?[^\s<>"')\]]*)?/gi;
const VID = /https?:\/\/[^\s<>"')\]]+\.(?:mp4|webm)(?:\?[^\s<>"')\]]*)?/gi;
const num = (v) => Number(String(v).replace(/[^0-9.-]/g, '')) || 0;

function media(d) {
  const t = d.task || {};
  const text = `${t.result_text || ''}\n${t.result_url || ''}\n${d.url || ''}`;
  const opts = parse(d.options) || [];
  const chosen = Array.isArray(opts) ? opts.find((o) => o && o.key === d.choice) : null;
  const imgs = [...new Set([...(chosen && chosen.image ? [chosen.image] : []), ...(text.match(IMG) || [])])];
  const vids = [...new Set([...(chosen && chosen.video ? [chosen.video] : []), ...(text.match(VID) || [])])];
  return { imgs, vids };
}
function blocksOf(rep) {
  const out = [];
  for (const s of (rep && rep.sections) || []) { out.push(s); for (const b of s.blocks || []) out.push(b); }
  return out;
}
const tile = (cls, label, inner, href) => `<${href ? `a href="${esc(href)}"` : 'div'} class="pt ${cls}">${label ? `<span class="pl">${esc(label)}</span>` : ''}<div class="pc">${inner}</div></${href ? 'a' : 'div'}>`;

export async function portalHtml(db, { job, ds, site, base, period, token, preview }) {
  const biz = String(job.business || '').replace(/\s*\(데모\)/, '');
  const tiles = [];
  const q = (extra) => `/c/${esc(token)}?${[preview ? 'preview=1' : '', extra].filter(Boolean).join('&')}`;

  // 웹사이트
  let spec = null;
  if (site) { const r = await db.prepare(`SELECT spec FROM sites WHERE id = ?`).bind(site.id).first().catch(() => null); spec = r && r.spec ? parse(r.spec) : null; }
  if (site) {
    const url = site.domain && site.live ? `https://${site.domain}/` : `https://${site.slug}.sites.bizhigher.com/`;
    const photo = spec && spec.hero && spec.hero.photo;
    tiles.push(tile('w2 h2 t-web', '웹사이트', `<div class="bro"><i></i><i></i><i></i><span>${esc(url.replace(/^https:\/\//, '').replace(/\/$/, ''))}</span></div><div class="hero"${photo ? ` style="background-image:url('${esc(photo)}')"` : ''}><b>${esc((spec && spec.name) || biz)}</b>${spec && spec.tagline ? `<span>${esc(spec.tagline)}</span>` : ''}${spec && spec.rating ? `<em>★ ${esc(spec.rating)}${spec.review_count ? ` · 리뷰 ${esc(spec.review_count)}` : ''}</em>` : ''}</div>`, url));
  }

  // 진행률
  const tasks = (await db.prepare(`SELECT key, who, status, phase, service, done_at FROM job_tasks WHERE job_id = ?`).bind(job.id).all().catch(() => ({ results: [] }))).results || [];
  if (tasks.length) {
    const pct = jobProgress(tasks), C = 2 * Math.PI * 40;
    const since = Date.now() - 30 * 86400000;
    const done30 = tasks.filter((t) => t.status === 'done' && t.who !== 'customer' && t.service !== 'common' && t.done_at && Date.parse(String(t.done_at).replace(' ', 'T') + 'Z') >= since).length;
    tiles.push(tile('t-prog', '전체 진행', `<div class="ring"><svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="40" fill="none" stroke="#EEF1F6" stroke-width="11"/><circle cx="50" cy="50" r="40" fill="none" stroke="#0A4DF5" stroke-width="11" stroke-linecap="round" stroke-dasharray="${(C * pct / 100).toFixed(1)} 400" transform="rotate(-90 50 50)"/><text x="50" y="57" text-anchor="middle">${pct}%</text></svg><span><b>${done30}</b>최근 30일 끝낸 작업</span></div>`));
  }

  // 승인 대기
  const pending = ds.filter((d) => d.sent_at && d.needs_approval && !d.approved_at);
  if (pending.length) {
    const d = pending[0];
    tiles.push(tile('t-appr', '확인해 주세요', `<span class="ab">승인 대기 ${pending.length}건</span><b>${esc(customerTitle(d.task && d.task.key, d.title))}</b><i class="go">확인하러 가기 ↓</i><em>7일 무응답이면 자동 승인</em>`, `#d${d.id}`));
  }

  // 결과물 이미지·영상 (전달된 것, 최신순)
  let imgTiles = 0, vidTile = false;
  for (const d of ds.filter((x) => x.sent_at)) {
    const { imgs, vids } = media(d);
    const title = customerTitle(d.task && d.task.key, d.title);
    if (vids.length && !vidTile) { vidTile = true; tiles.push(tile('h2 t-vid', title, `<video src="${esc(vids[0])}"${imgs[0] ? ` poster="${esc(imgs[0])}"` : ''} muted playsinline preload="metadata"></video><i class="play">▶ 영상</i>`, `#d${d.id}`)); continue; }
    if (imgs.length && imgTiles < 3) { tiles.push(tile(`${imgTiles === 0 ? 'w2 ' : ''}t-img`, title, `<img src="${esc(imgs[0])}" alt="" loading="lazy">${imgs.length > 1 ? `<i class="more">+${imgs.length - 1}장</i>` : ''}`, `#d${d.id}`)); imgTiles++; }
  }

  // 마지막 월간 리포트
  if (base) {
    const bl = blocksOf(base);
    const g = bl.find((b) => b.gauge);
    if (g) { const v = num(g.gauge.value), mx = num(g.gauge.max) || 100, C = 2 * Math.PI * 40; tiles.push(tile('t-score', '진단 점수', `<div class="ring"><svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="40" fill="none" stroke="#EEF1F6" stroke-width="11"/><circle cx="50" cy="50" r="40" fill="none" stroke="#14B8A6" stroke-width="11" stroke-linecap="round" stroke-dasharray="${(C * v / mx).toFixed(1)} 400" transform="rotate(-90 50 50)"/><text x="50" y="57" text-anchor="middle">${esc(g.gauge.value)}</text></svg><span>${g.gauge.before != null ? `<s>${esc(g.gauge.before)}</s> → ` : ''}<b>${esc(g.gauge.value)}</b>${g.gauge.before != null ? `<em>+${v - num(g.gauge.before)}</em>` : ''}</span></div>`)); }
    const gr = bl.find((b) => b.grids && b.grids.after);
    if (gr) { const f = gr.grids.after.flat(); const top3 = f.filter((v) => v > 0 && v <= 3).length; tiles.push(tile('t-map', `지도 3위 안 ${top3}/${f.length}`, `<div class="map">${gr.grids.after.map((r) => r.map((v) => `<i class="${v <= 0 ? 'o' : v <= 3 ? 'a' : v <= 7 ? 'b' : v <= 12 ? 'c' : 'd'}"></i>`).join('')).join('')}</div>${gr.grids.keyword ? `<span class="kw">"${esc(gr.grids.keyword)}"</span>` : ''}`)); }
    const k = (base.kpis || []).slice(0, 3);
    if (k.length) tiles.push(tile('t-kpi', `${period ? Number(period.slice(5)) + '월 ' : ''}숫자`, `<div class="kpis">${k.map((x) => `<div><b>${esc(x.value)}</b><span>${esc(x.label)}</span>${x.delta ? `<em>${esc(x.delta)}</em>` : ''}</div>`).join('')}</div>`));
    const st = bl.find((b) => b.stars);
    if (st) tiles.push(tile('t-stars', '리뷰', `<div class="stars"><b>${esc(st.stars.avg)}</b><span class="st">★★★★★</span><span>리뷰 ${esc(st.stars.total)}개${st.stars.newCount ? ` · 이번 달 ${esc(st.stars.newCount)}` : ''}</span>${st.stars.replied ? `<em>답글 ${esc(st.stars.replied)}</em>` : ''}</div>`));
    const ck = bl.find((b) => b.checks);
    if (ck) tiles.push(tile('t-ai', 'AI 검색에 나오나요', `<div class="ai">${ck.checks.slice(0, 4).map((c) => `<span class="s-${esc(c.state || 'no')}">${c.state === 'ok' ? '✓' : c.state === 'part' ? '△' : '✕'} ${esc(c.label)}</span>`).join('')}</div>`));
    const tl = bl.find((b) => b.timeline);
    if (tl) tiles.push(tile('w2 t-plan', '다음 달 계획', `<ol>${tl.timeline.slice(0, 4).map((x) => `<li><b>${esc(x.when)}</b>${esc(x.text)}</li>`).join('')}</ol>`));
    const photo = base.business && base.business.photo;
    tiles.push(tile('h2 t-rep', `${period ? Number(period.slice(5)) + '월 ' : ''}월간 리포트`, `<div class="cover"${photo ? ` style="background-image:url('${esc(photo)}')"` : ''}></div><b>${esc(base.title || '월간 리포트')}</b>${(base.summary || []).slice(0, 2).map((s) => `<span>${esc(s)}</span>`).join('')}<i class="go">리포트 열기 →</i>`, q(`view=report${period ? '&r=' + period : ''}`)));
  }

  if (tiles.length < 3) return ''; // 시작 직후(타일이 거의 없을 때)는 포털 대신 아래 리포트·결과물만
  const now = new Date().toLocaleString('ko-KR', { timeZone: 'America/Los_Angeles', year: 'numeric', month: 'long' });
  return `<section class="portal" aria-label="${esc(biz)} 마케팅 포털"><div class="pbar"><span class="plogo">B</span><b>${esc(biz)}</b><span class="psub">마케팅 포털 · ${esc(now)}</span><span class="pcnt">${tiles.length}</span></div><div class="pgrid">${tiles.join('')}</div></section>`;
}

export const PORTAL_CSS = `
.portal{max-width:1100px;margin:16px auto 6px;padding:0 16px}.portal .pbar{display:flex;align-items:center;gap:10px;margin:0 2px 10px;font-size:15px}.plogo{width:26px;height:26px;border-radius:8px;background:#0A4DF5;color:#fff;font-weight:900;font-size:14px;display:inline-flex;align-items:center;justify-content:center}.psub{color:#9CA3AF;font-size:13px;font-weight:600}.pcnt{margin-left:auto;font-size:12.5px;font-weight:800;color:#0A4DF5;background:#EEF3FF;border-radius:999px;padding:3px 10px}.pcnt::after{content:'개'}
.pgrid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));grid-auto-rows:150px;grid-auto-flow:dense;gap:10px}
.pt{position:relative;display:block;min-width:0;border-radius:16px;background:#fff;border:1px solid #E3E9F6;overflow:hidden;box-shadow:0 10px 24px -20px rgba(10,27,77,.45);color:#111318;text-decoration:none;transition:transform .25s ease,box-shadow .25s ease}a.pt:hover{transform:translateY(-2px);box-shadow:0 18px 34px -22px rgba(10,27,77,.5)}
.pt.w2{grid-column:span 2}.pt.h2{grid-row:span 2}
.pl{position:absolute;top:8px;left:8px;z-index:2;font-size:11.5px;font-weight:800;background:rgba(255,255,255,.93);border:1px solid #E5E7EB;border-radius:999px;padding:3px 9px;max-width:calc(100% - 16px);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pc{position:absolute;inset:0;padding:36px 12px 10px;display:flex;flex-direction:column;min-height:0;font-size:12.5px;color:#4B5563;line-height:1.4}
.t-web .pc,.t-img .pc,.t-vid .pc{padding:0}.t-web .pl{top:auto;bottom:8px}.bro{display:flex;align-items:center;gap:5px;height:26px;padding:0 10px;background:#F1F4FA;border-bottom:1px solid #E5E7EB;flex:none}.bro i{width:8px;height:8px;border-radius:50%;background:#F87171}.bro i:nth-child(2){background:#FBBF24}.bro i:nth-child(3){background:#34D399}.bro span{margin-left:8px;font-size:11px;color:#9CA3AF;background:#fff;border-radius:6px;padding:1px 10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.hero{flex:1;background:#0A1B4D center/cover;position:relative;display:flex;flex-direction:column;justify-content:flex-end;padding:16px 16px 40px;color:#fff}.hero::before{content:'';position:absolute;inset:0;background:linear-gradient(180deg,rgba(5,10,31,.05),rgba(5,10,31,.72))}.hero>*{position:relative}.hero b{font-size:22px;font-weight:900}.hero span{font-size:12.5px;opacity:.9}.hero em{font-style:normal;align-self:flex-start;margin-top:8px;background:#FBBF24;color:#111;border-radius:999px;padding:3px 10px;font-size:12px;font-weight:800}
.t-img img,.t-vid video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;background:#000}.more,.play{position:absolute;right:10px;bottom:10px;font-style:normal;font-size:11.5px;font-weight:800;background:rgba(255,255,255,.93);border-radius:999px;padding:3px 9px}
.ring{flex:1;display:flex;align-items:center;gap:10px;justify-content:center;min-height:0}.ring svg{height:100%;max-height:96px;width:auto}.ring text{font-size:22px;font-weight:900;fill:#111318}.ring span{display:flex;flex-direction:column;font-size:12px}.ring b{font-size:22px;color:#111318}.ring s{color:#9CA3AF}.ring em{font-style:normal;font-weight:800;color:#047857}
.t-appr{background:#FFFBEB;border-color:#FDE68A}.t-appr .pc{justify-content:center;gap:3px}.ab{font-size:11.5px;font-weight:800;color:#B45309}.t-appr b{font-size:14px;color:#111318}.go{font-style:normal;font-weight:800;color:#0A4DF5;font-size:12.5px}.t-appr em{font-style:normal;font-size:11px;color:#9CA3AF}
.map{flex:1;min-height:0;aspect-ratio:1;align-self:center;display:grid;grid-template-columns:repeat(7,1fr);gap:2px}.map i{border-radius:3px}.map .a{background:#0A4DF5}.map .b{background:#6E95F9}.map .c{background:#C3D3FC}.map .d,.map .o{background:#EEF1F6}.kw{font-size:10.5px;color:#9CA3AF;text-align:center;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.kpis{flex:1;display:flex;flex-direction:column;justify-content:center;gap:2px}.kpis div{display:flex;align-items:baseline;gap:6px}.kpis b{font-size:18px;font-weight:900;color:#111318;min-width:52px}.kpis span{font-size:11.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.kpis em{margin-left:auto;font-style:normal;font-size:11px;font-weight:800;color:#047857}
.stars{flex:1;display:flex;flex-direction:column;justify-content:center}.stars b{font-size:32px;font-weight:900;color:#111318;line-height:1}.stars .st{color:#F59E0B;letter-spacing:1px}.stars em{font-style:normal;font-weight:800;color:#047857;font-size:12px}
.ai{flex:1;display:flex;flex-direction:column;justify-content:center;gap:3px}.ai span{font-size:12px;font-weight:800;color:#111318;border-radius:8px;padding:3px 8px;background:#F6F8FB}.ai .s-ok{background:#ECFDF5}.ai .s-part{background:#FFFBEB}.ai .s-no{background:#FEF2F2}
.t-plan ol{list-style:none;margin:0;padding:0;display:grid;gap:4px;font-size:12.5px;color:#111318}.t-plan li{display:grid;grid-template-columns:62px 1fr;gap:6px}.t-plan li b{color:#0A4DF5;font-size:12px}
.t-rep .pc{gap:4px}.t-rep .cover{height:42%;margin:-36px -12px 6px;background:#E9EEF8 center/cover;flex:none}.t-rep b{font-size:14px;color:#111318}.t-rep span{font-size:12px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}.t-rep .go{margin-top:auto}
@media (max-width:640px){.pgrid{grid-template-columns:repeat(2,minmax(0,1fr));grid-auto-rows:136px}.portal{padding:0 12px}.psub{display:none}}
`;
