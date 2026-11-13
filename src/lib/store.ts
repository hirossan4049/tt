'use client';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { IMG, SEED, type DayId, type Status } from './data';
import { IMG_MANIFEST } from './img-manifest';
import type { Sel } from './plan';

export type View = 'tt' | 'my' | 'ex';
export type Layout = 'poster' | 'timeline' | 'grid';
export type ThemeId = 'ink' | 'paper' | 'riso';
export type Content = 'must' | 'mm' | 'all';
export type Format = 'story' | 'wallpaper';
export type Media = 'image' | 'video';

export interface ExportOpts { format: Format; device: string; layout: Layout; content: Content; photo: boolean; day: DayId; theme: ThemeId; media: Media }

export interface Photo { ui: string; hi: string; credit: string; license: string; own?: boolean }

interface PlannerState {
  // persisted
  day: DayId;
  sel: Sel;
  ex: ExportOpts;
  // ui
  view: View;
  side: 'my' | 'ex';
  sheet: string | null;
  focus: string | null;
  pulse: string | null;
  query: string;
  search: boolean;
  page: number;
  toast: string | null;
  /** perf id the grid should scroll to */
  jump: string | null;
  set: (p: Partial<PlannerState>) => void;
  setStatus: (id: string, st: Status) => void;
  setEx: <K extends keyof ExportOpts>(k: K, v: ExportOpts[K]) => void;
}

export const DEFAULT_EX: ExportOpts = { format: 'story', device: 'and', layout: 'poster', content: 'mm', photo: true, day: 'd1', theme: 'ink', media: 'image' };

export const usePlanner = create<PlannerState>()(
  persist(
    (set) => ({
      day: 'd1',
      sel: SEED,
      ex: DEFAULT_EX,
      view: 'tt',
      side: 'my',
      sheet: null,
      focus: null,
      pulse: null,
      query: '',
      search: false,
      page: 0,
      toast: null,
      jump: null,
      set: (p) => set(p),
      setStatus: (id, st) =>
        set((s) => {
          const sel = { ...s.sel };
          if (st === 'none') delete sel[id];
          else sel[id] = st;
          return { sel, focus: id, pulse: id };
        }),
      setEx: (k, v) => set((s) => ({ ex: { ...s.ex, [k]: v }, page: 0 })),
    }),
    {
      name: 'tt.planner.v1',
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (s) => ({ day: s.day, sel: s.sel, ex: s.ex }),
      merge: (persisted, current) => {
        const p = (persisted || {}) as Partial<PlannerState>;
        return { ...current, ...p, ex: { ...DEFAULT_EX, ...(p.ex || {}) } };
      },
    },
  ),
);

/** Artist photos: official lineup API images + user-supplied overrides. */
interface PhotoState {
  user: Record<string, string>;
  setUser: (name: string, url: string) => void;
}
export const usePhotos = create<PhotoState>()(
  persist(
    (set) => ({
      user: {},
      setUser: (name, url) => set((s) => ({ user: { ...s.user, [name]: url } })),
    }),
    { name: 'tt.photos.v2', skipHydration: true, storage: createJSONStorage(() => localStorage), partialize: (s) => ({ user: s.user }) },
  ),
);

const IMG_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif', '.bmp', '.tiff']);
function isImageUrl(url: string) {
  const u = url.split('?')[0].toLowerCase();
  return IMG_EXTS.has(u.slice(u.lastIndexOf('.')));
}

export function photoOf(name: string, st: Pick<PhotoState, 'user'>): Photo | null {
  const u = st.user[name];
  if (u) return { ui: u, hi: u, credit: '', license: '', own: true };
  const m = IMG_MANIFEST[name];
  if (m) return { ui: m.md, hi: m.lg, credit: 'Tomorrowland', license: '', own: false };
  const url = IMG[name];
  if (url && isImageUrl(url)) return { ui: url, hi: url, credit: 'Tomorrowland', license: '', own: false };
  return null;
}

let toastT: ReturnType<typeof setTimeout> | undefined;
export function flash(msg: string) {
  usePlanner.setState({ toast: msg });
  clearTimeout(toastT);
  toastT = setTimeout(() => usePlanner.setState({ toast: null }), 2600);
}
