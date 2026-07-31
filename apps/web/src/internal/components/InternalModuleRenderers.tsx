import React from 'react';
import type { InternalModule, RoleKey } from '../types/internal';
import { AdministrativeReviewModulePage } from './AdministrativeReviewModulePage';
import { AuditDashboardWorkspace } from './AuditDashboardWorkspace';
import { UserRoleManagementModule } from './UserRoleManagementModule';
import { AuditTrailWorkspace } from './AuditTrailWorkspace';
import { ComplianceReportsWorkspace } from './ComplianceReportsWorkspace';
import { PaymentTrackingModulePage } from './PaymentTrackingModulePage';
import { PostAwardInspectionModulePage } from './PostAwardInspectionModulePage';
import { ProfilePage } from './ProfilePage';
import { WorkflowConfigurationModulePage } from './WorkflowConfigurationModulePage';
import { ProcurementPlanModule } from './ProcurementPlanModule';
import { PlanningCommitteeReviewModule } from './PlanningCommitteeReviewModule';
import { EvaluationScoringModule } from './EvaluationScoringModule';
import { BidOpeningModule } from './BidOpeningModule';
import { TendersBoardApprovalModule } from './TendersBoardApprovalModule';
import { CgisApprovalModule } from './CgisApprovalModule';
import { ContractManagementModule } from './ContractManagementModule';
import { ContractAwardModule } from './ContractAwardModule';
import { BppEscalationModule } from './BppEscalationModule';
import { VendorRegistrationApprovalModule } from './VendorRegistrationApprovalModule';
import { AdminRequisitionManagementPage } from './AdminRequisitionManagementPage';
import { BudgetOfficerWorkspacePage } from './BudgetOfficerWorkspacePage';
import { DepartmentHeadReviewModule } from './DepartmentHeadReviewModule';
import { ThresholdConfigurationModule } from './ThresholdConfigurationModule';
import { TenderCreatePage } from './TenderCreatePage';
import { EvaluationReportModule } from './EvaluationReportModule';
import { AssignedTendersModule } from './AssignedTendersModule';
import { SystemMonitoringModule } from './SystemMonitoringModule';
import { TenderReviewPage } from './TenderReviewPage';
import { ApprovalRejectionPage } from './ApprovalRejectionPage';
import { HighValueTendersPage } from './HighValueTendersPage';
import { ProcurementMethodDeterminationModule } from './ProcurementMethodDeterminationModule';
import { NeedsAndRequisitionsModule } from './NeedsAndRequisitionsModule';
import { NeedsSubmissionModule } from './NeedsSubmissionModule';
import { OrganizationManagementModule } from './OrganizationManagementModule';

export type InternalModuleRendererProps = {
  module: InternalModule;
  moduleData: unknown;
  moduleError: string | null;
  isLoading: boolean;
  token: string | null;
  role: RoleKey | null;
  userEmail?: string | null;
  availableModuleIds: string[];
  onModuleChange: (moduleId: string) => void;
};

export const renderGenericModuleWorkspace = ({
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
        <pre style={{ overflowX: 'auto', maxHeight: 400, fontSize: 12, padding: 12, background: '#f8fafc', borderRadius: 12 }}>{JSON.stringify(moduleData, null, 2)}</pre>
      ) : (
        <div className="plan-empty">No live dataset was returned for this module.</div>
      )}
    </section>
  );
};

export const moduleRenderers: Partial<Record<string, (props: InternalModuleRendererProps) => React.ReactNode>> = {
    'budget-workspace': (props) => <BudgetOfficerWorkspacePage module={props.module} token={props.token} role={props.role} />,
    'audit-dashboard': (props) => <AuditDashboardWorkspace module={props.module} token={props.token} />,
    'audit-trail-viewer': (props) => <AuditTrailWorkspace module={props.module} token={props.token} />,
    'compliance-reports': (props) => <ComplianceReportsWorkspace module={props.module} token={props.token} />,
    'inspection-acceptance': (props) => <PostAwardInspectionModulePage module={props.module} token={props.token} />,
    'payment-tracking': (props) => <PaymentTrackingModulePage module={props.module} token={props.token} userEmail={props.userEmail} />,
    'contract-management': (props) => <ContractManagementModule module={props.module} token={props.token} role={props.role} initialData={props.moduleData} />,
    'contract-award': (props) => <ContractAwardModule module={props.module} token={props.token} role={props.role} initialData={props.moduleData} onModuleChange={props.onModuleChange} />,
    'bpp-escalation': (props) => <BppEscalationModule module={props.module} token={props.token} role={props.role} initialData={props.moduleData} />,
    'administrative-review': (props) => <AdministrativeReviewModulePage module={props.module} token={props.token} role={props.role} userEmail={props.userEmail} />,
    'annual-procurement-plan': (props) => <ProcurementPlanModule module={props.module} token={props.token} role={props.role} initialData={props.moduleData} />,
    'procurement-method-determination': (props) => <ProcurementMethodDeterminationModule module={props.module} token={props.token} />,
    'procurement-planning-committee': (props) => <PlanningCommitteeReviewModule module={props.module} token={props.token} role={props.role} userEmail={props.userEmail} initialData={props.moduleData} />,
    'create-tender': (props) => <TenderCreatePage token={props.token} module={props.module} />,
    'assigned-tenders': (props) => <AssignedTendersModule module={props.module} token={props.token} role={props.role} initialData={props.moduleData} onModuleChange={props.onModuleChange} />,
    'technical-evaluation': (props) => <EvaluationScoringModule module={props.module} token={props.token} role={props.role} initialData={props.moduleData} />,
    'financial-evaluation': (props) => <EvaluationScoringModule module={props.module} token={props.token} role={props.role} initialData={props.moduleData} />,
    'evaluation-report': (props) => <EvaluationReportModule module={props.module} token={props.token} />,
    'user-role-management': (props) => <UserRoleManagementModule module={props.module} token={props.token} />,
    'bid-opening-session': (props) => <BidOpeningModule module={props.module} token={props.token} role={props.role} initialData={props.moduleData} />,
    'tenders-board-approval': (props) => <TendersBoardApprovalModule module={props.module} token={props.token} role={props.role} userEmail={props.userEmail} availableModuleIds={props.availableModuleIds} onModuleChange={props.onModuleChange} initialData={props.moduleData} />,
    'final-approval': (props) => <CgisApprovalModule module={props.module} token={props.token} role={props.role} userEmail={props.userEmail} />,
    'cgis-approval': (props) => <CgisApprovalModule module={props.module} token={props.token} role={props.role} userEmail={props.userEmail} />,
    'workflow-configuration': (props) => <WorkflowConfigurationModulePage module={props.module} moduleData={props.moduleData} moduleError={props.moduleError} token={props.token} />,
    'vendor-registration-approval': (props) => <VendorRegistrationApprovalModule module={props.module} token={props.token} role={props.role} userEmail={props.userEmail} />,
    'department-head-review': (props) => <DepartmentHeadReviewModule module={props.module} token={props.token} role={props.role} userEmail={props.userEmail} />,
    'threshold-configuration': (props) => <ThresholdConfigurationModule module={props.module} token={props.token} />,
    'system-monitoring': (props) => <SystemMonitoringModule module={props.module} token={props.token} initialData={props.moduleData} />,
    'user-profile': (props) => <ProfilePage module={props.module} token={props.token} userEmail={props.userEmail} />,
    'tender-review': (props) => <TenderReviewPage module={props.module} token={props.token} role={props.role} userEmail={props.userEmail} availableModuleIds={props.availableModuleIds} onModuleChange={props.onModuleChange} initialData={props.moduleData} />,
    'approval-rejection': (props) => <ApprovalRejectionPage module={props.module} token={props.token} role={props.role} userEmail={props.userEmail} availableModuleIds={props.availableModuleIds} onModuleChange={props.onModuleChange} initialData={props.moduleData} />,
    'high-value-tenders': (props) => <HighValueTendersPage module={props.module} token={props.token} role={props.role} userEmail={props.userEmail} availableModuleIds={props.availableModuleIds} onModuleChange={props.onModuleChange} initialData={props.moduleData} />,
    'needs-collection': (props) => <NeedsAndRequisitionsModule module={props.module} token={props.token} role={props.role} userEmail={props.userEmail} availableModuleIds={props.availableModuleIds} onModuleChange={props.onModuleChange} />,
    'needs-submission': (props) => <NeedsSubmissionModule module={props.module} token={props.token!} role={props.role} />,
    'organization-management': (props) => <OrganizationManagementModule module={props.module} token={props.token!} />
};
