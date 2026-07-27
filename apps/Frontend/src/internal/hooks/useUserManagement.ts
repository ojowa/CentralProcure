'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { InternalUserProfile, InternalOrganizationalUnitRecord } from '../types/internal';
import * as userService from '../services/userManagementService';

export interface UseUserManagementOptions {
  token?: string | null;
  autoLoad?: boolean;
}

export interface UseUserManagementReturn {
  users: InternalUserProfile[];
  isLoading: boolean;
  error: string | null;
  refreshUsers: () => Promise<void>;
  updateUser: (userId: string, data: userService.UpdateUserRequest) => Promise<void>;
  updateUserRole: (userId: string, role: string) => Promise<void>;
  updateUserStatus: (userId: string, status: string, isActive: boolean) => Promise<void>;
  resetPassword: (userId: string, newPassword: string, requireChange?: boolean) => Promise<void>;
  deactivateUser: (userId: string) => Promise<void>;
  filteredUsers: InternalUserProfile[];
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  activeCount: number;
  pendingCount: number;
  inactiveCount: number;
}

export function useUserManagement(options: UseUserManagementOptions = {}): UseUserManagementReturn {
  const { token, autoLoad = true } = options;

  const [users, setUsers] = useState<InternalUserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchUsers = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await userService.fetchUsers(token);
      setUsers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch users');
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (autoLoad && token) {
      void fetchUsers();
    }
  }, [autoLoad, token, fetchUsers]);

  const updateUser = useCallback(async (userId: string, data: userService.UpdateUserRequest) => {
    if (!token) throw new Error('No token available');
    setIsLoading(true);
    try {
      await userService.updateUser(token, userId, data);
      await fetchUsers();
    } finally {
      setIsLoading(false);
    }
  }, [token, fetchUsers]);

  const updateUserRole = useCallback(async (userId: string, role: string) => {
    if (!token) throw new Error('No token available');
    setIsLoading(true);
    try {
      await userService.updateUserRole(token, userId, role);
      await fetchUsers();
    } finally {
      setIsLoading(false);
    }
  }, [token, fetchUsers]);

  const updateUserStatus = useCallback(async (userId: string, status: string, isActive: boolean) => {
    if (!token) throw new Error('No token available');
    setIsLoading(true);
    try {
      await userService.updateUserStatus(token, userId, status, isActive);
      await fetchUsers();
    } finally {
      setIsLoading(false);
    }
  }, [token, fetchUsers]);

  const resetPassword = useCallback(async (userId: string, newPassword: string, requireChange = true) => {
    if (!token) throw new Error('No token available');
    setIsLoading(true);
    try {
      await userService.resetUserPassword(token, userId, {
        NewPassword: newPassword,
        RequireChangeOnNextLogin: requireChange
      });
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  const deactivateUser = useCallback(async (userId: string) => {
    if (!token) throw new Error('No token available');
    setIsLoading(true);
    try {
      await userService.deactivateUser(token, userId);
      await fetchUsers();
    } finally {
      setIsLoading(false);
    }
  }, [token, fetchUsers]);

  const filteredUsers = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return users;
    return users.filter(u =>
      u.Email.toLowerCase().includes(q) ||
      u.Username.toLowerCase().includes(q) ||
      u.FirstName.toLowerCase().includes(q) ||
      u.Surname.toLowerCase().includes(q) ||
      u.ServiceNumber.toLowerCase().includes(q)
    );
  }, [users, searchQuery]);

  const activeCount = useMemo(() => users.filter(u => u.Status === 'Active').length, [users]);
  const pendingCount = useMemo(() => users.filter(u => u.Status === 'Pending').length, [users]);
  const inactiveCount = useMemo(() => users.filter(u => u.Status === 'Inactive').length, [users]);

  return {
    users,
    isLoading,
    error,
    refreshUsers: fetchUsers,
    updateUser,
    updateUserRole,
    updateUserStatus,
    resetPassword,
    deactivateUser,
    filteredUsers,
    searchQuery,
    setSearchQuery,
    activeCount,
    pendingCount,
    inactiveCount
  };
}
