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

function head({ title, description, pathName, jsonLd, noindex }) {
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
<meta property="og:type" content="website">
<meta property="og:site_name" content="BizHigher">
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
      <a class="${cls('audit')}" href="/free-audit/">무료 진단</a>
    </div>
    <div class="nav-cta"><a class="btn btn-primary btn-small" href="/free-audit/">무료 진단 받기</a></div>
    <button class="nav-toggle" aria-label="메뉴 열기" onclick="document.getElementById('mm').classList.toggle('open');this.closest('.nav').classList.toggle('menu-open')">☰</button>
  </div>
  <div class="mobile-menu" id="mm">
    <a href="/services/">서비스</a>
    <a href="/pricing/">가격</a>
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
      </div>
      <div class="footer-col">
        <span class="footer-head">문의</span>
        <a href="mailto:${SITE.email}" class="footer-link">${SITE.email}</a>
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
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'BizHigher',
    url: SITE.domain,
    email: SITE.email,
    description: '미국 한인 비즈니스를 위한 AI 자동화 마케팅 서비스',
    slogan: SITE.tagline,
  };
  return head({
    title: 'BizHigher — 미국 한인 비즈니스 AI 마케팅 | 마케팅, 이제 주문하세요',
    description: '견적 미팅 없는 정찰제 마케팅. AI가 만들고 전문가가 검수하고 영업일 3일 안에 받아보세요. 미국 전역 한인 비즈니스를 위한 마케팅 쇼핑몰.',
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
      <span class="hero-badge">⚡ AI 자동화 마케팅 · 영업일 3일 딜리버리</span>
      <h1 class="h1">마케팅, 이제<br><span class="grad">주문하세요.</span></h1>
      <p class="hero-sub">AI가 만들고, 전문가가 검수하고, 영업일 3일 안에 받아보세요. 견적 문의 없는 정찰제 마케팅.</p>
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
          <div class="demo-chip demo-chip-ok">✓ 90일 실행 플랜 생성 완료</div>
        </div>
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
  // 루프마다 다른 지역·업종 비즈니스로 순환 (마지막 칩은 항상 완료 스타일)
  var BIZ = [
    { name: '가든그로브 안경점', score: 63, bars: [82, 61, 45, 38, 68],
      chips: ['🔎 경쟁사 대비 리뷰 32개 부족', '📸 프로필 사진 6개월째 업데이트 없음', '✓ 90일 실행 플랜 생성 완료'] },
    { name: '달라스 한식당', score: 71, bars: [88, 79, 52, 66, 74],
      chips: ['⭐ 최근 30일 신규 리뷰 12개 — 지역 상위권', '🌐 웹사이트에 메뉴·영업시간 정보 없음', '✓ 90일 실행 플랜 생성 완료'] },
    { name: 'LA 네일살롱', score: 48, bars: [54, 41, 30, 62, 49],
      chips: ['🔎 "nail salon near me" 노출 순위권 밖', '💬 미답글 리뷰 9개 — 신뢰도 하락 요인', '✓ 90일 실행 플랜 생성 완료'] },
    { name: '애틀랜타 수학학원', score: 57, bars: [66, 72, 38, 25, 58],
      chips: ['📱 SNS 계정 없음 — 학부모 접점 부재', '🏷️ 구글 카테고리 "일반 학교"로 잘못 분류', '✓ 90일 실행 플랜 생성 완료'] },
  ];
  var bi = 0;
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function apply(b) {
    // 바 목표치·숫자·칩 문구를 해당 비즈니스로 교체
    fills.forEach(function (f, i) { f.setAttribute('data-w', b.bars[i]); });
    fillNums.forEach(function (n, i) { n.textContent = b.bars[i]; });
    chips.forEach(function (c, i) { c.textContent = b.chips[i]; });
  }
  function setFinal() {
    var b = BIZ[0];
    apply(b);
    typeEl.textContent = b.name;
    scoreEl.textContent = b.score;
    if (ring) ring.style.setProperty('--p', b.score);
    fills.forEach(function (f) { f.style.width = f.getAttribute('data-w') + '%'; });
    chips.forEach(function (c) { c.classList.add('show'); });
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
  }
  function run() {
    reset();
    var b = BIZ[bi % BIZ.length];
    bi++;
    apply(b);
    // 1) 업체명 타이핑
    var i = 0;
    (function type() {
      if (i <= b.name.length) { typeEl.textContent = b.name.slice(0, i); i++; timers.push(setTimeout(type, 90)); }
    })();
    // 2) 바 채우기 (스태거)
    fills.forEach(function (f, idx) {
      t(function () { f.style.width = f.getAttribute('data-w') + '%'; }, 1500 + idx * 220);
    });
    // 3) 점수 카운트업 + 링
    t(function () {
      var start = null;
      function step(ts) {
        if (!start) start = ts;
        var p = Math.min((ts - start) / 1400, 1);
        var v = Math.round(b.score * (1 - Math.pow(1 - p, 3)));
        scoreEl.textContent = v;
        if (ring) ring.style.setProperty('--p', v);
        if (p < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    }, 1600);
    // 4) 인사이트 칩
    chips.forEach(function (c, idx) {
      t(function () { c.classList.add('show'); }, 3400 + idx * 800);
    });
    // 5) 다음 비즈니스로 루프
    t(run, 10500);
  }
  run();
})();
</script>

<section class="section section-gray">
  <div class="container">
    <p class="eyebrow">HOW IT WORKS</p>
    <h2 class="h2">대행사 미팅은 없습니다</h2>
    <div class="stack-zone">
      <div class="stack-card"><span class="stack-num">01</span><h3 class="stack-title">쇼핑하듯 주문</h3><p class="stack-desc">가격이 다 공개되어 있습니다. 견적 미팅도, 영업 전화도 없습니다. 필요한 서비스를 골라 카드로 결제하면 끝.</p></div>
      <div class="stack-card stack-c2"><span class="stack-num">02</span><h3 class="stack-title">AI 제작 + 전문가 검수</h3><p class="stack-desc">AI가 빠르게 제작하고, 마케팅 전문가가 하나하나 검수합니다. 속도와 품질을 둘 다 가져갑니다.</p></div>
      <div class="stack-card stack-c3"><span class="stack-num">03</span><h3 class="stack-title">영업일 3일 내 딜리버리</h3><p class="stack-desc">결과물과 사용 가이드를 이메일로 받아보세요. 수정 1회 무료. 구독이면 매달 이 사이클이 자동으로 돕니다.</p></div>
    </div>
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
    <h2 class="h2">이렇게 진행됩니다</h2>
    <div class="grid3">
      <div class="stat-box"><div class="stat" data-count="3" data-suffix="일">3일</div><p class="stat-label">인테이크 완료 후 최대 딜리버리 기한 (영업일)</p></div>
      <div class="stat-box"><div class="stat" data-count="100" data-suffix="%">100%</div><p class="stat-label">전문가 검수 — 모든 결과물은 사람이 확인 후 전달</p></div>
      <div class="stat-box"><div class="stat" data-count="0" data-prefix="$">$0</div><p class="stat-label">견적·상담 비용 — 모든 가격 사이트에 공개</p></div>
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
  return head({
    title: '마케팅 서비스 | BizHigher — 견적 문의 없는 정찰제',
    description: 'SEO 블로그, 구글 프로필 최적화, 광고 소재, 리뷰 관리까지. 미국 한인 비즈니스를 위한 마케팅을 쇼핑하듯 주문하세요. 모든 가격 공개.',
    pathName: '/services/',
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
  return head({
    title: '가격 안내 | BizHigher — 투명한 정찰제 마케팅',
    description: '숨은 비용도 견적 미팅도 없습니다. 원타임 $49부터 월 구독까지, 미국 한인 비즈니스 마케팅 전 상품 가격표.',
    pathName: '/pricing/',
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

function servicePage(s) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: s.name,
    description: s.shortDescription,
    provider: { '@type': 'Organization', name: 'BizHigher', url: SITE.domain },
    areaServed: 'US',
    url: `${SITE.domain}/service/${s.slug}/`,
  };
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

function sitemap() {
  const urls = ['/', '/services/', '/pricing/', '/free-audit/', ...DATA.services.map((s) => `/service/${s.slug}/`), ...DATA.packages.map((p) => `/package/${p.slug}/`)];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${SITE.domain}${u}</loc></url>`).join('\n')}
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
DATA.services.forEach((s) => write(`service/${s.slug}/index.html`, servicePage(s)));
DATA.packages.forEach((p) => write(`package/${p.slug}/index.html`, packagePage(p)));
write('404.html', notFoundPage());
write('sitemap.xml', sitemap());
write('robots.txt', ROBOTS);
write('style.css', fs.readFileSync(path.join(__dirname, 'src', 'style.css'), 'utf8'));

console.log(`Done — ${DATA.services.length} services, ${DATA.faqs.length} FAQs.`);
