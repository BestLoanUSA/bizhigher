/**
 * 공용 모션 장치 — 유행 숏폼 분해 결과(docs/shortform-playbook-ko.md)를 그대로 코드로:
 * 단어 팝 자막(핵심어 색), 컷마다 줌 펀치, 컷 플래시, 박자 컷 프레임, 진행 바. 전부 spring/interpolate 라 프레임 결정적.
 */
import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring, Easing } from 'remotion';

export const FONT = "'NotoKR', 'Noto Sans KR', sans-serif";
export const INK = '#0B1220';

/** bpm → 컷 프레임 목록 (every 박자마다, 최소 간격 minSec) */
export function beatFrames(fps: number, bpm: number, total: number, every = 2, minSec = 1.4): number[] {
  const step = Math.max(minSec * fps, (60 / bpm) * fps * every); const out: number[] = [];
  for (let f = 0; f < total; f += step) out.push(Math.round(f));
  return out;
}

/** 줌 펀치 — cut 프레임에서 1→peak 로 튀고 20프레임 안에 돌아온다 */
export function punchScale(frame: number, cuts: number[], peak = 1.08): number {
  let s = 1;
  for (const c of cuts) { const d = frame - c; if (d >= 0 && d < 22) { const k = 1 - d / 22; s = Math.max(s, 1 + (peak - 1) * Math.pow(k, 1.6)); } }
  return s;
}

export const Flash: React.FC<{ cuts: number[]; strength?: number }> = ({ cuts, strength = 0.55 }) => {
  const frame = useCurrentFrame();
  let o = 0; for (const c of cuts) { const d = frame - c; if (d >= 0 && d < 8) o = Math.max(o, strength * (1 - d / 8)); }
  return o > 0 ? <AbsoluteFill style={{ background: '#fff', opacity: o, pointerEvents: 'none' }} /> : null;
};

export const Progress: React.FC<{ accent: string }> = ({ accent }) => {
  const frame = useCurrentFrame(); const { durationInFrames } = useVideoConfig();
  return <div style={{ position: 'absolute', top: 0, left: 0, height: 10, width: `${(frame / durationInFrames) * 100}%`, background: accent, zIndex: 20 }} />;
};

/** 단어 팝 자막. text: "안경 *직접* 써 보고" — *별표* 는 강조색. at: 시작 프레임. pos: top|mid|bottom. size: px */
/* 단어 간격(stagger) 기본 8프레임(0.27초) — 프로모 훅과 같은 "한 단어씩 올라오는" 속도. 4~5프레임이면 한꺼번에 뜨는 것처럼 보인다(2026-11-01 David 지적).
 * 강조어(*별표*)는 글자가 자리 잡은 뒤 뒤에서 마커가 쓸고 지나간다(프로모 훅과 동일) */
export const KineticCaption: React.FC<{ text: string; at?: number; accent: string; pos?: 'top' | 'mid' | 'bottom'; size?: number; stagger?: number; dark?: boolean; outline?: boolean; marker?: boolean }> = ({ text, at = 0, accent, pos = 'bottom', size = 96, stagger = 8, dark = false, outline = true, marker = true }) => {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig();
  const tokens = text.split(/\s+/).filter(Boolean);
  const lastAt = at + (tokens.length - 1) * stagger;
  const sweep = interpolate(frame, [lastAt + 14, lastAt + 32], [0, 100], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
  const top = pos === 'top' ? 230 : pos === 'mid' ? '38%' : undefined; const bottom = pos === 'bottom' ? 300 : undefined;
  const color = dark ? INK : '#fff';
  const stroke = outline ? (dark ? '0 0 0 #fff' : `-3px -3px 0 ${INK}, 3px -3px 0 ${INK}, -3px 3px 0 ${INK}, 3px 3px 0 ${INK}, 0 6px 22px rgba(0,0,0,.55)`) : 'none';
  return (
    <div style={{ position: 'absolute', left: 56, right: 56, top, bottom, textAlign: 'center', fontFamily: FONT, color, fontSize: size, fontWeight: 900, lineHeight: 1.12, letterSpacing: '-0.03em', wordBreak: 'keep-all', zIndex: 10 }}>
      {tokens.map((tk, i) => {
        const em = /^\*.+\*$/.test(tk); const w = tk.replace(/^\*|\*$/g, '');
        const s = spring({ frame: frame - at - i * stagger, fps, config: { damping: 14, stiffness: 120 } });
        return (
          <span key={i} style={{ display: 'inline-block', position: 'relative', marginRight: 20, opacity: s, transform: `translateY(${(1 - s) * 64}px)`, color: em ? accent : color, textShadow: em && !dark ? `-3px -3px 0 ${INK}, 3px -3px 0 ${INK}, -3px 3px 0 ${INK}, 3px 3px 0 ${INK}, 0 6px 22px rgba(0,0,0,.55)` : stroke }}>
            {em && marker ? <span style={{ position: 'absolute', left: -8, right: -8, bottom: 6, height: Math.round(size * 0.3), width: `${sweep}%`, background: dark ? accent : 'rgba(255,255,255,.92)', zIndex: -1, borderRadius: 8 }} /> : null}
            {w}
          </span>
        );
      })}
    </div>
  );
};

/** 사진 켄번스 + 펀치 — 컷 프레임 목록을 주면 그 시점마다 튄다 */
export const Photo: React.FC<{ src: string; cuts?: number[]; from?: number; to?: number; pan?: number; dim?: number }> = ({ src, cuts = [], from = 1.04, to = 1.14, pan = 0, dim = 0.28 }) => {
  const frame = useCurrentFrame(); const { durationInFrames } = useVideoConfig();
  const z = interpolate(frame, [0, durationInFrames], [from, to]) * punchScale(frame, cuts);
  return (
    <AbsoluteFill>
      <img src={src} style={{ width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${z}) translateX(${pan}%)`, transformOrigin: 'center' }} />
      <AbsoluteFill style={{ background: `linear-gradient(180deg, rgba(0,0,0,${dim * 0.5}) 0%, rgba(0,0,0,0) 35%, rgba(0,0,0,${dim + 0.35}) 100%)` }} />
    </AbsoluteFill>
  );
};

/** 숫자 카운트업 — at 부터 dur 프레임 동안 0→value (소수 자리 유지) */
export function countUp(frame: number, at: number, dur: number, value: number): string {
  const p = Math.min(1, Math.max(0, (frame - at) / dur)); const e = 1 - Math.pow(1 - p, 3);
  const dec = (String(value).split('.')[1] || '').length; return (value * e).toFixed(dec);
}
export const ease = Easing;
