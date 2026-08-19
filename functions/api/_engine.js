/**
 * BizHigher AI 진단 엔진 — 순수 로직 모듈
 * (네트워크 호출 없는 채점·템플릿 함수는 여기 모아 테스트 가능하게 유지)
 */

/* ---------- 채점 룰 엔진 (결정적 — 같은 입력이면 항상 같은 점수) ---------- */

export function computeScores(biz, competitors) {
  const areas = [];

  // 1. 구글 노출 (20)
  let exposure = 0;
  if (biz.found) {
    exposure += 6;
    if ((biz.photoCount || 0) >= 10) exposure += 5;
    else if ((biz.photoCount || 0) >= 3) exposure += 3;
    else if ((biz.photoCount || 0) >= 1) exposure += 1;
    if (biz.websiteUri) exposure += 4;
    if (biz.hasHours) exposure += 3;
    if (biz.primaryType) exposure += 2;
  }
  areas.push({ key: 'exposure', label: '구글 노출', score: exposure, max: 20 });

  // 2. 리뷰·평판 (20)
  let reviews = 0;
  const rating = biz.rating || 0;
  const count = biz.reviewCount || 0;
  if (rating >= 4.7) reviews += 8;
  else if (rating >= 4.4) reviews += 6;
  else if (rating >= 4.0) reviews += 4;
  else if (rating >= 3.5) reviews += 2;
  if (count >= 300) reviews += 12;
  else if (count >= 100) reviews += 9;
  else if (count >= 50) reviews += 7;
  else if (count >= 20) reviews += 4;
  else if (count >= 5) reviews += 2;
  areas.push({ key: 'reviews', label: '리뷰·평판', score: reviews, max: 20 });

  // 3. 웹사이트 (20)
  let website = 0;
  if (biz.websiteUri) {
    website += 10;
    if (biz.websiteUri.startsWith('https://')) website += 4;
    if (biz.websiteReachable) website += 6;
  }
  areas.push({ key: 'website', label: '웹사이트', score: website, max: 20 });

  // 4. 정보 완성도 (20)
  let completeness = 0;
  if (biz.found) {
    if (biz.hasHours) completeness += 6;
    if ((biz.photoCount || 0) >= 5) completeness += 5;
    if (biz.address) completeness += 4;
    if (biz.phone) completeness += 3;
    if (biz.primaryType) completeness += 2;
  }
  areas.push({ key: 'completeness', label: '정보 완성도', score: completeness, max: 20 });

  // 5. 경쟁사 대비 (20)
  let competitive = 10; // 경쟁 데이터 없으면 중립
  if (biz.found && competitors && competitors.length > 0) {
    competitive = 0;
    const avgRating = competitors.reduce((s, c) => s + (c.rating || 0), 0) / competitors.length;
    const avgCount = competitors.reduce((s, c) => s + (c.reviewCount || 0), 0) / competitors.length;
    if (rating >= avgRating + 0.2) competitive += 10;
    else if (rating >= avgRating - 0.1) competitive += 7;
    else if (rating >= avgRating - 0.4) competitive += 4;
    else competitive += 1;
    const ratio = avgCount > 0 ? count / avgCount : 1;
    if (ratio >= 1.2) competitive += 10;
    else if (ratio >= 0.8) competitive += 7;
    else if (ratio >= 0.4) competitive += 4;
    else if (ratio >= 0.15) competitive += 2;
  }
  areas.push({ key: 'competitive', label: '경쟁사 대비', score: competitive, max: 20 });

  const total = areas.reduce((s, a) => s + a.score, 0);
  return { total, areas };
}

/* ---------- 템플릿 해석 (Claude API 키가 없거나 실패해도 리포트가 나가도록) ---------- */

const AREA_TEMPLATES = {
  exposure: {
    title: '구글에서 가게가 충분히 보이지 않습니다',
    why: '구글 프로필의 사진·웹사이트·영업시간 같은 기본 정보가 부족하면 구글이 가게를 검색 결과 위쪽에 올려주지 않습니다. 손님 대부분은 지도 상단 3곳 중에서 고릅니다.',
    fix: '프로필의 카테고리·설명·사진·영업시간을 키워드 기반으로 채우는 것이 가장 빠른 개선입니다.',
    serviceSlug: 'google-profile-optimization',
    serviceName: '구글 비즈니스 프로필 최적화 — $199',
  },
  reviews: {
    title: '리뷰가 경쟁 업체보다 부족합니다',
    why: '구글은 최신 리뷰 활동을 지도 순위에 반영하고, 손님은 리뷰 수와 별점으로 가게를 고릅니다. 리뷰가 멈춰 있으면 순위도 매출도 서서히 밀립니다.',
    fix: '방문 손님에게 자연스럽게 리뷰를 요청하는 시스템(QR 등)을 매장에 두는 것부터 시작하세요.',
    serviceSlug: 'review-qr-kit',
    serviceName: '구글 리뷰 QR 키트 — $79',
  },
  website: {
    title: '웹사이트가 없거나 신뢰를 주지 못합니다',
    why: '구글 프로필에서 가게를 발견한 손님의 상당수가 웹사이트를 확인한 뒤 방문을 결정합니다. 웹사이트가 없으면 이 손님들이 경쟁 업체로 넘어갑니다.',
    fix: '웹사이트가 준비되기 전까지는 구글 프로필이 웹사이트 역할을 합니다. 프로필의 설명·사진·서비스 항목부터 완벽하게 채우세요.',
    serviceSlug: 'google-profile-optimization',
    serviceName: '구글 비즈니스 프로필 최적화 — $199',
  },
  completeness: {
    title: '프로필 정보가 비어 있습니다',
    why: '영업시간·전화·사진이 비어 있으면 구글이 "관리되지 않는 가게"로 판단하고, 손님도 영업 여부가 불확실한 가게는 피합니다.',
    fix: '영업시간, 전화번호, 최근 사진 10장 이상을 채우는 것이 기본기입니다.',
    serviceSlug: 'google-profile-optimization',
    serviceName: '구글 비즈니스 프로필 최적화 — $199',
  },
  competitive: {
    title: '같은 동네 경쟁 업체에 밀리고 있습니다',
    why: '손님이 검색했을 때 나란히 비교되는 것은 결국 동네 경쟁 업체입니다. 별점·리뷰 수에서 밀리면 지도 노출과 선택 모두에서 불리해집니다.',
    fix: '리뷰 확보와 프로필 최적화를 병행해 경쟁 업체와의 격차부터 줄이세요.',
    serviceSlug: 'review-qr-kit',
    serviceName: '구글 리뷰 QR 키트 — $79',
  },
};

export function templateAnalysis(biz, scores, competitors) {
  if (!biz.found) {
    return {
      summary: `구글에서 "${biz.name}"의 비즈니스 프로필을 찾지 못했습니다. 프로필이 없다는 것 자체가 지금 가장 큰 마케팅 문제입니다 — 손님 대부분이 구글 지도에서 가게를 찾기 때문입니다.`,
      problems: [
        {
          title: '구글 비즈니스 프로필이 없습니다 (또는 검색되지 않습니다)',
          why: '구글 지도에 나오지 않는 가게는 새 손님에게는 존재하지 않는 가게와 같습니다. 경쟁 업체들은 이미 지도에서 손님을 받고 있습니다.',
          fix: '무료로 구글 비즈니스 프로필을 만들고, 카테고리·사진·영업시간을 채우는 것이 최우선입니다.',
          serviceSlug: 'google-profile-optimization',
          serviceName: '구글 비즈니스 프로필 최적화 — $199',
        },
      ],
      nextStep: '프로필 생성부터 최적화까지 한 번에 해결하는 것을 추천드립니다.',
    };
  }
  const sorted = [...scores.areas].sort((a, b) => a.score / a.max - b.score / b.max);
  const worst = sorted.slice(0, 2);
  const problems = worst.map((a) => AREA_TEMPLATES[a.key]);
  const grade = scores.total >= 75 ? '상위권' : scores.total >= 55 ? '평균 수준' : '개선이 시급한 수준';
  const compLine =
    competitors && competitors.length
      ? ` 같은 지역 경쟁 업체 ${competitors.length}곳과 비교한 결과입니다.`
      : '';
  return {
    summary: `"${biz.name}"의 온라인 마케팅 점수는 100점 만점에 ${scores.total}점으로 ${grade}입니다.${compLine} 아래 두 가지가 지금 가장 급한 문제입니다.`,
    problems,
    nextStep: '가장 점수가 낮은 영역부터 하나씩 해결하는 것이 효율적입니다. 어떤 서비스가 맞을지 고민되시면 부담 없이 문의 주세요.',
  };
}

/* ---------- Claude 프롬프트 ---------- */

export function buildClaudePrompt(biz, scores, competitors) {
  const data = {
    business: {
      name: biz.name,
      rating: biz.rating,
      reviewCount: biz.reviewCount,
      photoCount: biz.photoCount,
      website: biz.websiteUri || null,
      hasHours: biz.hasHours,
      category: biz.primaryType || null,
      address: biz.address || null,
    },
    scores,
    competitors: (competitors || []).map((c) => ({
      name: c.name,
      rating: c.rating,
      reviewCount: c.reviewCount,
    })),
  };
  return `당신은 미국 한인 소상공인을 돕는 마케팅 전문가입니다. 아래 구글 비즈니스 프로필 데이터와 채점 결과를 바탕으로 진단 해석을 작성하세요.

데이터:
${JSON.stringify(data, null, 2)}

작성 규칙:
- 존댓말, 친근하지만 전문적으로. 사장님이 바로 이해할 수 있는 쉬운 말로.
- 막연한 표현 대신 데이터의 실제 숫자를 인용할 것 (예: "리뷰가 23개로 경쟁 업체 평균 89개의 4분의 1 수준입니다")
- problems는 점수가 가장 낮은 영역 2개에 대해 작성
- 각 problem의 serviceSlug는 다음 중 가장 적합한 것 하나: google-profile-optimization(프로필 문제), review-qr-kit(리뷰 부족), seo-blog-pack(웹사이트/검색 노출), ad-creative-pack(광고 필요)
- serviceName은 해당 상품명과 가격: "구글 비즈니스 프로필 최적화 — $199" / "구글 리뷰 QR 키트 — $79" / "SEO 블로그 아티클 팩 — $149~" / "광고 소재 팩 — $199"

반드시 아래 JSON 형식으로만 응답하세요. 다른 텍스트 없이 JSON만:
{"summary":"2~3문장 종합 평가 (총점과 핵심 문제 언급)","problems":[{"title":"문제 제목","why":"왜 문제인지 2문장, 숫자 인용","fix":"해결 방향 1~2문장","serviceSlug":"...","serviceName":"..."},{...}],"nextStep":"다음 단계 제안 1~2문장"}`;
}
