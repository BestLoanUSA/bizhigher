#!/usr/bin/env node
/**
 * AI 실행 루틴 보조 스크립트 — 관리자 API로 "AI가 지금 할 단계"를 받고 결과물을 올린다.
 * 콘텐츠 생성은 루틴 세션의 Claude가 하고, 이 스크립트는 읽기/쓰기만 한다 (Node 18+, 의존성 없음).
 *
 *   node automation/ai-runner/runner.js queue [--limit 20]                 # 할 단계 + 고객 컨텍스트 + Gmail 초안 대기 (JSON)
 *   node automation/ai-runner/runner.js submit --task 123 --file out.md [--url https://…] [--kind text|html|link]
 *                                              [--checks "포인트1|포인트2|포인트3"] [--self-check "…"] [--done]   # 기본 검증 큐(review), --done 이면 바로 완료(verify=0 단계)
 *   node automation/ai-runner/runner.js drafted --deliverable 7 [--note "초안 제목"]   # Gmail 초안 만든 뒤 기록
 *   node automation/ai-runner/runner.js note --job 5 --text "…"                      # 타임라인 메모
 *
 * 환경변수: BIZHIGHER_ADMIN_PASSWORD (필수), BIZHIGHER_ADMIN_URL (기본 https://bizhigher.com)
 */
const fs = require('fs');
const BASE = (process.env.BIZHIGHER_ADMIN_URL || 'https://bizhigher.com').replace(/\/$/, '');
// 환경변수 상자에 따옴표로 감싸거나 끝에 공백이 붙어 들어오는 경우가 흔하다 — 값은 바꾸지 않고 겉껍데기만 벗긴다
const RAW_PW = process.env.BIZHIGHER_ADMIN_PASSWORD || '';
const PW = RAW_PW.trim().replace(/^(["'])(.*)\1$/s, '$2');
const args = process.argv.slice(2);
const cmd = args[0];
const opt = (k, d) => { const i = args.indexOf('--' + k); return i > -1 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : d; };

async function login() {
  if (!PW) throw new Error('BIZHIGHER_ADMIN_PASSWORD 가 없습니다 (환경 비밀에 넣으세요)');
  const r = await fetch(BASE + '/admin/login', { method: 'POST', body: new URLSearchParams({ password: PW }), redirect: 'manual' });
  const c = (r.headers.get('set-cookie') || '').split(';')[0];
  if (!c.startsWith('bh_admin=')) {
    // 값은 절대 출력하지 않는다. 모양만 알려 준다
    const shape = `길이 ${PW.length}자` + (RAW_PW !== PW ? ' · 겉의 따옴표/공백을 제거하고 시도함' : '') + (/\s/.test(PW) ? ' · 안에 공백 있음' : '');
    throw new Error(`로그인 실패 (${r.status}) — ${BASE}/admin/login 에 보낸 비밀번호(${shape})가 Cloudflare Production의 ADMIN_PASSWORD 와 다릅니다. 브라우저에서 같은 값으로 /admin/ 로그인이 되는지 먼저 확인하고, 환경변수 줄이 BIZHIGHER_ADMIN_PASSWORD=값 (따옴표·공백 없이)인지 보세요`);
  }
  return c;
}
async function api(path, body) {
  const cookie = await login();
  const r = await fetch(BASE + '/admin/api/' + path, { method: body ? 'POST' : 'GET', headers: { cookie, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({ ok: false, error: 'bad json ' + r.status }));
  if (!j.ok) throw new Error(path + ': ' + j.error);
  return j;
}

(async () => {
  if (cmd === 'queue') {
    const q = await api('runner/queue?limit=' + (opt('limit', '20')));
    console.log(JSON.stringify(q, null, 2));
    return;
  }
  if (cmd === 'submit') {
    const id = Number(opt('task'));
    const file = opt('file');
    if (!id || !file) throw new Error('--task ID --file path 가 필요합니다');
    const text = fs.readFileSync(file, 'utf8');
    const checks = (opt('checks', '') || '').split('|').map((s) => s.trim()).filter(Boolean);
    await api(`tasks/${id}/result`, { kind: opt('kind', opt('url') && text.trim().length < 400 ? 'link' : 'text'), text, url: opt('url', ''), checks, self_check: opt('self-check', '') });
    if (args.includes('--done')) await api(`tasks/${id}/status`, { status: 'done' }); // verify=0 단계: 검증 없이 완료
    console.log(`올림: task ${id} (${text.length}자)${args.includes('--done') ? ' → 완료' : ' → 검증 큐'}`);
    return;
  }
  if (cmd === 'done') { // verify=0 단계: 결과 올린 뒤 완료 처리
    const id = Number(opt('task'));
    await api(`tasks/${id}/status`, { status: 'done', note: opt('note', '') });
    console.log(`완료: task ${id}`);
    return;
  }
  if (cmd === 'drafted') {
    const id = Number(opt('deliverable'));
    await api(`deliverables/${id}/drafted`, { note: opt('note', '') });
    console.log(`기록: deliverable ${id} Gmail 초안`);
    return;
  }
  if (cmd === 'note') {
    await api(`jobs/${Number(opt('job'))}/note`, { note: opt('text', '') });
    console.log('메모 저장');
    return;
  }
  console.log('사용법: queue | submit --task ID --file F [--url U] [--checks "a|b"] [--self-check S] | done --task ID | drafted --deliverable ID | note --job ID --text T');
})().catch((e) => { console.error('오류:', e.message); process.exit(1); });
