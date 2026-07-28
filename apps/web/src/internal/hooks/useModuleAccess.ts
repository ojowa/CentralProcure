'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { InternalModule } from '../types/internal';
import * as userService from '../services/userManagementService';

export type ModuleAccessMode = 'role' | 'user';

export interface ModuleGrant {
  ModuleId: string;
  IsEnabled: boolean;
}

export interface UseModuleAccessOptions {
  token?: string | null;
  autoLoad?: boolean;
}

export interface UseModuleAccessReturn {
  roleModuleGrants: userService.RoleModuleAccessGrant[];
  userModuleGrants: userService.UserModuleAccessGrant[];
  isLoading: boolean;
  error: string | null;
  refreshGrants: () => Promise<void>;
  updateRoleGrant: (roleName: string, moduleId: string, isEnabled: boolean) => Promise<void>;
  updateUserGrant: (userId: string, moduleId: string, isEnabled: boolean) => Promise<void>;
  deleteRoleGrant: (roleName: string, moduleId: string) => Promise<void>;
  deleteUserGrant: (userId: string, moduleId: string) => Promise<void>;
  bulkUpdateRoleGrants: (roleName: string, grants: ModuleGrant[]) => Promise<void>;
  bulkUpdateUserGrants: (userId: string, grants: ModuleGrant[]) => Promise<void>;
  bulkResetRoleGrants: (roleName: string) => Promise<void>;
  bulkResetUserGrants: (userId: string) => Promise<void>;
  getGrantForModule: (moduleId: string, mode: ModuleAccessMode, targetId: string) => userService.RoleModuleAccessGrant | userService.UserModuleAccessGrant | undefined;
}

export function useModuleAccess(options: UseModuleAccessOptions = {}): UseModuleAccessReturn {
  const { token, autoLoad = true } = options;

  const [roleModuleGrants, setRoleModuleGrants] = useState<userService.RoleModuleAccessGrant[]>([]);
  const [userModuleGrants, setUserModuleGrants] = useState<userService.UserModuleAccessGrant[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchGrants = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    setError(null);
    try {
      const [roleGrants, userGrants] = await Promise.all([
        userService.fetchRoleModuleAccessGrants(token),
        userService.fetchUserModuleAccessGrants(token)
      ]);
      setRoleModuleGrants(roleGrants);
      setUserModuleGrants(userGrants);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch module access grants');
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (autoLoad && token) {
      void fetchGrants();
    }
  }, [autoLoad, token, fetchGrants]);

  const updateRoleGrant = useCallback(async (roleName: string, moduleId: string, isEnabled: boolean) => {
    if (!token) throw new Error('No token available');
    setIsLoading(true);
    try {
      await userService.updateRoleModuleAccessGrant(token, { RoleName: roleName, ModuleId: moduleId, IsEnabled: isEnabled });
      await fetchGrants();
    } finally {
      setIsLoading(false);
    }
  }, [token, fetchGrants]);

  const updateUserGrant = useCallback(async (userId: string, moduleId: string, isEnabled: boolean) => {
    if (!token) throw new Error('No token available');
    setIsLoading(true);
    try {
      await userService.updateUserModuleAccessGrant(token, { InternalUserId: userId, ModuleId: moduleId, IsEnabled: isEnabled });
      await fetchGrants();
    } finally {
      setIsLoading(false);
    }
  }, [token, fetchGrants]);

  const deleteRoleGrant = useCallback(async (roleName: string, moduleId: string) => {
    if (!token) throw new Error('No token available');
    setIsLoading(true);
    try {
      await userService.deleteRoleModuleAccessGrant(token, { RoleName: roleName, ModuleId: moduleId });
      await fetchGrants();
    } finally {
      setIsLoading(false);
    }
  }, [token, fetchGrants]);

  const deleteUserGrant = useCallback(async (userId: string, moduleId: string) => {
    if (!token) throw new Error('No token available');
    setIsLoading(true);
    try {
      await userService.deleteUserModuleAccessGrant(token, { InternalUserId: userId, ModuleId: moduleId });
      await fetchGrants();
    } finally {
      setIsLoading(false);
    }
  }, [token, fetchGrants]);

  const bulkUpdateRoleGrants = useCallback(async (roleName: string, grants: ModuleGrant[]) => {
    if (!token) throw new Error('No token available');
    setIsLoading(true);
    try {
      await userService.bulkUpdateRoleModuleAccessGrants(token, { RoleName: roleName, Grants: grants });
      await fetchGrants();
    } finally {
      setIsLoading(false);
    }
  }, [token, fetchGrants]);

  const bulkUpdateUserGrants = useCallback(async (userId: string, grants: ModuleGrant[]) => {
    if (!token) throw new Error('No token available');
    setIsLoading(true);
    try {
      await userService.bulkUpdateUserModuleAccessGrants(token, { InternalUserId: userId, Grants: grants });
      await fetchGrants();
    } finally {
      setIsLoading(false);
    }
  }, [token, fetchGrants]);

  const bulkResetRoleGrants = useCallback(async (roleName: string) => {
    if (!token) throw new Error('No token available');
    setIsLoading(true);
    try {
      await userService.bulkResetRoleModuleAccessGrants(token, { RoleName: roleName });
      await fetchGrants();
    } finally {
      setIsLoading(false);
    }
  }, [token, fetchGrants]);

  const bulkResetUserGrants = useCallback(async (userId: string) => {
    if (!token) throw new Error('No token available');
    setIsLoading(true);
    try {
      await userService.bulkResetUserModuleAccessGrants(token, { InternalUserId: userId });
      await fetchGrants();
    } finally {
      setIsLoading(false);
    }
  }, [token, fetchGrants]);

  const getGrantForModule = useCallback((moduleId: string, mode: ModuleAccessMode, targetId: string) => {
    if (mode === 'role') {
      return roleModuleGrants.find(g => g.RoleName === targetId && g.ModuleId === moduleId);
    } else {
      return userModuleGrants.find(g => g.InternalUserId === targetId && g.ModuleId === moduleId);
    }
  }, [roleModuleGrants, userModuleGrants]);

  return {
    roleModuleGrants,
    userModuleGrants,
    isLoading,
    error,
    refreshGrants: fetchGrants,
    updateRoleGrant,
    updateUserGrant,
    deleteRoleGrant,
    deleteUserGrant,
    bulkUpdateRoleGrants,
    bulkUpdateUserGrants,
    bulkResetRoleGrants,
    bulkResetUserGrants,
    getGrantForModule
  };
}
