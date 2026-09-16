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

## 최초 배포 (딱 한 번, 약 10분)

### 1. GitHub에 올리기
1. github.com → **New repository** → 이름 `bizhigher-site` (Private 권장) → Create
2. 이 폴더의 파일들을 업로드:
   - 웹에서: repo 페이지 → **uploading an existing file** → 폴더 내용 전체 드래그
   - 또는 터미널: `git init && git add -A && git commit -m "init" && git branch -M main && git remote add origin <repo주소> && git push -u origin main`

### 2. Cloudflare Worker 연결 (Git)
1. Cloudflare 대시보드 → **Workers & Pages** → **Create** → **Import a repository**
2. `bizhigher-site` repo 선택
3. 설정 입력:
   - Project name: `bizhigher-site`
   - **Build command**: `node build.js`
   - **Deploy command**: `npx wrangler deploy`
4. **Deploy** → 1~2분 뒤 `bizhigher.<계정>.workers.dev` 에서 사이트 확인

정적 파일 위치(dist), D1 바인딩(DB), 404 페이지는 전부 `wrangler.toml`이 자동으로 처리합니다.

### 3. D1 바인딩 확인 (진단 폼용)
`wrangler.toml`에 이미 설정되어 있어 자동 연결됩니다. 폼 제출이 안 되면:
1. Worker → **Settings** → **Bindings** 에 `DB → bizhigher-db` 가 있는지 확인
2. 없으면 **Add** → **D1 database** → Variable name `DB` / Database `bizhigher-db` → 재배포

### 4. 커스텀 도메인
1. Worker → **Settings** → **Domains & Routes** → **Add** → **Custom Domain** → `bizhigher.com`
2. (도메인이 같은 Cloudflare 계정에 있으면 DNS가 자동 설정됩니다)
3. `www.bizhigher.com`도 같은 방법으로 추가

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
