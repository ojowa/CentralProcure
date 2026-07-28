'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import * as auditService from '../services/auditAccessService';

export type AuditTargetType = 'role' | 'user' | 'all';

export interface UseAccessAuditOptions {
  token?: string | null;
  autoLoad?: boolean;
  initialLimit?: number;
}

export interface AuditFilters {
  targetType: AuditTargetType;
  targetId?: string;
  moduleId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface UseAccessAuditReturn {
  entries: auditService.ModuleAccessAuditEntry[];
  filteredEntries: auditService.ModuleAccessAuditEntry[];
  isLoading: boolean;
  error: string | null;
  filters: AuditFilters;
  setFilters: (filters: AuditFilters) => void;
  refresh: () => Promise<void>;
  exportToCsv: (filename?: string) => void;
  clearError: () => void;
}

export function useAccessAudit(options: UseAccessAuditOptions = {}): UseAccessAuditReturn {
  const { token, autoLoad = true, initialLimit = 100 } = options;

  const [entries, setEntries] = useState<auditService.ModuleAccessAuditEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<AuditFilters>({
    targetType: 'all',
    targetId: undefined,
    moduleId: undefined,
    dateFrom: undefined,
    dateTo: undefined
  });

  const fetchAudit = useCallback(async () => {
    if (!token) return;

    setIsLoading(true);
    setError(null);

    try {
      const params: auditService.AuditQueryParams = {
        Limit: initialLimit
      };

      if (filters.targetType === 'role' && filters.targetId) {
        params.RoleName = filters.targetId;
      } else if (filters.targetType === 'user' && filters.targetId) {
        params.InternalUserId = filters.targetId;
      }

      const data = await auditService.fetchModuleAccessAudit(token, params);
      setEntries(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch audit entries');
    } finally {
      setIsLoading(false);
    }
  }, [token, filters.targetType, filters.targetId, initialLimit]);

  useEffect(() => {
    if (autoLoad && token) {
      void fetchAudit();
    }
  }, [autoLoad, token, fetchAudit]);

  const filteredEntries = useMemo(() => {
    return entries.filter(entry => {
      if (filters.moduleId && entry.ModuleId !== filters.moduleId) {
        return false;
      }

      if (filters.dateFrom) {
        const entryDate = new Date(entry.ChangedAt);
        const fromDate = new Date(filters.dateFrom);
        if (entryDate < fromDate) return false;
      }

      if (filters.dateTo) {
        const entryDate = new Date(entry.ChangedAt);
        const toDate = new Date(filters.dateTo);
        if (entryDate > toDate) return false;
      }

      return true;
    });
  }, [entries, filters.moduleId, filters.dateFrom, filters.dateTo]);

  const exportToCsv = useCallback((filename?: string) => {
    auditService.downloadAuditCsv(filteredEntries, filename);
  }, [filteredEntries]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    entries,
    filteredEntries,
    isLoading,
    error,
    filters,
    setFilters,
    refresh: fetchAudit,
    exportToCsv,
    clearError
  };
}

export function useAccessAuditWithTarget(
  token: string | null | undefined,
  targetType: 'role' | 'user',
  targetId: string
) {
  const [entries, setEntries] = useState<auditService.ModuleAccessAuditEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAudit = useCallback(async () => {
    if (!token || !targetId) return;

    setIsLoading(true);
    setError(null);

    try {
      const params: auditService.AuditQueryParams = {
        Limit: 100
      };

      if (targetType === 'role') {
        params.RoleName = targetId;
      } else {
        params.InternalUserId = targetId;
      }

      const data = await auditService.fetchModuleAccessAudit(token, params);
      setEntries(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch audit');
    } finally {
      setIsLoading(false);
    }
  }, [token, targetType, targetId]);

  useEffect(() => {
    if (token && targetId) {
      void fetchAudit();
    }
  }, [token, targetId, fetchAudit]);

  const exportToCsv = useCallback((filename?: string) => {
    auditService.downloadAuditCsv(entries, filename);
  }, [entries]);

  return {
    entries,
    isLoading,
    error,
    refresh: fetchAudit,
    exportToCsv,
    clearError: () => setError(null)
  };
}
