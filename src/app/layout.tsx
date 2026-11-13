import type { Metadata, Viewport } from 'next';
import '@fontsource/big-shoulders-display/700';
import '@fontsource/big-shoulders-display/800';
import '@fontsource/big-shoulders-display/900';
import '@fontsource/archivo/500';
import '@fontsource/archivo/600';
import '@fontsource/archivo/700';
import '@fontsource/archivo/800';
import '@fontsource/ibm-plex-mono/400';
import '@fontsource/ibm-plex-mono/500';
import '@fontsource/ibm-plex-mono/600';
import '@fontsource/noto-sans-jp/400';
import '@fontsource/noto-sans-jp/500';
import '@fontsource/noto-sans-jp/700';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://tt.h1rose.com'),
  title: 'TT — Tomorrowland Thailand 2026 Timetable Planner',
  description: '見たいセットを Must / Maybe で選んで、自分だけのタイムテーブルを Story 画像・動画で書き出し。非公式ファンメイドツール。',
  openGraph: { title: 'TT — Timetable Planner', description: 'Tomorrowland Thailand 2026 のマイタイムテーブルを作って Story に。', url: 'https://tt.h1rose.com', siteName: 'tt.h1rose.com', type: 'website' },
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#0c0c0b' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
