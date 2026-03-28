'use client';

import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useEffect, useMemo, useState, type SetStateAction } from 'react';
import type {
  BudgetAppropriationResponse,
  BudgetConfirmationDetail,
  BudgetDashboardResponse,
  BudgetFilters as IBudgetFilters,
  BudgetRequisitionQueueItem,
  InternalModule,
  RoleKey
} from '../types/internal';
import {
  decideBudgetConfirmation,
  fetchBudgetConfirmationDetail,
  fetchBudgetDashboard,
  fetchBudgetRequisitionQueue
} from '../services/budgetService';

// Sub-components
import { BudgetFilters } from './budget-officer/BudgetFilters';
import { BudgetQueue } from './budget-officer/BudgetQueue';
import { BudgetDetailView } from './budget-officer/BudgetDetailView';
import { BudgetDecisionPanel } from './budget-officer/BudgetDecisionPanel';
import { BudgetSubNav } from './budget-officer/BudgetSubNav';
import { BudgetAppropriationLedger } from './budget-officer/BudgetAppropriationLedger';
import { BudgetAppropriationForm } from './budget-officer/BudgetAppropriationForm';
import { BudgetAlignmentPanel } from './budget-officer/BudgetAlignmentPanel';
import { BudgetExecutionDashboard } from './budget-officer/BudgetExecutionDashboard';
import { BudgetReleaseForm } from './budget-officer/BudgetReleaseForm';
import { BudgetCommitmentForm } from './budget-officer/BudgetCommitmentForm';
import { BudgetCommitmentLedger } from './budget-officer/BudgetCommitmentLedger';
import { BudgetReleaseLedger } from './budget-officer/BudgetReleaseLedger';
import { hasModuleAction } from './requisitionWorkspace/helpers';

type Props = {
  module: InternalModule;
  token?: string | null;
  role?: RoleKey | null;
};

type ViewType = 'dashboard' | 'queue' | 'ledger' | 'releaseledger' | 'commitments' | 'create' | 'review';

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

  return options;
};

export const BudgetOfficerWorkspacePage = ({ module, token, role }: Props) => {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const activeView = (searchParams.get('view') as ViewType) || 'dashboard';

  const setActiveView = (view: ViewType | SetStateAction<ViewType>) => {
    const nextView = typeof view === 'function' ? (view as any)(activeView) : view;
    const params = new URLSearchParams(searchParams.toString());
    params.set('view', nextView);
    router.push(`${pathname}?${params.toString()}`);
  };

  const [isDecisionModalOpen, setIsDecisionModalOpen] = useState(false);
  const [isAlignmentModalOpen, setIsAlignmentModalOpen] = useState(false);
  const [filters, setFilters] = useState<IBudgetFilters>(defaultFilters);
  const [page, setPage] = useState(1);
  const [dashboard, setDashboard] = useState<BudgetDashboardResponse | null>(null);
  const [queue, setQueue] = useState<BudgetRequisitionQueueItem[]>([]);
  const [total, setTotal] = useState(0);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [selectedRequisitionId, setSelectedRequisitionId] = useState<string | null>(null);
  const [detail, setDetail] = useState<BudgetConfirmationDetail | null>(null);
  const [decisionNote, setDecisionNote] = useState('');
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const [modalError, setModalError] = useState<string | null>(null);
  const [isLoadingQueue, setIsLoadingQueue] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const hasBudgetAuthority = Boolean(token) && (
    hasModuleAction(module, 'budget.confirm') ||
    hasModuleAction(module, 'budget.view') ||
    hasModuleAction(module, 'planning_committee.view')
  );

  const canTakeDecisions = Boolean(token) && hasModuleAction(module, 'budget.confirm');
  const canCreateBudget = hasBudgetAuthority;
  const canViewLedger = hasBudgetAuthority;

  const availableDecisions = useMemo(() => getDecisionOptions(detail) as any[], [detail]);

  const loadQueueAndDashboard = async () => {
    if (!token) {
      setDashboard(null);
      setQueue([]);
      setTotal(0);
      setSelectedPlanId(null);
      setSelectedRequisitionId(null);
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
        fetchBudgetRequisitionQueue(token, {
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
  }, [token, filters.department, filters.fiscalYear, filters.query, filters.stage, page, activeView]);

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

  const handleAppropriationCreated = (response: BudgetAppropriationResponse) => {
    setFeedback(`Appropriation ${response.BudgetCode} added for FY ${response.FiscalYear}.`);
    void loadQueueAndDashboard();
  };

  const handleReleaseCreated = () => {
    setFeedback('Budget release recorded successfully.');
    void loadQueueAndDashboard();
  };

  const handleCommitmentCreated = () => {
    setFeedback('Budget commitment recorded successfully.');
    void loadQueueAndDashboard();
  };

  const selectedRequisition = useMemo(
    () => queue.find((item) => item.RequisitionId === selectedRequisitionId) ?? null,
    [queue, selectedRequisitionId]
  );

  const handleBudgetAligned = () => {
    setFeedback('Budget code aligned. Requisition now waits for APP approval.');
    setIsAlignmentModalOpen(false);
    setSelectedRequisitionId(null);
    void loadQueueAndDashboard();
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
          <p className="plan-muted">
            Monitoring {total} active requisitions for Fiscal Year{' '}
            {filters.fiscalYear.trim() || new Date().getFullYear()}
          </p>
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

      <div className="budget-workspace__topbar">
        <BudgetSubNav
          activeView={activeView}
          onViewChange={(view) => setActiveView(view as SetStateAction<ViewType>)}
          hasSelection={Boolean(selectedPlanId)}
          canCreateBudget={canCreateBudget}
          canViewLedger={canViewLedger}
        />
      </div>

      <main className="budget-workspace__viewport">
          {activeView === 'dashboard' && (
            <div className="budget-view-content animate-fade">
              <BudgetExecutionDashboard dashboard={dashboard} onSelectPlan={onSelectPlan} />
            </div>
          )}

          {activeView === 'queue' && (
            <div className="budget-view-content animate-fade">
              <BudgetFilters
                filters={filters}
                onFilterChange={(next) => {
                  setPage(1);
                  setFilters((prev) => ({ ...prev, ...next }));
                }}
              />
              <BudgetQueue
                queue={queue}
                selectedRequisitionId={selectedRequisitionId}
                onSelectRequisition={(id) => {
                  setSelectedRequisitionId(id);
                  setIsAlignmentModalOpen(true);
                }}
                isLoading={isLoadingQueue}
                page={page}
                total={total}
                onPageChange={setPage}
              />
            </div>
          )}

          {activeView === 'ledger' && (
            <div className="budget-view-content animate-fade">
              <BudgetAppropriationLedger token={token} />
            </div>
          )}

          {activeView === 'releaseledger' && (
            <div className="budget-view-content animate-fade">
              <BudgetReleaseLedger token={token} />
            </div>
          )}

          {activeView === 'commitments' && (
            <div className="budget-view-content animate-fade">
              <BudgetCommitmentLedger token={token} />
            </div>
          )}

          {activeView === 'create' && (
            <div className="budget-view-content animate-fade">
              <div className="budget-create-stack">
                <BudgetAppropriationForm token={token} onSuccess={handleAppropriationCreated} />
                <BudgetReleaseForm token={token} onSuccess={handleReleaseCreated} />
                <BudgetCommitmentForm token={token} onSuccess={handleCommitmentCreated} />
              </div>
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

      <BudgetDecisionPanel
        isOpen={isDecisionModalOpen}
        onClose={() => setIsDecisionModalOpen(false)}
        detail={detail}
        availableDecisions={availableDecisions}
        decisionNote={decisionNote}
        onNoteChange={setDecisionNote}
        onDecision={handleDecision}
        canTakeDecisions={canTakeDecisions}
        isSaving={isSaving}
        error={modalError}
      />
      {isAlignmentModalOpen && selectedRequisition ? (
        <div className="budget-modal-overlay" role="dialog" aria-modal="true" aria-label="Budget alignment">
          <div className="budget-modal-shell">
            <BudgetAlignmentPanel
              token={token}
              requisition={selectedRequisition}
              onAligned={handleBudgetAligned}
              onClose={() => {
                setIsAlignmentModalOpen(false);
                setSelectedRequisitionId(null);
              }}
            />
          </div>
        </div>
      ) : null}
      <style jsx>{`
        .budget-workspace__topbar {
          margin-bottom: 8px;
        }

        .budget-create-stack {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 18px;
        }

        @media (max-width: 1120px) {
          .budget-create-stack {
            grid-template-columns: 1fr;
          }
        }

        .budget-modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.48);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          z-index: 90;
          backdrop-filter: blur(6px);
        }

        .budget-modal-shell {
          width: min(880px, 100%);
          max-height: calc(100vh - 48px);
          overflow: auto;
        }
      `}</style>
    </section>
  );
};
