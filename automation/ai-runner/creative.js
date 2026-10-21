#!/usr/bin/env node
/**
 * 광고 소재·게시물 이미지 파이프라인 (루틴 세션용, 의존성 없음 — Playwright는 환경에 깔린 것을 쓴다)
 *
 *   node automation/ai-runner/creative.js gen --prompt "…" --out bg.jpg [--size square_hd|portrait_16_9|landscape_16_9|{w}x{h}] [--model fal-ai/flux/schnell]
 *       fal.ai 로 배경 이미지 1장 생성 (환경변수 FAL_KEY). 사람 얼굴·글자·브랜드 로고는 프롬프트에 넣지 않는다 — 글자는 compose 가 얹는다
 *   node automation/ai-runner/creative.js compose --bg bg.jpg --headline "…" [--sub "…"] [--cta "…"] [--brand "New Optix"] [--color "#0A4DF5"] [--logo logo.png] --out outdir [--name feed]
 *       1:1(1080²) · 9:16(1080×1920) · 1.91:1(1200×628) JPEG 3장을 outdir 에 쓴다. 한글은 Noto Sans KR(구글 폰트)로 조판
 *   node automation/ai-runner/creative.js upload --file a.jpg|clip.mp4 [--job 1] [--task 12] [--label "…"]
 *       관리자 API 에 올려 공개 URL(/a/…) 을 받는다 (BIZHIGHER_ADMIN_URL · BIZHIGHER_ADMIN_PASSWORD). R2 가 있으면 60MB 까지
 *   node automation/ai-runner/creative.js video --image 고객사진URL또는파일 [--crop 9:16] [--prompt "subtle camera push-in…"] [--duration 5] --out clip.mp4 [--job 1 --task 12]
 *       fal.ai 이미지→영상(기본 Kling 2.1 standard, 편당 약 $0.25~0.5, 1~3분 소요). 사람 얼굴 클로즈업·글자가 큰 사진은 피한다. 자막·로고·음악은 David 가 편집
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

/* ---------- 영상: 고객 사진 1장 → 5초 클립 (fal.ai 큐 API) ---------- */
async function uploadFile(file, { job, task, label } = {}) {
  const BASE = (process.env.BIZHIGHER_ADMIN_URL || 'https://bizhigher.com').replace(/\/$/, '');
  const PW = (process.env.BIZHIGHER_ADMIN_PASSWORD || '').trim().replace(/^(["'])(.*)\1$/s, '$2');
  const r = await fetch(BASE + '/admin/login', { method: 'POST', body: new URLSearchParams({ password: PW }), redirect: 'manual' });
  const cookie = (r.headers.get('set-cookie') || '').split(';')[0];
  if (!cookie.startsWith('bh_admin=')) throw new Error('관리자 로그인 실패 ' + r.status);
  const ext = (file.split('.').pop() || '').toLowerCase();
  const ct = { png: 'image/png', webp: 'image/webp', gif: 'image/gif', mp4: 'video/mp4', webm: 'video/webm', pdf: 'application/pdf' }[ext] || 'image/jpeg';
  const fd = new FormData();
  fd.append('file', new Blob([fs.readFileSync(file)], { type: ct }), path.basename(file));
  if (job) fd.append('job_id', String(job)); if (task) fd.append('task_id', String(task)); fd.append('label', label || path.basename(file));
  const res = await fetch(BASE + '/admin/api/assets', { method: 'POST', headers: { cookie }, body: fd });
  const j = await res.json();
  if (!j.ok) throw new Error('업로드 실패: ' + j.error);
  return j.url;
}

/* 사진을 비율에 맞춰 중앙 크롭 (영상 소스용: 9:16 = 1080×1920, 1:1 = 1080², 16:9 = 1920×1080) */
async function cropImage(file, ratio, out) {
  const dims = { '9:16': [1080, 1920], '1:1': [1080, 1080], '16:9': [1920, 1080] }[ratio];
  if (!dims) throw new Error('--crop 은 9:16 | 1:1 | 16:9');
  const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
  const exe = process.env.PLAYWRIGHT_CHROMIUM || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
  const b = await chromium.launch(exe ? { executablePath: exe } : {});
  const page = await b.newPage({ viewport: { width: dims[0], height: dims[1] }, deviceScaleFactor: 1 });
  const ext = (file.split('.').pop() || 'jpg').toLowerCase();
  const data = 'data:image/' + (ext === 'png' ? 'png' : 'jpeg') + ';base64,' + fs.readFileSync(file).toString('base64');
  await page.setContent(`<!doctype html><body style="margin:0;width:${dims[0]}px;height:${dims[1]}px;background:#000 url('${data}') center/cover no-repeat"></body>`);
  await page.screenshot({ path: out, type: 'jpeg', quality: 90 });
  await b.close();
  return out;
}

async function video() {
  const key = process.env.FAL_KEY;
  if (!key) throw new Error('FAL_KEY 가 없습니다 (bizhigher 환경변수)');
  let image = opt('image'); const out = opt('out', 'clip.mp4');
  const prompt = opt('prompt', 'subtle slow camera push-in, gentle natural motion, photorealistic, no text');
  const model = opt('model', 'fal-ai/kling-video/v2.1/standard/image-to-video');
  const duration = String(opt('duration', '5'));
  if (!image) throw new Error('--image URL 또는 파일 필요 (고객 매장 사진)');
  if (!/^https?:\/\//.test(image)) {
    if (!fs.existsSync(image)) throw new Error('--image 파일 없음');
    if (opt('crop')) image = await cropImage(image, opt('crop'), out.replace(/\.mp4$/i, '') + '-src.jpg');
    image = await uploadFile(image, { job: opt('job'), task: opt('task'), label: 'video-src ' + path.basename(image) }); // fal 이 받을 공개 URL
  }
  const sub = await fetch('https://queue.fal.run/' + model, { method: 'POST', headers: { Authorization: 'Key ' + key, 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt, image_url: image, duration, negative_prompt: 'blur, distort, low quality, text, watermark, extra limbs', cfg_scale: 0.5 }) });
  if (!sub.ok) throw new Error('fal.ai 제출 ' + sub.status + ': ' + (await sub.text()).slice(0, 300));
  const q = await sub.json(); // { request_id, status_url, response_url }
  const t0 = Date.now(); let st = {};
  while (Date.now() - t0 < 15 * 60e3) {
    await new Promise((r) => setTimeout(r, 6000));
    const s = await fetch(q.status_url, { headers: { Authorization: 'Key ' + key } });
    st = await s.json().catch(() => ({}));
    if (st.status === 'COMPLETED') break;
    if (st.status === 'FAILED' || st.error) throw new Error('fal.ai 생성 실패: ' + JSON.stringify(st).slice(0, 300));
    process.stderr.write('.');
  }
  if (st.status !== 'COMPLETED') throw new Error('fal.ai 15분 안에 끝나지 않음 (request ' + q.request_id + ')');
  const res = await fetch(q.response_url, { headers: { Authorization: 'Key ' + key } });
  const j = await res.json();
  const url = j.video && j.video.url;
  if (!url) throw new Error('fal.ai 응답에 영상이 없습니다');
  const bin = Buffer.from(await (await fetch(url)).arrayBuffer());
  fs.writeFileSync(out, bin);
  console.log(JSON.stringify({ out, bytes: bin.length, model, request_id: q.request_id, source: image }));
}

async function upload() {
  const file = opt('file'); if (!file || !fs.existsSync(file)) throw new Error('--file 없음');
  console.log(await uploadFile(file, { job: opt('job'), task: opt('task'), label: opt('label') }));
}

(async () => {
  if (cmd === 'gen') return gen();
  if (cmd === 'compose') return compose();
  if (cmd === 'upload') return upload();
  if (cmd === 'video') return video();
  if (cmd === 'crop') return cropImage(opt('image'), opt('ratio', '9:16'), opt('out', 'cropped.jpg')).then((o) => console.log(o));
  console.log('사용법: gen --prompt … --out bg.jpg | compose --bg bg.jpg --headline … --out dir | upload --file a.jpg [--job N --task N] | video --image 사진URL또는파일 [--crop 9:16] [--prompt …] [--duration 5] --out clip.mp4 [--job N --task N] | crop --image a.jpg --ratio 9:16 --out b.jpg');
})().catch((e) => { console.error('오류:', e.message); process.exit(1); });
