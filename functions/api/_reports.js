/**
 * 진단 리포트 공용 — 주소(슬러그)·30일 만료·구글 데이터 정리. 라우팅되지 않는 내부 모듈.
 *
 * 구글 지도 플랫폼 약관(2026-10-23 확인): Places 콘텐츠는 place_id 말고는 저장하지 않는다
 * (ToS §3.2.3 No Scraping/No Caching, Places 서비스별 약관 §14.3). 그래서 리포트는
 * 발급 후 REPORT_TTL_DAYS가 지나면 구글에서 온 값(상호·별점·리뷰 수·주소·경쟁 가게·웹사이트 점검·AI 해석)을
 * 지우고 place_id·우리 점수·사용자가 입력한 업체명/지역만 남긴다. 리포트는 noindex 유지.
 */
export const REPORT_TTL_DAYS = 30;
const TTL_MS = REPORT_TTL_DAYS * 24 * 60 * 60 * 1000;

/* 한글 → 로마자(국어의 로마자 표기법, 음운 변화는 생략) — 주소용이라 대략이면 충분하다 */
const INI = ['g', 'kk', 'n', 'd', 'tt', 'r', 'm', 'b', 'pp', 's', 'ss', '', 'j', 'jj', 'ch', 'k', 't', 'p', 'h'];
const MED = ['a', 'ae', 'ya', 'yae', 'eo', 'e', 'yeo', 'ye', 'o', 'wa', 'wae', 'oe', 'yo', 'u', 'wo', 'we', 'wi', 'yu', 'eu', 'ui', 'i'];
const FIN = ['', 'k', 'k', 'k', 'n', 'n', 'n', 't', 'l', 'k', 'm', 'l', 'l', 'l', 'p', 'l', 'm', 'p', 'p', 't', 't', 'ng', 't', 't', 'k', 't', 'p', 't'];
function romanize(str) {
  let out = '';
  for (const ch of String(str || '')) {
    const c = ch.charCodeAt(0) - 0xac00;
    if (c >= 0 && c < 11172) {
      out += INI[Math.floor(c / 588)] + MED[Math.floor((c % 588) / 28)] + FIN[c % 28];
    } else {
      out += ch;
    }
  }
  return out;
}

export function slugify(str) {
  return romanize(str)
    .normalize('NFKD')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32)
    .replace(/-+$/g, '');
}

const ALPHA = 'abcdefghjkmnpqrstuvwxyz23456789'; // 헷갈리는 i·l·o·0·1 제외
function rand(n) {
  const bytes = crypto.getRandomValues(new Uint8Array(n));
  let s = '';
  for (const b of bytes) s += ALPHA[b % ALPHA.length];
  return s;
}

/** /report/{slug}-{4자} — 사용자가 입력한 업체명(없으면 지역)으로 만든다. 구글 상호는 쓰지 않는다(저장 불가) */
export function newReportId(business, location) {
  const base = slugify(business) || slugify(location) || 'report';
  return `${base}-${rand(4)}`;
}

/* 라우트에서 받는 id 정리 — 옛 무작위 id(16진 12자)와 새 슬러그 id 둘 다 */
export function cleanReportId(raw) {
  return String(raw || '').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 60);
}

export function isExpired(report, now = Date.now()) {
  if (!report || report.sample) return false;
  if (report.expired) return true;
  const t = Date.parse(report.generatedAt || '');
  return Number.isFinite(t) && now - t > TTL_MS;
}

/** 구글에서 온 값을 지운 리포트. scores를 맨 앞에 둔다(관리자 목록이 앞 400자에서 total을 읽는다) */
export function scrubReport(report, row) {
  const s = (report && report.scores) || {};
  return {
    scores: {
      total: s.total || 0,
      areas: (s.areas || []).map((a) => ({ key: a.key, label: a.label, score: a.score, max: a.max })),
    },
    v: 1,
    expired: true,
    placeId: (report && report.business && report.business.placeId) || null,
    business: { name: (row && row.business) || '' }, // 사용자가 입력한 업체명
    location: (row && row.location) || '',
    generatedAt: (report && report.generatedAt) || null,
    expiredAt: new Date().toISOString(),
  };
}

/** 만료된 리포트를 한 번에 정리 — 새 진단이 들어올 때마다 뒤에서 돈다(waitUntil). 실패해도 무시 */
export async function purgeExpiredReports(env, limit = 200) {
  if (!env || !env.DB) return 0;
  const cutoff = new Date(Date.now() - TTL_MS).toISOString();
  let n = 0;
  try {
    const res = await env.DB.prepare(
      `SELECT id, business, location, report_json FROM reports
       WHERE json_extract(report_json, '$.expired') IS NULL
         AND json_extract(report_json, '$.generatedAt') < ?
       LIMIT ?`
    ).bind(cutoff, limit).all();
    for (const row of res.results || []) {
      let report;
      try { report = JSON.parse(row.report_json); } catch { report = {}; }
      await env.DB.prepare('UPDATE reports SET report_json = ? WHERE id = ?')
        .bind(JSON.stringify(scrubReport(report, row)), row.id).run();
      n++;
    }
  } catch {
    /* D1 JSON 함수 미지원 등 — 열람 시 정리가 대신한다 */
  }
  return n;
}
