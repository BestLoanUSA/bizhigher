# 단계 → 읽을 스킬 지도 (2026-10-22)

`.claude/skills/` 에 가져온 지침(출처·라이선스는 그 폴더의 README)을 플레이북 단계별로 어디서 읽는지 정한다. 루틴은 결과물을 쓰기 **전에** 해당 `SKILL.md` 를 읽는다(2~3개까지). 스킬 지침과 우리 규칙(CLAUDE.md §1·§12, 질문지 금지 표현)이 충돌하면 우리 규칙.

| 단계 | 읽을 스킬 | 무엇에 쓰나 |
|---|---|---|
| ob-3 고객 프로필 | `competitor-profiling` · `seo-local` | 경쟁사 비교 틀, 로컬 SEO 기준 항목 |
| gpo-2 경쟁사 갭 분석 | `seo-maps` · `competitor-profiling` | 지도 노출 요인 체크리스트 |
| gpo-3 프로필 콘텐츠 팩 | `copywriting` · `seo-local` · `seo-maps` | 설명 750자·서비스 20개·Q&A 톤, 카테고리·속성 |
| gpo-5 Before/After 리포트 | `copy-editing` | 리포트 문장 다듬기 |
| qr-2 QR 인쇄물 문구 | `copywriting` · `marketing-psychology` | 리뷰 요청 문구(대가 제공 없이) |
| lls-1 디렉토리 목록 · lls-3 NAP 문서 | `directory-submissions` · `seo-local` | 등록 우선순위·설명문 변형(references 의 directory-list·positioning-variations) |
| an-2 GA4 전환 설계 | (없음 — 플레이북 지침만) | |
| ads-2 광고 설계안 | `ads` · `ad-creative` · `copywriting` | 캠페인 구조·키워드·RSA 헤드라인 규칙 |
| llp-2 지역 랜딩페이지 | `seo-programmatic` · `seo-page` · `copywriting` | 도시별 페이지 중복 방지·페이지 구조 |
| web-2 사이트 스펙 | `copywriting` · `seo-page` · `seo-schema` · `site-architecture` | 헤드라인·섹션 카피, 페이지 SEO, 스키마 |
| post-2 월간 게시물 캘린더 | `social` · `content-strategy` | 주제 믹스·캡션 틀·CTA |
| post-4 게시물 이미지 | `image` | 이미지 규격·텍스트 비율 |
| rr-1 · rr-live 리뷰 답글 | (없음 — §12-4 규칙만) | |
| ac-1 브리프 · ac-2 카피 · ac-3 이미지 | `ad-creative` · `copywriting` · `image` | 컨셉 3방향, 헤드라인 5·본문 2, 규격 |
| seo-2 온보딩 분석 | `seo-audit` · `seo-technical` · `seo-page` | 2페이지 키워드·기술 점검 항목 |
| seo-3 월 주제 캘린더 | `blog-calendar` · `seo-content-brief` · `blog-brief` | 키워드 클러스터·브리프 |
| seo-4 블로그 4편 | `blog-write` · `blog-seo-check` · `blog-schema` · `blog-geo` · `blog-factcheck` · `blog-multilingual`(한/영) | 집필·점검·FAQ 스키마·AI 검색 인용 |
| seo-6 기술 SEO 점검 | `seo-technical` · `seo-sitemap` · `seo-images` | 월간 체크리스트 |
| seo-7 AI 검색 인용 테스트 | `ai-seo` · `seo-geo` | 인용되게 하는 문장 구조·테스트 질문 |
| seo-8 분기 랜딩페이지 | `seo-programmatic` · `seo-page` | |
| sv-1 영상 기획안 | `video` · `social` | 훅·장면·자막 구조 |
| mr-4 월간 리포트 | `copy-editing` | 숫자 해석 문장 |
| cp-2 사이트 수정 | `copy-editing` | |
| 킥오프·고객 요약(ob-5, summary) | `emails` · `copy-editing` | 짧고 사실만 |

파이썬 도구가 필요한 지시(`python3 …`, `uv run`, `scripts/`)는 건너뛴다. 사이트 QA(web-4·llp-4)는 스킬이 아니라 `qa.js` 가 Unlighthouse 를 돌린다.
