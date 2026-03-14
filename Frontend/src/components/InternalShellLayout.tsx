import React, { useEffect, useState, useCallback } from 'react';
import type { InternalModule, RoleKey } from '../types/internal';
import { InternalHeader } from './InternalHeader';
import { SidebarNav } from './SidebarNav';
import { DashboardPage } from './DashboardPage';
import { fetchInternalModules } from '../services/internalAuthService';
import { fetchModuleData } from '../services/moduleService';
import { fallbackRoles } from '../data/internalData';

const defaultRole: RoleKey = 'requisitioning_officer';
const moduleFetchSkipList = new Set<string>([
  'dashboard',
  'create-requisition',
  'requisition-history',
  'requisition-tracking',
  'workflow-blueprint',
  'annual-procurement-plan',
  'create-tender',
  'publish-tender',
  'bid-opening-session',
  'bpp-escalation',
  'contract-award',
  'contract-management',
  'inspection-acceptance',
  'evaluation-report',
  'vendor-registration-approval'
]);

interface InternalShellProps {
  token: string | null;
  userRole?: RoleKey | null;
  userEmail?: string | null;
}

export const InternalShellLayout = ({ token, userRole, userEmail }: InternalShellProps) => {
  const [accessibleModules, setAccessibleModules] = useState<InternalModule[]>([]);
  const [modulesLoading, setModulesLoading] = useState(false);
  const [modulesError, setModulesError] = useState<string | null>(null);
  const [moduleData, setModuleData] = useState<unknown>(null);
  const [moduleError, setModuleError] = useState<string | null>(null);
  const [isModuleLoading, setIsModuleLoading] = useState(false);
  const [activeModuleId, setActiveModuleId] = useState<string>('dashboard');

  const selectedRole = userRole ?? defaultRole;
  const activeRoleDefinition = [...roles, ...fallbackRoles].find((role) => role.roleName === selectedRole) ?? fallbackRoles[0];

  const activeModule = accessibleModules.find((module) => module.id === activeModuleId) ?? accessibleModules[0];

  const handleSignOut = useCallback(() => {
    window.location.href = '/internal/login';
  }, []);

  useEffect(() => {
    if (!token) {
      setAccessibleModules([]);
      return;
    }

    let isMounted = true;
    setModulesLoading(true);
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
        }
      });

    return () => {
      isMounted = false;
    };
  }, [token]);

  useEffect(() => {
    if (!token || moduleFetchSkipList.has(activeModuleId)) {
      setIsModuleLoading(false);
      setModuleError(null);
      setModuleData(null);
      return;
    }

    let isMounted = true;
    setIsModuleLoading(true);
    setModuleError(null);

    fetchModuleData(activeModuleId, token)
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
  }, [activeModuleId, token]);

  useEffect(() => {
    if (activeModuleId === 'dashboard') return;
    const moduleStillAccessible = accessibleModules.some((module) => module.id === activeModuleId);
    if (!moduleStillAccessible) {
      setActiveModuleId('dashboard');
    }
  }, [accessibleModules, activeModuleId]);

  // Dynamic ModulePage component resolver (Phase 3 placeholder)
  const ModulePageComponent = React.lazy(() => {
    // Map module.id to component (expand as modules extracted)
    const componentMap: Record<string, () => Promise<{ default: React.ComponentType<any> }>> = {
      // 'requisition-create': () => import('./RequisitionModulePage'), // Phase 3
      // Add more as Phase 3 progresses
    };
    return componentMap[activeModule?.id ?? '']?.() ?? Promise.resolve({ default: () => <div>Module {activeModuleId} loading...</div> });
  });

  return (
    <div className="portal-shell">
      <InternalHeader role={activeRoleDefinition} onSignOut={handleSignOut} />
      <div className="portal-flagband" aria-hidden="true" />
      <div className="portal-content">
        <SidebarNav
          modules={accessibleModules}
          activeModuleId={activeModuleId}
          onModuleChange={setActiveModuleId}
        />
        <main className="portal-main">
          {modulesError ? <div className="portal-alert">{modulesError}</div> : null}
          {modulesLoading ? <div className="plan-loading">Loading role workspace...</div> : null}
          {activeModuleId === 'dashboard' ? <DashboardPage modules={accessibleModules} /> : null}
          {activeModuleId !== 'dashboard' && activeModule ? (
            <React.Suspense fallback={<div>Loading module...</div>}>
              <ModulePageComponent 
                module={activeModule}
                moduleData={moduleData}
                moduleError={moduleError}
                isLoading={isModuleLoading}
                token={token}
                role={selectedRole}
                userEmail={userEmail}
              />
            </React.Suspense>
          ) : null}
        </main>
      </div>
    </div>
  );
};

