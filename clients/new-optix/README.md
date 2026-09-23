# New Optix — 고객 웹사이트 (BizHigher 제작 실험 1호)

가든그로브 안경점 New Optix의 정적 사이트. bizhigher.com 빌드와는 **완전히 분리**되어 있다
(루트 `build.js`는 이 폴더를 읽지 않으며 bizhigher.com에 배포되지 않는다).

## 빌드
```
node build.js      # → dist/
```

## 어디를 고치나
| 바꾸고 싶은 것 | 파일 |
|---|---|
| 주소·전화·영업시간·브랜드·보험·결제수단·연차·언어·도메인 | `site.json` |
| 서비스 8종 문구·FAQ | `services.json` |
| 디자인 | `src/style.css` |
| 페이지 구조 | `build.js` |
| OG 이미지 | `src/og/og.html` → `node src/og/make-og.js` |

## ⚠️ 공개 전 체크
- `site.json`의 `_assumed` 목록은 **가정값**이다(브랜드·보험·연차·도메인·옆집 검안사 이름 등). 업주 확인 후 수정
- `draft: true` 동안은 모든 페이지 `noindex` + `robots.txt` 전면 차단 + 상단 초안 배너. 확인이 끝나면 `false`로 바꾸고 재빌드
- 매장 실사진이 아직 없다 — 들어오면 히어로·소개 페이지에 교체
- 소개 페이지의 `TODO(owner)` 자리에 사장님 이야기
- 구글 리뷰 원문은 사이트에 옮기지 않는다(리뷰 주제만 요약 + 구글 링크)
- 옆 검안 진료소와의 독립성 고지 문구는 자문 확인 후 확정

## 배포 (미정)
별도 Cloudflare Pages 프로젝트를 권장: 루트 디렉터리 `clients/new-optix`, 빌드 명령 `node build.js`, 출력 `dist`.
