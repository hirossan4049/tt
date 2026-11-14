'use client';
import { memo, useEffect, useRef } from 'react';
import { BY, GRID_H, NEXT, PERFS, PX, S0, ST, STAGES, fm, type Perf, type Status } from '@/lib/data';
import { conflicts, type Sel } from '@/lib/plan';
import { usePlanner, type Photo } from '@/lib/store';
import { FG, Marker, MUST_TINT, RED, bgUrl, usePhotoOf } from './ui';

const HOUR_LINES = `repeating-linear-gradient(to bottom, rgba(240,239,234,.06) 0 1px, transparent 1px ${30 * PX}px, rgba(240,239,234,.02) ${30 * PX}px ${30 * PX + 1}px, transparent ${30 * PX + 1}px ${60 * PX}px)`;
const HOURS = Array.from({ length: 13 }, (_, i) => 13 + i);
const COLS_STYLE: React.CSSProperties = { gridTemplateColumns: `38px repeat(${STAGES.length}, minmax(112px, 1fr))` };

export function Grid() {
  const day = usePlanner((s) => s.day);
  const sel = usePlanner((s) => s.sel);
  const pulse = usePlanner((s) => s.pulse);
  const query = usePlanner((s) => s.query);
  const focus = usePlanner((s) => s.focus);
  const jump = usePlanner((s) => s.jump);
  const sheet = usePlanner((s) => s.sheet);
  const set = usePlanner((s) => s.set);
  const phOf = usePhotoOf();
  const gridRef = useRef<HTMLDivElement>(null);

  // Tap feedback + dock auto-hide.
  useEffect(() => { if (!pulse) return; const t = setTimeout(() => set({ pulse: null }), 170); return () => clearTimeout(t); }, [pulse, set]);
  useEffect(() => { if (!focus) return; const t = setTimeout(() => set({ focus: null }), 6000); return () => clearTimeout(t); }, [focus, sel, set]);

  // Scroll to a set chosen from search.
  useEffect(() => {
    if (!jump) return;
    const p = BY[jump];
    const t = setTimeout(() => {
      const g = gridRef.current;
      if (g && p) {
        const ci = STAGES.findIndex((s) => s.id === p.stage);
        const colW = (g.scrollWidth - 38) / STAGES.length;
        g.scrollTo({ top: Math.max(0, (p.start - S0) * PX - 30), left: Math.max(0, 38 + ci * colW - 60), behavior: 'smooth' });
      }
      set({ jump: null });
    }, 60);
    return () => clearTimeout(t);
  }, [jump, set]);

  const q = query.trim().toLowerCase();

  return (
    <div className="relative flex min-w-0 flex-1 flex-col">
      <div ref={gridRef} className="relative min-h-0 flex-1 overflow-auto overscroll-contain">
        <div className="relative min-w-[600px]">
          <div className="sticky top-0 z-[3] grid border-b border-bone/[0.07] bg-ink" style={COLS_STYLE}>
            <div className="sticky left-0 z-[4] bg-ink" />
            {STAGES.map((s) => (
              <div key={s.id} className="px-1.5 pt-[9px] pb-[7px] font-mono text-[10px] leading-none font-semibold tracking-[.1em] whitespace-nowrap text-sub">{s.name}</div>
            ))}
          </div>
          <div className="grid pt-2.5 pb-[120px]" style={COLS_STYLE}>
            <div className="sticky left-0 z-[2] bg-ink" style={{ height: GRID_H }}>
              {HOURS.map((h) => (
                <div key={h} className="absolute left-0 w-8 -translate-y-1.5 text-right font-mono text-[10px] font-medium text-sub" style={{ top: (h * 60 - S0) * PX }}>
                  {String(h % 24).padStart(2, '0')}
                </div>
              ))}
            </div>
            {STAGES.map((s) => (
              <div key={s.id} className="relative border-l border-bone/[0.04]" style={{ height: GRID_H, backgroundImage: HOUR_LINES }}>
                {PERFS.filter((p) => p.day === day && p.stage === s.id).map((p) => (
                  <Block key={p.id} p={p} v={sel[p.id] || 'none'} sel={sel} ph={phOf(p.name)} dim={!!q && !p.name.toLowerCase().includes(q)} pressed={pulse === p.id} />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
      {focus && BY[focus] && !sheet && <Dock id={focus} />}
    </div>
  );
}

const Block = memo(function Block({ p, v, sel, ph, dim, pressed }: { p: Perf; v: Status; sel: Sel; ph: Photo | null; dim: boolean; pressed: boolean }) {
  const setStatus = usePlanner((s) => s.setStatus);
  const set = usePlanner((s) => s.set);
  const pd = useRef<{ x: number; y: number; lp: boolean; mv: boolean } | null>(null);
  const lpT = useRef<ReturnType<typeof setTimeout>>(undefined);

  const h = (p.end - p.start) * PX - 3;
  const hasPh = !!ph && h >= 72;
  const short = h < 50;
  const isMust = v === 'must';
  const isMaybe = v === 'maybe';
  const phFilter = isMust ? 'none' : isMaybe ? 'grayscale(.25) brightness(.85)' : 'grayscale(1) brightness(.55) contrast(1.08)';
  const border = isMust ? '1.5px solid rgba(240,239,234,.9)' : isMaybe ? '1.5px dashed rgba(240,239,234,.45)' : '1px solid rgba(240,239,234,.08)';
  const cf = conflicts(p.id, sel);
  let bar: { top: number; h: number; bg: string } | null = null;
  if (cf.length) {
    const a = Math.min(...cf.map((c) => c.a)), b = Math.max(...cf.map((c) => c.b)), strong = cf.some((c) => c.strong);
    bar = { top: (a - p.start) * PX, h: (b - a) * PX, bg: strong ? RED : `repeating-linear-gradient(to bottom, ${RED} 0 4px, transparent 4px 8px)` };
  }
  const cycle = () => { navigator.vibrate?.(6); setStatus(p.id, NEXT[v]); };

  return (
    <button
      aria-label={`${p.name} ${fm(p.start)}–${fm(p.end)} ${ST[p.stage].name}、${v === 'must' ? 'Must' : v === 'maybe' ? 'Maybe' : '未選択'}`}
      onPointerDown={(e) => {
        pd.current = { x: e.clientX, y: e.clientY, lp: false, mv: false };
        clearTimeout(lpT.current);
        lpT.current = setTimeout(() => {
          if (!pd.current) return;
          pd.current.lp = true;
          navigator.vibrate?.(12);
          set({ sheet: p.id, focus: null });
        }, 450);
      }}
      onPointerMove={(e) => {
        if (pd.current && Math.hypot(e.clientX - pd.current.x, e.clientY - pd.current.y) > 8) { pd.current.mv = true; clearTimeout(lpT.current); }
      }}
      onPointerUp={() => { clearTimeout(lpT.current); if (pd.current && !pd.current.lp && !pd.current.mv) cycle(); pd.current = null; }}
      onPointerCancel={() => { clearTimeout(lpT.current); pd.current = null; }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') { e.preventDefault(); set({ sheet: p.id }); }
        else if (e.key === ' ') { e.preventDefault(); cycle(); }
      }}
      onContextMenu={(e) => e.preventDefault()}
      className="absolute inset-x-0.5 m-0 box-border touch-manipulation overflow-hidden p-0 text-left select-none [-webkit-touch-callout:none] [transition:opacity_.2s,transform_.16s_cubic-bezier(.2,.8,.2,1)]"
      style={{ top: (p.start - S0) * PX, height: h, border, opacity: dim ? 0.14 : 1, transform: pressed ? 'scale(.96)' : 'scale(1)' }}
    >
      {hasPh ? (
        <>
          <span className="absolute inset-0 bg-cover bg-[center_22%]" style={{ backgroundImage: bgUrl(ph), filter: phFilter }} />
          <span className="absolute inset-x-0 bottom-0 z-[1]" style={{ height: short ? '100%' : '78%', background: 'linear-gradient(to top, rgba(0,0,0,.84) 0%, rgba(0,0,0,.5) 35%, rgba(0,0,0,.15) 65%, transparent 100%)' }} />
        </>
      ) : (
        <span className="absolute inset-0 z-[1]" style={{ background: isMust ? MUST_TINT : isMaybe ? 'repeating-linear-gradient(135deg, rgba(240,239,234,.13) 0 1px, transparent 1px 6px), #121211' : '#171716' }} />
      )}

      <span className="absolute top-1.5 right-1.5 z-[3]"><Marker status={v} size={7} /></span>

      <span className="absolute inset-x-0 bottom-0 z-[2] flex flex-col gap-[2px] px-1.5 pt-3 pb-1.5" style={{ color: FG }}>
        <span className="font-disp text-[15px] leading-[.92] font-extrabold tracking-[.01em] uppercase [text-shadow:0_1px_3px_rgba(0,0,0,.85)]">{p.name}</span>
        {!short && (
          <span className="font-mono text-[10px] leading-none font-medium [text-shadow:0_1px_2px_rgba(0,0,0,.8)]" style={{ opacity: hasPh ? 0.9 : 0.65 }}>{fm(p.start)}</span>
        )}
      </span>
      {bar && <span className="absolute right-0 z-[3] w-1" style={{ top: bar.top, height: bar.h, background: bar.bg }} />}
    </button>
  );
});

function Dock({ id }: { id: string }) {
  const p = BY[id];
  const cur = usePlanner((s) => s.sel[id] || 'none');
  const setStatus = usePlanner((s) => s.setStatus);
  const set = usePlanner((s) => s.set);
  const phOf = usePhotoOf();
  const ph = phOf(p.name);
  return (
    <div className="absolute inset-x-3 bottom-3 z-[6] mx-auto flex h-[62px] max-w-[520px] animate-dock-in items-stretch overflow-hidden rounded-full bg-ink/88 text-bone shadow-[0_14px_50px_rgba(0,0,0,.65)] backdrop-blur-md">
      {ph && <span className="w-[62px] flex-none bg-cover bg-[center_22%]" style={{ backgroundImage: bgUrl(ph) }} />}
      <button onClick={() => set({ sheet: p.id, focus: null })} aria-label="詳細を開く" className="flex min-w-0 flex-1 flex-col justify-center gap-0.5 border-0 bg-transparent p-0 px-3 text-left">
        <span className="truncate font-disp text-[18px] leading-[.95] font-extrabold uppercase">{p.name}</span>
        <span className="font-mono text-[10px] leading-none font-medium whitespace-nowrap text-sub">{fm(p.start)}–{fm(p.end)} · {ST[p.stage].name}</span>
      </button>
      <div role="radiogroup" aria-label="ステータス" className="flex flex-none items-center gap-1 pr-2">
        {(['must', 'maybe', 'none'] as Status[]).map((k) => {
          const on = cur === k;
          return (
            <button
              key={k}
              onClick={() => setStatus(p.id, k)}
              role="radio"
              aria-checked={on}
              aria-label={k === 'none' ? '未選択' : k}
              className="flex size-9 flex-none items-center justify-center rounded-full border-0 transition-colors"
              style={{ background: on ? 'rgba(240,239,234,.14)' : 'transparent' }}
            >
              {k === 'none' ? <span className="font-mono text-[15px] leading-none text-bone/70">×</span> : <Marker status={k} size={k === 'must' ? 11 : 10} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
