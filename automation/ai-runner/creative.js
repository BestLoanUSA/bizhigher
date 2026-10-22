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
 *       fal.ai 이미지→영상(기본 Kling 2.1 standard, 편당 약 $0.25~0.5, 1~3분 소요). 사람 얼굴 클로즈업·글자가 큰 사진은 피한다
 *   node automation/ai-runner/creative.js caption --video clip.mp4 --text "훅 문장|둘째 자막|셋째 자막" [--captions captions.json] [--brand "New Optix"] [--logo logo.png|URL] [--color "#0A4DF5"] [--music bgm.mp3] [--cta "지금 예약 (714) 555-0142"] --out final.mp4
 *       자막·로고·CTA 를 Playwright 로 투명 PNG 에 그려 시스템 ffmpeg(overlay·libx264)로 클립에 얹는다 — sv-3 의 David 편집을 "확인"으로 줄이는 명령.
 *       --text 는 | 로 나눈 자막을 길이에 비례해 자동 배분(사이 0.1초), --captions 는 [{start,end,text}] 로 직접 지정. *단어* 는 브랜드 색 강조. 음악은 --music(mp3) 이 있을 때만, 끝 1초 페이드.
 *       Playwright 번들 ffmpeg 에는 overlay 가 없으므로 /usr/bin/ffmpeg(또는 FFMPEG 환경변수)를 쓴다 — 없으면 오류로 멈춘다
 *   node automation/ai-runner/creative.js promo (--job 28 | --spec spec.json) [--clip clip.mp4] [--props over.json] [--hook "리드|문장|강조어"] [--cta "…"] --out promo.mp4
 *       사이트 스펙(D1 sites.spec)에서 props 를 만들어 Remotion 템플릿(automation/video, 9:16 약 20초: 훅 → 서비스 ≤3 → 왜 우리 → 엔드카드)을 렌더한다.
 *       --clip 은 훅 장면 배경(Kling 클립), 없으면 히어로 사진 켄번스. --props 는 props 부분 덮어쓰기(JSON: hook·services[].sub·highlights·cta·hours 등 — sv-1 기획안 문구를 여기로).
 *       스펙에 없는 값은 비워 두면 그 장면·요소가 빠진다(지어내지 않는다). 첫 실행은 automation/video 에 npm ci(1~2분), 렌더는 20초 영상 기준 약 1.5분, 비용 0.
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

/* ---------- 자막·로고 합성 (sv-3 축소) ---------- */
function ffmpegBin() {
  const c = [process.env.FFMPEG, '/usr/bin/ffmpeg', '/usr/local/bin/ffmpeg'].filter(Boolean);
  for (const b of c) if (fs.existsSync(b)) return b;
  throw new Error('overlay 를 지원하는 ffmpeg 가 없습니다 (/usr/bin/ffmpeg). Playwright 번들 ffmpeg 는 자막 합성에 못 씁니다');
}
function probe(file) {
  const { execFileSync } = require('child_process');
  const out = execFileSync(ffmpegBin(), ['-hide_banner', '-i', file], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).toString();
  return out;
}
function probeInfo(file) {
  let txt = ''; try { probe(file); } catch (e) { txt = String(e.stderr || e.stdout || e.message || ''); }
  const d = /Duration:\s*(\d+):(\d+):(\d+\.?\d*)/.exec(txt); const wh = /Video:.*?\s(\d{2,5})x(\d{2,5})/.exec(txt);
  if (!d || !wh) throw new Error('영상 정보를 읽지 못했습니다: ' + file);
  return { duration: Number(d[1]) * 3600 + Number(d[2]) * 60 + Number(d[3]), w: Number(wh[1]), h: Number(wh[2]), hasAudio: /Audio:/.test(txt) };
}
/* 자막 문장을 길이 비례로 시간 배분 */
function autoTimes(lines, duration, gap = 0.1) {
  const lens = lines.map((l) => Math.max(4, l.replace(/\*/g, '').length)); const total = lens.reduce((a, b) => a + b, 0);
  const usable = duration - gap * lines.length; let t = 0.05;
  return lines.map((text, i) => { const len = Math.max(1.2, (lens[i] / total) * usable); const c = { start: +t.toFixed(2), end: +Math.min(duration, t + len).toFixed(2), text }; t += len + gap; return c; });
}
const mark = (txt, color) => esc(txt).replace(/\*([^*]+)\*/g, `<b style="color:${color}">$1</b>`);
function overlayHtml({ w, h, text, brand, logo, color, cta, pos }) {
  const tall = h > w * 1.3; const base = Math.round(w / 1080 * 100) / 100; // 1080 기준 배율
  const fs_ = Math.round((tall ? 64 : 52) * base), pad = Math.round(56 * base), bottom = Math.round((tall ? h * 0.2 : h * 0.12));
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@500;700;900&display=swap">
<style>*{box-sizing:border-box;margin:0}html,body{width:${w}px;height:${h}px;background:transparent;overflow:hidden;font-family:'Noto Sans KR',sans-serif;color:#fff}
.br{position:absolute;top:${pad}px;left:${pad}px;display:flex;align-items:center;gap:${Math.round(14 * base)}px;font-weight:700;font-size:${Math.round(30 * base)}px;text-shadow:0 2px 10px rgba(0,0,0,.55)}.br img{height:${Math.round(64 * base)}px;width:auto;border-radius:${Math.round(14 * base)}px;background:#fff;padding:${Math.round(6 * base)}px;box-shadow:0 4px 16px rgba(0,0,0,.35)}
.cap{position:absolute;left:${pad}px;right:${pad}px;${pos === 'center' ? 'top:50%;transform:translateY(-50%);' : `bottom:${bottom}px;`}text-align:center}
.cap span{display:inline;background:rgba(0,0,0,.62);color:#fff;font-weight:900;font-size:${fs_}px;line-height:1.5;padding:${Math.round(6 * base)}px ${Math.round(18 * base)}px;border-radius:${Math.round(14 * base)}px;box-decoration-break:clone;-webkit-box-decoration-break:clone;word-break:keep-all;letter-spacing:-.01em}
.cta{position:absolute;left:${pad}px;right:${pad}px;bottom:${Math.round(bottom * 0.45)}px;text-align:center}.cta span{display:inline-block;background:${color};color:#fff;font-weight:700;font-size:${Math.round(34 * base)}px;padding:${Math.round(14 * base)}px ${Math.round(30 * base)}px;border-radius:999px;box-shadow:0 6px 20px rgba(0,0,0,.35)}
</style></head><body>
${brand || logo ? `<div class="br">${logo ? `<img src="${esc(logo)}" alt="">` : ''}${brand ? `<span>${esc(brand)}</span>` : ''}</div>` : ''}
${text ? `<div class="cap"><span>${mark(text, color)}</span></div>` : ''}
${cta ? `<div class="cta"><span>${esc(cta)}</span></div>` : ''}
</body></html>`;
}
async function caption() {
  const video = opt('video'); const out = opt('out', 'final.mp4');
  if (!video || !fs.existsSync(video)) throw new Error('--video 파일 없음');
  const ff = ffmpegBin(); const info = probeInfo(video);
  const brand = opt('brand', ''); let logo = opt('logo', ''); const color = opt('color', '#0A4DF5'); const cta = opt('cta', ''); const music = opt('music', ''); const pos = opt('pos', 'bottom');
  let caps = [];
  if (opt('captions')) caps = JSON.parse(fs.readFileSync(opt('captions'), 'utf8'));
  else if (opt('text')) caps = autoTimes(opt('text').split('|').map((x) => x.trim()).filter(Boolean), info.duration);
  caps = caps.filter((c) => c && c.text && c.end > c.start).slice(0, 12);
  const tmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'cap-'));
  if (logo && /^https?:\/\//.test(logo)) { const b = Buffer.from(await (await fetch(logo)).arrayBuffer()); const lp = path.join(tmp, 'logo.' + (/\.png(\?|$)/i.test(logo) ? 'png' : 'jpg')); fs.writeFileSync(lp, b); logo = lp; }
  if (logo && fs.existsSync(logo)) logo = 'data:image/' + (logo.endsWith('.png') ? 'png' : 'jpeg') + ';base64,' + fs.readFileSync(logo).toString('base64');
  // Playwright 로 투명 PNG — 자막마다 1장(로고·브랜드 포함) + 자막 없는 구간용 1장(로고·CTA만)
  const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
  const exe = process.env.PLAYWRIGHT_CHROMIUM || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
  const b = await chromium.launch(exe ? { executablePath: exe } : {});
  const page = await b.newPage({ viewport: { width: info.w, height: info.h }, deviceScaleFactor: 1 });
  const shots = [];
  const render = async (i, text) => { await page.setContent(overlayHtml({ w: info.w, h: info.h, text, brand, logo, color, cta, pos }), { waitUntil: 'networkidle' }); await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(150); const f = path.join(tmp, `ov${i}.png`); await page.screenshot({ path: f, omitBackground: true }); return f; };
  const basePng = (brand || logo || cta) ? await render('base', '') : null;
  for (let i = 0; i < caps.length; i++) shots.push({ file: await render(i, caps[i].text), ...caps[i] });
  await b.close();
  // ffmpeg: 기본 오버레이(전 구간) → 자막 오버레이(구간별, 0.25초 페이드) → 음악
  const args = ['-y', '-hide_banner', '-loglevel', 'error', '-i', video];
  const inputs = []; if (basePng) { args.push('-loop', '1', '-framerate', '30', '-i', basePng); inputs.push({ kind: 'base' }); }
  for (const s of shots) { args.push('-loop', '1', '-framerate', '30', '-i', s.file); inputs.push(s); }
  if (music) { if (!fs.existsSync(music)) throw new Error('--music 파일 없음'); args.push('-i', music); }
  const fc = []; let cur = '[0:v]';
  inputs.forEach((inp, i) => {
    const idx = i + 1; const lbl = `[o${i}]`, outl = `[v${i}]`;
    if (inp.kind === 'base') fc.push(`[${idx}:v]format=rgba${lbl}`, `${cur}${lbl}overlay=0:0:shortest=1${outl}`);
    else { const fd = Math.min(0.25, (inp.end - inp.start) / 3).toFixed(2); fc.push(`[${idx}:v]format=rgba,fade=t=in:st=${inp.start}:d=${fd}:alpha=1,fade=t=out:st=${(inp.end - fd).toFixed(2)}:d=${fd}:alpha=1${lbl}`, `${cur}${lbl}overlay=0:0:shortest=1:enable='between(t,${inp.start},${inp.end})'${outl}`); }
    cur = outl;
  });
  const musicIdx = inputs.length + 1;
  if (music) fc.push(`[${musicIdx}:a]afade=t=in:st=0:d=0.5,afade=t=out:st=${Math.max(0, info.duration - 1).toFixed(2)}:d=1,volume=0.9[a]`);
  if (fc.length) args.push('-filter_complex', fc.join(';'), '-map', cur); else args.push('-map', '0:v');
  if (music) args.push('-map', '[a]', '-shortest'); else if (info.hasAudio) args.push('-map', '0:a?');
  args.push('-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p', '-r', '30', '-movflags', '+faststart');
  if (music || info.hasAudio) args.push('-c:a', 'aac', '-b:a', '128k');
  args.push('-t', String(info.duration), out);
  const { execFileSync } = require('child_process');
  try { execFileSync(ff, args, { stdio: ['ignore', 'pipe', 'pipe'] }); } catch (e) { throw new Error('ffmpeg 합성 실패: ' + String(e.stderr || e.message).slice(-600)); }
  const done = probeInfo(out);
  console.log(JSON.stringify({ out, bytes: fs.statSync(out).size, duration: done.duration, size: `${done.w}x${done.h}`, captions: shots.map((s) => [s.start, s.end, s.text]), brand: !!(brand || logo), cta: !!cta, music: !!music }));
}

/* ───────── promo: 스펙 → Remotion 프로모 영상 ───────── */
const VIDEO_DIR = path.join(__dirname, '../video');
async function adminGet(p) {
  const BASE = (process.env.BIZHIGHER_ADMIN_URL || 'https://bizhigher.com').replace(/\/$/, '');
  const PW = (process.env.BIZHIGHER_ADMIN_PASSWORD || '').trim().replace(/^(["'])(.*)\1$/s, '$2');
  if (!PW) throw new Error('BIZHIGHER_ADMIN_PASSWORD 가 없습니다');
  const r = await fetch(BASE + '/admin/login', { method: 'POST', body: new URLSearchParams({ password: PW }), redirect: 'manual' });
  const cookie = (r.headers.get('set-cookie') || '').split(';')[0];
  if (!cookie.startsWith('bh_admin=')) throw new Error('관리자 로그인 실패 ' + r.status);
  const res = await fetch(`${BASE}/admin/api/${p}`, { headers: { cookie, 'sec-fetch-mode': 'cors' } });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || j.ok === false) throw new Error(`${p}: ${j.error || res.status}`);
  return j;
}
/** 긴 문장을 n자 안에서 자연스러운 경계로 자른다 */
function shorten(str, n) {
  const s = String(str || '').replace(/\s+/g, ' ').trim(); if (s.length <= n) return s;
  const cut = s.slice(0, n); const i = Math.max(cut.lastIndexOf(' '), cut.lastIndexOf(','), cut.lastIndexOf('·'), cut.lastIndexOf('。'));
  return (i > n * 0.5 ? cut.slice(0, i) : cut).replace(/[,·.\s]+$/, '');
}
/** 사이트 스펙 → 프로모 props. 스펙에 있는 값만 쓴다 */
function specToProps(spec) {
  const a = spec.address || {}; const hero = spec.hero || {}; const gallery = (spec.gallery || []).filter(Boolean);
  const lead = shorten(String(spec.tagline || '').split(/[·|]/)[0], 20) || [a.city, spec.category].filter(Boolean).join(' ');
  const picked = (spec.services || []).filter((x) => x && x.name).slice(0, 3);
  const used = new Set(picked.map((x) => x.photo).filter(Boolean));
  const spare = () => { const g = gallery.find((u) => !used.has(u)) || hero.photo || gallery[0] || ''; if (g) used.add(g); return g; }; // 사진 없는 서비스는 아직 안 쓴 갤러리 사진
  const services = picked.map((x) => ({ name: x.name, sub: shorten(x.desc, 18), photo: x.photo || spare() }));
  return {
    name: spec.name || '', name_ko: spec.name_ko || spec.name || '', accent: (spec.theme && spec.theme.color) || '#0A4DF5', logo: spec.logo || '',
    clip: '', photo: hero.photo || gallery[0] || '',
    hook: { lead, line: hero.headline || spec.tagline || spec.name || '', em: hero.em || '' },
    services, highlights: (spec.highlights || []).map((h) => h && h.title).filter(Boolean).slice(0, 4),
    rating: Number(spec.rating) || 0, review_count: Number(spec.review_count) || 0,
    phone: spec.phone || '', address: [a.line1, a.city].filter(Boolean).join(', '),
    hours: (spec.hours || []).filter((h) => h && h.days).slice(0, 3).map((h) => `${h.days} ${h.time || ''}`.trim()),
    cta: spec.phone ? '지금 전화하세요' : '지금 방문하세요',
  };
}
/** props 덮어쓰기: 객체는 깊게, 객체 배열(services 등)은 인덱스별로 병합(사진 등 스펙 값 유지), 그 밖의 배열·값은 교체 */
function deepMerge(a, b) {
  for (const k of Object.keys(b || {})) {
    const v = b[k];
    if (Array.isArray(v) && Array.isArray(a[k]) && v.every((x) => x && typeof x === 'object' && !Array.isArray(x))) a[k] = v.map((x, i) => deepMerge({ ...(a[k][i] || {}) }, x));
    else if (v && typeof v === 'object' && !Array.isArray(v) && a[k] && typeof a[k] === 'object' && !Array.isArray(a[k])) deepMerge(a[k], v);
    else a[k] = v;
  }
  return a;
}
/** URL 또는 파일을 run 폴더에 내려받아 1600px 로 줄인다(렌더 속도). 실패하면 '' */
async function fetchAsset(src, dir, name) {
  try {
    let buf; if (/^https?:\/\//.test(src)) { const r = await fetch(src); if (!r.ok) return ''; buf = Buffer.from(await r.arrayBuffer()); } else { if (!fs.existsSync(src)) return ''; buf = fs.readFileSync(src); }
    const ext = /\.(png|webp|gif)$/i.test(src) ? RegExp.$1.toLowerCase() : 'jpg';
    const raw = path.join(dir, name + '.src.' + ext); fs.writeFileSync(raw, buf);
    if (ext !== 'jpg' && ext !== 'webp') return path.basename(raw);
    const out = path.join(dir, name + '.jpg');
    try { require('child_process').execFileSync(ffmpegBin(), ['-v', 'error', '-y', '-i', raw, '-vf', "scale='min(1600,iw)':-2", '-q:v', '3', out], { stdio: 'ignore' }); fs.unlinkSync(raw); return path.basename(out); } catch { return path.basename(raw); }
  } catch { return ''; }
}
function chromeBin() {
  const c = [process.env.REMOTION_CHROME, process.env.PLAYWRIGHT_CHROMIUM].filter(Boolean);
  try { for (const d of fs.readdirSync('/opt/pw-browsers')) if (/^chromium-\d+$/.test(d)) c.push(`/opt/pw-browsers/${d}/chrome-linux/chrome`); } catch {}
  return c.find((b) => fs.existsSync(b)) || '';
}
async function ensureVideoDeps() {
  if (fs.existsSync(path.join(VIDEO_DIR, 'node_modules/remotion'))) return;
  console.error('automation/video 의존성 설치 중(npm ci, 1~2분)…');
  require('child_process').execFileSync('npm', ['ci', '--no-audit', '--no-fund'], { cwd: VIDEO_DIR, stdio: ['ignore', 'ignore', 'inherit'] });
}
async function ensureFont() {
  const f = path.join(VIDEO_DIR, 'public/NotoSansKR.ttf'); if (fs.existsSync(f) && fs.statSync(f).size > 1e6) return 'NotoSansKR.ttf';
  try { const r = await fetch('https://raw.githubusercontent.com/notofonts/noto-cjk/main/Sans/Variable/TTF/Subset/NotoSansKR-VF.ttf'); if (r.ok) { const b = Buffer.from(await r.arrayBuffer()); if (b.length > 1e6) { fs.writeFileSync(f, b); return 'NotoSansKR.ttf'; } } } catch {}
  return ''; // 템플릿이 구글 폰트 링크로 대체
}
async function promo() {
  const out = path.resolve(opt('out', 'promo.mp4')); const job = opt('job'); const specFile = opt('spec'); const over = opt('props');
  let spec = null;
  if (specFile) spec = JSON.parse(fs.readFileSync(specFile, 'utf8'));
  else if (job) { const r = await adminGet('sites/' + job); spec = r && r.spec; if (!spec) throw new Error('작업 ' + job + ' 에 저장된 사이트 스펙이 없습니다 — --spec 또는 --props 로 직접 주세요'); if (typeof spec === 'string') spec = JSON.parse(spec); }
  const props = spec ? specToProps(spec) : { name: '', hook: { line: '' }, services: [], highlights: [] };
  if (over) deepMerge(props, JSON.parse(fs.readFileSync(over, 'utf8')));
  if (opt('hook')) { const [lead, line, em] = opt('hook').split('|'); props.hook = { lead: (lead || '').trim(), line: (line || props.hook.line || '').trim(), em: (em || '').trim() }; }
  if (opt('cta')) props.cta = opt('cta');
  if (!props.hook || !props.hook.line) throw new Error('훅 문장이 없습니다 (스펙 hero.headline 또는 --hook)');
  await ensureVideoDeps();
  const run = '_run-' + Date.now().toString(36); const dir = path.join(VIDEO_DIR, 'public', run); fs.mkdirSync(dir, { recursive: true });
  try {
    const rel = (n) => (n ? run + '/' + n : '');
    const clip = opt('clip'); if (clip) { if (!fs.existsSync(clip)) throw new Error('--clip 파일 없음'); fs.copyFileSync(clip, path.join(dir, 'clip.mp4')); props.clip = rel('clip.mp4'); }
    if (props.photo) props.photo = rel(await fetchAsset(props.photo, dir, 'hero'));
    if (props.logo) props.logo = rel(await fetchAsset(props.logo, dir, 'logo'));
    const seen = {};
    for (let i = 0; i < props.services.length; i++) { const src = props.services[i].photo; if (!src) continue; if (seen[src]) { props.services[i].photo = seen[src]; continue; } seen[src] = props.services[i].photo = rel(await fetchAsset(src, dir, 'svc' + i)); }
    props.font = await ensureFont();
    const propsFile = path.join(dir, 'props.json'); fs.writeFileSync(propsFile, JSON.stringify(props));
    const scenes = 1 + props.services.filter((x) => x && x.name).length + (props.highlights.length ? 1 : 0) + 1;
    const chrome = chromeBin();
    const argv = ['render', 'src/index.ts', 'Promo', out, '--props=' + propsFile, '--codec=h264', '--concurrency=' + (opt('concurrency', '2')), '--log=error'];
    if (chrome) argv.push('--browser-executable=' + chrome, '--chrome-mode=chrome-for-testing');
    console.error(`렌더 중 (${scenes}장면, Remotion)…`);
    require('child_process').execFileSync(path.join(VIDEO_DIR, 'node_modules/.bin/remotion'), argv, { cwd: VIDEO_DIR, stdio: ['ignore', 'ignore', 'inherit'], timeout: 15 * 60 * 1000 });
    const info = probeInfo(out);
    const url = opt('job') && args.includes('--upload') ? await uploadFile(out, { job: opt('job'), task: opt('task'), label: opt('label', '프로모 영상 9:16') }) : undefined;
    console.log(JSON.stringify({ out, seconds: info.duration, scenes, services: props.services.map((x) => x.name), highlights: props.highlights.length, clip: !!props.clip, font: props.font ? 'local' : 'google', url }));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
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
  if (cmd === 'caption') return caption();
  if (cmd === 'promo') return promo();
  if (cmd === 'crop') return cropImage(opt('image'), opt('ratio', '9:16'), opt('out', 'cropped.jpg')).then((o) => console.log(o));
  console.log('사용법: gen --prompt … --out bg.jpg | compose --bg bg.jpg --headline … --out dir | upload --file a.jpg [--job N --task N] | video --image 사진URL또는파일 [--crop 9:16] [--prompt …] [--duration 5] --out clip.mp4 [--job N --task N] | caption --video clip.mp4 --text "자막1|자막2" [--brand …] [--logo …] [--cta …] [--music bgm.mp3] --out final.mp4 | promo (--job N | --spec spec.json) [--clip clip.mp4] [--props over.json] [--hook "리드|문장|강조어"] [--cta …] [--upload --task N] --out promo.mp4 | crop --image a.jpg --ratio 9:16 --out b.jpg');
})().catch((e) => { console.error('오류:', e.message); process.exit(1); });
