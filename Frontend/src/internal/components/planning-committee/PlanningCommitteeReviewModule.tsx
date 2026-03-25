import React, { useState, useCallback } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import styles from './styles/planning-committee.module.css';

import { usePlanningCommittee } from './hooks/usePlanningCommittee';
import { PendingQueue } from './views/PendingQueue';
import { LinkedQueue } from './views/LinkedQueue';
import { AppItemsBrowser } from './views/AppItemsBrowser';
import { ReviewWorkspace } from './views/ReviewWorkspace';
import { LinkToPlanModal } from './components/LinkToPlanModal';
import { RequisitionDetailModal } from './components/RequisitionDetailModal';

import type { InternalModule, RequisitionSummary } from '../../types/internal';
interface Props {
  module: InternalModule;
  token: string | null;
  role: string | null;
  userEmail?: string | null;
  initialData?: any;
}

type ViewState = 'requisitions' | 'linked' | 'app-items' | 'workspace';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(value);

const escapeCsv = (value: string) => {
  if (value.includes('"') || value.includes(',') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
};

const downloadCsv = (filename: string, rows: string[][]) => {
  const content = rows.map((row) => row.map((cell) => escapeCsv(cell)).join(',')).join('\n');
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

export const PlanningCommitteeReviewModule: React.FC<Props> = ({
  module,
  token,
  role,
  userEmail: _userEmail,
  initialData: _initialData
}) => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [view, setView] = useState<ViewState>('requisitions');
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [selectedRequisitionForModal, setSelectedRequisitionForModal] = useState<RequisitionSummary | null>(null);
  const [planNotice, setPlanNotice] = useState<string | null>(null);
  const [planModalError, setPlanModalError] = useState<string | null>(null);
  const [finalDecisionError, setFinalDecisionError] = useState<string | null>(null);
  const [selectedPlanForAppItems, setSelectedPlanForAppItems] = useState('');

  const {
    state,
    loading,
    error,
    success,
    clearNotifications,
    loadPlans,
    loadWorkspaceData,
    loadRequisitionDetail,
    loadAppItems,
    submitReview,
    submitFinalDecision,
    linkToPlan,
    unlinkRequisition
  } = usePlanningCommittee(token);

  // Sync view with URL
  React.useEffect(() => {
    const queryView = searchParams?.get('view') ?? '';
    const routeSuffix = pathname?.split('/').slice(-1)[0] ?? '';
    const normalized = (queryView || routeSuffix).toLowerCase();

    switch (normalized) {
      case 'pending':
      case 'requisitions':
        setView('requisitions');
        break;
      case 'linked':
        setView('linked');
        break;
      case 'app':
      case 'appitems':
      case 'app-items':
        setView('app-items');
        break;
      case 'workspace':
        setView('workspace');
        break;
      default:
        if (queryView || routeSuffix) {
          setView('requisitions');
        }
    }
  }, [searchParams, pathname]);

  const pushView = useCallback((nextView: ViewState) => {
    const base = '/internal/dashboard/procurementplanningcommittee';
    const viewParam = nextView === 'requisitions' ? 'pending' : nextView;
    router.push(`${base}?view=${encodeURIComponent(viewParam)}`);
    setView(nextView);
    clearNotifications();
  }, [router, clearNotifications]);

  const openWorkspace = useCallback(async (req: RequisitionSummary) => {
    pushView('workspace');
    setFinalDecisionError(null);
    await loadWorkspaceData(req);
  }, [pushView, loadWorkspaceData]);

  const openLinkModal = useCallback((req: RequisitionSummary) => {
    setSelectedRequisitionForModal(req);
    setPlanNotice(null);
    setPlanModalError(null);
    setIsLinkModalOpen(true);
    clearNotifications();
  }, [clearNotifications]);

  const openViewModal = useCallback(async (req: RequisitionSummary) => {
    setSelectedRequisitionForModal(req);
    await loadWorkspaceData(req);
    await loadRequisitionDetail(req.RequisitionId);
    setIsViewModalOpen(true);
  }, [loadWorkspaceData, loadRequisitionDetail]);

  const handleLinkSubmit = useCallback(async (
    mode: 'create' | 'attach',
    config: { title?: string; fiscalYear?: number; existingPlanId?: string }
  ) => {
    if (!selectedRequisitionForModal) return false;

    const result = await linkToPlan(
      selectedRequisitionForModal,
      mode,
      config,
      setPlanNotice
    );

    setPlanModalError(result.error ?? null);

    if (result.success) {
      setIsLinkModalOpen(false);
    }
    return result.success;
  }, [selectedRequisitionForModal, linkToPlan]);

  const handleSubmitReview = useCallback(async (decision: string, remarks: string) => {
    if (!token || !state.selectedPlan || !state.selectedRequisition) {
      return false;
    }
    return await submitReview(decision, remarks);
  }, [token, state.selectedPlan, state.selectedRequisition, submitReview]);

  const handleSubmitFinalDecision = useCallback(async (decision: string, remarks: string) => {
    if (!token || !state.selectedPlan || !state.selectedRequisition) return false;
    setFinalDecisionError(null);
    const result = await submitFinalDecision(decision, remarks);
    setFinalDecisionError(result.error ?? null);
    if (result.success) {
      if (decision === 'Recommended') {
        const refreshedPlans = await loadPlans();
        setSelectedPlanForAppItems(state.selectedPlan.PlanId);
        pushView('app-items');
        if (!refreshedPlans.some((plan: { PlanId: string }) => plan.PlanId === state.selectedPlan?.PlanId)) {
          setPlanNotice('The requisition was approved into its departmental plan, but the plan is not in the current planning-committee filter.');
        } else {
          setPlanNotice('The requisition was approved successfully by Planning Committee. It is now part of the departmental plan.');
        }
      } else {
        pushView('linked');
      }
    }
    return result.success;
  }, [token, state.selectedPlan, state.selectedRequisition, submitFinalDecision, pushView, loadPlans]);

  const handleUnlink = useCallback(async (reason: string) => {
    if (!state.selectedRequisition) return false;
    return await unlinkRequisition(state.selectedRequisition, reason);
  }, [state.selectedRequisition, unlinkRequisition]);

  // CSV export functions
  const exportPendingCsv = useCallback(() => {
    const rows = [
      ['Required By', 'Title', 'Department', 'Status', 'Total Estimate'],
      ...state.requisitions.map((r) => [
        r.RequiredBy ? new Date(r.RequiredBy).toLocaleDateString() : '—',
        r.Title,
        r.Department,
        r.Status,
        formatCurrency(r.TotalEstimate)
      ])
    ];
    downloadCsv('pending_requisitions.csv', rows);
  }, [state.requisitions]);

  const exportLinkedCsv = useCallback(() => {
    const rows = [
      ['Required By', 'Title', 'Department', 'Status', 'Total Estimate', 'APP Item'],
      ...state.linkedRequisitions.map((r) => [
        r.RequiredBy ? new Date(r.RequiredBy).toLocaleDateString() : '—',
        r.Title,
        r.Department,
        r.Status,
        formatCurrency(r.TotalEstimate),
        r.AppItemDescription ?? r.AppItemId ?? '—'
      ])
    ];
    downloadCsv('linked_requisitions.csv', rows);
  }, [state.linkedRequisitions]);

  const exportDepartmentPlansCsv = useCallback(() => {
    const rows = [
      ['Department', 'Plan Title', 'Fiscal Year', 'Status', 'Total Budget', 'Created'],
      ...state.plans.map((plan) => [
        plan.Department || 'Unassigned',
        plan.PlanTitle,
        String(plan.FiscalYear),
        plan.Status,
        formatCurrency(plan.TotalBudget),
        new Date(plan.CreatedAt).toLocaleDateString()
      ])
    ];
    downloadCsv('department_plans.csv', rows);
  }, [state.plans]);

  const exportReviewsCsv = useCallback(() => {
    const rows = [
      ['Role', 'Decision', 'Remarks', 'Updated At'],
      ...state.memberReviews.map((r) => [
        r.ReviewerRole.replace(/_/g, ' ').toUpperCase(),
        r.Decision,
        r.Remarks ?? '',
        new Date(r.UpdatedAt).toLocaleString()
      ])
    ];
    downloadCsv('committee_reviews.csv', rows);
  }, [state.memberReviews]);

  // Load plans for APP items view
  React.useEffect(() => {
    if (token && view === 'app-items' && state.plans.length === 0) {
      loadPlans().then((plans) => {
        if (plans.length > 0 && !selectedPlanForAppItems) {
          setSelectedPlanForAppItems(plans[0].PlanId);
        }
      });
    }
  }, [token, view, state.plans.length, selectedPlanForAppItems, loadPlans]);

  return (
    <section className={`portal-module ${styles.container}`}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerTitle}>
          <h2>{module.title || 'Planning Committee Review'}</h2>
          <p className={styles.headerSubtitle}>
            {module.description || 'Assign requisitions to a departmental plan, record requisition-level committee decisions, and keep approved requisitions in planning committee until Procurement Secretary recommends the plan.'}
          </p>
        </div>
        <nav className={styles.tabs}>
          <button
            className={`${styles.tab} ${view === 'requisitions' ? styles.tabActive : ''}`}
            onClick={() => pushView('requisitions')}
          >
            Pending
          </button>
          <button
            className={`${styles.tab} ${view === 'linked' ? styles.tabActive : ''}`}
            onClick={() => pushView('linked')}
          >
            Linked
          </button>
          <button
            className={`${styles.tab} ${view === 'app-items' ? styles.tabActive : ''}`}
            onClick={() => pushView('app-items')}
          >
            Department Plans
          </button>
          {state.selectedRequisition && view === 'workspace' && (
            <button
              className={`${styles.tab} ${styles.tabActive}`}
              onClick={() => pushView('workspace')}
            >
              Workspace
            </button>
          )}
        </nav>
      </header>

      {/* Notifications */}
      {error && <div className="portal-alert">{error}</div>}
      {success && (
        <div className="portal-alert portal-alert--success" style={{ background: '#dcfce7', borderColor: '#86efac', color: '#166534' }}>
          {success}
        </div>
      )}
      {planNotice && (
        <div className="portal-alert portal-alert--info">{planNotice}</div>
      )}

      {/* Views */}
      {view === 'requisitions' && (
        <PendingQueue
          requisitions={state.requisitions}
          onLink={openLinkModal}
          formatCurrency={formatCurrency}
          downloadCsv={exportPendingCsv}
        />
      )}

      {view === 'linked' && (
        <LinkedQueue
          requisitions={state.linkedRequisitions}
          onWorkspace={openWorkspace}
          onView={openViewModal}
          formatCurrency={formatCurrency}
          downloadCsv={exportLinkedCsv}
        />
      )}

      {view === 'app-items' && (
        <AppItemsBrowser
          token={token}
          role={role}
          plans={state.plans}
          appItems={state.appItems}
          selectedPlanId={selectedPlanForAppItems}
          onPlanChange={setSelectedPlanForAppItems}
          onLoadItems={loadAppItems}
          onPlanRecommended={async () => { await loadPlans(); }}
          formatCurrency={formatCurrency}
          downloadCsv={exportDepartmentPlansCsv}
        />
      )}

      {view === 'workspace' && (
        <ReviewWorkspace
          requisition={state.selectedRequisition}
          plan={state.selectedPlan}
          planItems={state.planItems}
          memberReviews={state.memberReviews}
          memberStatuses={state.memberStatuses}
          decision={state.selectedDecision}
          authority={state.workspaceAuthority}
          finalDecisionError={finalDecisionError}
          loading={loading.action}
          onSubmitReview={handleSubmitReview}
          onSubmitFinalDecision={handleSubmitFinalDecision}
          onLink={() => state.selectedRequisition && openLinkModal(state.selectedRequisition)}
          onUnlink={handleUnlink}
          formatCurrency={formatCurrency}
          downloadReviewsCsv={exportReviewsCsv}
        />
      )}

      {/* Modals */}
      <LinkToPlanModal
        requisition={selectedRequisitionForModal || {
          RequisitionId: '',
          Title: '',
          Department: '',
          Status: '',
          TotalEstimate: 0,
          CreatedAt: new Date().toISOString()
        }}
        isOpen={isLinkModalOpen}
        onClose={() => setIsLinkModalOpen(false)}
        onLink={handleLinkSubmit}
        onLoadPlans={async () => {
          return state.availablePlans.length > 0 ? state.availablePlans : await loadPlans('Under Review');
        }}
        error={planModalError}
        notice={planNotice}
      />

      <RequisitionDetailModal
        requisition={state.selectedRequisitionDetail}
        memberReviews={state.memberReviews}
        isOpen={isViewModalOpen}
        onClose={() => setIsViewModalOpen(false)}
        formatCurrency={formatCurrency}
      />
    </section>
  );
};

export default PlanningCommitteeReviewModule;
