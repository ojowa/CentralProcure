import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appBasePath = process.env.NEXT_PUBLIC_APP_BASE_PATH ?? '';
const backendServiceUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5000';
const normalizeBasePath = (value) => {
  if (!value || value === '/') {
    return '';
  }

  return value.endsWith('/') ? value.slice(0, -1) : value;
};
const normalizedBasePath = normalizeBasePath(appBasePath);

/** @type {import('next').NextConfig} */
const nextConfig = {
  ...(normalizedBasePath ? { basePath: normalizedBasePath, assetPrefix: normalizedBasePath } : {}),
  turbopack: {
    root: __dirname
  },
  pageExtensions: ['tsx', 'ts', 'jsx', 'js'],
  allowedDevOrigins: ['10.169.246.197'],
  async rewrites() {
    return [
      {
        source: '/public/:path*',
        destination: '/:path*'
      },
      {
        source: '/api/:path*',
        destination: `${backendServiceUrl}/api/:path*`
      }
    ];
  }
};

export default nextConfig;
