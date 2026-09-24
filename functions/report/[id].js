/**
 * 진단 리포트 페이지 — GET /report/{id}
 * D1의 reports 테이블에서 리포트를 읽어 브랜드 스타일 HTML로 렌더링합니다.
 * 공유 가능한 고유 URL — 하단에 "우리 가게도 진단하기" 바이럴 CTA 포함.
 */

export async function onRequestGet(context) {
  const { params, env } = context;
  const id = String(params.id || '').replace(/[^a-z0-9]/gi, '').slice(0, 20);
  if (!id) return Response.redirect(new URL('/free-audit/', context.request.url).toString(), 302);

  const row = await env.DB.prepare('SELECT report_json FROM reports WHERE id = ?').bind(id).first();
  if (!row) return Response.redirect(new URL('/free-audit/', context.request.url).toString(), 302);

  let report;
  try {
    report = JSON.parse(row.report_json);
  } catch {
    return Response.redirect(new URL('/free-audit/', context.request.url).toString(), 302);
  }

  return new Response(renderReportHtml(report, id), {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=3600' },
  });
}

/* ---------- 렌더링 ---------- */

export function renderReportHtml(report, id) {
  const b = report.business;
  const s = report.scores;
  const pct = Math.round((s.total / 100) * 100);
  const gradeColor = s.total >= 75 ? '#0B9E58' : s.total >= 55 ? '#0A4DF5' : '#D3382F';

  const bars = s.areas
    .map((a) => {
      const p = Math.round((a.score / a.max) * 100);
      const color = p < 40 ? '#D3382F' : '#0A4DF5';
      return `<div class="bar-row"><span class="bar-label">${esc(a.label)}</span><div class="bar"><i style="width:${p}%;background:${color}"></i></div><span class="bar-val">${a.score}/${a.max}</span></div>`;
    })
    .join('');

  const problems = (report.analysis.problems || [])
    .map(
      (p) => `
    <div class="problem">
      <h3>🔴 ${esc(p.title)}</h3>
      <p class="p-why">${esc(p.why)}</p>
      <p class="p-fix"><b>해결 방향</b> — ${esc(p.fix)}</p>
      ${p.serviceSlug ? `<a class="btn btn-primary btn-small" href="/service/${esc(p.serviceSlug)}/">해결하기 — ${esc(p.serviceName || '서비스 보기')} →</a>` : ''}
    </div>`
    )
    .join('');

  const webcheckSection = renderWebcheckSection(b.webcheck);

  const compRows = (report.competitors || [])
    .map(
      (c) =>
        `<div class="comp-row"><span>${esc(c.name)}${c.distanceMi != null ? ` <small style="color:#8A93A6;font-weight:600;">${c.distanceMi}mi</small>` : ''}</span><span>⭐ ${c.rating ?? '-'} · 리뷰 ${c.reviewCount ?? 0}개</span></div>`
    )
    .join('');
  const compSection = compRows
    ? `<div class="card"><h2 class="sec-title">같은 지역 경쟁 업체</h2>
       <div class="comp-row comp-me"><span>${esc(b.name)} (내 가게)</span><span>⭐ ${b.rating ?? '-'} · 리뷰 ${b.reviewCount ?? 0}개</span></div>
       ${compRows}</div>`
    : '';

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(b.name)} 마케팅 진단 리포트 — ${s.total}점 | BizHigher</title>
<meta name="description" content="${esc(b.name)}의 온라인 마케팅 진단 결과 — 100점 만점에 ${s.total}점. BizHigher 무료 AI 진단.">
<meta name="robots" content="noindex">
<meta property="og:title" content="${esc(b.name)} 마케팅 진단 — ${s.total}점 / 100점">
<meta property="og:description" content="BizHigher 무료 AI 진단 결과입니다. 우리 가게도 60초 만에 진단받아 보세요.">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='15' fill='%230A4DF5'/%3E%3Cpath d='M15 44 h9 v-9 h9 v-9 h6.5' stroke='white' stroke-width='6.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3Cpath d='M38.5 15.5 h10 v10' stroke='white' stroke-width='6.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">
<link rel="stylesheet" href="/style.css">
<style>
  .report-wrap{max-width:720px;margin:0 auto;padding:40px 20px 80px;}
  .report-head{text-align:center;margin-bottom:28px;}
  .report-kicker{font-size:13px;font-weight:800;color:var(--blue-600);letter-spacing:.08em;margin-bottom:10px;}
  .report-title{font-size:30px;font-weight:800;letter-spacing:-.02em;}
  .report-date{font-size:13px;color:var(--ink-400);margin-top:6px;}
  .card{background:#fff;border:1px solid var(--line);border-radius:18px;padding:28px;margin-bottom:18px;}
  .score-flex{display:flex;gap:32px;align-items:center;}
  .gauge{width:140px;height:140px;border-radius:50%;background:conic-gradient(${gradeColor} 0 ${pct}%, #E9ECF2 ${pct}% 100%);display:flex;align-items:center;justify-content:center;flex-shrink:0;}
  .gauge-in{width:104px;height:104px;border-radius:50%;background:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;}
  .gauge-num{font-size:34px;font-weight:800;color:${gradeColor};line-height:1;}
  .gauge-sub{font-size:12px;color:var(--ink-400);margin-top:4px;}
  .bar-row{display:flex;align-items:center;gap:12px;margin-bottom:12px;font-size:14px;}
  .bar-label{width:88px;flex-shrink:0;font-weight:600;}
  .bar{flex:1;height:9px;background:#E9ECF2;border-radius:99px;overflow:hidden;}
  .bar i{display:block;height:100%;border-radius:99px;}
  .bar-val{width:44px;text-align:right;font-weight:700;font-size:12.5px;color:var(--ink-600);}
  .summary{font-size:16px;line-height:1.7;color:var(--ink-600);}
  .sec-title{font-size:20px;font-weight:800;letter-spacing:-.01em;margin-bottom:16px;}
  .problem{border-left:4px solid var(--red-600);background:var(--gray-50);border-radius:0 14px 14px 0;padding:20px 22px;margin-bottom:14px;}
  .problem h3{font-size:16.5px;font-weight:800;margin-bottom:8px;}
  .p-why{font-size:14.5px;line-height:1.65;color:var(--ink-600);margin-bottom:8px;}
  .p-fix{font-size:14.5px;line-height:1.65;color:var(--ink-600);margin-bottom:14px;}
  .comp-row{display:flex;justify-content:space-between;padding:11px 0;border-bottom:1px solid var(--line);font-size:14.5px;color:var(--ink-600);}
  .comp-row:last-child{border-bottom:none;}
  .comp-me{font-weight:800;color:var(--ink-900);}
  .wc-badge{font-weight:700;font-size:14px;color:var(--ink-400);}
  .wc-row{display:flex;gap:12px;padding:12px 0;border-bottom:1px solid var(--line);align-items:flex-start;}
  .wc-row:last-child{border-bottom:none;}
  .wc-ico{font-size:15px;flex-shrink:0;margin-top:1px;}
  .wc-h{font-size:14.5px;font-weight:700;color:var(--ink-900);}
  .wc-note{font-size:13px;color:var(--ink-400);margin-top:2px;line-height:1.55;}
  .next-step{font-size:15px;line-height:1.7;color:var(--ink-600);}
  .share-band{background:var(--blue-50);border:1px solid #CDD9FF;border-radius:18px;padding:24px;text-align:center;margin-bottom:18px;}
  .share-band p{font-size:14px;color:var(--ink-600);margin-bottom:12px;}
  .viral{background:var(--navy-900);border-radius:18px;padding:36px 24px;text-align:center;}
  .viral h2{color:#fff;font-size:24px;font-weight:800;margin-bottom:8px;letter-spacing:-.01em;}
  .viral p{color:#7DA2FF;font-size:14.5px;margin-bottom:20px;}
  @media(max-width:600px){.score-flex{flex-direction:column;gap:20px;}.report-title{font-size:24px;}}
</style>
<script type="text/javascript">
    (function(c,l,a,r,i,t,y){
        c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
        t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
        y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
    })(window, document, "clarity", "script", "yiy7q338pe");
</script>
<script async src="https://www.googletagmanager.com/gtag/js?id=G-6D7XST08PS"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-6D7XST08PS');
</script>
</head>
<body>
<div class="report-wrap">
  <div class="report-head">
    <div class="report-kicker">BIZHIGHER 무료 AI 마케팅 진단</div>
    <h1 class="report-title">${esc(b.name)}</h1>
    <p class="report-date">${(report.business.inferredIndustry || report.business.category) ? esc(report.business.inferredIndustry || report.business.category) + ' · ' : ''}${esc(report.location)} · ${new Date(report.generatedAt).toLocaleDateString('ko-KR')}</p>
  </div>

  <div class="card">
    <div class="score-flex">
      <div class="gauge"><div class="gauge-in"><span class="gauge-num">${s.total}</span><span class="gauge-sub">/ 100점</span></div></div>
      <div style="flex:1;width:100%;">${bars}</div>
    </div>
  </div>

  <div class="card"><h2 class="sec-title">종합 평가</h2><p class="summary">${esc(report.analysis.summary)}</p></div>

  ${webcheckSection}

  <div class="card"><h2 class="sec-title">지금 가장 급한 문제</h2>${problems}</div>

  ${compSection}

  <div class="card"><h2 class="sec-title">다음 단계</h2><p class="next-step">${esc(report.analysis.nextStep || '')}</p>
    <div style="margin-top:16px;display:flex;gap:10px;flex-wrap:wrap;">
      <a href="/services/" class="btn btn-primary">서비스 둘러보기</a>
      <a href="/pricing/#plans" class="btn btn-ghost">통째로 맡기기 — 패키지 월 $219부터</a>
    </div>
  </div>

  <div class="share-band">
    <p>이 리포트는 고유 링크로 저장됩니다. 동업자나 가족에게 공유해보세요.</p>
    <button class="btn btn-ghost btn-small" onclick="navigator.clipboard.writeText(location.href).then(()=>{this.textContent='링크 복사됨 ✓'})">📤 리포트 링크 복사</button>
  </div>

  <div class="viral">
    <h2>내 가게는 몇 점일까?</h2>
    <p>60초 만에 무료로 진단받아 보세요. 가입도 필요 없습니다.</p>
    <a href="/free-audit/" class="btn btn-white">우리 가게도 진단하기 →</a>
  </div>
</div>
</body>
</html>`;
}

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ---------- 웹사이트 진단 섹션 ----------
   biz.website가 있어서 webcheckSite()를 돌린 경우에만 값이 온다.
   웹사이트가 아예 없는 업소, 또는 구글에서 업체 자체를 못 찾은 경우는
   wc가 null이라 이 섹션 전체를 건너뛴다. */
function renderWebcheckSection(wc) {
  if (!wc || !wc.checked) return '';

  if (!wc.reachable) {
    const why = wc.skipped === 'robots-disallow'
      ? '이 웹사이트가 자동 점검 접근을 막아두어 세부 항목은 확인하지 못했습니다. 사이트가 없다는 뜻은 아닙니다.'
      : wc.challenged
      ? '접속 시 보안 확인 페이지가 떠서 실제 내용을 읽지 못했습니다.'
      : '점검 시점에 웹사이트에 연결하지 못했습니다. 일시적인 문제일 수 있습니다.';
    return `<div class="card"><h2 class="sec-title">웹사이트 진단</h2><p class="summary">${esc(why)}</p></div>`;
  }

  const items = [
    ['HTTPS 보안 연결', !!wc.finalIsHttps,
      wc.finalIsHttps ? '정상 적용됨' : '보안 연결이 안 돼 있습니다. 브라우저가 방문자에게 경고를 띄울 수 있습니다.'],
    ['모바일 최적화', !!wc.hasViewport,
      wc.hasViewport ? '정상' : '스마트폰에서 화면이 깨지거나 글자가 작게 보일 수 있습니다. 방문자 대부분이 모바일입니다.'],
    ['검색 결과 설명(meta description)', !!wc.hasMetaDesc,
      wc.hasMetaDesc ? '정상' : '없으면 구글 검색 결과에 업소 소개 대신 페이지의 임의 문장이 노출될 수 있습니다.'],
    ['SNS 공유 미리보기(OG 태그)', !!wc.hasOg,
      wc.hasOg ? '정상' : '카카오톡·페이스북에 링크를 공유해도 미리보기 카드가 안 뜰 수 있습니다.'],
    ['구조화 데이터', !!wc.hasSchema,
      wc.hasSchema
        ? (wc.hasLocalBusinessSchema ? '업소 정보 형식까지 갖춤' : '있지만 업소 정보 형식은 아님')
        : '없습니다 — 검색·AI 엔진이 이 페이지를 하나의 업소로 구조적으로 인식하기 어렵습니다.'],
    ['AI 검색 노출', !wc.blocksAnyAI,
      wc.blocksAnyAI
        ? `ChatGPT·Perplexity 등 AI가 이 사이트를 읽지 못하도록 막혀 있습니다 (${esc((wc.aiBlocked || []).join(', '))}).`
        : 'AI 크롤러를 막고 있지 않습니다.'],
    ['영업시간 표기', !!wc.showsHours,
      wc.showsHours ? '정상' : '사이트 본문에서 영업시간을 찾지 못했습니다.'],
    ['SNS 연결', (wc.socialVia || []).length > 0,
      (wc.socialVia || []).length ? `연결됨 (${esc(wc.socialVia.join(', '))})` : '연결된 SNS 링크를 찾지 못했습니다.'],
  ];
  const okCount = items.filter((i) => i[1]).length;
  const rows = items.map(([label, ok, note]) => `
    <div class="wc-row"><span class="wc-ico">${ok ? '✅' : '⚠️'}</span><div><div class="wc-h">${esc(label)}</div><div class="wc-note">${note}</div></div></div>`
  ).join('');
  const bonus = wc.hasLlmsTxt ? `<div class="wc-note" style="margin-top:10px;">✨ llms.txt까지 갖추고 있어 AI 검색엔진 대응이 앞서 있습니다.</div>` : '';

  return `<div class="card"><h2 class="sec-title">웹사이트 진단 <span class="wc-badge">${okCount}/${items.length}</span></h2>${rows}${bonus}</div>`;
}
