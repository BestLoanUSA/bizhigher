# 고객 웹사이트 자동 제작·호스팅 설계 (2026-10-22, David 승인)

## 1. 한 줄 요약

고객 사이트는 **Cloudflare Pages 프로젝트 1개(`bizhigher-sites`)** 안에 폴더로 들어가고, **도메인으로 구분**한다. 대시보드엔 이 한 줄만 늘어난다. 사이트 내용은 **D1 `sites` 테이블의 스펙 JSON**이 원본이고, 루틴이 스펙 → 정적 HTML → 배포까지 한다. 저장소에는 고객 사이트 파일을 두지 않는다.

```
질문지(웹사이트 블록·사진·Places 공개 정보)
   → [AI, web-2] 사이트 스펙 JSON 작성  → POST /admin/api/sites   (D1 sites)
   → sites.js build   : GET /admin/api/sites → 모든 고객 사이트를 템플릿으로 렌더 → sites-build/{slug}/…
   → sites.js deploy  : wrangler pages deploy sites-build --project-name bizhigher-sites
   → 임시 주소 https://{slug}.sites.bizhigher.com (noindex) → 검증 큐(web-2) → 고객 페이지
   → [고객, web-3] 도메인 DNS 변경 → David/루틴이 프로젝트에 도메인 추가 → 색인 허용
   → [AI, web-4] qa.js 실측 리포트 → 인도
```

## 2. 왜 이 구조인가 (대안과 비교)

| | 고객마다 Pages 프로젝트 | **프로젝트 1개 + 도메인 라우팅 (채택)** | bizhigher.com 하위 경로 |
|---|---|---|---|
| 대시보드 | 고객 수만큼 늘어남 | 1개 고정 | 0개 |
| 고객 도메인 | 가능 | 가능(프로젝트당 100개) | **불가** |
| 고객 SEO | 독립 | 독립 | BizHigher 일부로 취급 |
| 고객이 떠날 때 | 프로젝트 이전 | 폴더 zip 전달 | 어려움 |
| 비용 | 정적 무료 | 정적 무료 + 라우터 호출(무료 10만/일) | 무료 |

라우터(`_worker.js`)는 모든 요청에서 Host 를 보고 폴더를 고른다. 호출 수가 Workers 무료 한도(하루 10만)를 넘으면 Workers Paid($5/월, 1,000만)로 올린다 — 고객 30곳 수준에서는 무료 범위.

## 3. 구성 요소

| 것 | 어디 | 역할 |
|---|---|---|
| 스펙 스키마·템플릿 | `automation/sites/render.js` | 스펙 JSON → `{ 'index.html', 'sitemap.xml', 'robots.txt' }` (원페이지). 360px 우선, Pretendard, LocalBusiness 스키마, OG, 한/영 토글 |
| 라우터 | `automation/sites/worker.js` | 빌드 출력 루트의 `_worker.js`. `{slug}.sites.bizhigher.com` 또는 연결된 고객 도메인 → `/{slug}/…` 로 재작성해 `env.ASSETS` 서빙. 도메인 표는 빌드 시 박아 넣음 |
| 루틴 CLI | `automation/ai-runner/sites.js` | `spec --job N --file spec.json`(저장+미리보기 URL) · `build [--out sites-build]`(전체 렌더) · `deploy [--dir]`(wrangler) · `render --spec x.json --out dir`(로컬 확인) |
| 관리자 API | `functions/admin/[[path]].js` | `GET sites`(전체 스펙, 빌드용) · `POST sites {job_id, spec}`(업서트, slug 자동) · `GET sites/:slug` · `POST sites/:slug/domain {domain}`(Pages 프로젝트에 도메인 추가 — `CLOUDFLARE_API_TOKEN` 필요) · `POST sites/:slug/live {live}` |
| D1 | `sites` | id · job_id · slug · spec(JSON) · domain · live(0/1) · version · updated_at · published_at |
| 플레이북 | `web-2` | "사이트 스펙 작성 → 빌드·배포 → 임시 주소 검증 큐" (AI 60분 → 15분) |

## 4. 스펙 JSON (AI가 질문지에서 뽑아 쓰는 것) — 템플릿 v3 (2026-10-22)

```json
{
  "slug": "newoptix", "lang": "ko-en", "tier": "onepage",            // "business" 면 5페이지(홈·서비스·소개·갤러리·오시는 길·문의) + 소식(블로그)
  "name": "New Optix", "name_ko": "뉴옵틱스 안경", "tagline": "가든그로브 한인 안경점 · 검안 포함", "tagline_en": "…",
  "category": "안경점", "category_en": "Optometry", "since": 2012, "phone": "(714) 555-1234", "email": "", "address": { "line1": "9876 Garden Grove Blvd", "city": "Garden Grove", "state": "CA", "zip": "92844" },
  "maps_url": "https://maps.google.com/?cid=…", "place_id": "ChIJ…", "review_url": "https://search.google.com/local/writereview?placeid=…", "rating": 4.7, "review_count": 128,
  "hours": [{ "days": "월–금", "time": "10:00–19:00" }, { "days": "토", "time": "10:00–17:00" }, { "days": "일", "time": "휴무" }], "hours_note": "공휴일은 전화로 확인",
  "timezone": "America/Los_Angeles",
  "hero": { "photo": "https://bizhigher.com/a/….jpg", "video": "", "headline": "오늘 검안, 이틀 안에 새 안경", "em": "이틀 안에", "sub": "…", "headline_en": "…", "em_en": "two days", "sub_en": "…", "badge": "한국어 상담", "badge_sub": "보험 안경 OK" },
  "stats": [{ "value": "14+", "label": "years", "label_ko": "년 운영" }],
  "promo": { "title": "처음 오시는 분, 검안 $59", "text": "…", "href": "tel:…", "cta": "지금 예약", "title_en": "…", "text_en": "…", "cta_en": "…" },
  "services_title": "…", "services_intro": "…", "services": [{ "name": "…", "name_en": "…", "desc": "…", "desc_en": "…", "price": "$149~", "photo": "…" }],
  "highlights_title": "…", "highlights": [{ "title": "…", "text": "…", "title_en": "…", "text_en": "…" }],
  "brands": ["Ray-Ban", "Zeiss"],
  "gallery": ["https://…jpg"], "gallery_generated": [], "photo_meta": {},
  "steps_title": "…", "steps": [{ "title": "전화 또는 방문", "text": "…", "title_en": "…", "text_en": "…" }],
  "reviews_title": "…", "review_themes": ["친절한 한국어 상담", "보험 처리가 빠름"],
  "about": { "title": "…", "text": "…", "text_en": "…", "photo": "…" },
  "visit_title": "…", "map_embed": "",
  "faq": [{ "q": "…", "a": "…", "q_en": "…", "a_en": "…" }],
  "closing": "궁금한 점은 전화 한 통이면 됩니다.", "closing_en": "…",
  "contact": { "form": true, "title": "…", "text": "…", "forward_to": "" },
  "posts": [{ "slug": "new-frames-fall", "title": "…", "title_en": "…", "date": "2026-10-15", "excerpt": "…", "body": "문단은 빈 줄로, 소제목은 ## 로", "photo": "" }],
  "social": { "instagram": "", "facebook": "", "yelp": "" },
  "theme": { "color": "#0A4DF5", "style": "clean" },
  "seo": { "title": "…", "description": "…(155자)", "keywords": "…" },
  "cta": { "booking_url": "" }
}
```

**섹션은 값이 있을 때만 나온다** (순서): 나브 → 히어로(아이브로우 업종·도시·설립, 헤드라인 + `em` 강조 단어 이탤릭, 서브, 버튼, 통계 행 `stats` 없으면 평점·리뷰 수·운영 연수로 자동) → 프로모 밴드 `promo` → 서비스 그리드(`services` 7개 이상이면 4열) → 왜 우리(`highlights` 최대 4) → 브랜드 칩 `brands` → 갤러리(`gallery` 3장 이상) → 이용 단계 `steps`(최대 4) → 리뷰 요약(`rating` 있을 때, `review_themes` 는 **고객이 질문지에서 말한 "손님이 자주 칭찬하는 점"** 만 — Places 리뷰 본문에서 뽑지 않는다) → 소개 `about` → 오시는 길(주소·전화·시간표·`hours_note`·`map_embed` 없으면 지도 열기 카드) → FAQ(`faq`, FAQPage 스키마 자동) → 마무리 CTA 밴드 `closing` → 푸터(시간·서비스·바로가기·SNS) + 폰 하단 고정 전화·길찾기 바.

**스타일 `theme.style`** (없으면 업종으로 자동, `render.js styleFor`; `theme.mood` 는 v2 호환 별칭):

| 스타일 | 느낌 | 기본 업종 | 서체(제목) |
|---|---|---|---|
| `clean` | 흰 바탕 + 브랜드 색 강조 | 전문직·의료·안경·학원(기본값) | Fraunces |
| `warm` | 종이색 바탕·네이비 버튼·틸 강조·물결 구분선·종이 질감 | 식당·뷰티·미용실 | Fraunces + Noto Serif KR |
| `luxe` | 다크 + 골드 | 부동산·융자·법률·보험·회계·주얼리 | Fraunces + Noto Serif KR |
| `editorial` | 잡지 레이아웃 — 와이드 사진 위에 큰 세리프 제목이 겹침, 각진 모서리 | 카페·베이커리·디저트·꽃집·브런치 | Playfair Display + Nanum Myeongjo |
| `bold` | 원색 한 가지 + 아주 큰 산세리프, 사선 밴드, 큰 둥근 버튼 | 치킨·분식·BBQ·피자·세차·학원 | Space Grotesk |
| `soft` | 파스텔 그라데이션 배경 + 유리 질감 카드 + 물결 | 네일·피부·스파·소아과·요가·필라테스 | Nunito |
| `mono` | 흑백 사진(호버 시 컬러) + 포인트 색 하나 + 가는 검은 선, 모서리 0 | 변호사·회계·고급 부동산(질문지 지정 시) | DM Serif Display + Gowun Batang |
| `neon` | 다크 + 네온 글로우 테두리·그라데이션 글자 | 바·펍·노래방·헬스장·PC방·당구장 | Space Grotesk |

`theme.color` 는 강조색. clean 은 항상 그 색을 쓰고, 나머지는 기본값(#0A4DF5)이 아닐 때만 그 색으로 덮어쓴다(기본값이면 스타일 고유색: warm 틸, luxe 골드, editorial 벽돌, bold 오렌지, soft 라벤더, mono 레드, neon 민트). 강조색 하나에서 **보조 팔레트를 자동 생성**(유사색 +30°, 보색 +180°, 연한 틴트)해 서비스 아이콘·단계 번호·"왜 우리" 밑줄이 번갈아 다른 톤을 쓴다.

**모션(v3)** — 전부 JS 가 켜진 뒤에만(`.js`) 숨김 클래스가 붙고(콘텐츠 기본 표시), 3초 폴백, `prefers-reduced-motion` 이면 전부 끈다:
- 히어로 순차 등장(아이브로우 → 제목 → 서브 → 버튼 → 통계 → 사진, 0.09초 간격) · 통계 숫자 카운트업 · 히어로/소개 사진 패럴랙스(`data-px`) · 상단 스크롤 진행 바
- 데스크탑 포인터만: 서비스 카드 틸트(±5°), 히어로 사진 빛 반사 · 갤러리는 가로로 흐르는 마퀴 띠(호버 시 정지, reduced-motion 이면 가로 스크롤)
- `hero.video`(mp4 URL)가 있으면 히어로 배경 무음 반복 영상(사진은 poster). Premium 플랜 전용 — `creative.js video --crop 16:9` 로 만든 5초 클립을 업로드해 넣는다

**실시간 영업 중 표시** — `hours[].days`("월–금"·"토"·"Mon–Fri")와 `time`("10:00–19:00"·"10am–7pm"·"휴무")을 빌드가 파싱해 `data-hours` 로 넣고, 브라우저가 가게 타임존(`timezone`, 없으면 주(state)로 추정, 기본 LA)의 지금 시각으로 "지금 영업 중 · 오후 7시 마감 / 영업 종료 · 내일 오전 10시 오픈"을 나브·폰 하단 바에 보여준다. 영업시간표에서 오늘 줄이 강조된다. 파싱 안 되는 줄은 표시에서 빠진다(표에는 그대로).

**사진 준비 `sites.js prep`** — 루틴이 스펙을 저장하기 전에 돌린다. 가로 900px 미만 사진은 fal.ai(`fal-ai/aura-sr`, 4배)로 업스케일해 `/a/` 에 올리고 URL 을 바꾼다(`photo_meta[새URL] = {w,h,from}`). 갤러리가 3장 미만이면 업종 분위기 이미지를 4장이 되게 생성해 `gallery_generated` 에 넣고 화면에 "일부 이미지는 분위기 연출용" 한 줄을 붙인다(사람·글자·로고 없음). FAL_KEY 없으면 크기 보고만. 비용은 장당 약 $0.01~0.03.

**비즈니스 등급 `tier: "business"` (2단계, 2026-10-22)** — 파일이 여러 개가 된다: `/`(히어로·프로모·서비스 6개·왜 우리·리뷰·갤러리 띠) · `/services/`(서비스 전체 + `detail` 문단 + FAQ) · `/about/`(소개·왜 우리·이용 단계·브랜드·리뷰) · `/gallery/`(사진 그리드, 3장 이상일 때) · `/contact/`(오시는 길·영업시간·지도·**문의 폼**·FAQ) · `/blog/` + `/blog/{slug}/`(`posts[]` 있을 때, BlogPosting 스키마). 사이트맵에 전 페이지, 페이지마다 BreadcrumbList. 링크는 상대 경로라 `bizhigher-sites.pages.dev/{slug}/…` 와 서브도메인·고객 도메인 모두에서 동작한다. 원페이지에서도 `contact.form: true` 면 문의 섹션이 붙는다.

**문의 폼** — 정적 사이트에서 `https://bizhigher.com/api/site-contact` 로 일반 POST(JS 없이도 됨, `functions/api/site-contact.js`). 허니팟·2초 미만 거부·IP 하루 20건. 저장은 D1 `site_leads` + 작업 타임라인 "📩 사이트 문의" + David 알림. **사업주에게는 스펙 `contact.forward_to` 에 이메일이 있을 때만** 전달 메일이 간다(§12-3 "고객에게 자동 메일 금지"의 유일한 예외 — 사업주 자신의 사이트로 들어온 손님 문의. 비우면 관리자 "📩 사이트 문의 n건"과 David 알림에만 쌓인다). 보낸 뒤 `?sent=1` 로 돌아와 접수 안내를 보여준다.

**수정 → 재배포 루프** — ① 고객 페이지 `/c/{token}` 맨 위 "내 웹사이트" 카드(iframe + 열기 + **수정 요청 폼**) 또는 관리자 작업 페이지 "AI에게 수정 요청" → `web-2` 단계가 `doing` + `revise_note`(고객이면 "[고객 수정 요청]" 접두)로 다시 열린다(완료된 것도, 이미 열려 있으면 요청을 이어 붙임) ② 다음 루틴이 `sites.js patch --job N --file patch.json`(깊은 병합, null 삭제)으로 바뀐 키만 고쳐 새 버전 저장 → build·deploy → 검증 큐에 "바뀐 키" 와 함께 올림 ③ 스펙 저장·패치는 `site_versions` 에 버전·메모·바뀐 키를 기록하고 관리자 `settings.sitesDirty` 를 켠다 → `sites.js needs-deploy` 가 yes(관리자에서 스타일·등급만 바꿔도 2시간 안에 재배포). 관리자 "버전 기록" 버튼으로 본다. `sites.js diff --job N` 은 마지막 두 버전의 바뀐 키.

규칙: 사진은 질문지 첨부(`/a/…`) 또는 fal 생성본만. 가격·영업시간·수치(`stats`·`since`)는 질문지·Places 공개 정보에서만(없으면 비움, 지어내지 않음). 리뷰 본문은 넣지 않는다(§14) — 별점·리뷰 수와 "리뷰 보기" 링크만. 의료업은 환자 암시 표현 금지. `lang`이 `ko-en`이면 `_en` 키를 채우고 템플릿이 토글을 보여준다. 헤드라인은 기능이 아니라 **손님이 얻는 것**(속도·편안함·결과)으로 8~14자, `em` 은 그 안의 2~4자. `stats`·`since`·`review_themes` 는 질문지·Places 에 있는 것만.

## 5. 주소·색인

- 임시: **`https://bizhigher-sites.pages.dev/{slug}/`** 는 배포 즉시 항상 열린다(관리자 "미리보기 열기"·검증 큐 임베드가 이 주소). `https://{slug}.sites.bizhigher.com` 은 `sites.js deploy` 가 Pages 커스텀 도메인 + DNS CNAME 으로 자동 등록한다(토큰에 Zone Read 가 없으면 DNS 는 못 만들고 상태를 출력). 둘 다 `<meta name="robots" content="noindex">` + robots.txt Disallow
- 고객 도메인 연결(web-3): 고객 등록대행사에서 CNAME `@`/`www` → `bizhigher-sites.pages.dev` (또는 Cloudflare로 네임서버 이전). 그다음 `POST sites/:slug/domain` 이 Pages 프로젝트에 도메인을 추가하고 `live=1` → 다음 빌드부터 색인 허용·sitemap·canonical 이 그 도메인
- 임시 주소는 도메인 연결 후에도 살아 있되 canonical 은 고객 도메인

## 6. David가 한 번 할 것 (호스팅 준비)

1. Cloudflare → Workers & Pages → Create → Pages → **Direct Upload** → 프로젝트 이름 `bizhigher-sites` (빈 프로젝트. 첫 배포는 루틴이 한다)
2. Cloudflare → My Profile → API Tokens → Create Token → "Edit Cloudflare Workers" 템플릿 말고 **Custom**: `Account · Cloudflare Pages · Edit` + `Zone · DNS · Edit`(bizhigher.com) + `Account · Account Settings · Read`
3. claude.ai/code `bizhigher` 환경 변수에 `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`(대시보드 오른쪽 Account ID). Cloudflare Pages 프로젝트(bizhigher.com)의 환경변수에도 `CLOUDFLARE_API_TOKEN`·`CLOUDFLARE_ACCOUNT_ID`(도메인 추가 API용, 선택)
4. DNS: `*.sites.bizhigher.com` 은 Pages 가 도메인을 추가할 때 자동으로 CNAME 을 만든다(같은 계정) — 손으로 할 것 없음

## 7. 단계별 범위

| 단계 | 내용 | 상태 |
|---|---|---|
| 1 | 원페이지 템플릿, D1 스펙, 한 프로젝트 호스팅, 서브도메인 자동 등록, 도메인 연결 | 2026-10-22 완료 |
| v2·v3 | 프리미엄 디자인, 스타일 8종, 모션, 영업 중 표시, 사진 준비(prep), 히어로 영상 | 2026-10-22 완료 |
| 2 | 비즈니스 등급(5페이지+블로그), 문의 폼(D1 리드·David 알림·선택 전달), 수정→패치→재배포 루프(버전 기록·dirty 플래그), 고객 페이지 임베드+수정 요청, 관리자 스타일·등급 변경 | 2026-10-22 완료 |
| 3 (예정) | 예약·주문 외부 툴 임베드, 다국어 3개 이상, 월간 블로그 자동 발행(seo-4 → posts), Turnstile, 고객 도메인 자동 DNS | — |

## 8. 함정

- Pages 직접 업로드는 빌드 횟수 제한(월 500)에 걸리지 않는다. 파일은 해시로 중복 제거되어 바뀐 것만 올라간다
- `_worker.js` 가 있으면 **모든 요청**이 워커를 거친다(정적도). 무료 10만/일 — 넘으면 Workers Paid
- 프로젝트당 커스텀 도메인 100개: 고객당 임시 1 + 실도메인 1~2 → 고객 40~50곳이 한 프로젝트 한계. 넘으면 `bizhigher-sites-2`
- 루틴은 커밋·푸시 금지 → 고객 사이트 원본은 D1 스펙뿐. 템플릿을 바꾸면 다음 빌드에서 전 고객 사이트가 함께 바뀐다(의도: 유지보수 1곳)
- Cloudflare 가 Pages → Workers(Static Assets) 로 권장을 옮기는 중. 빌드 출력은 그대로 쓸 수 있으므로 필요할 때 `wrangler deploy` 로 갈아탄다
