#!/usr/bin/env node
/**
 * 샘플 리포트 — data/sample-report.json(가상의 "순두부 하우스", 예시 수치) 을 실제 고객 리포트와 같은 판형(automation/ai-runner/_report.js)으로 굽는다.
 *   node scripts/sample-report.js
 * → src/sample-report/report.pdf(레터) + 쪽 이미지 p0.jpg(표지·한눈에·지표) p1~pN.jpg(섹션마다) + pages.json(쪽 제목 목록)
 *   빌드(build.js)가 /sample-report/ 페이지(같은 HTML, noindex)와 함께 dist 로 복사하고, 홈 "이렇게 생긴 것을 받습니다"가 쪽 이미지를 넘겨 보여준다.
 * 판형(_report.js)이나 data/sample-report.json 을 바꾸면 다시 돌려서 커밋한다(Playwright 필요, 약 20초).
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'src', 'sample-report');

(async () => {
  const R = require(path.join(ROOT, 'automation', 'ai-runner', '_report.js'));
  const { installFonts } = require(path.join(ROOT, 'automation', 'ai-runner', '_fonts.js'));
  let chromium;
  try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require(process.env.PLAYWRIGHT_PATH || '/opt/node-tools/node_modules/playwright')); }
  const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'sample-report.json'), 'utf8'));
  // 사진은 사이트 주소(/showcase/…)로 적혀 있다 — setContent 페이지는 그 주소를 못 읽으므로 굽는 동안만 data URI 로 바꿔 넣는다
  const inline = (u) => { const m = /^\/showcase\/(.+)$/.exec(u || ''); if (!m) return u; const f = path.join(ROOT, 'src', 'showcase', m[1]); return fs.existsSync(f) ? `data:image/jpeg;base64,${fs.readFileSync(f).toString('base64')}` : u; };
  if (data.business) data.business.photo = inline(data.business.photo);
  for (const sec of data.sections || []) for (const b of [sec, ...(sec.blocks || [])]) if (b.gallery) b.gallery.forEach((g) => { g.src = inline(g.src); });
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 860, height: 1100 }, deviceScaleFactor: 2 });
  const head = await installFonts(page, ['sans']);
  await page.setContent(R.renderHtml(data, { fontHead: head }), { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  await page.pdf({ path: path.join(OUT, 'report.pdf'), format: 'Letter', printBackground: true, preferCSSPageSize: true });
  // 쪽 0: 띠 + 표지 + 한눈에 보기 + 지표 카드
  const top = await page.evaluate(() => { const k = document.querySelector('.kpis') || document.querySelector('.summary') || document.querySelector('.cover'); return Math.ceil(k.getBoundingClientRect().bottom + 22); });
  await page.screenshot({ path: path.join(OUT, 'p0.jpg'), type: 'jpeg', quality: 84, fullPage: true, clip: { x: 0, y: 0, width: 860, height: top } });
  const pages = [{ file: 'p0.jpg', title: '표지 · 한눈에 보기' }];
  const secs = await page.$$('section.sec');
  for (let i = 0; i < secs.length; i++) {
    const bb = await secs[i].boundingBox();
    const title = await secs[i].$eval('h2', (h) => h.textContent.replace(/^\d+/, '').trim());
    const f = `p${i + 1}.jpg`;
    await page.screenshot({ path: path.join(OUT, f), type: 'jpeg', quality: 84, fullPage: true, clip: { x: 0, y: Math.max(0, bb.y - 6), width: 860, height: Math.ceil(bb.height + 22) } });
    pages.push({ file: f, title });
  }
  // 휴대폰용 쪽 이미지(m0~mN) — 리포트의 모바일 판형(390px)으로 따로 찍어야 폰에서 글자가 읽힌다
  const mp = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const mhead = await installFonts(mp, ['sans']);
  await mp.setContent(R.renderHtml(data, { fontHead: mhead }), { waitUntil: 'load' });
  await mp.evaluate(() => document.fonts.ready); await mp.waitForTimeout(300);
  const mtop = await mp.evaluate(() => { const k = document.querySelector('.kpis') || document.querySelector('.cover'); return Math.ceil(k.getBoundingClientRect().bottom + 16); });
  await mp.screenshot({ path: path.join(OUT, 'm0.jpg'), type: 'jpeg', quality: 82, fullPage: true, clip: { x: 0, y: 0, width: 390, height: mtop } });
  const msecs = await mp.$$('section.sec');
  for (let i = 0; i < msecs.length; i++) {
    const bb = await msecs[i].boundingBox();
    await mp.screenshot({ path: path.join(OUT, `m${i + 1}.jpg`), type: 'jpeg', quality: 82, fullPage: true, clip: { x: 0, y: Math.max(0, bb.y - 4), width: 390, height: Math.ceil(bb.height + 16) } });
    pages[i + 1].m = `m${i + 1}.jpg`;
  }
  pages[0].m = 'm0.jpg';
  await b.close();
  fs.writeFileSync(path.join(OUT, 'pages.json'), JSON.stringify(pages, null, 1) + '\n');
  console.log(`샘플 리포트: PDF + 쪽 ${pages.length}장 → src/sample-report/`);
})().catch((e) => { console.error('오류:', e.message); process.exit(1); });
