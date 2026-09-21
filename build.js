/**
 * BizHigher 정적 사이트 빌드 스크립트
 * 사용법: node build.js  →  dist/ 폴더에 전체 사이트 생성
 * 의존성 없음 (Node 18+)
 *
 * 콘텐츠 수정은 data/services.json 만 고치면 됩니다.
 */
const fs = require('fs');
const path = require('path');

const DATA = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'services.json'), 'utf8'));
const SITE = DATA.site;
const DIST = path.join(__dirname, 'dist');

// CSS 캐시 버스팅 — style.css 내용이 바뀌면 주소도 바뀌어 브라우저가 항상 새 CSS를 받음
const crypto = require('crypto');
const CSS_VER = crypto.createHash('md5')
  .update(fs.readFileSync(path.join(__dirname, 'src', 'style.css'), 'utf8'))
  .digest('hex').slice(0, 8);

/* ---------- 공통 조각 ---------- */

const LOGO_SVG = `<svg width="30" height="30" viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="15" fill="#0A4DF5"/><path d="M15 44 h9 v-9 h9 v-9 h6.5" stroke="#fff" stroke-width="6.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M38.5 15.5 h10 v10" stroke="#fff" stroke-width="6.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

const FAVICON = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='15' fill='%230A4DF5'/%3E%3Cpath d='M15 44 h9 v-9 h9 v-9 h6.5' stroke='white' stroke-width='6.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3Cpath d='M38.5 15.5 h10 v10' stroke='white' stroke-width='6.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E`;

const ANALYTICS = `
<script type="text/javascript">
    (function(c,l,a,r,i,t,y){
        c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
        t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
        y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
    })(window, document, "clarity", "script", "yiy7q338pe");
</script>
<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-6D7XST08PS"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());

  gtag('config', 'G-6D7XST08PS');
</script>`;

/* src/og/<slug>.png 이 있으면 그 글 전용 카드를 쓴다. 없으면 사이트 기본 이미지. */
function ogFor(slug) {
  return fs.existsSync(path.join(__dirname, 'src', 'og', `${slug}.png`)) ? `/og/${slug}.png` : null;
}

function head({ title, description, pathName, jsonLd, noindex, ogImage, ogType }) {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<meta name="description" content="${description}">
${noindex ? '<meta name="robots" content="noindex">' : ''}
<link rel="canonical" href="${SITE.domain}${pathName}">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${description}">
<meta property="og:url" content="${SITE.domain}${pathName}">
<meta property="og:type" content="${ogType || 'website'}">
<meta property="og:site_name" content="BizHigher">
<meta property="og:image" content="${SITE.domain}${ogImage || '/og-image.png'}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${SITE.domain}${ogImage || '/og-image.png'}">
<link rel="icon" href="${FAVICON}">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">
<link rel="stylesheet" href="/style.css?v=${CSS_VER}">
${jsonLd ? `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>` : ''}
${ANALYTICS}
</head>
<body>`;
}

function nav(active) {
  const cls = (k) => (k === active ? 'nav-link active' : 'nav-link');
  return `
<nav class="nav">
  <div class="nav-inner">
    <a href="/" class="logo">${LOGO_SVG}<span>Biz<span class="logo-accent">Higher</span></span></a>
    <div class="nav-links">
      <a class="${cls('services')}" href="/services/">서비스</a>
      <a class="${cls('pricing')}" href="/pricing/">가격</a>
      <a class="${cls('blog')}" href="/blog/">블로그</a>
      <a class="${cls('data')}" href="/data/">데이터</a>
      <a class="${cls('audit')}" href="/free-audit/">무료 진단</a>
    </div>
    <div class="nav-cta"><a class="btn btn-primary btn-small" href="/free-audit/">무료 진단 받기</a></div>
    <button class="nav-toggle" aria-label="메뉴 열기" onclick="document.getElementById('mm').classList.toggle('open');this.closest('.nav').classList.toggle('menu-open')">☰</button>
  </div>
  <div class="mobile-menu" id="mm">
    <a href="/services/">서비스</a>
    <a href="/pricing/">가격</a>
    <a href="/blog/">블로그</a>
    <a href="/data/">데이터</a>
    <a href="/free-audit/">무료 진단</a>
    <a class="btn btn-primary btn-block" href="/free-audit/" style="border-bottom:none;color:#fff;">무료 진단 받기</a>
  </div>
</nav>`;
}

const FOOTER = `
<section class="mega-cta">
  <div class="container center">
    <a href="/free-audit/" class="mega-link" aria-label="무료 AI 진단 시작하기"><span class="mega-text">한 단계 위로.</span></a>
    <p class="mega-sub">내 가게 마케팅, 몇 점일까요? — 60초 무료 AI 진단으로 시작하세요 →</p>
  </div>
</section>
<footer class="footer">
  <div class="container">
    <div class="footer-cols">
      <div class="footer-brand">
        <span class="logo">${LOGO_SVG}<span>Biz<span class="logo-accent">Higher</span></span></span>
        <p class="footer-desc">미국 한인 비즈니스를 위한 AI 자동화 마케팅. 내 비즈니스를 한 단계 위로.</p>
      </div>
      <div class="footer-col">
        <span class="footer-head">서비스</span>
        <a href="/services/" class="footer-link">전체 서비스</a>
        <a href="/pricing/" class="footer-link">가격</a>
        <a href="/free-audit/" class="footer-link">무료 진단</a>
        <a href="/blog/" class="footer-link">블로그</a>
        <a href="/data/" class="footer-link">데이터 리포트</a>
      </div>
      <div class="footer-col">
        <span class="footer-head">문의</span>
        <a href="mailto:${SITE.email}" class="footer-link">${SITE.email}</a>
      </div>
      <div class="footer-col">
        <span class="footer-head">약관</span>
        <a href="/privacy/" class="footer-link">개인정보처리방침</a>
        <a href="/terms/" class="footer-link">이용약관</a>
      </div>
    </div>
    <p class="footer-copy">© ${new Date().getFullYear()} BizHigher. All rights reserved.</p>
  </div>
</footer>
<script>
/* 스크롤 리빌 — IO 지원 시에만 숨겼다가 나타남 (기본은 항상 보임) + 3초 강제 표시 안전장치 */
(function () {
  if (!('IntersectionObserver' in window)) return;
  var els = document.querySelectorAll('.prod-card, .step-card, .tier, .stat-box, .faq-item, .price-item');
  if (!els.length) return;
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
    });
  }, { threshold: 0, rootMargin: '0px 0px -40px 0px' });
  els.forEach(function (el, i) {
    el.classList.add('rv');
    el.style.transitionDelay = Math.min((i % 6) * 60, 300) + 'ms';
    io.observe(el);
  });
  setTimeout(function () {
    els.forEach(function (el) { el.classList.add('in'); });
  }, 3000);
})();

/* 인터랙션 팩 — 네비 스크롤 상태 · 카운트업 · 카드 3D 틸트 (모두 선택적 강화, 실패해도 콘텐츠 표시에 영향 없음) */
(function () {
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* 0) 플로팅 네비 — 스크롤 시 글래스 강화 */
  var nav = document.querySelector('.nav');
  if (nav) {
    var navUpd = function () { nav.classList.toggle('scrolled', window.scrollY > 40); };
    window.addEventListener('scroll', navUpd, { passive: true });
    navUpd();
  }

  /* 1) 숫자 카운트업 — 뷰포트 진입 시 1회 */
  if (!reduced && 'IntersectionObserver' in window) {
    var stats = document.querySelectorAll('[data-count]');
    if (stats.length) {
      var sio = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (!en.isIntersecting) return;
          sio.unobserve(en.target);
          var el = en.target;
          var target = parseInt(el.getAttribute('data-count'), 10) || 0;
          var pre = el.getAttribute('data-prefix') || '', suf = el.getAttribute('data-suffix') || '';
          var start = null;
          function step(ts) {
            if (!start) start = ts;
            var p = Math.min((ts - start) / 1200, 1);
            el.textContent = pre + Math.round(target * (1 - Math.pow(1 - p, 3))) + suf;
            if (p < 1) requestAnimationFrame(step);
          }
          requestAnimationFrame(step);
        });
      }, { threshold: 0 });
      stats.forEach(function (el) { sio.observe(el); });
    }
  }

  /* 2) 스텝 카드 순차 하이라이트 — 섹션이 보이는 동안 부드럽게 순환 */
  var steps = document.getElementById('steps');
  if (steps && !reduced && 'IntersectionObserver' in window) {
    var cards = steps.querySelectorAll('.step-card');
    if (cards.length) {
      var idx = 0, iv = null;
      function cycle() {
        cards.forEach(function (c, i) { c.classList.toggle('step-active', i === idx); });
        idx = (idx + 1) % cards.length;
      }
      var stio = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting && !iv) { cycle(); iv = setInterval(cycle, 2200); }
          else if (!en.isIntersecting && iv) {
            clearInterval(iv); iv = null;
            cards.forEach(function (c) { c.classList.remove('step-active'); });
          }
        });
      }, { threshold: 0.3 });
      stio.observe(steps);
    }
  }

  /* 3) 카드 3D 틸트 — 데스크톱(정밀 포인터)에서만 */
  if (!reduced && window.matchMedia && window.matchMedia('(pointer: fine)').matches) {
    var tiltEls = document.querySelectorAll('.prod-card, .tier, .step-card');
    tiltEls.forEach(function (el) {
      el.addEventListener('mousemove', function (e) {
        var r = el.getBoundingClientRect();
        var rx = ((e.clientY - r.top) / r.height - 0.5) * -5;
        var ry = ((e.clientX - r.left) / r.width - 0.5) * 5;
        el.style.transform = 'perspective(800px) rotateX(' + rx.toFixed(2) + 'deg) rotateY(' + ry.toFixed(2) + 'deg) translateY(-4px)';
      });
      el.addEventListener('mouseleave', function () { el.style.transform = ''; });
    });
  }
})();
</script>
</body>
</html>`;

function badgeHtml(s) {
  if (!s.badge) return '';
  const cls = s.badgeStyle === 'green' ? 'badge badge-green' : s.badgeStyle === 'dark' ? 'badge badge-dark' : 'badge';
  return `<span class="${cls}">${s.badge}</span>`;
}

function productCard(s) {
  return `
<a href="/service/${s.slug}/" class="prod-card">
  ${badgeHtml(s)}
  <h3 class="h3">${s.name}</h3>
  <p class="body-sm">${s.shortDescription}</p>
  <div class="price-row"><span class="price">${s.price}</span><span class="price-sub">${s.priceSub}</span></div>
  <span class="card-cta">자세히 보기 →</span>
</a>`;
}

/* 가격 문자열("$199", "$19/월", "$199~")에서 숫자만 추출 — 구조화 데이터의 offers.price 용 */
function priceToNumber(priceStr) {
  const m = String(priceStr).replace(/,/g, '').match(/\$([\d.]+)/);
  return m ? Number(m[1]) : null;
}

function breadcrumbList(items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: it.url })),
  };
}

/* ---------- 패키지 공통 ---------- */

const PERIODS = [
  { key: 'monthly', label: '월간', per: '/월', note: '매월 결제 · 언제든 취소' },
  { key: 'six', label: '6개월', per: '/월', months: 6, note: '6개월 선결제' },
  { key: 'annual', label: '12개월', per: '/월', months: 12, note: '12개월 선결제' },
];

function pkgConsultHref(pkg, periodLabel) {
  return `mailto:${SITE.email}?subject=${encodeURIComponent(`[플랜 신청] ${pkg.name} — ${periodLabel}`)}&body=${encodeURIComponent('업체명:\n연락처:\n웹사이트/구글 프로필 링크:\n궁금한 점:')}`;
}

function packageMatrixSection() {
  // 서버 렌더는 12개월(기본) 기준 — JS가 토글 시 갱신
  const pkgsJson = JSON.stringify(DATA.packages.map((p) => ({
    slug: p.slug, name: p.name, sum: p.sum, prices: p.prices, links: p.links || {},
  })));
  const gifts = DATA.setupGifts;
  const cards = DATA.packages.map((p) => {
    const price = p.prices.annual;
    const total = price * 12;
    const disc = Math.round((1 - price / p.sum) * 100);
    return `
      <div class="tier pk-card ${p.popular ? 'tier-pop' : ''}" data-slug="${p.slug}">
        ${p.popular ? '<div class="tier-badge">가장 인기</div>' : ''}
        <h3 class="h3">${p.name}</h3>
        <p class="pk-sum">개별 합계 <s>$${p.sum}/월</s> <span class="pk-disc">${disc}% 할인</span></p>
        <div class="tier-price">$<span class="pk-price">${price}</span><span class="tier-per">/월</span></div>
        <p class="pk-total">총 $${total.toLocaleString('en-US')} · 12개월 선결제</p>
        <ul class="pk-list">${p.includes.map((i) => `<li>${i}</li>`).join('')}</ul>
        <a class="btn ${p.popular ? 'btn-primary' : 'btn-ghost'} btn-block pk-cta" href="${pkgConsultHref(p, '12개월')}">플랜 시작하기</a>
        <a class="pk-more" href="/package/${p.slug}/">자세히 보기 →</a>
      </div>`;
  }).join('');
  return `
<section class="section" id="plans">
  <div class="container">
    <p class="eyebrow">PLANS</p>
    <h2 class="h2">우리 가게 마케팅, 통째로 맡기세요</h2>
    <div class="period-toggle" id="period-toggle" role="tablist">
      <button type="button" data-period="monthly">월간</button>
      <button type="button" data-period="six">6개월</button>
      <button type="button" data-period="annual" class="on">12개월 <span class="pt-save">최대 혜택</span></button>
    </div>
    <div class="gift-note" id="gift-note">🎁 <b>12개월 플랜 셋업 무료</b> — ${gifts.annual.items.join(' + ')} <b>($${gifts.annual.value} 상당${gifts.premiumAnnualExtra ? ` · Premium은 ${gifts.premiumAnnualExtra}` : ''})</b></div>
    <div class="grid3 pk-grid">${cards}</div>
    <p class="note-text">장기 플랜은 시작 후 30일 내 해지 시 잔여 금액 환불 (제공된 서비스·셋업은 정가 차감) · 월간 플랜은 언제든 취소</p>
  </div>
</section>
<script>
(function () {
  var PKGS = ${pkgsJson};
  var GIFTS = ${JSON.stringify(gifts)};
  var CONSULT = ${JSON.stringify(Object.fromEntries(DATA.packages.map((p) => [p.slug, { monthly: pkgConsultHref(p, '월간'), six: pkgConsultHref(p, '6개월'), annual: pkgConsultHref(p, '12개월') }])))};
  var toggle = document.getElementById('period-toggle');
  if (!toggle) return;
  var noteEl = document.getElementById('gift-note');
  function fmt(n) { return n.toLocaleString('en-US'); }
  function render(period) {
    PKGS.forEach(function (p) {
      var card = document.querySelector('.pk-card[data-slug="' + p.slug + '"]');
      if (!card) return;
      var price = p.prices[period];
      var disc = Math.round((1 - price / p.sum) * 100);
      card.querySelector('.pk-price').textContent = price;
      card.querySelector('.pk-disc').textContent = disc + '% 할인';
      var months = period === 'six' ? 6 : period === 'annual' ? 12 : 0;
      card.querySelector('.pk-total').textContent = months
        ? '총 $' + fmt(price * months) + ' · ' + (months === 6 ? '6개월' : '12개월') + ' 선결제'
        : '매월 결제 · 언제든 취소';
      var cta = card.querySelector('.pk-cta');
      cta.href = (p.links && p.links[period]) || CONSULT[p.slug][period];
    });
    if (noteEl) {
      if (period === 'annual') noteEl.innerHTML = '🎁 <b>12개월 플랜 셋업 무료</b> — ' + GIFTS.annual.items.join(' + ') + ' <b>($' + GIFTS.annual.value + ' 상당' + (GIFTS.premiumAnnualExtra ? ' · Premium은 ' + GIFTS.premiumAnnualExtra : '') + ')</b>';
      else if (period === 'six') noteEl.innerHTML = '🎁 <b>6개월 플랜 셋업 무료</b> — ' + GIFTS.six.items.join(' + ') + ' <b>($' + GIFTS.six.value + ' 상당)</b>';
      else noteEl.innerHTML = '💡 6·12개월 플랜을 선택하면 셋업 서비스(최대 $' + GIFTS.annual.value + ' 상당)가 무료입니다';
    }
  }
  toggle.addEventListener('click', function (e) {
    var btn = e.target.closest('button[data-period]');
    if (!btn) return;
    toggle.querySelectorAll('button').forEach(function (b) { b.classList.toggle('on', b === btn); });
    render(btn.getAttribute('data-period'));
  });
})();
</script>`;
}

/* ---------- 페이지: 패키지 상세 ---------- */

function packagePage(p) {
  const gifts = DATA.setupGifts;
  const url = `${SITE.domain}/package/${p.slug}/`;
  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'Service',
      name: `${p.name} 플랜`,
      description: p.tagline,
      provider: { '@type': 'Organization', name: 'BizHigher', url: SITE.domain },
      areaServed: { '@type': 'Country', name: 'United States' },
      url,
      offers: PERIODS.map((per) => ({
        '@type': 'Offer',
        name: `${per.label} 결제`,
        price: p.prices[per.key],
        priceCurrency: 'USD',
        url,
        availability: 'https://schema.org/InStock',
        eligibleDuration: per.months ? { '@type': 'QuantitativeValue', value: per.months, unitCode: 'MON' } : undefined,
      })),
    },
    breadcrumbList([
      { name: '홈', url: `${SITE.domain}/` },
      { name: '가격', url: `${SITE.domain}/pricing/` },
      { name: p.name, url },
    ]),
  ];
  const rows = PERIODS.map((per) => {
    const price = p.prices[per.key];
    const months = per.months || 0;
    const totalTxt = months ? `총 $${(price * months).toLocaleString('en-US')} 선결제` : '매월 결제 · 언제든 취소';
    const disc = Math.round((1 - price / p.sum) * 100);
    const href = (p.links && p.links[per.key]) || pkgConsultHref(p, per.label);
    const primary = per.key === 'annual';
    return `<a href="${href}" class="btn ${primary ? 'btn-primary' : 'btn-ghost'} btn-block">${per.label} — $${price}/월 <span class="pk-btn-sub">(${totalTxt} · ${disc}%↓)</span></a>`;
  }).join('');
  return head({
    title: `${p.name} 플랜 — 월 $${p.prices.annual}부터 | BizHigher`,
    description: p.tagline,
    pathName: `/package/${p.slug}/`,
    jsonLd,
  }) + nav('pricing') + `
<header class="detail-head">
  <div class="container-narrow">
    <a href="/pricing/#plans" class="back-link">← 전체 플랜</a>
    ${p.popular ? '<span class="badge">가장 인기</span>' : '<span class="badge">플랜</span>'}
    <h1 class="detail-title">${p.name}</h1>
    <p class="detail-sub">${p.tagline}</p>
    <div class="pricebox">
      <div class="pricebox-row"><span class="pricebox-price">$${p.prices.annual}<span style="font-size:18px;font-weight:600;color:var(--ink-400);">/월</span></span><span class="pricebox-sub">12개월 기준 · 개별 합계 <s>$${p.sum}/월</s></span></div>
      ${rows}
      <p class="pricebox-secure">🎁 6개월: 셋업 $${gifts.six.value} 무료 · 12개월: 셋업 $${gifts.annual.value} 무료${p.slug === 'local-premium' ? ` (${gifts.premiumAnnualExtra})` : ''}<br>장기 플랜 30일 만족 보장 — 해지 시 잔여 환불(제공분 정가 차감)</p>
    </div>
  </div>
</header>
<section class="detail-body">
  <div class="container-narrow">
    <h2 class="h2-left">플랜에 포함된 것</h2>
    <ul class="includes-list">${p.includes.map((i) => `<li>${i}</li>`).join('')}</ul>
    <h2 class="h2-left">장기 플랜 무료 셋업</h2>
    <ul class="includes-list">
      ${gifts.six.items.map((i) => `<li><b>6개월+</b> ${i}</li>`).join('')}
      ${gifts.annual.items.slice(1).map((i) => `<li><b>12개월</b> ${i}</li>`).join('')}
      ${p.slug === 'local-premium' ? `<li><b>12개월</b> ${gifts.premiumAnnualExtra}</li>` : ''}
    </ul>
    <div class="detail-desc">
      <p>온보딩 순서: 1개월차에 프로필 최적화·리뷰 QR·로컬 등록을 마치고, 2개월차에 웹사이트·지역 페이지를 제작합니다. 월간 서비스(포스팅·리뷰·소재 등)는 결제 직후 질문지 제출과 함께 바로 시작됩니다.</p>
      <p>모든 결과물은 전문가 검수 후 전달되며, 매달 초 성과 리포트로 진행 상황을 숫자로 확인하실 수 있습니다.</p>
    </div>
  </div>
</section>
<section class="section section-gray">
  <div class="container-narrow">
    <h2 class="h2">다른 플랜과 비교하기</h2>
    <div class="hero-ctas"><a href="/pricing/#plans" class="btn btn-primary">전체 플랜 보기</a></div>
  </div>
</section>
` + FOOTER;
}

/* ---------- 페이지: 홈 ---------- */

function homePage() {
  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'ProfessionalService',
      name: 'BizHigher',
      alternateName: '비즈하이어',
      url: SITE.domain,
      email: SITE.email,
      description: '미국 한인 비즈니스를 위한 AI 광고회사 — 구글 지도 노출, 리뷰 관리, SNS 포스팅, 웹사이트 제작, 광고 운영을 AI 자동화와 전문가 검수로 대행사 절반 이하 가격에 정찰제로 제공합니다.',
      slogan: SITE.tagline,
      areaServed: { '@type': 'Country', name: 'United States' },
      availableLanguage: ['Korean', 'English'],
      priceRange: '$19 - $999',
      knowsAbout: ['로컬 SEO', '구글 비즈니스 프로필 최적화', 'AI 검색 최적화(AIO)', '리뷰 관리', '웹사이트 제작', 'Google Ads', '한인 비즈니스 마케팅'],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: DATA.faqs.map((f) => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
    },
  ];
  return head({
    title: 'BizHigher — 한인 비즈니스를 위한 AI 마케팅·광고회사 | 대행사 절반 이하 가격',
    description: 'AI가 만들고 광고 전문가가 검수합니다. 대행사 절반 이하 가격으로 10배 빠르게 — 견적 미팅 없는 정찰제. 미국 전역 한인 비즈니스를 위한 AI 광고회사.',
    pathName: '/',
    jsonLd,
  }) + nav('home') + `
<header class="hero hero-cine" id="cine-hero">
  <div class="hero-sticky" id="cine-sticky">
  <div class="cine-stage1" aria-hidden="true">
    <div class="cine-pins" id="cine-pins"></div>
    <div class="cine-origin" id="cine-origin">
      <div class="cine-ring cr1"></div>
      <div class="cine-ring cr2"></div>
      <div class="cine-ring cr3"></div>
      <div class="cine-ring cr4"></div>
      <div class="cine-seed" id="cine-seed"></div>
    </div>
    <div class="cine-center" id="cine-center">
      <div class="cine-word" id="cine-word">Biz<span class="grad" id="cine-higher">Higher</span></div>
      <p class="cine-tag">AI AUTOMATION MARKETING — 내 비즈니스를 한 단계 위로</p>
    </div>
    <div class="cine-beat" id="cine-b1">당신의 비즈니스를 <b>더 멀리,</b></div>
    <div class="cine-beat" id="cine-b2"><b>더 많은 손님에게.</b></div>
    <div class="cine-beat cine-beat-brand" id="cine-b3"><span class="grad">Biz, Higher.</span><small>내 비즈니스를 한 단계 위로</small></div>
    <div class="cine-hint">SCROLL<span class="cine-chev">⌄</span></div>
  </div>
  <div class="cine-stage2">
  <div class="container hero-grid">
    <div class="hero-copy">
      <span class="hero-badge">🇺🇸 한인 비즈니스를 위한 AI 광고회사</span>
      <h1 class="h1 h1-hero">광고 대행사 절반 이하의 가격으로,<br><span class="grad">10배 빠르게.</span></h1>
      <p class="hero-sub">AI가 만들고 광고 전문가가 검수합니다. 사람만 쓰는 회사보다 빠르고, 저렴하고, 24시간 쉬지 않습니다. 견적 미팅 없는 광고 마케팅, 지금 주문하세요.</p>
      <div class="hero-ctas">
        <a href="/free-audit/" class="btn btn-primary">무료 AI 진단 받기</a>
        <a href="/services/" class="btn btn-ghost">서비스 둘러보기</a>
      </div>
    </div>
    <div class="hero-demo" aria-hidden="true">
      <div class="demo-card" id="demo-card">
        <div class="demo-top"><span class="demo-dot"></span>AI 마케팅 진단 리포트<span class="demo-live">LIVE</span></div>
        <div class="demo-name"><span id="dm-type"></span><span class="demo-caret"></span></div>
        <div class="demo-score-row">
          <div class="demo-ring" id="dm-ring"><div class="demo-ring-in"><b id="dm-score">0</b><small>/100</small></div></div>
          <div class="demo-bars">
            <div class="demo-bar"><span>구글 노출</span><div class="demo-track"><div class="demo-fill" data-w="82"></div></div><b>82</b></div>
            <div class="demo-bar"><span>리뷰·평판</span><div class="demo-track"><div class="demo-fill" data-w="61"></div></div><b>61</b></div>
            <div class="demo-bar"><span>웹사이트</span><div class="demo-track"><div class="demo-fill" data-w="45"></div></div><b>45</b></div>
            <div class="demo-bar"><span>SNS</span><div class="demo-track"><div class="demo-fill" data-w="38"></div></div><b>38</b></div>
            <div class="demo-bar"><span>경쟁사 대비</span><div class="demo-track"><div class="demo-fill" data-w="68"></div></div><b>68</b></div>
          </div>
        </div>
        <div class="demo-chips">
          <div class="demo-chip">🔎 경쟁사 대비 리뷰 32개 부족</div>
          <div class="demo-chip">📸 프로필 사진 6개월째 업데이트 없음</div>
        </div>
        <div class="demo-plan" id="dm-plan"><span id="dm-plan-txt">🚀 180일 실행 플랜 시작</span></div>
      </div>
    </div>
  </div>
  <div class="marquee"><div class="marquee-track" id="mq-track">
    <span>식당</span><span>·</span><span>카페</span><span>·</span><span>베이커리</span><span>·</span><span>마켓</span><span>·</span><span>뷰티살롱</span><span>·</span><span>네일샵</span><span>·</span><span>스킨케어</span><span>·</span><span>마사지</span><span>·</span><span>안경점</span><span>·</span><span>치과</span><span>·</span><span>한의원</span><span>·</span><span>병원</span><span>·</span><span>약국</span><span>·</span><span>학원</span><span>·</span><span>태권도장</span><span>·</span><span>부동산</span><span>·</span><span>융자</span><span>·</span><span>보험</span><span>·</span><span>세무사</span><span>·</span><span>변호사</span><span>·</span><span>회계사</span><span>·</span><span>꽃집</span><span>·</span><span>사진관</span><span>·</span><span>세탁소</span><span>·</span><span>정비소</span><span>·</span><span>HVAC</span><span>·</span><span>이사·무빙</span><span>·</span><span>청소업체</span><span>·</span>
  </div></div>
  <div class="chan-row" aria-hidden="true">
    <span class="chan-label">당신의 가게가 발견되는 곳</span>
    <div class="chan-marquee"><div class="chan-track" id="chan-track">
      <span class="chan" style="--cdot:#4285F4">Google</span>
      <span class="chan" style="--cdot:#34A853;animation-delay:.4s">Google Maps</span>
      <span class="chan" style="--cdot:#03C75A;animation-delay:.8s">네이버</span>
      <span class="chan" style="--cdot:#0078D4;animation-delay:1.2s">Bing</span>
      <span class="chan" style="--cdot:#A2AAAD;animation-delay:1.6s">Apple Maps</span>
      <span class="chan" style="--cdot:#FEE500;animation-delay:2s">카카오맵</span>
      <span class="chan" style="--cdot:#33CCFF;animation-delay:2.4s">Waze</span>
      <span class="chan" style="--cdot:#10A37F;animation-delay:2.8s">ChatGPT</span>
      <span class="chan" style="--cdot:#4E82EE;animation-delay:3.2s">Gemini</span>
      <span class="chan" style="--cdot:#20B8CD;animation-delay:3.6s">Perplexity</span>
      <span class="chan" style="--cdot:#D97757;animation-delay:4s">Claude</span>
      <span class="chan" style="--cdot:#7B83EB;animation-delay:.2s">Copilot</span>
      <span class="chan" style="--cdot:#5AC8FA;animation-delay:.6s">Siri</span>
      <span class="chan" style="--cdot:#00CAFF;animation-delay:1s">Alexa</span>
      <span class="chan" style="--cdot:#EA4335;animation-delay:1.4s">Google Assistant</span>
      <span class="chan" style="--cdot:#E1306C;animation-delay:1.8s">Instagram</span>
      <span class="chan" style="--cdot:#1877F2;animation-delay:2.2s">Facebook</span>
      <span class="chan" style="--cdot:#FF0000;animation-delay:2.6s">YouTube</span>
      <span class="chan" style="--cdot:#69C9D0;animation-delay:3s">TikTok</span>
      <span class="chan" style="--cdot:#D32323;animation-delay:3.4s">Yelp</span>
      <span class="chan" style="--cdot:#8ED500;animation-delay:3.8s">Nextdoor</span>
      <span class="chan" style="--cdot:#34E0A1;animation-delay:4.1s">TripAdvisor</span>
    </div></div>
  </div>
  </div><!-- /cine-stage2 -->
  </div><!-- /hero-sticky -->
</header>
<script>
/* 시네마틱 히어로 v17.1 — i점 원점 리플 + 손님 신호 칩 + 3박자 메시지
   데스크톱(992px+)·모션 허용 시에만 활성. 실패·미지원 시 기본 히어로 그대로 표시 */
(function () {
  try {
    var hero = document.getElementById('cine-hero');
    if (!hero) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var narrow = window.matchMedia('(max-width: 991px)').matches;
    var sticky = document.getElementById('cine-sticky');
    var s1 = hero.querySelector('.cine-stage1');
    var s2 = hero.querySelector('.cine-stage2');
    var center = document.getElementById('cine-center');
    var higher = document.getElementById('cine-higher');
    var origin = document.getElementById('cine-origin');
    var seed = document.getElementById('cine-seed');
    var rings = hero.querySelectorAll('.cine-ring');
    var pinsWrap = document.getElementById('cine-pins');
    var beats = [document.getElementById('cine-b1'), document.getElementById('cine-b2'), document.getElementById('cine-b3')];
    if (!sticky || !s1 || !s2 || !center || !higher || !origin || !pinsWrap) return;

    /* 모바일/좁은 화면: 히어로 메인 카피는 데스크톱처럼 오버레이로 떠오르고,
       데모 카드·마퀴·채널만 스티키 종료 지점 바로 아래 일반 흐름으로 분리 (빈 구간 제거) */
    var track = hero;
    if (narrow) {
      track = document.createElement('div');
      track.className = 'cine-track';
      hero.insertBefore(track, sticky);
      track.appendChild(sticky);
      var flow = document.createElement('div');
      flow.className = 'cine-flow';
      ['.hero-demo', '.marquee', '.chan-row'].forEach(function (sel) {
        var el = s2.querySelector(sel);
        if (el) flow.appendChild(el);
      });
      hero.appendChild(flow);
      hero.classList.add('cine-narrow');
    }

    /* 손님 행동 신호 핀 — chip: 라벨 있는 신호, dot: 밀도용 글로우 핀 (x,y = 화면 %) */
    var PINS = [
      { x: 68, y: 26, label: '📞 전화 문의' },
      { x: 34, y: 34, label: '🧭 길찾기 +1' },
      { x: 80, y: 56, label: '⭐ 새 리뷰 5.0', edge: true },
      { x: 22, y: 62, label: '📅 예약 요청' },
      { x: 55, y: 80, label: '👀 프로필 조회 +12' },
      { x: 12, y: 24, label: '💬 "영업하나요?"', edge: true },
      { x: 45, y: 16 }, { x: 88, y: 34 }, { x: 90, y: 76 }, { x: 8, y: 46 },
      { x: 28, y: 82 }, { x: 70, y: 88 }, { x: 16, y: 78 }, { x: 84, y: 12 }, { x: 40, y: 60 },
    ];
    PINS.forEach(function (pn) {
      var el = document.createElement('div');
      el.className = 'cine-pin' + (pn.label ? ' cine-chip' : '') + (pn.edge ? ' edge' : '');
      el.style.left = pn.x + '%';
      el.style.top = pn.y + '%';
      el.innerHTML = pn.label ? '<i></i><span>' + pn.label + '</span>' : '<i></i>';
      pinsWrap.appendChild(el);
      pn.el = el;
    });

    var ox = 0, oy = 0, maxR = 1, seedPx = 22, ringBase = 1;
    function layout() {
      /* "Higher"의 i(인덱스 1) 글자 위 점 좌표를 실측해 원점으로 */
      var node = higher.firstChild;
      var range = document.createRange();
      range.setStart(node, 1); range.setEnd(node, 2);
      var ir = range.getBoundingClientRect();
      var sr = sticky.getBoundingClientRect();
      ox = ir.left - sr.left + ir.width * 0.56;
      /* i의 점(tittle) 중심: 폰트 어센트 박스 기준 상단에서 약 24% 지점 (실측 보정값) */
      oy = ir.top - sr.top + ir.height * 0.215;
      seedPx = Math.max(16, ir.width * 0.8);
      seed.style.width = seedPx + 'px'; seed.style.height = seedPx + 'px';
      origin.style.left = ox + 'px'; origin.style.top = oy + 'px';
      var w = sr.width, h = sr.height;
      maxR = Math.max(Math.hypot(ox, oy), Math.hypot(w - ox, oy), Math.hypot(ox, h - oy), Math.hypot(w - ox, h - oy));
      ringBase = rings[0] ? rings[0].offsetWidth : 200;
      PINS.forEach(function (pn) {
        pn.dist = Math.hypot(w * pn.x / 100 - ox, h * pn.y / 100 - oy);
      });
    }

    function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
    function seg(p, a, b) { return clamp((p - a) / (b - a), 0, 1); }
    function beat(p, i1, i2, o1, o2) { return seg(p, i1, i2) * (1 - seg(p, o1, o2)); }
    var ticking = false;
    function frame() {
      ticking = false;
      var r = track.getBoundingClientRect();
      var total = r.height - window.innerHeight;
      var p = total > 0 ? clamp(-r.top / total, 0, 1) : 1;

      /* 워드마크: i점만 남기고 일찍 퇴장 */
      center.style.opacity = String(1 - seg(p, 0.06, 0.18));
      center.style.transform = 'scale(' + (1 + seg(p, 0, 0.2) * 0.12) + ')';

      /* 씨앗 점: 깨어나서 커지다가 파동에 자리를 내줌 */
      var wake = seg(p, 0.03, 0.16);
      seed.style.transform = 'translate(-50%,-50%) scale(' + (1 + wake * 7) + ')';
      seed.style.opacity = String(0.95 * (1 - seg(p, 0.3, 0.44)));

      /* 파동 링 4개 — 순차 확장, 퍼질수록 옅어짐 */
      var grow = seg(p, 0.06, 0.56);
      var radius = grow * maxR * 1.08;
      rings.forEach(function (rg, i) {
        var rp = clamp(grow * 1.35 - i * 0.17, 0, 1);
        var sc = Math.max(0.02, rp * (2.15 * maxR) / ringBase);
        rg.style.transform = 'translate(-50%,-50%) scale(' + sc + ')';
        rg.style.opacity = String(rp > 0 ? 0.65 * (1 - rp) + 0.05 : 0);
      });

      /* 신호 핀 점등 — 파동이 닿는 순서대로 (되감으면 역순 소등) */
      PINS.forEach(function (pn) {
        pn.el.classList.toggle('lit', radius >= pn.dist && p < 0.74);
      });

      /* 3박자 메시지 (1·2박자) */
      beats[0].style.opacity = String(beat(p, 0.18, 0.24, 0.32, 0.38));
      beats[1].style.opacity = String(beat(p, 0.36, 0.42, 0.5, 0.56));
      [0, 1].forEach(function (i) {
        var bp = [seg(p, 0.18, 0.24), seg(p, 0.36, 0.42)][i];
        beats[i].style.transform = 'translate(-50%,-50%) translateY(' + (22 * (1 - bp)) + 'px)';
      });

      /* 3박자(Biz, Higher.) — 등장 후 좌상단 네비 로고로 날아가 도킹 */
      var bIn = seg(p, 0.54, 0.6);
      var f = seg(p, 0.66, 0.78);
      var fe = f * f * (3 - 2 * f); /* smoothstep */
      var b3 = beats[2];
      var logo = document.querySelector('.nav .logo');
      var dx = 0, dy = 0;
      if (logo && f > 0) {
        var lr = logo.getBoundingClientRect();
        dx = (lr.left + lr.width / 2 - window.innerWidth / 2) * fe;
        dy = (lr.top + lr.height / 2 - window.innerHeight / 2) * fe;
      }
      var sc3 = 1 - fe * 0.85;
      b3.style.opacity = String(bIn * (1 - seg(f, 0.88, 1)));
      b3.style.transform = 'translate(calc(-50% + ' + dx.toFixed(1) + 'px), calc(-50% + ' + dy.toFixed(1) + 'px)) translateY(' + (22 * (1 - bIn) * (1 - fe)) + 'px) scale(' + sc3.toFixed(3) + ')';
      var b3small = b3.querySelector('small');
      if (b3small) b3small.style.opacity = String(1 - seg(p, 0.64, 0.68));
      /* 도킹 순간 로고 반짝 */
      if (logo) {
        if (f >= 1 && !window.__bhDocked) {
          window.__bhDocked = true;
          logo.classList.add('logo-pop');
          setTimeout(function () { logo.classList.remove('logo-pop'); }, 800);
        } else if (f < 0.9) { window.__bhDocked = false; }
      }

      /* 스테이지1 → 스테이지2 전환 (모든 화면 동일 타이밍) */
      s1.style.opacity = String(1 - seg(p, 0.74, 0.84));
      s1.style.visibility = p > 0.86 ? 'hidden' : 'visible';
      var e2 = seg(p, 0.74, 0.88);
      s2.style.opacity = String(e2);
      s2.style.transform = 'translateY(' + (44 * (1 - e2)) + 'px)';
      s2.style.pointerEvents = e2 > 0.5 ? 'auto' : 'none';

      /* 마무리 축소 */
      var e3 = seg(p, 0.92, 1);
      sticky.style.transform = 'scale(' + (1 - 0.05 * e3) + ')';
      sticky.style.borderRadius = (36 * e3) + 'px';
    }
    function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(frame); } }
    hero.classList.add('cine-on');
    layout();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', function () { layout(); onScroll(); }, { passive: true });
    frame();
  } catch (e) {
    var h = document.getElementById('cine-hero');
    if (h) h.classList.remove('cine-on');
  }
})();
</script>
<script>
/* 히어로 라이브 리포트 데모 — reduced-motion이면 완성 상태로 정적 표시 */
(function () {
  // 마퀴 무한 루프용 콘텐츠 복제 — 트랙이 화면 폭의 2배 이상이 될 때까지 (초와이드 대응)
  ['mq-track', 'chan-track'].forEach(function (id) {
    var t = document.getElementById(id);
    if (!t) return;
    var unit = t.innerHTML;
    var guard = 0;
    while (t.scrollWidth < window.innerWidth * 2 && guard < 6) { t.innerHTML += unit; guard++; }
    t.innerHTML += t.innerHTML; // 최종 2배 — translateX(-50%) 루프 기준
  });
  var typeEl = document.getElementById('dm-type');
  if (!typeEl) return;
  var scoreEl = document.getElementById('dm-score');
  var ring = document.getElementById('dm-ring');
  var fills = Array.prototype.slice.call(document.querySelectorAll('.demo-fill'));
  var fillNums = Array.prototype.slice.call(document.querySelectorAll('.demo-bar > b'));
  var chips = Array.prototype.slice.call(document.querySelectorAll('.demo-chip'));
  var planBtn = document.getElementById('dm-plan');
  var planTxt = document.getElementById('dm-plan-txt');
  // 비포/애프터 스토리 — 형편없는 진단 → 플랜 시작 버튼 클릭 → 180일 뒤 극적 반전
  var BIZ = [
    { name: '가든그로브 안경점', s0: 41, s1: 94, b0: [48, 34, 45, 22, 39], b1: [96, 91, 88, 82, 95],
      prob: ['🔎 경쟁사 대비 리뷰 32개 부족', '📸 프로필 사진 6개월째 업데이트 없음'],
      win:  ['⭐ 리뷰 187개 — 동네 안경점 1위', '📸 매주 새 사진·게시물 자동 업로드'] },
    { name: '애틀랜타 수학학원', s0: 29, s1: 92, b0: [31, 42, 25, 12, 33], b1: [93, 89, 86, 90, 88],
      prob: ['🏷️ 구글 카테고리 "일반 학교"로 잘못 분류', '📱 SNS 계정 없음 — 학부모 접점 부재'],
      win:  ['🏷️ "수학학원" 지도 검색 최상단 노출', '📱 인스타 학부모 팔로워 1,200+'] },
    { name: '달라스 한식당', s0: 37, s1: 95, b0: [44, 51, 18, 35, 40], b1: [97, 94, 90, 87, 93],
      prob: ['🌐 웹사이트 없음 — 메뉴·영업시간 못 찾음', '🔎 "korean bbq near me" 순위권 밖'],
      win:  ['🌐 예약되는 웹사이트 — 월 방문 2,400', '🔎 "korean bbq near me" 첫 화면 노출'] },
    { name: 'LA 네일살롱', s0: 33, s1: 91, b0: [38, 29, 30, 41, 35], b1: [92, 90, 85, 94, 89],
      prob: ['💬 미답글 리뷰 9개 — 신뢰도 하락 요인', '📉 신규 손님 문의 월 6건'],
      win:  ['💬 모든 리뷰 24시간 내 답글 자동화', '📈 신규 문의 월 31건 — 5배 증가'] },
  ];
  var bi = 0;
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function setBars(vals, animate) {
    fills.forEach(function (f, i) {
      f.setAttribute('data-w', vals[i]);
      if (animate) f.style.width = vals[i] + '%';
    });
    fillNums.forEach(function (n, i) { n.textContent = vals[i]; });
  }
  function setChips(texts, ok, show) {
    chips.forEach(function (c, i) {
      c.textContent = texts[i];
      c.classList.toggle('demo-chip-ok', !!ok);
      c.classList.toggle('demo-chip-warn', !ok);
      if (show) c.classList.add('show');
    });
  }
  function countScore(from, to, ms) {
    var start = null;
    function step(ts) {
      if (!start) start = ts;
      var p = Math.min((ts - start) / ms, 1);
      var v = Math.round(from + (to - from) * (1 - Math.pow(1 - p, 3)));
      scoreEl.textContent = v;
      if (ring) ring.style.setProperty('--p', v);
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
  function setFinal() {
    var b = BIZ[0];
    typeEl.textContent = b.name;
    scoreEl.textContent = b.s1;
    if (ring) ring.style.setProperty('--p', b.s1);
    setBars(b.b1, true);
    setChips(b.win, true, true);
    if (planBtn) { planBtn.classList.add('show', 'done'); planTxt.textContent = '✓ 180일 실행 플랜 완료'; }
  }
  if (reduced) { setFinal(); return; }
  var timers = [];
  function t(fn, ms) { timers.push(setTimeout(fn, ms)); }
  function reset() {
    timers.forEach(clearTimeout); timers = [];
    typeEl.textContent = ''; scoreEl.textContent = '0';
    if (ring) ring.style.setProperty('--p', 0);
    fills.forEach(function (f) { f.style.width = '0%'; });
    chips.forEach(function (c) { c.classList.remove('show'); });
    if (planBtn) {
      planBtn.classList.remove('show', 'press', 'done', 'running');
      planTxt.textContent = '🚀 180일 실행 플랜 시작';
    }
  }
  function run() {
    reset();
    var b = BIZ[bi % BIZ.length];
    bi++;
    // ── BEFORE: 형편없는 진단 ──
    setBars(b.b0, false);
    setChips(b.prob, false, false);
    var i = 0;
    (function type() {
      if (i <= b.name.length) { typeEl.textContent = b.name.slice(0, i); i++; timers.push(setTimeout(type, 85)); }
    })();
    fills.forEach(function (f, idx) {
      t(function () { f.style.width = b.b0[idx] + '%'; }, 1300 + idx * 180);
    });
    t(function () { countScore(0, b.s0, 1100); }, 1400);
    t(function () { chips[0].classList.add('show'); }, 2700);
    t(function () { chips[1].classList.add('show'); }, 3400);
    // ── 버튼 등장 → 클릭 연출 ──
    t(function () { if (planBtn) planBtn.classList.add('show'); }, 4200);
    t(function () { if (planBtn) planBtn.classList.add('press'); }, 5200);
    t(function () { if (planBtn) planBtn.classList.remove('press'); }, 5440);
    // ── AFTER: DAY 카운트 + 점수 급상승 + 문제→장점 반전 ──
    t(function () {
      if (planBtn) planBtn.classList.add('running');
      var start = null;
      function day(ts) {
        if (!start) start = ts;
        var p = Math.min((ts - start) / 1500, 1);
        planTxt.textContent = '플랜 진행 중 · DAY ' + Math.max(1, Math.round(180 * p));
        if (p < 1) requestAnimationFrame(day);
      }
      requestAnimationFrame(day);
      countScore(b.s0, b.s1, 1600);
      fills.forEach(function (f, idx) {
        t(function () { f.style.width = b.b1[idx] + '%'; }, idx * 120);
      });
      fillNums.forEach(function (n, idx) { t(function () { n.textContent = b.b1[idx]; }, 600 + idx * 120); });
    }, 5600);
    t(function () { chips[0].classList.add('swap'); }, 6100);
    t(function () { chips[0].textContent = b.win[0]; chips[0].classList.add('demo-chip-ok'); chips[0].classList.remove('demo-chip-warn', 'swap'); }, 6350);
    t(function () { chips[1].classList.add('swap'); }, 6700);
    t(function () { chips[1].textContent = b.win[1]; chips[1].classList.add('demo-chip-ok'); chips[1].classList.remove('demo-chip-warn', 'swap'); }, 6950);
    t(function () {
      if (planBtn) { planBtn.classList.remove('running'); planBtn.classList.add('done'); }
      planTxt.textContent = '✓ 180일 실행 플랜 완료';
    }, 7300);
    // ── 홀드 후 다음 비즈니스 ──
    t(run, 13000);
  }
  run();
})();
</script>

<section class="section section-gray">
  <div class="container">
    <p class="eyebrow">HOW IT WORKS</p>
    <h2 class="h2">대행사 미팅은 없습니다</h2>
    <div class="stack-zone">
      <div class="stack-card"><span class="stack-num">01</span><h3 class="stack-title">쇼핑하듯 주문</h3><p class="stack-desc">모든 가격이 공개돼 있습니다. 견적 미팅 0번, 영업 전화 0통 — 대행사 계약에 쓰던 2주를 클릭 몇 번으로 끝내세요.</p></div>
      <div class="stack-card stack-c2"><span class="stack-num">02</span><h3 class="stack-title">AI 제작 + 전문가 검수</h3><p class="stack-desc">AI가 몇 시간 만에 초안을 만들고, 광고 전문가가 전략과 디테일을 잡습니다. 대행사 품질은 그대로, 인건비 거품은 뺐습니다 — AI를 제대로 쓰는 회사만 낼 수 있는 가격입니다.</p></div>
      <div class="stack-card stack-c3"><span class="stack-num">03</span><h3 class="stack-title">받고 끝이 아닙니다</h3><p class="stack-desc">영업일 3일 내 딜리버리, 수정 1회 무료. 구독이면 AI가 24시간 데이터를 지켜보며 매주 최적화 사이클이 자동으로 돕니다.</p></div>
    </div>
  </div>
</section>

<section class="section vs-section">
  <div class="container">
    <p class="eyebrow">WHY AI AGENCY</p>
    <h2 class="h2">대행사와 비교하지 마세요</h2>
    <p class="vs-sub">사람만 쓰는 대행사와 AI 광고회사는 구조가 다릅니다. 구조가 다르면, 가격과 속도가 다릅니다.</p>
    <div class="vs-table" role="table" aria-label="일반 대행사와 BizHigher 비교">
      <div class="vs-c vs-lab vs-head-lab"></div>
      <div class="vs-c vs-old vs-head">일반 대행사</div>
      <div class="vs-c vs-bh vs-head vs-bh-head"><span class="vs-logo">Biz<b>Higher</b></span><span class="vs-badge">AI 광고회사</span></div>
      <div class="vs-c vs-lab">시작까지</div>
      <div class="vs-c vs-old"><i>—</i>미팅 · 견적 · 계약, 보통 2주+</div>
      <div class="vs-c vs-bh"><i>✓</i>온라인 주문 — 오늘 바로 시작</div>
      <div class="vs-c vs-lab">첫 결과물</div>
      <div class="vs-c vs-old"><i>—</i>2~4주</div>
      <div class="vs-c vs-bh"><i>✓</i>영업일 3일</div>
      <div class="vs-c vs-lab">비용</div>
      <div class="vs-c vs-old"><i>—</i>월 리테이너 $1,500~</div>
      <div class="vs-c vs-bh"><i>✓</i>월 $219부터 · 정찰제</div>
      <div class="vs-c vs-lab">모니터링</div>
      <div class="vs-c vs-old"><i>—</i>담당자 근무시간에만</div>
      <div class="vs-c vs-bh"><i>✓</i>AI 24시간 + 전문가 검수</div>
      <div class="vs-c vs-lab">해지</div>
      <div class="vs-c vs-old"><i>—</i>전화 · 위약금</div>
      <div class="vs-c vs-bh vs-bh-last"><i>✓</i>클릭 2번, 언제든</div>
    </div>
    <p class="vs-note">* 일반 대행사 항목은 미국 로컬 마케팅 대행사의 일반적인 계약 조건 기준입니다. <a href="/pricing/">BizHigher 정찰제 가격표 보기 →</a></p>
  </div>
</section>

<section class="section acc-section">
  <div class="container">
    <p class="eyebrow">EXPERTISE</p>
    <h2 class="h2">BizHigher가 잘하는 것</h2>
    <div class="acc" id="acc">
      <a class="acc-item" href="/service/seo-aio/" style="--ga:#0A4DF5;--gb:#062B8F;">
        <span class="acc-num">01</span><span class="acc-title">로컬 SEO · AIO</span>
        <span class="acc-body">구글 지도와 AI 검색(ChatGPT) 모두에서 발견되게 만듭니다. 경쟁사 갭 분석으로 시작하는 데이터 기반 최적화.<b>자세히 보기 →</b></span>
      </a>
      <a class="acc-item" href="/service/website/" style="--ga:#22D3EE;--gb:#0A4DF5;">
        <span class="acc-num">02</span><span class="acc-title">웹사이트 제작</span>
        <span class="acc-body">호스팅비 $0, 영업일 3~7일. 예약·주문까지 되는 사이트를 정찰제로. 유지관리 구독으로 계속 관리됩니다.<b>자세히 보기 →</b></span>
      </a>
      <a class="acc-item" href="/service/gbp-posting/" style="--ga:#7C5CFF;--gb:#3B1FA8;">
        <span class="acc-num">03</span><span class="acc-title">콘텐츠 · 포스팅</span>
        <span class="acc-body">구글 프로필 + 인스타 + 페이스북에 매주 콘텐츠가 올라갑니다. 블로그까지 더하면 검색 유입이 복리로 쌓입니다.<b>자세히 보기 →</b></span>
      </a>
      <a class="acc-item" href="/service/shortform-video/" style="--ga:#2F6BFF;--gb:#0B1B66;">
        <span class="acc-num">04</span><span class="acc-title">숏폼 · 광고 소재</span>
        <span class="acc-body">릴스·틱톡용 AI 영상과 매달 새 광고 이미지. 촬영팀 없이 광고급 크리에이티브를 구독으로.<b>자세히 보기 →</b></span>
      </a>
      <a class="acc-item" href="/service/ads-management/" style="--ga:#0839C4;--gb:#050A3F;">
        <span class="acc-num">05</span><span class="acc-title">광고 운영</span>
        <span class="acc-body">구글·메타·빙 광고를 전환 데이터 기반으로 매주 최적화. 동시 5곳 한정으로 품질을 지킵니다.<b>자세히 보기 →</b></span>
      </a>
    </div>
  </div>
</section>
<script>
/* 아코디언 — 터치·클릭 대응 (기본 1번 활성, 링크 이동은 활성 상태에서만) */
(function () {
  var acc = document.getElementById('acc');
  if (!acc) return;
  var items = acc.querySelectorAll('.acc-item');
  if (items.length) items[0].classList.add('on');
  items.forEach(function (it) {
    it.addEventListener('click', function (e) {
      if (!it.classList.contains('on')) {
        e.preventDefault();
        items.forEach(function (o) { o.classList.remove('on'); });
        it.classList.add('on');
      }
    });
    it.addEventListener('mouseenter', function () {
      if (window.matchMedia('(max-width: 991px)').matches) return;
      items.forEach(function (o) { o.classList.remove('on'); });
      it.classList.add('on');
    });
  });
  /* 좁은 화면: 스크롤 위치에 따라 카드가 순서대로 하나씩 확장 */
  var accTick = false;
  function accScroll() {
    accTick = false;
    if (!window.matchMedia('(max-width: 991px)').matches) return;
    var r = acc.getBoundingClientRect();
    if (r.bottom < 0 || r.top > window.innerHeight) return;
    var pr = (window.innerHeight * 0.55 - r.top) / r.height;
    var idx = Math.max(0, Math.min(items.length - 1, Math.floor(pr * items.length)));
    items.forEach(function (o, i) { o.classList.toggle('on', i === idx); });
  }
  window.addEventListener('scroll', function () {
    if (!accTick) { accTick = true; requestAnimationFrame(accScroll); }
  }, { passive: true });
  accScroll();
})();
</script>

<section class="section">
  <div class="container">
    <p class="eyebrow">SERVICES</p>
    <h2 class="h2">지금 필요한 게 뭐예요?</h2>
    <div class="grid3">
      ${DATA.services.slice(0, 8).map(productCard).join('')}
      <a href="/services/" class="prod-card prod-card-more">
        <h3 class="h3">전체 ${DATA.services.length}개 서비스 보기 →</h3>
        <p class="body-sm">원타임부터 월 구독까지 — 필요한 것만 골라 담으세요.</p>
      </a>
    </div>
  </div>
</section>

<section class="section section-navy">
  <div class="container">
    <h2 class="h2">AI 광고회사의 숫자</h2>
    <div class="grid3">
      <div class="stat-box"><div class="stat" data-count="3" data-suffix="일">3일</div><p class="stat-label">대행사 평균 2~4주 걸리는 결과물을 영업일 3일에</p></div>
      <div class="stat-box"><div class="stat" data-count="24" data-suffix="시간">24시간</div><p class="stat-label">AI는 퇴근하지 않습니다 — 데이터 모니터링·자동화 상시 가동</p></div>
      <div class="stat-box"><div class="stat" data-count="58" data-suffix="%">58%</div><p class="stat-label">개별 구매 대비 12개월 플랜 절감률 — 정찰제라 계산이 됩니다</p></div>
    </div>
  </div>
</section>

<section class="section">
  <div class="container">
    <p class="eyebrow">PLANS</p>
    <h2 class="h2">통째로 맡기면 훨씬 저렴합니다</h2>
    <div class="grid3">
      ${DATA.packages.map((p) => `
      <div class="tier ${p.popular ? 'tier-pop' : ''}">
        ${p.popular ? '<div class="tier-badge">가장 인기</div>' : ''}
        <h3 class="h3">${p.name}</h3>
        <p class="pk-sum">개별 합계 <s>$${p.sum}/월</s></p>
        <div class="tier-price">$${p.prices.annual}<span class="tier-per">/월</span></div>
        <p class="body-sm">${p.tagline}</p>
        <p class="pk-total">12개월 기준 · 월간 $${p.prices.monthly}</p>
        <a href="/package/${p.slug}/" class="btn ${p.popular ? 'btn-primary' : 'btn-ghost'} btn-block">플랜 보기</a>
      </div>`).join('')}
    </div>
    <p class="note-text">🎁 12개월 플랜은 프로필 최적화 · 로컬 등록 · 웹사이트까지 셋업 무료 (최대 $1,014 상당) · <a href="/pricing/#plans" style="color:var(--blue-600);font-weight:700;">전체 비교 →</a></p>
  </div>
</section>

<section class="section">
  <div class="container-narrow">
    <h2 class="h2">자주 묻는 질문</h2>
    ${DATA.faqs.map((f) => `<div class="faq-item"><h3 class="faq-q">${f.q}</h3><p class="faq-a">${f.a}</p></div>`).join('')}
  </div>
</section>
` + FOOTER;
}

/* ---------- 페이지: 서비스 목록 ---------- */

function servicesPage() {
  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: '마케팅 서비스',
      url: `${SITE.domain}/services/`,
      inLanguage: 'ko',
      hasPart: DATA.services.map((s) => ({
        '@type': 'Service',
        name: s.name,
        url: `${SITE.domain}/service/${s.slug}/`,
        offers: { '@type': 'Offer', price: priceToNumber(s.price), priceCurrency: 'USD' },
      })),
    },
    breadcrumbList([
      { name: '홈', url: `${SITE.domain}/` },
      { name: '서비스', url: `${SITE.domain}/services/` },
    ]),
  ];
  return head({
    title: '마케팅 서비스 | BizHigher — 견적 문의 없는 정찰제',
    description: 'SEO 블로그, 구글 프로필 최적화, 광고 소재, 리뷰 관리까지. 미국 한인 비즈니스를 위한 마케팅을 쇼핑하듯 주문하세요. 모든 가격 공개.',
    pathName: '/services/',
    jsonLd,
  }) + nav('services') + `
<header class="page-head">
  <div class="container">
    <h1 class="page-title">서비스</h1>
    <p class="page-sub">모든 가격은 정찰제입니다. 견적 문의가 필요 없습니다.</p>
    <div class="banner"><span class="badge">🎁 장기 플랜</span><span class="banner-text">6·12개월 플랜 선택 시 셋업 서비스 무료 — 최대 $1,014 상당 <a href="/pricing/#plans" style="color:var(--blue-600);">플랜 비교 →</a></span></div>
  </div>
</header>
${[
  ['expose', '🔍 검색·지도·AI 노출', '구글, 지도, AI 검색 — 손님이 찾는 모든 곳에서 발견되게 합니다.', ''],
  ['content', '✍️ 콘텐츠·리뷰', '매주 쌓이는 콘텐츠와 관리되는 리뷰가 가게의 신뢰를 만듭니다.', 'section-gray'],
  ['ads', '📣 광고', '전환 추적 기반으로 광고비가 일하게 만듭니다.', ''],
  ['web', '🌐 웹사이트', '호스팅비 $0 — 만들고, 계속 관리해 드립니다.', 'section-gray'],
].map(([cat, title, sub, cls]) => `
<section class="section svc-cat ${cls}">
  <div class="container">
    <h2 class="h2-left">${title}</h2>
    <p class="svc-cat-sub">${sub}</p>
    <div class="grid3">
      ${DATA.services.filter((s) => s.cat === cat).map(productCard).join('')}
    </div>
  </div>
</section>`).join('')}

<section class="pkg-band">
  <div class="container center">
    <p class="eyebrow" style="color:var(--cyan-400);">PLANS</p>
    <h2 class="h2" style="color:#fff;">필요한 게 5개 이상이라면,<br>통째로가 답입니다</h2>
    <p class="pkg-band-sub">패키지 플랜은 개별 구독 대비 <b>최대 58% 저렴</b>하고, 12개월 플랜은 프로필 최적화부터 웹사이트까지 <b>셋업 $1,014 상당이 무료</b>입니다.</p>
    <div class="pkg-mini-row">
      ${DATA.packages.map((p) => `
      <a href="/package/${p.slug}/" class="pkg-mini ${p.popular ? 'pkg-mini-pop' : ''}">
        <span class="pkg-mini-name">${p.name}</span>
        <span class="pkg-mini-price">$${p.prices.annual}<small>/월</small></span>
        <span class="pkg-mini-note">12개월 기준 · <s>$${p.sum}</s></span>
      </a>`).join('')}
    </div>
    <div class="hero-ctas" style="margin-top:30px;"><a href="/pricing/#plans" class="btn btn-primary">플랜 비교하기 →</a></div>
  </div>
</section>
` + FOOTER;
}

/* ---------- 페이지: 가격 ---------- */

function pricingPage() {
  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: '가격 안내',
      url: `${SITE.domain}/pricing/`,
      inLanguage: 'ko',
      hasPart: DATA.packages.map((p) => ({
        '@type': 'Service',
        name: `${p.name} 플랜`,
        url: `${SITE.domain}/package/${p.slug}/`,
        offers: { '@type': 'Offer', price: p.prices.annual, priceCurrency: 'USD' },
      })),
    },
    breadcrumbList([
      { name: '홈', url: `${SITE.domain}/` },
      { name: '가격', url: `${SITE.domain}/pricing/` },
    ]),
  ];
  return head({
    title: '가격 안내 | BizHigher — 투명한 정찰제 마케팅',
    description: '숨은 비용도 견적 미팅도 없습니다. 원타임 $49부터 월 구독까지, 미국 한인 비즈니스 마케팅 전 상품 가격표.',
    pathName: '/pricing/',
    jsonLd,
  }) + nav('pricing') + `
<header class="page-head">
  <div class="container">
    <h1 class="page-title">투명한 정찰제</h1>
    <p class="page-sub">숨은 비용도, 견적 미팅도 없습니다. 모든 가격이 여기 있습니다.</p>
  </div>
</header>
${packageMatrixSection()}
<section class="section section-gray">
  <div class="container-narrow">
    <h2 class="h2">개별 구독</h2>
    <div class="price-list">
      ${DATA.services.filter((s) => s.type === 'subscription').map((s) => `<a href="/service/${s.slug}/" class="price-item"><span><span class="price-item-name">${s.name}</span><span class="price-item-meta">${s.delivery} · 언제든 해지</span></span><span class="price-item-price">${s.price}</span></a>`).join('')}
    </div>
    <p class="note-text">모든 구독은 Stripe 고객 포털에서 직접 해지할 수 있습니다 · 구독 고객 전원 월간 성과 리포트 무료</p>
  </div>
</section>
<section class="section">
  <div class="container-narrow">
    <h2 class="h2">원타임 서비스</h2>
    <div class="price-list">
      ${DATA.services.filter((s) => s.type !== 'subscription').map((s) => `<a href="/service/${s.slug}/" class="price-item"><span><span class="price-item-name">${s.name}</span><span class="price-item-meta">${s.delivery}</span></span><span class="price-item-price">${s.price === '$149~' ? '$149 / $249' : s.price}</span></a>`).join('')}
    </div>
    <p class="note-text">모든 원타임 상품에 수정 1회 무료 포함 · 작업 시작 전 전액 환불</p>
  </div>
</section>
` + FOOTER;
}

/* ---------- 페이지: 무료 진단 ---------- */

function auditPage() {
  return head({
    title: '무료 AI 마케팅 진단 — 내 가게 마케팅 점수 확인 | BizHigher',
    description: '60초 만에 우리 가게가 구글에서 어떻게 보이는지 AI가 분석해 드립니다. 가입 없이 무료로 진단받으세요.',
    pathName: '/free-audit/',
  }) + nav('audit') + `
<section class="audit-hero">
  <div class="container-narrow">
    <p class="eyebrow">무료 · 60초 · 가입 불필요</p>
    <h1 class="h1">내 가게 마케팅,<br>몇 점일까요?</h1>
    <p class="hero-sub">구글에서 우리 가게가 어떻게 보이는지 AI가 분석해 드립니다. 60초 안에 이 화면에서 바로 리포트가 열립니다.</p>
    <form class="audit-form" id="audit-form">
      <input type="text" name="business" placeholder="업체명 (예: 청기와 순두부)" class="input" required>
      <input type="text" name="location" placeholder="도시 또는 구글 프로필 링크" class="input" required>
      <input type="email" name="email" placeholder="이메일" class="input" required>
      <button type="submit" class="btn btn-primary btn-block">무료 진단 시작 →</button>
      <div class="form-msg" id="form-msg"></div>
    </form>
    <p class="note-text">분석에 20~40초 정도 걸립니다. 완료되면 리포트 화면으로 자동 이동합니다. 스팸은 보내지 않습니다.</p>
  </div>
</section>
<section class="section section-gray">
  <div class="container">
    <h2 class="h2">진단 리포트에 담기는 것</h2>
    <div class="grid3">
      <div class="step-card"><h3 class="h3">5개 영역 점수</h3><p class="body-sm">구글 노출 · 리뷰·평판 · 웹사이트 · SNS · 경쟁사 대비 — 100점 만점 채점</p></div>
      <div class="step-card"><h3 class="h3">가장 급한 문제 2가지</h3><p class="body-sm">왜 문제인지, 방치하면 어떻게 되는지, 무엇부터 고치면 되는지 설명합니다</p></div>
      <div class="step-card"><h3 class="h3">다음 단계 추천</h3><p class="body-sm">지금 상황에서 가장 효과적인 서비스를 추천해 드립니다 — 강요는 없습니다</p></div>
    </div>
  </div>
</section>
<script>
document.getElementById('audit-form').addEventListener('submit', async function (e) {
  e.preventDefault();
  const msg = document.getElementById('form-msg');
  const btn = this.querySelector('button');
  btn.disabled = true; btn.textContent = 'AI가 분석 중입니다... (최대 40초)';
  try {
    const body = Object.fromEntries(new FormData(this).entries());
    const res = await fetch('/api/audit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error('server');
    const result = await res.json();
    if (result.reportUrl) {
      btn.textContent = '리포트 여는 중...';
      window.location.href = result.reportUrl;
      return;
    }
    msg.className = 'form-msg success';
    msg.textContent = '접수되었습니다! 영업일 1일 안에 진단 리포트를 이메일로 보내드릴게요.';
    this.reset();
    btn.textContent = '접수 완료 ✓';
  } catch (err) {
    msg.className = 'form-msg error';
    msg.textContent = '일시적인 오류가 발생했습니다. 잠시 후 다시 시도하시거나 ${SITE.email} 로 보내주세요.';
    btn.disabled = false; btn.textContent = '무료 진단 시작 →';
  }
});
</script>
` + FOOTER;
}

/* ---------- 페이지: 서비스 상세 ---------- */

/* 구독 서비스 → 포함된 최저 플랜 매핑 (상세 페이지 업셀 배너용) */
const PLAN_OF = {
  'gbp-posting': 'local-starter', 'review-reply': 'local-starter', 'ad-creative-pack': 'local-starter',
  'local-listing-care': 'local-starter', 'care-plan': 'local-starter',
  'seo-aio': 'local-growth', 'shortform-video': 'local-growth',
  'ads-management': 'local-premium', 'seo-blog-pack': 'local-premium',
};

function planHint(s) {
  const pslug = PLAN_OF[s.slug];
  if (!pslug) return '';
  const p = DATA.packages.find((x) => x.slug === pslug);
  if (!p) return '';
  const disc = Math.round((1 - p.prices.annual / p.sum) * 100);
  return `
<div class="plan-hint">
  <span class="plan-hint-badge">플랜 포함</span>
  <span>이 서비스는 <b>${p.name} 플랜</b>에 포함되어 있습니다 — 묶으면 개별 대비 <b>${disc}% 절약</b> + 12개월 셋업 무료</span>
  <a href="/package/${p.slug}/">플랜 보기 →</a>
</div>`;
}

function servicePage(s, posts) {
  const url = `${SITE.domain}/service/${s.slug}/`;
  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'Service',
      name: s.name,
      description: s.shortDescription,
      provider: { '@type': 'Organization', name: 'BizHigher', url: SITE.domain },
      areaServed: { '@type': 'Country', name: 'United States' },
      url,
      offers: {
        '@type': 'Offer',
        price: priceToNumber(s.price),
        priceCurrency: 'USD',
        url,
        availability: 'https://schema.org/InStock',
        ...(s.type === 'subscription' ? { priceSpecification: { '@type': 'UnitPriceSpecification', price: priceToNumber(s.price), priceCurrency: 'USD', unitText: 'MONTH' } } : {}),
      },
    },
    breadcrumbList([
      { name: '홈', url: `${SITE.domain}/` },
      { name: '서비스', url: `${SITE.domain}/services/` },
      { name: s.name, url },
    ]),
  ];
  if (s.faqs && s.faqs.length) {
    jsonLd.push({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: s.faqs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
    });
  }
  const relatedPosts = (posts || []).filter((x) => x.related === s.slug).slice(0, 3);
  // Stripe 링크가 아직 없는 상품은 상담(이메일) CTA로 폴백
  const consultHref = `mailto:${SITE.email}?subject=${encodeURIComponent('[상담 신청] ' + s.name)}&body=${encodeURIComponent('업체명:\n연락처:\n궁금한 점:')}`;
  const optionA = s.stripeLinkA
    ? `<a href="${s.stripeLinkA}" class="btn btn-primary btn-block">${s.optionALabel}</a>`
    : `<a href="${consultHref}" class="btn btn-primary btn-block">${s.optionALabel || '상담 신청하기'}</a>`;
  const optionB = s.stripeLinkB
    ? `<a href="${s.stripeLinkB}" class="btn btn-ghost btn-block">${s.optionBLabel}</a>`
    : (s.optionBLabel ? `<a href="${consultHref}" class="btn btn-ghost btn-block">${s.optionBLabel}</a>` : '');
  const optionC = s.stripeLinkC
    ? `<a href="${s.stripeLinkC}" class="btn btn-ghost btn-block">${s.optionCLabel}</a>`
    : (s.optionCLabel ? `<a href="${consultHref}" class="btn btn-ghost btn-block">${s.optionCLabel}</a>` : '');
  return head({
    title: `${s.name} — ${s.price} | BizHigher`,
    description: s.shortDescription,
    pathName: `/service/${s.slug}/`,
    jsonLd,
  }) + nav('services') + `
<header class="detail-head">
  <div class="container-narrow">
    <a href="/services/" class="back-link">← 전체 서비스</a>
    ${badgeHtml(s)}
    <h1 class="detail-title">${s.name}</h1>
    <p class="detail-sub">${s.shortDescription}</p>
    <div class="pricebox">
      <div class="pricebox-row"><span class="pricebox-price">${s.price}</span><span class="pricebox-sub">${s.priceSub}</span></div>
      ${optionA}
      ${optionB}
      ${optionC}
      <p class="pricebox-secure">${s.stripeLinkA ? '🔒 Stripe 안전결제 · 수정 1회 무료 · ' + (s.type === 'subscription' ? '언제든 해지' : '작업 시작 전 전액 환불') : '📩 상담 신청 시 1영업일 내 회신드립니다 · 부담 없이 문의하세요'}</p>
    </div>
    ${planHint(s)}
  </div>
</header>
<section class="detail-body">
  <div class="container-narrow">
    <h2 class="h2-left">포함 내역</h2>
    <ul class="includes-list">${s.includes.map((i) => `<li>${i}</li>`).join('')}</ul>
    <h2 class="h2-left">${s.descriptionTitle}</h2>
    <div class="detail-desc">${s.description.map((p) => `<p>${p}</p>`).join('')}</div>
  </div>
</section>
<section class="section section-gray">
  <div class="container">
    <h2 class="h2">주문 후 이렇게 진행됩니다</h2>
    <div class="grid4">
      <div class="step-card"><p class="tl-tag">STEP 1 · 5분</p><h3 class="h3">비즈니스 정보 입력</h3><p class="body-sm">결제 직후 간단한 질문지 작성 (최초 1회만)</p></div>
      <div class="step-card"><p class="tl-tag">STEP 2</p><h3 class="h3">AI 제작</h3><p class="body-sm">AI가 브랜드 정보를 바탕으로 초안을 제작합니다</p></div>
      <div class="step-card"><p class="tl-tag">STEP 3</p><h3 class="h3">전문가 검수</h3><p class="body-sm">마케팅 전문가가 품질·사실관계를 확인합니다</p></div>
      <div class="step-card"><p class="tl-tag">STEP 4</p><h3 class="h3">딜리버리</h3><p class="body-sm">이메일로 결과물과 사용 가이드를 받아보세요</p></div>
    </div>
  </div>
</section>
<section class="section">
  <div class="container">
    <h2 class="h2">함께 보면 좋은 서비스</h2>
    <div class="grid3">
      ${DATA.services.filter((x) => x.slug !== s.slug).slice(0, 3).map(productCard).join('')}
    </div>
  </div>
</section>
${s.faqs && s.faqs.length ? `
<section class="section section-gray">
  <div class="container-narrow">
    <h2 class="h2">자주 묻는 질문</h2>
    ${s.faqs.map((f) => `<div class="faq-item"><h3 class="faq-q">${f.q}</h3><p class="faq-a">${f.a}</p></div>`).join('')}
  </div>
</section>` : ''}
${relatedPosts.length ? `
<section class="section">
  <div class="container">
    <h2 class="h2">관련 가이드 읽어보기</h2>
    <div class="grid3">${relatedPosts.map(blogCard).join('')}</div>
  </div>
</section>` : ''}
` + FOOTER;
}

/* ---------- 페이지: 주문 완료 + 인테이크 ---------- */

function thanksPage() {
  return head({
    title: '주문 완료 — 작업 정보를 알려주세요 | BizHigher',
    description: 'BizHigher 주문이 완료되었습니다. 작업 시작을 위한 질문지를 작성해주세요.',
    pathName: '/thanks/',
    noindex: true,
  }) + nav('') + `
<section class="audit-hero">
  <div class="container-narrow">
    <p class="eyebrow">결제 완료 ✓</p>
    <h1 class="h1" style="font-size:40px;">주문 감사합니다!</h1>
    <p class="hero-sub">작업을 시작하려면 아래 질문지만 작성해주세요. 5분이면 충분하고, <b>이 질문지가 제출된 시점부터 딜리버리 기한(영업일 기준)이 시작됩니다.</b></p>
    <form class="audit-form" id="intake-form" style="max-width:560px;">
      <input type="hidden" name="service" id="service-field" value="">
      <input type="text" name="business" placeholder="업체명 (한글/영문)" class="input" required>
      <input type="text" name="contact_name" placeholder="담당자 성함" class="input" required>
      <input type="text" name="phone" placeholder="연락처 (문자 가능한 번호)" class="input" required>
      <input type="email" name="email" placeholder="이메일 (결제하신 이메일)" class="input" required>
      <input type="text" name="links" placeholder="구글 프로필·웹사이트·SNS 링크 (있는 것만)" class="input">

      <!-- 웹사이트 제작 전용 질문 (service가 website로 시작할 때만 표시) -->
      <div id="website-extra" style="display:none;">
        <p style="font-weight:800;color:var(--navy-900,#0A1B4D);margin:18px 0 10px;font-size:15px;">🌐 웹사이트 제작 질문지</p>
        <input type="text" data-label="원하는 도메인" placeholder="원하는 도메인 주소 (예: mystore.com — 미정이면 비워두세요)" class="input">
        <input type="text" data-label="업종·한줄소개" placeholder="업종과 가게 한 줄 소개 (예: 가든그로브 안경점, 한국어 상담)" class="input">
        <textarea data-label="꼭 들어갈 내용" placeholder="홈페이지에 꼭 들어가야 할 내용 — 영업시간, 대표 서비스/메뉴와 가격, 주차 안내, 예약 방법 등" class="input" rows="3" style="resize:vertical;"></textarea>
        <select data-label="로고 보유" class="input">
          <option value="">로고가 있나요?</option>
          <option>로고 파일 있음 (이메일로 보내드릴게요)</option>
          <option>로고 없음 — 텍스트 로고로 진행</option>
          <option>로고 없음 — 로고 제작도 관심 있어요</option>
        </select>
        <input type="text" data-label="사진 자산" placeholder="매장·상품 사진 링크 (구글드라이브/카카오 등, 없으면 '이메일로 보낼게요')" class="input">
        <input type="text" data-label="참고 사이트" placeholder="마음에 드는 참고 사이트 주소 (있다면)" class="input">
        <input type="text" data-label="선호 분위기" placeholder="선호하는 색·분위기 (예: 깔끔한 화이트, 고급스러운 네이비)" class="input">
      </div>

      <textarea name="notes" placeholder="비즈니스 소개와 요청사항을 자유롭게 적어주세요 — 주 고객층, 강점, 강조하고 싶은 것, 피하고 싶은 표현 등" class="input" rows="5" style="resize:vertical;"></textarea>
      <button type="submit" class="btn btn-primary btn-block">질문지 제출 — 작업 시작하기</button>
      <div class="form-msg" id="form-msg"></div>
    </form>
    <p class="note-text">제출 후 확인 연락을 드리고 바로 작업이 시작됩니다. 궁금한 점은 hello@bizhigher.com</p>
  </div>
</section>
<script>
var params = new URLSearchParams(location.search);
var svc = params.get('service') || '';
document.getElementById('service-field').value = svc;
// 웹사이트 제작 주문이면 전용 질문지 표시
// 웹사이트 제작 주문 또는 웹사이트가 포함된 12개월 플랜이면 전용 질문지 표시
if (svc.indexOf('website') === 0 || (svc.indexOf('local-') === 0 && svc.indexOf('annual') > -1)) {
  document.getElementById('website-extra').style.display = 'block';
}
document.getElementById('intake-form').addEventListener('submit', async function (e) {
  e.preventDefault();
  const msg = document.getElementById('form-msg');
  const btn = this.querySelector('button');
  btn.disabled = true; btn.textContent = '제출 중...';
  try {
    const body = Object.fromEntries(new FormData(this).entries());
    // 웹사이트 전용 답변을 notes 앞에 정리해서 붙임
    const extra = document.getElementById('website-extra');
    if (extra && extra.style.display !== 'none') {
      const lines = [];
      extra.querySelectorAll('[data-label]').forEach(function (el) {
        if (el.value && el.value.trim()) lines.push('[' + el.getAttribute('data-label') + '] ' + el.value.trim());
      });
      if (lines.length) body.notes = '── 웹사이트 질문지 ──\\n' + lines.join('\\n') + (body.notes ? '\\n── 추가 요청 ──\\n' + body.notes : '');
    }
    const res = await fetch('/api/intake', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error('server');
    msg.className = 'form-msg success';
    msg.textContent = '제출 완료! 곧 확인 연락을 드리고 작업을 시작하겠습니다.';
    btn.textContent = '제출 완료 ✓';
  } catch (err) {
    msg.className = 'form-msg error';
    msg.textContent = '일시적인 오류입니다. 잠시 후 다시 시도하시거나 hello@bizhigher.com 으로 보내주세요.';
    btn.disabled = false; btn.textContent = '질문지 제출 — 작업 시작하기';
  }
});
</script>
` + FOOTER;
}


/* ---------- 블로그 엔진 (의존성 없는 마크다운 변환) ---------- */

function mdToHtml(md) {
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const inline = (s) => s
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/\*(.+?)\*/g, '<i>$1</i>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>');
  const lines = md.split('\n');
  const out = [];
  let i = 0;
  const hIds = [];
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    if (/^### /.test(line)) { out.push(`<h3>${inline(esc(line.slice(4)))}</h3>`); i++; continue; }
    if (/^## /.test(line)) {
      const t = line.slice(3).trim();
      const id = 'h' + (hIds.length + 1);
      hIds.push({ id, t });
      out.push(`<h2 id="${id}">${inline(esc(t))}</h2>`); i++; continue;
    }
    if (/^---\s*$/.test(line)) { out.push('<hr>'); i++; continue; }
    if (/^> /.test(line)) {
      const buf = [];
      while (i < lines.length && /^> ?/.test(lines[i])) { buf.push(inline(esc(lines[i].replace(/^> ?/, '')))); i++; }
      out.push(`<blockquote>${buf.join('<br>')}</blockquote>`); continue;
    }
    if (/^\|/.test(line)) {
      const rows = [];
      while (i < lines.length && /^\|/.test(lines[i])) { rows.push(lines[i]); i++; }
      const cells = (r) => r.split('|').slice(1, -1).map((c) => inline(esc(c.trim())));
      const head = cells(rows[0]);
      const body = rows.slice(2).map((r) => `<tr>${cells(r).map((c) => `<td>${c}</td>`).join('')}</tr>`).join('');
      out.push(`<div class="tbl-wrap"><table><thead><tr>${head.map((c) => `<th>${c}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table></div>`);
      continue;
    }
    if (/^[-*] /.test(line)) {
      const buf = [];
      while (i < lines.length && /^[-*] /.test(lines[i])) { buf.push(`<li>${inline(esc(lines[i].slice(2)))}</li>`); i++; }
      out.push(`<ul>${buf.join('')}</ul>`); continue;
    }
    if (/^\d+\. /.test(line)) {
      const buf = [];
      while (i < lines.length && /^\d+\. /.test(lines[i])) { buf.push(`<li>${inline(esc(lines[i].replace(/^\d+\. /, '')))}</li>`); i++; }
      out.push(`<ol>${buf.join('')}</ol>`); continue;
    }
    if (/^!!! /.test(line)) { out.push(`<div class="callout">${inline(esc(line.slice(4)))}</div>`); i++; continue; }
    const img = line.match(/^!\[(.*?)\]\((.+?)\)\s*$/);
    if (img) { out.push(`<figure><img src="${img[2]}" alt="${esc(img[1])}" loading="lazy">${img[1] ? `<figcaption>${esc(img[1])}</figcaption>` : ''}</figure>`); i++; continue; }
    // 문단 (연속 줄 병합)
    const buf = [line];
    i++;
    while (i < lines.length && lines[i].trim() && !/^(#|[-*] |\d+\. |>|\||---|!!!)/.test(lines[i])) { buf.push(lines[i]); i++; }
    out.push(`<p>${inline(esc(buf.join(' ')))}</p>`);
  }
  return { html: out.join('\n'), toc: hIds };
}

function loadPosts() {
  const dir = path.join(__dirname, 'content', 'blog');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith('.md')).map((f) => {
    const raw = fs.readFileSync(path.join(dir, f), 'utf8');
    const m = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    const meta = {};
    m[1].split('\n').forEach((l) => {
      const idx = l.indexOf(':');
      if (idx > 0) meta[l.slice(0, idx).trim()] = l.slice(idx + 1).trim();
    });
    const body = m[2].trim();
    // faq는 본문 끝 "## 자주 묻는 질문" 섹션에서 추출 (### 질문 / 문단 답변)
    const faqs = [];
    const fm = body.match(/## 자주 묻는 질문\n([\s\S]*)$/);
    if (fm) {
      const parts = fm[1].split(/^### /m).filter((x) => x.trim());
      parts.forEach((p) => {
        const nl = p.indexOf('\n');
        faqs.push({ q: p.slice(0, nl).trim(), a: p.slice(nl).trim().replace(/\n+/g, ' ') });
      });
    }
    const words = body.replace(/[#>*|\-]/g, '').length;
    return { slug: meta.slug || f.replace(/\.md$/, ''), title: meta.title, description: meta.description,
      date: meta.date, updated: meta.updated || '', category: meta.category || '가이드', keywords: meta.keywords || '',
      related: meta.related || '', body, faqs, readMin: Math.max(3, Math.round(words / 600)) };
  }).sort((a, b) => (a.date < b.date ? 1 : -1));
}

function blogCard(p) {
  return `
<a href="/blog/${p.slug}/" class="prod-card">
  <span class="badge">${p.category}</span>
  <h3 class="h3">${p.title}</h3>
  <p class="body-sm">${p.description}</p>
  <div class="price-row"><span class="price-sub">${p.date} · ${p.readMin}분 읽기</span></div>
  <span class="card-cta">읽어보기 →</span>
</a>`;
}

function blogIndexPage(posts) {
  return head({
    title: '블로그 — 미국 한인 비즈니스 마케팅 가이드 | BizHigher',
    description: '구글 등록, 리뷰 관리, AI 검색 노출까지 — 미국에서 가게 운영하는 한인 사장님을 위한 실전 마케팅 가이드.',
    pathName: '/blog/',
  }) + nav('blog') + `
<header class="page-head">
  <div class="container">
    <h1 class="page-title">블로그</h1>
    <p class="page-sub">미국에서 가게 하는 한인 사장님을 위한 실전 마케팅 가이드 — 전부 무료입니다.</p>
  </div>
</header>
<section class="section">
  <div class="container">
    <div class="grid3">${posts.map(blogCard).join('')}</div>
  </div>
</section>
` + FOOTER;
}

function blogPostPage(p, posts) {
  const { html, toc } = mdToHtml(p.body);
  const jsonLd = [
    {
      '@context': 'https://schema.org', '@type': 'BlogPosting',
      headline: p.title, description: p.description,
      datePublished: p.date, dateModified: p.updated || p.date, inLanguage: 'ko',
      author: { '@type': 'Organization', name: 'BizHigher', url: SITE.domain },
      publisher: { '@type': 'Organization', name: 'BizHigher', url: SITE.domain },
      mainEntityOfPage: `${SITE.domain}/blog/${p.slug}/`, keywords: p.keywords,
    },
  ];
  if (p.faqs.length) {
    jsonLd.push({ '@context': 'https://schema.org', '@type': 'FAQPage',
      mainEntity: p.faqs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) });
  }
  const relSvc = p.related ? DATA.services.find((s) => s.slug === p.related) : null;
  const others = posts.filter((x) => x.slug !== p.slug).slice(0, 3);
  return head({
    title: `${p.title} | BizHigher 블로그`,
    description: p.description,
    pathName: `/blog/${p.slug}/`,
    jsonLd,
    ogImage: ogFor(p.slug),
    ogType: 'article',
  }) + nav('blog') + `
<header class="page-head">
  <div class="container-narrow">
    <a href="/blog/" class="back-link">← 블로그</a>
    <span class="badge">${p.category}</span>
    <h1 class="page-title" style="font-size:36px;line-height:1.25;">${p.title}</h1>
    <p class="page-sub">${p.date} · ${p.readMin}분 읽기 · BizHigher</p>
  </div>
</header>
<section class="detail-body" style="padding-top:4px;">
  <div class="container post-layout">
    ${toc.length > 2 ? `<aside class="toc toc-side" id="toc"><b>목차</b><ol>${toc.map((h) => `<li><a href="#${h.id}" data-h="${h.id}">${h.t}</a></li>`).join('')}</ol></aside>` : '<div></div>'}
    <div class="post-main">
    <article class="post-body">${html}</article>
    <div class="post-cta">
      <b>우리 가게는 지금 몇 점일까요?</b>
      <p>이 글에서 다룬 항목들을 60초 만에 자동으로 점검해 드립니다. 가입 없이 업체명과 도시만 입력하세요.</p>
      <a href="/free-audit/" class="btn btn-primary">무료 AI 진단 받기 →</a>
      ${relSvc ? `<a href="/service/${relSvc.slug}/" class="btn btn-ghost">맡기고 싶다면: ${relSvc.name} (${relSvc.price})</a>` : ''}
    </div>
    ${others.length ? `<h2 class="h2-left" style="margin-top:48px;">함께 읽으면 좋은 글</h2><div class="grid3">${others.map(blogCard).join('')}</div>` : ''}
    </div><!-- /post-main -->
  </div>
</section>
<script>
/* 목차 스크롤스파이 — 실패해도 목차·본문 표시엔 영향 없음 */
(function () {
  try {
    if (!('IntersectionObserver' in window)) return;
    var links = document.querySelectorAll('#toc a[data-h]');
    if (!links.length) return;
    var map = {};
    links.forEach(function (a) { map[a.getAttribute('data-h')] = a; });
    var current = null;
    var hs = document.querySelectorAll('.post-body h2[id]');
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          if (current) current.classList.remove('on');
          current = map[en.target.id];
          if (current) current.classList.add('on');
        }
      });
    }, { rootMargin: '-15% 0px -70% 0px', threshold: 0 });
    hs.forEach(function (h) { io.observe(h); });
  } catch (e) {}
})();
</script>
` + FOOTER;
}

/* ---------- 데이터 리포트 (/data/) ---------- */
/* data/surveys/*.json 은 "발행 시점의 스냅샷"이다.
   한 번 올린 분기 파일의 숫자는 절대 다시 만들지 않는다 — 인용된 숫자가 조용히 바뀌면
   리포트의 신뢰가 통째로 무너진다. 숫자가 달라졌으면 다음 분기 파일을 새로 만든다. */

const PCT_MIN = 15; // 모수가 이보다 작은 구간은 비율을 쓰지 않는다. 실수만 보여준다.

function loadSurveys() {
  const dir = path.join(__dirname, 'data', 'surveys');
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')))
    .map((s) => ({ ...s, slug: s.slug || `korean-business-online-${s.quarter.toLowerCase()}` }))
    .sort((a, b) => (a.quarter < b.quarter ? 1 : -1));
}

const pct = (n, d) => Math.round((n / d) * 100);
const dash = '<span style="color:var(--ink-400)">—</span>';

function surveyRows(rows) {
  return rows
    .map((r) => {
      const none = r.total - r.withWebsite;
      return `<tr><td>${r.name}</td><td>${r.total}</td><td><b>${r.withOwnDomain}</b></td><td>${none}</td><td>${
        r.total >= PCT_MIN ? `${pct(r.withOwnDomain, r.total)}%` : dash
      }</td></tr>`;
    })
    .join('');
}

function surveyTable(caption, rows) {
  return `<div class="tbl-wrap"><table>
<caption style="caption-side:top;text-align:left;font-weight:700;padding-bottom:8px;">${caption}</caption>
<thead><tr><th>구분</th><th>확인한 업소</th><th>자체 도메인</th><th>웹사이트 없음</th><th>자체 도메인 비율</th></tr></thead>
<tbody>${surveyRows(rows)}</tbody></table></div>`;
}

function surveyCsv(s) {
  const line = (t, r) => `${t},${r.name},${r.total},${r.withWebsite},${r.withOwnDomain},${r.total - r.withWebsite}`;
  return [
    'segment_type,segment,businesses_verified,with_any_web_presence,with_own_domain,no_website',
    ...s.byCategory.map((r) => line('category', r)),
    ...s.byCity.map((r) => line('city', r)),
    `all,전체,${s.totals.businesses},${s.totals.withWebsite},${s.totals.withOwnDomain},${s.totals.noWebsite}`,
  ].join('\n');
}

function dataReportPage(s) {
  const e = s.editorial || {};
  const url = `${SITE.domain}/data/${s.slug}/`;
  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'Dataset',
      '@id': `${url}#dataset`,
      name: s.title,
      description: e.dek || s.title,
      url,
      inLanguage: 'ko',
      datePublished: s.asOf,
      temporalCoverage: s.asOf,
      isAccessibleForFree: true,
      license: 'https://creativecommons.org/licenses/by/4.0/',
      creator: { '@type': 'Organization', name: 'BizHigher', url: SITE.domain },
      publisher: { '@type': 'Organization', name: 'BizHigher', url: SITE.domain },
      spatialCoverage: {
        '@type': 'Place',
        name: 'Los Angeles County and Orange County, California, USA',
      },
      measurementTechnique: s.method.verification,
      variableMeasured: [
        { '@type': 'PropertyValue', name: '확인한 업소 수', value: s.totals.businesses },
        { '@type': 'PropertyValue', name: '자체 도메인 웹사이트 보유', value: s.totals.withOwnDomain },
        { '@type': 'PropertyValue', name: '웹사이트 없음', value: s.totals.noWebsite },
      ],
      distribution: [
        {
          '@type': 'DataDownload',
          encodingFormat: 'text/csv',
          contentUrl: `${url}data.csv`,
          name: `${s.title} (CSV)`,
        },
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: e.headline || s.title,
      description: e.dek || s.title,
      datePublished: s.asOf,
      dateModified: s.asOf,
      inLanguage: 'ko',
      mainEntityOfPage: url,
      author: { '@type': 'Organization', name: 'BizHigher', url: SITE.domain },
      publisher: { '@type': 'Organization', name: 'BizHigher', url: SITE.domain },
      about: { '@id': `${url}#dataset` },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: '홈', item: `${SITE.domain}/` },
        { '@type': 'ListItem', position: 2, name: '데이터', item: `${SITE.domain}/data/` },
        { '@type': 'ListItem', position: 3, name: s.title, item: url },
      ],
    },
  ];

  const citation = `BizHigher, 「${s.title}」, ${s.asOf}. ${url}`;

  return (
    head({
      title: `${s.title} | BizHigher 데이터`,
      description: e.dek || s.title,
      pathName: `/data/${s.slug}/`,
      jsonLd,
      ogImage: ogFor(s.slug),
      ogType: 'article',
    }) +
    nav('data') +
    `
<header class="page-head">
  <div class="container-narrow">
    <a href="/data/" class="back-link">← 데이터 리포트</a>
    <span class="badge">${s.quarter} 조사</span>
    <h1 class="page-title" style="font-size:36px;line-height:1.25;">${e.headline || s.title}</h1>
    <p class="page-sub">${s.asOf} 기준 · 직접 확인한 ${s.totals.businesses}곳 전수 집계 · BizHigher</p>
  </div>
</header>

<section class="section-navy" style="padding:44px 0;">
  <div class="container">
    <div class="grid3">
      <div class="stat-box"><div class="stat">${s.totals.businesses}</div><div class="stat-label">직접 확인한 한인 업소</div></div>
      <div class="stat-box"><div class="stat">${s.totals.withOwnDomain}</div><div class="stat-label">자체 도메인 웹사이트를 가진 곳</div></div>
      <div class="stat-box"><div class="stat">${s.totals.noWebsite}</div><div class="stat-label">웹사이트가 아예 없는 곳</div></div>
    </div>
  </div>
</section>

<section class="detail-body" style="padding-top:36px;">
  <div class="container-narrow">
    <article class="post-body">
      ${e.dek ? `<p style="font-size:18px;color:var(--ink-600);">${e.dek}</p>` : ''}

      <h2 id="findings">이번 조사에서 확인한 것</h2>
      ${(e.findings || []).map((f) => `<h3>${f.title}</h3><p>${f.body}</p>`).join('')}

      <h2 id="by-category">업종별</h2>
      ${surveyTable(`${s.asOf} 기준 · 확인한 ${s.totals.businesses}곳`, s.byCategory)}
      <p style="font-size:14px;color:var(--ink-400);">모수가 ${PCT_MIN}곳 미만인 구간은 비율을 계산하지 않았습니다. 실수로 읽어 주세요.</p>

      <h2 id="by-city">도시별</h2>
      ${surveyTable(`${s.asOf} 기준 · 확인한 ${s.totals.businesses}곳`, s.byCity)}

      <h2 id="method">조사 방법과 한계</h2>
      <ul>
        <li><b>범위</b> — ${s.method.scope}</li>
        <li><b>확인 방법</b> — ${s.method.verification}</li>
        <li><b>“자체 사이트”의 정의</b> — ${s.method.websiteDefinition}</li>
        <li><b>수집하지 않은 것</b> — ${s.method.noGooglePlaces}</li>
        <li><b>확인 시점</b> — ${s.freshness.oldestVerifiedAt} ~ ${s.freshness.newestVerifiedAt}</li>
      </ul>
      <div class="callout"><b>표본이 아니라 전수입니다.</b> ${s.method.caveat}</div>

      ${e.meaning ? `<h2 id="meaning">이 숫자가 뜻하는 것</h2>${e.meaning}` : ''}

      ${seriesNav(s.slug)}

      <h2 id="reuse">데이터 내려받기 · 인용</h2>
      <p>원자료를 CSV로 공개합니다. 기사·발표·보고서에 자유롭게 쓰실 수 있습니다 (CC BY 4.0 — 출처와 링크만 남겨 주세요).</p>
      <p><a class="btn btn-primary" href="/data/${s.slug}/data.csv" download>CSV 내려받기 (${s.byCategory.length + s.byCity.length + 1}행)</a></p>
      <blockquote>${citation}</blockquote>
      <p style="font-size:14px;color:var(--ink-400);">숫자에 대한 문의나 추가 집계 요청은 <a href="mailto:${SITE.email}">${SITE.email}</a>로 보내 주세요. 언론사에는 요청하신 형태로 가공해 드립니다.</p>
    </article>

    <div class="post-cta">
      <b>우리 가게는 이 표의 어느 칸에 있을까요?</b>
      <p>업체명과 도시만 넣으면 60초 안에 웹사이트·구글 노출·리뷰·SNS를 점검해 드립니다. 가입 없이 무료입니다.</p>
      <a href="/free-audit/" class="btn btn-primary">무료 AI 진단 받기 →</a>
    </div>
  </div>
</section>
` +
    FOOTER
  );
}

function dataIndexPage(surveys) {
  /* 1호(surveys)와 2호 이후(reports)를 한 목록으로 합친다 */
  surveys = surveys.concat(loadReports()).sort((a, b) => (a.asOf < b.asOf ? 1 : -1));
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'BizHigher 데이터 리포트',
    url: `${SITE.domain}/data/`,
    inLanguage: 'ko',
    hasPart: surveys.map((s) => ({
      '@type': 'Dataset',
      name: s.title,
      url: `${SITE.domain}/data/${s.slug}/`,
      datePublished: s.asOf,
    })),
  };
  return (
    head({
      title: '데이터 리포트 | BizHigher',
      description:
        '미국 한인 비즈니스의 온라인 실태를 직접 확인해 분기마다 공개합니다. 원자료 CSV를 함께 제공하며 인용은 자유입니다.',
      pathName: '/data/',
      jsonLd,
    }) +
    nav('data') +
    `
<header class="page-head">
  <div class="container-narrow">
    <span class="badge">공개 데이터 · 정기 발행</span>
    <h1 class="page-title">한인 업소 온라인 실태 조사</h1>
    <p class="page-sub">미국 한인 비즈니스가 온라인에서 어떤 상태인지를, 추정이 아니라 한 곳씩 직접 확인해 정기적으로 공개합니다.<br>원자료 CSV까지 함께 엽니다. 출처만 남기면 인용은 자유입니다.</p>
  </div>
</header>
<section class="section" style="padding-bottom:0;">
  <div class="container-narrow">
    <div class="tbl-wrap"><table style="width:100%;border-collapse:collapse;font-size:14.5px;">
      <caption style="caption-side:top;text-align:left;font-weight:700;padding-bottom:8px;">발행 주기</caption>
      <tbody>
        <tr><td style="border:1px solid var(--line);padding:10px 14px;white-space:nowrap;font-weight:700;">분기 1회</td><td style="border:1px solid var(--line);padding:10px 14px;">모수를 다시 세고 직전 분기와 비교하는 전수 조사</td></tr>
        <tr><td style="border:1px solid var(--line);padding:10px 14px;white-space:nowrap;font-weight:700;">2~3주 1회</td><td style="border:1px solid var(--line);padding:10px 14px;">같은 데이터에 질문 하나를 더하는 단일 주제 리포트</td></tr>
      </tbody>
    </table></div>
    <p style="font-size:15px;color:var(--ink-600);line-height:1.8;">
      <b>한 번 발행한 숫자는 고치지 않습니다.</b> 값이 달라졌으면 같은 글을 수정하는 대신 새 리포트를 냅니다. 인용한 쪽의 숫자가 나중에 틀려지는 일이 없도록 하기 위해서입니다.<br>
      <b>인용은 자유입니다.</b> 모든 리포트와 원자료 CSV는 CC BY 4.0으로 공개합니다. 출처와 링크만 남겨 주세요.<br>
      <b>추가 집계를 요청할 수 있습니다.</b> 기사나 발표에 필요한 형태가 따로 있으면 <a href="mailto:${SITE.email}">${SITE.email}</a>로 알려 주세요. 가공해서 보내 드립니다.
    </p>
  </div>
</section>
<section class="section" style="padding-top:40px;">
  <div class="container-narrow">
    <h2 class="h2-left" style="margin-top:0;">발행한 리포트</h2>
    ${
      surveys.length
        ? surveys
            .map(
              (s) => `<a class="prod-card" href="/data/${s.slug}/" style="display:block;margin-bottom:16px;">
  <span class="badge">${s.quarter}</span>
  <h2 class="h2-left" style="margin:0 0 8px;">${(s.editorial && s.editorial.headline) || s.title}</h2>
  <p style="color:var(--ink-600);margin:0 0 10px;">${(s.editorial && s.editorial.dek) || ''}</p>
  <p style="font-size:14px;color:var(--ink-400);margin:0;">${s.asOf} 기준 · ${s.totals ? `확인한 업소 ${s.totals.businesses}곳` : s.cardNote || '전수 점검'} · CSV 제공</p>
</a>`
            )
            .join('')
        : '<p>준비 중입니다.</p>'
    }
  </div>
</section>
` +
    FOOTER
  );
}

/* ---------- 데이터 리포트: 지표형 (/data/) ---------- */
/* data/reports/*.json 은 표 구조까지 데이터에 담는다. 리포트마다 페이지 함수를 새로
   만들지 않기 위해서다. 2호부터 새 리포트는 전부 이 형식을 쓴다.
   1호(surveys/)는 이미 발행됐으므로 기존 renderer를 그대로 둔다. */

function loadReports() {
  const dir = path.join(__dirname, 'data', 'reports');
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')))
    .sort((a, b) => (a.asOf < b.asOf ? 1 : -1));
}

function reportTable(t) {
  const head = t.columns.map((c) => `<th>${c.label}</th>`).join('');
  const body = t.rows
    .map((r) => {
      const tds = t.columns
        .map((c) => {
          const v = r[c.key];
          const cell = v === undefined || v === null || v === '' ? '<span style="color:var(--ink-400)">—</span>' : v;
          return `<td${c.strong ? ' style="font-weight:700"' : ''}>${cell}</td>`;
        })
        .join('');
      return `<tr${r.indent ? ' style="color:var(--ink-600)"' : ''}>${tds}</tr>`;
    })
    .join('');
  return `<div class="tbl-wrap"><table>
${t.caption ? `<caption style="caption-side:top;text-align:left;font-weight:700;padding-bottom:8px;">${t.caption}</caption>` : ''}
<thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>${
    t.note ? `<p style="font-size:14px;color:var(--ink-400);margin-top:-8px;">${t.note}</p>` : ''
  }`;
}

/* 롱 포맷 CSV — 표 구조가 리포트마다 달라도 한 파일로 나간다 */
function reportCsv(s) {
  const esc = (v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
  const lines = ['table,segment,metric,value'];
  s.tables.forEach((t) => {
    const key = t.csvName || t.caption || '';
    const labelCol = t.columns[0];
    t.columns.slice(1).forEach((c) => {
      if (c.csv === false) return;
      t.rows.forEach((r) => {
        const v = r[c.key];
        if (v === undefined || v === null || v === '') return;
        lines.push([key, r[labelCol.key], c.label, v].map(esc).join(','));
      });
    });
  });
  return lines.join('\n');
}

function metricReportPage(s) {
  const e = s.editorial || {};
  const url = `${SITE.domain}/data/${s.slug}/`;
  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'Dataset',
      '@id': `${url}#dataset`,
      name: s.title,
      description: e.dek || s.title,
      url,
      inLanguage: 'ko',
      datePublished: s.asOf,
      temporalCoverage: s.asOf,
      isAccessibleForFree: true,
      license: 'https://creativecommons.org/licenses/by/4.0/',
      creator: { '@type': 'Organization', name: 'BizHigher', url: SITE.domain },
      publisher: { '@type': 'Organization', name: 'BizHigher', url: SITE.domain },
      spatialCoverage: { '@type': 'Place', name: 'Los Angeles County and Orange County, California, USA' },
      measurementTechnique: (s.method[0] || {}).text,
      variableMeasured: (s.stats || []).map((x) => ({
        '@type': 'PropertyValue',
        name: x.label,
        value: x.value,
      })),
      distribution: [
        { '@type': 'DataDownload', encodingFormat: 'text/csv', contentUrl: `${url}data.csv`, name: `${s.title} (CSV)` },
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: e.headline || s.title,
      description: e.dek || s.title,
      datePublished: s.asOf,
      dateModified: s.asOf,
      inLanguage: 'ko',
      mainEntityOfPage: url,
      author: { '@type': 'Organization', name: 'BizHigher', url: SITE.domain },
      publisher: { '@type': 'Organization', name: 'BizHigher', url: SITE.domain },
      about: { '@id': `${url}#dataset` },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: '홈', item: `${SITE.domain}/` },
        { '@type': 'ListItem', position: 2, name: '데이터', item: `${SITE.domain}/data/` },
        { '@type': 'ListItem', position: 3, name: s.title, item: url },
      ],
    },
  ];
  const csvLines = reportCsv(s).split('\n').length - 1;

  return (
    head({
      title: `${s.title} | BizHigher 데이터`,
      description: e.dek || s.title,
      pathName: `/data/${s.slug}/`,
      jsonLd,
      ogImage: ogFor(s.slug),
      ogType: 'article',
    }) +
    nav('data') +
    `
<header class="page-head">
  <div class="container-narrow">
    <a href="/data/" class="back-link">← 데이터 리포트</a>
    <span class="badge">${s.quarter} 조사</span>
    <h1 class="page-title" style="font-size:36px;line-height:1.25;">${e.headline || s.title}</h1>
    <p class="page-sub">${s.subline || `${s.asOf} 기준 · BizHigher`}</p>
  </div>
</header>

<section class="section-navy" style="padding:44px 0;">
  <div class="container">
    <div class="grid3">
      ${(s.stats || [])
        .map((x) => `<div class="stat-box"><div class="stat">${x.value}</div><div class="stat-label">${x.label}</div></div>`)
        .join('')}
    </div>
  </div>
</section>

<section class="detail-body" style="padding-top:36px;">
  <div class="container-narrow">
    <article class="post-body">
      ${e.dek ? `<p style="font-size:18px;color:var(--ink-600);">${e.dek}</p>` : ''}

      <h2 id="findings">이번 점검에서 확인한 것</h2>
      ${(e.findings || []).map((f) => `<h3>${f.title}</h3><p>${f.body}</p>`).join('')}

      ${(s.tables || [])
        .map((t) => `${t.heading ? `<h2 id="${t.id || ''}">${t.heading}</h2>` : ''}${reportTable(t)}`)
        .join('')}

      <h2 id="method">조사 방법과 한계</h2>
      <ul>${(s.method || []).map((m) => `<li><b>${m.label}</b> — ${m.text}</li>`).join('')}</ul>
      ${s.callout ? `<div class="callout">${s.callout}</div>` : ''}

      ${e.meaning ? `<h2 id="meaning">이 숫자가 뜻하는 것</h2>${e.meaning}` : ''}

      ${seriesNav(s.slug)}

      <h2 id="reuse">데이터 내려받기 · 인용</h2>
      <p>원자료를 CSV로 공개합니다. 기사·발표·보고서에 자유롭게 쓰실 수 있습니다 (CC BY 4.0 — 출처와 링크만 남겨 주세요).</p>
      <p><a class="btn btn-primary" href="/data/${s.slug}/data.csv" download>CSV 내려받기 (${csvLines}행)</a></p>
      <blockquote>BizHigher, 「${s.title}」, ${s.asOf}. ${url}</blockquote>
      <p style="font-size:14px;color:var(--ink-400);">숫자에 대한 문의나 추가 집계 요청은 <a href="mailto:${SITE.email}">${SITE.email}</a>로 보내 주세요. 언론사에는 요청하신 형태로 가공해 드립니다.</p>
    </article>

    <div class="post-cta">
      <b>우리 가게 첫 화면은 어떻게 보일까요?</b>
      <p>업체명과 도시만 넣으면 60초 안에 웹사이트·구글 노출·리뷰·SNS를 점검해 드립니다. 가입 없이 무료입니다.</p>
      <a href="/free-audit/" class="btn btn-primary">무료 AI 진단 받기 →</a>
    </div>
  </div>
</section>
` +
    FOOTER
  );
}

/* 리포트끼리 서로 링크한다. 손으로 적으면 3호를 낼 때 1·2호를 고치는 걸 잊는다. */
function seriesNav(currentSlug) {
  const all = loadSurveys()
    .concat(loadReports())
    .map((x) => ({
      slug: x.slug,
      title: (x.editorial && x.editorial.headline) || x.title,
      asOf: x.asOf,
    }))
    .filter((x) => x.slug && x.slug !== currentSlug)
    .sort((a, b) => (a.asOf < b.asOf ? 1 : -1));
  if (!all.length) return '';
  return `<h2 id="series">이 시리즈의 다른 리포트</h2>
<ul>${all.map((x) => `<li><a href="/data/${x.slug}/">${x.title}</a> <span style="color:var(--ink-400)">(${x.asOf})</span></li>`).join('')}</ul>`;
}

/* ---------- 페이지: 법적 고지 ---------- */

function legalPage(title, pathName, bodyHtml) {
  return head({
    title: `${title} | BizHigher`,
    description: `BizHigher ${title}`,
    pathName,
  }) + nav('') + `
<header class="page-head">
  <div class="container-narrow"><h1 class="page-title" style="font-size:34px;">${title}</h1>
  <p class="page-sub">최종 업데이트: 2026년 9월 16일</p></div>
</header>
<section class="detail-body" style="padding-top:8px;">
  <div class="container-narrow legal-body">${bodyHtml}</div>
</section>
` + FOOTER;
}

const PRIVACY_HTML = `
<p>BizHigher(이하 "회사", bizhigher.com)는 이용자의 개인정보를 소중히 다룹니다. 본 방침은 회사가 어떤 정보를 수집하고 어떻게 사용하는지 설명합니다.</p>
<h2 class="h2-left">1. 수집하는 정보</h2>
<p>• <b>직접 제공 정보</b>: 무료 진단 신청 및 주문 질문지를 통해 업체명, 담당자 성함, 이메일, 전화번호, 웹사이트·소셜 링크 등을 수집합니다.<br>
• <b>결제 정보</b>: 결제는 Stripe가 처리하며, 회사는 카드번호를 저장하지 않습니다.<br>
• <b>자동 수집 정보</b>: Google Analytics 및 Microsoft Clarity를 통해 방문 기록, 기기·브라우저 정보, 사이트 이용 행태(쿠키 포함)가 수집될 수 있습니다.</p>
<h2 class="h2-left">2. 이용 목적</h2>
<p>서비스 제공 및 결과물 제작·전달, 주문·구독 관리, 고객 문의 응대, 서비스 개선과 사이트 분석, 서비스 관련 안내에 사용합니다. 이용자의 동의 없이 제3자에게 개인정보를 판매하지 않습니다.</p>
<h2 class="h2-left">3. 제3자 서비스</h2>
<p>회사는 서비스 운영을 위해 다음 처리자를 이용합니다: Stripe(결제), Google Analytics(분석), Microsoft Clarity(분석), Cloudflare(호스팅·보안), Resend(이메일 발송). 각 서비스는 자체 개인정보처리방침에 따라 정보를 처리합니다.</p>
<h2 class="h2-left">4. 보관 및 파기</h2>
<p>개인정보는 서비스 제공에 필요한 기간 동안 보관하며, 목적 달성 후 관련 법령이 정한 기간을 제외하고 지체 없이 파기합니다. 구독 해지 후에도 법적 의무 이행을 위한 최소한의 거래 기록은 보관될 수 있습니다.</p>
<h2 class="h2-left">5. 이용자의 권리</h2>
<p>이용자는 언제든지 자신의 개인정보에 대한 열람, 정정, 삭제를 요청할 수 있습니다. 캘리포니아 거주자는 CCPA에 따른 권리(수집 정보 확인, 삭제 요청, 판매 거부 — 회사는 개인정보를 판매하지 않습니다)를 행사할 수 있습니다. 요청은 아래 연락처로 보내주세요.</p>
<h2 class="h2-left">6. 쿠키</h2>
<p>사이트는 분석 목적의 쿠키를 사용합니다. 브라우저 설정에서 쿠키를 차단할 수 있으며, 이 경우 일부 기능이 제한될 수 있습니다.</p>
<h2 class="h2-left">7. 문의</h2>
<p>개인정보 관련 문의: <a href="mailto:hello@bizhigher.com" style="color:var(--blue-600);font-weight:700;">hello@bizhigher.com</a></p>
`;

const TERMS_HTML = `
<p>본 약관은 BizHigher(bizhigher.com, 이하 "회사")가 제공하는 마케팅 서비스 이용에 관한 회사와 고객 간의 권리·의무를 규정합니다. 서비스를 주문하면 본 약관에 동의한 것으로 봅니다.</p>
<h2 class="h2-left">1. 서비스</h2>
<p>회사는 AI 기술과 전문가 검수를 결합한 마케팅 서비스(진단 리포트, 프로필 최적화, 콘텐츠·광고 제작, 웹사이트 제작, 월 구독 관리 등)를 제공합니다. 각 서비스의 내용·가격·제공 기한은 사이트의 해당 서비스 페이지에 명시된 바에 따릅니다.</p>
<h2 class="h2-left">2. 주문과 작업 시작</h2>
<p>결제 후 제공되는 질문지(인테이크) 제출 시점부터 제공 기한(영업일 기준)이 시작됩니다. 고객이 제공한 정보·자료가 부정확하거나 지연 제공될 경우 기한이 조정될 수 있습니다.</p>
<h2 class="h2-left">3. 구독과 해지</h2>
<p>월간 구독은 언제든 해지할 수 있으며, 결제 이메일의 구독 관리 링크(Stripe 고객 포털)에서 직접 처리됩니다. 해지 시 다음 결제부터 청구되지 않으며, 이미 결제된 기간의 서비스는 기간 만료일까지 제공됩니다.</p>
<h2 class="h2-left">4. 환불</h2>
<p>• 원타임 서비스: 작업 시작(질문지 제출) 전 전액 환불됩니다.<br>
• 월간 구독: 해지 시 다음 결제부터 청구가 중단되며, 이미 결제된 월은 환불되지 않습니다.<br>
• 6·12개월 플랜: 시작 후 30일 이내 해지 시 잔여 금액을 환불하며, 이미 제공된 서비스와 셋업은 개별 정가 기준으로 차감 후 정산합니다. 30일 경과 후에는 환불되지 않으나 남은 기간의 서비스는 계속 제공됩니다.</p>
<h2 class="h2-left">5. 결과물과 지식재산권</h2>
<p>대금이 완납된 결과물의 사용 권리는 고객에게 있습니다. 회사는 고객이 별도로 거부 의사를 밝히지 않는 한, 완성된 결과물을 포트폴리오로 소개할 수 있습니다. 고객이 제공한 자료(로고, 사진 등)에 대한 권리와 책임은 고객에게 있습니다.</p>
<h2 class="h2-left">6. 고객의 협조</h2>
<p>일부 서비스는 고객의 계정 권한 부여(예: 구글 비즈니스 프로필 관리자 초대, Search Console 사용자 추가, 광고 계정 접근)가 필요합니다. 권한 미제공으로 인한 지연은 회사의 책임이 아닙니다.</p>
<h2 class="h2-left">7. 보증의 한계</h2>
<p>회사는 전문적이고 성실한 서비스 제공을 약속하지만, 검색 순위·광고 성과·매출 등 특정 결과를 보장하지 않습니다. 검색 엔진과 광고 플랫폼의 정책·알고리즘은 회사가 통제할 수 없습니다.</p>
<h2 class="h2-left">8. 책임 제한</h2>
<p>회사의 배상 책임은 관련 법이 허용하는 최대 한도 내에서 해당 서비스에 대해 고객이 실제 지불한 금액을 초과하지 않습니다.</p>
<h2 class="h2-left">9. 기타</h2>
<p>본 약관은 미국 캘리포니아주 법률에 따라 해석됩니다. 회사는 약관을 개정할 수 있으며, 중요한 변경은 사이트에 공지합니다. 문의: <a href="mailto:hello@bizhigher.com" style="color:var(--blue-600);font-weight:700;">hello@bizhigher.com</a></p>
`;

/* ---------- 404 ---------- */

function notFoundPage() {
  return head({
    title: '페이지를 찾을 수 없습니다 | BizHigher',
    description: 'BizHigher — 미국 한인 비즈니스 AI 마케팅',
    pathName: '/404.html',
  }) + nav('') + `
<section class="hero">
  <div class="container">
    <h1 class="h1">404</h1>
    <p class="hero-sub">페이지를 찾을 수 없습니다.</p>
    <div class="hero-ctas"><a href="/" class="btn btn-primary">홈으로 가기</a></div>
  </div>
</section>
` + FOOTER;
}

/* ---------- sitemap & robots ---------- */

/* lastmod는 "내용이 실제로 바뀐 날"일 때만 의미가 있다.
   빌드할 때마다 오늘 날짜를 모든 URL에 찍으면 구글은 그 사이트맵의 lastmod를
   통째로 신뢰하지 않게 된다 — 그래서 진짜 날짜를 아는 URL에만 넣는다.
   글 내용을 고쳤으면 그 글의 front matter에 updated: YYYY-MM-DD 를 추가하면 된다. */
function sitemap() {
  const posts = loadPosts();
  const surveys = loadSurveys();
  const postDates = posts.map((p) => p.updated || p.date).filter(Boolean).sort();
  const newestPost = postDates.length ? postDates[postDates.length - 1] : '';

  const urls = [
    { u: '/' },
    { u: '/services/' },
    { u: '/pricing/' },
    { u: '/free-audit/' },
    { u: '/privacy/' },
    { u: '/terms/' },
    { u: '/blog/', d: newestPost },
    ...posts.map((p) => ({ u: `/blog/${p.slug}/`, d: p.updated || p.date })),
    ...DATA.services.map((s) => ({ u: `/service/${s.slug}/` })),
    ...DATA.packages.map((p) => ({ u: `/package/${p.slug}/` })),
    ...(surveys.length ? [{ u: '/data/', d: surveys[0].asOf }] : []),
    ...surveys.map((x) => ({ u: `/data/${x.slug}/`, d: x.asOf })),
    ...loadReports().map((x) => ({ u: `/data/${x.slug}/`, d: x.asOf })),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((x) => `  <url><loc>${SITE.domain}${x.u}</loc>${x.d ? `<lastmod>${x.d}</lastmod>` : ''}</url>`).join('\n')}
</urlset>`;
}

const ROBOTS = `User-agent: *
Allow: /

Sitemap: ${SITE.domain}/sitemap.xml`;

/* ---------- 빌드 실행 ---------- */

function write(rel, content) {
  const full = path.join(DIST, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
  console.log('  ✓', rel);
}

fs.rmSync(DIST, { recursive: true, force: true });
console.log('Building BizHigher →', DIST);

write('index.html', homePage());
write('services/index.html', servicesPage());
write('pricing/index.html', pricingPage());
write('free-audit/index.html', auditPage());
write('thanks/index.html', thanksPage());
const POSTS = loadPosts();
DATA.services.forEach((s) => write(`service/${s.slug}/index.html`, servicePage(s, POSTS)));
DATA.packages.forEach((p) => write(`package/${p.slug}/index.html`, packagePage(p)));
write('404.html', notFoundPage());
write('privacy/index.html', legalPage('개인정보처리방침', '/privacy/', PRIVACY_HTML));
const IMGDIR = path.join(__dirname, 'content', 'blog', 'img');
if (fs.existsSync(IMGDIR)) {
  fs.mkdirSync(path.join(DIST, 'blog-img'), { recursive: true });
  fs.readdirSync(IMGDIR).forEach((f) => {
    fs.copyFileSync(path.join(IMGDIR, f), path.join(DIST, 'blog-img', f));
  });
  console.log('  \u2713 blog-img/');
}
if (POSTS.length) {
  write('blog/index.html', blogIndexPage(POSTS));
  POSTS.forEach((p) => write(`blog/${p.slug}/index.html`, blogPostPage(p, POSTS)));
}
const REPORTS = loadReports();
REPORTS.forEach((x) => {
  write(`data/${x.slug}/index.html`, metricReportPage(x));
  write(`data/${x.slug}/data.csv`, reportCsv(x));
});
const SURVEYS = loadSurveys();
if (SURVEYS.length || REPORTS.length) {
  write('data/index.html', dataIndexPage(SURVEYS));
  SURVEYS.forEach((x) => {
    write(`data/${x.slug}/index.html`, dataReportPage(x));
    write(`data/${x.slug}/data.csv`, surveyCsv(x));
  });
}
write('terms/index.html', legalPage('이용약관', '/terms/', TERMS_HTML));
fs.copyFileSync(path.join(__dirname, 'src', 'og-image.png'), path.join(DIST, 'og-image.png'));
console.log('  \u2713 og-image.png');
const OGDIR = path.join(__dirname, 'src', 'og');
if (fs.existsSync(OGDIR)) {
  const pngs = fs.readdirSync(OGDIR).filter((f) => f.endsWith('.png'));
  if (pngs.length) {
    fs.mkdirSync(path.join(DIST, 'og'), { recursive: true });
    pngs.forEach((f) => fs.copyFileSync(path.join(OGDIR, f), path.join(DIST, 'og', f)));
    console.log(`  \u2713 og/ (${pngs.length}\uc7a5)`);
  }
}
write('sitemap.xml', sitemap());
write('robots.txt', ROBOTS);
write('llms.txt', `# BizHigher (비즈하이어)

> 미국 한인 비즈니스를 위한 AI 자동화 마케팅 회사. 견적 미팅 없는 정찰제로 마케팅 서비스를 쇼핑하듯 주문할 수 있다. AI가 제작하고 전문가가 검수하며, 대부분 영업일 3일 내 제공된다. 웹사이트는 한국어로 운영되며, 결과물(웹사이트·콘텐츠·광고 소재)은 한국어·영어 모두 제작 가능하다.

- 웹사이트: https://bizhigher.com
- 문의: ${SITE.email}
- 대상: 미국 전역의 한인 소상공인 (식당, 카페, 뷰티, 안경점, 치과, 한의원, 학원, 부동산, 융자 등)

## 주요 서비스
${DATA.services.map((s) => `- ${s.name} (${s.price}): ${s.shortDescription} — https://bizhigher.com/service/${s.slug}/`).join('\n')}

## 패키지 플랜
${DATA.packages.map((p) => `- ${p.name}: 월 $${p.prices.annual}(12개월 기준)~$${p.prices.monthly}(월간) — ${p.tagline}`).join('\n')}

## 공개 데이터 (인용 자유, CC BY 4.0)
${loadSurveys().map((x) => `- ${x.title}: https://bizhigher.com/data/${x.slug}/ — ${x.asOf} 기준 직접 확인한 ${x.totals.businesses}곳 중 자체 도메인 보유 ${x.totals.withOwnDomain}곳, 웹사이트 없음 ${x.totals.noWebsite}곳. CSV 원자료 제공.`).join('\n')}
${loadReports().map((x) => `- ${x.title}: https://bizhigher.com/data/${x.slug}/ — ${(x.editorial && x.editorial.dek) || ''} CSV 원자료 제공.`).join('\n')}

## 무료 도구
- 무료 AI 마케팅 진단 (60초, 가입 불필요): https://bizhigher.com/free-audit/ — 구글 노출·리뷰·웹사이트·SNS·경쟁사 대비 5개 영역 점수와 개선 우선순위 제공

## 블로그 (한인 비즈니스 마케팅 가이드)
${loadPosts().map((p) => `- ${p.title}: https://bizhigher.com/blog/${p.slug}/`).join('\n')}

## 특징
- 모든 가격 공개 (정찰제), 월간 구독은 언제든 해지 가능
- 구글 검색뿐 아니라 ChatGPT 등 AI 검색 노출 최적화(AIO) 서비스 제공
- 한국어 상담 가능
`);
write('style.css', fs.readFileSync(path.join(__dirname, 'src', 'style.css'), 'utf8'));

console.log(`Done — ${DATA.services.length} services, ${DATA.faqs.length} FAQs.`);
