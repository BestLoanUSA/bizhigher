# 블로그 업그레이드 대기열

화·목·토 업그레이드 루틴이 읽고 갱신한다. 프롬프트는 `docs/blog-upgrade-routine-prompt-ko.md`.
루틴은 **⬜ 중 가장 위 1편**을 골라 업그레이드한 뒤 ✅ 날짜와 한 줄 메모로 바꾼다.
모든 ⬜이 ✅가 되면 처음부터 다시 돌되, 마지막 업그레이드가 **60일 지난 글**만 대상으로 한다.
허브 글(`hub: true`)은 대기열에 없다 — 스포크를 고칠 때 함께 갱신한다.

## 업그레이드 대기열

| 상태 | slug | 카테고리 | 우선 이유 |
|---|---|---|---|
| ⬜ | store-photo-guide | 구글 노출 | 초기 글 |
| ⬜ | yelp-management-guide | 리뷰·평판 | 옐프 정책 최신화 |
| ⬜ | google-business-profile-posts | 콘텐츠·SNS | 기능 변화 점검 |
| ⬜ | photo-reviews-guide | 리뷰·평판 | |
| ⬜ | online-menu-guide | 웹사이트 | |
| ⬜ | trade-area-analysis-google-maps | 구글 노출 | |
| ⬜ | instagram-vs-google-business-profile | 콘텐츠·SNS | |
| ⬜ | website-visitors-no-calls | 웹사이트 | |
| ⬜ | bilingual-marketing-korean-local-customers | 콘텐츠·SNS | |
| ⬜ | shortform-video-guide | 콘텐츠·SNS | |
| ⬜ | seasonal-marketing-calendar | 광고 | 연말·연초 시기 맞춰 날짜 갱신 |
| ⬜ | google-ai-overviews-local-business | AI 검색 | |
| ⬜ | local-marketing-2026-review-2027-prep | AI 검색 | 연말 전 2027 내용 보강 |
| ⬜ | google-business-profile-qa-removed | 구글 노출 | |
| ⬜ | review-qr-code-placement | 리뷰·평판 | |
| ⬜ | email-sms-marketing-basics | 콘텐츠·SNS | 법규(스팸·동의) 최신화 |
| ⬜ | landing-page-vs-homepage-for-ads | 웹사이트 | |

## 업그레이드 완료

| 상태 | slug | 메모 |
|---|---|---|
| ✅ 2026-10-22 | not-showing-on-google | 첫 문단 직접 답·업체명 검색 2분 진단(순서도)·증상별 표 추가, 구글 공식 로컬 순위 3요소·광고 무관 명시, 항목별 주의사항·내부 링크 7개, FAQ 5개로 보강 |
| ✅ 2026-10-24 | google-business-profile-guide | 첫 문단 직접 답, 등록 자격 표(사서함·가상 사무실 불가)·업체명 규칙 표·인증 방법 표(구글 공식 기준), 거절 시 대처, 준비물 체크리스트 이미지, 내부 링크 6개, FAQ 6개. 확인 안 된 "영상 인증이 표준" 주장 삭제 |
| ✅ 2026-10-27 | google-review-guide | 첫 문단 직접 답, 구글 공식 정책(대가·게이팅·할당량·문구 지시 금지) 표, 오해 vs 사실 이미지, 점검표, 내부 링크 6개, FAQ 보강. 근거 없던 "90%가 잊는다"·와이파이 스팸 필터·서비스 제공 허용 취지 삭제 |
| ✅ 2026-10-29 | ai-search-optimization-aio | 첫 문단 직접 답, 재료 표·구조도 이미지, 구글 AI 요약(별도 요건 없음)·ChatGPT(OAI-SearchBot) 공식 안내 반영, 점검표·하지 말 것 추가, 리뷰 문구 유도 권유와 "FAQ 스키마가 AI 요약에 유리" 주장 삭제, 내부 링크 6개, FAQ 5개 |
| ✅ 2026-10-31 | do-you-need-a-website | 첫 문단 직접 답, 판단 흐름도 이미지, 5신호 표·업종별 예시·계약 전 확인 표(도메인 명의), 구글 공식 로컬 순위 3요소 반영, 구글 프로필 무료 웹사이트 2024년 종료 명시, 근거 없던 가격·제작기간·유지관리 금액(판매 문구) 삭제, 내부 링크 7개, FAQ 5개 |
| ✅ 2026-11-03 | korean-business-directory-list | 첫 문단 직접 답, 구글 공식 인지도(prominence) 설명 반영, 디렉토리별 무료·유료·주의 표(BBB 인증 유료·Nextdoor·Yelp·Apple 인증), 한인 업소록은 확인 안 된 한국일보·중앙일보·라코텔 단정 삭제하고 확인 질문 3개로 대체, 피라미드 이미지, 내부 링크 6개·로컬 등록 관리 링크 1개(I-01), FAQ 5개 |
| ✅ 2026-11-05 | near-me-search-ranking | 첫 문단 직접 답, 구글 공식 3요소 표·세 요소 이미지, 위치 미공유 시 구글이 아는 정보로 거리 계산(공식 문구)으로 정정, 확인 안 된 Wi-Fi·기지국 추정·지역명 리뷰 효과·서비스 지역 효과 주장과 업종별 거리 가중치 단정 삭제, 서비스 지역 공식 기준(20개·2시간), 순위 직접 비교 방법·하지 말 것, /tools/local-rank/ 링크(K-01), 내부 링크 8개, FAQ 6개 |
| ✅ 2026-11-07 | not-showing-on-google | [SEO K-01] 2분 진단 문단과 7번 거리 항목에 /tools/local-rank/ 링크 2개(근사치 한계 명시) |
| ✅ 2026-11-10 | google-business-profile-hours-update | 첫 문단 직접 답, 구글 공식 기준 반영(특별 영업시간 최대 6일·7일 이상은 임시 휴업·24시간 묶음 제한·기본 영업시간 '영업 중' 조건·검토 후 반영), 설정 순서·추가 영업시간 행, 내부 링크(/service/local-listing-care/ 포함) 3개, FAQ 6개. 근거 없던 '구글 알림' 문장 정정. 이미지는 기존 커버 유지 |
| ✅ 2026-11-12 | negative-review-response-guide | 첫 문단 직접 답, 구글 공식 신고 기준 표(정책 위반 vs 답글 대응)·리뷰 관리 도구 신고·1회 이의 제기(최대 10개), 리뷰 협박 신고 양식, 답글 4단계 구조·구글 동작(작성자 알림·검토 최대 30일), 업종·상황별 예문(영어 포함), 치과 HIPAA OCR 합의 사례, FTC 리뷰 규칙(2024-10-21), 점검표, 판단 흐름도·타임라인 이미지, 내부 링크 6개·답글 생성기 링크, FAQ 5개. '구글 정책상 위험할 수 있다' 같은 모호한 표현 정리 |
| ✅ 2026-11-14 | google-ads-small-budget-guide | 첫 문단 직접 답, 구글 공식 예산 규칙(하루 최대 2배·월 30.4배) 표, 키워드 플래너로 하루 클릭 직접 계산법, 켜기 전 설정 6가지 표(전화 전환 60초·검색 파트너/디스플레이 해제·위치 옵션 Presence), 부동산·융자 ZIP 타겟팅 제한, 업종별 키워드·제외 키워드 표, 주차별 표·4주 판단표·점검표, 순서·기록 6지표 이미지 2장, 내부 링크 8개·도구 4개, FAQ 5개. 근거 없던 업종별 하루 클릭 수(3~8·1~3) 삭제 |
