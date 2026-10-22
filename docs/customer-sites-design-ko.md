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

## 4. 스펙 JSON (AI가 질문지에서 뽑아 쓰는 것) — 템플릿 v2 (2026-10-22)

```json
{
  "slug": "newoptix", "lang": "ko-en", "tier": "onepage",
  "name": "New Optix", "name_ko": "뉴옵틱스 안경", "tagline": "가든그로브 한인 안경점 · 검안 포함", "tagline_en": "…",
  "category": "안경점", "category_en": "Optometry", "since": 2012, "phone": "(714) 555-1234", "email": "", "address": { "line1": "9876 Garden Grove Blvd", "city": "Garden Grove", "state": "CA", "zip": "92844" },
  "maps_url": "https://maps.google.com/?cid=…", "place_id": "ChIJ…", "review_url": "https://search.google.com/local/writereview?placeid=…", "rating": 4.7, "review_count": 128,
  "hours": [{ "days": "월–금", "time": "10:00–19:00" }, { "days": "토", "time": "10:00–17:00" }, { "days": "일", "time": "휴무" }], "hours_note": "공휴일은 전화로 확인",
  "hero": { "photo": "https://bizhigher.com/a/….jpg", "headline": "오늘 검안, 이틀 안에 새 안경", "em": "이틀 안에", "sub": "…", "headline_en": "…", "em_en": "two days", "sub_en": "…", "badge": "한국어 상담", "badge_sub": "보험 안경 OK" },
  "stats": [{ "value": "14+", "label": "years", "label_ko": "년 운영" }],
  "promo": { "title": "처음 오시는 분, 검안 $59", "text": "…", "href": "tel:…", "cta": "지금 예약", "title_en": "…", "text_en": "…", "cta_en": "…" },
  "services_title": "…", "services_intro": "…", "services": [{ "name": "…", "name_en": "…", "desc": "…", "desc_en": "…", "price": "$149~", "photo": "…" }],
  "highlights_title": "…", "highlights": [{ "title": "…", "text": "…", "title_en": "…", "text_en": "…" }],
  "brands": ["Ray-Ban", "Zeiss"],
  "gallery": ["https://…jpg"],
  "steps_title": "…", "steps": [{ "title": "전화 또는 방문", "text": "…", "title_en": "…", "text_en": "…" }],
  "reviews_title": "…", "review_themes": ["친절한 한국어 상담", "보험 처리가 빠름"],
  "about": { "title": "…", "text": "…", "text_en": "…", "photo": "…" },
  "visit_title": "…", "map_embed": "",
  "faq": [{ "q": "…", "a": "…", "q_en": "…", "a_en": "…" }],
  "closing": "궁금한 점은 전화 한 통이면 됩니다.", "closing_en": "…",
  "social": { "instagram": "", "facebook": "", "yelp": "" },
  "theme": { "color": "#0A4DF5", "mood": "clean" },
  "seo": { "title": "…", "description": "…(155자)", "keywords": "…" },
  "cta": { "booking_url": "" }
}
```

**섹션은 값이 있을 때만 나온다** (순서): 나브 → 히어로(아이브로우 업종·도시·설립, 헤드라인 + `em` 강조 단어 이탤릭, 서브, 버튼, 통계 행 `stats` 없으면 평점·리뷰 수·운영 연수로 자동) → 프로모 밴드 `promo` → 서비스 그리드(`services` 7개 이상이면 4열) → 왜 우리(`highlights` 최대 4) → 브랜드 칩 `brands` → 갤러리(`gallery` 3장 이상) → 이용 단계 `steps`(최대 4) → 리뷰 요약(`rating` 있을 때, `review_themes` 는 **고객이 질문지에서 말한 "손님이 자주 칭찬하는 점"** 만 — Places 리뷰 본문에서 뽑지 않는다) → 소개 `about` → 오시는 길(주소·전화·시간표·`hours_note`·`map_embed` 없으면 지도 열기 카드) → FAQ(`faq`, FAQPage 스키마 자동) → 마무리 CTA 밴드 `closing` → 푸터(시간·서비스·바로가기·SNS) + 폰 하단 고정 전화·길찾기 바.

**무드 `theme.mood`** (없으면 업종으로 자동, `render.js moodFor`): `clean`(흰 바탕·브랜드 색 강조 — 전문직·의료·안경·학원), `warm`(종이색 바탕·네이비 버튼·틸 강조 — 식당·카페·뷰티·꽃집), `luxe`(다크 바탕·골드 강조 — 부동산·융자·법률·보험·스파·주얼리). `theme.color` 는 clean 에서 강조색, warm·luxe 에서는 기본값(#0A4DF5)이 아닐 때만 강조색을 덮어쓴다. 서체: 제목 Fraunces(+warm·luxe 는 Noto Serif KR), 본문 Inter·Pretendard. 섹션 88px 리듬, 스크롤 연출은 JS 가 켜진 뒤에만(기본 표시, 3초 폴백, reduced-motion 존중).

규칙: 사진은 질문지 첨부(`/a/…`) 또는 fal 생성본만. 가격·영업시간·수치(`stats`·`since`)는 질문지·Places 공개 정보에서만(없으면 비움, 지어내지 않음). 리뷰 본문은 넣지 않는다(§14) — 별점·리뷰 수와 "리뷰 보기" 링크만. 의료업은 환자 암시 표현 금지. `lang`이 `ko-en`이면 `_en` 키를 채우고 템플릿이 토글을 보여준다. 헤드라인은 기능이 아니라 **손님이 얻는 것**(속도·편안함·결과)으로 8~14자, `em` 은 그 안의 2~4자.

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

- **1단계(이 PR)**: 원페이지 템플릿 · 라우터 · 스펙 저장 API · 루틴 CLI(spec/build/deploy/render) · 플레이북·루틴 프롬프트 · 로컬 렌더 검증(360px)
- 2단계: 비즈니스 등급(5페이지 + 문의 폼 + 블로그 구조), 도메인 추가 API 자동화(web-3), 고객 페이지에서 사이트 미리보기 임베드, 수정 요청 → 스펙 수정 → 재배포 루프
- 3단계: 유지관리 구독(cp-*)과 연결 — 월간 수정 요청이 스펙 패치로

## 8. 함정

- Pages 직접 업로드는 빌드 횟수 제한(월 500)에 걸리지 않는다. 파일은 해시로 중복 제거되어 바뀐 것만 올라간다
- `_worker.js` 가 있으면 **모든 요청**이 워커를 거친다(정적도). 무료 10만/일 — 넘으면 Workers Paid
- 프로젝트당 커스텀 도메인 100개: 고객당 임시 1 + 실도메인 1~2 → 고객 40~50곳이 한 프로젝트 한계. 넘으면 `bizhigher-sites-2`
- 루틴은 커밋·푸시 금지 → 고객 사이트 원본은 D1 스펙뿐. 템플릿을 바꾸면 다음 빌드에서 전 고객 사이트가 함께 바뀐다(의도: 유지보수 1곳)
- Cloudflare 가 Pages → Workers(Static Assets) 로 권장을 옮기는 중. 빌드 출력은 그대로 쓸 수 있으므로 필요할 때 `wrangler deploy` 로 갈아탄다
