'use client';

import { useState, useEffect, useCallback } from 'react';
import { fetchInternalUnits, fetchInternalModulesCatalog } from '../services/internalAuthService';
import type { InternalModule, InternalOrganizationalUnitRecord } from '../types/internal';

type UseInitialDataResult = {
  units: InternalOrganizationalUnitRecord[];
  moduleCatalog: InternalModule[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

export function useInitialData(token?: string | null): UseInitialDataResult {
  const [units, setUnits] = useState<InternalOrganizationalUnitRecord[]>([]);
  const [moduleCatalog, setModuleCatalog] = useState<InternalModule[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    setError(null);
    try {
      const [unitsData, modulesData] = await Promise.all([
        fetchInternalUnits(),
        fetchInternalModulesCatalog(token)
      ]);
      setUnits(unitsData);
      setModuleCatalog(modulesData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load initial data');
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  return { units, moduleCatalog, isLoading, error, refresh: load };
}
