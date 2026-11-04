/**
 * 고객 결과물 페이지 — GET /c/{token} · POST /c/{token} (승인·수정 요청)
 * 작업(jobs.portal_token)마다 하나. 로그인 없음 — 추측 불가능한 24자 토큰이 곧 열쇠. 검색 금지(noindex).
 * 보여 주는 것: 고객에게 전달된(sent_at) 결과물만. ?preview=1 은 David 미리보기(전달 전 것도 표시).
 * 승인이 필요한 결과물(needs_approval)은 [승인] / [수정 요청] 버튼 → job_tasks 에 반영돼 루틴이 다음 단계를 돈다.
 */
import { ensureSchema, addEvent, approveDeliverable, parseOptions } from '../api/_orders.js';
import { wakeRoutine } from '../api/_runner.js';
import { customerTitle } from '../api/_playbook.js';
import { notify } from '../api/_notify.js';

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const EMBED_RE = /^https:\/\/([a-z0-9-]+\.)*(bizhigher-sites\.pages\.dev|sites\.bizhigher\.com|bizhigher\.com)(\/|$)/i;

async function load(env, token) {
  const t = String(token || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40);
  if (t.length < 16 || !env.DB) return null;
  await ensureSchema(env.DB);
  const job = await env.DB.prepare(`SELECT * FROM jobs WHERE portal_token = ?`).bind(t).first();
  if (!job) return null;
  const site = await env.DB.prepare(`SELECT id, slug, domain, live, version, updated_at FROM sites WHERE job_id = ?`).bind(job.id).first().catch(() => null);
  const siteTask = site ? await env.DB.prepare(`SELECT id, status, revise_note FROM job_tasks WHERE job_id = ? AND key = 'web-2' ORDER BY id DESC LIMIT 1`).bind(job.id).first().catch(() => null) : null;
  const ds = (await env.DB.prepare(`SELECT * FROM deliverables WHERE job_id = ? ORDER BY id DESC`).bind(job.id).all()).results || [];
  const taskIds = ds.map((d) => d.task_id).filter(Boolean);
  const tasks = taskIds.length ? (await env.DB.prepare(`SELECT id, key, service, sort, result_kind, result_text, result_url FROM job_tasks WHERE id IN (${taskIds.map(() => '?').join(',')})`).bind(...taskIds).all()).results || [] : [];
  const byId = new Map(tasks.map((x) => [x.id, x]));
  return { job, site, siteTask, ds: ds.map((d) => ({ ...d, task: byId.get(d.task_id) || null })) };
}

/* 고객에게 보이면 안 되는 내부 줄 — 루틴이 결과물에 남기는 작업 메모 (2026-11-03 데모: "[고객 안내 — David가 검토한 뒤…]"·"참고한 스킬"·"제목:"이 그대로 보였다) */
function customerText(text) {
  return String(text || '')
    .replace(/\n+\[David 승인 메모\][^\n]*/g, '')
    .split('\n')
    // 줄 맨 앞의 내부 라벨("**[고객 안내]** 이번 달…")은 라벨만 지우고 문장은 남긴다
    .map((l) => l.replace(/^\s*\**\s*\[(고객 안내|검수)[^\]]*\]\s*\**\s*/, ''))
    .filter((l, i, a) => !(l === '' && a[i - 1] === '') && !/^\s*참고한 스킬\s*:/.test(l) && !/^\s*\**\s*\[(David|내부)[^\]]*\]/.test(l))
    .map((l) => l.replace(/^\s*제목\s*:\s*/, '### '))
    .join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/* 작은 마크다운 → HTML (먼저 전부 이스케이프하므로 안전). 제목·굵게·목록·표·문단만 */
function mdHtml(src) {
  const inline = (t) => esc(t).replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/(https?:\/\/[^\s<]+[^\s<.,;:!?)])/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
  const lines = String(src || '').split('\n');
  let out = '', list = null, para = [];
  const flush = () => { if (para.length) { out += `<p>${para.map(inline).join('<br>')}</p>`; para = []; } if (list) { out += `</${list}>`; list = null; } };
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (!l.trim()) { flush(); continue; }
    const h = /^(#{1,4})\s+(.*)$/.exec(l);
    if (h) { flush(); out += `<h${Math.min(4, h[1].length + 2)} class="mdh">${inline(h[2])}</h${Math.min(4, h[1].length + 2)}>`; continue; }
    if (/^\s*\|.*\|\s*$/.test(l)) {
      flush();
      const rows = [];
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) { rows.push(lines[i]); i++; }
      i--;
      const cells = (r) => r.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
      const body = rows.filter((r) => !/^\s*\|[\s:|-]+\|\s*$/.test(r));
      if (body.length) {
        const head = cells(body[0]);
        // 열이 5개 이상인 표는 폰에서 글자가 한 줄에 한 자씩 깨진다(2026-11-03 데모: 게시물 캘린더 7열) → 행마다 카드(제목: 값)로
        if (head.length >= 5) out += `<div class="mdcards">${body.slice(1).map((r) => { const c = cells(r); return `<dl>${head.map((h, k) => c[k] ? `<dt>${inline(h)}</dt><dd>${inline(c[k])}</dd>` : '').join('')}</dl>`; }).join('')}</div>`;
        else out += `<div class="tw"><table><thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join('')}</tr></thead><tbody>${body.slice(1).map((r) => `<tr>${cells(r).map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
      }
      continue;
    }
    const li = /^\s*(?:[-*•]|(\d+)[.)])\s+(.*)$/.exec(l);
    if (li) {
      const tag = li[1] ? 'ol' : 'ul';
      if (para.length) { out += `<p>${para.map(inline).join('<br>')}</p>`; para = []; }
      if (list !== tag) { if (list) out += `</${list}>`; out += `<${tag}>`; list = tag; }
      out += `<li>${inline(li[2])}</li>`;
      continue;
    }
    if (list) { out += `</${list}>`; list = null; }
    para.push(l);
  }
  flush();
  return out;
}

/* 결과물 본문 — 관리자 공용 미리보기(_ui.js previewHtml)와 같은 규칙: 종류와 상관없이 이미지·영상·PDF·우리 사이트를 그 자리에서 */
function body(d) {
  const k = d.kind || (d.task && d.task.result_kind) || (d.url ? 'link' : 'text');
  const raw = (d.task ? d.task.result_text || '' : '').replace(/\n+\[David 승인 메모\][^\n]*/g, '').trim(); // David 내부 메모는 고객에게 보이지 않는다
  const text = k === 'html' ? raw : customerText(raw);
  const url = d.url || (d.task && d.task.result_url) || '';
  const all = (text + '\n' + url).match(/https?:\/\/[^\s<>"')\]]+/g) || [];
  const uniq0 = [...new Set(all.map((u) => u.replace(/[.,;:!?]+$/, '')))];
  // 선택 카드(시안·영상)에 이미 나오는 이미지·영상은 본문에서 또 보여주지 않는다(같은 영상이 6개씩 보이던 문제, 2026-11-03)
  const inOptions = new Set(parseOptions(d.options).flatMap((o) => [o.image, o.video]).filter(Boolean));
  const uniq = uniq0.filter((u) => !inOptions.has(u));
  const isMedia = (u) => /\.(jpe?g|png|webp|gif|mp4|webm|pdf)(\?|$)/i.test(u);
  const imgs = uniq.filter((u) => /\.(jpe?g|png|webp|gif)(\?|$)/i.test(u));
  const vids = uniq.filter((u) => /\.(mp4|webm)(\?|$)/i.test(u));
  const pdfs = uniq.filter((u) => /\.pdf(\?|$)/i.test(u));
  const sites = uniq.filter((u) => EMBED_RE.test(u) && !isMedia(u) && !/\/a\//.test(u));
  let html = '';
  if (k === 'html' && text) html += `<iframe sandbox="" srcdoc="${esc(text.slice(0, 200000))}" style="width:100%;height:${/class="cover"/.test(text) ? 900 : 520}px;border:1px solid #e5e7eb;border-radius:12px;background:#fff"></iframe>`; // 리포트(creative.js report)는 길어서 더 높게
  if (imgs.length) html += '<div class="grid">' + imgs.slice(0, 24).map((u) => `<a href="${esc(u)}" target="_blank" rel="noopener"><img src="${esc(u)}" alt="" loading="lazy"></a>`).join('') + '</div>';
  if (vids.length) html += '<div class="grid">' + vids.slice(0, 6).map((u) => `<video src="${esc(u)}" controls playsinline preload="metadata"></video>`).join('') + '</div>';
  for (const u of pdfs.slice(0, 3)) html += `<object data="${esc(u)}" type="application/pdf" style="width:100%;height:480px;border:1px solid #e5e7eb;border-radius:12px;margin:8px 0"><a class="btn ghost" href="${esc(u)}" target="_blank" rel="noopener">PDF 열기 →</a></object>`;
  for (const u of sites.slice(0, 1)) html += `<iframe src="${esc(u)}" title="사이트 미리보기" loading="lazy" style="width:100%;height:560px;border:1px solid #e5e7eb;border-radius:12px;background:#fff;margin:8px 0"></iframe><p><a class="btn" href="${esc(u)}" target="_blank" rel="noopener">사이트 열기 →</a></p>`;
  if (text && k !== 'html') {
    const rest = text.split('\n').filter((l) => !(imgs.concat(vids, [...inOptions]).some((u) => l.includes(u)) && l.trim().length < 200)).join('\n').trim(); // 이미지 주소만 있는 줄은 숨김
    if (rest) html += `<div class="md">${mdHtml(rest.slice(0, 12000))}</div>`;
  }
  if (url && !imgs.includes(url) && !vids.includes(url) && !pdfs.includes(url) && !sites.includes(url)) html += `<p><a class="btn ghost" href="${esc(url)}" target="_blank" rel="noopener">파일·링크 열기 →</a></p>`;
  return html || '<p class="muted">내용은 담당자 안내 메일을 참고해 주세요.</p>';
}

function siteCard(site, siteTask, env) {
  if (!site) return '';
  const url = site.domain && site.live ? `https://${site.domain}/` : `https://${site.slug}.sites.bizhigher.com/`;
  const alt = `https://${(env && env.SITES_PROJECT) || 'bizhigher-sites'}.pages.dev/${site.slug}/`;
  const pending = siteTask && siteTask.status === 'doing' && siteTask.revise_note;
  return `<section class="card site"><div class="meta">웹사이트${site.domain && site.live ? '' : ' · 임시 주소(검색 비노출) — 도메인 연결 전'}</div><h2>내 웹사이트</h2>
    <iframe src="${esc(alt)}" title="웹사이트 미리보기" loading="lazy" style="width:100%;height:520px;border:1px solid #e5e7eb;border-radius:12px;background:#fff;margin:8px 0"></iframe>
    <p><a class="btn" href="${esc(url)}" target="_blank" rel="noopener">사이트 열기 →</a> <a class="btn ghost" href="${esc(alt)}" target="_blank" rel="noopener">임시 주소</a></p>
    <div class="appr"><b>고치고 싶은 곳이 있으면 적어 주세요.</b> 영업시간·사진·문구·색감 무엇이든 괜찮습니다. 반영 후 같은 주소에서 바로 보실 수 있습니다(보통 하루 안).
      ${pending ? `<div class="rev">✎ 접수된 요청: ${esc(siteTask.revise_note.replace(/^\[고객 수정 요청\]\s*/, ''))} — 반영 중입니다</div>` : ''}
      <form method="post"><input type="hidden" name="action" value="site-revise"><textarea name="note" required placeholder="예: 토요일 영업시간을 17시 마감으로, 첫 화면 사진을 매장 외관으로"></textarea><button class="btn ghost" type="submit">웹사이트 수정 요청</button></form>
    </div></section>`;
}

function page(job, ds, { preview, msg, site, siteTask, env }) {
  const biz = esc((job.business || '').replace(/\s*\(데모\)/, ''));
  const items = ds.map((d) => {
    const options = parseOptions(d.options);
    const chosen = options.find((o) => o.key === d.choice);
    // 선택지가 있는 결과물(시안·세트·버전): 카드마다 "이 디자인으로 진행" — 고객이 고르는 승인 (2026-10-27)
    const choiceCards = options.length ? `<div class="opts">${options.map((o) => `<form method="post" class="opt"><input type="hidden" name="id" value="${d.id}"><input type="hidden" name="action" value="approve"><input type="hidden" name="choice" value="${esc(o.key)}">${o.video ? `<video src="${esc(o.video)}" poster="${esc(o.image)}" controls playsinline preload="metadata"></video>` : o.image ? `<a href="${esc(o.image)}" target="_blank" rel="noopener"><img src="${esc(o.image)}" alt="${esc(o.label)}" loading="lazy"></a>` : ''}<div class="ol"><b>${esc(o.key)}.</b> ${esc(o.label)}${o.default ? ' <span class="rec">추천</span>' : ''}</div>${o.note ? `<div class="on">${esc(o.note)}</div>` : ''}<button class="btn" type="submit">${o.video ? '이 영상으로 진행' : '이 디자인으로 진행'}</button></form>`).join('')}</div>` : '';
    const approval = d.needs_approval && !d.approved_at ? `
      <div class="appr"><b>${options.length ? (options.some((o) => o.video) ? '마음에 드는 영상을 골라 주세요.' : '마음에 드는 디자인을 골라 주세요.') : '확인 부탁드립니다.'}</b> ${options.length ? (options.some((o) => o.video) ? '재생해 보시고 먼저 올릴 것을 골라 주세요. 7일 안에 회신이 없으면 추천 표시된 것으로 진행합니다.' : '이미지를 누르면 크게 보입니다. 고르시면 그 디자인으로 나머지를 만듭니다. 7일 안에 회신이 없으면 가게 분위기에 맞는 것으로 진행합니다.') : '내용이 괜찮으면 승인을 눌러 주세요. 7일 안에 회신이 없으면 승인된 것으로 보고 예정대로 진행합니다(게시 후에도 수정 1회 무료).'}
        ${options.length ? choiceCards : `<form method="post" class="row"><input type="hidden" name="id" value="${d.id}"><input type="hidden" name="action" value="approve"><button class="btn" type="submit">✓ 이대로 진행해 주세요</button></form>`}
        <details${d.revise_note ? ' open' : ''}><summary>수정 요청하기</summary>${d.revise_note ? `<div class="rev">✎ 접수된 요청: ${esc(d.revise_note)} — 반영 후 다시 올려드립니다</div>` : ''}<form method="post"><input type="hidden" name="id" value="${d.id}"><input type="hidden" name="action" value="revise"><textarea name="note" required placeholder="무엇을 어떻게 고칠지 적어 주세요 (예: 2주차 게시물 가격 문구 삭제)"></textarea><button class="btn ghost" type="submit">수정 요청 보내기</button></form></details>
      </div>` : d.approved_at ? `<div class="ok">✓ ${esc(d.approved_at.slice(0, 10))} 승인됨${chosen ? ` · 선택: ${esc(chosen.key)}. ${esc(chosen.label)}` : ''}</div>${chosen && chosen.image ? `<div class="grid"><a href="${esc(chosen.image)}" target="_blank" rel="noopener"><img src="${esc(chosen.image)}" alt="" loading="lazy"></a></div>` : ''}` : '';
    // 승인 버튼이 없는 결과물(킥오프 안내 등)에도 답할 길을 둔다 — 킥오프의 '확인 부탁드려요' 질문에 메일 말고는 답할 곳이 없었다(2026-11-04)
    const isKick = d.task && d.task.key === 'ob-5';
    const reply = !d.needs_approval ? `<details class="reply"${isKick && !d.customer_reply ? ' open' : ''}><summary>${isKick ? '확인 질문에 답하기' : '답변·질문 남기기'}</summary>${d.customer_reply ? `<div class="ok">💬 보내 주신 답변: ${esc(d.customer_reply).replace(/\n/g, '<br>')}</div>` : ''}<form method="post"><input type="hidden" name="id" value="${d.id}"><input type="hidden" name="action" value="reply"><textarea name="note" required placeholder="${isKick ? '예: 월·목은 4시에 닫습니다. 카테고리는 안경점으로 바꿔 주세요. 브랜드 이름은 올려도 됩니다.' : '궁금한 점이나 덧붙일 내용을 적어 주세요'}"></textarea><button class="btn ghost" type="submit">보내기</button></form></details>` : '';
    return `<section class="card${d.sent_at ? '' : ' draft'}"><div class="meta">${d.sent_at ? esc(d.sent_at.slice(0, 10)) : '전달 전 (미리보기)'}</div><h2>${esc(customerTitle(d.task && d.task.key, d.title))}</h2>${d.summary ? `<p class="sum">${esc(d.summary)}</p>` : ''}${body(d)}${approval}${reply}</section>`;
  }).join('');
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${biz} — BizHigher 결과물</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">
<style>
:root{--blue:#0A4DF5;--navy:#0A1B4D;--ink:#111318;--muted:#6B7280;--line:#E5E7EB}*{box-sizing:border-box}body{margin:0;font-family:Pretendard,-apple-system,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;background:#F3F4F7;color:var(--ink)}
header{background:var(--navy);color:#fff;padding:22px 18px}header .logo{font-weight:800;font-size:18px}header .logo span{color:#7FA6FF}header h1{font-size:22px;margin:10px 0 4px}header p{margin:0;opacity:.85;font-size:14px}
main{max-width:720px;margin:0 auto;padding:16px}
.card{background:#fff;border:1px solid var(--line);border-radius:16px;padding:18px 16px;margin-bottom:14px}.card.draft{border-style:dashed;background:#FFFBEB}.card h2{font-size:17px;margin:2px 0 8px}.meta{font-size:12px;color:var(--muted)}.sum{font-size:15px;line-height:1.6;margin:0 0 10px}
.md{background:#F8FAFC;border:1px solid var(--line);border-radius:12px;padding:4px 14px;margin:8px 0;font-size:15px;line-height:1.65}.md p,.md ul,.md ol{margin:10px 0}.md ul,.md ol{padding-left:20px}.md li{margin:4px 0}.mdh{font-size:16px;margin:16px 0 6px}.md .tw{overflow-x:auto;margin:10px 0}.md table{border-collapse:collapse;width:100%;font-size:14px;background:#fff}.md th,.md td{border:1px solid var(--line);padding:6px 8px;text-align:left;vertical-align:top}.md th{background:#EEF2F7}.md a{word-break:break-all}.reply{margin-top:12px}.reply summary{cursor:pointer;font-weight:700;color:var(--accent,#0A4DF5)}.reply textarea{width:100%;min-height:90px;margin:8px 0;padding:10px;border:1px solid var(--line);border-radius:10px;font:inherit}.mdcards dl{display:grid;grid-template-columns:minmax(72px,30%) 1fr;gap:4px 10px;margin:10px 0;padding:10px 12px;background:#fff;border:1px solid var(--line);border-radius:10px;font-size:14px}.mdcards dt{color:#5B6472;font-weight:700}.mdcards dd{margin:0}
pre{white-space:pre-wrap;word-break:break-word;font:14px/1.6 inherit;background:#F8FAFC;border:1px solid var(--line);border-radius:12px;padding:12px;margin:8px 0;max-height:520px;overflow:auto}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px;margin:8px 0}.grid img,.grid video{width:100%;border-radius:10px;border:1px solid var(--line);display:block;background:#000}
.btn{display:inline-block;background:var(--blue);color:#fff;border:0;border-radius:999px;padding:12px 18px;font-weight:700;font-size:15px;cursor:pointer;text-decoration:none;font-family:inherit}.btn.ghost{background:#fff;color:var(--blue);border:1.5px solid var(--blue)}
.appr{margin-top:12px;background:#EEF2FF;border-radius:12px;padding:12px;font-size:14px;line-height:1.6}.appr .row{margin:10px 0}.appr details{margin-top:6px}.appr summary{cursor:pointer;color:var(--blue);font-weight:700}.appr textarea{width:100%;min-height:90px;border:1.5px solid var(--line);border-radius:10px;padding:10px;font:inherit;margin:8px 0}
.opts{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px;margin:12px 0 4px}.opt{background:#fff;border:1.5px solid var(--line);border-radius:12px;padding:10px;display:flex;flex-direction:column;gap:8px}.opt img,.opt video{width:100%;border-radius:8px;border:1px solid var(--line);display:block;background:#000}.opt img{background:#fff}.opt video{aspect-ratio:9/16;max-height:360px;object-fit:contain}.opt .rec{display:inline-block;font-size:11px;font-weight:700;color:#0A4DF5;background:#EEF3FF;border-radius:999px;padding:1px 7px;margin-left:4px;vertical-align:middle}.opt .ol{font-size:14px}.opt .on{font-size:12.5px;color:var(--muted);line-height:1.45}.opt .btn{margin-top:auto;padding:10px 12px;font-size:14px;text-align:center}
.ok{margin-top:10px;color:#0B7A3E;font-weight:700}.rev{margin-top:10px;color:#B45309;font-size:14px}.muted{color:var(--muted);font-size:14px}
.flash{background:#E7F7EE;color:#0B7A3E;border-radius:12px;padding:12px 14px;font-weight:700;margin-bottom:14px}.pv{background:#FEF3C7;color:#92400E;border-radius:12px;padding:10px 14px;font-size:13px;margin-bottom:14px}
footer{text-align:center;color:var(--muted);font-size:13px;padding:24px 16px}footer a{color:var(--blue)}
</style></head><body>
<header><div class="logo">Biz<span>Higher</span></div><h1>${biz} 사장님 결과물</h1><p>${esc(job.service_name || '')} · 이 페이지는 사장님만 보는 주소입니다. 북마크해 두세요.</p></header>
<main>${msg ? `<div class="flash">${esc(msg)}</div>` : ''}${preview ? '<div class="pv">미리보기 모드 — 점선 상자는 아직 고객에게 전달되지 않은 결과물입니다.</div>' : ''}
${siteCard(site, siteTask, env)}${items || '<div class="card"><p class="muted">아직 전달된 결과물이 없습니다. 작업이 진행되면 여기에 쌓입니다.</p></div>'}
</main><footer>궁금한 점은 <a href="mailto:hello@bizhigher.com">hello@bizhigher.com</a> · 수정 1회 무료 · <a href="https://bizhigher.com/terms/">이용약관</a></footer></body></html>`;
}

const html = (s, status = 200) => new Response(s, { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } });

export async function onRequestGet({ params, env, request }) {
  const data = await load(env, params.token);
  if (!data) return html('<!doctype html><meta charset="utf-8"><p style="font-family:sans-serif;padding:40px">페이지를 찾을 수 없습니다. 링크를 다시 확인해 주세요.</p>', 404);
  const u = new URL(request.url);
  const preview = u.searchParams.get('preview') === '1';
  const ds = preview ? data.ds : data.ds.filter((d) => d.sent_at);
  const msg = u.searchParams.get('ok') === 'approve' ? '승인해 주셔서 감사합니다. 예정대로 진행하겠습니다.' : u.searchParams.get('ok') === 'choice' ? '골라 주셔서 감사합니다. 그 디자인으로 나머지를 만들어 올려드리겠습니다.' : u.searchParams.get('ok') === 'revise' ? '수정 요청을 받았습니다. 반영해서 다시 올려드리겠습니다.' : u.searchParams.get('ok') === 'site' ? '웹사이트 수정 요청을 받았습니다. 반영되면 같은 주소에서 보실 수 있습니다.' : u.searchParams.get('ok') === 'reply' ? '답변 감사합니다. 확인해서 반영하겠습니다.' : '';
  return html(page(data.job, ds, { preview, msg, site: data.site, siteTask: data.siteTask, env }));
}

export async function onRequestPost({ params, env, request, waitUntil }) {
  const wake = (why) => { try { const p = wakeRoutine(env.DB, env, why); if (waitUntil) waitUntil(p); } catch {} }; // 고객 행동으로 AI 차례가 열리면 루틴을 깨운다
  const data = await load(env, params.token);
  if (!data) return html('not found', 404);
  const form = await request.formData().catch(() => null);
  if (!form) return html('bad request', 400);
  const id = Number(form.get('id')); const action = String(form.get('action') || ''); const note = String(form.get('note') || '').trim().slice(0, 2000);
  if (action === 'site-revise') {
    if (!data.site) return html('bad request', 400);
    if (!note) return html('수정 내용을 적어 주세요', 400);
    const t = await env.DB.prepare(`SELECT id, status, revise_note FROM job_tasks WHERE job_id = ? AND key = 'web-2' ORDER BY id DESC LIMIT 1`).bind(data.job.id).first().catch(() => null);
    const tagged = '[고객 수정 요청] ' + note;
    if (t) await env.DB.prepare(`UPDATE job_tasks SET status = 'doing', claimed_at = NULL, revise_note = ?, done_at = NULL WHERE id = ?`).bind(t.status === 'doing' && t.revise_note ? t.revise_note + '\n' + tagged : tagged, t.id).run();
    await addEvent(env.DB, data.job.id, 'customer', null, null, `✎ 웹사이트 수정 요청 (고객 페이지) — ${note.slice(0, 200)}${t ? '' : ' (web-2 단계 없음 — 수동 처리)'}`);
    wake('고객 웹사이트 수정 요청');
    return Response.redirect(new URL(`/c/${params.token}?ok=site`, request.url).toString(), 303);
  }
  if (action === 'reply') {
    const r = data.ds.find((x) => x.id === id && x.sent_at);
    if (!r) return html('bad request', 400);
    if (!note) return html('내용을 적어 주세요', 400);
    const day = new Date().toISOString().slice(0, 10);
    const merged = (r.customer_reply ? r.customer_reply + '\n' : '') + `[${day}] ${note}`;
    await env.DB.prepare(`UPDATE deliverables SET customer_reply = ?, reply_at = datetime('now') WHERE id = ?`).bind(merged.slice(0, 8000), r.id).run();
    // 고객 프로필(ob-3) 맨 앞에 붙인다 — 뒤 AI 단계가 모두 done_results 로 프로필을 읽으므로 답이 다음 결과물에 바로 반영된다(뒤에 붙이면 4000자 자르기에 잘린다)
    const tag = `[고객 답변 ${day} — ${customerTitle(r.task && r.task.key, r.title)}] ${note}`;
    await env.DB.prepare(`UPDATE job_tasks SET result_text = ? || char(10) || char(10) || COALESCE(result_text, '') WHERE job_id = ? AND key = 'ob-3'`).bind(tag.slice(0, 2000), data.job.id).run().catch(() => {});
    await addEvent(env.DB, data.job.id, 'customer', null, null, `💬 고객 답변 (고객 페이지) — ${r.title}: ${note.slice(0, 300)}`);
    const biz = (data.job.business || '').replace(/\s*\(데모\)/, '');
    const p = notify(env, `[BizHigher] ${biz} — 고객 답변 도착`, [['결과물', esc(customerTitle(r.task && r.task.key, r.title))], ['답변', esc(note).replace(/\n/g, '<br>')], ['반영', '고객 프로필(ob-3) 맨 앞에 붙였습니다 — 다음 AI 단계부터 읽습니다. 웹사이트·구글 프로필에 바로 고칠 내용이면 관리자 "AI에게 수정 요청"으로 넘겨 주세요']]).catch(() => {});
    if (waitUntil) waitUntil(p);
    return Response.redirect(new URL(`/c/${params.token}?ok=reply`, request.url).toString(), 303);
  }
  const d = data.ds.find((x) => x.id === id && x.sent_at);
  if (!d || !d.needs_approval) return html('bad request', 400);
  const db = env.DB;
  if (action === 'approve') {
    const options = parseOptions(d.options); const choice = String(form.get('choice') || '').slice(0, 20);
    if (options.length && !options.some((o) => o.key === choice)) return html('디자인을 하나 골라 주세요', 400);
    await approveDeliverable(db, d, { source: 'customer', note: '고객 페이지에서 승인' + (choice ? ' — 선택 ' + choice : ''), choice });
    wake(choice ? `고객 선택 ${choice} — ${d.title.slice(0, 50)}` : `고객 승인 — ${d.title.slice(0, 50)}`);
    return Response.redirect(new URL(`/c/${params.token}?ok=${choice ? 'choice' : 'approve'}`, request.url).toString(), 303);
  }
  if (action === 'revise') {
    if (!note) return html('수정 내용을 적어 주세요', 400);
    await db.prepare(`UPDATE deliverables SET revise_note = ?, approved_at = NULL WHERE id = ?`).bind(note, d.id).run();
    if (d.task) await db.prepare(`UPDATE job_tasks SET status = 'doing', claimed_at = NULL, revise_note = ?, done_at = NULL WHERE id = ?`).bind('[고객 수정 요청] ' + note, d.task.id).run();
    await addEvent(db, data.job.id, 'customer', null, null, `✎ 고객 수정 요청 (고객 페이지) — ${d.title}: ${note}`);
    wake(`고객 수정 요청 — ${d.title.slice(0, 50)}`);
    return Response.redirect(new URL(`/c/${params.token}?ok=revise`, request.url).toString(), 303);
  }
  return html('bad request', 400);
}
