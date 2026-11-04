# BizHigher.com — 사이트 코드

미국 한인 비즈니스를 위한 AI 마케팅 이커머스. Webflow에서 이전한 정적 사이트입니다.

- **호스팅**: Cloudflare Pages (무료)
- **콘텐츠 수정**: `data/services.json` 하나만 고치면 됩니다 (상품·가격·FAQ 전부)
- **디자인 수정**: `src/style.css` (브랜드 토큰은 파일 상단 `:root`)
- **페이지 구조 수정**: `build.js`
- **진단 폼 저장소**: Cloudflare D1 `bizhigher-db` → `audit_leads` 테이블

## 로컬 빌드

```
node build.js     # dist/ 폴더에 사이트 생성
```

## 배포 — Cloudflare Pages (Git 연결)

이 사이트는 **Cloudflare Pages + Pages Functions** 로 돈다(`functions/` 폴더가 곧 API 라우팅). 2026-11-04 에 예전 Worker 방식 설정(`wrangler.toml`·`worker/index.js`)을 지웠다 — 쓰이지 않았고 고쳐도 사이트가 바뀌지 않아 혼란만 줬다.

- **배포**: GitHub `main` 에 push → Cloudflare Pages 가 `node build.js` 로 빌드해 `dist/` 를 올린다(1~2분). `npx wrangler deploy` 는 **쓰지 않는다**(별도 Worker 가 생겨 도메인이 충돌한다)
- **PR 프리뷰**: 브랜치를 push 하면 `https://<브랜치>.bizhigher-site.pages.dev` 에 프리뷰가 뜬다(프로젝트 이름이 옛 이름 `bizhigher-site`)
- **D1·환경변수·R2 바인딩**: 전부 Cloudflare 대시보드 → Workers & Pages → 이 Pages 프로젝트 → Settings 에 있다(`DB` → `bizhigher-db`, `R2_ASSETS` → `bizhigher-assets`). 파일로 관리하지 않는다
- **커스텀 도메인**: 같은 프로젝트 → Custom domains 에 `bizhigher.com`·`www.bizhigher.com`
- **Functions 로컬 테스트**: `npx wrangler pages dev dist --d1 DB=<id> --binding ADMIN_PASSWORD=x …` (CLAUDE.md §14)

## 이후 콘텐츠 수정 흐름

1. `data/services.json` 수정 (예: 가격 변경, 상품 추가)
2. GitHub에 커밋/푸시 (웹에서 파일 편집 → Commit 도 가능)
3. Cloudflare Pages가 **자동으로 재빌드·배포** (1~2분)

> Claude에게 "SEO 블로그 팩 가격 $169로 바꿔줘"라고 말하면 수정~배포까지 처리됩니다.

## AI 진단 엔진 (환경변수 설정 필요)

폼 제출 → 구글 Places 데이터 수집(우리 가게+경쟁 3곳) → 룰 채점(100점) → Claude 해석 → `/report/{id}` 리포트 즉시 발급.

Cloudflare Pages 프로젝트 → **Settings → Environment variables**(Production)에 등록:

| 변수 | 필수 | 발급처 |
|---|---|---|
| `GOOGLE_PLACES_API_KEY` | 필수 (없으면 리드만 저장) | console.cloud.google.com → Places API (New) 활성화 → API 키 |
| `ANTHROPIC_API_KEY` | 선택 (없으면 템플릿 해석) | console.anthropic.com → API Keys |
| `CLAUDE_MODEL` | 선택 (기본 claude-haiku-4-5) | |

변수 저장 후 **재배포 1회** 필요 (Deployments → 최신 배포 ⋯ → Retry, 또는 아무 커밋).

## 진단 폼 제출 확인

제출된 리드는 D1 `audit_leads` 테이블에 쌓입니다.
Claude에게 "진단 신청 들어온 거 보여줘"라고 하면 조회해줍니다.
(직접 보려면: Cloudflare 대시보드 → Storage & Databases → D1 → bizhigher-db → Console → `SELECT * FROM audit_leads ORDER BY id DESC;`)

## Stripe 결제 연결 (매출 시작할 때)

`data/services.json`의 각 상품 `stripeLinkA` / `stripeLinkB` 값을 Stripe Payment Link 주소로 교체 → 푸시. 현재는 임시로 `/free-audit/`로 연결되어 있습니다.
