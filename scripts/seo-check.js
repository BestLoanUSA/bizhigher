#!/usr/bin/env node
/**
 * SEO 자동 점검 — bizhigher.com (seo/README.md). `node build.js` 뒤에 돌린다:
 *   node scripts/seo-check.js [--report seo-report.md]      (npm run seo:check)
 *
 * 규칙은 문서가 아니라 여기(코드)에 있다 — 루틴이 하나를 잊어도 리뷰어가 아니라 CI가 막는다.
 * cpacedesk 의 scripts/seo-check.mjs 를 bizhigher 에 맞게 옮긴 것(2026-11-02).
 *
 * 막는 규칙(BLOCKING) — seo/check-baseline.json 에 없는 위반이 하나라도 있으면 exit 1:
 *   meta          색인 페이지마다 <title>, meta description, 자기 주소를 가리키는 canonical, <h1> 정확히 1개, og:title·og:image
 *   unique-title  색인 페이지끼리 <title> 중복 없음
 *   unique-desc   … meta description 중복 없음
 *   orphan        색인 페이지는 다른 페이지에서 링크된다
 *   sitemap       사이트맵 URL 은 전부 빌드되고 색인 가능 / 색인 페이지는 전부 사이트맵에
 *   json-ld       JSON-LD 블록이 전부 파싱된다 · 별점·리뷰 마크업(aggregateRating·Review) 없음(CLAUDE.md §5-1)
 *                 · 블로그 글은 BlogPosting, "자주 묻는 질문" 섹션이 있는 페이지는 FAQPage
 *   copy          "90일 실행 플랜" 류 금지 표현(CLAUDE.md §1 — 실행 플랜은 180일; "최근 90일" 같은 측정 지표는 허용)
 *                 · 보장·1위 같은 뒷받침 못 하는 주장
 *   blog          content/blog/*.md 원고 규격(CLAUDE.md §9): description 155자 이내, summary 는 " | " 로 나뉜 정확히 세 문장(각 70자 이내),
 *                 `## 자주 묻는 질문` 섹션과 `###` 질문 3개 이상, 본문 1,800자 이상, keywords 있음
 *   llms          dist/llms.txt 가 모든 서비스·패키지 페이지 URL 을 담는다(services.json 에서 생성되므로 어긋나면 빌드 문제)
 *   keyword-map   seo/keyword-map.yaml 의 owner·support URL 은 전부 빌드되고 색인 가능, 한 URL 이 두 묶음의 owner 가 아니다
 *
 * baseline 은 "나중에 고칠 알려진 위반" 목록이다. 새 위반은 실패, 더 이상 안 나오는 항목은 지우라고 알려 준다.
 *
 * 보고만(REPORT ONLY) — SEO 루프가 차례로 처리하는 것, 실패 아님:
 *   제목 표시 폭 60 초과(한글·한자 = 2, 그 외 = 1 — 구글이 보통 자르는 선), 설명문 폭 80 미만 또는 320 초과,
 *   들어오는 내부 링크 3개 미만, alt 없는 이미지, owner 페이지 제목·H1 에 묶음 키워드가 하나도 없음,
 *   두 묶음에 같은 키워드, 외부 링크 깨짐 후보(사이트 안 404 링크)
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const SITE = 'https://bizhigher.com';
const argv = process.argv.slice(2);
const ri = argv.indexOf('--report');
const REPORT = ri >= 0 ? argv[ri + 1] : null;

if (!fs.existsSync(DIST)) { console.error('dist/ 가 없습니다 — 먼저 `node build.js`'); process.exit(2); }

/* ---------- 빌드 읽기 ---------- */
const htmlFiles = [];
(function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) walk(p); else if (p.endsWith('.html')) htmlFiles.push(p);
  }
})(DIST);

const decode = (s) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ');
const pathOfFile = (f) => { const r = path.relative(DIST, f).replace(/(^|\/)index\.html$/, '').replace(/\.html$/, ''); return r ? `/${r}/` : '/'; };
const norm = (href) => { let p = href.split(/[?#]/)[0]; if (!p.endsWith('/') && !/\.[a-z0-9]+$/i.test(p)) p += '/'; return p; };
const BLOCK = /<\/?(p|h[1-6]|li|td|th|dt|dd|div|section|article|aside|header|footer|nav|br|tr|blockquote|figcaption|summary|details)\b[^>]*>/gi;
const textOf = (html) => decode(html.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<style[\s\S]*?<\/style>/g, ' ').replace(BLOCK, '\n').replace(/<[^>]+>/g, ' ')).replace(/[ \t]+/g, ' ').replace(/\s*\n\s*/g, '\n').trim();
const width = (s) => [...s].reduce((n, ch) => n + (/[ᄀ-ᇿ　-〿㄰-㆏一-鿿가-힯＀-￯]/.test(ch) ? 2 : 1), 0);

// 루트에 index.html 이 아닌 파일(404.html, 네이버 소유 확인 파일)은 색인 대상이 아니다
const rootFile = (f) => path.dirname(f) === DIST && path.basename(f) !== 'index.html';
const pages = htmlFiles.map((file) => {
  const html = fs.readFileSync(file, 'utf8');
  const p = pathOfFile(file);
  const robots = (html.match(/<meta name="robots" content="([^"]*)"/) || [])[1] || '';
  const hrefs = [...html.matchAll(/<a\b[^>]*\bhref="([^"]+)"/g)].map((m) => m[1]);
  const main = (html.match(/<main[\s\S]*<\/main>/) || [])[0] || html.replace(/<nav[\s\S]*?<\/nav>/g, ' ').replace(/<footer[\s\S]*<\/footer>/, ' ');
  return {
    path: p, file, html,
    text: textOf(html), mainText: textOf(main),
    indexable: !rootFile(file) && !/noindex/i.test(robots),
    title: decode((html.match(/<title>([^<]*)<\/title>/) || [])[1] || '').trim(),
    desc: decode((html.match(/<meta name="description" content="([^"]*)"/) || [])[1] || '').trim(),
    canonical: (html.match(/<link rel="canonical" href="([^"]*)"/) || [])[1] || '',
    ogTitle: /<meta property="og:title"/.test(html), ogImage: /<meta property="og:image"/.test(html),
    h1: (html.match(/<h1[\s>]/g) || []).length,
    h1Text: textOf((html.match(/<h1[\s\S]*?<\/h1>/) || [''])[0]),
    links: new Set(hrefs.filter((h) => h.startsWith('/') && !h.startsWith('//')).map(norm)),
    imgsNoAlt: (html.match(/<img\b(?![^>]*\balt=)[^>]*>/g) || []).length,
    hasFaqHeading: /<h2[^>]*>\s*자주 묻는 질문/.test(html),
    jsonLd: [...html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]),
  };
});
const byPath = new Map(pages.map((p) => [p.path, p]));
const indexable = pages.filter((p) => p.indexable);

/* ---------- 막는 규칙 ---------- */
const violations = [];
const flag = (rule, key, detail = '') => violations.push({ rule, key, detail });

for (const p of indexable) {
  if (!p.title) flag('meta', `${p.path} <title> 없음`);
  if (!p.desc) flag('meta', `${p.path} meta description 없음`);
  if (p.canonical !== `${SITE}${p.path}`) flag('meta', `${p.path} canonical`, p.canonical || '(없음)');
  if (p.h1 !== 1) flag('meta', `${p.path} h1 개수`, String(p.h1));
  if (!p.ogTitle || !p.ogImage) flag('meta', `${p.path} og:title 또는 og:image 없음`);
}
for (const [field, rule] of [['title', 'unique-title'], ['desc', 'unique-desc']]) {
  const groups = new Map();
  for (const p of indexable) if (p[field]) groups.set(p[field], [...(groups.get(p[field]) || []), p.path]);
  for (const [value, paths] of groups) if (paths.length > 1) flag(rule, value, paths.join(', '));
}
const inbound = new Map();
for (const p of pages) for (const l of p.links) if (l !== p.path) inbound.set(l, (inbound.get(l) || new Set()).add(p.path));
for (const p of indexable) if (p.path !== '/' && !inbound.has(p.path)) flag('orphan', p.path);

const sitemapFile = path.join(DIST, 'sitemap.xml');
const inSitemap = new Set(fs.existsSync(sitemapFile) ? [...fs.readFileSync(sitemapFile, 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => norm(new URL(m[1]).pathname)) : []);
for (const u of inSitemap) { const p = byPath.get(u); if (!p) flag('sitemap', `${u} 사이트맵에 있는데 빌드 안 됨`); else if (!p.indexable) flag('sitemap', `${u} 사이트맵에 있는데 noindex`); }
for (const p of indexable) if (!inSitemap.has(p.path)) flag('sitemap', `${p.path} 색인 페이지인데 사이트맵에 없음`);

const isBlogPost = (p) => /^\/blog\/[^/]+\/$/.test(p);
for (const p of pages) {
  const types = new Set();
  p.jsonLd.forEach((block, i) => {
    try { const j = JSON.parse(block); (function collect(n) { if (Array.isArray(n)) return n.forEach(collect); if (!n || typeof n !== 'object') return; const t = n['@type']; if (t) (Array.isArray(t) ? t : [t]).forEach((x) => types.add(x)); for (const k of Object.keys(n)) if (k !== '@type') collect(n[k]); })(j); }
    catch (e) { flag('json-ld', `${p.path} 블록 ${i + 1} 파싱 실패`, e.message); }
    if (/"(aggregateRating|reviewRating)"|"@type"\s*:\s*"Review"/.test(block)) flag('json-ld', `${p.path} 별점·리뷰 마크업`);
  });
  if (!p.indexable) continue;
  if (isBlogPost(p.path) && !types.has('BlogPosting')) flag('json-ld', `${p.path} BlogPosting 없음`);
  if (p.hasFaqHeading && !types.has('FAQPage')) flag('json-ld', `${p.path} "자주 묻는 질문" 섹션이 있는데 FAQPage 없음`);
}

// 카피 규칙 — 화면에 보이는 글자만(태그 제거). 부정문("…하지 않습니다")은 통과.
const COPY = [
  [/90\s*일\s*(실행\s*)?플랜/, '"90일 실행 플랜" — 실행 플랜은 180일로 통일(CLAUDE.md §1)'],
  [/(1위|상위\s*노출|노출|순위)\s*(를|을)?\s*(100%\s*)?보장/, '노출·순위 보장 주장'],
  [/무조건\s*(1위|상위)/, '"무조건 1위" 류 주장'],
];
const NEG = /(않|없|아닙|못|금지|지\s*마)/;
const sentences = (t) => t.split(/\n|(?<=[.!?。])\s+/).map((x) => x.trim()).filter(Boolean);
for (const p of indexable) {
  const ss = sentences(p.text);
  for (const [re, what] of COPY) { const hit = ss.find((s) => re.test(s) && !NEG.test(s)); if (hit) flag('copy', `${p.path}: ${what}`, `"${hit.slice(0, 120)}"`); }
}

// 블로그 원고 규격 — dist 가 아니라 원고(content/blog/*.md)를 본다. 루틴이 발행 직전에 돌리는 검사가 이것이다.
const BLOG = path.join(ROOT, 'content', 'blog');
const blogIssues = [];
if (fs.existsSync(BLOG)) for (const f of fs.readdirSync(BLOG).filter((x) => x.endsWith('.md'))) {
  const src = fs.readFileSync(path.join(BLOG, f), 'utf8');
  const fm = (src.match(/^---\n([\s\S]*?)\n---/) || [])[1] || '';
  const get = (k) => ((fm.match(new RegExp(`^${k}:\\s*(.*)$`, 'm')) || [])[1] || '').trim().replace(/^"(.*)"$/, '$1');
  const body = src.replace(/^---\n[\s\S]*?\n---/, '');
  const key = `content/blog/${f}`;
  const desc = get('description'); const sum = get('summary'); const slug = get('slug');
  if (!desc) flag('blog', `${key} description 없음`); else if (desc.length > 155) flag('blog', `${key} description ${desc.length}자 (155 초과)`);
  if (!get('keywords')) flag('blog', `${key} keywords 없음`);
  if (!slug) flag('blog', `${key} slug 없음`);
  const parts = sum ? sum.split(' | ').map((s) => s.trim()) : [];
  if (!sum) flag('blog', `${key} summary 없음`);
  else if (parts.length !== 3) flag('blog', `${key} summary 가 ${parts.length}문장 (정확히 3)`);
  else if (parts.some((s) => s.length > 70)) flag('blog', `${key} summary 문장 70자 초과`, parts.find((s) => s.length > 70).slice(0, 60));
  if (!/^## 자주 묻는 질문\s*$/m.test(body)) flag('blog', `${key} "## 자주 묻는 질문" 섹션 없음`);
  else { const after = body.split(/^## 자주 묻는 질문\s*$/m)[1] || ''; const qs = (after.match(/^### /gm) || []).length; if (qs < 3) flag('blog', `${key} FAQ 질문 ${qs}개 (3 이상)`); }
  const chars = body.replace(/\s+/g, '').replace(/!\[[^\]]*\]\([^)]*\)/g, '').length;
  if (chars < 1800) flag('blog', `${key} 본문 ${chars}자 (1,800 이상)`);
  blogIssues.push({ f, chars, parts: parts.length });
}

// llms.txt — 서비스·패키지 페이지는 전부 들어 있어야 한다(둘 다 services.json 에서 나온다)
const llmsFile = path.join(DIST, 'llms.txt');
if (fs.existsSync(llmsFile)) {
  const llms = fs.readFileSync(llmsFile, 'utf8');
  for (const p of indexable) if (/^\/(service|package)\/[^/]+\/$/.test(p.path) && !llms.includes(`${SITE}${p.path}`)) flag('llms', `${p.path} 가 llms.txt 에 없음`);
} else flag('llms', 'dist/llms.txt 없음');

// seo/keyword-map.yaml — 모양이 고정된 파일이라 YAML 라이브러리 없이 패턴으로 읽는다(파일 머리말 참고)
const mapFile = path.join(ROOT, 'seo', 'keyword-map.yaml');
const owners = new Map(); const clusters = []; // {id, keywords[], owner}
if (fs.existsSync(mapFile)) {
  let cur = null;
  for (const raw of fs.readFileSync(mapFile, 'utf8').split('\n')) {
    const line = raw.replace(/\s+#.*$/, '');
    const id = line.match(/^\s+- id:\s*(\S+)/);
    if (id) { cur = { id: id[1], keywords: [], owner: '' }; clusters.push(cur); continue; }
    if (!cur) continue;
    const kw = line.match(/^\s+keywords:\s*\[(.*)\]\s*$/);
    if (kw) cur.keywords = kw[1].split(',').map((s) => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
    const owner = line.match(/^\s+owner:\s*(\/\S*)/);
    if (owner) { cur.owner = owner[1]; owners.set(owner[1], [...(owners.get(owner[1]) || []), cur.id]); }
    for (const m of line.matchAll(/(?:^|[\s[,:])(\/[\w/-]*\/)(?=$|[\s\],])/g)) {
      const u = m[1]; const p = byPath.get(u);
      if (!p) flag('keyword-map', `${u} (${cur.id}) 빌드 안 됨`); else if (!p.indexable) flag('keyword-map', `${u} (${cur.id}) noindex`);
    }
  }
  for (const [u, list] of owners) if (list.length > 1) flag('keyword-map', `${u} 가 묶음 ${list.length}개의 owner`, list.join(', '));
}

/* ---------- baseline ---------- */
const baseFile = path.join(ROOT, 'seo', 'check-baseline.json');
const baseline = fs.existsSync(baseFile) ? JSON.parse(fs.readFileSync(baseFile, 'utf8')) : {};
const known = new Set(Object.entries(baseline).filter(([k]) => !k.startsWith('_')).flatMap(([rule, keys]) => keys.map((k) => `${rule}\u0000${k}`)));
const seen = new Set(violations.map((v) => `${v.rule}\u0000${v.key}`));
const fresh = violations.filter((v) => !known.has(`${v.rule}\u0000${v.key}`));
const knownNow = violations.filter((v) => known.has(`${v.rule}\u0000${v.key}`));
const fixed = [...known].filter((k) => !seen.has(k)).map((k) => k.replace('\u0000', ': '));

/* ---------- 보고만 ---------- */
const longTitles = indexable.filter((p) => width(p.title) > 60);
const descOut = indexable.filter((p) => p.desc && (width(p.desc) < 80 || width(p.desc) > 320));
const weak = indexable.filter((p) => p.path !== '/' && (inbound.get(p.path) ? inbound.get(p.path).size : 0) < 3);
const noAlt = indexable.filter((p) => p.imgsNoAlt > 0);
const kwMiss = clusters.filter((c) => c.owner && byPath.get(c.owner) && c.keywords.length).filter((c) => { const p = byPath.get(c.owner); const hay = (p.title + ' ' + p.h1Text).toLowerCase().replace(/\s+/g, ''); return !c.keywords.some((k) => hay.includes(k.toLowerCase().replace(/\s+/g, ''))); });
const kwDup = (() => { const m = new Map(); for (const c of clusters) for (const k of c.keywords) m.set(k, [...(m.get(k) || []), c.id]); return [...m].filter(([, ids]) => new Set(ids).size > 1); })();
const broken = []; for (const p of indexable) for (const l of p.links) if (!byPath.has(l) && !/\.[a-z0-9]+$/i.test(l) && !/^\/(admin|api|report|a|c)\//.test(l)) broken.push(`${p.path} → ${l}`);

/* ---------- 출력 ---------- */
const group = (list) => { const m = new Map(); for (const v of list) m.set(v.rule, [...(m.get(v.rule) || []), v]); return [...m]; };
console.log(`SEO 점검: 페이지 ${pages.length}개 빌드, 색인 대상 ${indexable.length}개, 블로그 원고 ${blogIssues.length}편`);
if (fresh.length) {
  console.error(`\n✗ 막는 위반 ${fresh.length}건:`);
  for (const [rule, list] of group(fresh)) { console.error(`  ${rule} (${list.length})`); for (const v of list.slice(0, 20)) console.error(`    ${v.key}${v.detail ? `  — ${v.detail}` : ''}`); if (list.length > 20) console.error(`    … ${list.length - 20}건 더`); }
} else console.log('✓ 막는 위반 없음');
if (knownNow.length) console.log(`  (알려진 위반 ${knownNow.length}건 — seo/check-baseline.json: ${group(knownNow).map(([r, l]) => `${r} ${l.length}`).join(', ')})`);
if (fixed.length) console.log(`  고쳐짐 — seo/check-baseline.json 에서 지울 것:\n    ${fixed.join('\n    ')}`);
console.log(`\n보고만: 제목 폭 60 초과 ${longTitles.length} · 설명문 폭 80~320 밖 ${descOut.length} · 들어오는 링크 3 미만 ${weak.length} · alt 없는 이미지 있는 페이지 ${noAlt.length} · owner 제목·H1 에 키워드 없음 ${kwMiss.length} · 두 묶음에 같은 키워드 ${kwDup.length} · 사이트 안 깨진 링크 ${broken.length}`);

if (REPORT) {
  const row = (p, f) => `| ${p.path} | ${f(p)} |`;
  const out = [
    '# SEO 점검 보고서', '', `색인 페이지 ${indexable.length}개 · 블로그 원고 ${blogIssues.length}편. 막는 위반: 새 ${fresh.length}, 알려진 ${knownNow.length}.`, '',
    `## 제목 표시 폭 60 초과 (${longTitles.length})`, '', '| 페이지 | 폭: 제목 |', '|---|---|', ...longTitles.sort((a, b) => width(b.title) - width(a.title)).map((p) => row(p, (x) => `${width(x.title)}: ${x.title.replace(/\|/g, '\\|')}`)), '',
    `## 설명문 폭 80~320 밖 (${descOut.length})`, '', '| 페이지 | 폭 |', '|---|---|', ...descOut.map((p) => row(p, (x) => width(x.desc))), '',
    `## 들어오는 내부 링크 3개 미만 (${weak.length})`, '', '| 페이지 | 링크한 페이지 |', '|---|---|', ...weak.map((p) => row(p, (x) => [...(inbound.get(x.path) || [])].join(', ') || '—')), '',
    `## alt 없는 이미지 (${noAlt.length})`, '', '| 페이지 | 개수 |', '|---|---|', ...noAlt.map((p) => row(p, (x) => x.imgsNoAlt)), '',
    `## owner 페이지 제목·H1 에 묶음 키워드가 없음 (${kwMiss.length})`, '', '| 묶음 | owner | 키워드 |', '|---|---|---|', ...kwMiss.map((c) => `| ${c.id} | ${c.owner} | ${c.keywords.slice(0, 4).join(', ')} |`), '',
    `## 두 묶음에 같은 키워드 (${kwDup.length})`, '', '| 키워드 | 묶음 |', '|---|---|', ...kwDup.map(([k, ids]) => `| ${k} | ${[...new Set(ids)].join(', ')} |`), '',
    `## 사이트 안 깨진 링크 후보 (${broken.length})`, '', ...broken.map((b) => `- ${b}`), '',
  ];
  fs.writeFileSync(path.resolve(ROOT, REPORT), out.join('\n'));
  console.log(`보고서: ${REPORT}`);
}
process.exit(fresh.length ? 1 : 0);
