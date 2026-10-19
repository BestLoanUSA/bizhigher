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

## 화면 설명 (2026-10-19 재설계 — 디자인 캔버스 기준)

읽는 법: 🟢 AI가 끝냄 · 🔵 내 차례 · 🟠 고객 차례 · 🔴 막힘. 모든 화면에서 "지금 내가 누를 버튼 하나"가 가장 크다.

| 탭 | 내용 |
|---|---|
| 관제탑 | 맨 위 "오늘 내 차례 N건 · 예상 시간"(검증·승인·직접), AI가 24시간에 끝낸 단계, 고객 차례, 막힌 고객, 이달 입금. "내가 누를 것"은 마감 순이고 줄 끝 버튼 하나로 바로 간다. "고객 보드"는 고객마다 0→100% 막대(온보딩·셋업·월간 운영 구간) + 최근 단계 색 점 8개 + 다음 할 일 + 마감. 필터(전체·내 차례·고객 차례·막힘·마감 임박)와 정렬(마감 순 / 진행률 낮은 순, 선택은 브라우저에 기억) |
| 검증 큐 | AI가 검증을 요청한 단계가 마감 순으로. 결과물은 **페이지 안에서** 본다 — 텍스트는 그대로, HTML은 샌드박스 프레임, bizhigher.com·프리뷰 주소는 임베드, Drive·PDF는 링크 버튼. 확인 포인트 체크박스 + AI 자기 점검 + 승인 메모. 버튼: **승인**(결과물 목록 등록 → 발송 대기 → 다음 건) / **수정 요청**(메모를 적으면 단계가 "진행"으로 돌아가 AI가 재작성) / **반려**. 오른쪽 "자동 승인" 스위치는 위험 낮은 유형부터 켠다 |
| 고객(여정) | 진행률 큰 숫자 + 마일스톤 6개(결제 → 정보 입력 → 셋업 → 첫 결과물 → 월간 운영 → 180일 리포트) + "지금 할 일" 카드(버튼 하나) + 레인 3개(AI가 했음 / 내 차례 / 고객 차례·막힘, 지금 단계 기준) + 서비스별 진행 막대 + 전체 단계(접힘, 상태 직접 변경) + 결제·질문지 + 결과물·발송 + 타임라인 |
| 리드 | 무료 진단 신청 · 무료 도구 이용자 |
| 플레이북 | 상품별 자동화 지도(작업 없이) |
| 더보기 | 주문(Stripe) · 질문지 · 발급 리포트 |

## AI(fulfillment)가 결과물을 붙이는 법

검증 큐에 올라오려면 단계(`job_tasks`)에 결과물을 붙이고 상태를 `review`로 바꾼다. 둘 중 하나:

- API: `POST /admin/api/tasks/{task_id}/result` with `{"kind":"text|html|link","text":"…","url":"…","checks":["확인 포인트 1","2","3"],"self_check":"금지 표현 0건 …"}` (관리자 로그인 쿠키 필요)
- D1 직접: `UPDATE job_tasks SET status='review', result_kind=?, result_text=?, result_url=?, checks=?(JSON 배열), self_check=?, requested_at=datetime('now') WHERE id=?`

승인되면 `deliverables`에 행이 생기고 `sent_at`이 비어 있다 = **발송 대기**. fulfillment 루틴은 이 행을 보고 Gmail 초안을 만들고, David가 보낸 뒤 "보냈음"을 누른다. 수정 요청은 `revise_note`에 들어가고 상태가 `doing`으로 돌아간다.
