import React, { useState, useEffect } from 'react';
import type { InternalModule, AssignedTenderItem } from '../types/internal';
import { fetchAssignedTenders, fetchTenderBids, logEvaluationAction } from '../services/moduleService';

interface Props {
  module: InternalModule;
  token: string | null;
  role?: string | null;
  initialData?: any;
}

export const EvaluationScoringModule = ({ module, token, role, initialData }: Props) => {
  const [view, setView] = useState<'list' | 'evaluate'>('list');
  const [assignedTenders, setAssignedTenders] = useState<AssignedTenderItem[]>([]);
  const [selectedTender, setSelectedTender] = useState<AssignedTenderItem | null>(null);
  const [bids, setBids] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Action Form State
  const [actionForm, setActionForm] = useState({
    ActionType: 'StartEvaluation',
    Reason: '',
    Notes: '',
    Justification: '',
    Recommendation: 'Qualified',
    ThresholdNote: ''
  });

  useEffect(() => {
    if (initialData && Array.isArray(initialData)) {
      setAssignedTenders(initialData);
    } else if (token) {
      loadTenders();
    }
  }, [initialData, token]);

  useEffect(() => {
    if (!assignedTenders.length || typeof window === 'undefined') {
      return;
    }

    const focusTenderId = window.sessionStorage.getItem('assignedTenderFocusId');
    if (!focusTenderId) {
      return;
    }

    const focusedTender = assignedTenders.find((item) => item.TenderId === focusTenderId);
    if (!focusedTender) {
      window.sessionStorage.removeItem('assignedTenderFocusId');
      return;
    }

    window.sessionStorage.removeItem('assignedTenderFocusId');
    void handleSelectTender(focusedTender);
  }, [assignedTenders]);

  const loadTenders = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await fetchAssignedTenders(token);
      setAssignedTenders(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectTender = async (tender: AssignedTenderItem) => {
    if (!token) return;
    setLoading(true);
    try {
      // Note: API might not have this specific bids endpoint yet,
      // but we prepare the UI for it.
      try {
        const bidData = await fetchTenderBids(tender.TenderId, token);
        setBids(bidData || []);
      } catch {
        setBids([]); // Fallback if endpoint missing
      }
      setSelectedTender(tender);
      setView('evaluate');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !selectedTender) return;
    setLoading(true);
    try {
      await logEvaluationAction({
        ...actionForm,
        TenderId: selectedTender.TenderId,
        ReportCode: selectedTender.ReportCode
      }, token);
      setError(null);
      alert('Action logged successfully');
      loadTenders();
      setView('list');
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
          <button className="plan-button plan-button--secondary" onClick={() => setView('list')}>Back to Assignments</button>
        )}
      </header>

      {error && <div className="portal-alert">{error}</div>}

      {view === 'list' && (
        <div className="portal-table-container">
          <table className="portal-table">
            <thead>
              <tr>
                <th>Report Code</th>
                <th>Tender Title</th>
                <th>Category</th>
                <th>Status</th>
                <th>Deadline</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {assignedTenders.map(t => (
                <tr key={t.ReportCode}>
                  <td><strong>{t.ReportCode}</strong></td>
                  <td>{t.TenderTitle}</td>
                  <td>{t.ProcurementCategory}</td>
                  <td>{t.EvaluationStatus.toLowerCase() === 'pending' ? 'Not Started' : t.EvaluationStatus}</td>
                  <td>{t.SubmissionDeadline ? new Date(t.SubmissionDeadline).toLocaleDateString() : 'N/A'}</td>
                  <td>
                    <button className="plan-button plan-button--sm" onClick={() => handleSelectTender(t)}>Open Evaluation</button>
                  </td>
                </tr>
              ))}
              {assignedTenders.length === 0 && (
                <tr>
                  <td colSpan={6} className="plan-empty">No evaluation assignments found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {view === 'evaluate' && selectedTender && (
        <div className="evaluation-workspace">
          <div className="plan-summary-card">
            <h3>Tender: {selectedTender.TenderTitle}</h3>
            <div className="plan-summary-card__grid">
              <div><small>Report Code</small><p>{selectedTender.ReportCode}</p></div>
              <div><small>Category</small><p>{selectedTender.ProcurementCategory}</p></div>
              <div><small>Tender Status</small><p>{selectedTender.TenderStatus}</p></div>
            </div>
          </div>

          <div className="evaluation-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginTop: '24px' }}>
            <div className="evaluation-bids-section">
              <h3>Submitted Bids</h3>
              <div className="portal-table-container">
                <table className="portal-table">
                  <thead>
                    <tr>
                      <th>Vendor</th>
                      <th>Submission Date</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bids.map((bid, i) => (
                      <tr key={i}>
                        <td>{bid.VendorName || 'Anonymous Vendor'}</td>
                        <td>{new Date(bid.SubmittedAt).toLocaleString()}</td>
                        <td><button className="plan-button plan-button--sm plan-button--secondary">View Files</button></td>
                      </tr>
                    ))}
                    {bids.length === 0 && (
                      <tr><td colSpan={3} className="plan-empty">No bids retrieved or bid opening session not yet processed.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="evaluation-actions-section">
              <form className="portal-form" onSubmit={handleSubmitAction}>
                <h3>Evaluation Control Action</h3>
                <label className="plan-field">
                  <span>Action Type</span>
                  <select 
                    className="plan-input" 
                    value={actionForm.ActionType} 
                    onChange={e => setActionForm({...actionForm, ActionType: e.target.value})}
                  >
                    <option value="StartEvaluation">Start Evaluation Session</option>
                    <option value="RequestClarification">Request Clarification from Vendor</option>
                    <option value="RecordNonCompliance">Flag as Non-Compliant</option>
                    <option value="RecommendAward">Recommend for Award</option>
                    <option value="RecommendReTender">Recommend Re-Tender</option>
                    <option value="ConflictOfInterest">Declare Conflict of Interest</option>
                  </select>
                </label>

                {actionForm.ActionType === 'RecordNonCompliance' && (
                  <label className="plan-field">
                    <span>Reason for Non-Compliance</span>
                    <textarea className="plan-input" required value={actionForm.Reason} onChange={e => setActionForm({...actionForm, Reason: e.target.value})} />
                  </label>
                )}

                {actionForm.ActionType === 'RequestClarification' && (
                  <label className="plan-field">
                    <span>Clarification Notes</span>
                    <textarea className="plan-input" required value={actionForm.Notes} onChange={e => setActionForm({...actionForm, Notes: e.target.value})} />
                  </label>
                )}

                {(actionForm.ActionType === 'RecommendAward' || actionForm.ActionType === 'RecommendReTender') && (
                  <>
                    <label className="plan-field">
                      <span>Evaluation Recommendation</span>
                      <select className="plan-input" value={actionForm.Recommendation} onChange={e => setActionForm({...actionForm, Recommendation: e.target.value})}>
                        <option value="Qualified">Qualified & Recommended</option>
                        <option value="ConditionallyQualified">Conditionally Qualified</option>
                        <option value="Unqualified">Unqualified</option>
                      </select>
                    </label>
                    <label className="plan-field">
                      <span>Justification Summary</span>
                      <textarea className="plan-input" required value={actionForm.Justification} onChange={e => setActionForm({...actionForm, Justification: e.target.value})} />
                    </label>
                  </>
                )}

                <div className="portal-form-actions">
                  <button type="submit" className="plan-button" disabled={loading}>Submit Evaluation Action</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
