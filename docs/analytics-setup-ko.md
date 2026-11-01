# GA4 · Search Console 셋업 — 고객 대신 만들어 주는 절차 (2026-11-01 David 결정)

대부분 고객은 GA4 도 Search Console 도 없다. 원칙은 **소유권은 고객, 운영은 우리.** 비밀번호를 주고받지 않고, 우리 계정으로 만든 것은 해지 시 넘겨 준다(약관 §6 "측정 계정의 소유권").

## 1. 질문지에서 갈라진다 (`── 구글 계정(측정) ──` 블록)

| 고객 답 | 경로 | David 시간 |
|---|---|---|
| 있음 — 내 계정으로 | **A. 10분 통화** — 고객이 자기 구글에 로그인한 화면을 보며 David 가 Claude in Chrome 보조 입력으로 GA4 속성·Search Console 속성을 만들고, `hello@bizhigher.com`(편집자)과 서비스 계정(뷰어)을 추가한다 | 10분 |
| 없음 — BizHigher 계정으로 | **B. 대리 생성** — `hello@bizhigher.com` 소유로 GA4 속성·Search Console 속성을 만든다. 해지 시 고객 요청 14일 안에 소유권 이전 | 5분 |
| 이미 있음 — 초대할게 | **C. 초대 받기** — 고객이 GA4 속성 액세스 관리와 Search Console 사용자에 `hello@bizhigher.com` 과 서비스 계정을 추가. 안내문은 아래 §4 | 0분 |

서비스 계정 = Cloud 프로젝트 `bizhigher-gbp` 의 `bizhigher-ads-runner@bizhigher-gbp.iam.gserviceaccount.com`(2026-10 생성). 같은 키를 루틴 환경변수 `GOOGLE_SA_JSON` 으로 넣으면 `analytics.js` 가 GA4·GSC 를 읽는다. 키 값은 채팅·결과물에 절대 적지 않는다.

## 2. 우리가 만든 사이트면 설치는 자동이다

- GA4 측정 ID 를 스펙에 넣는다: `node automation/ai-runner/sites.js patch --job N --file p.json` 에서 `{"analytics":{"ga4":"G-XXXXXXX","ga4_property":"123456789","gsc_site":"sc-domain:example.com","gsc_verification":"HTML 태그의 content 값"}}` → 다음 배포에 gtag + 전환 이벤트 4종(`phone_click`·`directions_click`·`booking_click`·`contact_submit`) + 인증 메타가 들어간다. **미리보기(noindex) 주소에는 들어가지 않는다**(데이터 오염 방지) — 도메인 연결(web-3) 뒤 실제 도메인에서만 측정된다
- GA4 쪽에서 이 4개 이벤트를 **핵심 이벤트(전환)** 로 표시해 둔다(관리 → 이벤트 → 핵심 이벤트로 표시). 광고 셋업(ads-2)이 이 이벤트를 전환으로 쓴다
- Search Console 검증은 **HTML 태그 방식**: 속성 추가(URL 접두어 `https://도메인/`) → "HTML 태그" 의 `content` 값을 스펙 `analytics.gsc_verification` 에 넣고 배포 → "확인" 클릭. 도메인 속성(`sc-domain:`)은 DNS TXT 가 필요한데 고객 DNS 는 우리 소유가 아니라 쓰지 않는다(우리 서브도메인 `{slug}.sites.bizhigher.com` 은 noindex 라 필요 없음)
- 외부 사이트(WordPress·Wix 등)는 지금처럼 설치 코드와 안내문을 전달한다(an-3 수동)

## 3. GA4 없이도 숫자는 나온다 — 우리 비콘

우리가 만든 사이트는 페이지 보기·전화 클릭·길찾기·예약·문의 제출을 `https://bizhigher.com/api/site-event` 로 보내고 D1 `site_events` 에 **일별로 집계**한다(개인정보·IP 없음). `node automation/ai-runner/sites.js stats --job N --month 2026-10` 이 월간 표를 준다. 리포트(c-5)는 이 숫자를 기본으로 쓰고, GA4·GSC 가 연결되면 `analytics.js both --job N` 숫자를 덧붙인다. 두 수치는 다를 수 있다(광고 차단·봇 처리 기준이 다름) — 리포트에 출처를 적는다.

## 4. 고객에게 보내는 초대 안내문 (경로 C)

> GA4: analytics.google.com → 관리(⚙) → 속성 액세스 관리 → + → 이메일 `hello@bizhigher.com` 역할 **편집자**, 그리고 `bizhigher-ads-runner@bizhigher-gbp.iam.gserviceaccount.com` 역할 **뷰어** 추가.
> Search Console: search.google.com/search-console → 설정 → 사용자 및 권한 → 사용자 추가 → 위 두 주소를 **전체** 권한으로.
> GA4 측정 ID(G-로 시작)와 속성 ID(숫자)를 알려 주시면 사이트에 바로 연결합니다.

## 5. 통화 10분 순서 (경로 A, David + Claude in Chrome 보조 입력)

1. 고객이 구글 로그인 → analytics.google.com → "측정 시작" → 계정 이름 = 상호, 속성 이름 = 상호 + 웹사이트, 시간대 = 가게 주, 통화 USD
2. 데이터 스트림 → 웹 → 사이트 주소 입력 → **측정 ID(G-…)** 와 **속성 ID(숫자, 관리 → 속성 설정)** 를 받아 적는다
3. 속성 액세스 관리 → hello@(편집자) + 서비스 계정(뷰어)
4. Search Console → 속성 추가 → URL 접두어 → HTML 태그 → `content` 값 받아 적기 → (우리 배포 후) 확인 → 사용자 추가 2명
5. 스펙 패치(§2) → 다음 루틴 실행이 배포 → GA4 실시간에서 전화 클릭 1번 테스트(an-4)

CAPTCHA·2단계 인증은 고객이 직접 누른다. 계정 생성·인증을 무인 봇으로 넘기지 않는다(CLAUDE.md §15).
