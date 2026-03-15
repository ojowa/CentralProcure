import React, { useState, useEffect } from 'react';
import type { InternalModule, BppNoObjectionDetail, TenderSummary } from '../types/internal';
import { fetchBppNoObjections, createBppNoObjection, fetchModuleData } from '../services/moduleService';

interface Props {
  module: InternalModule;
  token: string | null;
  role?: string | null;
  initialData?: any;
}

export const BppEscalationModule = ({ module, token, role, initialData }: Props) => {
  const [view, setView] = useState<'list' | 'create'>('list');
  const [noObjections, setNoObjections] = useState<BppNoObjectionDetail[]>([]);
  const [highValueTenders, setHighValueTenders] = useState<TenderSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [newEscalation, setNewEscalation] = useState({ 
    TenderId: '', Amount: 0, ProcurementType: 'Goods', RequestedBy: '' 
  });

  useEffect(() => {
    if (initialData) {
      setNoObjections(Array.isArray(initialData) ? initialData : initialData.Items || []);
    } else if (token) {
      loadData();
    }
  }, [initialData, token]);

  const loadData = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await fetchBppNoObjections(token);
      setNoObjections(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStartCreate = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const tenderData: any = await fetchModuleData('high-value-tenders', token);
      setHighValueTenders(tenderData?.Items || []);
      setView('create');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setLoading(true);
    try {
      await createBppNoObjection(newEscalation, token);
      loadData();
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
          <button className="plan-button" onClick={handleStartCreate}>+ Escalate to BPP</button>
        )}
        {view !== 'list' && (
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
                <th>Tender</th>
                <th>Amount</th>
                <th>Requested At</th>
                <th>BPP Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {noObjections.map(no => (
                <tr key={no.NoObjectionId}>
                  <td><strong>{no.ReferenceCode || no.NoObjectionId.slice(0, 8).toUpperCase()}</strong></td>
                  <td>{no.TenderId}</td>
                  <td>{new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(no.Amount)}</td>
                  <td>{new Date(no.RequestedAt).toLocaleDateString()}</td>
                  <td><span className={`plan-badge plan-badge--${(no.Status || 'Pending').toLowerCase().replace(' ', '-')}`}>{no.Status}</span></td>
                  <td><button className="plan-button plan-button--sm plan-button--secondary">View File</button></td>
                </tr>
              ))}
              {noObjections.length === 0 && !loading && (
                <tr><td colSpan={6} className="plan-empty">No projects currently escalated for BPP prior review.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {view === 'create' && (
        <form className="portal-form" onSubmit={handleCreate}>
          <h3>Package Project for BPP Prior Review</h3>
          <div className="portal-form-grid">
            <label className="plan-field">
              <span>Select High-Value Project</span>
              <select className="plan-input" required value={newEscalation.TenderId} onChange={e => setNewEscalation({...newEscalation, TenderId: e.target.value})}>
                <option value="">-- Choose Project --</option>
                {highValueTenders.map(t => (
                  <option key={t.TenderId} value={t.TenderId}>{t.Title} ({new Intl.NumberFormat('en-NG').format(t.Budget ?? 0)})</option>
                ))}
              </select>
            </label>
            <label className="plan-field">
              <span>Escalation Amount (NGN)</span>
              <input type="number" className="plan-input" required value={newEscalation.Amount} onChange={e => setNewEscalation({...newEscalation, Amount: parseFloat(e.target.value)})} />
            </label>
            <label className="plan-field">
              <span>Procurement Type</span>
              <select className="plan-input" value={newEscalation.ProcurementType} onChange={e => setNewEscalation({...newEscalation, ProcurementType: e.target.value})}>
                <option>Goods</option>
                <option>Works</option>
                <option>Services</option>
              </select>
            </label>
            <label className="plan-field">
              <span>Liaison Officer</span>
              <input className="plan-input" required value={newEscalation.RequestedBy} onChange={e => setNewEscalation({...newEscalation, RequestedBy: e.target.value})} />
            </label>
          </div>
          <div className="portal-alert portal-alert--info" style={{ marginTop: '16px' }}>
            <strong>Threshold Guard:</strong> Per PPA 2007, projects above agency thresholds must receive a Certificate of No-Objection before award.
          </div>
          <div className="portal-form-actions">
            <button type="submit" className="plan-button" disabled={loading}>Submit to BPP Portal</button>
          </div>
        </form>
      )}
    </section>
  );
};
