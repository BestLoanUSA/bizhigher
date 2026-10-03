#!/usr/bin/env node
/**
 * 리뷰 자동화 실험 — 가져오기 → 분류 → 답글 초안 → (승인된 것만) 게시
 *
 * 분기 규칙 (CLAUDE.md §15·§12, 예외 없음)
 *   AUTO  : 별 4~5개 + 일반 내용 → 자동 게시 후보
 *   HUMAN : 별 1~3개, 또는 환불·위생·법적·직원 실명·건강/시력/처방 언급 → 초안만 + 사람 승인(24시간 내)
 *   금지  : 리뷰 대가·할인 약속, 고객이 환자/검안 대상이었음을 암시(HIPAA), 개인정보 언급, 가짜 리뷰
 *
 * 사용법
 *   node automation/gbp/reviews.js locations                       # 계정·위치 목록 → 위치 경로 확인
 *   node automation/gbp/reviews.js list     --location accounts/A/locations/L
 *   node automation/gbp/reviews.js draft    --location ... [--since 7d] [--out queue.json]
 *   node automation/gbp/reviews.js draft    --dry-run                  # fixtures/sample-reviews.json 으로 로직만 검증
 *   node automation/gbp/reviews.js post     --queue queue.json [--auto]  # approved:true (또는 --auto 시 AUTO 등급)만 게시
 *
 * 업소 정보는 --biz automation/gbp/biz/new-optix.json (톤·금지어·언어·영업시간·URL)
 */
const fs = require('fs');
const path = require('path');
const gbp = require('./lib');

const args = process.argv.slice(2);
const cmd = args[0];
const opt = (k, d) => { const i = args.indexOf('--' + k); return i > -1 ? (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true) : d; };
const DRY = !!opt('dry-run', false);

const biz = JSON.parse(fs.readFileSync(opt('biz', path.join(__dirname, 'biz', 'new-optix.json')), 'utf8'));

/* ---------- 분류 ---------- */
const STAR = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };
const RISK_PATTERNS = [
  /환불|refund|money back|charge ?back/i,
  /위생|더럽|hygien|dirty|unsanitary|infection/i,
  /소송|변호사|고소|law(suit|yer)|sue|legal|attorney|BBB|신고/i,
  /사기|scam|fraud|rip.?off|overcharg|바가지/i,
  /처방|prescription|검안|exam|doctor|optometrist|의사|진료|시력|diagnos|medical/i, // 건강·검안 — HIPAA 성격
  /직원\s*[가-힣]{2,3}|manager\s+[A-Z][a-z]+|employee\s+[A-Z][a-z]+/, // 직원 실명
  /차별|discriminat|racis|harass/i,
];
function classify(r) {
  const stars = STAR[r.starRating] || 0;
  const text = (r.comment || '').trim();
  const risks = RISK_PATTERNS.filter((re) => re.test(text)).map((re) => re.source.slice(0, 18));
  const nameHits = (biz.staffNames || []).filter((n) => text.includes(n));
  if (nameHits.length) risks.push('직원 실명:' + nameHits.join(','));
  let grade = 'AUTO';
  if (stars <= 3 || risks.length) grade = 'HUMAN';
  return { stars, grade, risks };
}

/* ---------- 초안 ---------- */
function lang(text) { return /[가-힣]/.test(text || '') ? 'ko' : 'en'; }
function templateReply(r, c) {
  const who = r.reviewer && r.reviewer.displayName ? r.reviewer.displayName.split(' ')[0] : '';
  const L = lang(r.comment);
  if (c.stars >= 4) { // HUMAN 등급이어도 별점이 높으면 감사 톤 (사람 검토 사유는 내용 위험이지 불만이 아님)
    return L === 'ko'
      ? `${who ? who + '님, ' : ''}소중한 후기 감사합니다. 다음에 오실 때도 편안하게 모시겠습니다. — ${biz.name}`
      : `${who ? 'Thank you, ' + who + '!' : 'Thank you!'} We appreciate you taking the time to share this. See you next time at ${biz.name}.`;
  }
  return L === 'ko'
    ? `${who ? who + '님, ' : ''}불편을 드려 죄송합니다. 어떤 점이 아쉬우셨는지 직접 듣고 바로잡고 싶습니다. ${biz.phone}로 연락 주시면 책임지고 확인하겠습니다. — ${biz.name}`
    : `${who ? who + ', ' : ''}we're sorry your visit fell short. We'd like to hear what happened and make it right — please reach us at ${biz.phone}. — ${biz.name}`;
}
async function draftReply(r, c) {
  const system = `당신은 "${biz.name}"(${biz.industry}, ${biz.city}) 사장님을 대신해 구글 리뷰에 답글을 쓰는 담당자다.
규칙(예외 없음): 리뷰어가 쓴 언어로 답한다. 2~4문장, 과장·이모지 남발 금지. 리뷰 대가·할인·보상 약속 금지.
고객이 검안·진료·처방을 받았다는 사실을 확인하거나 암시하지 않는다(건강 정보). 리뷰에 없는 개인정보를 쓰지 않는다.
직원 실명이 리뷰에 있어도 답글에서 반복하지 않는다. 낮은 별점이면 방어하지 말고 사과 → 경청 의지 → 연락처(${biz.phone}) 순서로.
톤: ${biz.tone}. 금지 표현: ${(biz.bannedPhrases || []).join(', ') || '없음'}. 서명은 "— ${biz.name}".
답글 본문만 출력한다.`;
  const prompt = `별점: ${c.stars}/5\n리뷰어: ${(r.reviewer && r.reviewer.displayName) || '(익명)'}\n리뷰 본문:\n${r.comment || '(본문 없음 — 별점만)'}\n\n등급: ${c.grade}${c.risks.length ? ' (주의: ' + c.risks.join(', ') + ')' : ''}`;
  try {
    const out = await gbp.claude(prompt, { system, maxTokens: 400 });
    if (out && out.trim()) return { text: out.trim(), by: 'claude' };
  } catch (e) { console.error('  claude 실패, 템플릿으로 폴백:', e.message); }
  return { text: templateReply(r, c), by: 'template' };
}

/* ---------- 명령 ---------- */
function sinceMs(s) { const m = /^(\d+)([dhm])$/.exec(s || ''); if (!m || !Number(m[1])) return 0; return Date.now() - m[1] * { d: 864e5, h: 36e5, m: 6e4 }[m[2]]; }

async function fetchReviews() {
  if (DRY) return JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'sample-reviews.json'), 'utf8'));
  const location = opt('location', biz.location);
  if (!location) throw new Error('--location accounts/A/locations/L 이 필요합니다 (biz 파일의 location 또는 인자)');
  const all = []; let pageToken;
  do {
    const d = await gbp.listReviews(location, { pageToken });
    all.push(...(d.reviews || [])); pageToken = d.nextPageToken;
  } while (pageToken && all.length < 200);
  return all;
}

(async () => {
  if (cmd === 'locations') {
    const accounts = await gbp.listAccounts();
    for (const a of accounts) {
      console.log(`\n계정: ${a.name}  (${a.accountName || ''} · ${a.type || ''})`);
      const locs = await gbp.listLocations(a.name);
      for (const l of locs) console.log(`  ${a.name}/${l.name.split('/').slice(-2).join('/')}  ${l.title}  ${(l.storefrontAddress && l.storefrontAddress.locality) || ''}`);
    }
    console.log('\n→ biz 파일의 "location" 에 accounts/…/locations/… 를 넣으세요.');
    return;
  }
  if (cmd === 'list' || cmd === 'draft') {
    const since = sinceMs(opt('since', '0d'));
    const reviews = (await fetchReviews()).filter((r) => !since || new Date(r.updateTime || r.createTime).getTime() >= since);
    const rows = [];
    for (const r of reviews) {
      const c = classify(r);
      const replied = !!(r.reviewReply && r.reviewReply.comment);
      const row = { name: r.name, reviewer: (r.reviewer && r.reviewer.displayName) || '', stars: c.stars, grade: c.grade, risks: c.risks, replied, createTime: r.createTime, comment: r.comment || '' };
      if (cmd === 'draft' && !replied) {
        const d = await draftReply(r, c);
        row.draft = d.text; row.draftBy = d.by;
        row.approved = false; // 사람이 true로 바꾸거나, --auto 로 AUTO 등급만 게시
      }
      rows.push(row);
      console.log(`\n[${c.grade}] ★${c.stars} ${row.reviewer} ${replied ? '(답글 있음)' : ''}${c.risks.length ? '  ⚠ ' + c.risks.join(', ') : ''}`);
      console.log('  ' + (r.comment || '(본문 없음)').replace(/\s+/g, ' ').slice(0, 160));
      if (row.draft) console.log('  ↳ 초안(' + row.draftBy + '): ' + row.draft.replace(/\s+/g, ' '));
    }
    const out = opt('out', cmd === 'draft' ? path.join(__dirname, 'queue.json') : null);
    if (out) { fs.writeFileSync(out, JSON.stringify(rows, null, 2)); console.log(`\n저장: ${out} (${rows.length}건) — approved 를 true 로 바꾼 뒤 post 명령으로 게시`); }
    const n = rows.filter((x) => !x.replied).length, auto = rows.filter((x) => !x.replied && x.grade === 'AUTO').length;
    console.log(`\n요약: 전체 ${rows.length} · 미답글 ${n} · 자동 게시 후보 ${auto} · 사람 승인 필요 ${n - auto}`);
    return;
  }
  if (cmd === 'post') {
    const q = JSON.parse(fs.readFileSync(opt('queue', path.join(__dirname, 'queue.json')), 'utf8'));
    const auto = !!opt('auto', false);
    let posted = 0;
    for (const row of q) {
      if (row.replied || !row.draft) continue;
      const ok = row.approved === true || (auto && row.grade === 'AUTO');
      if (!ok) { console.log(`건너뜀 (승인 필요): ★${row.stars} ${row.reviewer}`); continue; }
      if (DRY) { console.log(`[dry-run] 게시 예정 → ${row.name}\n  ${row.draft}`); posted++; continue; }
      await gbp.replyToReview(row.name, row.draft);
      row.replied = true; row.postedAt = new Date().toISOString(); posted++;
      console.log(`게시됨: ★${row.stars} ${row.reviewer}`);
    }
    if (!DRY) fs.writeFileSync(opt('queue', path.join(__dirname, 'queue.json')), JSON.stringify(q, null, 2));
    console.log(`\n게시 ${posted}건`);
    return;
  }
  console.log('사용법: node automation/gbp/reviews.js locations | list | draft | post  (--dry-run, --location, --since 7d, --out, --queue, --auto)');
})().catch((e) => { console.error('\n오류:', e.message); process.exit(1); });
