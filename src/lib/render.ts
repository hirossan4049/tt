// Dedicated canvas renderer for Story / Wallpaper exports (not a screenshot).
// All drawing happens in a 1080-wide logical space; `dims()` gives the logical height.
// An optional `anim` turns the same layout into motion frames for video export.
//
// Printed club-poster direction: oversized condensed type, hard ink fields, monochrome
// photography and a recurring orbital mark. Density changes composition, never page count.
// Every set keeps its complete name, start/end time and stage; crowded schedules use a
// numbered lane map with a matching programme on the same canvas.
import { DEVICES, FESTIVAL, SITE, STAGES, type Day, type StageId, type Status } from './data';
import type { ExportOpts, Photo, ThemeId } from './store';

export interface Item { name: string; start: string; end: string; s: number; e: number; stage: string; stageShort: string; stageId: StageId; st: Status; ph: Photo | null }

export interface Theme {
  label: string; sw: string; bg: string; fg: string; sub: string; line: string; acc: string;
  disp: string; dw: number; nw: number; upper: boolean; track: number; photo: 'mono' | 'duo' | 'color'; duoLift?: string; phBg: string; phInk: string;
}

const DISP = '"Big Shoulders Display"', ARCH = '"Archivo"', MONO = '"IBM Plex Mono","Noto Sans JP"';
const P = 48, W = 1080;

export const THEMES: Record<ThemeId, Theme> = {
  ink: { label: 'Ink', sw: '#dfff00', bg: '#101112', fg: '#f4f2e9', sub: '#b0b2a8', line: '#41433d', acc: '#dfff00', disp: DISP, dw: 900, nw: 800, upper: true, track: -0.015, photo: 'mono', phBg: '#262922', phInk: '#dfff00' },
  paper: { label: 'Paper', sw: '#eee9dc', bg: '#eee9dc', fg: '#181918', sub: '#55564f', line: '#b6b1a5', acc: '#e63b21', disp: DISP, dw: 900, nw: 800, upper: true, track: -0.015, photo: 'mono', phBg: '#d9d2c0', phInk: '#e63b21' },
  riso: { label: 'Riso', sw: 'linear-gradient(135deg,#ff719e 50%,#2339dc 50%)', bg: '#f3edda', fg: '#2339dc', sub: '#424a9b', line: '#a3a9d6', acc: '#ff719e', disp: DISP, dw: 900, nw: 800, upper: true, track: -0.01, photo: 'duo', duoLift: '#ff719e', phBg: '#e4deed', phInk: '#2339dc' },
};

export const FONT_LOADS = [`900 100px ${DISP}`, `800 100px ${DISP}`, `800 100px ${ARCH}`, `700 100px ${ARCH}`, `600 100px ${ARCH}`, `500 20px ${MONO}`, `600 20px ${MONO}`, `400 20px ${MONO}`];

export interface Dims { W: number; H: number; f: number; top: number; bot: number; pw: number; ph: number; wallpaper: boolean }
export function dims(ex: Pick<ExportOpts, 'format' | 'device'>): Dims {
  if (ex.format === 'story') return { W, H: 1920, f: 1, top: 128, bot: 86, pw: 1080, ph: 1920, wallpaper: false };
  const d = DEVICES.find((x) => x.id === ex.device) || DEVICES[0];
  const f = d.w / 1080, H = d.h / f;
  return { W, H, f, top: Math.round(H * 0.3), bot: 96, pw: d.w, ph: d.h, wallpaper: true };
}

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
type ImgFn = (url: string) => CanvasImageSource | null;

const cs = (T: Theme, n: string) => (T.upper ? n.toUpperCase() : n);
const ls = (ctx: Ctx, v: string) => { if ('letterSpacing' in ctx) (ctx as CanvasRenderingContext2D).letterSpacing = v; };
function setF(ctx: Ctx, T: Theme, wt: number, s: number) { ctx.font = `${wt} ${s}px ${T.disp}`; ls(ctx, T.track * s + 'px'); }
function mono(ctx: Ctx, s: number, wt = 500) { ctx.font = `${wt} ${s}px ${MONO}`; ls(ctx, '0px'); }
function fitT(ctx: Ctx, T: Theme, txt: string, wt: number, size: number, min: number, maxW: number) {
  let s = size; setF(ctx, T, wt, s);
  while (s > min && ctx.measureText(txt).width > maxW) { s -= 2; setF(ctx, T, wt, s); }
  return s;
}
/** Shrinks a mono-font line until it fits `maxW` — guarantees long stage names never collide with neighboring text. */
function fitMono(ctx: Ctx, txt: string, size: number, min: number, maxW: number, wt = 500) {
  let s = size; mono(ctx, s, wt);
  while (s > min && ctx.measureText(txt).width > maxW) { s -= 1; mono(ctx, s, wt); }
  return s;
}
function wrapW(ctx: Ctx, txt: string, maxW: number) {
  const lines: string[] = []; let line = '';
  for (const word of txt.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width <= maxW) { line = next; continue; }
    if (line) { lines.push(line); line = ''; }
    // Unbroken names still wrap; no ellipsis and no lost suffix.
    for (const char of Array.from(word)) {
      if (line && ctx.measureText(line + char).width > maxW) { lines.push(line); line = ''; }
      line += char;
    }
  }
  if (line) lines.push(line);
  return lines;
}
function sizeOf(img: CanvasImageSource) {
  const i = img as HTMLImageElement;
  return { iw: i.naturalWidth || (img as ImageBitmap).width, ih: i.naturalHeight || (img as ImageBitmap).height };
}
// Locate warm skin clusters once per source photo. This avoids cutting off a face when
// a portrait becomes a wide strip; monochrome/stage photos use a conservative upper crop.
// The small local readback is optional (e.g. cross-origin images); no network or face API.
const focalPoints = new WeakMap<object, number>();
function focalY(img: CanvasImageSource): number {
  const cached = focalPoints.get(img); if (cached !== undefined) return cached;
  let focus = 0.34;
  try {
    const c = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(48, 64) : document.createElement('canvas');
    c.width = 48; c.height = 64;
    const x = c.getContext('2d') as Ctx;
    x.drawImage(img, 0, 0, 48, 64);
    const pixels = x.getImageData(0, 0, 48, 64).data, mask = new Uint8Array(48 * 64);
    for (let y = 3; y < 48; y++) for (let xx = 4; xx < 44; xx++) {
      const p = (y * 48 + xx) * 4, r = pixels[p], g = pixels[p + 1], b = pixels[p + 2];
      if (r > 65 && g > 35 && b > 20 && r > g * 1.06 && r > b * 1.12 && r - Math.min(g, b) > 18) mask[y * 48 + xx] = 1;
    }
    let best = 12;
    for (let p = 0; p < mask.length; p++) if (mask[p]) {
      const queue = [p]; mask[p] = 0; let sumY = 0;
      for (let q = 0; q < queue.length; q++) {
        const v = queue[q]; sumY += Math.floor(v / 48);
        for (const n of [v - 48, v + 48, v - 1, v + 1]) if (n >= 0 && n < mask.length && mask[n]) { mask[n] = 0; queue.push(n); }
      }
      const center = sumY / queue.length / 64, score = queue.length * (1 - center * 0.55);
      if (score > best) { best = score; focus = center; }
    }
  } catch { /* A non-readable photo still exports with the conservative crop. */ }
  focalPoints.set(img, focus); return focus;
}
function cover(ctx: Ctx, img: CanvasImageSource, x: number, y: number, w: number, h: number, zoom = 1, fy = focalY(img)) {
  const { iw, ih } = sizeOf(img); const ir = iw / ih, r = w / h;
  let sw: number, sh: number, sx: number, sy: number;
  if (ir > r) { sh = ih; sw = sh * r; sx = (iw - sw) / 2; sy = 0; } else { sw = iw; sh = sw / r; sx = 0; sy = Math.max(0, Math.min(ih - sh, ih * fy - sh * 0.5)); }
  if (zoom !== 1) { const nw = sw / zoom, nh = sh / zoom; sx += (sw - nw) / 2; sy += (sh - nh) * fy; sw = nw; sh = nh; }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}
/** The recurring orbital mark is drawn with vectors, so photo-off is an art direction too. */
function orbit(ctx: Ctx, T: Theme, x: number, y: number, w: number, h: number) {
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.fillStyle = T.acc; ctx.fillRect(x, y, w, h);
  ctx.translate(x + w * 0.55, y + h * 0.48); ctx.rotate(-0.42);
  ctx.strokeStyle = T.bg === '#101112' ? T.bg : T.fg; ctx.lineWidth = Math.max(2, Math.min(w, h) * 0.018);
  const r = Math.max(w, h) * 0.66;
  for (let i = 0; i < 8; i++) {
    ctx.beginPath(); ctx.ellipse(0, 0, r, r * (0.12 + i * 0.055), 0, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.restore();
}
// Keep the original 1×1 dot at (2,2), repeated every six logical pixels. Tiles
// are shared across exports; patterns belong to their destination context.
const halftoneTiles = new Map<string, OffscreenCanvas | HTMLCanvasElement>();
const halftonePatterns = new WeakMap<Ctx, Map<string, CanvasPattern>>();
function halftone(ctx: Ctx, T: Theme, x: number, y: number, w: number, h: number) {
  const color = T.photo === 'duo' ? 'rgba(35,57,220,.16)' : 'rgba(0,0,0,.12)';
  let patterns = halftonePatterns.get(ctx);
  if (!patterns) { patterns = new Map(); halftonePatterns.set(ctx, patterns); }
  let pattern = patterns.get(color);
  if (!pattern) {
    let tile = halftoneTiles.get(color);
    if (!tile) {
      tile = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(6, 6) : document.createElement('canvas');
      tile.width = 6; tile.height = 6;
      const ink = tile.getContext('2d') as Ctx;
      ink.fillStyle = color; ink.fillRect(2, 2, 1, 1);
      halftoneTiles.set(color, tile);
    }
    pattern = ctx.createPattern(tile, 'repeat')!;
    patterns.set(color, pattern);
  }
  ctx.save(); ctx.translate(x, y); ctx.fillStyle = pattern;
  ctx.fillRect(0, 0, w, h); ctx.restore();
}
/** Consistent print treatment; selection status never switches a photo back to raw color. */
function photo(ctx: Ctx, T: Theme, img: CanvasImageSource | null, name: string, x: number, y: number, w: number, h: number, mode?: Theme['photo'] | null, zoom = 1) {
  if (!img) { orbit(ctx, T, x, y, w, h); return; }
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.filter = 'grayscale(1) contrast(1.22)';
  cover(ctx, img, x, y, w, h, zoom); ctx.filter = 'none';
  if (T.photo === 'duo') {
    ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = T.acc; ctx.fillRect(x, y, w, h);
    ctx.globalCompositeOperation = 'screen'; ctx.fillStyle = T.fg; ctx.fillRect(x, y, w, h);
  }
  ctx.globalCompositeOperation = 'source-over';
  halftone(ctx, T, x, y, w, h);
  ctx.restore();
}
function dimUnselected(ctx: Ctx, x: number, y: number, w: number, h: number) {
  ctx.save(); ctx.globalAlpha *= 0.35; ctx.fillStyle = '#101112'; ctx.fillRect(x, y, w, h); ctx.restore();
}
function masthead(ctx: Ctx, D: Dims, T: Theme, day: Day) {
  const y = D.top;
  ctx.fillStyle = T.fg; setF(ctx, T, 900, 77); ctx.fillText('TOMORROWLAND', P - 2, y + 40);
  mono(ctx, 16, 600); ctx.fillText('THAILAND / 2026', P, y + 74);
  ctx.fillStyle = T.acc; ctx.fillRect(W - P - 182, y - 20, 182, 100);
  ctx.fillStyle = T.bg === '#101112' ? T.bg : T.fg;
  setF(ctx, T, 900, 48); ctx.fillText(day.dow, W - P - 170, y + 21);
  mono(ctx, 15, 600); ctx.fillText(day.date, W - P - 168, y + 59);
  ctx.fillStyle = T.fg; ctx.fillRect(P, y + 100, W - 2 * P, 3);
}
function credit(ctx: Ctx, D: Dims, T: Theme, credits: string[]) {
  const y = D.H - 34;
  mono(ctx, 13, 500); ctx.fillStyle = T.sub; ctx.textAlign = 'right';
  ctx.fillText(SITE, W - P, y); ctx.textAlign = 'left';
  if (credits.length) {
    const txt = 'PHOTOS: ' + credits.join(' / ');
    fitMono(ctx, txt, 12, 8, W - 2 * P - 210); ctx.fillText(txt, P, y);
  }
}
/** Keep the wallpaper clock area flat and quiet; content begins below it. */
function wallpaperSafeArea(ctx: Ctx, D: Dims, T: Theme) {
  if (!D.wallpaper) return;
  ctx.fillStyle = T.bg; ctx.fillRect(0, 0, W, D.top - 36);
}

// The single source of truth for set typography: three measured fields, never optional.
// The caller supplies either the paper palette or a high-contrast photo-overlay palette.
function programme(ctx: Ctx, T: Theme, it: Item, x: number, y: number, w: number, h: number, maxSize: number, numbered?: number, showStage = true) {
  // Hard safety net: whatever the sizing math below decides, nothing ever paints
  // outside this box. A real stage timetable can hand us a 15-minute, 24px-tall cell —
  // text must still resolve to *something readable inside it*, never bleed into the next.
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  const inset = numbered === undefined ? 0 : Math.min(40, w * 0.1);
  if (numbered !== undefined && h > 22) {
    mono(ctx, Math.min(16, h * 0.2), 600); ctx.fillStyle = T.sub;
    ctx.fillText(String(numbered).padStart(2, '0'), x, y + Math.min(22, h * 0.27));
  }
  x += inset; w -= inset;
  const compact = h < 105;
  const baseMetaSize = Math.max(9, Math.min(compact ? 16 : 19, h * 0.17));
  const metaFontAt = (s: number) => {
    if (compact) { ctx.font = `800 ${s}px ${DISP}`; ls(ctx, '0px'); }
    else mono(ctx, s, 500);
  };
  // Metadata is condensed, not omitted — and now fit to WIDTH as well as height: a narrow
  // stage-timetable column must never clip "13:00–14:25" mid-digit. Time is the one field
  // that is never dropped; stage (the first thing to give up space) rides along only if it
  // still fits after time claims what it needs — a column header already names the stage
  // when `showStage` is false, so dropping it there loses nothing.
  const time = `${it.start}–${it.end}`;
  const combined = showStage ? `${time} / ${it.stage}` : time;
  let metaSize = baseMetaSize, inline = false, stageLines: string[] = [];
  if (compact) {
    metaFontAt(metaSize);
    while (metaSize > 8 && ctx.measureText(combined).width > w) { metaSize -= 1; metaFontAt(metaSize); }
    inline = ctx.measureText(combined).width <= w;
  }
  if (!inline) {
    metaSize = baseMetaSize; metaFontAt(metaSize);
    while (metaSize > 7 && ctx.measureText(time).width > w) { metaSize -= 1; metaFontAt(metaSize); }
    if (showStage && h >= 70) stageLines = wrapW(ctx, it.stage, w);
  }
  const metaFont = () => metaFontAt(metaSize);
  let metaH = (inline ? 1 : 1 + stageLines.length) * metaSize * 1.18;
  // If even one metadata line would eat more than half the box, there is no honest way to
  // show both name and time here — keep the time (never dropped) and give up the stage line.
  if (metaH > h * 0.6) { stageLines = []; metaH = metaSize * 1.18; }
  const nameH = Math.max(1, h - metaH - (metaH ? 4 : 0));
  let size = Math.min(maxSize, nameH / 0.92), lines: string[] = [], ascent = 0, descent = 0;
  for (; size > 1; size -= 1) {
    setF(ctx, T, T.nw, size);
    if (size > 18 && cs(T, it.name).split(/\s+/).some(word => ctx.measureText(word).width > w)) continue;
    lines = wrapW(ctx, cs(T, it.name), w);
    const metrics = lines.map(line => ctx.measureText(line));
    ascent = Math.max(...metrics.map(m => m.actualBoundingBoxAscent));
    descent = Math.max(0, ...metrics.map(m => m.actualBoundingBoxDescent));
    const total = ascent + descent + (lines.length - 1) * size * 1.02;
    if (total <= nameH || size <= 8) break;
  }
  // Clamp to the box even at the size floor — caption still reads top-aligned, never overflowing.
  const maxLines = Math.max(1, Math.floor(nameH / (size * (lines.length > 1 ? 1.02 : 1))));
  if (lines.length > maxLines) lines = lines.slice(0, maxLines);
  ctx.fillStyle = it.st === 'none' ? T.sub : T.fg;
  lines.forEach((line, i) => { setF(ctx, T, T.nw, size); ctx.fillText(line, x, y + ascent + i * size * 1.02); });
  if (metaH > 0) {
    const my = y + h - metaH + metaSize * 0.85;
    ctx.fillStyle = T.sub; metaFont(); ctx.fillText(inline ? combined : time, x, my);
    metaFont(); stageLines.forEach((line, i) => ctx.fillText(line, x, my + (i + 1) * metaSize * 1.18));
  }
  ctx.restore();
}

/** Full photographic plate with every programme field inside its bounds. */
function photoProgramme(ctx: Ctx, T: Theme, it: Item, im: CanvasImageSource, x: number, y: number, w: number, h: number, maxSize: number, numbered?: number, zoom = 1, showStage = true) {
  photo(ctx, T, im, it.name, x, y, w, h, undefined, zoom);
  if (it.st === 'none') dimUnselected(ctx, x, y, w, h);
  const pad = Math.min(24, h * 0.08);
  const textH = Math.min(h - 2 * pad, Math.max(120, Math.min(340, maxSize * 1.5 + 60, h * 0.48)));
  const textY = y + h - pad - textH, fadeY = Math.max(y, textY - Math.min(220, h * 0.45));
  const scrim = ctx.createLinearGradient(0, fadeY, 0, y + h);
  scrim.addColorStop(0, h < 240 ? 'rgba(0,0,0,.62)' : 'rgba(0,0,0,0)');
  // Reach the legibility floor BEFORE the first glyph, even in a short list row.
  scrim.addColorStop((textY - fadeY) / (y + h - fadeY), 'rgba(0,0,0,.72)');
  scrim.addColorStop(1, 'rgba(0,0,0,.9)');
  ctx.fillStyle = scrim; ctx.fillRect(x, y, w, h);
  programme(ctx, { ...T, fg: '#f4f2e9', sub: '#e1e2da' }, it, x + pad, textY, w - 2 * pad, textH, maxSize, numbered, showStage);
}

// ---------- motion ----------
/** Animation clock for a single page (seconds). Omit for a still image. */
export interface Anim { t: number; dur: number }
const easeOut = (x: number) => 1 - Math.pow(1 - x, 3);
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
type Enter = (i: number, fn: () => void, dy?: number) => void;
function makeEnter(ctx: Ctx, anim?: Anim): Enter {
  return (i, fn, dy = 40) => {
    if (!anim) { fn(); return; }
    const p = easeOut(clamp01((anim.t - 0.15 - Math.min(i * 0.055, 1.8)) / 0.5));
    if (p <= 0) return;
    ctx.save(); ctx.globalAlpha = p; ctx.translate(0, dy * (1 - p)); fn(); ctx.restore();
  };
}
export const pageDuration = (n: number) => Math.min(7, 3.4 + Math.min(n, 16) * 0.2);

type PosterTier = 'hero' | 'lead' | 'grid' | 'dense';
function pickPosterTier(n: number): PosterTier {
  if (n <= 3) return 'hero';
  if (n <= 6) return 'lead';
  if (n <= 15) return 'grid';
  return 'dense';
}
/** Picks which items get to be "the" photo(s) — must-status and photographed sets lead; never a fixed favorite. */
function pickLeads(items: Item[], count: number): Item[] {
  const photographed = items.filter((i) => i.ph);
  const pool = photographed.length >= count ? photographed : items;
  return pool
    .slice()
    .sort((a, b) => {
      const pa = a.st === 'must' ? 0 : a.st === 'maybe' ? 1 : 2, pb = b.st === 'must' ? 0 : b.st === 'maybe' ? 1 : 2;
      return pa !== pb ? pa - pb : a.s - b.s;
    })
    .slice(0, count);
}

export function drawPage(ctx: Ctx, ex: ExportOpts, items: Item[], day: Day, img: ImgFn, anim?: Anim) {
  const D = dims(ex), T = THEMES[ex.theme];
  const enter = makeEnter(ctx, anim);
  const zoom = anim ? 1.12 - 0.12 * easeOut(clamp01(anim.t / anim.dur)) : 1;
  ctx.fillStyle = T.bg; ctx.fillRect(0, 0, W, D.H); ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';

  const credits: string[] = [];
  const useImg = (it: Item) => {
    if (!ex.photo) return null;
    const im = it.ph ? img(it.ph.hi) : null;
    const c = it.ph && !it.ph.own && it.ph.credit ? it.ph.credit : '';
    if (im && c && !credits.includes(c)) credits.push(c);
    return im;
  };
  const modeOf = () => undefined;
  const top = D.top + 132, bottom = D.H - D.bot;
  enter(0, () => masthead(ctx, D, T, day), 0);
  if (ex.layout === 'schedule') drawSchedule(ctx, D, T, items, top, bottom, useImg, modeOf, enter);
  else if (ex.layout === 'timeline') drawList(ctx, D, T, items, top, bottom, useImg, modeOf, enter, 1);
  else if (ex.layout === 'grid') drawTimetable(ctx, D, T, items, top, bottom, useImg, enter, !!ex.reverse);
  else {
    const tier = pickPosterTier(items.length);
    if (tier === 'hero') drawHero(ctx, D, T, items, useImg, modeOf, enter, zoom);
    else if (tier === 'lead') drawLead(ctx, D, T, items, top, bottom, useImg, modeOf, enter, zoom);
    else if (tier === 'grid') drawGrid(ctx, D, T, items, top, bottom, useImg, modeOf, enter, 1, items.length <= 6 ? 2 : 3);
    else drawDense(ctx, D, T, items, top, bottom, enter, 1);
  }
  enter(0, () => credit(ctx, D, T, credits), 0);
  wallpaperSafeArea(ctx, D, T);
}

type UseImg = (it: Item) => CanvasImageSource | null;
type ModeOf = (it: Item) => 'color' | undefined;

/** 1–3: a large photographic plate, the whole programme overlaid directly on the photo. */
function drawHero(ctx: Ctx, D: Dims, T: Theme, items: Item[], useImg: UseImg, modeOf: ModeOf, enter: Enter, zoom: number) {
  const order = pickLeads(items, items.length), top = D.top + 132, bottom = D.H - D.bot;
  const gap = 24, h = (bottom - top - gap * (order.length - 1)) / Math.max(1, order.length);
  const maxSize = order.length === 1 ? 250 : order.length === 2 ? 190 : 150;
  order.forEach((it, i) => enter(i + 1, () => {
    const y = top + i * (h + gap);
    // A narrow fluorescent registration bar leads every plate, same device as every other tier.
    ctx.fillStyle = T.acc; ctx.fillRect(P, y, W - 2 * P, 8);
    const im = useImg(it);
    if (im) photoProgramme(ctx, T, it, im, P, y + 8, W - 2 * P, h - 8, maxSize, undefined, zoom);
    else programme(ctx, T, it, P, y + 32, W - 2 * P, h - 40, maxSize);
  }, 24));
}

/** 4–6: photographic lead and supporting bill, with type inside every photo. */
function drawLead(ctx: Ctx, D: Dims, T: Theme, items: Item[], top: number, bottom: number, useImg: UseImg, modeOf: ModeOf, enter: Enter, zoom: number) {
  const [lead] = pickLeads(items, 1); if (!lead) return;
  const rest = items.filter(it => it !== lead).sort((a, b) => a.s - b.s);
  const leadH = (bottom - top) * 0.46;
  enter(1, () => {
    const im = useImg(lead);
    if (im) photoProgramme(ctx, T, lead, im, P, top, W - 2 * P, leadH, 132, undefined, zoom);
    else programme(ctx, T, lead, P, top + 24, W - 2 * P, leadH - 48, 132);
  });
  const listTop = top + leadH + 26, rowH = (bottom - listTop) / rest.length;
  rest.forEach((it, i) => enter(i + 2, () => {
    const y = listTop + i * rowH;
    ctx.fillStyle = T.line; ctx.fillRect(P, y, W - 2 * P, 1);
    const im = useImg(it);
    if (im) photoProgramme(ctx, T, it, im, P, y + 12, W - 2 * P, rowH - 24, 88, i + 2, zoom);
    else programme(ctx, T, it, P, y + 12, W - 2 * P, rowH - 24, 88, i + 2);
  }, 16));
}

/** List is a full-height running order; photographic rows carry their own overlaid type. */
function drawList(ctx: Ctx, D: Dims, T: Theme, items: Item[], top: number, bottom: number, useImg: UseImg, modeOf: ModeOf, enter: Enter, idx0: number) {
  if (items.length > 20) { drawDense(ctx, D, T, items, top, bottom, enter, idx0); return; }
  const rowH = (bottom - top) / Math.max(1, items.length);
  items.forEach((it, i) => enter(idx0 + i * 0.3, () => {
    const y = top + i * rowH, im = rowH >= 155 ? useImg(it) : null;
    ctx.fillStyle = i === 0 ? T.acc : T.line; ctx.fillRect(P, y, W - 2 * P, i === 0 ? 8 : 1);
    const maxSize = items.length === 1 ? 250 : items.length < 4 ? 190 : 100;
    if (im) photoProgramme(ctx, T, it, im, P, y + 16, W - 2 * P, rowH - 30, maxSize, i + 1);
    else programme(ctx, T, it, P, y + 18, W - 2 * P, rowH - 30, maxSize, i + 1);
  }, 14));
}

/** Photographic contact sheet: the full programme overlaid on every plate, same as every other tier. */
function drawGrid(ctx: Ctx, D: Dims, T: Theme, items: Item[], top: number, bottom: number, useImg: UseImg, modeOf: ModeOf, enter: Enter, idx0: number, cols: number) {
  if (!items.length) return;
  cols = Math.min(cols, items.length);
  const rows = Math.ceil(items.length / cols), gap = items.length > 20 ? 12 : 22;
  const cw = (W - 2 * P - (cols - 1) * gap) / cols, ch = (bottom - top - (rows - 1) * gap) / rows;
  const maxSize = cols === 1 ? 180 : cols === 2 ? 86 : 62;
  items.forEach((it, i) => enter(idx0 + i * 0.15, () => {
    const x = P + (i % cols) * (cw + gap), y = top + Math.floor(i / cols) * (ch + gap);
    ctx.fillStyle = i % cols === 0 ? T.acc : T.line; ctx.fillRect(x, y, cw, 3);
    const im = useImg(it);
    if (im) photoProgramme(ctx, T, it, im, x, y + 6, cw, ch - 6, maxSize);
    else programme(ctx, T, it, x, y + 16, cw, ch - 20, maxSize);
  }, 18));
}

/**
 * The standalone "Grid" layout: a real per-stage timetable (time runs down, stages run across),
 * exactly like the in-app planner grid. Only stages that actually have a set in `items` get a
 * column — an unselected stage takes up no space at all. `reverse` flips the time axis so the
 * latest set sits at the top instead of the earliest.
 */
function drawTimetable(ctx: Ctx, D: Dims, T: Theme, items: Item[], top: number, bottom: number, useImg: UseImg, enter: Enter, reverse: boolean) {
  if (!items.length) return;
  const stageIds = STAGES.map((s) => s.id).filter((id) => items.some((it) => it.stageId === id));
  if (!stageIds.length) return;

  const startHour = Math.floor(Math.min(...items.map((i) => i.s)) / 60) * 60;
  const endHour = Math.ceil(Math.max(...items.map((i) => i.e)) / 60) * 60;
  const span = Math.max(60, endHour - startHour);

  const headerH = 40, hourColW = 54, gap = 6;
  const gridLeft = P + hourColW, gridTop = top + headerH + 8;
  const gridW = W - P - gridLeft, colW = (gridW - gap * (stageIds.length - 1)) / stageIds.length;
  const scale = (bottom - gridTop) / span;
  const yOf = (min: number) => gridTop + (reverse ? endHour - min : min - startHour) * scale;

  enter(0, () => {
    stageIds.forEach((id, i) => {
      const x = gridLeft + i * (colW + gap), stage = STAGES.find((s) => s.id === id)!;
      ctx.fillStyle = i === 0 ? T.acc : T.line; ctx.fillRect(x, top, colW, i === 0 ? 6 : 2);
      const size = fitMono(ctx, stage.short, Math.min(15, colW * 0.15), 8, colW - 4, 700);
      ctx.fillStyle = T.fg; mono(ctx, size, 700); ctx.fillText(stage.short, x, top + headerH - 10);
    });
    for (let h = startHour; h <= endHour; h += 60) {
      const y = reverse ? gridTop + (endHour - h) * scale : gridTop + (h - startHour) * scale;
      ctx.fillStyle = T.line; ctx.fillRect(gridLeft, y, gridW, 1);
      mono(ctx, 13, 500); ctx.fillStyle = T.sub;
      ctx.fillText(String(Math.floor(h / 60) % 24).padStart(2, '0'), P, y + (reverse ? -4 : 14));
    }
  }, 0);

  let idx = 0;
  stageIds.forEach((id, ci) => {
    const x = gridLeft + ci * (colW + gap);
    items.filter((it) => it.stageId === id).sort((a, b) => a.s - b.s).forEach((it) => {
      const top0 = reverse ? yOf(it.e) : yOf(it.s);
      const h = Math.max(26, (it.e - it.s) * scale - 3);
      const maxSize = Math.min(40, colW * 0.26);
      enter(idx + 1, () => {
        const dim = it.st === 'none';
        // The column header already names the stage, so every cell here skips repeating it —
        // that's real width given back to the name and the (never-dropped) start/end time.
        const im = h >= 100 ? useImg(it) : null;
        if (im) photoProgramme(ctx, T, it, im, x, top0, colW, h, maxSize, undefined, 1, false);
        else {
          ctx.fillStyle = T.line; ctx.fillRect(x, top0, colW, 1);
          if (dim) { ctx.fillStyle = T.phBg; ctx.fillRect(x, top0, colW, h); }
          programme(ctx, T, it, x + 6, top0 + 6, colW - 10, h - 10, maxSize, undefined, false);
        }
      }, 10);
      idx++;
    });
  });
}

/** High density is a festival bill, not a spreadsheet: name above complete time and stage. */
function drawDense(ctx: Ctx, D: Dims, T: Theme, items: Item[], top: number, bottom: number, enter: Enter, idx0: number) {
  const n = items.length; if (!n) return;
  const cols = n <= 24 ? 2 : 3, rows = Math.ceil(n / cols), gap = 26;
  const cw = (W - 2 * P - (cols - 1) * gap) / cols, rh = (bottom - top) / rows;
  items.forEach((it, i) => enter(idx0 + i * 0.08, () => {
    const col = Math.floor(i / rows), row = i % rows;
    const x = P + col * (cw + gap), y = top + row * rh;
    ctx.fillStyle = row === 0 ? T.acc : T.line; ctx.fillRect(x, y, cw, row === 0 ? 6 : 1);
    programme(ctx, T, it, x, y + Math.min(12, rh * 0.12), cw, rh - Math.min(22, rh * 0.2), cols === 2 ? 64 : 40);
  }, 0));
}

/** Calendar lanes retain true relative time inside each overlap cluster; idle gaps collapse.
 * When lanes become too narrow for complete names, the numbered map and full programme
 * share ONE image. Enlarging tiny events in-place would falsify overlaps, so we do not.
 */
function drawSchedule(ctx: Ctx, D: Dims, T: Theme, allItems: Item[], top: number, bottom: number, useImg: UseImg, modeOf: ModeOf, enter: Enter) {
  const items = allItems.filter(it => it.st !== 'none').sort((a, b) => a.s - b.s || a.e - b.e);
  if (!items.length) return;
  if (items.length === 1) { drawHero(ctx, D, T, items, useImg, modeOf, enter, 1); return; }
  type Cluster = { start: number; end: number; entries: { it: Item; lane: number; index: number }[]; ends: number[] };
  const clusters: Cluster[] = [];
  items.forEach((it, index) => {
    let c = clusters[clusters.length - 1];
    if (!c || it.s >= c.end) { c = { start: it.s, end: it.e, entries: [], ends: [] }; clusters.push(c); }
    c.end = Math.max(c.end, it.e);
    let lane = c.ends.findIndex(e => e <= it.s); if (lane < 0) lane = c.ends.length;
    c.ends[lane] = it.e; c.entries.push({ it, lane, index });
  });
  const total = clusters.reduce((sum, c) => sum + c.end - c.start, 0) || 1;
  const avail = bottom - top;
  const indexed = items.length > 18 || clusters.some(c => c.ends.length > 3 || c.entries.some(({ it }) => (it.e - it.s) / total * avail < 130));
  const mapH = indexed ? Math.min(300, avail * (items.length > 30 ? 0.15 : 0.25)) : avail;
  const scale = mapH / total;
  let cy = top;
  clusters.forEach(c => {
    const laneW = (W - 2 * P) / c.ends.length;
    c.entries.forEach(({ it, lane, index }) => {
      const x = P + lane * laneW, y = cy + (it.s - c.start) * scale;
      const w = laneW - 6, h = (it.e - it.s) * scale - 3;
      enter(index * 0.12 + 1, () => {
        const blockT = { ...T, bg: index % 2 ? T.phBg : T.bg };
        ctx.fillStyle = blockT.bg; ctx.fillRect(x, y, w, h);
        ctx.fillStyle = T.acc; ctx.fillRect(x, y, 5, h);
        if (indexed) {
          ctx.fillStyle = T.fg; mono(ctx, Math.max(8, Math.min(23, h * 0.65)), 600);
          ctx.fillText(String(index + 1).padStart(2, '0'), x + 10, y + Math.min(h - 2, 27));
        } else {
          const imageW = h > 260 && w > 440 ? w * 0.4 : 0;
          if (imageW) photo(ctx, T, useImg(it), it.name, x + w - imageW, y + 8, imageW, h - 16);
          programme(ctx, T, it, x + 14, y + 16, w - 28 - (imageW ? imageW + 8 : 0), h - 28, c.ends.length === 1 ? 150 : 70);
        }
      }, 0);
    });
    cy += (c.end - c.start) * scale;
  });
  if (indexed) {
    const listTop = top + mapH + 32, cols = items.length > 30 ? 3 : 2;
    const rows = Math.ceil(items.length / cols), rh = (bottom - listTop) / rows, cw = (W - 2 * P - (cols - 1) * 22) / cols;
    items.forEach((it, i) => enter(i * 0.08 + 1, () => {
      const x = P + Math.floor(i / rows) * (cw + 22), y = listTop + (i % rows) * rh;
      programme(ctx, T, it, x, y + 3, cw, rh - 8, 64, i + 1);
    }, 0));
  }
}

/** Closing card for videos: makes the "made with tt.h1rose.com" credit explicit. */
export function drawOutro(ctx: Ctx, ex: ExportOpts, day: Day, t: number) {
  const D = dims(ex), T = THEMES[ex.theme];
  ctx.fillStyle = T.bg; ctx.fillRect(0, 0, W, D.H);
  const p = (d: number) => easeOut(clamp01((t - d) / 0.5));
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.save(); ctx.globalAlpha = p(0); mono(ctx, 24); ctx.fillStyle = T.sub; ctx.fillText(`${FESTIVAL} — ${day.dow} ${day.d}`, 540, D.H / 2 - 150); ctx.restore();
  ctx.save(); ctx.globalAlpha = p(0.15); ctx.translate(0, 28 * (1 - p(0.15))); const s = fitT(ctx, T, cs(T, 'My Timetable'), T.dw, 150, 76, W - 2 * P); ctx.fillStyle = T.fg; ctx.fillText(cs(T, 'My Timetable'), 540, D.H / 2 - 10); void s; ctx.restore();
  ctx.save(); ctx.globalAlpha = p(0.4); ctx.fillStyle = T.acc; ctx.fillRect(540 - 50, D.H / 2 + 26, 100, 3); ctx.restore();
  ctx.save(); ctx.globalAlpha = p(0.55) * 0.7; mono(ctx, 20); ctx.fillStyle = T.sub; ctx.fillText(SITE, 540, D.H / 2 + 90); ctx.restore();
  ctx.textAlign = 'left';
}
