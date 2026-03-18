import React, { useState, useEffect } from 'react';
import type { InternalModule, RoleKey } from '../types/internal';
import { fetchModuleData, applyCgisAction } from '../services/moduleService';
import { CgisDecisionModal } from './CgisDecisionModal';
import { CgisDocumentsPanel } from './CgisDocumentsPanel';

interface CgisQueueItem {
  InstanceId: string;
  EntityType: string;
  EntityId: string;
  RecordTitle: string | null;
  Department: string;
  Amount: number | null;
  ApprovalRoute: string | null;
  ApprovalAuthorityLabel: string | null;
  Status: string | null;
  VendorName: string | null;
  CreatedAt: string;
  DaysPending: number;
}

interface CgisApprovalModuleProps {
  module: InternalModule;
  token: string | null;
  role: RoleKey | null;
  userEmail?: string | null;
}

export const CgisApprovalModule = ({ module, token, role, userEmail }: CgisApprovalModuleProps) => {
  const [queue, setQueue] = useState<CgisQueueItem[]>([]);
  const [selectedCase, setSelectedCase] = useState<CgisQueueItem | null>(null);
  const [rationale, setRationale] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [pendingAction, setPendingAction] = useState<'approve' | 'reject' | 'return' | 'escalate' | null>(null);

  const loadQueue = async () => {
    if (!token) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchModuleData('cgis-approval', token) as CgisQueueItem[];
      setQueue(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load CGIS queue.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadQueue();
  }, [token]);

  const initiateAction = (action: 'approve' | 'reject' | 'return' | 'escalate') => {
    if (!rationale.trim()) {
      setError('Rationale is mandatory for all executive decisions.');
      return;
    }
    setError(null);
    setPendingAction(action);
  };

  const confirmAction = async () => {
    if (!token || !selectedCase || !pendingAction || !rationale.trim()) return;

    setIsProcessing(true);
    setError(null);
    try {
      await applyCgisAction(pendingAction, {
        EntityType: selectedCase.EntityType,
        EntityId: selectedCase.EntityId,
        Rationale: rationale.trim(),
        Actor: userEmail
      }, token);
      
      setRationale('');
      setPendingAction(null);
      setSelectedCase(null);
      await loadQueue();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${pendingAction} case.`);
      setPendingAction(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const formatAmount = (val: number | null) => 
    val !== null ? new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(val) : 'N/A';

  return (
    <section className="portal-module">
      <header className="module-header">
        <div>
          <h2>{module.title}</h2>
          <p>{module.description}</p>
        </div>
        <button className="plan-button-secondary" onClick={() => void loadQueue()} disabled={isLoading}>
          {isLoading ? 'Refreshing...' : 'Refresh Queue'}
        </button>
      </header>

      {error && <div className="portal-alert animate-shake">{error}</div>}

      {selectedCase ? (
        <div className="portal-module-detail">
          <div className="detail-header">
            <button className="plan-link" onClick={() => setSelectedCase(null)}>&larr; Back to Queue</button>
            <h3>Reviewing: {selectedCase.RecordTitle || 'Untitled Case'}</h3>
          </div>

          <div className="portal-module-grid">
            <article className="portal-module-card">
              <h4>Case Identity</h4>
              <p><strong>Type:</strong> {selectedCase.EntityType}</p>
              <p><strong>ID:</strong> {selectedCase.EntityId}</p>
              <p><strong>Department:</strong> {selectedCase.Department}</p>
            </article>

            <article className="portal-module-card">
              <h4>Financial Summary</h4>
              <p><strong>Total Amount:</strong> {formatAmount(selectedCase.Amount)}</p>
              <p><strong>Route:</strong> {selectedCase.ApprovalRoute || 'Low-Value Direct'}</p>
              <p><strong>Authority:</strong> {selectedCase.ApprovalAuthorityLabel || 'CGIS'}</p>
            </article>

            <article className="portal-module-card highlight-card">
              <h4>Recommended Vendor</h4>
              <p><strong>Company:</strong> {selectedCase.VendorName || 'TBD (Evaluation Pending)'}</p>
              <p><strong>Status:</strong> <span className="admin-status admin-status--good">Evaluated & Recommended</span></p>
            </article>

            <article className="portal-module-card">
              <h4>Why This Reached CGIS</h4>
              <p>This procurement follows the <strong>{selectedCase.ApprovalRoute || 'Low-Value Direct'}</strong> path, which mandates final executive review by the Accounting Officer (CGIS) as per PPA 2007 guidelines.</p>
              <p className="days-warning">{selectedCase.DaysPending} days pending in executive queue.</p>
            </article>
          </div>

          <CgisDocumentsPanel 
            entityType={selectedCase.EntityType} 
            entityId={selectedCase.EntityId} 
            token={token} 
          />

          <div className="action-panel" style={{ marginTop: '24px', padding: '20px', backgroundColor: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
            <h4>Executive Decision</h4>
            <div className="plan-field">
              <label><span>Rationale / Decision Note (Mandatory)</span></label>
              <textarea 
                className="plan-input" 
                rows={4} 
                placeholder="Enter the justification for this approval, rejection, or return. This will be recorded in the audit trail."
                value={rationale}
                onChange={(e) => setRationale(e.target.value)}
              />
            </div>

            <div className="plan-button-group" style={{ marginTop: '16px' }}>
              <button 
                className="plan-button" 
                onClick={() => initiateAction('approve')} 
                disabled={isProcessing || !rationale.trim()}
              >
                Approve Award
              </button>
              <button 
                className="plan-button-secondary plan-button-danger-outline" 
                onClick={() => initiateAction('reject')} 
                disabled={isProcessing || !rationale.trim()}
              >
                Reject Award
              </button>
              <button 
                className="plan-button-secondary" 
                onClick={() => initiateAction('return')} 
                disabled={isProcessing || !rationale.trim()}
              >
                Return for Clarification
              </button>
              <button 
                className="plan-button-secondary" 
                onClick={() => initiateAction('escalate')} 
                disabled={isProcessing || !rationale.trim()}
              >
                Escalate to Board
              </button>
            </div>
          </div>

          {pendingAction && (
            <CgisDecisionModal
              action={pendingAction}
              recordTitle={selectedCase.RecordTitle || 'Untitled Case'}
              rationale={rationale}
              isProcessing={isProcessing}
              onConfirm={() => void confirmAction()}
              onCancel={() => setPendingAction(null)}
            />
          )}
        </div>
      ) : (
        <div className="portal-table-container">
          <table className="plan-table">
            <thead>
              <tr>
                <th>Case Ref</th>
                <th>Title</th>
                <th>Department</th>
                <th>Amount</th>
                <th>Route</th>
                <th>Recommendation</th>
                <th>Days</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {queue.length > 0 ? (
                queue.map((item) => (
                  <tr key={item.InstanceId}>
                    <td className="monospace" style={{ fontSize: '0.85em' }}>{item.EntityId.slice(0, 8)}...</td>
                    <td><strong>{item.RecordTitle || 'Untitled'}</strong></td>
                    <td>{item.Department}</td>
                    <td>{formatAmount(item.Amount)}</td>
                    <td><span className="plan-badge">{item.ApprovalRoute || 'Direct'}</span></td>
                    <td>{item.Status || 'Ready for Review'}</td>
                    <td>
                      <span className={item.DaysPending > 5 ? 'text-urgent' : ''}>
                        {item.DaysPending}d
                      </span>
                    </td>
                    <td>
                      <button className="plan-link" onClick={() => setSelectedCase(item)}>Open Case</button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="plan-empty">
                    {isLoading ? 'Loading CGIS queue...' : 'No pending cases in the CGIS approval queue.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};
