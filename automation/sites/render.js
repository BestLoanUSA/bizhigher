/**
 * 고객 사이트 렌더러 v3 — 스펙 JSON → 정적 파일 (원페이지, 프리미엄)
 * 설계: docs/customer-sites-design-ko.md §3·§4. 루틴(sites.js)과 로컬 확인(render --spec)이 같이 쓴다.
 *
 * v3 (2026-10-22): 스타일 8종(theme.style) · 스크롤 모션 · 브랜드 색에서 팔레트 자동 생성 · 실시간 영업 중 표시 · 히어로 영상 · 갤러리 마퀴
 *   clean(흰 바탕·브랜드 색)  warm(종이색·틸)  luxe(다크·골드)  editorial(잡지, 사진 위 큰 세리프)
 *   bold(원색 한 가지·큰 산세리프)  soft(파스텔 그라데이션·유리 카드)  mono(흑백 사진·포인트 색 하나)  neon(다크·네온 글로우)
 *   theme.mood 는 v2 호환 별칭(clean/warm/luxe). 없으면 업종으로 자동(styleFor)
 * 원칙: 360px 우선 · 콘텐츠 기본 표시(JS 가 켜진 뒤에만 숨김 클래스, 3초 폴백, reduced-motion 존중) · 빈 값은 섹션 숨김(지어내지 않음) · 리뷰 본문 없음(별점·수·링크·고객이 준 테마만)
 */
'use strict';

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const slugify = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'site';
const telHref = (p) => 'tel:' + String(p || '').replace(/[^\d+]/g, '');

/* ---------- 색 ---------- */
function hex2rgb(h) { const m = /^#?([0-9a-f]{6})$/i.exec(h || ''); if (!m) return [10, 77, 245]; const n = parseInt(m[1], 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
const rgb2hex = ([r, g, b]) => '#' + [r, g, b].map((x) => Math.round(Math.max(0, Math.min(255, x))).toString(16).padStart(2, '0')).join('');
const rgbStr = ([r, g, b]) => `${r}, ${g}, ${b}`;
function luminance([r, g, b]) { const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); }
function rgb2hsl([r, g, b]) { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b); let h = 0, s = 0; const l = (mx + mn) / 2; if (mx !== mn) { const d = mx - mn; s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; } return [h, s, l]; }
function hsl2rgb([h, s, l]) { h = ((h % 360) + 360) % 360; const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2; let [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x]; return [(r + m) * 255, (g + m) * 255, (b + m) * 255]; }
const hsl = (h, s, l) => rgb2hex(hsl2rgb([h, s, l]));
const inkFor = (hex) => (luminance(hex2rgb(hex)) > 0.45 ? '#0F172A' : '#FFFFFF');

/* ---------- 스타일 결정 ---------- */
const STYLES = ['clean', 'warm', 'luxe', 'editorial', 'bold', 'soft', 'mono', 'neon'];
function styleFor(s) {
  const t = s.theme || {};
  if (STYLES.includes(t.style)) return t.style;
  if (['clean', 'warm', 'luxe'].includes(t.mood)) return t.mood;
  const c = `${s.category || ''} ${s.category_en || ''}`.toLowerCase();
  if (/바|펍|bar|pub|노래방|karaoke|헬스|gym|fitness|pc방|클럽|club|당구|billiard/.test(c)) return 'neon';
  if (/부동산|융자|모기지|realt|mortgage|loan|law|변호|보험|insur|주얼리|jewel|회계|cpa|account/.test(c)) return 'luxe';
  if (/카페|커피|베이커리|빵|디저트|cafe|coffee|bakery|dessert|꽃|flower|플라워|브런치|brunch/.test(c)) return 'editorial';
  if (/치킨|분식|bbq|고기|국밥|순두부|chicken|세차|car wash|taco|피자|pizza|버거|burger|학원|academy|tutor/.test(c)) return 'bold';
  if (/네일|nail|피부|skin|스파|spa|소아|pediatric|왁싱|wax|산후|요가|yoga|필라테스|pilates/.test(c)) return 'soft';
  if (/식당|레스토랑|restaurant|뷰티|미용|헤어|hair|beauty|salon|한식|일식|sushi|중식/.test(c)) return 'warm';
  return 'clean';
}
function moodFor(s) { return styleFor(s); } // v2 호환

/* ---------- 스타일별 토큰 ---------- */
function tokens(s, style) {
  const brandHex = s.theme.color; const isDefault = /^#0A4DF5$/i.test(brandHex);
  // 강조색 → 보조 팔레트 (유사색 +30°, 보색 +180°, 연한 틴트). 스타일이 강조색을 바꾸면 그 색에서 다시 뽑는다
  const pal = (hex) => { const [h, sat, lig] = rgb2hsl(hex2rgb(hex)); return { accent: hex, accentInk: inkFor(hex), accent2: hsl(h + 30, Math.max(0.35, sat), Math.min(0.55, Math.max(0.35, lig))), accent3: hsl(h + 180, Math.max(0.3, sat * 0.8), 0.5), tint: hsl(h, Math.min(0.45, sat), 0.965), soft: `rgba(${rgbStr(hex2rgb(hex))}, .11)` }; };
  const base = { serifKo: false, fontHead: 'Fraunces', fontHeadKo: '', fontBody: 'Inter', radius: '18px', dark: false, grain: false, glass: false, grayscale: false, glow: false, wave: false, slant: false, headWeight: 600 };
  const A = (hex) => ({ ...base, ...pal(hex) });
  switch (style) {
    case 'warm': { const accent = isDefault ? '#1F6F68' : brandHex; return { ...A(accent), paper: '#FAF7F2', paper2: '#F2EDE4', card: '#FFFFFF', line: '#E4DDD1', ink: '#14202B', ink2: '#3A4652', ink3: '#6B7580', soft: `rgba(${rgbStr(hex2rgb(accent))}, .10)`, btn: '#14202B', btnInk: '#fff', band: '#14202B', bandInk: '#fff', cta: accent, ctaInk: inkFor(accent), serifKo: true, fontHeadKo: 'Noto Serif KR', wave: true, grain: true }; }
    case 'luxe': { const gold = isDefault ? '#D4B06A' : brandHex; return { ...A(gold), paper: '#0C1117', paper2: '#121923', card: '#161E29', line: '#263140', ink: '#F4EFE6', ink2: '#C9C2B6', ink3: '#8E8A82', soft: `rgba(${rgbStr(hex2rgb(gold))}, .14)`, btn: gold, btnInk: inkFor(gold), band: '#161E29', bandInk: '#F4EFE6', cta: gold, ctaInk: '#0C1117', dark: true, serifKo: true, fontHeadKo: 'Noto Serif KR', grain: true }; }
    case 'editorial': { const accent = isDefault ? '#B5412A' : brandHex; return { ...A(accent), paper: '#FBFAF7', paper2: '#F1EEE7', card: '#FFFFFF', line: '#E2DED5', ink: '#111111', ink2: '#3D3D3D', ink3: '#777', soft: `rgba(${rgbStr(hex2rgb(accent))}, .10)`, btn: '#111', btnInk: '#fff', band: '#111', bandInk: '#fff', cta: accent, ctaInk: inkFor(accent), serifKo: true, fontHead: 'Playfair Display', fontHeadKo: 'Nanum Myeongjo', headWeight: 500, radius: '4px', grain: true }; }
    case 'bold': { const accent = isDefault ? '#FF5A1F' : brandHex; const ink = '#0B0B0F'; return { ...A(accent), paper: '#FFFFFF', paper2: pal(accent).tint, card: '#FFFFFF', line: '#E6E6EA', ink, ink2: '#2C2C35', ink3: '#6B6B78', soft: `rgba(${rgbStr(hex2rgb(accent))}, .12)`, btn: accent, btnInk: inkFor(accent), band: accent, bandInk: inkFor(accent), cta: ink, ctaInk: '#fff', fontHead: 'Space Grotesk', fontHeadKo: '', fontBody: 'Space Grotesk', headWeight: 700, radius: '28px', slant: true }; }
    case 'soft': { const accent = isDefault ? '#8C6FE6' : brandHex; const [ah] = rgb2hsl(hex2rgb(accent)); return { ...A(accent), paper: hsl(ah, 0.5, 0.975), paper2: hsl(ah + 25, 0.55, 0.95), card: 'rgba(255,255,255,.62)', line: 'rgba(255,255,255,.75)', ink: '#2B2746', ink2: '#4E4A66', ink3: '#817C98', soft: `rgba(${rgbStr(hex2rgb(accent))}, .14)`, btn: accent, btnInk: inkFor(accent), band: hsl(ah, 0.45, 0.22), bandInk: '#fff', cta: accent, ctaInk: inkFor(accent), fontHead: 'Nunito', fontBody: 'Nunito', headWeight: 800, radius: '26px', glass: true, wave: true, grad: `linear-gradient(135deg, ${hsl(ah, 0.6, 0.94)} 0%, ${hsl(ah + 40, 0.6, 0.93)} 50%, ${hsl(ah - 40, 0.55, 0.94)} 100%)` }; }
    case 'mono': { const accent = isDefault ? '#C8102E' : brandHex; return { ...A(accent), paper: '#FFFFFF', paper2: '#F5F5F5', card: '#FFFFFF', line: '#1A1A1A', ink: '#111', ink2: '#333', ink3: '#777', soft: 'rgba(0,0,0,.05)', btn: '#111', btnInk: '#fff', band: '#111', bandInk: '#fff', cta: accent, ctaInk: inkFor(accent), serifKo: true, fontHead: 'DM Serif Display', fontHeadKo: 'Gowun Batang', fontBody: 'Inter', headWeight: 400, radius: '0px', grayscale: true }; }
    case 'neon': { const accent = isDefault ? '#19F0C2' : brandHex; return { ...A(accent), paper: '#07080C', paper2: '#0D0F16', card: '#11131C', line: '#1F2330', ink: '#F2F3F7', ink2: '#B9BDCB', ink3: '#7D8294', soft: `rgba(${rgbStr(hex2rgb(accent))}, .14)`, btn: accent, btnInk: inkFor(accent), band: '#0D0F16', bandInk: '#F2F3F7', cta: accent, ctaInk: inkFor(accent), dark: true, fontHead: 'Space Grotesk', fontBody: 'Space Grotesk', headWeight: 700, radius: '14px', glow: true }; }
    default: return { ...A(brandHex), paper: '#FFFFFF', paper2: pal(brandHex).tint, card: '#FFFFFF', line: '#E3E7EE', ink: '#0F172A', ink2: '#334155', ink3: '#64748B', soft: `rgba(${rgbStr(hex2rgb(brandHex))}, .09)`, btn: '#0F172A', btnInk: '#fff', band: '#0F172A', bandInk: '#fff', cta: brandHex, ctaInk: inkFor(brandHex) };
  }
}

/* ---------- 스펙 정규화 ---------- */
function normalize(spec) {
  const s = JSON.parse(JSON.stringify(spec || {}));
  s.slug = slugify(s.slug || s.name);
  s.lang = ['ko', 'en', 'ko-en'].includes(s.lang) ? s.lang : 'ko';
  s.address = s.address || {};
  const arr = (k, f) => { s[k] = Array.isArray(s[k]) ? s[k].filter(f) : []; };
  arr('hours', (h) => h && h.days); arr('services', (x) => x && x.name); arr('highlights', (x) => x && x.title);
  arr('gallery', (u) => /^https?:\/\//.test(u)); arr('faq', (x) => x && x.q && x.a); arr('steps', (x) => x && x.title);
  arr('stats', (x) => x && x.value && x.label); arr('review_themes', (x) => typeof x === 'string' && x.trim()); arr('brands', (x) => typeof x === 'string' && x.trim());
  arr('gallery_generated', (u) => /^https?:\/\//.test(u));
  arr("posts", (p) => p && p.title && p.slug);
  s.contact = s.contact || {};
  s.tier = s.tier === "business" ? "business" : "onepage";
  s.hero = s.hero || {}; s.about = s.about || {}; s.social = s.social || {}; s.theme = s.theme || {}; s.seo = s.seo || {}; s.cta = s.cta || {}; s.promo = s.promo || {};
  s.theme.color = /^#[0-9a-f]{6}$/i.test(s.theme.color || '') ? s.theme.color : '#0A4DF5';
  return s;
}

/* ---------- 한/영 ---------- */
function pick(s, obj, key) {
  const ko = obj[key] || '', en = obj[key + '_en'] || '';
  if (s.lang === 'en') return { main: en || ko, alt: '' };
  return { main: ko || en, alt: s.lang === 'ko-en' ? en : '' };
}
function t(s, obj, key) { const { main, alt } = pick(s, obj, key); return alt ? `<span data-ko="${esc(main)}" data-en="${esc(alt)}">${esc(main)}</span>` : esc(main); }
function L(s, ko, en) { if (s.lang === 'en') return esc(en); return s.lang === 'ko-en' ? `<span data-ko="${esc(ko)}" data-en="${esc(en)}">${esc(ko)}</span>` : esc(ko); }
/* 헤드라인의 강조 단어(hero.em / hero.em_en)를 <em>으로 */
function emph(s) {
  const wrap = (txt, em) => { const e = esc(txt); const w = esc(em || ''); return w && e.includes(w) ? e.replace(w, `<em>${w}</em>`) : e; };
  const { main, alt } = pick(s, s.hero, 'headline');
  const mainEm = s.lang === 'en' ? (s.hero.em_en || s.hero.em) : s.hero.em;
  if (!alt) return wrap(main, mainEm);
  return `<span data-ko="${esc(wrap(main, s.hero.em))}" data-en="${esc(wrap(alt, s.hero.em_en || s.hero.em))}">${wrap(main, s.hero.em)}</span>`;
}

function addressLine(a) { return [a.line1, a.line2, [a.city, a.state].filter(Boolean).join(', ') + (a.zip ? ' ' + a.zip : '')].filter(Boolean).join(', '); }
function mapsHref(s) { return s.maps_url || (s.place_id ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.name)}&query_place_id=${encodeURIComponent(s.place_id)}` : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressLine(s.address) || s.name)}`); }
function stars(r) { const n = Math.round(Number(r) || 0); return '★'.repeat(n) + '☆'.repeat(Math.max(0, 5 - n)); }
const G_LOGO = '<svg class="g" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8z"/><path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1C3.3 21.3 7.3 24 12 24z"/><path fill="#FBBC05" d="M5.3 14.3c-.2-.7-.4-1.5-.4-2.3s.1-1.6.4-2.3V6.6H1.3C.5 8.2 0 10 0 12s.5 3.8 1.3 5.4l4-3.1z"/><path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4C18 1.2 15.2 0 12 0 7.3 0 3.3 2.7 1.3 6.6l4 3.1c.9-2.9 3.6-4.9 6.7-4.9z"/></svg>';

/* 주(state) → 타임존 (영업 중 표시용). 스펙 timezone 이 있으면 그것 */
const TZ = { CA: 'America/Los_Angeles', WA: 'America/Los_Angeles', OR: 'America/Los_Angeles', NV: 'America/Los_Angeles', AZ: 'America/Phoenix', CO: 'America/Denver', UT: 'America/Denver', TX: 'America/Chicago', IL: 'America/Chicago', MN: 'America/Chicago', MO: 'America/Chicago', OK: 'America/Chicago', KS: 'America/Chicago', WI: 'America/Chicago', TN: 'America/Chicago', AL: 'America/Chicago', LA: 'America/Chicago', NY: 'America/New_York', NJ: 'America/New_York', PA: 'America/New_York', VA: 'America/New_York', MD: 'America/New_York', GA: 'America/New_York', FL: 'America/New_York', NC: 'America/New_York', SC: 'America/New_York', MA: 'America/New_York', CT: 'America/New_York', OH: 'America/New_York', MI: 'America/New_York', IN: 'America/New_York', KY: 'America/New_York', DC: 'America/New_York', HI: 'Pacific/Honolulu', AK: 'America/Anchorage' };
/* hours → 요일별 [open, close] 분 단위 (파싱 실패 요일은 생략 → 그 요일은 표시 안 함) */
function hoursTable(hours) {
  const DAY = { 월: 1, 화: 2, 수: 3, 목: 4, 금: 5, 토: 6, 일: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6, sun: 0 };
  const dayIdx = (tok) => { const k = tok.trim().toLowerCase().slice(0, 3); return DAY[k] ?? DAY[tok.trim()[0]] ?? null; };
  const toMin = (txt) => { const m = /(\d{1,2})(?::(\d{2}))?\s*(am|pm|오전|오후)?/i.exec(txt); if (!m) return null; let h = Number(m[1]); const mi = Number(m[2] || 0); const ap = (m[3] || '').toLowerCase(); if ((ap === 'pm' || ap === '오후') && h < 12) h += 12; if ((ap === 'am' || ap === '오전') && h === 12) h = 0; return h * 60 + mi; };
  const out = {};
  for (const h of hours) {
    const range = h.time || (h.open && h.close ? `${h.open}–${h.close}` : '');
    const closed = /휴무|closed|쉼/i.test(range);
    let days = [];
    const dm = /^\s*([^\s–\-~]+)\s*[–\-~]\s*([^\s]+)\s*$/.exec(h.days);
    if (dm) { const a = dayIdx(dm[1]), b = dayIdx(dm[2]); if (a != null && b != null) { for (let d = a; ; d = (d + 1) % 7) { days.push(d); if (d === b) break; if (days.length > 7) break; } } }
    else { for (const tok of h.days.split(/[,·\s/]+/)) { const d = dayIdx(tok); if (d != null) days.push(d); } }
    if (!days.length) continue;
    if (closed) { for (const d of days) out[d] = null; continue; }
    const parts = range.split(/\s*[–\-~]\s*/); if (parts.length < 2) continue;
    const o = toMin(parts[0]), c = toMin(parts[1]); if (o == null || c == null) continue;
    for (const d of days) out[d] = [o, c];
  }
  return Object.keys(out).length ? out : null;
}

function schema(s, canonical) {
  const o = {
    '@context': 'https://schema.org', '@type': s.schema_type || 'LocalBusiness', name: s.name, url: canonical, telephone: s.phone || undefined, email: s.email || undefined,
    image: s.hero.photo || undefined, description: s.seo.description || s.tagline || undefined,
    address: s.address.line1 ? { '@type': 'PostalAddress', streetAddress: [s.address.line1, s.address.line2].filter(Boolean).join(' '), addressLocality: s.address.city, addressRegion: s.address.state, postalCode: s.address.zip, addressCountry: 'US' } : undefined,
    hasMap: s.place_id || s.maps_url ? mapsHref(s) : undefined,
    sameAs: Object.values(s.social).filter(Boolean),
  };
  if (s.hours.length && s.hours.every((h) => h.open && h.close && h.day_codes)) o.openingHoursSpecification = s.hours.map((h) => ({ '@type': 'OpeningHoursSpecification', dayOfWeek: h.day_codes, opens: h.open, closes: h.close }));
  const out = [o];
  if (s.faq.length) out.push({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: s.faq.slice(0, 10).map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) });
  return out.map((x) => JSON.stringify(x, (k, v) => (v === undefined || (Array.isArray(v) && !v.length) ? undefined : v))).join('</script>\n<script type="application/ld+json">');
}

/* ---------- CSS ---------- */
const CSS = (k, style, lang) => `
:root{--paper:${k.paper};--paper2:${k.paper2};--card:${k.card};--line:${k.line};--ink:${k.ink};--ink2:${k.ink2};--ink3:${k.ink3};--accent:${k.accent};--accent2:${k.accent2};--accent3:${k.accent3};--accent-ink:${k.accentInk};--soft:${k.soft};--btn:${k.btn};--btn-ink:${k.btnInk};--band:${k.band};--band-ink:${k.bandInk};--cta:${k.cta};--cta-ink:${k.ctaInk};
--serif:'${k.fontHead}',${k.fontHeadKo ? `'${k.fontHeadKo}',` : ''}Georgia,serif;--sans:'${k.fontBody}',Pretendard,-apple-system,BlinkMacSystemFont,'Segoe UI','Apple SD Gothic Neo','Noto Sans KR',sans-serif;--radius:${k.radius};--shadow:0 1px 2px rgba(20,32,43,.05),0 10px 30px rgba(20,32,43,${k.dark ? '.35' : '.08'})}
*{box-sizing:border-box}html{scroll-behavior:smooth;-webkit-text-size-adjust:100%}body{margin:0;font-family:var(--sans);color:var(--ink);background:${k.grad || 'var(--paper)'};${k.grad ? 'background-attachment:fixed;' : ''}line-height:1.65;font-size:16px;overflow-x:hidden}
img{max-width:100%;display:block}a{color:var(--accent)}h1,h2,h3{margin:0;line-height:1.15;letter-spacing:-.015em;word-break:keep-all;overflow-wrap:anywhere}
h1{font-family:var(--serif);font-weight:${k.headWeight};font-size:clamp(34px,7.2vw,60px);line-height:1.06}h2{font-family:var(--serif);font-weight:${k.headWeight};font-size:clamp(27px,3.6vw,40px);margin-bottom:14px}h3{font-size:17px;font-weight:700;letter-spacing:0}
p{margin:0 0 14px}.wrap{max-width:1120px;margin:0 auto;padding:0 20px}
.eyebrow{font-size:12.5px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--accent);margin-bottom:12px;display:block}
.lead{font-size:17.5px;color:var(--ink2);max-width:56ch}
#prog{position:fixed;top:0;left:0;height:3px;width:0;background:var(--accent);z-index:60;transition:width .1s linear}
.nav{position:sticky;top:0;z-index:30;background:${k.dark ? 'rgba(10,12,18,.84)' : 'rgba(255,255,255,.8)'};backdrop-filter:saturate(1.5) blur(12px);-webkit-backdrop-filter:saturate(1.5) blur(12px);border-bottom:1px solid var(--line)}
.nav .wrap{display:flex;align-items:center;gap:14px;height:64px}.brand{font-family:var(--serif);font-weight:${Math.max(600, k.headWeight)};font-size:20px;color:var(--ink);text-decoration:none;display:flex;align-items:center;gap:10px;letter-spacing:-.01em;white-space:nowrap;min-width:0}.brand span{overflow:hidden;text-overflow:ellipsis}.brand img{height:34px;width:auto}
.nav nav{display:none;gap:22px;margin-left:12px;font-size:14.5px}.nav nav a{color:var(--ink2);text-decoration:none;font-weight:500}.nav nav a:hover{color:var(--ink)}
.nav .right{margin-left:auto;display:flex;gap:8px;align-items:center}
.lang{border:1px solid var(--line);background:transparent;color:var(--ink2);border-radius:999px;padding:7px 11px;font-size:12.5px;font-weight:700;cursor:pointer;font-family:inherit}
.open{display:none;align-items:center;gap:7px;font-size:13px;color:var(--ink2);font-weight:600;white-space:nowrap}.open i{width:8px;height:8px;border-radius:50%;background:#22C55E;box-shadow:0 0 0 3px rgba(34,197,94,.2)}.open.closed i{background:#9CA3AF;box-shadow:none}.open.show{display:flex}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:9px;min-height:50px;padding:0 24px;border-radius:${style === 'mono' ? '0' : style === 'editorial' ? '4px' : '999px'};font-weight:600;font-size:16px;text-decoration:none;border:1.5px solid transparent;transition:transform .15s ease,background .15s ease,box-shadow .15s ease;white-space:nowrap;font-family:inherit;cursor:pointer}
.btn.primary{background:var(--btn);color:var(--btn-ink)}.btn.primary:hover{transform:translateY(-1px);box-shadow:0 8px 20px rgba(0,0,0,.16)}.btn.outline{background:transparent;color:var(--ink);border-color:${style === 'mono' ? 'var(--ink)' : 'var(--line)'}}.btn.outline:hover{border-color:var(--ink2)}
.btn.accent{background:var(--accent);color:var(--accent-ink)}.btn.sm{min-height:42px;padding:0 16px;font-size:14.5px}.btn.sm .num{display:none}.btn.sm .lbl{display:inline}
${k.glow ? '.btn.primary,.btn.accent{box-shadow:0 0 0 1px var(--accent),0 0 22px rgba(' + rgbStr(hex2rgb(k.accent)) + ',.45)}.btn.primary:hover{box-shadow:0 0 0 1px var(--accent),0 0 34px rgba(' + rgbStr(hex2rgb(k.accent)) + ',.7)}' : ''}
.hero{position:relative;padding:56px 0 48px;background:${k.grad ? 'transparent' : `radial-gradient(900px 420px at 88% 12%,var(--soft) 0%,rgba(0,0,0,0) 62%),var(--paper)`};overflow:hidden}
.hero .wrap{display:grid;gap:34px;grid-template-columns:1fr;align-items:center;position:relative;z-index:1}
.hero h1 em{font-style:italic;color:var(--accent)}${style === 'bold' || style === 'neon' ? '.hero h1 em{font-style:normal;background:linear-gradient(90deg,var(--accent),var(--accent2));-webkit-background-clip:text;background-clip:text;color:transparent}' : ''}.hero .lead{margin:20px 0 26px}
.hero .cta{display:flex;gap:10px;flex-wrap:wrap}
.stats{list-style:none;display:flex;gap:16px;margin:32px 0 0;padding:22px 0 0;border-top:1px solid var(--line)}.stats li{flex:1;min-width:0}.stats b{display:block;font-family:var(--serif);font-size:clamp(24px,7vw,30px);white-space:nowrap;font-weight:${Math.max(600, k.headWeight)};line-height:1;letter-spacing:-.02em}.stats span{font-size:13px;color:var(--ink3)}
.photo{position:relative}.photo .frame{position:relative;overflow:hidden;border-radius:${style === 'mono' || style === 'editorial' ? '0' : '28px'};box-shadow:var(--shadow);aspect-ratio:4/3;background:var(--paper2)}.photo img,.photo video{width:100%;height:100%;object-fit:cover;display:block;${k.grayscale ? 'filter:grayscale(1);transition:filter .6s ease;' : ''}}${k.grayscale ? '.photo:hover img{filter:none}' : ''}.photo .glare{position:absolute;inset:-40%;background:radial-gradient(circle at var(--gx,50%) var(--gy,50%),rgba(255,255,255,.28),rgba(255,255,255,0) 40%);pointer-events:none;opacity:0;transition:opacity .3s}.photo:hover .glare{opacity:1}
.chip{position:absolute;background:${k.glass ? 'rgba(255,255,255,.78)' : 'var(--card)'};color:var(--ink);border:1px solid var(--line);border-radius:14px;padding:10px 14px;box-shadow:var(--shadow);font-size:13px;line-height:1.3;display:flex;gap:10px;align-items:center;z-index:2;${k.glass ? 'backdrop-filter:blur(10px);' : ''}}.chip b{display:block;font-size:14px}.chip .st{color:#E0A020;letter-spacing:1px;font-size:12px}.chip .g{flex:none}
.chip.a{right:-6px;top:18px}.chip.b{left:-6px;bottom:22px}
.hero-video{position:absolute;inset:0;z-index:0}.hero-video video{width:100%;height:100%;object-fit:cover;opacity:.35}.hero.has-video{color:#fff}.hero.has-video .lead,.hero.has-video .stats span{color:rgba(255,255,255,.8)}.hero.has-video .stats{border-color:rgba(255,255,255,.25)}.hero.has-video .btn.outline{color:#fff;border-color:rgba(255,255,255,.5)}.hero.has-video::before{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.55),rgba(0,0,0,.75));z-index:0}
.wave{display:block;width:100%;height:46px;margin-top:-1px}
.band{position:relative;background:var(--band);color:var(--band-ink);padding:40px 0;border-top:4px solid var(--accent);${k.slant ? 'clip-path:polygon(0 0,100% 10px,100% 100%,0 calc(100% - 10px));padding:52px 0;' : ''}}.band .wrap{display:flex;gap:20px;align-items:center;flex-wrap:wrap}.band .eyebrow{color:${style === 'bold' ? 'var(--band-ink)' : 'var(--accent)'};opacity:.9}.band h2{font-size:clamp(22px,3vw,30px);margin:0 0 6px}.band p{margin:0;opacity:.85;max-width:60ch}.band .btn{margin-left:auto}${style === 'bold' ? '.band .btn.accent{background:var(--band-ink);color:var(--band)}' : ''}
section{padding:72px 0;position:relative}section.tint{background:${k.grad ? 'rgba(255,255,255,.35)' : 'var(--paper2)'}}.sec-h{max-width:720px;margin-bottom:30px}.sec-h.center{margin-left:auto;margin-right:auto;text-align:center}.sec-h p{color:var(--ink2);font-size:16.5px}
.grid{display:grid;gap:14px;grid-template-columns:1fr}
.card{background:var(--card);border:1px solid var(--line);border-radius:var(--radius);padding:24px 22px;box-shadow:var(--shadow);transition:transform .25s ease,box-shadow .25s ease;transform-style:preserve-3d;will-change:transform;${k.glass ? 'backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);' : ''}${k.glow ? 'box-shadow:none;' : ''}}.card:hover{transform:translateY(-3px);${k.glow ? 'border-color:var(--accent);box-shadow:0 0 24px rgba(' + rgbStr(hex2rgb(k.accent)) + ',.25);' : ''}}
.card .ic{width:40px;height:40px;border-radius:${style === 'mono' ? '0' : '12px'};background:var(--soft);color:var(--accent);display:flex;align-items:center;justify-content:center;margin-bottom:14px;font-weight:800;font-family:var(--serif);font-size:18px}.card:nth-child(3n+2) .ic{color:var(--accent2);background:rgba(${rgbStr(hex2rgb(k.accent2))},.12)}.card:nth-child(3n) .ic{color:var(--accent3);background:rgba(${rgbStr(hex2rgb(k.accent3))},.12)}
.card h3{margin-bottom:6px}.card p{color:var(--ink2);font-size:15px;margin:0}.card .price{display:inline-block;margin-top:12px;font-weight:700;color:var(--accent);font-size:15px}.card img{border-radius:${style === 'mono' ? '0' : '12px'};aspect-ratio:4/3;object-fit:cover;margin-bottom:14px;width:100%;${k.grayscale ? 'filter:grayscale(1);' : ''}}
.why{display:grid;gap:22px 28px;grid-template-columns:1fr}.why div{padding-top:16px;border-top:2px solid var(--accent)}.why div:nth-child(2){border-color:var(--accent2)}.why div:nth-child(3){border-color:var(--accent3)}.why b{display:block;font-size:17px;margin-bottom:6px}.why span{color:var(--ink2);font-size:15px}
.brands{display:flex;flex-wrap:wrap;gap:10px}.brands span{border:1px solid var(--line);background:var(--card);border-radius:${style === 'mono' ? '0' : '999px'};padding:8px 14px;font-size:14px;font-weight:500}
.marq{overflow:hidden;position:relative;width:100%}.marq .track{display:flex;gap:12px;width:max-content;padding:0 20px;animation:slide 48s linear infinite}.marq:hover .track{animation-play-state:paused}.marq img{height:240px;width:auto;aspect-ratio:4/3;object-fit:cover;border-radius:${style === 'mono' || style === 'editorial' ? '0' : '18px'};flex:none;${k.grayscale ? 'filter:grayscale(1);transition:filter .5s;' : ''}}${k.grayscale ? '.marq img:hover{filter:none}' : ''}@keyframes slide{to{transform:translateX(-50%)}}
.gen-note{font-size:12.5px;color:var(--ink3);margin-top:12px}
.steps{display:grid;gap:22px;grid-template-columns:1fr}.steps div{padding-top:16px;border-top:1px solid var(--line)}.steps i{display:block;font-style:normal;font-family:var(--serif);font-size:34px;color:var(--accent);line-height:1;margin-bottom:10px;font-weight:${Math.max(500, k.headWeight)}}.steps div:nth-child(2) i{color:var(--accent2)}.steps div:nth-child(3) i{color:var(--accent3)}.steps b{display:block;font-size:16px;margin-bottom:4px}.steps span{color:var(--ink2);font-size:15px}
.reviews{display:grid;gap:26px;grid-template-columns:1fr;align-items:center}.score{background:var(--card);border:1px solid var(--line);border-radius:var(--radius);padding:30px 26px;text-align:center;box-shadow:var(--shadow);${k.glass ? 'backdrop-filter:blur(14px);' : ''}}.score b{display:block;font-family:var(--serif);font-size:64px;line-height:1;font-weight:${Math.max(600, k.headWeight)}}.score .st{color:#E0A020;font-size:22px;letter-spacing:2px;margin:8px 0}.score small{display:flex;justify-content:center;align-items:center;gap:6px;color:var(--ink3);margin-bottom:14px}
.themes{list-style:none;margin:0;padding:0}.themes li{padding:8px 0 8px 28px;position:relative;color:var(--ink2)}.themes li::before{content:"★";color:var(--accent);position:absolute;left:4px}
.about{display:grid;gap:28px;grid-template-columns:1fr;align-items:center}.about .frame{overflow:hidden;border-radius:${style === 'mono' || style === 'editorial' ? '0' : '24px'};aspect-ratio:4/3;box-shadow:var(--shadow)}.about img{width:100%;height:100%;object-fit:cover;${k.grayscale ? 'filter:grayscale(1);' : ''}}.about p{font-size:16.5px;color:var(--ink2)}
.visit{display:grid;gap:28px;grid-template-columns:1fr}.hours{list-style:none;margin:0;padding:0}.hours li{display:flex;justify-content:space-between;gap:12px;padding:10px 0;border-bottom:1px solid var(--line);font-size:15px}.hours li:last-child{border:0}.hours b{font-weight:600}.hours .closed{color:var(--ink3)}.hours li.today{color:var(--accent)}.hours li.today b::after{content:" · ${lang === 'en' ? 'today' : '오늘'}";font-size:12px;opacity:.8}
.addr{font-size:16px;line-height:1.7;margin-bottom:8px}.addr a{color:var(--ink);text-decoration:none;font-weight:600}
.mapcard{background:var(--paper2);border:1px solid var(--line);border-radius:${style === 'mono' ? '0' : '24px'};min-height:260px;display:flex;align-items:center;justify-content:center;text-align:center;padding:28px;overflow:hidden}
.faq{max-width:760px;margin:0 auto}.faq details{background:var(--card);border:1px solid var(--line);border-radius:${style === 'mono' ? '0' : '14px'};padding:0 20px;margin-bottom:10px;box-shadow:var(--shadow);${k.glass ? 'backdrop-filter:blur(14px);' : ''}}.faq summary{cursor:pointer;list-style:none;font-weight:600;padding:16px 0;display:flex;justify-content:space-between;gap:12px;align-items:center}.faq summary::-webkit-details-marker{display:none}.faq summary::after{content:"+";color:var(--accent);font-size:22px;font-weight:300}.faq details[open] summary::after{content:"–"}.faq .a{padding:0 0 16px;color:var(--ink2);font-size:15.5px}
.ctab{background:var(--cta);color:var(--cta-ink);padding:52px 0;${k.slant ? 'clip-path:polygon(0 10px,100% 0,100% 100%,0 100%);padding-top:62px;' : ''}}.ctab .wrap{display:flex;gap:18px;align-items:center;flex-wrap:wrap}.ctab h2{font-size:clamp(22px,3vw,30px);margin:0;max-width:30ch;color:inherit}.ctab .btns{margin-left:auto;display:flex;gap:10px;flex-wrap:wrap}.ctab .btn.primary{background:var(--cta-ink);color:var(--cta)}.ctab .btn.outline{color:inherit;border-color:rgba(255,255,255,.45)}
footer{background:var(--band);color:var(--band-ink);padding:52px 0 110px}footer .cols{display:grid;gap:28px;grid-template-columns:1fr}footer h3{margin:0 0 10px;font-size:12.5px;font-weight:700;font-family:var(--sans);letter-spacing:.12em;text-transform:uppercase;opacity:.7}footer ul{list-style:none;margin:0;padding:0;font-size:14.5px;line-height:1.9}footer a{color:inherit;text-decoration:none;opacity:.9}footer .brand{color:inherit;margin-bottom:10px}footer .desc{opacity:.75;font-size:14.5px;max-width:40ch}footer .copy{margin-top:30px;padding-top:18px;border-top:1px solid rgba(255,255,255,.14);font-size:13px;opacity:.6}
.bottom{position:fixed;left:0;right:0;bottom:0;z-index:40;padding:8px 12px calc(10px + env(safe-area-inset-bottom));background:${k.dark ? 'rgba(10,12,18,.94)' : 'rgba(255,255,255,.95)'};border-top:1px solid var(--line);backdrop-filter:blur(8px)}.bottom .row{display:grid;grid-template-columns:1fr 1fr;gap:8px}.bottom .btn{min-height:46px}.bottom .open{justify-content:center;margin-bottom:6px;font-size:12.5px}
${k.grain ? 'body::after{content:"";position:fixed;inset:0;pointer-events:none;z-index:70;opacity:' + (k.dark ? '.07' : '.05') + ';background-image:url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'160\' height=\'160\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'.9\' numOctaves=\'2\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\'/%3E%3C/svg%3E")}' : ''}
${style === 'editorial' ? `.hero h1{font-size:clamp(40px,8.5vw,84px);line-height:.98;letter-spacing:-.02em}.hero .eyebrow{letter-spacing:.2em}.hero .photo{margin-top:-4px}` : ''}
${style === 'bold' ? `.hero h1{font-size:clamp(40px,9vw,88px);line-height:.95;letter-spacing:-.035em;text-transform:none}.eyebrow{background:var(--ink);color:#fff;display:inline-block;padding:4px 10px;border-radius:6px}.band .eyebrow{background:rgba(0,0,0,.25)}.btn{font-weight:700}` : ''}
${style === 'neon' ? `.hero{background:radial-gradient(700px 400px at 80% 0%,rgba(${rgbStr(hex2rgb(k.accent))},.22),transparent 60%),radial-gradient(600px 400px at 10% 100%,rgba(${rgbStr(hex2rgb(k.accent2))},.16),transparent 60%),var(--paper)}.photo .frame{box-shadow:0 0 0 1px var(--accent),0 0 40px rgba(${rgbStr(hex2rgb(k.accent))},.35)}.eyebrow{text-shadow:0 0 12px rgba(${rgbStr(hex2rgb(k.accent))},.8)}` : ''}
${style === 'mono' ? `.card,.score,.faq details,.brands span{box-shadow:none;border-width:1px}.why div{border-top-width:1px;border-color:var(--ink)}.steps div{border-color:var(--ink)}` : ''}
/* 모션 — JS 가 켜진 뒤에만(.js) 숨긴다. 3초 폴백·reduced-motion 은 아래 */
.js .rv{opacity:0;transform:translateY(16px);transition:opacity .7s cubic-bezier(.2,.7,.2,1),transform .7s cubic-bezier(.2,.7,.2,1)}.js .rv.on{opacity:1;transform:none}
.js .in{opacity:0;transform:translateY(18px);animation:rise .8s cubic-bezier(.2,.7,.2,1) forwards;animation-delay:calc(var(--i,0) * .09s)}@keyframes rise{to{opacity:1;transform:none}}
.js .px{will-change:transform}
@media(min-width:760px){.nav nav{display:flex}.open.show{display:flex}.hero{padding:88px 0 80px}.hero .wrap{grid-template-columns:1.05fr .95fr;gap:56px}.grid{grid-template-columns:repeat(2,1fr)}.why{grid-template-columns:repeat(2,1fr)}.steps{grid-template-columns:repeat(2,1fr)}.reviews{grid-template-columns:300px 1fr}.about{grid-template-columns:1fr 1fr}.visit{grid-template-columns:1fr 1fr}footer .cols{grid-template-columns:1.4fr 1fr 1fr 1fr}footer{padding-bottom:52px}.bottom{display:none}section{padding:88px 0}.stats{gap:28px}.stats li{flex:0 0 auto;min-width:96px}.btn.sm .num{display:inline}.btn.sm .lbl{display:none}.marq img{height:300px}
${style === 'editorial' ? `.hero .wrap{grid-template-columns:1fr;gap:0}.hero .photo{order:-1;margin:0 0 -90px}.hero .photo .frame{aspect-ratio:21/9}.hero .copy{position:relative;z-index:2;background:var(--paper);padding:34px 40px 0 0;max-width:720px;margin-right:auto}.hero .stats{max-width:600px}` : ''}
${style === 'bold' ? `.hero .wrap{grid-template-columns:1fr;gap:28px}.hero .photo .frame{aspect-ratio:21/9}.hero h1{max-width:16ch}` : ''}}
@media(min-width:1024px){.grid{grid-template-columns:repeat(3,1fr)}.why{grid-template-columns:repeat(4,1fr)}.steps{grid-template-columns:repeat(4,1fr)}.grid.four{grid-template-columns:repeat(4,1fr)}}
@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}.js .rv,.js .in{opacity:1;transform:none;transition:none;animation:none}.card:hover,.btn.primary:hover{transform:none}.marq .track{animation:none}.marq{overflow-x:auto}.photo .glare{display:none}#prog{display:none}}
`;

/* ---------- 페이지 ---------- */
/* ---------- 페이지 공통 ---------- */
function ctx(spec, { canonical, noindex }) {
  const s = spec; const style = styleFor(s); const k = tokens(s, style);
  const name = pick(s, s, 'name').main || s.name;
  const phone = s.phone || ''; const addr = addressLine(s.address); const maps = mapsHref(s);
  const toggle = s.lang === 'ko-en'; const year = new Date().getFullYear();
  const business = s.tier === 'business';
  const posts = business ? (s.posts || []).filter((p) => p && p.title && p.slug) : [];
  const ht = s.hours.length ? hoursTable(s.hours) : null;
  const tz = s.timezone || TZ[(s.address.state || '').toUpperCase()] || 'America/Los_Angeles';
  const gallery = [...s.gallery, ...s.gallery_generated.filter((u) => !s.gallery.includes(u))];
  const stats = s.stats.length ? s.stats : [s.rating ? { value: `${s.rating}★`, label: 'Google', label_ko: '구글 평점' } : null, s.review_count ? { value: String(s.review_count), label: 'reviews', label_ko: '리뷰' } : null, s.since ? { value: `${Math.max(1, year - Number(s.since))}+`, label: 'years', label_ko: '년 운영' } : null].filter(Boolean);
  // 페이지 목록 (비즈니스 등급) — [경로, ko, en]. 원페이지는 앵커
  const pages = business
    ? [['', '홈', 'Home'], s.services.length && ['services/', '서비스', 'Services'], (s.about.text || s.highlights.length || s.steps.length) && ['about/', '소개', 'About'], gallery.length >= 3 && ['gallery/', '갤러리', 'Gallery'], posts.length && ['blog/', '소식', 'Blog'], ['contact/', '오시는 길·문의', 'Visit & Contact']].filter(Boolean)
    : [s.services.length && ['#services', '서비스', 'Services'], s.about.text && ['#about', '소개', 'About'], s.faq.length && ['#faq', '자주 묻는 질문', 'FAQ'], (addr || s.hours.length) && ['#visit', '오시는 길', 'Visit']].filter(Boolean);
  const contactOn = !!(s.contact && s.contact.form) || business;
  return { s, style, k, name, phone, addr, maps, toggle, year, business, posts, ht, tz, gallery, stats, pages, canonical, noindex, contactOn };
}
/* 현재 페이지 깊이(0=루트, 1=/x/, 2=/x/y/)에서 사이트 내 경로로 가는 상대 링크 — pages.dev 하위 경로와 서브도메인 둘 다에서 동작 */
const rel = (depth, p) => (p.startsWith('#') ? (depth ? '../'.repeat(depth) + p : p) : '../'.repeat(depth) + p);

function btns(c, cls, depth = 0) {
  const { s, phone, addr, maps } = c;
  return `${phone ? `<a class="btn primary" href="${telHref(phone)}">📞 ${L(s, '전화하기', 'Call ' + phone)}</a>` : ''}${s.cta.booking_url ? `<a class="btn ${cls || 'outline'}" href="${esc(s.cta.booking_url)}" target="_blank" rel="noopener">${L(s, '온라인 예약', 'Book online')}</a>` : ''}${addr ? `<a class="btn ${cls || 'outline'}" href="${esc(maps)}" target="_blank" rel="noopener">📍 ${L(s, '길찾기', 'Get directions')}</a>` : c.contactOn && c.business ? `<a class="btn ${cls || 'outline'}" href="${rel(depth, 'contact/')}">${L(s, '문의하기', 'Contact us')}</a>` : ''}`;
}

/* ---------- 섹션 ---------- */
const sec = {
  hero(c, depth, compact) {
    const { s, name, stats, toggle } = c; let i = 0; const IN = () => ` in" style="--i:${i++}`;
    return `<section class="hero${s.hero.video ? ' has-video' : ''}" id="top">${s.hero.video ? `<div class="hero-video"><video autoplay muted loop playsinline ${s.hero.photo ? `poster="${esc(s.hero.photo)}"` : ''}><source src="${esc(s.hero.video)}" type="video/mp4"></video></div>` : ''}<div class="wrap">
  <div class="copy">
    ${s.category ? `<span class="eyebrow${IN()}">${t(s, s, 'category')}${s.address.city ? ' · ' + esc(s.address.city) : ''}${s.since ? ` · ${L(s, '설립 ' + s.since, 'since ' + s.since)}` : ''}</span>` : ''}
    <h1 class="${IN()}">${s.hero.headline ? emph(s) : esc(name)}</h1>
    ${s.hero.sub || s.tagline ? `<p class="lead${IN()}">${s.hero.sub ? t(s, s.hero, 'sub') : t(s, s, 'tagline')}</p>` : ''}
    <div class="cta${IN()}">${btns(c, '', depth)}</div>
    ${stats.length ? `<ul class="stats${IN()}">${stats.slice(0, 4).map((x) => `<li><b data-count="${esc(x.value)}">${esc(x.value)}</b><span>${s.lang === 'en' ? esc(x.label) : toggle ? `<span data-ko="${esc(x.label_ko || x.label)}" data-en="${esc(x.label)}">${esc(x.label_ko || x.label)}</span>` : esc(x.label_ko || x.label)}</span></li>`).join('')}</ul>` : ''}
  </div>
  ${s.hero.photo && !s.hero.video ? `<div class="photo${IN()}"><div class="frame"><img class="px" data-px=".12" src="${esc(s.hero.photo)}" alt="${esc(name)}" fetchpriority="high"><div class="glare"></div></div>${s.rating ? `<div class="chip a">${G_LOGO}<span class="st">${stars(s.rating)}</span><span><b>${esc(s.rating)} ${L(s, '구글 평점', 'on Google')}</b>${s.review_count ? `${esc(s.review_count)} ${L(s, '리뷰', 'reviews')}` : ''}</span></div>` : ''}${s.hero.badge ? `<div class="chip b"><span><b>${t(s, s.hero, 'badge')}</b>${s.hero.badge_sub ? t(s, s.hero, 'badge_sub') : ''}</span></div>` : ''}</div>` : ''}
</div>${s.promo.title && !compact ? sec.wave(c) : ''}</section>`;
  },
  wave(c) { return c.k.wave ? `<svg class="wave" viewBox="0 0 1440 46" preserveAspectRatio="none" aria-hidden="true"><path d="M0,20 C240,46 480,0 720,18 C960,36 1200,10 1440,24 L1440,46 L0,46 Z" fill="${c.k.band}"/></svg>` : ''; },
  promo(c) { const { s } = c; return s.promo.title ? `<div class="band"><div class="wrap"><div><span class="eyebrow">${L(s, '지금', 'Our specialty')}</span><h2>${t(s, s.promo, 'title')}</h2>${s.promo.text ? `<p>${t(s, s.promo, 'text')}</p>` : ''}</div>${s.promo.href ? `<a class="btn accent" href="${esc(s.promo.href)}">${s.promo.cta ? t(s, s.promo, 'cta') : L(s, '자세히', 'Learn more')} →</a>` : ''}</div></div>` : ''; },
  services(c, depth, { max = 12, more = false, full = false } = {}) {
    const { s, name } = c; if (!s.services.length) return '';
    const list = s.services.slice(0, max);
    return `<section id="services"><div class="wrap"><div class="sec-h center rv"><span class="eyebrow">${L(s, '서비스', 'What we do')}</span><h2>${s.services_title ? t(s, s, 'services_title') : L(s, '한 곳에서 해결하는 서비스', 'Everything you need, under one roof')}</h2>${s.services_intro ? `<p>${t(s, s, 'services_intro')}</p>` : ''}</div>
<div class="grid${list.length >= 7 ? ' four' : ''}">${list.map((x, n) => `<div class="card rv tilt"${full ? ` id="svc-${n + 1}"` : ''}>${x.photo ? `<img src="${esc(x.photo)}" alt="${esc(x.name)}" loading="lazy">` : `<div class="ic">${String(n + 1).padStart(2, '0')}</div>`}<h3>${t(s, x, 'name')}</h3>${x.desc ? `<p>${t(s, x, 'desc')}</p>` : ''}${full && x.detail ? `<p style="margin-top:8px">${t(s, x, 'detail').replace(/\n/g, '<br>')}</p>` : ''}${x.price ? `<span class="price">${esc(x.price)}</span>` : ''}</div>`).join('')}</div>${more && s.services.length > max ? `<p style="text-align:center;margin-top:22px"><a class="btn outline" href="${rel(depth, 'services/')}">${L(s, '서비스 전체 보기', 'See all services')} →</a></p>` : ''}</div></section>`;
  },
  highlights(c) { const { s, name } = c; return s.highlights.length ? `<section class="tint"><div class="wrap"><div class="sec-h center rv"><span class="eyebrow">${L(s, '왜 ' + name, 'Why ' + name)}</span><h2>${s.highlights_title ? t(s, s, 'highlights_title') : L(s, '손님이 다시 찾는 이유', 'Why neighbors keep coming back')}</h2></div><div class="why">${s.highlights.slice(0, 4).map((h) => `<div class="rv"><b>${t(s, h, 'title')}</b><span>${t(s, h, 'text')}</span></div>`).join('')}</div></div></section>` : ''; },
  brands(c) { const { s } = c; return s.brands.length ? `<section><div class="wrap"><div class="sec-h rv"><span class="eyebrow">${L(s, '취급 브랜드', 'Brands we carry')}</span><h2>${s.brands_title ? t(s, s, 'brands_title') : L(s, '믿을 수 있는 브랜드만', 'Trusted names only')}</h2></div><div class="brands rv">${s.brands.slice(0, 24).map((b) => `<span>${esc(b)}</span>`).join('')}</div></div></section>` : ''; },
  galleryStrip(c, depth, more) { const { s, gallery } = c; return gallery.length >= 3 ? `<section class="tint"><div class="wrap"><div class="sec-h rv"><span class="eyebrow">${L(s, '매장', 'Gallery')}</span><h2>${L(s, '직접 보시면 압니다', 'Come see for yourself')}</h2></div></div><div class="marq rv"><div class="track">${[...gallery.slice(0, 8), ...gallery.slice(0, 8)].map((u) => `<img src="${esc(u)}" alt="" loading="lazy">`).join('')}</div></div>${s.gallery_generated.length ? `<div class="wrap"><p class="gen-note">${L(s, '일부 이미지는 분위기 연출용 이미지입니다.', 'Some images are illustrative.')}</p></div>` : ''}${more ? `<div class="wrap"><p style="text-align:center;margin-top:18px"><a class="btn outline" href="${rel(depth, 'gallery/')}">${L(s, '사진 전체 보기', 'See all photos')} →</a></p></div>` : ''}</section>` : ''; },
  galleryGrid(c) { const { s, gallery } = c; return gallery.length ? `<section><div class="wrap"><div class="gal-grid">${gallery.slice(0, 40).map((u, i) => `<a href="${esc(u)}" target="_blank" rel="noopener" class="rv" aria-label="${L(s, '사진', 'Photo')} ${i + 1}"><img src="${esc(u)}" alt="" loading="lazy"></a>`).join('')}</div>${s.gallery_generated.length ? `<p class="gen-note">${L(s, '일부 이미지는 분위기 연출용 이미지입니다.', 'Some images are illustrative.')}</p>` : ''}</div></section>` : ''; },
  steps(c) { const { s } = c; return s.steps.length ? `<section><div class="wrap"><div class="sec-h center rv"><span class="eyebrow">${L(s, '이용 방법', 'How it works')}</span><h2>${s.steps_title ? t(s, s, 'steps_title') : L(s, '네 단계면 끝납니다', 'Four easy steps')}</h2></div><div class="steps">${s.steps.slice(0, 4).map((x, n) => `<div class="rv"><i>${n + 1}</i><b>${t(s, x, 'title')}</b>${x.text ? `<span>${t(s, x, 'text')}</span>` : ''}</div>`).join('')}</div></div></section>` : ''; },
  reviews(c) { const { s, maps } = c; return s.rating ? `<section class="tint"><div class="wrap"><div class="reviews"><div class="score rv"><b data-count="${esc(s.rating)}">${esc(s.rating)}</b><div class="st">${stars(s.rating)}</div><small>${G_LOGO} ${s.review_count ? `${esc(s.review_count)} ${L(s, '구글 리뷰', 'reviews on Google')}` : 'Google'}</small><a class="btn outline sm" href="${esc(s.review_url || maps)}" target="_blank" rel="noopener">${L(s, '구글에서 리뷰 보기', 'Read reviews on Google')}</a></div><div class="rv"><span class="eyebrow">${L(s, '손님 이야기', 'What customers mention most')}</span><h2>${s.reviews_title ? t(s, s, 'reviews_title') : L(s, '한 번 오신 분이 다시 오십니다', 'People come back — and bring friends')}</h2>${s.review_themes.length ? `<ul class="themes">${s.review_themes.slice(0, 5).map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}</div></div></div></section>` : ''; },
  about(c) { const { s, name } = c; return s.about.text ? `<section id="about"><div class="wrap"><div class="about">${s.about.photo ? `<div class="frame rv"><img class="px" data-px=".08" src="${esc(s.about.photo)}" alt="${esc(name)}" loading="lazy"></div>` : ''}<div class="rv"><span class="eyebrow">${L(s, '소개', 'About')}</span><h2>${s.about.title ? t(s, s.about, 'title') : esc(name)}</h2><p>${t(s, s.about, 'text').replace(/\n/g, '<br>')}</p></div></div></div></section>` : ''; },
  visit(c, depth) {
    const { s, addr, phone, maps, name } = c; if (!(addr || s.hours.length)) return '';
    return `<section class="tint" id="visit"><div class="wrap"><div class="visit"><div class="rv"><span class="eyebrow">${L(s, '오시는 길', 'Visit us')}</span><h2>${s.visit_title ? t(s, s, 'visit_title') : L(s, (s.address.city || '') + '에서 뵙겠습니다', 'Find us in ' + (s.address.city || 'town'))}</h2>${addr ? `<p class="addr">📍 <a href="${esc(maps)}" target="_blank" rel="noopener">${esc(addr)}</a></p>` : ''}${phone ? `<p class="addr">📞 <a href="${telHref(phone)}">${esc(phone)}</a></p>` : ''}${s.email ? `<p class="addr">✉️ <a href="mailto:${esc(s.email)}">${esc(s.email)}</a></p>` : ''}${s.hours.length ? `<ul class="hours">${s.hours.map((h) => { const tm = h.time || (h.open && h.close ? h.open + ' – ' + h.close : ''); const closed = /휴무|closed/i.test(tm); return `<li data-days="${esc(h.days)}"><b>${esc(h.days)}</b><span class="${closed ? 'closed' : ''}">${esc(tm)}</span></li>`; }).join('')}</ul>` : ''}${s.hours_note ? `<p style="color:var(--ink3);font-size:14px;margin-top:10px">${t(s, s, 'hours_note')}</p>` : ''}<div class="cta" style="display:flex;gap:10px;flex-wrap:wrap;margin-top:18px">${btns(c, '', depth)}</div></div><div class="mapcard rv">${s.map_embed ? `<iframe src="${esc(s.map_embed)}" style="width:100%;height:100%;min-height:260px;border:0;border-radius:20px" loading="lazy" title="map"></iframe>` : `<div><p style="font-weight:600">${esc(addr || name)}</p><a class="btn primary" href="${esc(maps)}" target="_blank" rel="noopener">${L(s, '구글 지도에서 열기', 'Open in Google Maps')}</a></div>`}</div></div></div></section>`;
  },
  faq(c) { const { s } = c; return s.faq.length ? `<section id="faq"><div class="wrap"><div class="sec-h center rv"><span class="eyebrow">FAQ</span><h2>${L(s, '자주 묻는 질문', 'Frequently asked questions')}</h2></div><div class="faq">${s.faq.slice(0, 10).map((f) => `<details class="rv"><summary>${t(s, f, 'q')}</summary><div class="a">${t(s, f, 'a')}</div></details>`).join('')}</div></div></section>` : ''; },
  ctab(c, depth) { const { s, phone, addr } = c; return phone || addr || c.contactOn ? `<div class="ctab"><div class="wrap"><h2>${s.closing ? t(s, s, 'closing') : L(s, '궁금한 점은 전화 한 통이면 됩니다.', 'Questions? One call and we will take it from there.')}</h2><div class="btns">${btns(c, 'outline', depth)}</div></div></div>` : ''; },
  /* 문의 폼 — 정적 사이트에서 bizhigher.com 의 Functions 로 POST (JS 없이도 동작). 스팸: 허니팟 + 작성 시간 */
  contact(c, depth) {
    const { s, canonical } = c; if (!c.contactOn) return '';
    const ret = canonical + (c.business ? 'contact/' : '') + '?sent=1';
    return `<section id="contact"><div class="wrap"><div class="contact"><div class="rv"><span class="eyebrow">${L(s, '문의', 'Contact')}</span><h2>${s.contact && s.contact.title ? t(s, s.contact, 'title') : L(s, '궁금한 점을 남겨 주세요', 'Send us a message')}</h2><p class="lead">${s.contact && s.contact.text ? t(s, s.contact, 'text') : L(s, '영업시간 안에 확인하고 연락드립니다. 급하시면 전화가 가장 빠릅니다.', 'We read messages during business hours. For anything urgent, a call is fastest.')}</p></div>
<form class="cform rv" method="post" action="${esc(CONTACT_ENDPOINT)}" data-sent="${esc(s.lang === 'en' ? 'Thanks — we received your message and will get back to you during business hours.' : '문의가 접수되었습니다. 영업시간 안에 연락드리겠습니다.')}">
<input type="hidden" name="slug" value="${esc(s.slug)}"><input type="hidden" name="return_to" value="${esc(ret)}"><input type="hidden" name="_t" value="${Date.now()}"><div class="hp" aria-hidden="true"><label>Website<input type="text" name="website" tabindex="-1" autocomplete="off"></label></div>
<label>${L(s, '이름', 'Name')}<input name="name" required maxlength="80" autocomplete="name"></label>
<div class="two"><label>${L(s, '전화', 'Phone')}<input name="phone" type="tel" maxlength="40" autocomplete="tel"></label><label>${L(s, '이메일', 'Email')}<input name="email" type="email" maxlength="120" autocomplete="email"></label></div>
<label>${L(s, '문의 내용', 'Message')}<textarea name="message" required maxlength="2000" rows="5"></textarea></label>
<button class="btn primary" type="submit">${L(s, '보내기', 'Send')}</button>
<p class="fine">${L(s, '남겨 주신 정보는 답변 용도로만 씁니다.', 'We use your details only to reply.')}</p></form></div></div></section>`;
  },
  blogList(c, depth) { const { s, posts } = c; return posts.length ? `<section><div class="wrap"><div class="posts">${posts.slice(0, 30).map((p) => `<a class="post rv" href="${rel(depth, 'blog/' + slugify(p.slug) + '/')}">${p.photo ? `<img src="${esc(p.photo)}" alt="" loading="lazy">` : ''}<div><span class="date">${esc(p.date || '')}</span><h3>${t(s, p, 'title')}</h3>${p.excerpt ? `<p>${t(s, p, 'excerpt')}</p>` : ''}</div></a>`).join('')}</div></div></section>` : ''; },
  blogPost(c, p) { const { s } = c; const body = String(pick(s, p, 'body').main || '').split(/\n{2,}/).map((para) => /^##\s/.test(para) ? `<h2>${esc(para.replace(/^##\s*/, ''))}</h2>` : `<p>${esc(para).replace(/\n/g, '<br>')}</p>`).join(''); return `<section><div class="wrap"><article class="article">${p.photo ? `<img class="cover" src="${esc(p.photo)}" alt="">` : ''}<span class="date">${esc(p.date || '')}</span><h1>${t(s, p, 'title')}</h1>${body}</article></div></section>`; },
  pageHead(c, ko, en, sub) { return `<section class="phead"><div class="wrap"><span class="eyebrow in" style="--i:0">${esc(c.name)}</span><h1 class="in" style="--i:1">${L(c.s, ko, en)}</h1>${sub ? `<p class="lead in" style="--i:2">${sub}</p>` : ''}</div></section>`; },
};
const CONTACT_ENDPOINT = 'https://bizhigher.com/api/site-contact';

const EXTRA_CSS = `
.phead{padding:56px 0 20px}.phead h1{font-size:clamp(32px,5.5vw,52px)}
.gal-grid{display:grid;gap:10px;grid-template-columns:repeat(2,1fr)}.gal-grid img{aspect-ratio:1;object-fit:cover;width:100%;border-radius:var(--radius)}.gal-grid a:first-child{grid-column:span 2}.gal-grid a:first-child img{aspect-ratio:16/9}
.contact{display:grid;gap:28px;grid-template-columns:1fr}.cform{background:var(--card);border:1px solid var(--line);border-radius:var(--radius);padding:22px;box-shadow:var(--shadow);display:grid;gap:12px}.cform label{display:grid;gap:6px;font-size:14px;font-weight:600;color:var(--ink2)}.cform input,.cform textarea{font:inherit;font-size:16px;padding:12px 14px;border:1.5px solid var(--line);border-radius:12px;background:var(--paper);color:var(--ink);width:100%}.cform input:focus,.cform textarea:focus{outline:0;border-color:var(--accent)}.cform .two{display:grid;gap:12px;grid-template-columns:1fr}.cform .fine{font-size:12.5px;color:var(--ink3);margin:0}.cform .hp{position:absolute;left:-9999px;top:-9999px}.cform .ok{background:var(--soft);border-radius:12px;padding:14px;font-weight:600}
.posts{display:grid;gap:16px;grid-template-columns:1fr}.post{display:grid;gap:12px;background:var(--card);border:1px solid var(--line);border-radius:var(--radius);padding:16px;text-decoration:none;color:inherit;box-shadow:var(--shadow)}.post img{aspect-ratio:16/9;object-fit:cover;border-radius:12px;width:100%}.post h3{font-size:18px;margin:4px 0 6px}.post p{color:var(--ink2);font-size:15px;margin:0}.date{font-size:12.5px;color:var(--ink3);font-weight:600;letter-spacing:.04em}
.article{max-width:720px;margin:0 auto}.article .cover{border-radius:var(--radius);margin-bottom:22px;aspect-ratio:16/9;object-fit:cover;width:100%}.article h1{font-size:clamp(30px,5vw,46px);margin:8px 0 22px}.article h2{font-size:24px;margin:30px 0 10px}.article p{font-size:17px;color:var(--ink2)}
.nav nav a.on{color:var(--accent)}
@media(min-width:760px){.gal-grid{grid-template-columns:repeat(4,1fr)}.gal-grid a:first-child{grid-column:span 2;grid-row:span 2}.gal-grid a:first-child img{aspect-ratio:auto;height:100%}.contact{grid-template-columns:1fr 1.1fr;align-items:start}.cform .two{grid-template-columns:1fr 1fr}.posts{grid-template-columns:repeat(3,1fr)}.phead{padding:80px 0 10px}}
`;

/* 공통 셸 — head·나브·푸터·스크립트. depth = 현재 페이지 깊이, active = 활성 메뉴 경로 */
function shell(c, { title, desc, depth = 0, active = '', content, extraSchema = [], canonicalPage }) {
  const { s, style, k, name, phone, addr, maps, toggle, year, ht, tz, pages } = c;
  const canonical = canonicalPage || c.canonical;
  const fonts = (() => { const f = new Set(); const add = (n, w) => f.add(`family=${n.replace(/ /g, '+')}:wght@${w}`); const hw = { Fraunces: '500;600', 'Playfair Display': '500;600', 'Space Grotesk': '500;700', Nunito: '600;800', 'DM Serif Display': '400' }[k.fontHead] || '600;700'; add(k.fontHead, hw); if (k.fontHeadKo) add(k.fontHeadKo, { 'Noto Serif KR': '600', 'Nanum Myeongjo': '700', 'Gowun Batang': '700' }[k.fontHeadKo] || '700'); if (k.fontBody !== k.fontHead) add(k.fontBody, '400;500;600;700'); return [...f].join('&'); })();
  const openChip = ht ? `<span class="open" id="open-chip"><i></i><span class="t"></span></span>` : '';
  const navLinks = pages.map(([h, ko, en]) => `<a href="${h.startsWith('#') ? (depth ? rel(depth, '') + h : h) : rel(depth, h)}"${h === active ? ' class="on"' : ''}>${L(s, ko, en)}</a>`).join('');
  const schemas = [schema(s, c.canonical), ...extraSchema].join('</script>\n<script type="application/ld+json">');
  return `<!doctype html>
<html lang="${s.lang === 'en' ? 'en' : 'ko'}" data-style="${style}">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
${c.noindex ? '<meta name="robots" content="noindex,nofollow">' : ''}
<link rel="canonical" href="${esc(canonical)}">
<meta property="og:type" content="business.business"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}">${s.hero.photo ? `<meta property="og:image" content="${esc(s.hero.photo)}">` : ''}<meta property="og:url" content="${esc(canonical)}">
<meta name="theme-color" content="${k.paper.startsWith('#') ? k.paper : '#ffffff'}">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?${fonts}&display=swap">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">
${s.logo ? `<link rel="icon" href="${esc(s.logo)}">` : ''}
<script type="application/ld+json">${schemas}</script>
<style>${CSS(k, style, s.lang)}${EXTRA_CSS}</style>
</head>
<body${ht ? ` data-hours='${esc(JSON.stringify(ht))}' data-tz="${esc(tz)}"` : ''}>
<div id="prog" aria-hidden="true"></div>
<header class="nav"><div class="wrap">
  <a class="brand" href="${rel(depth, '')}${depth ? '' : '#top'}">${s.logo ? `<img src="${esc(s.logo)}" alt="${esc(name)}">` : ''}<span>${esc(name)}</span></a>
  <nav>${navLinks}</nav>
  <div class="right">${openChip}${toggle ? '<button class="lang" id="lang" type="button" aria-label="Language">EN</button>' : ''}${phone ? `<a class="btn primary sm" href="${telHref(phone)}">📞 <span class="num">${esc(phone)}</span><span class="lbl">${L(s, '전화', 'Call')}</span></a>` : ''}</div>
</div></header>
<main>
${content}
</main>
<footer><div class="wrap"><div class="cols">
  <div><a class="brand" href="${rel(depth, '')}">${esc(name)}</a><p class="desc">${t(s, s, 'tagline') || ''}</p>${addr ? `<p class="desc">${esc(addr)}</p>` : ''}${phone ? `<p class="desc"><a href="${telHref(phone)}">${esc(phone)}</a></p>` : ''}</div>
  ${s.hours.length ? `<div><h3>${L(s, '영업시간', 'Hours')}</h3><ul>${s.hours.map((h) => `<li>${esc(h.days)} · ${esc(h.time || (h.open && h.close ? h.open + '–' + h.close : ''))}</li>`).join('')}</ul></div>` : ''}
  ${s.services.length ? `<div><h3>${L(s, '서비스', 'Services')}</h3><ul>${s.services.slice(0, 8).map((x) => `<li><a href="${c.business ? rel(depth, 'services/') : rel(depth, '') + '#services'}">${t(s, x, 'name')}</a></li>`).join('')}</ul></div>` : ''}
  <div><h3>${L(s, '바로가기', 'Links')}</h3><ul>${pages.map(([h, ko, en]) => `<li><a href="${h.startsWith('#') ? rel(depth, '') + h : rel(depth, h)}">${L(s, ko, en)}</a></li>`).join('')}${Object.entries(s.social).filter(([, v]) => v).map(([kk, v]) => `<li><a href="${esc(v)}" target="_blank" rel="noopener">${esc(kk[0].toUpperCase() + kk.slice(1))}</a></li>`).join('')}</ul></div>
</div><div class="copy">© ${year} ${esc(name)}. All rights reserved.</div></div></footer>
${phone || addr ? `<div class="bottom">${ht ? `<span class="open" id="open-bar"><i></i><span class="t"></span></span>` : ''}<div class="row">${phone ? `<a class="btn primary" href="${telHref(phone)}">📞 ${L(s, '전화', 'Call')}</a>` : ''}${addr ? `<a class="btn outline" href="${esc(maps)}" target="_blank" rel="noopener" style="background:var(--card)">📍 ${L(s, '길찾기', 'Directions')}</a>` : ''}</div></div>` : ''}
<script>(function(){
  var d=document.documentElement, rm=matchMedia('(prefers-reduced-motion: reduce)').matches, en=false;
  try{en=localStorage.getItem('lang')==='en'}catch(e){}
  var LANG=${s.lang === 'en' ? "'en'" : "(en?'en':'ko')"};
  /* 1) 스크롤 연출 — JS 가 켜진 뒤에만 숨김(.js). 3초 뒤 강제 표시 폴백 */
  if('IntersectionObserver' in window && !rm){d.classList.add('js');var els=[].slice.call(document.querySelectorAll('.rv'));var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('on');io.unobserve(e.target);}});},{rootMargin:'0px 0px -8% 0px'});els.forEach(function(el){io.observe(el);});setTimeout(function(){els.forEach(function(el){el.classList.add('on');});},3000);
    /* 2) 숫자 카운트업 */
    var cnt=[].slice.call(document.querySelectorAll('[data-count]'));var co=new IntersectionObserver(function(es){es.forEach(function(e){if(!e.isIntersecting)return;co.unobserve(e.target);var el=e.target,raw=el.getAttribute('data-count'),m=/^([^\\d]*)(\\d+(?:\\.\\d+)?)(.*)$/.exec(raw);if(!m)return;var to=parseFloat(m[2]),dec=(m[2].split('.')[1]||'').length,t0=null;function step(ts){if(!t0)t0=ts;var p=Math.min(1,(ts-t0)/1200),v=to*(1-Math.pow(1-p,3));el.textContent=m[1]+v.toFixed(dec)+m[3];if(p<1)requestAnimationFrame(step);else el.textContent=raw;}requestAnimationFrame(step);});},{threshold:.6});cnt.forEach(function(el){co.observe(el);});
    /* 3) 패럴랙스 + 진행 바 */
    var px=[].slice.call(document.querySelectorAll('.px')),prog=document.getElementById('prog'),tick=false;function onS(){if(tick)return;tick=true;requestAnimationFrame(function(){tick=false;var y=window.scrollY||0,H=d.scrollHeight-innerHeight;if(prog)prog.style.width=(H>0?Math.min(100,y/H*100):0)+'%';px.forEach(function(el){var r=el.parentElement.getBoundingClientRect();if(r.bottom<0||r.top>innerHeight)return;var f=parseFloat(el.getAttribute('data-px')||'.1'),off=(r.top+r.height/2-innerHeight/2)*f;el.style.transform='translateY('+off.toFixed(1)+'px) scale(1.12)';});});}addEventListener('scroll',onS,{passive:true});onS();
    /* 4) 데스크탑 포인터: 카드 틸트 + 히어로 사진 빛 반사 */
    if(matchMedia('(hover:hover) and (pointer:fine)').matches){document.querySelectorAll('.tilt').forEach(function(c){c.addEventListener('mousemove',function(ev){var r=c.getBoundingClientRect(),x=(ev.clientX-r.left)/r.width-.5,y=(ev.clientY-r.top)/r.height-.5;c.style.transform='translateY(-3px) rotateX('+(-y*5).toFixed(2)+'deg) rotateY('+(x*5).toFixed(2)+'deg)';});c.addEventListener('mouseleave',function(){c.style.transform='';});});
      document.querySelectorAll('.photo').forEach(function(p){p.addEventListener('mousemove',function(ev){var r=p.getBoundingClientRect();p.style.setProperty('--gx',((ev.clientX-r.left)/r.width*100).toFixed(1)+'%');p.style.setProperty('--gy',((ev.clientY-r.top)/r.height*100).toFixed(1)+'%');});});}
  }
  /* 5) 지금 영업 중 — 영업시간표 + 가게 타임존 */
  try{var hb=document.body.getAttribute('data-hours');if(hb){var H=JSON.parse(hb),tz=document.body.getAttribute('data-tz')||'America/Los_Angeles';var parts=new Intl.DateTimeFormat('en-US',{timeZone:tz,weekday:'short',hour:'numeric',minute:'numeric',hour12:false}).formatToParts(new Date()),g={};parts.forEach(function(p){g[p.type]=p.value});var wd={Sun:0,Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6}[g.weekday],now=(parseInt(g.hour,10)%24)*60+parseInt(g.minute,10);var fmt=function(m){var h=Math.floor(m/60),mi=m%60,ap=h>=12?'PM':'AM',h12=h%12||12;return LANG==='en'?h12+(mi?':'+String(mi).padStart(2,'0'):'')+' '+ap:(h>=12?'오후 ':'오전 ')+h12+(mi?':'+String(mi).padStart(2,'0'):'')+'시'};var today=H[wd],isOpen=false,txt='';if(today&&now>=today[0]&&now<today[1]){isOpen=true;txt=LANG==='en'?'Open now · closes '+fmt(today[1]):'지금 영업 중 · '+fmt(today[1])+' 마감'}else{var n=null;for(var i=0;i<7&&n==null;i++){var dd=(wd+i)%7,h=H[dd];if(h&&(i>0||now<h[0])){n=[i,h[0]];}}txt=n?(LANG==='en'?'Closed · opens '+(n[0]===0?'today ':n[0]===1?'tomorrow ':'')+fmt(n[1]):'영업 종료 · '+(n[0]===0?'오늘 ':n[0]===1?'내일 ':'')+fmt(n[1])+' 오픈'):(LANG==='en'?'Closed':'영업 종료')}
    ['open-chip','open-bar'].forEach(function(id){var el=document.getElementById(id);if(!el)return;el.querySelector('.t').textContent=txt;el.classList.toggle('closed',!isOpen);el.classList.add('show');});
    var rows=document.querySelectorAll('.hours li');var KO=['일','월','화','수','목','금','토'],EN=['sun','mon','tue','wed','thu','fri','sat'];rows.forEach(function(li){var dsv=(li.getAttribute('data-days')||'').toLowerCase();if(dsv.indexOf(KO[wd])>-1||dsv.indexOf(EN[wd])>-1){li.classList.add('today');return;}var m=/^\\s*(\\S)[^–\\-~]*[–\\-~]\\s*(\\S)/.exec(dsv);if(m){var a=KO.indexOf(m[1])>-1?KO.indexOf(m[1]):EN.indexOf(dsv.slice(0,3)),b=KO.indexOf(m[2]);var bm=/[–\\-~]\\s*([a-z]{3})/.exec(dsv);if(bm)b=EN.indexOf(bm[1]);if(a>-1&&b>-1){for(var x=a,c=0;c<7;c++,x=(x+1)%7){if(x===wd){li.classList.add('today');break;}if(x===b)break;}}}});}}catch(e){}
  /* 6) 문의 폼 — ?sent=1 이면 접수 안내 */
  try{var cf=document.querySelector('.cform');if(cf&&/[?&]sent=1/.test(location.search)){var ok=document.createElement('div');ok.className='ok';ok.textContent=cf.getAttribute('data-sent');cf.parentNode.insertBefore(ok,cf);cf.style.display='none';ok.scrollIntoView({block:'center'});}}catch(e){}
  /* 7) 한/영 토글 */
  var b=document.getElementById('lang');if(!b)return;
  function apply(){document.querySelectorAll('[data-en]').forEach(function(el){el.innerHTML=en?el.getAttribute('data-en'):el.getAttribute('data-ko')});b.textContent=en?'한국어':'EN';d.lang=en?'en':'ko'}
  b.addEventListener('click',function(){en=!en;try{localStorage.setItem('lang',en?'en':'ko')}catch(e){}apply()});if(en)apply();
})();</script>
</body></html>`;
}

const crumbs = (c, items) => ({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: items.map(([n, u], i) => ({ '@type': 'ListItem', position: i + 1, name: n, item: c.canonical + u })) });

/* 원페이지 */
function onepage(c) {
  const { s, name } = c;
  const title = s.seo.title || `${name} — ${s.tagline || s.category || ''}`.replace(/ — $/, '');
  const content = [sec.hero(c, 0), sec.promo(c), sec.services(c, 0), sec.highlights(c), sec.brands(c), sec.galleryStrip(c, 0), sec.steps(c), sec.reviews(c), sec.about(c), sec.visit(c, 0), sec.faq(c), sec.contact(c, 0), sec.ctab(c, 0)].join('\n');
  return shell(c, { title, desc: s.seo.description || s.tagline || '', content });
}

/* 비즈니스 등급 — 페이지별 파일 */
function business(c) {
  const { s, name, posts } = c; const files = {};
  const base = s.seo.title || `${name} — ${s.tagline || s.category || ''}`.replace(/ — $/, '');
  const desc = s.seo.description || s.tagline || '';
  const T = (ko, en) => (s.lang === 'en' ? en : ko) + ' | ' + name;
  files['index.html'] = shell(c, { title: base, desc, depth: 0, active: '', content: [sec.hero(c, 0), sec.promo(c), sec.services(c, 0, { max: 6, more: true }), sec.highlights(c), sec.reviews(c), sec.galleryStrip(c, 0, true), sec.ctab(c, 0)].join('\n') });
  if (s.services.length) files['services/index.html'] = shell(c, { title: T('서비스', 'Services'), desc, depth: 1, active: 'services/', canonicalPage: c.canonical + 'services/', extraSchema: [crumbs(c, [[name, ''], [s.lang === 'en' ? 'Services' : '서비스', 'services/']])], content: [sec.pageHead(c, '서비스', 'Services', s.services_intro ? t(s, s, 'services_intro') : ''), sec.services(c, 1, { full: true }), sec.faq(c), sec.ctab(c, 1)].join('\n') });
  if (s.about.text || s.highlights.length || s.steps.length) files['about/index.html'] = shell(c, { title: T('소개', 'About'), desc, depth: 1, active: 'about/', canonicalPage: c.canonical + 'about/', extraSchema: [crumbs(c, [[name, ''], [s.lang === 'en' ? 'About' : '소개', 'about/']])], content: [sec.pageHead(c, '소개', 'About'), sec.about(c), sec.highlights(c), sec.steps(c), sec.brands(c), sec.reviews(c), sec.ctab(c, 1)].join('\n') });
  if (c.gallery.length >= 3) files['gallery/index.html'] = shell(c, { title: T('갤러리', 'Gallery'), desc, depth: 1, active: 'gallery/', canonicalPage: c.canonical + 'gallery/', extraSchema: [crumbs(c, [[name, ''], [s.lang === 'en' ? 'Gallery' : '갤러리', 'gallery/']])], content: [sec.pageHead(c, '갤러리', 'Gallery'), sec.galleryGrid(c), sec.ctab(c, 1)].join('\n') });
  files['contact/index.html'] = shell(c, { title: T('오시는 길·문의', 'Visit & Contact'), desc, depth: 1, active: 'contact/', canonicalPage: c.canonical + 'contact/', extraSchema: [crumbs(c, [[name, ''], [s.lang === 'en' ? 'Contact' : '오시는 길·문의', 'contact/']])], content: [sec.pageHead(c, '오시는 길 · 문의', 'Visit & Contact'), sec.visit(c, 1), sec.contact(c, 1), sec.faq(c)].join('\n') });
  if (posts.length) {
    files['blog/index.html'] = shell(c, { title: T('소식', 'Blog'), desc, depth: 1, active: 'blog/', canonicalPage: c.canonical + 'blog/', extraSchema: [crumbs(c, [[name, ''], [s.lang === 'en' ? 'Blog' : '소식', 'blog/']])], content: [sec.pageHead(c, '소식', 'Blog'), sec.blogList(c, 1), sec.ctab(c, 1)].join('\n') });
    for (const p of posts) { const ps = slugify(p.slug); files[`blog/${ps}/index.html`] = shell(c, { title: `${pick(s, p, 'title').main} | ${name}`, desc: p.excerpt || desc, depth: 2, active: 'blog/', canonicalPage: c.canonical + `blog/${ps}/`, extraSchema: [{ '@context': 'https://schema.org', '@type': 'BlogPosting', headline: p.title, datePublished: p.date || undefined, image: p.photo || undefined, author: { '@type': 'Organization', name }, publisher: { '@type': 'Organization', name } }, crumbs(c, [[name, ''], [s.lang === 'en' ? 'Blog' : '소식', 'blog/'], [p.title, `blog/${ps}/`]])], content: [sec.blogPost(c, p), sec.ctab(c, 2)].join('\n') }); }
  }
  return files;
}

function render(spec, { origin, noindex }) {
  const s = normalize(spec);
  const canonical = (origin || `https://${s.slug}.sites.bizhigher.com`).replace(/\/$/, '') + '/';
  const c = ctx(s, { canonical, noindex: !!noindex });
  const files = c.business ? business(c) : { 'index.html': onepage(c) };
  const urls = Object.keys(files).map((f) => canonical + f.replace(/index\.html$/, ''));
  files['robots.txt'] = noindex ? 'User-agent: *\nDisallow: /\n' : `User-agent: *\nAllow: /\nSitemap: ${canonical}sitemap.xml\n`;
  files['sitemap.xml'] = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map((u) => `<url><loc>${esc(u)}</loc></url>`).join('')}</urlset>\n`;
  return { slug: s.slug, files, pages: urls };
}

module.exports = { render, normalize, slugify, styleFor, moodFor, STYLES, hoursTable, CONTACT_ENDPOINT };
