#!/usr/bin/env node
/**
 * OG 이미지 생성기 — 블로그 글과 데이터 리포트의 공유용 카드를 만든다.
 *
 *   node scripts/og.js          → 없는 것만 만든다
 *   node scripts/og.js --force  → 전부 다시 만든다
 *
 * 이 스크립트는 SVG만 쓴다. PNG로 굽는 것은 GitHub Actions가 rsvg-convert로 한다.
 * (페이스북·카카오·X는 SVG를 미리보기로 렌더하지 않는다. 반드시 PNG여야 한다.)
 *
 * 왜 한 판형인가: 피드에서 스크롤하는 사람이 이미지를 보고 "이 집 글이네"를 먼저
 * 알아보게 하려는 것이다. 글마다 디자인이 다르면 그 인식이 쌓이지 않는다.
 * 변하는 것은 제목·분류·숫자뿐이고, 나머지는 고정이다.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'src', 'og');
const FORCE = process.argv.includes('--force');

/* 사이트 토큰과 같은 값 (src/style.css) */
const C = {
  ground: '#081130',
  deep: '#050A1F',
  blue: '#0A4DF5',
  blue300: '#7DA2FF',
  cyan: '#22D3EE',
  mist: '#B9C4E8',
  mist4: '#8E9BC7',
};

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/* 글자폭 어림 — Noto Sans CJK 기준. 한글은 폭이 1em에 가깝고 라틴은 절반쯤이다. */
function widthOf(text, size) {
  let w = 0;
  for (const ch of text) {
    if (/[가-힣㄰-㆏一-鿿＀-￯]/.test(ch)) w += 1.0;
    else if (ch === ' ') w += 0.26;
    else if (/[.,·:;'"!?()\[\]\-—]/.test(ch)) w += 0.36;
    else if (/[iIlj1|]/.test(ch)) w += 0.3;
    else if (/[A-Z]/.test(ch)) w += 0.65;
    else w += 0.55;
  }
  return w * size;
}

/* 한글은 아무 데서나 줄을 바꿔도 되지만, 띄어쓰기가 있으면 거기서 끊는 편이 읽기 좋다. */
function wrap(text, size, maxWidth, maxLines) {
  const words = text.split(/(\s+)/).filter((x) => x !== '');
  const lines = [];
  let cur = '';
  const push = () => { if (cur.trim()) lines.push(cur.trim()); cur = ''; };
  for (const w of words) {
    const next = cur + w;
    if (widthOf(next, size) <= maxWidth) { cur = next; continue; }
    if (widthOf(w, size) > maxWidth) {
      /* 한 덩어리가 줄보다 길면 글자 단위로 쪼갠다 */
      push();
      let piece = '';
      for (const ch of w) {
        if (widthOf(piece + ch, size) > maxWidth) { lines.push(piece); piece = ''; }
        piece += ch;
      }
      cur = piece;
      continue;
    }
    push();
    cur = w.trimStart();
  }
  push();
  return maxLines ? lines.slice(0, maxLines) : lines;
}

/* 줄 수가 넘치면 글자를 줄인다. 잘라내기보다 줄이는 쪽이 낫다. */
function fitTitle(text, maxWidth, maxLines, sizes) {
  for (const size of sizes) {
    const lines = wrap(text, size, maxWidth);
    if (lines.length <= maxLines) return { size, lines };
  }
  const size = sizes[sizes.length - 1];
  return { size, lines: wrap(text, size, maxWidth, maxLines) };
}

const LOGO = (x, y, s) => `<g transform="translate(${x},${y}) scale(${s / 64})">
<rect width="64" height="64" rx="15" fill="${C.blue}"/>
<path d="M15 44 h9 v-9 h9 v-9 h6.5" stroke="#fff" stroke-width="6.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M38.5 15.5 h10 v10" stroke="#fff" stroke-width="6.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></g>`;

/**
 * 한 판형. 변하는 것은 chip(분류), title, sub, stat(숫자)뿐이다.
 * stat이 있으면 오른쪽에 숫자가 들어가고 제목 폭이 줄어든다.
 */
function card({ chip, title, sub, stat, statLabel }) {
  const PAD = 88;
  const titleMax = stat ? 640 : 1024;
  const t = fitTitle(title, titleMax, 3, [66, 58, 50, 44]);
  const lh = Math.round(t.size * 1.28);
  /* 제목 블록을 칩(위)과 구분선(아래) 사이에 가운데로 놓는다.
     화면 전체를 기준으로 하면 한 줄짜리 제목이 위로 떠 보인다. */
  const AREA_TOP = 200;
  const AREA_BOT = 520;
  const blockH = t.lines.length * lh + (sub ? 58 : 0);
  const top = AREA_TOP + Math.round((AREA_BOT - AREA_TOP - blockH) / 2) + Math.round(t.size * 0.72);
  const mid = Math.round((AREA_TOP + AREA_BOT) / 2);

  const subLines = sub ? wrap(sub, 30, titleMax, 1) : [];

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" font-family="Noto Sans CJK KR, Noto Sans KR, Pretendard, sans-serif">
<defs>
  <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="${C.ground}"/><stop offset="1" stop-color="${C.deep}"/>
  </linearGradient>
  <radialGradient id="glow" cx="0.82" cy="0.12" r="0.62">
    <stop offset="0" stop-color="${C.blue}" stop-opacity="0.42"/>
    <stop offset="1" stop-color="${C.blue}" stop-opacity="0"/>
  </radialGradient>
  <linearGradient id="rail" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="${C.blue}"/><stop offset="1" stop-color="${C.cyan}"/>
  </linearGradient>
</defs>
<rect width="1200" height="630" fill="url(#bg)"/>
<rect width="1200" height="630" fill="url(#glow)"/>
<rect width="12" height="630" fill="url(#rail)"/>

${LOGO(PAD, 54, 44)}
<text x="${PAD + 58}" y="86" font-size="30" font-weight="700" fill="#fff">BizHigher</text>

${
  chip
    ? `<rect x="${PAD}" y="118" width="${Math.round(widthOf(chip, 24) + 44)}" height="44" rx="22" fill="#ffffff" fill-opacity="0.10"/>
<text x="${PAD + 22}" y="147" font-size="24" font-weight="600" fill="${C.blue300}">${esc(chip)}</text>`
    : ''
}

${t.lines
  .map(
    (l, i) =>
      `<text x="${PAD}" y="${top + i * lh}" font-size="${t.size}" font-weight="800" fill="#ffffff" letter-spacing="-1">${esc(l)}</text>`
  )
  .join('\n')}

${subLines
  .map(
    (l) =>
      `<text x="${PAD}" y="${top + (t.lines.length - 1) * lh + 58}" font-size="30" fill="${C.mist}">${esc(l)}</text>`
  )
  .join('\n')}

${
  stat
    ? `<text x="1112" y="${mid + 44}" font-size="180" font-weight="800" fill="${C.cyan}" text-anchor="end" letter-spacing="-6">${esc(stat)}</text>
${wrap(statLabel || '', 26, 420, 2)
        .map((l, i) => `<text x="1112" y="${mid + 96 + i * 34}" font-size="26" fill="${C.mist4}" text-anchor="end">${esc(l)}</text>`)
        .join('\n')}`
    : ''
}

<line x1="${PAD}" y1="542" x2="1112" y2="542" stroke="#ffffff" stroke-opacity="0.12" stroke-width="1"/>
<text x="${PAD}" y="580" font-size="26" fill="${C.mist4}">bizhigher.com</text>
<text x="1112" y="580" font-size="26" fill="${C.mist4}" text-anchor="end">미국 한인 비즈니스 AI 마케팅</text>
</svg>`;
}

/* ---------- 소스 ---------- */

function frontMatter(raw) {
  const m = raw.match(/^---\n([\s\S]*?)\n---\n/);
  if (!m) return {};
  const meta = {};
  m[1].split('\n').forEach((l) => {
    const i = l.indexOf(':');
    if (i > 0) meta[l.slice(0, i).trim()] = l.slice(i + 1).trim();
  });
  return meta;
}

/* 제목의 "—" 앞뒤를 제목과 부제로 나눈다. 원래 그렇게 쓰고 있다. */
function splitTitle(title) {
  const i = title.indexOf('—');
  if (i > 0) return { main: title.slice(0, i).trim(), sub: title.slice(i + 1).trim() };
  return { main: title.trim(), sub: '' };
}

function items() {
  const out = [];

  const blogDir = path.join(ROOT, 'content', 'blog');
  if (fs.existsSync(blogDir)) {
    fs.readdirSync(blogDir)
      .filter((f) => f.endsWith('.md'))
      .forEach((f) => {
        const meta = frontMatter(fs.readFileSync(path.join(blogDir, f), 'utf8'));
        if (!meta.title) return;
        const { main, sub } = splitTitle(meta.title);
        out.push({ slug: meta.slug || f.replace(/\.md$/, ''), chip: meta.category || '가이드', title: main, sub });
      });
  }

  const reportDir = path.join(ROOT, 'data', 'reports');
  if (fs.existsSync(reportDir)) {
    fs.readdirSync(reportDir)
      .filter((f) => f.endsWith('.json'))
      .forEach((f) => {
        const r = JSON.parse(fs.readFileSync(path.join(reportDir, f), 'utf8'));
        const s = (r.stats || [])[0] || {};
        out.push({
          slug: r.slug,
          chip: `데이터 리포트 · ${r.quarter}`,
          title: (r.editorial && r.editorial.headline) || r.title,
          sub: '',
          stat: s.value,
          statLabel: s.label,
        });
      });
  }

  const surveyDir = path.join(ROOT, 'data', 'surveys');
  if (fs.existsSync(surveyDir)) {
    fs.readdirSync(surveyDir)
      .filter((f) => f.endsWith('.json'))
      .forEach((f) => {
        const r = JSON.parse(fs.readFileSync(path.join(surveyDir, f), 'utf8'));
        out.push({
          slug: r.slug || `korean-business-online-${r.quarter.toLowerCase()}`,
          chip: `데이터 리포트 · ${r.quarter}`,
          title: (r.editorial && r.editorial.headline) || r.title,
          sub: '',
          stat: String(r.totals.noWebsite),
          statLabel: `웹사이트 없음 (${r.totals.businesses}곳 중)`,
        });
      });
  }

  return out;
}

/* ---------- 실행 ---------- */

fs.mkdirSync(OUT, { recursive: true });
const all = items();
let made = 0;
all.forEach((it) => {
  const svg = path.join(OUT, `${it.slug}.svg`);
  const png = path.join(OUT, `${it.slug}.png`);
  if (!FORCE && fs.existsSync(png)) return;
  fs.writeFileSync(svg, card(it));
  made += 1;
  console.log('  ✓', `${it.slug}.svg`);
});
console.log(`${all.length}개 중 ${made}개 생성${made ? ' — 이제 PNG로 구워야 한다' : ' (이미 다 있음)'}`);
