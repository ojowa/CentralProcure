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
