import type { NextConfig } from 'next';

// Static export served by Cloudflare Workers static assets at the root of tt.h1rose.com (no basePath).
const nextConfig: NextConfig = {
  output: 'export',
  images: { unoptimized: true },
  trailingSlash: true,
};

export default nextConfig;
