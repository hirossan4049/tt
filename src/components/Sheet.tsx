'use client';
import { useRef, useState } from 'react';
import { BY, DY, ST, fm, type Status } from '@/lib/data';
import { conflicts } from '@/lib/plan';
import { fileToDataUrl } from '@/lib/photos';
import { flash, usePhotos, usePlanner } from '@/lib/store';
import { FG, Marker, RED, bgUrl, usePhotoOf } from './ui';

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
      <div onClick={close} className="absolute inset-0 animate-fade-in bg-[rgba(5,5,4,.78)]" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={p.name}
        className="relative max-h-[94vh] w-full max-w-[480px] animate-sheet-in overflow-hidden bg-ink pb-[calc(16px+env(safe-area-inset-bottom))]"
        style={{ transform: `translateY(${drag}px)`, transition: dragging ? 'none' : 'transform .25s cubic-bezier(.2,.8,.2,1)' }}
      >
        <div
          onPointerDown={(e) => {
            if ((e.target as HTMLElement).closest('button, label')) return;
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
          className="relative touch-none"
          style={{ height: ph ? 'min(66vh,520px)' : 'min(44vh,340px)' }}
        >
          {ph ? (
            <div className="absolute inset-0 bg-cover bg-[center_25%]" style={{ backgroundImage: bgUrl(ph, true) }} />
          ) : (
            <div aria-hidden className="absolute -inset-x-10 -inset-y-2.5 flex flex-col font-disp text-[112px] leading-[.84] font-black whitespace-nowrap text-transparent uppercase [-webkit-text-stroke:1px_rgba(240,239,234,.22)]">
              {[0, 1, 2, 3].map((i) => <span key={i} style={{ transform: `translateX(${-i * 70}px)` }}>{up}  {up}</span>)}
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 h-[70%] bg-gradient-to-t from-ink via-ink/75 to-transparent" />
          <div className="absolute top-3 left-1/2 -ml-5 h-1 w-10 rounded-full bg-bone/55" />
          <button onClick={close} aria-label="閉じる" className="absolute top-3 right-3 flex size-9 items-center justify-center rounded-full border-0 bg-ink/40 font-mono text-xl leading-none text-bone backdrop-blur-sm">×</button>
          <div className="absolute inset-x-4 bottom-4 flex flex-col gap-1">
            <div className="font-disp text-[52px] leading-[.86] font-black text-balance uppercase [text-shadow:0_2px_16px_rgba(0,0,0,.6)]">{p.name}</div>
            <div className="flex flex-wrap gap-x-4 gap-y-0.5 font-mono text-[12px] font-medium [text-shadow:0_1px_8px_rgba(0,0,0,.6)]">
              <span>{DY[p.day].dow} {DY[p.day].d}</span>
              <span>{fm(p.start)}–{fm(p.end)}</span>
              <span className="text-bone/70">{ST[p.stage].name}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-0">
          <div role="radiogroup" aria-label="ステータス" className="flex items-center justify-center gap-5 border-b border-bone/8 px-4 py-3.5">
            {(['must', 'maybe', 'none'] as Status[]).map((k) => {
              const on = cur === k;
              return (
                <button
                  key={k}
                  onClick={() => setStatus(p.id, k)}
                  role="radio"
                  aria-checked={on}
                  aria-label={k === 'none' ? 'なし' : k}
                  className="flex size-14 flex-none items-center justify-center rounded-full border-0 transition-transform active:scale-90"
                  style={{ background: on ? 'rgba(240,239,234,.12)' : 'transparent' }}
                >
                  {k === 'none' ? <span className="font-mono text-[18px] leading-none text-bone/70">×</span> : <Marker status={k} size={k === 'must' ? 16 : 14} />}
                </button>
              );
            })}
          </div>

          {conf.length > 0 && (
            <div className="border-b border-bone/8 px-4 py-3">
              <div className="mb-2 font-mono text-[10px] font-medium tracking-[.06em] text-sub">OVERLAP</div>
              <div className="flex flex-col gap-2">
                {conf.map((c) => (
                  <button key={c.q.id} onClick={() => set({ sheet: c.q.id })} className="flex items-baseline justify-between gap-3 border-0 bg-transparent p-0 text-left">
                    <span className="min-w-0 truncate font-disp text-[16px] leading-none font-extrabold uppercase" style={{ color: c.strong ? RED : FG }}>{c.q.name}</span>
                    <span className="flex flex-none items-center gap-1.5 font-mono text-[10px] font-medium whitespace-nowrap text-sub">
                      <Marker status={sel[c.q.id] || 'none'} size={6} />
                      {fm(c.q.start)}–{fm(c.q.end)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between gap-2.5 px-4 py-3 font-mono text-[10px] leading-[1.4] text-bone/45">
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
