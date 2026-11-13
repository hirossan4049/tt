import { BY, DAYS, K, PERFS, type DayId, type Perf, type Status } from './data';

export type Sel = Record<string, Exclude<Status, 'none'>>;

export interface Conflict { q: Perf; strong: boolean; a: number; b: number }

/** Selected sets on the same day that overlap `id`. `strong` = Must × Must. */
export function conflicts(id: string, sel: Sel): Conflict[] {
  const p = BY[id];
  const s = sel[id];
  if (!p || !s) return [];
  return PERFS.filter((q) => q.id !== id && q.day === p.day && sel[q.id] && q.start < p.end && p.start < q.end).map((q) => ({
    q,
    strong: s === 'must' && sel[q.id] === 'must',
    a: Math.max(p.start, q.start),
    b: Math.min(p.end, q.end),
  }));
}

export interface Band { s: number; e: number; strong: boolean }
export interface ClusterItem { p: Perf; lane: number }
export interface Cluster { start: number; end: number; lanes: number; items: ClusterItem[]; bands: Band[]; h: number }
export interface DayPlan { day: DayId; must: number; maybe: number; clash: number; segs: ({ kind: 'gap'; gap: number } | ({ kind: 'cluster' } & Cluster))[] }

/** Groups each day's selected sets into overlapping clusters with lanes and merged clash bands. */
export function buildPlan(sel: Sel): DayPlan[] {
  const ids = Object.keys(sel).filter((id) => BY[id]);
  return DAYS.map((d) => {
    const items = ids.map((id) => BY[id]).filter((p) => p.day === d.id).sort((a, b) => a.start - b.start || a.end - b.end);
    if (!items.length) return null;
    const clusters: { start: number; end: number; items: Perf[] }[] = [];
    items.forEach((p) => {
      const c = clusters[clusters.length - 1];
      if (c && p.start < c.end) { c.items.push(p); c.end = Math.max(c.end, p.end); }
      else clusters.push({ start: p.start, end: p.end, items: [p] });
    });
    let clash = 0;
    const segs: DayPlan['segs'] = [];
    clusters.forEach((c, ci) => {
      if (ci) { const g = c.start - clusters[ci - 1].end; if (g > 0) segs.push({ kind: 'gap', gap: g }); }
      const lanes: number[] = [];
      const lane: Record<string, number> = {};
      c.items.forEach((p) => {
        let i = lanes.findIndex((e) => e <= p.start);
        if (i < 0) { i = lanes.length; lanes.push(0); }
        lanes[i] = p.end; lane[p.id] = i;
      });
      const raw: Band[] = [];
      for (let i = 0; i < c.items.length; i++)
        for (let j = i + 1; j < c.items.length; j++) {
          const a = c.items[i], b = c.items[j];
          const s0 = Math.max(a.start, b.start), e0 = Math.min(a.end, b.end);
          if (e0 > s0) raw.push({ s: s0, e: e0, strong: sel[a.id] === 'must' && sel[b.id] === 'must' });
        }
      raw.sort((x, y) => x.s - y.s);
      const merged: Band[] = [];
      raw.forEach((r) => {
        const m = merged[merged.length - 1];
        if (m && r.s <= m.e) { m.e = Math.max(m.e, r.e); m.strong = m.strong || r.strong; } else merged.push({ ...r });
      });
      clash += merged.length;
      segs.push({ kind: 'cluster', start: c.start, end: c.end, lanes: lanes.length, items: c.items.map((p) => ({ p, lane: lane[p.id] })), bands: merged, h: Math.max(64, (c.end - c.start) * K) });
    });
    return { day: d.id, must: items.filter((p) => sel[p.id] === 'must').length, maybe: items.filter((p) => sel[p.id] === 'maybe').length, clash, segs };
  }).filter((x): x is DayPlan => !!x);
}

/** Share-link codec: `#s=d1-main-3:m,d1-core-3:y` */
export function encodeShare(sel: Sel): string {
  return Object.keys(sel).filter((id) => BY[id]).map((id) => `${id}:${sel[id] === 'must' ? 'm' : 'y'}`).join(',');
}
export function decodeShare(hash: string): Sel | null {
  const m = hash.match(/[#&]s=([^&]+)/);
  if (!m) return null;
  const o: Sel = {};
  try {
    decodeURIComponent(m[1]).split(',').forEach((t) => {
      const [id, v] = t.split(':');
      if (BY[id]) o[id] = v === 'm' ? 'must' : 'maybe';
    });
  } catch { return null; }
  return o;
}
