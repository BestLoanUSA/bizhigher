# 비즈니스 로그인 설정 — 구글·카카오 (2026-11-07)

고객(사장님)이 `bizhigher.com/login` 에서 구글이나 카카오 버튼 한 번으로 `/my/` 사장님 페이지에 들어온다.
화면은 메일 링크로 여는 고객 페이지(`/c/{token}`)와 같다 — 결정할 것 · 새 소식 · 월간 리포트 · 받은 결과물.

- 데모: `https://bizhigher.com/my/demo` (가상의 순두부 하우스, 키 없이도 열린다)
- 코드: `functions/auth/[[path]].js`(OAuth) · `functions/api/_owner.js`(세션·연결) · `functions/my/[[path]].js`(대시보드) · `functions/c/_dash.js`(화면) · `functions/c/_demo.js`(데모)

## 어떻게 이어지나

| 경우 | 동작 |
|---|---|
| 구글 계정 이메일 = 결제·질문지 이메일 | 로그인하자마자 그 작업이 보인다(`jobs.customer_email`, 대소문자 무시) |
| 다른 구글 계정 · 카카오 | 메일로 받은 고객 페이지 위쪽 **[Google로 연결]·[카카오로 연결]** 을 한 번 → `owner_links` 에 기록 → 다음부터 로그인만으로 열림. 타임라인에 "🔑 비즈니스 로그인 연결" |
| 아무것도 안 맞음 | **시작 허브**(`functions/c/_hub.js`): ① 가게 정보 → ② 60초 무료 진단(로그인·가게 정보 이메일로 내 리포트를 찾아 점수 표시) → ③ 진단 약점으로 고른 서비스·플랜 → ④ 결제하면 진행 순서·미리 준비할 것. 아래 "로그인 회원이 더 받는 것"(도구 하루 10회·새 가이드·카카오톡 채널·새 글 소식). 데모 `/my/demo/start` |
| 작업이 여러 개 | 위쪽 줄에서 가게·상품을 고른다(`/my/?job=ID`) |

버튼(승인·선택·수정 요청·답변)은 고객 페이지와 같은 코드(`handleAction`)를 탄다. 타임라인에는 "사장님 페이지(Google 로그인)에서" 처럼 남는다.

## 키가 없을 때

버튼을 누르면 `/login/?err=setup` 으로 돌아와 "준비 중 — 메일 링크로 들어와 주세요" 가 뜬다. 고객 페이지 링크(`/c/…`)는 그대로 동작한다.

## 1. 구글 (David 10분)

1. Google Cloud Console → 프로젝트 **`bizhigher-gbp`**(hello@bizhigher.com 소유)
2. API 및 서비스 → **OAuth 동의 화면**: 외부 · 앱 이름 "BizHigher" · 지원 이메일 hello@bizhigher.com · 승인된 도메인 `bizhigher.com` · 범위 `openid`·`email`·`profile`(민감하지 않은 범위라 구글 심사 없이 게시 가능) → **앱 게시**(테스트 상태로 두면 테스트 사용자만 로그인된다)
3. **사용자 인증 정보 → OAuth 클라이언트 ID → 웹 애플리케이션**
   - 승인된 리디렉션 URI: `https://bizhigher.com/auth/google/callback`
   - (www 로도 열린다면 `https://www.bizhigher.com/auth/google/callback` 도)
4. 나온 클라이언트 ID·보안 비밀을 Cloudflare Pages(Production) 환경변수에:
   - `GOOGLE_OAUTH_CLIENT_ID`
   - `GOOGLE_OAUTH_CLIENT_SECRET`(암호화)

## 2. 카카오 (David 15분)

1. developers.kakao.com → 내 애플리케이션 → 앱 추가 "BizHigher"
2. 앱 키 → **REST API 키** 복사
3. 카카오 로그인 → 활성화 ON · Redirect URI `https://bizhigher.com/auth/kakao/callback`
4. 플랫폼 → Web → 사이트 도메인 `https://bizhigher.com`
5. 동의항목: **닉네임**(필수). **카카오계정(이메일)** 은 비즈 앱 전환(사업자 정보 등록)이 필요할 수 있다 — 없으면 이메일 없이도 동작하고, 사장님은 고객 페이지에서 [카카오로 연결]을 한 번 누르면 된다
6. (권장) 보안 → Client Secret 발급·사용 ON
7. Cloudflare 환경변수: `KAKAO_REST_API_KEY` · `KAKAO_CLIENT_SECRET`(Client Secret 을 켰을 때만, 암호화)

## 2-1. 카카오 간편로그인 — 휴대폰에서 아이디 입력 없이 (2026-11-07)

REST 키만 있으면 휴대폰에서도 카카오 웹 로그인 화면(아이디·비밀번호 칸 + "카카오톡으로 로그인" 버튼)이 먼저 뜬다. **JavaScript 키**를 넣으면 `/auth/kakao` 가 카카오 SDK(`Kakao.Auth.authorize`, throughTalk)로 휴대폰의 **카카오톡 앱을 바로 열어** 동의 한 번으로 끝난다. PC·카카오톡 없는 폰은 SDK 가 알아서 웹 로그인으로 넘긴다. 인가 코드는 같아서 콜백·토큰 교환(REST 키·시크릿)은 그대로다.

1. developers.kakao.com → 앱 → 플랫폼 키 → **JavaScript 키** 복사 (공개돼도 되는 키)
2. 그 JavaScript 키 설정에 **JavaScript SDK 도메인** `https://bizhigher.com` 추가, 리다이렉트 URI 칸이 있으면 `https://bizhigher.com/auth/kakao/callback` 도 추가
3. Cloudflare Production 환경변수 `KAKAO_JS_KEY` = JavaScript 키 → 재배포
4. 확인: 휴대폰에서 `bizhigher.com/login` → 카카오로 계속하기 → 카카오톡 앱이 열리면 성공. 오류가 나면 로그인 화면에 `(오류 코드: …)` 가 붙는다(예 `token-KOE…` = 리다이렉트 URI·시크릿 문제)

## 2-2. 카카오톡 채널 버튼 (선택)

`KAKAO_CHANNEL_URL` = 채널 주소(예 `https://pf.kakao.com/_xxxxx`)를 넣으면 로그인 회원 페이지 아래 "언제든 물어보세요" 칸에 [카카오톡 채널 추가]·[1:1 채팅하기] 버튼이 생긴다. 없으면 이메일만 보인다. 카카오 콘솔 → 카카오 로그인 → 카카오톡 채널 연결을 해 두면 로그인 동의 화면에서 채널 추가도 함께 받을 수 있다(코드 변경 없음).

## 3. 세션 키 (선택)

`OWNER_SESSION_SECRET` — 비즈니스 로그인 쿠키 서명 키(긴 무작위 문자열, 암호화). 없으면 `ADMIN_PASSWORD` 에서 따로 파생한 키를 쓴다(관리자 쿠키와는 다른 키). 이 값을 바꾸면 모든 사장님이 로그아웃된다.

환경변수를 넣은 뒤 **재배포 1회**.

## 저장했는데 여전히 "준비 중"이 뜰 때

`https://bizhigher.com/auth/google` 을 열었을 때 구글 계정 고르기 대신 `/login/?err=setup&p=google` 로 돌아오면 서버가 키를 못 읽은 것이다.

1. **재배포했는가** — Pages 는 변수를 저장한 뒤에 만든 배포에만 넣는다. Deployments → 최신 Production → ⋯ → Retry deployment(또는 main 에 커밋 하나)
2. **Production 칸에 넣었는가** — Preview 칸에만 있으면 bizhigher.com 에는 없다
3. **이름이 정확한가** — `GOOGLE_OAUTH_CLIENT_ID`·`GOOGLE_OAUTH_CLIENT_SECRET` (앞뒤 공백·오타)
4. 고쳐지면 구글 화면에서 `redirect_uri_mismatch` 가 날 수 있다 → 클라이언트의 리디렉션 URI 가 `https://bizhigher.com/auth/google/callback` 와 글자 하나까지 같은지(끝 `/` 없음). www 로도 들어오면 www 주소도 추가

## 보안 메모

- 비밀번호 없음. 구글·카카오가 확인해 준 계정 id·이메일·이름만 `owner_logins` 에 저장, 구글·카카오 토큰은 저장하지 않는다
- 세션 = 서명 쿠키 `bh_owner`(HttpOnly·Secure·SameSite=Lax, 30일). 상태값 쿠키 `bh_oauth`(10분)로 콜백 위조를 막는다
- 구글 이메일 자동 연결은 `email_verified` 일 때만, 카카오는 `is_email_verified` 일 때만
- `/my/`·`/auth/` 는 robots 차단 + noindex, `/login/` 은 noindex
- 데모(`/my/demo`·`/c/sundubu-house-DEMO…`)는 D1 을 읽지도 쓰지도 않는다 — 루틴·관리자·통계에 섞이지 않는다
