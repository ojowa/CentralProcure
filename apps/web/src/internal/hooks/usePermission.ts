'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { Permission } from '../types/internal';
import { fetchMyPermissions } from '../services/permissionService';

export interface UsePermissionReturn {
  permissions: Permission[];
  permissionKeys: Set<string>;
  isLoading: boolean;
  error: string | null;
  hasPermission: (key: string) => boolean;
  hasAnyPermission: (keys: string[]) => boolean;
  hasAllPermissions: (keys: string[]) => boolean;
  refreshPermissions: () => Promise<void>;
}

export function usePermission(token?: string | null): UsePermissionReturn {
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPermissions = useCallback(async () => {
    if (!token) {
      setPermissions([]);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchMyPermissions(token);
      setPermissions(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load permissions';
      setError(message);
      setPermissions([]);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadPermissions();
  }, [loadPermissions]);

  const permissionKeys = useMemo(
    () => new Set(permissions.map(p => p.PermissionKey)),
    [permissions]
  );

  const hasPermission = useCallback(
    (key: string) => permissionKeys.has(key),
    [permissionKeys]
  );

  const hasAnyPermission = useCallback(
    (keys: string[]) => keys.some(k => permissionKeys.has(k)),
    [permissionKeys]
  );

  const hasAllPermissions = useCallback(
    (keys: string[]) => keys.every(k => permissionKeys.has(k)),
    [permissionKeys]
  );

  return {
    permissions,
    permissionKeys,
    isLoading,
    error,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    refreshPermissions: loadPermissions,
  };
}
