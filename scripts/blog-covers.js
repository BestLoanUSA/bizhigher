#!/usr/bin/env node
/**
 * 블로그 대표 사진 — 글의 핵심 장면을 사진으로 (2026-11-06 David 요청: "카드 위는 글씨 말고 눈을 사로잡는 이미지")
 *
 *   node scripts/blog-covers.js              → covers.json 에 장면이 있는데 사진이 없는 글만
 *   node scripts/blog-covers.js --only slug  → 그 글만 다시
 *   node scripts/blog-covers.js --force      → 전부 다시(약 $0.04 × 글 수)
 *
 * content/blog/img/covers.json 의 영어 장면 설명 → fal.ai flux-pro v1.1(4:3) → content/blog/img/{slug}-cover.jpg (800×600, ffmpeg 로 줄임)
 * 환경변수 FAL_KEY 필요(bizhigher 루틴 환경에 있다). GitHub Actions 에는 키가 없으므로 블로그 발행 루틴이 글과 함께 만들어 커밋한다.
 * 규칙: 글자·로고·실제 앱 화면을 흉내 내지 않는다(모든 장면 끝에 STYLE 이 붙는다). 사람·손은 넣지 않는다(손가락·표정이 어색하게 나온다, 2026-11-06) — 공간·사물 정물로.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const IMG = path.join(__dirname, '..', 'content', 'blog', 'img');
const STYLE = 'editorial still life or interior photograph, no people, no hands, no human figures, natural light, warm tones, shallow depth of field, 35mm film look, realistic, no text, no letters, no words, no logos, no readable signage, no brand names';
const MODEL = process.env.COVER_MODEL || 'fal-ai/flux-pro/v1.1';
const args = process.argv.slice(2);
const FORCE = args.includes('--force');
const ONLY = (() => { const i = args.indexOf('--only'); return i > -1 && args[i + 1] ? args[i + 1].split(',') : null; })();

async function one(slug, scene) {
  const res = await fetch('https://fal.run/' + MODEL, {
    method: 'POST', headers: { Authorization: 'Key ' + process.env.FAL_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: `${scene}, ${STYLE}`, image_size: 'landscape_4_3', num_images: 1, output_format: 'jpeg', enable_safety_checker: true, safety_tolerance: '2' }),
  });
  if (!res.ok) throw new Error(`fal.ai ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const j = await res.json();
  const url = j.images && j.images[0] && j.images[0].url;
  if (!url) throw new Error('이미지 없음');
  const raw = path.join(IMG, `${slug}-cover.src.jpg`), out = path.join(IMG, `${slug}-cover.jpg`);
  fs.writeFileSync(raw, Buffer.from(await (await fetch(url)).arrayBuffer()));
  try { execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', raw, '-vf', 'scale=800:600:force_original_aspect_ratio=increase,crop=800:600', '-q:v', '4', out]); fs.rmSync(raw); }
  catch { fs.renameSync(raw, out); } // ffmpeg 가 없으면 원본 그대로
  return out;
}

(async () => {
  if (!process.env.FAL_KEY) { console.log('FAL_KEY 가 없어 대표 사진을 건너뜁니다(카드는 표 그림으로 보인다)'); return; }
  const scenes = JSON.parse(fs.readFileSync(path.join(IMG, 'covers.json'), 'utf8'));
  const todo = Object.entries(scenes).filter(([k]) => !k.startsWith('_')).filter(([slug]) => (ONLY ? ONLY.includes(slug) : FORCE || !fs.existsSync(path.join(IMG, `${slug}-cover.jpg`))));
  let ok = 0;
  for (let i = 0; i < todo.length; i += 4) { // 4개씩 동시에
    await Promise.all(todo.slice(i, i + 4).map(async ([slug, scene]) => {
      try { await one(slug, scene); ok++; console.log(`  ✓ ${slug}`); } catch (e) { console.log(`  ⚠ ${slug} — ${e.message}`); }
    }));
  }
  console.log(`대표 사진 ${ok}/${todo.length}개`);
})();
