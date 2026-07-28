import { dirname, join } from 'path';
import util from 'node:util';
import { fileURLToPath } from 'url';

if (
  typeof util._extend === 'function' &&
  util._extend !== Object.assign
) {
  Object.defineProperty(util, '_extend', {
    value: Object.assign,
    configurable: true,
    writable: true
  });
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = join(__dirname, '..');
const appBasePath = process.env.NEXT_PUBLIC_APP_BASE_PATH ?? '';
const defaultApiServiceUrl = process.env.NODE_ENV === 'development'
  ? 'http://localhost:5000'
  : '';
const apiServiceUrl = process.env.NEXT_PUBLIC_API_URL ?? defaultApiServiceUrl;
const normalizeBasePath = (value) => {
  if (!value || value === '/') {
    return '';
  }

  return value.endsWith('/') ? value.slice(0, -1) : value;
};
const normalizedBasePath = normalizeBasePath(appBasePath);

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: workspaceRoot,
  transpilePackages: ['@centralprocure/shared'],
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
        destination: `${apiServiceUrl}/health`
      },
      {
        source: '/api/:path*',
        destination: `${apiServiceUrl}/api/:path*`
      }
    ];
  }
};

export default nextConfig;
