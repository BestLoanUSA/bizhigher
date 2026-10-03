# GBP 자동화 실험 키트 — 리뷰 답글 · 프로필 게시물

New Optix(가든그로브 안경점)처럼 **David가 구글 비즈니스 프로필(GBP) 관리자 권한을 받은 업소**를 대상으로, 리뷰 관리와 게시물이 어디까지 자동화되는지 실험하는 도구다. CLAUDE.md §12·§15의 규칙을 코드에 그대로 박아 두었다.

> 상태: **API 승인 전.** Google은 승인 전 GBP API 할당량을 0으로 두므로 지금은 `--dry-run`으로 분류·초안 로직만 돌아간다. 승인되는 순간 같은 명령이 실제 프로필에 붙는다.

## 왜 API인가

| 방법 | 리뷰 답글 | 게시물 | 비고 |
|---|---|---|---|
| **GBP API** (이 키트) | 읽기·답글 게시 자동 | 생성·예약 자동 | 승인 필요(수 주), 승인 후 300 QPM |
| 예약 발행 툴(Publer·Buffer 등) | 툴마다 다름, 대부분 알림만 | 지원 | 승인 문제를 툴이 대신 짐. 월 $10~30. **API 승인 전 임시 경로** |
| GBP 앱에서 수동 | 복붙 | 복붙 | 초안은 이 키트가 만들고 David가 붙여넣기 |
| 브라우저 자동화 | — | — | **하지 않는다.** 구글 약관·CAPTCHA 문제(§15) |

## 0. 지금 당장 할 수 있는 것 (승인 없이)

```bash
node automation/gbp/reviews.js draft --dry-run        # 샘플 리뷰 6건 → 분류 + 답글 초안 (ANTHROPIC_API_KEY 있으면 Claude, 없으면 템플릿)
node automation/gbp/reviews.js post  --dry-run --auto # AUTO 등급만 게시 시뮬레이션
node automation/gbp/posts.js plan --month 2026-10 --dry-run   # 한 달치 게시물 초안 8개
```

`automation/gbp/biz/new-optix.json`을 실제 값(전화·웹사이트·영업시간·서비스·직원 이름)으로 채우면 초안 품질이 올라간다.

## 계정 구조 (2026-10-03 결정)

- **BizHigher 대행사 계정 = `hello@bizhigher.com`** (Workspace 없이 만든 무료 구글 계정. 메일은 Cloudflare Email Routing → maxinchoi@gmail.com). Business Profile Manager에 **조직 "BizHigher"** 를 이 계정으로 만들어 두었다.
- 고객 프로필 접근은 **고객(소유자)이 hello@bizhigher.com을 "관리자"로 초대**하는 방식. 관리자는 다른 관리자를 추가할 수 없으므로(구글 정책) 기존 maxinchoi@gmail.com 관리자 권한으로는 옮길 수 없다. 사장님께 보여드릴 안내: [`docs/owner-invite-ko.md`](docs/owner-invite-ko.md)
- 새 계정이 동작하는 것을 확인한 뒤 maxinchoi@gmail.com 관리자는 제거한다. 그 전엔 둘 다 유지.
- GBP API 신청·Cloud 프로젝트·OAuth 토큰 전부 hello@bizhigher.com으로. 신청 자격(60일+ 프로필의 오너/매니저)은 **David가 소유한 BestLoanUSA 프로필에 hello@bizhigher.com을 관리자로 추가**해 충족한다(§15 폴백). 고객 프로필 초대를 기다릴 필요가 없다.
- 나중에 bizhigher.com으로 Workspace를 열면 같은 주소의 무료 계정이 "충돌 계정"이 되어 이름 변경을 요구받는다 → 그때 조직·Cloud 프로젝트 소유권을 Workspace 계정으로 이전.

## 1. API 접근 신청 (David가 할 일, 지금 시작)

자격(§15): 인증 후 **60일 이상** 지난 활성 프로필 + 프로필에 웹사이트 등록 + 신청 이메일이 오너/매니저. BizHigher 프로필이 아직 없으므로 **BestLoanUSA 프로필에 hello@bizhigher.com을 관리자로 추가**한 뒤 신청한다. 모든 단계는 hello@bizhigher.com으로 로그인해서 진행.

1. [Google Cloud Console](https://console.cloud.google.com/) → 새 프로젝트 `bizhigher-gbp`
2. API 라이브러리에서 사용 설정: **My Business Account Management API**, **My Business Business Information API**, **Google My Business API**
3. OAuth 동의 화면: 외부 · 테스트 사용자에 GBP 관리자 구글 계정 추가
4. 사용자 인증 정보 → OAuth 클라이언트 ID → **데스크톱 앱** → client_id / client_secret 보관
5. [GBP API 접근 신청 양식](https://developers.google.com/my-business/content/prereqs) 제출 — 프로젝트 번호, 회사 웹사이트(bizhigher.com), 용도("고객 업소의 리뷰 답글·게시물 관리 대행") 기재
6. 승인 메일이 오면 할당량이 300 QPM으로 열린다

## 2. 토큰 발급 (승인 후 1회)

```bash
GBP_CLIENT_ID=... GBP_CLIENT_SECRET=... node automation/gbp/auth.js
```
브라우저에서 **GBP 관리자 권한이 있는 구글 계정**으로 동의 → 주소창의 `code=` 값을 붙여넣으면 `automation/gbp/.token.json`에 refresh_token이 저장된다(gitignore).

```bash
node automation/gbp/reviews.js locations     # accounts/…/locations/… 경로 확인 → biz 파일 "location"에 기록
```

## 3. 리뷰 — 분기 규칙과 흐름

```
가져오기 → 분류 → 초안 → queue.json → (승인) → 게시
```

| 등급 | 조건 | 처리 |
|---|---|---|
| **AUTO** | 별 4~5개 + 일반 내용 | `post --auto`로 자동 게시 |
| **HUMAN** | 별 1~3개, 또는 환불·위생·법적·사기·직원 실명·**검안/처방/진료/시력 언급** | 초안만. David가 `approved:true`로 바꿔야 게시(24시간 내) |

답글 원칙(코드의 system 프롬프트): 리뷰어 언어로, 2~4문장, 리뷰 대가·할인 약속 금지, **검안·처방 사실을 확인하거나 암시하지 않음**(안경점은 검안이 붙어 건강정보 성격), 직원 실명 반복 금지, 낮은 별점은 사과 → 경청 → 연락처.

```bash
node automation/gbp/reviews.js draft --since 7d          # 최근 7일 미답글 리뷰 초안 → queue.json
# queue.json 열어 HUMAN 건은 approved:true 로 (필요하면 draft 수정)
node automation/gbp/reviews.js post --auto                # AUTO + approved 게시
```

## 4. 게시물 — 월 1회 캘린더 승인

```bash
node automation/gbp/posts.js plan --month 2026-10 --n 8   # 초안 8개 → calendar-2026-10.json
# 캘린더 열어 문구 손보고 mediaUrl(공개 사진 URL) 채우고 approved:true
node automation/gbp/posts.js post --calendar automation/gbp/calendar-2026-10.json --due   # 오늘까지 예정분 게시
```

사진은 **공개 URL**이어야 한다(Drive 공유 링크 불가). 사이트 저장소 `src/showcase/`처럼 Pages에 올리거나 Cloudflare R2를 쓴다. 게시물은 7일 뒤 피드에서 내려가므로 주 2회 리듬이 기준이다.

## 5. 정기 실행으로 올리기 (승인 후)

- **리뷰**: 매일 1회 `draft --since 1d` → `post --auto`. HUMAN 건은 David에게 알림(Gmail 초안 또는 D1 큐).
- **게시물**: 매일 1회 `post --due`.
- 실행 위치: claude.ai 루틴(§14 — 로컬 크론 금지) 또는 Cloudflare Worker cron. 토큰은 환경변수/Secret으로 옮긴다(`.token.json`은 로컬 실험용).
- 큐·승인 상태는 장기적으로 D1 테이블(`gbp_reviews`, `gbp_posts`)로 옮긴다. 지금은 JSON 파일.

## 6. 하지 않는 것

- 낮은 별점 자동 답글 (§16)
- 리뷰 요청 대가·게이팅·가짜 리뷰 (§12)
- 브라우저 자동화·CAPTCHA 우회 (§15)
- 고객(업소)에게 자동 이메일 발송 — 알림은 David에게만 (§12)
