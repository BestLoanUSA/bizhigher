#!/usr/bin/env node
/**
 * 구글 프로필 게시물 자동화 실험 — 월간 캘린더(JSON) → 초안 → (승인된 것만) 게시
 *
 * 승인 단위는 월 1회 캘린더(CLAUDE.md §15). 건별 승인은 하지 않는다.
 *
 * 사용법
 *   node automation/gbp/posts.js plan  [--month 2026-10] [--n 8]      # 업소 정보로 한 달치 게시물 초안 생성 → calendar-YYYY-MM.json
 *   node automation/gbp/posts.js show  --calendar calendar-2026-10.json
 *   node automation/gbp/posts.js post  --calendar calendar-2026-10.json [--due]   # approved:true 인 것 중 (--due 면 오늘 이전 예정분만) 게시
 *   node automation/gbp/posts.js list  --location accounts/A/locations/L        # 올라간 게시물 확인
 *   --dry-run 을 붙이면 API를 호출하지 않는다
 *
 * 게시물 규격: 본문 1,500자 이내(권장 100~300자), 사진 1장(공개 URL, 1200×900 권장), CTA 1개. 게시물은 7일 뒤 피드에서 내려간다.
 */
const fs = require('fs');
const path = require('path');
const gbp = require('./lib');

const args = process.argv.slice(2);
const cmd = args[0];
const opt = (k, d) => { const i = args.indexOf('--' + k); return i > -1 ? (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true) : d; };
const DRY = !!opt('dry-run', false);
const biz = JSON.parse(fs.readFileSync(opt('biz', path.join(__dirname, 'biz', 'new-optix.json')), 'utf8'));

function templatePlan(month, n) {
  const topics = biz.postTopics || ['이달의 추천', '영업시간 안내', '자주 묻는 질문', '서비스 소개', '손님 후기 감사', '시즌 안내', '신상품', '예약 안내'];
  const [y, m] = month.split('-').map(Number);
  const days = new Date(y, m, 0).getDate();
  return Array.from({ length: n }, (_, i) => {
    const day = Math.min(days, 2 + Math.round(i * (days - 3) / Math.max(1, n - 1)));
    return {
      date: `${month}-${String(day).padStart(2, '0')}`,
      topic: topics[i % topics.length],
      summary: `[${topics[i % topics.length]}] ${biz.name} — ${biz.oneLiner}. ${biz.hours ? '영업시간 ' + biz.hours + '.' : ''} 문의 ${biz.phone}`,
      cta: biz.website ? { type: 'LEARN_MORE', url: biz.website } : { type: 'CALL' },
      mediaUrl: '', // 공개 URL (Drive 공유 링크는 안 됨 — Cloudflare R2/사이트 경로 등)
      languageCode: 'ko',
      approved: false,
    };
  });
}

async function claudePlan(month, n) {
  const system = `당신은 "${biz.name}"(${biz.industry}, ${biz.city})의 구글 비즈니스 프로필 게시물을 쓰는 담당자다.
규칙: 한 달치 게시물 ${n}개를 JSON 배열로만 출력한다. 각 항목 {date:"YYYY-MM-DD", topic, summary, ctaType:"LEARN_MORE|CALL|BOOK|SHOP", languageCode:"ko"|"en"}.
summary는 100~280자, 과장·최상급·"최고" 금지, 가격·할인은 업소 정보에 있는 것만. 지역명(${biz.city})과 서비스 키워드를 자연스럽게 1~2개 포함.
리뷰 요청·리뷰 대가 언급 금지. 검안·진료 결과를 단정하는 의학적 표현 금지. 톤: ${biz.tone}. 금지 표현: ${(biz.bannedPhrases || []).join(', ') || '없음'}.`;
  const prompt = `대상 월: ${month}\n업소 정보: ${JSON.stringify({ name: biz.name, oneLiner: biz.oneLiner, services: biz.services, hours: biz.hours, website: biz.website, phone: biz.phone, highlights: biz.highlights, postTopics: biz.postTopics }, null, 0)}`;
  const out = await gbp.claude(prompt, { system, maxTokens: 3000 });
  if (!out) return null;
  const m = out.match(/\[[\s\S]*\]/); if (!m) return null;
  const arr = JSON.parse(m[0]);
  return arr.map((p) => ({
    date: p.date, topic: p.topic, summary: p.summary,
    cta: p.ctaType === 'CALL' ? { type: 'CALL' } : { type: p.ctaType || 'LEARN_MORE', url: biz.website },
    mediaUrl: '', languageCode: p.languageCode || 'ko', approved: false,
  }));
}

(async () => {
  if (cmd === 'plan') {
    const month = opt('month', new Date().toISOString().slice(0, 7));
    const n = parseInt(opt('n', '8'), 10);
    let plan = null;
    try { plan = await claudePlan(month, n); } catch (e) { console.error('claude 실패, 템플릿으로 폴백:', e.message); }
    if (!plan) plan = templatePlan(month, n);
    const out = opt('out', path.join(__dirname, `calendar-${month}.json`));
    fs.writeFileSync(out, JSON.stringify(plan, null, 2));
    plan.forEach((p) => console.log(`${p.date}  [${p.topic}]  ${p.summary.replace(/\s+/g, ' ').slice(0, 90)}…`));
    console.log(`\n저장: ${out} — 검토 후 각 항목 approved:true, mediaUrl 채우고 post 명령`);
    return;
  }
  if (cmd === 'show') {
    const cal = JSON.parse(fs.readFileSync(opt('calendar'), 'utf8'));
    cal.forEach((p) => console.log(`${p.approved ? '✓' : '·'} ${p.date} ${p.posted ? '(게시됨)' : ''} [${p.topic}] ${p.summary}\n`));
    return;
  }
  if (cmd === 'post') {
    const file = opt('calendar'); const cal = JSON.parse(fs.readFileSync(file, 'utf8'));
    const location = opt('location', biz.location);
    const today = new Date().toISOString().slice(0, 10);
    let n = 0;
    for (const p of cal) {
      if (p.posted || !p.approved) continue;
      if (opt('due', false) && p.date > today) continue;
      if (!p.mediaUrl) console.warn(`경고: ${p.date} 사진 없음 — 사진 없는 게시물은 노출이 약합니다`);
      if (DRY) { console.log(`[dry-run] ${p.date} 게시 예정: ${p.summary.slice(0, 80)}…`); n++; continue; }
      const res = await gbp.createLocalPost(location, p);
      p.posted = true; p.postedAt = new Date().toISOString(); p.postName = res.name; n++;
      console.log(`게시됨: ${p.date} → ${res.name}`);
    }
    if (!DRY) fs.writeFileSync(file, JSON.stringify(cal, null, 2));
    console.log(`\n게시 ${n}건`);
    return;
  }
  if (cmd === 'list') {
    const posts = await gbp.listLocalPosts(opt('location', biz.location));
    posts.forEach((p) => console.log(`${p.createTime}  ${p.state}  ${(p.summary || '').slice(0, 80)}`));
    return;
  }
  console.log('사용법: node automation/gbp/posts.js plan | show | post | list  (--month, --n, --calendar, --location, --due, --dry-run)');
})().catch((e) => { console.error('\n오류:', e.message); process.exit(1); });
