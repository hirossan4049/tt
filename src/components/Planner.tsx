'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { BY, DAYS, DY, GLY, PERFS, fm } from '@/lib/data';
import { decodeShare } from '@/lib/plan';
import { flash, usePhotos, usePlanner, type View } from '@/lib/store';
import { FG, SUB, bgUrl, cx, usePhotoOf } from './ui';
import { Grid } from './Grid';
import { MyPlan } from './MyPlan';
import { ExportStudio } from './ExportStudio';
import { Sheet } from './Sheet';

export function Planner() {
  const [ready, setReady] = useState(false);
  const [wide, setWide] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Hydrate persisted state on the client, then apply a shared plan from the URL hash.
  useEffect(() => {
    Promise.all([usePlanner.persist.rehydrate(), usePhotos.persist.rehydrate()]).then(() => {
      const shared = decodeShare(location.hash || '');
      if (shared) {
        usePlanner.setState({ sel: shared });
        history.replaceState(null, '', location.pathname + location.search);
        flash('共有プランを読み込みました');
      }
      setReady(true);
    });
  }, []);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const ro = new ResizeObserver((e) => setWide(e[0].contentRect.width >= 900));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ready]);

  const view = usePlanner((s) => s.view);
  const side = usePlanner((s) => s.side);
  const search = usePlanner((s) => s.search);
  const sheet = usePlanner((s) => s.sheet);
  const toast = usePlanner((s) => s.toast);
  const total = usePlanner((s) => Object.keys(s.sel).filter((id) => BY[id]).length);
  const set = usePlanner((s) => s.set);

  if (!ready) return <div className="h-dvh bg-ink" />;

  const showGrid = wide || view === 'tt';
  const pane: 'my' | 'ex' = wide ? (view === 'ex' ? 'ex' : view === 'my' ? 'my' : side) : view === 'ex' ? 'ex' : 'my';
  const showSide = wide || view !== 'tt';

  return (
    <div ref={rootRef} className="relative flex h-dvh flex-col overflow-hidden bg-ink font-body text-bone">
      {showGrid && <TopBar wide={wide} />}
      {search && <Search wide={wide} />}

      <div className="relative flex min-h-0 flex-1">
        {showGrid && <Grid />}
        {showSide && (
          <aside className={cx('flex min-h-0 flex-col', wide ? 'w-[400px] flex-none border-l border-bone/10' : 'flex-1')}>
            {wide && (
              <div className="grid h-11 flex-none grid-cols-2 border-b border-bone/10">
                {(['my', 'ex'] as const).map((k) => {
                  const on = pane === k;
                  return (
                    <button key={k} onClick={() => set({ side: k, view: k })} className="relative border-0 bg-transparent text-[12px] font-semibold" style={{ color: on ? FG : SUB }}>
                      {k === 'my' ? 'マイプラン' : '書き出し'}
                      <span className="absolute inset-x-0 -bottom-px h-0.5" style={{ background: on ? FG : 'transparent' }} />
                    </button>
                  );
                })}
              </div>
            )}
            {pane === 'my' ? <MyPlan /> : <ExportStudio wide={wide} />}
          </aside>
        )}
      </div>

      {!wide && (
        <nav aria-label="メイン" className="grid flex-none grid-cols-3 border-t border-bone/10 bg-ink pb-[env(safe-area-inset-bottom)]">
          {(
            [
              ['tt', 'タイムテーブル'],
              ['my', 'マイプラン'],
              ['ex', '書き出し'],
            ] as [View, string][]
          ).map(([k, l]) => {
            const on = view === k;
            return (
              <button key={k} onClick={() => set({ view: k, search: false, focus: null })} aria-current={on ? 'page' : undefined} className="relative flex h-[50px] items-center justify-center gap-1.5 border-0 bg-transparent text-[12px] font-semibold transition-colors" style={{ color: on ? FG : SUB }}>
                {l}
                {k === 'my' && total > 0 && <span className="font-mono text-[11px] font-semibold">{total}</span>}
                <span className="absolute -top-px left-[24%] right-[24%] h-0.5" style={{ background: on ? FG : 'transparent' }} />
              </button>
            );
          })}
        </nav>
      )}

      {sheet && BY[sheet] && <Sheet id={sheet} />}

      {toast && (
        <div role="status" className="absolute left-1/2 z-50 -translate-x-1/2 animate-fade-in whitespace-nowrap bg-bone px-4 py-3 text-[12px] font-semibold text-ink shadow-[0_12px_40px_rgba(0,0,0,.5)]" style={{ bottom: wide ? 24 : 64 }}>
          {toast}
        </div>
      )}
    </div>
  );
}

function TopBar({ wide }: { wide: boolean }) {
  const day = usePlanner((s) => s.day);
  const set = usePlanner((s) => s.set);
  return (
    <header className="flex h-11 flex-none items-stretch border-b border-bone/10">
      {wide && <div className="flex items-center border-r border-bone/10 px-[18px] font-disp text-[18px] leading-none font-black tracking-[.03em]">TOMORROWLAND TH 26</div>}
      <nav aria-label="日付" className="flex min-w-0 flex-1">
        {DAYS.map((d) => {
          const on = d.id === day;
          return (
            <button key={d.id} onClick={() => set({ day: d.id })} aria-pressed={on} className="relative flex items-center gap-1.5 border-0 bg-transparent px-3.5 transition-colors" style={{ color: on ? FG : SUB }}>
              <span className="font-disp text-[18px] leading-none font-extrabold tracking-[.04em]">{d.dow}</span>
              <span className="font-mono text-[11px] leading-none font-medium">{d.d}</span>
              <span className="absolute inset-x-2.5 -bottom-px h-0.5" style={{ background: on ? FG : 'transparent' }} />
            </button>
          );
        })}
      </nav>
      <button onClick={() => set({ search: true, focus: null })} aria-label="アーティスト検索" className="flex w-12 flex-none items-center justify-center border-0 bg-transparent">
        <span className="relative block size-3 -translate-x-0.5 -translate-y-0.5 rounded-full border-2 border-bone">
          <span className="absolute -right-1 -bottom-1.5 h-[7px] w-0.5 -rotate-45 bg-bone" />
        </span>
      </button>
    </header>
  );
}

function Search({ wide }: { wide: boolean }) {
  const query = usePlanner((s) => s.query);
  const sel = usePlanner((s) => s.sel);
  const set = usePlanner((s) => s.set);
  const view = usePlanner((s) => s.view);
  const phOf = usePhotoOf();
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { const t = setTimeout(() => inputRef.current?.focus(), 30); return () => clearTimeout(t); }, []);
  const q = query.trim().toLowerCase();
  const results = useMemo(
    () => (q ? PERFS.filter((p) => p.name.toLowerCase().includes(q)).sort((a, b) => a.day.localeCompare(b.day) || a.start - b.start).slice(0, 8) : []),
    [q],
  );
  const close = () => set({ search: false, query: '' });
  return (
    <div className="absolute inset-x-0 top-0 z-30 max-h-[70vh] animate-fade-in overflow-auto border-b border-bone/12 bg-ink" onKeyDown={(e) => e.key === 'Escape' && close()}>
      <div className="flex h-14 items-center pl-3.5">
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => set({ query: e.target.value })}
          placeholder="ARTIST"
          aria-label="アーティスト名で検索"
          className="h-10 min-w-0 flex-1 border-0 bg-transparent p-0 font-disp text-[28px] leading-none font-extrabold tracking-[.03em] text-bone uppercase outline-none placeholder:text-bone/30"
        />
        <button onClick={close} aria-label="検索を閉じる" className="size-[52px] flex-none border-0 bg-transparent font-mono text-2xl leading-none">×</button>
      </div>
      {results.map((p) => (
        <button
          key={p.id}
          onClick={() => set({ day: p.day, search: false, query: '', focus: p.id, jump: p.id, view: wide ? view : 'tt' })}
          className="grid w-full grid-cols-[48px_40px_minmax(0,1fr)_auto] items-center gap-3 border-0 border-t border-bone/7 bg-transparent px-3.5 py-1.5 text-left hover:bg-ink-3"
        >
          <span className="block size-12 bg-[#1c1c1b] bg-cover bg-[center_22%]" style={{ backgroundImage: bgUrl(phOf(p.name)) }} />
          <span className="font-mono text-[11px] font-semibold text-sub">{DY[p.day].dow}</span>
          <span className="font-disp text-[20px] leading-none font-extrabold uppercase">{p.name}</span>
          <span className="font-mono text-[11px] font-medium whitespace-nowrap text-sub">{GLY[sel[p.id] || 'none']} {fm(p.start)}</span>
        </button>
      ))}
      {q && !results.length && <div className="p-3.5 font-mono text-[12px] text-sub">—</div>}
    </div>
  );
}
