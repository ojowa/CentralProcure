import React, { useState, useEffect } from 'react';
import type { InternalModule, ProcurementPlanSummary, ProcurementPlanDetail, ProcurementPlanItemDetail } from '../types/internal';
import { fetchPlanDetails, createPlan, createPlanItem } from '../services/moduleService';

interface Props {
  module: InternalModule;
  token: string | null;
  role?: string | null;
  initialData?: any;
}

export const ProcurementPlanModule = ({ module, token, role, initialData }: Props) => {
  const [view, setView] = useState<'list' | 'create' | 'details'>('list');
  const [plans, setPlans] = useState<ProcurementPlanSummary[]>(Array.isArray(initialData) ? initialData : []);
  const [selectedPlan, setSelectedPlan] = useState<ProcurementPlanDetail | null>(null);
  const [planItems, setPlanItems] = useState<ProcurementPlanItemDetail[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [newPlan, setNewPlan] = useState({ PlanTitle: '', FiscalYear: new Date().getFullYear(), Department: '', Notes: '' });
  const [newItem, setNewItem] = useState({ ItemCode: '', Description: '', BudgetCode: '', ProcurementType: 'Goods', EstimatedAmount: 0 });

  useEffect(() => {
    if (initialData && Array.isArray(initialData)) {
      setPlans(initialData);
    }
  }, [initialData]);

  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setLoading(true);
    try {
      const created = await createPlan(newPlan, token);
      setPlans([created, ...plans]);
      handleViewDetails(created.PlanId);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = async (planId: string) => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await fetchPlanDetails(planId, token);
      setSelectedPlan(data.Plan);
      setPlanItems(data.Items || []);
      setView('details');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !selectedPlan) return;
    setLoading(true);
    try {
      const created = await createPlanItem(selectedPlan.PlanId, newItem, token);
      setPlanItems([...planItems, created]);
      setNewItem({ ItemCode: '', Description: '', BudgetCode: '', ProcurementType: 'Goods', EstimatedAmount: 0 });
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
          <button className="plan-button" onClick={() => setView('create')}>+ New APP</button>
        )}
        {view !== 'list' && (
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
                    <button className="plan-button plan-button--sm" onClick={() => handleViewDetails(p.PlanId)}>View Items</button>
                  </td>
                </tr>
              ))}
              {plans.length === 0 && (
                <tr>
                  <td colSpan={6} className="plan-empty">No procurement plans found for this department.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {view === 'create' && (
        <form className="portal-form" onSubmit={handleCreatePlan}>
          <h3>Initialize Annual Procurement Plan</h3>
          <div className="portal-form-grid">
            <label className="plan-field">
              <span>Plan Title</span>
              <input 
                className="plan-input" 
                required 
                value={newPlan.PlanTitle}
                onChange={e => setNewPlan({...newPlan, PlanTitle: e.target.value})}
                placeholder="e.g. FY2026 NIS Headquarters APP" 
              />
            </label>
            <label className="plan-field">
              <span>Fiscal Year</span>
              <input 
                type="number" 
                className="plan-input" 
                required 
                value={newPlan.FiscalYear}
                onChange={e => setNewPlan({...newPlan, FiscalYear: parseInt(e.target.value)})}
              />
            </label>
            <label className="plan-field">
              <span>Department</span>
              <input 
                className="plan-input" 
                required 
                value={newPlan.Department}
                onChange={e => setNewPlan({...newPlan, Department: e.target.value})}
                placeholder="e.g. ICT Department" 
              />
            </label>
          </div>
          <label className="plan-field">
            <span>Notes / Executive Summary</span>
            <textarea 
              className="plan-input" 
              value={newPlan.Notes}
              onChange={e => setNewPlan({...newPlan, Notes: e.target.value})}
              rows={3} 
            />
          </label>
          <div className="portal-form-actions">
            <button type="submit" className="plan-button" disabled={loading}>Create Plan Header</button>
          </div>
        </form>
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
                <small>Total Estimated Budget</small>
                <p><strong>{new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(selectedPlan.TotalBudget)}</strong></p>
              </div>
            </div>
          </div>

          <div className="plan-items-section">
            <h3>APP Line Items</h3>
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

            {selectedPlan.Status === 'Draft' && (
              <form className="plan-add-item-form" onSubmit={handleAddItem}>
                <h4>Add Line Item</h4>
                <div className="portal-form-grid">
                  <input className="plan-input" placeholder="Item Code" required value={newItem.ItemCode} onChange={e => setNewItem({...newItem, ItemCode: e.target.value})} />
                  <input className="plan-input" placeholder="Description" required value={newItem.Description} onChange={e => setNewItem({...newItem, Description: e.target.value})} />
                  <select className="plan-input" value={newItem.ProcurementType} onChange={e => setNewItem({...newItem, ProcurementType: e.target.value})}>
                    <option>Goods</option>
                    <option>Works</option>
                    <option>Services</option>
                  </select>
                  <input className="plan-input" placeholder="Budget Code" required value={newItem.BudgetCode} onChange={e => setNewItem({...newItem, BudgetCode: e.target.value})} />
                  <input type="number" className="plan-input" placeholder="Amount (NGN)" required value={newItem.EstimatedAmount} onChange={e => setNewItem({...newItem, EstimatedAmount: parseFloat(e.target.value)})} />
                  <button type="submit" className="plan-button" disabled={loading}>Add Item</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </section>
  );
};
