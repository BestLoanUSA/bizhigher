/**
 * 고객 사이트 자동 SEO 점검 — 렌더된 페이지(render() 의 files)를 규칙으로 검사한다 (2026-11-04, seo-6·seo-5)
 * bizhigher.com 의 scripts/seo-check.js 와 같은 생각을 고객 사이트 템플릿 출력에 맞춘 것.
 *
 * 막는 위반(blocking) — 발행·배포 전에 0 이어야 한다:
 *   제목·설명 누락 / 제목·설명 페이지 간 중복 / H1 이 1개가 아님 / 도메인 연결(live)인데 canonical 없음·noindex /
 *   JSON-LD 파싱 실패·자체 별점(aggregateRating) / 사이트맵에 빠진 페이지 /
 *   키워드 지도(spec.seo.keywords): 한 키워드가 두 페이지 · 지도에 적힌 페이지가 없음
 * 보고만(warn): 제목 길이(10~60자 밖) · 설명 길이(50~160자 밖) · 고아 페이지(다른 페이지에서 링크 없음) ·
 *   얇은 글(블로그·지역 본문 800자 미만) · alt 없는 이미지 · 키워드가 그 페이지 제목·H1 에 없음 · 키워드 주인이 없는 블로그·지역 페이지
 *
 * 키워드 지도 형식: spec.seo = { keywords: [{ keyword: "가든그로브 안경점", page: "/" }, { keyword: "garden grove eye exam", page: "/services/" }, …] }
 */
'use strict';

const strip = (h) => String(h || '').replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ').trim();
const norm = (s) => String(s || '').toLowerCase().replace(/\s+/g, '');
const decode = (s) => String(s || '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
const pageOf = (file) => '/' + file.replace(/index\.html$/, '').replace(/^\/+/, '');

function check(files, spec, { live = false } = {}) {
  const blocking = [], warn = [];
  const pages = Object.keys(files).filter((f) => f.endsWith('.html') && !/(^|\/)404\.html$/.test(f));
  const info = {};
  for (const f of pages) {
    const h = String(files[f]);
    const p = pageOf(f);
    const title = decode(((/<title>([\s\S]*?)<\/title>/i.exec(h) || [])[1] || '').trim());
    const desc = decode(((/<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i.exec(h) || [])[1] || '').trim());
    const h1s = (h.match(/<h1[\s>]/gi) || []).length;
    const h1 = strip((/<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(h) || [])[1] || '');
    const canonical = /<link\s+rel=["']canonical["']/i.test(h);
    const noindex = /<meta\s+name=["']robots["']\s+content=["'][^"']*noindex/i.test(h);
    const links = [...h.matchAll(/href=["']([^"'#?]+)["']/gi)].map((m) => m[1]);
    const imgsNoAlt = (h.match(/<img(?![^>]*\balt=)[^>]*>/gi) || []).length;
    const main = (/<main[\s\S]*?<\/main>/i.exec(h) || [h])[0];
    info[p] = { file: f, title, desc, h1s, h1, canonical, noindex, links, imgsNoAlt, textLen: strip(main).replace(/\s/g, '').length };
    if (!title) blocking.push(`${p} — <title> 없음`);
    else if (title.length > 60 || title.length < 10) warn.push(`${p} — 제목 ${title.length}자(권장 10~60): ${title}`);
    if (!desc) blocking.push(`${p} — meta description 없음`);
    else if (desc.length < 50 || desc.length > 160) warn.push(`${p} — 설명 ${desc.length}자(권장 50~160)`);
    if (h1s !== 1) blocking.push(`${p} — H1 ${h1s}개(1개여야 함)`);
    if (live && !canonical) blocking.push(`${p} — 도메인 연결됐는데 canonical 없음`);
    if (live && noindex) blocking.push(`${p} — 도메인 연결됐는데 noindex(검색에서 빠짐)`);
    for (const m of h.matchAll(/<script\s+type=["']application\/ld\+json["']>([\s\S]*?)<\/script>/gi)) {
      try { const j = JSON.parse(m[1]); if (/"aggregateRating"/.test(JSON.stringify(j))) blocking.push(`${p} — 스키마에 자체 별점(aggregateRating) — 구글 정책상 넣지 않는다`); }
      catch { blocking.push(`${p} — JSON-LD 파싱 실패`); }
    }
    if (imgsNoAlt) warn.push(`${p} — alt 없는 이미지 ${imgsNoAlt}개`);
    if (/^\/(blog|areas)\/[^/]+\/$/.test(p) && info[p].textLen < 800) warn.push(`${p} — 본문 ${info[p].textLen}자(얇은 글, 800자 이상 권장)`);
  }
  // 중복 제목·설명
  const dup = (key, label) => { const seen = {}; for (const [p, i] of Object.entries(info)) { if (!i[key]) continue; (seen[i[key]] = seen[i[key]] || []).push(p); } for (const [v, ps] of Object.entries(seen)) if (ps.length > 1) blocking.push(`${label} 중복 ${ps.length}페이지(${ps.join(', ')}): ${v.slice(0, 60)}`); };
  dup('title', '제목'); dup('desc', '설명');
  // 사이트맵
  const sm = files['sitemap.xml'] ? String(files['sitemap.xml']) : '';
  if (!sm) blocking.push('sitemap.xml 없음');
  else {
    const locs = new Set([...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => { try { return new URL(m[1]).pathname.replace(/^\/[^/]+(?=\/)/, (x) => x); } catch { return m[1]; } }));
    const inMap = (p) => [...locs].some((l) => l === p || l.endsWith(p === '/' ? '/' : p));
    for (const p of Object.keys(info)) if (!inMap(p)) blocking.push(`${p} — 사이트맵에 없음`);
  }
  // 고아 페이지(상대·절대 링크 모두 끝부분으로 대조)
  const linked = new Set();
  for (const [from, i] of Object.entries(info)) for (const l of i.links) {
    for (const p of Object.keys(info)) if (p !== from && p !== '/' && (l.endsWith(p.slice(1)) || l === p)) linked.add(p);
  }
  for (const p of Object.keys(info)) if (p !== '/' && !linked.has(p)) warn.push(`${p} — 다른 페이지에서 링크가 없음(고아)`);
  // 키워드 지도
  const kws = (spec && spec.seo && Array.isArray(spec.seo.keywords)) ? spec.seo.keywords : [];
  if (!kws.length) warn.push('키워드 지도(spec.seo.keywords) 없음 — seo-11 에서 만든다');
  const owner = {};
  for (const k of kws) {
    const kw = (k && (k.keyword || k.kw) || '').trim(); const pg = (k && k.page || '').trim();
    if (!kw || !pg) continue;
    const n = norm(kw);
    if (owner[n] && owner[n] !== pg) blocking.push(`키워드 "${kw}" 주인이 둘 — ${owner[n]} · ${pg} (한 키워드 한 페이지)`);
    owner[n] = owner[n] || pg;
    const i = info[pg.endsWith('/') ? pg : pg + '/'];
    if (!i) { blocking.push(`키워드 "${kw}" 의 페이지 ${pg} 가 사이트에 없음`); continue; }
    if (!norm(i.title + i.h1).includes(n)) warn.push(`${pg} — 주인 키워드 "${kw}" 가 제목·H1 에 없음`);
  }
  if (kws.length) {
    const owned = new Set(Object.values(owner).map((p) => (p.endsWith('/') ? p : p + '/')));
    for (const p of Object.keys(info)) if (/^\/(blog|areas)\/[^/]+\/$/.test(p) && !owned.has(p)) warn.push(`${p} — 키워드 지도에 주인 키워드가 없음`);
  }
  const md = [`# 자동 SEO 점검 — ${Object.keys(info).length}페이지 (${live ? '도메인 연결' : '임시 주소 — noindex 정상'})`, '',
    `**막는 위반 ${blocking.length}건** · 보고 ${warn.length}건`, '',
    ...(blocking.length ? ['## 막는 위반 (발행 전 0 이어야 함)', ...blocking.map((x) => '- ' + x), ''] : ['✓ 막는 위반 없음', '']),
    ...(warn.length ? ['## 보고', ...warn.map((x) => '- ' + x)] : [])].join('\n');
  return { pages: Object.keys(info).length, blocking, warn, markdown: md };
}

module.exports = { check };
