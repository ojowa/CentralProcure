import type { Metadata } from 'next';

const normalizeBasePath = (value: string): string => {
  if (!value || value === '/') {
    return '';
  }

  return value.endsWith('/') ? value.slice(0, -1) : value;
};

const normalizeSiteUrl = (value: string): string => value.endsWith('/') ? value.slice(0, -1) : value;

const rawSiteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? '';
const normalizedBasePath = normalizeBasePath(process.env.NEXT_PUBLIC_APP_BASE_PATH ?? '');
const normalizedSiteUrl = rawSiteUrl ? normalizeSiteUrl(rawSiteUrl) : '';

export const metadataBase = normalizedSiteUrl ? new URL(normalizedSiteUrl) : undefined;

const normalizeRoutePath = (path: string): string => {
  if (!path || path === '/') {
    return '/';
  }

  return path.startsWith('/') ? path : `/${path}`;
};

export const getCanonicalPath = (path: string): string => {
  const normalizedPath = normalizeRoutePath(path);
  if (!normalizedBasePath) {
    return normalizedPath;
  }

  return normalizedPath === '/' ? normalizedBasePath : `${normalizedBasePath}${normalizedPath}`;
};

export const createCanonicalMetadata = (
  path: string,
  metadata: Metadata = {}
): Metadata => ({
  ...metadata,
  alternates: {
    ...(metadata.alternates ?? {}),
    canonical: getCanonicalPath(path)
  }
});
