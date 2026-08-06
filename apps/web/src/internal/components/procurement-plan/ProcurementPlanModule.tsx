'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { InternalModule, ProcurementPlanDetail, ProcurementPlanItemDetail } from '../../types/internal';
import { fetchPlanDetails } from '../../services/moduleService';
import { usePermission } from '../../hooks/usePermission';
import {
  decideProcurementPlanApproval,
  fetchYearlyAppDetails,
  fetchYearlyApps,
  initiateProcurementPlan,
  recommendProcurementPlanForApproval,
  type YearlyAppDetail,
  type YearlyAppPlanSummary,
  type YearlyAppSummary
} from '../../services/procurementPlanService';
import { ProcurementPlanDiagnostics } from './ProcurementPlanDiagnostics';
import { ProcurementPlanListView } from './ProcurementPlanListView';
import { ProcurementPlanYearlyAppDetail } from './ProcurementPlanYearlyAppDetail';
import { YearlyAppModal } from './YearlyAppModal';
import {
  createYearlyApp,
  updateYearlyApp,
  submitYearlyAppForApproval,
  type YearlyAppCreateRequest,
  type YearlyAppUpdateRequest
} from '../../services/procurementPlanService';

interface Props {
  module: InternalModule;
  token: string | null;
  role?: string | null;
  initialData?: unknown;
}

export const ProcurementPlanModule = ({ module, token, role }: Props) => {
  const { hasPermission } = usePermission(token);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [view, setView] = useState<'list' | 'details'>('list');
  const [yearlyApps, setYearlyApps] = useState<YearlyAppSummary[]>([]);
  const [selectedYearlyApp, setSelectedYearlyApp] = useState<YearlyAppDetail | null>(null);
  const [includedPlans, setIncludedPlans] = useState<YearlyAppPlanSummary[]>([]);
  const [pendingPlans, setPendingPlans] = useState<YearlyAppPlanSummary[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<ProcurementPlanDetail | null>(null);
  const [planItems, setPlanItems] = useState<ProcurementPlanItemDetail[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [approvalNote, setApprovalNote] = useState('');
  const [query, setQuery] = useState('');
  const [thresholdSummary, setThresholdSummary] = useState<string | null>(null);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isModalProcessing, setIsModalProcessing] = useState(false);
  const [editingYearlyApp, setEditingYearlyApp] = useState<YearlyAppDetail | null>(null);

  const canRecommendApp = hasPermission('procurement_plan.approve');
  const canTakeApprovalDecision = hasPermission('procurement_plan.approve') || hasPermission('cgis.approve');
  const isAwaitingAppApproval = selectedPlan?.CurrentStageKey === 'app_approval';
  const isAwaitingCgisApproval = selectedPlan?.CurrentStageKey === 'accounting_officer_review';
  const isAtProcurementInitiation = selectedPlan?.CurrentStageKey === 'procurement_initiation';

  useEffect(() => {
    if (token) void loadBaseData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (!token) return;
    const yearlyAppId = searchParams.get('yearlyAppId');
    const planId = searchParams.get('planId');
    if (yearlyAppId) void openYearlyApp(yearlyAppId, false, planId ?? undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, token]);

  const filteredYearlyApps = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return yearlyApps;
    return yearlyApps.filter((app) => app.Title.toLowerCase().includes(needle) || app.Status.toLowerCase().includes(needle) || String(app.FiscalYear).includes(needle));
  }, [query, yearlyApps]);
  const statusCounts = useMemo(() => yearlyApps.reduce<Record<string, number>>((acc, app) => ({ ...acc, [app.Status]: (acc[app.Status] ?? 0) + 1 }), {}), [yearlyApps]);

  const splitLegacyPlans = (plans: YearlyAppPlanSummary[]) => ({
    included: plans.filter((plan) => plan.Status === 'Approved'),
    pending: plans.filter((plan) => plan.Status !== 'Approved')
  });

  const syncUrl = (yearlyAppId?: string | null, planId?: string | null) => {
    const params = new URLSearchParams();
    if (yearlyAppId) params.set('yearlyAppId', yearlyAppId);
    if (planId) params.set('planId', planId);
    const queryString = params.toString();
    router.replace(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false });
  };

  const loadBaseData = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const apps = await fetchYearlyApps(token);
      setYearlyApps(apps);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const openPlan = async (planId: string, pushUrl = true, yearlyAppIdOverride?: string) => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const details = await fetchPlanDetails(planId, token);
      setActionError(null);
      setSelectedPlan(details.Plan);
      setPlanItems(details.Items || []);
      setView('details');
      if (pushUrl) syncUrl(yearlyAppIdOverride ?? selectedYearlyApp?.YearlyAppId ?? details.Plan.YearlyAppId ?? null, planId);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const openYearlyApp = async (yearlyAppId: string, pushUrl = true, planIdToOpen?: string) => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const appData = await fetchYearlyAppDetails(token, yearlyAppId);
      const legacyPlans = appData.Plans ?? [];
      const groupedLegacyPlans = splitLegacyPlans(legacyPlans);
      setSelectedYearlyApp(appData.App);
      setIncludedPlans(appData.IncludedPlans ?? groupedLegacyPlans.included);
      setPendingPlans(appData.PendingPlans ?? groupedLegacyPlans.pending);
      setSelectedPlan(null);
      setPlanItems([]);
      setView('details');
      if (planIdToOpen) await openPlan(planIdToOpen, false, yearlyAppId);
      else if (pushUrl) syncUrl(yearlyAppId, null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const refreshCurrent = async (planId?: string) => {
    await loadBaseData();
    if (selectedYearlyApp) await openYearlyApp(selectedYearlyApp.YearlyAppId, false, planId);
  };

  const handleRecommendForApproval = async () => {
    if (!token || !selectedPlan) return;
    if (!window.confirm(`Recommend departmental plan "${selectedPlan.PlanTitle}" to Comptroller Procurement for approval?`)) return;
    setLoading(true);
    setError(null);
    setActionError(null);
    setFeedback(null);
    try {
      const result = await recommendProcurementPlanForApproval(token, selectedPlan.PlanId);
      setFeedback(result.Message);
      await refreshCurrent(selectedPlan.PlanId);
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleApprovalDecision = async (decision: 'approve' | 'return' | 'reject') => {
    if (!token || !selectedPlan) return;
    if (!window.confirm(`${decision === 'approve' ? 'Approve' : decision === 'return' ? 'Return' : 'Reject'} plan "${selectedPlan.PlanTitle}"?`)) return;
    setLoading(true);
    setError(null);
    setActionError(null);
    setFeedback(null);
    setThresholdSummary(null);
    try {
      const result = await decideProcurementPlanApproval(token, selectedPlan.PlanId, { Decision: decision, Note: approvalNote.trim() || undefined });
      setFeedback(result.Message);
      setApprovalNote('');
      await refreshCurrent(selectedPlan.PlanId);
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleInitiateProcurement = async () => {
    if (!token || !selectedPlan) return;
    if (!window.confirm(`Move plan "${selectedPlan.PlanTitle}" to Threshold Resolution?`)) return;
    setLoading(true);
    setError(null);
    setFeedback(null);
    try {
      const result = await initiateProcurementPlan(token, selectedPlan.PlanId);
      setFeedback(result.Message);
      setThresholdSummary(result.ApprovalAuthorityLabel || result.ApprovalRoute ? `Threshold route: ${result.ApprovalAuthorityLabel || result.ApprovalRoute}` : 'Threshold route resolved.');
      await refreshCurrent(selectedPlan.PlanId);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setModalMode('create');
    setEditingYearlyApp(null);
    setIsModalOpen(true);
  };

  const openEditModal = (app: YearlyAppDetail) => {
    setModalMode('edit');
    setEditingYearlyApp(app);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingYearlyApp(null);
    setIsModalProcessing(false);
  };

  const handleModalConfirm = async (data: YearlyAppCreateRequest | YearlyAppUpdateRequest) => {
    if (!token) return;
    setIsModalProcessing(true);
    setError(null);
    setFeedback(null);
    try {
      if (modalMode === 'create') {
        await createYearlyApp(token, data as YearlyAppCreateRequest);
        setFeedback('Yearly APP created successfully.');
      } else if (editingYearlyApp) {
        await updateYearlyApp(token, editingYearlyApp.YearlyAppId, data as YearlyAppUpdateRequest);
        setFeedback('Yearly APP updated successfully.');
      }
      closeModal();
      await loadBaseData();
    } catch (err: any) {
      setError(err.message || 'Failed to save Yearly APP');
    } finally {
      setIsModalProcessing(false);
    }
  };

  const handleSubmitYearlyApp = async (yearlyAppId: string, title: string) => {
    if (!token) return;
    if (!window.confirm(`Submit "${title}" for approval? This cannot be undone.`)) return;
    setLoading(true);
    setError(null);
    setFeedback(null);
    try {
      const result = await submitYearlyAppForApproval(token, yearlyAppId);
      setFeedback(result.Message);
      await loadBaseData();
      if (selectedYearlyApp?.YearlyAppId === yearlyAppId) {
        await openYearlyApp(yearlyAppId, false);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="app-module">
      <header className="app-module__header">
        <div className="app-module__title-group">
          <h2 className="app-module__title">{module.title}</h2>
          <p className="app-module__description">{module.description}</p>
        </div>
        {view !== 'list' && (
          <button
            className="app-btn app-btn--secondary"
            onClick={() => {
              setView('list');
              setSelectedYearlyApp(null);
              setSelectedPlan(null);
              setPlanItems([]);
              syncUrl();
            }}
          >
            <span className="app-btn__icon">←</span>
            Back to List
          </button>
        )}
      </header>

      {error && (
        <div className="app-alert app-alert--error">
          <span className="app-alert__icon">⚠</span>
          {error}
        </div>
      )}

      {feedback && (
        <div className="app-alert app-alert--success">
          <span className="app-alert__icon">✓</span>
          {feedback}
        </div>
      )}

      <ProcurementPlanDiagnostics
        role={role}
        selectedYearlyApp={selectedYearlyApp}
        selectedPlan={selectedPlan}
        canRecommendApp={canRecommendApp}
      />

      {view === 'list' ? (
        <ProcurementPlanListView
          yearlyApps={yearlyApps}
          filteredYearlyApps={filteredYearlyApps}
          query={query}
          canCreateApp={canRecommendApp || canTakeApprovalDecision}
          statusCounts={statusCounts}
          onQueryChange={setQuery}
          onOpenYearlyApp={(yearlyAppId) => void openYearlyApp(yearlyAppId)}
          onCreateYearlyApp={openCreateModal}
        />
      ) : selectedYearlyApp ? (
        <ProcurementPlanYearlyAppDetail
          selectedYearlyApp={selectedYearlyApp}
          includedPlans={includedPlans}
          pendingPlans={pendingPlans}
          selectedPlan={selectedPlan}
          planItems={planItems}
          loading={loading}
          actionError={actionError}
          approvalNote={approvalNote}
          thresholdSummary={thresholdSummary}
          canTakeApprovalDecision={canTakeApprovalDecision}
          isAwaitingAppApproval={isAwaitingAppApproval}
          isAwaitingCgisApproval={isAwaitingCgisApproval}
          isAtProcurementInitiation={isAtProcurementInitiation}
          onApprovalNoteChange={setApprovalNote}
          onApprovalDecision={(decision) => void handleApprovalDecision(decision)}
          onInitiateProcurement={() => void handleInitiateProcurement()}
          onOpenPlan={(planId) => void openPlan(planId)}
          onEditYearlyApp={openEditModal}
          onSubmitYearlyApp={(app) => void handleSubmitYearlyApp(app.YearlyAppId, app.Title)}
        />
      ) : null}

      <YearlyAppModal
        mode={modalMode}
        isOpen={isModalOpen}
        isProcessing={isModalProcessing}
        initialData={editingYearlyApp}
        onConfirm={handleModalConfirm}
        onCancel={closeModal}
      />
    </section>
  );
};
