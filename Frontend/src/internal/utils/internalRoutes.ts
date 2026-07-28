const INTERNAL_DASHBOARD_BASE_PATH = '/internal/dashboard';

const trimTrailingSlash = (value: string): string => {
  if (value.length > 1 && value.endsWith('/')) {
    return value.slice(0, -1);
  }

  return value;
};

export const normalizeModuleRouteSegment = (value: string): string =>
  value.toLowerCase().replace(/[^a-z0-9]/g, '');

const resolveTenderModuleAlias = (moduleId?: string | null): string | null => {
  if (!moduleId) {
    return moduleId ?? null;
  }

  const normalizedModuleId = normalizeModuleRouteSegment(moduleId);
  if (
    normalizedModuleId === normalizeModuleRouteSegment('tender-management') ||
    normalizedModuleId === normalizeModuleRouteSegment('publish-tender') ||
    normalizedModuleId === normalizeModuleRouteSegment('tender-create')
  ) {
    return 'create-tender';
  }

  return moduleId;
};

export const toInternalModuleRouteSegment = (moduleId: string): string =>
  normalizeModuleRouteSegment(resolveTenderModuleAlias(moduleId) ?? moduleId);

export const getInternalDashboardPath = (moduleId?: string | null): string => {
  const resolvedModuleId = resolveTenderModuleAlias(moduleId);

  if (!resolvedModuleId || resolvedModuleId === 'dashboard') {
    return INTERNAL_DASHBOARD_BASE_PATH;
  }

  return `${INTERNAL_DASHBOARD_BASE_PATH}/${toInternalModuleRouteSegment(resolvedModuleId)}`;
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
  if (
    (
      normalizedSegment === normalizeModuleRouteSegment('publish-tender') ||
      normalizedSegment === normalizeModuleRouteSegment('tender-management') ||
      normalizedSegment === normalizeModuleRouteSegment('tender-create')
    ) &&
    moduleIds.includes('create-tender')
  ) {
    return 'create-tender';
  }
  return (
    moduleIds.find((moduleId) => normalizeModuleRouteSegment(moduleId) === normalizedSegment) ?? null
  );
};
