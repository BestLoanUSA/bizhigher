/**
 * 공개 결과물·첨부 파일 — GET /a/{id}.{ext}
 * 루틴이 만든 이미지(a/…)와 고객이 질문지에 첨부한 파일(u/…). R2 바인딩(R2_ASSETS)이 있으면 R2 객체를, 없으면 D1 `assets` BLOB 을 서빙한다.
 * id는 추측 불가능한 16자 토큰이라 목록 노출은 없다. 고객 GBP 게시물·메타 예약 발행이 이 URL을 쓴다.
 */
const HEADERS = (ct) => {
  const h = { 'Content-Type': ct || 'image/jpeg', 'Cache-Control': 'public, max-age=31536000, immutable', 'X-Robots-Tag': 'noindex', 'X-Content-Type-Options': 'nosniff' };
  // SVG·PDF는 스크립트를 품을 수 있어 격리해서 보여준다
  if (/svg|pdf/.test(ct || '')) h['Content-Security-Policy'] = "default-src 'none'; sandbox";
  return h;
};

export async function onRequestGet({ params, env }) {
  const id = String(params.id || '').replace(/\.(jpe?g|png|webp|gif|heic|svg|pdf)$/i, '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32);
  if (!id || !env.DB) return new Response('not found', { status: 404 });
  const row = await env.DB.prepare('SELECT data, content_type, r2_key FROM assets WHERE id = ?').bind(id).first().catch(() => null);
  if (!row) return new Response('not found', { status: 404 });
  if (row.r2_key && env.R2_ASSETS) {
    const obj = await env.R2_ASSETS.get(row.r2_key).catch(() => null);
    if (obj) return new Response(obj.body, { headers: HEADERS(row.content_type || (obj.httpMetadata && obj.httpMetadata.contentType)) });
  }
  if (!row.data) return new Response('not found', { status: 404 });
  // D1은 BLOB을 ArrayBuffer로 주지만 로컬 에뮬레이터는 숫자 배열로 준다 — 둘 다 바이트로 만든다
  const bytes = Array.isArray(row.data) ? Uint8Array.from(row.data) : row.data instanceof ArrayBuffer || ArrayBuffer.isView(row.data) ? row.data : new TextEncoder().encode(String(row.data));
  return new Response(bytes, { headers: HEADERS(row.content_type) });
}
