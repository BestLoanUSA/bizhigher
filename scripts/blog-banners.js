#!/usr/bin/env node
/**
 * 블로그 "한눈에 보기" 배너 — 글마다 1장 (2026-11-06 David 요청)
 *
 *   node scripts/blog-banners.js            → 새 글·바뀐 글만 다시 만든다(content/blog/img/overview.json 의 해시로 판단)
 *   node scripts/blog-banners.js --force    → 전부 다시
 *   node scripts/blog-banners.js --only slug[,slug2]
 *
 * 재료는 글에 이미 있는 것만 쓴다 — 제목, front matter summary 3문장, ## 섹션 제목(읽는 순서), 카테고리.
 * 숫자·사례를 지어내지 않는다(design/infographic-templates/README.md 의 숫자 규칙과 같다).
 *
 * 한 글에 파일 3개 (content/blog/img/ → 빌드가 /blog-img/ 로 복사):
 *   {slug}-overview.jpg    1200×675  글 상단 배너(데스크톱)·OG 와 같은 비율
 *   {slug}-overview-m.jpg  1080×1350 휴대폰용 세로판 — 가로판을 폰 폭으로 줄이면 글자가 6px 가 돼서 따로 만든다
 *   {slug}-overview-t.jpg  720×405   블로그 카드 썸네일
 *
 * Playwright + automation/ai-runner/_fonts.js(Noto Serif/Sans KR 을 내려받아 직접 서빙) 로 굽는다.
 * GitHub Actions(og.yml)가 main push 때 돌려서 새 글에는 배너가 저절로 붙는다.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const BLOG = path.join(ROOT, 'content', 'blog');
const IMG = path.join(BLOG, 'img');
const MANIFEST = path.join(IMG, 'overview.json');
const VERSION = 1; // 디자인을 바꾸면 올린다 → 전부 다시 굽는다
const args = process.argv.slice(2);
const FORCE = args.includes('--force');
const ONLY = (() => { const i = args.indexOf('--only'); return i > -1 && args[i + 1] ? args[i + 1].split(',') : null; })();

/* 카테고리마다 색과 아이콘 하나 — 카드와 배너가 같은 값을 쓴다(build.js 도 이 표를 읽는다) */
const CATS = {
  '구글 노출': { c: '#0A4DF5', t: '#E8EEFF', icon: 'pin' },
  '리뷰·평판': { c: '#A15C07', t: '#FBF0D9', icon: 'star' },
  '광고': { c: '#BE185D', t: '#FCE7F1', icon: 'megaphone' },
  '웹사이트': { c: '#0E7490', t: '#DFF3F7', icon: 'browser' },
  'AI 검색': { c: '#6D28D9', t: '#EFE8FD', icon: 'spark' },
  '콘텐츠·SNS': { c: '#15803D', t: '#E3F3E8', icon: 'image' },
};
const DEFAULT_CAT = { c: '#0A4DF5', t: '#E8EEFF', icon: 'pin' };
const ICONS = {
  pin: '<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.6"/>',
  star: '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.8z"/>',
  megaphone: '<path d="M4 10v4h3l7 4V6L7 10H4z"/><path d="M17.5 9a4 4 0 0 1 0 6"/><path d="M7 14l1.2 5h2.3L9.6 14.6"/>',
  browser: '<rect x="3" y="4.5" width="18" height="15" rx="2.2"/><path d="M3 9h18"/><circle cx="6.2" cy="6.8" r=".6"/><circle cx="8.4" cy="6.8" r=".6"/><path d="M7 13h6M7 16h9"/>',
  spark: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M18.5 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z"/>',
  image: '<rect x="3" y="4.5" width="18" height="15" rx="2.2"/><circle cx="8.5" cy="9.5" r="1.8"/><path d="M21 16l-5-5-8 8.5"/>',
};
const icon = (k, size, stroke = 1.6) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[k] || ICONS.pin}</svg>`;

const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function loadPosts() {
  return fs.readdirSync(BLOG).filter((f) => f.endsWith('.md')).map((f) => {
    const raw = fs.readFileSync(path.join(BLOG, f), 'utf8');
    const m = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (!m) return null;
    const meta = {};
    m[1].split('\n').forEach((l) => { const i = l.indexOf(':'); if (i > 0) meta[l.slice(0, i).trim()] = l.slice(i + 1).trim(); });
    const body = m[2].trim();
    const heads = (body.match(/^## .+$/gm) || []).map((h) => h.slice(3).trim()).filter((h) => !/자주 묻는 질문/.test(h));
    return {
      slug: meta.slug || f.replace(/\.md$/, ''), title: meta.title || '', category: meta.category || '가이드', hub: meta.hub === 'true',
      summary: (meta.summary || '').split('|').map((x) => x.trim()).filter(Boolean).slice(0, 3),
      heads, readMin: Math.max(3, Math.round(body.replace(/[#>*|\-]/g, '').length / 600)), body,
    };
  }).filter(Boolean);
}

/* "2단계: 시트를 '질문-답' 문장으로 바꾸기" → "시트를 '질문-답' 문장으로 바꾸기" → 길면 앞부분만 */
function shortHead(h, max = 22) {
  let s = h.replace(/^\s*(\d+\s*단계\s*[:.)]?|\d+[.)]|step\s*\d+[:.]?)\s*/i, '').replace(/^[—–\-:·]\s*/, '').replace(/[?？]$/, '').trim();
  // "숫자 1: 전환 수"·"준비 2 — 리뷰 습관" 처럼 앞부분이 번호 이름뿐이면 뒷부분을 쓴다
  const parts = s.split(/ — | – |: /);
  s = (parts.length > 1 && /^[가-힣A-Za-z]{1,6}\s*\d+$/.test(parts[0].trim()) ? parts[1] : parts[0]).trim().replace(/\s*\([^)]*\)\s*$/, '');
  const len = (x) => [...x].length;
  if (len(s) <= max) return s;
  const comma = s.split(/,\s*/)[0];
  if (len(comma) >= 6 && len(comma) <= max) return comma;
  let out = '';
  for (const w of s.split(' ')) { const n = out ? out + ' ' + w : w; if (len(n) > max - 1) break; out = n; }
  return (out || [...s].slice(0, max - 1).join('')) + '…';
}
function splitTitle(t) {
  const i = t.indexOf(' — ');
  return i > 0 ? { main: t.slice(0, i), lead: t.slice(i + 3) } : { main: t, lead: '' };
}
const hashOf = (p) => crypto.createHash('sha1').update(JSON.stringify([VERSION, p.title, p.category, p.summary, p.heads, p.readMin, p.hub])).digest('hex').slice(0, 12);

/* ---------- 판형 ---------- */
const BASE = (cat) => `*{box-sizing:border-box;margin:0;padding:0}
:root{--bg:#FBFAF7;--ink:#0B1530;--sub:#556078;--hair:#DCDFE7;--c:${cat.c};--t:${cat.t}}
body{background:var(--bg);color:var(--ink);font-family:'Noto Sans KR',sans-serif;word-break:keep-all;overflow:hidden;position:relative;-webkit-font-smoothing:antialiased}
.glyph{position:absolute;color:var(--c);opacity:.07}
.chip{display:inline-flex;align-items:center;gap:10px;color:var(--c);font-weight:700}
.chip i{display:inline-flex;align-items:center;justify-content:center;border-radius:12px;background:var(--t)}
.glance{color:var(--sub);font-weight:500}
h1{font-family:'Noto Serif KR',serif;font-weight:700;letter-spacing:-.025em;line-height:1.22}
.lead{color:var(--sub);font-weight:400;line-height:1.5}
.pts{background:#fff;border:1px solid var(--hair);border-radius:20px;box-shadow:0 1px 0 rgba(11,21,48,.03),0 18px 40px -26px rgba(11,21,48,.25)}
.pt{border-left:3px solid var(--c);line-height:1.5;font-weight:500;color:var(--ink)}
.lbl{color:var(--c);font-weight:700}
.foot{position:absolute;display:flex;justify-content:space-between;align-items:center;color:#9AA1B2;font-weight:500;letter-spacing:.2em}
.foot b{color:var(--ink);font-weight:700}
.foot:before{content:"";position:absolute;left:0;right:0;top:-16px;height:1px;background:var(--hair)}`;

function landscape(p, cat) {
  const { main, lead } = splitTitle(p.title);
  const steps = p.heads.slice(0, 6).map((h) => shortHead(h, 22));
  const more = p.heads.length - steps.length;
  const big = [...main].length > 22 ? 40 : 46;
  return `<style>${BASE(cat)}
body{width:1200px;height:675px}
.glyph{right:-70px;top:-80px}
.top{position:absolute;left:72px;right:72px;top:54px;display:flex;justify-content:space-between;align-items:center}
.chip{font-size:17px}.chip i{width:38px;height:38px}
.glance{font-size:16px}
.l{position:absolute;left:72px;top:124px;width:470px}
h1{font-size:${big}px}
.lead{font-size:19px;margin-top:16px}
.pts{position:absolute;left:584px;right:72px;top:118px;padding:26px 28px 24px}
.lbl{font-size:14px;margin-bottom:14px;display:block}
.pt{font-size:19px;padding:2px 0 2px 16px}.pt+.pt{margin-top:16px}
.route{position:absolute;left:72px;right:72px;top:${470}px}
.route .lbl{margin-bottom:16px}
.rail{display:flex;position:relative}
.rail:before{content:"";position:absolute;left:6px;right:6px;top:6px;height:2px;background:linear-gradient(90deg,var(--c),var(--t))}
.st{flex:1;position:relative;padding-top:26px;padding-right:12px}
.st:before{content:"";position:absolute;left:0;top:0;width:14px;height:14px;border-radius:50%;background:#fff;border:3px solid var(--c)}
.st b{display:block;font-size:13px;color:var(--c);font-weight:700;margin-bottom:4px}
.st span{font-size:15.5px;line-height:1.38;font-weight:500;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.foot{left:72px;right:72px;bottom:30px;font-size:12px}
.lbl em{font-style:normal;color:var(--sub);font-weight:500;margin-left:6px}
</style>
<div class="glyph">${icon(cat.icon, 440, 1.2)}</div>
<div class="top"><span class="chip"><i>${icon(cat.icon, 22, 2)}</i>${esc(p.category)}${p.hub ? ' 완전 가이드' : ''}</span><span class="glance">한눈에 보기 · ${p.readMin}분 읽기</span></div>
<div class="l"><h1>${esc(main)}</h1>${lead ? `<p class="lead">${esc(lead)}</p>` : ''}</div>
<div class="pts"><span class="lbl">이 글의 핵심</span>${p.summary.map((s) => `<p class="pt">${esc(s)}</p>`).join('')}</div>
${steps.length >= 3 ? `<div class="route"><span class="lbl">읽는 순서${more > 0 ? ` <em>외 ${more}개 섹션</em>` : ''}</span><div class="rail">${steps.map((s, i) => `<div class="st"><b>${i + 1}</b><span>${esc(s)}</span></div>`).join('')}</div></div>` : ''}
<div class="foot"><b>BIZHIGHER</b><span>BIZHIGHER.COM/BLOG</span></div>`;
}

function portrait(p, cat) {
  const { main, lead } = splitTitle(p.title);
  const steps = p.heads.slice(0, 7).map((h) => shortHead(h, 26));
  const more = p.heads.length - steps.length;
  return `<style>${BASE(cat)}
body{width:540px;height:675px}
.glyph{right:-60px;top:-50px}
.col{position:absolute;inset:30px 28px 56px;display:flex;flex-direction:column}
.top{display:flex;justify-content:space-between;align-items:center}
.chip{font-size:14px;gap:8px}.chip i{width:30px;height:30px;border-radius:9px}
.glance{font-size:12.5px}
.l{margin-top:22px;padding:0 4px}
h1{font-size:${[...main].length > 20 ? 27 : 30}px}
.lead{font-size:14.5px;margin-top:8px}
.pts{margin-top:20px;padding:16px 18px;border-radius:16px}
.lbl{font-size:12px;margin-bottom:9px;display:block}
.pt{font-size:15.5px;padding:1px 0 1px 12px}.pt+.pt{margin-top:10px}
.route{margin-top:auto;padding:0 4px}
.route .lbl{margin-bottom:6px}
.lbl em{font-style:normal;color:var(--sub);font-weight:500;margin-left:6px}
.rail{display:flex;flex-direction:column;border-left:2px solid var(--t);margin-left:5px}
.st{display:flex;gap:10px;align-items:baseline;font-size:14px;font-weight:500;padding:3px 0 3px 12px;position:relative}
.st:before{content:"";position:absolute;left:-6px;top:10px;width:8px;height:8px;border-radius:50%;background:#fff;border:2px solid var(--c)}
.st b{color:var(--c);font-size:12px;min-width:10px}
.foot{left:32px;right:32px;bottom:20px;font-size:10px}
.foot:before{top:-10px}
</style>
<div class="glyph">${icon(cat.icon, 300, 1.2)}</div>
<div class="col">
<div class="top"><span class="chip"><i>${icon(cat.icon, 17, 2)}</i>${esc(p.category)}${p.hub ? ' 완전 가이드' : ''}</span><span class="glance">한눈에 보기 · ${p.readMin}분</span></div>
<div class="l"><h1>${esc(main)}</h1>${lead ? `<p class="lead">${esc(lead)}</p>` : ''}</div>
<div class="pts"><span class="lbl">이 글의 핵심</span>${p.summary.map((s) => `<p class="pt">${esc(s)}</p>`).join('')}</div>
${steps.length >= 3 ? `<div class="route"><span class="lbl">읽는 순서${more > 0 ? ` <em>외 ${more}개</em>` : ''}</span><div class="rail">${steps.map((s, i) => `<div class="st"><b>${i + 1}</b><span>${esc(s)}</span></div>`).join('')}</div></div>` : ''}
</div>
<div class="foot"><b>BIZHIGHER</b><span>BIZHIGHER.COM</span></div>`;
}

/* 겹침·넘침 검사 — 핵심 박스가 읽는 순서와 겹치거나 화면 밖으로 나가면 실패로 알린다 */
const OVERLAP_CHECK = `(() => {
  const r = (s) => { const e = document.querySelector(s); return e ? e.getBoundingClientRect() : null; };
  const pts = r('.pts'), route = r('.route'), l = r('.l'), foot = r('.foot');
  const H = document.body.clientHeight, W = document.body.clientWidth, bad = [];
  if (pts && route && pts.bottom > route.top - 8) bad.push('핵심 박스가 읽는 순서와 겹침');
  if (l && pts && l.bottom > pts.top - 6 && l.right > pts.left) bad.push('제목이 핵심 박스와 겹침');
  const col = document.querySelector('.col'); if (col && col.scrollHeight > col.clientHeight + 1) bad.push('세로판 내용이 넘침');
  if (l && route && l.bottom > route.top - 8) bad.push('제목이 읽는 순서와 겹침');
  if (route && foot && route.bottom > foot.top - 20) bad.push('읽는 순서가 바닥글과 겹침');
  for (const e of document.querySelectorAll('h1,.pt,.st span')) { const b = e.getBoundingClientRect(); if (b.right > W + 1 || b.bottom > H + 1) bad.push('화면 밖: ' + e.textContent.slice(0, 20)); }
  return bad;
})()`;

async function main() {
  const all = loadPosts();
  const posts = all.filter((p) => !ONLY || ONLY.includes(p.slug));
  const manifest = fs.existsSync(MANIFEST) ? JSON.parse(fs.readFileSync(MANIFEST, 'utf8')) : {};
  const todo = posts.filter((p) => {
    if (p.summary.length < 2) { console.log(`  · ${p.slug} — summary 가 없어 건너뜀`); return false; }
    const files = ['', '-m', '-t'].map((s) => path.join(IMG, `${p.slug}-overview${s}.jpg`));
    return FORCE || ONLY || manifest[p.slug] !== hashOf(p) || files.some((f) => !fs.existsSync(f));
  });
  let chromium;
  try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require(process.env.PLAYWRIGHT_PATH || '/opt/node-tools/node_modules/playwright')); }
  const { installFonts } = require(path.join(ROOT, 'automation', 'ai-runner', '_fonts.js'));
  const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined });
  const shoot = async (html, w, h, dsf, out) => {
    const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: dsf });
    const fonts = await installFonts(page, ['serif', 'sans']);
    await page.setContent(`<!doctype html><html lang="ko"><head><meta charset="utf-8">${fonts}</head><body>${html}</body></html>`);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(150);
    const bad = await page.evaluate(OVERLAP_CHECK);
    await page.screenshot({ path: out, type: 'jpeg', quality: 86 });
    await page.close();
    return bad;
  };
  let warn = 0;
  for (const p of todo) {
    const cat = CATS[p.category] || DEFAULT_CAT;
    const base = path.join(IMG, `${p.slug}-overview`);
    const b1 = await shoot(landscape(p, cat), 1200, 675, 1, base + '.jpg');
    const b2 = await shoot(portrait(p, cat), 540, 675, 2, base + '-m.jpg');
    await shoot(landscape(p, cat), 1200, 675, 0.6, base + '-t.jpg');
    const bad = [...b1.map((x) => '가로: ' + x), ...b2.map((x) => '세로: ' + x)];
    if (bad.length) { warn++; console.log(`  ⚠ ${p.slug} — ${bad.join(' / ')}`); } else console.log(`  ✓ ${p.slug}`);
    manifest[p.slug] = hashOf(p);
  }
  // 카드 그림·인포그래픽 확대본(scripts/blog-cards.js) — 같은 브라우저로
  const cards = await require('./blog-cards.js').run({ browser, installFonts, posts: all, IMG, force: FORCE, only: ONLY });
  await browser.close();
  // 지워진 글의 배너는 정리한다
  const live = new Set(loadPosts().map((p) => p.slug));
  for (const s of Object.keys(manifest)) if (!live.has(s)) { delete manifest[s]; for (const x of ['', '-m', '-t']) fs.rmSync(path.join(IMG, `${s}-overview${x}.jpg`), { force: true }); }
  fs.writeFileSync(MANIFEST, JSON.stringify(Object.fromEntries(Object.entries(manifest).sort()), null, 1) + '\n');
  console.log(`배너 ${todo.length}개${warn ? ` (겹침 경고 ${warn}개 — 위 ⚠ 를 열어 볼 것)` : ''} · 카드·확대 ${cards.n}개${cards.warn ? ` (넘침 경고 ${cards.warn}개)` : ''}`);
}

module.exports = { CATS, DEFAULT_CAT, ICONS };
if (require.main === module) main().catch((e) => { console.error('오류:', e.message); process.exit(1); });
