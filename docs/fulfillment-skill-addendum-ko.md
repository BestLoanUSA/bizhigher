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
