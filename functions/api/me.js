/**
 * GET /api/me — 지금 브라우저가 로그인한 사장님인지(무료 도구·로그인 띠가 쓴다, 2026-11-07)
 * 돌려주는 것: 로그인 여부·이름·제공자·하루 도구 한도. 이메일 원문은 돌려주지 않는다(가린 형태만)
 */
import { session } from './_owner.js';
import { MEMBER_PER_USER } from './tools/_shared.js';

const out = (o) => new Response(JSON.stringify(o), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
const mask = (e) => (e ? e.replace(/^(.)[^@]*(@.*)$/, '$1***$2') : '');

export async function onRequestGet({ request, env }) {
  const s = await session(request, env).catch(() => null);
  if (!s) return out({ loggedIn: false, toolsPerDay: 2, memberToolsPerDay: MEMBER_PER_USER });
  return out({ loggedIn: true, name: s.n || '', email: mask(s.e || ''), provider: s.p, toolsPerDay: MEMBER_PER_USER });
}
