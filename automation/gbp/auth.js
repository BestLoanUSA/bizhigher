#!/usr/bin/env node
/**
 * GBP API용 OAuth 토큰 발급 (한 번만) — 브라우저에서 David의 구글 계정으로 동의하고 refresh_token을 저장한다.
 *
 * 준비 (Google Cloud Console):
 *   1. 프로젝트 생성 → "My Business Account Management API", "My Business Business Information API",
 *      "Google My Business API"(v4) 를 라이브러리에서 사용 설정
 *   2. OAuth 동의 화면: 외부, 테스트 사용자에 David 계정 추가 (게시 전까지는 테스트 모드로 충분)
 *   3. 사용자 인증 정보 → OAuth 클라이언트 ID → 유형 "데스크톱 앱" → client_id / client_secret 복사
 *   4. GBP API 접근 신청(승인 전엔 할당량 0): https://developers.google.com/my-business/content/prereqs
 *
 * 실행:
 *   GBP_CLIENT_ID=... GBP_CLIENT_SECRET=... node automation/gbp/auth.js
 *   → 출력된 URL을 브라우저에서 열고 동의 → 주소창의 code= 값을 붙여넣기
 */
const readline = require('readline');
const { SCOPE, writeToken } = require('./lib');

const client_id = process.env.GBP_CLIENT_ID;
const client_secret = process.env.GBP_CLIENT_SECRET;
if (!client_id || !client_secret) {
  console.error('GBP_CLIENT_ID / GBP_CLIENT_SECRET 환경변수가 필요합니다.');
  process.exit(1);
}
// 데스크톱 앱 클라이언트는 루프백 리다이렉트를 쓴다. 서버를 띄우지 않고 주소창의 code만 복사한다.
const redirect_uri = 'http://localhost:8765';
const url = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
  client_id, redirect_uri, response_type: 'code', scope: SCOPE, access_type: 'offline', prompt: 'consent',
});

console.log('\n1) 아래 URL을 브라우저에서 열고, GBP 관리 권한이 있는 구글 계정으로 동의하세요:\n\n' + url + '\n');
console.log('2) 동의 후 브라우저가 http://localhost:8765/?code=... 로 이동하며 "연결할 수 없음"이 떠도 정상입니다.');
console.log('   주소창의 code= 뒤 값(& 앞까지)을 복사해 여기에 붙여넣으세요.\n');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
rl.question('code: ', async (code) => {
  rl.close();
  code = decodeURIComponent(code.trim());
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ code, client_id, client_secret, redirect_uri, grant_type: 'authorization_code' }),
  });
  const data = await res.json();
  if (!res.ok || !data.refresh_token) {
    console.error('토큰 발급 실패:', data);
    process.exit(1);
  }
  writeToken({
    client_id, client_secret,
    refresh_token: data.refresh_token,
    access_token: data.access_token,
    expires_at: Date.now() + (data.expires_in || 3600) * 1000,
    scope: data.scope,
    obtained_at: new Date().toISOString(),
  });
  console.log('\n저장됨: automation/gbp/.token.json (gitignore). 다음: node automation/gbp/reviews.js locations');
});
