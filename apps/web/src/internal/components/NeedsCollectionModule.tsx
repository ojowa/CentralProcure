'use client';

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import type { InternalModule, RoleKey } from '../types/internal';
import { usePermission } from '../hooks/usePermission';
import {
  fetchCollections,
  fetchCollectionDetail,
  createCollection,
  updateCollection,
  submitCollection,
  deleteCollection,
  fetchNeedsAnalysis,
  fetchAssessments,
  fetchAssessmentDetail,
  createAssessmentFromAnalysis,
  submitAssessmentDecision,
  type NeedsCollectionSummary,
  type NeedsCollectionDetail,
  type NeedsCollectionItem,
  type NeedsAnalysisResult,
  type NeedsAssessmentSummary,
  type NeedsAssessmentDetail,
  type NeedsAssessmentItem,
} from '../services/needsCollectionService';
import { formatDateTimeShort } from '../utils/procureUtils';
import {
  FileText, Plus, ArrowLeft, Save, Send, CheckCircle, XCircle,
  Search, Building2, Package, Trash2, Loader2, BarChart3, Filter,
  ClipboardList, RotateCcw
} from 'lucide-react';

interface NeedsCollectionModuleProps {
  module: InternalModule;
  token: string;
  role?: RoleKey | null;
}

type Tab = 'collections' | 'analysis' | 'assessments';
type View = 'list' | 'collection-detail' | 'assessment-detail';

export const NeedsCollectionModule: React.FC<NeedsCollectionModuleProps> = ({ module, token, role }) => {
  const { hasPermission } = usePermission(token);

  // Tab / navigation
  const [activeTab, setActiveTab] = useState<Tab>('collections');
  const [view, setView] = useState<View>('list');

  // Data
  const [collections, setCollections] = useState<NeedsCollectionSummary[]>([]);
  const [analysis, setAnalysis] = useState<NeedsAnalysisResult[]>([]);
  const [assessments, setAssessments] = useState<NeedsAssessmentSummary[]>([]);
  const [selectedCollection, setSelectedCollection] = useState<NeedsCollectionDetail | null>(null);
  const [selectedAssessment, setSelectedAssessment] = useState<NeedsAssessmentDetail | null>(null);

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [analysisYear, setAnalysisYear] = useState(new Date().getFullYear());
  const [isCreating, setIsCreating] = useState(false);

  // Collection form
  const [formTitle, setFormTitle] = useState('');
  const [formFiscalYear, setFormFiscalYear] = useState(new Date().getFullYear());
  const [formRemarks, setFormRemarks] = useState('');
  const [formItems, setFormItems] = useState<NeedsCollectionItem[]>([]);

  const clearMessages = useCallback(() => { setError(null); setSuccess(null); }, []);

  // ── Loaders ──────────────────────────────────
  const loadCollections = useCallback(async () => {
    setLoading(true); clearMessages();
    try {
      const data = await fetchCollections(token);
      setCollections(data.Collections);
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  }, [token, clearMessages]);

  const loadAnalysis = useCallback(async () => {
    setLoading(true); clearMessages();
    try {
      const data = await fetchNeedsAnalysis(token, analysisYear);
      setAnalysis(data);
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  }, [token, analysisYear, clearMessages]);

  const loadAssessments = useCallback(async () => {
    setLoading(true); clearMessages();
    try {
      const data = await fetchAssessments(token);
      setAssessments(data);
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  }, [token, clearMessages]);

  useEffect(() => {
    if (activeTab === 'collections' && view === 'list') loadCollections();
    if (activeTab === 'analysis' && view === 'list') loadAnalysis();
    if (activeTab === 'assessments' && view === 'list') loadAssessments();
  }, [activeTab, view, loadCollections, loadAnalysis, loadAssessments]);

  useEffect(() => { if (success) { const t = setTimeout(() => setSuccess(null), 3000); return () => clearTimeout(t); } }, [success]);

  // ── Collection actions ────────────────────────
  const filteredCollections = useMemo(() => {
    if (!searchQuery.trim()) return collections;
    const q = searchQuery.toLowerCase();
    return collections.filter(c => c.Title.toLowerCase().includes(q) || c.UnitName?.toLowerCase().includes(q) || c.Status.toLowerCase().includes(q));
  }, [collections, searchQuery]);

  const handleSelectCollection = async (id: string) => {
    setLoading(true); clearMessages();
    try {
      const data = await fetchCollectionDetail(id, token);
      setSelectedCollection(data);
      setFormTitle(data.Title);
      setFormFiscalYear(data.FiscalYear);
      setFormRemarks(data.Remarks || '');
      setFormItems(data.Items);
      setView('collection-detail');
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  const handleCreateCollection = () => {
    setIsCreating(true); setSelectedCollection(null);
    setFormTitle(''); setFormFiscalYear(new Date().getFullYear()); setFormRemarks(''); setFormItems([]);
    setView('collection-detail');
  };

  const handleSaveCollection = async () => {
    setLoading(true); clearMessages();
    try {
      const payload = { Title: formTitle, FiscalYear: formFiscalYear, Remarks: formRemarks, Items: formItems };
      if (selectedCollection) {
        await updateCollection(selectedCollection.CollectionId, token, payload);
        setSuccess('Collection updated.');
      } else {
        await createCollection(token, payload);
        setSuccess('Collection created.');
      }
      setView('list'); setIsCreating(false);
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  const handleSubmitCollection = async () => {
    if (!selectedCollection) return;
    setLoading(true); clearMessages();
    try {
      await submitCollection(selectedCollection.CollectionId, token);
      setSuccess('Collection submitted for review.');
      setView('list');
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  const handleDeleteCollection = async (id: string) => {
    if (!confirm('Delete this draft collection?')) return;
    setLoading(true); clearMessages();
    try {
      await deleteCollection(id, token);
      setSuccess('Collection deleted.');
      loadCollections();
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  // ── Assessment actions ────────────────────────
  const filteredAssessments = useMemo(() => {
    if (!searchQuery.trim()) return assessments;
    const q = searchQuery.toLowerCase();
    return assessments.filter(a => a.Status.toLowerCase().includes(q) || String(a.FiscalYear).includes(q));
  }, [assessments, searchQuery]);

  const handleSelectAssessment = async (id: string) => {
    setLoading(true); clearMessages();
    try {
      const data = await fetchAssessmentDetail(id, token);
      setSelectedAssessment(data);
      setView('assessment-detail');
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  const handleCreateAssessment = async () => {
    setLoading(true); clearMessages();
    try {
      await createAssessmentFromAnalysis(token, analysisYear);
      setSuccess('Assessment created from analysis.');
      setActiveTab('assessments');
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  const handleAssessmentDecision = async (decision: 'Endorsed' | 'Rejected') => {
    if (!selectedAssessment) return;
    setLoading(true); clearMessages();
    try {
      await submitAssessmentDecision(selectedAssessment.AssessmentId, token, decision);
      setSuccess(`Assessment ${decision.toLowerCase()}.`);
      setView('list');
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  // ── Item form helpers ─────────────────────────
  const addItem = () => setFormItems([...formItems, { Description: '', Quantity: 1, Unit: 'Unit', Priority: 'Normal', ProcurementType: 'Goods' }]);
  const removeItem = (i: number) => setFormItems(formItems.filter((_, idx) => idx !== i));
  const updateItem = (i: number, field: keyof NeedsCollectionItem, value: any) => {
    const next = [...formItems]; (next[i] as any)[field] = value; setFormItems(next);
  };

  const canEdit = () => isCreating || selectedCollection?.Status === 'Draft' || selectedCollection?.Status === 'Returned';
  const canSubmit = () => selectedCollection && (selectedCollection.Status === 'Draft' || selectedCollection.Status === 'Returned');

  const statusBadge = (s: string) => {
    const map: Record<string, string> = {
      Draft: 'bg-slate-100 text-slate-700', Submitted: 'bg-blue-100 text-blue-700',
      Endorsed: 'bg-emerald-100 text-emerald-700 font-bold', Rejected: 'bg-red-100 text-red-700',
      Returned: 'bg-amber-100 text-amber-700',
    };
    return `app-badge ${map[s] || ''}`;
  };

  // ── Detail views ─────────────────────────────
  if (view === 'collection-detail') {
    return (
      <section className="app-module">
        <header className="app-module__header">
          <div className="app-module__title-group">
            <button className="app-btn app-btn--secondary app-btn--sm mb-4" onClick={() => { setView('list'); setIsCreating(false); setSelectedCollection(null); clearMessages(); }}>
              <ArrowLeft size={16} className="mr-2" /> Back
            </button>
            <h2 className="app-module__title">{isCreating ? 'New Collection' : `Collection: ${selectedCollection?.Title}`}</h2>
          </div>
        </header>
        {error && <div className="app-alert app-alert--error mb-4">{error}</div>}
        {success && <div className="app-alert app-alert--success mb-4">{success}</div>}
        <div className="dh-layout" style={{ minHeight: 'calc(100vh - 220px)' }}>
          <div className="dh-queue-panel" style={{ flex: 1.5 }}>
            <div className="app-card">
              <div className="app-form-grid p-6">
                <div className="app-form-group col-span-2">
                  <label className="app-form-label">Title</label>
                  <input className="app-form__input" value={formTitle} onChange={e => setFormTitle(e.target.value)} placeholder="e.g. FY 2026 ICT Equipment Needs" disabled={!canEdit()} />
                </div>
                <div className="app-form-group">
                  <label className="app-form-label">Fiscal Year</label>
                  <select className="app-form__select" value={formFiscalYear} onChange={e => setFormFiscalYear(Number(e.target.value))} disabled={!canEdit()}>
                    {[0, 1, 2].map(o => { const y = new Date().getFullYear() + o; return <option key={y} value={y}>{y}</option>; })}
                  </select>
                </div>
                <div className="app-form-group col-span-3">
                  <label className="app-form-label">Remarks</label>
                  <textarea className="app-form__input" rows={2} value={formRemarks} onChange={e => setFormRemarks(e.target.value)} placeholder="Additional context..." disabled={!canEdit()} />
                </div>
              </div>
              <div className="p-6 border-t border-slate-100">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-slate-800 flex items-center gap-2"><Package size={18} className="text-emerald-600" /> Items</h3>
                  {canEdit() && <button className="app-btn app-btn--secondary app-btn--sm" onClick={addItem}><Plus size={14} className="mr-1" /> Add Item</button>}
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
                      {formItems.map((item, idx) => (
                        <tr key={idx}>
                          <td><input className="app-form__input app-form__input--sm" value={item.Description} onChange={e => updateItem(idx, 'Description', e.target.value)} disabled={!canEdit()} /></td>
                          <td>
                            <select className="app-form__select app-form__select--sm" value={item.ProcurementType} onChange={e => updateItem(idx, 'ProcurementType', e.target.value)} disabled={!canEdit()}>
                              <option value="Goods">Goods</option><option value="Works">Works</option><option value="Services">Services</option>
                            </select>
                          </td>
                          <td><input type="number" className="app-form__input app-form__input--sm" value={item.Quantity} onChange={e => updateItem(idx, 'Quantity', Number(e.target.value))} disabled={!canEdit()} /></td>
                          <td><input className="app-form__input app-form__input--sm" value={item.Unit} onChange={e => updateItem(idx, 'Unit', e.target.value)} disabled={!canEdit()} placeholder="Pcs" /></td>
                          <td>
                            <select className="app-form__select app-form__select--sm" value={item.Priority} onChange={e => updateItem(idx, 'Priority', e.target.value)} disabled={!canEdit()}>
                              <option value="Normal">Normal</option><option value="Urgent">Urgent</option><option value="Strategic">Strategic</option>
                            </select>
                          </td>
                          {canEdit() && <td><button className="text-red-400 hover:text-red-600" onClick={() => removeItem(idx)}><Trash2 size={14} /></button></td>}
                        </tr>
                      ))}
                      {!formItems.length && <tr><td colSpan={canEdit() ? 6 : 5} className="py-8 text-center text-slate-400 italic">No items yet.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
          <div className="dh-detail-panel" style={{ maxWidth: '320px', flex: '0 0 320px', display: 'flex', flexDirection: 'column', height: '100%' }}>
            {selectedCollection && (
              <div className="app-card" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <div className="app-card__header"><h3 className="app-card__title">Status</h3></div>
                <div className="app-info-list" style={{ flex: 1, overflowY: 'auto' }}>
                  <div className="app-info-item"><span className="app-info-item__label">Status</span><span className={statusBadge(selectedCollection.Status)}>{selectedCollection.Status}</span></div>
                  <div className="app-info-item"><span className="app-info-item__label">Unit</span><span className="app-info-item__value">{selectedCollection.UnitName}</span></div>
                  <div className="app-info-item"><span className="app-info-item__label">Fiscal Year</span><span className="app-info-item__value">{selectedCollection.FiscalYear}</span></div>
                  <div className="app-info-item"><span className="app-info-item__label">Items</span><span className="app-info-item__value">{formItems.length}</span></div>
                  {selectedCollection.SubmittedAt && <div className="app-info-item"><span className="app-info-item__label">Submitted</span><span className="app-info-item__value">{formatDateTimeShort(selectedCollection.SubmittedAt)}</span></div>}
                </div>
                <div className="app-card__footer" style={{ flexDirection: 'column', gap: '0.75rem' }}>
                  {canSubmit() && <button className="app-btn app-btn--success app-btn--lg" onClick={handleSubmitCollection} disabled={loading}>{loading ? <Loader2 className="animate-spin" /> : <Send className="app-btn__icon" />} Submit</button>}
                  {canEdit() && <button className="app-btn app-btn--secondary" onClick={handleSaveCollection} disabled={loading}><Save className="app-btn__icon" /> Save</button>}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    );
  }

  if (view === 'assessment-detail' && selectedAssessment) {
    return (
      <section className="app-module">
        <header className="app-module__header">
          <div className="app-module__title-group">
            <button className="app-btn app-btn--secondary app-btn--sm mb-4" onClick={() => { setView('list'); setSelectedAssessment(null); clearMessages(); }}>
              <ArrowLeft size={16} className="mr-2" /> Back
            </button>
            <h2 className="app-module__title">Assessment: FY {selectedAssessment.FiscalYear}</h2>
          </div>
        </header>
        {error && <div className="app-alert app-alert--error mb-4">{error}</div>}
        {success && <div className="app-alert app-alert--success mb-4">{success}</div>}
        <div className="app-card mb-4">
          <div className="app-info-list p-6">
            <div className="app-info-item"><span className="app-info-item__label">Status</span><span className={statusBadge(selectedAssessment.Status)}>{selectedAssessment.Status}</span></div>
            <div className="app-info-item"><span className="app-info-item__label">Fiscal Year</span><span className="app-info-item__value">{selectedAssessment.FiscalYear}</span></div>
            {selectedAssessment.AssessedBy && <div className="app-info-item"><span className="app-info-item__label">Assessed By</span><span className="app-info-item__value">{selectedAssessment.AssessedBy}</span></div>}
            {selectedAssessment.AssessedAt && <div className="app-info-item"><span className="app-info-item__label">Assessed At</span><span className="app-info-item__value">{formatDateTimeShort(selectedAssessment.AssessedAt)}</span></div>}
          </div>
          {selectedAssessment.Status === 'Draft' && hasPermission('needs.endorse') && (
            <div className="app-card__footer" style={{ flexDirection: 'row', gap: '0.75rem' }}>
              <button className="app-btn app-btn--success" onClick={() => handleAssessmentDecision('Endorsed')} disabled={loading}><CheckCircle className="app-btn__icon" /> Endorse</button>
              <button className="app-btn app-btn--danger" onClick={() => handleAssessmentDecision('Rejected')} disabled={loading}><XCircle className="app-btn__icon" /> Reject</button>
            </div>
          )}
        </div>
        <div className="app-card">
          <div className="app-card__header"><h3 className="app-card__title">Consolidated Items ({selectedAssessment.Items.length})</h3></div>
          <div className="app-table-wrapper">
            <table className="app-table">
              <thead>
                <tr><th>Description</th><th>Type</th><th>Unit</th><th className="app-table__cell--numeric">Total Qty</th><th>Priority</th><th>Source Units</th></tr>
              </thead>
              <tbody>
                {selectedAssessment.Items.map((item: NeedsAssessmentItem) => (
                  <tr key={item.ItemId}>
                    <td className="font-medium text-slate-800">{item.Description}</td>
                    <td><span className="app-badge">{item.ProcurementType}</span></td>
                    <td className="text-slate-600 text-xs">{item.Unit}</td>
                    <td className="app-table__cell--numeric font-semibold text-emerald-700">{item.Quantity}</td>
                    <td><span className={`text-[10px] px-1.5 rounded-full ${item.Priority?.includes('Urgent') ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'}`}>{item.Priority}</span></td>
                    <td className="text-xs text-slate-500">{item.SourceUnits?.map((s: { unitId: string; unitName: string }) => s.unitName).join(', ') || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    );
  }

  // ── List view ────────────────────────────────
  const statusCounts = useMemo(() => ({
    total: collections.length,
    draft: collections.filter(c => c.Status === 'Draft').length,
    submitted: collections.filter(c => c.Status === 'Submitted').length,
  }), [collections]);

  return (
    <section className="app-module">
      <header className="app-module__header">
        <div className="app-module__title-group">
          <h2 className="app-module__title">{module.title}</h2>
          <p className="app-module__description">{module.description}</p>
        </div>
        {activeTab === 'collections' && (
          <div className="app-module__actions">
            <button className="app-btn app-btn--primary" onClick={handleCreateCollection}><Plus size={18} className="mr-2" /> New Collection</button>
          </div>
        )}
        {activeTab === 'assessments' && hasPermission('needs.consolidate') && (
          <div className="app-module__actions">
            <button className="app-btn app-btn--primary" onClick={handleCreateAssessment} disabled={loading}><ClipboardList size={18} className="mr-2" /> Create Assessment from Analysis</button>
          </div>
        )}
      </header>

      {error && <div className="app-alert app-alert--error mb-4">{error}</div>}
      {success && <div className="app-alert app-alert--success mb-4">{success}</div>}

      {activeTab === 'collections' && (
        <div className="app-stats-row">
          <div className="app-stat-card"><div className="app-stat-card__value">{statusCounts.total}</div><div className="app-stat-card__label">Total Collections</div></div>
          <div className="app-stat-card"><div className="app-stat-card__value">{statusCounts.draft}</div><div className="app-stat-card__label">Draft</div></div>
          <div className="app-stat-card app-stat-card--info"><div className="app-stat-card__value">{statusCounts.submitted}</div><div className="app-stat-card__label">Submitted</div></div>
        </div>
      )}

      {/* Tabs */}
      <div className="app-tabs" style={{ marginTop: '1.5rem' }}>
        <button className={`app-tab ${activeTab === 'collections' ? 'app-tab--active' : ''}`} onClick={() => { setActiveTab('collections'); setView('list'); setSearchQuery(''); }}>
          <FileText className="app-tab__icon" /> Collections
        </button>
        <button className={`app-tab ${activeTab === 'analysis' ? 'app-tab--active' : ''}`} onClick={() => { setActiveTab('analysis'); setView('list'); setSearchQuery(''); }}>
          <BarChart3 className="app-tab__icon" /> Analysis
        </button>
        <button className={`app-tab ${activeTab === 'assessments' ? 'app-tab--active' : ''}`} onClick={() => { setActiveTab('assessments'); setView('list'); setSearchQuery(''); }}>
          <ClipboardList className="app-tab__icon" /> Assessments
        </button>
      </div>

      {/* Search & filters */}
      <div className="app-search-bar" style={{ marginTop: '1rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
        <div className="app-search" style={{ flex: 1 }}>
          <Search className="app-search__icon" />
          <input className="app-search__input" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            placeholder={activeTab === 'analysis' ? 'Search items...' : 'Search...'} />
        </div>
        {activeTab === 'analysis' && (
          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded px-2 py-1">
            <Filter size={14} className="text-slate-400" />
            <select className="text-xs font-medium text-slate-600 bg-transparent border-none outline-none" value={analysisYear} onChange={e => setAnalysisYear(Number(e.target.value))}>
              {[0, 1, 2].map(o => { const y = new Date().getFullYear() + o; return <option key={y} value={y}>{y}</option>; })}
            </select>
          </div>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div className="app-empty-state"><Loader2 className="animate-spin" /><p>Loading...</p></div>
      ) : activeTab === 'collections' ? (
        <div className="app-card" style={{ marginTop: '1rem' }}>
          <div className="app-table-wrapper">
            <table className="app-table">
              <thead><tr><th>Title</th><th>Unit</th><th>Year</th><th>Items</th><th>Status</th><th>Created</th><th>Actions</th></tr></thead>
              <tbody>
                {filteredCollections.map(c => (
                  <tr key={c.CollectionId}>
                    <td><div className="app-table__title">{c.Title}</div></td>
                    <td><div className="app-table__meta"><Building2 className="app-table__meta-icon" />{c.UnitName}</div></td>
                    <td>{c.FiscalYear}</td>
                    <td>{c.ItemCount}</td>
                    <td><span className={statusBadge(c.Status)}>{c.Status}</span></td>
                    <td><div className="app-table__meta">{formatDateTimeShort(c.CreatedAt)}</div></td>
                    <td>
                      <div className="flex gap-1">
                        <button className="app-btn app-btn--secondary app-btn--sm" onClick={() => handleSelectCollection(c.CollectionId)}>View</button>
                        {c.Status === 'Draft' && <button className="app-btn app-btn--danger app-btn--sm" onClick={() => handleDeleteCollection(c.CollectionId)}><Trash2 size={12} /></button>}
                      </div>
                    </td>
                  </tr>
                ))}
                {!filteredCollections.length && <tr><td colSpan={7} className="py-8 text-center text-slate-400">No collections found.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      ) : activeTab === 'analysis' ? (
        <>
          <div className="app-stats-row" style={{ marginTop: '1rem', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
            <div className="app-stat-card"><div className="app-stat-card__value">{analysis.length}</div><div className="app-stat-card__label">Unique Items</div></div>
            <div className="app-stat-card app-stat-card--info"><div className="app-stat-card__value">{analysisYear}</div><div className="app-stat-card__label">Fiscal Year</div></div>
            <div className="app-stat-card"><div className="app-stat-card__value">{analysis.reduce((s, r) => s + r.occurrence_count, 0)}</div><div className="app-stat-card__label">Total Sources</div></div>
          </div>
          <div className="app-card" style={{ marginTop: '1rem' }}>
            <div className="app-table-wrapper">
              <table className="app-table">
                <thead><tr><th>Description</th><th>Type</th><th>Unit</th><th className="app-table__cell--numeric">Total Qty</th><th>Priority</th><th>Sources</th></tr></thead>
                <tbody>
                  {analysis.filter(r => !searchQuery.trim() || r.item_description.toLowerCase().includes(searchQuery.toLowerCase())).map((r, idx) => (
                    <tr key={idx}>
                      <td className="font-medium text-slate-800">{r.item_description}</td>
                      <td><span className="app-badge">{r.procurement_type}</span></td>
                      <td className="text-slate-600 text-xs">{r.unit}</td>
                      <td className="app-table__cell--numeric font-semibold text-emerald-700">{r.total_quantity}</td>
                      <td>
                        <div className="flex flex-wrap gap-1">
                          {r.priority_summary.split(', ').map((p: string) => (
                            <span key={p} className={`text-[10px] px-1.5 rounded-full ${p === 'Urgent' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'}`}>{p}</span>
                          ))}
                        </div>
                      </td>
                      <td className="text-xs text-slate-500"><Building2 size={12} className="inline mr-1" />{r.occurrence_count} unit(s)</td>
                    </tr>
                  ))}
                  {!analysis.length && <tr><td colSpan={6} className="py-12 text-center text-slate-400">No analysis data for {analysisYear}.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <div className="app-card" style={{ marginTop: '1rem' }}>
          <div className="app-table-wrapper">
            <table className="app-table">
              <thead><tr><th>Fiscal Year</th><th>Items</th><th>Status</th><th>Assessed By</th><th>Assessed At</th><th>Actions</th></tr></thead>
              <tbody>
                {filteredAssessments.map(a => (
                  <tr key={a.AssessmentId}>
                    <td>{a.FiscalYear}</td>
                    <td>{a.ItemCount}</td>
                    <td><span className={statusBadge(a.Status)}>{a.Status}</span></td>
                    <td>{a.AssessedBy || '—'}</td>
                    <td>{a.AssessedAt ? formatDateTimeShort(a.AssessedAt) : '—'}</td>
                    <td><button className="app-btn app-btn--secondary app-btn--sm" onClick={() => handleSelectAssessment(a.AssessmentId)}>View</button></td>
                  </tr>
                ))}
                {!filteredAssessments.length && <tr><td colSpan={6} className="py-8 text-center text-slate-400">No assessments found.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
};
