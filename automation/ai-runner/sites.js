#!/usr/bin/env node
/**
 * 고객 사이트 — 스펙 저장·빌드·배포 (루틴·David 세션 공용). 설계: docs/customer-sites-design-ko.md
 *
 *   node automation/ai-runner/sites.js spec --job 28 --file spec.json         # 스펙 저장(업서트) → slug·미리보기 주소
 *   node automation/ai-runner/sites.js build [--out sites-build]              # 관리자 API의 모든 사이트를 렌더 + _worker.js
 *   node automation/ai-runner/sites.js deploy [--dir sites-build]             # wrangler pages deploy (CLOUDFLARE_API_TOKEN·CLOUDFLARE_ACCOUNT_ID 필요)
 *   node automation/ai-runner/sites.js render --spec spec.json --out preview  # 로컬 확인용 (관리자 API 없이)
 *   node automation/ai-runner/sites.js domains                                # 모든 사이트의 {slug}.sites.bizhigher.com 등록 상태 확인·보정 (배포 없이)
 *   node automation/ai-runner/sites.js needs-deploy                           # "yes …"/"no …" — 템플릿·라우터·CLI(automation/sites, sites.js)가 마지막 배포 뒤 바뀌었으면 yes (루틴이 매 실행 확인)
 *   node automation/ai-runner/sites.js patch --job 28 --file patch.json [--note "스타일 변경"]   # 저장된 스펙에 부분 패치(깊은 병합, null 은 삭제) → 새 버전. 수정 요청 반영에 쓴다(전체 재작성 금지)
 *   node automation/ai-runner/sites.js diff --job 28 [--file new.json]             # 저장된 최신 버전과 이전 버전(또는 --file)의 바뀐 키 목록 — 결과물 요약에 붙인다
 *   node automation/ai-runner/sites.js leads --job 28 [--since 7d]                # 사이트 문의 폼으로 들어온 리드 목록(관리자 API)
 *   node automation/ai-runner/sites.js prep --spec spec.json [--out spec.json] [--job N --task N] [--no-enhance] [--no-gen]
 *                                                                              # 사진 준비(v3): 작은 사진(가로 900px 미만)은 fal.ai 로 업스케일 → /a/ 업로드 → 스펙 URL 교체(photo_meta 기록),
 *                                                                              #   갤러리가 3장 미만이면 업종 분위기 이미지를 생성해 gallery_generated 에 채운다(사람·글자 없음, 화면에 "연출 이미지" 표시). FAL_KEY 없으면 크기 보고만
 *
 * 환경변수: BIZHIGHER_ADMIN_PASSWORD(spec·build), CLOUDFLARE_API_TOKEN·CLOUDFLARE_ACCOUNT_ID(deploy), SITES_PROJECT(기본 bizhigher-sites)
 */
'use strict';
const fs = require('fs'); const path = require('path'); const { execSync } = require('child_process');
const { render } = require('../sites/render.js');

const args = process.argv.slice(2); const cmd = args[0];
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : d; };
const BASE = (process.env.BIZHIGHER_ADMIN_URL || 'https://bizhigher.com').replace(/\/$/, '');
const PROJECT = process.env.SITES_PROJECT || 'bizhigher-sites';
/** 템플릿·라우터·CLI 의 현재 git 리비전 — 바뀌면 전 고객 사이트를 다시 배포해야 한다 */
function templateRev() {
  try { return execSync('git log -1 --format=%h -- automation/sites automation/ai-runner/sites.js', { cwd: path.join(__dirname, '../..'), encoding: 'utf8' }).trim() || 'unknown'; } catch { return 'unknown'; }
}

let cookie = '';
async function login() {
  const pw = (process.env.BIZHIGHER_ADMIN_PASSWORD || '').trim();
  if (!pw) throw new Error('BIZHIGHER_ADMIN_PASSWORD 가 없습니다');
  const r = await fetch(BASE + '/admin/login', { method: 'POST', body: new URLSearchParams({ password: pw }), redirect: 'manual' });
  const sc = r.headers.get('set-cookie') || '';
  const m = /bh_admin=([^;]+)/.exec(sc); if (!m) throw new Error(`관리자 로그인 실패 (${r.status})`);
  cookie = 'bh_admin=' + m[1];
}
async function api(p, body) {
  if (!cookie) await login();
  const r = await fetch(`${BASE}/admin/api/${p}`, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', Cookie: cookie, 'sec-fetch-mode': 'cors' }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.ok === false) throw new Error(`${p}: ${j.error || r.status}`);
  return j;
}
const CF = 'https://api.cloudflare.com/client/v4';
const cfHeaders = () => ({ Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`, 'Content-Type': 'application/json' });
const PREVIEW_ZONE = process.env.SITES_ZONE || 'bizhigher.com';
/** {slug}.sites.{zone} 을 Pages 프로젝트 도메인으로 추가하고 DNS CNAME 을 만든다. 반환: 상태 문자열 */
async function ensurePreviewDomain(slug) {
  const host = `${slug}.sites.${PREVIEW_ZONE}`; const acct = process.env.CLOUDFLARE_ACCOUNT_ID;
  const out = [];
  const r = await fetch(`${CF}/accounts/${acct}/pages/projects/${PROJECT}/domains`, { method: 'POST', headers: cfHeaders(), body: JSON.stringify({ name: host }) }).catch(() => null);
  const j = r ? await r.json().catch(() => ({})) : {};
  const dup = r && !r.ok && JSON.stringify(j).includes('already'); // 8000013 등 "already exists"
  out.push(r && (r.ok || dup) ? 'Pages 도메인 OK' : `Pages 도메인 실패 ${r ? r.status : 'network'} ${(j.errors || []).map((e) => e.message).join(';').slice(0, 120)}`);
  // DNS: zone id → CNAME 존재 확인 → 없으면 생성 (proxied)
  const z = await fetch(`${CF}/zones?name=${PREVIEW_ZONE}`, { headers: cfHeaders() }).then((x) => x.json()).catch(() => null);
  const zoneId = z && z.result && z.result[0] && z.result[0].id;
  if (!zoneId) { out.push('DNS: zone 조회 불가(토큰에 Zone Read 필요)'); return out.join(' · '); }
  const ex = await fetch(`${CF}/zones/${zoneId}/dns_records?type=CNAME&name=${host}`, { headers: cfHeaders() }).then((x) => x.json()).catch(() => null);
  if (ex && ex.result && ex.result.length) { out.push('DNS OK'); return out.join(' · '); }
  const c = await fetch(`${CF}/zones/${zoneId}/dns_records`, { method: 'POST', headers: cfHeaders(), body: JSON.stringify({ type: 'CNAME', name: host, content: `${PROJECT}.pages.dev`, proxied: true, ttl: 1 }) }).catch(() => null);
  const cj = c ? await c.json().catch(() => ({})) : {};
  out.push(c && c.ok ? 'DNS 생성' : `DNS 실패 ${(cj.errors || []).map((e) => e.message).join(';').slice(0, 120)}`);
  return out.join(' · ');
}
/* ---------- 사진 준비(prep) 헬퍼 ---------- */
const FAL = (model, body) => fetch('https://fal.run/' + model, { method: 'POST', headers: { Authorization: 'Key ' + process.env.FAL_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(async (r) => { if (!r.ok) throw new Error('fal.ai ' + r.status + ': ' + (await r.text()).slice(0, 200)); return r.json(); });
/** JPEG·PNG·WebP 머리에서 가로·세로 읽기 (라이브러리 없이) */
function imageSize(buf) {
  if (buf[0] === 0x89 && buf[1] === 0x50) return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20), type: 'png' };
  if (buf[0] === 0xff && buf[1] === 0xd8) { let i = 2; while (i < buf.length) { if (buf[i] !== 0xff) { i++; continue; } const m = buf[i + 1]; if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7), type: 'jpeg' }; i += 2 + buf.readUInt16BE(i + 2); } }
  if (buf.slice(0, 4).toString() === 'RIFF' && buf.slice(8, 12).toString() === 'WEBP') { const c = buf.slice(12, 16).toString(); if (c === 'VP8X') return { w: 1 + buf.readUIntLE(24, 3), h: 1 + buf.readUIntLE(27, 3), type: 'webp' }; if (c === 'VP8 ') return { w: buf.readUInt16LE(26) & 0x3fff, h: buf.readUInt16LE(28) & 0x3fff, type: 'webp' }; }
  return null;
}
async function uploadFile(file, { job, task, label } = {}) {
  if (!cookie) await login();
  const ext = (file.split('.').pop() || '').toLowerCase();
  const ct = { png: 'image/png', webp: 'image/webp' }[ext] || 'image/jpeg';
  const fd = new FormData();
  fd.append('file', new Blob([fs.readFileSync(file)], { type: ct }), path.basename(file));
  if (job) fd.append('job_id', String(job)); if (task) fd.append('task_id', String(task)); fd.append('label', label || path.basename(file));
  const res = await fetch(BASE + '/admin/api/assets', { method: 'POST', headers: { cookie }, body: fd });
  const j = await res.json().catch(() => ({}));
  if (!j.ok) throw new Error('업로드 실패: ' + (j.error || res.status));
  return j.url;
}
async function fetchBuf(url) { const r = await fetch(url); if (!r.ok) throw new Error(`${url} → ${r.status}`); return Buffer.from(await r.arrayBuffer()); }
/** 스펙의 사진 자리 전부 — [객체, 키] 쌍으로 */
function photoSlots(spec) {
  const out = [];
  if (spec.hero && spec.hero.photo) out.push([spec.hero, 'photo', 'hero']);
  if (spec.about && spec.about.photo) out.push([spec.about, 'photo', 'about']);
  (spec.gallery || []).forEach((u, i) => { if (u) out.push([spec.gallery, i, 'gallery' + (i + 1)]); });
  (spec.services || []).forEach((x, i) => { if (x && x.photo) out.push([x, 'photo', 'service' + (i + 1)]); });
  return out;
}
const AMBIANCE = (spec) => `interior of a ${spec.category_en || spec.category || 'small local business'}, ${spec.address && spec.address.city ? 'in ' + spec.address.city + ', ' : ''}warm natural light, clean and inviting, editorial photography, shallow depth of field, no people, no text, no logos, photorealistic`;

function writeSite(outDir, slug, files) {
  const dir = path.join(outDir, slug); fs.mkdirSync(dir, { recursive: true });
  for (const [name, body] of Object.entries(files)) { const p = path.join(dir, name); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, body); }
}
/** 스펙 깊은 병합(patch): 객체는 재귀, 배열·원시값은 교체, null 은 삭제 */
function deepPatch(base, patch) {
  const out = Array.isArray(base) ? [...base] : { ...(base || {}) };
  for (const [k, v] of Object.entries(patch || {})) {
    if (v === null) delete out[k];
    else if (v && typeof v === 'object' && !Array.isArray(v) && out[k] && typeof out[k] === 'object' && !Array.isArray(out[k])) out[k] = deepPatch(out[k], v);
    else out[k] = v;
  }
  return out;
}
/** 두 스펙의 바뀐 키 경로 목록 (요약용) */
function diffKeys(a, b, prefix = '') {
  const keys = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]); const out = [];
  for (const k of keys) {
    const x = a ? a[k] : undefined, y = b ? b[k] : undefined; const pth = prefix ? prefix + '.' + k : k;
    if (JSON.stringify(x) === JSON.stringify(y)) continue;
    if (x && y && typeof x === 'object' && typeof y === 'object' && !Array.isArray(x) && !Array.isArray(y)) out.push(...diffKeys(x, y, pth));
    else out.push(pth + (x === undefined ? ' (추가)' : y === undefined ? ' (삭제)' : Array.isArray(y) ? ` (${(x || []).length}→${y.length}개)` : ''));
  }
  return out;
}

(async () => {
  if (cmd === 'spec') {
    const job = Number(opt('job')); const file = opt('file');
    if (!job || !file) throw new Error('--job N --file spec.json 이 필요합니다');
    const spec = JSON.parse(fs.readFileSync(file, 'utf8'));
    const r = await api('sites', { job_id: job, spec });
    console.log(`저장: ${r.slug} (v${r.version}) → 미리보기 ${r.preview_url}${r.domain ? ' · 도메인 ' + r.domain : ''}${r.changed && r.changed.length ? '\n  바뀐 키: ' + r.changed.join(', ') : ''}`);
    console.log(`  (배포 후 항상 열리는 주소: https://${PROJECT}.pages.dev/${r.slug}/ — 서브도메인은 deploy 가 등록)`);
    return;
  }
  if (cmd === 'patch') {
    const job = Number(opt('job')); const file = opt('file');
    if (!job || !file) throw new Error('--job N --file patch.json 이 필요합니다');
    const patch = JSON.parse(fs.readFileSync(file, 'utf8'));
    const cur = await api('sites/' + job); if (!cur || !cur.spec) throw new Error('저장된 스펙이 없습니다 — spec 명령으로 먼저 만드세요');
    const next = deepPatch(cur.spec, patch);
    const r = await api('sites', { job_id: job, spec: next, note: opt('note', '부분 패치') });
    console.log(`패치: ${r.slug} v${r.version} — 바뀐 키: ${(r.changed || diffKeys(cur.spec, next)).join(', ') || '없음'}`);
    return;
  }
  if (cmd === 'diff') {
    const job = Number(opt('job')); if (!job) throw new Error('--job N 필요');
    const cur = await api('sites/' + job); if (!cur || !cur.spec) throw new Error('저장된 스펙이 없습니다');
    let other = null, label = '';
    if (opt('file')) { other = JSON.parse(fs.readFileSync(opt('file'), 'utf8')); label = '파일 vs 저장본 v' + cur.version; }
    else { const h = await api('sites/' + cur.slug + '/versions'); const prev = (h.versions || []).find((v) => v.version < cur.version); other = prev ? prev.spec : {}; label = `v${prev ? prev.version : 0} → v${cur.version}`; }
    const keys = opt('file') ? diffKeys(cur.spec, other) : diffKeys(other, cur.spec);
    console.log(`${label}: ${keys.length ? keys.join(', ') : '차이 없음'}`);
    return;
  }
  if (cmd === 'leads') {
    const job = Number(opt('job')); if (!job) throw new Error('--job N 필요');
    const cur = await api('sites/' + job); if (!cur) throw new Error('사이트 없음');
    const r = await api('sites/' + cur.slug + '/leads');
    for (const l of r.leads || []) console.log(`${l.created_at} · ${l.name} · ${l.phone || '-'} · ${l.email || '-'} · ${String(l.message || '').replace(/\s+/g, ' ').slice(0, 120)}`);
    if (!(r.leads || []).length) console.log('문의 없음');
    return;
  }
  if (cmd === 'render') {
    const spec = JSON.parse(fs.readFileSync(opt('spec'), 'utf8')); const out = opt('out', 'preview');
    const { slug, files } = render(spec, { noindex: true });
    writeSite(out, slug, files);
    console.log(`렌더: ${path.join(out, slug, 'index.html')}`);
    return;
  }
  if (cmd === 'build') {
    const out = opt('out', 'sites-build');
    const { sites } = await api('sites');
    fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out, { recursive: true });
    const domains = {};
    for (const s of sites) {
      const spec = typeof s.spec === 'string' ? JSON.parse(s.spec) : s.spec;
      spec.slug = s.slug;
      const origin = s.domain && s.live ? `https://${s.domain}` : `https://${s.slug}.sites.bizhigher.com`;
      const { files } = render(spec, { origin, noindex: !(s.domain && s.live) });
      writeSite(out, s.slug, files);
      if (s.domain) domains[s.domain.toLowerCase()] = s.slug;
    }
    const worker = fs.readFileSync(path.join(__dirname, '../sites/worker.js'), 'utf8').replace(/\/\*__DOMAINS__\*\/\{\}\/\*__END__\*\//, JSON.stringify(domains));
    fs.writeFileSync(path.join(out, '_worker.js'), worker);
    fs.writeFileSync(path.join(out, 'index.html'), '<!doctype html><meta charset="utf-8"><meta name="robots" content="noindex"><title>BizHigher Sites</title>');
    // 404.html 이 없으면 Pages 가 SPA 모드로 모든 미지 경로에 루트 index.html 을 200 으로 준다 → 반드시 둔다
    fs.writeFileSync(path.join(out, '404.html'), '<!doctype html><meta charset="utf-8"><meta name="robots" content="noindex"><title>Not found</title><p style="font-family:sans-serif;padding:40px">페이지를 찾을 수 없습니다.</p>');
    console.log(`빌드: 사이트 ${sites.length}곳, 도메인 ${Object.keys(domains).length}개 → ${out}/`);
    return;
  }
  if (cmd === 'deploy') {
    const dir = opt('dir', 'sites-build');
    if (!process.env.CLOUDFLARE_API_TOKEN || !process.env.CLOUDFLARE_ACCOUNT_ID) throw new Error('CLOUDFLARE_API_TOKEN·CLOUDFLARE_ACCOUNT_ID 가 없습니다 (환경 비밀에 넣으세요 — docs/customer-sites-design-ko.md §6)');
    if (!fs.existsSync(path.join(dir, '_worker.js'))) throw new Error(`${dir}/_worker.js 가 없습니다 — build 먼저`);
    const outp = execSync(`npx --yes wrangler@3 pages deploy "${dir}" --project-name "${PROJECT}" --branch main --commit-dirty=true`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    const m = /https:\/\/[a-z0-9.-]+\.pages\.dev/.exec(outp);
    console.log(`배포 완료: ${PROJECT}${m ? ' · ' + m[0] : ''}`);
    try { await api('settings', { settings: { sitesDeployedRev: templateRev(), sitesDeployedAt: new Date().toISOString(), sitesDirty: false } }); } catch (e) { console.log('  (배포 리비전 기록 실패: ' + e.message + ')'); }
    // 임시 주소 {slug}.sites.bizhigher.com — Pages 커스텀 도메인 + DNS CNAME (이미 있으면 그대로). 실패해도 pages.dev 경로는 항상 열린다
    const slugs = fs.readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
    for (const slug of slugs) console.log(`  ${slug}: ${await ensurePreviewDomain(slug)} · https://${PROJECT}.pages.dev/${slug}/`);
    return;
  }
  if (cmd === 'prep') {
    const file = opt('spec'); if (!file) throw new Error('--spec spec.json 필요');
    const spec = JSON.parse(fs.readFileSync(file, 'utf8')); const out = opt('out', file);
    const job = opt('job'), task = opt('task'); const hasFal = !!process.env.FAL_KEY;
    const tmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'prep-'));
    spec.photo_meta = spec.photo_meta || {};
    const report = { checked: 0, enhanced: 0, generated: 0, skipped: [], errors: [] };
    const MIN_W = Number(opt('min-width', '900'));
    if (!args.includes('--no-enhance')) {
      for (const [obj, key, label] of photoSlots(spec)) {
        const url = obj[key]; if (!/^https?:\/\//.test(url)) continue;
        if (spec.photo_meta[url] && spec.photo_meta[url].from) { report.skipped.push(label + ': 이미 보정본'); continue; }
        try {
          const buf = await fetchBuf(url); const sz = imageSize(buf); report.checked++;
          if (!sz) { report.skipped.push(label + ': 크기 판독 불가'); continue; }
          spec.photo_meta[url] = { w: sz.w, h: sz.h };
          if (sz.w >= MIN_W) { continue; }
          if (!hasFal) { report.skipped.push(`${label}: ${sz.w}px — FAL_KEY 없어 업스케일 생략`); continue; }
          const model = opt('model', 'fal-ai/aura-sr');
          const j = await FAL(model, { image_url: url, upscaling_factor: 4 });
          const img = j.image || (j.images && j.images[0]); if (!img || !img.url) throw new Error('fal 응답에 이미지 없음');
          const local = path.join(tmp, label + '.jpg'); fs.writeFileSync(local, await fetchBuf(img.url));
          const nu = await uploadFile(local, { job, task, label: `보정 ${label} (${sz.w}→${img.width || '?'}px)` });
          spec.photo_meta[nu] = { w: img.width || sz.w * 4, h: img.height || sz.h * 4, from: url };
          obj[key] = nu; report.enhanced++;
        } catch (e) { report.errors.push(`${label}: ${e.message}`); }
      }
    }
    const gal = (spec.gallery || []).filter(Boolean); const gen = spec.gallery_generated || [];
    if (!args.includes('--no-gen') && gal.length + gen.length < 3) {
      if (!hasFal) report.skipped.push(`갤러리 ${gal.length}장 — FAL_KEY 없어 분위기 이미지 생성 생략`);
      else for (let n = gal.length + gen.length; n < 4; n++) {
        try {
          const j = await FAL(opt('gen-model', 'fal-ai/flux/schnell'), { prompt: AMBIANCE(spec), image_size: 'landscape_4_3', num_images: 1, output_format: 'jpeg', enable_safety_checker: true, seed: 1000 + n });
          const img = j.images && j.images[0]; if (!img || !img.url) throw new Error('fal 응답에 이미지 없음');
          const local = path.join(tmp, `ambiance${n}.jpg`); fs.writeFileSync(local, await fetchBuf(img.url));
          gen.push(await uploadFile(local, { job, task, label: `분위기 이미지 ${n + 1} (생성)` })); report.generated++;
        } catch (e) { report.errors.push('생성: ' + e.message); break; }
      }
      spec.gallery_generated = gen;
    }
    fs.writeFileSync(out, JSON.stringify(spec, null, 2));
    console.log(JSON.stringify({ out, ...report }));
    return;
  }
  if (cmd === 'needs-deploy') {
    const { sites } = await api('sites');
    if (!sites.length) { console.log('no — 등록된 사이트 없음'); return; }
    const cur = templateRev();
    const st = await api('settings');
    const last = (st.settings || {}).sitesDeployedRev || '';
    const dirty = !!(st.settings || {}).sitesDirty;
    console.log(cur !== last ? `yes — 템플릿 리비전 ${cur} (마지막 배포 ${last || '기록 없음'})` : dirty ? 'yes — 관리자에서 스펙이 바뀜(배포 대기)' : `no — 템플릿 리비전 ${cur} 그대로`);
    return;
  }
  if (cmd === 'domains') {
    if (!process.env.CLOUDFLARE_API_TOKEN || !process.env.CLOUDFLARE_ACCOUNT_ID) throw new Error('CLOUDFLARE_API_TOKEN·CLOUDFLARE_ACCOUNT_ID 가 없습니다');
    const { sites } = await api('sites');
    for (const s of sites) console.log(`  ${s.slug}: ${await ensurePreviewDomain(s.slug)}`);
    if (!sites.length) console.log('등록된 사이트 없음');
    return;
  }
  console.log('사용법: sites.js spec|patch|diff|leads|build|deploy|render|domains|needs-deploy|prep  (파일 머리 주석 참고)'); process.exit(1);
})().catch((e) => { console.error('오류:', e.message); process.exit(1); });
