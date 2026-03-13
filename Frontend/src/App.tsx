'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardPage, InternalHeader, ModulePage, SidebarNav } from './components/InternalShell';
import { roles } from './data/internalData';
import { InternalModule, RoleKey } from './types/internal';
import { fetchModuleData } from './services/moduleService';
import { fetchInternalModules } from './services/internalAuthService';
import { useAuth } from './hooks/useAuth';

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

const App = () => {
  const { isAuthenticated, isReady, user, token, logout } = useAuth();
  const router = useRouter();
  const [accessibleModules, setAccessibleModules] = useState<InternalModule[]>([]);
  const [modulesLoading, setModulesLoading] = useState(false);
  const [modulesError, setModulesError] = useState<string | null>(null);
  const [moduleData, setModuleData] = useState<unknown>(null);
  const [moduleError, setModuleError] = useState<string | null>(null);
  const [isModuleLoading, setIsModuleLoading] = useState(false);
  const selectedRole = user?.role ?? defaultRole;

  const [activeModuleId, setActiveModuleId] = useState<string>('dashboard');

  const activeRoleDefinition = roles.find((role) => role.key === selectedRole) ?? roles[0];

  const activeModule = accessibleModules.find((module) => module.id === activeModuleId) ?? accessibleModules[0];

  const handleSignOut = () => {
    logout();
    setActiveModuleId('dashboard');
    setAccessibleModules([]);
    setModulesError(null);
    setModuleData(null);
    setModuleError(null);
  };

  useEffect(() => {
    if (!isAuthenticated || !token) {
      setAccessibleModules([]);
      setModulesLoading(false);
      setModulesError(null);
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
  }, [isAuthenticated, token]);

  useEffect(() => {
    if (!isAuthenticated || !token || moduleFetchSkipList.has(activeModuleId)) {
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
  }, [isAuthenticated, activeModuleId, token]);

  useEffect(() => {
    if (isReady && !isAuthenticated) {
      router.replace('/internal/login');
    }
  }, [isAuthenticated, isReady, router]);

  useEffect(() => {
    if (activeModuleId === 'dashboard') {
      return;
    }

    const moduleStillAccessible = accessibleModules.some((module) => module.id === activeModuleId);
    if (!moduleStillAccessible) {
      setActiveModuleId('dashboard');
    }
  }, [accessibleModules, activeModuleId]);

  if (!isReady || !isAuthenticated) {
    return null;
  }

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
            <ModulePage
              module={activeModule}
              moduleData={moduleData}
              moduleError={moduleError}
              isLoading={isModuleLoading}
              token={token}
              role={user?.role}
              userEmail={user?.email}
            />
          ) : null}
        </main>
      </div>
    </div>
  );
};

export default App;
