const INTERNAL_DASHBOARD_BASE_PATH = '/internal/dashboard';

const trimTrailingSlash = (value: string): string => {
  if (value.length > 1 && value.endsWith('/')) {
    return value.slice(0, -1);
  }

  return value;
};

export const normalizeModuleRouteSegment = (value: string): string =>
  value.toLowerCase().replace(/[^a-z0-9]/g, '');

export const toInternalModuleRouteSegment = (moduleId: string): string =>
  normalizeModuleRouteSegment(moduleId);

export const getInternalDashboardPath = (moduleId?: string | null): string => {
  if (!moduleId || moduleId === 'dashboard') {
    return INTERNAL_DASHBOARD_BASE_PATH;
  }

  return `${INTERNAL_DASHBOARD_BASE_PATH}/${toInternalModuleRouteSegment(moduleId)}`;
};

export const getInternalDashboardRouteSegment = (pathname?: string | null): string | null => {
  if (!pathname) {
    return null;
  }

  const normalizedPath = trimTrailingSlash(pathname);
  if (normalizedPath === INTERNAL_DASHBOARD_BASE_PATH) {
    return null;
  }

  const prefix = `${INTERNAL_DASHBOARD_BASE_PATH}/`;
  if (!normalizedPath.startsWith(prefix)) {
    return null;
  }

  const remainder = normalizedPath.slice(prefix.length);
  return remainder.split('/')[0] || null;
};

export const resolveModuleIdFromRouteSegment = (
  moduleIds: string[],
  routeSegment?: string | null
): string | null => {
  if (!routeSegment) {
    return 'dashboard';
  }

  const normalizedSegment = normalizeModuleRouteSegment(routeSegment);
  return (
    moduleIds.find((moduleId) => normalizeModuleRouteSegment(moduleId) === normalizedSegment) ?? null
  );
};
