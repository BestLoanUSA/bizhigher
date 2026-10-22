# 가져온 스킬 (vendored) — 출처·라이선스·갱신법

루틴(AI 실행 루틴)과 Claude Code 세션이 결과물을 만들 때 읽는 마케팅·SEO·블로그 지침이다. 네 저장소에서 **지침(SKILL.md·references)만** 골라 복사했고 평가(evals)·파이썬 도구는 뺐다. MIT 3곳 + Apache 2.0 1곳. 어느 단계에서 어떤 스킬을 읽는지는 `docs/skills-map-ko.md`.

| 출처 | 가져온 스킬 | 커밋 | 라이선스 |
|---|---|---|---|
| [coreyhaines31/marketingskills](https://github.com/coreyhaines31/marketingskills) | copywriting · copy-editing · ad-creative · ads · ai-seo · schema · content-strategy · directory-submissions · social · video · emails · offers · marketing-psychology · site-architecture · image · competitor-profiling | e85f3cb (2026-10-19) | MIT — `_vendor/LICENSE-marketingskills` |
| [AgriciDaniel/claude-seo](https://github.com/AgriciDaniel/claude-seo) | seo-local · seo-maps · seo-geo · seo-schema · seo-page · seo-content · seo-content-brief · seo-technical · seo-audit · seo-images · seo-sitemap · seo-programmatic | 6be93f4 (2026-10-22) | MIT — `_vendor/LICENSE-claude-seo` |
| [anthropics/skills](https://github.com/anthropics/skills) | frontend-design — Claude 가 HTML/CSS/React 를 **직접 쓸 때**(사이트 템플릿 `render.js`·랜딩페이지·bizhigher.com·관리자 화면) 읽는 디자인 지침. 루틴의 스펙 JSON 단계에는 해당 없음 | dbd4588 (2026-10-22) | Apache 2.0 — `_vendor/LICENSE-anthropic-skills` |
| [AgriciDaniel/claude-blog](https://github.com/AgriciDaniel/claude-blog) | blog-write · blog-outline · blog-brief · blog-seo-check · blog-schema · blog-geo · blog-factcheck · blog-calendar · blog-repurpose · blog-multilingual · blog-localize · blog-style | 3544423 (2026-10-14) | MIT — `_vendor/LICENSE-claude-blog` + `NOTICE-claude-blog` |

**읽는 법**: 스킬은 그냥 마크다운이다. 루틴은 단계에 맞는 `SKILL.md`(필요하면 `references/`)를 `cat` 으로 읽고 지침·체크리스트·금지 표현만 따른다. claude-seo·claude-blog 의 SKILL.md 에 나오는 `python3 …`·`uv run`·`scripts/` 단계는 **그 저장소의 파이썬 런타임이 있어야 돌아가므로 건너뛴다**(지침의 판단 기준은 그대로 쓴다). 스킬이 묻는 "제품 컨텍스트"(`.agents/product-marketing.md` 등)는 우리 쪽 질문지·프로필(`job.intake`·`job.profile`)로 대신한다.

**우리 규칙이 우선**: CLAUDE.md §1 카피 원칙(베네핏·180일)·§12 규칙(가격은 services.json, 리뷰 대가 금지, HIPAA)·질문지의 금지 표현이 스킬 지침과 충돌하면 우리 규칙을 따른다.

**갱신**: 원본 저장소를 클론해 같은 폴더를 덮어쓰고(evals 제외) 이 표의 커밋을 갱신한다. 폴더 이름이 겹치는 스킬(marketingskills 의 `seo-audit` 등)은 claude-seo 쪽을 쓴다.
