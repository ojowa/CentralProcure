import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const appBasePath = process.env.NEXT_PUBLIC_APP_BASE_PATH ?? '';
const defaultBackendServiceUrl =
  process.env.NODE_ENV === 'development'
    ? 'http://127.0.0.1:5080'
    : 'https://centralprocure-backend.onrender.com';
const backendServiceUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? defaultBackendServiceUrl;
const normalizeBasePath = (value) => {
  if (!value || value === '/') {
    return '';
  }

  return value.endsWith('/') ? value.slice(0, -1) : value;
};
const normalizedBasePath = normalizeBasePath(appBasePath);

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: join(__dirname),
  ...(normalizedBasePath ? { basePath: normalizedBasePath } : {}),
  pageExtensions: ['tsx', 'ts', 'jsx', 'js'],
  allowedDevOrigins: ['10.169.246.197'],
  async rewrites() {
    return [
      {
        source: '/public/:path*',
        destination: '/:path*'
      },
      {
        source: '/api/health',
        destination: `${backendServiceUrl}/health`
      },
      {
        source: '/api/:path*',
        destination: `${backendServiceUrl}/api/:path*`
      }
    ];
  }
};

export default nextConfig;
