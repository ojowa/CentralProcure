import React, { useState, useEffect } from 'react';
import type { InternalModule, AdministrativeReviewSummary } from '../types/internal';
import { fetchAdministrativeReviews, submitAdministrativeReviewDecision } from '../services/moduleService';

interface Props {
  module: InternalModule;
  token: string | null;
  role?: string | null;
  initialData?: any;
}

export const AdministrativeReviewModule = ({ module, token, role, initialData }: Props) => {
  const [view, setView] = useState<'list' | 'resolve'>('list');
  const [complaints, setComplaints] = useState<AdministrativeReviewSummary[]>([]);
  const [selectedComplaint, setSelectedComplaint] = useState<AdministrativeReviewSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [resolution, setResolution] = useState({ 
    outcome: 'Dismiss Complaint', resolutionNotes: '', resolutionStageKey: '' 
  });

  useEffect(() => {
    if (initialData) {
      setComplaints(Array.isArray(initialData) ? initialData : initialData.Items || []);
    } else if (token) {
      loadComplaints();
    }
  }, [initialData, token]);

  const loadComplaints = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await fetchAdministrativeReviews(token);
      setComplaints(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResolve = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !selectedComplaint) return;
    setLoading(true);
    try {
      await submitAdministrativeReviewDecision(selectedComplaint.ComplaintId, resolution, token);
      loadComplaints();
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
        {view === 'resolve' && (
          <button className="plan-button plan-button--secondary" onClick={() => setView('list')}>Back to Queue</button>
        )}
      </header>

      {error && <div className="portal-alert">{error}</div>}

      {view === 'list' && (
        <div className="portal-table-container">
          <table className="portal-table">
            <thead>
              <tr>
                <th>Reference</th>
                <th>Subject</th>
                <th>Filed By</th>
                <th>Filed At</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {complaints.map(c => (
                <tr key={c.ComplaintId}>
                  <td><strong>{c.ComplaintReference}</strong></td>
                  <td>{c.Subject}</td>
                  <td>{c.FiledBy || 'Anonymous'}</td>
                  <td>{new Date(c.FiledAt).toLocaleDateString()}</td>
                  <td><span className={`plan-badge plan-badge--${(c.Status || 'Pending').toLowerCase().replace(' ', '-')}`}>{c.Status}</span></td>
                  <td>
                    <button className="plan-button plan-button--sm" onClick={() => { setSelectedComplaint(c); setView('resolve'); }}>Investigate</button>
                  </td>
                </tr>
              ))}
              {complaints.length === 0 && !loading && (
                <tr><td colSpan={6} className="plan-empty">No pending administrative reviews (complaints).</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {view === 'resolve' && selectedComplaint && (
        <div className="resolve-view">
          <div className="plan-summary-card">
            <h3>{selectedComplaint.Subject}</h3>
            <p><strong>Summary:</strong> {(selectedComplaint as any).Summary}</p>
            <div className="portal-module-grid" style={{ marginTop: '16px' }}>
              <article className="portal-module-card">
                <h3>Complaint Detail</h3>
                <p>{(selectedComplaint as any).Details}</p>
              </article>
              <article className="portal-module-card">
                <h3>Requested Remedy</h3>
                <p>{(selectedComplaint as any).RequestedRemedy || 'Not specified.'}</p>
              </article>
            </div>
          </div>

          <form className="portal-form" onSubmit={handleResolve} style={{ marginTop: '24px' }}>
            <h3>Final Statutory Decision</h3>
            <div className="portal-form-grid">
              <label className="plan-field">
                <span>Resolution Outcome</span>
                <select className="plan-input" value={resolution.outcome} onChange={e => setResolution({...resolution, outcome: e.target.value})}>
                  <option value="Resume Procurement">Resume Procurement (Dismiss Complaint)</option>
                  <option value="Modify Decision">Modify Decision (Partial Merit)</option>
                  <option value="Escalate To BPP">Escalate to BPP for Arbitration</option>
                  <option value="Terminate Procurement">Terminate Procurement (High Merit)</option>
                  <option value="Dismiss Complaint">Dismiss Complaint</option>
                </select>
              </label>
              <label className="plan-field">
                <span>Return to Stage (Optional)</span>
                <select className="plan-input" value={resolution.resolutionStageKey} onChange={e => setResolution({...resolution, resolutionStageKey: e.target.value})}>
                  <option value="">-- No Stage Change --</option>
                  <option value="solicitation">Back to Advert / Invitation / EOI / RFP</option>
                  <option value="evaluation">Back to Evaluation</option>
                  <option value="award_and_publication">Back to Award</option>
                </select>
              </label>
            </div>
            <label className="plan-field">
              <span>Decision Justification & Notes</span>
              <textarea className="plan-input" required rows={4} value={resolution.resolutionNotes} onChange={e => setResolution({...resolution, resolutionNotes: e.target.value})} />
            </label>
            <div className="portal-form-actions">
              <button type="submit" className="plan-button" disabled={loading}>Log Final Decision</button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
};
