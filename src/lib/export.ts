import { DY, PERFS, ST, fm } from './data';
import type { Sel } from './plan';
import { buildPages, dims, drawOutro, drawPage, pageDuration, type Item } from './render';
import type { ExportOpts, Photo } from './store';

// ---------- image cache (CORS-enabled so the canvas stays exportable) ----------
const cache = new Map<string, HTMLImageElement & { failed?: boolean }>();
const listeners = new Set<() => void>();
export function onImageLoad(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; }
export function getImg(url: string): HTMLImageElement | null {
  if (!url) return null;
  let im = cache.get(url);
  if (!im) {
    im = new Image();
    im.crossOrigin = 'anonymous';
    im.decoding = 'async';
    const ref = im;
    im.onload = () => {
      // Verify the image can be used in a canvas without tainting (CORS).
      try {
        const test = document.createElement('canvas');
        test.width = 1; test.height = 1;
        test.getContext('2d')!.drawImage(ref, 0, 0);
      } catch {
        ref.failed = true;
      }
      listeners.forEach((f) => f());
    };
    im.onerror = () => { ref.failed = true; };
    im.src = url;
    cache.set(url, im);
  }
  return im.complete && im.naturalWidth && !im.failed ? im : null;
}
/** Waits (bounded) for every photo the export will draw. */
export function preload(urls: string[], timeout = 8000): Promise<void> {
  const ps = urls.filter(Boolean).map((u) => {
    getImg(u);
    const im = cache.get(u)!;
    if (im.complete) return Promise.resolve();
    return new Promise<void>((r) => { im.addEventListener('load', () => r(), { once: true }); im.addEventListener('error', () => r(), { once: true }); });
  });
  return Promise.race([Promise.all(ps).then(() => undefined), new Promise<void>((r) => setTimeout(r, timeout))]);
}

export function exportItems(ex: ExportOpts, sel: Sel, phOf: (name: string) => Photo | null): Item[] {
  return PERFS.filter((p) => p.day === ex.day)
    .map((p) => ({ name: p.name, start: fm(p.start), end: fm(p.end), s: p.start, e: p.end, stage: ST[p.stage].name, stageId: p.stage, st: sel[p.id] || 'none', ph: phOf(p.name) }) as Item)
    .filter((i) => ex.content === 'all' || i.st === 'must' || (ex.content === 'mm' && i.st === 'maybe'))
    .sort((a, b) => a.s - b.s || a.stageId.localeCompare(b.stageId));
}

export const fileBase = (ex: ExportOpts) => `tt-${DY[ex.day].dow.toLowerCase()}-${ex.layout}-${ex.theme}`;

// ---------- still images ----------
export async function renderPngs(ex: ExportOpts, items: Item[]): Promise<File[]> {
  const D = dims(ex), pages = buildPages(ex, items), day = DY[ex.day];
  if (ex.photo) await preload(items.map((i) => i.ph?.hi || ''));
  const files: File[] = [];
  for (let i = 0; i < pages.length; i++) {
    const c = document.createElement('canvas'); c.width = D.pw; c.height = D.ph;
    const x = c.getContext('2d')!; x.setTransform(D.f, 0, 0, D.f, 0, 0);
    drawPage(x, ex, pages[i], i, pages.length, day, items, getImg);
    const b = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/png'));
    if (!b) throw new Error('toBlob failed');
    files.push(new File([b], `${fileBase(ex)}${pages.length > 1 ? '-' + (i + 1) : ''}.png`, { type: 'image/png' }));
  }
  return files;
}

// ---------- Story video ----------
const FPS = 30, FADE = 0.3, OUTRO = 2.2;
export function videoTimeline(ex: ExportOpts, items: Item[]) {
  const pages = buildPages(ex, items);
  const segs = pages.map((p) => pageDuration(p.length));
  return { pages, segs, total: segs.reduce((a, b) => a + b, 0) + OUTRO };
}
/** Draws frame at time t (seconds) of the story video. */
export function drawVideoFrame(ctx: CanvasRenderingContext2D, ex: ExportOpts, items: Item[], tl: ReturnType<typeof videoTimeline>, t: number) {
  const day = DY[ex.day], D = dims(ex);
  let acc = 0;
  for (let i = 0; i < tl.pages.length; i++) {
    const d = tl.segs[i];
    if (t < acc + d) {
      const lt = t - acc;
      drawPage(ctx, ex, tl.pages[i], i, tl.pages.length, day, items, getImg, { t: lt, dur: d });
      const out = lt - (d - FADE);
      if (out > 0) { ctx.save(); ctx.globalAlpha = Math.min(1, out / FADE); ctx.fillStyle = getComputedBg(ex); ctx.fillRect(0, 0, 1080, D.H); ctx.restore(); }
      return;
    }
    acc += d;
  }
  drawOutro(ctx, ex, day, t - acc);
}
const getComputedBg = (ex: ExportOpts) => ({ ink: '#0c0c0b', paper: '#ebe8e0', riso: '#f1ebdd' })[ex.theme];

export type VideoResult = { file: File; kind: 'mp4' | 'webm' };

/**
 * Encodes a 1080×1920 30fps story video. Uses WebCodecs (H.264 MP4 via mediabunny) when available —
 * faster than real time and Instagram-friendly — and falls back to MediaRecorder (real time) otherwise.
 */
export async function renderVideo(ex: ExportOpts, items: Item[], onProgress: (p: number) => void, signal?: AbortSignal): Promise<VideoResult> {
  const exS: ExportOpts = { ...ex, format: 'story' };
  if (exS.photo) await preload(items.map((i) => i.ph?.hi || ''));
  const tl = videoTimeline(exS, items);
  const W = 1080, H = 1920;
  const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d', { alpha: false })!;
  const frames = Math.ceil(tl.total * FPS);

  const mb = await import('mediabunny');
  let codec: 'avc' | 'hevc' | 'vp9' | 'av1' | null = null;
  if (typeof VideoEncoder !== 'undefined')
    for (const c of ['avc', 'hevc', 'vp9', 'av1'] as const)
      if (await mb.canEncodeVideo(c, { width: W, height: H, bitrate: 8_000_000 }).catch(() => false)) { codec = c; break; }
  if (codec) {
    const target = new mb.BufferTarget();
    const output = new mb.Output({ format: new mb.Mp4OutputFormat({ fastStart: 'in-memory' }), target });
    const src = new mb.CanvasSource(canvas, { codec, bitrate: 8_000_000, keyFrameInterval: 1 });
    output.addVideoTrack(src, { frameRate: FPS });
    await output.start();
    for (let f = 0; f < frames; f++) {
      if (signal?.aborted) { await output.cancel(); throw new DOMException('aborted', 'AbortError'); }
      drawVideoFrame(ctx, exS, items, tl, f / FPS);
      await src.add(f / FPS, 1 / FPS);
      if (f % 6 === 0) onProgress(f / frames);
    }
    await output.finalize();
    onProgress(1);
    return { file: new File([target.buffer!], `${fileBase(exS)}.mp4`, { type: 'video/mp4' }), kind: 'mp4' };
  }

  // Fallback: record the canvas in real time.
  const mime = ['video/mp4;codecs=avc1', 'video/webm;codecs=vp9', 'video/webm'].find((m) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m));
  if (!mime) throw new Error('video unsupported');
  const stream = canvas.captureStream(FPS);
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 8_000_000 });
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const done = new Promise<void>((r) => { rec.onstop = () => r(); });
  rec.start();
  const t0 = performance.now();
  await new Promise<void>((resolve, reject) => {
    const tick = () => {
      if (signal?.aborted) { rec.stop(); reject(new DOMException('aborted', 'AbortError')); return; }
      const t = (performance.now() - t0) / 1000;
      drawVideoFrame(ctx, exS, items, tl, Math.min(t, tl.total));
      onProgress(Math.min(1, t / tl.total));
      if (t >= tl.total) { resolve(); return; }
      requestAnimationFrame(tick);
    };
    tick();
  });
  rec.stop();
  await done;
  const kind = mime.startsWith('video/mp4') ? 'mp4' : 'webm';
  return { file: new File(chunks, `${fileBase(exS)}.${kind}`, { type: mime.split(';')[0] }), kind };
}

/** Share sheet on phones (straight into Instagram Stories), download elsewhere. */
export async function deliver(files: File[]): Promise<'shared' | 'saved' | 'cancelled'> {
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  const touch = matchMedia('(pointer: coarse)').matches;
  if (touch && nav.share && nav.canShare?.({ files })) {
    try { await nav.share({ files }); return 'shared'; } catch (e) { if ((e as Error).name === 'AbortError') return 'cancelled'; }
  }
  files.forEach((f) => {
    const a = document.createElement('a'); a.href = URL.createObjectURL(f); a.download = f.name;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  });
  return 'saved';
}
