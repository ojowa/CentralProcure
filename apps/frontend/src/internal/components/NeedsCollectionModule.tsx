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
  fetchNeedsAnalysis,
  type NeedAssessmentSummary,
  type NeedAssessmentDetail,
  type NeedAssessmentItemDetail,
  type NeedAssessmentAuthorizedUser,
  type NeedAssessmentAnalysisResult
} from '../services/needsCollectionService';
import { formatDateTimeShort } from '../utils/procureUtils';
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
  Package,
  Trash2,
  Loader2,
  BarChart3,
  Filter
} from 'lucide-react';

interface NeedsCollectionModuleProps {
  module: InternalModule;
  token: string;
  role?: RoleKey | null;
}

export const NeedsCollectionModule: React.FC<NeedsCollectionModuleProps> = ({ module, token, role }) => {
  const [assessments, setAssessments] = useState<NeedAssessmentSummary[]>([]);
  const [authorizedUsers, setAuthorizedUsers] = useState<NeedAssessmentAuthorizedUser[]>([]);
  const [analysisResults, setAnalysisResults] = useState<NeedAssessmentAnalysisResult[]>([]);
  const [activeTab, setActiveTab] = useState<'assessments' | 'users' | 'analysis'>('assessments');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<NeedAssessmentDetail | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Analysis Filters
  const [analysisYear, setAnalysisYear] = useState(new Date().getFullYear());
  const [analysisStatus, setAnalysisStatus] = useState('Endorsed');

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

  const loadAnalysis = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchNeedsAnalysis(token, analysisYear, undefined, analysisStatus);
      setAnalysisResults(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'analysis') {
      loadAnalysis();
    } else {
      loadList();
    }
  }, [token, activeTab, analysisYear, analysisStatus]);

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

  const filteredAnalysis = useMemo(() => {
    if (!searchQuery.trim()) return analysisResults;
    const query = searchQuery.toLowerCase();
    return analysisResults.filter(
      (r) =>
        r.ItemDescription.toLowerCase().includes(query) ||
        r.ProcurementType.toLowerCase().includes(query)
    );
  }, [analysisResults, searchQuery]);

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
    setItems([...items, { Description: '', Quantity: 1, Unit: 'Unit', Priority: 'Normal', ProcurementType: 'Goods' }]);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: keyof NeedAssessmentItemDetail, value: any) => {
    const newItems = [...items];
    (newItems[index] as any)[field] = value;
    setItems(newItems);
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
    switch (status) {
      case 'Draft': return `${base} bg-slate-100 text-slate-700`;
      case 'Submitted': return `${base} bg-blue-100 text-blue-700`;
      case 'Endorsed': return `${base} bg-emerald-100 text-emerald-700 font-bold`;
      case 'Rejected': return `${base} bg-red-100 text-red-700`;
      case 'Returned': return `${base} bg-amber-100 text-amber-700`;
      default: return base;
    }
  };

  if (selectedId || isCreating) {
    return (
      <section className="app-module">
        <header className="app-module__header">
          <div className="app-module__title-group">
            <button className="app-btn app-btn--secondary app-btn--sm mb-4" onClick={handleBackToList}>
              <ArrowLeft size={16} className="mr-2" /> Back to List
            </button>
            <h2 className="app-module__title">{isCreating ? 'Create Need Assessment' : `Assessment: ${detail?.Title}`}</h2>
          </div>
        </header>

        {error && <div className="app-alert app-alert--error mb-6">{error}</div>}
        {successMessage && <div className="app-alert app-alert--success mb-6">{successMessage}</div>}

        <div className="dh-layout" style={{ minHeight: 'calc(100vh - 220px)' }}>
          {/* Left Panel - Form */}
          <div className="dh-queue-panel" style={{ flex: 1.5 }}>
            <div className="app-card">
              <div className="app-form-grid p-6">
                <div className="app-form-group col-span-2">
                  <label className="app-form-label">Assessment Title</label>
                  <input
                    className="app-form__input"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. FY 2026 ICT Equipment Needs"
                    disabled={!canEdit()}
                  />
                </div>
                <div className="app-form-group">
                  <label className="app-form-label">Fiscal Year</label>
                  <select
                    className="app-form__select"
                    value={fiscalYear}
                    onChange={(e) => setFiscalYear(Number(e.target.value))}
                    disabled={!canEdit()}
                  >
                    {[0, 1, 2].map(offset => {
                      const year = new Date().getFullYear() + offset;
                      return <option key={year} value={year}>{year}</option>;
                    })}
                  </select>
                </div>
                <div className="app-form-group col-span-3">
                  <label className="app-form-label">Internal Remarks / Context</label>
                  <textarea
                    className="app-form__input"
                    rows={2}
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="Additional context for this assessment..."
                  />
                </div>
              </div>

              {/* Items Section */}
              <div className="p-6 border-t border-slate-100">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-slate-800 flex items-center gap-2">
                    <Package size={18} className="text-emerald-600" />
                    Required Items
                  </h3>
                  {canEdit() && (
                    <button className="app-btn app-btn--secondary app-btn--sm" onClick={handleAddItem}>
                      <Plus size={14} className="mr-1" /> Add Item
                    </button>
                  )}
                </div>

                <div className="app-table-wrapper">
                  <table className="app-table">
                    <thead>
                      <tr>
                        <th style={{ width: '40%' }}>Description</th>
                        <th>Type</th>
                        <th style={{ width: '80px' }}>Qty</th>
                        <th>Unit</th>
                        <th>Priority</th>
                        {canEdit() && <th style={{ width: '50px' }}></th>}
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item, idx) => (
                        <tr key={idx}>
                          <td>
                            <input
                              className="app-form__input app-form__input--sm"
                              value={item.Description}
                              onChange={(e) => handleItemChange(idx, 'Description', e.target.value)}
                              disabled={!canEdit()}
                            />
                          </td>
                          <td>
                            <select
                              className="app-form__select app-form__select--sm"
                              value={item.ProcurementType}
                              onChange={(e) => handleItemChange(idx, 'ProcurementType', e.target.value)}
                              disabled={!canEdit()}
                            >
                              <option value="Goods">Goods</option>
                              <option value="Works">Works</option>
                              <option value="Services">Services</option>
                            </select>
                          </td>
                          <td>
                            <input
                              type="number"
                              className="app-form__input app-form__input--sm"
                              value={item.Quantity}
                              onChange={(e) => handleItemChange(idx, 'Quantity', Number(e.target.value))}
                              disabled={!canEdit()}
                            />
                          </td>
                          <td>
                            <input
                              className="app-form__input app-form__input--sm"
                              value={item.Unit}
                              onChange={(e) => handleItemChange(idx, 'Unit', e.target.value)}
                              disabled={!canEdit()}
                              placeholder="e.g. Pcs"
                            />
                          </td>
                          <td>
                            <select
                              className="app-form__select app-form__select--sm"
                              value={item.Priority}
                              onChange={(e) => handleItemChange(idx, 'Priority', e.target.value)}
                              disabled={!canEdit()}
                            >
                              <option value="Normal">Normal</option>
                              <option value="Urgent">Urgent</option>
                              <option value="Strategic">Strategic</option>
                            </select>
                          </td>
                          {canEdit() && (
                            <td>
                              <button className="text-red-400 hover:text-red-600" onClick={() => handleRemoveItem(idx)}>
                                <Trash2 size={14} />
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                      {!items.length && (
                        <tr>
                          <td colSpan={canEdit() ? 6 : 5} className="py-8 text-center text-slate-400 italic">
                            No items added yet. Click "Add Item" to begin.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          {/* Right Panel - Status & Actions */} 
          <div className="dh-detail-panel" style={{ maxWidth: '320px', flex: '0 0 320px', display: 'flex', flexDirection: 'column', height: '100%' }}>
            {detail && (
              <div className="app-card" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <div className="app-card__header">
                  <h3 className="app-card__title">Status Overview</h3>
                </div>

                <div className="app-info-list" style={{ flex: 1, overflowY: 'auto' }}>
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
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="app-module">
      <header className="app-module__header">
        <div className="app-module__title-group">
          <h2 className="app-module__title">{module.title}</h2>
          <p className="app-module__description">{module.description}</p>
        </div>
        <div className="app-module__actions">
          <button className="app-btn app-btn--primary" onClick={handleCreateNew}>
            <Plus size={18} className="mr-2" /> New Assessment
          </button>
        </div>
      </header>

      {/* Stats Summary */}
      <div className="app-stats-row">
        <div className="app-stat-card">
          <div className="app-stat-card__value">{statusCounts.total}</div>
          <div className="app-stat-card__label">Total Assessments</div>
        </div>
        <div className="app-stat-card">
          <div className="app-stat-card__value">{statusCounts.draft}</div>
          <div className="app-stat-card__label">In Draft</div>
        </div>
        <div className="app-stat-card app-stat-card--info">
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
        <button
          className={`app-tab ${activeTab === 'analysis' ? 'app-tab--active' : ''}`}
          onClick={() => setActiveTab('analysis')}
        >
          <BarChart3 className="app-tab__icon" /> Needs Analysis
        </button>
      </div>

      {/* Search Bar & Filters */}
      <div className="app-search-bar" style={{ marginTop: '1rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
        <div className="app-search" style={{ flex: 1 }}>
          <Search className="app-search__icon" />
          <input
            className="app-search__input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={activeTab === 'analysis' ? "Search by item description or type..." : "Search assessments by title, unit, or status..."}
          />
        </div>
        
        {activeTab === 'analysis' && (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-white border border-slate-200 rounded px-2 py-1">
              <Calendar size={14} className="text-slate-400" />
              <select 
                className="text-xs font-medium text-slate-600 bg-transparent border-none outline-none"
                value={analysisYear}
                onChange={e => setAnalysisYear(Number(e.target.value))}
              >
                {[0, 1, 2].map(offset => {
                  const year = new Date().getFullYear() + offset;
                  return <option key={year} value={year}>{year} Budget Year</option>;
                })}
              </select>
            </div>
            
            <div className="flex items-center gap-1 bg-white border border-slate-200 rounded px-2 py-1">
              <Filter size={14} className="text-slate-400" />
              <select 
                className="text-xs font-medium text-slate-600 bg-transparent border-none outline-none"
                value={analysisStatus}
                onChange={e => setAnalysisStatus(e.target.value)}
              >
                <option value="Endorsed">Endorsed Only</option>
                <option value="Submitted">Submitted & Endorsed</option>
                <option value="">All Statuses</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {activeTab === 'analysis' && (
        <div className="app-stats-row" style={{ marginTop: '1rem', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
          <div className="app-stat-card">
            <div className="app-stat-card__value">{filteredAnalysis.length}</div>
            <div className="app-stat-card__label">Unique Items Identified</div>
          </div>
          <div className="app-stat-card app-stat-card--info">
            <div className="app-stat-card__value">{analysisYear}</div>
            <div className="app-stat-card__label">Fiscal Analysis Period</div>
          </div>
          <div className="app-stat-card">
            <div className="app-stat-card__value">{analysisResults.reduce((sum, r) => sum + Number(r.OccurrenceCount), 0)}</div>
            <div className="app-stat-card__label">Assessment Sources</div>
          </div>
        </div>
      )}

      {/* Content */}
      {loading && (activeTab !== 'analysis' || !analysisResults.length) ? (
        <div className="app-empty-state">
          <Loader2 className="animate-spin" />
          <p>Loading...</p>
        </div>
      ) : activeTab === 'analysis' ? (
        <div className="app-card" style={{ marginTop: '1rem' }}>
          <div className="app-table-wrapper">
            <table className="app-table">
              <thead>
                <tr>
                  <th>Description</th>
                  <th>Type</th>
                  <th>Unit</th>
                  <th className="app-table__cell--numeric">Total Qty</th>
                  <th>Priority Breakdown</th>
                  <th>Sources</th>
                </tr>
              </thead>
              <tbody>
                {filteredAnalysis.map((item, idx) => (
                  <tr key={idx}>
                    <td><div className="font-medium text-slate-800">{item.ItemDescription}</div></td>
                    <td><span className="app-badge">{item.ProcurementType}</span></td>
                    <td><span className="text-slate-600 text-xs">{item.Unit}</span></td>
                    <td className="app-table__cell--numeric font-semibold text-emerald-700">{item.TotalQuantity}</td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {item.PrioritySummary.split(', ').map(p => (
                          <span key={p} className={`text-[10px] px-1.5 rounded-full ${p === 'Urgent' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'}`}>
                            {p}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center gap-1 text-slate-500 text-xs">
                        <Users size={12} />
                        {item.OccurrenceCount}
                      </div>
                    </td>
                  </tr>
                ))}
                {!filteredAnalysis.length && (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      No analysis data found for the selected period and status.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
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
                    <td>{a.FiscalYear}</td>
                    <td>
                      <span className={getStatusBadgeClass(a.Status)}>{a.Status}</span>
                    </td>
                    <td>
                      <div className="app-table__meta">
                        {formatDateTimeShort(a.CreatedAt)}
                      </div>
                    </td>
                    <td>
                      <button className="app-btn app-btn--secondary app-btn--sm" onClick={() => handleSelect(a.NeedAssessmentId)}>
                        View Details
                      </button>
                    </td>
                  </tr>
                ))}
                {!filteredAssessments.length && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      No assessments found.
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
                  <th>Access Type</th>
                </tr>
              </thead>
              <tbody>
                {authorizedUsers.map((u) => (
                  <tr key={u.InternalUserId}>
                    <td><div className="font-medium text-slate-800">{u.FullName}</div></td>
                    <td><div className="text-slate-500 text-sm">{u.Email}</div></td>
                    <td><span className="app-badge">{u.RoleName}</span></td>
                    <td>{u.UnitName}</td>
                    <td>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${u.AccessType === 'Direct Grant' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                        {u.AccessType}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
};
