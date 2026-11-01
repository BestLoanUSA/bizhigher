/**
 * 고객 사진 선별·크롭·보정 — 카메라로 대충 찍은 사진 여러 장에서 "쓸 만한 장면"을 뽑아 규격에 맞게 잘라 보정한다 (2026-11-01 David 요청).
 * 의존성 없음: 분석·보정 전부 Playwright(Chromium) 캔버스에서 한다. sharp 없이도 돈다.
 *
 *   analyze(browser, files)            → [{file,w,h,sharp,luma,contrast,clipHi,clipLo,color,grid,score,flags}]  (512px 축소본으로 계산)
 *   rank(items)                        → 점수 순(흐림·노출 불량은 뒤로)
 *   smartCrop(item, ratio)             → {sx,sy,sw,sh} — 주요 피사체(엣지 에너지+채도) 밀도가 높은 창. 중심 가중
 *   enhance(browser, file, opts)       → 잘라서(또는 원본 비율) 자동 레벨·화이트밸런스·룩 필터·비네트 → JPEG 저장
 *   contactSheet(browser, items, out)  → 번호·점수·플래그가 붙은 컨택트 시트(루틴이 Read 로 보고 --pick 으로 고른다)
 *
 * 룩(look)은 사이트 스타일 8종과 같은 키 — 한 고객의 사진 세트가 같은 톤으로 맞춰진다. 생성형 손질(업스케일·배경)은 sites.js prep 의 fal 경로를 그대로 쓴다.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const RATIOS = { '1:1': [1080, 1080], '9:16': [1080, 1920], '16:9': [1920, 1080], '4:3': [1600, 1200], '3:2': [1800, 1200], '1.91:1': [1200, 628], '4:5': [1080, 1350] };
/** 룩별 보정 값 — contrast(S커브 세기) · sat(채도 배수) · warm(+따뜻/−차갑게, R−B 시프트) · bright(밝기 오프셋) · vig(비네트 세기) */
const LOOKS = {
  clean: { contrast: 1.06, sat: 1.08, warm: 0, bright: 2, vig: 0.06 },
  warm: { contrast: 1.08, sat: 1.1, warm: 6, bright: 2, vig: 0.12 },
  luxe: { contrast: 1.16, sat: 0.95, warm: 4, bright: -5, vig: 0.24 },
  editorial: { contrast: 1.1, sat: 0.9, warm: 2, bright: 0, vig: 0.1 },
  bold: { contrast: 1.12, sat: 1.22, warm: 0, bright: 3, vig: 0.05 },
  soft: { contrast: 0.95, sat: 0.95, warm: 3, bright: 7, vig: 0.04 },
  mono: { contrast: 1.15, sat: 0, warm: 0, bright: 0, vig: 0.16 },
  neon: { contrast: 1.18, sat: 1.25, warm: -4, bright: -3, vig: 0.2 },
  none: { contrast: 1, sat: 1, warm: 0, bright: 0, vig: 0 },
};
const GRID = 16;

async function launch() {
  const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
  const exe = process.env.PLAYWRIGHT_CHROMIUM || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
  return chromium.launch(exe ? { executablePath: exe } : {});
}
const dataUrl = (file) => { const ext = path.extname(file).slice(1).toLowerCase(); const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg'; return `data:${mime};base64,` + fs.readFileSync(file).toString('base64'); };

/* ───────── 브라우저 안에서 도는 함수들 (문자열로 넘겨 evaluate) ───────── */
const IN_PAGE = `
const loadImg = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('이미지 로드 실패')); i.src = src; });
async function analyze(src, GRID) {
  const img = await loadImg(src); const W = img.naturalWidth, H = img.naturalHeight;
  const s = Math.min(1, 512 / Math.max(W, H)); const w = Math.max(16, Math.round(W * s)), h = Math.max(16, Math.round(H * s));
  const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.drawImage(img, 0, 0, w, h);
  const d = x.getImageData(0, 0, w, h).data; const n = w * h; const g = new Float32Array(n); const sat = new Float32Array(n);
  let luma = 0, hi = 0, lo = 0, rgM = 0, ybM = 0; const rg = new Float32Array(n), yb = new Float32Array(n);
  for (let i = 0; i < n; i++) { const r = d[i*4], gg = d[i*4+1], b = d[i*4+2]; const y = 0.299*r + 0.587*gg + 0.114*b; g[i] = y; luma += y; if (y > 248) hi++; if (y < 10) lo++;
    const mx = Math.max(r, gg, b), mn = Math.min(r, gg, b); sat[i] = mx ? (mx - mn) / mx : 0; rg[i] = r - gg; yb[i] = (r + gg) / 2 - b; rgM += rg[i]; ybM += yb[i]; }
  luma /= n; rgM /= n; ybM /= n;
  let v = 0, rgV = 0, ybV = 0; for (let i = 0; i < n; i++) { v += (g[i] - luma) ** 2; rgV += (rg[i] - rgM) ** 2; ybV += (yb[i] - ybM) ** 2; }
  const contrast = Math.sqrt(v / n); const color = Math.sqrt(rgV / n + ybV / n) + 0.3 * Math.sqrt(rgM * rgM + ybM * ybM);
  // 라플라시안 (선명도) + 격자 에너지
  const lap = new Float32Array(n); let lm = 0;
  for (let yy = 1; yy < h - 1; yy++) for (let xx = 1; xx < w - 1; xx++) { const i = yy * w + xx; const L = 4 * g[i] - g[i-1] - g[i+1] - g[i-w] - g[i+w]; lap[i] = Math.abs(L); lm += L; }
  lm /= n; let lv = 0; for (let i = 0; i < n; i++) lv += (lap[i] - lm) ** 2; const sharp = Math.sqrt(lv / n);
  const grid = new Array(GRID * GRID).fill(0), gl = new Array(GRID * GRID).fill(0), cnt = new Array(GRID * GRID).fill(0);
  for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) { const i = yy * w + xx; const gi = Math.min(GRID - 1, Math.floor(yy / h * GRID)) * GRID + Math.min(GRID - 1, Math.floor(xx / w * GRID)); grid[gi] += lap[i] * (0.6 + sat[i]); gl[gi] += g[i]; cnt[gi]++; }
  for (let i = 0; i < grid.length; i++) { grid[i] = cnt[i] ? grid[i] / cnt[i] : 0; gl[i] = cnt[i] ? gl[i] / cnt[i] : 0; }
  return { w: W, h: H, sharp, luma, contrast, clipHi: hi / n, clipLo: lo / n, color, grid, gridLuma: gl };
}
async function enhance(src, o) {
  const img = await loadImg(src); const W = img.naturalWidth, H = img.naturalHeight;
  const r = o.rect || { sx: 0, sy: 0, sw: W, sh: H };
  let tw = o.w, th = o.h; if (!tw || !th) { const sc = Math.min(1, (o.max || 2000) / Math.max(r.sw, r.sh)); tw = Math.round(r.sw * sc); th = Math.round(r.sh * sc); }
  const c = document.createElement('canvas'); c.width = tw; c.height = th; const x = c.getContext('2d'); x.imageSmoothingQuality = 'high';
  x.drawImage(img, r.sx, r.sy, r.sw, r.sh, 0, 0, tw, th);
  const id = x.getImageData(0, 0, tw, th); const d = id.data; const n = tw * th; const L = o.look;
  // 1) 자동 레벨: 채널별 0.4%·99.6% 백분위를 0·255 로 (히스토그램)
  const hist = [new Uint32Array(256), new Uint32Array(256), new Uint32Array(256)];
  for (let i = 0; i < n; i++) { hist[0][d[i*4]]++; hist[1][d[i*4+1]]++; hist[2][d[i*4+2]]++; }
  const pct = (hh, p) => { let acc = 0; const t = n * p; for (let v = 0; v < 256; v++) { acc += hh[v]; if (acc >= t) return v; } return 255; };
  const lo = hist.map((hh) => pct(hh, 0.004)), hi = hist.map((hh) => pct(hh, 0.996));
  // 2) 그레이 월드 화이트밸런스(중간톤만, 50% 만 반영, ±12% 한도)
  let mr = 0, mg = 0, mb = 0, mc = 0; for (let i = 0; i < n; i += 7) { const y = 0.299*d[i*4] + 0.587*d[i*4+1] + 0.114*d[i*4+2]; if (y > 40 && y < 215) { mr += d[i*4]; mg += d[i*4+1]; mb += d[i*4+2]; mc++; } }
  if (mc) { mr /= mc; mg /= mc; mb /= mc; } const avg = (mr + mg + mb) / 3 || 1;
  const gain = [mr, mg, mb].map((m) => Math.min(1.12, Math.max(0.88, 1 + ((avg / (m || 1)) - 1) * (o.wb == null ? 0.5 : o.wb))));
  // 3) LUT: 레벨 → 게인 → 밝기 → S커브(대비) → 따뜻함
  const lut = [0, 1, 2].map((ch) => { const t = new Uint8ClampedArray(256); for (let v = 0; v < 256; v++) {
    let u = (v - lo[ch]) / Math.max(1, hi[ch] - lo[ch]); u = Math.min(1, Math.max(0, u)) * (o.levels === false ? 0 : 1) + (o.levels === false ? v / 255 : 0);
    u = Math.min(1, Math.max(0, u * gain[ch] + (L.bright || 0) / 255));
    const k = L.contrast || 1; u = u < 0.5 ? 0.5 * Math.pow(2 * u, k) : 1 - 0.5 * Math.pow(2 * (1 - u), k);
    u += (ch === 0 ? 1 : ch === 2 ? -1 : 0) * (L.warm || 0) / 255;
    t[v] = Math.round(Math.min(1, Math.max(0, u)) * 255); } return t; });
  const cx = tw / 2, cy = th / 2, rad = Math.sqrt(cx * cx + cy * cy); const vig = L.vig || 0, satK = L.sat == null ? 1 : L.sat;
  for (let i = 0; i < n; i++) { let r = lut[0][d[i*4]], g = lut[1][d[i*4+1]], b = lut[2][d[i*4+2]];
    if (satK !== 1) { const y = 0.299*r + 0.587*g + 0.114*b; r = y + (r - y) * satK; g = y + (g - y) * satK; b = y + (b - y) * satK; }
    if (vig) { const px = (i % tw) - cx, py = Math.floor(i / tw) - cy; const dd = Math.sqrt(px*px + py*py) / rad; const f = 1 - vig * Math.pow(Math.max(0, dd - 0.35) / 0.65, 2); r *= f; g *= f; b *= f; }
    d[i*4] = r; d[i*4+1] = g; d[i*4+2] = b; }
  x.putImageData(id, 0, 0);
  return c.toDataURL('image/jpeg', o.quality || 0.88);
}
`;

async function withPage(browser, fn) { const page = await browser.newPage(); try { await page.setContent('<html><body></body></html>'); await page.addScriptTag({ content: IN_PAGE }); return await fn(page); } finally { await page.close(); } }

/** 지표 → 점수·플래그. 100점 만점, 흐림·노출·해상도·색 */
function scoreOf(m) {
  const flags = []; const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  // 연속 점수 — 선명도 35 · 노출 25 · 대비 15 · 해상도 15 · 색 10 (사진끼리 순위가 갈리도록 문턱이 아니라 비율로)
  const sharpN = clamp(m.sharp / 70); const sSharp = sharpN * 35; if (sharpN < 0.4) flags.push('흐림'); else if (sharpN < 0.6) flags.push('선명도 보통');
  const sExpo = clamp(1 - Math.abs(m.luma - 125) / 70) * 25; if (m.luma < 70) flags.push('어두움'); else if (m.luma > 185) flags.push('과노출');
  let sCon = clamp(m.contrast / 55) * 15; if (m.contrast < 32) flags.push('밋밋함');
  if (m.clipHi > 0.08) { sCon -= 6; flags.push('하이라이트 날아감'); }
  if (m.clipLo > 0.3) { sCon -= 6; flags.push('암부 뭉침'); }
  const short = Math.min(m.w, m.h); const sRes = clamp((short - 500) / 1100) * 15; if (short < 900) flags.push('저해상도 ' + short + 'px');
  const sCol = clamp(m.color / 40) * 10; if (m.color < 12) flags.push('색이 적음');
  const ar = m.w / m.h; let pen = 0; if (ar > 2.3 || ar < 1 / 2.3) { pen = 5; flags.push('극단적 비율'); }
  // 화면 전체가 빽빽한 사진(격자 에너지 평균 높고 분산 낮음)은 주 피사체가 없어 보인다
  if (m.grid && m.grid.length) { const mean = m.grid.reduce((a, b) => a + b, 0) / m.grid.length; const vr = Math.sqrt(m.grid.reduce((a, b) => a + (b - mean) ** 2, 0) / m.grid.length); if (mean > 18 && vr / mean < 0.45) { pen += 6; flags.push('빽빽함(주 피사체 불분명)'); } }
  const score = Math.round(clamp(sSharp + sExpo + sCon + sRes + sCol - pen, 0, 100));
  return { score, flags, parts: { sharp: Math.round(sSharp), expo: Math.round(sExpo), contrast: Math.round(sCon), res: Math.round(sRes), color: Math.round(sCol) } };
}

async function analyze(browser, files) {
  return withPage(browser, async (page) => {
    const out = [];
    for (const file of files) {
      try { const m = await page.evaluate(([src, G]) => analyze(src, G), [dataUrl(file), GRID]); out.push({ file, ...m, ...scoreOf(m) }); }
      catch (e) { out.push({ file, error: e.message, score: 0, flags: ['읽기 실패'] }); }
    }
    return out;
  });
}
function rank(items) { return [...items].sort((a, b) => b.score - a.score || (b.sharp || 0) - (a.sharp || 0)); }

/** 주요 피사체 창 — 격자 에너지 밀도 최대 + 중심 가중 + 큰 창 선호. ratio '1:1'|'9:16'|… 또는 숫자(w/h). 'orig' 면 전체 */
function smartCrop(item, ratio, { focus } = {}) {
  const W = item.w, H = item.h; if (!ratio || ratio === 'orig' || !item.grid) return { sx: 0, sy: 0, sw: W, sh: H };
  const fx = focus ? focus[0] - 0.5 : 0, fy = focus ? focus[1] - 0.5 : 0; // --focus 0.5,0.3 처럼 "이 근처를 중심으로" (0~1)
  const r = typeof ratio === 'number' ? ratio : (RATIOS[ratio] ? RATIOS[ratio][0] / RATIOS[ratio][1] : (() => { const [a, b] = String(ratio).split(':').map(Number); return a && b ? a / b : W / H; })());
  const full = W / H >= r ? { w: H * r, h: H } : { w: W, h: W / r };
  const cell = (gx, gy) => item.grid[Math.min(GRID - 1, gy) * GRID + Math.min(GRID - 1, gx)];
  const total = item.grid.reduce((a, b) => a + b, 0) / (GRID * GRID) || 1;
  let best = null;
  for (const s of [1, 0.92, 0.84, 0.76, 0.68, 0.6]) {
    const cw = full.w * s, ch = full.h * s; const steps = 12;
    for (let i = 0; i <= steps; i++) for (let j = 0; j <= steps; j++) {
      const sx = (W - cw) * i / steps, sy = (H - ch) * j / steps;
      const gx0 = sx / W * GRID, gy0 = sy / H * GRID, gx1 = (sx + cw) / W * GRID, gy1 = (sy + ch) / H * GRID;
      let e = 0, c = 0;
      for (let gy = Math.floor(gy0); gy < Math.ceil(gy1); gy++) for (let gx = Math.floor(gx0); gx < Math.ceil(gx1); gx++) { const wx = Math.min(gx + 1, gx1) - Math.max(gx, gx0), wy = Math.min(gy + 1, gy1) - Math.max(gy, gy0); const wgt = Math.max(0, wx) * Math.max(0, wy); e += cell(gx, gy) * wgt; c += wgt; }
      const density = c ? e / c / total : 0;
      const ccx = (sx + cw / 2) / W - 0.5 - fx, ccy = (sy + ch / 2) / H - 0.5 - fy; const center = 1 - (focus ? 0.6 : 0.25) * Math.sqrt(ccx * ccx + ccy * ccy) * 2;
      const v = density * (0.62 + 0.38 * s) * center;
      if (!best || v > best.v) best = { v, sx: Math.round(sx), sy: Math.round(sy), sw: Math.round(cw), sh: Math.round(ch) };
    }
  }
  return best;
}

/** 보정 저장. opts: { ratio|rect, w,h (없으면 비율 유지, max 2000px), look, out, quality, wb, levels } */
async function enhance(browser, file, opts = {}) {
  const look = LOOKS[opts.look] || LOOKS.clean;
  let rect = opts.rect || null, w = opts.w, h = opts.h;
  if (!rect && opts.ratio && opts.ratio !== 'orig') { const item = opts.item || (await analyze(browser, [file]))[0]; rect = smartCrop(item, opts.ratio, { focus: opts.focus }); if (!w && RATIOS[opts.ratio]) [w, h] = RATIOS[opts.ratio]; }
  const url = await withPage(browser, (page) => page.evaluate(([src, o]) => enhance(src, o), [dataUrl(file), { rect, w, h, look, max: opts.max || 2000, quality: opts.quality || 0.88, wb: opts.wb, levels: opts.levels }]));
  const buf = Buffer.from(url.split(',')[1], 'base64'); fs.mkdirSync(path.dirname(opts.out), { recursive: true }); fs.writeFileSync(opts.out, buf);
  return { out: opts.out, rect, bytes: buf.length };
}

/** 컨택트 시트 — 4열, 번호·점수·플래그·크기. 루틴이 보고 고른다 */
async function contactSheet(browser, items, out, { cols = 4, title = '' } = {}) {
  const cards = items.map((it, i) => `<div class="c"><div class="im"><img src="${dataUrl(it.file)}"><span class="n">${i + 1}</span><span class="s ${it.score >= 70 ? 'g' : it.score >= 45 ? 'y' : 'r'}">${it.score}</span></div><div class="t">${path.basename(it.file)} · ${it.w}×${it.h}${it.flags && it.flags.length ? ' · <b>' + it.flags.join(', ') + '</b>' : ' · 양호'}</div></div>`).join('');
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0;background:#EEF0F4;font-family:system-ui,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;padding:24px}h1{font-size:22px;margin:0 0 14px}.g{display:grid;grid-template-columns:repeat(${cols},1fr);gap:14px}.c{background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 2px 10px rgba(0,0,0,.08)}.im{position:relative;aspect-ratio:4/3;background:#111}.im img{width:100%;height:100%;object-fit:contain;display:block}.n{position:absolute;left:8px;top:8px;background:#111;color:#fff;font-weight:800;font-size:22px;padding:2px 10px;border-radius:8px}.s{position:absolute;right:8px;top:8px;color:#fff;font-weight:800;font-size:16px;padding:3px 9px;border-radius:8px}.s.g{background:#0B9E58}.s.y{background:#D98E04}.s.r{background:#D3382F}.t{font-size:12px;color:#333;padding:8px 10px;line-height:1.4}</style></head><body><h1>${title || '사진 컨택트 시트'} — 점수는 선명도·노출·해상도·색 기준(초록 70+ 바로 사용, 노랑 45+ 보정 후 사용, 빨강 제외 권장)</h1><div class="g">${cards}</div></body></html>`;
  const page = await browser.newPage(); await page.setViewportSize({ width: 1400, height: 900 }); await page.setContent(html); await page.waitForTimeout(300);
  await page.screenshot({ path: out, type: 'jpeg', quality: 80, fullPage: true }); await page.close(); return out;
}

module.exports = { launch, analyze, rank, scoreOf, smartCrop, enhance, contactSheet, LOOKS, RATIOS, GRID };
