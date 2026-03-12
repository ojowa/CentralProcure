const normalizeBasePath = (value: string): string => {
  if (!value || value === '/') {
    return '';
  }

  return value.endsWith('/') ? value.slice(0, -1) : value;
};

export const APP_BASE_PATH = normalizeBasePath(
  process.env.NEXT_PUBLIC_APP_BASE_PATH ?? ''
);

export const PUBLIC_BASE_PATH = normalizeBasePath(`${APP_BASE_PATH}/public`);

export const withAppBasePath = (path: string): string => `${APP_BASE_PATH}${path}`;

export const withPublicBasePath = (path: string): string => `${PUBLIC_BASE_PATH}${path}`;
