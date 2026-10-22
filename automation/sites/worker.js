/**
 * 고객 사이트 라우터 — 빌드 출력 루트의 _worker.js 로 복사된다 (sites.js build 가 DOMAINS 를 박아 넣는다)
 * Host 로 폴더를 고른다: {slug}.sites.bizhigher.com → /{slug}/…  ·  고객 도메인(DOMAINS 표) → /{slug}/…
 * 그 밖의 호스트(bizhigher-sites.pages.dev 등)는 경로 그대로 — /{slug}/ 로 직접 열 수 있다.
 */
const DOMAINS = /*__DOMAINS__*/{}/*__END__*/;
const SITES_SUFFIX = '.sites.bizhigher.com';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const host = url.hostname.toLowerCase();
    let slug = '';
    if (host.endsWith(SITES_SUFFIX)) slug = host.slice(0, -SITES_SUFFIX.length);
    else if (DOMAINS[host]) slug = DOMAINS[host];
    else if (host.startsWith('www.') && DOMAINS[host.slice(4)]) slug = DOMAINS[host.slice(4)];
    if (!slug || !/^[a-z0-9-]{1,40}$/.test(slug)) return env.ASSETS.fetch(request);
    // www → 루트 도메인으로 301 (canonical 하나)
    if (host.startsWith('www.') && DOMAINS[host.slice(4)]) { url.hostname = host.slice(4); return Response.redirect(url.toString(), 301); }
    // Pages 는 /x/index.html → /x/ 로 308 하므로 디렉터리는 끝에 / 를 붙여 바로 요청한다 (index.html 요청도 / 로)
    const path = url.pathname.replace(/\/index\.html$/, '/');
    const target = new URL(request.url); target.pathname = `/${slug}${path}`;
    const res = await env.ASSETS.fetch(new Request(target.toString(), request));
    if (res.status === 404) { // 폴더 없음 → 깔끔한 404
      return new Response('<!doctype html><meta charset="utf-8"><title>Not found</title><p style="font-family:sans-serif;padding:40px">페이지를 찾을 수 없습니다.</p>', { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }
    if (res.status >= 300 && res.status < 400) { // Pages 가 /{slug}/… 로 리다이렉트하면 접두사를 떼고 돌려준다
      const loc = res.headers.get('location') || '';
      const u = new URL(loc, request.url);
      if (u.pathname.startsWith(`/${slug}/`)) { u.hostname = url.hostname; u.pathname = u.pathname.slice(slug.length + 1); return Response.redirect(u.toString(), res.status); }
    }
    const h = new Headers(res.headers);
    h.set('X-Content-Type-Options', 'nosniff'); h.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    return new Response(res.body, { status: res.status, headers: h });
  },
};
