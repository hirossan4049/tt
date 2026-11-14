'use client';
import { useMemo } from 'react';
import { DY, K, ST, dur, fm } from '@/lib/data';
import { buildPlan } from '@/lib/plan';
import { usePlanner } from '@/lib/store';
import { FG, Marker, MUST_TINT, RED, bgUrl, usePhotoOf } from './ui';

export function MyPlan() {
  const sel = usePlanner((s) => s.sel);
  const set = usePlanner((s) => s.set);
  const phOf = usePhotoOf();
  const plan = useMemo(() => buildPlan(sel), [sel]);

  return (
    <div className="min-h-0 flex-1 overflow-auto px-3 pb-10">
      {!plan.length && (
        <button onClick={() => set({ view: 'tt' })} className="my-14 flex flex-col items-start gap-3.5 border-0 bg-transparent p-0 text-left">
          <span className="font-disp text-[64px] leading-[.85] font-black text-bone/22">NO SETS<br />YET</span>
          <span className="border-b border-bone pb-[3px] text-[13px] font-semibold">タイムテーブルへ →</span>
        </button>
      )}
      {plan.map((g) => (
        <section key={g.day} className="pt-5">
          <div className="mb-2.5 flex items-baseline justify-between border-b border-bone/10 pb-2">
            <div className="font-disp text-[36px] leading-[.9] font-black tracking-[.01em]">{DY[g.day].full}</div>
            <div className="flex gap-3 font-mono text-[11px] font-medium whitespace-nowrap">
              <span>● {g.must}</span>
              <span>○ {g.maybe}</span>
              {g.clash > 0 && <span className="text-sig">× {g.clash}</span>}
            </div>
          </div>
          {g.segs.map((s, si) =>
            s.kind === 'gap' ? (
              <div key={si} className="grid h-[26px] grid-cols-[48px_minmax(0,1fr)] items-center">
                <div />
                <div className="flex items-center gap-2 font-mono text-[10px] font-medium whitespace-nowrap text-bone/42">
                  <span className="h-px flex-1 bg-bone/10" />
                  {dur(s.gap)}
                </div>
              </div>
            ) : (
              <div key={si} className="grid grid-cols-[48px_minmax(0,1fr)]">
                <div className="relative" style={{ height: s.h }}>
                  <div className="pt-[3px] font-mono text-[11px] leading-none font-semibold">{fm(s.start)}</div>
                  {(() => {
                    let last = -99;
                    return s.bands.map((b, bi) => {
                      let lt = (b.s - s.start) * K + (b.s === s.start ? 18 : 0);
                      lt = Math.max(lt, last + 14);
                      last = lt;
                      return (
                        <div key={bi}>
                          <div className="absolute right-[7px] w-[3px]" style={{ top: (b.s - s.start) * K, height: (b.e - b.s) * K, background: b.strong ? RED : `repeating-linear-gradient(to bottom, ${RED} 0 3px, transparent 3px 6px)` }} />
                          <div className="absolute left-0 font-mono text-[10px] leading-[1.2] font-semibold whitespace-nowrap text-sig" style={{ top: lt }}>×{dur(b.e - b.s)}</div>
                        </div>
                      );
                    });
                  })()}
                </div>
                <div className="relative" style={{ height: s.h }}>
                  {s.items.map(({ p, lane }) => {
                    const v = sel[p.id];
                    const n = s.lanes;
                    const must = v === 'must';
                    const maybe = v === 'maybe';
                    const ph = phOf(p.name);
                    const h = Math.max(52, (p.end - p.start) * K - 3);
                    const hasPh = !!ph && h >= 72 && n <= 2;
                    return (
                      <button
                        key={p.id}
                        onClick={() => set({ sheet: p.id })}
                        aria-label={`${p.name} ${fm(p.start)} ${v}`}
                        className="absolute box-border overflow-hidden p-0 text-left transition-transform active:scale-[.98]"
                        style={{
                          top: (p.start - s.start) * K,
                          height: h,
                          left: `${(lane / n) * 100}%`,
                          width: `calc(${100 / n}% - 3px)`,
                          border: must ? '1.5px solid rgba(240,239,234,.9)' : maybe ? '1.5px dashed rgba(240,239,234,.45)' : '1px solid rgba(240,239,234,.08)',
                        }}
                      >
                        {hasPh && (
                          <>
                            <span className="absolute inset-0 bg-cover bg-[center_22%]" style={{ backgroundImage: bgUrl(ph), filter: must ? 'none' : maybe ? 'grayscale(.25) brightness(.85)' : 'grayscale(1) brightness(.55) contrast(1.08)' }} />
                            <span className="absolute inset-x-0 bottom-0 z-[1] h-[78%] bg-gradient-to-t from-black/84 via-black/45 to-transparent" />
                          </>
                        )}
                        {!hasPh && <span className="absolute inset-0 z-[1]" style={{ background: must ? MUST_TINT : maybe ? 'repeating-linear-gradient(135deg, rgba(240,239,234,.13) 0 1px, transparent 1px 6px), #121211' : '#171716' }} />}
                        <span className="absolute top-1.5 right-1.5 z-[3]"><Marker status={v || 'none'} size={6} /></span>
                        <span className="absolute inset-x-0 bottom-0 z-[2] flex flex-col gap-[2px] px-2 pb-1.5 pt-3" style={{ color: FG }}>
                          <span className="font-disp leading-[.94] font-extrabold tracking-[.01em] uppercase [text-shadow:0_1px_3px_rgba(0,0,0,.85)]" style={{ fontSize: n === 1 ? 22 : n === 2 ? 16 : 14 }}>{p.name}</span>
                          <span className="font-mono text-[10px] leading-[1.3] font-medium [text-shadow:0_1px_2px_rgba(0,0,0,.8)]">
                            {fm(p.start)}–{fm(p.end)}
                          </span>
                          {n === 1 && <span className="font-mono text-[10px] leading-none font-medium tracking-[.08em] text-bone/70 [text-shadow:0_1px_2px_rgba(0,0,0,.8)]">{ST[p.stage].name}</span>}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ),
          )}
        </section>
      ))}
    </div>
  );
}
