import { describe, expect, it } from 'vitest';
import { BY, PERFS, fm } from '../src/lib/data';
import { buildPlan, conflicts, decodeShare, encodeShare, type Sel } from '../src/lib/plan';

describe('data', () => {
  it('spans three days with 159 sets total', () => {
    expect(PERFS.length).toBe(159);
    expect(fm(BY['d1-core-6'].end)).toBe('01:00');
  });
});

describe('conflicts', () => {
  // Goldfish 13:00–14:25 (d1-main-0) vs CLAUDINE 13:00–14:30 (d1-core-0)
  it('flags Must × Must as strong', () => {
    const sel: Sel = { 'd1-main-0': 'must', 'd1-core-0': 'must' };
    const c = conflicts('d1-main-0', sel);
    expect(c).toHaveLength(1);
    expect(c[0].strong).toBe(true);
    expect(fm(c[0].a)).toBe('13:00');
    expect(fm(c[0].b)).toBe('14:25');
  });
  it('flags Must × Maybe as weak, ignores unselected', () => {
    expect(conflicts('d1-main-0', { 'd1-main-0': 'must', 'd1-core-0': 'maybe' })[0].strong).toBe(false);
    expect(conflicts('d1-main-0', { 'd1-main-0': 'must' })).toHaveLength(0);
    expect(conflicts('d1-main-0', {})).toHaveLength(0);
  });
  it('does not cross days', () => {
    expect(conflicts('d1-main-0', { 'd1-main-0': 'must', 'd2-main-0': 'must' })).toHaveLength(0);
  });
});

describe('buildPlan', () => {
  it('clusters overlaps into lanes and merges clash bands', () => {
    const sel: Sel = { 'd1-main-0': 'must', 'd1-core-0': 'must', 'd1-codex-0': 'maybe', 'd2-main-0': 'must' };
    const plan = buildPlan(sel);
    expect(plan.map((d) => d.day)).toEqual(['d1', 'd2']);
    const d1 = plan[0];
    expect(d1.must).toBe(2);
    expect(d1.maybe).toBe(1);
    const cl = d1.segs.find((s) => s.kind === 'cluster');
    expect(cl && cl.kind === 'cluster' && cl.lanes).toBe(3);
    expect(d1.clash).toBe(1);
  });
});

describe('share link', () => {
  it('round-trips', () => {
    const sel: Sel = { 'd1-main-0': 'must', 'd1-core-0': 'maybe' };
    expect(decodeShare('#s=' + encodeURIComponent(encodeShare(sel)))).toEqual(sel);
    expect(decodeShare('#x=1')).toBeNull();
  });
  it('drops unknown ids', () => {
    expect(decodeShare('#s=nope:m,d1-main-0:y')).toEqual({ 'd1-main-0': 'maybe' });
  });
});
