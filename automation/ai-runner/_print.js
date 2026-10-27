/**
 * 리뷰 QR 인쇄물 키트 — creative.js print 가 부른다 (qr-2 디자인 + qr-3 인쇄 파일을 한 번에)
 *   테이블텐트(4×5" 패널 2면, 접는 선) · 포스터(레터 8.5×11") · 카운터 카드(4×6", 2-up) · 스티커 시트(2" 원형 12개, Avery 22807 근사) · 모바일 공유 이미지(1080×1920)
 *   출력: 항목별 PNG(300dpi) + 인쇄용 PDF(재단선·접는 선, 레터 용지, pdfunite 로 한 파일) + 인쇄 가이드 md
 * 원칙: 리뷰 대가·조건 문구 없음("솔직한 리뷰"), 구글 로고 미사용(글자만), 한/영 병기. QR 은 search.google.com/local/writereview?placeid=…
 * 의존: 환경의 Playwright + 시스템 Chromium, src/tools/qrcode.min.js(동봉, MIT), /usr/bin/pdfunite(없으면 PDF 를 항목별로 따로 둔다)
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const DPI = 300; const CSS_IN = 96; // 브라우저 1in = 96px → 300dpi 는 deviceScaleFactor 3.125
const FONT = `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@500;700;900&display=swap">`;

/** 밝은 글자가 어울리는 배경인지 */
function dark(hex) { const m = /^#?([0-9a-f]{6})$/i.exec(hex || ''); if (!m) return true; const n = parseInt(m[1], 16); const r = n >> 16, g = (n >> 8) & 255, b = n & 255; return (0.299 * r + 0.587 * g + 0.114 * b) < 150; }

/** QR SVG(확대 가능) — qrcode-generator 를 브라우저 안에서 돌린다 */
async function qrSvg(browser, text) {
  const lib = fs.readFileSync(path.join(__dirname, '../../src/tools/qrcode.min.js'), 'utf8');
  const page = await browser.newPage();
  await page.setContent('<html><body></body></html>');
  await page.addScriptTag({ content: lib });
  const svg = await page.evaluate((t) => { const q = qrcode(0, 'M'); q.addData(t); q.make(); return q.createSvgTag({ cellSize: 4, margin: 0, scalable: true }); }, text);
  await page.close();
  return svg.replace(/<svg /, '<svg class="qr" preserveAspectRatio="xMidYMid meet" ');
}

const BASE_CSS = (d) => `
*{box-sizing:border-box;margin:0;padding:0}
html,body{font-family:'Noto Sans KR',sans-serif;color:#111318;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.qr{display:block;width:100%;height:100%}
.qrbox{background:#fff;border-radius:.12in;padding:.1in;display:inline-block;line-height:0}
.steps{display:flex;gap:.08in;justify-content:center}
.step{flex:1;text-align:center;font-size:.11in;font-weight:700;line-height:1.3}
.step b{display:block;width:.3in;height:.3in;line-height:.3in;border-radius:50%;margin:0 auto .05in;background:${d.color};color:${d.fg};font-size:.15in;font-weight:900}
.step small{display:block;font-weight:500;font-size:.09in;opacity:.75}
.en{font-weight:500;opacity:.8}
.brand{font-weight:900;letter-spacing:-.01em}
.panel{position:relative;overflow:hidden;background:#fff}
.band{position:absolute;left:0;right:0;top:0;background:${d.color};color:${d.fg}}
.logo{height:.45in;width:auto;background:#fff;border-radius:.06in;padding:.04in}
.cut{position:absolute;background:#111}
.foot{font-size:.1in;font-weight:500;opacity:.7}
`;

/* ---------- 항목 템플릿 (trim 크기 = w×h inch) ---------- */
function stepsHtml(d) {
  return `<div class="steps"><div class="step"><b>1</b>QR 스캔<small>Scan</small></div><div class="step"><b>2</b>별점 선택<small>Rate</small></div><div class="step"><b>3</b>한 줄 남기기<small>Write a line</small></div></div>`;
}
function panelTent(d, qr) { // 4×5 in, 테이블텐트 한 면 — QR 이 가장 크고, 글은 한/영 두 줄
  return `<div class="panel" style="width:4in;height:5in;padding:.3in .3in .25in">
    <div class="band" style="height:.9in;padding:.18in .3in"><div class="brand" style="font-size:.26in;line-height:1.1">${esc(d.name_ko || d.name)}</div><div class="en" style="font-size:.12in">${esc(d.name_ko && d.name !== d.name_ko ? d.name : '')}</div></div>
    <div style="margin-top:.68in;text-align:center"><div style="font-size:.24in;font-weight:900;line-height:1.2;word-break:keep-all">솔직한 리뷰를<br>남겨 주세요</div><div class="en" style="font-size:.12in;margin-top:.04in">Share your honest experience</div></div>
    <div style="text-align:center;margin:.14in 0 .12in"><div class="qrbox" style="width:1.6in;height:1.6in;border:.03in solid ${d.color}">${qr}</div></div>
    ${stepsHtml(d)}
    <div class="foot" style="position:absolute;left:.3in;right:.3in;bottom:.12in;text-align:center">구글 리뷰 · Google Review${d.phone ? ' · ' + esc(d.phone) : ''}</div>
  </div>`;
}
function panelCard(d, qr) { // 4×6 in 카운터 카드
  return `<div class="panel" style="width:4in;height:6in;padding:.3in">
    <div class="band" style="height:1.05in;padding:.2in .3in;display:flex;align-items:center;gap:.15in">${d.logo ? `<img class="logo" src="${d.logo}">` : ''}<div><div class="brand" style="font-size:.26in;line-height:1.1">${esc(d.name_ko || d.name)}</div><div class="en" style="font-size:.12in">${esc(d.name_ko && d.name !== d.name_ko ? d.name : '')}</div></div></div>
    <div style="margin-top:.95in;text-align:center"><div style="font-size:.28in;font-weight:900;line-height:1.2;word-break:keep-all">오늘 어떠셨나요?</div><div class="en" style="font-size:.13in;margin-top:.04in">How was your visit today?</div></div>
    <div style="text-align:center;margin:.25in 0 .2in"><div class="qrbox" style="width:2.2in;height:2.2in;border:.03in solid ${d.color}">${qr}</div></div>
    <div style="text-align:center;font-size:.15in;font-weight:700;line-height:1.35;word-break:keep-all">30초면 됩니다. 솔직한 한 줄이<br>다음 손님에게 큰 도움이 됩니다.<div class="en" style="font-size:.11in;margin-top:.04in">Takes 30 seconds. Your honest words help the next guest.</div></div>
    <div class="foot" style="position:absolute;left:.3in;right:.3in;bottom:.2in;text-align:center">구글 리뷰 · Google Review${d.phone ? ' · ' + esc(d.phone) : ''}</div>
  </div>`;
}
function panelPoster(d, qr) { // 8.5×11 in 포스터 — 안쪽 여백 .4in (테두리 없는 인쇄가 안 되는 프린터 대비). 위 제목 → 가운데 2단(글 | QR) → 3단계 띠 → 바닥
  return `<div class="panel" style="width:8.5in;height:11in;padding:.4in">
    <div style="background:${d.color};color:${d.fg};border-radius:.25in;height:10.2in;padding:.6in .7in;position:relative">
      <div style="display:flex;align-items:center;gap:.25in">${d.logo ? `<img class="logo" src="${d.logo}" style="height:.8in">` : ''}<div><div class="brand" style="font-size:.5in;line-height:1.05">${esc(d.name_ko || d.name)}</div><div class="en" style="font-size:.2in">${esc(d.name_ko && d.name !== d.name_ko ? d.name : '')}</div></div></div>
      <div style="margin-top:.4in;font-size:.7in;font-weight:900;line-height:1.1;letter-spacing:-.02em;word-break:keep-all">솔직한 리뷰를<br>남겨 주세요</div>
      <div class="en" style="font-size:.24in;margin-top:.1in">Share your honest experience on Google</div>
      <div style="display:flex;gap:.4in;align-items:center;margin-top:.35in">
        <div style="flex:1;font-size:.23in;font-weight:700;line-height:1.5;word-break:keep-all">휴대폰 카메라로 QR 을 비추면 리뷰 창이 바로 열립니다.<div class="en" style="font-size:.16in;margin-top:.12in;line-height:1.45">Point your phone camera at the QR code. The review page opens right away.</div></div>
        <div class="qrbox" style="width:3in;height:3in;flex:0 0 3in;padding:.15in;border-radius:.18in">${qr}</div>
      </div>
      <div style="position:absolute;left:.7in;right:.7in;bottom:.95in;background:rgba(255,255,255,.14);border-radius:.18in;padding:.26in .4in">
        <div class="steps" style="gap:.3in">${['QR 스캔|Scan', '별점 선택|Rate', '한 줄 남기기|Write a line'].map((s, i) => { const [k, e] = s.split('|'); return `<div class="step" style="font-size:.24in"><b style="width:.6in;height:.6in;line-height:.6in;font-size:.3in;background:${d.fg};color:${d.color}">${i + 1}</b>${k}<small style="font-size:.16in;opacity:.85">${e}</small></div>`; }).join('')}</div>
      </div>
      <div class="foot" style="position:absolute;left:.7in;right:.7in;bottom:.4in;text-align:center;font-size:.2in;opacity:.85">구글 리뷰 · Google Review${d.phone ? ' · ' + esc(d.phone) : ''}</div>
    </div>
  </div>`;
}
function sticker(d, qr) { // 2in 원형 1개
  return `<div style="width:2in;height:2in;border-radius:50%;background:${d.color};color:${d.fg};position:relative;overflow:hidden;text-align:center;padding-top:.17in">
    <div style="font-size:.13in;font-weight:900;line-height:1.1;padding:0 .3in;word-break:keep-all;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(d.name_ko || d.name)}</div>
    <div class="qrbox" style="margin:.06in auto 0;width:1.1in;height:1.1in;padding:.06in">${qr}</div>
    <div style="font-size:.11in;font-weight:700;margin-top:.05in">구글 리뷰 <span class="en" style="font-weight:500">· Review us</span></div>
  </div>`;
}
function mobile(d, qr) { // 1080×1920 공유 이미지 (스토리·카톡)
  return `<div class="panel" style="width:1080px;height:1920px;background:${d.color};color:${d.fg};padding:120px 90px;text-align:center">
    <div class="brand" style="font-size:64px;line-height:1.1">${esc(d.name_ko || d.name)}</div><div class="en" style="font-size:28px;margin-top:8px">${esc(d.name_ko && d.name !== d.name_ko ? d.name : '')}</div>
    <div style="margin-top:140px;font-size:96px;font-weight:900;line-height:1.15;letter-spacing:-.02em;word-break:keep-all">솔직한 리뷰를<br>남겨 주세요</div>
    <div class="en" style="font-size:36px;margin-top:20px">Share your honest experience</div>
    <div class="qrbox" style="width:560px;height:560px;margin:110px auto 0;padding:28px;border-radius:32px">${qr}</div>
    <div style="font-size:34px;font-weight:700;margin-top:60px;line-height:1.5;word-break:keep-all">QR 을 길게 누르거나 카메라로 비추면<br>리뷰 창이 바로 열립니다</div>
    <div style="font-size:30px;opacity:.85;margin-top:120px">구글 리뷰 · Google Review${d.phone ? ' · ' + esc(d.phone) : ''}</div>
  </div>`;
}

/* ---------- 인쇄 페이지(레터) — 재단선·접는 선 ---------- */
function marks(x, y, w, h) { // trim 박스(in) 바깥 .25in 길이 재단선 8개
  const L = 0.25, g = 0.06; const m = [];
  for (const [cx, cy, hx, vy] of [[x, y, -1, -1], [x + w, y, 1, -1], [x, y + h, -1, 1], [x + w, y + h, 1, 1]]) {
    m.push(`<div class="cut" style="left:${cx + (hx < 0 ? -L - g : g)}in;top:${cy}in;width:${L}in;height:.01in"></div>`);
    m.push(`<div class="cut" style="left:${cx}in;top:${cy + (vy < 0 ? -L - g : g)}in;width:.01in;height:${L}in"></div>`);
  }
  return m.join('');
}
const place = (x, y, html) => `<div style="position:absolute;left:${x}in;top:${y}in">${html}</div>`;
/** w×h 패널을 deg 만큼 돌려 (x,y) 에서 시작하는 h×w 영역에 놓는다 (90°/-90°) */
const placeRot = (x, y, w, h, html, deg) => `<div style="position:absolute;left:${x + h / 2 - w / 2}in;top:${y + w / 2 - h / 2}in;width:${w}in;height:${h}in;transform:rotate(${deg}deg);transform-origin:center">${html}</div>`;
function pages(d, qr) {
  const tent = panelTent(d, qr), card = panelCard(d, qr), st = sticker(d, qr);
  return [
    // 1. 포스터 — 페이지 가장자리 = 재단선 (레터 그대로 출력)
    { name: 'poster', css: '@page{size:8.5in 11in;margin:0}', html: `<div style="position:relative;width:8.5in;height:11in">${panelPoster(d, qr)}</div>` },
    // 2. 테이블텐트 — 가로 레터에 10×4" 띠(4×5 패널 2면을 90° 돌려 나란히), 가운데 세로 접는 선이 텐트의 꼭대기. 양 패널의 머리가 접는 선을 향한다
    { name: 'tent', css: '@page{size:11in 8.5in;margin:0}', html: `<div style="position:relative;width:11in;height:8.5in">${placeRot(0.5, 2.25, 4, 5, tent, 90)}${placeRot(5.5, 2.25, 4, 5, tent, -90)}${marks(0.5, 2.25, 10, 4)}<div style="position:absolute;left:5.5in;top:2in;height:4.5in;border-left:.01in dashed #999"></div><div style="position:absolute;left:5.56in;top:6.55in;font-size:.1in;color:#666">접는 선 / fold</div></div>` },
    // 3. 카운터 카드 — 가로 레터 2-up
    { name: 'card', css: '@page{size:11in 8.5in;margin:0}', html: `<div style="position:relative;width:11in;height:8.5in">${place(1.25, 1.25, card)}${place(5.75, 1.25, card)}${marks(1.25, 1.25, 4, 6)}${marks(5.75, 1.25, 4, 6)}</div>` },
    // 4. 스티커 시트 — 2" 원형 3×4 (Avery 22807 근사: 위 .5in, 좌 .75in, 간격 .5in)
    { name: 'stickers', css: '@page{size:8.5in 11in;margin:0}', html: `<div style="position:relative;width:8.5in;height:11in">${[0, 1, 2, 3].map((r) => [0, 1, 2].map((c) => place(0.75 + c * 2.5, 0.5 + r * 2.5, st)).join('')).join('')}</div>` },
  ];
}
const doc = (css, body) => `<!doctype html><html><head><meta charset="utf-8">${FONT}<style>${css}</style></head><body>${body}</body></html>`;

/**
 * 키트 생성. d = { name, name_ko, phone, review_url, color, logo(data URL|''), out(dir) }
 * 반환: { files: [{ kind, file }], pdf, guide }
 */
async function makeKit(d) {
  fs.mkdirSync(d.out, { recursive: true });
  const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
  const exe = process.env.PLAYWRIGHT_CHROMIUM || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
  const b = await chromium.launch(exe ? { executablePath: exe } : {});
  const data = { ...d, color: d.color || '#0A4DF5' }; data.fg = dark(data.color) ? '#ffffff' : '#111318';
  const qr = await qrSvg(b, d.review_url);
  const css = BASE_CSS(data); const files = [];
  // PNG(300dpi) — 항목별 trim 크기
  const shots = [['tent', panelTent(data, qr), 4, 5], ['card', panelCard(data, qr), 4, 6], ['poster', panelPoster(data, qr), 8.5, 11], ['sticker', sticker(data, qr), 2, 2]];
  for (const [kind, html, w, h] of shots) {
    const page = await b.newPage({ viewport: { width: Math.round(w * CSS_IN), height: Math.round(h * CSS_IN) }, deviceScaleFactor: DPI / CSS_IN });
    await page.setContent(doc(css, `<div id="t" style="width:${w}in;height:${h}in;overflow:hidden">${html}</div>`), { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    const file = path.join(d.out, `${kind}-${w}x${h}in.png`);
    await page.locator('#t').screenshot({ path: file, type: 'png', omitBackground: kind === 'sticker' });
    files.push({ kind, file }); await page.close();
  }
  { const page = await b.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
    await page.setContent(doc(css, mobile(data, qr)), { waitUntil: 'networkidle' }); await page.evaluate(() => document.fonts.ready);
    const file = path.join(d.out, 'mobile-1080x1920.png'); await page.screenshot({ path: file, type: 'png' }); files.push({ kind: 'mobile', file }); await page.close(); }
  // PDF — 페이지별로 뽑아 pdfunite 로 합친다
  const parts = [];
  for (const p of pages(data, qr)) {
    const page = await b.newPage();
    await page.setContent(doc(css + p.css, p.html), { waitUntil: 'networkidle' }); await page.evaluate(() => document.fonts.ready);
    const file = path.join(d.out, `_${p.name}.pdf`); await page.pdf({ path: file, preferCSSPageSize: true, printBackground: true }); parts.push(file); await page.close();
  }
  await b.close();
  let pdf = path.join(d.out, 'print-kit.pdf');
  try { execFileSync('/usr/bin/pdfunite', [...parts, pdf], { stdio: 'ignore' }); for (const f of parts) fs.unlinkSync(f); }
  catch { pdf = ''; for (const f of parts) { const nf = f.replace('/_', '/print-'); fs.renameSync(f, nf); files.push({ kind: 'pdf', file: nf }); } }
  const guide = path.join(d.out, 'print-guide.md');
  fs.writeFileSync(guide, guideMd(data, pdf));
  return { files, pdf, guide };
}

function guideMd(d, pdf) {
  return `# ${d.name_ko || d.name} 리뷰 QR 키트 — 인쇄 가이드

QR 링크: ${d.review_url}
(휴대폰 카메라로 스캔해 구글 리뷰 창이 열리는지 인쇄 전에 한 번 확인)

| 항목 | 파일 | 용지·크기 | 인쇄 메모 |
|---|---|---|---|
| 테이블텐트 | ${pdf ? 'print-kit.pdf 2쪽' : 'print-tent.pdf'} / tent-4x5in.png | 레터 가로, 카드지 80~110lb (216~300gsm) | 재단선대로 4×10" 띠를 자르고 가운데 점선에서 접는다. 위 패널은 거꾸로 인쇄된 것이 정상(접으면 양면 모두 바로 섬). 코팅(라미네이트)하면 오래 간다 |
| 포스터 | ${pdf ? 'print-kit.pdf 1쪽' : 'print-poster.pdf'} / poster-8.5x11in.png | 레터 세로, 일반 또는 광택 80lb | 페이지 가장자리가 재단선. 테두리 없는 인쇄가 안 되면 흰 여백이 .4" 안쪽 디자인 밖으로만 생겨 그대로 써도 된다 |
| 카운터 카드 | ${pdf ? 'print-kit.pdf 3쪽' : 'print-card.pdf'} / card-4x6in.png | 레터 가로 2-up, 카드지 | 재단선대로 4×6" 2장. 아크릴 스탠드(4×6)에 꽂는다 |
| 스티커 | ${pdf ? 'print-kit.pdf 4쪽' : 'print-stickers.pdf'} / sticker-2x2in.png | Avery 22807(2" 원형 12개) 호환 근사 | 일반 용지에 1장 시험 인쇄해 라벨 위치를 맞춘 뒤 라벨지에 인쇄. 안 맞으면 온라인 스티커 인쇄(2" 원형)에 sticker PNG 업로드 |
| 모바일 공유 | mobile-1080x1920.png | 인쇄 아님 | 카톡·인스타 스토리에 올리는 용도. QR 을 길게 누르면 열린다 |

- 인쇄처: 동네 인쇄소(FedEx Office·Staples)에 PDF 그대로, 또는 온라인(Vistaprint·UPrinting)에 PNG 300dpi 업로드
- 문구는 "솔직한 리뷰"만 요청한다. 할인·사은품 등 **리뷰 대가 문구를 추가하지 않는다**(구글 정책 위반, 프로필 정지 사유)
- 구글 로고는 넣지 않았다(브랜드 가이드 확인 전). 글자 "구글 리뷰 · Google Review"만 사용
`;
}

module.exports = { makeKit };
