/**
 * New Optix — 정적 사이트 빌더
 * 사용: node build.js  →  dist/
 *
 * 사실 정보는 site.json, 서비스 문구는 services.json.
 * 두 파일만 고치고 다시 빌드하면 모든 페이지·스키마·사이트맵이 함께 바뀐다.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = __dirname;
const DIST = path.join(ROOT, 'dist');
const S = JSON.parse(fs.readFileSync(path.join(ROOT, 'site.json'), 'utf8'));
const SERVICES = JSON.parse(fs.readFileSync(path.join(ROOT, 'services.json'), 'utf8'));

const CSS = fs.readFileSync(path.join(ROOT, 'src', 'style.css'), 'utf8');
const CSS_VER = crypto.createHash('md5').update(CSS).digest('hex').slice(0, 8);

/* ---------- 헬퍼 ---------- */

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const A = S.address;
const addrLine1 = `${A.street} ${A.suite}`;
const addrLine2 = `${A.city}, ${A.region} ${A.zip}`;
const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(S.mapsQuery)}`;
const dirUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(S.mapsQuery)}`;
const embedUrl = `https://maps.google.com/maps?q=${encodeURIComponent(S.mapsQuery)}&z=16&output=embed`;
const years = `${S.yearsServing}+`;
// features 그룹(아동 근시 관리 등)은 브랜드가 아니므로 브랜드 목록·스키마에서 제외
const allBrands = S.brands.filter((g) => !g.features).flatMap((g) => g.items);

function fmtTime(t) {
  const [h, m] = t.split(':').map(Number);
  const hh = ((h + 11) % 12) + 1;
  return `${hh}${m ? ':' + String(m).padStart(2, '0') : ''} ${h < 12 ? 'AM' : 'PM'}`;
}
function fmtTimeKo(t) {
  const [h, m] = t.split(':').map(Number);
  const hh = ((h + 11) % 12) + 1;
  return `${h < 12 ? '오전' : '오후'} ${hh}시${m ? ' ' + m + '분' : ''}`;
}
const DAY_KO = { Monday: '월', Tuesday: '화', Wednesday: '수', Thursday: '목', Friday: '금', Saturday: '토', Sunday: '일' };
const DAY_SCHEMA = (d) => `https://schema.org/${d}`;

function hoursTable(lang = 'en') {
  const rows = S.hours.map((h, i) => {
    const day = lang === 'ko' ? DAY_KO[h.day] + '요일' : h.day;
    const val = h.open
      ? (lang === 'ko' ? `${fmtTimeKo(h.open)} – ${fmtTimeKo(h.close)}` : `${fmtTime(h.open)} – ${fmtTime(h.close)}`)
      : (lang === 'ko' ? '휴무' : 'Closed');
    // JS 인덱스(0=일요일)와 맞추기 위한 data-dow
    const dow = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].indexOf(h.day);
    return `<tr data-dow="${dow}"${h.open ? '' : ' class="closed"'}><th scope="row">${day}</th><td>${val}</td></tr>`;
  }).join('');
  return `<table class="hours">${rows}</table>`;
}

function earlyCloseNote(lang = 'en') {
  const early = S.hours.filter((h) => h.open && h.close < '18:00');
  if (!early.length) return '';
  if (lang === 'ko') return `<p class="hours-note">⚠️ ${early.map((h) => DAY_KO[h.day]).join('·')}요일은 ${fmtTimeKo(early[0].close)}에 일찍 닫습니다.</p>`;
  return `<p class="hours-note">Heads up: we close early (${fmtTime(early[0].close)}) on ${early.map((h) => h.day + 's').join(' and ')}.</p>`;
}

/* ---------- 아이콘 (라인 SVG) ---------- */

const ICON = {
  progressive: '<path d="M4 12h16M4 8h16M4 16h16" opacity=".35"/><rect x="3" y="5" width="18" height="14" rx="7"/><path d="M8 19c1-3 2-5 4-7s3-4 4-7"/>',
  lens: '<circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 1 0 16" fill="currentColor" opacity=".15" stroke="none"/><path d="M4 12h16"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  contact: '<path d="M3 13c2.5-5 15.5-5 18 0"/><path d="M5 13c2 4 12 4 14 0"/><circle cx="12" cy="12.5" r="2.5"/>',
  kids: '<circle cx="12" cy="7" r="3"/><path d="M6 21v-2a6 6 0 0 1 12 0v2"/><path d="M8.5 7h7" />',
  sport: '<path d="M3 10c0-2 2-3 4-3h10c2 0 4 1 4 3v2c0 3-2 5-5 5-2 0-3-2-4-2s-2 2-4 2c-3 0-5-2-5-5z"/><path d="M3 11H1M23 11h-2"/>',
  tools: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.5-.5-.5-2.5z"/>',
  frame: '<circle cx="7" cy="13" r="4"/><circle cx="17" cy="13" r="4"/><path d="M11 13c.7-.8 1.3-.8 2 0M3 13 2 9M21 13l1-4"/>',
  phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/>',
  pin: '<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  lab: '<path d="M4 20h16M6 20V9h12v11M9 9V5h6v4"/><circle cx="12" cy="14.5" r="2.5"/>',
  shield: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/><path d="m9 12 2 2 4-4"/>',
  rx: '<path d="M6 3h12v18H6z"/><path d="M9 8h6M9 12h6M9 16h3"/>',
  star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z"/>',
  ruler: '<path d="M3 17 17 3l4 4L7 21z"/><path d="m7 13 2 2M10 10l2 2M13 7l2 2"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
};
const icon = (k, cls = 'ico') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[k] || ''}</svg>`;

const LOGO_MARK = `<svg class="logo-mark" viewBox="0 0 48 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2.4"/><circle cx="36" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M21 11c2-2 4-2 6 0" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><circle cx="36" cy="12" r="4.5" fill="var(--accent)"/></svg>`;

/* ---------- 구조화 데이터 ---------- */

const BIZ_ID = `${S.domain}/#business`;
function bizSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': ['Optician', 'Store'],
    '@id': BIZ_ID,
    name: S.name,
    description: `Optical shop in ${A.city}, ${A.region} offering eyeglasses, progressive lenses, prescription sunglasses, contact lenses, kids' glasses and myopia control, sports goggles and lens replacement, with an in-store lens lab.`,
    url: S.domain + '/',
    telephone: S.phoneHref,
    ...(S.email ? { email: S.email } : {}),
    image: `${S.domain}/og-image.png`,
    priceRange: '$$',
    address: {
      '@type': 'PostalAddress',
      streetAddress: addrLine1,
      addressLocality: A.city,
      addressRegion: A.region,
      postalCode: A.zip,
      addressCountry: A.country,
    },
    hasMap: mapsUrl,
    areaServed: S.serviceArea.map((c) => ({ '@type': 'City', name: `${c}, CA` })),
    knowsLanguage: S.languages,
    paymentAccepted: S.payments.join(', '),
    brand: allBrands.map((b) => ({ '@type': 'Brand', name: b })),
    openingHoursSpecification: S.hours.filter((h) => h.open).map((h) => ({
      '@type': 'OpeningHoursSpecification', dayOfWeek: DAY_SCHEMA(h.day), opens: h.open, closes: h.close,
    })),
    makesOffer: SERVICES.map((s) => ({
      '@type': 'Offer', itemOffered: { '@type': 'Service', name: s.title, url: `${S.domain}/services/${s.slug}/` },
    })),
  };
}
const faqSchema = (faqs) => ({
  '@context': 'https://schema.org', '@type': 'FAQPage',
  mainEntity: faqs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
});
const crumbSchema = (items) => ({
  '@context': 'https://schema.org', '@type': 'BreadcrumbList',
  itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it[0], item: S.domain + it[1] })),
});
const ld = (obj) => `<script type="application/ld+json">${JSON.stringify(obj)}</script>`;

/* ---------- 레이아웃 ---------- */

const NAV = [
  ['Services', '/services/'],
  ['Brands', '/brands/'],
  ['Insurance', '/insurance/'],
  ['About', '/about/'],
  ['Visit', '/contact/'],
];

function header(active, lang) {
  const links = NAV.map(([t, h]) => `<a href="${h}"${active === h ? ' aria-current="page"' : ''}>${t}</a>`).join('');
  return `
${S.draft ? '<div class="draft-bar">Draft preview — some details are still being confirmed.</div>' : ''}
<header class="site-header">
  <div class="wrap header-inner">
    <a class="logo" href="/" aria-label="${esc(S.name)} home">${LOGO_MARK}<span>New&nbsp;Optix</span></a>
    <nav class="main-nav" aria-label="Main">${links}<a href="/ko/" lang="ko"${lang === 'ko' ? ' aria-current="page"' : ''}>한국어</a></nav>
    <a class="btn btn-sm btn-dark header-call" href="tel:${S.phoneHref}">${icon('phone')}<span>${S.phone}</span></a>
  </div>
</header>`;
}

function footer(lang) {
  const ko = lang === 'ko';
  return `
<footer class="site-footer">
  <div class="wrap footer-grid">
    <div>
      <a class="logo logo-light" href="/">${LOGO_MARK}<span>New&nbsp;Optix</span></a>
      <p class="foot-tag">${ko ? '가든그로브 안경점 — 안경·선글라스·콘택트렌즈' : esc(S.tagline)}</p>
      <address>
        ${esc(addrLine1)}<br>${esc(addrLine2)}<br>
        <a href="tel:${S.phoneHref}">${S.phone}</a>
      </address>
    </div>
    <div>
      <h3>${ko ? '영업시간' : 'Hours'}</h3>
      ${hoursTable(lang)}
    </div>
    <div>
      <h3>${ko ? '서비스' : 'Services'}</h3>
      <ul class="foot-links">${SERVICES.map((s) => `<li><a href="/services/${s.slug}/">${esc(s.title)}</a></li>`).join('')}</ul>
    </div>
    <div>
      <h3>${ko ? '안내' : 'Shop'}</h3>
      <ul class="foot-links">
        <li><a href="/brands/">Brands</a></li>
        <li><a href="/insurance/">Insurance &amp; payment</a></li>
        <li><a href="/about/">About us</a></li>
        <li><a href="/contact/">Directions &amp; hours</a></li>
        <li><a href="/ko/" lang="ko">한국어 안내</a></li>
      </ul>
    </div>
  </div>
  <div class="wrap foot-legal">
    <p>${esc(S.neighbor.disclosure)}</p>
    <p>© ${new Date().getFullYear()} ${esc(S.name)}. All rights reserved.</p>
  </div>
</footer>
<div class="mobile-bar">
  <a href="tel:${S.phoneHref}">${icon('phone')}${ko ? '전화하기' : 'Call'}</a>
  <a href="${dirUrl}" target="_blank" rel="noopener">${icon('pin')}${ko ? '길찾기' : 'Directions'}</a>
</div>
<script>
/* 오늘 요일 영업시간 강조 — 실패해도 표는 그대로 보인다 */
try {
  var d = new Date().getDay();
  document.querySelectorAll('.hours tr[data-dow="' + d + '"]').forEach(function (tr) { tr.classList.add('today'); });
} catch (e) {}
</script>`;
}

function page({ pathName, title, description, body, schemas = [], lang = 'en', active = '' }) {
  const canonical = S.domain + pathName;
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${canonical}">
${S.draft ? '<meta name="robots" content="noindex, nofollow">' : ''}
<link rel="alternate" hreflang="en" href="${S.domain}/">
<link rel="alternate" hreflang="ko" href="${S.domain}/ko/">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${canonical}">
<meta property="og:image" content="${S.domain}/og-image.png">
<meta name="theme-color" content="#14202b">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Inter:wght@400;500;600;700&family=Noto+Sans+KR:wght@400;500;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/style.css?v=${CSS_VER}">
${schemas.map(ld).join('\n')}
</head>
<body${lang === 'ko' ? ' class="ko"' : ''}>
<a class="skip" href="#main">Skip to content</a>
${header(active, lang)}
<main id="main">
${body}
</main>
${footer(lang)}
</body>
</html>`;
}

/* ---------- 공통 섹션 ---------- */

function neighborSection() {
  const n = S.neighbor;
  const link = n.url ? `<a class="text-link" href="${esc(n.url)}" rel="noopener">Visit ${esc(n.name)}'s website ${icon('arrow', 'ico-inline')}</a>` : '';
  return `
<section class="section neighbor">
  <div class="wrap neighbor-inner">
    <div class="neighbor-mark">${icon('rx', 'ico-lg')}</div>
    <div>
      <p class="eyebrow">Need an eye exam first?</p>
      <h2 class="h2">An independent optometrist practices right next door.</h2>
      <p>New Optix is an optical shop — we don't perform eye exams. If you need a new prescription, ${esc(n.name)} is located in the same building, so you can have your eyes examined and then choose your glasses without driving across town. Prescriptions from any eye doctor are always welcome here.</p>
      ${link}
      <p class="fine">${esc(n.disclosure)}</p>
    </div>
  </div>
</section>`;
}

function visitSection(lang = 'en') {
  const ko = lang === 'ko';
  return `
<section class="section visit" id="visit">
  <div class="wrap visit-grid">
    <div class="visit-info">
      <p class="eyebrow">${ko ? '오시는 길' : 'Visit us'}</p>
      <h2 class="h2">${ko ? '가든그로브 블러바드에 있습니다' : 'Find us on Garden Grove Blvd'}</h2>
      <ul class="facts">
        <li>${icon('pin')}<span>${esc(addrLine1)}<br>${esc(addrLine2)}</span></li>
        <li>${icon('phone')}<a href="tel:${S.phoneHref}">${S.phone}</a></li>
      </ul>
      ${hoursTable(lang)}
      ${earlyCloseNote(lang)}
      <div class="btn-row">
        <a class="btn btn-accent" href="${dirUrl}" target="_blank" rel="noopener">${icon('pin')}${ko ? '길찾기' : 'Get directions'}</a>
        <a class="btn btn-outline" href="tel:${S.phoneHref}">${icon('phone')}${ko ? '전화하기' : 'Call the shop'}</a>
      </div>
    </div>
    <div class="map-frame">
      <iframe title="Map to ${esc(S.name)}" src="${embedUrl}" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>
    </div>
  </div>
</section>`;
}

function faqBlock(faqs, heading = 'Frequently asked questions') {
  return `
<section class="section faq">
  <div class="wrap narrow">
    <h2 class="h2 center">${heading}</h2>
    <div class="faq-list">
      ${faqs.map((f) => `<details><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join('')}
    </div>
  </div>
</section>`;
}

function ctaBand(text = 'Bring your prescription — or your favorite frame — and we’ll take it from there.') {
  return `
<section class="cta-band">
  <div class="wrap cta-inner">
    <p>${text}</p>
    <div class="btn-row">
      <a class="btn btn-accent" href="tel:${S.phoneHref}">${icon('phone')}Call ${S.phone}</a>
      <a class="btn btn-ghost" href="${dirUrl}" target="_blank" rel="noopener">${icon('pin')}Directions</a>
    </div>
  </div>
</section>`;
}

const crumbs = (items) => `<nav class="crumbs wrap" aria-label="Breadcrumb">${items.map(([t, h], i) => i === items.length - 1 ? `<span aria-current="page">${esc(t)}</span>` : `<a href="${h}">${esc(t)}</a>`).join('<span class="sep">/</span>')}</nav>`;

/* ---------- 히어로 일러스트 ---------- */

const HERO_ART = `
<div class="hero-art" aria-hidden="true">
  <div class="art-disc"></div>
  <svg class="art-glasses" viewBox="0 0 400 180">
    <defs>
      <linearGradient id="lensG" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#ffffff" stop-opacity=".85"/>
        <stop offset=".55" stop-color="#dcebe8" stop-opacity=".55"/>
        <stop offset="1" stop-color="#b9d6d1" stop-opacity=".7"/>
      </linearGradient>
    </defs>
    <path d="M20 70 Q8 66 4 52" fill="none" stroke="#14202b" stroke-width="6" stroke-linecap="round"/>
    <path d="M380 70 Q392 66 396 52" fill="none" stroke="#14202b" stroke-width="6" stroke-linecap="round"/>
    <rect x="20" y="40" width="150" height="112" rx="52" fill="url(#lensG)" stroke="#14202b" stroke-width="7"/>
    <rect x="230" y="40" width="150" height="112" rx="52" fill="url(#lensG)" stroke="#14202b" stroke-width="7"/>
    <path d="M170 78 Q200 58 230 78" fill="none" stroke="#14202b" stroke-width="7" stroke-linecap="round"/>
    <path d="M52 66 Q70 54 96 54" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" opacity=".9"/>
    <path d="M262 66 Q280 54 306 54" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" opacity=".9"/>
  </svg>
  <div class="chip chip-a">${icon('lab')}<span><b>In-store lab</b>Ready in ~3 days</span></div>
  <div class="chip chip-b">${icon('star')}<span><b>${S.rating} on Google</b>Friendly, honest service</span></div>
  <div class="chip chip-c">${icon('shield')}<span><b>Vision plans</b>We handle the paperwork</span></div>
</div>`;

/* ---------- 한국 트렌드 안경테 메시지 ---------- */

function promoPill(lang = 'en') {
  return `<p class="promo-pill"><span class="dot"></span>${lang === 'ko' ? '한국 트렌드 안경테 · 착한 가격' : 'Trendy Korean frames · Unbeatable prices'}</p>`;
}

function promoBand(lang = 'en') {
  const ko = lang === 'ko';
  return `
<section class="promo-band">
  <div class="wrap promo-inner">
    <div>
      <p class="promo-kicker">${ko ? 'NEW OPTIX 추천' : 'Our specialty'}</p>
      <h2 class="promo-title">${esc(ko ? S.promo.koHeadline : S.promo.headline)}</h2>
      <p class="promo-sub">${esc(ko ? S.promo.koSub : S.promo.sub)}</p>
    </div>
    <a class="btn btn-accent" href="${ko ? dirUrl : '/brands/'}"${ko ? ' target="_blank" rel="noopener"' : ''}>${ko ? icon('pin') + '매장에서 써 보기' : 'See our frames ' + icon('arrow', 'ico-inline')}</a>
  </div>
</section>`;
}

/* ---------- 페이지: 홈 ---------- */

const HOME_FAQS = [
  { q: 'Do you do eye exams?', a: `No — New Optix is an optical shop. We make and fit glasses and supply contact lenses. An independent optometrist practices next door, and we also fill prescriptions from any eye doctor.` },
  { q: 'Can I use a prescription from another eye doctor?', a: 'Yes. Bring a current prescription from any optometrist or ophthalmologist. If you only have your old glasses, we can read the lenses to help you pick a frame, but a new pair should be made from a current prescription.' },
  { q: 'How long does it take to get new glasses?', a: S.turnaroundNote },
  { q: 'Do you take my vision insurance?', a: `${S.insuranceHeadline}. Call with your plan name and member ID and we’ll check your benefits before you come in.` },
  { q: 'Can you put new lenses in my current frame?', a: 'Yes, even if the frame was bought somewhere else, as long as it is in good condition. We inspect every frame first and tell you about any risk.' },
  { q: 'Do I need an appointment?', a: 'Walk-ins are welcome for frame shopping and adjustments. If you want unhurried help choosing progressives or a large order, calling ahead helps us set aside time.' },
  { q: 'Do you speak Korean?', a: `Yes. We can help you in ${S.languages.join(' and ')}.` },
];

function homePage() {
  const cards = SERVICES.map((s) => `
    <a class="svc-card" href="/services/${s.slug}/">
      ${icon(s.icon, 'ico-lg')}
      <h3>${esc(s.title)}</h3>
      <p>${esc(s.short)}</p>
      <span class="more">Learn more ${icon('arrow', 'ico-inline')}</span>
    </a>`).join('');

  const body = `
<section class="hero">
  <div class="wrap hero-grid">
    <div class="hero-copy">
      ${promoPill()}
      <p class="eyebrow">Garden Grove optical shop · ${years} years</p>
      <h1 class="h1">Glasses that fit your face, your prescription <em>and</em> your budget.</h1>
      <p class="lead">From lightweight titanium to Lindberg and Gucci, fitted by opticians who take the time to get it right — and made in our own lab, usually in about 3 days.</p>
      <div class="btn-row">
        <a class="btn btn-dark" href="tel:${S.phoneHref}">${icon('phone')}Call ${S.phone}</a>
        <a class="btn btn-outline" href="${dirUrl}" target="_blank" rel="noopener">${icon('pin')}Get directions</a>
      </div>
      <ul class="trust">
        <li><b>${S.rating}★</b><span>Google rating</span></li>
        <li><b>${years}</b><span>years in Garden Grove</span></li>
        <li><b>~3 days</b><span>typical turnaround</span></li>
      </ul>
    </div>
    ${HERO_ART}
  </div>
</section>
${promoBand()}

<section class="section">
  <div class="wrap">
    <p class="eyebrow center">What we do</p>
    <h2 class="h2 center">Everything for your glasses, under one roof</h2>
    <div class="svc-grid">${cards}</div>
  </div>
</section>

<section class="section tint">
  <div class="wrap">
    <p class="eyebrow center">Why New Optix</p>
    <h2 class="h2 center">Why neighbors keep coming back</h2>
    <div class="why-grid">
      <div class="why">${icon('lab', 'ico-lg')}<h3>Made in our own lab</h3><p>Most lenses are cut and fitted in the shop, so many glasses are ready in about 3 business days instead of weeks.</p></div>
      <div class="why">${icon('ruler', 'ico-lg')}<h3>Fitted, not just sold</h3><p>We measure you in the frame you pick and adjust it on your face. Adjustments afterward are free.</p></div>
      <div class="why">${icon('shield', 'ico-lg')}<h3>Insurance made simple</h3><p>We check your benefits and handle the claim. You'll know what's covered before you choose.</p></div>
      <div class="why">${icon('rx', 'ico-lg')}<h3>Any doctor's prescription</h3><p>Bring a current prescription from any eye doctor — or bring your own frame for new lenses.</p></div>
    </div>
  </div>
</section>

<section class="section brands-band">
  <div class="wrap">
    <div class="split-head">
      <div>
        <p class="eyebrow">Frames we carry</p>
        <h2 class="h2">From featherweight titanium to designer icons</h2>
      </div>
      <a class="text-link" href="/brands/">See all brands ${icon('arrow', 'ico-inline')}</a>
    </div>
    <div class="brand-cloud">${allBrands.map((b) => `<span>${esc(b)}</span>`).join('')}</div>
    <p class="fine">Lens technology from ${S.lensBrands.join(', ')}.</p>
  </div>
</section>

<section class="section">
  <div class="wrap">
    <p class="eyebrow center">How it works</p>
    <h2 class="h2 center">New glasses in four easy steps</h2>
    <ol class="steps">
      <li><span class="num">1</span><h3>Bring your prescription</h3><p>From any eye doctor — or have an exam next door first.</p></li>
      <li><span class="num">2</span><h3>Choose frame &amp; lenses</h3><p>Try on as many as you like. We explain lens options in plain language.</p></li>
      <li><span class="num">3</span><h3>We make them in-store</h3><p>Measured precisely and cut in our lab — usually about 3 business days.</p></li>
      <li><span class="num">4</span><h3>Pick up &amp; fine-tune</h3><p>We adjust the fit on your face. Come back any time for free adjustments.</p></li>
    </ol>
  </div>
</section>

<section class="section tint">
  <div class="wrap reviews">
    <div class="rating-card">
      <div class="big">${S.rating}</div>
      <div class="stars" aria-label="${S.rating} out of 5 stars">★★★★★</div>
      <p>${S.reviewCount} reviews on Google</p>
      <a class="btn btn-outline btn-sm" href="${mapsUrl}" target="_blank" rel="noopener">Read reviews on Google</a>
    </div>
    <div>
      <p class="eyebrow">What customers mention most</p>
      <h2 class="h2">Service people come back for — some for over 20 years</h2>
      <ul class="themes">
        <li>${icon('star')}<span><b>Friendly, patient staff</b> from the first visit to pick-up</span></li>
        <li>${icon('shield')}<span><b>Easy vision insurance</b> — benefits checked and claims handled for you</span></li>
        <li>${icon('frame')}<span><b>High-quality frame selection</b>, including lightweight titanium and designer brands</span></li>
        <li>${icon('ruler')}<span><b>Fair prices</b> and consistently good work, year after year</span></li>
      </ul>
    </div>
  </div>
</section>

${neighborSection()}

<section class="section ins-band">
  <div class="wrap">
    <div class="split-head">
      <div>
        <p class="eyebrow">Insurance &amp; payment</p>
        <h2 class="h2">Most major vision plans accepted</h2>
      </div>
      <a class="text-link" href="/insurance/">Insurance details ${icon('arrow', 'ico-inline')}</a>
    </div>
    <div class="ins-list">${S.insurance.map((i) => `<span>${esc(i.name)}</span>`).join('')}</div>
    <p class="fine">We also accept ${S.payments.slice(0, -1).join(', ')} and ${S.payments[S.payments.length - 1]}.</p>
  </div>
</section>

${visitSection()}
${faqBlock(HOME_FAQS)}
${ctaBand()}`;

  return page({
    pathName: '/',
    title: `${S.name} | Trendy Korean Frames & Eyeglasses in Garden Grove, CA`,
    description: `Trendy Korean frames at unbeatable prices, plus Cartier, Gucci and Lindberg. Garden Grove optical shop for ${years} years — in-store lab, EyeMed, Medicare & HMO.`,
    body,
    schemas: [bizSchema(), faqSchema(HOME_FAQS)],
  });
}

/* ---------- 페이지: 서비스 ---------- */

function servicesIndex() {
  const body = `
${crumbs([['Home', '/'], ['Services', '/services/']])}
<section class="page-head">
  <div class="wrap narrow">
    <p class="eyebrow">Services</p>
    <h1 class="h1">Optical services in Garden Grove</h1>
    <p class="lead">Frames, lenses, contacts and more — handled by opticians who fit every pair in person. ${esc(S.turnaroundNote.split('.')[0])}.</p>
  </div>
</section>
<section class="section pt0">
  <div class="wrap svc-list">
    ${SERVICES.map((s) => `
    <a class="svc-row" href="/services/${s.slug}/">
      ${icon(s.icon, 'ico-lg')}
      <div><h2>${esc(s.title)}</h2><p>${esc(s.short)}</p></div>
      ${icon('arrow', 'ico-inline')}
    </a>`).join('')}
  </div>
</section>
${neighborSection()}
${ctaBand()}`;
  return page({
    pathName: '/services/',
    active: '/services/',
    title: `Optical Services in Garden Grove | ${S.name}`,
    description: 'Progressive lenses, blue light and Transitions lenses, prescription sunglasses, contact lenses, kids’ glasses, kids’ myopia control, sports goggles and lens replacement in Garden Grove, CA.',
    body,
    schemas: [crumbSchema([['Home', '/'], ['Services', '/services/']])],
  });
}

function servicePage(s) {
  const others = SERVICES.filter((o) => o.slug !== s.slug).slice(0, 4);
  const trail = [['Home', '/'], ['Services', '/services/'], [s.title, `/services/${s.slug}/`]];
  const body = `
${crumbs(trail)}
<section class="page-head">
  <div class="wrap narrow">
    <div class="head-ico">${icon(s.icon, 'ico-xl')}</div>
    <p class="eyebrow">${esc(s.title)}</p>
    <h1 class="h1">${esc(s.h1)}</h1>
    <p class="lead">${esc(s.lead)}</p>
    <div class="btn-row">
      <a class="btn btn-dark" href="tel:${S.phoneHref}">${icon('phone')}Call ${S.phone}</a>
      <a class="btn btn-outline" href="${dirUrl}" target="_blank" rel="noopener">${icon('pin')}Directions</a>
    </div>
  </div>
</section>

<section class="section pt0">
  <div class="wrap narrow">
    <div class="content-card">
      <h2 class="h3">What we offer</h2>
      <ul class="checks">${s.offer.map((o) => `<li>${esc(o)}</li>`).join('')}</ul>
    </div>
    <div class="honest">
      <h2 class="h3">Good to know</h2>
      <p>${esc(s.honest)}</p>
    </div>
    <div class="info-strip">
      <div>${icon('lab')}<span><b>Turnaround</b>${esc(S.turnaround)} for most orders</span></div>
      <div>${icon('shield')}<span><b>Insurance</b><a href="/insurance/">Most vision plans</a></span></div>
      <div>${icon('rx')}<span><b>Prescriptions</b>From any eye doctor</span></div>
    </div>
  </div>
</section>

${faqBlock(s.faqs, `${s.title}: common questions`)}

<section class="section tint">
  <div class="wrap">
    <h2 class="h2 center">Other services</h2>
    <div class="svc-grid four">${others.map((o) => `
      <a class="svc-card" href="/services/${o.slug}/">${icon(o.icon, 'ico-lg')}<h3>${esc(o.title)}</h3><p>${esc(o.short)}</p></a>`).join('')}
    </div>
  </div>
</section>
${ctaBand()}`;

  return page({
    pathName: `/services/${s.slug}/`,
    active: '/services/',
    title: `${s.title} in Garden Grove, CA | ${S.name}`,
    description: s.meta,
    body,
    schemas: [
      {
        '@context': 'https://schema.org', '@type': 'Service',
        name: s.title, description: s.meta, serviceType: s.title,
        provider: { '@id': BIZ_ID }, areaServed: S.serviceArea.map((c) => `${c}, CA`),
        url: `${S.domain}/services/${s.slug}/`,
      },
      faqSchema(s.faqs),
      crumbSchema(trail),
    ],
  });
}

/* ---------- 페이지: 브랜드 ---------- */

function brandsPage() {
  const trail = [['Home', '/'], ['Brands', '/brands/']];
  const body = `
${crumbs(trail)}
<section class="page-head">
  <div class="wrap narrow">
    <p class="eyebrow">Brands</p>
    <h1 class="h1">Eyeglass frames &amp; sunglass brands we carry</h1>
    <p class="lead">A hand-picked mix of lightweight titanium, designer and everyday frames — plus kids’ and sport styles. Selection changes often, so call if you’re looking for a specific model.</p>
  </div>
</section>
<section class="section pt0">
  <div class="wrap brand-groups">
    ${S.brands.map((g) => `
    <div class="brand-group">
      <h2>${esc(g.group)}${g.note ? ` <span class="badge">${esc(g.note)}</span>` : ''}</h2>
      <ul>${g.items.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>
    </div>`).join('')}
    <div class="brand-group lens">
      <h2>Lens technology</h2>
      <ul>${S.lensBrands.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>
    </div>
  </div>
  <div class="wrap narrow">
    <div class="honest">
      <h2 class="h3">Why lightweight titanium?</h2>
      <p>Titanium frames weigh a fraction of standard metal frames, don’t rust and are hypoallergenic for most people — which is why they’re popular with anyone who wears glasses all day. Rimless and ultra-thin models look almost invisible but need a careful fit; that’s where an in-person optician makes the difference.</p>
    </div>
  </div>
</section>
${ctaBand('Looking for a specific brand or model? Call and we’ll check what’s in the shop.')}`;
  return page({
    pathName: '/brands/', active: '/brands/',
    title: `Eyeglass Brands: Cartier, Gucci, Lindberg & More | ${S.name} Garden Grove`,
    description: `Frames from ${allBrands.slice(0, 6).join(', ')} and more at ${S.name} in Garden Grove. Plus trendy Korean frames, lightweight titanium and sport eyewear.`,
    body,
    schemas: [crumbSchema(trail)],
  });
}

/* ---------- 페이지: 보험 ---------- */

const INS_FAQS = [
  { q: 'How do I know what my plan covers?', a: 'Call us with your plan name, the member’s name and date of birth (or member ID). We’ll look up your frame, lens and contact lens benefits and tell you before you visit.' },
  { q: 'What if my plan isn’t listed?', a: 'Call us anyway — our list changes. If we’re out of network for your plan, many plans still reimburse part of the cost; we’ll give you an itemized receipt to submit.' },
  { q: 'Do you accept Medicare?', a: 'Yes. Original Medicare generally covers glasses only after cataract surgery, while many Medicare Advantage plans include yearly eyewear benefits. Call with your plan details and we’ll check your coverage.' },
  { q: 'Can I use my FSA or HSA card?', a: 'Yes. Prescription glasses, prescription sunglasses and contact lenses are generally eligible expenses. Check your plan for the exact rules.' },
  { q: 'Does my insurance cover the eye exam here?', a: 'New Optix doesn’t perform eye exams. Exam benefits are billed by the eye doctor who examines you.' },
];

function insurancePage() {
  const trail = [['Home', '/'], ['Insurance', '/insurance/']];
  const body = `
${crumbs(trail)}
<section class="page-head">
  <div class="wrap narrow">
    <p class="eyebrow">Insurance &amp; payment</p>
    <h1 class="h1">Vision insurance, made easy</h1>
    <p class="lead">We check your benefits and file the claim for you, so you know what’s covered before you choose frames and lenses.</p>
  </div>
</section>
<section class="section pt0">
  <div class="wrap narrow">
    <div class="content-card">
      <h2 class="h3">Insurance we accept</h2>
      <p class="ins-lede">${esc(S.insuranceHeadline)}.</p>
      <ul class="ins-grid">${S.insurance.map((i) => `<li>${icon('shield')}<span>${esc(i.name)}${i.note ? `<small>${esc(i.note)}</small>` : ''}</span></li>`).join('')}</ul>
      <p class="fine">Plan participation can change. Please call to confirm before your visit.</p>
    </div>
    <div class="content-card">
      <h2 class="h3">What to bring</h2>
      <ul class="checks">
        <li>Your current glasses or contact lens prescription (from any eye doctor)</li>
        <li>Insurance member ID, or the member’s name and date of birth</li>
        <li>Your current glasses, if you have them</li>
      </ul>
    </div>
    <div class="content-card">
      <h2 class="h3">Payment options</h2>
      <ul class="pay">${S.payments.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>
    </div>
  </div>
</section>
${faqBlock(INS_FAQS, 'Insurance questions')}
${ctaBand('Tell us your plan name and we’ll check your benefits before you come in.')}`;
  return page({
    pathName: '/insurance/', active: '/insurance/',
    title: `Vision Insurance Accepted: EyeMed, Medicare & HMO Plans | ${S.name} Garden Grove`,
    description: `${S.insuranceHeadline}. We check your benefits and file the claim. FSA/HSA cards accepted.`,
    body,
    schemas: [crumbSchema(trail), faqSchema(INS_FAQS)],
  });
}

/* ---------- 페이지: 소개 ---------- */

function aboutPage() {
  const trail = [['Home', '/'], ['About', '/about/']];
  const body = `
${crumbs(trail)}
<section class="page-head">
  <div class="wrap narrow">
    <p class="eyebrow">About us</p>
    <h1 class="h1">A neighborhood optical shop for ${years} years</h1>
    <p class="lead">New Optix has helped Garden Grove see clearly for more than ${S.yearsServing} years. Some of our customers have been with us for more than 20 years.</p>
  </div>
</section>
<section class="section pt0">
  <div class="wrap narrow prose">
    <h2>How we work</h2>
    <p>We believe a good pair of glasses is equal parts prescription, lens and fit. Getting any one of them wrong means headaches, slipping frames or lenses you never quite get used to. So we take our time: we listen to how you use your eyes, explain the lens options that actually matter for you, and measure you in the frame you choose.</p>
    <p>Because we have our own lens lab in the shop, most glasses are ready in about 3 business days — and if something isn’t right, we can fix it here instead of sending it away.</p>
    <h2>What you can expect</h2>
    <ul class="checks">
      <li>Honest advice — including when you don’t need the upgrade</li>
      <li>Benefits checked and insurance paperwork handled for you</li>
      <li>Free adjustments for as long as you wear your glasses</li>
      <li>Help in ${S.languages.join(' and ')}</li>
    </ul>
    <!-- TODO(owner): 사장님 이름·사진·창업 이야기 들어갈 자리 -->
    <h2>Right next door: eye exams</h2>
    <p>${esc(S.neighbor.disclosure)} If you need an exam, ${esc(S.neighbor.name)} practices in the same building.</p>
  </div>
</section>
${visitSection()}
${ctaBand()}`;
  return page({
    pathName: '/about/', active: '/about/',
    title: `About ${S.name} | Garden Grove Optical Shop Since ${new Date().getFullYear() - S.yearsServing}`,
    description: `${S.name} is a Garden Grove optical shop serving the community for ${years} years, with an in-store lens lab, friendly opticians and help in ${S.languages.join(' and ')}.`,
    body,
    schemas: [crumbSchema(trail)],
  });
}

/* ---------- 페이지: 찾아오기 ---------- */

function contactPage() {
  const trail = [['Home', '/'], ['Visit', '/contact/']];
  const body = `
${crumbs(trail)}
<section class="page-head">
  <div class="wrap narrow">
    <p class="eyebrow">Visit</p>
    <h1 class="h1">Hours, directions &amp; contact</h1>
    <p class="lead">Walk-ins welcome for frame shopping and adjustments. Serving ${S.serviceArea.slice(0, -1).join(', ')} and ${S.serviceArea[S.serviceArea.length - 1]}.</p>
  </div>
</section>
${visitSection()}
${ctaBand()}`;
  return page({
    pathName: '/contact/', active: '/contact/',
    title: `Hours & Directions | ${S.name}, ${addrLine1}, Garden Grove`,
    description: `${S.name}, ${addrLine1}, ${addrLine2}. Call ${S.phone}. Open Mon–Sat, closed Sunday.`,
    body,
    schemas: [crumbSchema(trail)],
  });
}

/* ---------- 페이지: 한국어 ---------- */

const KO_FAQS = [
  { q: '시력검사도 하나요?', a: 'New Optix는 안경점이라 시력검사는 하지 않습니다. 같은 건물에 독립 검안 진료소가 있고, 다른 안과·검안사의 처방전도 받습니다.' },
  { q: '안경은 며칠 걸리나요?', a: '매장 안 가공실에서 직접 만들어 대부분 영업일 기준 3일 정도면 됩니다. 고도수·일부 누진다초점·특수 코팅 렌즈는 제조사 제작이라 더 걸릴 수 있으며, 주문 시 예상 날짜를 알려드립니다.' },
  { q: '안경 보험 되나요?', a: `EyeMed를 비롯한 대부분의 주요 안경 보험과 Medicare, HMO 플랜을 받습니다. 보험사 이름과 회원 정보를 전화로 알려주시면 방문 전에 혜택을 확인해 드립니다.` },
  { q: '다른 곳에서 산 안경테에 렌즈만 바꿀 수 있나요?', a: '네, 테 상태가 괜찮으면 가능합니다. 작업 전에 테를 점검하고, 오래된 테는 파손 위험이 있으면 미리 말씀드립니다.' },
];

function koPage() {
  const body = `
<section class="hero ko-hero">
  <div class="wrap hero-grid">
    <div class="hero-copy">
      ${promoPill('ko')}
      <p class="eyebrow">가든그로브 안경점 · ${years}년</p>
      <h1 class="h1">얼굴에, 처방에, 예산에 맞는 안경.</h1>
      <p class="lead">가벼운 티타늄 안경테부터 Lindberg·Gucci까지. 매장 안 가공실에서 직접 만들어 대부분 3일 안에 찾아가실 수 있습니다. 한국어로 편하게 상담하세요.</p>
      <div class="btn-row">
        <a class="btn btn-dark" href="tel:${S.phoneHref}">${icon('phone')}전화 ${S.phone}</a>
        <a class="btn btn-outline" href="${dirUrl}" target="_blank" rel="noopener">${icon('pin')}길찾기</a>
      </div>
      <ul class="trust">
        <li><b>${S.rating}★</b><span>구글 평점</span></li>
        <li><b>${years}년</b><span>가든그로브에서</span></li>
        <li><b>약 3일</b><span>평균 제작 기간</span></li>
      </ul>
    </div>
    ${HERO_ART}
  </div>
</section>
${promoBand('ko')}

<section class="section">
  <div class="wrap">
    <h2 class="h2 center">이런 것을 해 드립니다</h2>
    <div class="ko-svc">
      <div><b>누진다초점 렌즈</b><span>먼 곳·컴퓨터·가까운 곳을 안경 하나로</span></div>
      <div><b>블루라이트·변색 렌즈</b><span>화면 눈부심 완화, 햇빛에서 어두워지는 렌즈</span></div>
      <div><b>도수 선글라스</b><span>편광·틴트 렌즈, 누진 선글라스도 가능</span></div>
      <div><b>콘택트렌즈</b><span>원데이·월착용·난시용·다초점 (콘택트렌즈 처방전 필요)</span></div>
      <div><b>어린이 근시 관리</b><span>근시 억제 렌즈, MiSight® 콘택트렌즈 (검안사 처방 필요)</span></div>
      <div><b>스포츠 고글</b><span>농구·피클볼·라켓 운동용 도수 고글</span></div>
      <div><b>렌즈만 교체</b><span>다른 곳에서 산 안경테에도 새 렌즈를</span></div>
    </div>
    <p class="center fine">자세한 영어 안내: <a class="text-link" href="/services/">Services</a></p>
  </div>
</section>

<section class="section tint">
  <div class="wrap">
    <div class="split-head">
      <div><p class="eyebrow">보험·결제</p><h2 class="h2">EyeMed 등 주요 안경 보험, Medicare·HMO</h2></div>
    </div>
    <div class="ins-list">${S.insurance.map((i) => `<span>${esc(i.name)}</span>`).join('')}</div>
    <p class="fine">현금, 신용카드, Apple Pay·Google Pay, FSA/HSA 카드 사용 가능. 다른 안과·검안사 처방전도 받습니다.</p>
  </div>
</section>

<section class="section neighbor">
  <div class="wrap neighbor-inner">
    <div class="neighbor-mark">${icon('rx', 'ico-lg')}</div>
    <div>
      <p class="eyebrow">시력검사가 먼저 필요하신가요?</p>
      <h2 class="h2">같은 건물에 독립 검안 진료소가 있습니다.</h2>
      <p>New Optix는 시력검사를 하지 않는 안경점입니다. 새 처방이 필요하시면 같은 건물의 ${esc(S.neighbor.name)}에서 검사를 받으신 뒤 바로 안경을 고르실 수 있습니다.</p>
      <p class="fine">검안 진료소는 New Optix와 별개로 운영되는 독립 사업체입니다. 검사와 안경 구입은 원하시는 곳 어디서나 하실 수 있습니다.</p>
    </div>
  </div>
</section>

${visitSection('ko')}
${faqBlock(KO_FAQS, '자주 묻는 질문')}`;

  return page({
    pathName: '/ko/', lang: 'ko', active: '/ko/',
    title: `가든그로브 안경점 New Optix | 한국 트렌드 안경테 · 누진다초점 · 안경 보험`,
    description: `가든그로브 ${years}년 안경점 New Optix. 누진다초점, 도수 선글라스, 콘택트렌즈, 어린이 안경, 렌즈 교체. 매장 가공실에서 약 3일 제작, 주요 안경 보험 가능, 한국어 상담.`,
    body,
    schemas: [faqSchema(KO_FAQS)],
  });
}

/* ---------- 404 ---------- */

function notFound() {
  return page({
    pathName: '/404.html',
    title: `Page not found | ${S.name}`,
    description: 'Page not found.',
    body: `
<section class="page-head">
  <div class="wrap narrow center">
    <h1 class="h1">We couldn’t find that page.</h1>
    <p class="lead">It may have moved. Try the links below, or give us a call at <a href="tel:${S.phoneHref}">${S.phone}</a>.</p>
    <div class="btn-row center-row"><a class="btn btn-dark" href="/">Home</a><a class="btn btn-outline" href="/services/">Services</a></div>
  </div>
</section>`,
  });
}

/* ---------- 파비콘 ---------- */

const FAVICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#14202b"/><circle cx="21" cy="32" r="10" fill="none" stroke="#fff" stroke-width="4"/><circle cx="43" cy="32" r="10" fill="none" stroke="#fff" stroke-width="4"/><path d="M31 31c1-1.5 1-1.5 2 0" stroke="#fff" stroke-width="4" fill="none" stroke-linecap="round"/><circle cx="43" cy="32" r="4.5" fill="#c9974f"/></svg>`;

/* ---------- 빌드 ---------- */

function write(rel, content) {
  const out = path.join(DIST, rel);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, content);
}

fs.rmSync(DIST, { recursive: true, force: true });

const pages = [
  ['/', homePage()],
  ['/services/', servicesIndex()],
  ...SERVICES.map((s) => [`/services/${s.slug}/`, servicePage(s)]),
  ['/brands/', brandsPage()],
  ['/insurance/', insurancePage()],
  ['/about/', aboutPage()],
  ['/contact/', contactPage()],
  ['/ko/', koPage()],
];
for (const [p, html] of pages) write(p + 'index.html', html);
write('404.html', notFound());
write('style.css', CSS);
write('favicon.svg', FAVICON);
fs.copyFileSync(path.join(ROOT, 'src', 'og-image.png'), path.join(DIST, 'og-image.png'));

write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.map(([p]) => `  <url><loc>${S.domain}${p}</loc></url>`).join('\n')}
</urlset>
`);
write('robots.txt', S.draft
  ? 'User-agent: *\nDisallow: /\n'
  : `User-agent: *\nAllow: /\n\nSitemap: ${S.domain}/sitemap.xml\n`);
write('llms.txt', `# ${S.name}
> ${S.tagline}. ${addrLine1}, ${addrLine2}. Phone ${S.phone}.

${S.name} is an optical shop (not an eye exam provider) with an in-store lens lab. Most glasses are ready in ${S.turnaround}.

## Services
${SERVICES.map((s) => `- [${s.title}](${S.domain}/services/${s.slug}/): ${s.short}`).join('\n')}

## Info
- [Brands](${S.domain}/brands/): ${allBrands.join(', ')}
- [Insurance](${S.domain}/insurance/): ${S.insurance.map((i) => i.name).join(', ')}
- [Hours & directions](${S.domain}/contact/)
- [한국어 안내](${S.domain}/ko/)
`);

console.log(`Built ${pages.length + 1} pages → ${path.relative(process.cwd(), DIST) || 'dist'} (draft=${S.draft})`);
