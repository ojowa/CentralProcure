import React, { useState, useEffect } from 'react';
import type { InternalModule, ProcurementPlanSummary, ProcurementPlanDetail, ProcurementPlanItemDetail, RequisitionSummary, PlanningCommitteeMemberStatus } from '../types/internal';
import { fetchPlanDetails, fetchMemberReviews, fetchMemberStatuses, submitMemberReview, submitCommitteeDecision, createPlanItem, createPlan, fetchProcurementPlans } from '../services/moduleService';
import { fetchRequisitions, updateRequisition, fetchRequisitionDetail } from '../services/requisitionService';

interface Props {
  module: InternalModule;
  token: string | null;
  role: string | null;
  userEmail?: string | null;
  initialData?: any;
}

interface MemberReview {
  ReviewId: string;
  PlanId: string;
  ReviewerRole: string;
  ReviewerUserId: string;
  Decision: string;
  Remarks: string;
  CreatedAt: string;
  UpdatedAt: string;
}

const committeeRoleLabels: Record<string, string> = {
  planning_statistics_officer: 'PSO Reviewed',
  financial_unit_officer: 'Finance Reviewed',
  department_head: 'Technical Reviewed',
  legal_reviewer: 'Legal Reviewed',
  procurement_secretary: 'Secretary Recorded',
  comptroller_procurement: 'Chair Reviewed'
};

const normalizeRole = (value?: string | null) =>
  value ? value.trim().toLowerCase().replace(/[\s-]+/g, '_') : '';

export const PlanningCommitteeReviewModule = ({ module, token, role, userEmail, initialData }: Props) => {
  const [view, setView] = useState<'list' | 'details' | 'requisitions' | 'linked' | 'app-items' | 'workspace'>('workspace');
  const [plans, setPlans] = useState<ProcurementPlanSummary[]>([]);
  const [requisitions, setRequisitions] = useState<RequisitionSummary[]>([]);
  const [linkedRequisitions, setLinkedRequisitions] = useState<RequisitionSummary[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<ProcurementPlanDetail | null>(null);
  const [selectedPlanForItems, setSelectedPlanForItems] = useState('');
  const [appItems, setAppItems] = useState<ProcurementPlanItemDetail[]>([]);
  const [planItems, setPlanItems] = useState<ProcurementPlanItemDetail[]>([]);
  const [memberReviews, setMemberReviews] = useState<MemberReview[]>([]);
  const [memberStatuses, setMemberStatuses] = useState<PlanningCommitteeMemberStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedRequisition, setSelectedRequisition] = useState<RequisitionSummary | null>(null);
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [planMode, setPlanMode] = useState<'create' | 'attach'>('create');
  const [planTitle, setPlanTitle] = useState('');
  const [planFiscalYear, setPlanFiscalYear] = useState(new Date().getFullYear());
  const [selectedPlanId, setSelectedPlanId] = useState('');

  // Review Form state
  const [reviewDecision, setReviewDecision] = useState('Cleared');
  const [reviewRemarks, setReviewRemarks] = useState('');

  // Committee Decision Form state (for Chairman/Secretary)
  const [overallDecision, setOverallDecision] = useState('Recommended');
  const [committeeRemarks, setCommitteeRemarks] = useState('');

  useEffect(() => {
    if (initialData && Array.isArray(initialData)) {
      setPlans(initialData);
    } else if (Array.isArray(initialData?.Items)) {
      setPlans(initialData.Items);
    }
  }, [initialData]);

  useEffect(() => {
    if (!token || !isLinkModalOpen || planMode !== 'attach') {
      return;
    }

    fetchProcurementPlans(token, 'Under Review')
      .then((data) => {
        const items = Array.isArray(data) ? data : data.Items;
        setPlans(items ?? []);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Unable to load procurement plans.'));
  }, [token, isLinkModalOpen, planMode]);

  useEffect(() => {
    if (!token) {
      setRequisitions([]);
      return;
    }
    fetchRequisitions(token, { status: 'Under Review', page: 1, pageSize: 50 })
      .then((response) => {
        const items = response.Items ?? [];
        setRequisitions(items.filter((item) => !item.AppItemId));
        setLinkedRequisitions(items.filter((item) => Boolean(item.AppItemId)));
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Unable to load requisitions.'));
  }, [token]);

  useEffect(() => {
    if (!token || view !== 'app-items') {
      return;
    }

    fetchProcurementPlans(token, 'Under Review')
      .then((data) => {
        const items = Array.isArray(data) ? data : data.Items;
        const plansList = items ?? [];
        setPlans(plansList);
        if (!selectedPlanForItems && plansList.length) {
          setSelectedPlanForItems(plansList[0].PlanId);
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Unable to load procurement plans.'));
  }, [token, view, selectedPlanForItems]);

  useEffect(() => {
    if (!token || view !== 'app-items' || !selectedPlanForItems) {
      setAppItems([]);
      return;
    }

    fetchPlanDetails(selectedPlanForItems, token)
      .then((detailData) => setAppItems(detailData.Items || []))
      .catch((err) => setError(err instanceof Error ? err.message : 'Unable to load APP items.'));
  }, [token, view, selectedPlanForItems]);

  const handleViewDetails = async (planId: string) => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const detailData = await fetchPlanDetails(planId, token);
      const reviews = await fetchMemberReviews(planId, token);
      const statuses = await fetchMemberStatuses(planId, token);
      
      setSelectedPlan(detailData.Plan);
      setPlanItems(detailData.Items || []);
      setMemberReviews(reviews);
      setMemberStatuses(statuses);
      setView('details');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const openLinkModal = (req: RequisitionSummary) => {
    setSelectedRequisition(req);
    setPlanTitle(`${req.Department} Procurement Plan`);
    setPlanFiscalYear(new Date(req.RequiredBy ?? req.CreatedAt).getFullYear());
    setSelectedPlanId('');
    setPlanMode('create');
    setIsLinkModalOpen(true);
    setSuccess(null);
  };

  const openWorkspace = (req: RequisitionSummary) => {
    setSelectedRequisition(req);
    setView('workspace');
  };

  const handleLinkToPlan = async () => {
    if (!token || !selectedRequisition) return;
    setLoading(true);
    setError(null);
    try {
      const reqDetail = await fetchRequisitionDetail(token, selectedRequisition.RequisitionId);
      if (!reqDetail.BudgetCode || !reqDetail.BudgetCode.trim()) {
        throw new Error('Budget code is required before linking to a plan.');
      }

      let planId = selectedPlanId;
      if (planMode === 'create') {
        const createdPlan = await createPlan(
          {
            PlanTitle: planTitle,
            Department: reqDetail.Department,
            FiscalYear: planFiscalYear,
            TotalBudget: reqDetail.TotalEstimate,
            Status: 'Under Review'
          },
          token
        );
        planId = createdPlan.PlanId;
      }

      if (!planId) {
        throw new Error('Select or create a plan.');
      }

      const planItem = await createPlanItem(
        planId,
        {
          ItemCode: null,
          Description: reqDetail.Title,
          BudgetCode: reqDetail.BudgetCode.trim(),
          ProcurementType: reqDetail.ProcurementType,
          EstimatedAmount: reqDetail.TotalEstimate,
          Status: 'Active',
          Notes: 'Created from requisition approval.'
        },
        token
      );

      await updateRequisition(token, selectedRequisition.RequisitionId, {
        AppItemId: planItem.PlanItemId
      });

      setSuccess('Requisition linked to procurement plan.');
      setIsLinkModalOpen(false);
      const refreshed = await fetchRequisitions(token, { status: 'Under Review', page: 1, pageSize: 50 });
      const refreshedItems = refreshed.Items ?? [];
      setRequisitions(refreshedItems.filter((item) => !item.AppItemId));
      setLinkedRequisitions(refreshedItems.filter((item) => Boolean(item.AppItemId)));
      const planDetail = await fetchPlanDetails(planId, token);
      setSelectedPlan(planDetail.Plan);
      setPlanItems(planDetail.Items || []);
      setMemberReviews(await fetchMemberReviews(planId, token));
      setMemberStatuses(await fetchMemberStatuses(planId, token));
      setView('details');
    } catch (err: any) {
      setError(err.message || 'Unable to link requisition to plan.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitMemberReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !selectedPlan || !role || !userEmail) return;
    setLoading(true);
    try {
      await submitMemberReview({
        PlanId: selectedPlan.PlanId,
        ReviewerRole: role,
        ReviewerUserId: userEmail,
        Decision: reviewDecision,
        Remarks: reviewRemarks
      }, token);
      
      // Refresh reviews
      const reviews = await fetchMemberReviews(selectedPlan.PlanId, token);
      setMemberReviews(reviews);
      setMemberStatuses(await fetchMemberStatuses(selectedPlan.PlanId, token));
      setReviewRemarks('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitOverallDecision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !selectedPlan || !userEmail) return;
    setLoading(true);
    try {
      await submitCommitteeDecision({
        PlanId: selectedPlan.PlanId,
        ChairmanUserId: userEmail, // Assuming current user is chairman/secretary for demo
        SecretaryUserId: userEmail,
        OverallDecision: overallDecision,
        CommitteeRemarks: committeeRemarks,
        MeetingDate: new Date().toISOString()
      }, token);
      
      setView('list');
      // Refresh list would be better, but for now just go back
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const isChairman = role === 'comptroller_procurement' || role === 'accounting_officer' || role === 'procurement_manager' || role === 'admin';

  const reviewStatusMap = memberReviews.reduce<Record<string, MemberReview>>((acc, review) => {
    const key = normalizeRole(review.ReviewerRole);
    if (!key) {
      return acc;
    }
    acc[key] = review;
    return acc;
  }, {});

  const statusMap = memberStatuses.reduce<Record<string, PlanningCommitteeMemberStatus>>((acc, status) => {
    const key = normalizeRole(status.RoleKey);
    if (!key) {
      return acc;
    }
    acc[key] = status;
    return acc;
  }, {});

  return (
    <section className="portal-module planning-committee">
      <header className="portal-module__header planning-committee__header">
        <div>
          <h2>Planning Committee Review</h2>
          <p className="plan-muted">Link requisitions to APP lines, record committee decisions, and move the plan forward.</p>
        </div>
        <div className="planning-committee__tabs">
          <button className={`plan-tab ${view === 'workspace' ? 'plan-tab--active' : ''}`} onClick={() => setView('workspace')}>Workspace</button>
          <button className={`plan-tab ${view === 'requisitions' ? 'plan-tab--active' : ''}`} onClick={() => setView('requisitions')}>Pending</button>
          <button className={`plan-tab ${view === 'linked' ? 'plan-tab--active' : ''}`} onClick={() => setView('linked')}>Linked</button>
          <button className={`plan-tab ${view === 'app-items' ? 'plan-tab--active' : ''}`} onClick={() => setView('app-items')}>APP Items</button>
        </div>
      </header>

      {error && <div className="portal-alert">{error}</div>}
      {success && <div className="plan-loading">{success}</div>}

      {view === 'list' && null}

      {view === 'requisitions' && (
        <div className="portal-table-container">
          <table className="portal-table">
            <thead>
              <tr>
                <th>Required By</th>
                <th>Title</th>
                <th>Department</th>
                <th>Status</th>
                <th>Total Estimate</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {requisitions.map(r => (
                <tr key={r.RequisitionId}>
                  <td>{r.RequiredBy ? new Date(r.RequiredBy).toLocaleDateString() : '—'}</td>
                  <td>{r.Title}</td>
                  <td>{r.Department}</td>
                  <td><span className={`plan-badge plan-badge--${r.Status.toLowerCase()}`}>{r.Status}</span></td>
                  <td>{new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(r.TotalEstimate)}</td>
                  <td>
                    <button
                      className="plan-button plan-button--sm"
                      onClick={() => openLinkModal(r)}
                      disabled={Boolean(r.AppItemId)}
                    >
                      Create / Attach Plan
                    </button>
                    <button className="plan-button plan-button--sm plan-button--secondary" onClick={() => openWorkspace(r)}>
                      Open Workspace
                    </button>
                  </td>
                </tr>
              ))}
              {requisitions.length === 0 && (
                <tr>
                  <td colSpan={6} className="plan-empty">No requisitions awaiting committee linkage.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {view === 'linked' && (
        <div className="portal-table-container">
          <table className="portal-table">
            <thead>
              <tr>
                <th>Required By</th>
                <th>Title</th>
                <th>Department</th>
                <th>Status</th>
                <th>Total Estimate</th>
                <th>APP Item</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {linkedRequisitions.map(r => (
                <tr key={r.RequisitionId}>
                  <td>{r.RequiredBy ? new Date(r.RequiredBy).toLocaleDateString() : '—'}</td>
                  <td>{r.Title}</td>
                  <td>{r.Department}</td>
                  <td><span className={`plan-badge plan-badge--${r.Status.toLowerCase()}`}>{r.Status}</span></td>
                  <td>{new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(r.TotalEstimate)}</td>
                  <td>{r.AppItemDescription ?? r.AppItemId ?? '—'}</td>
                  <td>
                    <button className="plan-button plan-button--sm plan-button--secondary" onClick={() => openWorkspace(r)}>
                      Open Workspace
                    </button>
                  </td>
                </tr>
              ))}
              {linkedRequisitions.length === 0 && (
                <tr>
                  <td colSpan={7} className="plan-empty">No linked requisitions yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {view === 'app-items' && (
        <div>
          <div className="plan-form-grid" style={{ marginBottom: '16px' }}>
            <label className="plan-field">
              <span>Select Plan</span>
              <select
                className="plan-input"
                value={selectedPlanForItems}
                onChange={(e) => setSelectedPlanForItems(e.target.value)}
              >
                <option value="">Select plan</option>
                {plans.map((p) => (
                  <option key={p.PlanId} value={p.PlanId}>
                    {p.PlanTitle} ({p.FiscalYear})
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="portal-table-container">
            <table className="portal-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Description</th>
                  <th>Budget Code</th>
                  <th>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {appItems.map((item) => (
                  <tr key={item.PlanItemId}>
                    <td>{item.ItemCode ?? '—'}</td>
                    <td>{item.Description}</td>
                    <td>{item.BudgetCode}</td>
                    <td>{new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(item.EstimatedAmount)}</td>
                    <td><span className={`plan-badge plan-badge--${item.Status.toLowerCase()}`}>{item.Status}</span></td>
                  </tr>
                ))}
                {appItems.length === 0 && (
                  <tr>
                    <td colSpan={5} className="plan-empty">No APP items found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {view === 'workspace' && (
        <div className="planning-committee__workspace">
          <div className="planning-committee__queue">
            <div className="planning-committee__queue-header">
              <h4>Queue</h4>
              <span className="plan-muted">Under Review</span>
            </div>
            <div className="plan-mini-list">
              {[...requisitions, ...linkedRequisitions].map((req) => (
                <button
                  key={req.RequisitionId}
                  className={`queue-card ${selectedRequisition?.RequisitionId === req.RequisitionId ? 'queue-card--active' : ''}`}
                  onClick={() => setSelectedRequisition(req)}
                >
                  <div>
                    <strong>{req.Title}</strong>
                    <div className="plan-muted">{req.Department}</div>
                  </div>
                  <span className={`queue-pill ${req.AppItemId ? 'queue-pill--linked' : 'queue-pill--pending'}`}>
                    {req.AppItemId ? 'Linked' : 'Pending'}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="planning-committee__workbench">
            <div className="workbench-hero">
              <div>
                <div className="workbench-kicker">Requisition</div>
                <h3>{selectedRequisition?.Title ?? 'Select a requisition from the queue'}</h3>
                <div className="workbench-meta">
                  <span>{selectedRequisition?.Department ?? '—'}</span>
                  <span>{selectedRequisition?.Status ?? '—'}</span>
                  <span>{selectedRequisition ? new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(selectedRequisition.TotalEstimate) : '—'}</span>
                </div>
              </div>
              <div className="workbench-actions">
                <button
                  className="plan-button"
                  onClick={() => selectedRequisition && openLinkModal(selectedRequisition)}
                  disabled={!selectedRequisition || Boolean(selectedRequisition.AppItemId)}
                >
                  Create / Attach Plan
                </button>
                <span className={`plan-badge ${selectedRequisition?.AppItemId ? 'plan-badge--approved' : 'plan-badge--pending'}`}>
                  {selectedRequisition?.AppItemId ? 'Linked' : 'Pending'}
                </span>
              </div>
            </div>

            <div className="workbench-grid">
              <div className="workbench-card">
                <h4>Plan Link Guidance</h4>
                <p className="plan-muted">Only APP items under an Under Review plan are eligible for linking.</p>
                <ul className="workbench-list">
                  <li>Confirm budget code matches the requisition line.</li>
                  <li>Ensure the APP item is Active before linking.</li>
                  <li>Linked requisitions appear in the Linked tab.</li>
                </ul>
              </div>
              <div className="workbench-card">
                <h4>Committee Checklist</h4>
                <p className="plan-muted">Record reviews before final committee decision.</p>
                <ul className="workbench-list">
                  <li>Verify scope and justification.</li>
                  <li>Confirm estimate aligns with budget.</li>
                  <li>Document remarks for the record.</li>
                </ul>
              </div>
            </div>
          </div>

          <aside className="planning-committee__review">
            <h4>Committee Review</h4>
            <p className="plan-muted">Submit member remarks or the final decision.</p>
            <div className="committee-status">
              {Object.entries(committeeRoleLabels).map(([roleKey, label]) => {
                const status = statusMap[roleKey];
                const review = reviewStatusMap[roleKey];
                return (
                  <div key={roleKey} className="committee-status__row">
                    <span>{label}</span>
                    <span className={`committee-pill ${(status?.Decision || review) ? 'committee-pill--done' : 'committee-pill--pending'}`}>
                      {status?.Decision ?? review?.Decision ?? 'Pending'}
                    </span>
                  </div>
                );
              })}
            </div>
            <form onSubmit={handleSubmitMemberReview}>
              <label className="plan-field">
                <span>Your Decision</span>
                <select className="plan-input" value={reviewDecision} onChange={e => setReviewDecision(e.target.value)}>
                  <option value="Cleared">Cleared</option>
                  <option value="Queried">Queried</option>
                  <option value="Rejected">Rejected</option>
                </select>
              </label>
              <label className="plan-field">
                <span>Remarks</span>
                <textarea
                  className="plan-input"
                  rows={3}
                  required
                  value={reviewRemarks}
                  onChange={e => setReviewRemarks(e.target.value)}
                  placeholder="Provide justification for your decision..."
                />
              </label>
              <button type="submit" className="plan-button" style={{ width: '100%' }} disabled={loading}>Submit Review</button>
            </form>

            {isChairman && (
              <form onSubmit={handleSubmitOverallDecision} style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid #e2e8f0' }}>
                <h4>Final Decision</h4>
                <label className="plan-field">
                  <span>Overall Decision</span>
                  <select className="plan-input" value={overallDecision} onChange={e => setOverallDecision(e.target.value)}>
                    <option value="Recommended">Recommended for Approval</option>
                    <option value="Returned">Return to Department</option>
                    <option value="Rejected">Rejected</option>
                  </select>
                </label>
                <label className="plan-field">
                  <span>Committee Remarks</span>
                  <textarea
                    className="plan-input"
                    rows={3}
                    required
                    value={committeeRemarks}
                    onChange={e => setCommitteeRemarks(e.target.value)}
                    placeholder="Summary of committee findings..."
                  />
                </label>
                <button type="submit" className="plan-button plan-button--success" style={{ width: '100%' }} disabled={loading}>
                  Finalize Review
                </button>
              </form>
            )}
          </aside>
        </div>
      )}

      {view === 'details' && selectedPlan && (
        <div className="plan-details-view">
          <div className="plan-summary-card">
            <div className="plan-summary-card__grid">
              <div>
                <small>Plan Title</small>
                <p><strong>{selectedPlan.PlanTitle}</strong></p>
              </div>
              <div>
                <small>Department</small>
                <p>{selectedPlan.Department}</p>
              </div>
              <div>
                <small>Fiscal Year</small>
                <p>{selectedPlan.FiscalYear}</p>
              </div>
              <div>
                <small>Total Budget</small>
                <p>{new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(selectedPlan.TotalBudget)}</p>
              </div>
            </div>
          </div>

          <div className="portal-grid" style={{ gridTemplateColumns: '1fr 350px', gap: '24px', marginTop: '24px' }}>
            <div>
              <h3>APP Line Items</h3>
              <div className="portal-table-container">
                <table className="portal-table">
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Description</th>
                      <th>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {planItems.map(item => (
                      <tr key={item.PlanItemId}>
                        <td>{item.ItemCode}</td>
                        <td>{item.Description}</td>
                        <td>{new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(item.EstimatedAmount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ marginTop: '32px' }}>
                <h3>Committee Member Remarks</h3>
                {memberReviews.length === 0 ? (
                  <p className="plan-empty">No member remarks yet.</p>
                ) : (
                  <div className="portal-timeline" style={{ padding: '16px', background: '#f8f9fa', borderRadius: '8px' }}>
                    {memberReviews.map(r => (
                      <div key={r.ReviewId} style={{ marginBottom: '16px', borderBottom: '1px solid #dee2e6', paddingBottom: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <strong>{r.ReviewerRole.replace(/_/g, ' ').toUpperCase()}</strong>
                          <span className={`plan-badge plan-badge--${r.Decision.toLowerCase()}`}>{r.Decision}</span>
                        </div>
                        <p style={{ margin: '4px 0', fontSize: '14px' }}>{r.Remarks}</p>
                        <small style={{ color: '#6c757d' }}>{new Date(r.UpdatedAt).toLocaleString()}</small>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <aside className="portal-sidebar-box" style={{ background: '#fff', padding: '20px', borderRadius: '8px', border: '1px solid #e0e0e0' }}>
              <form onSubmit={handleSubmitMemberReview}>
                <h4>Submit Your Review</h4>
                <label className="plan-field">
                  <span>Your Decision</span>
                  <select className="plan-input" value={reviewDecision} onChange={e => setReviewDecision(e.target.value)}>
                    <option value="Cleared">Cleared</option>
                    <option value="Queried">Queried</option>
                    <option value="Rejected">Rejected</option>
                  </select>
                </label>
                <label className="plan-field">
                  <span>Remarks</span>
                  <textarea 
                    className="plan-input" 
                    rows={4} 
                    required 
                    value={reviewRemarks}
                    onChange={e => setReviewRemarks(e.target.value)}
                    placeholder="Provide justification for your decision..."
                  />
                </label>
                <button type="submit" className="plan-button" style={{ width: '100%' }} disabled={loading}>Submit Review</button>
              </form>

              {isChairman && (
                <form onSubmit={handleSubmitOverallDecision} style={{ marginTop: '32px', paddingTop: '24px', borderTop: '2px dashed #eee' }}>
                  <h4>Final Committee Decision</h4>
                  <p style={{ fontSize: '12px', color: '#666', marginBottom: '16px' }}>Only Chairman/Secretary can submit the final decision.</p>
                  <label className="plan-field">
                    <span>Overall Decision</span>
                    <select className="plan-input" value={overallDecision} onChange={e => setOverallDecision(e.target.value)}>
                      <option value="Recommended">Recommended for Approval</option>
                      <option value="Returned">Return to Department</option>
                      <option value="Rejected">Rejected</option>
                    </select>
                  </label>
                  <label className="plan-field">
                    <span>Committee Remarks</span>
                    <textarea 
                      className="plan-input" 
                      rows={3} 
                      required 
                      value={committeeRemarks}
                      onChange={e => setCommitteeRemarks(e.target.value)}
                      placeholder="Summary of committee findings..."
                    />
                  </label>
                  <button type="submit" className="plan-button plan-button--success" style={{ width: '100%' }} disabled={loading}>Finalize Review Session</button>
                </form>
              )}
            </aside>
          </div>
        </div>
      )}

      {isLinkModalOpen && selectedRequisition && (
        <div className="plan-modal" role="dialog" aria-modal="true">
          <div className="plan-modal__backdrop" onClick={() => setIsLinkModalOpen(false)} />
          <div className="plan-modal__content">
            <div className="requisition-card__header">
              <div>
                <h3>Create or Attach Procurement Plan</h3>
                <p>Link requisition to a procurement plan for committee review.</p>
              </div>
              <button type="button" className="plan-link" onClick={() => setIsLinkModalOpen(false)}>Close</button>
            </div>
            {error && <div className="portal-alert" style={{ marginTop: '12px' }}>{error}</div>}
            <div className="plan-form-grid" style={{ marginTop: '12px' }}>
              <label className="plan-field">
                <span>Plan Mode</span>
                <select className="plan-input" value={planMode} onChange={(e) => setPlanMode(e.target.value as 'create' | 'attach')}>
                  <option value="create">Create New Plan</option>
                  <option value="attach">Attach to Existing Plan</option>
                </select>
              </label>
              {planMode === 'create' ? (
                <>
                  <label className="plan-field">
                    <span>Plan Title</span>
                    <input className="plan-input" value={planTitle} onChange={(e) => setPlanTitle(e.target.value)} />
                  </label>
                  <label className="plan-field">
                    <span>Fiscal Year</span>
                    <input className="plan-input" type="number" value={planFiscalYear} onChange={(e) => setPlanFiscalYear(Number(e.target.value))} />
                  </label>
                </>
              ) : (
                <label className="plan-field">
                  <span>Select Plan</span>
                  <select className="plan-input" value={selectedPlanId} onChange={(e) => setSelectedPlanId(e.target.value)}>
                    <option value="">Select plan</option>
                    {plans
                      .filter((p) => p.Status === 'Under Review')
                      .map(p => (
                      <option key={p.PlanId} value={p.PlanId}>{p.PlanTitle} ({p.FiscalYear})</option>
                    ))}
                  </select>
                </label>
              )}
            </div>
            <div className="plan-actions" style={{ marginTop: '16px' }}>
              <button className="plan-button" onClick={() => void handleLinkToPlan()} disabled={loading}>
                Link Requisition
              </button>
              <button className="plan-button plan-button--secondary" onClick={() => setIsLinkModalOpen(false)} disabled={loading}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .planning-committee__header {
          align-items: center;
          border-bottom: 1px solid var(--portal-border);
          padding-bottom: 16px;
        }

        .planning-committee__tabs {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .plan-tab {
          border: 1px solid var(--portal-border);
          background: #fff;
          padding: 8px 14px;
          border-radius: 999px;
          font-weight: 600;
          font-size: 0.9rem;
          color: var(--portal-ink);
          cursor: pointer;
        }

        .plan-tab--active {
          background: #0f172a;
          color: #fff;
          border-color: #0f172a;
        }

        .planning-committee__workspace {
          display: grid;
          grid-template-columns: 300px 1fr 360px;
          gap: 20px;
        }

        .planning-committee__queue,
        .planning-committee__review {
          background: #fff;
          border: 1px solid var(--portal-border);
          border-radius: 18px;
          padding: 16px;
        }

        .planning-committee__queue-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }

        .queue-card {
          width: 100%;
          border: 1px solid var(--portal-border);
          background: #f8fafc;
          border-radius: 14px;
          padding: 12px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
          text-align: left;
          cursor: pointer;
        }

        .queue-card + .queue-card {
          margin-top: 8px;
        }

        .queue-card--active {
          border-color: #0f172a;
          background: #eef2ff;
        }

        .queue-pill {
          font-size: 0.75rem;
          padding: 4px 10px;
          border-radius: 999px;
          font-weight: 600;
        }

        .queue-pill--pending {
          background: #fef3c7;
          color: #92400e;
        }

        .queue-pill--linked {
          background: #dcfce7;
          color: #166534;
        }

        .planning-committee__workbench {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .workbench-hero {
          background: linear-gradient(135deg, #f1f5f9, #ffffff);
          border: 1px solid var(--portal-border);
          border-radius: 22px;
          padding: 20px;
          display: flex;
          justify-content: space-between;
          gap: 16px;
          align-items: flex-start;
        }

        .workbench-kicker {
          text-transform: uppercase;
          letter-spacing: 0.08em;
          font-size: 0.7rem;
          color: #64748b;
          margin-bottom: 6px;
        }

        .workbench-meta {
          display: flex;
          gap: 16px;
          flex-wrap: wrap;
          font-size: 0.85rem;
          color: #334155;
        }

        .workbench-actions {
          display: flex;
          flex-direction: column;
          gap: 10px;
          align-items: flex-end;
        }

        .workbench-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 16px;
        }

        .workbench-card {
          background: #fff;
          border: 1px solid var(--portal-border);
          border-radius: 18px;
          padding: 16px;
        }

        .workbench-list {
          margin: 12px 0 0;
          padding-left: 18px;
          color: #475569;
        }

        .committee-status {
          display: grid;
          gap: 8px;
          margin: 12px 0 16px;
        }

        .committee-status__row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 10px;
          border-radius: 10px;
          background: #f8fafc;
          border: 1px solid var(--portal-border);
          font-size: 0.85rem;
        }

        .committee-pill {
          font-size: 0.7rem;
          padding: 4px 10px;
          border-radius: 999px;
          font-weight: 600;
        }

        .committee-pill--pending {
          background: #fef3c7;
          color: #92400e;
        }

        .committee-pill--done {
          background: #dcfce7;
          color: #166534;
        }

        @media (max-width: 1200px) {
          .planning-committee__workspace {
            grid-template-columns: 1fr;
          }
          .workbench-actions {
            align-items: flex-start;
          }
        }
      `}</style>
    </section>
  );
};
