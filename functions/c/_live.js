/**
 * 고객 페이지 실시간 리포트 (2026-11-06 David 요청: "고객 이름이 들어간 그 링크가 리포트가 되게 — 살아 있는 형태로")
 *
 * 페이지를 열 때마다 새로 만든다:
 *   실시간 — 전체 진행률 · 다음 할 일(사장님 차례 강조) · 최근 30일 한 일(서비스별 개수) · 내 웹사이트 이번 달(우리 비콘 site_events)
 *   + 마지막 월간 리포트(job_reports, 루틴이 mr-4 때 runner.js report-data 로 올린다)의 진단 점수·지도 순위·차트·표
 * 판형은 실제 리포트와 같다(functions/api/_report-view.js = _report.js 의 순수 렌더 부분, build.js 가 복사).
 * 숫자는 D1 에 있는 것만 — 없으면 그 칸을 만들지 않는다.
 */
import { renderHtml } from '../api/_report-view.js';
import { customerTitle, DELIVER_KEYS } from '../api/_playbook.js';
import { jobProgress, siteStats } from '../api/_orders.js';

const CLOSED = new Set(['done', 'skipped']);
const parse = (s) => { try { return JSON.parse(s); } catch { return null; } };
const laNow = () => new Date().toLocaleString('ko-KR', { timeZone: 'America/Los_Angeles', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const laMonth = () => new Date().toLocaleString('en-CA', { timeZone: 'America/Los_Angeles' }).slice(0, 7);

export async function reportPeriods(db, jobId) {
  return ((await db.prepare(`SELECT period FROM job_reports WHERE job_id = ? ORDER BY period DESC`).bind(jobId).all().catch(() => ({ results: [] }))).results || []).map((r) => r.period);
}
export async function storedReport(db, jobId, period) {
  const row = await db.prepare(`SELECT data, period FROM job_reports WHERE job_id = ? AND period = ?`).bind(jobId, period).first().catch(() => null);
  return row ? parse(row.data) : null;
}

/** 실시간 리포트 객체(report.json 형식) */
export async function buildLive(db, job, site) {
  const tasks = (await db.prepare(`SELECT key, title, service, service_name, who, status, phase, david_min, done_at, sort FROM job_tasks WHERE job_id = ? ORDER BY sort, id`).bind(job.id).all()).results || [];
  const periods = await reportPeriods(db, job.id);
  const base = periods.length ? await storedReport(db, job.id, periods[0]) : null;
  const biz = String(job.business || '').replace(/\s*\(데모\)/, '');
  const pct = jobProgress(tasks);
  const since = Date.now() - 30 * 86400000;
  const doneRecent = tasks.filter((t) => t.status === 'done' && t.done_at && Date.parse(String(t.done_at).replace(' ', 'T') + 'Z') >= since && t.service !== 'common');
  const bySvc = new Map();
  for (const t of doneRecent) { if (t.who === 'customer') continue; const k = t.service_name || t.service; bySvc.set(k, (bySvc.get(k) || 0) + 1); }
  // 다음 할 일은 고객에게 의미 있는 것만: 사장님 차례 + 사장님이 받게 될 결과물(DELIVER_KEYS). 내부 단계(결제 기록·등록 작업 등)는 빼고
  const open = tasks.filter((t) => !CLOSED.has(t.status) && t.status !== 'review' && t.phase !== 'daily' && t.phase !== 'weekly' && t.service !== 'common');
  const yours = open.filter((t) => t.who === 'customer' && t.key !== 'cp-1'); // cp-1(콘텐츠 수정 월 2회)은 원할 때만 쓰는 권리라 할 일이 아니다
  const coming = open.filter((t) => t.who !== 'customer' && DELIVER_KEYS.has(t.key));
  const next = [...yours.slice(0, 2), ...coming.slice(0, 4 - Math.min(2, yours.length))];
  const waiting = await db.prepare(`SELECT COUNT(*) n FROM deliverables WHERE job_id = ? AND sent_at IS NOT NULL AND needs_approval = 1 AND approved_at IS NULL`).bind(job.id).first().catch(() => null);
  const waitN = (waiting && waiting.n) || 0;

  const summary = [
    `전체 작업의 ${pct}%가 끝났습니다.`,
    doneRecent.length ? `최근 30일 동안 ${doneRecent.filter((t) => t.who !== 'customer').length}가지 작업을 마쳤습니다.` : '이번 달 작업을 준비하고 있습니다.',
    waitN ? `확인해 주실 결과물이 ${waitN}건 있습니다 — 이 페이지 아래에서 바로 승인하실 수 있습니다.` : yours.length ? `사장님 차례인 일이 ${yours.length}건 있습니다(아래 "다음 할 일").` : '지금 사장님이 하실 일은 없습니다.',
  ];
  const kpis = [{ label: '전체 진행', value: pct + '%', note: `${tasks.filter((t) => CLOSED.has(t.status)).length}/${tasks.length}단계` }, { label: '최근 30일 한 일', value: String(doneRecent.filter((t) => t.who !== 'customer').length), note: '완료된 작업' }];
  const sections = [{ title: '지금 진행 상황', progress: pct, progressLabel: '전체 진행', steps: next.map((t) => ({ text: customerTitle(t.key, t.title), you: t.who === 'customer' })) }];
  if (bySvc.size) sections.push({ title: '최근 30일 한 일', tiles: [...bySvc.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, n]) => ({ n: String(n), label: k })), items: doneRecent.filter((t) => t.who !== 'customer' && DELIVER_KEYS.has(t.key)).sort((a, b) => String(b.done_at).localeCompare(String(a.done_at))).slice(0, 5).map((t) => customerTitle(t.key, t.title)) });

  if (site) {
    const st = await siteStats(db, site.id, laMonth()).catch(() => null);
    const ev = (st && st.events) || {}, pv = (st && st.prevEvents) || {};
    const row = (label, k) => [label, String(ev[k] || 0), String(pv[k] || 0)];
    if (st && Object.keys(ev).length + Object.keys(pv).length) {
      kpis.push({ label: '이번 달 사이트 방문', value: String(ev.page_view || 0), note: `지난달 ${pv.page_view || 0}` });
      sections.push({ title: '내 웹사이트 — 이번 달', table: { head: ['항목', '이번 달', '지난달'], rows: [row('페이지 보기', 'page_view'), row('전화 버튼', 'phone_click'), row('길찾기', 'directions_click'), row('예약 버튼', 'booking_click'), row('문의 접수', 'contact_submit')] }, note: 'BizHigher 사이트에 붙은 자체 측정(구글 애널리틱스와 따로 셉니다). 오늘까지의 숫자입니다.' });
    }
  }
  if (base) {
    for (const k of (base.kpis || []).slice(0, 2)) kpis.push({ ...k, note: `${k.note ? k.note + ' · ' : ''}${periods[0]} 리포트` });
    for (const s of base.sections || []) if (!/다음 달 계획/.test(s.title || '')) sections.push({ ...s, title: `${s.title}` + (s.scores || s.grids || s.chart ? ` · ${periods[0]}` : '') });
    const plan = (base.sections || []).find((s) => /다음 달 계획/.test(s.title || ''));
    if (plan) sections.push(plan);
  }
  return {
    title: `${biz} 리포트`, subtitle: base ? `실시간 진행 + ${periods[0]} 월간 리포트` : '실시간 진행 — 첫 월간 리포트는 한 달 뒤에 더해집니다',
    business: { ...(base && base.business), name: (base && base.business && base.business.name) || biz },
    live: laNow(), summary, kpis: kpis.slice(0, 4), sections,
    cta: '궁금한 점은 이 페이지 아래 답변 칸에 남겨 주세요. 이 리포트는 열 때마다 새로 계산됩니다.',
    notes: base ? `실시간 항목은 페이지를 열 때 계산합니다. 진단 점수·지도 순위·차트는 ${periods[0]} 월간 리포트 기준입니다.` : '실시간 항목은 페이지를 열 때 계산합니다.',
  };
}

export async function liveReportHtml(db, job, site, period) {
  if (period) { const d = await storedReport(db, job.id, period); return d ? renderHtml(d, { robots: 'noindex' }) : null; }
  return renderHtml(await buildLive(db, job, site), { robots: 'noindex' });
}
