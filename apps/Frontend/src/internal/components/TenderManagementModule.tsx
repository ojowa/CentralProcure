import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { InternalModule, TenderSummary } from '../types/internal';
import { fetchTenderDetails } from '../services/moduleService';
import { fetchTenders } from '../services/tenderService';
import { fetchTenderWorkflowDisplay } from '../services/tenderWorkflowService';
import { WorkflowProgressStepper } from './WorkflowProgressStepper';
import type { WorkflowRuntimeDisplay } from './workflowDisplayTypes';
import { getInternalDashboardPath } from '../utils/internalRoutes';

interface Props {
  module: InternalModule;
  token: string | null;
  role?: string | null;
  initialData?: any;
}

export const TenderManagementModule = ({ module, token, role, initialData }: Props) => {
  const router = useRouter();
  const [tenders, setTenders] = useState<TenderSummary[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'draft' | 'published'>('all');
  const [selectedTender, setSelectedTender] = useState<any>(null);
  const [selectedWorkflow, setSelectedWorkflow] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (activeTab === 'all' && initialData?.Items) {
      setTenders(initialData.Items);
    } else if (token) {
      void loadTenders(activeTab);
    }
  }, [activeTab, initialData, token]);

  const loadTenders = async (tab: 'all' | 'draft' | 'published' = activeTab) => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchTenders(token, {
        status: tab === 'all' ? undefined : tab === 'draft' ? 'Draft' : 'Published',
        page: 1,
        pageSize: 50,
        sortBy: 'created_at',
        sortDir: 'desc'
      });
      setTenders(data.Items || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    router.push(`${getInternalDashboardPath('tender-create')}?source=${encodeURIComponent(module.id)}`);
  };

  const handleView = async (tenderId: string) => {
    if (!token) return;
    setLoading(true);
    try {
      const [tender, workflow] = await Promise.all([
        fetchTenderDetails(tenderId, token),
        fetchTenderWorkflowDisplay(tenderId, token)
      ]);
      setSelectedTender(tender);
      setSelectedWorkflow(workflow);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePublish = (tenderId: string) => {
    router.push(`${getInternalDashboardPath('tender-create')}?edit=${encodeURIComponent(tenderId)}&source=${encodeURIComponent(module.id)}`);
  };

  const selectedTenderStatusLabel =
    selectedWorkflow?.CurrentStageTitle ||
    selectedTender?.Status ||
    'Unknown';

  return (
    <section className="portal-module">
      <header className="portal-module__header">
        <div>
          <h2>{module.title}</h2>
          <p>{module.description}</p>
        </div>
        <button className="plan-button" onClick={handleCreate}>+ New Tender</button>
      </header>

      <nav className="workflow-config-tabs" aria-label="Tender management views">
        <button
          type="button"
          className={activeTab === 'all' ? 'active' : undefined}
          onClick={() => {
            setSelectedTender(null);
            setSelectedWorkflow(null);
            setActiveTab('all');
          }}
        >
          All Tenders
        </button>
        <button
          type="button"
          className={activeTab === 'draft' ? 'active' : undefined}
          onClick={() => {
            setSelectedTender(null);
            setSelectedWorkflow(null);
            setActiveTab('draft');
          }}
        >
          Draft Tenders
        </button>
        <button
          type="button"
          className={activeTab === 'published' ? 'active' : undefined}
          onClick={() => {
            setSelectedTender(null);
            setSelectedWorkflow(null);
            setActiveTab('published');
          }}
        >
          Published Tenders
        </button>
      </nav>

      {error && <div className="portal-alert">{error}</div>}

      {selectedTender ? (
        <div className="app-card">
          <div className="detail-header">
            <h3>{selectedTender.Title}</h3>
            <button className="plan-button plan-button--secondary" onClick={() => setSelectedTender(null)}>
              Close
            </button>
          </div>

          <div className="plan-summary-card__grid">
            <div><small>Reference</small><p>{selectedTender.TenderId?.slice(0, 8).toUpperCase()}</p></div>
            <div><small>Status</small><p>{selectedTenderStatusLabel}</p></div>
            <div><small>Budget</small><p>{(selectedTender.Budget || 0).toLocaleString('en-NG', { style: 'currency', currency: 'NGN' })}</p></div>
            <div><small>Category</small><p>{selectedTender.Category}</p></div>
          </div>

          {selectedWorkflow?.CurrentStageKey && (
            <div className="workflow-section">
              <WorkflowProgressStepper
                currentStageKey={selectedWorkflow.CurrentStageKey}
                display={selectedWorkflow.WorkflowDisplay as WorkflowRuntimeDisplay | null | undefined}
              />
            </div>
          )}

          {selectedTender.Status === 'Draft' && (
            <button className="plan-button" onClick={() => handlePublish(selectedTender.TenderId)}>
              Publish Tender
            </button>
          )}
        </div>
      ) : (
        <div className="portal-table-container">
          <table className="portal-table">
            <thead>
              <tr>
                <th>Reference</th>
                <th>Title</th>
                <th>Category</th>
                <th>Status</th>
                <th>Closing Date</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {tenders.map(t => (
                <tr key={t.TenderId}>
                  <td><strong>{t.TenderId?.slice(0, 8).toUpperCase()}</strong></td>
                  <td>{t.Title}</td>
                  <td>{t.Category}</td>
                  <td>
                    <span className={`plan-badge plan-badge--${t.Status.toLowerCase().replace(' ', '-')}`}>
                      {t.Status}
                    </span>
                  </td>
                  <td>{t.ClosingDate ? new Date(t.ClosingDate).toLocaleDateString() : 'Not Set'}</td>
                  <td>
                    {t.Status === 'Draft' ? (
                      <button className="plan-button plan-button--sm" onClick={() => handlePublish(t.TenderId)}>
                        Publish
                      </button>
                    ) : (
                      <button className="plan-button plan-button--sm plan-button--secondary" onClick={() => handleView(t.TenderId)}>
                        View
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {tenders.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} className="plan-empty">No tenders found.</td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td colSpan={6} className="plan-empty">Loading...</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};
