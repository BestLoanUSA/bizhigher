/**
 * 프로모 템플릿 (9:16, 30fps, 약 20초) — 훅 → 서비스 ≤3 장면 → 왜 우리 → 엔드카드
 * props 는 사이트 스펙(D1 sites.spec)에서 creative.js promo 가 만든다. 스펙에 없는 값은 비워 두면 그 장면·요소가 빠진다(지어내지 않는다).
 * 글꼴: public/NotoSansKR.ttf 가 있으면 그걸, 없으면 구글 폰트 링크. 모든 모션은 spring/interpolate 라 프레임 결정적.
 */
import React, { useEffect, useState } from 'react';
import { AbsoluteFill, Sequence, OffthreadVideo, Img, staticFile, useCurrentFrame, useVideoConfig, interpolate, spring, delayRender, continueRender, Easing } from 'remotion';

export const FPS = 30;
/** 장면 길이(프레임) */
export const T = { hook: 150, svc: 60, why: 120, end: 150 };
const OV = 14; // 장면 겹침 — 다음 장면이 이 위에서 와이프/페이드 인

export type PromoProps = {
  name: string; name_ko?: string; accent?: string; logo?: string; font?: string;
  clip?: string; photo?: string;
  hook: { lead?: string; line: string; em?: string };
  services: { name: string; sub?: string; photo?: string }[];
  highlights: string[];
  rating?: number; review_count?: number;
  phone?: string; address?: string; hours?: string[]; cta?: string;
};

export function durationFor(p: PromoProps) {
  const n = Math.min(3, (p.services || []).filter((s) => s && s.name).length);
  return T.hook + T.svc * n + ((p.highlights || []).length ? T.why : 0) + T.end;
}

export const SAMPLE: PromoProps = {
  name: 'New Optix', name_ko: '뉴옵틱스', accent: '#0A4DF5', photo: '',
  hook: { lead: '가든그로브 안경점', line: '안경을 직접 써 보고 고르세요', em: '직접 써 보고' },
  services: [{ name: '안경테', sub: '얼굴형에 맞게 직접 비교' }, { name: '선글라스', sub: '모양과 착용감을 그 자리에서' }, { name: '콘택트렌즈', sub: '매장 재고 · 전화 문의' }],
  highlights: ['직접 써 보고 선택', '한국어 · 영어 상담'], rating: 4.7, review_count: 14,
  phone: '(714) 530-6700', address: '9520 Garden Grove Blvd Ste 4, Garden Grove', hours: ['월·목 10:00–16:00', '화·수·금·토 10:00–18:00', '일 휴무'], cta: '지금 전화하세요',
};

const FONT = "'NotoKR', 'Noto Sans KR', sans-serif";
const INK = '#0B1220';
const PAPER = '#F5F7FB';

function useFont(font?: string) {
  const [handle] = useState(() => delayRender('font'));
  useEffect(() => {
    const done = () => continueRender(handle);
    if (font) {
      const f = new FontFace('NotoKR', `url(${staticFile(font)})`, { weight: '100 900' } as any);
      f.load().then((ff) => { (document as any).fonts.add(ff); done(); }).catch(done);
    } else {
      const link = document.createElement('link'); link.rel = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@500;700;900&display=swap';
      link.onload = () => (document as any).fonts.ready.then(done, done); link.onerror = done;
      document.head.appendChild(link); setTimeout(done, 8000);
    }
  }, [handle, font]);
}

const Brand: React.FC<{ logo?: string; name: string; dark?: boolean }> = ({ logo, name, dark }) => (
  <div style={{ position: 'absolute', top: 64, left: 64, display: 'flex', alignItems: 'center', gap: 18, color: dark ? INK : '#fff', fontWeight: 700, fontSize: 34, letterSpacing: '-0.01em', textShadow: dark ? 'none' : '0 1px 10px rgba(0,0,0,.45)' }}>
    {logo ? <Img src={staticFile(logo)} style={{ height: 56, width: 'auto', borderRadius: 12, background: '#fff', padding: 6 }} /> : null}
    <span>{name}</span>
  </div>
);

/** 1. 훅 — 클립(또는 사진 켄번스) 위에 단어가 차례로 솟고, 강조어 뒤로 마커가 쓸고 지나간다 */
const Hook: React.FC<PromoProps> = ({ clip, photo, hook, accent, logo, name }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const words = (hook.line || '').split(' ').filter(Boolean);
  const emWords = (hook.em || '').split(' ').filter(Boolean);
  const lead = spring({ frame: frame - 10, fps, config: { damping: 200 } });
  const marker = interpolate(frame, [48, 70], [0, 100], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
  const size = words.join('').length > 14 ? 88 : 104;
  return (
    <AbsoluteFill>
      {clip ? <OffthreadVideo src={staticFile(clip)} muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : photo ? <Img src={staticFile(photo)} style={{ width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${interpolate(frame, [0, T.hook + OV], [1.02, 1.14])})` }} />
        : <AbsoluteFill style={{ background: accent }} />}
      <AbsoluteFill style={{ background: 'linear-gradient(180deg, rgba(0,0,0,.25) 0%, rgba(0,0,0,0) 35%, rgba(0,0,0,.72) 100%)' }} />
      <Brand logo={logo} name={name} />
      <div style={{ position: 'absolute', left: 64, right: 64, bottom: 190, color: '#fff', fontFamily: FONT }}>
        {hook.lead ? <div style={{ fontSize: 48, fontWeight: 500, opacity: lead, transform: `translateY(${(1 - lead) * 20}px)`, marginBottom: 18, textShadow: '0 2px 14px rgba(0,0,0,.5)' }}>{hook.lead}</div> : null}
        <div style={{ fontSize: size, fontWeight: 900, lineHeight: 1.12, letterSpacing: '-0.03em', wordBreak: 'keep-all', textShadow: '0 2px 18px rgba(0,0,0,.55)' }}>
          {words.map((w, i) => {
            const s = spring({ frame: frame - 18 - i * 6, fps, config: { damping: 14, stiffness: 120 } });
            const isEm = emWords.includes(w);
            return (
              <span key={i} style={{ display: 'inline-block', marginRight: 22, position: 'relative', opacity: s, transform: `translateY(${(1 - s) * 60}px)` }}>
                {isEm ? <span style={{ position: 'absolute', left: -6, right: -6, bottom: 8, height: 30, width: `${marker}%`, background: accent, zIndex: -1, borderRadius: 6 }} /> : null}
                {w}
              </span>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** 2. 서비스 — 사진 켄번스 + 이름이 아래에서 솟는다. 오른쪽에서 밀고 들어오는 와이프 */
const Service: React.FC<{ svc: PromoProps['services'][0]; accent: string; idx: number; total: number }> = ({ svc, accent, idx, total }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const zoom = interpolate(frame, [0, T.svc + OV], [1.06, 1.16]);
  const wipe = interpolate(frame, [0, 14], [100, 0], { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
  const s = spring({ frame: frame - 8, fps, config: { damping: 16, stiffness: 110 } });
  return (
    <AbsoluteFill style={{ clipPath: `inset(0 ${wipe}% 0 0)`, background: INK }}>
      {svc.photo ? <Img src={staticFile(svc.photo)} style={{ width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${zoom}) translateX(${(idx - 1) * -2}%)` }} /> : <AbsoluteFill style={{ background: accent, opacity: .85 }} />}
      <AbsoluteFill style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0) 45%, rgba(0,0,0,.7) 100%)' }} />
      <div style={{ position: 'absolute', left: 64, right: 64, bottom: 220, color: '#fff', fontFamily: FONT, transform: `translateY(${(1 - s) * 50}px)`, opacity: s }}>
        <div style={{ fontSize: svc.name.length > 6 ? 96 : 120, fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1, wordBreak: 'keep-all', textShadow: '0 2px 18px rgba(0,0,0,.5)' }}>{svc.name}</div>
        {svc.sub ? <div style={{ fontSize: 44, fontWeight: 500, marginTop: 18, opacity: .95, wordBreak: 'keep-all', textShadow: '0 1px 10px rgba(0,0,0,.5)' }}>{svc.sub}</div> : null}
      </div>
      <div style={{ position: 'absolute', left: 64, right: 64, bottom: 150, display: 'flex', gap: 10 }}>
        {Array.from({ length: total }).map((_, i) => <div key={i} style={{ flex: 1, height: 6, borderRadius: 3, background: i < idx ? '#fff' : 'rgba(255,255,255,.35)', overflow: 'hidden' }}>{i === idx ? <div style={{ height: '100%', width: `${Math.min(100, (frame / T.svc) * 100)}%`, background: accent }} /> : null}</div>)}
      </div>
    </AbsoluteFill>
  );
};

/** 3. 왜 우리 — 밝은 배경, 체크 행이 차례로. 별점은 스펙 값만 */
const Why: React.FC<PromoProps> = ({ highlights, rating, review_count, accent, logo, name, name_ko }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const title = spring({ frame: frame - 4, fps, config: { damping: 200 } });
  const rs = spring({ frame: frame - 46, fps, config: { damping: 200 } });
  return (
    <AbsoluteFill style={{ background: PAPER, opacity: interpolate(frame, [0, 10], [0, 1], { extrapolateRight: 'clamp' }), fontFamily: FONT, color: INK }}>
      <Brand logo={logo} name={name} dark />
      <div style={{ position: 'absolute', left: 64, right: 64, top: 420 }}>
        <div style={{ fontSize: 88, fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1.1, wordBreak: 'keep-all', opacity: title, transform: `translateY(${(1 - title) * 24}px)` }}>{name_ko || name}에서는</div>
        <div style={{ marginTop: 70, display: 'flex', flexDirection: 'column', gap: 44 }}>
          {highlights.slice(0, 4).map((h, i) => {
            const s = spring({ frame: frame - 18 - i * 12, fps, config: { damping: 15, stiffness: 120 } });
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 28, opacity: s, transform: `translateX(${(1 - s) * -40}px)` }}>
                <div style={{ width: 64, height: 64, borderRadius: 32, background: accent, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40, fontWeight: 900, flexShrink: 0 }}>✓</div>
                <div style={{ fontSize: h.length > 14 ? 48 : 56, fontWeight: 700, letterSpacing: '-0.02em', wordBreak: 'keep-all' }}>{h}</div>
              </div>
            );
          })}
        </div>
        {rating ? (
          <div style={{ marginTop: 90, display: 'inline-flex', alignItems: 'baseline', gap: 16, opacity: rs, transform: `scale(${0.9 + rs * 0.1})`, transformOrigin: 'left' }}>
            <span style={{ fontSize: 120, fontWeight: 900, letterSpacing: '-0.04em', color: accent }}>{rating}</span>
            <span style={{ fontSize: 40, fontWeight: 500, color: '#4B5563' }}>★ 구글 리뷰{review_count ? ` ${review_count}개` : ''}</span>
          </div>) : null}
      </div>
    </AbsoluteFill>
  );
};

/** 4. 엔드카드 — 브랜드 색, 전화번호가 가장 크다 */
const End: React.FC<PromoProps> = ({ accent, logo, name, name_ko, phone, address, hours, cta }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const a = (d: number) => spring({ frame: frame - d, fps, config: { damping: 18, stiffness: 110 } });
  const pulse = 1 + Math.sin(frame / 9) * 0.02;
  return (
    <AbsoluteFill style={{ background: accent, color: '#fff', fontFamily: FONT, opacity: interpolate(frame, [0, 8], [0, 1], { extrapolateRight: 'clamp' }), alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
      {logo ? <div style={{ opacity: a(2), transform: `scale(${0.8 + a(2) * 0.2})` }}><Img src={staticFile(logo)} style={{ height: 150, width: 'auto', borderRadius: 28, background: '#fff', padding: 16 }} /></div> : null}
      <div style={{ marginTop: 36, fontSize: 72, fontWeight: 900, letterSpacing: '-0.02em', opacity: a(8), transform: `translateY(${(1 - a(8)) * 20}px)` }}>{name_ko || name}</div>
      {phone ? <div style={{ marginTop: 56, fontSize: 118, fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1, opacity: a(16), transform: `translateY(${(1 - a(16)) * 24}px)` }}>{phone}</div> : null}
      {address ? <div style={{ marginTop: 40, fontSize: 40, fontWeight: 500, opacity: a(24) * 0.95, padding: '0 90px', lineHeight: 1.4, wordBreak: 'keep-all' }}>{address}</div> : null}
      {hours && hours.length ? <div style={{ marginTop: 16, fontSize: 36, fontWeight: 500, opacity: a(30) * 0.85, lineHeight: 1.5 }}>{hours.map((h, i) => <div key={i}>{h}</div>)}</div> : null}
      {cta ? <div style={{ marginTop: 80, padding: '30px 66px', borderRadius: 999, background: '#fff', color: accent, fontSize: 52, fontWeight: 900, opacity: a(40), transform: `scale(${a(40) * pulse})` }}>{cta}</div> : null}
    </AbsoluteFill>
  );
};

export const Promo: React.FC<PromoProps> = (p0) => {
  const p: PromoProps = { ...p0, accent: p0.accent || '#0A4DF5', services: (p0.services || []).filter((s) => s && s.name).slice(0, 3), highlights: p0.highlights || [] };
  useFont(p.font);
  let at = 0;
  const seq = (dur: number, last = false) => { const from = at; at += dur; return { from, durationInFrames: last ? dur : dur + OV }; };
  return (
    <AbsoluteFill style={{ background: INK }}>
      <Sequence {...seq(T.hook)}><Hook {...p} /></Sequence>
      {p.services.map((svc, i) => <Sequence key={i} {...seq(T.svc)}><Service svc={svc} idx={i} total={p.services.length} accent={p.accent!} /></Sequence>)}
      {p.highlights.length ? <Sequence {...seq(T.why)}><Why {...p} /></Sequence> : null}
      <Sequence {...seq(T.end, true)}><End {...p} /></Sequence>
    </AbsoluteFill>
  );
};
