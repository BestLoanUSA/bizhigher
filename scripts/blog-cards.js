/**
 * 블로그 카드 그림 + 인포그래픽 확대본 (2026-11-06 David 요청 2차)
 *
 * 카드 그림 {slug}-card.jpg (800×600, 카드 크기 400×300 에서 읽히는 글자 크기로 그린다)
 *   글마다 그 글에만 있는 내용으로 만든다 — 본문의 표(모든 글에 있다)·체크리스트·제목의 숫자·"A vs B"·허브의 하위 글.
 *   판형 6종: 숫자(num) · 비교(vs) · 표(table) · 목록(list) · 체크리스트(check) · 완전 가이드(hub)
 *   색은 카테고리 포인트 한 곳(작은 표시)에만 쓴다. 지어낸 숫자 없음 — 표의 글자를 줄여 옮길 뿐
 * 인포그래픽 확대본 {이름}-zoom.jpg — 본문 인포그래픽(1200×675)에서 위 제목·아래 바닥글을 잘라내고 그림 부분만
 *   (블로그 목록의 "인포그래픽 모아보기" 칸이 쓴다)
 *
 * scripts/blog-banners.js 가 같은 브라우저로 불러 쓴다(따로 돌리지 않는다).
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const CARD_VERSION = 1;
const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const len = (s) => [...String(s)].length;
const clean = (s) => String(s || '').replace(/\*\*|__|`/g, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/<br\s*\/?>/gi, ' ').replace(/\s+/g, ' ').trim();
function cut(s, max) {
  s = clean(s);
  if (len(s) <= max) return s;
  let out = '';
  for (const w of s.split(' ')) { const n = out ? out + ' ' + w : w; if (len(n) > max - 1) break; out = n; }
  return (out && len(out) >= max * 0.5 ? out : [...s].slice(0, max - 1).join('')) + '…';
}

/* 본문에서 표·체크리스트를 꺼낸다. 표는 바로 위 제목(## 또는 ###)을 함께 */
function parseBody(body) {
  const lines = body.split('\n');
  const tables = [];
  let head = '';
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (/^#{2,3} /.test(l)) head = l.replace(/^#+\s*/, '').trim();
    if (/^\|.*\|\s*$/.test(l) && i + 1 < lines.length && /^\|\s*:?-{2,}/.test(lines[i + 1])) {
      const rows = [];
      let j = i;
      while (j < lines.length && /^\|.*\|\s*$/.test(lines[j])) { rows.push(lines[j]); j++; }
      const cells = rows.filter((r, k) => k !== 1).map((r) => r.replace(/^\||\|\s*$/g, '').split('|').map(clean));
      if (cells.length >= 3) tables.push({ head, header: cells[0], rows: cells.slice(1) });
      i = j;
    }
  }
  const checks = [...body.matchAll(/^- \[[ xX]\] (.+)$/gm)].map((m) => clean(m[1]));
  return { tables, checks };
}

function pickTable(tables) {
  const ok = tables.filter((t) => t.rows.length >= 2 && t.header.length >= 2 && t.header.length <= 5);
  return ok.sort((a, b) => score(b) - score(a))[0] || null;
  function score(t) { const avg = t.rows.flat().reduce((s, c) => s + len(c), 0) / Math.max(1, t.rows.flat().length); return Math.min(t.rows.length, 5) * 2 - Math.max(0, avg - 18) / 4 - (t.header.length > 3 ? 1 : 0); }
}

/* 판형 고르기 */
function plan(p, posts) {
  const { tables, checks } = parseBody(p.body);
  const table = pickTable(tables);
  const main = p.title.split(' — ')[0];
  const vs = main.match(/^(.+?)\s+vs\.?\s+(.+?)$/i);
  const num = p.title.match(/(\$\d[\d,]*|\d+)\s*(가지|개|단계|곳|분|편|초)/);
  const hashN = parseInt(crypto.createHash('md5').update(p.slug).digest('hex').slice(0, 6), 16);
  if (p.hub) {
    const spokes = posts.filter((x) => !x.hub && x.category === p.category).map((x) => x.title.split(' — ')[0]);
    return { kind: 'hub', spokes };
  }
  if (vs) return { kind: 'vs', a: cut(vs[1], 12), b: cut(vs[2], 12), table };
  if (num) {
    // "숫자 1: 전환 수"·"1단계 …"·"1. …" 처럼 번호 붙은 섹션이 3개 이상이면 그것이 그 숫자의 내용이다
    const numbered = p.heads.filter((h) => /^(\d+[.)]|\d+\s*단계|[가-힣A-Za-z]{1,4}\s*\d+\s*[:—–])/.test(h)).map((h) => {
      const m = h.match(/^[가-힣A-Za-z]{1,4}\s*\d+\s*[:—–]\s*(.+)$/); return (m ? m[1] : h.replace(/^(\d+[.)]|\d+\s*단계\s*[:.]?)\s*/, '')).replace(/^[—–\-:·]\s*/, '').split(/ — | – /)[0];
    });
    return numbered.length >= 3 ? { kind: 'num', n: num[1], unit: num[2], table: null, heads: numbered, cap: main } : { kind: 'num', n: num[1], unit: num[2], table, heads: p.heads };
  }
  if (table && table.header.length >= 3) return { kind: 'table', table };
  if (checks.length >= 4 && (hashN % 2 === 0 || !table)) return { kind: 'check', checks };
  if (table) return { kind: 'list', table };
  return { kind: 'check', checks: checks.length ? checks : p.heads };
}

const CARD_CSS = (cat) => `*{box-sizing:border-box;margin:0;padding:0}
:root{--bg:#FBFAF7;--ink:#0B1530;--sub:#5B6478;--hair:#E1E3EA;--c:${cat.c}}
body{width:400px;height:300px;overflow:hidden;background:var(--bg);color:var(--ink);font-family:'Noto Sans KR',sans-serif;word-break:keep-all;-webkit-font-smoothing:antialiased}
.w{position:absolute;inset:22px 24px 20px;display:flex;flex-direction:column}
.cap{display:flex;align-items:center;gap:8px;font-size:12.5px;font-weight:600;color:var(--sub);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cap:before{content:"";flex:none;width:7px;height:7px;border-radius:2px;background:var(--c)}
.serif{font-family:'Noto Serif KR',serif}
.one{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}`;

function cardHtml(p, pl, cat) {
  const css = CARD_CSS(cat);
  const capFrom = (t, fb) => esc(cut((t && t.head) || fb || '', 26));
  if (pl.kind === 'hub') {
    const s = pl.spokes.slice(0, 4);
    return `<style>${css}
.big{display:flex;align-items:baseline;gap:8px;margin-top:14px}.big b{font-size:64px;line-height:1;font-weight:700}.big span{font-size:17px;font-weight:600;color:var(--sub)}
.stack{margin-top:auto;display:flex;flex-direction:column;gap:6px}
.stack div{background:#fff;border:1px solid var(--hair);border-radius:10px;padding:8px 12px;font-size:14px;font-weight:500;box-shadow:0 1px 0 rgba(11,21,48,.03)}
.stack div:nth-child(2){margin-left:8px}.stack div:nth-child(3){margin-left:16px}.stack div:nth-child(4){margin-left:24px;opacity:.7}
</style><div class="w"><div class="cap">${esc(p.category)} 완전 가이드</div>
<div class="big"><b class="serif">${pl.spokes.length}</b><span>편을 한 번에 정리</span></div>
<div class="stack">${s.map((t) => `<div class="one">${esc(cut(t, 26))}</div>`).join('')}</div></div>`;
  }
  if (pl.kind === 'vs') {
    const t = pl.table;
    const rows = t && t.header.length >= 3 ? t.rows.slice(0, 3) : [];
    return `<style>${css}
.duo{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:10px;margin-top:16px}
.duo div{background:#fff;border:1px solid var(--hair);border-radius:12px;padding:14px 10px;text-align:center;font-size:19px;font-weight:700;line-height:1.25}
.duo i{font-family:'Noto Serif KR',serif;font-style:italic;font-size:22px;color:var(--c)}
.rows{margin-top:auto;display:flex;flex-direction:column}
.r{display:grid;grid-template-columns:1fr 1fr;gap:16px;padding:7px 2px;border-top:1px solid var(--hair);font-size:13px}
.r small{grid-column:1/3;font-size:11.5px;color:var(--sub);font-weight:600;margin-bottom:-3px}
</style><div class="w"><div class="cap">${capFrom(t, '한눈에 비교')}</div>
<div class="duo"><div>${esc(pl.a)}</div><i>vs</i><div>${esc(pl.b)}</div></div>
<div class="rows">${rows.map((r) => `<div class="r"><small class="one">${esc(cut(r[0], 24))}</small><span class="one">${esc(cut(r[1], 16))}</span><span class="one">${esc(cut(r[2], 16))}</span></div>`).join('')}</div></div>`;
  }
  if (pl.kind === 'num') {
    // 첫 칸이 번호(1, 2, 3…)뿐이면 다음 칸을 쓴다
    const col = pl.table && pl.table.rows.every((r) => /^[#\d.\s]*$/.test(r[0] || '')) ? 1 : 0;
    const items = (pl.table ? pl.table.rows.map((r) => r[col] || '') : pl.heads).filter(Boolean).slice(0, 4).map((x) => cut(x.replace(/^\d+[.)]\s*/, ''), 17));
    const big = pl.n.length >= 4 ? 54 : pl.n.length >= 3 ? 68 : 104;
    return `<style>${css}
.g{flex:1;display:grid;grid-template-columns:auto 1fr;gap:20px;align-items:center;margin-top:8px}
.n{display:flex;flex-direction:column;align-items:flex-start}.n b{font-size:${big}px;line-height:.95;font-weight:700}.n span{font-size:16px;font-weight:700;margin-top:4px;padding-top:6px;border-top:3px solid var(--c)}
ol{list-style:none;display:flex;flex-direction:column;gap:9px}
li{display:flex;gap:9px;align-items:baseline;font-size:14.5px;font-weight:500}li em{font-style:normal;font-size:12px;font-weight:700;color:var(--sub);min-width:12px}
</style><div class="w"><div class="cap">${pl.cap ? esc(cut(pl.cap, 26)) : capFrom(pl.table, p.title.split(' — ')[0])}</div>
<div class="g"><div class="n"><b class="serif">${esc(pl.n)}</b><span>${esc(pl.unit)}</span></div>
<ol>${items.map((x, i) => `<li><em>${i + 1}</em><span class="one">${esc(x)}</span></li>`).join('')}</ol></div></div>`;
  }
  if (pl.kind === 'table') {
    const t = pl.table;
    // 셋째 칸까지 넣으면 글자가 너무 잘릴 때는 두 칸만(첫 칸 + 둘째 칸)
    const avg = (k) => t.rows.slice(0, 4).reduce((n, r) => n + len(r[k] || ''), 0) / Math.min(4, t.rows.length);
    const cols = t.header.length >= 3 && avg(1) <= 9 && avg(2) <= 9 ? 3 : 2;
    const rows = t.rows.slice(0, 4);
    const w = cols === 3 ? '1.1fr 1fr 1fr' : '0.9fr 1.4fr';
    return `<style>${css}
.tb{margin-top:14px;background:#fff;border:1px solid var(--hair);border-radius:12px;overflow:hidden;flex:1;display:flex;flex-direction:column}
.tr{display:grid;grid-template-columns:${w};gap:10px;padding:0 14px;align-items:center;flex:1;border-top:1px solid var(--hair);font-size:13px}
.tr:first-child{border-top:0;flex:none;padding-top:9px;padding-bottom:8px;font-size:11.5px;font-weight:700;color:var(--sub);background:#F6F6F2}
.tr span:first-child{font-weight:600}
</style><div class="w"><div class="cap">${capFrom(t, '')}</div>
<div class="tb"><div class="tr">${t.header.slice(0, cols).map((h) => `<span class="one">${esc(cut(h, 12))}</span>`).join('')}</div>
${rows.map((r) => `<div class="tr">${r.slice(0, cols).map((c) => `<span class="one">${esc(cut(c, cols === 3 ? 11 : 20))}</span>`).join('')}</div>`).join('')}</div></div>`;
  }
  if (pl.kind === 'list') {
    const t = pl.table;
    const rows = t.rows.slice(0, 4);
    return `<style>${css}
.ls{margin-top:auto;display:flex;flex-direction:column}
.it{padding:9px 0;border-top:1px solid var(--hair)}.it:first-child{border-top:0}
.it b{display:block;font-size:15.5px;font-weight:700}.it span{display:block;font-size:12.5px;color:var(--sub);margin-top:2px}
</style><div class="w"><div class="cap">${capFrom(t, '')}</div>
<div class="ls">${rows.map((r) => `<div class="it"><b class="one">${esc(cut(r[0], 22))}</b><span class="one">${esc(cut(r[1], 30))}</span></div>`).join('')}</div></div>`;
  }
  const items = pl.checks.slice(0, 5).map((x) => cut(x, 24));
  return `<style>${css}
.ck{margin-top:auto;display:flex;flex-direction:column;gap:9px}
.ck div{display:flex;gap:11px;align-items:center;font-size:15px;font-weight:500}
.ck i{flex:none;width:18px;height:18px;border-radius:5px;border:2px solid var(--ink);position:relative}
.ck div:nth-child(-n+2) i{background:var(--ink)}
.ck div:nth-child(-n+2) i:after{content:"";position:absolute;left:4px;top:0px;width:5px;height:9px;border:solid #fff;border-width:0 2px 2px 0;transform:rotate(45deg)}
</style><div class="w"><div class="cap">점검표</div>
<div class="ck">${items.map((x) => `<div><i></i><span class="one">${esc(x)}</span></div>`).join('')}</div></div>`;
}

const cardHash = (p, pl) => crypto.createHash('sha1').update(JSON.stringify([CARD_VERSION, p.category, pl])).digest('hex').slice(0, 12);

/* 넘침 검사 — 판형 안쪽(.w)이 넘치면 알린다 */
const CARD_CHECK = `(() => { const w = document.querySelector('.w'); const bad = []; if (w && w.scrollHeight > w.clientHeight + 1) bad.push('세로 넘침'); return bad; })()`;

/* 인포그래픽 확대: 제목 블록 아래의 첫 빈 띠부터 바닥글 위까지, 잉크가 있는 범위만 */
const ZOOM_JS = `async (src) => {
  const img = new Image(); img.src = src; await img.decode();
  const W = img.naturalWidth, H = img.naturalHeight, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const cx = cv.getContext('2d'); cx.drawImage(img, 0, 0); const d = cx.getImageData(0, 0, W, H).data;
  const ink = (x, y) => { const i = (y * W + x) * 4; return (d[i] + d[i + 1] + d[i + 2]) / 3 < 205; };
  const rowInk = (y) => { let n = 0; for (let x = 40; x < W - 40; x += 3) if (ink(x, y)) n++; return n; };
  const footY = Math.round(H * 0.875);
  let y = Math.round(H * 0.13); while (y < footY && !rowInk(y)) y++;
  let gap = 0, start = y; for (; y < footY; y++) { if (!rowInk(y)) { gap++; if (gap >= 20) { start = y; break; } } else gap = 0; }
  while (start < footY && !rowInk(start)) start++;
  let end = footY; while (end > start && !rowInk(end)) end--;
  let x0 = W, x1 = 0; for (let yy = start; yy <= end; yy += 2) for (let x = 30; x < W - 30; x++) if (ink(x, yy)) { if (x < x0) x0 = x; if (x > x1) x1 = x; }
  const pad = 26; const sx = Math.max(0, x0 - pad), sy = Math.max(0, start - pad), ex = Math.min(W, x1 + pad), ey = Math.min(H, end + pad);
  if (ex - sx < W * 0.3 || ey - sy < H * 0.2) return null;
  const out = document.createElement('canvas'); out.width = ex - sx; out.height = ey - sy;
  const ox = out.getContext('2d'); ox.drawImage(cv, sx, sy, ex - sx, ey - sy, 0, 0, ex - sx, ey - sy);
  return out.toDataURL('image/jpeg', 0.9);
}`;

async function run({ browser, installFonts, posts, IMG, force, only }) {
  const MAN = path.join(IMG, 'cards.json');
  const man = fs.existsSync(MAN) ? JSON.parse(fs.readFileSync(MAN, 'utf8')) : {};
  const { CATS, DEFAULT_CAT } = require('./blog-banners.js');
  let n = 0, warn = 0;
  for (const p of posts) {
    if (only && !only.includes(p.slug)) continue;
    const pl = plan(p, posts);
    const h = cardHash(p, pl), out = path.join(IMG, `${p.slug}-card.jpg`);
    if (!force && !only && man[p.slug] === h && fs.existsSync(out)) continue;
    const page = await browser.newPage({ viewport: { width: 400, height: 300 }, deviceScaleFactor: 2 });
    const fonts = await installFonts(page, ['serif', 'sans']);
    await page.setContent(`<!doctype html><html lang="ko"><head><meta charset="utf-8">${fonts}</head><body>${cardHtml(p, pl, CATS[p.category] || DEFAULT_CAT)}</body></html>`);
    await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(120);
    const bad = await page.evaluate(CARD_CHECK);
    await page.screenshot({ path: out, type: 'jpeg', quality: 88 });
    await page.close();
    man[p.slug] = h; n++;
    if (bad.length) { warn++; console.log(`  ⚠ 카드 ${p.slug} (${pl.kind}) — ${bad.join(', ')}`); } else console.log(`  ✓ 카드 ${p.slug} (${pl.kind})`);
  }
  // 인포그래픽 확대본 — 원본 PNG 마다 1장
  const pngs = fs.readdirSync(IMG).filter((f) => f.endsWith('.png'));
  const zpage = await browser.newPage();
  await zpage.route('https://img.local/**', (route) => {
    const name = decodeURIComponent(new URL(route.request().url()).pathname.slice(1));
    if (!name) return route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>z</title>' });
    const f = path.join(IMG, path.basename(name));
    return fs.existsSync(f) ? route.fulfill({ status: 200, contentType: 'image/png', body: fs.readFileSync(f) }) : route.fulfill({ status: 404, body: '' });
  });
  await zpage.goto('https://img.local/');
  for (const f of pngs) {
    const out = path.join(IMG, f.replace(/\.png$/, '-zoom.jpg'));
    const key = 'zoom:' + f, st = fs.statSync(path.join(IMG, f));
    const h = `${CARD_VERSION}-${st.size}`;
    if (!force && man[key] === h && fs.existsSync(out)) continue;
    const data = await zpage.evaluate(`(${ZOOM_JS})('https://img.local/${encodeURIComponent(f)}')`);
    if (!data) { console.log(`  ⚠ 확대 ${f} — 그림 부분을 못 찾음(원본을 쓴다)`); continue; }
    fs.writeFileSync(out, Buffer.from(data.split(',')[1], 'base64'));
    man[key] = h; n++;
    console.log(`  ✓ 확대 ${f}`);
  }
  await zpage.close();
  for (const k of Object.keys(man)) {
    if (k.startsWith('zoom:')) { if (!fs.existsSync(path.join(IMG, k.slice(5)))) { delete man[k]; fs.rmSync(path.join(IMG, k.slice(5).replace(/\.png$/, '-zoom.jpg')), { force: true }); } }
    else if (!posts.some((p) => p.slug === k)) { delete man[k]; fs.rmSync(path.join(IMG, `${k}-card.jpg`), { force: true }); }
  }
  fs.writeFileSync(MAN, JSON.stringify(Object.fromEntries(Object.entries(man).sort()), null, 1) + '\n');
  return { n, warn };
}

module.exports = { run, plan, parseBody };
