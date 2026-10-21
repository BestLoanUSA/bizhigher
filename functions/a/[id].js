/**
 * 공개 결과물 이미지 — GET /a/{id}.jpg
 * 루틴이 만든 광고 소재·게시물 이미지. R2 바인딩(R2_ASSETS)이 있으면 R2 객체를, 없으면 D1 `assets` BLOB 을 서빙한다.
 * id는 추측 불가능한 16자 토큰이라 목록 노출은 없다. 고객 GBP 게시물·메타 예약 발행이 이 URL을 쓴다.
 */
const HEADERS = (ct) => ({ 'Content-Type': ct || 'image/jpeg', 'Cache-Control': 'public, max-age=31536000, immutable', 'X-Robots-Tag': 'noindex' });

export async function onRequestGet({ params, env }) {
  const id = String(params.id || '').replace(/\.(jpe?g|png|webp)$/i, '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32);
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
