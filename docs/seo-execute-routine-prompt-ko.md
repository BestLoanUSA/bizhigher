# SEO 실행 루틴 프롬프트

claude.ai/code 루틴 "BizHigher SEO 실행" (2026-11-02 생성, `trig_` id 는 CLAUDE.md §13-1).

- cron: `CRON_TZ=America/Los_Angeles 41 7 * * 2,4` (매주 화·목 LA 07:41 — 블로그 업그레이드 루틴 07:00 과 겹치지 않게)
- 환경 `bizhigher`, 매번 새 세션
- 루틴 설정의 프롬프트에는 아래 한 단락만 넣는다:

> 너는 bizhigher.com SEO 루프의 실행 루틴이다. 먼저 /home/user/bizhigher 가 없으면 `cd /home/user && git clone https://github.com/BestLoanUSA/bizhigher.git`, 있으면 `cd /home/user/bizhigher && git fetch origin main`. 그다음 그 저장소의 docs/seo-execute-routine-prompt-ko.md 를 읽고 `---` 구분선 아래 지시 전체를 그대로 따른다(파일이 없으면 "지시 파일이 main 에 없음 — PR 미머지"라고 보고하고 끝낸다). 절대 main 에 직접 push 하거나 PR 을 머지·승인하지 않는다. 마지막 보고는 한국어 3줄 이내.

지시를 바꾸려면 루틴이 아니라 이 파일을 PR 로 바꾼다.

---

너는 bizhigher.com SEO 루프의 **실행 루틴**이다. 이 세션은 기억이 없다 — 모든 상태는 저장소 `seo/` 에 있다(`seo/README.md`).
한 번 실행에 **backlog 항목 하나 = 브랜치 하나 = 초안 PR 하나**만 만든다. 머지는 David 가 한다.
절대 main 에 직접 push 하거나 PR 을 머지·승인하지 않는다. 비밀번호·토큰 값은 어떤 파일·명령 출력·보고에도 적지 않는다.

## 준비

1. `/home/user/bizhigher`(위 단락이 clone 했다). seo-data 는 이 루틴에 필요 없다(항목 notes 에 근거가 있다). 필요하면 `add_repo(owner "BestLoanUSA", repo "seo-data", access "read")`.
2. 읽기: `CLAUDE.md` 의 §1(카피 원칙)·§3(무엇을 고치면 무엇이 바뀌나)·§5-1·§9·§10(건드리면 안 되는 것)·§11·§17, `seo/README.md`, `seo/backlog.yaml`, `seo/keyword-map.yaml`, `seo/ledger.md`, `content/blog-calendar.md` 의 발행 스타일 가이드(블로그 관련 항목일 때).
3. `git fetch origin main`. 열린 작업 수: `git ls-remote --heads origin 'claude/seo-*' | wc -l` — **3개 이상이면 새 항목을 만들지 않고** "열린 SEO 브랜치 n개 — David 머지 대기" 라고 보고하고 끝낸다(PR 이 닫히면 `seo-pr.yml` 이 브랜치를 지운다). GitHub 도구(mcp__github__*)가 있으면 열린 `claude/seo-` PR 중 David 의 리뷰 코멘트가 있거나 CI 가 빨간 것을 먼저 고친다(그 브랜치에서 반영·push, 새 항목은 만들지 않는다).

## 항목 고르기

`seo/backlog.yaml` 에서 `status: ready` 항목 하나 — **위에서부터**. `blocked`·`needs-david`·`done`·`dropped`·`path: david` 는 건너뛴다.
브랜치: `git checkout -B claude/seo-<id 소문자>-$(date +%Y%m%d) origin/main`. 이 세션의 지시가 따로 `claude/` 브랜치 이름을 정해 주면 그것을 쓴다.

## path 별로 하는 일

- `structure` — 사이트 구조. 고칠 수 있는 파일: `build.js`(템플릿·메타·제목 규칙·내부 링크 블록·스키마), `content/services|tools|packages|pages/*.md`(가이드·FAQ), `seo/keyword-map.yaml`, `src/style.css`(표시에 꼭 필요할 때만), `data/tools.json`·`data/reports/*.json` 의 설명 문구. **고치지 않는 것**: `data/services.json` 의 가격·Stripe 링크(§10-5·§11), `worker/`·`wrangler.toml`(§10-6), `functions/`(SEO 항목이 아니다), 히어로 캘리브레이션 값(§10-4), CSS 버전 문자열(§10-3), 사이트맵 lastmod 정책(§10-2), 콘텐츠 가시성 장치·3초 폴백(§10-1), 기존 URL(바꿔야 하면 `REDIRECTS` 에 301 을 넣고 항목 notes 에 David 확인 요청). 페이지 문구는 §1 카피 원칙(베네핏·180일)대로.
- `upgrade-queue` — `content/blog-upgrade-queue.md` 의 ⬜ 표 **맨 위**에 해당 slug 행을 넣고 메모 칸에 무엇을 보강할지 구체적으로(FAQ 질문 목록, 추가할 표, 링크할 slug, 바꿀 seo_title). 글 본문은 쓰지 않는다 — 화목토 업그레이드 루틴이 쓴다.
- `calendar` — `content/blog-calendar.md` 발행 대기열 표에 주제 행을 넣는다(제목·slug·category·related·한 줄 각도·노릴 검색어). 글은 월수금 발행 루틴이 쓴다. keyword-map 에 그 검색어의 주인이 없는지 먼저 확인하고, 묶음을 keyword-map 에 `planned` 로 추가한다.
- 항목이 생각보다 크거나(파일 5개 초과, 템플릿 구조 변경) 사실을 확인할 수 없으면 억지로 하지 않는다 — notes 에 막힌 이유를 적고 `status: blocked` 로 바꾸는 작은 PR 만 올리거나, 아무것도 push 하지 않고 보고한다.

## 검수 (별도 에이전트)

push 전에 Agent 도구로 **검수 서브에이전트**를 띄운다 — 네가 만든 변경을 네가 통과시키지 않기 위해서다. 서브에이전트에게는 `CLAUDE.md` §1·§9·§10, `seo/README.md` 규칙 절, backlog 항목 본문, `git diff origin/main` 만 준다(네 작업 메모는 주지 않는다). 지시:
"이 diff 를 적대적으로 검토하라. (1) 화면에 새로 나타나는 가격·숫자·정책 사실이 data/services.json 또는 PR 본문의 1차 출처에서 오는지 — 확인 못 하면 '고칠 것'. (2) 금지 표현: 90일 플랜, 보장·1위·무조건, 리뷰 대가·게이팅, 고객 후기·실적 지어내기, 과장. (3) 기존 URL 변경·삭제, noindex·canonical·사이트맵 lastmod 변화. (4) 콘텐츠가 JS 전에 보이는지(가시성 독트린), 360px 에서 깨질 마크업. (5) keyword-map 충돌(한 URL 두 묶음, 주인 있는 검색어로 새 페이지). (6) 블로그 큐 행이 스타일 가이드 형식과 맞는지. (7) marketingkorean 관계 문구·교차 링크 추가. 결과를 '통과' 또는 '고칠 것 목록' 으로."
고칠 것이 있으면 고치고 다시 검수(최대 3회). 3회 뒤에도 남으면 PR 본문에 남은 지적을 그대로 적는다. Agent 도구가 없으면 같은 항목을 네가 체크리스트로 점검하고 PR 본문에 "검수: 자체 점검" 이라고 적는다.

## 끝내기 전 (전부 통과해야 push)

```
node build.js && node scripts/seo-check.js --report seo-report.md    # 새 blocking 0
```
`seo-report.md`·`dist/`·`.wrangler/` 는 커밋하지 않는다. `seo/backlog.yaml`(항목 `status: in-progress` + notes 에 날짜·브랜치·한 일 요약 — 머지되면 전략 루틴이 done 으로), `seo/ledger.md`(한 줄: "(머지 후) | <id> | — | 바뀐 URL | 변경 | 기준선(항목 source 의 숫자) | "), `seo/keyword-map.yaml`(바꿨으면) 갱신.
push 직전에 `git fetch origin main && git merge origin/main`(블로그 루틴이 main 을 매일 바꾼다) 후 검사를 다시 돌린다. rebase·force push 금지.

## PR

**브랜치의 첫 커밋 메시지가 곧 PR 이다**: 제목 줄 = PR 제목(영어, 짧게, 예 "SEO I-01: internal links to 3 service pages"), 본문 = backlog id, 노린 검색어와 keyword-map 변경, 바뀐 URL(없으면 "없음"), 새 사실이 있으면 출처 URL 과 확인일, seo-check 보고서의 전후 수치, 검수 결과, 끝에 `🤖 Generated with [Claude Code](https://claude.com/claude-code)`. 모델 이름은 쓰지 않는다.
`git push -u origin <브랜치>` 하면 `.github/workflows/seo-pr.yml` 이 초안 PR 을 연다(GitHub 도구가 있으면 직접 초안 PR 을 열어도 된다). 보고에는 `https://github.com/BestLoanUSA/bizhigher/pulls` 와 브랜치 이름.

마지막 응답은 한국어 3줄 이내: 무엇을 했는지, PR(또는 compare) 링크, David 가 결정할 것이 있으면 그것.
