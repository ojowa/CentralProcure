import React, { useState, useEffect } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { InternalModule, ProcurementPlanSummary, ProcurementPlanDetail, ProcurementPlanItemDetail } from '../types/internal';
import { fetchPlanDetails } from '../services/moduleService';
import { decideProcurementPlanApproval, initiateProcurementPlan } from '../services/procurementPlanService';

interface Props {
  module: InternalModule;
  token: string | null;
  role?: string | null;
  initialData?: any;
}

export const ProcurementPlanModule = ({ module, token, role, initialData }: Props) => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [view, setView] = useState<'list' | 'details'>('list');
  const [plans, setPlans] = useState<ProcurementPlanSummary[]>(Array.isArray(initialData) ? initialData : []);
  const [selectedPlan, setSelectedPlan] = useState<ProcurementPlanDetail | null>(null);
  const [planItems, setPlanItems] = useState<ProcurementPlanItemDetail[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [approvalNote, setApprovalNote] = useState('');
  const [query, setQuery] = useState('');
  const [thresholdSummary, setThresholdSummary] = useState<string | null>(null);
  const canTakeApprovalDecision =
    role === 'comptroller_procurement' || role === 'accounting_officer' || role === 'admin';
  const isAwaitingAppApproval = selectedPlan?.CurrentStageKey === 'app_approval';
  const isAtProcurementInitiation = selectedPlan?.CurrentStageKey === 'procurement_initiation';

  useEffect(() => {
    if (initialData && Array.isArray(initialData)) {
      setPlans(initialData);
    }
  }, [initialData]);

  useEffect(() => {
    const planId = searchParams.get('planId');
    const requestedView = searchParams.get('view');

    if (planId && token) {
      void handleViewDetails(planId, false);
      return;
    }

    if (!planId) {
      setView('list');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, token]);

  const filteredPlans = plans.filter((plan) => {
    const needle = query.trim().toLowerCase();
    if (!needle) return true;
    return (
      plan.PlanTitle.toLowerCase().includes(needle) ||
      plan.Department.toLowerCase().includes(needle) ||
      plan.Status.toLowerCase().includes(needle) ||
      String(plan.FiscalYear).includes(needle)
    );
  });

  const statusCounts = plans.reduce<Record<string, number>>((acc, plan) => {
    acc[plan.Status] = (acc[plan.Status] ?? 0) + 1;
    return acc;
  }, {});

  const handleViewDetails = async (planId: string, pushUrl = true) => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchPlanDetails(planId, token);
      setSelectedPlan(data.Plan);
      setPlanItems(data.Items || []);
      setThresholdSummary(null);
      setView('details');
      if (pushUrl) {
        router.replace(`${pathname}?planId=${encodeURIComponent(planId)}&view=details`, { scroll: false });
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleApprovalDecision = async (decision: 'approve' | 'return' | 'reject') => {
    if (!token || !selectedPlan) return;

    const confirmed = window.confirm(
      `${decision === 'approve' ? 'Approve' : decision === 'return' ? 'Return' : 'Reject'} APP "${selectedPlan.PlanTitle}"?`
    );
    if (!confirmed) return;

    setLoading(true);
    setError(null);
    setFeedback(null);
    setThresholdSummary(null);
    try {
      const result = await decideProcurementPlanApproval(token, selectedPlan.PlanId, {
        Decision: decision,
        Note: approvalNote.trim() || undefined
      });

      setFeedback(result.Message);
      const refreshed = await fetchPlanDetails(selectedPlan.PlanId, token);
      setSelectedPlan(refreshed.Plan);
      setPlanItems(refreshed.Items || []);
      setApprovalNote('');
      setPlans((current) =>
        current.map((plan) =>
          plan.PlanId === selectedPlan.PlanId
            ? { ...plan, Status: result.PlanStatus }
            : plan
        )
      );
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleInitiateProcurement = async () => {
    if (!token || !selectedPlan) return;

    const confirmed = window.confirm(`Move APP "${selectedPlan.PlanTitle}" from Procurement Initiation to Threshold Resolution?`);
    if (!confirmed) return;

    setLoading(true);
    setError(null);
    setFeedback(null);
    try {
      const result = await initiateProcurementPlan(token, selectedPlan.PlanId);
      setFeedback(result.Message);
      setThresholdSummary(
        result.ApprovalAuthorityLabel || result.ApprovalRoute
          ? `Threshold route: ${result.ApprovalAuthorityLabel || result.ApprovalRoute}`
          : 'Threshold route resolved.'
      );
      const refreshed = await fetchPlanDetails(selectedPlan.PlanId, token);
      setSelectedPlan(refreshed.Plan);
      setPlanItems(refreshed.Items || []);
      setPlans((current) =>
        current.map((plan) =>
          plan.PlanId === selectedPlan.PlanId
            ? { ...plan, Status: refreshed.Plan.Status }
            : plan
        )
      );
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="portal-module">
      <header className="portal-module__header">
        <div>
          <h2>{module.title}</h2>
          <p>{module.description}</p>
        </div>
        {view !== 'list' && (
          <button className="plan-button plan-button--secondary" onClick={() => {
            setView('list');
            setSelectedPlan(null);
            setPlanItems([]);
            router.replace(pathname, { scroll: false });
          }}>Back to List</button>
        )}
      </header>

      {error && <div className="portal-alert">{error}</div>}
      {feedback && <div className="plan-success">{feedback}</div>}

      {view === 'list' && (
        <>
          <div className="portal-form-grid" style={{ marginBottom: '16px' }}>
            <div className="portal-stat-card">
              <span className="portal-stat-card__label">Total APPs</span>
              <strong>{plans.length}</strong>
            </div>
            <div className="portal-stat-card">
              <span className="portal-stat-card__label">Under Review</span>
              <strong>{statusCounts['Under Review'] ?? 0}</strong>
            </div>
            <div className="portal-stat-card">
              <span className="portal-stat-card__label">Approved</span>
              <strong>{statusCounts['Approved'] ?? 0}</strong>
            </div>
            <div className="portal-stat-card">
              <span className="portal-stat-card__label">Rejected</span>
              <strong>{statusCounts['Rejected'] ?? 0}</strong>
            </div>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <input
              className="plan-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search APP by title, department, status, or year"
            />
          </div>

          <div className="portal-table-container">
            <table className="portal-table">
              <thead>
                <tr>
                  <th>Fiscal Year</th>
                  <th>APP Title</th>
                  <th>Department</th>
                  <th>Status</th>
                  <th>Total Budget</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredPlans.map(p => (
                  <tr key={p.PlanId}>
                    <td><strong>{p.FiscalYear}</strong></td>
                    <td>{p.PlanTitle}</td>
                    <td>{p.Department}</td>
                    <td><span className={`plan-badge plan-badge--${p.Status.toLowerCase()}`}>{p.Status}</span></td>
                    <td>{new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(p.TotalBudget)}</td>
                    <td>
                      <button className="plan-button plan-button--sm" onClick={() => void handleViewDetails(p.PlanId)}>Open APP</button>
                    </td>
                  </tr>
                ))}
                {filteredPlans.length === 0 && (
                  <tr>
                    <td colSpan={6} className="plan-empty">No APPs match your search.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {view === 'details' && selectedPlan && (
        <div className="plan-details-view">
          <div className="plan-summary-card">
            <div className="plan-summary-card__grid">
              <div>
                <small>Fiscal Year</small>
                <p>{selectedPlan.FiscalYear}</p>
              </div>
              <div>
                <small>Status</small>
                <p><span className={`plan-badge plan-badge--${selectedPlan.Status.toLowerCase()}`}>{selectedPlan.Status}</span></p>
              </div>
              <div>
                <small>Current Workflow Stage</small>
                <p>{selectedPlan.CurrentStageTitle || selectedPlan.CurrentStageKey || 'Not available'}</p>
              </div>
              <div>
                <small>Total Estimated Budget</small>
                <p><strong>{new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(selectedPlan.TotalBudget)}</strong></p>
              </div>
            </div>
          </div>

          {canTakeApprovalDecision ? (
            <div className="portal-module-card" style={{ marginTop: '16px' }}>
              <h3>APP Approval Decision</h3>
              <p className="plan-muted">
                {isAwaitingAppApproval
                  ? 'This plan is awaiting APP approval. Record your decision below.'
                  : 'This plan is not currently in APP Approval stage.'}
              </p>
              <label className="plan-field" style={{ marginTop: '12px' }}>
                <span>Approval Note</span>
                <textarea
                  className="plan-input"
                  rows={3}
                  value={approvalNote}
                  onChange={(event) => setApprovalNote(event.target.value)}
                  placeholder="Record approval rationale, return instruction, or rejection reason."
                  disabled={loading || !isAwaitingAppApproval}
                />
              </label>
              <div className="portal-form-actions">
                <button
                  type="button"
                  className="plan-button"
                  disabled={loading || !isAwaitingAppApproval}
                  onClick={() => void handleApprovalDecision('approve')}
                >
                  Approve APP
                </button>
                <button
                  type="button"
                  className="plan-button plan-button--secondary"
                  disabled={loading || !isAwaitingAppApproval}
                  onClick={() => void handleApprovalDecision('return')}
                >
                  Return APP
                </button>
                <button
                  type="button"
                  className="plan-button plan-button--ghost"
                  disabled={loading || !isAwaitingAppApproval}
                  onClick={() => void handleApprovalDecision('reject')}
                >
                  Reject APP
                </button>
              </div>
            </div>
          ) : null}

          {canTakeApprovalDecision ? (
            <div className="portal-module-card" style={{ marginTop: '16px' }}>
              <h3>Procurement Initiation</h3>
              <p className="plan-muted">
                {isAtProcurementInitiation
                  ? 'This APP has been approved. Move it into Threshold Resolution to determine the live approval route.'
                  : 'This step becomes available after APP approval moves the plan into Procurement Initiation.'}
              </p>
              {thresholdSummary ? <p className="plan-muted" style={{ marginTop: '8px' }}>{thresholdSummary}</p> : null}
              <div className="portal-form-actions">
                <button
                  type="button"
                  className="plan-button"
                  disabled={loading || !isAtProcurementInitiation}
                  onClick={() => void handleInitiateProcurement()}
                >
                  Resolve Threshold Route
                </button>
              </div>
            </div>
          ) : null}

          <div className="plan-items-section">
            <h3>APP Line Items</h3>
            <p className="plan-muted" style={{ marginBottom: '12px' }}>
              APP line items are created automatically from requisitions that have received final committee approval.
            </p>
            <table className="portal-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Description</th>
                  <th>Procurement Type</th>
                  <th>Estimated Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {planItems.map(item => (
                  <tr key={item.PlanItemId}>
                    <td>{item.ItemCode}</td>
                    <td>{item.Description}</td>
                    <td>{item.ProcurementType}</td>
                    <td>{new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(item.EstimatedAmount)}</td>
                    <td>{item.Status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
};
