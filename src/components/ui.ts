'use client';
import { useCallback } from 'react';
import { photoOf, usePhotos, type Photo } from '@/lib/store';

export const FG = '#f0efea', SUB = 'rgba(240,239,234,.56)', RED = '#ff4a2e', INK = '#0c0c0b';
export const HATCH = 'repeating-linear-gradient(135deg, rgba(240,239,234,.13) 0 1px, transparent 1px 6px), #121211';
export const bgUrl = (ph: Photo | null | undefined, hi = false) => (ph ? `url("${hi ? ph.hi : ph.ui}")` : 'none');

export function usePhotoOf() {
  const user = usePhotos((s) => s.user);
  return useCallback((name: string) => photoOf(name, { user }), [user]);
}

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');
