'use client';
import { useCallback } from 'react';
import type { Status } from '@/lib/data';
import { photoOf, usePhotos, type Photo } from '@/lib/store';

export const FG = '#f0efea', SUB = 'rgba(240,239,234,.56)', RED = '#ff4a2e', INK = '#0c0c0b';
export const HATCH = 'repeating-linear-gradient(135deg, rgba(240,239,234,.13) 0 1px, transparent 1px 6px), #121211';
/** Subtle tint that reads as "selected" without the flat white block of a solid fill. */
export const MUST_TINT = 'linear-gradient(160deg, rgba(240,239,234,.16), rgba(240,239,234,.04))';
export const bgUrl = (ph: Photo | null | undefined, hi = false) => (ph ? `url("${hi ? ph.hi : ph.ui}")` : 'none');

/**
 * The one marker shape used everywhere a set's status is shown: a filled dot for "must",
 * a ring for "maybe", nothing for "none". No text, no word — same shape in the grid,
 * My Schedule, the dock and the detail sheet.
 */
export function Marker({ status, size = 8 }: { status: Status; size?: number }) {
  if (status === 'none') return null;
  return (
    <span
      aria-hidden
      className="inline-block flex-none rounded-full"
      style={status === 'must' ? { width: size, height: size, background: FG } : { width: size, height: size, boxShadow: `inset 0 0 0 1.5px ${FG}` }}
    />
  );
}

export function usePhotoOf() {
  const user = usePhotos((s) => s.user);
  return useCallback((name: string) => photoOf(name, { user }), [user]);
}

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');
