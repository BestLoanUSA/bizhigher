#!/usr/bin/env node
/**
 * 사이트 QA 자동화 — 360/768/1280 스크린샷 · 속도 · 가로 넘침 · 링크 · 폼 점검 → 리포트(md) + 몽타주(jpg)
 * (David 차례였던 web-4 "360px 실측·속도·폼 테스트"를 루틴이 먼저 돌리고 David 는 리포트만 본다. 의존성 없음 — Playwright 는 환경 것)
 *
 *   node automation/ai-runner/qa.js --url https://example.com [--out qa] [--name home] [--links 40]
 *   → qa/{name}-360.jpg · -768.jpg · -1280.jpg · {name}-montage.jpg · {name}-report.md · 요약 JSON(stdout)
 *   업로드는 creative.js upload --file qa/{name}-montage.jpg 로.
 */
const fs = require('fs');
const path = require('path');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i > -1 && args[i + 1] != null && !args[i + 1].startsWith('--') ? args[i + 1] : d; };
const VIEWS = [['360', 360, 780, true], ['768', 768, 1024, false], ['1280', 1280, 800, false]];

(async () => {
  const url = opt('url'); if (!url) throw new Error('--url 필요');
  const out = opt('out', 'qa'); const name = opt('name', 'site'); const maxLinks = Number(opt('links', 40));
  fs.mkdirSync(out, { recursive: true });
  const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
  const exe = process.env.PLAYWRIGHT_CHROMIUM || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
  const browser = await chromium.launch(exe ? { executablePath: exe } : {});
  const result = { url, checkedAt: new Date().toISOString(), views: {}, links: { checked: 0, broken: [] }, forms: [], issues: [] };
  let anchors = [];
  for (const [label, w, h, mobile] of VIEWS) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1, ignoreHTTPSErrors: true, /* 클라우드 세션 프록시 CA 때문 — 인증서 자체 점검은 별도 */ userAgent: mobile ? 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36 BizHigherQA' : undefined });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e.message).slice(0, 160)));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 160)); });
    await page.addInitScript(() => { try { new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lcp = e.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true }); } catch {} });
    const t0 = Date.now();
    let status = 0;
    try { const r = await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 }); status = r ? r.status() : 0; } catch (e) { errors.push('goto: ' + e.message.slice(0, 120)); }
    await page.waitForTimeout(800);
    // 스타일시트가 안 붙었으면(프록시 재시도 오류 등) 한 번 더 — 스타일 없는 화면을 QA 하지 않는다
    let cssMissing = await page.evaluate(() => [...document.querySelectorAll('link[rel=stylesheet]')].filter((l) => !l.sheet).length).catch(() => 0);
    if (cssMissing) { try { await page.reload({ waitUntil: 'networkidle', timeout: 60000 }); await page.waitForTimeout(800); } catch {} cssMissing = await page.evaluate(() => [...document.querySelectorAll('link[rel=stylesheet]')].filter((l) => !l.sheet).length).catch(() => 0); }
    if (cssMissing) errors.push('스타일시트 ' + cssMissing + '개 로드 실패(재시도 후에도) — 이 뷰포트 스크린샷은 참고만');
    const m = await page.evaluate(() => {
      const nav = performance.getEntriesByType('navigation')[0] || {};
      const res = performance.getEntriesByType('resource');
      const imgs = [...document.images];
      return {
        title: document.title, h1: document.querySelectorAll('h1').length,
        description: (document.querySelector('meta[name="description"]') || {}).content || '',
        viewportMeta: !!document.querySelector('meta[name="viewport"]'),
        overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
        scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth,
        imgNoAlt: imgs.filter((i) => !i.alt).length, imgTotal: imgs.length,
        bigImages: imgs.filter((i) => i.naturalWidth > 2000).length,
        domContentLoaded: Math.round(nav.domContentLoadedEventEnd || 0), load: Math.round(nav.loadEventEnd || 0),
        lcp: Math.round(window.__lcp || 0), requests: res.length + 1, bytes: res.reduce((a, r) => a + (r.transferSize || 0), 0) + (nav.transferSize || 0),
        tel: !!document.querySelector('a[href^="tel:"]'), maps: !!document.querySelector('a[href*="maps.google"], a[href*="goo.gl/maps"], a[href*="maps.app"]'),
        forms: [...document.forms].map((f) => ({ id: f.id || f.getAttribute('name') || '(id 없음)', action: f.action || '', fields: [...f.querySelectorAll('input,textarea,select')].filter((x) => x.type !== 'hidden').length, required: [...f.querySelectorAll('[required]')].length, submit: !!f.querySelector('button[type=submit],input[type=submit],button:not([type])') })),
        anchors: [...document.querySelectorAll('a[href]')].map((a) => a.href).filter((h) => /^https?:/.test(h)),
        smallTapTargets: [...document.querySelectorAll('a,button')].filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && (r.width < 40 || r.height < 40); }).length,
      };
    }).catch(() => ({}));
    const shot = path.join(out, `${name}-${label}.jpg`);
    try { await page.screenshot({ path: shot, type: 'jpeg', quality: 80, fullPage: true }); } catch { try { await page.screenshot({ path: shot, type: 'jpeg', quality: 80 }); } catch {} }
    result.views[label] = { status, ...m, errors: [...new Set(errors)].slice(0, 8), screenshot: shot };
    if (label === '360') { anchors = m.anchors || []; result.forms = m.forms || []; }
    delete result.views[label].anchors; delete result.views[label].forms;
    await ctx.close();
  }
  // 같은 도메인 링크 점검 (최대 N)
  const origin = new URL(url).origin;
  const uniq = [...new Set(anchors.filter((h) => h.startsWith(origin)))].slice(0, maxLinks);
  for (const h of uniq) {
    try { const r = await fetch(h, { method: 'GET', redirect: 'follow', headers: { 'user-agent': 'BizHigherQA' } }); result.links.checked++; if (r.status >= 400) result.links.broken.push({ url: h, status: r.status }); }
    catch (e) { result.links.checked++; result.links.broken.push({ url: h, status: 'ERR' }); }
  }
  // 문제 목록
  const v = result.views['360'] || {};
  if (v.status && v.status >= 400) result.issues.push(`페이지 응답 ${v.status}`);
  if (v.overflow) result.issues.push(`360px 가로 넘침 (scrollWidth ${v.scrollWidth} > ${v.innerWidth}) — 반드시 수정`);
  if (!v.viewportMeta) result.issues.push('viewport 메타 태그 없음 — 모바일에서 축소되어 보임');
  if (v.h1 !== 1) result.issues.push(`H1 개수 ${v.h1} (1개 권장)`);
  if (!v.description) result.issues.push('메타 설명(description) 없음');
  if (v.lcp > 2500) result.issues.push(`LCP ${v.lcp}ms (2.5초 초과 — 큰 이미지·폰트 확인)`);
  if (v.bytes > 3 * 1024 * 1024) result.issues.push(`전송량 ${(v.bytes / 1048576).toFixed(1)}MB (3MB 초과)`);
  if (v.bigImages) result.issues.push(`2000px 넘는 이미지 ${v.bigImages}장 — 리사이즈`);
  if (v.imgNoAlt) result.issues.push(`alt 없는 이미지 ${v.imgNoAlt}/${v.imgTotal}`);
  if (v.smallTapTargets > 3) result.issues.push(`40px 미만 터치 대상 ${v.smallTapTargets}개`);
  if (!v.tel) result.issues.push('전화 링크(tel:) 없음 — 모바일 전화 버튼 권장');
  if (v.errors && v.errors.length) result.issues.push(`JS 오류 ${v.errors.length}건: ${v.errors[0]}`);
  if (result.links.broken.length) result.issues.push(`깨진 링크 ${result.links.broken.length}개: ${result.links.broken.slice(0, 3).map((b) => b.url).join(', ')}`);
  for (const f of result.forms) if (!f.submit) result.issues.push(`폼 ${f.id}에 제출 버튼 없음`);
  // 몽타주 (3 뷰포트 상단 부분을 나란히)
  const montage = path.join(out, `${name}-montage.jpg`);
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
    const img = (f) => fs.existsSync(f) ? 'data:image/jpeg;base64,' + fs.readFileSync(f).toString('base64') : '';
    await page.setContent(`<!doctype html><body style="margin:0;background:#0A1B4D;font-family:sans-serif;color:#fff"><div style="display:flex;gap:16px;padding:16px;align-items:flex-start;height:1000px;box-sizing:border-box">
      ${VIEWS.map(([l, w]) => `<div style="flex:${w === 1280 ? 3 : w === 768 ? 2 : 1};min-width:0"><div style="font-size:14px;margin-bottom:6px">${l}px · LCP ${result.views[l].lcp || '-'}ms · ${result.views[l].overflow ? '⚠ 가로 넘침' : 'OK'}</div><div style="height:940px;overflow:hidden;border-radius:10px;background:#fff"><img src="${img(result.views[l].screenshot)}" style="width:100%;display:block"></div></div>`).join('')}
    </div></body>`);
    await page.screenshot({ path: montage, type: 'jpeg', quality: 78 });
    await page.close();
  } catch {}
  await browser.close();
  const md = [`# QA 리포트 — ${url}`, `점검 시각: ${result.checkedAt}`, '', '| 뷰포트 | 응답 | LCP | 로드 | 요청 | 전송량 | 가로 넘침 | JS 오류 |', '|---|---|---|---|---|---|---|---|',
    ...VIEWS.map(([l]) => { const x = result.views[l]; return `| ${l}px | ${x.status} | ${x.lcp || '-'}ms | ${x.load || '-'}ms | ${x.requests || '-'} | ${x.bytes ? (x.bytes / 1024).toFixed(0) + 'KB' : '-'} | ${x.overflow ? '⚠' : 'OK'} | ${(x.errors || []).length} |`; }),
    '', `제목: ${v.title || '-'}`, `설명: ${(v.description || '-').slice(0, 160)}`, `H1: ${v.h1} · 이미지 ${v.imgTotal}(alt 없음 ${v.imgNoAlt}) · 전화 링크 ${v.tel ? '있음' : '없음'} · 지도 링크 ${v.maps ? '있음' : '없음'}`,
    `폼: ${result.forms.length ? result.forms.map((f) => `${f.id} (필드 ${f.fields}, 필수 ${f.required}, 제출 버튼 ${f.submit ? '있음' : '없음'})`).join(' / ') : '없음'}`,
    `링크 점검: ${result.links.checked}개 중 깨짐 ${result.links.broken.length}개${result.links.broken.length ? ' — ' + result.links.broken.map((b) => `${b.url} (${b.status})`).join(', ') : ''}`,
    '', '※ 속도 수치는 실행 환경(클라우드 세션 프록시)의 영향을 받는다 — 전후 비교·상대 비교용. 절대값은 PageSpeed Insights 로 확인', '', '## 수정할 것', ...(result.issues.length ? result.issues.map((i) => '- ' + i) : ['- 없음 — 인도 가능']), '', `몽타주: ${montage}`].join('\n');
  fs.writeFileSync(path.join(out, `${name}-report.md`), md);
  console.log(JSON.stringify({ report: path.join(out, `${name}-report.md`), montage, issues: result.issues, lcp360: v.lcp, overflow360: !!v.overflow, broken: result.links.broken.length }));
})().catch((e) => { console.error('오류:', e.message); process.exit(1); });
