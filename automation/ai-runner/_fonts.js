/**
 * 인쇄물·소재용 글꼴 — 저장소에 두지 않고 첫 실행에 내려받아 automation/fonts/ 에 캐시한다(.gitignore).
 * 세션 Chromium 은 프록시 인증서를 믿지 않아 Google Fonts 가 조용히 실패하므로(2026-10-27 확인) 파일을 page.route 로 직접 서빙한다.
 *   const { installFonts } = require('./_fonts.js'); const css = await installFonts(page, ['serif','display','sans']); → <style>${css}</style>
 * 전부 OFL: Noto Serif KR(variable) · Black Han Sans · Noto Sans KR(variable)
 */
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '../fonts');
const FONTS = {
  serif: { file: 'NotoSerifKR-VF.ttf', url: 'https://raw.githubusercontent.com/notofonts/noto-cjk/main/Serif/Variable/TTF/Subset/NotoSerifKR-VF.ttf', family: 'Noto Serif KR', weight: '200 900', google: 'Noto+Serif+KR:wght@400;600;700;900' },
  display: { file: 'BlackHanSans-Regular.ttf', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/blackhansans/BlackHanSans-Regular.ttf', family: 'Black Han Sans', weight: '400', google: 'Black+Han+Sans' },
  sans: { file: 'NotoSansKR-VF.ttf', url: 'https://raw.githubusercontent.com/notofonts/noto-cjk/main/Sans/Variable/TTF/Subset/NotoSansKR-VF.ttf', family: 'Noto Sans KR', weight: '100 900', google: 'Noto+Sans+KR:wght@400;500;700;900' },
};
/** 없으면 내려받는다. 반환: key → 파일 경로(실패하면 null) */
async function ensureFonts(keys = Object.keys(FONTS)) {
  fs.mkdirSync(DIR, { recursive: true });
  const out = {};
  for (const k of keys) {
    const f = FONTS[k]; if (!f) continue;
    const p = path.join(DIR, f.file);
    const alt = path.join(__dirname, '../video/public', f.file); // Remotion 이 이미 받아 둔 파일이 있으면 재사용
    if (!fs.existsSync(p) && fs.existsSync(alt) && fs.statSync(alt).size > 1e5) fs.copyFileSync(alt, p);
    if (!fs.existsSync(p) || fs.statSync(p).size < 1e5) {
      try { const r = await fetch(f.url); if (r.ok) { const b = Buffer.from(await r.arrayBuffer()); if (b.length > 1e5) fs.writeFileSync(p, b); } } catch {}
    }
    out[k] = fs.existsSync(p) && fs.statSync(p).size > 1e5 ? p : null;
  }
  return out;
}
/** Playwright 페이지에 글꼴을 붙인다 — 파일은 https://fonts.local/{file} 로 서빙(route), 없는 글꼴은 Google Fonts 링크로 대체. 반환: 페이지 <head> 에 넣을 HTML */
async function installFonts(page, keys = Object.keys(FONTS)) {
  const files = await ensureFonts(keys);
  await page.route('https://fonts.local/**', (route) => {
    const name = decodeURIComponent(new URL(route.request().url()).pathname.slice(1));
    const p = path.join(DIR, path.basename(name));
    if (!fs.existsSync(p)) return route.fulfill({ status: 404, body: '' });
    route.fulfill({ status: 200, body: fs.readFileSync(p), headers: { 'Content-Type': 'font/ttf', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'max-age=3600' } });
  });
  const faces = [], google = [];
  for (const k of keys) { const f = FONTS[k]; if (!f) continue; if (files[k]) faces.push(`@font-face{font-family:'${f.family}';src:url(https://fonts.local/${f.file}) format('truetype');font-weight:${f.weight};font-display:block}`); else google.push(f.google); }
  return (google.length ? `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?${google.map((g) => 'family=' + g).join('&')}&display=swap">` : '') + `<style>${faces.join('')}</style>`;
}
/** 글꼴이 실제로 올라왔는지 기다린다(최대 8초) */
async function waitFonts(page, specs) {
  await page.evaluate(async (list) => { await Promise.all(list.map((f) => document.fonts.load(f).catch(() => null))); await document.fonts.ready; }, specs);
}
module.exports = { ensureFonts, installFonts, waitFonts, FONTS, DIR };
