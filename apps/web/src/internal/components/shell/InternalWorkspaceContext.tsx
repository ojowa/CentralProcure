'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import type { InternalModule, InternalRoleRecord, RoleDefinition, RoleKey } from '../../types/internal';
import { useAuth } from '../../hooks/useAuth';
import { fetchInternalModules, fetchInternalRoles, fetchInternalUserProfile, resolveCanonicalRole } from '../../services/internalAuthService';
import { fetchModuleData } from '../../services/moduleService';
import {
  getInternalDashboardPath,
  getInternalDashboardRouteSegment,
  resolveModuleIdFromRouteSegment
} from '../../utils/internalRoutes';

const shouldSkipModuleFetch = (module: InternalModule | null): boolean => {
  if (!module) {
    return true;
  }

  if (module.hasDataset === false) {
    return true;
  }

  return !module.hasDataset && module.datasetUrl == null;
};

const formatRoleName = (value: string): string =>
  value
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim();

const mapRoleRecordToDefinition = (roleRecord: InternalRoleRecord): RoleDefinition | null => {
  const key = resolveCanonicalRole(roleRecord.CanonicalRoleKey, roleRecord.RoleName);
  if (!key) {
    return null;
  }

  return {
    key,
    name: roleRecord.RoleName ? formatRoleName(roleRecord.RoleName) : 'Role',
    description: roleRecord.Description?.trim() || ''
  };
};

type WorkspaceContextValue = {
  token: string;
  userRole: RoleKey | null;
  userEmail: string | null;
  modules: InternalModule[];
  modulesLoading: boolean;
  modulesError: string | null;
  activeModuleId: string | null;
  activeModule: InternalModule | null;
  moduleData: unknown;
  moduleError: string | null;
  isModuleLoading: boolean;
  availableRoles: RoleDefinition[];
  headerRoleDefinition: RoleDefinition;
  recordRoleName: string | undefined;
  selectedRole: RoleKey | null;
  availableModuleIds: string[];
  handleModuleChange: (moduleId: string) => void;
  handleSignOut: () => void;
};

const WorkspaceContext = createContext<WorkspaceContextValue | undefined>(undefined);

export const useWorkspace = (): WorkspaceContextValue => {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error('useWorkspace must be used within an InternalWorkspaceProvider');
  }

  return context;
};

export const InternalWorkspaceProvider = ({ children }: { children: ReactNode }) => {
  const pathname = usePathname();
  const router = useRouter();
  const { logout, token, user } = useAuth();
  const [accessibleModules, setAccessibleModules] = useState<InternalModule[]>([]);
  const [availableRoles, setAvailableRoles] = useState<RoleDefinition[]>([]);
  const [headerRoleOverride, setHeaderRoleOverride] = useState<RoleDefinition | null>(null);
  const [profileRoleKey, setProfileRoleKey] = useState<RoleKey | null>(user?.role ?? null);
  const [profileRoleNameRaw, setProfileRoleNameRaw] = useState<string | null>(null);
  const [modulesLoading, setModulesLoading] = useState(false);
  const [hasResolvedModules, setHasResolvedModules] = useState(false);
  const [modulesError, setModulesError] = useState<string | null>(null);
  const [moduleData, setModuleData] = useState<unknown>(null);
  const [moduleError, setModuleError] = useState<string | null>(null);
  const [isModuleLoading, setIsModuleLoading] = useState(false);

  const userEmail = user?.email ?? null;
  const selectedRole = profileRoleKey ?? user?.role ?? null;
  const activeRoleDefinition = selectedRole
    ? (availableRoles.find((role) => role.key === selectedRole) ?? null)
    : null;
  const recordRoleName = activeRoleDefinition?.name ?? (profileRoleNameRaw ? formatRoleName(profileRoleNameRaw) : undefined);
  const headerRoleDefinition = headerRoleOverride ?? activeRoleDefinition ?? {
    key: user?.role ?? 'ict_admin',
    name: profileRoleNameRaw ? formatRoleName(profileRoleNameRaw) : 'Role Unavailable',
    description: profileRoleNameRaw
      ? 'Resolved from API profile (custom role label).'
      : 'Unable to resolve your current role.'
  };

  const routeSegment = useMemo(
    () => getInternalDashboardRouteSegment(pathname),
    [pathname]
  );
  const activeModuleId = useMemo(
    () => resolveModuleIdFromRouteSegment(accessibleModules.map((module) => module.id), routeSegment),
    [accessibleModules, routeSegment]
  );
  const activeModule = useMemo(() => {
    if (!activeModuleId || activeModuleId === 'dashboard') {
      return null;
    }

    return accessibleModules.find((module) => module.id === activeModuleId) ?? null;
  }, [accessibleModules, activeModuleId]);

  const handleModuleChange = useCallback(
    (moduleId: string) => {
      router.push(getInternalDashboardPath(moduleId));
    },
    [router]
  );

  const handleSignOut = useCallback(() => {
    logout();
    router.replace('/internal/login');
  }, [logout, router]);

  useEffect(() => {
    let isMounted = true;

    fetchInternalRoles()
      .then((roleRecords) => {
        if (!isMounted) {
          return;
        }

        const mappedRoles = roleRecords
          .filter((roleRecord) => roleRecord.IsActive)
          .map(mapRoleRecordToDefinition)
          .filter((role): role is RoleDefinition => Boolean(role) && Boolean(role?.key));

        if (!mappedRoles.length) {
          setAvailableRoles([]);
          return;
        }

        const dedupedRoles = Array.from(
          mappedRoles.reduce((map, role) => {
            if (!map.has(role.key)) {
              map.set(role.key, role);
            }

            return map;
          }, new Map<RoleKey, RoleDefinition>())
            .values()
        );

        setAvailableRoles(dedupedRoles);
      })
      .catch(() => {
        if (isMounted) {
          setAvailableRoles([]);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!token) {
      setHeaderRoleOverride(null);
      setProfileRoleKey(user?.role ?? null);
      setProfileRoleNameRaw(null);
      return;
    }

    let isMounted = true;

    fetchInternalUserProfile(token)
      .then((profile) => {
        if (!isMounted) return;

        setProfileRoleNameRaw(profile.RoleName ?? null);
        const resolvedKey = resolveCanonicalRole(profile.CanonicalRoleKey, profile.RoleName);
        if (!resolvedKey) {
          setHeaderRoleOverride(null);
          setProfileRoleKey(user?.role ?? null);
          return;
        }

        const resolvedDefinition =
          availableRoles.find((role) => role.key === resolvedKey) ?? null;

        setHeaderRoleOverride(resolvedDefinition);
        setProfileRoleKey(resolvedKey);
      })
      .catch(() => {
        if (isMounted) {
          setHeaderRoleOverride(null);
          setProfileRoleKey(user?.role ?? null);
          setProfileRoleNameRaw(null);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [availableRoles, token, user?.role]);

  useEffect(() => {
    if (!token) {
      setAccessibleModules([]);
      setHasResolvedModules(false);
      return;
    }

    let isMounted = true;
    setModulesLoading(true);
    setHasResolvedModules(false);
    setModulesError(null);

    fetchInternalModules(token)
      .then((modules) => {
        if (isMounted) {
          setAccessibleModules(modules);
        }
      })
      .catch((error) => {
        if (isMounted) {
          setAccessibleModules([]);
          setModulesError(error instanceof Error ? error.message : 'Failed to load role modules.');
        }
      })
      .finally(() => {
        if (isMounted) {
          setModulesLoading(false);
          setHasResolvedModules(true);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [selectedRole, token]);

  useEffect(() => {
    if (!token || !activeModuleId || shouldSkipModuleFetch(activeModule)) {
      setIsModuleLoading(false);
      setModuleError(null);
      setModuleData(null);
      return;
    }

    let isMounted = true;
    setIsModuleLoading(true);
    setModuleError(null);

    fetchModuleData(activeModuleId, token, activeModule?.datasetUrl)
      .then((data) => {
        if (isMounted) {
          setModuleData(data);
        }
      })
      .catch((error) => {
        if (isMounted) {
          setModuleError(error instanceof Error ? error.message : 'Failed to load module data.');
          setModuleData(null);
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsModuleLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [activeModule, activeModuleId, token]);

  useEffect(() => {
    if (!token || !routeSegment || modulesLoading || !hasResolvedModules) {
      return;
    }

    if (!resolveModuleIdFromRouteSegment(accessibleModules.map((module) => module.id), routeSegment)) {
      router.replace(getInternalDashboardPath());
    }
  }, [accessibleModules, hasResolvedModules, modulesLoading, routeSegment, router, token]);

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      token,
      userRole: user?.role ?? null,
      userEmail,
      modules: accessibleModules,
      modulesLoading,
      modulesError,
      activeModuleId,
      activeModule,
      moduleData,
      moduleError,
      isModuleLoading,
      availableRoles,
      headerRoleDefinition,
      recordRoleName,
      selectedRole,
      availableModuleIds: accessibleModules.map((module) => module.id),
      handleModuleChange,
      handleSignOut
    }),
    [
      token,
      user?.role,
      userEmail,
      accessibleModules,
      modulesLoading,
      modulesError,
      activeModuleId,
      activeModule,
      moduleData,
      moduleError,
      isModuleLoading,
      availableRoles,
      headerRoleDefinition,
      recordRoleName,
      selectedRole,
      handleModuleChange,
      handleSignOut
    ]
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
};
