'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { DAYS, DEVICES, DY, SITE } from '@/lib/data';
import { encodeShare } from '@/lib/plan';
import { deliver, drawVideoFrame, exportItems, getImg, onImageLoad, renderPngs, renderVideo, videoTimeline } from '@/lib/export';
import { FONT_LOADS, THEMES, buildPages, dims, drawPage } from '@/lib/render';
import { flash, usePlanner, type ExportOpts } from '@/lib/store';
import { FG, INK, usePhotoOf } from './ui';

type Opt = [string | boolean, string, string?];

export function ExportStudio({ wide }: { wide: boolean }) {
  const ex = usePlanner((s) => s.ex);
  const sel = usePlanner((s) => s.sel);
  const page = usePlanner((s) => s.page);
  const set = usePlanner((s) => s.set);
  const setEx = usePlanner((s) => s.setEx);
  const phOf = usePhotoOf();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tick, setTick] = useState(0);
  const [busy, setBusy] = useState<null | number>(null);
  const abortRef = useRef<AbortController | null>(null);

  const video = ex.media === 'video';
  const eff: ExportOpts = useMemo(() => (video ? { ...ex, format: 'story' } : ex), [ex, video]);
  const items = useMemo(() => exportItems(eff, sel, phOf), [eff, sel, phOf]);
  const pages = useMemo(() => buildPages(eff, items), [eff, items]);
  const tl = useMemo(() => videoTimeline(eff, items), [eff, items]);
  const pn = pages.length;
  const pi = Math.min(page, pn - 1);
  const D = dims(eff);

  // Fonts + photos arriving trigger a redraw.
  useEffect(() => {
    Promise.all(FONT_LOADS.map((f) => document.fonts.load(f))).then(() => setTick((t) => t + 1));
    const off = onImageLoad(() => setTick((t) => t + 1));
    const onResize = () => setTick((t) => t + 1);
    addEventListener('resize', onResize);
    return () => { off(); removeEventListener('resize', onResize); };
  }, []);

  // Live preview: still page, or the looping story animation.
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const box = cv.parentElement!;
    const maxH = Math.min(wide ? 560 : 480, innerHeight * 0.56);
    const maxW = box.clientWidth - 24;
    const s = Math.min(maxH / D.H, maxW / 1080), dpr = devicePixelRatio || 1;
    const cw = Math.round(1080 * s), ch = Math.round(D.H * s);
    cv.style.width = cw + 'px'; cv.style.height = ch + 'px';
    cv.width = Math.round(cw * dpr); cv.height = Math.round(ch * dpr);
    const ctx = cv.getContext('2d')!;
    ctx.setTransform(s * dpr, 0, 0, s * dpr, 0, 0);
    if (!video) { drawPage(ctx, eff, pages[pi], pi, pn, DY[eff.day], items, getImg); return; }
    let raf = 0;
    const t0 = performance.now();
    const loop = () => {
      const t = ((performance.now() - t0) / 1000) % tl.total;
      ctx.setTransform(s * dpr, 0, 0, s * dpr, 0, 0);
      drawVideoFrame(ctx, eff, items, tl, t);
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, [eff, items, pages, pi, pn, tl, video, wide, D.H, tick]);

  const seg = <K extends keyof ExportOpts>(key: K, opts: Opt[]) =>
    opts.map(([k, l, sw]) => {
      const on = ex[key] === k;
      return { label: l, on, sw, onClick: () => setEx(key, k as ExportOpts[K]) };
    });
  const rows = [
    { label: '出力', opts: seg('media', [['image', '画像'], ['video', '動画']]) },
    { label: 'レイアウト', opts: seg('layout', [['poster', 'Poster'], ['timeline', 'Timeline'], ['grid', 'Grid']]) },
    { label: 'テーマ', opts: seg('theme', Object.entries(THEMES).map(([k, t]) => [k, t.label, t.sw] as Opt)) },
    { label: '内容', opts: seg('content', [['must', '● のみ'], ['mm', '● + ○'], ['all', '全枠']]) },
    { label: '日', opts: seg('day', DAYS.map((d) => [d.id, d.dow] as Opt)) },
    { label: '写真', opts: seg('photo', [[true, 'あり'], [false, 'なし']]) },
    ...(video ? [] : [{ label: 'サイズ', opts: seg('format', [['story', 'Story'], ['wallpaper', '壁紙']]) }]),
  ];

  const meta = video ? `${D.pw}×${D.ph} · MP4 · ${Math.round(tl.total)}s` : `${D.pw}×${D.ph}${pn > 1 ? ` · ${pi + 1}/${pn}` : ''}`;

  const save = async () => {
    if (busy != null) { abortRef.current?.abort(); return; }
    try {
      if (video) {
        const ac = new AbortController(); abortRef.current = ac;
        setBusy(0);
        const r = await renderVideo(eff, items, (p) => setBusy(p), ac.signal);
        setBusy(null);
        const how = await deliver([r.file]);
        if (how !== 'cancelled') flash(how === 'shared' ? '共有しました' : `${r.kind.toUpperCase()} を保存`);
      } else {
        setBusy(0);
        const files = await renderPngs(eff, items);
        setBusy(null);
        const how = await deliver(files);
        if (how !== 'cancelled') flash(how === 'shared' ? '共有しました' : `${D.pw}×${D.ph} を保存`);
      }
    } catch (e) {
      setBusy(null);
      if ((e as Error).name === 'AbortError') flash('書き出しを中止しました');
      else flash(video ? 'この端末では動画を書き出せませんでした' : '画像を書き出せませんでした');
    }
  };

  const saveLabel =
    busy != null ? (video ? `書き出し中 ${Math.round(busy * 100)}% — 中止` : '書き出し中…') : video ? 'MP4を保存' : pn > 1 ? `PNG ${pn}枚を保存` : 'PNGを保存';

  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <div className="flex flex-col items-center gap-2.5 bg-[#070707] px-3 pt-[18px] pb-3">
        <canvas ref={canvasRef} aria-label="書き出しプレビュー" className="block shadow-[0_20px_60px_rgba(0,0,0,.8)]" />
        <div className="flex h-[30px] items-center gap-2.5">
          {!video && pn > 1 && <PageBtn label="前のページ" onClick={() => set({ page: (pi - 1 + pn) % pn })}>‹</PageBtn>}
          <span className="font-mono text-[11px] font-medium whitespace-nowrap text-sub">{meta}</span>
          {!video && pn > 1 && <PageBtn label="次のページ" onClick={() => set({ page: (pi + 1) % pn })}>›</PageBtn>}
        </div>
      </div>
      <div className="flex flex-col px-3 pt-0.5 pb-[18px]">
        {rows.map((row) => (
          <div key={row.label} className="grid min-h-[50px] grid-cols-[56px_minmax(0,1fr)] items-center gap-2 border-b border-bone/7">
            <div className="font-mono text-[10px] font-medium text-sub">{row.label}</div>
            <div className="flex gap-px border border-bone/12 bg-bone/12">
              {row.opts.map((o) => (
                <button
                  key={o.label}
                  onClick={o.onClick}
                  aria-pressed={o.on}
                  className="flex h-9 min-w-0 flex-1 items-center justify-center gap-1.5 border-0 text-[12px] font-semibold whitespace-nowrap transition-colors"
                  style={{ background: o.on ? FG : INK, color: o.on ? INK : FG }}
                >
                  {o.sw && <span className="size-[11px] flex-none shadow-[inset_0_0_0_1px_rgba(128,128,128,.6)]" style={{ background: o.sw }} />}
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        ))}
        {!video && ex.format === 'wallpaper' && (
          <div className="grid min-h-[50px] grid-cols-[56px_minmax(0,1fr)] items-center gap-2 border-b border-bone/7">
            <div className="font-mono text-[10px] font-medium text-sub">端末</div>
            <select value={ex.device} onChange={(e) => setEx('device', e.target.value)} aria-label="壁紙サイズ" className="h-[38px] border border-bone/20 bg-ink px-2 font-mono text-[12px] font-medium text-bone">
              {DEVICES.map((dv) => <option key={dv.id} value={dv.id}>{dv.label}</option>)}
            </select>
          </div>
        )}
        <div className="mt-3.5 grid grid-cols-[minmax(0,1fr)_auto] gap-2">
          <button onClick={save} className="relative h-[52px] overflow-hidden border-0 bg-bone text-[14px] font-bold text-ink active:scale-[.98]">
            {busy != null && video && <span className="absolute inset-y-0 left-0 bg-ink/15" style={{ width: `${busy * 100}%` }} />}
            <span className="relative">{saveLabel}</span>
          </button>
          <button
            onClick={() => {
              const url = location.href.split('#')[0] + '#s=' + encodeURIComponent(encodeShare(sel));
              navigator.clipboard?.writeText(url).catch(() => {});
              flash('リンクをコピーしました');
            }}
            className="h-[52px] border border-bone/25 bg-transparent px-[18px] text-[13px] font-semibold whitespace-nowrap"
          >
            リンク
          </button>
        </div>
        <p className="mt-4 font-mono text-[10px] leading-relaxed text-bone/40">Made with {SITE} · 非公式ファンメイド · 時刻は仮データ</p>
      </div>
    </div>
  );
}

function PageBtn({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} aria-label={label} className="size-[30px] border border-bone/25 bg-transparent font-mono text-[13px] font-medium">
      {children}
    </button>
  );
}
