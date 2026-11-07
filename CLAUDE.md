# bizhigher.com — 작업 지침

이 저장소에서 작업하는 Claude가 매번 읽는 기준 문서다.
세 개의 대화창에 흩어져 있던 결정을 2026-09-18에 통합했다.
**새 결정이 생기면 코드보다 이 파일을 먼저 갱신한다.**

---

## 1. 이 사이트가 무엇인가

- **BizHigher (비즈하이어)** — "한인 비즈니스를 위한 **AI 광고회사**"
- 대상: 미국 전역의 한인 소상공인 — 식당, 카페, 뷰티, 안경점, 치과, 한의원, 학원, 부동산, 융자 등
- 전 상품 **정찰제**. 견적 미팅 없음. Stripe 고객 포털로 언제든 셀프 해지
- Webflow에서 이전한 정적 사이트

### 카피 원칙 — 어기기 쉬우니 주의

- **기능이 아니라 베네핏으로 쓴다.** "AI가 만들고 전문가가 검수"는 기능 설명이다. 속도·비용·24시간·실시간 최적화로 말한다
- H1은 **"광고 대행사 절반 이하의 가격으로, 10배 빠르게."** 가격 우위로 대행사와의 비교 자체를 차단하는 전략이다
- **실행 플랜은 전부 180일로 통일.** "90일 실행 플랜"이라는 표현을 쓰지 않는다 — 6개월 패키지 주기와 맞물려야 하기 때문. 단 "최근 90일 리뷰 속도" 같은 **측정 지표의 90일은 그대로 유지**한다. 진단 리포트·무료 진단·fulfillment 플레이북 전부에 적용

---

## 2. 스택과 배포 — 먼저 읽을 것

| | |
|---|---|
| 저장소 | `BestLoanUSA/bizhigher` (구 `bizhigher-site`에서 개명, **비공개**) |
| 빌드 | `node build.js` → `dist/` |
| 호스팅 | **Cloudflare Pages + Pages Functions** |
| DB | D1 `bizhigher-db` = `a917b539-f3d6-4fd9-b9eb-0b11df59d82a`, 바인딩 변수명 `DB` |
| 배포 | GitHub main에 push → Cloudflare 자동 재빌드 (1~2분) |

Cloudflare는 repo를 ID로 추적하므로 **대시보드에 옛 이름(`bizhigher-site`)이 보여도 연결은 정상**이다.

**PR 프리뷰**: 브랜치를 push할 때마다 Cloudflare Pages가 프리뷰를 배포한다. 주소는 `https://<브랜치이름>.bizhigher-site.pages.dev` (프로젝트 이름이 옛 이름이라 `bizhigher.pages.dev`로는 열리지 않는다). PR의 "Cloudflare Pages" 체크 Details에서도 찾을 수 있다. 프리뷰 환경에는 Production의 D1·환경변수가 묶여 있지 않으므로 진단 폼·`/report/*`는 프리뷰에서 동작하지 않을 수 있다 — 디자인·문구 확인용

### 배포 방식 — Pages Functions 하나 (2026-11-04 정리)

예전에는 `wrangler.toml` + `worker/index.js`(Cloudflare **Worker** 방식) 설정이 함께 들어 있었지만 실제로는 동작하지 않는 죽은 코드였다(2026-09-18 라이브 확인: `functions/report/[id].js` 가 실행됨 = Pages Functions). **2026-11-04 두 파일을 지우고 README 를 Pages 기준으로 고쳤다.**

- 실제로 도는 API 는 전부 `functions/`(Pages Functions)다. 바인딩(D1 `DB`·R2 `R2_ASSETS`)·환경변수는 Cloudflare 대시보드의 Pages 프로젝트 설정에만 있다
- **`npx wrangler deploy`를 실행하지 말 것.** 별도 Worker가 하나 더 생겨 도메인 라우팅이 충돌한다
- 로컬 Functions 테스트는 `wrangler pages dev`(§14). 루트에 `wrangler.toml` 을 다시 만들지 않는다

### 저장소에 쓰는 방법 — 2026-09-18 갱신

이전 지침은 "클라우드 세션은 push 불가, 수동 zip 업로드 또는 repo 연결 루틴만"이었다. **지금은 다음과 같다:**

| 경로 | 쓰기 | 비고 |
|---|---|---|
| **Claude Code** (`claude.ai/code`) | ✅ | 폰에서도 가능. 브랜치 생성 → PR |
| repo 연결 claude.ai 루틴 | ✅ | 블로그 자동 발행이 이 방식 |
| Cowork 클라우드 세션 | ❌ | 프록시가 차단. 유효한 PAT여도 403 — 시도하지 말 것 |
| 수동 zip 업로드 | ⚠️ | 더 이상 기본 경로가 아니다 |

**`.github/workflows`에는 자동화 2개만 있다** — `og.yml`(블로그·리포트 추가 시 OG 이미지 생성 후 재빌드 커밋), `indexnow.yml`(main push마다 바뀐 페이지를 IndexNow로 Bing 등에 알림, §13). marketingkorean과 달리 `claude/*` 자동 병합은 없으므로 Claude Code 작업은 PR로 도착하고 사람이 병합한다(§11).

---

## 3. 무엇을 고치면 무엇이 바뀌나

| 고치고 싶은 것 | 고칠 파일 |
|---|---|
| 상품·가격·패키지·FAQ·Stripe 링크 | `data/services.json` — **이 파일 하나면 된다** |
| 디자인·브랜드 색 | `src/style.css` (상단 `:root` 토큰) |
| 페이지 구조·문구 | `build.js` |
| 히어로 데모 업체 4곳 | `build.js` 안의 `BIZ` 배열 |
| 블로그 글 | `content/blog/*.md` |
| 블로그 주제 큐 | `content/blog-calendar.md` |
| 블로그 카드 대표 사진(2026-11-06) | 장면 `content/blog/img/covers.json`(slug → 영어 장면) → `node scripts/blog-covers.js [--only slug]`(fal.ai flux-pro v1.1, 4:3 → 800×600 `{slug}-cover.jpg`, 장당 약 $0.04, FAL_KEY) — 카드 그림 1순위(없으면 표 그림 `-card.jpg`). Actions 에는 FAL_KEY 가 없어 **발행 루틴이 글과 함께** 만든다(캘린더 이미지 규칙). 글자·로고·앱 화면 금지 |
| 블로그 "한눈에 보기" 배너·카드 그림(2026-11-06) | 생성 `scripts/blog-banners.js`(제목·summary 3문장·`##` 제목 → `content/blog/img/{slug}-overview.jpg` 1200×675 · `-m` 휴대폰 세로판 1080×1350 · `-t` 카드 썸네일, 해시 `overview.json` 으로 바뀐 글만) — main push 때 `og.yml` 이 자동으로 굽고 커밋. 카테고리 색·아이콘 `CATS`(카드와 공유). **카드 그림** `scripts/blog-cards.js`(`{slug}-card.jpg` 800×600 — 그 글의 표·번호 섹션·"A vs B"·허브 하위 글로 판형 6종 num·vs·table·list·check·hub, 해시 `cards.json`) · **인포그래픽 확대본** `{이름}-zoom.jpg`(본문 PNG 의 제목·바닥글을 잘라낸 그림 부분) → 블로그 목록 "인포그래픽 모아보기"(누르면 dialog 로 원본) · 카드 `build.js blogCard`(그림 + 분류 + 제목만, 색은 분류 표시에만) · 글 상단 `post-banner`(`<picture>`, 폰은 세로판) · CSS `.post-card`·`.post-banner`. 디자인을 바꾸면 `VERSION` 을 올린다 |
| 블로그 대표 사진 alt·검색 제목(2026-11-06) | alt 는 `content/blog/img/covers-alt.json`(slug → 사진에 보이는 장면 한국어 한 줄, 없으면 '{제목} 대표 사진') — 카드·링크 카드·글 상단·BlogPosting `image`(ImageObject caption) 공용. 새 글은 발행 루틴이 covers.json 장면과 함께 한 줄 추가. `<title>` 은 `blogTitleTag` — 60자 넘으면 꼬리를 "| BizHigher"로 줄이고 그래도 길면 글 제목만 |
| 블로그 본문 안 글 링크 카드(2026-11-06) | `build.js linkCards`·`postLinkCard` — 본문의 `→ [제목](/blog/slug/)` 한 줄 문단(모든 글)과 허브 글의 `- [제목](/blog/slug/): 설명` 목록을 대표 그림·분류·제목·설명 카드로 바꾼다. 글을 쓸 때 형식만 지키면 자동, CSS `.post-link` |
| 서비스 페이지 검색용 가이드·추가 FAQ | `content/services/{slug}.md` — 질문형 `##` 섹션 + `## 자주 묻는 질문`. 가격은 여기 쓰지 않는다(`services.json`이 원본) |
| 무료 도구 `/tools/` | 목록·외부 도구 `data/tools.json` · 화면 `src/tools/{slug}.html` · 동작 `src/tools/{slug}.js`(+`common.js`) · 서버 `functions/api/tools/[tool].js`(공용 `_shared.js`) · 설명·FAQ `content/tools/{slug}.md` (§5-1) |
| 결제 후 질문지 첨부(사진·로고·PDF) | 화면 `build.js`의 `/thanks/` 폼(`file-box`) · 서버 `functions/api/upload.js`(R2 `R2_ASSETS` 필수, 파일당 10MB, IP·일 30개) · 공개 URL `/a/{id}.{ext}`(`functions/a/[id].js`, SVG·PDF는 CSP sandbox). URL은 질문지 `notes` 끝 "── 첨부 파일 ──" 블록에 들어가 관리자·루틴(`job.intake.notes`)이 본다 |
| 질문지 제출 완료 페이지 `/thanks/done/` | `build.js`의 `thanksDonePage()` — 제출 후 리다이렉트(`?service=&files=&b=`). 진행 순서 4단계(패키지가 아니면 4단계 숨김)·미리 준비할 것(GBP 관리자 초대 hello@)·무료 진단 CTA 없음(`FOOTER_BASE`). 첨부는 최대 30개 |
| 결제 후 질문지 "구글에서 내 가게 찾기" | `functions/api/place-lookup.js`(Places Text Search, IP·이메일 하루 10회 `intake-place`) · 화면은 `build.js` `/thanks/` 폼 상단 `place-box`. 고객이 고르면 상호·전화·링크가 채워지고 주소·카테고리·영업시간·평점·place_id·지도 링크가 `notes` 맨 앞 "── 구글 프로필 공개 정보 ──" 블록으로 들어간다(고객 본인 가게 정보라 저장 OK). `?email=&business=&contact=&phone=`로 미리 채우기 가능(데모가 쓴다) |
| 진단 채점 로직 | `functions/api/_engine.js` |
| 리포트 디자인 | `functions/report/[id].js` — 만료 화면 `renderExpiredHtml` 포함 |
| 리포트 주소·30일 만료 | `functions/api/_reports.js` — 주소 `/report/{업체명 슬러그}-{4자}`(사용자 입력 업체명을 로마자로, 구글 상호 아님). 옛 16진 12자 주소도 그대로 열린다. 발급 30일 뒤 구글에서 온 값을 지우고 place_id·점수·입력 업체명/지역만 남긴다(열람 시 + 새 진단마다 `purgeExpiredReports`). 만료 화면은 "같은 가게 다시 진단하기" |
| 구글 지도 출처 표시 | 로고 `src/google-maps-logo.svg`(공식 회색, 높이 18px, `alt="Google Maps" translate="no"`). 리포트 상단·경쟁 업체 카드, Places를 쓰는 도구 4개(`build.js` `PLACES_TOOLS`). Places 데이터를 화면에 보여주는 새 화면에는 반드시 붙인다 |
| GBP 리뷰 답글·게시물 자동화 실험 | `automation/gbp/` (README 참고. API 승인 전엔 `--dry-run`만) |
| 광고 표준 트리거 12개(플랫폼 내장 자동 규칙) | `docs/ad-rules-ko.md` — 안전장치·낭비 차단·소재 교체·예산 이동·시간대·주말·프로모 종료·티어 상한·평판 연동. ads-2 설계안이 고객 숫자로 환산한 표를 붙이고 ads-3·ads-4 구축 때 심는다(2026-11-02, 스마틀리 분석 https://claude.ai/artifact/TYMA52t35CWb8Q3RBxSeK5) |
| 광고 소재 사전 점검(세트 점수·기본 선택) | `automation/ai-runner/creative.js precheck` — 글자 픽셀 비율(20% 이하)·흰 글자 대비(4.5:1)·9:16 안전 영역(compose 가 글자를 아래 320px 위로)·노출·선명도. `--options` 면 1위를 기본 선택으로. 시선 추적 예측은 하지 않는다 |
| 업종별 광고 학습 메모(우리식 Synapse) | D1 `ad_learnings` · 관리자 `GET/POST/DELETE /admin/api/learnings` · `runner.js learnings --industry` / `learn --industry … --kind keyword|negative|hook|audience|cpa|budget|creative|rule|note`. 업종·도시 수준 집계만, 고객명·이메일·전화·링크 금지(서버가 형식 거절). ads-2·ac-1 전에 읽고 am-5·ads-5 뒤에 한 줄 쓴다 |
| 고객 결과물 페이지 `/c/{token}` | `functions/c/[token].js` — 묶음 메일·승인 흐름은 §12-3 |
| 고객 페이지 실시간 리포트(2026-11-06) | 맨 위 "내 리포트" = `functions/c/_live.js buildLive`(열 때마다: 전체 진행률·다음 할 일(사장님 차례 + 받을 결과물 DELIVER_KEYS)·최근 30일 한 일·이번 달 사이트 숫자 site_events) + 마지막 월간 리포트 데이터 D1 `job_reports`(루틴 mr-4 가 `runner.js report-data --job --period --file report.json`, 관리자 API `POST jobs/:id/report-data`). 판형은 실제 리포트와 같다 — `functions/api/_report-view.js` 는 `_report.js` 의 `@@report-core` 구간을 build.js 가 빌드마다 ESM 으로 복사한 것(직접 고치지 말 것). 탭 `?r=YYYY-MM` = 저장된 달, `?view=report` = 리포트만 전체 화면·인쇄. iframe(sandbox, 스크립트 없음)이고 높이는 부모가 맞춘다 |
| 새 리뷰 감시·답글 과제 | `functions/api/_reviews.js` (§12-4) — 위험 단어 목록 `RISK`, 쿨다운 20시간 |
| 고객 웹사이트 템플릿·빌드·호스팅 | 템플릿 `automation/sites/render.js` · 라우터 `automation/sites/worker.js` · CLI `automation/ai-runner/sites.js` · 스펙 API `functions/admin/[[path]].js`(`sites`) · 설계 `docs/customer-sites-design-ko.md` (§12-5) |
| 결과물 품질용 마케팅·SEO·블로그 지침(가져온 스킬) | `.claude/skills/*/SKILL.md` — marketingskills·claude-seo·claude-blog 에서 골라 복사(MIT, 출처·갱신법은 그 폴더 README). 단계별 어떤 스킬을 읽는지 `docs/skills-map-ko.md`. 파이썬 도구 단계는 건너뛰고 지침만 쓴다 |
| 템플릿·랜딩·홈·관리자 **디자인을 코드로 고칠 때** | `.claude/skills/frontend-design/SKILL.md`(Anthropic 공식, Apache 2.0) 를 먼저 읽는다 — 팔레트·타이포·레이아웃 계획을 브리프와 대조한 뒤 구현. 루틴 결과물(스펙 JSON)에는 적용되지 않는다 |
| 리뷰 QR 인쇄물 키트(테이블텐트·포스터·카드·스티커·모바일) | `automation/ai-runner/_print.js` — 룩 3종(A 사진 콜라주 · B 네이비·골드 세리프 · C 미니멀+도형, `LOOKS`·`lookForStyle`) · 명령 `creative.js print --preview`(시안+options.json) / `--look`(전체 키트). 글꼴은 `_fonts.js`(Noto Serif KR·Black Han Sans·Noto Sans KR 을 `automation/fonts/` 에 내려받아 page.route 로 서빙 — Google Fonts 는 세션 프록시 인증서 때문에 Chromium 에서 조용히 실패한다). QR 은 `src/tools/qrcode.min.js` |
| 고객이 고르는 승인(시안·세트·영상·사이트 스타일 선택) | `functions/api/_orders.js`의 `parseOptions`·`pickDefaultOption`·`approveDeliverable(choice)`·`patchSiteSpec`(선택지 `patch`) · 고객 페이지 `functions/c/[token].js` 선택 카드(영상은 재생) · 관리자 `deliverables/:id/choose`(David 대신 선택) · 루틴 `runner.js submit --options` · 선택지 생성 `creative.js print --preview`(인쇄물) · `creative.js pick`(영상) · `sites.js styles`(사이트 스타일) (§12-3) |
| 고객 프로모 영상 템플릿(Remotion, 9:16 20초) | `automation/video/src/Promo.tsx`(장면·모션) · 명령 `automation/ai-runner/creative.js promo`(스펙→props·렌더) · 설명 `automation/video/README.md`. 의존성은 그 폴더 `npm ci`, 커밋 안 함 |
| 숏폼 템플릿 4종(3가지 이유·POV 투어·시작 전과 지금·메뉴 리빌) + 키네틱 자막 | `automation/video/src/Formats.tsx`·`Kinetic.tsx` · 명령 `creative.js promo --template list|tour|ba|menu --photos …` · 분해 결과·규칙 `docs/shortform-playbook-ko.md` (2026-11-01) |
| 고객 사진 선별·크롭·보정 | `automation/ai-runner/_photos.js` · 명령 `creative.js photos --job N`(시트 → `--pick`) · `sites.js prep --grade` · `compose --grade` |
| 홈 "이렇게 생긴 것을 받습니다" = 순두부 하우스 마케팅 포털(2026-11-07 v5) · 샘플 리포트 `/sample-report/` noindex · PDF | `build.js showcaseSection()` — 포털 = 벤토 격자 타일 16개(폰 8개: `.fxp-a-*`, 영역 이름 web·prof·ads·rev·rep0~3·score·map·kpi·blog·list·ai·cal·appr, 넓은 화면 6열×4행·폰 2열×6행, 숨길 타일은 CSS media 로). 큰 카드 = `SC_SCENES`(report 제외) 4장면 + 리포트 쪽 4장(800×600 `.fx-card`). JS `.fx-on` 이면 포털이 제자리에서 비어 있다가, 카드가 가운데 크게 떠(뒤 포털 흐림 `.fx-dim`) 제 칸으로 줄어들며 그 타일로 바뀌고, 사이사이 나머지 타일이 튀어나와 다 차면 CTA. 카드당 스크롤 380px(폰 300), 포털 높이는 화면 비율에 맞춰 늘어나 빈 공간이 없다. 칸이 숨은 카드(폰의 리포트 1~3쪽)는 날아오지 않는다. JS 없음·움직임 줄이기·낮은 화면 = 포털만 정적. 리포트 쪽 이미지 주소에 `?v={md5}`(같은 파일 이름이라 캐시에 옛 쪽이 남던 문제). CSS `v54`. 리포트 데이터 `data/sample-report.json`(가상의 순두부 하우스·예시 수치, 표지 + 3쪽 — 섹션 `join: true` 는 앞 쪽에 붙고 `cols: 3` 은 3열) → `node scripts/sample-report.js`(사진 `/showcase/…` 는 굽는 동안 data URI, PDF + 데스크톱 p0~p3 + 휴대폰 m0~m3 → `src/sample-report/`, 커밋) → 빌드가 `/sample-report/` 로 복사. 판형이나 데이터를 바꾸면 스크립트를 다시 돌려 커밋 |
| 고객 리포트(로고·표지·KPI·표·차트·PDF) | `automation/ai-runner/_report.js`(2026-11-06 섹션 추가: `scores` 진단 점수 · `grids` 지도 순위 7×7 · `tiles` 한 일 개수 · `sample` 예시 띠 · v2 `blocks` 2열 묶음(v3 `cols: 3`·`span` 2·3, `join`) + 그림 10종 `gauge`·`radar`·`lines`·`funnel`·`rank`·`stars`·`words`·`checks`·`gallery`·`timeline`, 표지 사진 `business.photo`, KPI 추이선 `trend`) · 명령 `creative.js report --data report.json` → `submit --kind html --url {pdf}` · 형식은 그 파일 머리말 |
| 지역 랜딩 페이지(도시별 입구 페이지) | 템플릿 `automation/sites/render.js`(`areas[]` → `areas/{slug}/`·홈 칩·푸터·사이트맵·areaServed 스키마) · 검사·패치 `sites.js areas --job N --file areas.json`(본문 350자·FAQ 2개·도시 간 중복 60% 미만) · 설계 §4 |
| GA4·Search Console 셋업·읽기 | 스펙 `analytics{ga4,ga4_property,gsc_site,gsc_verification}`(템플릿이 gtag·전환 이벤트·인증 메타, 실제 도메인에서만) · 비콘 `functions/api/site-event.js` → D1 `site_events` → 관리자 `sites/:slug/stats`·`sites.js stats` · 서비스 계정 읽기 `automation/ai-runner/analytics.js`(`GOOGLE_SA_JSON`) · 절차 `docs/analytics-setup-ko.md` · 질문지 "구글 계정(측정)" 블록 · 약관 §6 소유권 |
| 루틴 자동 깨움(할 일 생길 때만 실행) | `functions/api/_runner.js`(`wakeRoutine`·`hasAiWork`) · 관리자 `runner/wake`·`runner/status` · `runner.js wake` · 환경변수 `ROUTINE_FIRE_URL`·`ROUTINE_FIRE_TOKEN` (§12-2) |
| 고객 사이트 SEO 루프(2026-11-04) | 키워드 지도 `spec.seo.keywords`·페이지별 제목/설명 덮어쓰기 `spec.seo.pages`(`render.js shell`) · 자동 점검 `automation/ai-runner/_seocheck.js` + `sites.js seocheck --job N`(막는 위반 있으면 종료 1) · 색인 확인 `analytics.js index --job N`(URL 검사 API) · 플레이북 seo-11·seo-9·seo-10·seo-6 · 루틴 지시 `docs/ai-runner-routine-prompt-ko.md` (a-5) |
| 구글 프로필 월간 관리·지도 순위 그리드·경쟁사 스팸 점검(2026-11-04) | 플레이북 `gbp-care`(gc-1 주간 변경 감시 · gc-2 월간 관리안(사진 5장·휴일 영업시간 질문·Ask Maps 대비, 고객 전달) · gc-3 스팸 후보 · gc-4 David GBP 반영) — 세 패키지 모두. 지도 순위는 월간 리포트 `mr-6`. 도구 `automation/ai-runner/places.js grid`(7×7, IDs Only 무료, `--prev` 전월 대비) · `watch`(고객 확인값과 비교, 다르면 종료 2) · `spam`(한/영 같은 뜻은 한 개념으로 세서 이중 언어 상호는 정상 처리, 괄호 키워드·홍보 문구·같은 호수 중복만). 루틴 지시 `docs/ai-runner-routine-prompt-ko.md` (a-6). 신고는 루틴이 하지 않고 David 가 지도에서 확인 후 |
| 월간·주간 단계 다시 열기 | `functions/api/_orders.js rolloverRecurring` — 월간 단계는 끝난 지 28일, 주간은 6일 뒤 todo 로(루틴 큐가 매번 호출) |
| SEO 자동 점검(규칙·예외) | `scripts/seo-check.js`(규칙은 머리말) · 예외 `seo/check-baseline.json` · `npm run check` = 빌드 + 점검 · CI `.github/workflows/seo-check.yml` (§13-1) |
| SEO 루프 기억(할 일·키워드 지도·변경 기록·주간 보고) | `seo/backlog.yaml` · `seo/keyword-map.yaml`(한 키워드 한 페이지) · `seo/ledger.md` · `seo/weekly/` · `seo/page-audit.yaml` — 루틴 지시 `docs/seo-strategy-routine-prompt-ko.md`·`docs/seo-execute-routine-prompt-ko.md` (§13-1) |
| 리드 유입 출처(AI 검색·추천·utm) | 화면 `build.js` `window.bhRef()`(sessionStorage, "ref:호스트"/"utm:…"/"direct") → `audit_leads.source`·`tool_leads.source`(없으면 ALTER 로 추가, `functions/api/audit.js ensureSourceColumn`·`tools/_shared.js`) → 관리자 리드 탭 칩(`_ui.js srcChip`, AI 호스트는 🤖) (§13-1) |
| 관리자 페이지 `/admin/` | `functions/admin/` (화면 `_ui.js`, API `[[path]].js`, 인증 `_auth.js`). 설정 안내 `docs/admin-setup-ko.md` |
| Stripe 결제 → 주문·작업 기록 | `functions/api/stripe-webhook.js` + 공용 `functions/api/_orders.js` |
| 서비스별 작업 단계·자동화 수준(플레이북) | `functions/api/_playbook.js` — 관리자 파이프라인·플레이북 탭·`docs/automation-map-ko.md`의 단일 소스 |
| 패키지 상세 페이지 검색용 가이드·FAQ | `content/packages/{slug}.md` (서비스 가이드와 같은 형식, 가격은 쓰지 않고 `services.json`이 원본) |
| 무료 진단 페이지 설명·FAQ | `content/pages/free-audit.md` — 채점 기준 표는 `functions/api/_engine.js`의 `computeScores`와 일치시킨다 |
| 홈 "OUR OWN DATA" 제목·문구·숫자 | 최신 데이터 리포트 JSON의 `homeBand`(`headline`·`sub`·`stats`·`note`). 없으면 1호 설문으로 폴백 |
| 홈 인기 무료 도구 | `build.js`의 `HOME_TOOLS`(6개, 밝은 그리드 `.tool-grid-light` — 묶음별 색 `TOOL_GROUP_COLOR`, 폰은 가로 넘김) |
| 도구 ↔ 블로그 글 ↔ 서비스 연결(2026-11-06) | `build.js` `toolPostScore`(글 related = 도구 service +5 · 글 분류 ↔ 도구 묶음 `CAT_TOOL_GROUPS` +3 · 키워드 겹침 최대 +4, 3점 이상만) → 글 아래 "이 글과 함께 쓰는 무료 도구"(`toolsForPost`), 도구 아래 "이 도구와 함께 읽으면 좋은 글"(`postsForTool`). 서비스가 맞으면 둘 다 `svcBanner`(이름·가격·포함 3개·버튼, 가격은 services.json 그대로). 홈 섹션 순서는 … 무료 도구 → 블로그 → OUR OWN DATA → FAQ |
| 푸터 항목 | `build.js`의 `FOOT_SERVICES`·`FOOT_TOOLS`(마케팅 가이드 열은 블로그 허브에서 자동) — `footerColsHtml()` |
| 옛 주소 301 리디렉트·응답 헤더 | `build.js`의 `REDIRECTS`(→ `dist/_redirects`)·`HEADERS`(→ `dist/_headers`). 상품 슬러그를 바꾸거나 없애면 `REDIRECTS`에 한 줄 추가. `robots.txt`는 `/admin/`·`/api/` 차단 |

---

## 4. 카탈로그와 가격

- **서비스 16개** (구독 중심) + **패키지 3종 × 기간 3종**
- Local Starter / Growth / Premium — 월간 **$219 / $439 / $759**, 6개월 **$179 / $359 / $619**, 12개월 선결제 **$139 / $279 / $479**, 12개월 약정 월 분납 **$159 / $299 / $519**(2026-10-02 추가. Stripe 월 반복 결제 링크를 `links.installment`에 넣기 전까지는 이메일 신청으로 폴백. 셋업 선물은 선결제와 동일하되 웹사이트·랜딩은 2회차 납부 후 제작)
- 셋업 무료 선물로 장기 플랜 유도 — 플랜별·기간별로 커진다(`data/services.json`의 `setupGifts.tiers`). 6개월 $367~$1,202, 12개월 $715~$2,350 상당. 수치는 빌드가 합산하므로 손으로 적지 않는다
- Stripe Payment Link는 `data/services.json`에 슬러그별로 매핑되어 있고 **16개 전부 실링크가 연결되어 있다**(2026-09-18 확인). 새 구독 상품은 월간·6개월·연간 **링크 3종**을 만들어 연결해야 한다
- 결제 후 리다이렉트는 `/thanks/?service={slug}` — `website`, `local-*-annual`, `local-*-installment` 슬러그일 때만 웹사이트 질문지가 노출된다. 월 분납 링크의 리다이렉트는 `https://bizhigher.com/thanks/?service=local-{starter|growth|premium}-installment`

### 할인·보장

- **FOUNDING20** 쿠폰 20%. 6·12개월 플랜과 **중복 불가**
- 30일 보장 = 잔여 환불 + **이미 제공된 서비스·셋업은 정가 차감**(악용 방지)

---

## 5. 무료 진단 — 핵심 리드 수단

폼 제출 → 구글 Places로 우리 가게와 경쟁 3곳 수집 → 룰 채점(100점) → Claude 해석 → `/report/{id}`로 공유 가능한 리포트 즉시 발급. 60초, 가입 불필요. 리포트 하단에 "우리 가게도 진단하기" 바이럴 CTA.

**추천 매핑** (현행 카탈로그 기준):

| 진단 결과 | 추천 |
|---|---|
| 프로필 문제 | 프로필 최적화 $199 |
| 리뷰 부족 | QR 키트 $39 · 답글 대행 $49/월 |
| 웹사이트 없음 | 제작 $199~ |
| 구글 밖 노출 없음 | 로컬 등록 $129 |
| 콘텐츠 없음 | 블로그 구독 $99/월 |
| 광고 없음 | 광고 셋업 $299 |

**약점 영역이 3개 이상이면 개별 상품 대신 패키지를 제안한다.**

### 5-1. 무료 도구 `/tools/` (2026-10-07)

도구 15개 + 외부 공식 무료 도구 7개. 각 도구 페이지 하단에서 관련 유료 서비스로 연결하고, 서비스 페이지에서도 "먼저 무료로 해보기"로 도구를 링크한다. 목록 페이지 설명·FAQ는 `content/tools/_index.md`.

**이용 조건 (David 결정 2026-10-07)**
- **이메일 필수 + 휴대폰 선택** — 무료 도구의 대가. D1 `tool_leads`에 이메일·전화·업체명·도구만 저장하고, 이메일이 처음 보이면 David에게 알림. `/admin/` 리드 탭 하단 "무료 도구 이용자"에서 본다
- **모든 도구 하루 2회** — IP와 이메일을 각각 세서 어느 쪽이든 2회면 막는다
- 외부 도구는 **로그인·계정이 필요 없는 공식 공공 도구만**. Canva·CapCut·HubSpot 같은 다른 회사 상업 제품은 넣지 않는다
- 아이콘은 이모지 대신 `build.js`의 `TOOL_ICONS`(단색 선 아이콘)
- **묶음 4개**(2026-10-12): 구글 지도·검색 노출 / 리뷰·평판 / 광고 / 콘텐츠·홍보 — `data/tools.json`의 `groups`(순서·이름·설명)와 도구별 `group`. 새 도구는 `group`을 반드시 넣는다. 목록은 묶음별 섹션 + 상단 바로가기, 도구 페이지 하단 추천은 같은 묶음 먼저

| 도구 | 외부 비용 | 전체 하루 한도 |
|---|---|---|
| 광고 예산 계산기 `ads-budget` · 리뷰 별점 계산기 `review-calc` · 광고 링크 추적(UTM) `utm-builder` · 광고 문구 글자 수 `ad-copy-check` · 스키마 생성기 `schema-generator` | 없음 (계산은 브라우저, 서버는 리드·횟수만) | 각 1000 |
| 구글 지도 순위 체크 `local-rank` | 7×7=49지점은 Places **IDs Only(구글 기준 무료·무제한)** + 중심 상위 3곳 이름 Pro 1회 + 가게 찾기 Pro 1회 | 150 |
| 리뷰 링크·QR `review-link` | Places Text Search Pro (월 5,000 무료 후 1,000건당 $32, 무료 진단과 공유) | 300 |
| 가게 정보 일치 `nap-check` | Places Enterprise 필드 (월 1,000 무료 후 1,000건당 $35) | 100 |
| 경쟁 가게 리뷰 비교 `competitor-reviews` | 가게 찾기 Pro 1회(보조 한도 `competitor-find`) + 상위 10곳 별점·리뷰 Enterprise 1회 + 우리 가게가 목록 밖이면 상세 Enterprise 1회 | 100 |
| 광고 키워드·제외 키워드 `ad-keywords` | Claude 텍스트 1회 — 검색량 숫자는 만들지 않음, 경쟁 상호 키워드 금지 | 200 |
| 리뷰 답글 · 게시물 · 한/영 소개문 | Claude 텍스트 1회 (약 $0.005) | 200 |
| 메뉴판 → 웹 메뉴 `menu-to-web` | Claude 이미지 1회 (브라우저에서 1568px 축소) | 80 |
| AI 추천 체크 `ai-check` | Claude + 웹 검색 최대 3회 (검색 1,000회당 $10) — 가장 비싸다 | 60 |

- 한도는 `functions/api/tools/_shared.js`의 `LIMITS`. 횟수는 D1 `tool_usage`에 일자별 솔트 해시로만 센다. **리뷰·사진·결과 등 입력 내용과 Places 결과는 저장하지 않는다**(§14)
- 입력 검증 실패는 횟수를 차감하지 않는다(`charge()`는 외부 API 호출 직전). 로컬 순위의 가게 찾기 단계는 별도 보조 한도(`local-rank-find`, 6회)
- 지도 순위는 Places API 결과로 계산한 **근사치**다(실제 앱은 개인화·광고로 다를 수 있음) — 화면과 FAQ에 명시
- 리뷰 별점 계산기는 구글 표시 별점의 반올림(표시 4.5 = 실제 4.45 이상)과 현재 별점의 ±0.05 오차 범위를 함께 계산한다. 옐프에는 맞지 않음을 명시
- 스키마 생성기는 별점·리뷰(aggregateRating)를 넣지 않는다 — 자기 사이트 리뷰로 인정되지 않고 사실과 다르면 정책 위반
- 광고 문구 체커는 구글 광고의 2바이트 문자(한글·한자·일본어) = 2자 규칙을 반영한다(구글 공식). 메타는 권장 길이 경고만
- QR 라이브러리는 `src/tools/qrcode.min.js`(qrcode-generator 1.4.4, MIT)로 자체 호스팅
- **Claude를 쓰는 도구는 `ANTHROPIC_API_KEY`(무료 진단과 같은 키)가 있어야 동작하고, AI 추천 체크는 Anthropic Console에서 웹 검색이 허용돼 있어야 한다**

---

## 6. 홈페이지 구성

- 시네마틱 스크롤 히어로 (i점 리플 → 손님 행동 신호 칩 → 3박자 "Biz, Higher." → 나브 로고 도킹)
- 180일 비포/애프터 스토리 데모 (형편없는 점수·문제 칩 2개 → 플랜 시작 연출 → 점수 급상승·문제가 장점으로 반전, 4개 업체 순환)
- 대행사 비교표 (BizHigher 열 강조)
- 숫자 섹션 (3일 / 24시간 / 58%)
- FAQ 10개
- 데스크탑·모바일(360px) 모두 동작해야 한다

---

## 7. 데이터베이스 — D1 `bizhigher-db`

| 테이블 | 무엇이 들어오나 | 쓰는 곳 |
|---|---|---|
| `audit_leads` | 무료 진단 신청 (업체명, 지역, 이메일) | `functions/api/audit.js` |
| `reports` | 발급된 진단 리포트 JSON | `/report/{id}` |
| `intakes` | **유료 주문 인테이크** | `functions/api/intake.js` |
| `customer_profiles` | 고객 정보 (fulfillment에서 재사용) | fulfillment 스킬 |
| `orders` · `payments` | Stripe 결제·구독 1건 = 주문 1건, 입금 내역 | `functions/api/stripe-webhook.js` |
| `jobs` · `job_events` · `deliverables` | 주문당 작업 1건, 상태 타임라인, 결과물 링크 | `/admin/` · 웹훅 · `intake.js` |
| `job_tasks` | 작업당 플레이북 단계(누가·검증·David 분·막힌 이유·상태) | `_orders.js seedTasks()` · `/admin/` |
| `stripe_events` | 처리한 Stripe 이벤트 id (중복 방지) | 웹훅 |
| `deliverables` 추가 열 | `task_id`·`kind`·`summary`·`needs_approval`·`approved_at`·`revise_note`·`packet_id` — 고객 페이지·묶음 발송·승인(§12-3). `jobs.portal_token`도 같이 | `_orders.js EXTRA_COLUMNS` |
| `tool_usage` | 무료 도구 하루 사용 횟수 (일자·IP 해시·도구) — 자동 생성 | `functions/api/tools/_shared.js` |
| `review_seen` · `review_sync` | 본 리뷰의 키 해시·별점, 작업별 마지막 Places 확인 시각 — 자동 생성 | `functions/api/_reviews.js` (§12-4) |
| `ad_learnings` | 업종별 광고 학습 메모(업종·도시·채널·종류·메모·값·표본 수) — 자동 생성, 고객 식별 정보 없음 | 관리자 `learnings` API · `runner.js learnings/learn` (2026-11-02) |
| `sites` | 고객 웹사이트 스펙 JSON(작업당 1행, slug·domain·live·version) — 자동 생성 | `sites.js` · 관리자 `sites` API (§12-5) |
| `site_events` | 고객 사이트 전환 비콘 일별 집계(사이트·날짜·이벤트·페이지·n) — 자동 생성 | `functions/api/site-event.js` · `siteStats()` (2026-11-01) |
| `site_versions` · `site_leads` | 스펙 버전 기록(버전·메모·바뀐 키), 고객 사이트 문의 폼 리드 — 자동 생성 | 관리자 `sites/:slug/versions`·`leads` · `functions/api/site-contact.js` (§12-5 2단계) |

`orders` 이하 6개 테이블은 `functions/api/_orders.js`의 `ensureSchema()`가 **없으면 자동 생성**한다(`CREATE TABLE IF NOT EXISTS`). 손으로 SQL을 돌릴 필요 없다. 기존 3개 테이블은 이 코드가 만들지 않았으므로 관리자 API는 `PRAGMA table_info`로 컬럼 유무를 확인하고 쓴다.

---

## 8. 환경변수

Cloudflare 프로젝트 → Settings → Environment variables (Production).

| 변수 | 필수 | 없으면 |
|---|---|---|
| `GOOGLE_PLACES_API_KEY` | **필수** | 리드만 저장되고 채점·리포트가 안 나온다 |
| `ANTHROPIC_API_KEY` | 선택 | 템플릿 해석으로 대체 |
| `CLAUDE_MODEL` | 선택 | 기본 `claude-haiku-4-5` |
| `RESEND_API_KEY` · `NOTIFY_EMAIL` · `NOTIFY_FROM` | 선택 | 이메일 알림이 안 간다. 알림 메일은 전부 David 전용이며 푸터에 그렇게 적힌다(`_notify.js`). 고객에게는 어떤 메일도 자동으로 가지 않는다. **`NOTIFY_EMAIL` 은 Cloudflare 에 만들지 않았다** — 코드 기본값 `hello@bizhigher.com`(Email Routing → david@bestloanusa.com)을 쓰고, 고객 묶음 메일 BCC 도 같은 주소(`notifyTo`). 2026-11-03 전에는 기본값이 옛 주소라 알림이 오지 않았다 |
| `CUSTOMER_FROM` | 선택 | 고객 묶음 메일 발신 주소(예 `BizHigher <hello@bizhigher.com>`, Resend 도메인 인증 필요). 없으면 `NOTIFY_FROM` |
| `CLOUDFLARE_API_TOKEN` · `CLOUDFLARE_ACCOUNT_ID` · `SITES_PROJECT` | 선택 | 고객 도메인을 Pages 프로젝트에 자동 추가(§12-5). 없으면 D1 기록만 하고 David가 대시보드에서 추가. 같은 두 변수가 `bizhigher` 루틴 환경에도 있어야 배포가 된다 |
| `ADMIN_PASSWORD` | 관리자 페이지 필수 | `/admin/`이 503으로 잠긴다 |
| `ADMIN_ACCESS_TEAM` · `ADMIN_ACCESS_AUD` | 선택 | Cloudflare Access로 바꿀 때. 둘 다 있으면 Access 토큰 검증 |
| `STRIPE_WEBHOOK_SECRET` | 주문 기록 필수 | 웹훅이 503, 결제가 관리자 페이지에 안 뜬다 |
| `STRIPE_SECRET_KEY` | 선택 (Restricted key, Payment Links·Checkout Sessions 읽기) | 상품명 매핑이 안 돼 "미확인"으로 들어온다 |
| `ROUTINE_FIRE_URL` · `ROUTINE_FIRE_TOKEN` | 선택 (루틴 자동 깨움) | 할 일이 생겨도 루틴이 바로 돌지 않고 하루 1회 정기 실행만 돈다(§12-2). URL은 루틴 API 트리거 모달이 주는 전체 주소, 토큰은 `sk-ant-oat01-…` |
| `TOOLS_OFF` | 선택 | 쉼표 목록의 도구를 끈다. 예: `ai-check,menu-to-web` (비용이 걱정될 때) |
| `TOOLS_DAILY_SCALE` | 선택 | 모든 도구의 전체 하루 한도에 곱하는 배수. 예: `0.5`면 절반 |

**변수를 바꾸면 재배포 1회가 필요하다.**

---

## 9. 블로그 자동 발행

**주 3편, 월·수·금 LA 아침 7시.** 예약 작업 "BizHigher 블로그 월수금 자동 발행", cron `0 14 * * 1,3,5` (**UTC**).

repo에 연결된 claude.ai 웹 루틴이 집필 → 커밋 → main 푸시까지 직접 한다. 푸시되면 Cloudflare가 자동 배포한다.

**주제 큐는 `content/blog-calendar.md`.** 루틴이 대기열 맨 위 ⬜ 주제를 고르고, 발행 후 그 행을 ✅로 옮기며, **대기열이 3개 이하로 줄면 겹치지 않는 새 주제 6개를 자동으로 추가**한다.

### 글 규격 (캘린더의 스타일 가이드와 동일)

```yaml
---
title: ...
slug: 영문
date: 2026-09-18
updated: 2026-09-20     # 선택 — 기존 글을 고쳤을 때만
description: 155자 내
keywords: ...
category: 구글 노출 | 리뷰·평판 | 콘텐츠·SNS | 광고 | 웹사이트 | AI 검색
related: 서비스 slug
---
```

- 본문 1,800자 이상 · `##` 섹션 4~7개 · 표 또는 체크리스트 1개 이상
- 마지막에 **`## 자주 묻는 질문`** 섹션 + `### 질문` 3~4개 → FAQPage 스키마로 자동 추출된다. **이 제목 문자열을 바꾸면 스키마가 사라진다**
- front matter **`summary: 문장1 | 문장2 | 문장3`** — 글 맨 위 "핵심 요약" 박스 + BlogPosting `abstract`. AI 검색이 그대로 인용할 단정문 3개(규칙은 캘린더 스타일 가이드)
- 톤: 존댓말, 미국 한인 사장님 눈높이, 과장 금지, 솔직한 주의사항 1개 이상
- **본문에 판매 문구 금지** — CTA는 빌드가 자동 부착한다(무료 진단 + related 서비스)
- 이미지는 `content/blog/img/`에 두고 `![캡션](/blog-img/파일명.png)`

> 캘린더 경로: 발행 루틴 프롬프트는 `content/blog-calendar.md`(content/ 바로 아래)로 바르게 적혀 있다(2026-11-04 확인).

**발행 전 검사(2026-11-02)**: 발행 루틴(월수금)·업그레이드 루틴(화목토) 모두 push 전에 `node build.js && node scripts/seo-check.js` 를 돌리고(위 규격을 코드가 검사한다 — summary 3문장·FAQ·1,800자·description·"90일 플랜"), Agent 도구가 있으면 검수 서브에이전트의 적대적 검토를 한 번 받는다. main 에 직접 push 되므로 CI(`seo-check.yml`)가 사후에 한 번 더 돌고, 실패하면 이슈 "SEO 점검 실패 — main" 이 열린다. 블로그 글을 SEO 이유로 고칠 때는 글을 직접 쓰지 않고 `content/blog-upgrade-queue.md` 에 넣는다(§13-1).

---

## 10. 건드리면 안 되는 것

### 10-1. 콘텐츠 가시성 독트린 — 어기면 "빈 화면" 버그가 재발한다

- 콘텐츠는 **기본 표시**로 두고, **JS 초기화가 성공한 뒤에만** 숨김 클래스를 추가한다
- **3초 강제 표시 폴백**을 반드시 유지한다
- `prefers-reduced-motion` 대응
- 모든 웹 결과물은 **360px에서 실측**한다

### 10-2. 사이트맵 `lastmod`는 블로그에만 붙인다

`sitemap()`은 블로그 인덱스와 각 글에만 `lastmod`를 넣고 정적·서비스·패키지 페이지에는 **의도적으로 넣지 않는다.** 빌드할 때마다 모든 URL에 오늘 날짜를 찍으면 구글이 그 사이트맵의 `lastmod`를 통째로 신뢰하지 않게 된다. (2026-09-18 적용, 라이브 확인)

### 10-3. CSS 캐시 버스팅

`style.css?v={md5}`는 `build.js`가 자동 처리한다. **버전 문자열을 손으로 만지지 말 것.** 배포 후 디자인이 안 바뀌어 보이면 하드 리프레시부터.

### 10-4. 시네마틱 히어로 캘리브레이션

i점 좌표(`oy = top + height × 0.215`, `ox = left + width × 0.56` 등)는 **픽셀 실측으로 맞춘 값**이다. 로고 문구나 폰트를 바꾸면 재보정이 필요하다. 마퀴는 화면 폭 2배까지 콘텐츠를 복제한 뒤 `translateX(-50%)` 루프로 돈다(초와이드 이음새 방지).

### 10-5. `data/services.json`은 가격이 실린 파일이다

Stripe 링크와 표시 가격이 여기 들어 있다. 가격 변경은 되돌리기 어려운 실수다 — §11의 승인 정책을 따른다.

### 10-6. 배포 설정

§2 참고. Worker 방식 설정 파일은 2026-11-04 지웠다 — 다시 만들지 말 것.

---

## 11. 배포 승인 정책

`data/services.json`(가격·Stripe 링크)이 바뀌는 커밋은 **사람이 한 번 보고 병합한다.** 블로그 글, 문구 수정, 스타일 변경은 바로 병합해도 된다.

폰에서도 PR 화면에서 변경 내용을 보고 병합 버튼 한 번이면 되므로 이 단계가 "컴퓨터 없이 끝까지"를 막지 않는다.

---

## 12. 주문 처리 (fulfillment)

유료 주문은 Stripe 웹훅 → D1 `orders`+`jobs`, 질문지는 `/api/intake` → D1 `intakes`로 들어오고 같은 이메일의 작업에 자동 연결된다. 진행 상태·결과물 링크·메모는 `/admin/`에서 관리한다(§12-1). 처리는 `bizhigher-fulfillment` 스킬이 담당한다: D1에서 신규 인테이크 조회 → 서비스별 플레이북대로 결과물 제작 → Google Drive 저장 → 고객 발송용 Gmail 초안 준비 → **David가 검토·수정·발송 승인.**

**규칙 (예외 없음)**

- **고객에게 자동 발송 금지.** 루틴·AI는 메일을 보내지 않는다. 고객 메일은 David가 관리자에서 "고객에게 묶음 보내기"를 눌렀을 때만 간다(§12-3)
- 모든 결과물은 David QA 필수
- 노출·SEO 서비스는 **경쟁사 갭 분석을 선행**한다
- 고객 정보는 D1 `customer_profiles`를 재사용한다
- 웹 산출물은 **360px 실측 후** 전달한다
- **리뷰 대가 제공·리뷰 게이팅·가짜 리뷰 금지** — 구글 정책 위반. 서비스 결과물과 블로그 콘텐츠 양쪽에서 원칙으로 명시한다

### 12-2. AI 실행 루틴 (2026-10-21)

- claude.ai/code Routine "BizHigher AI 실행 루틴" `trig_01XTs4cefsWCQCVQPbw1ZtL8`(2026-11-02 재생성 — 이전 `trig_01GhKv3AnLhkwQm9k2CrevXR` 은 사라져서 새로 만들었다. id 가 바뀌면 루틴 API 토큰을 다시 발급해 Cloudflare `ROUTINE_FIRE_URL`·`ROUTINE_FIRE_TOKEN` 을 갱신하고 재배포한다), 매번 새 세션, 환경 `bizhigher`(`env_01GEFiPcc32xD2DkSUWS9R3S`), Gmail 커넥터 없음(조직 정책). **프롬프트 원문은 `docs/ai-runner-routine-prompt-ko.md`** — 루틴 설정에는 그 파일을 읽으라는 한 단락만 넣고, 지시 변경은 파일 커밋으로(2026-11-02). 코드·절차는 `automation/ai-runner/README.md`
- **할 일이 생길 때만 돈다(2026-11-01 David 결정)** — 정기 실행은 LA 07:23 하루 1회(`CRON_TZ=America/Los_Angeles 23 7 * * *`, 사이트 재배포·새 리뷰 확인·7일 무응인 처리용)뿐이고, 그 밖에는 **관리자가 깨운다**: `functions/api/_runner.js wakeRoutine()`이 claude.ai 루틴 API 트리거(`POST https://api.anthropic.com/v1/claude_code/routines/{trig_…}/fire`, 루틴별 토큰 `sk-ant-oat01-…`)를 부른다. 부르는 순간 = 관리자 승인·수정 요청·반려·다시 열기·자동 승인·단계 완료·David 대신 선택·사이트 수정 요청·데모, 질문지 제출(`/api/intake`), Stripe 결제, 고객 페이지 승인·선택·수정 요청, 루틴 자신(`runner.js wake` — 끝날 때 남은 단계가 있으면). **AI 차례(`aiReady`)가 하나도 없으면 부르지 않고**, 3분 안의 중복은 건너뛴다(한 세션이 큐를 전부 처리). 상태는 `settings.runner`(관제탑 하단 한 줄 + "지금 루틴 돌리기" 버튼 = `POST /admin/api/runner/wake {force}`). 환경변수 `ROUTINE_FIRE_URL`·`ROUTINE_FIRE_TOKEN`(§8)이 없으면 조용히 건너뛰고 관제탑에 "미설정"만 보인다 — 그러면 하루 1회만 돈다. 루틴 토큰은 claude.ai/code/routines → 루틴 편집 → Add another trigger → API → Generate token(한 번만 보임), 루틴당 시간당 30회 한도. 이전(2026-10-21~31)의 2시간마다 8회 실행은 빈 실행 비용(회당 약 $0.15) 때문에 폐기
- 흐름: `runner.js queue`(관리자 API `GET /admin/api/runner/queue` — 같은 서비스 앞 단계가 끝난 AI 단계만) → 플레이북대로 결과물 생성 → `submit`(verify면 검증 큐, 아니면 done) → 전달 대기 결과물은 `summary`(고객용 요약 2~4문장 저장, 메일 없음) → 작업별 메모. 발송은 §12-3
- **2026-10-21 확장**: 우리 가게 공개 정보는 `places.js lookup`(고객 프로필 단계와 "GBP·구글 프로필 확인" 수정 요청에서 — 주소·전화·웹사이트·카테고리·영업시간·평점·리뷰 수·place_id·지도 링크·사진 수·소개문을 "(Places 공개 정보, 날짜)" 표시로 채운다), 경쟁사 갭 분석은 `places.js competitors`(실시간 조회만, 저장 금지), 광고 소재·게시물 이미지는 `creative.js gen→compose→upload`(fal.ai flux/schnell 배경 + Playwright 한글 조판 1:1·9:16·1.91:1 → D1 `assets` BLOB → `/a/{id}.jpg`, `functions/a/[id].js`) → `submit --kind images`로 검증 큐에 이미지 그리드. 숏폼 영상은 `creative.js video`(고객 사진 1장 → fal.ai Kling 2.1 이미지→영상 5초 클립, 편당 약 $0.25~0.5, `sv-2` auto)로 클립을 만들고 `creative.js caption`(자막 `|` 구분 자동 배분·`*강조*`·로고·브랜드·CTA·선택 음악 → Playwright 투명 PNG + 시스템 ffmpeg overlay, 2026-10-22)으로 완성본 mp4 까지 루틴이 만든다. **스토리 완성본(2026-10-22)**: `creative.js promo --job N --clip 클립`(Remotion 템플릿 `automation/video`)이 사이트 스펙의 상호·서비스·강조점·별점·전화·영업시간만으로 9:16 20초(훅→서비스 ≤3→왜 우리→엔드카드)를 렌더한다 — 비용 0, 약 1.5분, Kling 클립은 훅 배경. 사이트 스펙이 없는 고객은 caption 5초 클립만. David 는 sv-3 에서 확인만. **리뷰 QR 인쇄물(2026-10-27)**: `creative.js print --job N --preview` 가 룩 3종 시안(A 사진 콜라주+보정 · B 네이비·골드 세리프 · C 미니멀+도형)과 `options.json` 을 만들어 고객이 고르고(qr-2 → qr-2b), `--look {선택}` 이 테이블텐트·포스터·카운터 카드·스티커·모바일 PNG(300dpi) + 인쇄용 PDF(레터, 재단선·접는 선, pdfunite) + 가이드를 만든다(qr-3). 비용 0, 시안 40초·키트 30초. 사진이 없으면 FAL 로 분위기 이미지 2장(A 룩용). 리뷰 대가 문구 없음, 구글 로고 미사용, QR 은 writereview 링크. 글꼴은 `_fonts.js` 자체 서빙. 웹사이트 빌드·실사진 합성·리포트 PDF 는 여전히 기획안만 올리고 David 세션이 마무리(인쇄물은 print 로 자동). 자산 업로드는 multipart(R2 60MB, mp4·webm·pdf 포함)
- `bizhigher` 환경변수: `BIZHIGHER_ADMIN_PASSWORD`(= Cloudflare `ADMIN_PASSWORD`, 없으면 첫 줄에서 멈춤) · `FAL_KEY` · `GOOGLE_PLACES_API_KEY` · `GOOGLE_SA_JSON`(서비스 계정 키 JSON — GA4·GSC 읽기, 2026-11-01). 이미지는 Pages R2 바인딩 `R2_ASSETS`(버킷 `bizhigher-assets`)에 본문, D1 `assets`에 메타·`r2_key`. 바인딩이 없으면 D1 BLOB 폴백. 서빙은 둘 다 `/a/{id}.jpg`(`functions/a/[id].js`)
- 사이트 QA는 `qa.js --url …`(360/768/1280 스크린샷·LCP·전송량·가로 넘침·링크·폼·터치 대상 → 리포트 md + 몽타주 jpg). https 주소면 **Unlighthouse**(사이트 전체 Lighthouse, 2026-10-22)도 돌려 페이지별 성능·접근성·권장사항·SEO 점수와 떨어진 항목을 붙인다(`--no-lighthouse` 로 끔, 임시 주소는 noindex 라 SEO 의 색인 항목 제외). `web-4`·`llp-4`가 이걸 쓴다. 속도 수치는 세션 프록시 영향이 커 상대 비교용. 광고 셋업 `ads-2`는 Google Ads Editor 가져오기 CSV + Meta 설정표까지 만들어 David 구축 시간을 90분 → 25/40분으로
- **가져온 스킬(2026-10-22)**: `.claude/skills/` 에 marketingskills·claude-seo·claude-blog 의 지침 40개(MIT). 루틴은 `docs/skills-map-ko.md` 대로 단계마다 해당 SKILL.md 를 읽고 쓴다(파이썬 도구 단계 제외, 우리 규칙 우선)
- 수동 경로는 그대로 남아 있다: 고객 여정 "AI 실행 지시 복사" → claude.ai fulfillment 스킬. 스킬에는 2026-10-21 기준 연동 섹션이 들어가 있고, 추가분은 `docs/fulfillment-skill-addendum-ko.md` v2

### 12-4. 새 리뷰 감시 — Places 공개 리뷰 (2026-10-22 B-3, GBP API 전 임시)

- `functions/api/_reviews.js syncReviews`: 리뷰 답글 서비스가 들어 있는 진행 중 작업마다 **하루 1회**(20시간 쿨다운) Places Details(`reviews,rating,userRatingCount`, Enterprise+Atmosphere SKU 월 1,000 무료)를 읽는다. place_id 는 질문지 "구글 프로필 공개 정보" 블록 → ob-3 프로필 순. 루틴 큐(`runner/queue`)가 부르고, 검증 큐 탭 "새 리뷰 확인" 버튼(`POST /admin/api/reviews/sync {force}`)으로 즉시도 된다
- **처음 보는 작업은 기준선만** 기록한다(옛 리뷰에 과제 안 만듦 — 백로그는 rr-1). 이후 새 리뷰마다 `job_tasks`에 `rr-live` 단계(service `review-live`, sort 9000 고정 → 서로·rr-2~6에 막히지 않음, who ai, verify 1)를 만든다. 리뷰 원문은 그 단계의 `note`에. 별 1~3 또는 환불·위생·법적·직원 언급(`RISK`)이면 제목에 "⚠ 사람 승인 필요"
- 루틴이 답글 초안을 써서 검증 큐로 → **David가 GBP에 붙여넣고 "승인" = 게시했음**(리뷰당 2분). 자동 승인 규칙 대상이 아니다(게시가 사람 손이므로). GBP API 승인 후 별 4~5는 자동 게시로 바꾼다
- 한계: Places는 "관련도 높은" 리뷰 최대 5개만 준다 — 리뷰가 많은 가게는 놓칠 수 있다. 저장은 `review_seen`(키 해시·별점)·`review_sync`(마지막 확인)뿐, 본문은 고객 자신의 작업 안에만(§14 재게시 아님). 로컬 테스트는 `--binding PLACES_MOCK='{json}'`

### 12-5. 고객 웹사이트 자동 제작·호스팅 (2026-10-22 David 승인, 1단계)

- 구조: **Cloudflare Pages 프로젝트 1개 `bizhigher-sites`** 에 고객 사이트가 `{slug}/` 폴더로 들어가고 `_worker.js` 가 Host 로 폴더를 고른다. 대시보드엔 한 줄만. 원본은 **D1 `sites`(스펙 JSON)**, 저장소에 고객 사이트 파일을 두지 않는다. 설계·대안 비교·함정은 `docs/customer-sites-design-ko.md`
- 흐름: web-2(AI) 질문지·사진·Places 공개 정보 → 스펙 JSON(`sites.js spec --job`) → `sites.js build`(관리자 `GET sites` → 전 고객 렌더 + `_worker.js`) → `sites.js deploy`(wrangler pages deploy) → 임시 주소(`https://bizhigher-sites.pages.dev/{slug}/` 는 즉시, `https://{slug}.sites.bizhigher.com` 은 deploy 가 Pages 도메인+DNS 로 자동 등록, 둘 다 noindex) 를 검증 큐에 → web-3 고객이 CNAME → `bizhigher-sites.pages.dev` → 관리자 고객 여정 "웹사이트 → 연결"(`POST sites/:slug/domain`, `CLOUDFLARE_API_TOKEN` 있으면 Pages 도메인도 추가) → 다음 빌드부터 canonical·색인 허용
- 템플릿 v3(2026-10-22): **스타일 8종** `theme.style` clean/warm/luxe/editorial/bold/soft/mono/neon — 없으면 업종으로 자동(`styleFor`, `theme.mood` 는 v2 별칭). 강조색 하나에서 보조 팔레트 자동 생성. 모션(히어로 순차 등장·카운트업·패럴랙스·카드 틸트·갤러리 마퀴·진행 바)은 JS 뒤에만, reduced-motion 이면 전부 꺼짐. 실시간 "지금 영업 중" 표시(가게 타임존). `hero.video` 로 히어로 배경 영상(Premium). 사진은 저장 전 `sites.js prep`(900px 미만 업스케일, 갤러리 3장 미만이면 분위기 이미지 생성 → `gallery_generated`, 화면에 연출 표시). 섹션은 히어로(통계 행·`em` 강조)·프로모 밴드·서비스·왜 우리·브랜드·갤러리·이용 단계·리뷰 요약·소개·오시는 길·FAQ·CTA 밴드·푸터, 값이 있는 것만. 스펙 키 전체는 설계 문서 §4. 원칙: 360px 우선 · JS 없이 전부 보임(스크롤 연출은 JS 뒤, 3초 폴백) · 빈 값은 섹션 숨김(지어내지 않음) · 리뷰 본문 없음(별점·수·링크·고객이 준 `review_themes` 만) · `lang: ko-en` 이면 `_en` 키로 토글. 템플릿을 고치면 다음 빌드에서 **전 고객 사이트가 함께** 바뀐다 — `sites.js deploy` 가 템플릿 git 리비전을 관리자 `settings.sitesDeployedRev` 에 기록하고, 루틴은 매 실행 `sites.js needs-deploy` 가 yes 면(=머지로 리비전이 바뀜) 전 고객 사이트를 재배포한다. 그 밖에 LA 07시대 첫 실행에도 1회
- **스크롤 효과 v4(2026-11-01 David 요청)**: `theme.scroll` 5종 — 카드 스택(`stack`) · 제목 밑줄·단계 연결선 그리기(`draw`) · 히어로 스크롤 재생(`scrub`, `hero.frames` = `sites.js frames` 로 클립에서 뽑은 webp 36장) · 고정 가로 갤러리(`pin`) · 단어 등장(`reveal`). 스타일·재료별 기본값은 `render.js scrollFor()`, 키 설명은 설계 문서 §4. 원칙 그대로: JS 없이 전부 보임 · reduced-motion 이면 전부 끔 · 360px 실측. sticky 를 쓰는 섹션은 `overflow:hidden` 을 쓰지 않는다(`clip`) — hidden 이면 sticky 가 죽는다
- **지역 랜딩 페이지·측정(2026-11-01 David 결정)**: 지역 랜딩 = 새 사이트가 아니라 기존 사이트에 도시별 입구 페이지(`areas[]`). 우리 사이트면 `sites.js areas` 로 자동, 외부 사이트면 HTML 전달(llp-3·seo-8). GA4·Search Console 은 **소유권은 고객, 운영은 우리** — 질문지 "구글 계정(측정)" 답에 따라 10분 통화(고객 계정) / BizHigher 계정 대리 생성(해지 시 이전, 약관 §6) / 기존 초대. 우리 사이트는 스펙 `analytics` 로 태그·전환 이벤트·인증 메타가 자동, GA4 없이도 우리 비콘(`site_events`)이 페이지 보기·전화·길찾기·예약·문의를 센다. 서비스 계정(`GOOGLE_SA_JSON`)이 뷰어로 추가되면 `analytics.js both` 가 월간 숫자를 읽어 리포트 담당자 확인 칸이 사라진다. 절차 `docs/analytics-setup-ko.md`
- **사진 품질 파이프라인(2026-11-01)**: 고객 사진은 `creative.js photos`(`_photos.js` — 점수·컨택트 시트·스마트 크롭·자동 레벨/화이트밸런스·룩 필터)로 먼저 고르고 보정한다. `sites.js prep --grade` 가 사이트 사진 칸을 같은 룩으로 보정해 다시 올리고, `compose --grade`·`print --photo`·`promo --photos` 가 보정본을 쓴다. 기계 점수는 참고용, 장면 선택은 루틴이 시트를 눈으로 보고 `--pick`
- 호스팅 준비(David 1회): Pages 프로젝트 `bizhigher-sites`(Direct Upload) + API 토큰(Pages Edit · DNS Edit bizhigher.com · Account Read) → `bizhigher` 환경 `CLOUDFLARE_API_TOKEN`·`CLOUDFLARE_ACCOUNT_ID`. 없으면 루틴은 스펙 저장까지만 하고 "[배포 대기 — Cloudflare 토큰 필요]"
- 비용: 정적 무료·무제한, 라우터 호출 무료 하루 10만(넘으면 Workers Paid $5/월). 프로젝트당 도메인 100개(고객 40~50곳) → 넘으면 `bizhigher-sites-2`
- **2단계(2026-10-22 완료)**: `tier: business` 면 홈·서비스·소개·갤러리·오시는 길/문의 + 소식(`posts[]`) 다페이지(상대 링크라 두 호스트 모두 동작, 사이트맵·브레드크럼). **문의 폼** → `functions/api/site-contact.js` → D1 `site_leads` + 타임라인 + David 알림, 사업주 전달은 스펙 `contact.forward_to` 가 있을 때만(§12-3 유일 예외). **수정→재배포 루프**: 고객 페이지 "내 웹사이트" 카드·관리자 "AI에게 수정 요청" → web-2 다시 열림(`revise_note`) → 루틴 `sites.js patch`(부분 패치) → 재배포. 스펙 저장·패치마다 `site_versions` 기록 + `settings.sitesDirty` → `needs-deploy` yes. 관리자 작업 페이지에서 스타일·등급 변경(패치)·문의 리드·버전 기록. 3단계 예정: 예약·주문 임베드, 월간 블로그 자동(seo-4→posts), Turnstile

### 12-3. 고객 메일 정책 — 최소·묶음 (2026-10-21 David 결정)

목표는 거의 100% 자동화. 고객에게 가는 메일은 **꼭 필요한 순간에만, 한꺼번에 묶어서**. 결과물마다 메일을 보내지 않는다.

- **고객 결과물 페이지 `/c/{token}`** (`functions/c/[token].js`): 작업마다 하나, 로그인 없음(`jobs.portal_token` 24자). 전달된(`sent_at`) 결과물만 보이고 이미지 그리드·영상·텍스트·HTML(샌드박스)·링크를 그 자리에서 본다. David 미리보기는 `?preview=1`(관리자 고객 여정 "고객 페이지 미리보기"). noindex
- **보내는 순간은 4가지뿐**: ① 킥오프(ob-5) ② 월간 승인 묶음(게시물 캘린더·콘텐츠·광고 소재·영상 — `APPROVAL_KEYS`) ③ 월간 리포트 ④ 고객 자료가 없어 막혔을 때. 그 밖의 내부 작업물은 메일 없이 관리자 페이지에만 쌓인다
- **발송 = David 클릭 1번**: 관리자 고객 여정 "고객에게 묶음 보내기" → `POST /admin/api/jobs/{id}/send-packet {note}` → 전달 안 된 결과물 전부를 한 통(고객 페이지 링크 + 목록·요약 + 승인 요청 문구)으로 Resend 발송, David BCC, `sent_at`·`packet_id` 기록. 루틴은 이 API를 호출하지 않는다
- **고객 승인은 페이지에서**: `needs_approval` 결과물에 [이대로 진행]/[수정 요청] 버튼. 승인 → `approved_at` + 같은 서비스의 다음 고객 차례 단계 완료 + 타임라인(`approveDeliverable`, `_orders.js`). 수정 요청 → 그 단계 `doing` + `revise_note`로 되돌아가 다음 루틴이 다시 만든다
- **7일 무응답 승인 간주는 코드로 돈다**(2026-10-22 B-1, `sweepAutoApprovals`): 보낸 지 7일 지난 승인 대기 결과물(수정 요청 없는 것)을 루틴 큐·검증 큐를 열 때마다 승인 처리하고 다음 고객 차례 단계를 완료한다. 타임라인 "⏱ 7일 무응답 → 승인 간주". 약관 §2와 일치
- 루틴은 결과물마다 **고객용 요약**(`deliverables.summary`, `runner.js summary`)만 쓴다. 구 `draft --job`(David 메일 초안)은 남아 있지만 기본 경로가 아니다
- **고객이 고르는 승인(2026-10-27 David 결정)** — 시안·세트·버전처럼 선택지가 있는 결과물은 승인 버튼 대신 **카드 N장 + [이 디자인으로 진행]**. 공용 장치라 **인쇄물(qr-2 룩 3종) · 광고 소재(ac-5 세트 3개) · 영상(sv-2 완성본·프로모, `creative.js pick` — 카드에서 재생, [이 영상으로 진행]) · 웹사이트 스타일(web-2, `sites.js styles` — 지금 스타일 + 어울리는 2종 스크린샷 카드, 선택지의 `patch`가 고르는 순간 스펙 `theme.style` 에 적용되고 다음 루틴 실행이 재배포)** 네 곳에서 켜져 있다(2026-10-27). 루틴이 `runner.js submit --options options.json`(`[{key,label,image,video?,note,styles[],default,patch?}]`)으로 올리면 → `job_tasks.options` → David 승인 시 `deliverables.options`(선택지가 있으면 단계 키와 무관하게 `needs_approval`) → 고객 선택은 `deliverables.choice`·`choice_at` + 타임라인 "선택: B …" + **같은 서비스의 다음 단계(고객 차례 아닌 것) note 에 `[고객 선택] B — 라벨`**(AI 면 루틴이, David 면 관리자에서 읽는다). 승인이 완료 처리하는 고객 단계는 **바로 다음 단계가 고객 차례일 때만**(web-3 도메인 연결처럼 더 뒤의 고객 단계는 건드리지 않는다). 플레이북에는 선택을 기다리는 고객 단계(`qr-2b`·`web-2b`·`sv-2b`)를 선택지 단계 바로 뒤에 둬서 다음 AI 단계가 선택 전에 돌지 않게 한다. **7일 무응답 기본값은 사이트 스타일로 자동**(`pickDefaultOption`: 옵션의 `styles` 에 사이트 `theme.style` 이 있으면 그것 → `default` → 첫 항목). David 는 관리자 결과물 목록의 "대신 선택"으로 전화 확인 뒤 고를 수 있다(`POST deliverables/:id/choose {choice}`)

### 12-1. 관리자 페이지 `/admin/` (2026-10-05 1단계)

- 폰 우선(360px). **2026-10-19 재설계**(디자인 캔버스 https://claude.ai/artifact/8kp9pBHEQuy9JkeWNB3tAA): 탭은 관제탑 · 검증 큐 · 고객 · 리드 · 플레이북 · 더보기. 원칙은 "지금 내가 누를 버튼 하나가 가장 크다", 색 = 공을 든 사람(🟢 AI · 🔵 David · 🟠 고객 · 🔴 막힘). 화면 설명과 AI가 결과물을 붙이는 법은 `docs/admin-setup-ko.md`
- 진행률 = 단계마다 10점 + David 분/2 가중 합산(`jobProgress`, `_orders.js`), 검증 대기는 70%로 침. 고객 대기·막힘 집계는 "지금 단계"(가장 앞선 미완료 phase, `currentPhaseTasks`)만 센다. 정렬은 마감 순 / 진행률 낮은 순
- 검증 큐: `job_tasks.status='review'` + `result_kind/result_text/result_url/checks/self_check`. 승인 → done. **`deliverables` 행(발송 대기)은 `_playbook.js`의 `DELIVER_KEYS`에 있는 고객 전달 단계만** 만든다(2026-10-21 — 내부 작업물마다 초안 메일이 가던 문제). 루틴은 작업 단위로 묶어 한 통(`draft --job`)을 David 메일에 보낸다, 수정 요청 → doing + `revise_note`, 반려 → todo. **자동 승인 규칙**(`settings.admin.autoRules`, 2026-10-22 B-2): 규칙마다 단계 키 목록(`tasks`)과 조건(`guard`)이 있고, 켜진 규칙의 단계는 `tasks/:id/result` 제출 즉시 완료 처리된다(큐 건너뜀, 타임라인 "✅ 자동 승인"). 기본 켜짐 4개: 킥오프 ob-5 · NAP 문서 lls-3·lls-7 · 리뷰 답글 rr-1·rr-7("사람 승인 필요" 표시가 없을 때만) · 크리에이티브 브리프 ac-1. 꺼짐: 프로필 ob-3 · 본문(gpo-3·llp-2·seo-4·post-2, self_check 금지 표현 0건·가격 언급 0건일 때만) · 광고 설계 ads-2 · 리포트류 · QA. 검증 큐 탭에서 켜고 끈다. 규칙 집합을 바꾸면 `AUTO_RULES_VERSION`을 올린다(저장된 설정 초기화). 결과물 미리보기는 페이지 안(텍스트·샌드박스 HTML·bizhigher 도메인 임베드), Drive·PDF는 링크
- 작업 상태 파이프라인(고정): **신규 → 정보 확인 → 제작 중 → QA 대기 → 발송 대기 → 완료**, 별도로 **보류**. 바꾸는 쪽은 `JOB_STATUSES`(`_orders.js`) 하나
- 결제(`checkout.session.completed`) → 주문 + 작업(신규). 질문지 제출 → 같은 이메일(30일 내)의 작업에 연결하고 **정보 확인**으로, 마감일은 `data/services.json`의 `delivery`(영업일)로 계산. 질문지가 먼저 오면 질문지만으로 작업을 만들고 결제가 오면 합친다. **질문지 재제출(2026-10-21)**: 같은 이메일의 작업이 30일 안에 있고 이미 질문지를 갖고 있으면 새 작업을 만들지 않고 그 작업의 질문지를 최신 것으로 바꾼다(타임라인에 "다시 제출됨"). "데모 삭제"는 업체명 (데모)뿐 아니라 데모 이메일(`@….example`)로 생긴 작업·질문지까지 지운다
- 상품 매핑은 빌드가 쓰는 `dist/data/stripe-links.json`(Payment Link URL → slug)을 웹훅이 `env.ASSETS`로 읽는다. **새 Stripe 링크를 `services.json`에 넣으면 자동 반영**, 손으로 매핑하지 않는다
- 월 분납 2회차 `invoice.paid`가 오면 타임라인에 "웹사이트 제작 시작 가능" 메모가 자동으로 붙는다(§4)
- 결과물은 이 페이지가 만들지 않는다 — fulfillment 스킬이 만들고 Drive 링크를 여기 붙인다. 고객 자동 발송 금지는 그대로
- **서비스 파이프라인(2026-10-15)**: 작업이 생기면 `_playbook.js`의 단계가 `job_tasks`로 펼쳐진다. 단계마다 🟢자동 / 🟡AI+검수 / 🔵David 수동 / 🟠고객 대기 / 🔴막힘과 David 분, 검증 필수 표시. 단계 상태는 대기→진행→검증 대기→완료(막힘·해당 없음). 플레이북 탭은 작업 없이 상품별 자동화 지도를 보여준다. 관제탑 하단 데모 버튼 2개(2026-10-21): "데모: New Optix Premium 새 주문 1곳"은 결제 직후 상태(단계 전부 비움, **질문지 없음**)라 실제 고객처럼 David가 `/thanks/` 질문지(데모 이메일 미리 채워진 링크가 열림)를 써서 붙여야 ob-3부터 루틴이 돈다 · "데모 고객 4곳 (진행 중 상태)"는 화면 확인용으로 단계가 미리 채워져 있다. 둘 다 실제 결제 없이 같은 코드 경로(업체명에 "(데모)", "데모 삭제"로 제거). API는 `POST /admin/api/demo {only, fresh}`
- **자동화 현황과 병목은 `docs/automation-map-ko.md`.** Premium 12개월 1곳 = 83단계, 자동+AI 46%, David 셋업 21h + 월 14h(목표선 §15의 7~14배). 상위 병목: 광고 운영 수동(5.4h/월) · 로컬 등록 120곳(10h) · GBP API 거절 · 고객 대기 14단계. 플레이북 숫자를 바꾸면 문서 §7 표를 다시 생성한다
- **데모 재실행에서 찾은 병목 정리(2026-11-03)**: ① `aiReady` 의 공통 온보딩 게이트가 ob-3·ob-5 자신까지 막아 질문지 뒤 루틴이 시작되지 않았다 → 공통 단계는 앞 공통 단계가 끝나면 AI 차례 ② 질문지가 이미 답한 고객 단계는 `closeIntakeSteps`(`_orders.js`)가 닫는다 — ob-4(첨부 1개 이상)·web-1(웹사이트 질문지 블록)·an-1(우리가 만드는 사이트)·seo-1(구글 계정 답이 "이미 있어요"가 아니면 skipped) ③ 권한 단계(gpo-1·an-1·ads-1·post-1)는 그 권한이 실제로 필요한 단계 바로 앞으로 옮겼다 — 갭 분석·콘텐츠 팩·측정 설계·광고 설계·캘린더는 권한 없이 먼저 돈다 ④ "AI가 만들고 고객이 승인"인데 고객 단계로만 있던 seo-3·sv-1 은 AI 단계 + 승인 단계(seo-3b·sv-1b)로 나눴다, llp-1 도시 목록은 AI 제안 + David 확인 ⑤ 질문지 notes 한도 3000 → 12000자(첨부 링크가 맨 뒤라 잘렸다). 킥오프 뒤 바로 도는 AI 단계 6 → 13개. ⑥ 깨움 디바운스: 3분 창이 "세션이 아직 도는가"를 몰라 1분 만에 끝난 루틴 직후의 승인을 버리고 다시 깨우지 않았다 → `runner.js wake` 가 `end:true`(루틴 끝 신호, `settings.runner.lastEndAt`)를 보내고, 디바운스는 마지막 깨움 뒤 끝 신호가 없을 때만. 남은 pending 은 관리자 API 요청마다 `retryPendingWake` 가 이어서 깨운다. ⑦ 고객 페이지가 결과물 글을 `<pre>` 원문으로 보여 마크다운 기호·내부 메모("[고객 안내 — David가 검토한 뒤…]"·"참고한 스킬")·내부 단계 제목이 고객에게 그대로 보였다 → `c/[token].js` `customerText`(내부 줄 제거)·`mdHtml`(제목·굵게·목록·표만, 이스케이프 후 변환), 제목은 `_playbook.js customerTitle`(고객 페이지·묶음 메일 공용). ⑧ 질문지에 광고 예산이 없어 ads-2 가 일 $20 을 가정했다 → `/thanks/` 에 "📣 광고 예산·목표" 블록(`#ads-extra`, 광고 셋업·운영·소재·Premium 주문만 — 월 예산 범위·목표·혜택과 종료일 → notes "── 광고 ──") ⑨ `places.js competitors` 가 대형 소매(한인 마트 등)를 경쟁사로 잡았다 → primaryType 이 마트·쇼핑몰·편의점 계열이면 제외(우리 가게가 그 업종이면 유지, `--keep-all`). ⑩ 루틴 두 세션이 같은 단계를 동시에 만들었다(긴 실행 중 3분이 지나 '단계 완료' 깨움이 새 세션을 띄움 → qr-2·web-2 중복) → 큐가 넘긴 단계에 `job_tasks.claimed_at` 을 찍고 90분 동안 다른 세션 큐·`hasAiWork` 에서 뺀다(`isClaimed`). 수정 요청·반려·다시 열기는 claim 을 지운다. 그래서 동시 실행은 서로 다른 단계를 나눠 하는 병렬 처리가 된다. ⑪ 고객이 웹사이트 스타일을 골라도 깨움 판정이 AI 단계만 세서 재배포가 다음 날 07:23까지 밀렸다 → `hasAiWork` 가 `settings.admin.sitesDirty`(재배포 대기)도 할 일로 센다 ⑫ web-4(QA)가 web-3(고객 도메인 연결) 뒤라 고객이 DNS 를 바꾸기 전엔 QA·인도가 멈췄다 → QA 를 임시 주소로 먼저(web-4 → web-3). ⑬ 숏폼 키네틱 자막에서 강조어 뒤에 문장부호가 붙으면("*편하게*,") 강조가 빠지고 별표가 화면에 찍혔다 → `Kinetic.tsx` 가 강조 뒤 문장부호를 허용. ⑭ 자동 QA(llp-4·web-4)가 DELIVER_KEYS 라 Lighthouse 점수·템플릿 결함 목록이 고객에게 갔다 → 전달 대상에서 뺐다(사이트는 고객 페이지 '내 웹사이트' 카드). 고객 페이지가 선택 카드의 이미지·영상을 본문에서 또 보여줘 같은 영상이 6개씩 보였다 → 본문에서 선택지 미디어 제외. ⑮ **David 단계 줄이기(2026-11-03)** — lls-2 인증 이메일은 catch-all 로 자동(5분→0) · lls-6 로컬 등록을 10-15 결정 ④대로 핵심 30곳 보조 입력 + 나머지 시티에이션 빌더 발주(Premium 600분→165분, 추정치·실측 필요) · ac-4 David 큐레이션 → precheck 자동 선별, David 는 ac-5 에서 세트 3개 한 번 승인 · sv-3 영상 확인은 sv-2 검증 큐와 중복이라 자동 완료 · am-1 캠페인 구축은 광고 셋업(ads-3·ads-4)과 같은 주문이면 seedTasks 가 skipped · mr-5 는 '고객에게 묶음 보내기'. Premium 12개월 David 셋업 1,072→572분 · 주간·일간 반복 단계(rr-5·rr-6·am-2·am-3 등)는 한 줄 행이라 영영 완료되지 않아 월간 리뷰 요약 rr-7·광고 리포트 am-5 를 영원히 막았다 → `aiReady` 가 반복 단계(phase weekly·daily)를 막는 단계로 보지 않는다 · seo-7(AI 검색 테스트)·am-4(티어 상한)를 각각 seo-8·am-5 뒤로 ⑰ **월간 운영이 두 번째 달부터 멈추던 문제(2026-11-04)** — 월간 단계(캘린더·블로그·리포트·SEO 개선 등)가 한 번 끝나면 다시 열리지 않았다 → `rolloverRecurring`(월간 28일·주간 6일 뒤 todo, 결과는 prev 로 남김, 타임라인 "🔁 새 달") ⑱ **고객 SEO 루프**: seo-11 키워드 지도(한 키워드 한 페이지) · seo-9 검색 데이터로 기존 페이지 개선(월간, David 승인 뒤 패치) · seo-10 색인 확인(주간) · seo-6 자동 SEO 점검(발행 전 seo-5 도 막는 위반 0) — 서비스 페이지 `data/services.json` seo-aio·`content/services/seo-aio.md` 에도 반영. 템플릿 하위 페이지 7개가 같은 설명을 쓰던 중복을 페이지별 설명으로 고침 ⑯ **고객 답변 칸(2026-11-04)**: 승인 버튼 없는 결과물(킥오프 등)에 '답변·질문 남기기'(킥오프는 '확인 질문에 답하기', 기본 펼침) → `deliverables.customer_reply`·`reply_at` + ob-3 프로필 결과 맨 앞에 `[고객 답변 날짜 — 제목]` + 타임라인 + David 알림. 이전엔 킥오프 확인 질문에 메일 말고 답할 곳이 없었다 · 배경 영상 히어로의 강조어·눈썹 글자는 `accentOnDark`(8스타일 모두 WCAG 4.5:1 이상) 진행 중인 작업에 새 순서를 적용하려면 관리자 API `POST jobs/{id}/tasks/seed {force:true}`(todo 단계만 다시 펼침)
- **AI 단계는 저절로 돌지 않는다(2026-10-21 확인).** 관리자 페이지는 추적기이고 실행기가 아니다. AI 차례(`who` auto·ai, status todo·doing)인 단계는 (a) 고객 여정의 "AI 실행 지시 복사" → claude.ai fulfillment 스킬에 붙여넣기, 또는 (b) 루틴(§19-16)이 실행해 `job_tasks`에 결과물을 붙여야 움직인다. 관제탑 "AI 차례인데 멈춤" 타일과 고객 보드 "AI n일 멈춤" 배지가 이걸 잡는다. 스킬에 넣을 연동 문구는 `docs/fulfillment-skill-addendum-ko.md`
- 완료된 AI 단계는 "AI가 했음"에서 펼쳐 결과물을 보고 **수정 요청(다시 열림)** 또는 **직접 고치기**(result_text·url 편집)가 된다. 검증 불필요 단계도 `result_text`에 한 일을 남기는 것이 규칙
- **"AI가 했음"은 완성물과 내부 작업을 나눠 보여준다**(2026-10-27 David 요청): 고객에게 전달하거나 올릴 **완성 결과물**(이미지·영상 / 글·본문 / 사이트·링크 / 리포트·전달 / **파일 대기(기획안)** — 루틴 규칙 (d)로 파일 대신 기획안만 올라온 것, David 가 만들 목록)이 위에 칩 필터와 함께, **내부 작업·계획**(프로필·분석·설계·설정)은 접힌 목록으로. 분류는 `_playbook.js`의 `OUTPUT_KIND`(단계 키 → 종류) + `outputKind()`(실제 결과물에 이미지·영상·사이트 주소가 있으면 그걸 우선). 새 단계를 플레이북에 넣으면 `OUTPUT_KIND`에도 종류를 적는다(없으면 DELIVER_KEYS 면 리포트, 아니면 내부)
- 2단계 예정: AI 실행 루틴, 고객 포털(사진·권한·월간 승인), GBP 리뷰·게시물 승인 큐(§15), 매출 통계

---

## 13. 측정·검색

- GA4 `G-6D7XST08PS` + Microsoft Clarity 전 페이지
- GSC 등록 + 사이트맵 제출 완료
- 메타 타이틀·스키마에 "AI 광고회사" 키워드
- `ProfessionalService` + `FAQPage` 스키마, `llms.txt`, 블로그 글마다 `BlogPosting` + FAQ 스키마 자동

`llms.txt`는 서비스·패키지·블로그 목록을 자동으로 담으므로 `data/services.json`을 고치면 함께 갱신된다.

### 13-1. SEO 루프 — 자동 점검·주간 전략·실행 루틴 (2026-11-02)

cpacedesk·BestLoanUSA 와 같은 구조(`seo/README.md` 가 기준 문서). David 의 5개 업그레이드 표 기준으로:

| 항목 | bizhigher 에서 |
|---|---|
| 1. 자동 SEO 점검 | `scripts/seo-check.js` — 빌드 결과(dist)와 블로그 원고를 규칙으로 검사. 막는 규칙: meta·canonical·h1·og / 제목·설명문 중복 / 고아 / 사이트맵 / JSON-LD(BlogPosting·FAQPage·별점 금지) / 카피("90일 플랜"·보장) / 블로그 규격 / llms.txt / keyword-map. 보고만: 제목 폭·설명문·inbound·alt·키워드 불일치. `npm run check`. CI `seo-check.yml`(PR 체크 + main 실패 시 이슈) |
| 2. 한 키워드 한 페이지 | `seo/keyword-map.yaml` — 묶음 82개 초안(원고 keywords 에서 자동 생성). 한 URL 이 두 묶음 owner 면 점검이 막는다. 서비스=구매·도구=실행·블로그=정보 로 각도 분담 |
| 3. push 전 2차 AI 검토 | SEO 실행 루틴과 블로그 루틴 2개가 push 전에 검수 서브에이전트(별도 컨텍스트, diff 만 보고 적대적 검토) + seo-check 를 거친다(§9) |
| 4. 매일 색인 확인 | 이미 `BestLoanUSA/seo-data`(`metrics/bizhigher/index-latest.md`, 사이트맵 84 URL 을 URL 검사 API 로 매일) — 전략 루틴이 매주 읽어 I- 항목으로 만든다 |
| 5. AI 검색 유입 추적 | seo-data `latest-extra.md` 의 AI 방문(aiVisits) + GA4 generate_lead 출처 + **리드 자체의 `source` 열**(2026-11-02 — 무료 진단·도구 리드에 referrer 호스트·utm 저장, 관리자 리드 탭 🤖 칩). 전략 루틴 주간 보고서 "AI 검색" 절 |

- 루틴 2개(환경 `bizhigher`, 새 세션, 프롬프트는 파일을 읽으라는 한 단락, **루틴 설정 Repositories 에 저장소를 붙인다 — 전략 루틴은 `bizhigher` + `seo-data`(읽기), 실행 루틴은 `bizhigher`. 세션 범위는 시작 시 고정이라 add_repo 로 못 넓힌다(2026-11-02 첫 실행 교훈)**): **"BizHigher SEO 주간 전략"** 월 08:41 PT(`docs/seo-strategy-routine-prompt-ko.md` — seo-data 측정·색인·AI 방문·seo-check 보고서 → backlog 정렬·블로그 큐 제안·`seo/weekly/<date>.md`·ledger 판정·페이지 평가 8개 → 초안 PR) · **"BizHigher SEO 실행"** 화·목 07:41 PT(`docs/seo-execute-routine-prompt-ko.md` — backlog `ready` 1개 → `claude/seo-<id>-<date>` → 검수 → 초안 PR; 열린 `claude/seo-` 브랜치 3개 이상이면 쉼). 루틴 id: 전략 `trig_01RFfusrbePqT3vysSrZHrdM` · 실행 `trig_01H648RbWtMsV5YKTeuPTtNA`(2026-11-02 생성). 블로그 발행 루틴 `trig_011D66sXmHXN5Zbd31cmoNQa` 프롬프트에도 같은 날 "발행 전 검사" 단락을 넣었다
- 경로 4개: 새 글은 `content/blog-calendar.md` 대기열(발행 루틴이 씀) · 글 보강은 `content/blog-upgrade-queue.md`(업그레이드 루틴이 고침) · 구조는 실행 루틴 PR · 사람 일은 `path: david`. SEO 루틴은 글을 직접 쓰지 않고 **main 에 직접 push 하지 않는다**
- 초안 PR 은 `.github/workflows/seo-pr.yml` 이 `claude/seo-**` 첫 push 에 연다 — **저장소 설정 Actions → General → "Allow GitHub Actions to create and approve pull requests" 가 켜져 있어야 한다**(David 1회, backlog D-01)
- 가격·Stripe 링크(`data/services.json`)와 §10 항목은 SEO 이유로 바꾸지 않는다. 2026-11 기준 노출 64/월·클릭 0·색인 68/84 라 판단 근거는 색인 상태·seo-check·페이지 평가가 대부분이다

**IndexNow** (2026-10-06): 키는 `src/indexnow-key.txt` → 빌드가 `dist/{key}.txt`로 공개. `.github/workflows/indexnow.yml`이 main push마다 `scripts/indexnow.js`로 바뀐 URL만 골라(전역 변경이면 사이트맵 전체) Cloudflare 배포 완료를 기다린 뒤 전송한다. 키를 바꾸면 이전 키 파일은 자동으로 사라지므로 따로 할 일 없음. 수동 확인: `node scripts/indexnow.js <before> <after> --dry-run`

**구조화 데이터 규칙**: 회사는 `@id: https://bizhigher.com/#organization` 하나(`ORG_ENTITY`, 홈에서 정의). 다른 페이지는 `ORG_MIN`/`ORG_REF`로 참조만 한다. 화면 브레드크럼은 `crumbsHtml(items)`, 스키마는 `breadcrumbList(items)` — 같은 items를 넘겨 항상 일치시킨다. `founder`·`sameAs`는 정보 확정 시 `ORG_ENTITY`에 추가

---

## 14. 기술적 함정

- **`functions/`는 Pages Functions 규약.** `onRequestGet` / `onRequestPost` 이름이 곧 라우팅이다. `_`로 시작하는 파일(`_engine.js`, `_notify.js`)은 라우팅되지 않는 내부 모듈
- `/api/intake`는 `onRequestPost`만 있다. GET으로 열면 404가 정상
- **루틴 cron은 UTC.** 월수금 LA 아침 7시 = `0 14 * * 1,3,5`. **마지막 자리가 `*`면 매일 실행된다.** 11월 서머타임 종료 시 1시간 시프트
- **로컬 크론(CronCreate 류)으로 정기 작업을 만들지 말 것** — 세션 종료 시 소멸한다. 스케줄 작업은 반드시 claude.ai 루틴으로
- **스킬(fulfillment 등) 수정은 파일을 고쳐도 무효**다. `propose_skills` 제안 카드를 David가 저장해야 반영된다
- 클라우드 세션의 egress: **bizhigher.com·api.cloudflare.com 모두 열려 있다**(2026-10-21 확인, 이전 "curl 차단" 메모는 낡았다). 관리자 API를 `BIZHIGHER_ADMIN_PASSWORD`로 직접 호출할 수 있다 — AI 실행 루틴이 이 경로를 쓴다
- **Functions 로컬 테스트**는 `npx wrangler pages dev dist --d1 DB=<id> --binding ADMIN_PASSWORD=x --binding STRIPE_WEBHOOK_SECRET=x --persist-to <스크래치 경로>`(설정 파일 없이 플래그로 바인딩을 넘긴다). 로컬 에뮬레이터는 브라우저 navigate 요청에 Functions 대신 404.html을 주는 버그가 있다 — 프로덕션은 Functions 우선이므로 curl이나 Playwright `route.fetch`로 `sec-fetch-mode`를 바꿔 확인한다. 생성되는 `.wrangler/`는 커밋하지 말 것
- **Google Places는 진단용 실시간 조회에만 쓴다.** 조회 결과를 저장해 재게시하지 않는다. 약관(ToS §3.2.3, Places 약관 §14.3): 저장은 place_id만 무기한, 좌표는 30일까지. 그래서 리포트는 30일 뒤 정리되고 noindex를 유지한다(2026-10-23). 리포트 열람은 D1만 읽어 Places·Claude 비용이 들지 않는다 — [[marketingkorean]]과의 경계에서 특히 중요(§16)

---

## 15. 로컬 스타터 운영 자동화 — **제안 단계, 미승인**

> 아래는 별도 대화에서 정리된 방향이며 **David의 명시적 승인을 아직 거치지 않았다.** 확정 사항으로 취급하지 말 것.

- 목표선: **고객 1곳당 David 실투입 주 15~30분 이하.** 로컬 스타터가 월 $139~219이므로 이 선을 넘으면 수익이 남지 않는다
- 구조: AI 생성 → **위험한 것만** 사람 승인 → 나머지 자동 발행. 전건 승인은 인건비 때문에 불가
- 기존 스택 재사용(D1 + Worker cron + Claude + Drive + Gmail). fulfillment 스킬에 "월간 운영" 모드를 추가하는 방식. 새 인프라 도입 없음
- D1 고객 마스터 테이블이 단일 데이터 소스 (NAP, 영업시간, 카테고리, 브랜드 톤, 언어, 사진 폴더, 채널 토큰, 금지 표현)
- **포스팅 승인은 월 1회 캘린더 단위.** 건별 승인이 아니며, 기한 내 무응답 시 승인 간주 조항을 약관에 명시 — **2026-10-21 약관 반영**(`build.js` TERMS_HTML §2 "월간 콘텐츠 승인": 7일 무응답 시 승인 간주, 전화 확인 대체 가능, 낮은 별점·환불·위생·법적 리뷰 답글은 제외)
- 광고 소재 10장/월은 포스팅 이미지 템플릿과 같은 파이프라인에서 생산
- **리뷰 답글 분기**: 별 4~5개 + 일반 내용 → 자동 게시 / 별 1~3개 또는 환불·위생·법적·직원 실명 언급 → 초안만 + 알림, 24시간 내 사람 승인
- 로컬 등록은 직접(반자동)이 기본. 외주 대행은 물량이 감당 안 될 때의 예비책
- **David 소유 사이트(marketingkorean.com, budongsanlisting.com)를 등록처로 활용** — 완전 자동, 월 +5곳 중 1~2곳 충당
- 고객별 전용 인증 이메일 — `{slug}-listings@bizhigher.com`(2026-11-03: bizhigher.com catch-all 이 이미 David 메일로 전달하므로 따로 만들지 않는다, lls-2 자동) — 인증 메일이 David에게 직접 오게 해 고객 왕복 제거
- 도입 순서: 리뷰 자동화 → GBP 포스팅 → FB/IG 포스팅 → 등록 반자동화 → 월간 리포트 자동화
- **GBP API는 지금 즉시 신청**(승인 소요 불확실). Meta는 비즈니스 인증부터 착수하고 그동안은 예약 발행 툴 또는 Meta Business Suite 파트너 권한으로 대체
- **2026-10-15 David 결정**: ① 광고 계정은 **BizHigher MCC 아래 고객 계정 생성**(카드는 고객 명의) ② **월 1회 캘린더 승인 + 무응답 시 승인 간주** 확정(약관 문구는 미작성) ③ 검수는 David가 전부 보다가 **위험 낮은 것부터 자동 확대**(별 4~5 일반 리뷰 답글 → 게시물 이미지·광고 카피 → 본문 → 리포트) ④ 로컬 등록은 핵심 30곳 **David + Claude in Chrome 보조 입력** + 나머지 **일회성 시티에이션 빌더**(곳당 $2~3, 영구). 구독형 애그리게이터(Yext류)는 해지 시 등록 소멸이라 제외
- **GBP 대행사 계정(2026-10-03 확정)**: `hello@bizhigher.com` — Workspace 없이 만든 무료 구글 계정, Business Profile Manager 조직 "BizHigher". 고객 프로필은 **소유자가 이 계정을 관리자로 초대**(관리자는 관리자를 추가 못 함 — 구글 정책). 안내문 `automation/gbp/docs/owner-invite-ko.md`. API 신청 자격은 BestLoanUSA 프로필에 이 계정을 관리자로 넣어 충족. david@bestloanusa.com과 maxinchoi@gmail.com은 BizHigher 용도로 쓰지 않는다. Workspace 전환 시 충돌 계정 이름 변경 + 소유권 이전 필요. **메일 수신(2026-10-22 David 결정)**: bizhigher.com MX는 Cloudflare Email Routing. `hello@`·`help@`·`david@bizhigher.com` + catch-all 전부 **david@bestloanusa.com으로 전달**한다(이전엔 maxinchoi@gmail.com이었음). 이유: Claude가 Gmail 커넥터로 볼 수 있는 사서함이 david@bestloanusa.com뿐이라 확인 메일·고객 답장을 세션에서 바로 읽을 수 있다. 구글 서비스 링크(GBP 초대 등)는 hello@로 로그인해 둔 **Chrome 프로필 "BizHigher"** 에서 연다. Publer 계정은 hello@bizhigher.com(이메일+비밀번호 가입). Workspace 보조 도메인 전환은 GBP API 재신청 뒤로 미룸

### 이 영역의 기술적 함정

- **GBP API 자격**: 인증 후 **60일 이상** 지난 활성 프로필 + 프로필에 웹사이트 등록 + 신청 이메일이 오너/매니저. BizHigher 프로필이 60일 미만이면 BestLoanUSA 프로필로 신청
- **GBP API 신청 2026-10-07 자동 거절.** 원인: 로그인 이메일 도메인(bizhigher.com)·Company website(bizhigher.com)·선택한 프로필(New Optix, newoptix.com)이 서로 달랐다. 심사 도구는 셋이 같은 회사인지 맞춰 본다 → **고객 프로필로는 대행사가 통과 못 한다.** 재신청은 (A) BestLoanUSA 재인증 후 david@bestloanusa.com + bestloanusa.com + BestLoanUSA 프로필, 또는 (B) BizHigher 프로필 인증 60일 후 hello@ + bizhigher.com. 확인 가능한 Yes/No 질문은 사실대로. 양식 맨 위 드롭다운 Submit은 옛 경로라 에러가 정상, "Apply for Google Business Profile API access" 버튼이 진짜 신청
- **GBP API 할당량**: 승인 전 0 QPM(호출 자체 불가), 승인 후 300 QPM. 심사 기간 공식 미명시
- **Meta 앱 심사**: 권한당 2~7영업일, 거절 시 시계 초기화, 복수 권한이면 **총 6~8주**가 현실적
- **Meta 사전 조건**: 비즈니스 인증 선행, 공개 개인정보처리방침 URL, 데이터 삭제 안내 URL, 권한별 시연 영상(실제 페이지 관리자 권한 테스트 계정)
- **Meta 거절 사유**: 시연 영상과 신청 권한 불일치, 리뷰어가 앱에 접근 불가, 두루뭉술한 사용 설명, 안 쓰는 권한 끼워넣기
- **Meta Standard Access는 확장 불가** — 클라이언트 페이지 운영에는 Advanced Access 필수
- **Yelp는 답글 API가 없다** — 알림·초안까지만 자동화, 게시는 수동
- **GBP API 전 리뷰 감지는 Places 공개 리뷰(최대 5개, 관련도순)로 한다**(§12-4). 리뷰가 많은 가게는 놓칠 수 있으니 David가 구글 알림 메일로 보완
- **Bing Places는 GBP 가져오기로 거의 원클릭** — 손으로 채우지 말 것
- **Apple Business Connect는 인증이 까다롭다** — 온보딩 초반에 먼저 시작
- **의료·치과 고객 리뷰 답글에서 환자 여부를 암시하는 표현 금지**(HIPAA). 보상·할인 약속 금지, 개인정보 언급 금지
- **진짜 병목은 폼 입력이 아니라 인증**(이메일·전화·엽서·CAPTCHA). 전화 인증은 고객과 10분 통화로 몰아서 처리
- **CAPTCHA 자동 우회는 하지 않는다.** 사람이 처리
- **"브라우저 자동화 금지"의 범위**: 무인 봇이 계정 생성·CAPTCHA·전화 인증을 넘기는 것. 사람이 화면을 보는 상태에서 Claude in Chrome이 폼을 채우는 **보조 입력은 허용**(2026-10-15). 디렉토리 약관 위반·고객 계정 정지 위험·UI 변경 시 깨짐이 무인 자동화를 피하는 이유

---

## 16. 하지 않기로 한 것

| 하지 않는 것 | 이유 |
|---|---|
| 월간 리포트 $19 구독 판매 | 무료화 — 리포트는 수익원이 아니라 리드·업셀 수단 |
| 케어플랜 별도 상품 | 웹사이트 유지관리 구독($29/월)으로 통합 — 선택 부담 감소 |
| "동시 5곳 한정" 희소성 표기 | 오히려 작아 보이게 함 |
| 파운딩 할인 50% | 20%로 축소 + 장기 플랜 중복 불가 — 마진 파괴 방지 |
| 히어로에 도시명 칩 | "달라스"가 안 와닿음 → 손님 행동 신호 칩(리뷰·전화·길찾기)으로 교체 |
| 고객에게 자동 이메일 발송 | 루틴은 요약만 쓴다. 발송은 David가 "고객에게 묶음 보내기" 클릭(§12-3) |
| 리뷰 대가 제공·게이팅·가짜 리뷰 | 구글 정책 위반 |
| 낮은 별점 리뷰 자동 답글 | 법적·평판 리스크 |
| 30곳 전수 수작업 등록 | 곳당 10~15분 × 30 = 4~6시간. 셋업가 $129로는 적자 |
| Yext류 **구독형** 애그리게이터 | 해지하면 등록이 사라지고 월 비용. 일회성 시티에이션 빌더(영구 등록)는 2026-10-15부터 허용 |
| 포스팅 건별 고객 승인 | 월 26건 왕복은 운영 불가 |
| Meta 앱 심사 완료를 서비스 개시 조건으로 | 6~8주 소요 — 론칭이 막힘 |
| 클라우드 Cowork 세션에서 직접 git push | 프록시 차단(§2) |
| 로컬 크론으로 정기 작업 | 세션 종료 시 소멸 |

---

## 17. marketingkorean과의 경계

별도 저장소, 별도 Cloudflare 프로젝트, 별도 브랜드로 운영하고 각자 독립적으로 키운다. **관계는 숨기지 않는다**(2026-10-23 David 결정 — 이전의 "사이트 상에서 관계를 표기하지 않는다"는 폐기). 기준은 marketingkorean CLAUDE.md §1(2026-10-19)과 같다.

- 관계를 밝힐 때는 **"경영진 일부가 같지만 서로 독립적으로 운영되는 서비스"**로 통일한다. "한 사람이 두 서비스를 운영한다"는 표현은 쓰지 않는다
- **깔때기는 이미 돌고 있다**: 마케팅코리안 사장님 안내(`marketingkorean.com/owners/`)의 "무료 마케팅 진단" 칸에서 업체명·지역·이메일을 넣으면 `bizhigher.com/free-audit/#business=&location=&email=&auto=1`로 새 창이 열려 바로 진단이 시작된다(`build.js`의 무료 진단 해시 채움 스크립트). 마케팅코리안은 입력 정보를 저장하지 않는다. 같은 섹션에 BizHigher 무료 도구 6개 링크가 있다
- 마케팅코리안 쪽 노출은 **사장님 화면(`/owners/`)에만** 둔다. 손님 화면(업소 상세·가이드 글)에는 BizHigher를 노출하지 않는다. 도구·진단을 쓴다고 업소록의 확인 상태·노출 순서가 바뀌지 않는다는 문구를 항상 함께 둔다
- 해시 채움 스크립트의 계약(`business`·`location`·`email`·`auto=1`)을 바꾸면 마케팅코리안 `/owners/` 폼도 함께 고친다
- 데이터는 여전히 분리한다: marketingkorean은 **Google Places 데이터의 저장·재게시를 금지**하고, BizHigher의 진단용 실시간 조회와 섞지 않는다
- BizHigher 사이트에서 마케팅코리안을 소개하는 배너·링크는 아직 없다 — 둘 경우 같은 관계 문구를 쓴다

### 도메인 포트폴리오

- `marketingkorean.com` — 활성, 별도 프로젝트로 분리 운영
- `aimarketingstaff.com` — 영어권 확장 2호 브랜드용 보관
- `moamarketing.com` — 보관
- `aipromoting` / `easyincrease` / `gmarket.us` — 갱신 시 정리 후보

---

## 18. 현재 상태 (2026-09-18 확인)

기술적으로 그의 사이트 중 cpacedesk 다음으로 건강하다.

| 항목 | 상태 |
|---|---|
| `llms.txt` · canonical · 실제 404 | ✅ |
| 홈 스키마 | ✅ ProfessionalService + FAQPage |
| 블로그 글 스키마 | ✅ BlogPosting + FAQPage |
| 사이트맵 `lastmod` | ✅ 블로그 URL에만 |
| Stripe | ✅ 서비스 16개 전부 실링크 연결 |
| 블로그 | 7편 발행, 주 3편 자동 |

---

## 19. 미결

1. ~~배포 설정 정리~~ → 2026-11-04 `wrangler.toml`·`worker/index.js` 삭제, README Pages 기준으로 수정 (§2)
2. ~~블로그 루틴 프롬프트의 캘린더 경로 수정~~ — 2026-11-04 확인 결과 이미 `content/blog-calendar.md` 로 바르게 적혀 있음
3. **BizHigher 자체 GBP 등록** — DBA 취득 대기. 취득 후 주소 숨김 SAB 등록 + 영상 인증 콘텐츠 팩 제작
4. **파운딩 고객 10곳 영업 실행** (FOUNDING20) — 미착수
5. **fal.ai** — 2026-10-21 `FAL_KEY` 연결. 정지 이미지(광고 소재·게시물)와 숏폼 클립(이미지→영상 5초)은 루틴이 만든다(§12-2). **자막·로고·CTA 합성도 루틴이 한다**(2026-10-22, `creative.js caption` — Playwright 로 투명 PNG 를 그려 **시스템 ffmpeg** `/usr/bin/ffmpeg`(overlay·libx264 있음; Playwright 번들 ffmpeg 는 없음)로 얹는다. 편당 약 17초, 비용 0). **20초 스토리 완성본은 Remotion 템플릿**(`automation/video`, `creative.js promo`, 2026-10-22 — 사이트 스펙이 있는 고객. 메뉴 리빌·비포/애프터 템플릿은 예정). sv-3 는 David 확인 5분. 음악은 고객이 준 mp3 가 있을 때만(`--music`). 선불 $50 + 자동 충전 OFF 유지. Higgsfield 유료 전환은 보류
6. **광고 셋업 상품의 GA4/GTM 템플릿화** — 미착수
7. **무료 홍보 채널 등록 실행** — 체크리스트 완성, 실제 등록은 David 몫
8. **블로그 스크린샷 삽입** — David가 스크린샷을 보내면 기존 글 4편에 삽입하는 워크플로우, 대기 중
9. **사이트 구축 현황 문서 갱신** — v22 이후 변경분(180일 통일, 추천 엔진 현행화, 발행 아키텍처) 미반영
10. ~~30곳 디렉토리 마스터 목록~~ → 2026-10-21 `docs/listings-master-30-ko.md`(핵심 5·애그리게이터 4·일반 12·한인 6·업종별). 시티에이션 빌더 업체 선정은 §19-13
11. **반자동 등록의 고객당 실소요 시간** — 1~1.5시간은 추정치. 1~2곳 실측 필요 (§15)
12. 포스팅 3채널 최종 확정 / 예약 발행 툴 선정 / 승인 큐 형태 / ~~무응답 자동 승인 약관 문구~~(2026-10-21 반영) / 월간 리포트 지표 정의 / GBP API 신청 계정 (§15)
13. **로컬 등록 실행** — 핵심 30곳 마스터 목록(Claude in Chrome 보조 입력용) + 일회성 시티에이션 빌더 업체 선정. `docs/automation-map-ko.md` §3
14. **Google Ads API 개발자 토큰 신청**(MCC) — 광고 운영 수동 5.4h/월/고객의 유일한 출구. 토큰 전에는 플랫폼 자동 규칙(`docs/ad-rules-ko.md`)으로 약 3.5h, 토큰 뒤 `ads.js report/propose/apply`(제안→승인→적용, 스마틀리 분석 §3-4·5·6)로 약 1h
15. **GBP API 재신청 경로**(A 또는 B, §15) + BestLoanUSA 프로필 재인증
17. ~~Google Search Console API 켜기~~ → 2026-11-04 켬. 프로젝트 ID `bizhigher-gbp`(번호 564513127968 — 콘솔 목록엔 ID 로 보인다), 소유 계정 **hello@bizhigher.com**. 서비스 계정 `bizhigher-ads-runner@bizhigher-gbp.iam.gserviceaccount.com` 이 bizhigher.com 서치콘솔(`sc-domain:bizhigher.com`)에 제한 사용자로 추가돼 URL 검사·검색 데이터 읽기 확인. Google Cloud 는 계정 3개에 흩어져 있다 — hello@bizhigher.com(bizhigher-gbp) · david@bestloanusa.com(bestloanusa-seo, 결제 계정 011F87-… 카드 거절 경고 2026-10·11) · maxinchoi@gmail.com(미확인). (옛 메모) — 서비스 계정(`GOOGLE_SA_JSON`)의 Google Cloud 프로젝트 564513127968 에 "Google Search Console API" 가 꺼져 있어 `analytics.js gsc`·`index` 가 403. Cloud Console → API 및 서비스 → 라이브러리 → Google Search Console API → 사용. 켜기 전엔 고객 SEO 의 색인 확인(seo-10)·검색 데이터 개선(seo-9)·월간 리포트 GSC 칸이 비고, seo-9 는 점검 결과만으로 고친다
16. ~~AI 실행 루틴~~ → 2026-10-21 생성(§12-2). 환경 비밀 `BIZHIGHER_ADMIN_PASSWORD`가 들어가야 첫 실행이 성공한다. 파일·이미지·영상 단계는 아직 David 세션 몫

---

## 20. 다음 작업 순서

1. 이 파일을 저장소 루트에 `CLAUDE.md`로 추가
2. ~~죽은 배포 설정 정리~~ (2026-11-04 완료)
3. ~~블로그 루틴 프롬프트의 캘린더 경로 수정~~ (이미 맞음)
4. §15의 로컬 스타터 자동화를 승인할지 결정 — 승인되면 "제안 단계" 표기를 걷어내고 §15를 확정 섹션으로 옮긴다
