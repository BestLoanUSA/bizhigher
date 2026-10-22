# 고객 프로모 영상 템플릿 (Remotion)

`creative.js promo` 가 사이트 스펙(D1 `sites.spec`)으로 **9:16 약 20초** 프로모 영상을 렌더하는 React 템플릿이다. 비용 0, 렌더 약 1~1.5분(세션 Chromium).

```
node automation/ai-runner/creative.js promo --job 28 [--clip clip.mp4] [--props over.json] [--hook "리드|문장|강조어"] [--cta "…"] --out promo.mp4 [--upload --task 12]
node automation/ai-runner/creative.js promo --spec spec.json --out promo.mp4      # 스펙 파일로 직접
```

| 장면 | 길이 | 내용 | 비면 |
|---|---|---|---|
| 훅 | 5초 | `--clip`(Kling 클립) 또는 히어로 사진 켄번스 위에 `hero.headline` 단어별 등장, `hero.em` 마커 스윕, 리드 = `tagline` 첫 토막 | 훅 문장이 없으면 오류 |
| 서비스 ×≤3 | 각 2초 | `services[].name` + 짧은 설명(`desc` 18자 또는 `--props` 의 `sub`) + 사진(없으면 안 쓴 갤러리 사진) | 서비스 없으면 장면 생략 |
| 왜 우리 | 4초 | `highlights[].title` 체크 행 + `rating`·`review_count` | highlights 없으면 생략 |
| 엔드카드 | 5초 | 상호·전화·주소·영업시간·CTA, 브랜드 색 `theme.color` | 없는 값은 줄만 빠짐 |

- **지어내지 않는다**: props 는 스펙 값만. 리뷰 본문 없음(별점·수만). 로고는 `spec.logo` 가 있을 때만
- `--props over.json` 은 부분 덮어쓰기 — 객체 배열(`services`)은 인덱스별 병합이라 `sub` 만 바꿔도 사진은 유지된다. sv-1 기획안의 훅·자막 문구를 여기로 넘긴다
- 폰트: `public/NotoSansKR.ttf`(첫 실행에 내려받음, 커밋 안 함). 못 받으면 구글 폰트 링크로 대체
- 첫 실행은 이 폴더에 `npm ci`(1~2분, `package-lock.json` 고정). 렌더 중간물은 `public/_run-*/` 에 만들었다 지운다
- 미리보기·수정: `cd automation/video && npm run studio` (로컬). 장면 길이는 `src/Promo.tsx` 의 `T`, 샘플 props 는 `SAMPLE`
- Remotion 라이선스: 3인 이하 회사·개인 무료(회사 라이선스는 4인 이상부터)
