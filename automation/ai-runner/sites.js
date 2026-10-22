#!/usr/bin/env node
/**
 * 고객 사이트 — 스펙 저장·빌드·배포 (루틴·David 세션 공용). 설계: docs/customer-sites-design-ko.md
 *
 *   node automation/ai-runner/sites.js spec --job 28 --file spec.json         # 스펙 저장(업서트) → slug·미리보기 주소
 *   node automation/ai-runner/sites.js build [--out sites-build]              # 관리자 API의 모든 사이트를 렌더 + _worker.js
 *   node automation/ai-runner/sites.js deploy [--dir sites-build]             # wrangler pages deploy (CLOUDFLARE_API_TOKEN·CLOUDFLARE_ACCOUNT_ID 필요)
 *   node automation/ai-runner/sites.js render --spec spec.json --out preview  # 로컬 확인용 (관리자 API 없이)
 *   node automation/ai-runner/sites.js domains                                # 모든 사이트의 {slug}.sites.bizhigher.com 등록 상태 확인·보정 (배포 없이)
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
    console.log(`  (배포 후 항상 열리는 주소: https://${PROJECT}.pages.dev/${r.slug}/ — 서브도메인은 deploy 가 등록)`);
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
    // 임시 주소 {slug}.sites.bizhigher.com — Pages 커스텀 도메인 + DNS CNAME (이미 있으면 그대로). 실패해도 pages.dev 경로는 항상 열린다
    const slugs = fs.readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
    for (const slug of slugs) console.log(`  ${slug}: ${await ensurePreviewDomain(slug)} · https://${PROJECT}.pages.dev/${slug}/`);
    return;
  }
  if (cmd === 'domains') {
    if (!process.env.CLOUDFLARE_API_TOKEN || !process.env.CLOUDFLARE_ACCOUNT_ID) throw new Error('CLOUDFLARE_API_TOKEN·CLOUDFLARE_ACCOUNT_ID 가 없습니다');
    const { sites } = await api('sites');
    for (const s of sites) console.log(`  ${s.slug}: ${await ensurePreviewDomain(s.slug)}`);
    if (!sites.length) console.log('등록된 사이트 없음');
    return;
  }
  console.log('사용법: sites.js spec|build|deploy|render|domains  (파일 머리 주석 참고)'); process.exit(1);
})().catch((e) => { console.error('오류:', e.message); process.exit(1); });
