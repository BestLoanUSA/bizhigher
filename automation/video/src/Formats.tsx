/**
 * 숏폼 템플릿 4종 (9:16, 30fps) — docs/shortform-playbook-ko.md 의 분해 결과를 적용.
 *   List: 훅 → ①②③ 이유 카드(사진 줌 펀치·번호·단어 팝 자막) → 엔드       14~16초
 *   Tour: 훅 → 사진 6~8장 박자 컷(장마다 한 단어 자막) → 엔드                10~13초
 *   BeforeAfter: 훅 → "전" 숫자 → 쓸어내기 → "지금" 카운트업 → 엔드        11~13초
 *   Menu: 훅 → 항목이 가격과 함께 차례로 튀어나옴 → 엔드                     12~16초
 * 모든 값은 creative.js promo --template 이 스펙·--props 에서 만든다. 없는 값은 지어내지 않고 그 요소가 빠진다.
 */
import React from 'react';
import { AbsoluteFill, Sequence, OffthreadVideo, Img, staticFile, useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { KineticCaption, Photo, Flash, Progress, beatFrames, punchScale, countUp, FONT, INK } from './Kinetic';
import { Brand, End, useFont, PromoProps } from './Promo';

export type Base = Pick<PromoProps, 'name' | 'name_ko' | 'accent' | 'logo' | 'font' | 'phone' | 'address' | 'hours' | 'cta'> & { hook: { line: string; lead?: string; em?: string }; clip?: string; photo?: string; bpm?: number; captionPos?: 'top' | 'mid' | 'bottom' };
export type ListProps = Base & { reasons: { title: string; sub?: string; photo?: string }[] };
export type TourProps = Base & { photos: string[]; captions?: string[] };
export type BAProps = Base & { pairs: { label: string; before: string | number; after: string | number }[] };
export type MenuProps = Base & { items: { name: string; price?: string; sub?: string; photo?: string }[] };

const HOOK = 66, ENDF = 96, OV = 10;
const P = (p: Base) => ({ ...p, accent: p.accent || '#0A4DF5' });
const hookText = (h: Base['hook']) => { if (!h) return ''; const line = h.line || ''; return h.em && line.includes(h.em) ? line.replace(h.em, `*${h.em.replace(/\s+/g, ' ')}*`) : line; };

/** 공통 훅 장면 — 첫 1초에 글자 펀치 + 줌, 브랜드는 40프레임 뒤 작게 */
const Hook: React.FC<Base & { bg?: string }> = (p) => {
  const frame = useCurrentFrame();
  const z = interpolate(frame, [0, 14], [1.0, 1.08], { extrapolateRight: 'clamp' }) * interpolate(frame, [14, HOOK + OV], [1, 1.12], { extrapolateLeft: 'clamp' });
  const brand = spring({ frame: frame - 40, fps: 30, config: { damping: 200 } });
  const bg = p.bg || p.photo;
  return (
    <AbsoluteFill style={{ background: INK }}>
      {p.clip ? <OffthreadVideo src={staticFile(p.clip)} muted style={{ width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${z})` }} />
        : bg ? <Img src={staticFile(bg)} style={{ width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${z})` }} /> : <AbsoluteFill style={{ background: p.accent }} />}
      <AbsoluteFill style={{ background: 'linear-gradient(180deg, rgba(0,0,0,.35) 0%, rgba(0,0,0,.15) 40%, rgba(0,0,0,.6) 100%)' }} />
      {p.hook.lead ? <div style={{ position: 'absolute', left: 56, right: 56, top: '30%', textAlign: 'center', color: '#fff', fontFamily: FONT, fontSize: 44, fontWeight: 600, opacity: interpolate(frame, [4, 16], [0, 1], { extrapolateRight: 'clamp' }), textShadow: '0 2px 12px rgba(0,0,0,.6)' }}>{p.hook.lead}</div> : null}
      <KineticCaption text={hookText(p.hook)} at={2} accent={p.accent!} pos="mid" size={104} stagger={4} />
      <div style={{ opacity: brand }}><Brand logo={p.logo} name={p.name} /></div>
    </AbsoluteFill>
  );
};

/* ───────── List: 3가지 이유 ───────── */
const REASON = 78;
export function listDuration(p: ListProps) { return HOOK + REASON * Math.min(4, (p.reasons || []).filter((r) => r && r.title).length) + ENDF; }
const Reason: React.FC<{ r: ListProps['reasons'][0]; i: number; n: number; accent: string; pos?: Base['captionPos']; fallback?: string }> = ({ r, i, n, accent, pos, fallback }) => {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig();
  const num = spring({ frame: frame - 2, fps, config: { damping: 11, stiffness: 180 } });
  const wipe = interpolate(frame, [0, 12], [100, 0], { extrapolateRight: 'clamp' });
  const src = r.photo || fallback;
  return (
    <AbsoluteFill style={{ clipPath: `inset(0 0 0 ${wipe}%)`, background: INK }}>
      {src ? <Photo src={staticFile(src)} cuts={[0]} pan={(i % 2 ? 1 : -1) * 1.5} /> : <AbsoluteFill style={{ background: accent, opacity: .9 }} />}
      <div style={{ position: 'absolute', left: 56, top: 200, display: 'flex', alignItems: 'center', gap: 22, opacity: num, transform: `scale(${0.6 + num * 0.4})`, transformOrigin: 'left center' }}>
        <div style={{ width: 120, height: 120, borderRadius: 32, background: accent, color: '#fff', fontFamily: FONT, fontWeight: 900, fontSize: 68, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 10px 30px rgba(0,0,0,.35)' }}>{i + 1}</div>
        <div style={{ color: '#fff', fontFamily: FONT, fontSize: 36, fontWeight: 600, opacity: .9, textShadow: '0 2px 10px rgba(0,0,0,.6)' }}>{i + 1} / {n}</div>
      </div>
      <KineticCaption text={r.title} at={6} accent={accent} pos={pos || 'bottom'} size={r.title.length > 10 ? 84 : 100} />
      {r.sub ? <div style={{ position: 'absolute', left: 56, right: 56, bottom: 200, textAlign: 'center', color: '#fff', fontFamily: FONT, fontSize: 42, fontWeight: 500, opacity: interpolate(frame, [24, 36], [0, 1], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' }), textShadow: '0 2px 12px rgba(0,0,0,.7)', wordBreak: 'keep-all' }}>{r.sub}</div> : null}
    </AbsoluteFill>
  );
};
export const List: React.FC<ListProps> = (p0) => {
  const p = P(p0) as ListProps; useFont(p.font);
  const reasons = (p.reasons || []).filter((r) => r && r.title).slice(0, 4);
  const photos = reasons.map((r) => r.photo).filter(Boolean) as string[];
  let at = 0; const seq = (d: number, last = false) => { const from = at; at += d; return { from, durationInFrames: last ? d : d + OV }; };
  return (
    <AbsoluteFill style={{ background: INK }}>
      <Sequence {...seq(HOOK)}><Hook {...p} bg={p.photo || photos[0]} /></Sequence>
      {reasons.map((r, i) => <Sequence key={i} {...seq(REASON)}><Reason r={r} i={i} n={reasons.length} accent={p.accent!} pos={p.captionPos} fallback={p.photo || photos[i % Math.max(1, photos.length)]} /></Sequence>)}
      <Sequence {...seq(ENDF, true)}><End {...(p as any)} services={[]} highlights={[]} /></Sequence>
      <Progress accent={p.accent!} />
    </AbsoluteFill>
  );
};

/* ───────── Tour: POV 매장 투어 ───────── */
const SHOT = 45;
export function tourDuration(p: TourProps) { return HOOK + SHOT * Math.min(10, (p.photos || []).length) + ENDF; }
export const Tour: React.FC<TourProps> = (p0) => {
  const p = P(p0) as TourProps; useFont(p.font);
  const photos = (p.photos || []).slice(0, 10); const caps = p.captions || [];
  const frame = useCurrentFrame();
  let at = 0; const seq = (d: number, last = false) => { const from = at; at += d; return { from, durationInFrames: last ? d : d + 2 }; };
  const cuts = photos.map((_, i) => HOOK + i * SHOT);
  return (
    <AbsoluteFill style={{ background: INK }}>
      <Sequence {...seq(HOOK)}><Hook {...p} bg={p.photo || photos[0]} /></Sequence>
      {photos.map((src, i) => (
        <Sequence key={i} {...seq(SHOT)}>
          <Photo src={staticFile(src)} cuts={[0]} from={i % 2 ? 1.12 : 1.02} to={i % 2 ? 1.02 : 1.12} pan={(i % 3 - 1) * 2} dim={0.2} />
          {caps[i] ? <KineticCaption text={caps[i]} at={3} accent={p.accent!} pos={p.captionPos || 'bottom'} size={caps[i].length > 8 ? 80 : 110} stagger={3} /> : null}
          <div style={{ position: 'absolute', right: 56, top: 230, color: '#fff', fontFamily: FONT, fontWeight: 800, fontSize: 34, opacity: .85, textShadow: '0 2px 10px rgba(0,0,0,.6)' }}>{i + 1}/{photos.length}</div>
        </Sequence>
      ))}
      <Flash cuts={cuts} strength={0.4} />
      <Sequence {...seq(ENDF, true)}><End {...(p as any)} services={[]} highlights={[]} /></Sequence>
      <Progress accent={p.accent!} />
      {frame > 40 && frame < HOOK + SHOT * photos.length ? <Brand logo={p.logo} name={p.name} /> : null}
    </AbsoluteFill>
  );
};

/* ───────── BeforeAfter: 시작 전과 지금 ───────── */
const BA = 190;
export function baDuration(_p: BAProps) { return HOOK + BA + ENDF; }
const Pairs: React.FC<{ pairs: BAProps['pairs']; mode: 'before' | 'after'; accent: string; at: number }> = ({ pairs, mode, accent, at }) => {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig();
  return (
    <div style={{ position: 'absolute', left: 56, right: 56, top: 520, display: 'flex', flexDirection: 'column', gap: 34, fontFamily: FONT }}>
      {pairs.slice(0, 4).map((pr, i) => {
        const s = spring({ frame: frame - at - i * 8, fps, config: { damping: 14, stiffness: 140 } });
        const raw = mode === 'before' ? pr.before : pr.after; const num = Number(raw); const isNum = raw !== '' && !isNaN(num);
        const shown = mode === 'after' && isNum ? countUp(frame, at + i * 8, 40, num) : String(raw);
        return (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', opacity: s, transform: `translateY(${(1 - s) * 30}px)`, borderBottom: `2px solid ${mode === 'after' ? 'rgba(255,255,255,.35)' : 'rgba(0,0,0,.12)'}`, paddingBottom: 18 }}>
            <span style={{ fontSize: 46, fontWeight: 600, color: mode === 'after' ? '#fff' : '#3F3F46' }}>{pr.label}</span>
            <span style={{ fontSize: 112, fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1, color: mode === 'after' ? '#fff' : '#71717A' }}>{shown}</span>
          </div>
        );
      })}
    </div>
  );
};
export const BeforeAfter: React.FC<BAProps> = (p0) => {
  const p = P(p0) as BAProps; useFont(p.font);
  const pairs = (p.pairs || []).filter((x) => x && x.label);
  let at = 0; const seq = (d: number, last = false) => { const from = at; at += d; return { from, durationInFrames: last ? d : d + OV }; };
  const Scene: React.FC = () => {
    const frame = useCurrentFrame();
    const wipe = interpolate(frame, [78, 100], [100, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
    return (
      <AbsoluteFill style={{ background: '#E4E4E7' }}>
        {p.photo ? <Img src={staticFile(p.photo)} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', filter: 'grayscale(1) contrast(.9)', opacity: .35 }} /> : null}
        <div style={{ position: 'absolute', left: 56, top: 230, fontFamily: FONT, color: '#3F3F46', fontSize: 40, fontWeight: 700, letterSpacing: '.2em' }}>BEFORE</div>
        <div style={{ position: 'absolute', left: 56, right: 56, top: 300, fontFamily: FONT, color: '#18181B', fontSize: 96, fontWeight: 900, letterSpacing: '-0.03em' }}>시작 전</div>
        <Pairs pairs={pairs} mode="before" accent={p.accent!} at={6} />
        <AbsoluteFill style={{ clipPath: `inset(0 0 ${wipe}% 0)`, background: p.accent }}>
          {p.photo ? <Img src={staticFile(p.photo)} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: .22, transform: `scale(${punchScale(frame, [100], 1.06)})` }} /> : null}
          <div style={{ position: 'absolute', left: 56, top: 230, fontFamily: FONT, color: 'rgba(255,255,255,.85)', fontSize: 40, fontWeight: 700, letterSpacing: '.2em' }}>AFTER</div>
          <div style={{ position: 'absolute', left: 56, right: 56, top: 300, fontFamily: FONT, color: '#fff', fontSize: 96, fontWeight: 900, letterSpacing: '-0.03em' }}>지금</div>
          <Pairs pairs={pairs} mode="after" accent={p.accent!} at={100} />
        </AbsoluteFill>
        <Flash cuts={[100]} strength={0.5} />
      </AbsoluteFill>
    );
  };
  return (
    <AbsoluteFill style={{ background: INK }}>
      <Sequence {...seq(HOOK)}><Hook {...p} /></Sequence>
      <Sequence {...seq(BA)}><Scene /></Sequence>
      <Sequence {...seq(ENDF, true)}><End {...(p as any)} services={[]} highlights={[]} /></Sequence>
      <Progress accent={p.accent!} />
    </AbsoluteFill>
  );
};

/* ───────── Menu: 메뉴·서비스 리빌 ───────── */
const ROW = 32, HOLD = 70;
export function menuDuration(p: MenuProps) { return HOOK + ROW * Math.min(6, (p.items || []).filter((x) => x && x.name).length) + HOLD + ENDF; }
export const Menu: React.FC<MenuProps> = (p0) => {
  const p = P(p0) as MenuProps; useFont(p.font);
  const items = (p.items || []).filter((x) => x && x.name).slice(0, 6);
  let at = 0; const seq = (d: number, last = false) => { const from = at; at += d; return { from, durationInFrames: last ? d : d + OV }; };
  const Scene: React.FC = () => {
    const frame = useCurrentFrame(); const { fps } = useVideoConfig();
    const cuts = items.map((_, i) => i * ROW); const bg = p.photo || items.find((x) => x.photo)?.photo;
    return (
      <AbsoluteFill style={{ background: INK }}>
        {bg ? <Photo src={staticFile(bg)} cuts={cuts} from={1.04} to={1.12} dim={0.45} /> : <AbsoluteFill style={{ background: p.accent, opacity: .9 }} />}
        <AbsoluteFill style={{ background: 'rgba(0,0,0,.35)' }} />
        <Brand logo={p.logo} name={p.name} />
        <div style={{ position: 'absolute', left: 56, right: 56, top: 300, fontFamily: FONT, color: '#fff' }}>
          {items.map((it, i) => {
            const s = spring({ frame: frame - i * ROW, fps, config: { damping: 13, stiffness: 150 } });
            const ps = spring({ frame: frame - i * ROW - 8, fps, config: { damping: 10, stiffness: 200 } });
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 18, padding: '26px 0', borderBottom: '2px solid rgba(255,255,255,.25)', opacity: s, transform: `translateX(${(1 - s) * -60}px)` }}>
                <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: it.name.length > 8 ? 56 : 68, fontWeight: 900, letterSpacing: '-0.02em', wordBreak: 'keep-all', textShadow: '0 2px 12px rgba(0,0,0,.6)' }}>{it.name}</div>{it.sub ? <div style={{ fontSize: 32, fontWeight: 500, opacity: .9, marginTop: 4, wordBreak: 'keep-all' }}>{it.sub}</div> : null}</div>
                {it.price ? <div style={{ fontSize: 62, fontWeight: 900, color: p.accent, background: '#fff', borderRadius: 18, padding: '4px 20px', transform: `scale(${0.5 + ps * 0.5})`, opacity: ps, whiteSpace: 'nowrap' }}>{it.price}</div> : null}
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
    );
  };
  return (
    <AbsoluteFill style={{ background: INK }}>
      <Sequence {...seq(HOOK)}><Hook {...p} bg={p.photo || items.find((x) => x.photo)?.photo} /></Sequence>
      <Sequence {...seq(ROW * items.length + HOLD)}><Scene /></Sequence>
      <Sequence {...seq(ENDF, true)}><End {...(p as any)} services={[]} highlights={[]} /></Sequence>
      <Progress accent={p.accent!} />
    </AbsoluteFill>
  );
};
