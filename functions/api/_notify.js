/**
 * David에게 보내는 알림 이메일 — Resend API 사용
 * 환경변수:
 *   RESEND_API_KEY  (필수 — 없으면 알림 없이 조용히 넘어감, 폼은 정상 동작)
 *   NOTIFY_EMAIL    (선택 — 기본 maxinchoi@gmail.com)
 *   NOTIFY_FROM     (선택 — 기본 "BizHigher <onboarding@resend.dev>",
 *                    bizhigher.com 도메인 인증 후 "BizHigher 알림 <alerts@bizhigher.com>" 권장)
 */

export async function notify(env, subject, rows) {
  if (!env.RESEND_API_KEY) return;
  const to = env.NOTIFY_EMAIL || 'maxinchoi@gmail.com';
  const from = env.NOTIFY_FROM || 'BizHigher <onboarding@resend.dev>';

  const table = rows
    .map(
      ([label, value]) =>
        `<tr><td style="padding:8px 14px;color:#6b7280;font-size:13px;white-space:nowrap;vertical-align:top;">${esc(label)}</td><td style="padding:8px 14px;font-size:14px;color:#111318;">${value}</td></tr>`
    )
    .join('');

  const html = `
  <div style="font-family:'Apple SD Gothic Neo','Malgun Gothic',sans-serif;max-width:520px;margin:0 auto;padding:24px;">
    <div style="font-size:18px;font-weight:800;margin-bottom:4px;">Biz<span style="color:#0A4DF5;">Higher</span></div>
    <h2 style="font-size:17px;margin:14px 0;">${esc(subject)}</h2>
    <table style="width:100%;border-collapse:collapse;background:#F6F7F9;border-radius:12px;">${table}</table>
    <p style="font-size:12px;color:#9CA3AF;margin-top:16px;">bizhigher.com 자동 알림 · 상세 내역은 Claude에게 "리드/주문 보여줘"라고 물어보세요.</p>
  </div>`;

  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({ from, to, subject, html }),
    });
  } catch {
    // 알림 실패는 조용히 무시 — 폼 처리에 영향 주지 않음
  }
}

export function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
