const appBasePath = process.env.NEXT_PUBLIC_APP_BASE_PATH ?? '';
const apiServiceUrl = process.env.NEXT_PUBLIC_API_URL || '';
const normalizeBasePath = (value) => {
  if (!value || value === '/') {
    return '';
  }

  return value.endsWith('/') ? value.slice(0, -1) : value;
};
const normalizedBasePath = normalizeBasePath(appBasePath);

const parseAllowedDevOrigins = (raw) =>
  (raw ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

/** @type {import('next').NextConfig} */
const nextConfig = {
  pageExtensions: ['tsx', 'ts', 'jsx', 'js'],
  ...(normalizedBasePath ? { basePath: normalizedBasePath } : {}),
  allowedDevOrigins: parseAllowedDevOrigins(process.env.ALLOWED_DEV_ORIGINS),
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
