'use client';

import React, { useEffect, useMemo, useState } from 'react';
import type { InternalModule, RoleKey } from '../types/internal';
import {
  fetchNeedAssessments,
  fetchNeedAssessmentDetail,
  createNeedAssessment,
  updateNeedAssessment,
  submitNeedAssessmentDecision,
  fetchAuthorizedUsers,
  type NeedAssessmentSummary,
  type NeedAssessmentDetail,
  type NeedAssessmentItemDetail,
  type NeedAssessmentAuthorizedUser
} from '../services/needsCollectionService';
import { formatCurrency, formatDateTimeShort } from '../utils/procureUtils';
import {
  FileText,
  Users,
  Plus,
  ArrowLeft,
  Save,
  Send,
  CheckCircle,
  XCircle,
  RotateCcw,
  Search,
  Calendar,
  Building2,
  Wallet,
  Package,
  Trash2,
  Loader2
} from 'lucide-react';

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
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

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

  const filteredAssessments = useMemo(() => {
    if (!searchQuery.trim()) return assessments;
    const query = searchQuery.toLowerCase();
    return assessments.filter(
      (a) =>
        a.Title.toLowerCase().includes(query) ||
        a.UnitName.toLowerCase().includes(query) ||
        a.Status.toLowerCase().includes(query)
    );
  }, [assessments, searchQuery]);

  const statusCounts = useMemo(() => {
    return {
      total: assessments.length,
      draft: assessments.filter((a) => a.Status === 'Draft').length,
      submitted: assessments.filter((a) => a.Status === 'Submitted').length,
      endorsed: assessments.filter((a) => a.Status === 'Endorsed').length,
    };
  }, [assessments]);

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

  const handleCreateNew = () => {
    setIsCreating(true);
    setSelectedId(null);
    setDetail(null);
    setTitle('');
    setRemarks('');
    setFiscalYear(new Date().getFullYear());
    setItems([]);
  };

  const handleBackToList = () => {
    setIsCreating(false);
    setSelectedId(null);
    setDetail(null);
    setError(null);
    setSuccessMessage(null);
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

  const calculateTotal = () => {
    return items.reduce((sum, item) => sum + (item.Quantity * item.EstimatedUnitCost), 0);
  };

  const canEdit = () => {
    if (isCreating) return true;
    if (!detail) return false;
    return detail.Status === 'Draft' || detail.Status === 'Returned';
  };

  const canSubmit = () => {
    if (!detail) return false;
    return detail.Status === 'Draft' || detail.Status === 'Returned';
  };

  const canDecide = () => {
    if (!detail) return false;
    if (detail.Status !== 'Submitted') return false;
    return role === 'formation_head' || role === 'department_head' || role === 'admin';
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const payload = { Title: title, FiscalYear: fiscalYear, Remarks: remarks, Items: items };
      if (selectedId) {
        await updateNeedAssessment(selectedId, token, payload);
        setSuccessMessage('Assessment updated successfully');
      } else {
        await createNeedAssessment(token, payload);
        setSuccessMessage('Assessment created successfully');
      }
      setTimeout(() => setSuccessMessage(null), 3000);
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
      setSuccessMessage(`Assessment ${decision.toLowerCase()}ed successfully`);
      setTimeout(() => setSuccessMessage(null), 3000);
      handleSelect(selectedId);
      loadList();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadgeClass = (status: string) => {
    const base = 'app-badge';
    switch (status.toLowerCase()) {
      case 'draft':
        return `${base} app-badge--draft`;
      case 'submitted':
        return `${base} app-badge--submitted`;
      case 'endorsed':
        return `${base} app-badge--endorsed`;
      case 'returned':
        return `${base} app-badge--warning`;
      case 'rejected':
        return `${base} app-badge--rejected`;
      default:
        return base;
    }
  };

  // Assessment Detail View
  if (selectedId || isCreating) {
    return (
      <section className="app-module">
        <header className="app-module__header">
          <div className="app-module__title-group">
            <button className="app-btn app-btn--secondary app-btn--sm" onClick={handleBackToList}>
              <ArrowLeft className="app-btn__icon" /> Back to List
            </button>
            <h2 className="app-module__title" style={{ marginTop: '1rem' }}>
              {isCreating ? 'Create New Assessment' : detail?.Title}
            </h2>
            <p className="app-module__description">
              {isCreating ? 'Fill in the details to create a new needs assessment' : `View and manage assessment details`}
            </p>
          </div>
          <div className="app-module__actions">
            {canEdit() && (
              <button className="app-btn app-btn--primary" onClick={handleSave} disabled={loading}>
                {loading ? <Loader2 className="animate-spin" /> : <Save className="app-btn__icon" />}
                Save Assessment
              </button>
            )}
          </div>
        </header>

        {error && (
          <div className="app-alert app-alert--error">
            <span className="app-alert__icon">⚠</span>
            {error}
          </div>
        )}

        {successMessage && (
          <div className="app-alert app-alert--success">
            <span className="app-alert__icon">✓</span>
            {successMessage}
          </div>
        )}

        <div className="dh-layout">
          {/* Left Panel - Form */}
          <div className="dh-queue-panel" style={{ flex: 1.5 }}>
            <div className="app-card">
              <div className="app-card__header">
                <div className="app-section-title">
                  <span className="app-section-title__icon">📋</span>
                  <h3 className="app-section-title__text">Assessment Information</h3>
                </div>
              </div>

              <div className="app-form-grid">
                <div className="app-form-group">
                  <label className="app-form-label">Title</label>
                  <input
                    type="text"
                    className="app-form__input"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    disabled={!canEdit()}
                    placeholder="Enter assessment title"
                  />
                </div>

                <div className="app-form-group">
                  <label className="app-form-label">Fiscal Year</label>
                  <input
                    type="number"
                    className="app-form__input"
                    value={fiscalYear}
                    onChange={(e) => setFiscalYear(Number(e.target.value))}
                    disabled={!canEdit()}
                  />
                </div>
              </div>

              <div className="app-form-group" style={{ marginTop: '1rem' }}>
                <label className="app-form-label">Remarks / Justification</label>
                <textarea
                  className="app-form__textarea"
                  rows={3}
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  disabled={!canEdit() && !detail?.Status}
                  placeholder="Add any additional remarks or justification..."
                />
              </div>
            </div>

            {/* Items Section */}
            <div className="app-card" style={{ marginTop: '1.5rem' }}>
              <div className="app-card__header">
                <div className="app-section-title">
                  <span className="app-section-title__icon">📦</span>
                  <h3 className="app-section-title__text">Items Required</h3>
                  <span className="app-section-title__count">{items.length}</span>
                </div>
                {canEdit() && (
                  <button className="app-btn app-btn--secondary app-btn--sm" onClick={handleAddItem}>
                    <Plus className="app-btn__icon" /> Add Item
                  </button>
                )}
              </div>

              <div className="app-table-wrapper">
                <table className="app-table app-table--compact">
                  <thead>
                    <tr>
                      <th>Description</th>
                      <th className="app-table__cell--numeric">Qty</th>
                      <th>Unit</th>
                      <th className="app-table__cell--numeric">Est. Unit Cost</th>
                      <th className="app-table__cell--numeric">Total</th>
                      <th>Type</th>
                      {canEdit() && <th>Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, idx) => (
                      <tr key={idx}>
                        <td>
                          {canEdit() ? (
                            <input
                              type="text"
                              className="app-form__input app-form__input--sm"
                              value={item.Description}
                              onChange={(e) => handleItemChange(idx, 'Description', e.target.value)}
                              placeholder="Item description"
                            />
                          ) : (
                            item.Description
                          )}
                        </td>
                        <td className="app-table__cell--numeric">
                          {canEdit() ? (
                            <input
                              type="number"
                              className="app-form__input app-form__input--sm"
                              value={item.Quantity}
                              onChange={(e) => handleItemChange(idx, 'Quantity', Number(e.target.value))}
                              min={1}
                            />
                          ) : (
                            item.Quantity
                          )}
                        </td>
                        <td>
                          {canEdit() ? (
                            <input
                              type="text"
                              className="app-form__input app-form__input--sm"
                              value={item.Unit}
                              onChange={(e) => handleItemChange(idx, 'Unit', e.target.value)}
                            />
                          ) : (
                            item.Unit
                          )}
                        </td>
                        <td className="app-table__cell--numeric">
                          {canEdit() ? (
                            <input
                              type="number"
                              className="app-form__input app-form__input--sm"
                              value={item.EstimatedUnitCost}
                              onChange={(e) => handleItemChange(idx, 'EstimatedUnitCost', Number(e.target.value))}
                              min={0}
                            />
                          ) : (
                            formatCurrency(item.EstimatedUnitCost)
                          )}
                        </td>
                        <td className="app-table__cell--numeric">
                          {formatCurrency(item.Quantity * item.EstimatedUnitCost)}
                        </td>
                        <td>
                          {canEdit() ? (
                            <select
                              className="app-form__select app-form__select--sm"
                              value={item.ProcurementType}
                              onChange={(e) => handleItemChange(idx, 'ProcurementType', e.target.value)}
                            >
                              <option value="Goods">Goods</option>
                              <option value="Works">Works</option>
                              <option value="Services">Services</option>
                            </select>
                          ) : (
                            item.ProcurementType
                          )}
                        </td>
                        {canEdit() && (
                          <td>
                            <button
                              className="app-btn app-btn--danger app-btn--sm"
                              onClick={() => handleRemoveItem(idx)}
                              title="Remove item"
                            >
                              <Trash2 className="app-btn__icon" />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                    {items.length === 0 && (
                      <tr>
                        <td colSpan={canEdit() ? 7 : 6} className="app-table__empty">
                          No items added yet. Click "Add Item" to begin.
                        </td>
                      </tr>
                    )}
                  </tbody>
                  {items.length > 0 && (
                    <tfoot>
                      <tr>
                        <td colSpan={4} className="app-table__cell--numeric app-table__total-label">
                          Total Estimated Cost:
                        </td>
                        <td colSpan={2} className="app-table__total-value">
                          {formatCurrency(calculateTotal())}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          </div>

          {/* Right Panel - Status & Actions */}
          <div className="dh-detail-panel" style={{ maxWidth: '280px', flex: '0 0 280px' }}>
            {detail && (
              <div className="app-card">
                <div className="app-card__header">
                  <h3 className="app-card__title">Status Overview</h3>
                </div>

                <div className="app-info-list">
                  <div className="app-info-item">
                    <span className="app-info-item__label">Current Status</span>
                    <span className={getStatusBadgeClass(detail.Status)}>{detail.Status}</span>
                  </div>
                  <div className="app-info-item">
                    <span className="app-info-item__label">Unit</span>
                    <span className="app-info-item__value">{detail.UnitName}</span>
                  </div>
                  <div className="app-info-item">
                    <span className="app-info-item__label">Fiscal Year</span>
                    <span className="app-info-item__value">{detail.FiscalYear}</span>
                  </div>
                  <div className="app-info-item">
                    <span className="app-info-item__label">Total Items</span>
                    <span className="app-info-item__value">{detail.Items.length}</span>
                  </div>
                  <div className="app-info-item">
                    <span className="app-info-item__label">Total Cost</span>
                    <span className="app-info-item__value app-info-item__value--highlight">
                      {formatCurrency(detail.TotalEstimatedCost)}
                    </span>
                  </div>
                  {detail.SubmittedAt && (
                    <div className="app-info-item">
                      <span className="app-info-item__label">Submitted</span>
                      <span className="app-info-item__value">{formatDateTimeShort(detail.SubmittedAt)}</span>
                    </div>
                  )}
                  {detail.EndorsedAt && (
                    <div className="app-info-item">
                      <span className="app-info-item__label">Endorsed</span>
                      <span className="app-info-item__value">{formatDateTimeShort(detail.EndorsedAt)}</span>
                    </div>
                  )}
                  {detail.EndorsedBy && (
                    <div className="app-info-item">
                      <span className="app-info-item__label">Endorsed By</span>
                      <span className="app-info-item__value">{detail.EndorsedBy}</span>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="app-card__footer" style={{ flexDirection: 'column', gap: '0.75rem' }}>
                  {canSubmit() && (
                    <>
                      <button
                        className="app-btn app-btn--success app-btn--lg"
                        onClick={() => handleDecision('Submit')}
                        disabled={loading}
                      >
                        {loading ? <Loader2 className="animate-spin" /> : <Send className="app-btn__icon" />}
                        Submit for Endorsement
                      </button>
                      <button
                        className="app-btn app-btn--secondary"
                        onClick={handleSave}
                        disabled={loading}
                      >
                        <Save className="app-btn__icon" /> Save as Draft
                      </button>
                    </>
                  )}

                  {canDecide() && (
                    <>
                      <button
                        className="app-btn app-btn--success app-btn--lg"
                        onClick={() => handleDecision('Endorse')}
                        disabled={loading}
                      >
                        {loading ? <Loader2 className="animate-spin" /> : <CheckCircle className="app-btn__icon" />}
                        Endorse Need
                      </button>
                      <button
                        className="app-btn app-btn--warning"
                        onClick={() => handleDecision('Return')}
                        disabled={loading}
                      >
                        <RotateCcw className="app-btn__icon" /> Return for Correction
                      </button>
                      <button
                        className="app-btn app-btn--danger"
                        onClick={() => handleDecision('Reject')}
                        disabled={loading}
                      >
                        <XCircle className="app-btn__icon" /> Reject
                      </button>
                    </>
                  )}

                  {!canSubmit() && !canDecide() && detail?.Status !== 'Draft' && (
                    <div className="app-info-item">
                      <span className="app-info-item__label" style={{ textAlign: 'center', width: '100%' }}>
                        No actions available for this status
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Help Card */}
            <div className="app-card app-card--compact" style={{ marginTop: '1rem' }}>
              <div className="app-card__header">
                <h3 className="app-card__title" style={{ fontSize: '0.85rem' }}>Need Assessment Guide</h3>
              </div>
              <div className="app-info-list" style={{ fontSize: '0.8rem' }}>
                <div className="app-info-item" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.25rem' }}>
                  <span className="app-info-item__label" style={{ fontSize: '0.7rem', textTransform: 'uppercase' }}>Step 1</span>
                  <span className="app-info-item__value">Create assessment with items</span>
                </div>
                <div className="app-info-item" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.25rem' }}>
                  <span className="app-info-item__label" style={{ fontSize: '0.7rem', textTransform: 'uppercase' }}>Step 2</span>
                  <span className="app-info-item__value">Submit for endorsement</span>
                </div>
                <div className="app-info-item" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.25rem' }}>
                  <span className="app-info-item__label" style={{ fontSize: '0.7rem', textTransform: 'uppercase' }}>Step 3</span>
                  <span className="app-info-item__value">Department head reviews</span>
                </div>
                <div className="app-info-item" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.25rem' }}>
                  <span className="app-info-item__label" style={{ fontSize: '0.7rem', textTransform: 'uppercase' }}>Step 4</span>
                  <span className="app-info-item__value">Convert to requisitions</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  // List View
  return (
    <section className="app-module">
      <header className="app-module__header">
        <div className="app-module__title-group">
          <h2 className="app-module__title">{module.title}</h2>
          <p className="app-module__description">{module.description}</p>
        </div>
        <div className="app-module__actions">
          <button className="app-btn app-btn--primary" onClick={handleCreateNew}>
            <Plus className="app-btn__icon" /> Create New Assessment
          </button>
        </div>
      </header>

      {error && (
        <div className="app-alert app-alert--error">
          <span className="app-alert__icon">⚠</span>
          {error}
        </div>
      )}

      {successMessage && (
        <div className="app-alert app-alert--success">
          <span className="app-alert__icon">✓</span>
          {successMessage}
        </div>
      )}

      {/* Stats Row */}
      <div className="app-stats-grid">
        <div className="app-stat-card app-stat-card--info">
          <div className="app-stat-card__value">{statusCounts.total}</div>
          <div className="app-stat-card__label">Total Assessments</div>
        </div>
        <div className="app-stat-card">
          <div className="app-stat-card__value">{statusCounts.draft}</div>
          <div className="app-stat-card__label">Draft</div>
        </div>
        <div className="app-stat-card app-stat-card--warning">
          <div className="app-stat-card__value">{statusCounts.submitted}</div>
          <div className="app-stat-card__label">Pending Endorsement</div>
        </div>
        <div className="app-stat-card app-stat-card--success">
          <div className="app-stat-card__value">{statusCounts.endorsed}</div>
          <div className="app-stat-card__label">Endorsed</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="app-tabs" style={{ marginTop: '1.5rem' }}>
        <button
          className={`app-tab ${activeTab === 'assessments' ? 'app-tab--active' : ''}`}
          onClick={() => setActiveTab('assessments')}
        >
          <FileText className="app-tab__icon" /> Need Assessments
        </button>
        <button
          className={`app-tab ${activeTab === 'users' ? 'app-tab--active' : ''}`}
          onClick={() => setActiveTab('users')}
        >
          <Users className="app-tab__icon" /> Authorized Users ({authorizedUsers.length})
        </button>
      </div>

      {/* Search Bar */}
      {activeTab === 'assessments' && (
        <div className="app-search-bar" style={{ marginTop: '1rem' }}>
          <div className="app-search">
            <Search className="app-search__icon" />
            <input
              className="app-search__input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search assessments by title, unit, or status..."
            />
          </div>
        </div>
      )}

      {/* Content */}
      {loading && !assessments.length ? (
        <div className="app-empty-state">
          <Loader2 className="animate-spin" />
          <p>Loading...</p>
        </div>
      ) : activeTab === 'assessments' ? (
        <div className="app-card" style={{ marginTop: '1rem' }}>
          <div className="app-table-wrapper">
            <table className="app-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Unit</th>
                  <th>Fiscal Year</th>
                  <th className="app-table__cell--numeric">Total Cost</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredAssessments.map((a) => (
                  <tr key={a.NeedAssessmentId}>
                    <td>
                      <div className="app-table__title">{a.Title}</div>
                    </td>
                    <td>
                      <div className="app-table__meta">
                        <Building2 className="app-table__meta-icon" />
                        {a.UnitName}
                      </div>
                    </td>
                    <td>
                      <div className="app-table__meta">
                        <Calendar className="app-table__meta-icon" />
                        {a.FiscalYear}
                      </div>
                    </td>
                    <td className="app-table__cell--numeric">
                      <div className="app-table__meta">
                        <Wallet className="app-table__meta-icon" />
                        {formatCurrency(a.TotalEstimatedCost)}
                      </div>
                    </td>
                    <td>
                      <span className={getStatusBadgeClass(a.Status)}>{a.Status}</span>
                    </td>
                    <td>
                      <span className="app-table__date">{formatDateTimeShort(a.CreatedAt)}</span>
                    </td>
                    <td>
                      <button
                        className="app-btn app-btn--secondary app-btn--sm"
                        onClick={() => handleSelect(a.NeedAssessmentId)}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredAssessments.length === 0 && (
                  <tr>
                    <td colSpan={7} className="app-table__empty">
                      {searchQuery ? 'No assessments match your search' : 'No need assessments found. Create one to get started.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="app-card" style={{ marginTop: '1rem' }}>
          <div className="app-table-wrapper">
            <table className="app-table">
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
                    <td>
                      <div className="app-table__title">{u.FullName}</div>
                    </td>
                    <td>{u.Email}</td>
                    <td>
                      <span className="app-badge">{u.RoleName}</span>
                    </td>
                    <td>{u.UnitName}</td>
                    <td>
                      <span className={`app-badge ${u.AccessType === 'Direct Grant' ? 'app-badge--endorsed' : 'app-badge--draft'}`}>
                        {u.AccessType}
                      </span>
                    </td>
                  </tr>
                ))}
                {authorizedUsers.length === 0 && (
                  <tr>
                    <td colSpan={5} className="app-table__empty">
                      No authorized users found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
};

export default NeedsCollectionModule;
