'use client';

import { useEffect, useMemo, useState } from 'react';
import type {
  BudgetConfirmationDetail,
  BudgetConfirmationQueueItem,
  BudgetDashboardResponse,
  BudgetFilters as IBudgetFilters,
  InternalModule,
  RoleKey
} from '../types/internal';
import {
  decideBudgetConfirmation,
  fetchBudgetConfirmationDetail,
  fetchBudgetConfirmations,
  fetchBudgetDashboard
} from '../services/budgetService';

// Sub-components
import { BudgetMetrics } from './budget-officer/BudgetMetrics';
import { BudgetFilters } from './budget-officer/BudgetFilters';
import { BudgetQueue } from './budget-officer/BudgetQueue';
import { BudgetDetailView } from './budget-officer/BudgetDetailView';
import { BudgetDecisionPanel } from './budget-officer/BudgetDecisionPanel';
import { BudgetRiskItems } from './budget-officer/BudgetRiskItems';
import { BudgetQueueSnapshot } from './budget-officer/BudgetQueueSnapshot';
import { BudgetSubNav } from './budget-officer/BudgetSubNav';

type Props = {
  module: InternalModule;
  token?: string | null;
  role?: RoleKey | null;
};

type ViewType = 'dashboard' | 'queue' | 'review';

const defaultFilters: IBudgetFilters = {
  fiscalYear: '',
  department: '',
  stage: '',
  query: ''
};

const getDecisionOptions = (detail: BudgetConfirmationDetail | null) => {
  if (!detail) return [];

  const options: string[] = ['hold', 'return', 'reject'];
  if (detail.CurrentStageKey === 'planning_committee_review') {
    options.unshift('start_review', 'confirm');
    return options;
  }

  if (detail.CurrentStageKey === 'budget_confirmation') {
    options.unshift('confirm');
  }

  return options;
};

export const BudgetOfficerWorkspacePage = ({ module, token, role }: Props) => {
  const [activeView, setActiveView] = useState<ViewType>('dashboard');
  const [isDecisionModalOpen, setIsDecisionModalOpen] = useState(false);
  const [filters, setFilters] = useState<IBudgetFilters>(defaultFilters);
  const [page, setPage] = useState(1);
  const [dashboard, setDashboard] = useState<BudgetDashboardResponse | null>(null);
  const [queue, setQueue] = useState<BudgetConfirmationQueueItem[]>([]);
  const [total, setTotal] = useState(0);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [detail, setDetail] = useState<BudgetConfirmationDetail | null>(null);
  const [decisionNote, setDecisionNote] = useState('');
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const [modalError, setModalError] = useState<string | null>(null);
  const [isLoadingQueue, setIsLoadingQueue] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const canTakeDecisions = Boolean(
    token && role && ['financial_unit_officer', 'accounting_officer', 'admin'].includes(role)
  );

  const selectedQueueItem = useMemo(
    () => queue.find((item) => item.PlanId === selectedPlanId) ?? null,
    [queue, selectedPlanId]
  );

  const availableDecisions = useMemo(() => getDecisionOptions(detail) as any[], [detail]);

  const loadQueueAndDashboard = async () => {
    if (!token) {
      setDashboard(null);
      setQueue([]);
      setTotal(0);
      setSelectedPlanId(null);
      return;
    }

    const fiscalYear = Number(filters.fiscalYear);

    setIsLoadingQueue(true);
    setError('');
    try {
      const [nextDashboard, nextQueue] = await Promise.all([
        fetchBudgetDashboard(token, {
          fiscalYear: Number.isFinite(fiscalYear) && fiscalYear > 0 ? fiscalYear : undefined,
          department: filters.department || undefined
        }),
        fetchBudgetConfirmations(token, {
          fiscalYear: Number.isFinite(fiscalYear) && fiscalYear > 0 ? fiscalYear : undefined,
          department: filters.department || undefined,
          stage: filters.stage || undefined,
          query: filters.query || undefined,
          page,
          pageSize: 12
        })
      ]);

      setDashboard(nextDashboard);
      setQueue(nextQueue.Items);
      setTotal(nextQueue.Total);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load budget workspace.');
      setDashboard(null);
      setQueue([]);
      setTotal(0);
    } finally {
      setIsLoadingQueue(false);
    }
  };

  useEffect(() => {
    void loadQueueAndDashboard();
  }, [token, filters.department, filters.fiscalYear, filters.query, filters.stage, page]);

  useEffect(() => {
    if (!token || !selectedPlanId) {
      setDetail(null);
      return;
    }

    let isMounted = true;
    setIsLoadingDetail(true);
    setError('');

    fetchBudgetConfirmationDetail(token, selectedPlanId)
      .then((nextDetail) => {
        if (isMounted) setDetail(nextDetail);
      })
      .catch((loadError) => {
        if (isMounted) {
          setDetail(null);
          setError(loadError instanceof Error ? loadError.message : 'Unable to load budget detail.');
        }
      })
      .finally(() => {
        if (isMounted) setIsLoadingDetail(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedPlanId, token]);

  const handleDecision = async (decision: string) => {
    if (!token || !detail) {
      setModalError('Select a plan before taking a budget decision.');
      return;
    }

    setIsSaving(true);
    setModalError(null);
    setFeedback('');

    try {
      const result = await decideBudgetConfirmation(token, detail.PlanId, {
        Decision: decision,
        Note: decisionNote.trim() || undefined
      });
      setFeedback(result.Message);
      setIsDecisionModalOpen(false); // Close modal on success
      await loadQueueAndDashboard();
      const refreshed = await fetchBudgetConfirmationDetail(token, detail.PlanId);
      setDetail(refreshed);
      setDecisionNote('');
    } catch (saveError) {
      setModalError(saveError instanceof Error ? saveError.message : 'Unable to apply budget decision.');
    } finally {
      setIsSaving(false);
    }
  };

  const onSelectPlan = (planId: string) => {
    setSelectedPlanId(planId);
    setActiveView('review');
  };

  const openDecisionModal = () => {
    setModalError(null);
    setIsDecisionModalOpen(true);
  };

  return (
    <section className="portal-module budget-workspace-redesign animate-fade-up">
      <header className="budget-workspace__hero">
        <div className="budget-workspace__title-group">
          <div className="admin-kicker">NIS Financial Oversight</div>
          <h2>Budget Control Center</h2>
          <p className="plan-muted">Monitoring {total} active requisitions for Fiscal Year 2026</p>
        </div>
        <div className="plan-actions">
          <button
            type="button"
            className="plan-button plan-button--secondary"
            onClick={() => void loadQueueAndDashboard()}
            disabled={!token || isLoadingQueue}
          >
            {isLoadingQueue ? 'Syncing...' : 'Refresh Financials'}
          </button>
        </div>
      </header>

      {error ? <div className="portal-alert animate-shake">{error}</div> : null}
      {feedback ? <div className="plan-loading animate-rise-in">{feedback}</div> : null}

      <div className="budget-workspace__command-grid">
        <aside className="budget-workspace__sidebar">
          <BudgetSubNav
            activeView={activeView}
            onViewChange={setActiveView}
            hasSelection={Boolean(selectedPlanId)}
          />
          
          <div className="budget-sidebar-scroll">
            <BudgetMetrics dashboard={dashboard} compact />
            {activeView !== 'review' && <BudgetQueueSnapshot dashboard={dashboard} />}
          </div>
        </aside>

        <main className="budget-workspace__viewport">
          {activeView === 'dashboard' && (
            <div className="budget-view-content animate-fade">
              <div className="view-header">
                <h3>Financial Insights</h3>
                <p>Top financial risks and appropriation status</p>
              </div>
              <BudgetRiskItems dashboard={dashboard} onSelectPlan={onSelectPlan} />
            </div>
          )}

          {activeView === 'queue' && (
            <div className="budget-view-content animate-fade">
              <div className="view-header">
                <h3>Requisition Pipeline</h3>
                <p>Manage routing and confirmations</p>
              </div>
              <BudgetFilters
                filters={filters}
                onFilterChange={(next) => {
                  setPage(1);
                  setFilters((prev) => ({ ...prev, ...next }));
                }}
              />
              <BudgetQueue
                queue={queue}
                selectedPlanId={selectedPlanId}
                onSelectPlan={onSelectPlan}
                isLoading={isLoadingQueue}
                page={page}
                total={total}
                onPageChange={setPage}
              />
            </div>
          )}

          {activeView === 'review' && (
            <div className="budget-view-content animate-fade active-review-terminal">
              <div className="review-main">
                <BudgetDetailView detail={detail} isLoading={isLoadingDetail} />
              </div>
              <aside className="review-action-terminal">
                <article className="portal-module-card action-terminal-card metric-card--glass">
                   <div className="terminal-header">
                     <span className="terminal-icon">⚖️</span>
                     <div>
                       <h3>Decision Terminal</h3>
                       <p className="plan-muted">Record the final budget decision for this requisition.</p>
                     </div>
                   </div>
                   
                   <div className="terminal-stats">
                      <div className="stat-item">
                        <span>Available</span>
                        <strong>{detail ? (detail.Available < 0 ? '-' : '') + (Math.abs(detail.Available).toLocaleString('en-NG', { style: 'currency', currency: 'NGN' })) : 'N/A'}</strong>
                      </div>
                      <div className="stat-item">
                        <span>Requested</span>
                        <strong>{detail ? detail.RequestedAmount.toLocaleString('en-NG', { style: 'currency', currency: 'NGN' }) : 'N/A'}</strong>
                      </div>
                   </div>

                   <button 
                    type="button" 
                    className="plan-button plan-button--large" 
                    style={{ width: '100%', marginTop: '16px', height: '52px', fontSize: '1rem' }}
                    onClick={openDecisionModal}
                    disabled={!detail || isLoadingDetail}
                   >
                     Record Financial Decision
                   </button>
                </article>
              </aside>
            </div>
          )}
        </main>
      </div>

      <BudgetDecisionPanel
        isOpen={isDecisionModalOpen}
        onClose={() => setIsDecisionModalOpen(false)}
        selectedQueueItem={selectedQueueItem}
        detail={detail}
        availableDecisions={availableDecisions}
        decisionNote={decisionNote}
        onNoteChange={setDecisionNote}
        onDecision={handleDecision}
        canTakeDecisions={canTakeDecisions}
        isSaving={isSaving}
        error={modalError}
      />
    </section>
  );
};
