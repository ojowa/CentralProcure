'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { InternalRoleRecord } from '../types/internal';
import * as roleService from '../services/roleManagementService';

export interface UseRoleManagementOptions {
  token?: string | null;
  autoLoad?: boolean;
}

export interface UseRoleManagementReturn {
  roles: InternalRoleRecord[];
  isLoading: boolean;
  error: string | null;
  refreshRoles: () => Promise<void>;
  createRole: (data: roleService.CreateRoleRequest) => Promise<void>;
  updateRole: (roleId: string, data: roleService.UpdateRoleRequest) => Promise<void>;
  deactivateRole: (roleId: string) => Promise<void>;
  roleUserCounts: Map<string, number>;
}

export function useRoleManagement(options: UseRoleManagementOptions = {}): UseRoleManagementReturn {
  const { token, autoLoad = true } = options;

  const [roles, setRoles] = useState<InternalRoleRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRoles = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await roleService.fetchRoles(token);
      setRoles(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch roles');
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (autoLoad && token) {
      void fetchRoles();
    }
  }, [autoLoad, token, fetchRoles]);

  const createRole = useCallback(async (data: roleService.CreateRoleRequest) => {
    if (!token) throw new Error('No token available');
    setIsLoading(true);
    try {
      await roleService.createRole(token, data);
      await fetchRoles();
    } finally {
      setIsLoading(false);
    }
  }, [token, fetchRoles]);

  const updateRole = useCallback(async (roleId: string, data: roleService.UpdateRoleRequest) => {
    if (!token) throw new Error('No token available');
    setIsLoading(true);
    try {
      await roleService.updateRole(token, roleId, data);
      await fetchRoles();
    } finally {
      setIsLoading(false);
    }
  }, [token, fetchRoles]);

  const deactivateRole = useCallback(async (roleId: string) => {
    if (!token) throw new Error('No token available');
    setIsLoading(true);
    try {
      await roleService.deactivateRole(token, roleId);
      await fetchRoles();
    } finally {
      setIsLoading(false);
    }
  }, [token, fetchRoles]);

  const roleUserCounts = useMemo(() => {
    const counts = new Map<string, number>();
    // This would typically come from the API, but we calculate it from users
    return counts;
  }, [roles]);

  return {
    roles,
    isLoading,
    error,
    refreshRoles: fetchRoles,
    createRole,
    updateRole,
    deactivateRole,
    roleUserCounts
  };
}
