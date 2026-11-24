# SEO 변경 기록

머지된 SEO 변경마다 한 줄. 전략 루틴이 머지 4~6주 뒤 "판정"을 채운다
(✅ 효과 / ➖ 변화 없음 / ❌ 역효과 + 근거). 원자료는 `seo-data` 의 `metrics/bizhigher/`. 여기에는 방향과 대략의 크기만 적는다(예: "클릭 +40%").

블로그 발행·업그레이드(블로그 루틴 2개)는 `content/blog-calendar.md`·`content/blog-upgrade-queue.md` 에 기록되므로 여기 적지 않는다.
단, SEO 루프가 큐에 넣어 나온 글·보강은 그 큐 PR 을 한 줄로 남긴다.

| 머지일 | backlog | PR | 바뀐 URL | 변경 | 기준선 | 판정 |
|---|---|---|---|---|---|---|
| (머지 후) | 0단계 · M-01 | — | 없음 (llms.txt 에 패키지 URL 3줄 추가, 리드 폼 숨은 필드) | seo/ 디렉터리, `scripts/seo-check.js`, CI 2개, 리드 source 추적, SEO 루틴 2개 | GSC 2026-10-02~10-29 노출 64 · 클릭 0 · 색인 68/84 (seo-data 2026-11-01) | 대상 아님 |
| (머지 후) | I-01 | — | /service/local-listing-care/ · /tools/nap-check/ · /service/google-profile-optimization/ · /service/review-qr-kit/ | 문맥 링크 3개 + 블로그 링크 큐 2편 | 색인 68/84, unknown 6, discovered 5 (2026-11-01) | 
| (머지 후) | K-01 | — | /tools/local-rank/ · (큐) /blog/near-me-search-ranking/ · /blog/not-showing-on-google/ | 가이드 깊이 보강 + FAQ 5개 + 블로그 링크 큐 2편 | "구글 지도 순위 체크" 류 평균 순위 48~74, 클릭 0 (2026-11-01) | |
| (머지 후) | O-01 | — | /blog/ 허브 6편 <title> | seo_title 지원 + 허브 6편 제목 단축 | 제목 폭 60 초과 56/84 (2026-11-02) | |
