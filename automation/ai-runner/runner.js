#!/usr/bin/env node
/**
 * AI 실행 루틴 보조 스크립트 — 관리자 API로 "AI가 지금 할 단계"를 받고 결과물을 올린다.
 * 콘텐츠 생성은 루틴 세션의 Claude가 하고, 이 스크립트는 읽기/쓰기만 한다 (Node 18+, 의존성 없음).
 *
 *   node automation/ai-runner/runner.js queue [--limit 20]                 # 할 단계 + 고객 컨텍스트 + Gmail 초안 대기 (JSON)
 *   node automation/ai-runner/runner.js submit --task 123 --file out.md [--url https://…] [--kind text|html|link|images|video] [--options options.json]
 *       --options = 고객이 고르는 선택지 [{key:'B',label:'네이비·골드',image:'https://…/a/….jpg',note:'…',styles:['luxe','mono'],default:true}] — 승인되면 고객 페이지에 카드로 뜨고 고객이 하나를 고른다. 선택값은 다음 AI 단계 note "[고객 선택] B — …"
 *                                              [--checks "포인트1|포인트2|포인트3"] [--self-check "…"] [--done]   # 기본 검증 큐(review), --done 이면 바로 완료(verify=0 단계)
 *   node automation/ai-runner/runner.js report-data --job 5 --period 2026-10 --file report.json   # 월간 리포트 데이터 → 고객 페이지 /c/… 의 실시간 리포트
 *   node automation/ai-runner/runner.js summary --deliverable 7 --file s.txt      # 결과물의 고객용 요약 저장 (고객 페이지·묶음 메일에 쓰임). 메일은 보내지 않는다
 *   node automation/ai-runner/runner.js draft --job 5 --file body.txt            # (구) 작업 단위 초안을 David 메일에 — 이제 summary 를 쓴다
 *   node automation/ai-runner/runner.js draft --deliverable 7 --file body.txt    # 결과물 1건만
 *   node automation/ai-runner/runner.js drafted --deliverable 7 [--note "초안 제목"]   # Gmail 초안을 다른 경로로 만든 뒤 기록만
 *   node automation/ai-runner/runner.js note --job 5 --text "…"                      # 타임라인 메모
 *   node automation/ai-runner/runner.js learnings --industry 안경점 [--channel google]  # 업종별 광고 학습 메모(먹힌 키워드·훅·CPA 범위) — ads-2·ac-1 설계 전에 읽는다
 *   node automation/ai-runner/runner.js learn --industry 안경점 --kind keyword --text "'eye exam near me' 전환 CPA $18~24, 'glasses' 는 전환 0" --value '{"cpa":[18,24]}' --n 1 --channel google --city "Garden Grove" --state CA --job 28 --task-key am-5
 *       업종·도시 수준 집계만. 고객명·이메일·전화·링크는 넣지 않는다(서버가 이메일·링크·전화 형식은 거절)
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
    let options; if (opt('options')) { options = JSON.parse(fs.readFileSync(opt('options'), 'utf8')); if (!Array.isArray(options) || !options.length) throw new Error('--options 는 [{key,label,image,note,styles,default}] 배열이어야 합니다'); }
    const r = await api(`tasks/${id}/result`, { kind: opt('kind', opt('url') && text.trim().length < 400 ? 'link' : 'text'), text, url: opt('url', ''), checks, self_check: opt('self-check', ''), options });
    if (args.includes('--done') && !(r && r.autoApproved)) await api(`tasks/${id}/status`, { status: 'done' }); // verify=0 단계: 검증 없이 완료
    console.log(`올림: task ${id} (${text.length}자)${r && r.autoApproved ? ' → 자동 승인(' + r.rule + ')' : args.includes('--done') ? ' → 완료' : ' → 검증 큐'}`);
    return;
  }
  if (cmd === 'done') { // verify=0 단계: 결과 올린 뒤 완료 처리
    const id = Number(opt('task'));
    await api(`tasks/${id}/status`, { status: 'done', note: opt('note', '') });
    console.log(`완료: task ${id}`);
    return;
  }
  if (cmd === 'report-data') { // 월간 리포트 데이터 → 고객 페이지 실시간 리포트(2026-11-06). report.json 그대로
    const id = opt('job'), file = opt('file'), period = opt('period');
    if (!id || !file || !period) throw new Error('--job N --period YYYY-MM --file report.json 이 필요합니다');
    const r = await api(`jobs/${id}/report-data`, { period, data: JSON.parse(fs.readFileSync(file, 'utf8')) });
    console.log(`리포트 데이터 저장: job ${id} · ${r.period}`); return;
  }
  if (cmd === 'summary') { // 결과물의 고객용 요약(2~4문장) — 발송은 David 가 관리자에서 묶음으로
    const id = Number(opt('deliverable')); const file = opt('file');
    if (!id || !file) throw new Error('--deliverable ID --file summary.txt 가 필요합니다');
    await api(`deliverables/${id}/summary`, { text: fs.readFileSync(file, 'utf8') });
    console.log(`요약 저장: deliverable ${id}`);
    return;
  }
  if (cmd === 'draft') { // Resend → David(NOTIFY_EMAIL). 고객에게는 가지 않는다. --job 이면 그 작업의 초안 대기 결과물을 한 통으로 묶는다
    const file = opt('file');
    if (!file) throw new Error('--file body.txt 가 필요합니다');
    if (opt('job')) {
      const r = await api(`jobs/${Number(opt('job'))}/draft-batch`, { text: fs.readFileSync(file, 'utf8') });
      console.log(`전달: job ${opt('job')} 결과물 ${r.count}건을 한 통으로 David 메일로`);
      return;
    }
    const id = Number(opt('deliverable'));
    if (!id) throw new Error('--job ID 또는 --deliverable ID 가 필요합니다');
    await api(`deliverables/${id}/draft-to-david`, { text: fs.readFileSync(file, 'utf8') });
    console.log(`전달: deliverable ${id} 초안을 David 메일로`);
    return;
  }
  if (cmd === 'drafted') {
    const id = Number(opt('deliverable'));
    await api(`deliverables/${id}/drafted`, { note: opt('note', '') });
    console.log(`기록: deliverable ${id} Gmail 초안`);
    return;
  }
  if (cmd === 'wake') { // 루틴이 끝날 때 남은 일이 있으면 자신을 다시 깨운다(관리자가 ROUTINE_FIRE_URL 로 발사). 3분 디바운스·AI 차례 없으면 건너뜀
    // end: 루틴이 끝나며 부르는 것이라 서버가 "실행 중" 디바운스를 풀고 바로 다음 실행을 깨운다(2026-11-03)
    const r = await api('runner/wake', { reason: opt('reason', '루틴 — 남은 단계'), force: args.includes('--force'), end: true });
    console.log(r.fired ? `루틴 깨움: ${r.session || ''}` : `건너뜀: ${r.skipped}${r.status && r.status.skipped ? ' — ' + r.status.skipped : ''}`);
    return;
  }
  if (cmd === 'note') {
    await api(`jobs/${Number(opt('job'))}/note`, { note: opt('text', '') });
    console.log('메모 저장');
    return;
  }
  if (cmd === 'learnings') { // 업종별 학습 메모 읽기 — ads-2·ac-1 설계 전에. 마크다운 표로 출력(없으면 "없음")
    const q = new URLSearchParams(); if (opt('industry')) q.set('industry', opt('industry')); if (opt('channel')) q.set('channel', opt('channel')); q.set('limit', opt('limit', '40'));
    const r = await api('learnings?' + q.toString());
    if (!r.learnings.length) { console.log('학습 메모 없음 — ' + (opt('industry') || '전체')); return; }
    console.log('| 업종 | 지역 | 채널 | 종류 | 메모 | 표본 | 날짜 |\n|---|---|---|---|---|---|---|');
    r.learnings.forEach((l) => console.log(`| ${l.industry} | ${[l.city, l.state].filter(Boolean).join(', ') || '-'} | ${l.channel || '-'} | ${l.kind} | ${l.text.replace(/\|/g, '/')}${l.value ? ' `' + JSON.stringify(l.value) + '`' : ''} | ${l.sample_n} | ${String(l.created_at).slice(0, 10)} |`));
    return;
  }
  if (cmd === 'learn') { // 학습 메모 한 줄 쓰기 — am-5·ads-5·ac-5(고객 선택) 뒤에. 고객명·이메일·전화는 넣지 않는다
    const body = { industry: opt('industry'), city: opt('city'), state: opt('state'), channel: opt('channel'), kind: opt('kind', 'note'), text: opt('text'), sample_n: Number(opt('n', '1')), job_id: opt('job') ? Number(opt('job')) : undefined, task_key: opt('task-key') };
    if (opt('value')) body.value = JSON.parse(opt('value'));
    if (!body.industry || !body.text) throw new Error('--industry 와 --text 가 필요합니다');
    const r = await api('learnings', body);
    console.log('학습 메모 저장 #' + r.id);
    return;
  }
  console.log('사용법: queue | submit --task ID --file F [--url U] [--kind text|html|link|images|video] [--checks "a|b"] [--self-check S] [--options o.json] [--done] | done --task ID | draft --deliverable ID --file F | drafted --deliverable ID | note --job ID --text T | wake [--reason R] [--force] | learnings [--industry I] [--channel google|meta] | learn --industry I --kind keyword|negative|hook|audience|cpa|budget|creative|rule|note --text T [--value JSON] [--n 3] [--channel C] [--city C --state S] [--job ID] [--task-key am-5]');
})().catch((e) => { console.error('오류:', e.message); process.exit(1); });
