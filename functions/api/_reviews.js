/**
 * 새 리뷰 감시 — Places 공개 리뷰로 (GBP API 승인 전 임시, 2026-10-22 B-3)
 *
 * 리뷰 답글 서비스가 들어 있는 진행 중 작업마다 하루 1회 Places Details(reviews·rating·userRatingCount)를 읽는다.
 * Places 는 "관련도 높은" 리뷰 최대 5개만 주므로 리뷰가 많은 가게는 놓칠 수 있다(소규모 가게엔 충분). GBP API 가 오면 전체로 바뀐다.
 *
 * 처음 보는 작업은 지금 있는 리뷰를 기준선으로만 기록한다(옛 리뷰에 답글 과제를 만들지 않는다 — 백로그는 rr-1).
 * 그 뒤 새로 보이는 리뷰마다 job_tasks 에 'rr-live' 단계(AI 초안 → David 가 GBP 에 붙여넣고 "승인" = 게시)를 만든다.
 * 별 1~3 또는 환불·위생·법적·직원 언급은 제목에 "⚠ 사람 승인 필요".
 *
 * 저장하는 것: review_seen 에 리뷰 키(해시)·별점만, 리뷰 본문은 그 작업의 job_tasks.note 에(답글을 쓰려면 필요 — 고객 자신의 리뷰, 재게시 없음 §14).
 * SKU: Enterprise + Atmosphere (월 1,000 무료). 작업당 하루 1회 → 고객 30곳까지 무료 범위.
 */
import { addEvent } from './_orders.js';

const CLOSED = new Set(['done', 'skipped']);
const RISK = /환불|refund|위생|dirty|hygien|식중독|poison|소송|lawsuit|sue\b|변호사|lawyer|경찰|police|사기|scam|fraud|무례|rude|차별|discriminat|부작용|side effect|감염|infection|harass|성희롱/i;

async function sha(s) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

export async function ensureReviewSchema(db) {
  await db.prepare(`CREATE TABLE IF NOT EXISTS review_seen (job_id INTEGER, review_key TEXT, rating INTEGER, seen_at TEXT DEFAULT (datetime('now')), PRIMARY KEY (job_id, review_key))`).run();
  await db.prepare(`CREATE TABLE IF NOT EXISTS review_sync (job_id INTEGER PRIMARY KEY, place_id TEXT, synced_at TEXT, rating REAL, count INTEGER, note TEXT)`).run();
}

/* 작업의 place_id — 질문지 "── 구글 프로필 공개 정보 ──" 블록 → ob-3 프로필 결과물 순 */
export async function findPlaceId(db, job) {
  const pick = (s) => { const m = /place_id\s*[:=]\s*([A-Za-z0-9_-]{10,})/.exec(s || ''); return m ? m[1] : ''; };
  if (job.intake_id) {
    const it = await db.prepare(`SELECT notes FROM intakes WHERE id = ?`).bind(job.intake_id).first().catch(() => null);
    const id = pick(it && it.notes); if (id) return id;
  }
  const t = await db.prepare(`SELECT result_text FROM job_tasks WHERE job_id = ? AND key = 'ob-3' AND result_text IS NOT NULL ORDER BY id DESC LIMIT 1`).bind(job.id).first().catch(() => null);
  return pick(t && t.result_text);
}

async function fetchReviews(env, placeId) {
  if (env.PLACES_MOCK) { // 로컬 테스트 전용 (프로덕션엔 없음)
    const m = JSON.parse(env.PLACES_MOCK); return m[placeId] || m['*'] || null;
  }
  if (!env.GOOGLE_PLACES_API_KEY) return null;
  const r = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?languageCode=en`, { headers: { 'X-Goog-Api-Key': env.GOOGLE_PLACES_API_KEY, 'X-Goog-FieldMask': 'rating,userRatingCount,reviews' } }).catch(() => null);
  if (!r || !r.ok) return null;
  const p = await r.json().catch(() => null);
  if (!p) return null;
  return {
    rating: p.rating, count: p.userRatingCount,
    reviews: (p.reviews || []).map((x) => ({
      author: (x.authorAttribution && x.authorAttribution.displayName) || '익명',
      rating: Number(x.rating) || 0,
      time: x.publishTime || '',
      when: x.relativePublishTimeDescription || '',
      text: (x.originalText && x.originalText.text) || (x.text && x.text.text) || '',
      lang: (x.originalText && x.originalText.languageCode) || (x.text && x.text.languageCode) || '',
    })),
  };
}

/* 진행 중 작업 전체 동기화. force 면 20시간 쿨다운 무시. 반환: { jobs, fetched, newTasks, baseline, skipped } */
export async function syncReviews(db, env, { force = false } = {}) {
  await ensureReviewSchema(db);
  const out = { jobs: 0, fetched: 0, newTasks: 0, baseline: 0, skipped: [] };
  const jobs = (await db.prepare(`SELECT DISTINCT j.* FROM jobs j JOIN job_tasks t ON t.job_id = j.id WHERE t.service = 'review-reply' AND j.status NOT IN ('done','hold')`).all()).results || [];
  for (const job of jobs) {
    out.jobs++;
    const tasks = (await db.prepare(`SELECT key, service, status, sort FROM job_tasks WHERE job_id = ?`).bind(job.id).all()).results || [];
    if (tasks.some((t) => t.service === 'common' && !CLOSED.has(t.status))) { out.skipped.push([job.id, '온보딩 미완료']); continue; }
    const sync = await db.prepare(`SELECT * FROM review_sync WHERE job_id = ?`).bind(job.id).first();
    if (!force && sync && sync.synced_at && Date.now() - Date.parse(sync.synced_at + 'Z') < 20 * 3600 * 1000) { out.skipped.push([job.id, '오늘 이미 확인']); continue; }
    const placeId = (sync && sync.place_id) || await findPlaceId(db, job);
    if (!placeId) { out.skipped.push([job.id, 'place_id 없음']); continue; }
    const data = await fetchReviews(env, placeId);
    if (!data) { out.skipped.push([job.id, 'Places 조회 실패/키 없음']); continue; }
    out.fetched++;
    const seen = new Set((((await db.prepare(`SELECT review_key FROM review_seen WHERE job_id = ?`).bind(job.id).all()).results) || []).map((r) => r.review_key));
    const first = !sync;
    const liveSort = 9000; // 별도 service('review-live') + 같은 sort → rr-2~6 이나 다른 리뷰 단계에 막히지 않는다(aiReady 는 같은 service 의 sort 가 더 작은 미완료 단계만 본다)
    for (const rv of data.reviews) {
      const key = await sha(`${rv.author}|${rv.time}`);
      if (seen.has(key)) continue;
      await db.prepare(`INSERT OR IGNORE INTO review_seen (job_id, review_key, rating) VALUES (?, ?, ?)`).bind(job.id, key, rv.rating).run();
      if (first) { out.baseline++; continue; } // 기준선 — 과제 안 만듦
      const human = rv.rating <= 3 || RISK.test(rv.text);
      const date = (rv.time || '').slice(0, 10) || rv.when;
      const title = `${human ? '⚠ 사람 승인 필요 · ' : ''}답글 ★${rv.rating} ${rv.author} (${date}) — 승인 = GBP에 게시했음`;
      const note = `[리뷰 원문 · Places 공개 리뷰 · ${date}] ★${rv.rating} ${rv.author}${rv.lang ? ' · ' + rv.lang : ''}\n${rv.text || '(본문 없음 — 별점만)'}\n\n답글 규칙: 리뷰어 언어로 2~4문장 · 대가·보상 약속 금지 · 의료업 환자 암시 금지${human ? ' · 별 1~3/위험 단어: 사과 + 오프라인 연락 유도, 잘못 인정·환불 약속 금지' : ''}`;
      await db.prepare(`INSERT INTO job_tasks (job_id, key, service, service_name, title, phase, who, david_min, verify, block, next, status, sort, note) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
        .bind(job.id, 'rr-live', 'review-live', '리뷰 답글 — 새 리뷰', title, 'daily', 'ai', 2, 1, '', 'GBP API 승인 후 별 4~5 자동 게시', 'todo', liveSort, note).run();
      out.newTasks++;
      await addEvent(db, job.id, 'task', null, null, `⭐ 새 리뷰 ★${rv.rating} ${rv.author} — AI 답글 초안 차례${human ? ' (사람 승인 필요)' : ''}`);
    }
    await db.prepare(`INSERT INTO review_sync (job_id, place_id, synced_at, rating, count) VALUES (?, ?, datetime('now'), ?, ?) ON CONFLICT(job_id) DO UPDATE SET place_id = excluded.place_id, synced_at = excluded.synced_at, rating = excluded.rating, count = excluded.count`).bind(job.id, placeId, data.rating || null, data.count || null).run();
    if (first) await addEvent(db, job.id, 'system', null, null, `⭐ 리뷰 감시 시작 (Places, 하루 1회) — 현재 ★${data.rating || '-'} · ${data.count || 0}건을 기준선으로, 이후 새 리뷰만 답글 과제로`);
  }
  return out;
}
