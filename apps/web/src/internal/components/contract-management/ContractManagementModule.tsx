import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import type { InternalModule, ContractSummary, ContractMilestone } from '../../types/internal';
import { fetchContracts, fetchContractMilestones, logContractMilestone } from '../../services/moduleService';

interface Props {
  module: InternalModule;
  token: string | null;
  role?: string | null;
  initialData?: any;
}

export const ContractManagementModule = ({ module, token, role, initialData }: Props) => {
  const searchParams = useSearchParams();
  const [view, setViewState] = useState<'list' | 'details'>(
    (searchParams.get('view') as 'list' | 'details') || 'list'
  );
  const setView = (v: 'list' | 'details') => {
    setViewState(v);
    const params = new URLSearchParams(window.location.search);
    params.set('view', v);
    window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}`);
  };
  const [contracts, setContracts] = useState<ContractSummary[]>([]);
  const [selectedContract, setSelectedContract] = useState<ContractSummary | null>(null);
  const [milestones, setMilestones] = useState<ContractMilestone[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [newMilestone, setNewMilestone] = useState({ 
    MilestoneTitle: '', Status: 'Active', Progress: 0, Notes: '', ContractManager: '' 
  });

  useEffect(() => {
    if (initialData) {
      setContracts(Array.isArray(initialData) ? initialData : initialData.Items || []);
    } else if (token) {
      loadContracts();
    }
  }, [initialData, token]);

  const loadContracts = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await fetchContracts(token);
      setContracts(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = async (contract: ContractSummary) => {
    if (!token) return;
    setLoading(true);
    try {
      const ms = await fetchContractMilestones(contract.ContractCode, token);
      setMilestones(ms);
      setSelectedContract(contract);
      setView('details');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddMilestone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !selectedContract) return;
    setLoading(true);
    try {
      await logContractMilestone(selectedContract.ContractCode, newMilestone, token);
      const ms = await fetchContractMilestones(selectedContract.ContractCode, token);
      setMilestones(ms);
      setNewMilestone({ MilestoneTitle: '', Status: 'Active', Progress: 0, Notes: '', ContractManager: '' });
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
        {view === 'details' && (
          <button className="plan-button plan-button--secondary" onClick={() => setView('list')}>Back to Contracts</button>
        )}
      </header>

      {error && <div className="portal-alert">{error}</div>}

      {view === 'list' && (
        <div className="portal-table-container">
          <table className="portal-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Tender / Project</th>
                <th>Vendor</th>
                <th>Value</th>
                <th>Progress</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {contracts.map(c => (
                <tr key={c.ContractId}>
                  <td><strong>{c.ContractCode}</strong></td>
                  <td>{c.TenderTitle}</td>
                  <td>{c.VendorName}</td>
                  <td>{new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(c.ContractValue)}</td>
                  <td>
                    <div style={{ width: '100px', background: '#e2e8f0', borderRadius: '4px', height: '8px' }}>
                      <div style={{ width: `${c.Progress}%`, background: '#059669', height: '100%', borderRadius: '4px' }} />
                    </div>
                    <small>{c.Progress}%</small>
                  </td>
                  <td><span className={`plan-badge plan-badge--${(c.Status || 'Active').toLowerCase().replace(' ', '-')}`}>{c.Status}</span></td>
                  <td>
                    <button className="plan-button plan-button--sm" onClick={() => handleViewDetails(c)}>Manage</button>
                  </td>
                </tr>
              ))}
              {contracts.length === 0 && !loading && (
                <tr><td colSpan={7} className="plan-empty">No active contracts found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {view === 'details' && selectedContract && (
        <div className="contract-details">
          <div className="plan-summary-card">
            <div className="plan-summary-card__grid">
              <div><small>Contract Code</small><p>{selectedContract.ContractCode}</p></div>
              <div><small>Vendor</small><p>{selectedContract.VendorName}</p></div>
              <div><small>Value</small><p>{new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(selectedContract.ContractValue)}</p></div>
              <div><small>Progress</small><p>{selectedContract.Progress}%</p></div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[1.5fr_1fr] gap-6 mt-6">
            <div className="milestone-history">
              <h3>Execution Milestones</h3>
              <div className="portal-table-container">
                <table className="portal-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Milestone</th>
                      <th>Progress After</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {milestones.map(m => (
                      <tr key={m.MilestoneId}>
                        <td>{new Date(m.RecordedAt).toLocaleDateString()}</td>
                        <td>{m.MilestoneTitle}</td>
                        <td>{m.ProgressAfter}%</td>
                        <td>{m.StatusAfter}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="add-milestone">
              <form className="portal-form" onSubmit={handleAddMilestone}>
                <h3>Update Contract Progress</h3>
                <label className="plan-field">
                  <span>Milestone Title</span>
                  <input className="plan-input" required value={newMilestone.MilestoneTitle} onChange={e => setNewMilestone({...newMilestone, MilestoneTitle: e.target.value})} placeholder="e.g. 30% Site Mobilization" />
                </label>
                <label className="plan-field">
                  <span>Current Status</span>
                  <select className="plan-input" value={newMilestone.Status} onChange={e => setNewMilestone({...newMilestone, Status: e.target.value})}>
                    <option>Active</option>
                    <option>On Hold</option>
                    <option>Completed</option>
                    <option>Terminated</option>
                  </select>
                </label>
                <label className="plan-field">
                  <span>Overall Progress (%)</span>
                  <input type="number" className="plan-input" required value={newMilestone.Progress} onChange={e => setNewMilestone({...newMilestone, Progress: parseInt(e.target.value)})} min={0} max={100} />
                </label>
                <label className="plan-field">
                  <span>Contract Manager (Update)</span>
                  <input className="plan-input" value={newMilestone.ContractManager} onChange={e => setNewMilestone({...newMilestone, ContractManager: e.target.value})} />
                </label>
                <label className="plan-field">
                  <span>Notes / Field Report</span>
                  <textarea className="plan-input" required value={newMilestone.Notes} onChange={e => setNewMilestone({...newMilestone, Notes: e.target.value})} rows={3} />
                </label>
                <div className="portal-form-actions">
                  <button type="submit" className="plan-button" disabled={loading}>Log Milestone</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
