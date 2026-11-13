// Dedicated canvas renderer for Story / Wallpaper exports (not a screenshot).
// All drawing happens in a 1080-wide logical space; `dims()` gives the logical height.
// An optional `anim` turns the same layouts into motion frames for video export.
import { DEVICES, FESTIVAL, SITE, STAGES, type Day, type StageId, type Status } from './data';
import type { ExportOpts, Photo, ThemeId } from './store';

export interface Item { name: string; start: string; end: string; s: number; e: number; stage: string; stageId: StageId; st: Status; ph: Photo | null }

export interface Theme {
  label: string; sw: string; bg: string; fg: string; sub: string; line: string; acc: string; mustFill: string; mustInk: string;
  disp: string; dw: number; nw: number; upper: boolean; track: number; photo: 'mono' | 'duo' | 'color'; duoLift?: string; phBg: string; phInk: string; mk: 'circle' | 'square';
}

const DISP = '"Big Shoulders Display"', ARCH = '"Archivo"', MONO = '"IBM Plex Mono","Noto Sans JP"';
const P = 72, W = 1080;

export const THEMES: Record<ThemeId, Theme> = {
  ink: { label: 'Ink', sw: '#0c0c0b', bg: '#0c0c0b', fg: '#f0efea', sub: '#8e8c86', line: 'rgba(240,239,234,.16)', acc: '#ff4a2e', mustFill: '#f0efea', mustInk: '#0c0c0b', disp: DISP, dw: 900, nw: 800, upper: true, track: 0, photo: 'mono', phBg: '#1a1a19', phInk: 'rgba(240,239,234,.2)', mk: 'circle' },
  paper: { label: 'Paper', sw: '#ebe8e0', bg: '#ebe8e0', fg: '#121211', sub: '#6c6962', line: 'rgba(18,18,17,.2)', acc: '#e8371f', mustFill: '#121211', mustInk: '#ebe8e0', disp: ARCH, dw: 800, nw: 700, upper: false, track: -0.04, photo: 'mono', phBg: '#d8d4ca', phInk: 'rgba(18,18,17,.22)', mk: 'square' },
  riso: { label: 'Riso', sw: 'linear-gradient(135deg,#ff3d8b 50%,#1f4fd1 50%)', bg: '#f1ebdd', fg: '#1f4fd1', sub: 'rgba(31,79,209,.62)', line: 'rgba(31,79,209,.28)', acc: '#ff3d8b', mustFill: '#ff3d8b', mustInk: '#f1ebdd', disp: DISP, dw: 900, nw: 800, upper: true, track: 0.01, photo: 'duo', duoLift: 'rgba(255,61,139,.2)', phBg: '#e6dfcf', phInk: 'rgba(255,61,139,.5)', mk: 'circle' },
};

export const FONT_LOADS = [`900 100px ${DISP}`, `800 100px ${DISP}`, `800 100px ${ARCH}`, `700 100px ${ARCH}`, `600 100px ${ARCH}`, `500 20px ${MONO}`, `600 20px ${MONO}`, `400 20px ${MONO}`];

export interface Dims { W: number; H: number; f: number; top: number; bot: number; pw: number; ph: number }
export function dims(ex: Pick<ExportOpts, 'format' | 'device'>): Dims {
  if (ex.format === 'story') return { W, H: 1920, f: 1, top: 220, bot: 260, pw: 1080, ph: 1920 };
  const d = DEVICES.find((x) => x.id === ex.device) || DEVICES[0];
  const f = d.w / 1080, H = d.h / f;
  return { W, H, f, top: Math.round(H * 0.32), bot: 210, pw: d.w, ph: d.h };
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
function wrapW(ctx: Ctx, txt: string, maxW: number) {
  const w = txt.split(' '); const L: string[] = []; let c = '';
  w.forEach((x) => { const t = c ? c + ' ' + x : x; if (ctx.measureText(t).width > maxW && c) { L.push(c); c = x; } else c = t; });
  if (c) L.push(c);
  return L;
}
function sizeOf(img: CanvasImageSource) {
  const i = img as HTMLImageElement;
  return { iw: i.naturalWidth || (img as ImageBitmap).width, ih: i.naturalHeight || (img as ImageBitmap).height };
}
function cover(ctx: Ctx, img: CanvasImageSource, x: number, y: number, w: number, h: number, zoom = 1, fy = 0.22) {
  const { iw, ih } = sizeOf(img); const ir = iw / ih, r = w / h;
  let sw: number, sh: number, sx: number, sy: number;
  if (ir > r) { sh = ih; sw = sh * r; sx = (iw - sw) / 2; sy = 0; } else { sw = iw; sh = sw / r; sx = 0; sy = (ih - sh) * fy; }
  if (zoom !== 1) { const nw = sw / zoom, nh = sh / zoom; sx += (sw - nw) / 2; sy += (sh - nh) * fy; sw = nw; sh = nh; }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}
function photo(ctx: Ctx, T: Theme, img: CanvasImageSource | null, name: string, x: number, y: number, w: number, h: number, mode?: Theme['photo'] | null, zoom = 1) {
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip(); const m = mode || T.photo;
  if (img) {
    cover(ctx, img, x, y, w, h, zoom);
    if (m !== 'color') { ctx.globalCompositeOperation = 'saturation'; ctx.fillStyle = '#808080'; ctx.fillRect(x, y, w, h); }
    if (m === 'duo') {
      ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha *= 0.9; ctx.fillStyle = T.fg; ctx.fillRect(x, y, w, h); ctx.globalAlpha /= 0.9;
      ctx.globalCompositeOperation = 'screen'; ctx.fillStyle = T.duoLift!; ctx.fillRect(x, y, w, h);
    }
    ctx.globalCompositeOperation = 'source-over';
  } else {
    // Typographic fallback when no licensed photo is available.
    ctx.fillStyle = T.phBg; ctx.fillRect(x, y, w, h);
    const t = name.toUpperCase(); const s = Math.max(26, Math.min(h / 2.6, w / 2.2));
    ctx.font = `900 ${s}px ${DISP}`; ls(ctx, '0px'); ctx.lineWidth = Math.max(1.2, s / 45); ctx.strokeStyle = T.phInk;
    let yy = y + s * 0.84, i = 0;
    while (yy < y + h + s) { ctx.strokeText(t + '  ' + t + '  ' + t, x - ((i * s * 1.3) % (w * 0.6)), yy); yy += s * 0.84; i++; }
  }
  ctx.restore();
}
function mark(ctx: Ctx, T: Theme, cx: number, cy: number, r: number, st: Status) {
  ctx.beginPath();
  if (T.mk === 'square') ctx.rect(cx - r, cy - r, r * 2, r * 2); else ctx.arc(cx, cy, r, 0, Math.PI * 2);
  if (st === 'must') { ctx.fillStyle = T.acc; ctx.fill(); } else { ctx.lineWidth = 3; ctx.strokeStyle = T.fg; ctx.stroke(); }
}
function head(ctx: Ctx, D: Dims, T: Theme, right: string, center?: boolean) {
  ctx.textBaseline = 'alphabetic'; mono(ctx, 24); ctx.fillStyle = T.sub;
  if (center) { ctx.textAlign = 'center'; ctx.fillText(`${FESTIVAL} — ${right}`, 540, D.top + 24); ctx.textAlign = 'left'; return; }
  ctx.textAlign = 'left'; ctx.fillText(FESTIVAL, P, D.top + 24); ctx.textAlign = 'right'; ctx.fillText(right, W - P, D.top + 24); ctx.textAlign = 'left';
}
/** Footer: legend, the "made with" credit for this site, and photo credits. */
function foot(ctx: Ctx, D: Dims, T: Theme, pl: string, credits: string[]) {
  const y = D.H - D.bot + 46; mono(ctx, 22); ctx.fillStyle = T.sub; ctx.textAlign = 'left';
  ctx.fillText(T.mk === 'square' ? '■ MUST   □ MAYBE' : '● MUST   ○ MAYBE', P, y);
  ctx.textAlign = 'right'; ctx.fillStyle = T.fg; ctx.fillText(`${pl ? pl + '   ' : ''}MADE WITH ${SITE}`, W - P, y); ctx.textAlign = 'left';
  if (credits.length) {
    mono(ctx, 15, 400); ctx.fillStyle = T.sub;
    const suffix = credits.includes('Tomorrowland') ? '' : ' — via Wikimedia Commons';
    const L = wrapW(ctx, 'Photos: ' + credits.join(' · ') + suffix, W - 2 * P).slice(0, 3);
    L.forEach((l, i) => ctx.fillText(l, P, y + 34 + i * 21));
  }
}

function rowsPer(D: Dims, ex: ExportOpts) {
  const T = ex.theme; const rowH = T === 'paper' ? 118 : T === 'riso' ? 120 : ex.photo ? 130 : 106;
  const hh = 330 + (T === 'riso' && ex.photo ? 360 : 0);
  return { rowH, hh, n: Math.max(3, Math.floor((D.H - D.top - D.bot - hh - 40) / rowH)) };
}
export function buildPages(ex: ExportOpts, items: Item[]): Item[][] {
  const D = dims(ex);
  if (ex.layout === 'grid') return [items];
  if (ex.layout === 'timeline') {
    const { n } = rowsPer(D, ex); const out: Item[][] = [];
    for (let i = 0; i < items.length; i += n) out.push(items.slice(i, i + n));
    return out.length ? out : [[]];
  }
  const musts = items.filter((i) => i.st === 'must'), rest = items.filter((i) => i.st !== 'must'); const per = 6; const out: Item[][] = [];
  for (let i = 0; i < musts.length; i += per) out.push(musts.slice(i, i + per));
  if (!out.length) out.push([]);
  out[out.length - 1] = out[out.length - 1].concat(rest);
  return out;
}

// ---------- motion ----------
/** Animation clock for a single page (seconds). Omit for a still image. */
export interface Anim { t: number; dur: number }
const easeOut = (x: number) => 1 - Math.pow(1 - x, 3);
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
type Enter = (i: number, fn: () => void, dy?: number) => void;
function makeEnter(ctx: Ctx, anim?: Anim): Enter {
  return (i, fn, dy = 46) => {
    if (!anim) { fn(); return; }
    const p = easeOut(clamp01((anim.t - 0.15 - i * 0.11) / 0.55));
    if (p <= 0) return;
    ctx.save(); ctx.globalAlpha = p; ctx.translate(0, dy * (1 - p)); fn(); ctx.restore();
  };
}
export const pageDuration = (n: number) => Math.min(7, 3.4 + n * 0.25);

export function drawPage(ctx: Ctx, ex: ExportOpts, page: Item[], pi: number, pn: number, day: Day, all: Item[], img: ImgFn, anim?: Anim) {
  const D = dims(ex), T = THEMES[ex.theme], pl = pn > 1 ? `${pi + 1}/${pn}` : '';
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
  const nm = all.filter((i) => i.st === 'must').length, nb = all.filter((i) => i.st === 'maybe').length;
  const headliner = all.filter((i) => i.st === 'must').sort((a, b) => b.s - a.s)[0] || all[0];
  const footer = (label: string, last: number) => enter(last, () => foot(ctx, D, T, label, credits), 0);

  if (ex.layout === 'timeline') {
    const { rowH } = rowsPer(D, ex); let y = D.top + 56;
    if (ex.theme === 'riso') {
      enter(0, () => head(ctx, D, T, day.date, true), 0);
      const s = fitT(ctx, T, day.full, 900, 250, 120, W - 2 * P); const ty = y;
      enter(1, () => { setF(ctx, T, 900, s); ctx.fillStyle = T.acc; ctx.textAlign = 'center'; ctx.fillText(day.full, 540, ty + s * 0.8); ctx.textAlign = 'left'; });
      y += s * 0.8 + 30;
      if (ex.photo && headliner) { const py = y; enter(2, () => photo(ctx, T, useImg(headliner), headliner.name, P, py, W - 2 * P, 330, null, zoom), 0); y += 360; }
      const cy = y; enter(2, () => { mono(ctx, 24); ctx.fillStyle = T.fg; ctx.textAlign = 'center'; ctx.fillText(`● ${nm}   ○ ${nb}${pl ? '   ' + pl : ''}`, 540, cy); ctx.textAlign = 'left'; });
      y += 20;
      page.forEach((it, i) => {
        const ry = y;
        enter(3 + i, () => {
          const up = cs(T, it.name); mono(ctx, 24, 600); ctx.fillStyle = T.fg; ctx.textAlign = 'center'; ctx.fillText(`${it.start} — ${it.stage}`, 540, ry + 34);
          if (it.st === 'must') { fitT(ctx, T, up, 900, 88, 44, W - 2 * P); ctx.fillStyle = T.acc; ctx.fillText(up, 540, ry + 108); }
          else if (it.st === 'maybe') { fitT(ctx, T, up, 800, 76, 40, W - 2 * P); ctx.lineWidth = 2.5; ctx.strokeStyle = T.fg; ctx.strokeText(up, 540, ry + 104); }
          else { fitT(ctx, T, up, 800, 54, 32, W - 2 * P); ctx.fillStyle = T.sub; ctx.fillText(up, 540, ry + 96); }
          ctx.textAlign = 'left';
        });
        y += rowH;
      });
    } else {
      enter(0, () => head(ctx, D, T, pl || day.date), 0);
      const title = ex.theme === 'paper' ? day.cap : day.full; const s = fitT(ctx, T, title, T.dw, 240, 110, W - 2 * P + 12); const ty = y;
      enter(1, () => { setF(ctx, T, T.dw, s); ctx.fillStyle = T.fg; ctx.fillText(title, P - 6, ty + s * 0.78); });
      y += s * 0.8 + 26;
      const my = y;
      enter(2, () => {
        mono(ctx, 26); ctx.fillStyle = T.fg; ctx.fillText(`${day.dow} ${day.d}`, P, my + 20); ctx.textAlign = 'right'; ctx.fillStyle = T.sub;
        ctx.fillText(T.mk === 'square' ? `■ ${nm}  □ ${nb}` : `● ${nm}  ○ ${nb}`, W - P, my + 20); ctx.textAlign = 'left';
        ctx.fillStyle = T.fg; ctx.fillRect(P, my + 44, W - 2 * P, ex.theme === 'paper' ? 2 : 4);
      });
      y += 48;
      page.forEach((it, i) => {
        const sel = it.st !== 'none'; const up = cs(T, it.name); const ry = y;
        enter(3 + i, () => {
          if (ex.theme === 'paper') {
            setF(ctx, T, 800, 58); ctx.fillStyle = sel ? T.fg : T.sub; ctx.fillText(it.start, P, ry + 70);
            const x0 = P + 230; let xr = W - P;
            if (ex.photo) { const ps = rowH - 24; photo(ctx, T, useImg(it), it.name, W - P - ps, ry + 12, ps, ps); xr = W - P - ps - 24; }
            if (sel) mark(ctx, T, x0 + 9, ry + 50, 9, it.st);
            const nx = x0 + (sel ? 32 : 0); fitT(ctx, T, up, 700, 48, 28, xr - nx);
            if (it.st === 'maybe') { ctx.lineWidth = 1.6; ctx.strokeStyle = T.fg; ctx.strokeText(up, nx, ry + 66); } else { ctx.fillStyle = sel ? T.fg : T.sub; ctx.fillText(up, nx, ry + 66); }
            mono(ctx, 20); ctx.fillStyle = T.sub; ctx.fillText(`${it.end} · ${it.stage}`, nx, ry + 98);
          } else {
            mono(ctx, 36, 600); ctx.fillStyle = sel ? T.fg : T.sub; ctx.fillText(it.start, P, ry + 52); mono(ctx, 22, 400); ctx.fillStyle = T.sub; ctx.fillText(it.end, P, ry + 84);
            let x0 = P + 166;
            if (ex.photo) { const ps = rowH - 24; photo(ctx, T, useImg(it), it.name, x0, ry + 12, ps, ps, it.st === 'must' ? 'color' : 'mono'); x0 += ps + 26; }
            const maxW = W - P - x0 - 46;
            if (it.st === 'must') { fitT(ctx, T, up, 800, 78, 40, maxW); ctx.fillStyle = T.fg; ctx.fillText(up, x0, ry + rowH * 0.56); }
            else if (it.st === 'maybe') { fitT(ctx, T, up, 800, 78, 40, maxW); ctx.lineWidth = 2.4; ctx.strokeStyle = T.fg; ctx.strokeText(up, x0, ry + rowH * 0.56); }
            else { fitT(ctx, T, up, 700, 56, 32, maxW); ctx.fillStyle = T.sub; ctx.fillText(up, x0, ry + rowH * 0.52); }
            mono(ctx, 21); ctx.fillStyle = T.sub; ctx.fillText(it.stage, x0, ry + rowH * 0.56 + 36);
            if (sel) mark(ctx, T, W - P - 14, ry + rowH / 2, 12, it.st);
          }
          ctx.fillStyle = T.line; ctx.fillRect(P, ry + rowH - 1, W - 2 * P, 1.5);
        }, 30);
        y += rowH;
      });
    }
    footer(pl, 4 + page.length);
  } else if (ex.layout === 'grid') {
    const riso = ex.theme === 'riso';
    enter(0, () => head(ctx, D, T, day.date, riso), 0);
    let y = D.top + 60; const title = ex.theme === 'paper' ? `${day.cap} ${day.d}` : `${day.dow} ${day.d}`;
    const s = fitT(ctx, T, title, T.dw, 170, 90, W - 2 * P); const ty = y;
    enter(1, () => {
      setF(ctx, T, T.dw, s); ctx.fillStyle = riso ? T.acc : T.fg;
      if (riso) { ctx.textAlign = 'center'; ctx.fillText(title, 540, ty + s * 0.8); ctx.textAlign = 'left'; } else ctx.fillText(title, P - 4, ty + s * 0.8);
    });
    y += s * 0.8 + 30;
    const gx = P + 56, cw = (W - P - gx) / STAGES.length; const hy = y;
    enter(2, () => {
      mono(ctx, 18, 600); STAGES.forEach((st, i) => { ctx.fillStyle = T.fg; ctx.fillText(st.short, gx + i * cw + 6, hy + 18); });
      ctx.fillStyle = T.fg; ctx.fillRect(P, hy + 34, W - 2 * P, 3);
    }, 0);
    y += 48;
    const bottom = D.H - D.bot; let a = 13 * 60, b = 25 * 60;
    if (page.length) { a = Math.floor(Math.min(...page.map((i) => i.s)) / 60) * 60; b = Math.ceil(Math.max(...page.map((i) => i.e)) / 60) * 60; }
    const sc = (bottom - y) / (b - a); const gy = y;
    enter(2, () => {
      for (let h = a; h <= b; h += 60) {
        const yy = gy + (h - a) * sc; ctx.fillStyle = T.line; ctx.fillRect(P, yy, W - 2 * P, 1.5);
        if (h < b) { mono(ctx, 18); ctx.fillStyle = T.sub; ctx.fillText(String(Math.floor(h / 60) % 24).padStart(2, '0'), P, yy + 22); }
      }
    }, 0);
    page.forEach((it, i) => {
      const ci = STAGES.findIndex((s0) => s0.id === it.stageId); const bx = gx + ci * cw + 4, bw = cw - 8, by = gy + (it.s - a) * sc + 3, bh = (it.e - it.s) * sc - 6;
      enter(3 + i * 0.5, () => {
        ctx.save(); ctx.beginPath(); ctx.rect(bx, by, bw, bh); ctx.clip(); let tc = T.fg;
        if (it.st === 'must') { ctx.fillStyle = T.mustFill; ctx.fillRect(bx, by, bw, bh); tc = T.mustInk; }
        else if (it.st === 'maybe') {
          ctx.fillStyle = T.bg; ctx.fillRect(bx, by, bw, bh); ctx.strokeStyle = T.line; ctx.lineWidth = 2;
          for (let k = -bh; k < bw; k += 12) { ctx.beginPath(); ctx.moveTo(bx + k, by + bh); ctx.lineTo(bx + k + bh, by); ctx.stroke(); }
          ctx.setLineDash([12, 8]); ctx.strokeStyle = T.fg; ctx.lineWidth = 5; ctx.strokeRect(bx, by, bw, bh); ctx.setLineDash([]);
        } else { ctx.strokeStyle = T.line; ctx.lineWidth = 2.5; ctx.strokeRect(bx, by, bw, bh); tc = T.sub; }
        let tY = by + 8;
        if (ex.photo && it.st !== 'none' && bh > 200) { const ph = Math.min(bh * 0.48, 170); photo(ctx, T, useImg(it), it.name, bx, by, bw, ph, it.st === 'must' && ex.theme === 'ink' ? 'color' : null); tY = by + ph + 6; }
        ctx.fillStyle = tc; setF(ctx, T, T.nw, 28); const L = wrapW(ctx, cs(T, it.name), bw - 16); let ly = tY + 26;
        L.forEach((l) => { if (ly < by + bh - 24) { fitT(ctx, T, l, T.nw, 28, 18, bw - 16); ctx.fillText(l, bx + 8, ly); ly += 27; } });
        if (ly + 4 < by + bh - 4) { mono(ctx, 17); ctx.fillText(it.start, bx + 8, ly + 4); }
        ctx.restore();
      }, 24);
    });
    footer('', 4 + page.length * 0.5);
  } else {
    const musts = page.filter((i) => i.st === 'must'), maybes = page.filter((i) => i.st === 'maybe'), nones = page.filter((i) => i.st === 'none');
    const lead = musts.slice().sort((a, b) => b.s - a.s)[0]; let y: number;
    let idx = 3;
    if (ex.theme === 'paper') {
      enter(0, () => head(ctx, D, T, day.date), 0);
      y = D.top + 56; const s = fitT(ctx, T, day.cap, 800, 220, 110, W - 2 * P + 10); const ty = y;
      enter(1, () => { setF(ctx, T, 800, s); ctx.fillStyle = T.fg; ctx.fillText(day.cap, P - 6, ty + s * 0.78); });
      y += s * 0.8 + 30;
      if (ex.photo && musts.length) {
        const cols = musts.length === 1 ? 1 : 2, rows = Math.ceil(musts.length / cols), avail = Math.min(D.H * 0.46, rows * 520), th = (avail - (rows - 1) * 8) / rows, tw = (W - 2 * P - (cols - 1) * 8) / cols;
        const y0 = y;
        musts.forEach((it, i) => {
          const cx = P + (i % cols) * (tw + 8), cy = y0 + Math.floor(i / cols) * (th + 8);
          enter(2 + i * 0.6, () => {
            photo(ctx, T, useImg(it), it.name, cx, cy, tw, th, null, zoom); ctx.fillStyle = T.bg; const capH = Math.min(84, th * 0.3); ctx.fillRect(cx, cy + th - capH, tw, capH);
            fitT(ctx, T, it.name, 700, 34, 20, tw - 120); ctx.fillStyle = T.fg; ctx.fillText(it.name, cx + 14, cy + th - capH / 2 + 12);
            mono(ctx, 20); ctx.textAlign = 'right'; ctx.fillText(it.start, cx + tw - 14, cy + th - capH / 2 + 8); ctx.textAlign = 'left';
          }, 30);
        });
        idx = 2 + musts.length * 0.6;
        y += rows * (th + 8) + 30;
      } else {
        musts.forEach((it, i) => {
          const s2 = fitT(ctx, T, it.name, 800, 110, 48, W - 2 * P - 140); const ry = y;
          enter(2 + i, () => { setF(ctx, T, 800, s2); ctx.fillStyle = T.fg; ctx.fillText(it.name, P - 4, ry + s2 * 0.8); mono(ctx, 24); ctx.textAlign = 'right'; ctx.fillText(it.start, W - P, ry + s2 * 0.8); ctx.textAlign = 'left'; });
          y += s2 * 0.92;
        });
        idx = 2 + musts.length;
        y += 20;
      }
      const flow = (arr: Item[], wt: number, size: number, stroke: boolean, col?: string) => {
        if (!arr.length) return;
        setF(ctx, T, wt, size); const txt = arr.map((i) => i.name).join(' · '); const L = wrapW(ctx, txt, W - 2 * P);
        L.forEach((l) => {
          if (y + size < D.H - D.bot) {
            const ry = y;
            enter(idx, () => { setF(ctx, T, wt, size); if (stroke) { ctx.lineWidth = 1.4; ctx.strokeStyle = T.fg; ctx.strokeText(l, P, ry + size * 0.8); } else { ctx.fillStyle = col!; ctx.fillText(l, P, ry + size * 0.8); } });
            idx += 0.5; y += size * 1.02;
          }
        });
        y += 14;
      };
      const ry = y; enter(idx, () => { ctx.fillStyle = T.fg; ctx.fillRect(P, ry, W - 2 * P, 2); }, 0);
      y += 24; flow(maybes, 700, 54, true); flow(nones, 600, 34, false, T.sub);
    } else {
      const center = ex.theme === 'riso';
      if (ex.photo && lead) {
        const hh = ex.format === 'story' ? 1120 : D.top + 560;
        enter(0, () => {
          photo(ctx, T, useImg(lead), lead.name, 0, 0, W, hh, null, zoom);
          const g = ctx.createLinearGradient(0, hh * 0.45, 0, hh); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, T.bg); ctx.fillStyle = g; ctx.fillRect(0, hh * 0.45, W, hh * 0.55 + 2);
        }, 0);
        enter(0.5, () => head(ctx, D, T, `${day.dow} ${day.d}`, center), 0);
        const up = cs(T, lead.name); const s = fitT(ctx, T, up, 900, center ? 250 : 230, 100, W - 2 * P);
        enter(1, () => {
          setF(ctx, T, 900, s); ctx.fillStyle = center ? T.acc : T.fg;
          if (center) {
            ctx.globalCompositeOperation = 'multiply'; ctx.textAlign = 'center'; ctx.fillText(up, 540, hh - 80); ctx.globalCompositeOperation = 'source-over';
            mono(ctx, 28, 600); ctx.fillStyle = T.fg; ctx.fillText(`${lead.start} — ${lead.stage}`, 540, hh - 30); ctx.textAlign = 'left';
          } else { ctx.fillText(up, P - 6, hh - 70); mono(ctx, 28, 600); ctx.fillStyle = T.acc; ctx.fillText(`${lead.start}  ${lead.stage}`, P, hh - 24); }
        }, 60);
        y = hh + 40;
      } else {
        enter(0, () => head(ctx, D, T, day.date, center), 0);
        y = D.top + 60; const s = fitT(ctx, T, day.full, 900, 260, 120, W - 2 * P); const ty = y;
        enter(1, () => { setF(ctx, T, 900, s); ctx.fillStyle = center ? T.acc : T.fg; if (center) { ctx.textAlign = 'center'; ctx.fillText(day.full, 540, ty + s * 0.8); ctx.textAlign = 'left'; } else ctx.fillText(day.full, P - 6, ty + s * 0.8); });
        y += s * 0.8 + 50;
      }
      const rest = musts.filter((i) => !(ex.photo && i === lead)); const avail = D.H - D.bot - y - 10;
      type Op = { t: 'm'; it: Item; up: string; s: number; y: number } | { t: 'b' | 'n'; parts: string[]; s: number; wt: number; y: number };
      const plan = (k: number) => {
        const ops: Op[] = []; let h = 0;
        rest.forEach((it) => { const up = cs(T, it.name); const s = fitT(ctx, T, up, 900, 112 * k, 50 * k, W - 2 * P - 150); ops.push({ t: 'm', it, up, s, y: h + s * 0.8 }); h += s * 0.88 + 4 * k; });
        const flow = (arr: Item[], wt: number, size: number, kind: 'b' | 'n') => {
          if (!arr.length) return; h += 24 * k; setF(ctx, T, wt, size * k);
          const parts = arr.map((i) => cs(T, i.name)); let line: string[] = []; const lines: string[][] = [];
          parts.forEach((p) => { const t = [...line, p].join('  /  '); if (ctx.measureText(t).width > W - 2 * P && line.length) { lines.push(line); line = [p]; } else line.push(p); });
          if (line.length) lines.push(line);
          lines.forEach((l) => { ops.push({ t: kind, parts: l, s: size * k, wt, y: h + size * k * 0.8 }); h += size * k * 0.98; });
        };
        flow(maybes, 800, 62, 'b'); flow(nones, 700, 38, 'n');
        return { ops, h };
      };
      let k = 1, pp = plan(1);
      if (pp.h > avail) { k = Math.max(0.5, avail / pp.h); pp = plan(k); }
      pp.ops.forEach((o, oi) => {
        const yy = y + o.y;
        enter(2 + oi * 0.7, () => {
          if (o.t === 'm') {
            setF(ctx, T, 900, o.s); const nw = ctx.measureText(o.up).width; mono(ctx, 24 * k, 600); const tw = ctx.measureText(o.it.start).width;
            if (center) { const x = 540 - (nw + 16 + tw) / 2; setF(ctx, T, 900, o.s); ctx.fillStyle = T.acc; ctx.fillText(o.up, x, yy); mono(ctx, 24 * k, 600); ctx.fillStyle = T.fg; ctx.fillText(o.it.start, x + nw + 16, yy - o.s * 0.5); }
            else { setF(ctx, T, 900, o.s); ctx.fillStyle = T.fg; ctx.fillText(o.up, P - 4, yy); mono(ctx, 24 * k, 600); ctx.fillStyle = T.acc; ctx.textAlign = 'right'; ctx.fillText(o.it.start, W - P, yy); ctx.textAlign = 'left'; }
          } else {
            setF(ctx, T, o.wt, o.s); const sep = '  /  '; const full = o.parts.join(sep); let x = center ? 540 - ctx.measureText(full).width / 2 : P;
            o.parts.forEach((p, i) => {
              if (o.t === 'b') { ctx.lineWidth = 2.2 * k; ctx.strokeStyle = T.fg; ctx.strokeText(p, x, yy); } else { ctx.fillStyle = T.sub; ctx.fillText(p, x, yy); }
              x += ctx.measureText(p).width;
              if (i < o.parts.length - 1) { ctx.fillStyle = T.sub; ctx.fillText(sep, x, yy); x += ctx.measureText(sep).width; }
            });
          }
        });
      });
      idx = 2 + pp.ops.length * 0.7;
    }
    footer(pl, idx + 1);
  }
}

/** Closing card for videos: makes the "made with tt.h1rose.com" credit explicit. */
export function drawOutro(ctx: Ctx, ex: ExportOpts, day: Day, t: number) {
  const D = dims(ex), T = THEMES[ex.theme];
  ctx.fillStyle = T.bg; ctx.fillRect(0, 0, W, D.H);
  const p = (d: number) => easeOut(clamp01((t - d) / 0.5));
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.save(); ctx.globalAlpha = p(0); mono(ctx, 26); ctx.fillStyle = T.sub; ctx.fillText(`${FESTIVAL} — ${day.dow} ${day.d}`, 540, D.H / 2 - 170); ctx.restore();
  ctx.save(); ctx.globalAlpha = p(0.15); ctx.translate(0, 30 * (1 - p(0.15))); const s = fitT(ctx, T, cs(T, 'My Timetable'), T.dw, 170, 80, W - 2 * P); ctx.fillStyle = T.fg; ctx.fillText(cs(T, 'My Timetable'), 540, D.H / 2 - 20); void s; ctx.restore();
  ctx.save(); ctx.globalAlpha = p(0.4); ctx.fillStyle = T.acc; ctx.fillRect(540 - 60, D.H / 2 + 30, 120, 4); ctx.restore();
  ctx.save(); ctx.globalAlpha = p(0.55); mono(ctx, 26); ctx.fillStyle = T.sub; ctx.fillText('MADE WITH', 540, D.H / 2 + 110); mono(ctx, 52, 600); ctx.fillStyle = T.fg; ctx.fillText(SITE, 540, D.H / 2 + 176); ctx.restore();
  ctx.textAlign = 'left';
}
