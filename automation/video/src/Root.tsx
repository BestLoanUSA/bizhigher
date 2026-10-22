import React from 'react';
import { Composition } from 'remotion';
import { Promo, FPS, durationFor, SAMPLE } from './Promo';

/** 컴포지션 "Promo" — props 는 creative.js promo 가 스펙에서 만든다(샘플은 SAMPLE). 길이는 장면 수에 따라 calculateMetadata 로 계산 */
export const Root: React.FC = () => (
  <Composition
    id="Promo"
    component={Promo as any}
    width={1080}
    height={1920}
    fps={FPS}
    durationInFrames={durationFor(SAMPLE)}
    defaultProps={SAMPLE as any}
    calculateMetadata={async ({ props }) => ({ durationInFrames: durationFor(props as any) })}
  />
);
