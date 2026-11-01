#!/usr/bin/env node
/**
 * GA4 · Search Console 읽기 — 서비스 계정으로 고객 속성의 월간 숫자를 가져온다 (의존성 없음, 2026-11-01)
 *
 *   node automation/ai-runner/analytics.js ga4 --property 123456789 [--month 2026-10]      # 세션·사용자·페이지 보기·전환 이벤트(phone_click·directions_click·booking_click·contact_submit)·상위 페이지
 *   node automation/ai-runner/analytics.js gsc --site "sc-domain:example.com" [--month 2026-10]   # 클릭·노출·CTR·평균 순위 + 상위 검색어 10·상위 페이지 10 (sc-domain:… 또는 https://example.com/)
 *   node automation/ai-runner/analytics.js both --job 28 [--month 2026-10]                 # 사이트 스펙 analytics.ga4_property · analytics.gsc_site 로 둘 다 → 리포트 c-5 용 JSON + 마크다운
 *
 * 인증: 환경변수 GOOGLE_SA_JSON = 서비스 계정 키 JSON 전체(또는 파일 경로). 고객이 그 서비스 계정 이메일을
 *   GA4 속성(관리 → 속성 액세스 관리 → 뷰어)과 Search Console(설정 → 사용자 및 권한 → 전체)에 추가해야 읽힌다 — docs/analytics-setup-ko.md.
 *   스코프: analytics.readonly · webmasters.readonly. 키 값은 절대 출력하지 않는다.
 */
'use strict';
const fs = require('fs'); const crypto = require('crypto');
const args = process.argv.slice(2); const cmd = args[0];
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : d; };

function loadSA() {
  const raw = process.env.GOOGLE_SA_JSON || process.env.GOOGLE_ADS_SA_JSON || '';
  if (!raw) throw new Error('환경변수 GOOGLE_SA_JSON(서비스 계정 키 JSON 또는 파일 경로)이 필요합니다');
  const txt = raw.trim().startsWith('{') ? raw : fs.readFileSync(raw.trim(), 'utf8');
  const sa = JSON.parse(txt); if (!sa.client_email || !sa.private_key) throw new Error('서비스 계정 JSON 에 client_email·private_key 가 없습니다');
  return sa;
}
const b64u = (b) => Buffer.from(b).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
async function token(scopes) {
  const sa = loadSA(); const now = Math.floor(Date.now() / 1000);
  const header = b64u(JSON.stringify({ alg: 'RS256', typ: 'JWT' })); const claim = b64u(JSON.stringify({ iss: sa.client_email, scope: scopes.join(' '), aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 }));
  const sig = crypto.sign('RSA-SHA256', Buffer.from(header + '.' + claim), sa.private_key);
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: header + '.' + claim + '.' + b64u(sig) }) });
  const j = await r.json(); if (!j.access_token) throw new Error('토큰 발급 실패: ' + JSON.stringify(j).slice(0, 200));
  return { tok: j.access_token, email: sa.client_email };
}
function monthRange(m) { const mm = /^\d{4}-\d{2}$/.test(m || '') ? m : new Date(Date.now() - 864e5 * 3).toISOString().slice(0, 7); const [y, mo] = mm.split('-').map(Number); const last = new Date(Date.UTC(y, mo, 0)).getUTCDate(); const prev = new Date(Date.UTC(y, mo - 2, 1)); const pm = prev.toISOString().slice(0, 7); const plast = new Date(Date.UTC(prev.getUTCFullYear(), prev.getUTCMonth() + 1, 0)).getUTCDate(); return { month: mm, start: `${mm}-01`, end: `${mm}-${String(last).padStart(2, '0')}`, prev: pm, pstart: `${pm}-01`, pend: `${pm}-${String(plast).padStart(2, '0')}` }; }

async function ga4(property, m) {
  const { tok, email } = await token(['https://www.googleapis.com/auth/analytics.readonly']); const R = monthRange(m);
  const run = async (body) => { const r = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${property}:runReport`, { method: 'POST', headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); const j = await r.json(); if (j.error) throw new Error('GA4 ' + property + ': ' + (j.error.message || r.status) + (r.status === 403 ? ` — 서비스 계정(${email})을 속성 뷰어로 추가했는지 확인` : '')); return j; };
  const tot = async (s, e) => { const j = await run({ dateRanges: [{ startDate: s, endDate: e }], metrics: [{ name: 'sessions' }, { name: 'totalUsers' }, { name: 'screenPageViews' }, { name: 'engagementRate' }] }); const v = (j.rows && j.rows[0] && j.rows[0].metricValues) || []; return { sessions: +((v[0] || {}).value || 0), users: +((v[1] || {}).value || 0), pageviews: +((v[2] || {}).value || 0), engagement: Math.round(+((v[3] || {}).value || 0) * 100) }; };
  const cur = await tot(R.start, R.end), prev = await tot(R.pstart, R.pend);
  const ev = await run({ dateRanges: [{ startDate: R.start, endDate: R.end }], dimensions: [{ name: 'eventName' }], metrics: [{ name: 'eventCount' }], dimensionFilter: { filter: { fieldName: 'eventName', inListFilter: { values: ['phone_click', 'directions_click', 'booking_click', 'contact_submit'] } } } });
  const events = {}; for (const row of ev.rows || []) events[row.dimensionValues[0].value] = +row.metricValues[0].value;
  const pg = await run({ dateRanges: [{ startDate: R.start, endDate: R.end }], dimensions: [{ name: 'pagePath' }], metrics: [{ name: 'screenPageViews' }], orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }], limit: 10 });
  const pages = (pg.rows || []).map((r) => ({ page: r.dimensionValues[0].value, views: +r.metricValues[0].value }));
  const src = await run({ dateRanges: [{ startDate: R.start, endDate: R.end }], dimensions: [{ name: 'sessionDefaultChannelGroup' }], metrics: [{ name: 'sessions' }], orderBys: [{ metric: { metricName: 'sessions' }, desc: true }], limit: 6 });
  const channels = (src.rows || []).map((r) => ({ channel: r.dimensionValues[0].value, sessions: +r.metricValues[0].value }));
  return { property, ...R, cur, prev, events, pages, channels };
}
async function gsc(site, m) {
  const { tok, email } = await token(['https://www.googleapis.com/auth/webmasters.readonly']); const R = monthRange(m);
  const q = async (body) => { const r = await fetch(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(site)}/searchAnalytics/query`, { method: 'POST', headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); const j = await r.json(); if (j.error) throw new Error('GSC ' + site + ': ' + (j.error.message || r.status) + (r.status === 403 ? ` — 서비스 계정(${email})을 속성 사용자로 추가했는지 확인` : '')); return j; };
  const tot = async (s, e) => { const j = await q({ startDate: s, endDate: e, dimensions: [] }); const r = (j.rows && j.rows[0]) || {}; return { clicks: r.clicks || 0, impressions: r.impressions || 0, ctr: Math.round((r.ctr || 0) * 1000) / 10, position: Math.round((r.position || 0) * 10) / 10 }; };
  const cur = await tot(R.start, R.end), prev = await tot(R.pstart, R.pend);
  const qs = await q({ startDate: R.start, endDate: R.end, dimensions: ['query'], rowLimit: 10 });
  const pg = await q({ startDate: R.start, endDate: R.end, dimensions: ['page'], rowLimit: 10 });
  const map = (j, k) => (j.rows || []).map((r) => ({ [k]: r.keys[0], clicks: r.clicks, impressions: r.impressions, position: Math.round(r.position * 10) / 10 }));
  return { site, ...R, cur, prev, queries: map(qs, 'query'), pages: map(pg, 'page') };
}
function md(g, c) {
  const L = [];
  if (g) { L.push(`| GA4 | ${g.month} | ${g.prev} |`, '|---|---|---|', `| 방문(세션) | ${g.cur.sessions} | ${g.prev.sessions} |`, `| 사용자 | ${g.cur.users} | ${g.prev.users} |`, `| 페이지 보기 | ${g.cur.pageviews} | ${g.prev.pageviews} |`, `| 참여율 | ${g.cur.engagement}% | ${g.prev.engagement}% |`, `| 전화 클릭 | ${g.events.phone_click || 0} | – |`, `| 길찾기 클릭 | ${g.events.directions_click || 0} | – |`, `| 예약 클릭 | ${g.events.booking_click || 0} | – |`, `| 문의 제출 | ${g.events.contact_submit || 0} | – |`, ''); if (g.channels.length) L.push('유입 경로: ' + g.channels.map((x) => `${x.channel} ${x.sessions}`).join(' · '), ''); }
  if (c) { L.push(`| Search Console | ${c.month} | ${c.prev} |`, '|---|---|---|', `| 검색 클릭 | ${c.cur.clicks} | ${c.prev.clicks} |`, `| 노출 | ${c.cur.impressions} | ${c.prev.impressions} |`, `| CTR | ${c.cur.ctr}% | ${c.prev.ctr}% |`, `| 평균 순위 | ${c.cur.position} | ${c.prev.position} |`, ''); if (c.queries.length) L.push('상위 검색어: ' + c.queries.slice(0, 8).map((x) => `${x.query}(${x.clicks})`).join(' · '), ''); }
  return L.join('\n');
}
(async () => {
  const m = opt('month');
  if (cmd === 'ga4') { const g = await ga4(opt('property'), m); console.log(JSON.stringify({ ...g, markdown: md(g, null) }, null, 2)); return; }
  if (cmd === 'gsc') { const c = await gsc(opt('site'), m); console.log(JSON.stringify({ ...c, markdown: md(null, c) }, null, 2)); return; }
  if (cmd === 'both') {
    const job = Number(opt('job')); if (!job) throw new Error('--job N 필요');
    const BASE = (process.env.BIZHIGHER_ADMIN_URL || 'https://bizhigher.com').replace(/\/$/, ''); const PW = (process.env.BIZHIGHER_ADMIN_PASSWORD || '').trim();
    const r0 = await fetch(BASE + '/admin/login', { method: 'POST', body: new URLSearchParams({ password: PW }), redirect: 'manual' }); const cookie = (r0.headers.get('set-cookie') || '').split(';')[0];
    const cur = await (await fetch(`${BASE}/admin/api/sites/${job}`, { headers: { cookie, 'sec-fetch-mode': 'cors' } })).json(); const an = (cur && cur.spec && cur.spec.analytics) || {};
    const out = { job, ga4: null, gsc: null, errors: [] };
    if (an.ga4_property) { try { out.ga4 = await ga4(String(an.ga4_property), m); } catch (e) { out.errors.push(e.message); } } else out.errors.push('스펙 analytics.ga4_property 없음');
    if (an.gsc_site) { try { out.gsc = await gsc(an.gsc_site, m); } catch (e) { out.errors.push(e.message); } } else out.errors.push('스펙 analytics.gsc_site 없음');
    console.log(JSON.stringify({ ...out, markdown: md(out.ga4, out.gsc) }, null, 2)); return;
  }
  console.log('사용법: ga4 --property ID [--month YYYY-MM] | gsc --site "sc-domain:…" [--month] | both --job N [--month]');
})().catch((e) => { console.error('오류:', e.message); process.exit(1); });
