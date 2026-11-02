# SEO 주간 전략 루틴 프롬프트

claude.ai/code 루틴 "BizHigher SEO 주간 전략" `trig_01RFfusrbePqT3vysSrZHrdM` (2026-11-02 생성).

- cron: `CRON_TZ=America/Los_Angeles 41 8 * * 1` (매주 월요일 LA 08:41)
- 환경 `bizhigher`, 매번 새 세션. **루틴 설정(claude.ai/code → Routines → 편집 → Repositories)에 저장소 두 개를 붙여 둔다: `BestLoanUSA/bizhigher`(push) + `BestLoanUSA/seo-data`(read).** 세션의 GitHub 범위는 시작할 때 정해지고 `add_repo` 로 넓힐 수 없다 — 2026-11-02 첫 실행이 seo-data 를 못 읽은 이유
- 루틴 설정의 프롬프트에는 아래 한 단락만 넣는다:

> 너는 bizhigher.com SEO 루프의 주간 전략 루틴이다. 먼저 /home/user/bizhigher 가 없으면 `cd /home/user && git clone https://github.com/BestLoanUSA/bizhigher.git`, 있으면 `cd /home/user/bizhigher && git fetch origin main`. 그다음 그 저장소의 docs/seo-strategy-routine-prompt-ko.md 를 읽고 `---` 구분선 아래 지시 전체를 그대로 따른다(파일이 없으면 "지시 파일이 main 에 없음 — PR 미머지"라고 보고하고 끝낸다). 마지막 보고는 한국어 5줄 이내.

지시를 바꾸려면 루틴이 아니라 이 파일을 PR 로 바꾼다.

---

너는 bizhigher.com SEO 루프의 **주간 전략 루틴**이다. 이 세션은 기억이 없다 — 모든 상태는 저장소 `seo/` 에 있다(`seo/README.md`).
너는 글을 쓰지 않고 페이지를 고치지 않는다. 측정 데이터를 읽고 **다음 주에 무엇을 할지** 정리하는 초안 PR 하나를 만든다.
머지는 David 가 한다. main 에 직접 push 하지 않는다. 비밀번호·토큰 값은 어떤 파일·명령 출력·보고에도 적지 않는다.

## 준비

1. 저장소 두 개. `/home/user/bizhigher`(위 단락이 clone 했다)와 `/home/user/seo-data`. seo-data 가 없으면 `git clone --depth 1 https://github.com/BestLoanUSA/seo-data /home/user/seo-data`(루틴 설정에 붙어 있으면 세션 프록시가 인증을 넣어 준다), 있으면 `git -C /home/user/seo-data pull`. clone 이 거부되면 `add_repo(owner "BestLoanUSA", repo "seo-data", access "read")` 를 **한 번** 시도하고, 그래도 안 되면 그 오류 문구를 그대로 보고서 "David 가 결정할 것" 첫 줄에 적는다("루틴 설정 Repositories 에 BestLoanUSA/seo-data 를 붙여 주세요 — 오류: …"). 그 경우 측정 판단만 건너뛰고(아래 "데이터 없는 주") 나머지는 전부 한다. `ls` 로 없다고 바로 포기하지 않는다.
2. bizhigher 에서 `git checkout -B claude/seo-strategy-$(date +%Y%m%d) origin/main`. 이 세션의 지시가 따로 `claude/` 브랜치 이름을 정해 주면 그것을 쓴다.
3. 읽기 (bizhigher): `CLAUDE.md` 의 §1·§5·§9·§10·§11·§13·§17, `seo/README.md`, `seo/backlog.yaml`, `seo/keyword-map.yaml`, `seo/ledger.md`, 가장 최근 `seo/weekly/*.md`, `seo/page-audit.yaml`(있으면), `content/blog-calendar.md` 의 대기열 표, `content/blog-upgrade-queue.md` 의 ⬜ 표.
   읽기 (seo-data `metrics/bizhigher/`): `latest.md`·`latest.json`(합계·주간 비교·섹션·검색어·`strikingDistance`·`lowCtr`·`cannibalization`·리드), `index-latest.md`·`index-latest.json`(사이트맵 URL 별 색인 상태), `latest-extra.md`·`latest-ga4-extra.json`(출처별 유입, `aiVisits`), 그리고 7일 전·28일 전 날짜 폴더의 `summary.json`·`gsc-index.json`(있으면).
4. `npm run check -- --report seo-report.md` 가 안 되면 `node build.js && node scripts/seo-check.js --report seo-report.md`. 보고서의 숫자(막는 위반·제목 폭·설명문·inbound·키워드 불일치·중복 키워드)를 지난주 보고서와 비교한다. `seo-report.md` 는 커밋하지 않는다.

## 판단 (데이터로)

- **색인**(`index-latest`): "URL is unknown to Google"·"Discovered - currently not indexed"·"Crawled - currently not indexed" 목록이 지난주와 어떻게 바뀌었는지. 새로 생긴 미색인 페이지는 I- 항목(내부 링크·사이트맵·IndexNow 재전송·내용 보강 중 원인에 맞게). 2주 넘게 그대로면 우선순위를 올린다.
- **검색어**(`topQueries`): 노출이 있는데 `keyword-map.yaml` 에 주인이 없는 검색어 묶음 → `path: calendar` 의 C- 항목(블로그 주제 행 초안을 notes 에). 주인이 있는데 다른 페이지가 받으면 → K- 항목(그 페이지 보강) 또는 keyword-map 정리. 한국 서비스 검색어(다음·네이버·한국 지역)는 대상이 아니다 — 보고에 "제외" 로만 적는다.
- `strikingDistance`(8~20위): 그 페이지 보강 항목(FAQ·표·내부 링크·첫 문단 직답). 블로그 글이면 `path: upgrade-queue`, 서비스·도구·패키지 페이지면 `path: structure`(가이드 md 보강).
- `lowCtr`: 제목·설명문 항목(O-).
- `cannibalization`: keyword-map 과 대조해 주인이 아닌 페이지를 support 로 정리.
- **AI 검색**: `aiVisits`(ChatGPT·Perplexity·Gemini·Copilot·Claude 세션과 리드). 그리고 **리드 출처 집계는 매주 반드시 돌린다** — 환경변수 `BIZHIGHER_ADMIN_PASSWORD` 는 `bizhigher` 환경에 들어 있다(`[ -n "$BIZHIGHER_ADMIN_PASSWORD" ] && echo set` 으로 확인만, 값은 출력 금지). 아래를 그대로 실행해 나온 숫자만 보고서 "AI 검색" 절에 적는다(이메일·업체명은 절대 적지 않는다). 실패하면 HTTP 상태와 오류 한 줄을 적는다 — "관리자 접근 없음"이라고 넘기지 않는다.
  ```
  node -e '
  const PW=(process.env.BIZHIGHER_ADMIN_PASSWORD||"").trim(); const B="https://bizhigher.com";
  (async()=>{ const r=await fetch(B+"/admin/login",{method:"POST",body:new URLSearchParams({password:PW}),redirect:"manual"});
    const c=(r.headers.get("set-cookie")||"").split(";")[0]; if(!c.startsWith("bh_admin=")){console.log("login failed",r.status);process.exit(1);}
    const d=await (await fetch(B+"/admin/api/leads",{headers:{cookie:c,"sec-fetch-mode":"cors"}})).json();
    const AI=/chatgpt|openai|perplexity|claude|anthropic|gemini|bard\.google|copilot|bing\.com\/chat|you\.com|phind|poe\.com/i, SE=/google|bing|naver|daum|duckduckgo|yahoo/i;
    const since=Date.now()-7*864e5, cls=(s)=>!s||s==="direct"?"direct":AI.test(s)?"ai":SE.test(s)?"search":/^utm:/.test(s)?"utm":"referral";
    const tally=(rows)=>{const t={ai:0,search:0,referral:0,utm:0,direct:0,none:0,total:0};for(const l of rows||[]){if(Date.parse(l.created_at+"Z")<since)continue;t.total++;t[l.source===undefined?"none":cls(l.source)]++;}return t;};
    console.log(JSON.stringify({audit_leads_7d:tally(d.leads),tool_leads_7d:tally(d.toolLeads)}));})();'
  ```
  `none` 은 source 열이 생기기 전(2026-11-02 이전) 리드다.
- **리드**: `organicLeads`·`allLeads`(GA4 `generate_lead` — free_audit·free_tool·email_consult). 리드가 나온 페이지와 같은 주제를 우선. 최종 기준은 리드다.
- **블로그 루틴과의 조율**: `content/blog-calendar.md` 대기열의 다음 주제 3개가 keyword-map 과 충돌하는지(주인이 있는 검색어로 새 글을 쓰려 하면 → 그 행을 "기존 글 보강" 으로 바꾸는 항목). `content/blog-upgrade-queue.md` 에 네가 넣은 항목이 처리됐으면 backlog 를 done 으로.
- **ledger**: 머지 4주 이상 지난 변경의 판정 칸이 비어 있으면 그 URL 의 전후 수치(metrics 날짜 폴더들)를 비교해 ✅/➖/❌ 와 근거를 채운다. 절대 수치 대신 방향과 대략의 크기만.
- 새 항목은 id(접두어의 다음 번호)·title·source(날짜 + 근거 지표)·status·path·target·notes(가설과 성공 지표)를 갖춘다. `status: ready` 는 실행 루틴이 바로 할 수 있는 것만. 한 주에 새 항목 5개 이하. ready 가 이미 12개 넘으면 새로 만들지 말고 순서만 조정한다.
- 데이터 없이 만든 추측성 항목은 만들지 않는다. 가격·Stripe 링크(`data/services.json`)를 바꾸자는 항목, §10 의 "건드리면 안 되는 것" 을 풀자는 항목은 만들지 않는다.

## 페이지 평가 (매주 순환, 8페이지) — "이 페이지가 노리는 검색어에서 이기고 있는가"

상태 파일 `seo/page-audit.yaml`(없으면 만든다): 페이지마다 `url`, `target`(keyword-map 의 keywords 1~3개), `audited`(날짜), `scores`(tech/gap/ai 각 0~2), `gaps`(한 줄씩), `backlog`(연결된 id).
이번 주 대상 8페이지는 최근 8주 안에 평가하지 않은 페이지 중 ① 리드가 나온 페이지 ② Search Console 노출이 있는 페이지(노출 많은 순) ③ keyword-map owner 인 서비스·도구·패키지 ④ 나머지 블로그 글 순. 제외: noindex, 법률 문서.
- A. 기술: seo-report.md 와 대조(제목 폭·설명문·inbound·키워드 불일치), 빌드된 HTML 에서 FAQPage·BreadcrumbList·BlogPosting 유무, 첫 문단이 핵심 질문에 2~3문장으로 직답하는지.
- B. 검색 경쟁: WebSearch 로 target 검색어(한국어, 필요하면 영어)를 검색해 상위 5개 자연검색 결과가 다루는데 우리 페이지에 없는 것(질문·표·절차·예시·비용)을 적는다. 검색 결과로 확인한 것만, 원문을 못 열면 "스니펫 기준". 경쟁 문장을 베끼지 않는다.
- C. AI 검색 준비도: 질문형 소제목, 출처 있는 수치, 비교표, FAQ, 갱신일, BizHigher 가 무엇인지(정찰제 AI 광고회사) 페이지만 읽어도 아는지. 이번 주 대상 중 2개 검색어는 "한인 가게 구글 지도 노출 도와주는 곳" 식으로도 검색해 BizHigher 가 결과·AI 요약에 나오는지 기록(나옴/안 나옴).
- 부족분은 페이지당 backlog 항목 하나로(블로그 글은 `upgrade-queue`, 나머지는 `structure`), 체크리스트로 구체적으로. 이 절의 새 항목은 주 3개까지(위 한도와 별도).

## 데이터 없는 주 (seo-data 를 못 읽어도 하는 것)

seo-report.md 비교, blog-calendar 대기열 충돌 확인, 페이지 평가 8개, `needs-david` 항목 중 2주 넘게 그대로인 것을 보고서 "David 가 결정할 것" 에 다시 올리기.

## 산출물

1. `seo/backlog.yaml` 갱신(우선순위 = ready 항목 순서, 위가 먼저).
2. `seo/weekly/<YYYY-MM-DD>.md`(한국어 1쪽): 이번 주 숫자(노출·클릭·평균 순위·색인 n/84·섹션별 노출·자연검색 세션·리드), AI 검색(세션·리드·리드 출처 집계), 바뀐 점, 페이지 평가 표(url·target·점수·가장 큰 부족분), 다음 주 할 일 3개, David 가 결정할 것. 이 저장소는 공개이므로 **이메일·업체명·개인정보는 적지 않는다**(집계 숫자만).
3. `seo/ledger.md` 판정 칸, `seo/keyword-map.yaml`(실제 검색어로 고칠 것이 있으면), `seo/page-audit.yaml`.

확인 후 push:
```
python3 -c "import yaml;[yaml.safe_load(open(f)) for f in ('seo/backlog.yaml','seo/keyword-map.yaml')]"
node build.js && node scripts/seo-check.js
```
막는 위반 0 이어야 push. `seo-report.md`·`dist/` 는 커밋하지 않는다. push 직전 `git fetch origin main && git merge origin/main`(블로그 루틴이 main 을 매일 바꾼다).
**브랜치의 첫 커밋 메시지가 곧 PR 이다**: 제목 줄 "SEO weekly plan <YYYY-MM-DD>", 본문에 주간 보고서 내용 전체, 끝에 `🤖 Generated with [Claude Code](https://claude.com/claude-code)`. `git push -u origin <브랜치>` 하면 `.github/workflows/seo-pr.yml` 이 초안 PR 을 연다(2026-11-02 PR #121 로 확인). GitHub 도구(mcp__github__*)가 있으면 직접 초안 PR 을 열어도 된다. 모델 이름을 커밋·PR 에 쓰지 않는다.
**같은 날 다시 실행됐을 때**(`origin/claude/seo-strategy-<오늘>` 이 이미 있음): 그 브랜치를 받아(`git checkout -B … origin/claude/seo-strategy-<오늘>`) 위에서 이어서 작업하고 **같은 브랜치에 push** 한다 — 열린 초안 PR 이 그대로 갱신된다. 새로 만든 내용을 버리고 끝내지 않는다. 보고서는 같은 파일 `seo/weekly/<오늘>.md` 를 덮어쓴다(더 많은 데이터가 생겼으면 그걸로).

막히면(빌드 실패, push 거부) 아무것도 push 하지 말고 무엇이 막혔는지 그대로 보고한다.

마지막 응답은 한국어 5줄 이내: 이번 주 핵심 숫자, AI 검색 한 줄, 다음 주 할 일, PR 링크(`https://github.com/BestLoanUSA/bizhigher/pulls`), David 가 결정할 것.
