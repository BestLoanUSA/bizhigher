/**
 * 사장님 대시보드 — 고객 페이지(/c/{token}) · 로그인 사장님 페이지(/my/) · 데모(/my/demo) 공용 렌더러 (2026-11-07)
 * 데이터 읽기·쓰기는 부르는 쪽([token].js · my/[[path]].js)이 하고, 여기는 HTML 만 만든다.
 * 결과물 본문 규칙(customerText·mdHtml·body)은 2026-11-03~04 고객 페이지 정리 그대로 옮겨 왔다.
 */
import { parseOptions, jobProgress } from '../api/_orders.js';
import { customerTitle } from '../api/_playbook.js';
import { PORTAL_CSS } from './_portal.js';

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const EMBED_RE = /^https:\/\/([a-z0-9-]+\.)*(bizhigher-sites\.pages\.dev|sites\.bizhigher\.com|bizhigher\.com)(\/|$)/i;

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
  // 데모 사장님(_demo.js) — 실제 사이트 대신 같은 모양의 그림. 실제 고객은 아래 iframe 으로 사이트가 그대로 열린다
  if (site.demo) return `<section class="card site" id="site"><div class="meta">웹사이트 · ${esc(site.domain)}</div><h2>내 웹사이트</h2><div class="site-demo"><div class="bar"><i></i><i></i><i></i><span>${esc(site.domain)}</span></div><div class="hero2" style="background-image:url('${esc(site.demo_photo)}')"><b>순두부 하우스</b><span>가든그로브 정통 순두부 · 매일 11시~9시</span><em>📞 전화하기</em></div></div><p class="muted">데모라 그림으로 보여 드립니다. 실제 고객 페이지에서는 사장님 사이트가 이 자리에서 그대로 열리고, 아래 칸에 고칠 곳을 적으면 보통 하루 안에 반영됩니다.</p></section>`;
  const url = site.domain && site.live ? `https://${site.domain}/` : `https://${site.slug}.sites.bizhigher.com/`;
  const alt = `https://${(env && env.SITES_PROJECT) || 'bizhigher-sites'}.pages.dev/${site.slug}/`;
  const pending = siteTask && siteTask.status === 'doing' && siteTask.revise_note;
  return `<section class="card site" id="site"><div class="meta">웹사이트${site.domain && site.live ? '' : ' · 임시 주소(검색 비노출) — 도메인 연결 전'}</div><h2>내 웹사이트</h2>
    <iframe src="${esc(alt)}" title="웹사이트 미리보기" loading="lazy" style="width:100%;height:520px;border:1px solid #e5e7eb;border-radius:12px;background:#fff;margin:8px 0"></iframe>
    <p><a class="btn" href="${esc(url)}" target="_blank" rel="noopener">사이트 열기 →</a> <a class="btn ghost" href="${esc(alt)}" target="_blank" rel="noopener">임시 주소</a></p>
    <div class="appr"><b>고치고 싶은 곳이 있으면 적어 주세요.</b> 영업시간·사진·문구·색감 무엇이든 괜찮습니다. 반영 후 같은 주소에서 바로 보실 수 있습니다(보통 하루 안).
      ${pending ? `<div class="rev">✎ 접수된 요청: ${esc(siteTask.revise_note.replace(/^\[고객 수정 요청\]\s*/, ''))} — 반영 중입니다</div>` : ''}
      <form method="post"><input type="hidden" name="action" value="site-revise"><textarea name="note" required placeholder="예: 토요일 영업시간을 17시 마감으로, 첫 화면 사진을 매장 외관으로"></textarea><button class="btn ghost" type="submit">웹사이트 수정 요청</button></form>
    </div></section>`;
}

/* 고른 뒤에도 결과물이 보여야 한다 — 영상은 고른 영상을 재생 가능하게, 나머지 선택지는 접어서 (2026-11-04: 고르고 나면 영상이 썸네일만 남던 문제) */
function chosenMedia(chosen, options) {
  const media = (o, big) => o.video ? `<video src="${esc(o.video)}"${o.image ? ` poster="${esc(o.image)}"` : ''} controls playsinline preload="metadata"${big ? ' class="pick"' : ''}></video>` : o.image ? `<a href="${esc(o.image)}" target="_blank" rel="noopener"><img src="${esc(o.image)}" alt="${esc(o.label)}" loading="lazy"></a>` : '';
  let h = chosen && (chosen.video || chosen.image) ? `<div class="grid one">${media(chosen, true)}</div>` : '';
  const rest = options.filter((o) => o !== chosen && (o.video || o.image));
  if (rest.length) h += `<details class="more"><summary>${rest.some((o) => o.video) ? '다른 영상' : '다른 시안'} ${rest.length}개 보기</summary><div class="opts">${rest.map((o) => `<div class="opt">${media(o)}<div class="ol"><b>${esc(o.key)}.</b> ${esc(o.label)}</div></div>`).join('')}</div></details>`;
  return h;
}

/* 실시간 리포트 카드 — 페이지 맨 위. 리포트는 실제 판형 그대로 iframe(스크립트 없음)으로, 높이는 부모가 맞춘다. JS 가 없으면 고정 높이 안에서 스크롤 */
export function reportCard(report, { periods, sel, preview, token }) {
  if (!report) return '';
  const q = (r) => `?${[preview ? 'preview=1' : '', r ? 'r=' + r : ''].filter(Boolean).join('&')}`.replace(/\?$/, '');
  const tabs = [`<a href="${q('') || '?'}"${!sel ? ' aria-current="true"' : ''}><i></i>실시간</a>`, ...periods.map((p) => `<a href="${q(p)}"${sel === p ? ' aria-current="true"' : ''}>${Number(p.slice(5))}월 리포트</a>`)].join('');
  return `<section class="card rep"><div class="rhead"><h2>내 리포트</h2><nav class="rtabs" aria-label="리포트 고르기">${tabs}</nav></div>
<iframe class="rframe" title="리포트" sandbox="allow-same-origin" srcdoc="${esc(report)}"></iframe>
<p class="rfoot"><a href="/c/${esc(token)}?view=report${sel ? '&r=' + sel : ''}" target="_blank" rel="noopener">전체 화면으로 보기 · 인쇄 →</a></p></section>
<script>(function(){try{var f=document.querySelector('.rframe');if(!f)return;function fit(){try{var h=f.contentDocument&&f.contentDocument.documentElement.scrollHeight;if(h>200)f.style.height=h+'px';}catch(e){}}f.addEventListener('load',fit);window.addEventListener('resize',fit);setTimeout(fit,1200);setTimeout(fit,3000);}catch(e){}})();</script>`;
}


/* ── 사장님 대시보드 (2026-11-07 David 요청: "업데이트되는 내용과 리포트와 결정사항을 업주가 한눈에") ──
   같은 화면을 세 곳이 쓴다: /c/{token}(메일 링크) · /my/(구글·카카오 로그인) · /my/demo(데모 사장님)
   순서: 인사·숫자 → 한눈에(마케팅 포털) → 결정할 것 | 새 소식 → 리포트 → 받은 결과물
   결정할 것 = 승인·선택 대기 결과물 + 답이 필요한 안내(ASK) + 사장님 차례 단계(HOWTO). 지난 결정은 접어서 */

/* 승인 카드가 대신하는 고객 단계(선택·승인 대기)와 사장님이 원할 때만 쓰는 단계는 "사장님 차례"에서 뺀다 */
const PAIRED = new Set(['post-3', 'seo-3b', 'sv-1b', 'sv-2b', 'qr-2b', 'web-2b', 'ob-2', 'cp-1']);
const HOWTO = {
  'ob-4': '가게 사진·로고·메뉴판을 질문지 페이지에 올리거나 메일로 보내 주세요.',
  'gpo-1': '구글 비즈니스 프로필에서 hello@bizhigher.com 을 관리자로 초대해 주세요 (2분).',
  'post-1': '인스타그램·페이스북 페이지에 BizHigher 를 파트너로 추가해 주세요.',
  'an-1': '웹사이트 관리자 접근 권한을 주세요 (BizHigher 가 만든 사이트면 필요 없습니다).',
  'seo-1': '구글 서치콘솔·애널리틱스에 hello@bizhigher.com 을 추가해 주세요.',
  'ads-1': '광고 계정에 결제 카드를 등록해 주세요 (광고비는 사장님 카드에서 바로 나갑니다).',
};
/* 새 소식 — 우리가 끝낸 일 중 사장님이 알아들을 수 있는 것만, 쉬운 말로 */
const FEED = {
  'post-5': ['📍', '구글 프로필에 새 게시물을 올렸습니다'],
  'post-6': ['📸', '인스타그램·페이스북에 게시물을 올렸습니다'],
  'rr-6': ['💬', '새 리뷰에 답글을 달았습니다'],
  'seo-5': ['✍️', '블로그 글을 발행했습니다'],
  'sv-4': ['🎬', '숏폼 영상을 올렸습니다'],
  'llc-1': ['🗂', '새 등록처 5곳에 가게를 올렸습니다'],
  'gc-4': ['🛠', '구글 프로필 정보를 최신으로 고쳤습니다'],
  'gc-3': ['🔎', '주변 가게의 스팸 정보를 점검했습니다'],
  'cp-3': ['🛡', '웹사이트 백업·속도·보안 점검을 마쳤습니다'],
  'seo-9': ['📈', '검색 데이터를 보고 웹사이트 문구를 다듬었습니다'],
  'seo-8': ['🗺', '새 지역 페이지를 열었습니다'],
  'mr-6': ['🧭', '지도 순위를 가게 주변 49지점에서 다시 쟀습니다'],
  'lls-6': ['🗂', '핵심 등록처 30곳에 가게를 올렸습니다'],
  'ac-3': ['🎨', '이번 달 광고 이미지를 만들었습니다'],
};
const ASK = new Set(['ob-5', 'gc-2']); // 답이 필요한 안내 — 답하기 전까지 "결정할 것"에 둔다
const CLOSED_T = new Set(['done', 'skipped']);

const ts = (s) => { const v = String(s || ''); return Date.parse(v.replace(' ', 'T') + (/[zZ]$|[+-]\d\d:?\d\d$/.test(v) ? '' : 'Z')); };
const laDay = (ms) => new Date(ms).toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
function dayLabel(ms) {
  const d = laDay(ms);
  if (d === laDay(Date.now())) return '오늘';
  if (d === laDay(Date.now() - 86400000)) return '어제';
  const [y, m, dd] = d.split('-');
  return `${y !== laDay(Date.now()).slice(0, 4) ? y + '년 ' : ''}${Number(m)}월 ${Number(dd)}일`;
}
const clean = (b) => String(b || '').replace(/\s*\(데모\)/, '');

export const SSO_ICON = {
  google: '<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>',
  kakao: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#191919" d="M12 3.2c-5.3 0-9.6 3.4-9.6 7.6 0 2.7 1.8 5.1 4.5 6.4l-1.1 4.1c-.1.4.3.6.6.4l4.8-3.2c.3 0 .5.1.8.1 5.3 0 9.6-3.4 9.6-7.7S17.3 3.2 12 3.2z"/></svg>',
};

function itemCard(d) {
  const options = parseOptions(d.options);
  const chosen = options.find((o) => o.key === d.choice);
  // 선택지가 있는 결과물(시안·세트·버전): 카드마다 "이 디자인으로 진행" — 고객이 고르는 승인 (2026-10-27)
  const choiceCards = options.length ? `<div class="opts">${options.map((o) => `<form method="post" class="opt"><input type="hidden" name="id" value="${d.id}"><input type="hidden" name="action" value="approve"><input type="hidden" name="choice" value="${esc(o.key)}">${o.video ? `<video src="${esc(o.video)}" poster="${esc(o.image)}" controls playsinline preload="metadata"></video>` : o.image ? `<a href="${esc(o.image)}" target="_blank" rel="noopener"><img src="${esc(o.image)}" alt="${esc(o.label)}" loading="lazy"></a>` : ''}<div class="ol"><b>${esc(o.key)}.</b> ${esc(o.label)}${o.default ? ' <span class="rec">추천</span>' : ''}</div>${o.note ? `<div class="on">${esc(o.note)}</div>` : ''}<button class="btn" type="submit">${o.video ? '이 영상으로 진행' : '이 디자인으로 진행'}</button></form>`).join('')}</div>` : '';
  const approval = d.needs_approval && !d.approved_at ? `
      <div class="appr"><b>${options.length ? (options.some((o) => o.video) ? '마음에 드는 영상을 골라 주세요.' : '마음에 드는 디자인을 골라 주세요.') : '확인 부탁드립니다.'}</b> ${options.length ? (options.some((o) => o.video) ? '재생해 보시고 먼저 올릴 것을 골라 주세요. 7일 안에 회신이 없으면 추천 표시된 것으로 진행합니다.' : '이미지를 누르면 크게 보입니다. 고르시면 그 디자인으로 나머지를 만듭니다. 7일 안에 회신이 없으면 가게 분위기에 맞는 것으로 진행합니다.') : '내용이 괜찮으면 승인을 눌러 주세요. 7일 안에 회신이 없으면 승인된 것으로 보고 예정대로 진행합니다(게시 후에도 수정 1회 무료).'}
        ${options.length ? choiceCards : `<form method="post" class="row"><input type="hidden" name="id" value="${d.id}"><input type="hidden" name="action" value="approve"><button class="btn" type="submit">✓ 이대로 진행해 주세요</button></form>`}
        <details${d.revise_note ? ' open' : ''}><summary>수정 요청하기</summary>${d.revise_note ? `<div class="rev">✎ 접수된 요청: ${esc(d.revise_note)} — 반영 후 다시 올려드립니다</div>` : ''}<form method="post"><input type="hidden" name="id" value="${d.id}"><input type="hidden" name="action" value="revise"><textarea name="note" required placeholder="무엇을 어떻게 고칠지 적어 주세요 (예: 2주차 게시물 가격 문구 삭제)"></textarea><button class="btn ghost" type="submit">수정 요청 보내기</button></form></details>
      </div>` : d.approved_at ? `<div class="ok">✓ ${esc(dayLabel(ts(d.approved_at)))} 승인됨${chosen ? ` · 선택: ${esc(chosen.key)}. ${esc(chosen.label)}` : ''}</div>${chosenMedia(chosen, options)}` : '';
  // 승인 버튼이 없는 결과물(킥오프 안내 등)에도 답할 길을 둔다 — 킥오프의 '확인 부탁드려요' 질문에 메일 말고는 답할 곳이 없었다(2026-11-04)
  const ask = d.task && ASK.has(d.task.key);
  const reply = !d.needs_approval ? `<details class="reply"${ask && !d.customer_reply ? ' open' : ''}><summary>${ask ? '확인 질문에 답하기' : '답변·질문 남기기'}</summary>${d.customer_reply ? `<div class="ok">💬 보내 주신 답변: ${esc(d.customer_reply).replace(/\n/g, '<br>')}</div>` : ''}<form method="post"><input type="hidden" name="id" value="${d.id}"><input type="hidden" name="action" value="reply"><textarea name="note" required placeholder="${ask ? '예: 12/24는 8시까지, 12/31은 6시까지, 1/1은 쉽니다.' : '궁금한 점이나 덧붙일 내용을 적어 주세요'}"></textarea><button class="btn ghost" type="submit">보내기</button></form></details>` : '';
  return `<section class="card${d.sent_at ? '' : ' draft'}" id="d${d.id}"><div class="meta">${d.sent_at ? esc(dayLabel(ts(d.sent_at))) : '전달 전 (미리보기)'}</div><h2>${esc(customerTitle(d.task && d.task.key, d.title))}</h2>${d.summary ? `<p class="sum">${esc(d.summary)}</p>` : ''}${body(d)}${approval}${reply}</section>`;
}

function feedHtml(ds, tasks) {
  const ev = [];
  for (const d of ds) {
    if (!d.sent_at) continue;
    const t = customerTitle(d.task && d.task.key, d.title);
    ev.push({ at: ts(d.sent_at), i: '📦', t, s: d.needs_approval && !d.approved_at ? '확인 필요' : '받음', href: `#d${d.id}`, hot: d.needs_approval && !d.approved_at });
    if (d.approved_at) { const o = parseOptions(d.options).find((x) => x.key === d.choice); ev.push({ at: ts(d.approved_at), i: '✓', t, s: o ? `${o.key}안 선택` : '승인', you: 1, href: `#d${d.id}` }); }
    if (d.reply_at) ev.push({ at: ts(d.reply_at), i: '💬', t, s: '답변 보냄', you: 1, href: `#d${d.id}` });
  }
  for (const t of tasks) { const f = FEED[t.key]; if (f && t.status === 'done' && t.done_at) ev.push({ at: ts(t.done_at), i: f[0], t: f[1] }); }
  const list = ev.filter((e) => !isNaN(e.at)).sort((a, b) => b.at - a.at).slice(0, 14);
  if (!list.length) return '<p class="muted">작업이 시작되면 여기에 날짜별로 쌓입니다.</p>';
  let last = '', out = '';
  for (const e of list) {
    const lab = dayLabel(e.at);
    if (lab !== last) { out += `<li class="fd">${esc(lab)}</li>`; last = lab; }
    const inner = `<i>${e.i}</i><span class="ft"><b>${esc(e.t)}</b><em>${e.you ? '<u>사장님</u>' : ''}${esc(e.s || '')}</em></span>`;
    out += `<li class="fe${e.hot ? ' hot' : ''}">${e.href ? `<a href="${e.href}">${inner}</a>` : `<div>${inner}</div>`}</li>`;
  }
  return `<ol class="feed">${out}</ol>`;
}

/**
 * @param mode 'token'(메일 링크) | 'owner'(로그인) | 'demo'
 * @param account 로그인 계정 {n 이름, e 이메일, p google|kakao|demo}
 * @param jobs 로그인한 계정의 작업 목록(2개 이상이면 위에 고르는 줄)
 */
export function renderDashboard({ job, ds, tasks = [], site, siteTask, env, report, portal, msg, preview, mode = 'token', token, account, jobs, jobId }) {
  const biz = esc(clean(job.business));
  const visible = ds;
  const pending = visible.filter((d) => d.needs_approval && !d.approved_at);
  const asks = visible.filter((d) => d.sent_at && !d.needs_approval && d.task && ASK.has(d.task.key) && !d.customer_reply && Date.now() - ts(d.sent_at) < 45 * 86400000);
  const decideIds = new Set([...pending, ...asks].map((d) => d.id));
  const yours = tasks.filter((t) => t.who === 'customer' && !CLOSED_T.has(t.status) && !PAIRED.has(t.key) && t.phase !== 'daily' && t.phase !== 'weekly');
  const past = visible.filter((d) => d.approved_at).sort((a, b) => ts(b.approved_at) - ts(a.approved_at)).slice(0, 8);
  const nDecide = pending.length + asks.length + yours.length;
  const pct = jobProgress(tasks);
  const done30 = tasks.filter((t) => t.status === 'done' && t.who !== 'customer' && t.service !== 'common' && t.done_at && Date.now() - ts(t.done_at) < 30 * 86400000).length;
  const la = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
  const nextRep = `${la.getMonth() === 11 ? 1 : la.getMonth() + 2}월 1일`;
  const nowLabel = new Date().toLocaleString('ko-KR', { timeZone: 'America/Los_Angeles', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' });

  const who = account ? esc(account.n || account.e || '') : '';
  const acct = account
    ? `<div class="ob-acct"><span class="av av-${esc(account.p || '')}">${esc(String(account.n || account.e || '?').trim().charAt(0).toUpperCase())}</span><span class="an">${who}</span>${mode === 'demo' ? '<a href="/login/">로그인 화면</a>' : '<a href="/auth/logout">로그아웃</a>'}</div>`
    : mode === 'token' ? '<div class="ob-acct"><a class="ob-login" href="#connect">🔑 로그인 연결</a></div>' : '';
  const switcher = jobs && jobs.length > 1 ? `<nav class="ob-jobs" aria-label="가게 고르기">${jobs.map((j) => `<a href="/my/?job=${j.id}"${j.id === jobId ? ' aria-current="true"' : ''}>${esc(clean(j.business))}<small>${esc(j.service_name || '')}</small></a>`).join('')}</nav>` : '';
  const connect = mode === 'token' && token ? `<div class="ob-connect" id="connect"><div class="ob-in"><span class="cx"><b>다음부터는 클릭 한 번으로 들어오세요</b><span>구글이나 카카오 계정을 연결해 두면 이 메일 링크를 찾지 않아도 <u>bizhigher.com/login</u> 에서 바로 열립니다.</span></span><a class="sso g" href="/auth/google?link=${esc(token)}">${SSO_ICON.google}Google로 연결</a><a class="sso k" href="/auth/kakao?link=${esc(token)}">${SSO_ICON.kakao}카카오로 연결</a></div></div>` : '';
  const demo = mode === 'demo' ? `<div class="ob-demo"><div class="ob-in"><b>데모 화면</b><span>가상의 "순두부 하우스" 사장님이 로그인하면 보는 화면입니다. 숫자는 예시이고, 버튼을 눌러도 실제로 처리되지는 않습니다.</span><a href="/free-audit/">우리 가게 무료 진단 →</a></div></div>` : '';

  const decide = `<section class="ob-sec" id="decide"><div class="ob-h"><h2>결정할 것</h2>${nDecide ? `<span class="cnt hot">${nDecide}</span>` : ''}</div>
${nDecide ? '' : '<div class="card ob-none">✓ 지금 결정하실 것은 없습니다. 확인할 것이 생기면 여기 맨 위에 뜹니다.</div>'}
${yours.length ? `<div class="card ob-turn"><h3>사장님 차례</h3><ul>${yours.map((t) => `<li><b>${esc(customerTitle(t.key, t.title))}</b>${HOWTO[t.key] ? `<span>${esc(HOWTO[t.key])}</span>` : ''}</li>`).join('')}</ul></div>` : ''}
${pending.map(itemCard).join('')}${asks.map(itemCard).join('')}
${past.length ? `<details class="card ob-past"><summary>지난 결정 ${past.length}건</summary><ul>${past.map((d) => { const o = parseOptions(d.options).find((x) => x.key === d.choice); return `<li><time>${esc(dayLabel(ts(d.approved_at)))}</time><a href="#d${d.id}">${esc(customerTitle(d.task && d.task.key, d.title))}</a><em>${o ? `${esc(o.key)}안 — ${esc(o.label)}` : '승인'}</em></li>`; }).join('')}</ul></details>` : ''}
</section>`;
  const news = `<section class="ob-sec" id="news"><div class="ob-h"><h2>새 소식</h2><span class="live"><i></i>실시간</span></div><div class="card ob-feed">${feedHtml(visible, tasks)}</div></section>`;
  const others = visible.filter((d) => !decideIds.has(d.id));

  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${biz} — 사장님 페이지 | BizHigher</title>
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">
<style>${BASE_CSS}${PORTAL_CSS}${DASH_CSS}</style></head><body>
<header class="ob-top"><div class="ob-in"><a class="logo" href="/">Biz<span>Higher</span></a><span class="ob-biz">${biz}</span>${acct}</div></header>
${switcher}
<section class="ob-hello"><div class="ob-in"><p class="ob-eye">사장님 전용 페이지 · ${esc(nowLabel)} 기준</p><h1>${biz} 사장님, 안녕하세요</h1><p class="ob-sub">${esc(job.service_name || '')}</p>
<div class="ob-stats"><a href="#decide"${nDecide ? ' class="hot"' : ''}>결정할 것 <b>${nDecide}</b></a><a href="#news">최근 30일 한 일 <b>${done30}</b></a><a href="#glance">전체 진행 <b>${pct}%</b></a><a href="#report">다음 월간 리포트 <b>${nextRep}</b></a></div></div></section>
<nav class="ob-nav" aria-label="이 페이지"><a href="#glance">한눈에</a><a href="#decide">결정할 것${nDecide ? ` <i>${nDecide}</i>` : ''}</a><a href="#news">새 소식</a><a href="#report">리포트</a><a href="#files">받은 결과물</a></nav>
${demo}${connect}
<div class="ob-main">${msg ? `<div class="flash">${esc(msg)}</div>` : ''}${preview ? '<div class="pv">미리보기 모드 — 점선 상자는 아직 고객에게 전달되지 않은 결과물입니다.</div>' : ''}</div>
<div id="glance">${portal || ''}</div>
<div class="ob-main"><div class="ob-two">${decide}${news}</div>
<section class="ob-sec" id="report">${report || '<div class="card"><h2>내 리포트</h2><p class="muted">첫 월간 리포트는 시작 한 달 뒤에 여기에 올라옵니다.</p></div>'}</section>
<section class="ob-sec" id="files"><div class="ob-h"><h2>받은 결과물</h2>${others.length ? `<span class="cnt">${others.length}</span>` : ''}</div>
${siteCard(site, siteTask, env)}${others.map(itemCard).join('') || '<div class="card"><p class="muted">아직 전달된 결과물이 없습니다. 작업이 진행되면 여기에 쌓입니다.</p></div>'}</section>
</div><footer>궁금한 점은 결과물 아래 답변 칸이나 <a href="mailto:hello@bizhigher.com">hello@bizhigher.com</a> · 수정 1회 무료 · <a href="/terms/">이용약관</a></footer></body></html>`;
}

const BASE_CSS = `:root{--blue:#0A4DF5;--navy:#0A1B4D;--ink:#111318;--muted:#6B7280;--line:#E5E7EB}*{box-sizing:border-box}body{margin:0;font-family:Pretendard,-apple-system,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;background:#F3F4F7;color:var(--ink)}
.card{background:#fff;border:1px solid var(--line);border-radius:16px;padding:18px 16px;margin-bottom:14px}.card.draft{border-style:dashed;background:#FFFBEB}.card h2{font-size:17px;margin:2px 0 8px}.meta{font-size:12px;color:var(--muted)}.sum{font-size:15px;line-height:1.6;margin:0 0 10px}
.md{background:#F8FAFC;border:1px solid var(--line);border-radius:12px;padding:4px 14px;margin:8px 0;font-size:15px;line-height:1.65}.md p,.md ul,.md ol{margin:10px 0}.md ul,.md ol{padding-left:20px}.md li{margin:4px 0}.mdh{font-size:16px;margin:16px 0 6px}.md .tw{overflow-x:auto;margin:10px 0}.md table{border-collapse:collapse;width:100%;font-size:14px;background:#fff}.md th,.md td{border:1px solid var(--line);padding:6px 8px;text-align:left;vertical-align:top}.md th{background:#EEF2F7}.md a{word-break:break-all}.reply{margin-top:12px}.reply summary{cursor:pointer;font-weight:700;color:var(--accent,#0A4DF5)}.reply textarea{width:100%;min-height:90px;margin:8px 0;padding:10px;border:1px solid var(--line);border-radius:10px;font:inherit}.mdcards dl{display:grid;grid-template-columns:minmax(72px,30%) 1fr;gap:4px 10px;margin:10px 0;padding:10px 12px;background:#fff;border:1px solid var(--line);border-radius:10px;font-size:14px}.mdcards dt{color:#5B6472;font-weight:700}.mdcards dd{margin:0}
pre{white-space:pre-wrap;word-break:break-word;font:14px/1.6 inherit;background:#F8FAFC;border:1px solid var(--line);border-radius:12px;padding:12px;margin:8px 0;max-height:520px;overflow:auto}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px;margin:8px 0}.grid img,.grid video{width:100%;border-radius:10px;border:1px solid var(--line);display:block;background:#000}
.btn{display:inline-block;background:var(--blue);color:#fff;border:0;border-radius:999px;padding:12px 18px;font-weight:700;font-size:15px;cursor:pointer;text-decoration:none;font-family:inherit}.btn.ghost{background:#fff;color:var(--blue);border:1.5px solid var(--blue)}
.appr{margin-top:12px;background:#EEF2FF;border-radius:12px;padding:12px;font-size:14px;line-height:1.6}.appr .row{margin:10px 0}.appr details{margin-top:6px}.appr summary{cursor:pointer;color:var(--blue);font-weight:700}.appr textarea{width:100%;min-height:90px;border:1.5px solid var(--line);border-radius:10px;padding:10px;font:inherit;margin:8px 0}
.grid.one{grid-template-columns:minmax(0,320px)}.grid video.pick{width:100%;aspect-ratio:9/16;max-height:560px;background:#000;border-radius:10px}details.more{margin-top:8px}details.more summary{cursor:pointer;color:var(--muted);font-size:14px}.rep{padding:0;overflow:hidden}.rhead{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;padding:16px 18px 12px}.rhead h2{margin:0}.rtabs{display:flex;gap:6px;flex-wrap:wrap}.rtabs a{display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:999px;border:1px solid var(--line);font-size:13px;font-weight:700;color:var(--muted);text-decoration:none;background:#fff}.rtabs a[aria-current]{background:#0F172A;border-color:#0F172A;color:#fff}.rtabs a i{width:7px;height:7px;border-radius:50%;background:#10B981}.rframe{display:block;width:100%;height:1100px;border:0;border-top:1px solid var(--line);background:#F3F5F9}.rfoot{margin:0;padding:10px 18px 14px;font-size:13px}.rfoot a{color:var(--blue,#0A4DF5);font-weight:700;text-decoration:none}.opts{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px;margin:12px 0 4px}.opt{background:#fff;border:1.5px solid var(--line);border-radius:12px;padding:10px;display:flex;flex-direction:column;gap:8px}.opt img,.opt video{width:100%;border-radius:8px;border:1px solid var(--line);display:block;background:#000}.opt img{background:#fff}.opt video{aspect-ratio:9/16;max-height:360px;object-fit:contain}.opt .rec{display:inline-block;font-size:11px;font-weight:700;color:#0A4DF5;background:#EEF3FF;border-radius:999px;padding:1px 7px;margin-left:4px;vertical-align:middle}.opt .ol{font-size:14px}.opt .on{font-size:12.5px;color:var(--muted);line-height:1.45}.opt .btn{margin-top:auto;padding:10px 12px;font-size:14px;text-align:center}
.ok{margin-top:10px;color:#0B7A3E;font-weight:700}.rev{margin-top:10px;color:#B45309;font-size:14px}.muted{color:var(--muted);font-size:14px}
.flash{background:#E7F7EE;color:#0B7A3E;border-radius:12px;padding:12px 14px;font-weight:700;margin-bottom:14px}.pv{background:#FEF3C7;color:#92400E;border-radius:12px;padding:10px 14px;font-size:13px;margin-bottom:14px}
footer a{color:var(--blue)}
`;
const DASH_CSS = `
.ob-in{max-width:1100px;margin:0 auto;padding:0 16px}
.ob-top{background:#0A1B4D;color:#fff}.ob-top .ob-in{display:flex;align-items:center;gap:12px;min-height:56px}.ob-top .logo{font-weight:900;font-size:18px;color:#fff;text-decoration:none;letter-spacing:-.02em}.ob-top .logo span{color:#7FA6FF}
.ob-biz{font-size:14px;font-weight:700;color:#C9D6F5;padding-left:12px;border-left:1px solid rgba(255,255,255,.18);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
.ob-acct{margin-left:auto;display:flex;align-items:center;gap:8px;font-size:13px;flex:none}.ob-acct a{color:#C9D6F5;text-decoration:none;font-weight:700}.ob-acct a:hover{color:#fff}
.av{width:28px;height:28px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-weight:800;font-size:13px;background:#2F5BD3;color:#fff}.av-kakao{background:#FEE500;color:#191919}.av-google{background:#fff;color:#1A73E8}.av-demo{background:#F59E0B;color:#1F1300}
.an{color:#fff;font-weight:700;max-width:140px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ob-login{background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.2);border-radius:999px;padding:6px 12px}
.ob-jobs{background:#0D2160;display:flex;gap:6px;overflow-x:auto;padding:8px 16px;justify-content:center}.ob-jobs a{flex:none;color:#C9D6F5;text-decoration:none;font-size:13px;font-weight:700;border:1px solid rgba(255,255,255,.18);border-radius:10px;padding:6px 12px;display:flex;flex-direction:column}.ob-jobs a small{font-weight:500;font-size:11px;opacity:.75}.ob-jobs a[aria-current]{background:#fff;color:#0A1B4D}
.ob-hello{background:linear-gradient(180deg,#0A1B4D 0%,#14307F 100%);color:#fff;padding:18px 0 26px;position:relative;overflow:hidden}.ob-hello::after{content:'';position:absolute;right:-140px;bottom:-300px;width:420px;height:420px;border-radius:50%;background:radial-gradient(circle,rgba(34,211,238,.28),transparent 65%);pointer-events:none}
.ob-eye{margin:0;font-size:12.5px;font-weight:700;color:#8FB0FF;letter-spacing:.02em}.ob-hello h1{margin:6px 0 2px;font-size:clamp(22px,4.2vw,32px);font-weight:900;letter-spacing:-.03em;line-height:1.25}.ob-sub{margin:0;color:#C9D6F5;font-size:14px}
.ob-stats{display:flex;flex-wrap:wrap;gap:8px;margin-top:16px;position:relative;z-index:1}.ob-stats a{display:inline-flex;align-items:baseline;gap:6px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.16);border-radius:12px;padding:9px 13px;font-size:13px;color:#C9D6F5;text-decoration:none}.ob-stats b{font-size:18px;color:#fff;font-weight:900}.ob-stats a.hot{background:#FBBF24;border-color:#FBBF24;color:#3B2A00}.ob-stats a.hot b{color:#1F1300}
.ob-nav{position:sticky;top:0;z-index:30;display:flex;gap:4px;justify-content:center;overflow-x:auto;padding:8px 12px;background:rgba(243,244,247,.94);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);border-bottom:1px solid var(--line)}.ob-nav a{flex:none;font-size:14px;font-weight:700;color:#374151;text-decoration:none;border-radius:999px;padding:7px 13px}.ob-nav a:hover{background:#fff}.ob-nav i{font-style:normal;display:inline-block;min-width:18px;text-align:center;font-size:11.5px;background:#F59E0B;color:#fff;border-radius:999px;padding:1px 5px;margin-left:2px}
.ob-demo{background:#FFF7E0;border-bottom:1px solid #FDE68A}.ob-demo .ob-in{display:flex;flex-wrap:wrap;gap:6px 12px;align-items:center;padding:10px 16px;font-size:13.5px;color:#713F12}.ob-demo b{background:#F59E0B;color:#fff;border-radius:6px;padding:2px 8px;font-size:12px}.ob-demo a{margin-left:auto;color:#0A4DF5;font-weight:800;text-decoration:none}
.ob-connect{background:#fff;border-bottom:1px solid var(--line)}.ob-connect .ob-in{display:flex;flex-wrap:wrap;align-items:center;gap:8px 10px;padding:12px 16px}.ob-connect .cx{display:flex;flex-direction:column;flex:1 1 300px;font-size:13px;color:var(--muted)}.ob-connect .cx b{color:var(--ink);font-size:14.5px}
.sso{display:inline-flex;align-items:center;justify-content:center;gap:8px;height:42px;padding:0 16px;border-radius:10px;font-weight:700;font-size:14.5px;text-decoration:none;white-space:nowrap}.sso svg{width:18px;height:18px;flex:none}.sso.g{background:#fff;color:#1F1F1F;border:1px solid #D0D4DB}.sso.k{background:#FEE500;color:rgba(0,0,0,.85)}
.ob-main{max-width:1100px;margin:0 auto;padding:0 16px}.ob-main:empty{display:none}.ob-main .flash,.ob-main .pv{margin:14px 0 0}
#glance{scroll-margin-top:60px}.ob-sec{scroll-margin-top:64px;margin-top:22px}.ob-h{display:flex;align-items:center;gap:8px;margin:0 2px 10px}.ob-h h2{margin:0;font-size:19px;font-weight:900;letter-spacing:-.02em}
.cnt{font-size:12.5px;font-weight:800;background:#E5E7EB;color:#374151;border-radius:999px;padding:2px 9px}.cnt.hot{background:#F59E0B;color:#fff}
.live{display:inline-flex;align-items:center;gap:5px;font-size:12px;font-weight:700;color:#047857}.live i{width:7px;height:7px;border-radius:50%;background:#10B981;box-shadow:0 0 0 3px rgba(16,185,129,.2)}
.ob-two{display:grid;gap:0 18px}@media (min-width:980px){.ob-two{grid-template-columns:minmax(0,1.45fr) minmax(0,1fr);align-items:start}#news{position:sticky;top:64px}}
.ob-none{color:#047857;font-weight:700;background:#ECFDF5;border-color:#A7F3D0}
.ob-turn h3{margin:0 0 6px;font-size:15px}.ob-turn ul{margin:0;padding:0;list-style:none;display:grid;gap:8px}.ob-turn li{display:flex;flex-direction:column;gap:2px;padding:10px 12px;border-radius:10px;background:#FFF7ED;border:1px solid #FED7AA}.ob-turn li span{font-size:13.5px;color:#7C2D12}
#decide .card:not(.ob-none):not(.ob-turn):not(.ob-past){border-color:#FCD34D;box-shadow:0 0 0 3px rgba(251,191,36,.18)}
.ob-past summary{cursor:pointer;font-weight:800;color:#374151}.ob-past ul{list-style:none;margin:10px 0 0;padding:0;display:grid;gap:6px}.ob-past li{display:grid;grid-template-columns:62px 1fr;gap:2px 8px;font-size:14px}.ob-past time{color:var(--muted);font-weight:700;grid-row:span 2}.ob-past a{color:var(--ink);font-weight:700;text-decoration:none}.ob-past em{font-style:normal;color:#047857;font-size:13px}
.ob-feed{padding:6px 14px}.feed{list-style:none;margin:0;padding:0}.feed .fd{font-size:12px;font-weight:800;color:var(--muted);padding:12px 0 4px;border-top:1px solid var(--line)}.feed .fd:first-child{border-top:0;padding-top:8px}
.feed .fe a,.feed .fe div{display:flex;gap:10px;align-items:flex-start;padding:7px 0;color:inherit;text-decoration:none}.feed .fe i{font-style:normal;width:28px;height:28px;flex:none;border-radius:8px;background:#F1F4FA;display:inline-flex;align-items:center;justify-content:center;font-size:14px}.feed .fe.hot i{background:#FEF3C7}
.feed .ft{display:flex;flex-direction:column;min-width:0}.feed .ft b{font-size:14px;font-weight:700;line-height:1.35}.feed .ft em{font-style:normal;font-size:12.5px;color:var(--muted)}.feed .fe.hot em{color:#B45309;font-weight:700}.feed u{text-decoration:none;font-size:11px;font-weight:800;color:#0A4DF5;background:#EEF3FF;border-radius:6px;padding:0 6px;margin-right:5px}.feed .fe a:hover b{color:#0A4DF5}
.site-demo{display:block;border:1px solid var(--line);border-radius:12px;overflow:hidden;margin:8px 0;text-decoration:none;color:#fff}.site-demo .bar{display:flex;gap:5px;align-items:center;height:28px;padding:0 10px;background:#F1F4FA;color:#9CA3AF;font-size:12px}.site-demo .bar i{width:8px;height:8px;border-radius:50%;background:#F87171}.site-demo .bar i:nth-child(2){background:#FBBF24}.site-demo .bar i:nth-child(3){background:#34D399}.site-demo .bar span{margin-left:8px}
.site-demo .hero2{height:280px;background:#0A1B4D center/cover;position:relative;display:flex;flex-direction:column;justify-content:flex-end;padding:22px}.site-demo .hero2::before{content:'';position:absolute;inset:0;background:linear-gradient(180deg,rgba(5,10,31,.05),rgba(5,10,31,.75))}.site-demo .hero2>*{position:relative}.site-demo .hero2 b{font-size:28px;font-weight:900}.site-demo .hero2 span{opacity:.9}.site-demo .hero2 em{font-style:normal;margin-top:10px;align-self:flex-start;background:#0A4DF5;border-radius:999px;padding:8px 16px;font-weight:700;font-size:14px}
footer{text-align:center;color:var(--muted);font-size:13px;padding:28px 16px 36px}
.grid video.pick{object-fit:cover}
@media (max-width:640px){.grid{grid-template-columns:repeat(2,minmax(0,1fr))}.ob-biz{display:none}.an{display:none}.ob-nav{justify-content:flex-start}.ob-stats a{padding:7px 10px}.ob-stats b{font-size:16px}.ob-demo a{margin-left:0}.ob-connect .sso{flex:1 1 140px}}
`;
