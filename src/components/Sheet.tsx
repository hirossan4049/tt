'use client';
import { useRef, useState } from 'react';
import { BY, DY, GLY, ST, fm, type Status } from '@/lib/data';
import { conflicts } from '@/lib/plan';
import { fileToDataUrl } from '@/lib/photos';
import { flash, usePhotos, usePlanner } from '@/lib/store';
import { FG, HATCH, INK, RED, SUB, bgUrl, usePhotoOf } from './ui';

export function Sheet({ id }: { id: string }) {
  const p = BY[id];
  const sel = usePlanner((s) => s.sel);
  const set = usePlanner((s) => s.set);
  const setStatus = usePlanner((s) => s.setStatus);
  const setUser = usePhotos((s) => s.setUser);
  const phOf = usePhotoOf();
  const [drag, setDrag] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dg = useRef<number | null>(null);

  const cur: Status = sel[p.id] || 'none';
  const ph = phOf(p.name);
  const up = p.name.toUpperCase();
  const close = () => set({ sheet: null });
  const conf = conflicts(p.id, sel);

  return (
    <div className="absolute inset-0 z-40 flex flex-col items-center justify-end" onKeyDown={(e) => e.key === 'Escape' && close()}>
      <div onClick={close} className="absolute inset-0 animate-fade-in bg-[rgba(5,5,4,.72)]" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={p.name}
        className="relative max-h-[94vh] w-full max-w-[480px] animate-sheet-in overflow-auto bg-ink pb-[calc(16px+env(safe-area-inset-bottom))]"
        style={{ transform: `translateY(${drag}px)`, transition: dragging ? 'none' : 'transform .25s cubic-bezier(.2,.8,.2,1)' }}
      >
        <div
          onPointerDown={(e) => {
            if ((e.target as HTMLElement).closest('button')) return;
            dg.current = e.clientY;
            e.currentTarget.setPointerCapture?.(e.pointerId);
            setDragging(true);
          }}
          onPointerMove={(e) => { if (dg.current != null) setDrag(Math.max(0, e.clientY - dg.current)); }}
          onPointerUp={() => {
            if (dg.current == null) return;
            dg.current = null;
            setDragging(false);
            if (drag > 90) close(); else setDrag(0);
          }}
          onPointerCancel={() => { dg.current = null; setDragging(false); setDrag(0); }}
          className="relative touch-none overflow-hidden bg-ink-3"
          style={{ height: ph ? 'min(58vh,460px)' : 'min(40vh,300px)' }}
        >
          {ph ? (
            <div className="absolute inset-0 bg-cover bg-[center_20%]" style={{ backgroundImage: bgUrl(ph, true) }} />
          ) : (
            <div aria-hidden className="absolute -inset-x-10 -inset-y-2.5 flex flex-col font-disp text-[112px] leading-[.84] font-black whitespace-nowrap text-transparent uppercase [-webkit-text-stroke:1px_rgba(240,239,234,.22)]">
              {[0, 1, 2, 3].map((i) => <span key={i} style={{ transform: `translateX(${-i * 70}px)` }}>{up}  {up}</span>)}
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 h-[55%] bg-gradient-to-b from-ink/0 to-ink/96" />
          <div className="absolute top-2 left-1/2 -ml-5 h-1 w-10 bg-bone/60" />
          <button onClick={close} aria-label="閉じる" className="absolute top-2.5 right-2 size-10 border-0 bg-ink/50 font-mono text-xl leading-none text-bone">×</button>
          <div className="absolute inset-x-3.5 bottom-2.5 flex flex-col gap-2">
            <div className="font-disp text-[64px] leading-[.86] font-black text-balance uppercase">{p.name}</div>
            <div className="flex flex-wrap gap-x-3.5 gap-y-0.5 font-mono text-[12px] font-medium">
              <span>{DY[p.day].dow} {DY[p.day].d}</span>
              <span>{fm(p.start)}–{fm(p.end)}</span>
              <span className="opacity-60">{ST[p.stage].name}</span>
            </div>
          </div>
        </div>

        <div role="radiogroup" aria-label="ステータス" className="grid grid-cols-[1fr_1fr_64px] gap-px border-y border-bone/14 bg-bone/14">
          {(['must', 'maybe', 'none'] as Status[]).map((k) => {
            const on = cur === k;
            const bg = on ? (k === 'must' ? FG : k === 'maybe' ? HATCH : '#1d1d1c') : INK;
            return (
              <button
                key={k}
                onClick={() => setStatus(p.id, k)}
                role="radio"
                aria-checked={on}
                aria-label={k === 'none' ? 'なし' : k}
                className="flex h-16 items-center justify-center gap-[9px] border-0 transition-colors active:scale-[.98]"
                style={{ background: bg, color: on && k === 'must' ? INK : FG }}
              >
                <span className="font-mono text-base leading-none font-medium">{k === 'none' ? '×' : GLY[k]}</span>
                {k !== 'none' && <span className="font-disp text-[22px] leading-none font-extrabold tracking-[.05em]">{k.toUpperCase()}</span>}
              </button>
            );
          })}
        </div>

        <div className="flex flex-col gap-2.5 px-3.5 pt-3">
          {conf.map((c) => (
            <button key={c.q.id} onClick={() => set({ sheet: c.q.id })} className="grid grid-cols-[14px_minmax(0,1fr)_auto] items-baseline gap-2 border-0 bg-transparent p-0 text-left font-mono text-[12px] font-medium" style={{ color: c.strong ? RED : SUB }}>
              <span>×</span>
              <span className="font-disp text-[17px] leading-[1.1] font-extrabold uppercase">{c.q.name}</span>
              <span className="whitespace-nowrap">{GLY[sel[c.q.id] || 'none']} {fm(c.q.start)}–{fm(c.q.end)}</span>
            </button>
          ))}
          <div className="flex items-center justify-between gap-2.5 font-mono text-[10px] leading-[1.4] text-bone/45">
            <span className="min-w-0 truncate">{ph ? (ph.own ? 'Photo: 自分の画像' : 'Photo: Tomorrowland') : 'Photo: —'}</span>
            <label className="relative flex-none cursor-pointer border-b border-bone/40 py-1 font-body text-[11px] font-medium text-bone">
              写真を変更
              <input
                type="file"
                accept="image/*"
                className="absolute size-px opacity-0"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  try { setUser(p.name, await fileToDataUrl(f)); } catch { flash('画像を読み込めませんでした'); }
                }}
              />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
