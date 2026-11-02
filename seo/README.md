# seo/ — bizhigher.com SEO 루프의 공유 기억 (2026-11-02)

목표: 미주 한인 사장님이 "구글 지도 노출·리뷰·웹사이트·광고"를 검색하거나 ChatGPT·구글 AI 요약에 물을 때
bizhigher.com 이 먼저, 많이 보이는 것. 판단 기준은 **무료 진단·도구 리드와 결제**다 — 노출·순위는 중간 지표.

루틴(에이전트)은 세션이 끝나면 아무것도 기억하지 못한다. **상태는 전부 이 디렉터리에 있다.** 채팅·메일에 남긴 것은 다음 루틴이 보지 못한다.
같은 구조를 cpacedesk(`cpacedesk/seo/README.md`)와 BestLoanUSA 가 먼저 만들었다. bizhigher 의 차이: 글은 **블로그 루틴 2개**(월수금 발행 · 화목토 업그레이드)가
이미 main 에 직접 쓰고 있으므로, SEO 루프는 글을 직접 쓰지 않고 **그 루틴의 큐에 넣는다.**

## 파일

| 파일 | 내용 | 쓰는 쪽 |
|---|---|---|
| `backlog.yaml` | 할 일. 항목마다 근거·가설·대상·성공 지표·상태 | 전략 루틴이 추가·정렬, 실행 루틴이 상태 변경 |
| `keyword-map.yaml` | 키워드 묶음 → 주인 URL **하나**. 서비스(구매)·도구(직접 해 보기)·블로그(정보)의 각도 분담 | 전략 루틴 |
| `ledger.md` | 머지된 변경 기록(날짜·PR·URL·기준선). 4~6주 뒤 효과 판정 | 실행 루틴 기록, 전략 루틴 판정 |
| `weekly/<date>.md` | 주간 보고서 (한국어 1쪽) | 전략 루틴 |
| `check-baseline.json` | `seo:check` 의 알려진 예외. 통과시키려고 넣지 않는다 — 고친다 | 사람 승인 |
| (비공개) `BestLoanUSA/seo-data` `metrics/bizhigher/` | Search Console·GA4 매일 스냅샷(`latest.md`), 사이트맵 전체 색인 상태(`index-latest.md`), 유입·AI 방문(`latest-extra.md`) | 측정(그 저장소의 Actions, 매일 06:23 PT) |

## 네 개의 경로 — 어떤 변경이 어디로 가는가

| 변경 | `path` | 누가 만드나 | 발행 |
|---|---|---|---|
| 새 블로그 글 | `calendar` — `content/blog-calendar.md` 대기열에 주제 행 추가(PR) | 월수금 발행 루틴이 쓴다 | 그 루틴이 main 에 push |
| 기존 글 보강(FAQ·표·내부 링크·제목) | `upgrade-queue` — `content/blog-upgrade-queue.md` 에 slug + 보강 메모(PR) | 화목토 업그레이드 루틴이 고친다 | 그 루틴이 main 에 push |
| 구조 — 템플릿(`build.js`), 메타·제목 규칙, 스키마, 내부 링크 블록, 서비스·도구·패키지 가이드(`content/services|tools|packages/*.md`), keyword-map | `structure` — **SEO 실행 루틴** → 초안 PR | 실행 루틴 | **David 머지** |
| 사람 일(검색 콘솔 설정, 계정, 결정) | `david` | David | — |

SEO 루틴의 커밋은 main 에 직접 가지 않는다. 브랜치 `claude/seo-…` 를 push 하면 `.github/workflows/seo-pr.yml` 이 초안 PR 을 연다.
가격·Stripe 링크(`data/services.json`)는 SEO 이유로 바꾸지 않는다(CLAUDE.md §10-5·§11).

## 루프

```
측정(seo-data, 매일) → 전략(월, backlog·큐 제안·주간 보고) → 실행(화·목, PR 1개) → CI seo:check + 검수 서브에이전트 → David 머지 → 배포
  ↑                                                                                                        │
  └────────────────────────── 평가(머지 4~6주 뒤, ledger 판정 — 전략 루틴) ←──────────────────────────────┘
```

## 자동 장치

| 무엇 | 어디 | 언제 |
|---|---|---|
| 측정 | `seo-data` → `.github/workflows/metrics.yml` → `metrics/bizhigher/latest.md`·`index-latest.md`·`latest-extra.md` | 매일 06:23 PT |
| SEO 규칙 | `scripts/seo-check.js` (규칙은 파일 머리말), 예외 `check-baseline.json`. `npm run check` = 빌드 + 점검 | 모든 PR·main push(`seo-check.yml`), 블로그 루틴의 push 직전, SEO 루틴의 push 직전 |
| 초안 PR | `.github/workflows/seo-pr.yml` — `claude/seo-**` 브랜치 첫 push 에 초안 PR, PR 닫히면 브랜치 삭제 | push 때 |
| 전략 루틴 | `docs/seo-strategy-routine-prompt-ko.md` — metrics·색인·AI 방문·seo-check 보고서 → backlog 정렬, 큐 제안, `weekly/<date>.md`, ledger 판정 → PR | 매주 월 08:41 PT |
| 실행 루틴 | `docs/seo-execute-routine-prompt-ko.md` — backlog `ready` 항목 1개 → `claude/seo-<id>-<date>` → 초안 PR. push 전 검수 서브에이전트. 열린 `claude/seo-` 브랜치 3개 이상이면 쉰다 | 매주 화·목 07:41 PT |

루틴 프롬프트는 "저장소의 그 파일을 읽고 따르라"는 한 단락뿐이다. 지시를 바꾸려면 파일을 PR 로 바꾼다.

## 모든 루틴이 지키는 규칙

1. **CLAUDE.md 가 우선한다.** §1 카피 원칙(베네핏으로, 180일 플랜), §5-1 도구 규칙, §9 블로그 규격, §10 건드리면 안 되는 것, §11 승인 정책, §14·§17 Places 데이터·marketingkorean 경계.
2. **PR 하나 = backlog 항목 하나.** 머지는 David. main 에 직접 push 하지 않는다. 블로그 루틴이 main 을 매일 바꾸므로 push 직전에 `git merge origin/main`.
3. **지어내지 않는다.** 실적·후기·고객 수·순위 주장("1위", "보장"), 출처 없는 통계. `seo:check` 의 `copy` 규칙이 일부를 막는다.
4. **한 키워드에 한 URL.** `keyword-map.yaml` 에 주인이 있으면 새 페이지 대신 그 페이지를 보강한다. 서비스·도구·블로그가 같은 말을 쓰더라도 의도(구매·실행·정보)가 다르면 잠식이 아니다 — 제목·첫 문단에서 그 의도를 분명히 한다.
5. **얇은 페이지를 만들지 않는다.** 새 페이지는 주 2개 이하. 도시 페이지류는 CLAUDE.md §12-5 지역 랜딩 규칙(도시마다 다른 내용)을 따른다.
6. **숫자로 판단한다.** 측정 데이터 없이 만든 추측성 항목은 `status: blocked`. 2026-11 현재 노출 64/월·클릭 0 이라 거의 모든 판단은 색인 상태와 seo-check 보고서로 한다 — 그래도 쉬는 이유는 아니다.
7. **marketingkorean 과의 경계(§17).** 관계 문구는 "경영진 일부가 같지만 서로 독립적으로 운영되는 서비스". 교차 링크를 새로 만드는 것은 David 의 결정.
8. **AI 검색 유입**은 세 곳에서 본다: seo-data `latest-extra.md` 의 AI 방문(ChatGPT·Perplexity·Gemini·Copilot·Claude 세션), GA4 `generate_lead` 의 세션 출처, 그리고 리드 자체의 `source` 열(무료 진단·도구 리드가 어떤 referrer·utm 에서 왔는지 — 관리자 리드 탭). 2026-11-02 부터 쌓인다.
