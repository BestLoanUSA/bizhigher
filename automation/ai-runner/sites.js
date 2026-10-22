#!/usr/bin/env node
/**
 * 고객 사이트 — 스펙 저장·빌드·배포 (루틴·David 세션 공용). 설계: docs/customer-sites-design-ko.md
 *
 *   node automation/ai-runner/sites.js spec --job 28 --file spec.json         # 스펙 저장(업서트) → slug·미리보기 주소
 *   node automation/ai-runner/sites.js build [--out sites-build]              # 관리자 API의 모든 사이트를 렌더 + _worker.js
 *   node automation/ai-runner/sites.js deploy [--dir sites-build]             # wrangler pages deploy (CLOUDFLARE_API_TOKEN·CLOUDFLARE_ACCOUNT_ID 필요)
 *   node automation/ai-runner/sites.js render --spec spec.json --out preview  # 로컬 확인용 (관리자 API 없이)
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
function writeSite(outDir, slug, files) {
  const dir = path.join(outDir, slug); fs.mkdirSync(dir, { recursive: true });
  for (const [name, body] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), body);
}

(async () => {
  if (cmd === 'spec') {
    const job = Number(opt('job')); const file = opt('file');
    if (!job || !file) throw new Error('--job N --file spec.json 이 필요합니다');
    const spec = JSON.parse(fs.readFileSync(file, 'utf8'));
    const r = await api('sites', { job_id: job, spec });
    console.log(`저장: ${r.slug} (v${r.version}) → 미리보기 ${r.preview_url}${r.domain ? ' · 도메인 ' + r.domain : ''}`);
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
    return;
  }
  console.log('사용법: sites.js spec|build|deploy|render  (파일 머리 주석 참고)'); process.exit(1);
})().catch((e) => { console.error('오류:', e.message); process.exit(1); });
