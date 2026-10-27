/**
 * 리뷰 QR 인쇄물 키트 — creative.js print 가 부른다 (qr-2 시안 → 고객 선택 → qr-3 전체 키트)
 *   룩 3종(2026-10-27 David 선택: 고객이 고른다): A 사진 콜라주+보정 · B 네이비·골드·세리프 · C 미니멀+도형·아이콘
 *   항목: 테이블텐트(4×5" 패널 2면, 접는 선) · 포스터(레터 8.5×11") · 카운터 카드(4×6", 2-up) · 스티커(2" 원형 12개, Avery 22807 근사) · 모바일 공유(1080×1920)
 *   출력: 항목별 PNG(300dpi) + 인쇄용 PDF(레터, 재단선·접는 선, pdfunite) + 인쇄 가이드 md. makePreview 는 룩별 텐트+포스터 저해상도 + 시안 보드
 * 원칙: 리뷰 대가·조건 문구 없음("솔직한 리뷰"), 구글 로고 미사용(글자만), 한/영 병기. 글꼴은 _fonts.js(자체 서빙). QR 은 writereview?placeid=…
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { installFonts, waitFonts } = require('./_fonts.js');

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const DPI = 300; const CSS_IN = 96;

/** 룩 — 사이트 스타일 8종과 매핑(무응답 기본값·자동 선택에 쓴다) */
const LOOKS = {
  A: { label: '사진 콜라주', note: '매장 사진 여러 장을 잡지처럼 배치하고 같은 톤으로 보정. 따뜻한 종이색과 세리프 제목', styles: ['editorial', 'warm'], needsPhotos: true },
  B: { label: '네이비·골드 세리프', note: '짙은 남색에 금색 선 액자와 별 다섯. 세리프 제목으로 신뢰감', styles: ['luxe', 'mono', 'clean'], default: true },
  C: { label: '미니멀 + 도형', note: '밝은 종이색에 브랜드색 도형과 선 아이콘. 가볍고 현대적', styles: ['soft', 'bold', 'neon'] },
};
function lookForStyle(style) { const st = String(style || '').toLowerCase(); return Object.keys(LOOKS).find((k) => LOOKS[k].styles.includes(st)) || 'B'; }

/* ───── 공통 ───── */
const GRAIN = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .5 0"/></filter><rect width="100%" height="100%" filter="url(#n)"/></svg>`;
const grainUrl = 'data:image/svg+xml;base64,' + Buffer.from(GRAIN).toString('base64');
const BASE_CSS = `*{box-sizing:border-box;margin:0;padding:0}html,body{font-family:'Noto Sans KR',sans-serif;color:#111;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.p{position:relative;overflow:hidden;background:#fff}.abs{position:absolute}.qr svg{display:block;width:100%;height:100%}.serif{font-family:'Noto Serif KR',serif}.disp{font-family:'Black Han Sans',sans-serif}.cut{position:absolute;background:#111}
.ph{position:relative;overflow:hidden;background:#1a1613}.ph img{width:100%;height:100%;object-fit:cover;display:block;filter:contrast(1.1) saturate(1.12) brightness(1.02) sepia(.08)}.ph::before{content:'';position:absolute;inset:0;background:radial-gradient(ellipse at center,rgba(0,0,0,0) 55%,rgba(0,0,0,.32) 100%)}.ph::after{content:'';position:absolute;inset:0;background:url(${grainUrl});opacity:.14;mix-blend-mode:overlay}`;
const QR = (svg, color, bg) => `<div class="qr" style="width:100%;height:100%">${svg.replace(/<rect[^>]*fill="white"[^>]*\/>/, bg ? `<rect width="100%" height="100%" fill="${bg}"/>` : '').replace(/<path /, `<path fill="${color}" `)}</div>`;
const star = (c, s) => `<svg viewBox="0 0 24 24" width="${s}in" height="${s}in" fill="none" stroke="${c}" stroke-width="1.1" stroke-linejoin="round"><path d="M12 2.8l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.7l-5.9 3.1 1.2-6.5L2.5 9.7l6.6-.9z"/></svg>`;
const stars5 = (c, s) => `<div style="display:flex;gap:${s * .18}in;justify-content:center">${[0, 1, 2, 3, 4].map(() => star(c, s)).join('')}</div>`;
const ICON = { cam: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7l1.5-3h5L16 7"/><circle cx="12" cy="13.5" r="3.5"/></svg>`, star: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M12 3l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.9l-5.9 3.1 1.2-6.5L2.5 9.9l6.6-.9z"/></svg>`, pen: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17z"/><path d="M13.5 6.5l3 3"/></svg>` };
const stepRow = (color, sz, gap) => `<div style="display:flex;justify-content:center;gap:${gap}in">${[['cam', 'QR 스캔', 'Scan'], ['star', '별점 선택', 'Rate'], ['pen', '한 줄 남기기', 'Write a line']].map(([i, k, e]) => `<div style="text-align:center;width:${sz * 5}in"><div style="width:${sz * 1.9}in;height:${sz * 1.9}in;margin:0 auto ${sz * .35}in;color:${color}">${ICON[i]}</div><div style="font-size:${sz * .85}in;font-weight:600">${k}</div><div style="font-size:${sz * .62}in;color:#777;margin-top:${sz * .1}in">${e}</div></div>`).join('')}</div>`;
const nameLine = (d) => esc(d.name_ko || d.name) + (d.name_ko && d.name !== d.name_ko ? ` <span style="font-weight:400;opacity:.75">${esc(d.name)}</span>` : '');

/* ───── A. 사진 콜라주 + 보정 ───── */
const CREAM = '#F3EEE5', INK = '#1A1613', MUTE = '#6B6257';
const phs = (d, n) => { const p = d.photos || []; return [0, 1, 2, 3].map((i) => p[i % Math.max(1, p.length)] || p[0] || ''); };
const A = {
  poster: (d, q) => { const [p1, p2, p3, p4] = phs(d); return `<div class="p" style="width:8.5in;height:11in;background:${CREAM};color:${INK};padding:.45in">
    <div style="display:flex;justify-content:space-between;align-items:baseline;padding:0 .05in .22in"><div style="font-weight:700;font-size:.24in">${nameLine(d)}</div><div style="font-size:.14in;color:${MUTE}">${esc(d.city || '')}</div></div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;grid-template-rows:3.3in 1.55in;gap:.08in">
      <div class="ph" style="grid-column:1/3"><img src="${p1}"></div><div class="ph"><img src="${p2}"></div><div class="ph"><img src="${p3}"></div><div class="ph"><img src="${p4}"></div>
      <div style="background:${INK};color:${CREAM};padding:.22in .25in;display:flex;flex-direction:column;justify-content:space-between"><div class="serif" style="font-size:.2in;font-weight:600;line-height:1.3">손님이 남긴 한 줄이<br>다음 손님의 선택이 됩니다</div><div style="font-size:.1in;opacity:.7">Your words guide the next guest</div></div>
    </div>
    <div style="display:flex;gap:.4in;align-items:center;margin-top:.42in">
      <div style="flex:1"><div class="serif" style="font-weight:700;font-size:.72in;line-height:1.1;letter-spacing:-.025em;word-break:keep-all">솔직한 리뷰를<br>남겨 주세요</div><div style="width:1in;height:.02in;background:${INK};margin:.28in 0 .22in"></div><div style="font-size:.19in;font-weight:500;line-height:1.5;word-break:keep-all">휴대폰 카메라로 QR을 비추면<br>리뷰 창이 바로 열립니다.</div><div style="font-size:.14in;color:${MUTE};margin-top:.1in">Share your honest experience on Google</div></div>
      <div style="width:2.75in;flex:0 0 2.75in;background:#fff;padding:.2in;box-shadow:0 .1in .3in rgba(26,22,19,.12)"><div style="width:2.35in;height:2.35in">${QR(q, INK)}</div><div style="text-align:center;font-size:.14in;font-weight:600;margin-top:.15in">스캔 → 별점 → 한 줄</div></div>
    </div>
    <div class="abs" style="left:.5in;right:.5in;bottom:.4in;display:flex;justify-content:space-between;font-size:.14in;color:${MUTE}"><span>${esc(d.phone || '')}</span><span>Google Review</span></div>
  </div>`; },
  tent: (d, q) => { const [p1, p2, p3] = phs(d); return `<div class="p" style="width:4in;height:5in;background:${CREAM};color:${INK};padding:.22in">
    <div style="display:grid;grid-template-columns:1.4fr 1fr;grid-template-rows:1.35in .85in;gap:.05in"><div class="ph" style="grid-row:1/3"><img src="${p1}"></div><div class="ph"><img src="${p2}"></div><div class="ph"><img src="${p3}"></div></div>
    <div style="text-align:center;margin-top:.2in"><div class="serif" style="font-weight:700;font-size:.3in;line-height:1.15;letter-spacing:-.02em">솔직한 리뷰를 남겨 주세요</div><div style="font-size:.1in;color:${MUTE};margin-top:.04in">Share your honest experience</div></div>
    <div style="display:flex;gap:.18in;align-items:center;margin-top:.17in;padding:0 .08in"><div style="width:1.35in;height:1.35in;flex:0 0 1.35in;background:#fff;padding:.08in;box-shadow:0 .05in .15in rgba(26,22,19,.12)">${QR(q, INK)}</div><div style="font-size:.12in;line-height:1.55;font-weight:500">카메라로 QR을 비추면<br>리뷰 창이 바로 열립니다<div style="margin-top:.08in;font-weight:700">스캔 → 별점 → 한 줄</div><div style="font-size:.09in;color:${MUTE};margin-top:.1in">${esc(d.name)}${d.phone ? ' · ' + esc(d.phone) : ''}</div></div></div>
  </div>`; },
  card: (d, q) => { const [p1, p2] = phs(d); return `<div class="p" style="width:4in;height:6in;background:${CREAM};color:${INK};padding:.25in">
    <div style="display:grid;grid-template-columns:1.5fr 1fr;grid-template-rows:2.3in;gap:.05in"><div class="ph"><img src="${p1}"></div><div class="ph"><img src="${p2}"></div></div>
    <div style="text-align:center;margin-top:.26in"><div class="serif" style="font-weight:700;font-size:.34in;line-height:1.15;letter-spacing:-.02em">오늘 어떠셨나요?</div><div style="font-size:.11in;color:${MUTE};margin-top:.04in">How was your visit today?</div></div>
    <div style="width:1.75in;height:1.75in;margin:.2in auto 0;background:#fff;padding:.1in;box-shadow:0 .05in .15in rgba(26,22,19,.12)">${QR(q, INK)}</div>
    <div style="text-align:center;font-size:.12in;font-weight:700;margin-top:.14in">스캔 → 별점 → 한 줄 <span style="font-weight:400;color:${MUTE}">· Scan · Rate · Write</span></div>
    <div class="abs" style="left:.25in;right:.25in;bottom:.18in;display:flex;justify-content:space-between;font-size:.1in;color:${MUTE}"><span>${nameLine(d)}</span><span>${esc(d.phone || '')}</span></div>
  </div>`; },
  sticker: (d, q) => `<div style="width:2in;height:2in;border-radius:50%;background:${CREAM};color:${INK};position:relative;overflow:hidden;text-align:center;padding-top:.16in;border:.02in solid ${INK}">
    <div class="serif" style="font-size:.13in;font-weight:700;padding:0 .3in;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(d.name_ko || d.name)}</div>
    <div style="width:1.08in;height:1.08in;margin:.06in auto 0;background:#fff;padding:.05in">${QR(q, INK)}</div>
    <div style="font-size:.1in;font-weight:600;margin-top:.05in">구글 리뷰 <span style="font-weight:400;color:${MUTE}">· Review us</span></div></div>`,
  mobile: (d, q) => { const [p1] = phs(d); return `<div class="p" style="width:1080px;height:1920px;background:${CREAM};color:${INK}">
    <div class="ph" style="height:1000px"><img src="${p1}"></div>
    <div style="padding:70px 80px 0;text-align:center"><div class="serif" style="font-size:88px;font-weight:700;line-height:1.15;letter-spacing:-.02em">솔직한 리뷰를<br>남겨 주세요</div><div style="font-size:30px;color:${MUTE};margin-top:14px">Share your honest experience</div>
    <div style="width:420px;height:420px;margin:50px auto 0;background:#fff;padding:24px;box-shadow:0 14px 40px rgba(26,22,19,.14)">${QR(q, INK)}</div>
    <div style="font-size:30px;font-weight:700;margin-top:40px">스캔 → 별점 → 한 줄</div><div style="font-size:24px;color:${MUTE};margin-top:14px">${esc(d.name)}${d.phone ? ' · ' + esc(d.phone) : ''}</div></div></div>`; },
};
/* ───── B. 네이비·골드·세리프 ───── */
const NAVY = '#0A1B4D', GOLD = '#C9A84C', IVORY = '#F5EFE3';
const frame = (o, w) => `<div class="abs" style="inset:${o}in;border:${w}in solid ${GOLD};opacity:.9"></div><div class="abs" style="inset:${o + 0.08}in;border:${w / 2}in solid ${GOLD};opacity:.45"></div>`;
const B = {
  poster: (d, q) => `<div class="p" style="width:8.5in;height:11in;background:${NAVY};color:${IVORY}">
    <div class="abs" style="inset:0;background:radial-gradient(ellipse at 50% 30%,rgba(255,255,255,.07),rgba(0,0,0,0) 60%)"></div>${frame(.42, .012)}
    <div class="abs" style="left:0;right:0;top:1.05in;text-align:center"><div class="serif" style="font-size:.22in;font-weight:600;letter-spacing:.04em;color:${GOLD}">${esc(d.name)}</div><div style="font-size:.14in;opacity:.75;margin-top:.04in">${esc(d.name_ko && d.name_ko !== d.name ? d.name_ko : '')}${d.city ? ' · ' + esc(d.city) : ''}</div></div>
    <div class="abs" style="left:0;right:0;top:1.9in">${stars5(GOLD, .34)}</div>
    <div class="abs" style="left:0;right:0;top:2.75in;text-align:center"><div class="serif" style="font-weight:700;font-size:.82in;line-height:1.12;letter-spacing:-.02em;word-break:keep-all">솔직한 리뷰를<br>남겨 주세요</div><div class="serif" style="font-size:.2in;font-style:italic;opacity:.8;margin-top:.22in">Share your honest experience</div></div>
    <div class="abs" style="left:50%;top:5.65in;width:3.1in;margin-left:-1.55in;background:${IVORY};padding:.22in;border:.012in solid ${GOLD}"><div style="width:2.66in;height:2.66in">${QR(q, NAVY)}</div></div>
    <div class="abs" style="left:0;right:0;top:9.05in;text-align:center;font-size:.17in;line-height:1.6"><span style="color:${GOLD}">QR 스캔</span> <span style="opacity:.5;margin:0 .1in">—</span> 별점 선택 <span style="opacity:.5;margin:0 .1in">—</span> 한 줄 남기기<div style="font-size:.12in;opacity:.65">Scan · Rate · Write a line</div></div>
    <div class="abs" style="left:0;right:0;bottom:.72in;text-align:center;font-size:.15in;letter-spacing:.02em;opacity:.8">${esc(d.phone || '')}</div>
  </div>`,
  tent: (d, q) => `<div class="p" style="width:4in;height:5in;background:${NAVY};color:${IVORY}">${frame(.2, .01)}
    <div class="abs" style="left:0;right:0;top:.5in;text-align:center"><div class="serif" style="font-size:.15in;font-weight:600;letter-spacing:.04em;color:${GOLD}">${esc(d.name)}</div><div style="font-size:.1in;opacity:.75">${esc(d.name_ko && d.name_ko !== d.name ? d.name_ko : '')}</div></div>
    <div class="abs" style="left:0;right:0;top:1.02in">${stars5(GOLD, .2)}</div>
    <div class="abs" style="left:0;right:0;top:1.45in;text-align:center"><div class="serif" style="font-weight:700;font-size:.36in;line-height:1.15;letter-spacing:-.02em">솔직한 리뷰를<br>남겨 주세요</div><div class="serif" style="font-size:.11in;font-style:italic;opacity:.8;margin-top:.08in">Share your honest experience</div></div>
    <div class="abs" style="left:50%;top:2.75in;width:1.6in;margin-left:-.8in;background:${IVORY};padding:.1in;border:.01in solid ${GOLD}"><div style="width:1.4in;height:1.4in">${QR(q, NAVY)}</div></div>
    <div class="abs" style="left:0;right:0;top:4.42in;text-align:center;font-size:.1in"><span style="color:${GOLD}">QR 스캔</span> — 별점 — 한 줄 <span style="opacity:.6;margin-left:.1in">${esc(d.phone || '')}</span></div>
  </div>`,
  card: (d, q) => `<div class="p" style="width:4in;height:6in;background:${NAVY};color:${IVORY}">${frame(.22, .01)}
    <div class="abs" style="left:0;right:0;top:.55in;text-align:center"><div class="serif" style="font-size:.17in;font-weight:600;letter-spacing:.04em;color:${GOLD}">${esc(d.name)}</div><div style="font-size:.1in;opacity:.75">${esc(d.name_ko && d.name_ko !== d.name ? d.name_ko : '')}</div></div>
    <div class="abs" style="left:0;right:0;top:1.1in">${stars5(GOLD, .22)}</div>
    <div class="abs" style="left:0;right:0;top:1.6in;text-align:center"><div class="serif" style="font-weight:700;font-size:.4in;line-height:1.15">오늘 어떠셨나요?</div><div class="serif" style="font-size:.12in;font-style:italic;opacity:.8;margin-top:.08in">How was your visit today?</div></div>
    <div class="abs" style="left:50%;top:2.7in;width:2in;margin-left:-1in;background:${IVORY};padding:.12in;border:.01in solid ${GOLD}"><div style="width:1.76in;height:1.76in">${QR(q, NAVY)}</div></div>
    <div class="abs" style="left:.4in;right:.4in;top:4.95in;text-align:center;font-size:.12in;line-height:1.6">30초면 됩니다. 솔직한 한 줄이<br>다음 손님에게 큰 도움이 됩니다.<div style="font-size:.1in;opacity:.65;margin-top:.04in">${esc(d.phone || '')}</div></div>
  </div>`,
  sticker: (d, q) => `<div style="width:2in;height:2in;border-radius:50%;background:${NAVY};color:${IVORY};position:relative;overflow:hidden;text-align:center;padding-top:.13in;border:.03in solid ${GOLD};box-shadow:inset 0 0 0 .06in ${NAVY},inset 0 0 0 .07in ${GOLD}">
    <div class="serif" style="font-size:.11in;font-weight:600;color:${GOLD};letter-spacing:.03em;padding:0 .3in;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(d.name)}</div>
    <div style="width:1.02in;height:1.02in;margin:.05in auto 0;background:${IVORY};padding:.05in">${QR(q, NAVY)}</div>
    <div style="font-size:.09in;margin-top:.05in">구글 리뷰 <span style="opacity:.7">· Review us</span></div></div>`,
  mobile: (d, q) => `<div class="p" style="width:1080px;height:1920px;background:${NAVY};color:${IVORY}">
    <div class="abs" style="inset:48px;border:3px solid ${GOLD};opacity:.9"></div><div class="abs" style="inset:60px;border:1.5px solid ${GOLD};opacity:.45"></div>
    <div style="padding:170px 90px 0;text-align:center"><div class="serif" style="font-size:40px;font-weight:600;letter-spacing:.06em;color:${GOLD}">${esc(d.name)}</div><div style="font-size:26px;opacity:.75;margin-top:8px">${esc(d.name_ko && d.name_ko !== d.name ? d.name_ko : '')}</div>
    <div style="margin:70px 0 60px">${stars5(GOLD, .6)}</div>
    <div class="serif" style="font-size:96px;font-weight:700;line-height:1.12;letter-spacing:-.02em">솔직한 리뷰를<br>남겨 주세요</div><div class="serif" style="font-size:32px;font-style:italic;opacity:.8;margin-top:28px">Share your honest experience</div>
    <div style="width:470px;margin:80px auto 0;background:${IVORY};padding:30px;border:2px solid ${GOLD}"><div style="width:410px;height:410px">${QR(q, NAVY)}</div></div>
    <div style="font-size:30px;margin-top:60px"><span style="color:${GOLD}">QR 스캔</span> — 별점 — 한 줄</div><div style="font-size:26px;opacity:.7;margin-top:30px">${esc(d.phone || '')}</div></div></div>`,
};
/* ───── C. 미니멀 + 도형·아이콘 ───── */
const PAPER = '#FBFAF6';
const dots = `background-image:radial-gradient(#111 .5px,transparent .6px);background-size:.16in .16in;opacity:.18`;
const C = {
  poster: (d, q) => `<div class="p" style="width:8.5in;height:11in;background:${PAPER};color:#111">
    <div class="abs" style="right:-1.2in;top:-1.4in;width:4.6in;height:4.6in;border-radius:50%;background:${d.color};opacity:.08"></div><div class="abs" style="left:.6in;top:.6in;width:2.2in;height:2.2in;${dots}"></div>
    <div class="abs" style="left:.75in;top:.95in;font-size:.2in;font-weight:600">${nameLine(d)}</div>
    <div class="abs" style="left:.75in;top:2.1in;width:6.5in;font-weight:700;font-size:.78in;line-height:1.15;letter-spacing:-.035em;word-break:keep-all">솔직한 리뷰를<br>남겨 주세요<span style="color:${d.color}">.</span></div>
    <div class="abs" style="left:.75in;top:4.25in;font-size:.2in;color:#555">Share your honest experience on Google</div>
    <div class="abs" style="left:50%;top:5.1in;width:4.4in;height:3.7in;margin-left:-2.2in;background:${d.color};border-radius:1.9in .6in 1.9in .6in"></div>
    <div class="abs" style="left:50%;top:5.4in;width:3.1in;margin-left:-1.55in;background:#fff;padding:.2in;border-radius:.1in;box-shadow:0 .15in .4in rgba(0,0,0,.18)"><div style="width:2.7in;height:2.7in">${QR(q, '#111')}</div></div>
    <div class="abs" style="left:0;right:0;top:9.2in">${stepRow(d.color, .2, .5)}</div>
    <div class="abs" style="left:.75in;right:.75in;bottom:.55in;display:flex;justify-content:space-between;font-size:.15in;color:#555"><span>${esc(d.phone || '')}</span><span>Google Review</span></div>
  </div>`,
  tent: (d, q) => `<div class="p" style="width:4in;height:5in;background:${PAPER};color:#111">
    <div class="abs" style="right:-.7in;top:-.8in;width:2.4in;height:2.4in;border-radius:50%;background:${d.color};opacity:.08"></div><div class="abs" style="left:.28in;top:.28in;width:1.1in;height:1.1in;${dots}"></div>
    <div class="abs" style="left:.34in;top:.45in;font-size:.12in;font-weight:600">${nameLine(d)}</div>
    <div class="abs" style="left:.34in;top:.95in;width:3.3in;font-weight:700;font-size:.4in;line-height:1.15;letter-spacing:-.03em">솔직한 리뷰를<br>남겨 주세요<span style="color:${d.color}">.</span></div>
    <div class="abs" style="left:50%;top:2.1in;width:2.4in;height:1.95in;margin-left:-1.2in;background:${d.color};border-radius:1in .35in 1in .35in"></div>
    <div class="abs" style="left:50%;top:2.28in;width:1.6in;margin-left:-.8in;background:#fff;padding:.1in;border-radius:.06in;box-shadow:0 .08in .22in rgba(0,0,0,.18)"><div style="width:1.4in;height:1.4in">${QR(q, '#111')}</div></div>
    <div class="abs" style="left:0;right:0;top:4.2in">${stepRow(d.color, .1, .2)}</div>
    <div class="abs" style="left:.34in;right:.34in;bottom:.18in;display:flex;justify-content:space-between;font-size:.09in;color:#777"><span>${esc(d.phone || '')}</span><span>Google Review</span></div>
  </div>`,
  card: (d, q) => `<div class="p" style="width:4in;height:6in;background:${PAPER};color:#111">
    <div class="abs" style="right:-.8in;top:-.9in;width:2.6in;height:2.6in;border-radius:50%;background:${d.color};opacity:.08"></div><div class="abs" style="left:.3in;top:.3in;width:1.2in;height:1.2in;${dots}"></div>
    <div class="abs" style="left:.36in;top:.5in;font-size:.13in;font-weight:600">${nameLine(d)}</div>
    <div class="abs" style="left:.36in;top:1.05in;width:3.3in;font-weight:700;font-size:.42in;line-height:1.15;letter-spacing:-.03em">오늘 어떠셨나요<span style="color:${d.color}">?</span></div>
    <div class="abs" style="left:.36in;top:1.65in;font-size:.12in;color:#555">How was your visit today?</div>
    <div class="abs" style="left:50%;top:2.3in;width:2.7in;height:2.3in;margin-left:-1.35in;background:${d.color};border-radius:1.1in .4in 1.1in .4in"></div>
    <div class="abs" style="left:50%;top:2.5in;width:1.9in;margin-left:-.95in;background:#fff;padding:.11in;border-radius:.07in;box-shadow:0 .08in .22in rgba(0,0,0,.18)"><div style="width:1.68in;height:1.68in">${QR(q, '#111')}</div></div>
    <div class="abs" style="left:0;right:0;top:5in">${stepRow(d.color, .11, .22)}</div>
    <div class="abs" style="left:.36in;right:.36in;bottom:.2in;display:flex;justify-content:space-between;font-size:.09in;color:#777"><span>${esc(d.phone || '')}</span><span>Google Review</span></div>
  </div>`,
  sticker: (d, q) => `<div style="width:2in;height:2in;border-radius:50%;background:#fff;color:#111;position:relative;overflow:hidden;text-align:center;padding-top:.16in;border:.05in solid ${d.color}">
    <div style="font-size:.12in;font-weight:700;padding:0 .3in;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(d.name_ko || d.name)}</div>
    <div style="width:1.06in;height:1.06in;margin:.06in auto 0">${QR(q, d.color)}</div>
    <div style="font-size:.1in;font-weight:600;margin-top:.05in">구글 리뷰 <span style="font-weight:400;color:#777">· Review us</span></div></div>`,
  mobile: (d, q) => `<div class="p" style="width:1080px;height:1920px;background:${PAPER};color:#111">
    <div class="abs" style="right:-260px;top:-300px;width:900px;height:900px;border-radius:50%;background:${d.color};opacity:.08"></div>
    <div style="padding:150px 90px 0"><div style="font-size:34px;font-weight:600">${nameLine(d)}</div>
    <div style="font-size:112px;font-weight:700;line-height:1.12;letter-spacing:-.035em;margin-top:70px;word-break:keep-all">솔직한 리뷰를<br>남겨 주세요<span style="color:${d.color}">.</span></div><div style="font-size:32px;color:#555;margin-top:24px">Share your honest experience on Google</div></div>
    <div class="abs" style="left:50%;top:880px;width:720px;height:620px;margin-left:-360px;background:${d.color};border-radius:300px 100px 300px 100px"></div>
    <div class="abs" style="left:50%;top:930px;width:520px;margin-left:-260px;background:#fff;padding:30px;border-radius:18px;box-shadow:0 24px 60px rgba(0,0,0,.18)"><div style="width:460px;height:460px">${QR(q, '#111')}</div></div>
    <div class="abs" style="left:0;right:0;top:1580px">${stepRow(d.color, .32, .7)}</div>
    <div class="abs" style="left:90px;right:90px;bottom:70px;display:flex;justify-content:space-between;font-size:26px;color:#555"><span>${esc(d.phone || '')}</span><span>Google Review</span></div></div>`,
};
const DESIGNS = { A, B, C };

/* ───── 인쇄 페이지(레터) — 재단선·접는 선 ───── */
function marks(x, y, w, h) { const L = 0.25, g = 0.06; const m = []; for (const [cx, cy, hx, vy] of [[x, y, -1, -1], [x + w, y, 1, -1], [x, y + h, -1, 1], [x + w, y + h, 1, 1]]) { m.push(`<div class="cut" style="left:${cx + (hx < 0 ? -L - g : g)}in;top:${cy}in;width:${L}in;height:.01in"></div>`); m.push(`<div class="cut" style="left:${cx}in;top:${cy + (vy < 0 ? -L - g : g)}in;width:.01in;height:${L}in"></div>`); } return m.join(''); }
const place = (x, y, html) => `<div style="position:absolute;left:${x}in;top:${y}in">${html}</div>`;
const placeRot = (x, y, w, h, html, deg) => `<div style="position:absolute;left:${x + h / 2 - w / 2}in;top:${y + w / 2 - h / 2}in;width:${w}in;height:${h}in;transform:rotate(${deg}deg);transform-origin:center">${html}</div>`;
function pages(dz, d, qr) {
  const tent = dz.tent(d, qr), card = dz.card(d, qr), st = dz.sticker(d, qr);
  return [
    { name: 'poster', css: '@page{size:8.5in 11in;margin:0}', html: `<div style="position:relative;width:8.5in;height:11in">${dz.poster(d, qr)}</div>` },
    { name: 'tent', css: '@page{size:11in 8.5in;margin:0}', html: `<div style="position:relative;width:11in;height:8.5in">${placeRot(0.5, 2.25, 4, 5, tent, 90)}${placeRot(5.5, 2.25, 4, 5, tent, -90)}${marks(0.5, 2.25, 10, 4)}<div style="position:absolute;left:5.5in;top:2in;height:4.5in;border-left:.01in dashed #999"></div><div style="position:absolute;left:5.56in;top:6.55in;font-size:.1in;color:#666">접는 선 / fold</div></div>` },
    { name: 'card', css: '@page{size:11in 8.5in;margin:0}', html: `<div style="position:relative;width:11in;height:8.5in">${place(1.25, 1.25, card)}${place(5.75, 1.25, card)}${marks(1.25, 1.25, 4, 6)}${marks(5.75, 1.25, 4, 6)}</div>` },
    { name: 'stickers', css: '@page{size:8.5in 11in;margin:0}', html: `<div style="position:relative;width:8.5in;height:11in">${[0, 1, 2, 3].map((r) => [0, 1, 2].map((c) => place(0.75 + c * 2.5, 0.5 + r * 2.5, st)).join('')).join('')}</div>` },
  ];
}
const doc = (head, css, body) => `<!doctype html><html><head><meta charset="utf-8">${head}<style>${css}</style></head><body>${body}</body></html>`;
const FONT_SPECS = ["700 20px 'Noto Serif KR'", "600 20px 'Noto Serif KR'", "20px 'Black Han Sans'", "700 20px 'Noto Sans KR'", "500 20px 'Noto Sans KR'"];

async function launch() {
  const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
  const exe = process.env.PLAYWRIGHT_CHROMIUM || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
  return chromium.launch(exe ? { executablePath: exe } : {});
}
async function qrSvg(browser, text) {
  const lib = fs.readFileSync(path.join(__dirname, '../../src/tools/qrcode.min.js'), 'utf8');
  const page = await browser.newPage(); await page.setContent('<html><body></body></html>'); await page.addScriptTag({ content: lib });
  const svg = await page.evaluate((t) => { const q = qrcode(0, 'M'); q.addData(t); q.make(); return q.createSvgTag({ cellSize: 4, margin: 0, scalable: true }); }, text);
  await page.close(); return svg.replace(/<svg /, '<svg preserveAspectRatio="xMidYMid meet" ');
}
async function render(browser, html, { w, h, scale, png, pdf, css = '' }) {
  const page = await browser.newPage({ viewport: { width: Math.round(w), height: Math.round(h) }, deviceScaleFactor: scale || 1 });
  const head = await installFonts(page);
  await page.setContent(doc(head, BASE_CSS + css, html), { waitUntil: 'load' });
  await waitFonts(page, FONT_SPECS); await page.waitForTimeout(150);
  if (png) await page.locator('#t').screenshot({ path: png, type: 'png', omitBackground: !!png.match(/sticker/) });
  if (pdf) await page.pdf({ path: pdf, preferCSSPageSize: true, printBackground: true });
  await page.close();
}
/** 데이터 정리 — photos 는 data URL 배열. A 룩은 사진이 1장도 없으면 못 만든다 */
function normalize(d) {
  const x = { ...d, color: /^#[0-9a-f]{6}$/i.test(d.color || '') ? d.color : '#0A4DF5', photos: (d.photos || []).filter(Boolean) };
  x.name_ko = x.name_ko || x.name; return x;
}
function availableLooks(d) { return Object.keys(LOOKS).filter((k) => !(LOOKS[k].needsPhotos && !(d.photos || []).length)); }

/** 전체 키트(한 룩). 반환 { files:[{kind,file}], pdf, guide } */
async function makeKit(d0) {
  const d = normalize(d0); const dz = DESIGNS[d.look] || DESIGNS.B; const look = DESIGNS[d.look] ? d.look : 'B';
  if (LOOKS[look].needsPhotos && !d.photos.length) throw new Error('룩 A(사진 콜라주)는 매장 사진이 필요합니다 — 질문지 첨부 사진 또는 --photo');
  fs.mkdirSync(d.out, { recursive: true });
  const b = await launch(); const qr = await qrSvg(b, d.review_url); const files = [];
  try {
    for (const [kind, w, h] of [['tent', 4, 5], ['card', 4, 6], ['poster', 8.5, 11], ['sticker', 2, 2]]) {
      const file = path.join(d.out, `${kind}-${w}x${h}in.png`);
      await render(b, `<div id="t" style="width:${w}in;height:${h}in;overflow:hidden">${dz[kind](d, qr)}</div>`, { w: w * CSS_IN, h: h * CSS_IN, scale: DPI / CSS_IN, png: file });
      files.push({ kind, file });
    }
    { const file = path.join(d.out, 'mobile-1080x1920.png'); await render(b, `<div id="t">${dz.mobile(d, qr)}</div>`, { w: 1080, h: 1920, scale: 1, png: file }); files.push({ kind: 'mobile', file }); }
    const parts = [];
    for (const p of pages(dz, d, qr)) { const file = path.join(d.out, `_${p.name}.pdf`); await render(b, p.html, { w: 816, h: 1056, pdf: file, css: p.css }); parts.push(file); }
    let pdf = path.join(d.out, 'print-kit.pdf');
    try { execFileSync('/usr/bin/pdfunite', [...parts, pdf], { stdio: 'ignore' }); for (const f of parts) fs.unlinkSync(f); }
    catch { pdf = ''; for (const f of parts) { const nf = f.replace('/_', '/print-'); fs.renameSync(f, nf); files.push({ kind: 'pdf', file: nf }); } }
    const guide = path.join(d.out, 'print-guide.md'); fs.writeFileSync(guide, guideMd(d, pdf, look));
    return { files, pdf, guide, look };
  } finally { await b.close(); }
}
/** 시안 — 룩별 텐트+포스터(저해상도) + 보드 1장. 반환 { looks:[{key,label,note,styles,default,tent,poster}], board } */
async function makePreview(d0) {
  const d = normalize(d0); fs.mkdirSync(d.out, { recursive: true });
  const b = await launch(); const qr = await qrSvg(b, d.review_url); const looks = [];
  try {
    for (const k of availableLooks(d)) {
      const dz = DESIGNS[k]; const o = { key: k, ...LOOKS[k] };
      o.poster = path.join(d.out, `look-${k}-poster.png`); o.tent = path.join(d.out, `look-${k}-tent.png`);
      await render(b, `<div id="t" style="width:8.5in;height:11in;overflow:hidden">${dz.poster(d, qr)}</div>`, { w: 8.5 * CSS_IN, h: 11 * CSS_IN, scale: 1.5, png: o.poster });
      await render(b, `<div id="t" style="width:4in;height:5in;overflow:hidden">${dz.tent(d, qr)}</div>`, { w: 4 * CSS_IN, h: 5 * CSS_IN, scale: 2, png: o.tent });
      looks.push(o);
    }
    // 시안 보드 — 룩별로 포스터+텐트 나란히, 라벨. 고객 페이지 카드 이미지로도 쓴다(룩별 card 이미지)
    const cell = (o) => `<div style="display:flex;flex-direction:column;gap:10px"><div style="font-weight:700;font-size:22px">${o.key}. ${esc(o.label)}</div><div style="display:flex;gap:10px;align-items:flex-start"><img src="data:image/png;base64,${fs.readFileSync(o.poster).toString('base64')}" style="height:520px;border:1px solid #ddd"><img src="data:image/png;base64,${fs.readFileSync(o.tent).toString('base64')}" style="height:520px;border:1px solid #ddd"></div><div style="font-size:14px;color:#555;max-width:620px;line-height:1.5">${esc(o.note)}</div></div>`;
    const board = path.join(d.out, 'looks-board.png');
    await render(b, `<div id="t" style="display:inline-flex;gap:36px;padding:28px;background:#fff">${looks.map(cell).join('')}</div>`, { w: 2000, h: 700, scale: 1, png: board });
    for (const o of looks) { o.card = path.join(d.out, `look-${o.key}-card.png`); await render(b, `<div id="t" style="display:inline-flex;gap:8px;padding:8px;background:#fff">${['poster', 'tent'].map((i) => `<img src="data:image/png;base64,${fs.readFileSync(o[i]).toString('base64')}" style="height:420px">`).join('')}</div>`, { w: 900, h: 460, scale: 1, png: o.card }); }
    return { looks, board };
  } finally { await b.close(); }
}

function guideMd(d, pdf, look) {
  return `# ${d.name_ko || d.name} 리뷰 QR 키트 — 인쇄 가이드 (룩 ${look}. ${LOOKS[look].label})

QR 링크: ${d.review_url}
(휴대폰 카메라로 스캔해 구글 리뷰 창이 열리는지 인쇄 전에 한 번 확인)

| 항목 | 파일 | 용지·크기 | 인쇄 메모 |
|---|---|---|---|
| 테이블텐트 | ${pdf ? 'print-kit.pdf 2쪽' : 'print-tent.pdf'} / tent-4x5in.png | 레터 가로, 카드지 80~110lb (216~300gsm) | 재단선대로 10×4" 띠를 자르고 가운데 점선에서 접는다. 두 면이 서로 거꾸로 인쇄된 것이 정상(접으면 양쪽 다 바로 섬). 코팅하면 오래 간다 |
| 포스터 | ${pdf ? 'print-kit.pdf 1쪽' : 'print-poster.pdf'} / poster-8.5x11in.png | 레터 세로, 일반 또는 광택 80lb | 페이지 가장자리가 재단선. 테두리 없는 인쇄가 안 되면 얇은 흰 테두리가 생기는데 그대로 써도 된다 |
| 카운터 카드 | ${pdf ? 'print-kit.pdf 3쪽' : 'print-card.pdf'} / card-4x6in.png | 레터 가로 2-up, 카드지 | 재단선대로 4×6" 2장. 아크릴 스탠드(4×6)에 꽂는다 |
| 스티커 | ${pdf ? 'print-kit.pdf 4쪽' : 'print-stickers.pdf'} / sticker-2x2in.png | Avery 22807(2" 원형 12개) 호환 근사 | 일반 용지에 1장 시험 인쇄해 라벨 위치를 맞춘 뒤 라벨지에 인쇄. 안 맞으면 온라인 스티커 인쇄(2" 원형)에 sticker PNG 업로드 |
| 모바일 공유 | mobile-1080x1920.png | 인쇄 아님 | 카톡·인스타 스토리용. QR 을 길게 누르면 열린다 |

- 인쇄처: 동네 인쇄소(FedEx Office·Staples)에 PDF 그대로, 또는 온라인(Vistaprint·UPrinting)에 PNG 300dpi 업로드
- 문구는 "솔직한 리뷰"만 요청한다. 할인·사은품 등 **리뷰 대가 문구를 추가하지 않는다**(구글 정책 위반, 프로필 정지 사유)
- 구글 로고는 넣지 않았다(브랜드 가이드 확인 전). 글자 "구글 리뷰 · Google Review"만 사용
`;
}

module.exports = { makeKit, makePreview, LOOKS, lookForStyle, availableLooks };
