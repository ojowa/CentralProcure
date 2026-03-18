import React, { useState, useEffect } from 'react';
import type { InternalModule, ProcurementPlanSummary, ProcurementPlanDetail, ProcurementPlanItemDetail } from '../types/internal';
import { fetchPlanDetails, fetchMemberReviews, submitMemberReview, submitCommitteeDecision } from '../services/moduleService';

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

export const PlanningCommitteeReviewModule = ({ module, token, role, userEmail, initialData }: Props) => {
  const [view, setView] = useState<'list' | 'details'>('list');
  const [plans, setPlans] = useState<ProcurementPlanSummary[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<ProcurementPlanDetail | null>(null);
  const [planItems, setPlanItems] = useState<ProcurementPlanItemDetail[]>([]);
  const [memberReviews, setMemberReviews] = useState<MemberReview[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const handleViewDetails = async (planId: string) => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const detailData = await fetchPlanDetails(planId, token);
      const reviews = await fetchMemberReviews(planId, token);
      
      setSelectedPlan(detailData.Plan);
      setPlanItems(detailData.Items || []);
      setMemberReviews(reviews);
      setView('details');
    } catch (err: any) {
      setError(err.message);
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

  const isChairman = role === 'accounting_officer' || role === 'procurement_manager' || role === 'admin';

  return (
    <section className="portal-module">
      <header className="portal-module__header">
        <div>
          <h2>{module.title}</h2>
          <p>{module.description}</p>
        </div>
        {view === 'details' && (
          <button className="plan-button plan-button--secondary" onClick={() => setView('list')}>Back to List</button>
        )}
      </header>

      {error && <div className="portal-alert">{error}</div>}

      {view === 'list' && (
        <div className="portal-table-container">
          <table className="portal-table">
            <thead>
              <tr>
                <th>Fiscal Year</th>
                <th>Title</th>
                <th>Department</th>
                <th>Status</th>
                <th>Total Budget</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {plans.map(p => (
                <tr key={p.PlanId}>
                  <td><strong>{p.FiscalYear}</strong></td>
                  <td>{p.PlanTitle}</td>
                  <td>{p.Department}</td>
                  <td><span className={`plan-badge plan-badge--${p.Status.toLowerCase()}`}>{p.Status}</span></td>
                  <td>{new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(p.TotalBudget)}</td>
                  <td>
                    <button className="plan-button plan-button--sm" onClick={() => handleViewDetails(p.PlanId)}>Review Plan</button>
                  </td>
                </tr>
              ))}
              {plans.length === 0 && (
                <tr>
                  <td colSpan={6} className="plan-empty">No procurement plans awaiting committee review.</td>
                </tr>
              )}
            </tbody>
          </table>
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
    </section>
  );
};
