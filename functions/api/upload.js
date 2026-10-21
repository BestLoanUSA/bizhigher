/**
 * 결제 후 질문지 첨부 파일 업로드 — POST /api/upload (multipart, 필드 file 1개)
 * 사진·로고·PDF를 R2(R2_ASSETS)에 넣고 공개 URL(/a/{id}.{ext})을 돌려준다. 질문지는 이 URL을 notes에 붙여 제출한다.
 * R2 바인딩이 없으면 503 — D1 BLOB에는 큰 파일을 넣지 않는다.
 * 한도: 파일당 10MB, IP·일 30개(tool_usage 'intake-upload'). 파일 내용은 R2 외에 어디에도 저장하지 않는다.
 */
import { takeQuota, json } from './tools/_shared.js';
import { ensureSchema } from './_orders.js';

const TYPES = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/heic': 'heic',
  'image/svg+xml': 'svg', 'application/pdf': 'pdf',
};
const BY_EXT = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', heic: 'image/heic', svg: 'image/svg+xml', pdf: 'application/pdf' };
const MAX = 10 * 1024 * 1024;

export async function onRequestPost({ request, env }) {
  if (!env.R2_ASSETS || !env.DB) return json({ ok: false, error: 'storage' }, 503);
  let form;
  try { form = await request.formData(); } catch { return json({ ok: false, error: 'invalid' }, 400); }
  const file = form.get('file');
  if (!file || typeof file === 'string' || !file.size) return json({ ok: false, error: 'invalid' }, 400);
  if (file.size > MAX) return json({ ok: false, error: 'too_large' }, 413);
  const name = String(file.name || 'file').slice(0, 120);
  const extGuess = (name.split('.').pop() || '').toLowerCase();
  const ct = TYPES[file.type] ? file.type : BY_EXT[extGuess];
  if (!ct) return json({ ok: false, error: 'type' }, 415);
  const ext = TYPES[ct];
  const quota = await takeQuota(env, request, 'intake-upload', String(form.get('email') || ''));
  if (!quota.ok) return json({ ok: false, error: quota.reason === 'user' || quota.reason === 'global' ? 'quota' : 'busy' }, 429);
  const id = [...crypto.getRandomValues(new Uint8Array(16))].map((x) => 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[x % 62]).join('');
  const key = `u/${id}.${ext}`;
  try {
    await env.R2_ASSETS.put(key, file.stream(), { httpMetadata: { contentType: ct }, customMetadata: { name } });
    await ensureSchema(env.DB);
    await env.DB.prepare(`INSERT INTO assets (id, content_type, bytes, label, r2_key) VALUES (?,?,?,?,?)`).bind(id, ct, file.size, 'u:' + name, key).run();
  } catch {
    return json({ ok: false, error: 'server' }, 500);
  }
  const url = new URL(request.url);
  return json({ ok: true, url: `${url.origin}/a/${id}.${ext}`, name, bytes: file.size });
}
