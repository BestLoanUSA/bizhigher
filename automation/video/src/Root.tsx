import React from 'react';
import { Composition } from 'remotion';
import { Promo, FPS, durationFor, SAMPLE } from './Promo';
import { List, Tour, BeforeAfter, Menu, listDuration, tourDuration, baDuration, menuDuration } from './Formats';

/** 컴포지션 — props 는 creative.js promo 가 스펙에서 만든다(샘플은 SAMPLE). 길이는 장면 수에 따라 calculateMetadata 로 계산 */
const base = { name: SAMPLE.name, name_ko: SAMPLE.name_ko, accent: SAMPLE.accent, phone: SAMPLE.phone, address: SAMPLE.address, hours: SAMPLE.hours, cta: SAMPLE.cta, hook: { line: '안경 고를 때 이거 모르면 손해', em: '손해' } };
const S_LIST = { ...base, reasons: SAMPLE.services.map((s) => ({ title: s.name, sub: s.sub })) };
const S_TOUR = { ...base, photos: [], captions: ['안경테', '선글라스', '콘택트렌즈'] };
const S_BA = { ...base, pairs: [{ label: '리뷰 수', before: 14, after: 22 }, { label: '구글 평점', before: 4.5, after: 4.7 }] };
const S_MENU = { ...base, items: SAMPLE.services.map((s) => ({ name: s.name, sub: s.sub })) };
export const Root: React.FC = () => (
  <>
    <Composition id="Promo" component={Promo as any} width={1080} height={1920} fps={FPS} durationInFrames={durationFor(SAMPLE)} defaultProps={SAMPLE as any} calculateMetadata={async ({ props }) => ({ durationInFrames: durationFor(props as any) })} />
    <Composition id="List" component={List as any} width={1080} height={1920} fps={FPS} durationInFrames={listDuration(S_LIST as any)} defaultProps={S_LIST as any} calculateMetadata={async ({ props }) => ({ durationInFrames: listDuration(props as any) })} />
    <Composition id="Tour" component={Tour as any} width={1080} height={1920} fps={FPS} durationInFrames={tourDuration(S_TOUR as any)} defaultProps={S_TOUR as any} calculateMetadata={async ({ props }) => ({ durationInFrames: tourDuration(props as any) })} />
    <Composition id="BeforeAfter" component={BeforeAfter as any} width={1080} height={1920} fps={FPS} durationInFrames={baDuration(S_BA as any)} defaultProps={S_BA as any} calculateMetadata={async ({ props }) => ({ durationInFrames: baDuration(props as any) })} />
    <Composition id="Menu" component={Menu as any} width={1080} height={1920} fps={FPS} durationInFrames={menuDuration(S_MENU as any)} defaultProps={S_MENU as any} calculateMetadata={async ({ props }) => ({ durationInFrames: menuDuration(props as any) })} />
  </>
);
