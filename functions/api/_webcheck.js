/**
 * 업소 자체 웹사이트 단건 점검 — free-audit 리포트에 같이 보여줄 웹사이트 진단.
 *
 * marketingkorean 저장소의 scripts/webcheck.js(분기별 배치 조사기)와 같은 판정
 * 로직을 Cloudflare Workers 런타임에서 "업소 1곳, 즉시 1회"로 쓸 수 있게 옮긴
 * 것이다. 파일시스템 읽기, 동시성 풀, 재시도 로직 등 배치 전용 부분은 뺐다 —
 * 여기는 사람이 폼을 제출하고 기다리는 요청 경로라 지연시간이 중요하다.
 *
 * 두 조사기는 같은 User-Agent(BizHigherResearchBot)를 쓴다. 업소 사이트
 * robots.txt가 이 봇을 이미 허용/차단해뒀다면 어느 쪽에서 와도 같은 대우를
 * 받아야 하기 때문이다.
 */

const UA = 'BizHigherResearchBot/1.0 (+https://bizhigher.com/data/)';
const UA_TOKEN = 'bizhigherresearchbot';

const AI_BOTS = [
  'GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'anthropic-ai',
  'PerplexityBot', 'CCBot', 'Google-Extended', 'Applebot-Extended', 'Bytespider',
];

const ORDER_HOSTS = {
  toasttab: '토스트', chownow: 'ChowNow', doordash: 'DoorDash', ubereats: 'Uber Eats',
  grubhub: 'Grubhub', slicelife: 'Slice', clover: 'Clover', squareup: '스퀘어',
  resy: 'Resy', opentable: 'OpenTable', tocktix: 'Tock', fresha: 'Fresha',
  booksy: 'Booksy', vagaro: 'Vagaro', mindbodyonline: 'Mindbody',
  calendly: 'Calendly', acuityscheduling: 'Acuity', zocdoc: 'Zocdoc',
};
const SOCIAL_HOSTS = ['facebook.com', 'instagram.com', 'youtube.com', 'tiktok.com', 'twitter.com', 'x.com', 'pf.kakao.com', 'blog.naver.com', 'yelp.com'];

/* ---------- robots.txt ---------- */

function parseRobots(txt) {
  const groups = [];
  let cur = null;
  let lastWasAgent = false;
  txt.split(/\r?\n/).forEach((raw) => {
    const line = raw.replace(/#.*$/, '').trim();
    if (!line) return;
    const i = line.indexOf(':');
    if (i < 0) return;
    const key = line.slice(0, i).trim().toLowerCase();
    const val = line.slice(i + 1).trim();
    if (key === 'user-agent') {
      if (!cur || !lastWasAgent) { cur = { agents: [], rules: [] }; groups.push(cur); }
      cur.agents.push(val.toLowerCase());
      lastWasAgent = true;
    } else if (cur && (key === 'disallow' || key === 'allow')) {
      cur.rules.push({ type: key, path: val });
      lastWasAgent = false;
    }
  });
  return groups;
}

function blocksRoot(groups, agent) {
  const a = agent.toLowerCase();
  const g = groups.find((x) => x.agents.includes(a)) || groups.find((x) => x.agents.includes('*'));
  if (!g) return false;
  const disallowAll = g.rules.some((r) => r.type === 'disallow' && (r.path === '/' || r.path === '/*'));
  const allowRoot = g.rules.some((r) => r.type === 'allow' && r.path === '/');
  return disallowAll && !allowRoot;
}

/* ---------- 가져오기 ---------- */

async function grab(url, { timeoutMs = 8000, textLimit = 1024 * 1024 } = {}) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  const t0 = Date.now();
  try {
    const res = await fetch(url, {
      signal: ctl.signal,
      redirect: 'follow',
      headers: { 'User-Agent': UA, Accept: 'text/html,text/plain,*/*' },
    });
    const buf = new Uint8Array(await res.arrayBuffer());
    return {
      ok: res.ok,
      status: res.status,
      finalUrl: res.url || url,
      contentType: res.headers.get('content-type') || '',
      bytes: buf.length,
      ms: Date.now() - t0,
      text: new TextDecoder().decode(buf.subarray(0, textLimit)),
    };
  } catch (e) {
    return { ok: false, status: 0, error: e.name === 'AbortError' ? 'timeout' : String(e.message || e), ms: Date.now() - t0 };
  } finally {
    clearTimeout(timer);
  }
}

const CHALLENGE = /just a moment|checking your browser|cf-browser-verification|cf_chl_|attention required|ddos-guard|incapsula|please enable javascript to/i;
function looksLikeChallenge(html) {
  if (!html) return true;
  if (CHALLENGE.test(html)) return true;
  const text = html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return html.length < 2000 && text.length < 200;
}

function looksLikeLlmsTxt(res) {
  if (!res.ok || !res.text) return false;
  const t = res.text.trim();
  if (t.length < 20) return false;
  if (/<html|<!doctype|<body|<script/i.test(t)) return false;
  const ct = String(res.contentType || '').toLowerCase();
  if (ct && !/text\/(plain|markdown)/.test(ct)) return false;
  return /^#\s+\S/.test(t) || /\]\(https?:\/\//.test(t);
}

/* ---------- HTML에서 읽는 것 ---------- */

function guessPlatform(html, finalUrl) {
  const gen = (html.match(/<meta[^>]+name=["']generator["'][^>]+content=["']([^"']+)/i) || [])[1] || '';
  const g = gen.toLowerCase();
  if (/wordpress/.test(g)) return 'WordPress';
  if (/wix/.test(g)) return 'Wix';
  if (/squarespace/.test(g)) return 'Squarespace';
  if (/webflow/.test(g)) return 'Webflow';
  if (/shopify/.test(g)) return 'Shopify';
  if (/duda/.test(g)) return 'Duda';
  const h = html.toLowerCase() + ' ' + String(finalUrl).toLowerCase();
  if (/\/wp-content\/|\/wp-includes\//.test(h)) return 'WordPress';
  if (/parastorage\.com|wixstatic\.com/.test(h)) return 'Wix';
  if (/squarespace-cdn|static1\.squarespace/.test(h)) return 'Squarespace';
  if (/assets\.website-files\.com|cdn\.prod\.website-files\.com/.test(h)) return 'Webflow';
  if (/cdn\.shopify\.com/.test(h)) return 'Shopify';
  if (/godaddysites\.com|img1\.wsimg\.com/.test(h)) return 'GoDaddy';
  if (/weebly(cloud)?\.com/.test(h)) return 'Weebly';
  return '기타·직접 제작';
}

function readHtml(html, finalUrl) {
  const out = {};
  out.hasViewport = /<meta[^>]+name=["']viewport["']/i.test(html);
  out.hasOg = /<meta[^>]+property=["']og:(title|image)["']/i.test(html);
  out.hasMetaDesc = /<meta[^>]+name=["']description["'][^>]+content=["'][^"']{10,}/i.test(html);

  const ld = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  out.schemaTypes = [];
  ld.forEach((m) => {
    try {
      const j = JSON.parse(m[1].trim());
      const walk = (n) => {
        if (Array.isArray(n)) return n.forEach(walk);
        if (n && typeof n === 'object') {
          if (n['@type']) [].concat(n['@type']).forEach((t) => out.schemaTypes.push(String(t)));
          if (n['@graph']) walk(n['@graph']);
        }
      };
      walk(j);
    } catch { /* 깨진 JSON-LD도 흔하다 */ }
  });
  out.hasSchema = out.schemaTypes.length > 0;
  out.hasLocalBusinessSchema = out.schemaTypes.some((t) => /LocalBusiness|Restaurant|Store|Dentist|MedicalBusiness|HealthAndBeautyBusiness|AutoRepair|School/i.test(t));

  const body = html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<[^>]+>/g, ' ');
  out.showsHours = /영업\s*시간|운영\s*시간|Hours?\s*(of\s*Operation)?\b|Mon(day)?\s*[-–~]\s*(Fri|Sat|Sun)|월\s*[-–~]\s*(금|토|일)/i.test(body);

  const hrefs = [...html.matchAll(/href=["']([^"']+)["']/gi)].map((m) => m[1].toLowerCase());
  out.orderingVia = [...new Set(hrefs.flatMap((h) => Object.keys(ORDER_HOSTS).filter((k) => h.includes(k)).map((k) => ORDER_HOSTS[k])))];
  out.socialVia = [...new Set(SOCIAL_HOSTS.filter((s) => hrefs.some((h) => h.includes(s))))];
  out.platform = guessPlatform(html, finalUrl);
  return out;
}

/* ---------- 업소 한 곳, 즉시 1회 ---------- */

export async function webcheckSite(websiteUrl) {
  let origin;
  try { origin = new URL(websiteUrl).origin; } catch { return { checked: true, reachable: false, error: 'bad-url' }; }

  const rb = await grab(`${origin}/robots.txt`, { timeoutMs: 6000, textLimit: 64 * 1024 });
  const hasRobots = !!(rb.ok && rb.text && /user-agent/i.test(rb.text));
  const groups = hasRobots ? parseRobots(rb.text) : [];
  const aiBlocked = AI_BOTS.filter((b) => hasRobots && blocksRoot(groups, b));

  const lm = await grab(`${origin}/llms.txt`, { timeoutMs: 4000, textLimit: 4 * 1024 });
  const hasLlmsTxt = looksLikeLlmsTxt(lm);

  if (hasRobots && blocksRoot(groups, UA_TOKEN)) {
    return { checked: true, reachable: false, skipped: 'robots-disallow', hasRobots, aiBlocked, blocksAnyAI: aiBlocked.length > 0, hasLlmsTxt };
  }

  const pg = await grab(websiteUrl, { timeoutMs: 9000 });
  if (!pg.ok) {
    return { checked: true, reachable: false, error: pg.error || `http-${pg.status}`, hasRobots, aiBlocked, blocksAnyAI: aiBlocked.length > 0, hasLlmsTxt };
  }
  if (looksLikeChallenge(pg.text)) {
    return { checked: true, reachable: false, challenged: true, hasRobots, aiBlocked, blocksAnyAI: aiBlocked.length > 0, hasLlmsTxt };
  }

  const r = {
    checked: true, reachable: true, status: pg.status, ms: pg.ms, bytes: pg.bytes,
    hasRobots, aiBlocked, blocksAnyAI: aiBlocked.length > 0, hasLlmsTxt,
  };
  try { r.finalIsHttps = new URL(pg.finalUrl).protocol === 'https:'; } catch { /* 무시 */ }
  Object.assign(r, readHtml(pg.text, pg.finalUrl));
  return r;
}
