#!/usr/bin/env node
/**
 * 광고 소재·게시물 이미지 파이프라인 (루틴 세션용, 의존성 없음 — Playwright는 환경에 깔린 것을 쓴다)
 *
 *   node automation/ai-runner/creative.js gen --prompt "…" --out bg.jpg [--size square_hd|portrait_16_9|landscape_16_9|{w}x{h}] [--model fal-ai/flux/schnell]
 *       fal.ai 로 배경 이미지 1장 생성 (환경변수 FAL_KEY). 사람 얼굴·글자·브랜드 로고는 프롬프트에 넣지 않는다 — 글자는 compose 가 얹는다
 *   node automation/ai-runner/creative.js compose --bg bg.jpg --headline "…" [--sub "…"] [--cta "…"] [--brand "New Optix"] [--color "#0A4DF5"] [--logo logo.png] --out outdir [--name feed]
 *       1:1(1080²) · 9:16(1080×1920) · 1.91:1(1200×628) JPEG 3장을 outdir 에 쓴다. 한글은 Noto Sans KR(구글 폰트)로 조판
 *   node automation/ai-runner/creative.js upload --file a.jpg [--job 1] [--task 12] [--label "…"]
 *       관리자 API 에 올려 공개 URL(/a/…jpg) 을 받는다 (BIZHIGHER_ADMIN_URL · BIZHIGHER_ADMIN_PASSWORD)
 */
const fs = require('fs');
const path = require('path');
const args = process.argv.slice(2);
const cmd = args[0];
const opt = (k, d) => { const i = args.indexOf('--' + k); return i > -1 && args[i + 1] != null && !args[i + 1].startsWith('--') ? args[i + 1] : d; };

async function gen() {
  const key = process.env.FAL_KEY;
  if (!key) throw new Error('FAL_KEY 가 없습니다 (bizhigher 환경변수)');
  const prompt = opt('prompt'); const out = opt('out', 'bg.jpg');
  if (!prompt) throw new Error('--prompt 필요');
  const sizeArg = opt('size', 'square_hd');
  const m = /^(\d+)x(\d+)$/.exec(sizeArg);
  const image_size = m ? { width: Number(m[1]), height: Number(m[2]) } : sizeArg;
  const model = opt('model', 'fal-ai/flux/schnell');
  const res = await fetch('https://fal.run/' + model, { method: 'POST', headers: { Authorization: 'Key ' + key, 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt, image_size, num_images: 1, output_format: 'jpeg', enable_safety_checker: true }) });
  if (!res.ok) throw new Error('fal.ai ' + res.status + ': ' + (await res.text()).slice(0, 300));
  const j = await res.json();
  const img = j.images && j.images[0];
  if (!img || !img.url) throw new Error('fal.ai 응답에 이미지가 없습니다');
  const bin = Buffer.from(await (await fetch(img.url)).arrayBuffer());
  fs.writeFileSync(out, bin);
  console.log(JSON.stringify({ out, width: img.width, height: img.height, bytes: bin.length, seed: j.seed }));
}

const SIZES = { feed: [1080, 1080], story: [1080, 1920], banner: [1200, 628] };
function template({ w, h, bg, headline, sub, cta, brand, color, logo }) {
  const tall = h > w * 1.3, wide = w > h * 1.5;
  const hs = wide ? 54 : tall ? 88 : 72, ss = wide ? 26 : tall ? 38 : 32, pad = wide ? 48 : 72;
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@500;700;900&display=swap">
<style>
*{box-sizing:border-box;margin:0}body{width:${w}px;height:${h}px;overflow:hidden;font-family:'Noto Sans KR',sans-serif;color:#fff;background:#111}
.bg{position:absolute;inset:0;background:url("${bg}") center/cover no-repeat}
.sh{position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.05) 0%,rgba(0,0,0,.25) 45%,rgba(0,0,0,.78) 100%)}
.tx{position:absolute;left:${pad}px;right:${pad}px;bottom:${pad}px;display:flex;flex-direction:column;gap:${wide ? 10 : 18}px}
h1{font-size:${hs}px;font-weight:900;line-height:1.15;letter-spacing:-.02em;text-shadow:0 2px 12px rgba(0,0,0,.35);word-break:keep-all}
p{font-size:${ss}px;font-weight:500;line-height:1.4;opacity:.95;word-break:keep-all}
.cta{display:inline-block;align-self:flex-start;margin-top:${wide ? 4 : 10}px;padding:${wide ? '12px 22px' : '18px 30px'};border-radius:999px;background:${color};font-weight:700;font-size:${wide ? 22 : 30}px}
.br{position:absolute;top:${pad}px;left:${pad}px;display:flex;align-items:center;gap:14px;font-weight:700;font-size:${wide ? 24 : 30}px;text-shadow:0 1px 8px rgba(0,0,0,.4)}
.br img{height:${wide ? 44 : 64}px;width:auto;border-radius:12px;background:#fff;padding:6px}
</style></head><body><div class="bg"></div><div class="sh"></div>
<div class="br">${logo ? `<img src="${logo}" alt="">` : ''}<span>${esc(brand || '')}</span></div>
<div class="tx"><h1>${esc(headline)}</h1>${sub ? `<p>${esc(sub)}</p>` : ''}${cta ? `<span class="cta">${esc(cta)}</span>` : ''}</div></body></html>`;
}
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

async function compose() {
  const bg = path.resolve(opt('bg')); const out = opt('out', 'out'); const name = opt('name', 'creative');
  if (!fs.existsSync(bg)) throw new Error('--bg 파일 없음');
  fs.mkdirSync(out, { recursive: true });
  const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
  const exe = process.env.PLAYWRIGHT_CHROMIUM || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
  const b = await chromium.launch(exe ? { executablePath: exe } : {});
  const bgUrl = 'data:image/jpeg;base64,' + fs.readFileSync(bg).toString('base64');
  const logoP = opt('logo'); const logo = logoP && fs.existsSync(logoP) ? 'data:image/png;base64,' + fs.readFileSync(logoP).toString('base64') : '';
  const made = [];
  for (const [k, [w, h]] of Object.entries(SIZES)) {
    const page = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    await page.setContent(template({ w, h, bg: bgUrl, headline: opt('headline', ''), sub: opt('sub', ''), cta: opt('cta', ''), brand: opt('brand', ''), color: opt('color', '#0A4DF5'), logo }), { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    const file = path.join(out, `${name}-${k}.jpg`);
    await page.screenshot({ path: file, type: 'jpeg', quality: 82 });
    made.push({ size: k, file, bytes: fs.statSync(file).size });
    await page.close();
  }
  await b.close();
  console.log(JSON.stringify(made));
}

async function upload() {
  const file = opt('file'); if (!file || !fs.existsSync(file)) throw new Error('--file 없음');
  const BASE = (process.env.BIZHIGHER_ADMIN_URL || 'https://bizhigher.com').replace(/\/$/, '');
  const PW = (process.env.BIZHIGHER_ADMIN_PASSWORD || '').trim().replace(/^(["'])(.*)\1$/s, '$2');
  const r = await fetch(BASE + '/admin/login', { method: 'POST', body: new URLSearchParams({ password: PW }), redirect: 'manual' });
  const cookie = (r.headers.get('set-cookie') || '').split(';')[0];
  if (!cookie.startsWith('bh_admin=')) throw new Error('관리자 로그인 실패 ' + r.status);
  const ct = /\.png$/i.test(file) ? 'image/png' : /\.webp$/i.test(file) ? 'image/webp' : 'image/jpeg';
  const res = await fetch(BASE + '/admin/api/assets', { method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify({ job_id: opt('job'), task_id: opt('task'), label: opt('label', path.basename(file)), content_type: ct, base64: fs.readFileSync(file).toString('base64') }) });
  const j = await res.json();
  if (!j.ok) throw new Error('업로드 실패: ' + j.error);
  console.log(j.url);
}

(async () => {
  if (cmd === 'gen') return gen();
  if (cmd === 'compose') return compose();
  if (cmd === 'upload') return upload();
  console.log('사용법: gen --prompt … --out bg.jpg | compose --bg bg.jpg --headline … --out dir | upload --file a.jpg [--job N --task N]');
})().catch((e) => { console.error('오류:', e.message); process.exit(1); });
