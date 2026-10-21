# AI 실행 루틴 — `job_tasks`의 AI 차례를 매일 처리한다

관리자 페이지(`/admin/`)는 추적기다. 이 루틴이 **AI 차례인 단계를 실제로 만들어 검증 큐에 올리는 실행기**다. (CLAUDE.md §12-1, §19-16)

## 어디서 도나

claude.ai/code **Routine**(Claude Code 클라우드 세션, 이 저장소 체크아웃). 매일 LA 아침 7:23에 새 세션이 열려 아래 순서로 돌고 끝난다.

1. `node automation/ai-runner/runner.js queue` — 관리자 API에서 "AI가 지금 할 수 있는 단계"(같은 서비스의 앞 단계가 끝난 것만)와 고객 컨텍스트(질문지·프로필·이미 만든 결과물)를 받는다
2. 단계마다 fulfillment 스킬의 플레이북대로 결과물을 **텍스트로** 만든다 → `submit`으로 올린다. `verify=1`이면 검증 큐(review)로, 아니면 `done`으로
3. 결과물 중 **발송 대기**(`deliverables.sent_at IS NULL AND drafted_at IS NULL`)는 Gmail **초안**을 만들고 `drafted`로 기록한다. 발송은 절대 하지 않는다
4. 작업마다 한 줄 메모(`note`)를 남기고 요약을 출력한다

## 루틴이 하지 않는 것 (David 또는 스킬 세션이 한다)

- 파일·이미지·영상이 필요한 단계: QR 키트 디자인(`qr-2`), 광고 소재 이미지(`ac-3`), 게시물 이미지(`post-4`), 숏폼(`sv-2`), 웹사이트·랜딩페이지 빌드(`web-2`, `llp-2`·`llp-3`), Before/After PDF(`gpo-5`) — 루틴은 이 단계들에 **기획안·카피·체크리스트만** 텍스트로 올리고 "파일 제작은 David 세션" 메모를 남긴다
- Places·GSC·GA4 등 외부 데이터가 필요한 단계: 키가 환경에 없으면 건너뛰고 메모
- 고객 발송, 낮은 별점 리뷰 답글 게시, `jobs.status` 변경

## 환경 설정 (한 번)

claude.ai/code → 이 환경 → Edit → **Network secrets**(없으면 Environment variables)

| 변수 | 값 |
|---|---|
| `BIZHIGHER_ADMIN_PASSWORD` | Cloudflare의 `ADMIN_PASSWORD`와 같은 값 |
| `BIZHIGHER_ADMIN_URL` | 선택. 기본 `https://bizhigher.com` |

루틴의 Gmail 초안은 세션의 Gmail 커넥터로 만든다(루틴 생성 시 `connectors: ["Gmail"]`).

## 로컬 확인

```bash
BIZHIGHER_ADMIN_URL=http://127.0.0.1:8788 BIZHIGHER_ADMIN_PASSWORD=test1234 node automation/ai-runner/runner.js queue
```
