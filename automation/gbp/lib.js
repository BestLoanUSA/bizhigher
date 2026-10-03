/**
 * Google Business Profile API — 의존성 없는 얇은 클라이언트 (Node 18+)
 *
 * 쓰는 API (전부 같은 OAuth 토큰, scope: https://www.googleapis.com/auth/business.manage)
 *   - 계정 목록:   GET  https://mybusinessaccountmanagement.googleapis.com/v1/accounts
 *   - 위치 목록:   GET  https://mybusinessbusinessinformation.googleapis.com/v1/{account}/locations
 *   - 리뷰 목록:   GET  https://mybusiness.googleapis.com/v4/{account}/{location}/reviews
 *   - 리뷰 답글:   PUT  https://mybusiness.googleapis.com/v4/{review.name}/reply   { comment }
 *   - 게시물 생성: POST https://mybusiness.googleapis.com/v4/{account}/{location}/localPosts
 *   - 게시물 목록: GET  https://mybusiness.googleapis.com/v4/{account}/{location}/localPosts
 *
 * ⚠️ GBP API는 Google의 접근 승인 전에는 할당량이 0이라 어떤 호출도 실패한다(CLAUDE.md §15).
 *    승인 전에는 reviews.js / posts.js 를 --dry-run 으로 돌려 분류·초안 로직만 검증한다.
 *
 * 토큰 저장: automation/gbp/.token.json (gitignore 됨). 만들기: node automation/gbp/auth.js
 */
const fs = require('fs');
const path = require('path');

const TOKEN_FILE = path.join(__dirname, '.token.json');
const SCOPE = 'https://www.googleapis.com/auth/business.manage';

function readToken() {
  if (!fs.existsSync(TOKEN_FILE)) throw new Error('토큰이 없습니다. 먼저 `node automation/gbp/auth.js` 를 실행하세요.');
  return JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8'));
}
function writeToken(t) {
  fs.writeFileSync(TOKEN_FILE, JSON.stringify(t, null, 2), { mode: 0o600 });
}

/** refresh_token으로 access_token을 갱신한다 (만료 60초 전부터 갱신) */
async function accessToken() {
  const t = readToken();
  if (t.access_token && t.expires_at && Date.now() < t.expires_at - 60_000) return t.access_token;
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: t.client_id,
      client_secret: t.client_secret,
      refresh_token: t.refresh_token,
      grant_type: 'refresh_token',
    }),
  });
  if (!res.ok) throw new Error('token refresh ' + res.status + ' ' + (await res.text()));
  const data = await res.json();
  t.access_token = data.access_token;
  t.expires_at = Date.now() + (data.expires_in || 3600) * 1000;
  writeToken(t);
  return t.access_token;
}

async function api(method, url, body) {
  const token = await accessToken();
  const res = await fetch(url, {
    method,
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }
  if (!res.ok) {
    const msg = (data && data.error && data.error.message) || text;
    const err = new Error(`${method} ${url} → ${res.status}: ${msg}`);
    err.status = res.status; err.data = data;
    throw err;
  }
  return data;
}

/* ---------- 계정 · 위치 ---------- */
async function listAccounts() {
  const d = await api('GET', 'https://mybusinessaccountmanagement.googleapis.com/v1/accounts');
  return d.accounts || [];
}
async function listLocations(accountName) {
  const mask = 'name,title,storefrontAddress,websiteUri,phoneNumbers,categories,metadata';
  const d = await api('GET', `https://mybusinessbusinessinformation.googleapis.com/v1/${accountName}/locations?readMask=${encodeURIComponent(mask)}&pageSize=100`);
  return d.locations || [];
}

/* ---------- 리뷰 ---------- */
/** @param {string} locationPath 'accounts/123/locations/456' */
async function listReviews(locationPath, { pageSize = 50, pageToken } = {}) {
  const q = new URLSearchParams({ pageSize: String(pageSize), orderBy: 'updateTime desc' });
  if (pageToken) q.set('pageToken', pageToken);
  return api('GET', `https://mybusiness.googleapis.com/v4/${locationPath}/reviews?${q}`);
}
async function replyToReview(reviewName, comment) {
  return api('PUT', `https://mybusiness.googleapis.com/v4/${reviewName}/reply`, { comment });
}
async function deleteReply(reviewName) {
  return api('DELETE', `https://mybusiness.googleapis.com/v4/${reviewName}/reply`);
}

/* ---------- 게시물 ---------- */
/**
 * @param {object} post { summary, cta: {type:'LEARN_MORE'|'CALL'|'BOOK'|'ORDER'|'SHOP'|'SIGN_UP', url}, mediaUrl, languageCode, event:{title,start,end}, offer:{couponCode,redeemOnlineUrl,termsConditions} }
 */
async function createLocalPost(locationPath, post) {
  const body = {
    languageCode: post.languageCode || 'ko',
    summary: post.summary,
    topicType: post.event ? 'EVENT' : post.offer ? 'OFFER' : 'STANDARD',
  };
  if (post.cta && post.cta.type && post.cta.type !== 'CALL') body.callToAction = { actionType: post.cta.type, url: post.cta.url };
  if (post.cta && post.cta.type === 'CALL') body.callToAction = { actionType: 'CALL' };
  if (post.mediaUrl) body.media = [{ mediaFormat: 'PHOTO', sourceUrl: post.mediaUrl }];
  if (post.event) {
    body.event = { title: post.event.title, schedule: { startDate: post.event.start, endDate: post.event.end } };
  }
  if (post.offer) body.offer = post.offer;
  return api('POST', `https://mybusiness.googleapis.com/v4/${locationPath}/localPosts`, body);
}
async function listLocalPosts(locationPath) {
  const d = await api('GET', `https://mybusiness.googleapis.com/v4/${locationPath}/localPosts?pageSize=20`);
  return d.localPosts || [];
}

/* ---------- Claude (초안 생성) ---------- */
async function claude(prompt, { maxTokens = 800, system } = {}) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null; // 키 없으면 호출자가 템플릿으로 폴백
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: process.env.CLAUDE_MODEL || 'claude-haiku-4-5',
      max_tokens: maxTokens,
      ...(system ? { system } : {}),
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) throw new Error('claude ' + res.status + ' ' + (await res.text()));
  const data = await res.json();
  return (data.content && data.content[0] && data.content[0].text) || '';
}

module.exports = {
  SCOPE, TOKEN_FILE, readToken, writeToken, accessToken, api,
  listAccounts, listLocations, listReviews, replyToReview, deleteReply, createLocalPost, listLocalPosts, claude,
};
