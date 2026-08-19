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

/* ---------- 공통 조각 ---------- */

const LOGO_SVG = `<svg width="30" height="30" viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="15" fill="#0A4DF5"/><path d="M15 44 h9 v-9 h9 v-9 h6.5" stroke="#fff" stroke-width="6.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M38.5 15.5 h10 v10" stroke="#fff" stroke-width="6.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

const FAVICON = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='15' fill='%230A4DF5'/%3E%3Cpath d='M15 44 h9 v-9 h9 v-9 h6.5' stroke='white' stroke-width='6.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3Cpath d='M38.5 15.5 h10 v10' stroke='white' stroke-width='6.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E`;

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
<link rel="stylesheet" href="/style.css">
${jsonLd ? `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>` : ''}
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
    <button class="nav-toggle" aria-label="메뉴 열기" onclick="document.getElementById('mm').classList.toggle('open')">☰</button>
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
<header class="hero">
  <div class="container">
    <h1 class="h1">마케팅, 이제 주문하세요.</h1>
    <p class="hero-sub">AI가 만들고, 전문가가 검수하고, 영업일 3일 안에 받아보세요. 견적 문의 없는 정찰제 마케팅.</p>
    <div class="hero-ctas">
      <a href="/free-audit/" class="btn btn-primary">무료 AI 진단 받기</a>
      <a href="/services/" class="btn btn-ghost">서비스 둘러보기</a>
    </div>
    <p class="hero-note">미국 전역 한인 비즈니스 — 식당 · 뷰티 · 병원 · 학원 · 부동산 · 융자</p>
  </div>
</header>

<section class="section section-gray">
  <div class="container">
    <p class="eyebrow">HOW IT WORKS</p>
    <h2 class="h2">대행사 미팅은 없습니다</h2>
    <div class="grid3">
      <div class="step-card"><div class="step-num">1</div><h3 class="h3">쇼핑하듯 주문</h3><p class="body-sm">가격이 다 공개되어 있습니다. 필요한 서비스를 골라 카드로 결제하세요.</p></div>
      <div class="step-card"><div class="step-num">2</div><h3 class="h3">AI 제작 + 전문가 검수</h3><p class="body-sm">AI가 빠르게 제작하고, 마케팅 전문가가 하나하나 검수합니다.</p></div>
      <div class="step-card"><div class="step-num">3</div><h3 class="h3">영업일 3일 내 딜리버리</h3><p class="body-sm">진행 상황을 확인하고 결과물을 받아보세요. 수정 1회 무료.</p></div>
    </div>
  </div>
</section>

<section class="section">
  <div class="container">
    <p class="eyebrow">SERVICES</p>
    <h2 class="h2">지금 필요한 게 뭐예요?</h2>
    <div class="grid3">
      ${DATA.services.map(productCard).join('')}
      <a href="/services/" class="prod-card prod-card-more">
        <h3 class="h3">전체 서비스 보기 →</h3>
        <p class="body-sm">월 구독 상품은 곧 오픈됩니다. 오픈 알림을 받아보세요.</p>
      </a>
    </div>
  </div>
</section>

<section class="section section-navy">
  <div class="container">
    <h2 class="h2">이렇게 진행됩니다</h2>
    <div class="grid3">
      <div class="stat-box"><div class="stat">3일</div><p class="stat-label">인테이크 완료 후 최대 딜리버리 기한 (영업일)</p></div>
      <div class="stat-box"><div class="stat">100%</div><p class="stat-label">전문가 검수 — 모든 결과물은 사람이 확인 후 전달</p></div>
      <div class="stat-box"><div class="stat">$0</div><p class="stat-label">견적·상담 비용 — 모든 가격 사이트에 공개</p></div>
    </div>
  </div>
</section>

<section class="section">
  <div class="container">
    <p class="eyebrow">PRICING</p>
    <h2 class="h2">투명한 정찰제</h2>
    <div class="grid3">
      <div class="tier"><h3 class="h3">원타임 서비스</h3><div class="tier-price">$49~</div><p class="body-sm">필요할 때 한 번씩. 진단 리포트부터 프로필 최적화까지.</p><a href="/services/" class="btn btn-ghost btn-block">서비스 보기</a></div>
      <div class="tier tier-pop"><div class="tier-badge">가장 인기</div><h3 class="h3">Growth 패키지</h3><div class="tier-price">$499<span class="tier-per">/월</span></div><p class="body-sm">블로그 + SNS + 리뷰 관리 + 월간 리포트. 곧 오픈 예정.</p><a href="/pricing/" class="btn btn-primary btn-block">오픈 알림 받기</a></div>
      <div class="tier"><h3 class="h3">파운딩 멤버</h3><div class="tier-price">50%</div><p class="body-sm">첫 10곳 한정 전 상품 반값 + 성과 사례 공개 동의.</p><a href="/free-audit/" class="btn btn-ghost btn-block">진단부터 시작</a></div>
    </div>
  </div>
</section>

<section class="cta-band">
  <div class="container">
    <h2 class="cta-title">내 가게 마케팅, 몇 점일까요?</h2>
    <p class="cta-sub">60초 만에 무료 AI 진단 리포트를 받아보세요. 가입도 필요 없습니다.</p>
    <a href="/free-audit/" class="btn btn-white">무료 진단 시작하기</a>
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
    <div class="banner"><span class="badge">파운딩 멤버</span><span class="banner-text">첫 10곳 한정 전 상품 50% 할인 — 성과 사례 공개에 동의하시는 분</span></div>
  </div>
</header>
<section class="section">
  <div class="container">
    <div class="grid3">
      ${DATA.services.map(productCard).join('')}
      <div class="prod-card prod-card-more">
        <h3 class="h3">월 구독 상품</h3>
        <p class="body-sm">SEO 블로그 구독 · SNS 운영 · 리뷰 관리 자동화 — 곧 오픈됩니다.</p>
        <a href="/free-audit/" class="btn btn-ghost btn-small">오픈 알림 받기</a>
      </div>
    </div>
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
<section class="section">
  <div class="container-narrow">
    <h2 class="h2">원타임 서비스</h2>
    <div class="price-list">
      ${DATA.services.map((s) => `<a href="/service/${s.slug}/" class="price-item"><span><span class="price-item-name">${s.name}</span><span class="price-item-meta">${s.delivery}</span></span><span class="price-item-price">${s.price === '$149~' ? '$149 / $249' : s.price}</span></a>`).join('')}
    </div>
    <p class="note-text">모든 상품에 수정 1회 무료 포함 · 작업 시작 전 전액 환불</p>
  </div>
</section>
<section class="section section-gray">
  <div class="container">
    <h2 class="h2">월 구독 패키지 — 곧 오픈</h2>
    <div class="grid3">
      <div class="tier"><h3 class="h3">Starter</h3><div class="tier-price">$249<span class="tier-per">/월</span></div><p class="body-sm">리뷰 관리 자동화 + SEO 블로그 월 4편 + 월간 리포트</p><a href="/free-audit/" class="btn btn-ghost btn-block">오픈 알림 받기</a></div>
      <div class="tier tier-pop"><div class="tier-badge">가장 인기 예정</div><h3 class="h3">Growth</h3><div class="tier-price">$499<span class="tier-per">/월</span></div><p class="body-sm">Starter 전체 + SNS 주 3회 운영 + 통합 마케팅 대시보드</p><a href="/free-audit/" class="btn btn-primary btn-block">오픈 알림 받기</a></div>
      <div class="tier"><h3 class="h3">Premium</h3><div class="tier-price">$899<span class="tier-per">/월</span></div><p class="body-sm">Growth 전체 + Google Ads 운영 + 블로그 월 8편 (광고비 별도, 최소 $1,000/월)</p><a href="/free-audit/" class="btn btn-ghost btn-block">오픈 알림 받기</a></div>
    </div>
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
  const optionB = s.stripeLinkB
    ? `<a href="${s.stripeLinkB}" class="btn btn-ghost btn-block">${s.optionBLabel}</a>`
    : '';
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
      <a href="${s.stripeLinkA}" class="btn btn-primary btn-block">${s.optionALabel}</a>
      ${optionB}
      <p class="pricebox-secure">🔒 Stripe 안전결제 · 수정 1회 무료 · 작업 시작 전 전액 환불</p>
    </div>
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
      <textarea name="notes" placeholder="비즈니스 소개와 요청사항을 자유롭게 적어주세요 — 주 고객층, 강점, 강조하고 싶은 것, 피하고 싶은 표현 등" class="input" rows="5" style="resize:vertical;"></textarea>
      <button type="submit" class="btn btn-primary btn-block">질문지 제출 — 작업 시작하기</button>
      <div class="form-msg" id="form-msg"></div>
    </form>
    <p class="note-text">제출 후 확인 연락을 드리고 바로 작업이 시작됩니다. 궁금한 점은 hello@bizhigher.com</p>
  </div>
</section>
<script>
var params = new URLSearchParams(location.search);
document.getElementById('service-field').value = params.get('service') || '';
document.getElementById('intake-form').addEventListener('submit', async function (e) {
  e.preventDefault();
  const msg = document.getElementById('form-msg');
  const btn = this.querySelector('button');
  btn.disabled = true; btn.textContent = '제출 중...';
  try {
    const body = Object.fromEntries(new FormData(this).entries());
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
  const urls = ['/', '/services/', '/pricing/', '/free-audit/', ...DATA.services.map((s) => `/service/${s.slug}/`)];
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
write('404.html', notFoundPage());
write('sitemap.xml', sitemap());
write('robots.txt', ROBOTS);
write('style.css', fs.readFileSync(path.join(__dirname, 'src', 'style.css'), 'utf8'));

console.log(`Done — ${DATA.services.length} services, ${DATA.faqs.length} FAQs.`);
