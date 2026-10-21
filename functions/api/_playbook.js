/**
 * 서비스 플레이북 — 상품별 작업 단계와 "지금 얼마나 자동화되는가"의 단일 소스.
 * 관리자 페이지의 작업 파이프라인(job_tasks)과 플레이북 탭, docs/automation-map-ko.md 가 이 파일에서 나온다.
 *
 * 단계 필드
 *   k      단계 키 (서비스 slug + 순번)
 *   t      제목
 *   ph     단계: onboarding(고객 입력·접근 권한) · setup(셋업 1회) · monthly · weekly · daily
 *   who    지금 누가 하나 — auto: 끝까지 자동 / ai: AI 생성 → David 검수 / david: David 손 / customer: 고객 대기 / blocked: 현재 막힘
 *   min    1회당 David 실투입(분). ai 는 검수 시간, david 는 작업 시간
 *   verify true 면 David 검증 필수(고객에게 나가기 전)
 *   block  막힌 이유 / 병목 설명
 *   next   무엇이 되면 자동화되나
 *
 * 레벨 정의는 CLAUDE.md §12·§15 와 같다: 고객 자동 발송 금지, 낮은 별점 자동 답글 금지, 브라우저 자동화·CAPTCHA 우회 금지.
 */

export const WHO = {
  auto: { label: '자동', icon: '🟢', desc: '사람 손 없이 끝까지 돈다' },
  ai: { label: 'AI+검수', icon: '🟡', desc: 'AI가 만들고 David가 보고 승인' },
  david: { label: 'David 수동', icon: '🔵', desc: '지금은 David가 직접 한다' },
  customer: { label: '고객 대기', icon: '🟠', desc: '고객이 주거나 승인해야 진행' },
  blocked: { label: '막힘', icon: '🔴', desc: '외부 승인·API·결정이 필요해 멈춰 있다' },
};
export const PHASES = [
  ['onboarding', '온보딩 — 고객 입력·접근 권한'],
  ['setup', '셋업 — 첫 1~2개월'],
  ['monthly', '월간 운영'],
  ['weekly', '주간 운영'],
  ['daily', '일간 운영'],
];

const S = (k, t, ph, who, min, extra = {}) => ({ k, t, ph, who, min, verify: !!extra.verify, block: extra.block || '', next: extra.next || '' });

/* ---------- 공통 온보딩 (모든 유료 주문) ---------- */
export const COMMON_ONBOARDING = [
  S('ob-1', 'Stripe 결제 → 주문·작업 자동 생성 + 이메일 알림', 'onboarding', 'auto', 0),
  S('ob-2', '질문지 제출 → 작업에 자동 연결, 마감일 계산', 'onboarding', 'customer', 0, { block: '고객이 질문지를 안 쓰면 여기서 멈춘다. 3일 무응답 시 리마인더 초안 자동 생성 예정' }),
  S('ob-3', '고객 프로필(customer_profiles) 생성·갱신 — NAP·업종·경쟁사·키워드·브랜드 톤', 'onboarding', 'ai', 5, { verify: true }),
  S('ob-4', '고객 자료 수령 — 로고·매장 사진 10장+·메뉴/가격표·브랜드 색', 'onboarding', 'customer', 5, { block: '사진이 없으면 소재·게시물·웹사이트 품질이 급락. 가장 흔한 지연 원인', next: '/portal/{token} 업로드 페이지 + 자동 리마인더' }),
  S('ob-5', '킥오프 안내 메일 — 180일 일정·필요 권한 목록·승인 방식(월 1회, 무응답 시 승인 간주)', 'onboarding', 'ai', 5, { verify: true, block: 'Gmail 초안까지만, 발송은 David(§12)' }),
];

/* ---------- 서비스별 ---------- */
export const PLAYBOOK = {
  'google-profile-optimization': {
    name: '구글 프로필 최적화', steps: [
      S('gpo-1', 'GBP 관리자 초대 — 사장님이 hello@bizhigher.com 을 관리자로 추가', 'onboarding', 'customer', 5, { block: '소유자만 초대 가능. 안내문 automation/gbp/docs/owner-invite-ko.md' }),
      S('gpo-2', '경쟁사 3곳 갭 분석 — 카테고리·속성·리뷰 속도(90일)·게시물 활동 (Places API)', 'setup', 'auto', 0, { block: '루틴이 places.js로 평점·리뷰 수·최근 리뷰 날짜·카테고리·웹사이트 유무를 뽑는다. 속성 상세·게시물 활동은 API에 없어 수동 보강 10분' }),
      S('gpo-3', '콘텐츠 팩 — 카테고리 교정안·설명 750자(한/영)·서비스 20개·Q&A 10세트·첫 게시물 4건', 'setup', 'ai', 20, { verify: true }),
      S('gpo-4', 'Before 스크린샷 → 프로필에 적용 → After 스크린샷', 'setup', 'david', 30, { block: 'GBP API 승인 전엔 손으로 입력', next: 'GBP API 승인(재신청: BestLoanUSA 재인증 후 david@ 또는 BizHigher 프로필 60일) → 설명·서비스·속성 자동 반영' }),
      S('gpo-5', 'Before/After 리포트 PDF + 4주 후 성과 리포트 리마인더', 'setup', 'ai', 5, { verify: true }),
    ],
  },
  'review-qr-kit': {
    name: '리뷰 QR 키트', steps: [
      S('qr-1', 'place_id 확인 → 리뷰 링크 생성 → QR 생성·스캔 테스트', 'setup', 'auto', 0),
      S('qr-2', '테이블텐트·포스터·카운터 카드·스티커 시트 디자인 (한/영)', 'setup', 'ai', 5, { verify: true, block: '리뷰 대가 문구 금지 검수' }),
      S('qr-3', '인쇄용 PDF(재단선)·모바일 PNG·인쇄 가이드 → Drive → Gmail 초안', 'setup', 'auto', 2, { verify: true }),
    ],
  },
  'local-listing-setup': {
    name: '로컬 등록 셋업', steps: [
      S('lls-1', '디렉토리 마스터 목록(등록 URL·인증 방식·자동화 가능 여부) 확정', 'setup', 'auto', 0, { block: 'docs/listings-master-30-ko.md(2026-10-21) 기준. 업종별 추가 디렉토리는 루틴이 보강해 lls-3 NAP 문서에 붙인다' }),
      S('lls-2', '고객 전용 인증 이메일 발급 — {고객}@listings.bizhigher.com (Cloudflare Email Routing)', 'setup', 'david', 5, { next: 'Cloudflare API로 자동 발급' }),
      S('lls-3', 'NAP 표준 문서·설명문·카테고리·사진 세트 준비', 'setup', 'ai', 5, { verify: true }),
      S('lls-4', 'Bing Places — GBP 가져오기', 'setup', 'david', 10),
      S('lls-5', 'Apple Business Connect — 등록·인증', 'setup', 'david', 20, { block: '인증 까다로움, 온보딩 초반에 시작' }),
      S('lls-6', 'Yelp·Nextdoor·한인 디렉토리 등 나머지 등록 — 곳당 10~15분, 이메일·전화·CAPTCHA 인증', 'setup', 'david', 600, { block: 'Premium 120곳 = 20~30시간. 브라우저 자동화·CAPTCHA 우회 금지(§15). 지금 구조로는 Premium 셋업에서 가장 큰 병목', next: '방향(2026-10-15): 핵심 30곳은 David + Claude in Chrome 보조 입력(사람이 보는 앞에서 폼 채우기, CAPTCHA·전화 인증은 David) → 곳당 3~5분. 나머지는 일회성 시티에이션 빌더(곳당 $2~3, 영구 등록). Yext류 구독 애그리게이터는 해지 시 등록이 사라져 제외' }),
      S('lls-7', '등록 완료 리포트(링크 목록) → Drive → Gmail 초안', 'setup', 'auto', 3, { verify: true }),
    ],
  },
  'analytics-setup': {
    name: '판매 추적·애널리틱스 셋업', steps: [
      S('an-1', '웹사이트 관리자 접근(WordPress/Wix/Squarespace 등) 또는 BizHigher 제작 사이트 확인', 'onboarding', 'customer', 0, { block: '외부 사이트면 로그인·플러그인 권한 필요' }),
      S('an-2', 'GA4 속성·Google Tag·전환 이벤트(전화·예약·문의·길찾기) 설계', 'setup', 'ai', 10, { verify: true }),
      S('an-3', '태그 설치 — BizHigher 제작 사이트면 빌드에 자동 삽입, 외부 사이트면 수동', 'setup', 'david', 60, { next: 'GTM 템플릿화(§19-6) → 외부 사이트도 스니펫 1개로' }),
      S('an-4', 'Search Console 연결·검증 + 전환 테스트 리포트', 'setup', 'david', 20, { next: 'GSC API(서비스 계정)로 검증 자동화' }),
    ],
  },
  'ads-setup': {
    name: '광고 셋업', steps: [
      S('ads-1', 'BizHigher MCC 아래 고객 Google Ads 계정 생성 + 고객 카드 등록(결제 프로필은 고객 명의) · Meta는 Business Manager 파트너 권한', 'onboarding', 'customer', 10, { block: '결정(2026-10-15): MCC 방식. 광고비는 고객 카드로 직접 결제(상품 정책). Meta는 비즈니스 인증 선행' }),
      S('ads-2', '캠페인 설계안 + Google Ads Editor 가져오기 CSV(캠페인·광고그룹·키워드·제외어·RSA 광고) + Meta 캠페인 설정표', 'setup', 'ai', 15, { verify: true }),
      S('ads-3', 'Google Ads — Ads Editor 로 CSV 가져오기 → 검토 → 게시 + 전환 연결', 'setup', 'david', 25, { block: 'CSV 가져오기 15분 + 전환 연결 10분. 구축을 손으로 하면 90분', next: 'Google Ads API 개발자 토큰(기본 액세스) + MCC → 일시정지 상태로 자동 생성' }),
      S('ads-4', 'Meta — 설정표대로 캠페인 복제·픽셀 연결', 'setup', 'david', 40, { block: 'Meta 마케팅 API는 앱 심사 6~8주(§15) → 당분간 수동. 설정표·카피·소재는 ads-2·ac-3 산출물 재사용', next: 'Meta 앱 심사 통과' }),
      S('ads-5', '전환 테스트 완료 리포트', 'setup', 'ai', 5, { verify: true }),
    ],
  },
  'local-landing-pack': {
    name: '지역 랜딩페이지 5개', steps: [
      S('llp-1', '도시 목록 확정 — 고객 승인 (기존 페이지 제외)', 'setup', 'customer', 5),
      S('llp-2', '도시별 페이지 작성 — 타이틀·메타·H1·지역 컨텍스트(실제 랜드마크 확인)·FAQ 3개+스키마·내부 링크 맵', 'setup', 'ai', 20, { verify: true, block: '도시 간 중복률 검사(doorway 방지)는 자동' }),
      S('llp-3', '적용 — BizHigher 제작 사이트면 빌드·배포 자동, 외부 사이트면 HTML 전달', 'setup', 'auto', 0, { block: '외부 사이트는 고객이 올려야 함 → 고객 대기' }),
      S('llp-4', '자동 QA(qa.js: 360/768/1280 스크린샷·속도·링크·폼) + 사이트맵 갱신 + 구글 등록 가이드', 'setup', 'auto', 5, { verify: true }),
    ],
  },
  'website': {
    name: '웹사이트 제작', steps: [
      S('web-1', '웹사이트 질문지(도메인·참고 사이트·페이지·기능) + 사진·로고', 'onboarding', 'customer', 0, { block: '월 분납 플랜은 2회차 납부 후 착수(§4)' }),
      S('web-2', '사이트 생성 — 정적 빌드, 한/영, 기본 SEO·스키마, GBP 연결, Cloudflare Pages 배포', 'setup', 'ai', 60, { verify: true, block: '맞춤형(예약·주문)은 외부 툴 연동이 수동' }),
      S('web-3', '도메인 연결 — 고객 등록대행사 DNS 변경 (안내문 제공)', 'setup', 'customer', 15, { block: '고객이 DNS를 못 만지면 David가 원격 안내 30분' }),
      S('web-4', '자동 QA 리포트(qa.js: 360/768/1280 스크린샷·속도·링크·폼) → David 검토 → 수정 1회 반영 → 인도', 'setup', 'ai', 10, { verify: true, block: '리포트의 "수정할 것"이 비면 인도. 수정은 cp-2 경로' }),
    ],
  },
  'gbp-posting': {
    name: '포스팅 관리 3채널 (주 2회)', steps: [
      S('post-1', 'IG·FB 페이지 접근 — Meta Business Suite 파트너 권한 또는 예약 툴 연결', 'onboarding', 'customer', 10, { block: 'Meta API 없이도 Business Suite 예약 발행은 가능. 고객이 파트너 추가해야 함' }),
      S('post-2', '월간 캘린더 8건 초안 — 주제·캡션 한/영·CTA·사진 촬영 가이드', 'monthly', 'ai', 15, { verify: true }),
      S('post-3', '고객 캘린더 승인 (월 1회, 기한 내 무응답 시 승인 간주 — 2026-10-15 확정)', 'monthly', 'customer', 0, { block: '약관 문구 작성 필요(§19-12)', next: '/portal 승인 페이지 + 무응답 자동 승인' }),
      S('post-4', '이미지 제작 — 고객 사진 + 템플릿 조판 (한글 텍스트는 PIL 오버레이)', 'weekly', 'auto', 0, { block: '루틴이 fal.ai 배경 + 한글 조판(creative.js)으로 제작, 검증 큐에서 확인. 고객 사진 있으면 그걸 배경으로 — 없으면 생성 이미지라 품질 편차' }),
      S('post-5', 'GBP 게시 — 주 2회', 'weekly', 'david', 10, { block: 'GBP API 신청 거절(2026-10-07). 지금은 앱에서 붙여넣기 또는 Publer류 예약 툴($10~30/월)', next: 'GBP API 재신청 통과 → 완전 자동' }),
      S('post-6', 'IG·FB 게시 — 주 2회', 'weekly', 'david', 10, { block: 'Meta API 앱 심사 전 → Business Suite 예약 발행 수동', next: '예약 툴 도입 시 GBP와 함께 한 번에 예약' }),
      S('post-7', '월간 게시·조회 리포트', 'monthly', 'david', 10, { block: 'GBP 인사이트는 API 없이 화면 캡처', next: 'GBP API' }),
    ],
  },
  'review-reply': {
    name: '리뷰 답글 관리', steps: [
      S('rr-1', '미답글 백로그 일괄 처리 + 답글 톤 확인', 'setup', 'ai', 15, { verify: true }),
      S('rr-2', '새 리뷰 감지 — 매일', 'daily', 'blocked', 0, { block: 'GBP API 거절. 대안: 구글이 hello@ 로 보내는 리뷰 알림 메일을 Gmail에서 읽어 감지(반자동)', next: 'Gmail 알림 파싱 루틴 → 큐 자동 생성' }),
      S('rr-3', '분류 — 별 4~5 일반 = AUTO / 별 1~3 또는 환불·위생·법적·검안·직원 실명 = HUMAN (코드 완성, 드라이런 검증)', 'daily', 'auto', 0),
      S('rr-4', '답글 초안 (리뷰 언어, 2~4문장, 대가·보상 약속 금지, HIPAA 표현 금지)', 'daily', 'auto', 0),
      S('rr-5', 'HUMAN 등급 승인 — 24시간 내', 'daily', 'david', 3, { verify: true }),
      S('rr-6', '게시', 'daily', 'david', 2, { block: 'API 전엔 앱에서 붙여넣기', next: 'GBP API → AUTO 등급은 승인 없이 자동 게시, HUMAN은 승인 후 자동 게시' }),
      S('rr-7', '월간 리뷰 요약 리포트', 'monthly', 'ai', 5, { verify: true }),
    ],
  },
  'ad-creative-pack': {
    name: '광고 소재 (Premium 20장/월)', steps: [
      S('ac-1', '크리에이티브 브리프 — 컨셉 3방향, 시즌·프로모션 반영(월 1회)', 'monthly', 'ai', 5, { verify: true }),
      S('ac-2', '카피 — 헤드라인 5·본문 2·CTA 한/영, 광고 정책 검사', 'monthly', 'auto', 0),
      S('ac-3', '이미지 — 매장 실사진 합성(배경 제거) 또는 생성, 1:1·9:16·1.91:1 규격, 수량 30~50% 여유', 'monthly', 'auto', 0, { block: '루틴이 fal.ai(FAL_KEY) 배경 생성 + 한글 조판으로 3규격 제작, 검증 큐에서 확인. 매장 실사진 합성은 David 세션' }),
      S('ac-4', 'David 큐레이션 — 20장 선별 (검수가 아니라 선별)', 'monthly', 'david', 15, { verify: true }),
      S('ac-5', '규격별 폴더 + 카피 문서 + 업로드 가이드 → Drive → Gmail 초안', 'monthly', 'auto', 2),
    ],
  },
  'local-listing-care': {
    name: '로컬 등록 관리 (+5곳/월)', steps: [
      S('llc-1', '신규 디렉토리 5곳 등록', 'monthly', 'david', 60, { block: 'local-listing-setup 과 같은 병목(인증·CAPTCHA)' }),
      S('llc-2', '정보 변경 시 전체 디렉토리 일괄 반영 · 분기 점검(깨진 링크)', 'monthly', 'david', 20, { next: '등록 목록 DB + 링크 상태 크롤링 자동' }),
    ],
  },
  'care-plan': {
    name: '웹사이트 케어', steps: [
      S('cp-1', '콘텐츠 수정 월 2회 — 고객 요청 접수', 'monthly', 'customer', 0),
      S('cp-2', '수정 반영·배포 — BizHigher 제작 사이트면 자동 빌드', 'monthly', 'ai', 10, { verify: true, block: '외부 사이트면 수동' }),
      S('cp-3', '백업·장애 모니터링·속도·보안 업데이트', 'monthly', 'auto', 0, { block: 'Cloudflare Pages 기본 제공. 외부 호스팅은 범위 밖' }),
    ],
  },
  'monthly-report': {
    name: '월간 성과 리포트', steps: [
      S('mr-1', '데이터 수집 — GA4·GSC', 'monthly', 'auto', 0, { block: '서비스 계정 연결 전엔 수동 내보내기', next: 'GA4 Data API + GSC API 서비스 계정(고객이 사용자로 추가)' }),
      S('mr-2', '데이터 수집 — GBP 인사이트(조회·전화·길찾기)·리뷰', 'monthly', 'david', 10, { block: 'GBP API 거절 → 화면 캡처', next: 'GBP API' }),
      S('mr-3', '데이터 수집 — 광고 성과(구글·메타)', 'monthly', 'david', 10, { next: 'Google Ads API 토큰 / Meta 앱 심사' }),
      S('mr-4', '리포트 PDF 생성 — 숫자·전월 대비·다음 달 제안', 'monthly', 'ai', 10, { verify: true }),
      S('mr-5', 'Gmail 초안 → David 발송', 'monthly', 'david', 2, { block: '고객 자동 발송 금지(§12)' }),
    ],
  },
  'seo-aio': {
    name: 'SEO/AIO 관리 (Premium 블로그 4편)', steps: [
      S('seo-1', 'Search Console·GA4 사용자 초대 (고객 → hello@bizhigher.com)', 'onboarding', 'customer', 5, { block: '초대 방법 안내문 필요' }),
      S('seo-2', '온보딩 분석 — 2페이지 키워드(11~20위·100임프레션+) 전수 발굴·교정 문구', 'setup', 'ai', 20, { verify: true, next: 'GSC API로 데이터 수집 자동' }),
      S('seo-3', '월 주제 캘린더(키워드 리서치) → 고객 승인', 'monthly', 'customer', 10, { verify: true }),
      S('seo-4', '블로그 4편 집필 — 1,200~1,800자·메타·FAQ 스키마·대표 이미지 (규제 업종 표현 검사)', 'monthly', 'ai', 30, { verify: true }),
      S('seo-5', '발행 — BizHigher 제작 사이트는 자동(블로그 루틴과 동일), 외부 사이트는 docx+html 전달', 'monthly', 'auto', 0, { block: '외부 사이트(WordPress 등)는 고객 또는 David가 올림' }),
      S('seo-6', '기술 SEO·스키마 월간 점검 (크롤러)', 'monthly', 'auto', 5),
      S('seo-7', 'AI 검색 인용 테스트 — ChatGPT·Perplexity에 가게가 나오는지', 'monthly', 'david', 15, { next: '검색 API로 반자동' }),
      S('seo-8', '분기별 지역 랜딩페이지 1개 추가', 'monthly', 'ai', 10, { verify: true }),
    ],
  },
  'shortform-video': {
    name: '숏폼 영상 (Premium 4편/월)', steps: [
      S('sv-1', '월초 기획안 4편 — 훅·장면·자막·음악 → 고객 승인', 'monthly', 'customer', 10, { verify: true }),
      S('sv-2', '영상 생성 — 고객 매장 사진으로 5초 클립(릴스·틱톡·쇼츠 9:16), 자막·로고·음악은 David 편집', 'monthly', 'auto', 0, { block: '루틴이 fal.ai 이미지→영상(Kling 2.1, 편당 약 $0.25~0.5)으로 클립을 만든다(creative.js video). 자막·로고·음악 합성은 sv-3에서 David(CapCut)', next: '자막 자동 합성(drawtext 지원 ffmpeg) → 편집까지 자동' }),
      S('sv-3', 'David 검수 (톤·사실·자막 오탈자)', 'monthly', 'david', 20, { verify: true }),
      S('sv-4', '게시 — 릴스·틱톡·쇼츠', 'monthly', 'david', 20, { block: '세 플랫폼 모두 앱 심사 없이는 API 게시 불가', next: '예약 툴(Publer·Later류)로 한 번에 예약' }),
    ],
  },
  'ads-management': {
    name: '광고 운영 2채널', steps: [
      S('am-1', '캠페인 구축 (광고 셋업 선행)', 'setup', 'david', 60, { next: 'Google Ads API' }),
      S('am-2', '주간 최적화 — 입찰·네거티브·소재 교체 (구글)', 'weekly', 'david', 45, { block: 'Google Ads API 개발자 토큰·MCC 없음', next: '기본 액세스 토큰 → 리포트·네거티브 자동, 입찰 제안은 AI+검수' }),
      S('am-3', '주간 최적화 — 메타', 'weekly', 'david', 30, { block: 'Meta API 앱 심사 전', next: 'Meta 앱 심사' }),
      S('am-4', '광고비 티어 상한 모니터링 (2개월 연속 초과 시 상위 티어 7일 전 안내)', 'monthly', 'david', 5, { next: 'API 연결 후 자동' }),
      S('am-5', '월간 성과 리포트 + 개선 제안', 'monthly', 'ai', 15, { verify: true }),
    ],
  },
};

/* ---------- 패키지 → 서비스 구성 ---------- */
const PKG = {
  'local-starter': { monthly: ['gbp-posting', 'review-reply', 'ad-creative-pack', 'local-listing-care', 'care-plan', 'monthly-report'] },
  'local-growth': { monthly: ['gbp-posting', 'review-reply', 'ad-creative-pack', 'local-listing-care', 'care-plan', 'monthly-report', 'seo-aio', 'shortform-video'] },
  'local-premium': { monthly: ['gbp-posting', 'review-reply', 'ad-creative-pack', 'local-listing-care', 'care-plan', 'monthly-report', 'seo-aio', 'shortform-video', 'ads-management'] },
};
// 셋업 선물 (data/services.json setupGifts 와 같은 구성) — six: 6개월 이상, annual: 12개월(선결제·분납)에 추가
const GIFTS = {
  'local-starter': { six: ['google-profile-optimization', 'review-qr-kit', 'local-listing-setup'], annual: ['local-landing-pack', 'website'] },
  'local-growth': { six: ['google-profile-optimization', 'review-qr-kit', 'local-listing-setup', 'analytics-setup'], annual: ['local-landing-pack', 'website'] },
  'local-premium': { six: ['google-profile-optimization', 'review-qr-kit', 'local-listing-setup', 'analytics-setup', 'ads-setup'], annual: ['local-landing-pack', 'website'] },
};

/** slug(서비스 또는 패키지-기간) → 적용할 서비스 slug 목록 */
/* 승인·완료 시 "결과물 · 발송" 목록(고객 전달)에 올라가는 단계 — 나머지는 내부 작업물이라 올리지 않는다 (2026-10-21: 매 단계마다 초안 메일이 가던 문제) */
export const DELIVER_KEYS = new Set(['ob-5', 'gpo-5', 'qr-3', 'lls-7', 'ads-5', 'llp-4', 'web-4', 'post-2', 'post-7', 'rr-7', 'ac-5', 'cp-2', 'mr-4', 'seo-3', 'seo-4', 'seo-8', 'sv-2', 'am-5', 'llc-2']);

/* 고객 승인이 필요한 결과물 — 고객 페이지에 [승인]/[수정 요청] 버튼이 붙고, 승인하면 같은 서비스의 다음 고객 차례 단계가 완료된다 */
export const APPROVAL_KEYS = new Set(['post-2', 'seo-3', 'ac-5', 'sv-2']);

export function servicesFor(slug) {
  if (!slug) return [];
  const m = /^(local-(?:starter|growth|premium))(?:-(monthly|six|annual|installment))?$/.exec(slug);
  if (m) {
    const [, pkg, period = 'monthly'] = m;
    const g = GIFTS[pkg];
    const gifts = period === 'monthly' ? [] : period === 'six' ? g.six : [...g.six, ...g.annual];
    return [...gifts, ...PKG[pkg].monthly];
  }
  return PLAYBOOK[slug] ? [slug] : [];
}

// 플랜별 수량 차이 — 같은 단계지만 분량·David 시간이 다르다
const TIER = {
  'local-starter': { listings: 30, listMin: 150, creatives: 10, curateMin: 8, blogs: 0, videos: 0 },
  'local-growth': { listings: 60, listMin: 300, creatives: 10, curateMin: 8, blogs: 2, videos: 2 },
  'local-premium': { listings: 120, listMin: 600, creatives: 20, curateMin: 15, blogs: 4, videos: 4 },
};
function tierize(step, svc, tier) {
  if (!tier) return step;
  const t = { ...step };
  if (t.k === 'lls-6') { t.min = tier.listMin; t.block = `${tier.listings}곳 × 10~15분 = ${Math.round(tier.listMin / 60)}시간. ` + t.block.replace(/^Premium 120곳 = 20~30시간\. /, ''); }
  if (t.k === 'ac-4') { t.t = `David 큐레이션 — ${tier.creatives}장 선별 (검수가 아니라 선별)`; t.min = tier.curateMin; }
  if (t.k === 'seo-4') { t.t = t.t.replace('블로그 4편', `블로그 ${tier.blogs}편`); t.min = Math.round(7.5 * tier.blogs); }
  if (t.k === 'sv-1' || t.k === 'sv-3' || t.k === 'sv-4') { t.t = t.t.replace('4편', `${tier.videos}편`); t.min = Math.round((t.min / 4) * tier.videos); }
  return t;
}
function tierName(svc, tier) {
  if (!tier) return PLAYBOOK[svc].name;
  if (svc === 'local-listing-setup') return `로컬 등록 셋업 ${tier.listings}곳`;
  if (svc === 'ad-creative-pack') return `광고 소재 ${tier.creatives}장/월`;
  if (svc === 'seo-aio') return `SEO/AIO 관리 (블로그 ${tier.blogs}편)`;
  if (svc === 'shortform-video') return `숏폼 영상 ${tier.videos}편/월`;
  return PLAYBOOK[svc].name;
}

/** 작업에 넣을 단계 목록 (공통 온보딩 + 서비스별), sort 순서 포함 */
export function tasksFor(slug) {
  const out = [];
  let sort = 0;
  const m = /^(local-(?:starter|growth|premium))/.exec(slug || '');
  const tier = m ? TIER[m[1]] : null;
  for (const s of COMMON_ONBOARDING) out.push({ ...s, service: 'common', serviceName: '공통 온보딩', sort: sort++ });
  for (const svc of servicesFor(slug)) {
    const p = PLAYBOOK[svc];
    for (const s of p.steps) out.push({ ...tierize(s, svc, tier), service: svc, serviceName: tierName(svc, tier), sort: sort++ });
  }
  return out;
}

/** 요약 — 레벨별 개수, David 분(셋업 1회 / 월간 반복), 병목 */
export function summarize(tasks) {
  const by = { auto: 0, ai: 0, david: 0, customer: 0, blocked: 0 };
  let setupMin = 0, monthMin = 0, verify = 0;
  const bottlenecks = [];
  for (const t of tasks) {
    by[t.who] = (by[t.who] || 0) + 1;
    if (t.verify) verify++;
    const per = t.min || 0;
    if (t.ph === 'onboarding' || t.ph === 'setup') setupMin += per;
    else if (t.ph === 'monthly') monthMin += per;
    else if (t.ph === 'weekly') monthMin += per * 4.3;
    else if (t.ph === 'daily') monthMin += per * 22;
    if (t.who === 'blocked' || (t.who === 'david' && per >= 60) || (t.who === 'customer' && t.block)) bottlenecks.push(t);
  }
  const total = tasks.length || 1;
  return { by, total: tasks.length, verify, setupMin: Math.round(setupMin), monthMin: Math.round(monthMin), autoPct: Math.round(((by.auto + by.ai) / total) * 100), bottlenecks };
}
