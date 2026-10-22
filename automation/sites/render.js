/**
 * 고객 사이트 렌더러 v2 — 스펙 JSON → 정적 파일 (원페이지, 프리미엄)
 * 설계: docs/customer-sites-design-ko.md §3·§4. 루틴(sites.js)과 로컬 확인(render --spec)이 같이 쓴다.
 * 디자인 기준: newoptix.com (세리프 디스플레이 + 산세리프 본문, 종이색 배경, 필 버튼, 88px 섹션 리듬, 통계 행, 프로모 밴드, FAQ, CTA 밴드)
 * 무드 3종 (theme.mood): clean(전문직·의료·안경) · warm(식당·카페·뷰티) · luxe(부동산·융자·고급 뷰티) — 같은 뼈대, 서체·색·질감만 다름
 * 원칙: 360px 우선 · 콘텐츠 기본 표시(JS 없이도 전부 보임, 스크롤 연출은 JS 가 켜진 뒤에만) · 빈 값은 섹션 숨김(지어내지 않음) · 리뷰 본문 없음(별점·수·링크·고객이 준 테마만)
 */
'use strict';

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const slugify = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'site';
const telHref = (p) => 'tel:' + String(p || '').replace(/[^\d+]/g, '');

function hex2rgb(h) { const m = /^#?([0-9a-f]{6})$/i.exec(h || ''); if (!m) return [31, 111, 104]; const n = parseInt(m[1], 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
const rgbStr = ([r, g, b]) => `${r}, ${g}, ${b}`;
function mix([r, g, b], [r2, g2, b2], t) { return '#' + [r + (r2 - r) * t, g + (g2 - g) * t, b + (b2 - b) * t].map((x) => Math.round(x).toString(16).padStart(2, '0')).join(''); }
function luminance([r, g, b]) { const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); }

/* 업종 → 기본 무드 */
function moodFor(s) {
  const m = (s.theme && s.theme.mood) || '';
  if (['clean', 'warm', 'luxe'].includes(m)) return m;
  const c = `${s.category || ''} ${s.category_en || ''}`.toLowerCase();
  if (/부동산|융자|모기지|realt|mortgage|loan|law|변호|보험|insur|주얼리|jewel|스파|spa|네일 살롱/.test(c)) return 'luxe';
  if (/식당|레스토랑|카페|커피|베이커리|빵|디저트|restaurant|cafe|coffee|bakery|bbq|고기|국밥|순두부|치킨|뷰티|미용|헤어|hair|beauty|nail|꽃|flower/.test(c)) return 'warm';
  return 'clean';
}

/* 무드별 토큰 — 브랜드 색은 accent(강조)로 들어간다 */
function tokens(s, mood) {
  const brand = hex2rgb(s.theme.color);
  const brandHex = s.theme.color;
  if (mood === 'luxe') {
    const gold = s.theme.color && !/^#0A4DF5$/i.test(s.theme.color) ? brandHex : '#D4B06A';
    return { paper: '#0C1117', paper2: '#121923', card: '#161E29', line: '#263140', ink: '#F4EFE6', ink2: '#C9C2B6', ink3: '#8E8A82', accent: gold, accentInk: luminance(hex2rgb(gold)) > 0.4 ? '#0C1117' : '#fff', soft: `rgba(${rgbStr(hex2rgb(gold))}, .14)`, btn: gold, btnInk: luminance(hex2rgb(gold)) > 0.4 ? '#0C1117' : '#fff', band: '#161E29', bandInk: '#F4EFE6', cta: gold, ctaInk: '#0C1117', dark: true, serifKo: true };
  }
  if (mood === 'warm') {
    const accent = s.theme.color && !/^#0A4DF5$/i.test(s.theme.color) ? brandHex : '#1F6F68';
    return { paper: '#FAF7F2', paper2: '#F2EDE4', card: '#FFFFFF', line: '#E4DDD1', ink: '#14202B', ink2: '#3A4652', ink3: '#6B7580', accent, accentInk: '#fff', soft: `rgba(${rgbStr(hex2rgb(accent))}, .10)`, gold: '#C9974F', btn: '#14202B', btnInk: '#fff', band: '#14202B', bandInk: '#fff', cta: accent, ctaInk: '#fff', dark: false, serifKo: true };
  }
  // clean
  return { paper: '#FFFFFF', paper2: '#F4F6F9', card: '#FFFFFF', line: '#E3E7EE', ink: '#0F172A', ink2: '#334155', ink3: '#64748B', accent: brandHex, accentInk: luminance(brand) > 0.5 ? '#0F172A' : '#fff', soft: `rgba(${rgbStr(brand)}, .09)`, btn: '#0F172A', btnInk: '#fff', band: '#0F172A', bandInk: '#fff', cta: brandHex, ctaInk: luminance(brand) > 0.5 ? '#0F172A' : '#fff', dark: false, serifKo: false };
}

/** 스펙 정규화 */
function normalize(spec) {
  const s = JSON.parse(JSON.stringify(spec || {}));
  s.slug = slugify(s.slug || s.name);
  s.lang = ['ko', 'en', 'ko-en'].includes(s.lang) ? s.lang : 'ko';
  s.address = s.address || {};
  const arr = (k, f) => { s[k] = Array.isArray(s[k]) ? s[k].filter(f) : []; };
  arr('hours', (h) => h && h.days); arr('services', (x) => x && x.name); arr('highlights', (x) => x && x.title);
  arr('gallery', (u) => /^https?:\/\//.test(u)); arr('faq', (x) => x && x.q && x.a); arr('steps', (x) => x && x.title);
  arr('stats', (x) => x && x.value && x.label); arr('review_themes', (x) => typeof x === 'string' && x.trim()); arr('brands', (x) => typeof x === 'string' && x.trim());
  s.hero = s.hero || {}; s.about = s.about || {}; s.social = s.social || {}; s.theme = s.theme || {}; s.seo = s.seo || {}; s.cta = s.cta || {}; s.promo = s.promo || {};
  s.theme.color = /^#[0-9a-f]{6}$/i.test(s.theme.color || '') ? s.theme.color : '#0A4DF5';
  return s;
}

/* 한/영 */
function pick(s, obj, key) {
  const ko = obj[key] || '', en = obj[key + '_en'] || '';
  if (s.lang === 'en') return { main: en || ko, alt: '' };
  return { main: ko || en, alt: s.lang === 'ko-en' ? en : '' };
}
function t(s, obj, key) { const { main, alt } = pick(s, obj, key); return alt ? `<span data-ko="${esc(main)}" data-en="${esc(alt)}">${esc(main)}</span>` : esc(main); }
/* 고정 문구(UI 라벨) — ko/en 쌍 */
function L(s, ko, en) { if (s.lang === 'en') return esc(en); return s.lang === 'ko-en' ? `<span data-ko="${esc(ko)}" data-en="${esc(en)}">${esc(ko)}</span>` : esc(ko); }

/* 헤드라인의 강조 단어(hero.em / hero.em_en)를 <em>으로 — 이탤릭 + 강조색 */
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

const CSS = (k) => `
:root{--paper:${k.paper};--paper2:${k.paper2};--card:${k.card};--line:${k.line};--ink:${k.ink};--ink2:${k.ink2};--ink3:${k.ink3};--accent:${k.accent};--accent-ink:${k.accentInk};--soft:${k.soft};--btn:${k.btn};--btn-ink:${k.btnInk};--band:${k.band};--band-ink:${k.bandInk};--cta:${k.cta};--cta-ink:${k.ctaInk};
--serif:'Fraunces',${k.serifKo ? "'Noto Serif KR'," : ''}Georgia,'Times New Roman',serif;--sans:'Inter',Pretendard,-apple-system,BlinkMacSystemFont,'Segoe UI','Apple SD Gothic Neo','Noto Sans KR',sans-serif;--radius:18px;--shadow:0 1px 2px rgba(20,32,43,.05),0 10px 30px rgba(20,32,43,${k.dark ? '.35' : '.08'})}
*{box-sizing:border-box}html{scroll-behavior:smooth;-webkit-text-size-adjust:100%}body{margin:0;font-family:var(--sans);color:var(--ink);background:var(--paper);line-height:1.65;font-size:16px}
img{max-width:100%;display:block}a{color:var(--accent)}h1,h2,h3{margin:0;line-height:1.15;letter-spacing:-.015em}
h1{font-family:var(--serif);font-weight:600;font-size:clamp(34px,7.2vw,58px);line-height:1.08}h2{font-family:var(--serif);font-weight:600;font-size:clamp(27px,3.6vw,40px);margin-bottom:14px}h3{font-size:17px;font-weight:700;letter-spacing:0}
p{margin:0 0 14px}.wrap{max-width:1120px;margin:0 auto;padding:0 20px}
.eyebrow{font-size:12.5px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--accent);margin-bottom:12px;display:block}
.lead{font-size:17.5px;color:var(--ink2);max-width:56ch}
.nav{position:sticky;top:0;z-index:30;background:${k.dark ? 'rgba(12,17,23,.86)' : 'rgba(255,255,255,.82)'};backdrop-filter:saturate(1.5) blur(10px);-webkit-backdrop-filter:saturate(1.5) blur(10px);border-bottom:1px solid var(--line)}
.nav .wrap{display:flex;align-items:center;gap:14px;height:64px}.brand{font-family:var(--serif);font-weight:600;font-size:20px;color:var(--ink);text-decoration:none;display:flex;align-items:center;gap:10px;letter-spacing:-.01em;white-space:nowrap;min-width:0}.brand span{overflow:hidden;text-overflow:ellipsis}.brand img{height:34px;width:auto}
.nav nav{display:none;gap:22px;margin-left:12px;font-size:14.5px}.nav nav a{color:var(--ink2);text-decoration:none;font-weight:500}.nav nav a:hover{color:var(--ink)}
.nav .right{margin-left:auto;display:flex;gap:8px;align-items:center}
.lang{border:1px solid var(--line);background:transparent;color:var(--ink2);border-radius:999px;padding:7px 11px;font-size:12.5px;font-weight:700;cursor:pointer;font-family:inherit}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:9px;min-height:50px;padding:0 24px;border-radius:999px;font-weight:600;font-size:16px;text-decoration:none;border:1.5px solid transparent;transition:transform .15s ease,background .15s ease,box-shadow .15s ease;white-space:nowrap;font-family:inherit;cursor:pointer}
.btn.primary{background:var(--btn);color:var(--btn-ink)}.btn.primary:hover{transform:translateY(-1px);box-shadow:0 8px 20px rgba(0,0,0,.14)}.btn.outline{background:transparent;color:var(--ink);border-color:var(--line)}.btn.outline:hover{border-color:var(--ink2)}
.btn.accent{background:var(--accent);color:var(--accent-ink)}.btn.sm{min-height:42px;padding:0 16px;font-size:14.5px}.btn.sm .num{display:none}.btn.sm .lbl{display:inline}
.hero{padding:56px 0 48px;background:radial-gradient(900px 420px at 88% 12%,var(--soft) 0%,rgba(0,0,0,0) 62%),var(--paper);overflow:hidden}
.hero .wrap{display:grid;gap:34px;grid-template-columns:1fr;align-items:center}
.hero .sub{display:block;font-size:13px;font-weight:600;color:var(--ink3);letter-spacing:.06em;text-transform:uppercase;margin-bottom:10px}
.hero h1 em{font-style:italic;color:var(--accent)}.hero .lead{margin:20px 0 26px}
.hero .cta{display:flex;gap:10px;flex-wrap:wrap}
.stats{list-style:none;display:flex;gap:16px;margin:32px 0 0;padding:22px 0 0;border-top:1px solid var(--line)}.stats li{flex:1;min-width:0}.stats b{display:block;font-family:var(--serif);font-size:clamp(24px,7vw,30px);white-space:nowrap;font-weight:600;line-height:1;letter-spacing:-.02em}.stats span{font-size:13px;color:var(--ink3)}
.photo{position:relative}.photo img{width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:28px;box-shadow:var(--shadow)}
.chip{position:absolute;background:var(--card);color:var(--ink);border:1px solid var(--line);border-radius:14px;padding:10px 14px;box-shadow:var(--shadow);font-size:13px;line-height:1.3;display:flex;gap:10px;align-items:center}.chip b{display:block;font-size:14px}.chip .st{color:#E0A020;letter-spacing:1px;font-size:12px}
.chip.a{right:-6px;top:18px}.chip.b{left:-6px;bottom:22px}
.band{background:var(--band);color:var(--band-ink);padding:40px 0;border-top:4px solid var(--accent)}.band .wrap{display:flex;gap:20px;align-items:center;flex-wrap:wrap}.band .eyebrow{color:var(--accent)}.band h2{font-size:clamp(22px,3vw,30px);margin:0 0 6px}.band p{margin:0;opacity:.85;max-width:60ch}.band .btn{margin-left:auto}
section{padding:72px 0}section.tint{background:var(--paper2)}.sec-h{max-width:720px;margin-bottom:30px}.sec-h.center{margin-left:auto;margin-right:auto;text-align:center}.sec-h p{color:var(--ink2);font-size:16.5px}
.grid{display:grid;gap:14px;grid-template-columns:1fr}
.card{background:var(--card);border:1px solid var(--line);border-radius:var(--radius);padding:24px 22px;box-shadow:var(--shadow);transition:transform .2s ease}.card:hover{transform:translateY(-2px)}
.card .ic{width:40px;height:40px;border-radius:12px;background:var(--soft);color:var(--accent);display:flex;align-items:center;justify-content:center;margin-bottom:14px;font-weight:800;font-family:var(--serif);font-size:18px}
.card h3{margin-bottom:6px}.card p{color:var(--ink2);font-size:15px;margin:0}.card .price{display:inline-block;margin-top:12px;font-weight:700;color:var(--accent);font-size:15px}.card img{border-radius:12px;aspect-ratio:4/3;object-fit:cover;margin-bottom:14px;width:100%}
.why{display:grid;gap:22px 28px;grid-template-columns:1fr}.why div{padding-top:16px;border-top:2px solid var(--accent)}.why b{display:block;font-size:17px;margin-bottom:6px}.why span{color:var(--ink2);font-size:15px}
.brands{display:flex;flex-wrap:wrap;gap:10px}.brands span{border:1px solid var(--line);background:var(--card);border-radius:999px;padding:8px 14px;font-size:14px;font-weight:500}
.steps{display:grid;gap:22px;grid-template-columns:1fr}.steps div{padding-top:16px;border-top:1px solid var(--line)}.steps i{display:block;font-style:normal;font-family:var(--serif);font-size:34px;color:var(--accent);line-height:1;margin-bottom:10px}.steps b{display:block;font-size:16px;margin-bottom:4px}.steps span{color:var(--ink2);font-size:15px}
.reviews{display:grid;gap:26px;grid-template-columns:1fr;align-items:center}.score{background:var(--card);border:1px solid var(--line);border-radius:var(--radius);padding:30px 26px;text-align:center;box-shadow:var(--shadow)}.score b{display:block;font-family:var(--serif);font-size:64px;line-height:1;font-weight:600}.score .st{color:#E0A020;font-size:22px;letter-spacing:2px;margin:8px 0}.score small{display:block;color:var(--ink3);margin-bottom:14px}
.themes{list-style:none;margin:0;padding:0}.themes li{padding:8px 0 8px 28px;position:relative;color:var(--ink2)}.themes li::before{content:"★";color:var(--accent);position:absolute;left:4px}
.about{display:grid;gap:28px;grid-template-columns:1fr;align-items:center}.about img{border-radius:24px;aspect-ratio:4/3;object-fit:cover;width:100%;box-shadow:var(--shadow)}.about p{font-size:16.5px;color:var(--ink2)}
.gallery{display:grid;gap:10px;grid-template-columns:repeat(2,1fr)}.gallery img{aspect-ratio:1;object-fit:cover;border-radius:16px;width:100%}.gallery img:first-child{grid-column:span 2;aspect-ratio:16/9}
.visit{display:grid;gap:28px;grid-template-columns:1fr}.hours{list-style:none;margin:0;padding:0}.hours li{display:flex;justify-content:space-between;gap:12px;padding:10px 0;border-bottom:1px solid var(--line);font-size:15px}.hours li:last-child{border:0}.hours b{font-weight:600}.hours .closed{color:var(--ink3)}
.addr{font-size:16px;line-height:1.7;margin-bottom:8px}.addr a{color:var(--ink);text-decoration:none;font-weight:600}
.mapcard{background:var(--paper2);border:1px solid var(--line);border-radius:24px;min-height:260px;display:flex;align-items:center;justify-content:center;text-align:center;padding:28px}
.faq{max-width:760px;margin:0 auto}.faq details{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:0 20px;margin-bottom:10px;box-shadow:var(--shadow)}.faq summary{cursor:pointer;list-style:none;font-weight:600;padding:16px 0;display:flex;justify-content:space-between;gap:12px;align-items:center}.faq summary::-webkit-details-marker{display:none}.faq summary::after{content:"+";color:var(--accent);font-size:22px;font-weight:300}.faq details[open] summary::after{content:"–"}.faq .a{padding:0 0 16px;color:var(--ink2);font-size:15.5px}
.ctab{background:var(--cta);color:var(--cta-ink);padding:52px 0}.ctab .wrap{display:flex;gap:18px;align-items:center;flex-wrap:wrap}.ctab h2{font-size:clamp(22px,3vw,30px);margin:0;max-width:30ch;color:inherit}.ctab .btns{margin-left:auto;display:flex;gap:10px;flex-wrap:wrap}.ctab .btn.primary{background:var(--cta-ink);color:var(--cta)}.ctab .btn.outline{color:inherit;border-color:rgba(255,255,255,.45)}
footer{background:var(--band);color:var(--band-ink);padding:52px 0 110px}footer .cols{display:grid;gap:28px;grid-template-columns:1fr}footer h4{margin:0 0 10px;font-size:12.5px;letter-spacing:.12em;text-transform:uppercase;opacity:.7}footer ul{list-style:none;margin:0;padding:0;font-size:14.5px;line-height:1.9}footer a{color:inherit;text-decoration:none;opacity:.9}footer .brand{color:inherit;margin-bottom:10px}footer .desc{opacity:.75;font-size:14.5px;max-width:40ch}footer .copy{margin-top:30px;padding-top:18px;border-top:1px solid rgba(255,255,255,.14);font-size:13px;opacity:.6}
.bottom{position:fixed;left:0;right:0;bottom:0;z-index:40;display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:10px 12px calc(10px + env(safe-area-inset-bottom));background:${k.dark ? 'rgba(12,17,23,.94)' : 'rgba(255,255,255,.95)'};border-top:1px solid var(--line);backdrop-filter:blur(8px)}.bottom .btn{min-height:46px}
.js .rv{opacity:0;transform:translateY(14px);transition:opacity .6s ease,transform .6s ease}.js .rv.on{opacity:1;transform:none}
@media(min-width:760px){.nav nav{display:flex}.stats{gap:28px}.stats li{flex:0 0 auto;min-width:96px}.btn.sm .num{display:inline}.btn.sm .lbl{display:none}.hero{padding:88px 0 80px}.hero .wrap{grid-template-columns:1.05fr .95fr;gap:56px}.grid{grid-template-columns:repeat(2,1fr)}.why{grid-template-columns:repeat(2,1fr)}.steps{grid-template-columns:repeat(2,1fr)}.reviews{grid-template-columns:300px 1fr}.about{grid-template-columns:1fr 1fr}.gallery{grid-template-columns:repeat(4,1fr)}.gallery img:first-child{grid-column:span 2;grid-row:span 2;aspect-ratio:auto;height:100%}.visit{grid-template-columns:1fr 1fr}footer .cols{grid-template-columns:1.4fr 1fr 1fr 1fr}footer{padding-bottom:52px}.bottom{display:none}section{padding:88px 0}}
@media(min-width:1024px){.grid{grid-template-columns:repeat(3,1fr)}.why{grid-template-columns:repeat(4,1fr)}.steps{grid-template-columns:repeat(4,1fr)}.grid.four{grid-template-columns:repeat(4,1fr)}}
@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}.js .rv{opacity:1;transform:none;transition:none}.card:hover,.btn.primary:hover{transform:none}}
`;

function page(s, { canonical, noindex }) {
  const mood = moodFor(s); const k = tokens(s, mood);
  const name = pick(s, s, 'name').main || s.name;
  const title = s.seo.title || `${name} — ${s.tagline || s.category || ''}`.replace(/ — $/, '');
  const desc = s.seo.description || s.tagline || '';
  const phone = s.phone || ''; const addr = addressLine(s.address); const maps = mapsHref(s);
  const toggle = s.lang === 'ko-en';
  const year = new Date().getFullYear();
  const btns = (cls) => `${phone ? `<a class="btn primary" href="${telHref(phone)}">📞 ${L(s, '전화하기', 'Call ' + phone)}</a>` : ''}${s.cta.booking_url ? `<a class="btn ${cls || 'outline'}" href="${esc(s.cta.booking_url)}" target="_blank" rel="noopener">${L(s, '온라인 예약', 'Book online')}</a>` : ''}${addr ? `<a class="btn ${cls || 'outline'}" href="${esc(maps)}" target="_blank" rel="noopener">📍 ${L(s, '길찾기', 'Get directions')}</a>` : ''}`;
  const stats = s.stats.length ? s.stats : [s.rating ? { value: `${s.rating}★`, label: 'Google', label_ko: '구글 평점' } : null, s.review_count ? { value: String(s.review_count), label: 'reviews', label_ko: '리뷰' } : null, s.since ? { value: `${Math.max(1, year - Number(s.since))}+`, label: 'years', label_ko: '년 운영' } : null].filter(Boolean);
  const navLinks = [s.services.length && ['#services', '서비스', 'Services'], s.about.text && ['#about', '소개', 'About'], s.faq.length && ['#faq', '자주 묻는 질문', 'FAQ'], (addr || s.hours.length) && ['#visit', '오시는 길', 'Visit']].filter(Boolean);
  return `<!doctype html>
<html lang="${s.lang === 'en' ? 'en' : 'ko'}" data-mood="${mood}">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
${noindex ? '<meta name="robots" content="noindex,nofollow">' : ''}
<link rel="canonical" href="${esc(canonical)}">
<meta property="og:type" content="business.business"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}">${s.hero.photo ? `<meta property="og:image" content="${esc(s.hero.photo)}">` : ''}<meta property="og:url" content="${esc(canonical)}">
<meta name="theme-color" content="${k.paper}">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Inter:wght@400;500;600;700${k.serifKo ? '&family=Noto+Serif+KR:wght@600' : ''}&display=swap">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">
${s.logo ? `<link rel="icon" href="${esc(s.logo)}">` : ''}
<script type="application/ld+json">${schema(s, canonical)}</script>
<style>${CSS(k)}</style>
</head>
<body>
<header class="nav"><div class="wrap">
  <a class="brand" href="#top">${s.logo ? `<img src="${esc(s.logo)}" alt="${esc(name)}">` : ''}<span>${esc(name)}</span></a>
  <nav>${navLinks.map(([h, ko, en]) => `<a href="${h}">${L(s, ko, en)}</a>`).join('')}</nav>
  <div class="right">${toggle ? '<button class="lang" id="lang" type="button" aria-label="Language">EN</button>' : ''}${phone ? `<a class="btn primary sm" href="${telHref(phone)}">📞 <span class="num">${esc(phone)}</span><span class="lbl">${L(s, '전화', 'Call')}</span></a>` : ''}</div>
</div></header>

<section class="hero" id="top"><div class="wrap">
  <div>
    ${s.category ? `<span class="eyebrow">${t(s, s, 'category')}${s.address.city ? ' · ' + esc(s.address.city) : ''}${s.since ? ` · ${L(s, '설립 ' + s.since, 'since ' + s.since)}` : ''}</span>` : ''}
    <h1>${s.hero.headline ? emph(s) : esc(name)}</h1>
    ${s.hero.sub || s.tagline ? `<p class="lead">${s.hero.sub ? t(s, s.hero, 'sub') : t(s, s, 'tagline')}</p>` : ''}
    <div class="cta">${btns()}</div>
    ${stats.length ? `<ul class="stats">${stats.slice(0, 4).map((x) => `<li><b>${esc(x.value)}</b><span>${s.lang === 'en' ? esc(x.label) : toggle ? `<span data-ko="${esc(x.label_ko || x.label)}" data-en="${esc(x.label)}">${esc(x.label_ko || x.label)}</span>` : esc(x.label_ko || x.label)}</span></li>`).join('')}</ul>` : ''}
  </div>
  ${s.hero.photo ? `<div class="photo rv"><img src="${esc(s.hero.photo)}" alt="${esc(name)}" fetchpriority="high">${s.rating ? `<div class="chip a"><span class="st">${stars(s.rating)}</span><span><b>${esc(s.rating)} ${L(s, '구글 평점', 'on Google')}</b>${s.review_count ? `${esc(s.review_count)} ${L(s, '리뷰', 'reviews')}` : ''}</span></div>` : ''}${s.hero.badge ? `<div class="chip b"><span><b>${t(s, s.hero, 'badge')}</b>${s.hero.badge_sub ? t(s, s.hero, 'badge_sub') : ''}</span></div>` : ''}</div>` : ''}
</div></section>

${s.promo.title ? `<div class="band"><div class="wrap"><div><span class="eyebrow">${L(s, '지금', 'Our specialty')}</span><h2>${t(s, s.promo, 'title')}</h2>${s.promo.text ? `<p>${t(s, s.promo, 'text')}</p>` : ''}</div>${s.promo.href ? `<a class="btn accent" href="${esc(s.promo.href)}">${s.promo.cta ? t(s, s.promo, 'cta') : L(s, '자세히', 'Learn more')} →</a>` : ''}</div></div>` : ''}

${s.services.length ? `<section id="services"><div class="wrap"><div class="sec-h center rv"><span class="eyebrow">${L(s, '서비스', 'What we do')}</span><h2>${s.services_title ? t(s, s, 'services_title') : L(s, '한 곳에서 해결하는 서비스', 'Everything you need, under one roof')}</h2>${s.services_intro ? `<p>${t(s, s, 'services_intro')}</p>` : ''}</div>
<div class="grid${s.services.length >= 7 ? ' four' : ''}">${s.services.slice(0, 12).map((x, i) => `<div class="card rv">${x.photo ? `<img src="${esc(x.photo)}" alt="${esc(x.name)}" loading="lazy">` : `<div class="ic">${String(i + 1).padStart(2, '0')}</div>`}<h3>${t(s, x, 'name')}</h3>${x.desc ? `<p>${t(s, x, 'desc')}</p>` : ''}${x.price ? `<span class="price">${esc(x.price)}</span>` : ''}</div>`).join('')}</div></div></section>` : ''}

${s.highlights.length ? `<section class="tint"><div class="wrap"><div class="sec-h center rv"><span class="eyebrow">${L(s, '왜 ' + name, 'Why ' + name)}</span><h2>${s.highlights_title ? t(s, s, 'highlights_title') : L(s, '손님이 다시 찾는 이유', 'Why neighbors keep coming back')}</h2></div>
<div class="why">${s.highlights.slice(0, 4).map((h) => `<div class="rv"><b>${t(s, h, 'title')}</b><span>${t(s, h, 'text')}</span></div>`).join('')}</div></div></section>` : ''}

${s.brands.length ? `<section><div class="wrap"><div class="sec-h rv"><span class="eyebrow">${L(s, '취급 브랜드', 'Brands we carry')}</span><h2>${s.brands_title ? t(s, s, 'brands_title') : L(s, '믿을 수 있는 브랜드만', 'Trusted names only')}</h2></div><div class="brands rv">${s.brands.slice(0, 24).map((b) => `<span>${esc(b)}</span>`).join('')}</div></div></section>` : ''}

${s.gallery.length >= 3 ? `<section class="tint"><div class="wrap"><div class="sec-h rv"><span class="eyebrow">${L(s, '매장', 'Gallery')}</span><h2>${L(s, '직접 보시면 압니다', 'Come see for yourself')}</h2></div><div class="gallery rv">${s.gallery.slice(0, 7).map((u) => `<img src="${esc(u)}" alt="" loading="lazy">`).join('')}</div></div></section>` : ''}

${s.steps.length ? `<section><div class="wrap"><div class="sec-h center rv"><span class="eyebrow">${L(s, '이용 방법', 'How it works')}</span><h2>${s.steps_title ? t(s, s, 'steps_title') : L(s, '네 단계면 끝납니다', 'Four easy steps')}</h2></div><div class="steps">${s.steps.slice(0, 4).map((x, i) => `<div class="rv"><i>${i + 1}</i><b>${t(s, x, 'title')}</b>${x.text ? `<span>${t(s, x, 'text')}</span>` : ''}</div>`).join('')}</div></div></section>` : ''}

${s.rating ? `<section class="tint"><div class="wrap"><div class="reviews"><div class="score rv"><b>${esc(s.rating)}</b><div class="st">${stars(s.rating)}</div><small>${s.review_count ? `${esc(s.review_count)} ${L(s, '구글 리뷰', 'reviews on Google')}` : 'Google'}</small><a class="btn outline sm" href="${esc(s.review_url || maps)}" target="_blank" rel="noopener">${L(s, '구글에서 리뷰 보기', 'Read reviews on Google')}</a></div><div class="rv"><span class="eyebrow">${L(s, '손님 이야기', 'What customers mention most')}</span><h2>${s.reviews_title ? t(s, s, 'reviews_title') : L(s, '한 번 오신 분이 다시 오십니다', 'People come back — and bring friends')}</h2>${s.review_themes.length ? `<ul class="themes">${s.review_themes.slice(0, 5).map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}</div></div></div></section>` : ''}

${s.about.text ? `<section id="about"><div class="wrap"><div class="about">${s.about.photo ? `<img class="rv" src="${esc(s.about.photo)}" alt="${esc(name)}" loading="lazy">` : ''}<div class="rv"><span class="eyebrow">${L(s, '소개', 'About')}</span><h2>${s.about.title ? t(s, s.about, 'title') : esc(name)}</h2><p>${t(s, s.about, 'text').replace(/\n/g, '<br>')}</p></div></div></div></section>` : ''}

${addr || s.hours.length ? `<section class="tint" id="visit"><div class="wrap"><div class="visit"><div class="rv"><span class="eyebrow">${L(s, '오시는 길', 'Visit us')}</span><h2>${s.visit_title ? t(s, s, 'visit_title') : L(s, (s.address.city || '') + '에서 뵙겠습니다', 'Find us in ' + (s.address.city || 'town'))}</h2>${addr ? `<p class="addr">📍 <a href="${esc(maps)}" target="_blank" rel="noopener">${esc(addr)}</a></p>` : ''}${phone ? `<p class="addr">📞 <a href="${telHref(phone)}">${esc(phone)}</a></p>` : ''}${s.email ? `<p class="addr">✉️ <a href="mailto:${esc(s.email)}">${esc(s.email)}</a></p>` : ''}${s.hours.length ? `<ul class="hours">${s.hours.map((h) => { const tm = h.time || (h.open && h.close ? h.open + ' – ' + h.close : ''); const closed = /휴무|closed/i.test(tm); return `<li><b>${esc(h.days)}</b><span class="${closed ? 'closed' : ''}">${esc(tm)}</span></li>`; }).join('')}</ul>` : ''}${s.hours_note ? `<p style="color:var(--ink3);font-size:14px;margin-top:10px">${t(s, s, 'hours_note')}</p>` : ''}<div class="cta" style="display:flex;gap:10px;flex-wrap:wrap;margin-top:18px">${btns()}</div></div><div class="mapcard rv">${s.map_embed ? `<iframe src="${esc(s.map_embed)}" style="width:100%;height:100%;min-height:260px;border:0;border-radius:20px" loading="lazy" title="map"></iframe>` : `<div><p style="font-weight:600">${esc(addr || name)}</p><a class="btn primary" href="${esc(maps)}" target="_blank" rel="noopener">${L(s, '구글 지도에서 열기', 'Open in Google Maps')}</a></div>`}</div></div></div></section>` : ''}

${s.faq.length ? `<section id="faq"><div class="wrap"><div class="sec-h center rv"><span class="eyebrow">FAQ</span><h2>${L(s, '자주 묻는 질문', 'Frequently asked questions')}</h2></div><div class="faq">${s.faq.slice(0, 10).map((f) => `<details class="rv"><summary>${t(s, f, 'q')}</summary><div class="a">${t(s, f, 'a')}</div></details>`).join('')}</div></div></section>` : ''}

${phone || addr ? `<div class="ctab"><div class="wrap"><h2>${s.closing ? t(s, s, 'closing') : L(s, '궁금한 점은 전화 한 통이면 됩니다.', 'Questions? One call and we will take it from there.')}</h2><div class="btns">${btns('outline')}</div></div></div>` : ''}

<footer><div class="wrap"><div class="cols">
  <div><a class="brand" href="#top">${esc(name)}</a><p class="desc">${t(s, s, 'tagline') || ''}</p>${addr ? `<p class="desc">${esc(addr)}</p>` : ''}${phone ? `<p class="desc"><a href="${telHref(phone)}">${esc(phone)}</a></p>` : ''}</div>
  ${s.hours.length ? `<div><h4>${L(s, '영업시간', 'Hours')}</h4><ul>${s.hours.map((h) => `<li>${esc(h.days)} · ${esc(h.time || (h.open && h.close ? h.open + '–' + h.close : ''))}</li>`).join('')}</ul></div>` : ''}
  ${s.services.length ? `<div><h4>${L(s, '서비스', 'Services')}</h4><ul>${s.services.slice(0, 8).map((x) => `<li><a href="#services">${t(s, x, 'name')}</a></li>`).join('')}</ul></div>` : ''}
  <div><h4>${L(s, '바로가기', 'Links')}</h4><ul>${navLinks.map(([h, ko, en]) => `<li><a href="${h}">${L(s, ko, en)}</a></li>`).join('')}${Object.entries(s.social).filter(([, v]) => v).map(([kk, v]) => `<li><a href="${esc(v)}" target="_blank" rel="noopener">${esc(kk[0].toUpperCase() + kk.slice(1))}</a></li>`).join('')}</ul></div>
</div><div class="copy">© ${year} ${esc(name)}. All rights reserved.</div></div></footer>
${phone || addr ? `<div class="bottom">${phone ? `<a class="btn primary" href="${telHref(phone)}">📞 ${L(s, '전화', 'Call')}</a>` : ''}${addr ? `<a class="btn outline" href="${esc(maps)}" target="_blank" rel="noopener" style="background:var(--card)">📍 ${L(s, '길찾기', 'Directions')}</a>` : ''}</div>` : ''}
<script>(function(){
  /* 스크롤 연출 — JS 가 켜진 뒤에만 숨김 클래스를 붙인다(콘텐츠 기본 표시). 3초 뒤 강제 표시 폴백 */
  var d=document.documentElement;
  if('IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches){d.classList.add('js');var els=[].slice.call(document.querySelectorAll('.rv'));var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('on');io.unobserve(e.target);}});},{rootMargin:'0px 0px -8% 0px'});els.forEach(function(el){io.observe(el);});setTimeout(function(){els.forEach(function(el){el.classList.add('on');});},3000);}
  var b=document.getElementById('lang');if(!b)return;var en=false;try{en=localStorage.getItem('lang')==='en'}catch(e){}
  function apply(){document.querySelectorAll('[data-en]').forEach(function(el){el.innerHTML=en?el.getAttribute('data-en'):el.getAttribute('data-ko')});b.textContent=en?'한국어':'EN';d.lang=en?'en':'ko'}
  b.addEventListener('click',function(){en=!en;try{localStorage.setItem('lang',en?'en':'ko')}catch(e){}apply()});if(en)apply();
})();</script>
</body></html>`;
}

function render(spec, { origin, noindex }) {
  const s = normalize(spec);
  const canonical = (origin || `https://${s.slug}.sites.bizhigher.com`).replace(/\/$/, '') + '/';
  return {
    slug: s.slug,
    files: {
      'index.html': page(s, { canonical, noindex: !!noindex }),
      'robots.txt': noindex ? 'User-agent: *\nDisallow: /\n' : `User-agent: *\nAllow: /\nSitemap: ${canonical}sitemap.xml\n`,
      'sitemap.xml': `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${esc(canonical)}</loc></url></urlset>\n`,
    },
  };
}

module.exports = { render, normalize, slugify, moodFor };
