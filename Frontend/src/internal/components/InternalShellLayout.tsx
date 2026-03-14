import React, { useEffect, useState, useCallback } from 'react';
import type { InternalModule, RoleKey } from '../types/internal';
import { InternalHeader } from './InternalHeader';
import { SidebarNav } from './SidebarNav';
import { DashboardPage } from './DashboardPage';
import { AdministrativeReviewModulePage } from './AdministrativeReviewModulePage';
import { AuditDashboardWorkspace } from './AuditDashboardWorkspace';
import { AuditTrailWorkspace } from './AuditTrailWorkspace';
import { ComplianceReportsWorkspace } from './ComplianceReportsWorkspace';
import { PaymentTrackingModulePage } from './PaymentTrackingModulePage';
import { PostAwardInspectionModulePage } from './PostAwardInspectionModulePage';
import { RequisitionOfficerWorkspace } from './RequisitionOfficerWorkspace';
import { WorkflowConfigurationModulePage } from './WorkflowConfigurationModulePage';
import { fetchInternalModules } from '../services/internalAuthService';
import { fetchModuleData } from '../services/moduleService';
import { roleModuleFallbacks, roles } from '../data/internalData';

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

type InternalModuleRendererProps = {
  module: InternalModule;
  moduleData: unknown;
  moduleError: string | null;
  isLoading: boolean;
  token?: string | null;
  role?: RoleKey | null;
  userEmail?: string | null;
  onModuleChange: (moduleId: string) => void;
};

const mergeModulesForRole = (role: RoleKey, modules: InternalModule[]): InternalModule[] => {
  const fallbacks = roleModuleFallbacks[role] ?? [];
  const merged = new Map<string, InternalModule>();

  for (const module of [...fallbacks, ...modules]) {
    const existing = merged.get(module.id);
    if (!existing) {
      merged.set(module.id, {
        ...module,
        actions: [...(module.actions ?? [])],
        allowedRoles: [...(module.allowedRoles ?? [])]
      });
      continue;
    }

    merged.set(module.id, {
      ...existing,
      ...module,
      actions: Array.from(new Set([...(existing.actions ?? []), ...(module.actions ?? [])])),
      allowedRoles: Array.from(new Set([...(existing.allowedRoles ?? []), ...(module.allowedRoles ?? [])]))
    });
  }

  return Array.from(merged.values());
};

const renderGenericModuleWorkspace = ({
  module,
  moduleData,
  moduleError,
  isLoading
}: InternalModuleRendererProps) => {
  return (
    <section className="portal-module">
      <h2>{module.title}</h2>
      <p>{module.description}</p>
      {moduleError ? <div className="portal-alert">{moduleError}</div> : null}
      {isLoading ? <div className="plan-loading">Loading live module data...</div> : null}

      <div className="portal-module-grid" style={{ marginTop: '16px' }}>
        <article className="portal-module-card">
          <h3>Microservice</h3>
          <p>{module.microservice}</p>
        </article>
        <article className="portal-module-card">
          <h3>Control Purpose</h3>
          <p>{module.controlPurpose}</p>
        </article>
        <article className="portal-module-card">
          <h3>Granted Actions</h3>
          <p>{module.actions?.length ? module.actions.join(', ') : 'No workflow actions returned.'}</p>
        </article>
      </div>

      {moduleData ? (
        <pre className="admin-response">{JSON.stringify(moduleData, null, 2)}</pre>
      ) : (
        <div className="plan-empty">No live dataset was returned for this module.</div>
      )}
    </section>
  );
};

const moduleRenderers: Partial<Record<string, (props: InternalModuleRendererProps) => React.ReactNode>> = {
  'create-requisition': (props) => <RequisitionOfficerWorkspace module={props.module} token={props.token} role={props.role} userEmail={props.userEmail} onModuleChange={props.onModuleChange} />,
  'requisition-history': (props) => <RequisitionOfficerWorkspace module={props.module} token={props.token} role={props.role} userEmail={props.userEmail} onModuleChange={props.onModuleChange} />,
  'requisition-tracking': (props) => <RequisitionOfficerWorkspace module={props.module} token={props.token} role={props.role} userEmail={props.userEmail} onModuleChange={props.onModuleChange} />,
  'administrative-review': (props) => <AdministrativeReviewModulePage module={props.module} token={props.token} role={props.role} userEmail={props.userEmail} />,
  'audit-dashboard': (props) => <AuditDashboardWorkspace module={props.module} token={props.token} />,
  'audit-trail-viewer': (props) => <AuditTrailWorkspace module={props.module} token={props.token} />,
  'compliance-reports': (props) => <ComplianceReportsWorkspace module={props.module} token={props.token} />,
  'inspection-acceptance': (props) => <PostAwardInspectionModulePage module={props.module} token={props.token} />,
  'payment-tracking': (props) => <PaymentTrackingModulePage module={props.module} token={props.token} userEmail={props.userEmail} />,
  'workflow-configuration': (props) => (
    <WorkflowConfigurationModulePage
      module={props.module}
      moduleData={props.moduleData}
      moduleError={props.moduleError}
      token={props.token}
    />
  )
};

export const InternalShellLayout = ({ token, userRole, userEmail }: InternalShellProps) => {
  const [accessibleModules, setAccessibleModules] = useState<InternalModule[]>([]);
  const [modulesLoading, setModulesLoading] = useState(false);
  const [modulesError, setModulesError] = useState<string | null>(null);
  const [moduleData, setModuleData] = useState<unknown>(null);
  const [moduleError, setModuleError] = useState<string | null>(null);
  const [isModuleLoading, setIsModuleLoading] = useState(false);
  const [activeModuleId, setActiveModuleId] = useState<string>('dashboard');

  const selectedRole = userRole ?? defaultRole;
  const activeRoleDefinition = roles.find((role) => role.key === selectedRole) ?? roles[0];

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
          setAccessibleModules(mergeModulesForRole(selectedRole, modules));
        }
      })
      .catch((error) => {
        if (isMounted) {
          setAccessibleModules(mergeModulesForRole(selectedRole, []));
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
  }, [selectedRole, token]);

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

  const activeModuleRenderer = activeModule ? moduleRenderers[activeModule.id] : null;

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
            <>
              {(activeModuleRenderer ?? renderGenericModuleWorkspace)({
                module: activeModule,
                moduleData,
                moduleError,
                isLoading: isModuleLoading,
                token,
                role: selectedRole,
                userEmail,
                onModuleChange: setActiveModuleId
              })}
            </>
          ) : null}
        </main>
      </div>
    </div>
  );
};

