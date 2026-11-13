import type { NextConfig } from 'next';

// Static export for GitHub Pages (served at the root of tt.h1rose.com, so no basePath).
const nextConfig: NextConfig = {
  output: 'export',
  images: { unoptimized: true },
  trailingSlash: true,
};

export default nextConfig;
