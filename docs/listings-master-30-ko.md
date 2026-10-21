# 로컬 등록 디렉토리 마스터 목록 (2026-10-21)

CLAUDE.md §19-10. 로컬 등록(`local-listing-setup`) 단계 `lls-1`의 기준 문서. 루틴은 이 표를 읽어 고객 업종에 맞는 추가 디렉토리를 보강하고, `lls-3` NAP 문서에 등록 순서를 붙인다.

**원칙**
- 무인 브라우저 자동화·CAPTCHA 우회는 하지 않는다. 사람이 화면을 보는 상태에서 Claude in Chrome 보조 입력은 허용(2026-10-15)
- 구독형 애그리게이터(Yext류)는 쓰지 않는다. **일회성 시티에이션 빌더**(곳당 $2~3, 영구)는 허용
- 전화·엽서 인증은 고객과 한 번에 몰아서 처리한다. 인증 메일은 고객 전용 주소(`{고객}@listings.bizhigher.com`, `lls-2`)로 받는다
- 등록 전 NAP(상호·주소·전화)는 구글 비즈니스 프로필과 글자 단위로 같아야 한다(`lls-3`)

**자동화 등급**: 🟢 자동(API·가져오기) · 🟡 반자동(루틴이 NAP 카드·이메일 초안 준비, 사람이 붙여넣기) · 🔵 수동(인증 필요) · 📦 외주(시티에이션 빌더)

## A. 핵심 플랫폼 — 전부 직접 (5곳)

| # | 사이트 | 등록 방식 | 인증 | 등급 | 분 | 비고 |
|---|---|---|---|---|---|---|
| 1 | Google Business Profile | 소유자가 hello@bizhigher.com 관리자 초대 | 이미 인증된 프로필 | 🟢 | 5 | 모든 등록의 기준. `automation/gbp/docs/owner-invite-ko.md` |
| 2 | Bing Places for Business | "Import from Google" — GBP 관리자 권한이 있는 구글 계정(hello@)으로 로그인해 가져오기 | GBP 인증을 그대로 인정, 동기화 켜 두면 재인증 없음 | 🟢 | 10 | BizHigher의 Microsoft 계정(hello@) 아래에 고객 업소를 추가하는 구조. 소유자가 아니어도 관리자면 가져오기 가능 |
| 3 | Apple Business Connect | Apple ID(hello@bizhigher.com)로 로그인 → 업소 추가 | 전화 또는 우편, 가끔 서류 | 🔵 | 20 | 온보딩 초반에 시작. Apple ID 인증 메일이 와야 하므로 bizhigher.com 메일 라우팅 필수 |
| 4 | Yelp for Business | yelp.com/signup 또는 biz.yelp.com 에서 업소 추가·클레임 | 전화(자동 통화 코드) 또는 이메일 | 🔵 | 15 | 답글 API 없음. 광고 영업 전화가 많이 옴 — 고객 번호 대신 listings 번호 사용 불가(업소 번호여야 함) |
| 5 | Facebook 페이지 + Instagram | 고객이 Meta Business Suite 파트너로 BizHigher 추가 | 고객 로그인 | 🟡 | 10 | 등록이 아니라 접근 권한. `post-1` |

## B. 데이터 애그리게이터 — 여기 넣으면 수십 곳에 전파 (4곳)

| # | 사이트 | 등록 방식 | 인증 | 등급 | 분 | 비고 |
|---|---|---|---|---|---|---|
| 6 | Data Axle (구 Infogroup) | dataaxle.com 업소 등록 폼 | 이메일 | 🟡 | 10 | 무료. 수백 개 디렉토리·내비게이션의 원천 데이터 |
| 7 | Foursquare (Places) | foursquare.com/business 클레임 | 이메일·전화 | 🟡 | 10 | 무료. Apple·Uber·Snap 등이 참조 |
| 8 | Neustar Localeze | 유료 연간 또는 시티에이션 빌더 경유 | — | 📦 | — | 직접은 비용 대비 효과 낮음 — 외주 패키지에 포함되면 OK |
| 9 | 시티에이션 빌더 (BrightLocal Citation Builder 류, 일회성) | 업소 1곳 CSV 업로드 → 업체가 사람 손으로 등록 | 업체가 처리, 전화 인증은 고객 | 📦 | 20 (발주) | 곳당 $2~3, 영구. **핵심 30곳 외 나머지 전부 이 경로** |

## C. 일반 디렉토리 — 미국 전역 (12곳)

| # | 사이트 | 등록 방식 | 인증 | 등급 | 분 | 비고 |
|---|---|---|---|---|---|---|
| 10 | Nextdoor Business | nextdoor.com/business 페이지 생성 | 이메일, 가끔 전화 | 🟡 | 10 | 동네 노출 효과 큼. 한인 밀집 지역 필수 |
| 11 | Yellow Pages (YP.com) | yp.com 무료 등록 | 전화 | 🔵 | 10 | 영업 전화 많음 |
| 12 | Superpages | superpages.com | 이메일 | 🟡 | 5 | YP 계열 |
| 13 | MapQuest | mapquest.com 업소 등록 | 이메일 | 🟡 | 5 | |
| 14 | Better Business Bureau (BBB) | bbb.org 무료 프로필 | 이메일·서류 | 🔵 | 15 | 인증(Accredited)은 유료, 프로필만 무료 |
| 15 | Manta | manta.com | 이메일 | 🟡 | 5 | |
| 16 | Hotfrog | hotfrog.com | 이메일 | 🟡 | 5 | |
| 17 | Cylex | cylex.us.com | 이메일 | 🟡 | 5 | |
| 18 | Brownbook | brownbook.net | 이메일 | 🟡 | 5 | |
| 19 | EZlocal | ezlocal.com | 이메일 | 🟡 | 5 | |
| 20 | MerchantCircle | merchantcircle.com | 이메일 | 🟡 | 5 | |
| 21 | Chamber of Commerce (chamberofcommerce.com) | 무료 등록 | 이메일 | 🟡 | 5 | 지역 상공회의소 실제 가입과는 별개 |

## D. 한인 디렉토리 (6곳)

| # | 사이트 | 등록 방식 | 인증 | 등급 | 분 | 비고 |
|---|---|---|---|---|---|---|
| 22 | 라디오코리아 업소록 | radiokorea.com 업소록 등록 신청 | 이메일 또는 전화 확인 | 🟡 | 10 | LA·OC 한인 1순위. 루틴이 신청 이메일 초안 |
| 23 | 중앙일보 업소록 (Korea Daily) | koreadaily.com 업소록 | 이메일·전화 | 🟡 | 10 | |
| 24 | 한국일보 업소록 (Korea Times) | koreatimes.com 업소록 | 이메일·전화 | 🟡 | 10 | |
| 25 | 미씨USA 업소록 | missyusa.com 업소록 | 회원 가입 | 🟡 | 10 | 여성 고객 비중 높은 업종(뷰티·네일·학원)에 효과 |
| 26 | 케이타운1번가 / 코리아타운데일리 등 지역 한인 매체 | 지역별 1~2곳 | 이메일 | 🟡 | 10 | 도시별로 루틴이 후보 보강 |
| 27 | marketingkorean.com · budongsanlisting.com (David 소유) | 관리자가 직접 등록 | 없음 | 🟢 | 0 | 완전 자동. 사이트 간 관계는 표기하지 않는다(§17) |

## E. 업종별 — 해당 업종만 (3곳 이상, 루틴이 보강)

| 업종 | 사이트 | 비고 |
|---|---|---|
| 식당·카페 | TripAdvisor, OpenTable/Resy(예약제), DoorDash·Uber Eats(배달) | 배달 앱은 등록이 곧 계약이라 고객이 직접 |
| 치과·한의원·안경점(검안) | Healthgrades, Zocdoc(예약 유료), Vitals, 보험사 네트워크 디렉토리 | HIPAA — 리뷰 답글·설명에 환자 암시 금지 |
| 뷰티·네일·헤어 | StyleSeat, Booksy, Vagaro | 예약 플랫폼 겸용 — 고객 결정 |
| 부동산·융자 | Zillow(에이전트), Realtor.com, NMLS Consumer Access(융자, 자동) | 라이선스 번호 표기 규정 확인 |
| 학원·교육 | Care.com, Niche, GreatSchools(학교만) | |
| 홈서비스 | Angi, Thumbtack, HomeAdvisor | 리드 유료 — 등록만 |

## 요금제별 분배 (플레이북 `TIERS`)

| 플랜 | 곳 수 | 직접(A+B 일부+D) | 외주 📦 |
|---|---|---|---|
| Starter | 30 | 1~7, 10, 22~27 (약 20곳) | 10곳 |
| Growth | 60 | 같음 | 40곳 |
| Premium | 120 | 같음 | 100곳 |

## 루틴이 자동으로 만드는 것 (`lls-3`)
- 디렉토리별 NAP 카드: 상호(한/영), 주소(USPS 표준), 전화, 카테고리(사이트별 명칭 매핑), 설명 150·250·750자(한/영), 영업시간, 웹사이트, 사진 5장 선정
- 외주 발주용 CSV 1개
- 한인 디렉토리 신청 이메일 초안(사이트별)
- 등록 완료 후 링크 목록(`lls-7`)

## 아직 확정 안 된 것
- 시티에이션 빌더 업체 선정(§19-13)
- 디렉토리별 URL·인증 방식은 2026-10 기준 — 등록 직전에 루틴이 재확인
- 반자동 등록의 고객당 실소요(1~1.5시간 추정, §19-11)
