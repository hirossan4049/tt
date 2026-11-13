import { WIKI } from './data';
import type { Photo } from './store';

/**
 * Fetches artist photos from the Wikipedia article's lead image, but only when the file
 * lives on Wikimedia Commons and its license is CC or public domain. Credits are kept
 * for display in the sheet and in exported images.
 */
export async function loadPhotos(cache: Record<string, Photo | null>): Promise<Record<string, Photo | null> | null> {
  const next = { ...cache };
  const todo = Object.keys(WIKI).filter((n) => !(n in next));
  if (!todo.length) return null;
  await Promise.all(
    todo.map(async (n) => {
      try {
        const r = await fetch('https://en.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(WIKI[n]));
        if (r.status === 404) { next[n] = null; return; }
        if (!r.ok) return;
        const j = await r.json();
        const o = j.originalimage;
        const src: string = o && o.source ? String(o.source).split('?')[0] : '';
        if (j.type === 'disambiguation' || !src || !/\/wikipedia\/commons\//.test(src) || /\.(svg|tiff?)$/i.test(src)) { next[n] = null; return; }
        const path = src.split('/wikipedia/commons/')[1];
        const file = path.split('/').pop()!;
        const fname = decodeURIComponent(file);
        const th = (w: number) => (o.width > w ? `https://upload.wikimedia.org/wikipedia/commons/thumb/${path}/${w}px-${file}` : src);
        const mj = await (await fetch(`https://commons.wikimedia.org/w/api.php?action=query&prop=imageinfo&iiprop=extmetadata&titles=${encodeURIComponent('File:' + fname)}&format=json&origin=*`)).json();
        const pg = (Object.values((mj.query || {}).pages || {})[0] || {}) as { imageinfo?: { extmetadata?: Record<string, { value?: string }> }[] };
        const md = (pg.imageinfo && pg.imageinfo[0].extmetadata) || {};
        const lic = ((md.LicenseShortName || {}).value || '').trim();
        if (!lic) return; // metadata hiccup: retry next visit
        if (!/^(cc|public domain|pd)/i.test(lic)) { next[n] = null; return; }
        const artist = ((md.Artist || {}).value || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().slice(0, 48) || 'Unknown';
        next[n] = { ui: th(480), hi: th(1280), credit: artist, license: lic };
      } catch {
        /* offline: retry next visit */
      }
    }),
  );
  return next;
}

/** Downscales a user-picked image into a JPEG data URL (kept in localStorage). */
export function fileToDataUrl(f: File, max = 1100): Promise<string> {
  return new Promise((resolve, reject) => {
    const rd = new FileReader();
    rd.onerror = reject;
    rd.onload = () => {
      const im = new Image();
      im.onerror = reject;
      im.onload = () => {
        const sc = Math.min(1, max / Math.max(im.width, im.height));
        const c = document.createElement('canvas');
        c.width = Math.round(im.width * sc);
        c.height = Math.round(im.height * sc);
        c.getContext('2d')!.drawImage(im, 0, 0, c.width, c.height);
        resolve(c.toDataURL('image/jpeg', 0.85));
      };
      im.src = rd.result as string;
    };
    rd.readAsDataURL(f);
  });
}
