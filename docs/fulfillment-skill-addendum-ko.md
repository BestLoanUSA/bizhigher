# fulfillment 스킬에 추가할 내용 — 관리자 페이지 연동 (2026-10-21)

> 스킬 파일은 저장소에서 고쳐도 무효다(CLAUDE.md §14). David가 claude.ai의 `bizhigher-fulfillment` 스킬 본문에 아래 블록을 그대로 붙여 넣는다.

---

## 관리자 페이지(/admin/)와 함께 일하는 법

작업의 "무엇이 됐고 무엇이 남았나"는 D1 `job_tasks`가 단일 소스다. 스킬은 **인테이크를 직접 보는 대신 AI 차례인 단계를 받아서 처리하고 결과물을 그 단계에 붙인다.**

### 1. 할 일 받기

David가 관리자 페이지에서 복사한 **작업 지시서**(`# BizHigher 작업 지시 — …`)를 붙여넣으면 그 안의 `[task N]` 목록이 이번에 할 단계다. 지시서 없이 "New Optix 작업 진행해줘"처럼 말하면 D1에서 직접 찾는다:

```sql
SELECT t.id, t.key, t.service_name, t.title, t.verify, t.revise_note, j.business, j.service_slug, j.intake_id
FROM job_tasks t JOIN jobs j ON j.id = t.job_id
WHERE j.business LIKE '%New Optix%' AND t.who IN ('auto','ai') AND t.status IN ('todo','doing')
ORDER BY t.sort LIMIT 10;
```

고객 정보는 `intakes`(job.intake_id)와 `customer_profiles`에서 읽는다. 단계 제목이 곧 해야 할 일이고, 서비스별 상세는 이 스킬의 플레이북 섹션을 따른다. `revise_note`가 있으면 David의 수정 요청이므로 그 내용부터 반영한다.

### 2. 결과물 붙이기 (단계마다)

```sql
UPDATE job_tasks SET
  status = 'review',                     -- verify=1 인 단계. verify=0 이면 'done' 과 done_at=datetime('now')
  result_kind = 'text',                  -- text | html | link
  result_text = '…결과물 본문 전체…',      -- 설명문·캘린더·갭 분석표 등은 본문을 그대로. 관리자 페이지 안에서 바로 읽는다
  result_url = 'https://drive.google.com/…',  -- Drive 폴더·프리뷰 주소. 웹사이트·PDF는 링크
  checks = '["David 확인 포인트 1","2","3"]',  -- 결과물마다 David가 봐야 할 2~3가지
  self_check = '금지 표현 0건 · 가격 0건 · 글자 수 706/750',
  requested_at = datetime('now')
WHERE id = {task_id};
INSERT INTO job_events (job_id, kind, note) VALUES ({job_id}, 'task', '👀 검증 요청 — {제목}');
```

검증이 필요 없는 단계(`verify=0`, 예: 갭 분석·QR 생성·프로필 저장)도 `result_text`에 무엇을 했는지 남긴다 — David가 "AI가 했음"에서 펼쳐 보고 필요하면 고친다.

### 3. 승인 뒤

David가 승인하면 `deliverables`에 행이 생기고 `sent_at`이 NULL이다 = **발송 대기**. 스킬은 이 행을 보고 고객 Gmail **초안**을 만든다(자동 발송 금지). David가 보낸 뒤 관리자 페이지에서 "보냈음"을 누른다.

```sql
SELECT d.id, d.title, d.url, j.business, j.customer_email FROM deliverables d JOIN jobs j ON j.id = d.job_id WHERE d.sent_at IS NULL;
```

### 4. 하지 않는 것

- `status`를 `done`으로 바꾸는 것은 verify=0 단계뿐. verify=1 단계는 반드시 `review`로 올리고 David가 승인한다
- 고객에게 메일을 보내지 않는다. 초안까지
- `jobs.status`는 건드리지 않는다(관리자 페이지가 관리)

---

## v2 추가분 (2026-10-21 저녁) — 스킬의 "관리자 페이지와 함께 일하는 법" 섹션 아래에 덧붙인다

### 결과물 종류
- `result_kind` 는 `text | html | link | images | video`. `images`·`video` 는 `result_text` 에 한 줄씩 공개 URL(`https://bizhigher.com/a/….jpg`, `….mp4`)을 넣으면 검증 큐·"AI가 했음"에서 바로 보인다
- 파일 업로드: `POST /admin/api/assets` (multipart `file`, `job_id`, `task_id`, `label`) → `{url}`. R2 가 있어 60MB 까지, mp4·webm·pdf 가능

### 저장소 스크립트 (claude.ai/code 세션에서만 — 스킬 세션에서는 같은 내용을 직접 수행)
- `automation/ai-runner/places.js lookup --query "상호 도시 주"` — 우리 가게 공개 정보 전부. `competitors --query "업종 도시 주" --me {place_id} --n 3` — 경쟁사 갭 분석 표
- `automation/ai-runner/creative.js gen|compose|upload|video|crop` — 광고 소재 3규격, 숏폼 5초 클립
- `automation/ai-runner/qa.js --url …` — 360/768/1280 스크린샷·속도·링크·폼 QA 리포트
- `docs/listings-master-30-ko.md` — 로컬 등록 디렉토리 마스터 목록(등록 방식·인증·자동화 등급)

### 고객 전달 결과물 규칙
- 승인하면 "결과물 · 발송"에 올라가는 단계는 `_playbook.js` `DELIVER_KEYS` 에 있는 것만(킥오프 메일·리포트·캘린더·인쇄 파일·클립 등). 설계안·NAP 문서 같은 내부 작업물은 올리지 않는다
- 고객에게 보내는 메일은 **David가 관리자 고객 여정의 "고객에게 묶음 보내기"를 눌러** 한 통으로 간다(고객 페이지 `/c/{token}` 링크 + 결과물 목록·요약). AI는 결과물마다 고객용 요약 2~4문장만 쓴다(`POST /admin/api/deliverables/{id}/summary {text}`). 결과물마다 메일·초안을 만들지 않는다

### 질문지 읽는 법
- `intakes.phone`·`email` 은 담당자 연락처(업소 대표번호 아님). `notes` 맨 앞 "── 구글 프로필 공개 정보 ──" 블록(place_id 포함), "── 웹사이트 질문지 ──", "── 첨부 파일 ──"(사진·로고·PDF URL) 순으로 읽는다

### 월간 콘텐츠 승인 (약관 반영 2026-10-21)
- 캘린더를 보낸 뒤 7일 안에 회신이 없으면 승인 간주. 전화 확인으로 대체 가능. 낮은 별점·환불·위생·법적 언급 리뷰 답글은 승인 간주 대상이 아니다
