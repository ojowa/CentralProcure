'use client';

import React, { useEffect, useState } from 'react';
import type { InternalModule, RoleKey } from '../types/internal';
import { 
  fetchNeedAssessments, 
  fetchNeedAssessmentDetail, 
  createNeedAssessment, 
  updateNeedAssessment, 
  submitNeedAssessmentDecision,
  type NeedAssessmentSummary,
  type NeedAssessmentDetail,
  type NeedAssessmentItemDetail
} from '../services/needsCollectionService';

interface NeedsCollectionModuleProps {
  module: InternalModule;
  token: string;
  role?: RoleKey | null;
}

export const NeedsCollectionModule: React.FC<NeedsCollectionModuleProps> = ({ module, token, role }) => {
  const [assessments, setAssessments] = useState<NeedAssessmentSummary[]>([]);
  const [authorizedUsers, setAuthorizedUsers] = useState<NeedAssessmentAuthorizedUser[]>([]);
  const [activeTab, setActiveTab] = useState<'assessments' | 'users'>('assessments');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<NeedAssessmentDetail | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [title, setTitle] = useState('');
  const [fiscalYear, setFiscalYear] = useState(new Date().getFullYear());
  const [remarks, setRemarks] = useState('');
  const [items, setItems] = useState<NeedAssessmentItemDetail[]>([]);

  const loadList = async () => {
    setLoading(true);
    try {
      const [assessmentsData, usersData] = await Promise.all([
        fetchNeedAssessments(token),
        fetchAuthorizedUsers(token)
      ]);
      setAssessments(assessmentsData);
      setAuthorizedUsers(usersData);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadList();
  }, [token]);

  const handleSelect = async (id: string) => {
    setLoading(true);
    try {
      const data = await fetchNeedAssessmentDetail(id, token);
      setDetail(data);
      setSelectedId(id);
      setIsCreating(false);
      setTitle(data.Title);
      setFiscalYear(data.FiscalYear);
      setRemarks(data.Remarks || '');
      setItems(data.Items);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddItem = () => {
    setItems([...items, { Description: '', Quantity: 1, Unit: 'Unit', EstimatedUnitCost: 0, Priority: 'Normal', ProcurementType: 'Goods' }]);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: keyof NeedAssessmentItemDetail, value: any) => {
    const newItems = [...items];
    (newItems[index] as any)[field] = value;
    setItems(newItems);
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const payload = { Title: title, FiscalYear: fiscalYear, Remarks: remarks, Items: items };
      if (selectedId) {
        await updateNeedAssessment(selectedId, token, payload);
      } else {
        await createNeedAssessment(token, payload);
      }
      setIsCreating(false);
      setSelectedId(null);
      loadList();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDecision = async (decision: string) => {
    if (!selectedId) return;
    setLoading(true);
    try {
      await submitNeedAssessmentDecision(selectedId, token, decision, remarks);
      handleSelect(selectedId);
      loadList();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="portal-workspace">
      <header className="portal-workspace-header">
        <div>
          <h2 className="portal-workspace-title">{module.title}</h2>
          <p className="portal-workspace-description">{module.description}</p>
        </div>
        <div className="portal-workspace-actions">
          {!isCreating && !selectedId && activeTab === 'assessments' && (
            <button className="plan-button plan-button--primary" onClick={() => { setIsCreating(true); setItems([]); setTitle(''); setRemarks(''); }}>
              Create New Assessment
            </button>
          )}
          {(isCreating || selectedId) && (
            <button className="plan-button" onClick={() => { setIsCreating(false); setSelectedId(null); setDetail(null); }}>
              Back to List
            </button>
          )}
        </div>
      </header>

      {error && <div className="portal-alert">{error}</div>}

      {loading && <div className="plan-loading">Processing...</div>}

      {!isCreating && !selectedId && (
        <div className="portal-tabs" style={{ marginBottom: '1.5rem' }}>
          <button 
            className={`portal-tab ${activeTab === 'assessments' ? 'portal-tab--active' : ''}`}
            onClick={() => setActiveTab('assessments')}
          >
            Need Assessments
          </button>
          <button 
            className={`portal-tab ${activeTab === 'users' ? 'portal-tab--active' : ''}`}
            onClick={() => setActiveTab('users')}
          >
            Authorized Users ({authorizedUsers.length})
          </button>
        </div>
      )}

      {!isCreating && !selectedId ? (
        activeTab === 'assessments' ? (
          <div className="plan-table-container">
            <table className="plan-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Unit</th>
                  <th>Year</th>
                  <th>Estimated Total</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {assessments.map((a) => (
                  <tr key={a.NeedAssessmentId}>
                    <td>{a.Title}</td>
                    <td>{a.UnitName}</td>
                    <td>{a.FiscalYear}</td>
                    <td>₦{a.TotalEstimatedCost.toLocaleString()}</td>
                    <td><span className={`plan-badge plan-badge--${a.Status.toLowerCase()}`}>{a.Status}</span></td>
                    <td>
                      <button className="plan-button plan-button--outline" onClick={() => handleSelect(a.NeedAssessmentId)}>View</button>
                    </td>
                  </tr>
                ))}
                {assessments.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                      No need assessments found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="plan-table-container">
            <table className="plan-table">
              <thead>
                <tr>
                  <th>Full Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Unit</th>
                  <th>Access Basis</th>
                </tr>
              </thead>
              <tbody>
                {authorizedUsers.map((u) => (
                  <tr key={u.InternalUserId}>
                    <td><strong>{u.FullName}</strong></td>
                    <td>{u.Email}</td>
                    <td>{u.RoleName}</td>
                    <td>{u.UnitName}</td>
                    <td>
                      <span className={`plan-badge ${u.AccessType === 'Direct Grant' ? 'plan-badge--urgent' : 'plan-badge--normal'}`}>
                        {u.AccessType}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : (
        <div className="plan-form-container">
          <div className="plan-form-section">
            <h3 className="plan-form-section-title">Assessment Information</h3>
            <div className="plan-field-group">
              <div className="plan-field">
                <label>Title</label>
                <input type="text" className="plan-input" value={title} onChange={(e) => setTitle(e.target.value)} disabled={!!selectedId && detail?.Status !== 'Draft' && detail?.Status !== 'Returned'} />
              </div>
              <div className="plan-field">
                <label>Fiscal Year</label>
                <input type="number" className="plan-input" value={fiscalYear} onChange={(e) => setFiscalYear(Number(e.target.value))} disabled={!!selectedId && detail?.Status !== 'Draft' && detail?.Status !== 'Returned'} />
              </div>
            </div>
            <div className="plan-field">
              <label>Remarks / Justification</label>
              <textarea className="plan-input" rows={3} value={remarks} onChange={(e) => setRemarks(e.target.value)} disabled={!!selectedId && detail?.Status !== 'Draft' && detail?.Status !== 'Returned' && detail?.Status !== 'Submitted'} />
            </div>
          </div>

          <div className="plan-form-section">
            <h3 className="plan-form-section-title">Items Required</h3>
            <table className="plan-table">
              <thead>
                <tr>
                  <th>Description</th>
                  <th>Qty</th>
                  <th>Unit</th>
                  <th>Est. Unit Cost</th>
                  <th>Total</th>
                  <th>Type</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <tr key={idx}>
                    <td><input type="text" className="plan-input" value={item.Description} onChange={(e) => handleItemChange(idx, 'Description', e.target.value)} disabled={!!selectedId && detail?.Status !== 'Draft' && detail?.Status !== 'Returned'} /></td>
                    <td><input type="number" className="plan-input" value={item.Quantity} onChange={(e) => handleItemChange(idx, 'Quantity', Number(e.target.value))} disabled={!!selectedId && detail?.Status !== 'Draft' && detail?.Status !== 'Returned'} /></td>
                    <td><input type="text" className="plan-input" value={item.Unit} onChange={(e) => handleItemChange(idx, 'Unit', e.target.value)} disabled={!!selectedId && detail?.Status !== 'Draft' && detail?.Status !== 'Returned'} /></td>
                    <td><input type="number" className="plan-input" value={item.EstimatedUnitCost} onChange={(e) => handleItemChange(idx, 'EstimatedUnitCost', Number(e.target.value))} disabled={!!selectedId && detail?.Status !== 'Draft' && detail?.Status !== 'Returned'} /></td>
                    <td>₦{(item.Quantity * item.EstimatedUnitCost).toLocaleString()}</td>
                    <td>
                      <select className="plan-input" value={item.ProcurementType} onChange={(e) => handleItemChange(idx, 'ProcurementType', e.target.value)} disabled={!!selectedId && detail?.Status !== 'Draft' && detail?.Status !== 'Returned'}>
                        <option value="Goods">Goods</option>
                        <option value="Works">Works</option>
                        <option value="Services">Services</option>
                      </select>
                    </td>
                    <td>
                      {(!selectedId || detail?.Status === 'Draft' || detail?.Status === 'Returned') && (
                        <button className="plan-button plan-button--danger" onClick={() => handleRemoveItem(idx)}>Remove</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {(!selectedId || detail?.Status === 'Draft' || detail?.Status === 'Returned') && (
              <button className="plan-button plan-button--outline" onClick={handleAddItem} style={{ marginTop: '1rem' }}>+ Add Line Item</button>
            )}
          </div>

          <div className="plan-form-footer">
            {(!selectedId || detail?.Status === 'Draft' || detail?.Status === 'Returned') && (
              <button className="plan-button plan-button--primary" onClick={handleSave}>Save Assessment</button>
            )}
            {selectedId && (detail?.Status === 'Draft' || detail?.Status === 'Returned') && (
              <button className="plan-button plan-button--success" onClick={() => handleDecision('Submit')}>Submit for Endorsement</button>
            )}
            {selectedId && detail?.Status === 'Submitted' && (role === 'formation_head' || role === 'department_head' || role === 'admin') && (
              <>
                <button className="plan-button plan-button--success" onClick={() => handleDecision('Endorse')}>Endorse Need</button>
                <button className="plan-button plan-button--warning" onClick={() => handleDecision('Return')}>Return for Correction</button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
