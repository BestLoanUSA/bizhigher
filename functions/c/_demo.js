/**
 * 데모 사장님 — "순두부 하우스"(가상) 의 사장님 화면 (2026-11-07 David 요청: "데모 고객을 만들어서 보여줘")
 *
 * D1 에 아무것도 쓰지 않는다. 고객 페이지 코드가 부르는 쿼리에 고정 데이터로 답하는 작은 가짜 DB(demoDb)를 넘겨
 * 실제 고객과 똑같은 코드(포털·실시간 리포트·결정할 것·새 소식·결과물)가 그대로 그린다.
 *   - 그래서 D1 이 없는 PR 프리뷰에서도 열리고, 루틴·관리자 화면·통계에 데모가 섞이지 않는다
 *   - 날짜는 "오늘 기준 며칠 전"으로 만들어 언제 열어도 최근 30일·새 소식이 살아 있다
 *   - 버튼(승인·선택·수정 요청)은 처리하지 않는다 — /my/demo·/c/{데모} 의 POST 는 안내만 하고 돌아온다
 * 주소: /my/demo (로그인한 사장님 화면) · /c/sundubu-house-{DEMO_TOKEN} (메일 링크로 여는 화면)
 * 월간 리포트는 홈 쇼케이스·샘플 리포트와 같은 data/sample-report.json (build.js 가 _demo-report.js 로 복사)
 */
import { tasksFor } from '../api/_playbook.js';
import SAMPLE from './_demo-report.js';

export const DEMO_TOKEN = 'DEMOsundubuHouse2026x';
export const DEMO_PATH = `sundubu-house-${DEMO_TOKEN}`;
export const DEMO_ACCOUNT = { n: '데모 사장님', e: 'owner-demo@bizhigher.example', p: 'demo' };

const DAY = 86400000;
const at = (daysAgo) => new Date(Date.now() - daysAgo * DAY - 7 * 60000).toISOString().replace('T', ' ').slice(0, 19); // 언제 열어도 "며칠 전" 그대로(미래 시각이 생기지 않게)
const laMonth = (ms) => new Date(ms).toLocaleString('en-CA', { timeZone: 'America/Los_Angeles' }).slice(0, 7);

/* 단계별 완료 시점(며칠 전). 없는 단계는 셋업이면 시작 직후, 반복 단계면 최근 */
const DONE_AGO = {
  'post-2': 2, 'post-4': 1, 'post-5': 0.3, 'post-6': 1, 'post-7': 6, 'gc-1': 2, 'gc-2': 3, 'gc-3': 3,
  'rr-2': 0.2, 'rr-3': 0.2, 'rr-4': 0.2, 'rr-5': 0.4, 'rr-6': 0.2, 'rr-7': 6,
  'ac-1': 5, 'ac-2': 4, 'ac-3': 4, 'ac-4': 3, 'ac-5': 2, 'llc-1': 11, 'llc-2': 10, 'cp-2': 20, 'cp-3': 4,
  'mr-1': 8, 'mr-6': 8, 'mr-2': 7, 'mr-3': 7, 'mr-4': 6, 'mr-5': 6,
  'seo-3': 24, 'seo-3b': 22, 'seo-4': 18, 'seo-5': 17, 'seo-10': 3, 'seo-9': 13, 'seo-6': 17,
  'sv-1': 16, 'sv-1b': 15, 'sv-2': 12, 'sv-2b': 9, 'sv-3': 12, 'sv-4': 8,
};
const OPEN = new Set(['post-3', 'gc-4', 'cp-1', 'seo-8', 'seo-7']); // 이번 달 아직 남은 단계(post-3 = 사장님 캘린더 승인)

function build(origin) {
  const o = String(origin || 'https://bizhigher.com').replace(/\/$/, '');
  const img = (f) => `${o}/showcase/${f}`;
  const start = 184;
  const job = { id: 9001, business: '순두부 하우스 (데모)', service_slug: 'local-growth-six', service_name: 'Local Growth · 6개월 플랜', customer_email: DEMO_ACCOUNT.e, status: 'doing', portal_token: DEMO_TOKEN, created_at: at(start), updated_at: at(0.2) };

  const tasks = tasksFor('local-growth-six').map((s, i) => {
    const recurring = ['monthly', 'weekly', 'daily'].includes(s.ph);
    const open = OPEN.has(s.k);
    const ago = DONE_AGO[s.k] != null ? DONE_AGO[s.k] : recurring ? 20 : Math.max(150, start - 2 - i * 1.3);
    return { id: 7000 + i, job_id: job.id, key: s.k, title: s.t, service: s.service, service_name: s.serviceName, who: s.who, status: open ? 'todo' : 'done', phase: s.ph, david_min: s.min, sort: s.sort, done_at: open ? null : at(ago), result_kind: 'text', result_text: '', result_url: '' };
  });
  const T = (k) => tasks.find((t) => t.key === k);
  const put = (k, text, url) => { const t = T(k); if (t) { t.result_text = text; if (url) t.result_url = url; } return t ? t.id : null; };

  const ds = [];
  const D = (o2) => ds.push({ id: 9100 + ds.length, job_id: job.id, kind: 'text', url: '', summary: '', needs_approval: 0, approved_at: null, revise_note: null, options: null, choice: null, choice_at: null, customer_reply: null, reply_at: null, ...o2, created_at: o2.sent_at });

  // ① 12월 게시물 캘린더 — 승인 대기
  D({ task_id: put('post-2', `12월 구글·인스타 게시물 8건입니다. 연말 단체 예약과 겨울 신메뉴를 중심으로 짰습니다.

| 날짜 | 주제 | 채널 | 사진 |
|---|---|---|---|
| 12/2 (화) | 겨울 신메뉴 — 해물 순두부 | 구글·인스타 | 해물 순두부 |
| 12/5 (금) | 연말 단체 예약 받습니다 (10명까지) | 구글·페이스북 | 매장 안 |
| 12/9 (화) | 점심 세트 $12.95 — 평일 11~3시 | 구글·인스타 | 점심 세트 |
| 12/12 (금) | 돌솥비빔밥 + 순두부 콤보 | 인스타 | 돌솥비빔밥 |
| 12/16 (화) | 손님 리뷰 감사 — "국물이 진해요" | 구글 | 갈비 순두부 |
| 12/19 (금) | 연말 영업시간 안내 | 구글·페이스북 | 매장 안 |
| 12/23 (화) | 크리스마스 이브 영업 안내 | 구글·인스타 | 매장 안 |
| 12/30 (화) | 새해 첫 주 점심 세트 | 구글·인스타 | 점심 세트 |

${img('seafood-sundubu-n.jpg')}
${img('lunch-interior.jpg')}
${img('lunch-set.jpg')}
${img('dolsot-bibimbap-n.jpg')}`), title: '12월 게시물 캘린더 (8건)', sent_at: at(2), needs_approval: 1, summary: '12월에 올릴 게시물 8건입니다. 연말 단체 예약과 겨울 신메뉴를 앞에 두었고, 12/19·12/23 영업시간 안내는 아래 "구글 프로필 확인" 답을 받으면 시간을 채웁니다.' });

  // ② 광고 소재 — 세트 고르기
  D({ task_id: put('ac-5', '12월 광고 소재 10장 중 점수 상위 3세트입니다. 고르신 세트로 구글·인스타 광고를 먼저 돌리고, 2주 뒤 성과를 보고 다른 세트와 바꿉니다.'), title: '광고 소재 — 먼저 쓸 세트 고르기', sent_at: at(2.1), needs_approval: 1, summary: '이번 달 광고 이미지 3세트입니다. 하나를 고르시면 그 세트로 먼저 광고를 돌립니다.',
    options: JSON.stringify([
      { key: 'A', label: '점심 세트 $12.95 — 평일 11~3시', image: img('lunch-set.jpg'), note: '지난달 클릭이 가장 많았던 문구를 이어 씁니다', default: true },
      { key: 'B', label: '겨울 한정 해물 순두부', image: img('seafood-sundubu-n.jpg'), note: '새 메뉴를 알리는 데 집중' },
      { key: 'C', label: '연말 단체 예약 — 10명까지', image: img('lunch-interior.jpg'), note: '12월 회식 수요를 노립니다' },
    ]) });

  // ③ 구글 프로필 — 답이 필요한 질문
  D({ task_id: put('gc-2', `이번 달 구글 프로필에서 확인해 주실 것 2가지입니다.

1. **연말 특별 영업시간** — 12/24(수)·12/31(수)·1/1(목)에 문을 여시나요? 몇 시까지 하시나요? 미리 올려 두면 구글 지도에 "영업시간이 다를 수 있음" 표시가 뜨지 않습니다.
2. **겨울 메뉴 사진** — 새로 찍은 사진이 있으면 알려 주세요. 없으면 다음 방문 때 찍겠습니다.

지난달 반영한 것: 카테고리 '두부 요리 전문점' 추가 · 메뉴 12개 가격 갱신 · 사진 6장 추가`), title: '이번 달 구글 프로필 관리', sent_at: at(3), summary: '연말 영업시간 2가지만 알려 주시면 됩니다. 아래 답변 칸에 한 줄로 적어 주세요.' });

  // ④ 10월 월간 리포트
  D({ task_id: put('mr-4', '10월 월간 리포트입니다. 지도 3위 안 17/49지점, 새 리뷰 27개(평균 4.7), 구글 프로필 전화 클릭 112회.', `${o}/sample-report/report.pdf`), title: '10월 월간 리포트', kind: 'link', url: `${o}/sample-report/report.pdf`, sent_at: at(6), summary: '시작 6개월째 리포트입니다. "korean tofu soup" 지도 3위 안이 0곳에서 17곳으로 늘었습니다.' });

  // ⑤ 10월 리뷰 요약
  D({ task_id: put('rr-7', `10월 새 리뷰 27개에 모두 48시간 안에 답글을 달았습니다.

| 별점 | 개수 | 답글 |
|---|---|---|
| ★5 | 21 | 21 |
| ★4 | 4 | 4 |
| ★3 이하 | 2 | 2 (사장님 확인 후 게시) |

손님들이 가장 많이 말한 것: **국물 맛(14회)** · **반찬 리필(9회)** · **주차(5회)**. 주차 안내를 구글 프로필 소개에 넣었습니다.`), title: '10월 리뷰 요약', sent_at: at(6.1), summary: '10월 새 리뷰 27개, 전부 답글 완료. 주차 문의가 늘어 프로필 소개에 주차 안내를 넣었습니다.' });

  // ⑥ 숏폼 영상 — 고른 것
  D({ task_id: put('sv-2', '10월 숏폼 영상 2편입니다. 고르신 영상을 인스타 릴스·유튜브 쇼츠·구글 프로필에 먼저 올립니다.'), title: '숏폼 영상 — 먼저 올릴 영상 고르기', sent_at: at(12), needs_approval: 1, approved_at: at(9), choice: 'B', choice_at: at(9), summary: '15초 영상 2편 중 먼저 올릴 것을 고르셨습니다.',
    options: JSON.stringify([
      { key: 'A', label: '점심 세트 15초 — 끓는 순두부', image: img('lunch-set.jpg'), video: `${o}/showcase/interior-loop.mp4` },
      { key: 'B', label: '매장 분위기 15초 — 저녁 손님', image: img('lunch-interior.jpg'), video: `${o}/showcase/interior-loop.mp4`, default: true },
    ]) });

  // ⑦ 10월 블로그 글
  D({ task_id: put('seo-4', `10월 블로그 글 2편을 발행했습니다.

- 가든그로브 순두부, 처음 오신 분께 추천하는 3가지
- 비 오는 날 생각나는 해물 순두부 이야기

두 글 모두 웹사이트 "소식" 메뉴에 올라가 있고, 구글에 색인됐습니다.`), title: '10월 블로그 글', sent_at: at(18), summary: '웹사이트에 블로그 글 2편이 올라갔습니다.' });

  // ⑧ 셋업 때 받은 것들
  D({ task_id: put('lls-7', '로컬 등록 60곳을 마쳤습니다. 핵심 30곳(애플 지도·빙·옐프·넥스트도어 등)은 직접, 나머지 30곳은 등록 대행으로 올렸고 주소·전화가 모두 같게 맞춰져 있습니다.'), title: '로컬 등록 완료 리포트', sent_at: at(150), summary: '60곳에 같은 상호·주소·전화로 등록했습니다.' });
  D({ task_id: put('gpo-5', `구글 프로필 정리 전·후입니다.

| 항목 | 전 | 후 |
|---|---|---|
| 카테고리 | 한식당 1개 | 한식당 + 두부 요리 전문점 |
| 사진 | 9장 | 34장 |
| 메뉴 | 없음 | 28개 |
| 소개문 | 없음 | 한/영 750자 |`), title: '구글 프로필 정리 전·후 리포트', sent_at: at(170), summary: '카테고리·사진·메뉴·소개문을 채웠습니다.' });
  D({ task_id: put('ob-5', '시작 안내 — 180일 일정과 준비할 것입니다. 확인 질문: 쉬는 날이 있나요? 구글 카테고리는 무엇으로 할까요?'), title: '시작 안내 — 180일 일정과 준비할 것', sent_at: at(182), summary: '앞으로 180일 동안의 일정입니다.', customer_reply: `[${at(181).slice(0, 10)}] 월요일은 쉽니다. 카테고리는 한식당으로 해 주세요.`, reply_at: at(181) });

  const site = { id: 9001, job_id: job.id, slug: 'sundubu-house', domain: 'sundubuhouse.com', live: 1, version: 7, updated_at: at(20), demo: 1, demo_photo: img('lunch-interior.jpg') };
  const spec = { name: '순두부 하우스', tagline: '가든그로브 정통 순두부 · 매일 11시~9시', rating: '4.7', review_count: 148, hero: { photo: img('lunch-interior.jpg') } };
  const report = { ...SAMPLE, business: { ...SAMPLE.business, photo: img('lunch-interior.jpg') }, sample: true };
  const now = laMonth(Date.now());
  const events = { [now]: { page_view: 96, phone_click: 9, directions_click: 14, booking_click: 3, contact_submit: 1 } };
  const prevD = new Date(now + '-01T00:00:00Z'); prevD.setUTCMonth(prevD.getUTCMonth() - 1);
  events[prevD.toISOString().slice(0, 7)] = { page_view: 412, phone_click: 38, directions_click: 61, booking_click: 12, contact_submit: 4 };
  return { job, tasks, ds, site, spec, report, events };
}

/* 고객 페이지 코드가 부르는 쿼리만 아는 가짜 D1. 모르는 쿼리는 빈 결과 — 쓰기는 아무것도 하지 않는다 */
export function demoDb(origin) {
  const X = build(origin);
  const answer = (sql, args) => {
    if (/FROM jobs WHERE portal_token/.test(sql)) return [X.job];
    if (/FROM jobs WHERE id/.test(sql)) return [X.job];
    if (/SELECT spec FROM sites/.test(sql)) return [{ spec: JSON.stringify(X.spec) }];
    if (/FROM sites WHERE job_id/.test(sql)) return [X.site];
    if (/FROM job_tasks WHERE id IN/.test(sql)) return X.tasks.filter((t) => args.includes(t.id));
    if (/FROM job_tasks WHERE job_id = \? AND key = 'web-2'/.test(sql)) return [];
    if (/FROM job_tasks WHERE job_id/.test(sql)) return X.tasks;
    if (/COUNT\(\*\) n FROM deliverables/.test(sql)) return [{ n: X.ds.filter((d) => d.sent_at && d.needs_approval && !d.approved_at).length }];
    if (/FROM deliverables WHERE job_id/.test(sql)) return X.ds;
    if (/SELECT period FROM job_reports/.test(sql)) return [{ period: '2026-10' }];
    if (/FROM job_reports WHERE job_id = \? AND period/.test(sql)) return args[1] === '2026-10' ? [{ data: JSON.stringify(X.report), period: '2026-10' }] : [];
    if (/FROM site_events .*GROUP BY event/.test(sql)) { const m = String(args[1] || '').slice(0, 7); return Object.entries(X.events[m] || {}).map(([event, n]) => ({ event, n })); }
    return [];
  };
  const stmt = (sql, args = []) => ({
    bind: (...a) => stmt(sql, a),
    first: async () => answer(sql, args)[0] || null,
    all: async () => ({ results: answer(sql, args) }),
    run: async () => ({ success: true, meta: { changes: 0 } }),
  });
  return { demo: true, prepare: (sql) => stmt(sql), batch: async () => [], exec: async () => ({}) };
}
