/**
 * 고객 사이트 렌더러 — 스펙 JSON → 정적 파일 (원페이지 템플릿)
 * 설계: docs/customer-sites-design-ko.md §3·§4. 루틴(sites.js)과 로컬 확인(render --spec)이 같이 쓴다.
 * 원칙: 360px 우선 · 콘텐츠 기본 표시(JS 없이도 전부 보임) · 지어내지 않음(빈 값은 섹션을 숨김) · 리뷰 본문 없음(별점·링크만)
 */
'use strict';

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const slugify = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'site';
const telHref = (p) => 'tel:' + String(p || '').replace(/[^\d+]/g, '');

function hex2rgb(h) { const m = /^#?([0-9a-f]{6})$/i.exec(h || ''); if (!m) return [10, 77, 245]; const n = parseInt(m[1], 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
function darken([r, g, b], f = 0.75) { return '#' + [r, g, b].map((x) => Math.round(x * f).toString(16).padStart(2, '0')).join(''); }

/** 스펙 정규화 — 없는 키를 채우고 slug 를 확정한다 */
function normalize(spec) {
  const s = JSON.parse(JSON.stringify(spec || {}));
  s.slug = slugify(s.slug || s.name);
  s.lang = ['ko', 'en', 'ko-en'].includes(s.lang) ? s.lang : 'ko';
  s.tier = s.tier || 'onepage';
  s.address = s.address || {};
  s.hours = Array.isArray(s.hours) ? s.hours.filter((h) => h && h.days) : [];
  s.services = Array.isArray(s.services) ? s.services.filter((x) => x && x.name) : [];
  s.highlights = Array.isArray(s.highlights) ? s.highlights.filter((x) => x && x.title) : [];
  s.gallery = Array.isArray(s.gallery) ? s.gallery.filter((u) => /^https?:\/\//.test(u)) : [];
  s.hero = s.hero || {}; s.about = s.about || {}; s.social = s.social || {}; s.theme = s.theme || {}; s.seo = s.seo || {}; s.cta = s.cta || {};
  s.theme.color = /^#[0-9a-f]{6}$/i.test(s.theme.color || '') ? s.theme.color : '#0A4DF5';
  return s;
}

/** 한/영 문자열 고르기 — lang 이 en 이면 _en 우선, ko-en 이면 둘 다(토글용 data 속성) */
function pick(s, obj, key) {
  const ko = obj[key] || '', en = obj[key + '_en'] || '';
  if (s.lang === 'en') return { main: en || ko, alt: '' };
  return { main: ko || en, alt: s.lang === 'ko-en' ? en : '' };
}
/** 토글 가능한 텍스트 노드 — alt 가 있으면 data-en 에 넣는다 */
function t(s, obj, key) { const { main, alt } = pick(s, obj, key); return alt ? `<span data-ko="${esc(main)}" data-en="${esc(alt)}">${esc(main)}</span>` : esc(main); }

function addressLine(a) { return [a.line1, a.line2, [a.city, a.state].filter(Boolean).join(', ') + (a.zip ? ' ' + a.zip : '')].filter(Boolean).join(', '); }
function mapsHref(s) { return s.maps_url || (s.place_id ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.name)}&query_place_id=${encodeURIComponent(s.place_id)}` : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressLine(s.address) || s.name)}`); }

function schema(s, canonical) {
  const o = {
    '@context': 'https://schema.org', '@type': s.schema_type || 'LocalBusiness', name: s.name, url: canonical, telephone: s.phone || undefined, email: s.email || undefined,
    image: s.hero.photo || undefined, description: s.seo.description || s.tagline || undefined,
    address: s.address.line1 ? { '@type': 'PostalAddress', streetAddress: [s.address.line1, s.address.line2].filter(Boolean).join(' '), addressLocality: s.address.city, addressRegion: s.address.state, postalCode: s.address.zip, addressCountry: 'US' } : undefined,
    hasMap: s.place_id || s.maps_url ? mapsHref(s) : undefined,
    sameAs: Object.values(s.social).filter(Boolean),
  };
  if (s.hours.length && s.hours.every((h) => h.open && h.close && h.day_codes)) o.openingHoursSpecification = s.hours.map((h) => ({ '@type': 'OpeningHoursSpecification', dayOfWeek: h.day_codes, opens: h.open, closes: h.close }));
  return JSON.stringify(o, (k, v) => (v === undefined || (Array.isArray(v) && !v.length) ? undefined : v));
}

const CSS = (c) => {
  const rgb = hex2rgb(c), dark = darken(rgb, 0.72), soft = `rgba(${rgb.join(',')},.08)`;
  return `
:root{--c:${c};--cd:${dark};--cs:${soft};--ink:#111318;--muted:#5B6472;--line:#E6E8EE;--bg:#fff;--bg2:#F7F8FB}
*{box-sizing:border-box}html{scroll-behavior:smooth;-webkit-text-size-adjust:100%}body{margin:0;font-family:Pretendard,-apple-system,'Apple SD Gothic Neo','Malgun Gothic',Segoe UI,sans-serif;color:var(--ink);background:var(--bg);line-height:1.6;font-size:16px}
img{max-width:100%;display:block}a{color:var(--c)}h1,h2,h3{line-height:1.25;margin:0 0 10px;letter-spacing:-.01em}h2{font-size:24px}p{margin:0 0 12px}
.wrap{max-width:1040px;margin:0 auto;padding:0 18px}
.nav{position:sticky;top:0;z-index:20;background:rgba(255,255,255,.92);backdrop-filter:saturate(1.4) blur(8px);border-bottom:1px solid var(--line)}.nav .wrap{display:flex;align-items:center;gap:12px;height:58px}.brand{font-weight:800;font-size:18px;color:var(--ink);text-decoration:none;display:flex;align-items:center;gap:8px}.brand img{height:32px;width:auto}
.nav nav{display:none;gap:18px;margin-left:auto;font-size:14.5px}.nav nav a{color:var(--ink);text-decoration:none;font-weight:600}.nav .call{margin-left:auto;background:var(--c);color:#fff;text-decoration:none;font-weight:700;padding:9px 14px;border-radius:999px;font-size:14px;white-space:nowrap}
.lang{border:1px solid var(--line);background:#fff;border-radius:999px;padding:6px 10px;font-size:12.5px;font-weight:700;cursor:pointer;color:var(--muted)}
.hero{position:relative;min-height:72vh;display:flex;align-items:flex-end;background:var(--cd) center/cover no-repeat;color:#fff;isolation:isolate}.hero::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.05) 0%,rgba(0,0,0,.62) 100%);z-index:-1}.hero .wrap{padding:48px 18px 36px;width:100%}.hero .kicker{display:inline-block;background:rgba(255,255,255,.16);border:1px solid rgba(255,255,255,.35);border-radius:999px;padding:5px 12px;font-size:13px;font-weight:700;margin-bottom:12px}.hero h1{font-size:clamp(30px,7vw,52px);font-weight:800;margin-bottom:10px;text-shadow:0 2px 14px rgba(0,0,0,.25)}.hero p{font-size:17px;max-width:620px;opacity:.95}.hero .cta{display:flex;gap:10px;flex-wrap:wrap;margin-top:18px}
.btn{display:inline-flex;align-items:center;gap:8px;background:var(--c);color:#fff;text-decoration:none;font-weight:800;padding:14px 20px;border-radius:14px;font-size:16px;min-height:48px}.btn.ghost{background:#fff;color:var(--ink);border:1.5px solid var(--line)}.hero .btn.ghost{background:rgba(255,255,255,.14);color:#fff;border-color:rgba(255,255,255,.45)}
section{padding:52px 0}section.alt{background:var(--bg2)}.sec-h{margin-bottom:22px}.sec-h .eyebrow{color:var(--c);font-weight:800;font-size:13px;letter-spacing:.08em;text-transform:uppercase}.sec-h p{color:var(--muted);max-width:640px}
.grid{display:grid;gap:14px;grid-template-columns:1fr}.card{background:#fff;border:1px solid var(--line);border-radius:18px;padding:18px;box-shadow:0 1px 2px rgba(16,24,40,.04)}.card h3{font-size:17px;margin-bottom:6px}.card p{color:var(--muted);font-size:15px;margin:0}.card .price{color:var(--c);font-weight:800;margin-top:8px;display:block}.card img{border-radius:12px;aspect-ratio:4/3;object-fit:cover;margin-bottom:12px;width:100%}
.hl{display:grid;gap:12px;grid-template-columns:1fr}.hl div{background:var(--cs);border-radius:16px;padding:16px}.hl b{display:block;font-size:16px;margin-bottom:4px}.hl span{color:var(--muted);font-size:14.5px}
.about{display:grid;gap:22px;grid-template-columns:1fr;align-items:center}.about img{border-radius:20px;aspect-ratio:4/3;object-fit:cover;width:100%}.about p{font-size:16.5px}
.gallery{display:grid;gap:8px;grid-template-columns:repeat(2,1fr)}.gallery img{aspect-ratio:1;object-fit:cover;border-radius:12px;width:100%}
.info{display:grid;gap:16px;grid-template-columns:1fr}.info .card{padding:20px}.hours{list-style:none;margin:0;padding:0}.hours li{display:flex;justify-content:space-between;gap:10px;padding:8px 0;border-bottom:1px dashed var(--line);font-size:15px}.hours li:last-child{border:0}.hours b{font-weight:600}
.rating{display:inline-flex;align-items:center;gap:8px;background:#fff;border:1px solid var(--line);border-radius:999px;padding:8px 14px;font-weight:700;font-size:14.5px}.rating .stars{color:#F5A623;letter-spacing:1px}
.map{border-radius:16px;overflow:hidden;border:1px solid var(--line);background:var(--bg2);min-height:220px;display:flex;align-items:center;justify-content:center;text-align:center;padding:20px}.map a{font-weight:800}
.bottom{position:fixed;left:0;right:0;bottom:0;z-index:30;display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:10px 12px calc(10px + env(safe-area-inset-bottom));background:rgba(255,255,255,.96);border-top:1px solid var(--line);backdrop-filter:blur(8px)}.bottom .btn{justify-content:center;padding:12px}body{padding-bottom:76px}
footer{padding:28px 0 40px;color:var(--muted);font-size:13.5px;border-top:1px solid var(--line)}footer .wrap{display:flex;flex-wrap:wrap;gap:8px 18px;align-items:center}footer a{color:var(--muted);text-decoration:none}
@media(min-width:720px){.nav nav{display:flex}.grid{grid-template-columns:repeat(3,1fr)}.hl{grid-template-columns:repeat(3,1fr)}.about{grid-template-columns:1.1fr 1fr}.gallery{grid-template-columns:repeat(4,1fr)}.info{grid-template-columns:1fr 1fr 1fr}.bottom{display:none}body{padding-bottom:0}h2{font-size:30px}}
@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}}
`;
};

/** index.html */
function page(s, { canonical, noindex }) {
  const name = pick(s, s, 'name').main || s.name;
  const title = s.seo.title || `${name} — ${s.tagline || s.category || ''}`.replace(/ — $/, '');
  const desc = s.seo.description || s.tagline || '';
  const phone = s.phone || '';
  const addr = addressLine(s.address);
  const hasHours = s.hours.length > 0;
  const showGallery = s.gallery.length >= 2;
  const toggle = s.lang === 'ko-en';
  const stars = s.rating ? '★'.repeat(Math.round(s.rating)) + '☆'.repeat(5 - Math.round(s.rating)) : '';
  return `<!doctype html>
<html lang="${s.lang === 'en' ? 'en' : 'ko'}">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
${noindex ? '<meta name="robots" content="noindex,nofollow">' : ''}
<link rel="canonical" href="${esc(canonical)}">
<meta property="og:type" content="business.business"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}">${s.hero.photo ? `<meta property="og:image" content="${esc(s.hero.photo)}">` : ''}<meta property="og:url" content="${esc(canonical)}">
<link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">
${s.logo ? `<link rel="icon" href="${esc(s.logo)}">` : ''}
<script type="application/ld+json">${schema(s, canonical)}</script>
<style>${CSS(s.theme.color)}</style>
</head>
<body>
<header class="nav"><div class="wrap">
  <a class="brand" href="#top">${s.logo ? `<img src="${esc(s.logo)}" alt="${esc(name)} 로고">` : ''}<span>${esc(name)}</span></a>
  <nav>${s.services.length ? `<a href="#services">${s.lang === 'en' ? 'Services' : toggle ? '<span data-ko="서비스" data-en="Services">서비스</span>' : '서비스'}</a>` : ''}${s.about.text ? `<a href="#about">${s.lang === 'en' ? 'About' : toggle ? '<span data-ko="소개" data-en="About">소개</span>' : '소개'}</a>` : ''}<a href="#info">${s.lang === 'en' ? 'Hours & Map' : toggle ? '<span data-ko="영업시간·오시는 길" data-en="Hours &amp; Map">영업시간·오시는 길</span>' : '영업시간·오시는 길'}</a></nav>
  ${toggle ? '<button class="lang" id="lang" type="button" aria-label="Language">EN</button>' : ''}
  ${phone ? `<a class="call" href="${telHref(phone)}">📞 ${esc(phone)}</a>` : ''}
</div></header>

<section class="hero" id="top" ${s.hero.photo ? `style="background-image:url('${esc(s.hero.photo)}')"` : ''}><div class="wrap">
  ${s.category ? `<span class="kicker">${t(s, s, 'category')}${s.address.city ? ' · ' + esc(s.address.city) : ''}</span>` : ''}
  <h1>${t(s, s.hero, 'headline') || esc(name)}</h1>
  ${s.hero.sub || s.tagline ? `<p>${s.hero.sub ? t(s, s.hero, 'sub') : t(s, s, 'tagline')}</p>` : ''}
  <div class="cta">${phone ? `<a class="btn" href="${telHref(phone)}">${s.lang === 'en' ? 'Call now' : toggle ? '<span data-ko="전화하기" data-en="Call now">전화하기</span>' : '전화하기'}</a>` : ''}${s.cta.booking_url ? `<a class="btn ghost" href="${esc(s.cta.booking_url)}" target="_blank" rel="noopener">${s.lang === 'en' ? 'Book online' : toggle ? '<span data-ko="온라인 예약" data-en="Book online">온라인 예약</span>' : '온라인 예약'}</a>` : ''}${addr ? `<a class="btn ghost" href="${esc(mapsHref(s))}" target="_blank" rel="noopener">${s.lang === 'en' ? 'Directions' : toggle ? '<span data-ko="길찾기" data-en="Directions">길찾기</span>' : '길찾기'}</a>` : ''}</div>
</div></section>

${s.highlights.length ? `<section><div class="wrap"><div class="hl">${s.highlights.slice(0, 3).map((h) => `<div><b>${t(s, h, 'title')}</b><span>${t(s, h, 'text')}</span></div>`).join('')}</div></div></section>` : ''}

${s.services.length ? `<section class="alt" id="services"><div class="wrap"><div class="sec-h"><div class="eyebrow">${s.lang === 'en' ? 'Services' : 'SERVICES'}</div><h2>${s.lang === 'en' ? 'What we offer' : toggle ? '<span data-ko="서비스 안내" data-en="What we offer">서비스 안내</span>' : '서비스 안내'}</h2>${s.services_intro ? `<p>${t(s, s, 'services_intro')}</p>` : ''}</div>
<div class="grid">${s.services.slice(0, 12).map((x) => `<div class="card">${x.photo ? `<img src="${esc(x.photo)}" alt="${esc(x.name)}" loading="lazy">` : ''}<h3>${t(s, x, 'name')}</h3>${x.desc ? `<p>${t(s, x, 'desc')}</p>` : ''}${x.price ? `<span class="price">${esc(x.price)}</span>` : ''}</div>`).join('')}</div></div></section>` : ''}

${s.about.text ? `<section id="about"><div class="wrap"><div class="about">${s.about.photo ? `<img src="${esc(s.about.photo)}" alt="${esc(name)}" loading="lazy">` : ''}<div><div class="sec-h"><div class="eyebrow">ABOUT</div><h2>${s.about.title ? t(s, s.about, 'title') : esc(name)}</h2></div><p>${t(s, s.about, 'text').replace(/\n/g, '<br>')}</p></div></div></div></section>` : ''}

${showGallery ? `<section class="alt"><div class="wrap"><div class="sec-h"><div class="eyebrow">GALLERY</div><h2>${s.lang === 'en' ? 'Photos' : toggle ? '<span data-ko="매장 사진" data-en="Photos">매장 사진</span>' : '매장 사진'}</h2></div><div class="gallery">${s.gallery.slice(0, 8).map((u) => `<img src="${esc(u)}" alt="" loading="lazy">`).join('')}</div></div></section>` : ''}

<section id="info"><div class="wrap"><div class="sec-h"><div class="eyebrow">VISIT</div><h2>${s.lang === 'en' ? 'Hours & Location' : toggle ? '<span data-ko="영업시간 · 오시는 길" data-en="Hours &amp; Location">영업시간 · 오시는 길</span>' : '영업시간 · 오시는 길'}</h2></div>
<div class="info">
  ${hasHours ? `<div class="card"><h3>${s.lang === 'en' ? 'Hours' : toggle ? '<span data-ko="영업시간" data-en="Hours">영업시간</span>' : '영업시간'}</h3><ul class="hours">${s.hours.map((h) => `<li><b>${esc(h.days)}</b><span>${esc(h.time || (h.open && h.close ? h.open + '–' + h.close : ''))}</span></li>`).join('')}</ul></div>` : ''}
  <div class="card"><h3>${s.lang === 'en' ? 'Contact' : toggle ? '<span data-ko="연락처" data-en="Contact">연락처</span>' : '연락처'}</h3>${phone ? `<p><a href="${telHref(phone)}">${esc(phone)}</a></p>` : ''}${s.email ? `<p><a href="mailto:${esc(s.email)}">${esc(s.email)}</a></p>` : ''}${addr ? `<p>${esc(addr)}</p>` : ''}${s.rating ? `<p><a class="rating" href="${esc(s.review_url || mapsHref(s))}" target="_blank" rel="noopener"><span class="stars">${stars}</span> ${esc(s.rating)}${s.review_count ? ` · ${s.lang === 'en' ? 'reviews' : '리뷰'} ${esc(s.review_count)}` : ''}</a></p>` : ''}${Object.values(s.social).some(Boolean) ? `<p>${Object.entries(s.social).filter(([, v]) => v).map(([k, v]) => `<a href="${esc(v)}" target="_blank" rel="noopener">${esc(k[0].toUpperCase() + k.slice(1))}</a>`).join(' · ')}</p>` : ''}</div>
  ${addr ? `<div class="map"><div><p><b>${esc(addr)}</b></p><a class="btn" href="${esc(mapsHref(s))}" target="_blank" rel="noopener">${s.lang === 'en' ? 'Open in Google Maps' : toggle ? '<span data-ko="구글 지도에서 열기" data-en="Open in Google Maps">구글 지도에서 열기</span>' : '구글 지도에서 열기'}</a></div></div>` : ''}
</div></div></section>

<footer><div class="wrap"><span>© ${new Date().getFullYear()} ${esc(name)}</span>${addr ? `<span>${esc(addr)}</span>` : ''}${phone ? `<a href="${telHref(phone)}">${esc(phone)}</a>` : ''}</div></footer>
${phone || addr ? `<div class="bottom">${phone ? `<a class="btn" href="${telHref(phone)}">📞 ${s.lang === 'en' ? 'Call' : toggle ? '<span data-ko="전화" data-en="Call">전화</span>' : '전화'}</a>` : ''}${addr ? `<a class="btn ghost" href="${esc(mapsHref(s))}" target="_blank" rel="noopener">📍 ${s.lang === 'en' ? 'Directions' : toggle ? '<span data-ko="길찾기" data-en="Directions">길찾기</span>' : '길찾기'}</a>` : ''}</div>` : ''}
${toggle ? `<script>(function(){var b=document.getElementById('lang');if(!b)return;var en=false;try{en=localStorage.getItem('lang')==='en'}catch(e){}function apply(){document.querySelectorAll('[data-en]').forEach(function(el){el.innerHTML=en?el.getAttribute('data-en'):el.getAttribute('data-ko')});b.textContent=en?'한국어':'EN';document.documentElement.lang=en?'en':'ko'}b.addEventListener('click',function(){en=!en;try{localStorage.setItem('lang',en?'en':'ko')}catch(e){}apply()});if(en)apply()})();</script>` : ''}
</body></html>`;
}

/** 스펙 → 파일 맵. origin 은 canonical 의 기준(고객 도메인이 있으면 그것, 아니면 임시 주소) */
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

module.exports = { render, normalize, slugify };
