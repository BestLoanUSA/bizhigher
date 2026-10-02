/**
 * 공개 샘플 진단 리포트 — GET /report/sample
 *
 * 가상의 예시 업체다. 실존 업소의 Google Places 데이터를 저장·재게시하지 않는다는 원칙(CLAUDE.md §14·§17) 때문에
 * 실제 고객 리포트를 공개하지 않고, 같은 채점 엔진(computeScores)으로 가상 입력을 채점해 보여준다.
 * 점수는 요청 시점에 엔진이 계산하므로 채점 룰이 바뀌면 샘플도 함께 바뀐다. 해석 문구만 손으로 썼다.
 *
 * `_`로 시작하므로 Pages Functions 라우팅 대상이 아니다.
 */
import { computeScores } from '../api/_engine.js';

const BIZ = {
  name: '가든그로브 순두부 하우스 (예시)',
  found: true,
  rating: 4.3,
  reviewCount: 48,
  photoCount: 2,
  websiteUri: 'https://example.com',
  websiteReachable: true,
  hasHours: true,
  address: 'Brookhurst St, Garden Grove, CA (예시)',
  phone: '(714) 000-0000',
  primaryType: 'korean_restaurant',
  categoryGeneric: false,
  inferredIndustry: '한식당',
};

const COMPETITORS = [
  { name: '같은 동네 한식당 A (예시)', rating: 4.6, reviewCount: 312, distanceMi: 0.4 },
  { name: '같은 동네 한식당 B (예시)', rating: 4.5, reviewCount: 190, distanceMi: 0.9 },
  { name: '같은 동네 한식당 C (예시)', rating: 4.4, reviewCount: 141, distanceMi: 1.3 },
];

const WEBCHECK = {
  checked: true,
  reachable: true,
  finalIsHttps: true,
  hasViewport: true,
  hasMetaDesc: false,
  hasOg: false,
  hasSchema: false,
  hasLocalBusinessSchema: false,
  blocksAnyAI: false,
  aiBlocked: [],
  showsHours: false,
  socialVia: ['instagram'],
  hasLlmsTxt: false,
};

export function buildSampleReport() {
  const scores = computeScores(BIZ, COMPETITORS);
  return {
    business: {
      name: BIZ.name,
      rating: BIZ.rating,
      reviewCount: BIZ.reviewCount,
      photoCount: BIZ.photoCount,
      website: BIZ.websiteUri,
      address: BIZ.address,
      category: BIZ.primaryType,
      categoryGeneric: false,
      inferredIndustry: BIZ.inferredIndustry,
      found: true,
      webcheck: WEBCHECK,
    },
    location: 'Garden Grove, CA',
    scores,
    competitors: COMPETITORS,
    analysis: {
      summary: `"${BIZ.name}"의 온라인 마케팅 점수는 100점 만점에 ${scores.total}점으로 평균 수준입니다. 같은 지역 경쟁 업체 3곳과 비교한 결과입니다. 별점 4.3은 나쁘지 않지만 리뷰 수가 경쟁 업체 평균의 4분의 1에 못 미치고, 프로필 사진이 2장뿐이라 "활동 중인 가게"로 보이지 않습니다. 웹사이트는 있지만 영업시간이 첫 화면에 없고 검색·AI가 업소로 인식할 구조화 데이터가 빠져 있습니다. 아래 두 가지가 지금 가장 급한 문제입니다.`,
      problems: [
        {
          title: '리뷰 수가 같은 동네 경쟁 업체의 4분의 1 수준입니다',
          why: '손님이 "순두부 near me"를 검색하면 지도에 나란히 뜨는 것은 결국 같은 동네 한식당입니다. 별점은 비슷한데 리뷰가 48개 대 312개면 손님은 리뷰 많은 쪽을 고르고, 구글도 최신 리뷰 활동이 많은 쪽을 위로 올립니다. 리뷰가 멈춰 있으면 순위와 선택 모두에서 서서히 밀립니다.',
          fix: '매장 테이블과 카운터에 리뷰 QR을 두고 식사 후 자연스럽게 요청하는 것부터 시작하세요. 리뷰 대가 제공이나 별점 선별(게이팅)은 구글 정책 위반이라 하지 않습니다. 들어오는 리뷰에는 24시간 안에 답글을 달아 "관리되는 가게" 신호를 보냅니다.',
          serviceSlug: 'review-qr-kit',
          serviceName: '구글 리뷰 QR 키트 — $39',
        },
        {
          title: '프로필 사진이 2장뿐이라 구글이 "활동 중인 가게"로 보지 않습니다',
          why: '구글은 사진·게시물·영업시간 같은 프로필 신호로 가게가 실제로 운영 중인지 판단합니다. 사진이 2장이면 손님은 메뉴와 매장 분위기를 확인할 수 없고, 구글은 경쟁 업체보다 정보가 부족한 프로필을 지도 상단 3곳에 올려주지 않습니다.',
          fix: '대표 사진 교체와 메뉴·매장·외관 사진 10장 이상 업로드, 보조 카테고리 추가, 설명문에 지역·메뉴 키워드를 자연스럽게 넣는 것이 가장 빠른 개선입니다. 이후 매주 게시물로 "활동 중" 신호를 유지하세요.',
          serviceSlug: 'google-profile-optimization',
          serviceName: '구글 비즈니스 프로필 최적화 — $199',
        },
      ],
      nextStep: '리뷰 QR 키트($39)와 프로필 최적화($199)로 시작하면 가장 적은 비용으로 두 문제를 동시에 잡을 수 있습니다. 웹사이트 첫 화면에 영업시간을 표기하고 업소 구조화 데이터를 넣는 작업은 웹사이트 유지관리 구독($29/월)에 포함됩니다. 세 가지를 꾸준히 하고 싶다면 Local Starter 플랜이 개별 구매보다 저렴합니다.',
    },
    generatedAt: '2026-09-28T17:00:00.000Z',
    sample: true,
  };
}
