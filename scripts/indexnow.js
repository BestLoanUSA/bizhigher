/**
 * IndexNow 알림 — main에 push된 변경분 중 바뀐 페이지 URL을 Bing·Yandex 등에 즉시 알린다.
 * ChatGPT 검색은 Bing 색인을 쓰므로 새 글·수정 글이 AI 검색에 빨리 반영된다.
 *
 * 사용법: node scripts/indexnow.js <before-sha> <after-sha> [--dry-run] [--no-wait]
 *   GitHub Actions(.github/workflows/indexnow.yml)가 push마다 실행한다.
 *
 * 어떤 URL을 보내나:
 *   content/blog/*.md       → 그 글 + /blog/
 *   content/services/*.md   → 그 서비스 페이지
 *   data/reports·surveys    → /data/ 전체
 *   그 밖의 사이트 전역 변경(build.js, services.json, style.css 등) → 사이트맵 전체
 *   (사이트가 60쪽 안팎이라 전역 변경 때 전체를 보내도 IndexNow 한도 10,000에 한참 못 미친다)
 * Cloudflare 배포(1~2분)가 끝난 뒤 보내야 하므로, 보낼 URL이 실제로 200을 돌려줄 때까지 기다린다.
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const HOST = 'bizhigher.com';
const ORIGIN = `https://${HOST}`;
const [before, after] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const DRY = process.argv.includes('--dry-run');
const NO_WAIT = process.argv.includes('--no-wait');
const KEY = fs.readFileSync(path.join(ROOT, 'src', 'indexnow-key.txt'), 'utf8').trim();

function changedFiles() {
  // 첫 push(before가 0000…)나 비교 불가면 전역 변경으로 취급
  if (!before || /^0+$/.test(before)) return null;
  try {
    return execSync(`git diff --name-only ${before} ${after || 'HEAD'}`, { cwd: ROOT }).toString().split('\n').filter(Boolean);
  } catch (e) {
    return null;
  }
}

function sitemapUrls() {
  const xml = fs.readFileSync(path.join(ROOT, 'dist', 'sitemap.xml'), 'utf8');
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
}

function blogSlug(file) {
  const p = path.join(ROOT, file);
  if (!fs.existsSync(p)) return null; // 삭제된 글은 알리지 않는다
  const m = fs.readFileSync(p, 'utf8').match(/^slug:\s*(.+)$/m);
  return (m ? m[1] : path.basename(file, '.md')).trim();
}

function urlsFor(files) {
  const all = sitemapUrls();
  if (!files) return all;
  const urls = new Set();
  let global = false;
  for (const f of files) {
    if (/^content\/blog\/img\//.test(f)) continue;
    if (/^content\/blog\/[^/]+\.md$/.test(f)) {
      const slug = blogSlug(f);
      if (slug) urls.add(`${ORIGIN}/blog/${slug}/`);
      urls.add(`${ORIGIN}/blog/`);
    } else if (/^content\/blog-calendar\.md$/.test(f)) {
      // 운영 메모 — 페이지가 아니다
    } else if (/^content\/services\/([^/]+)\.md$/.test(f)) {
      urls.add(`${ORIGIN}/service/${f.match(/^content\/services\/([^/]+)\.md$/)[1]}/`);
    } else if (/^data\/(reports|surveys)\//.test(f)) {
      all.filter((u) => u.startsWith(`${ORIGIN}/data/`)).forEach((u) => urls.add(u));
    } else if (/^(build\.js|data\/services\.json|src\/(style\.css|og-image\.png))$/.test(f)) {
      global = true;
    }
    // 그 밖(functions/, automation/, docs/, dist/, scripts/, src/og 등)은 공개 페이지 내용과 무관하거나 위에서 이미 반영된다
  }
  if (global) return all;
  // 사이트맵에 있는 URL만 보낸다 (noindex·삭제 페이지 제외)
  return [...urls].filter((u) => all.includes(u));
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitLive(urls) {
  // 새 글은 배포가 끝나야 200이 된다. 최대 8분 기다린다.
  const deadline = Date.now() + 8 * 60 * 1000;
  for (const u of urls) {
    for (;;) {
      const res = await fetch(u, { method: 'GET', redirect: 'manual' }).catch(() => null);
      if (res && res.status === 200) break;
      if (Date.now() > deadline) throw new Error(`배포 대기 시간 초과: ${u} (${res ? res.status : 'network error'})`);
      await sleep(15000);
    }
  }
}

(async () => {
  const urls = urlsFor(changedFiles());
  if (!urls.length) {
    console.log('알릴 페이지 변경이 없습니다.');
    return;
  }
  console.log(`IndexNow 대상 ${urls.length}개:\n  ${urls.join('\n  ')}`);
  const body = { host: HOST, key: KEY, keyLocation: `${ORIGIN}/${KEY}.txt`, urlList: urls };
  if (DRY) {
    console.log('(dry-run) 전송하지 않음');
    return;
  }
  if (!NO_WAIT) {
    // 기존 페이지 수정은 200이 계속 나오므로 배포 시간만큼은 무조건 기다린다
    await sleep(120000);
    await waitLive([`${ORIGIN}/${KEY}.txt`, ...urls]);
  }
  const res = await fetch('https://api.indexnow.org/indexnow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(body),
  });
  console.log(`IndexNow 응답: ${res.status} ${res.statusText}`);
  // 200 OK, 202 Accepted(키 확인 대기) 둘 다 정상
  if (res.status !== 200 && res.status !== 202) {
    console.error(await res.text());
    process.exit(1);
  }
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
