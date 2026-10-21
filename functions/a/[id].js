/**
 * 공개 결과물 이미지 — GET /a/{id}.jpg
 * 루틴이 만든 광고 소재·게시물 이미지를 D1 `assets`에 넣고 여기서 서빙한다 (R2 전까지의 저장소).
 * id는 추측 불가능한 16자 토큰이라 목록 노출은 없다. 고객 GBP 게시물·메타 예약 발행이 이 URL을 쓴다.
 */
export async function onRequestGet({ params, env }) {
  const id = String(params.id || '').replace(/\.(jpe?g|png|webp)$/i, '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32);
  if (!id || !env.DB) return new Response('not found', { status: 404 });
  const row = await env.DB.prepare('SELECT data, content_type FROM assets WHERE id = ?').bind(id).first().catch(() => null);
  if (!row || !row.data) return new Response('not found', { status: 404 });
  // D1은 BLOB을 ArrayBuffer로 주지만 로컬 에뮬레이터는 숫자 배열로 준다 — 둘 다 바이트로 만든다
  const bytes = Array.isArray(row.data) ? Uint8Array.from(row.data) : row.data instanceof ArrayBuffer || ArrayBuffer.isView(row.data) ? row.data : new TextEncoder().encode(String(row.data));
  return new Response(bytes, { headers: { 'Content-Type': row.content_type || 'image/jpeg', 'Cache-Control': 'public, max-age=31536000, immutable', 'X-Robots-Tag': 'noindex' } });
}
