# 관리자 페이지(/admin/) 설정 — David가 할 일

관리자 페이지는 `bizhigher.com/admin/`에 있다. 코드는 `functions/admin/`, 데이터는 D1 `bizhigher-db`. 표가 비어 보이면 아래 1·2번이 안 된 것이다.

## 1. 비밀번호 — 5분, 이게 되면 바로 열린다

Cloudflare 대시보드 → Workers & Pages → **bizhigher-site** → Settings → **Environment variables** → Production → Add variable

| 변수 | 값 |
|---|---|
| `ADMIN_PASSWORD` | 긴 비밀번호 (영문·숫자 20자 이상 권장. 비밀번호 관리자에 저장) |

저장 후 **Deployments → 최신 배포 → Retry deployment**(환경변수는 재배포해야 반영된다, CLAUDE.md §8). 그러고 나서 `bizhigher.com/admin/` 을 열면 로그인 화면이 뜬다. 로그인은 30일 유지.

> 프리뷰 배포(`*.bizhigher-site.pages.dev`)에는 이 변수가 없으므로 자동으로 잠겨 있다. 정상.

## 2. Stripe 웹훅 — 결제가 관리자 페이지에 뜨게 하는 선

Stripe 대시보드 → Developers → **Webhooks** → **Add endpoint**

| 항목 | 값 |
|---|---|
| Endpoint URL | `https://bizhigher.com/api/stripe-webhook` |
| Listen to | Events on your account |
| Events to send | 아래 6개만 체크 |

```
checkout.session.completed
invoice.paid
invoice.payment_failed
customer.subscription.updated
customer.subscription.deleted
charge.refunded
```

만들고 나면 **Signing secret**(`whsec_…`)이 보인다. Reveal → 복사.

Cloudflare 환경변수에 추가:

| 변수 | 값 | 필수 |
|---|---|---|
| `STRIPE_WEBHOOK_SECRET` | 위의 `whsec_…` | **필수** |
| `STRIPE_SECRET_KEY` | Developers → API keys → **Restricted key** 하나 새로 만들어 Payment Links **Read**, Checkout Sessions **Read** 만 켠 키 (`rk_live_…`) | 권장 — 없으면 상품명이 "미확인"으로 들어오고 금액·이메일만 기록된다 |

다시 **Retry deployment**.

확인: Stripe Webhooks 화면에서 방금 만든 엔드포인트 → **Send test event** → `checkout.session.completed` 전송 → 응답 200 이면 연결 끝. 관리자 대시보드 하단 "마지막 Stripe 이벤트"에 시각이 찍힌다. (테스트 이벤트는 가짜 주문 1건을 만드니 작업 목록에서 "보류"로 바꿔 두면 된다.)

## 3. 그 뒤로는 손댈 것 없음

- 결제 → 자동으로 **주문 + 작업(신규)** 생성, 이메일 알림(기존 Resend 설정)
- 고객이 질문지 제출 → 같은 이메일의 작업에 자동 연결, 상태 **정보 확인**, 마감일(영업일) 자동 계산
- 질문지가 먼저 오고 결제 기록이 없으면(이메일 신청 등) 질문지만으로 작업이 생기고, 나중에 결제가 들어오면 합쳐진다
- 구독 갱신·미납·해지·환불은 Stripe가 알려주는 대로 주문 상태가 바뀐다

## 4. 나중에 — Cloudflare Access로 바꾸기 (선택)

구글 로그인으로 잠그고 싶으면 Zero Trust → Access → Applications → Self-hosted, 도메인 `bizhigher.com/admin`, 정책 "이메일이 hello@bizhigher.com 또는 maxinchoi@gmail.com". 만든 앱의 **Audience(AUD) 태그**와 팀 이름(`<팀>.cloudflareaccess.com`)을 환경변수 `ADMIN_ACCESS_AUD`, `ADMIN_ACCESS_TEAM`에 넣으면 코드가 Access 토큰을 검증한다. 그때 `ADMIN_PASSWORD`는 지워도 된다.

## 화면 설명

| 탭 | 내용 |
|---|---|
| 대시보드 | 신규 주문·진행 중·마감 지남·오늘 마감·이달 입금·활성 구독·미납·작업 없는 질문지·7일 진단 신청 + 최근 활동 |
| 작업 | 상태별 필터. 한 건 열면 상태 버튼(신규→정보 확인→제작 중→QA 대기→발송 대기→완료 / 보류), 마감일, 결제 정보(Stripe 링크), 질문지 답변, 결과물 링크(Drive)와 발송 체크, 메모 타임라인, 같은 고객의 다른 작업 |
| 주문 | Stripe 웹훅으로 들어온 결제·구독 목록 |
| 질문지 | 제출된 인테이크. 작업이 없는 건 "작업 만들기" 버튼 |
| 리드 · 리포트 | 무료 진단 신청과 발급 리포트(점수) |
