import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import type { InternalModule, InternalRoleRecord, RoleDefinition, RoleKey } from '../types/internal';
import { InternalHeader } from './InternalHeader';
import { SidebarNav } from './SidebarNav';
import { DashboardPage } from './DashboardPage';
import { AdministrativeReviewModulePage } from './AdministrativeReviewModulePage';
import { AuditDashboardWorkspace } from './AuditDashboardWorkspace';
import { UserRoleManagementModule } from './UserRoleManagementModule';
import { AuditTrailWorkspace } from './AuditTrailWorkspace';
import { ComplianceReportsWorkspace } from './ComplianceReportsWorkspace';
import { PaymentTrackingModulePage } from './PaymentTrackingModulePage';
import { PostAwardInspectionModulePage } from './PostAwardInspectionModulePage';
import { BudgetOfficerWorkspacePage } from './BudgetOfficerWorkspacePage';
import { WorkflowBlueprintPage } from './WorkflowBlueprintPage';
import { CreateRequisitionPage } from './CreateRequisitionPage';
import { RequisitionHistoryPage } from './RequisitionHistoryPage';
import { RequisitionTrackingPage } from './RequisitionTrackingPage';
import { ProfilePage } from './ProfilePage';
import { WorkflowConfigurationModulePage } from './WorkflowConfigurationModulePage';
import { ProcurementPlanModule } from './ProcurementPlanModule';
import { PlanningCommitteeReviewModule } from './PlanningCommitteeReviewModule';
import { TenderManagementModule } from './TenderManagementModule';
import { EvaluationScoringModule } from './EvaluationScoringModule';
import { BidOpeningModule } from './BidOpeningModule';
import { TendersBoardApprovalModule } from './TendersBoardApprovalModule';
import { CgisApprovalModule } from './CgisApprovalModule';
import { ContractManagementModule } from './ContractManagementModule';
import { BppEscalationModule } from './BppEscalationModule';
import { AdministrativeReviewModule } from './AdministrativeReviewModule';
import { VendorRegistrationApprovalModule } from './VendorRegistrationApprovalModule';
import { AdminRequisitionManagementPage } from './AdminRequisitionManagementPage';
import { fetchInternalModules, fetchInternalRoles, resolveRole } from '../services/internalAuthService';
import { fetchModuleData } from '../services/moduleService';
import { roleModuleFallbacks, roles } from '../data/internalData';
import { useAuth } from '../hooks/useAuth';
import {
  getInternalDashboardPath,
  getInternalDashboardRouteSegment,
  resolveModuleIdFromRouteSegment
} from '../utils/internalRoutes';

const defaultRole: RoleKey = 'requisitioning_officer';
const moduleFetchSkipList = new Set<string>([
  'dashboard',
  'create-requisition',
  'requisition-history',
  'requisition-tracking',
  'requisition-management',
  'workflow-blueprint',
  'annual-procurement-plan',
  'budget-confirmation',
  'create-tender',
  'publish-tender',
  'bid-opening-session',
  'bpp-escalation',
  'contract-award',
  'contract-management',
  'inspection-acceptance',
  'evaluation-report',
  'vendor-registration-approval',
  'user-profile'
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
  token: string | null;
  role: RoleKey | null;
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
  'create-requisition': (props) => <CreateRequisitionPage module={props.module} token={props.token} role={props.role} userEmail={props.userEmail} onModuleChange={props.onModuleChange} />,
  'requisition-history': (props) => <RequisitionHistoryPage module={props.module} token={props.token} role={props.role} userEmail={props.userEmail} onModuleChange={props.onModuleChange} />,
  'requisition-tracking': (props) => <RequisitionTrackingPage module={props.module} token={props.token} role={props.role} userEmail={props.userEmail} onModuleChange={props.onModuleChange} />,
  'requisition-management': (props) => (
    <AdminRequisitionManagementPage
      module={props.module}
      token={props.token}
      role={props.role}
      userEmail={props.userEmail}
      onModuleChange={props.onModuleChange}
    />
  ),
  'audit-dashboard': (props) => <AuditDashboardWorkspace module={props.module} token={props.token} />,
  'audit-trail-viewer': (props) => <AuditTrailWorkspace module={props.module} token={props.token} />,
  'compliance-reports': (props) => <ComplianceReportsWorkspace module={props.module} token={props.token} />,
  'inspection-acceptance': (props) => <PostAwardInspectionModulePage module={props.module} token={props.token} />,
  'payment-tracking': (props) => <PaymentTrackingModulePage module={props.module} token={props.token} userEmail={props.userEmail} />,
  'contract-management': (props) => <ContractManagementModule module={props.module} token={props.token} role={props.role} initialData={props.moduleData} />,
  'bpp-escalation': (props) => <BppEscalationModule module={props.module} token={props.token} role={props.role} initialData={props.moduleData} />,
  'administrative-review': (props) => <AdministrativeReviewModulePage module={props.module} token={props.token} role={props.role} userEmail={props.userEmail} />,
  'workflow-blueprint': (props) => <WorkflowBlueprintPage module={props.module} token={props.token} />,
  'annual-procurement-plan': (props) => <ProcurementPlanModule module={props.module} token={props.token} role={props.role} initialData={props.moduleData} />,
  'procurement-planning-committee': (props) => (
    <PlanningCommitteeReviewModule 
      module={props.module} 
      token={props.token} 
      role={props.role} 
      userEmail={props.userEmail}
      initialData={props.moduleData} 
    />
  ),
  'budget-confirmation': (props) => <BudgetOfficerWorkspacePage module={props.module} token={props.token} role={props.role} />,
  'create-tender': (props) => <TenderManagementModule module={props.module} token={props.token} role={props.role} initialData={props.moduleData} />,
  'publish-tender': (props) => <TenderManagementModule module={props.module} token={props.token} role={props.role} initialData={props.moduleData} />,
  'technical-evaluation': (props) => <EvaluationScoringModule module={props.module} token={props.token} role={props.role} initialData={props.moduleData} />,
  'financial-evaluation': (props) => <EvaluationScoringModule module={props.module} token={props.token} role={props.role} initialData={props.moduleData} />,
  'user-role-management': (props) => <UserRoleManagementModule module={props.module} token={props.token} />,
  'bid-opening-session': (props) => <BidOpeningModule module={props.module} token={props.token} role={props.role} initialData={props.moduleData} />,
  'tenders-board-approval': (props) => <TendersBoardApprovalModule module={props.module} token={props.token} role={props.role} initialData={props.moduleData} />,
  'cgis-approval': (props) => (
    <CgisApprovalModule
      module={props.module}
      token={props.token}
      role={props.role}
      userEmail={props.userEmail}
    />
  ),
  'workflow-configuration': (props) => (
    <WorkflowConfigurationModulePage
      module={props.module}
      moduleData={props.moduleData}
      moduleError={props.moduleError}
      token={props.token}
    />
  ),
  'vendor-registration-approval': (props) => (
    <VendorRegistrationApprovalModule
      module={props.module}
      token={props.token}
      role={props.role}
      userEmail={props.userEmail}
    />
  ),
  'user-profile': (props) => (
    <ProfilePage
      module={props.module}
      token={props.token}
      userEmail={props.userEmail}
    />
  )
};

const formatRoleName = (value: string): string =>
  value
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim();

const roleFallbackByKey = new Map<RoleKey, RoleDefinition>(roles.map((role) => [role.key, role]));

const mapRoleRecordToDefinition = (roleRecord: InternalRoleRecord): RoleDefinition | null => {
  const key = resolveRole(roleRecord.RoleName);
  if (!key) {
    return null;
  }

  const fallbackRole = roleFallbackByKey.get(key);

  return {
    key,
    name: fallbackRole?.name ?? formatRoleName(roleRecord.RoleName),
    description: roleRecord.Description?.trim() || fallbackRole?.description || ''
  };
};

export const InternalShellLayout = ({ token, userRole, userEmail }: InternalShellProps) => {
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useAuth();
  const [accessibleModules, setAccessibleModules] = useState<InternalModule[]>([]);
  const [availableRoles, setAvailableRoles] = useState<RoleDefinition[]>(roles);
  const [modulesLoading, setModulesLoading] = useState(false);
  const [hasResolvedModules, setHasResolvedModules] = useState(false);
  const [modulesError, setModulesError] = useState<string | null>(null);
  const [moduleData, setModuleData] = useState<unknown>(null);
  const [moduleError, setModuleError] = useState<string | null>(null);
  const [isModuleLoading, setIsModuleLoading] = useState(false);

  const selectedRole = userRole ?? defaultRole;
  const activeRoleDefinition =
    availableRoles.find((role) => role.key === selectedRole) ??
    roleFallbackByKey.get(selectedRole) ??
    roles[0];

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
          .filter((role): role is RoleDefinition => Boolean(role));

        if (!mappedRoles.length) {
          setAvailableRoles(roles);
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
          setAvailableRoles(roles);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

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
          // If the database has explicitly granted modules, we trust that list as the primary source.
          // We only apply role-based fallbacks if the server returns no operational modules,
          // which ensures that granular database-level restrictions are respected.
          const hasOperationalModules = modules.some(m => m.section !== 'Account Management');
          const finalModules = hasOperationalModules 
            ? mergeModulesForRole(selectedRole, modules) 
            : mergeModulesForRole(selectedRole, []);
          
          setAccessibleModules(finalModules);
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
          setHasResolvedModules(true);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [selectedRole, token]);

  useEffect(() => {
    if (!token || !activeModuleId || moduleFetchSkipList.has(activeModuleId)) {
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
    if (!token || !routeSegment || modulesLoading || !hasResolvedModules) {
      return;
    }

    if (!resolveModuleIdFromRouteSegment(accessibleModules.map((module) => module.id), routeSegment)) {
      router.replace(getInternalDashboardPath());
    }
  }, [accessibleModules, hasResolvedModules, modulesLoading, routeSegment, router, token]);

  const activeModuleRenderer = activeModule ? moduleRenderers[activeModule.id] : null;

  return (
    <div className="portal-shell">
      <InternalHeader role={activeRoleDefinition} onSignOut={handleSignOut} />
      <div className="portal-flagband" aria-hidden="true" />
      <div className="portal-content">
        <SidebarNav
          modules={accessibleModules}
          activeModuleId={activeModuleId ?? 'dashboard'}
          onModuleChange={handleModuleChange}
        />
        <main className="portal-main">
          {modulesError ? <div className="portal-alert">{modulesError}</div> : null}
          {modulesLoading ? <div className="plan-loading">Loading role workspace...</div> : null}
          {activeModuleId === 'dashboard' ? <DashboardPage modules={accessibleModules} /> : null}
          {activeModuleId && activeModuleId !== 'dashboard' && activeModule ? (
            <>
              {(activeModuleRenderer ?? renderGenericModuleWorkspace)({
                module: activeModule,
                moduleData,
                moduleError,
                isLoading: isModuleLoading,
                token,
                role: selectedRole,
                userEmail,
                onModuleChange: handleModuleChange
              })}
            </>
          ) : null}
        </main>
      </div>
    </div>
  );
};
