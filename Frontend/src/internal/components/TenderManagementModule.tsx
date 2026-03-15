import React, { useState, useEffect } from 'react';
import type { InternalModule, TenderSummary, TenderDetail, RequisitionSummary } from '../types/internal';
import { fetchTenderDetails, createTender, publishTender, fetchApprovedRequisitions } from '../services/moduleService';

interface Props {
  module: InternalModule;
  token: string | null;
  role?: string | null;
  initialData?: any;
}

export const TenderManagementModule = ({ module, token, role, initialData }: Props) => {
  const [view, setView] = useState<'list' | 'create' | 'publish'>('list');
  const [tenders, setTenders] = useState<TenderSummary[]>([]);
  const [approvedRequisitions, setApprovedRequisitions] = useState<RequisitionSummary[]>([]);
  const [selectedTender, setSelectedTender] = useState<TenderDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [newTender, setNewTender] = useState({ 
    Title: '', Description: '', Category: 'Goods', Budget: 0, 
    Department: '', BudgetCode: '', FiscalYear: new Date().getFullYear(),
    RequisitionId: ''
  });
  const [publishData, setPublishData] = useState({ 
    PublishDate: new Date().toISOString().split('T')[0],
    OpeningDate: '',
    ClosingDate: ''
  });

  useEffect(() => {
    if (initialData && initialData.Items) {
      setTenders(initialData.Items);
    }
  }, [initialData]);

  const handleStartCreate = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const requisitions = await fetchApprovedRequisitions(token);
      setApprovedRequisitions(requisitions);
      setView('create');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectRequisition = (reqId: string) => {
    const req = approvedRequisitions.find(r => r.RequisitionId === reqId);
    if (req) {
      setNewTender({
        ...newTender,
        RequisitionId: req.RequisitionId,
        Title: req.Title,
        Department: req.Department,
        Budget: req.TotalEstimate,
        Description: `Tender for ${req.Title}. Department: ${req.Department}. Approved Estimate: ${req.TotalEstimate}`
      });
    }
  };

  const handleCreateTender = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setLoading(true);
    try {
      const created = await createTender(newTender, token);
      setTenders([created, ...tenders]);
      setView('list');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleViewTender = async (tenderId: string) => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await fetchTenderDetails(tenderId, token);
      setSelectedTender(data);
      setView('publish');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const validatePpaTimeline = () => {
    if (!publishData.PublishDate || !publishData.ClosingDate) return true;
    const start = new Date(publishData.PublishDate);
    const end = new Date(publishData.ClosingDate);
    const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays >= 42; // Mandatory 6 weeks
  };

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !selectedTender) return;
    
    if (!validatePpaTimeline()) {
      if (!confirm('The advertising period is less than the mandatory 42 days (6 weeks) required by PPA 2007 for NCB. Do you wish to proceed with this exception?')) {
        return;
      }
    }

    setLoading(true);
    try {
      await publishTender(selectedTender.TenderId, publishData, token);
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
        {view === 'list' && (
          <button className="plan-button" onClick={handleStartCreate}>+ New Tender from Requisition</button>
        )}
        {view !== 'list' && (
          <button className="plan-button plan-button--secondary" onClick={() => setView('list')}>Back to Tenders</button>
        )}
      </header>

      {error && <div className="portal-alert">{error}</div>}

      {view === 'list' && (
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
                  <td><strong>{t.TenderId.slice(0, 8).toUpperCase()}</strong></td>
                  <td>{t.Title}</td>
                  <td>{t.Category}</td>
                  <td><span className={`plan-badge plan-badge--${t.Status.toLowerCase().replace(' ', '-')}`}>{t.Status}</span></td>
                  <td>{t.ClosingDate ? new Date(t.ClosingDate).toLocaleDateString() : 'Not Set'}</td>
                  <td>
                    {t.Status === 'Draft' ? (
                      <button className="plan-button plan-button--sm" onClick={() => handleViewTender(t.TenderId)}>Publish Ad</button>
                    ) : (
                      <button className="plan-button plan-button--sm plan-button--secondary" onClick={() => handleViewTender(t.TenderId)}>View Details</button>
                    )}
                  </td>
                </tr>
              ))}
              {tenders.length === 0 && (
                <tr>
                  <td colSpan={6} className="plan-empty">No tenders found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {view === 'create' && (
        <form className="portal-form" onSubmit={handleCreateTender}>
          <h3>Convert Approved Requisition to Tender Ad</h3>
          <div className="portal-form-grid">
            <label className="plan-field">
              <span>Select Approved Requisition</span>
              <select 
                className="plan-input" 
                required 
                value={newTender.RequisitionId}
                onChange={e => handleSelectRequisition(e.target.value)}
              >
                <option value="">-- Choose Requisition --</option>
                {approvedRequisitions.map(r => (
                  <option key={r.RequisitionId} value={r.RequisitionId}>{r.Title} ({r.Department})</option>
                ))}
              </select>
            </label>
            <label className="plan-field">
              <span>Tender Title</span>
              <input className="plan-input" required value={newTender.Title} onChange={e => setNewTender({...newTender, Title: e.target.value})} />
            </label>
            <label className="plan-field">
              <span>Category</span>
              <select className="plan-input" value={newTender.Category} onChange={e => setNewTender({...newTender, Category: e.target.value})}>
                <option>Goods</option>
                <option>Works</option>
                <option>Services</option>
              </select>
            </label>
            <label className="plan-field">
              <span>Budget (NGN)</span>
              <input type="number" className="plan-input" required value={newTender.Budget} onChange={e => setNewTender({...newTender, Budget: parseFloat(e.target.value)})} />
            </label>
            <label className="plan-field">
              <span>Budget Code</span>
              <input className="plan-input" required value={newTender.BudgetCode} onChange={e => setNewTender({...newTender, BudgetCode: e.target.value})} />
            </label>
            <label className="plan-field">
              <span>Fiscal Year</span>
              <input type="number" className="plan-input" required value={newTender.FiscalYear} onChange={e => setNewTender({...newTender, FiscalYear: parseInt(e.target.value)})} />
            </label>
          </div>
          <label className="plan-field">
            <span>Detailed Scope & Instructions to Bidders</span>
            <textarea className="plan-input" rows={4} required value={newTender.Description} onChange={e => setNewTender({...newTender, Description: e.target.value})} />
          </label>
          <div className="portal-form-actions">
            <button type="submit" className="plan-button" disabled={loading}>Create Ad Draft</button>
          </div>
        </form>
      )}

      {view === 'publish' && selectedTender && (
        <div className="tender-publish-view">
          <div className="plan-summary-card">
            <h3>{selectedTender.Title}</h3>
            <div className="plan-summary-card__grid">
              <div><small>Reference</small><p>{selectedTender.TenderId.slice(0, 8).toUpperCase()}</p></div>
              <div><small>Status</small><p>{selectedTender.Status}</p></div>
              <div><small>Budget</small><p>{new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(selectedTender.Budget || 0)}</p></div>
            </div>
          </div>

          {selectedTender.Status === 'Draft' ? (
            <form className="portal-form" onSubmit={handlePublish} style={{ marginTop: '24px' }}>
              <h3>PPA 2007 Publication Control</h3>
              <div className="portal-form-grid">
                <label className="plan-field">
                  <span>Publication Date</span>
                  <input type="date" className="plan-input" required value={publishData.PublishDate} onChange={e => setPublishData({...publishData, PublishDate: e.target.value})} />
                </label>
                <label className="plan-field">
                  <span>Closing Date (Bid Submission Deadline)</span>
                  <input type="date" className="plan-input" required value={publishData.ClosingDate} onChange={e => setPublishData({...publishData, ClosingDate: e.target.value})} />
                </label>
                <label className="plan-field">
                  <span>Public Bid Opening Date</span>
                  <input type="date" className="plan-input" required value={publishData.OpeningDate} onChange={e => setPublishData({...publishData, OpeningDate: e.target.value})} />
                </label>
              </div>

              <div className="ppa-checklist" style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', marginTop: '16px', border: '1px solid #e2e8f0' }}>
                <h4 style={{ marginTop: 0 }}>Compliance Checklist</h4>
                <ul style={{ listStyle: 'none', padding: 0 }}>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <input type="checkbox" required /> <span>Confirm all bidding documents are ready for download.</span>
                  </li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <input type="checkbox" required /> <span>Confirm eligibility criteria (CAC, Tax, PENCOM, etc.) are explicitly stated.</span>
                  </li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input type="checkbox" checked={validatePpaTimeline()} readOnly /> 
                    <span style={{ color: validatePpaTimeline() ? 'green' : 'red' }}>
                      {validatePpaTimeline() ? 'Mandatory 6-week advertising period met.' : 'Advertising period is less than 6 weeks (NCB Violation).'}
                    </span>
                  </li>
                </ul>
              </div>

              <div className="portal-form-actions">
                <button type="submit" className="plan-button" disabled={loading}>Authorize Publication</button>
              </div>
            </form>
          ) : (
            <div className="portal-alert portal-alert--success" style={{ marginTop: '24px' }}>
              This tender advertisement is LIVE. Bidders can now submit proposals until {new Date(selectedTender.ClosingDate!).toLocaleDateString()}.
            </div>
          )}
        </div>
      )}
    </section>
  );
};
