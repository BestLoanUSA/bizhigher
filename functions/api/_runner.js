/**
 * AI 실행 루틴 깨우기 — "할 일이 생겼을 때만" 루틴이 돈다 (2026-11-01 David 결정: 정기 실행은 하루 1회 07시대만)
 *
 * claude.ai 루틴의 API 트리거(POST https://api.anthropic.com/v1/claude_code/routines/{trig_…}/fire, 루틴별 토큰)를
 * Cloudflare 환경변수 ROUTINE_FIRE_URL · ROUTINE_FIRE_TOKEN 으로 부른다. 토큰은 claude.ai/code/routines → 루틴 편집 →
 * Add another trigger → API → Generate token (한 번만 보임). 없으면 조용히 건너뛰고 settings.runner 에 "미설정"만 남긴다.
 *
 * 부르는 곳(AI 차례가 새로 생기는 순간): 관리자 승인·수정 요청·반려·다시 열기·결과물 제출(자동 승인)·단계 완료·David 대신 선택·
 * 사이트 수정 요청·데모 생성, 질문지 제출(/api/intake), Stripe 결제, 고객 페이지 승인·선택·수정 요청, 루틴 자신(runner.js wake — 남은 일이 있을 때).
 * 실제로 AI 차례(aiReady)가 하나도 없으면 부르지 않는다. 3분 안에 또 부르면 건너뛴다(한 세션이 큐를 전부 처리한다).
 */
import { aiReady } from './_orders.js';

const DEBOUNCE_MS = 3 * 60 * 1000;

export function runnerConfigured(env) { return !!(env.ROUTINE_FIRE_URL && env.ROUTINE_FIRE_TOKEN); }

/** 지금 AI 차례인 단계가 있는가 (큐와 같은 판정: 공통 온보딩 끝난 작업의, 같은 서비스 앞 단계가 끝난 auto·ai 단계) + 고객용 요약이 비어 있는 결과물 */
export async function hasAiWork(db) {
  const jobs = (await db.prepare(`SELECT id FROM jobs WHERE status NOT IN ('done','hold') ORDER BY id DESC LIMIT 200`).all()).results || [];
  if (!jobs.length) return { work: 0, drafts: 0 };
  const ids = jobs.map((j) => j.id);
  const rows = (await db.prepare(`SELECT id, job_id, key, service, sort, who, status FROM job_tasks WHERE job_id IN (${ids.map(() => '?').join(',')})`).bind(...ids).all()).results || [];
  const by = {}; for (const t of rows) (by[t.job_id] = by[t.job_id] || []).push(t);
  let work = 0; for (const id of ids) work += aiReady(by[id] || []).length;
  const d = await db.prepare(`SELECT COUNT(*) n FROM deliverables d JOIN jobs j ON j.id = d.job_id LEFT JOIN job_tasks t ON t.id = d.task_id WHERE d.sent_at IS NULL AND (d.summary IS NULL OR d.summary = '') AND j.status NOT IN ('done','hold') AND (COALESCE(t.result_text,'') != '' OR COALESCE(d.url,'') != '')`).first();
  return { work, drafts: (d && d.n) || 0 };
}

async function readState(db) {
  try { const r = await db.prepare(`SELECT value FROM settings WHERE key = 'runner'`).first(); return r ? JSON.parse(r.value) : {}; } catch { return {}; }
}
async function writeState(db, s) {
  await db.prepare(`INSERT INTO settings (key, value, updated_at) VALUES ('runner', ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`).bind(JSON.stringify(s)).run();
}

/** 루틴을 깨운다. 반환: { fired, reason, skipped } — 실패해도 예외를 던지지 않는다(호출한 쪽 작업을 막지 않기 위해) */
export async function wakeRoutine(db, env, reason, { force = false } = {}) {
  const state = await readState(db);
  const now = Date.now();
  const log = (patch) => writeState(db, { ...state, ...patch, lastReason: reason, lastAt: new Date(now).toISOString() });
  try {
    if (!runnerConfigured(env)) { await log({ skipped: '미설정 — ROUTINE_FIRE_URL · ROUTINE_FIRE_TOKEN', pending: true }); return { fired: false, skipped: 'unconfigured' }; }
    if (!force) {
      const w = await hasAiWork(db);
      if (!w.work && !w.drafts) { await log({ skipped: 'AI 차례 없음', pending: false }); return { fired: false, skipped: 'no-work' }; }
      if (state.lastFiredAt && now - Date.parse(state.lastFiredAt) < DEBOUNCE_MS) { await log({ skipped: '3분 안에 이미 깨움', pending: true }); return { fired: false, skipped: 'debounce' }; }
    }
    const r = await fetch(env.ROUTINE_FIRE_URL, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + env.ROUTINE_FIRE_TOKEN, 'anthropic-version': '2026-10-21', 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: `[관리자 깨움] ${reason || ''} — ${new Date(now).toISOString()}`.slice(0, 2000) }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { await log({ skipped: `루틴 API ${r.status} ${(j.error && j.error.message) || ''}`.slice(0, 200), pending: true }); return { fired: false, skipped: 'api-' + r.status }; }
    await log({ skipped: '', pending: false, lastFiredAt: new Date(now).toISOString(), lastSession: j.claude_code_session_url || '', fires: (state.fires || 0) + 1 });
    return { fired: true, session: j.claude_code_session_url };
  } catch (e) {
    try { await log({ skipped: String(e && e.message || e).slice(0, 200), pending: true }); } catch {}
    return { fired: false, skipped: 'error' };
  }
}

export async function runnerStatus(db, env) {
  const s = await readState(db);
  return { configured: runnerConfigured(env), lastAt: s.lastAt || null, lastReason: s.lastReason || '', lastFiredAt: s.lastFiredAt || null, lastSession: s.lastSession || '', skipped: s.skipped || '', pending: !!s.pending, fires: s.fires || 0 };
}
