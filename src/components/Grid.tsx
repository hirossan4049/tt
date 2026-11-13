'use client';
import { memo, useEffect, useRef } from 'react';
import { BY, GLY, GRID_H, NEXT, PERFS, PX, S0, ST, STAGES, fm, type Perf, type Status } from '@/lib/data';
import { conflicts, type Sel } from '@/lib/plan';
import { usePlanner, type Photo } from '@/lib/store';
import { FG, HATCH, INK, RED, bgUrl, usePhotoOf } from './ui';

const HOUR_LINES = `repeating-linear-gradient(to bottom, rgba(240,239,234,.08) 0 1px, transparent 1px ${30 * PX}px, rgba(240,239,234,.03) ${30 * PX}px ${30 * PX + 1}px, transparent ${30 * PX + 1}px ${60 * PX}px)`;
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
          <div className="sticky top-0 z-[3] grid border-b border-bone/10 bg-ink" style={COLS_STYLE}>
            <div className="sticky left-0 z-[4] bg-ink" />
            {STAGES.map((s) => (
              <div key={s.id} className="px-1.5 pt-[9px] pb-[7px] font-mono text-[10px] leading-none font-semibold tracking-[.1em] whitespace-nowrap">{s.name}</div>
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
              <div key={s.id} className="relative border-l border-bone/5" style={{ height: GRID_H, backgroundImage: HOUR_LINES }}>
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
  const hasPh = !!ph && h >= 96;
  const look =
    v === 'must'
      ? { bg: FG, fg: INK, border: `2px solid ${FG}`, panel: FG, phFilter: 'none' }
      : v === 'maybe'
        ? { bg: '#121211', fg: FG, border: `1.5px dashed ${FG}`, panel: HATCH, phFilter: 'grayscale(1) brightness(.7)' }
        : { bg: '#171716', fg: FG, border: '1px solid rgba(240,239,234,.06)', panel: '#171716', phFilter: 'grayscale(1) brightness(.5) contrast(1.1)' };
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
      className="absolute inset-x-0.5 m-0 box-border flex touch-manipulation flex-col overflow-hidden p-0 text-left select-none [-webkit-touch-callout:none] [transition:border-color_.18s,opacity_.2s,transform_.16s_cubic-bezier(.2,.8,.2,1)]"
      style={{ top: (p.start - S0) * PX, height: h, border: look.border, background: look.bg, color: look.fg, opacity: dim ? 0.14 : 1, transform: pressed ? 'scale(.94)' : 'scale(1)' }}
    >
      {hasPh && <span className="block min-h-0 flex-1 bg-cover bg-[center_22%] transition-[filter] duration-300" style={{ backgroundImage: bgUrl(ph), filter: look.phFilter }} />}
      <span className="flex flex-col gap-[3px] px-1.5 pt-[5px] pb-1.5 transition-colors" style={{ flex: hasPh ? 'none' : '1', background: look.panel }}>
        <span className="font-disp text-[15px] leading-[.94] font-extrabold tracking-[.01em] uppercase">{p.name}</span>
        <span className="flex items-center justify-between font-mono text-[10px] leading-none font-medium">
          <span className="opacity-70">{fm(p.start)}</span>
          <span className="text-[11px]">{GLY[v]}</span>
        </span>
      </span>
      {bar && <span className="absolute right-0 w-1" style={{ top: bar.top, height: bar.h, background: bar.bg }} />}
    </button>
  );
});

function Dock({ id }: { id: string }) {
  const p = BY[id];
  const cur = usePlanner((s) => s.sel[id] || 'none');
  const setStatus = usePlanner((s) => s.setStatus);
  const set = usePlanner((s) => s.set);
  const phOf = usePhotoOf();
  return (
    <div className="absolute inset-x-2 bottom-2 z-[6] mx-auto flex h-16 max-w-[520px] animate-dock-in items-stretch bg-bone text-ink shadow-[0_14px_40px_rgba(0,0,0,.55)]">
      <button onClick={() => set({ sheet: p.id, focus: null })} aria-label="詳細を開く" className="flex min-w-0 flex-1 items-stretch gap-2.5 border-0 bg-transparent p-0 text-left text-ink">
        <span className="w-16 flex-none bg-[#26262a] bg-cover bg-[center_22%]" style={{ backgroundImage: bgUrl(phOf(p.name)) }} />
        <span className="flex min-w-0 flex-1 flex-col justify-center gap-1">
          <span className="truncate font-disp text-[19px] leading-[.95] font-extrabold uppercase">{p.name}</span>
          <span className="font-mono text-[10px] leading-none font-medium whitespace-nowrap opacity-65">{fm(p.start)}–{fm(p.end)} · {ST[p.stage].name}</span>
        </span>
      </button>
      <div role="radiogroup" aria-label="ステータス" className="flex flex-none">
        {(['must', 'maybe', 'none'] as Status[]).map((k) => {
          const on = cur === k;
          return (
            <button
              key={k}
              onClick={() => setStatus(p.id, k)}
              role="radio"
              aria-checked={on}
              aria-label={k}
              className="flex w-[50px] flex-col items-center justify-center gap-1 border-0 border-l border-ink/12 transition-colors"
              style={{ background: on ? INK : 'transparent', color: on ? FG : INK }}
            >
              <span className="font-mono text-[15px] leading-none font-medium">{k === 'none' ? '×' : GLY[k]}</span>
              <span className="font-mono text-[8.5px] leading-none font-semibold tracking-[.08em]">{k === 'must' ? 'MUST' : k === 'maybe' ? 'MAYBE' : 'なし'}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
