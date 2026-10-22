# AI 실행 루틴 — `job_tasks`의 AI 차례를 매일 처리한다

관리자 페이지(`/admin/`)는 추적기다. 이 루틴이 **AI 차례인 단계를 실제로 만들어 검증 큐에 올리는 실행기**다. (CLAUDE.md §12-1, §12-2)

## 어디서 도나

claude.ai/code **Routine** "BizHigher AI 실행 루틴" — `bizhigher` 환경에서 LA 7:23부터 2시간마다(21:23까지, 하루 8회) 새 세션이 열려 저장소를 클론하고 아래 순서로 돌고 끝난다. David가 검증 큐에서 승인하면 다음 AI 단계는 다음 실행(최대 2시간 뒤)에 만들어진다.

1. `node automation/ai-runner/runner.js queue` — 관리자 API에서 "AI가 지금 할 수 있는 단계"(같은 서비스의 앞 단계가 끝난 것만)와 고객 컨텍스트(질문지·프로필·이미 만든 결과물·David 수정 요청)를 받는다
2. 단계마다 fulfillment 스킬의 플레이북대로 결과물을 만든다 → `submit`으로 올린다. `verify=1`이면 검증 큐(review)로, 아니면 `--done`으로 바로 완료
   - **텍스트** 단계(답글·게시물 본문·키워드·프로필·설계안 등): 스크래치 파일에 쓰고 `submit --task N --file F`
   - **우리 가게 공개 정보**(고객 프로필 `ob-3`, 또는 수정 요청에 "GBP·구글 프로필·Places 확인"이 있을 때): `places.js lookup --query "상호 도시 주" [--pick N]` 결과 표를 프로필에 채우고 "(Places 공개 정보, 날짜)"를 붙인다. 질문지 값과 다르면 둘 다 적고 [확인 필요]
   - **경쟁사 갭 분석**(`gpo-2` 등 노출·SEO 선행 단계): `places.js competitors --query "업종 도시" --me {place_id}` 결과 표를 그대로 결과물에 넣는다. 실시간 조회만 하고 저장·재게시하지 않는다
   - **영상** 단계(`sv-2`): 고객이 첨부한 매장 사진 1장을 `creative.js video --image {URL} --crop 9:16 --out clip.mp4` → fal.ai Kling 2.1 이미지→영상 5초 클립(1~3분 소요, 편당 약 $0.25~0.5) → `upload` → `submit --kind video`. 자막·로고·음악은 David가 편집(sv-3)
   - **이미지** 단계(`ac-3` 광고 소재, `post-4` 게시물 이미지): `creative.js gen`(fal.ai 배경) → `compose`(한글 헤드라인·CTA·브랜드 조판, 1:1·9:16·1.91:1) → `upload`(공개 URL `/a/….jpg`) → URL 목록을 `submit --kind images`. 검증 큐에서 이미지 그리드로 보인다
3. **전달 대기** 결과물(`deliverables.sent_at IS NULL`, 요약 없음)은 `pendingDrafts`로 온다. 루틴은 결과물마다 **고객용 요약 2~4문장**을 써서 `summary --deliverable N --file s.txt` 로 저장만 한다 — 메일은 보내지 않는다. 전달 대기 행은 플레이북 `DELIVER_KEYS` 단계(킥오프·리포트·캘린더·인쇄 파일 등 고객에게 실제로 가는 것)만 생긴다. 발송은 David가 관리자 고객 여정의 **"고객에게 묶음 보내기"** 를 눌렀을 때 한 통(고객 페이지 `/c/{token}` 링크 + 목록·요약 + 승인 요청)으로 간다. `APPROVAL_KEYS`(post-2·seo-3·ac-5·sv-2) 결과물은 고객 페이지에 [이대로 진행]/[수정 요청] 버튼이 붙고, 승인하면 같은 서비스의 다음 고객 차례 단계가 완료되며 수정 요청은 그 단계를 `doing` + `revise_note`로 되돌려 다음 루틴이 다시 만든다
4. 작업마다 한 줄 메모(`note`)를 남기고 요약을 출력한다

## 명령 모음

```bash
node automation/ai-runner/runner.js queue [--limit 12]
node automation/ai-runner/runner.js submit --task 123 --file out.md [--kind text|html|link|images] [--url …] [--checks "a|b|c"] [--self-check "…"] [--done]
node automation/ai-runner/runner.js summary --deliverable 7 --file s.txt      # 결과물의 고객용 요약 저장 (고객 페이지·묶음 메일에 쓰임, 메일 없음)
# submit 응답에 autoApproved 가 오면 관리자 자동 승인 규칙(검증 큐 탭)에 걸려 바로 완료된 것 — 큐에 올라가지 않는다. 출력: "→ 자동 승인(규칙키)"
node automation/ai-runner/runner.js draft --job 5 --file body.txt              # (구) 작업 단위 초안을 David 메일에 — 이제는 summary 를 쓴다
node automation/ai-runner/runner.js note --job 5 --text "…"

node automation/ai-runner/qa.js --url https://고객사이트 --out qa --name home   # 360/768/1280 스크린샷·속도·링크·폼 → qa/home-report.md + qa/home-montage.jpg (upload 로 올려 submit --kind images)
node automation/ai-runner/places.js lookup --query "New Optix Garden Grove CA" [--pick 2]      # 우리 가게 공개 정보 전부 (후보 여러 곳이면 --pick)
node automation/ai-runner/places.js competitors --query "optical store Garden Grove CA" [--me ChIJ…] [--n 3]
node automation/ai-runner/creative.js gen --prompt "modern optical shop interior, warm light, no text, no people" --out bg.jpg [--size square_hd|1024x1024]
node automation/ai-runner/creative.js compose --bg bg.jpg --headline "가을 안경테 신상 입고" --sub "검안 포함 $149부터" --cta "지금 예약" --brand "New Optix" --color "#0A4DF5" --out out --name oct
node automation/ai-runner/creative.js upload --file out/oct-feed.jpg --job 5 --task 123 --label "피드 1:1"   # → https://bizhigher.com/a/….jpg (mp4·pdf 도, R2 면 60MB)
node automation/ai-runner/creative.js video --image https://bizhigher.com/a/고객사진.jpg --crop 9:16 --prompt "subtle slow camera push-in" --out clip.mp4 --job 5 --task 140   # fal.ai 이미지→영상 5초
```

이미지 규칙: fal.ai 프롬프트에 **사람 얼굴·글자·로고·브랜드명을 넣지 않는다**(글자는 compose가 얹는다). 고객이 질문지에 첨부한 매장 사진(`job.intake.notes`의 "── 첨부 파일 ──" 블록, `/a/….jpg`)이 있으면 생성 대신 그 사진을 내려받아 `--bg`로 쓴다. 한 장당 fal.ai 비용은 flux/schnell 기준 약 $0.003, 업로드는 900KB 제한.

## 루틴이 하지 않는 것 (David 또는 스킬 세션이 한다)

- 영상(`sv-2`), 웹사이트·랜딩페이지 빌드(`web-2`, `llp-2`·`llp-3`), Before/After PDF(`gpo-5`), QR 인쇄물 디자인(`qr-2`), 매장 실사진 배경 제거 합성 — 기획안·카피만 텍스트로 올리고 "[David 세션에서 파일 작업 필요]" 메모
- GSC·GA4·광고 계정·GBP 인사이트가 필요한 단계: 키가 환경에 없으면 건너뛰고 메모
- 고객 발송, 낮은 별점 리뷰 답글 게시, `jobs.status` 변경, 사이트 코드 변경·커밋

## 환경 설정 (한 번) — claude.ai/code → `bizhigher` 환경 → Edit → Environment variables

| 변수 | 값 | 없으면 |
|---|---|---|
| `BIZHIGHER_ADMIN_PASSWORD` | Cloudflare `ADMIN_PASSWORD`와 같은 값 (따옴표 없이 `이름=값`) | 루틴이 첫 줄에서 멈춘다 |
| `FAL_KEY` | fal.ai API 키 | 이미지 단계는 기획안만 |
| `GOOGLE_PLACES_API_KEY` | Cloudflare의 같은 키 | 갭 분석 단계는 건너뜀 |
| `BIZHIGHER_ADMIN_URL` | 선택. 기본 `https://bizhigher.com` | |

고객 묶음 메일은 Cloudflare 쪽 `RESEND_API_KEY`를 쓰고 발신은 `CUSTOMER_FROM`(없으면 `NOTIFY_FROM`), David 에게 BCC(`NOTIFY_EMAIL`). 루틴은 메일을 보내지 않는다 — 버튼은 David 만 누른다(§12 자동 발송 금지).

## 저장 위치

Pages 프로젝트에 R2 바인딩 `R2_ASSETS`(버킷 `bizhigher-assets`, 2026-10-21 생성)가 있으면 이미지 본문은 R2 객체 `a/{id}.jpg`에, 메타(업체·단계·라벨·크기·`r2_key`)는 D1 `assets`에 들어간다. 바인딩이 없으면 본문까지 D1 BLOB. 둘 다 `functions/a/[id].js`가 `/a/{id}.jpg`로 서빙하므로 URL은 같다. 버킷 공개 액세스는 켜지 않는다.

## 로컬 확인

```bash
npx wrangler pages dev dist --port 8788 --d1 DB=a917b539-f3d6-4fd9-b9eb-0b11df59d82a --binding ADMIN_PASSWORD=test1234 --binding STRIPE_WEBHOOK_SECRET=x --persist-to /tmp/wr
BIZHIGHER_ADMIN_URL=http://127.0.0.1:8788 BIZHIGHER_ADMIN_PASSWORD=test1234 node automation/ai-runner/runner.js queue
```
