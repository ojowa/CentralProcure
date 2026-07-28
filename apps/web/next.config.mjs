import util from 'node:util';

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

const appBasePath = process.env.NEXT_PUBLIC_APP_BASE_PATH ?? '';
const apiServiceUrl = process.env.NEXT_PUBLIC_API_URL || '';
const normalizeBasePath = (value) => {
  if (!value || value === '/') {
    return '';
  }

  return value.endsWith('/') ? value.slice(0, -1) : value;
};
const normalizedBasePath = normalizeBasePath(appBasePath);

/** @type {import('next').NextConfig} */
const nextConfig = {
  ...(normalizedBasePath ? { basePath: normalizedBasePath } : {}),
  pageExtensions: ['tsx', 'ts', 'jsx', 'js'],
  allowedDevOrigins: ['10.169.246.197'],
  async rewrites() {
    const rules = [
      {
        source: '/public/:path*',
        destination: '/:path*'
      }
    ];

    if (apiServiceUrl) {
      rules.push(
        {
          source: '/api/health',
          destination: `${apiServiceUrl}/health`
        },
        {
          source: '/api/:path*',
          destination: `${apiServiceUrl}/api/:path*`
        }
      );
    }

    return rules;
  }
};

export default nextConfig;
