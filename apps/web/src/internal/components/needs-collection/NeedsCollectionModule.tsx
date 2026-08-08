'use client';

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import type { InternalModule, RoleKey } from '../../types/internal';
import { usePermission } from '../../hooks/usePermission';
import {
  fetchCollections,
  fetchCollectionDetail,
  createCollection,
  updateCollection,
  submitCollection,
  deleteCollection,
  fetchNeedsAnalysis,
  fetchCategoryBreakdown,
  fetchUnitStats,
  fetchWeightedAnalysis,
  fetchSimilarNeeds,
  fetchPlanGap,
  fetchThresholdFlags,
  fetchNonSubmissions,
  fetchAssessments,
  fetchAssessmentDetail,
  createAssessmentFromAnalysis,
  createManualAssessment,
  addAssessmentItem,
  updateAssessmentItem,
  deleteAssessmentItem,
  carryForwardNeeds,
  submitAssessmentDecision,
  convertAssessmentToPlan,
  type NeedsCollectionSummary,
  type NeedsCollectionDetail,
  type NeedsCollectionItem,
  type NeedsAnalysisResult,
  type NeedsCategoryBreakdown,
  type NeedsUnitStats,
  type NeedsWeightedResult,
  type NeedsSimilarGroup,
  type NeedsPlanGap,
  type NeedsThresholdFlag,
  type NeedsNonSubmission,
  type NeedsAssessmentSummary,
  type NeedsAssessmentDetail,
  type NeedsAssessmentItem,
} from '../../services/needsCollectionService';
import { formatDateTimeShort } from '../../utils/procureUtils';
import {
  FileText, Plus, ArrowLeft, Save, Send, CheckCircle, XCircle,
  Search, Building2, Package, Trash2, Loader2, BarChart3, Filter,
  ClipboardList, RotateCcw, PieChart, Users, TrendingUp, Copy,
  GitCompare, AlertTriangle, UserX
} from 'lucide-react';

interface NeedsCollectionModuleProps {
  module: InternalModule;
  token: string;
  role?: RoleKey | null;
}

type Tab = 'collections' | 'analysis' | 'assessments';
type View = 'list' | 'collection-detail' | 'assessment-detail';
type AnalysisView = 'overview' | 'category' | 'units' | 'weighted' | 'similar' | 'plan-gap' | 'thresholds' | 'non-submissions';

export const NeedsCollectionModule: React.FC<NeedsCollectionModuleProps> = ({ module, token, role }) => {
  const { hasPermission } = usePermission(token);
  const searchParams = useSearchParams();
  const router = typeof window !== 'undefined' ? window.history : null;

  const urlTab = (searchParams.get('tab') as Tab) || 'collections';
  const urlAnalysisView = (searchParams.get('view') as AnalysisView) || 'overview';

  const [activeTab, setActiveTabState] = useState<Tab>(urlTab);
  const [view, setView] = useState<View>('list');
  const [analysisView, setAnalysisViewState] = useState<AnalysisView>(urlAnalysisView);

  const [collections, setCollections] = useState<NeedsCollectionSummary[]>([]);
  const [analysis, setAnalysis] = useState<NeedsAnalysisResult[]>([]);
  const [categoryData, setCategoryData] = useState<NeedsCategoryBreakdown[]>([]);
  const [unitData, setUnitData] = useState<NeedsUnitStats[]>([]);
  const [weightedData, setWeightedData] = useState<NeedsWeightedResult[]>([]);
  const [similarData, setSimilarData] = useState<NeedsSimilarGroup[]>([]);
  const [planGapData, setPlanGapData] = useState<NeedsPlanGap[]>([]);
  const [thresholdData, setThresholdData] = useState<NeedsThresholdFlag[]>([]);
  const [nonSubData, setNonSubData] = useState<NeedsNonSubmission[]>([]);
  const [assessments, setAssessments] = useState<NeedsAssessmentSummary[]>([]);
  const [selectedCollection, setSelectedCollection] = useState<NeedsCollectionDetail | null>(null);
  const [selectedAssessment, setSelectedAssessment] = useState<NeedsAssessmentDetail | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [analysisYear, setAnalysisYear] = useState(new Date().getFullYear());
  const [isCreating, setIsCreating] = useState(false);
  const [thresholdUnitPrice, setThresholdUnitPrice] = useState<number>(0);

  const [formTitle, setFormTitle] = useState('');
  const [formFiscalYear, setFormFiscalYear] = useState(new Date().getFullYear());
  const [formRemarks, setFormRemarks] = useState('');
  const [formItems, setFormItems] = useState<NeedsCollectionItem[]>([]);

  // Create assessment dialog
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createMode, setCreateMode] = useState<'analysis' | 'manual' | 'carry-forward'>('analysis');
  const [createYear, setCreateYear] = useState(new Date().getFullYear());
  const [carryForwardYear, setCarryForwardYear] = useState(new Date().getFullYear() - 1);

  // Item editor
  const [editingItem, setEditingItem] = useState<NeedsAssessmentItem | null>(null);
  const [itemForm, setItemForm] = useState({ Description: '', Quantity: 1, Unit: 'Unit', Priority: 'Normal', ProcurementType: 'Goods' });
  const [showItemForm, setShowItemForm] = useState(false);

  const statusCounts = useMemo(() => ({
    total: collections.length,
    draft: collections.filter(c => c.Status === 'Draft').length,
    submitted: collections.filter(c => c.Status === 'Submitted').length,
    endorsed: collections.filter(c => c.Status === 'Endorsed').length,
  }), [collections]);

  const clearMessages = useCallback(() => { setError(null); setSuccess(null); }, []);

  const setActiveTab = useCallback((tab: Tab) => {
    setActiveTabState(tab);
    setView('list');
    const params = new URLSearchParams(window.location.search);
    params.set('tab', tab);
    if (tab === 'analysis') {
      params.set('view', analysisView);
    } else {
      params.delete('view');
    }
    window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}`);
  }, [analysisView]);

  const setAnalysisView = useCallback((v: AnalysisView) => {
    setAnalysisViewState(v);
    setSearchQuery('');
    const params = new URLSearchParams(window.location.search);
    params.set('tab', 'analysis');
    params.set('view', v);
    window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}`);
  }, []);

  // ── Loaders ──────────────────────────────────
  const loadCollections = useCallback(async () => {
    setLoading(true); clearMessages();
    try {
      const data = await fetchCollections(token);
      setCollections(data.Items);
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

  const loadCategory = useCallback(async () => {
    setLoading(true); clearMessages();
    try {
      const data = await fetchCategoryBreakdown(token, analysisYear);
      setCategoryData(data);
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  }, [token, analysisYear, clearMessages]);

  const loadUnitStats = useCallback(async () => {
    setLoading(true); clearMessages();
    try {
      const data = await fetchUnitStats(token, analysisYear);
      setUnitData(data);
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  }, [token, analysisYear, clearMessages]);

  const loadWeighted = useCallback(async () => {
    setLoading(true); clearMessages();
    try {
      const data = await fetchWeightedAnalysis(token, analysisYear);
      setWeightedData(data);
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  }, [token, analysisYear, clearMessages]);

  const loadSimilar = useCallback(async () => {
    setLoading(true); clearMessages();
    try {
      const data = await fetchSimilarNeeds(token, analysisYear);
      setSimilarData(data);
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  }, [token, analysisYear, clearMessages]);

  const loadPlanGap = useCallback(async () => {
    setLoading(true); clearMessages();
    try {
      const data = await fetchPlanGap(token, analysisYear);
      setPlanGapData(data);
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  }, [token, analysisYear, clearMessages]);

  const loadThresholds = useCallback(async () => {
    setLoading(true); clearMessages();
    try {
      const data = await fetchThresholdFlags(token, analysisYear, thresholdUnitPrice);
      setThresholdData(data);
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  }, [token, analysisYear, thresholdUnitPrice, clearMessages]);

  const loadNonSubmissions = useCallback(async () => {
    setLoading(true); clearMessages();
    try {
      const data = await fetchNonSubmissions(token, analysisYear);
      setNonSubData(data);
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
    if (activeTab === 'assessments' && view === 'list') loadAssessments();
  }, [activeTab, view, loadCollections, loadAssessments]);

  useEffect(() => {
    if (activeTab === 'analysis' && view === 'list') {
      if (analysisView === 'overview') loadAnalysis();
      else if (analysisView === 'category') loadCategory();
      else if (analysisView === 'units') loadUnitStats();
      else if (analysisView === 'weighted') loadWeighted();
      else if (analysisView === 'similar') loadSimilar();
      else if (analysisView === 'plan-gap') loadPlanGap();
      else if (analysisView === 'thresholds') loadThresholds();
      else if (analysisView === 'non-submissions') loadNonSubmissions();
    }
  }, [activeTab, view, analysisView, loadAnalysis, loadCategory, loadUnitStats, loadWeighted, loadSimilar, loadPlanGap, loadThresholds, loadNonSubmissions]);

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

  // ── Assessment creation handlers ─────────────
  const handleOpenCreateDialog = () => {
    setCreateMode('analysis');
    setCreateYear(analysisYear);
    setCarryForwardYear(new Date().getFullYear() - 1);
    setShowCreateDialog(true);
  };

  const handleConfirmCreate = async () => {
    setLoading(true); clearMessages();
    try {
      if (createMode === 'analysis') {
        await createAssessmentFromAnalysis(token, createYear);
        setSuccess(`Assessment created from FY ${createYear} analysis.`);
      } else if (createMode === 'manual') {
        await createManualAssessment(token, createYear, []);
        setSuccess(`Blank assessment created for FY ${createYear}.`);
      } else {
        // Carry forward: create blank for target year, then carry forward source year items
        const newAssessment = await createManualAssessment(token, createYear, []);
        await carryForwardNeeds(newAssessment.AssessmentId, token, carryForwardYear);
        setSuccess(`Assessment created for FY ${createYear} with needs carried forward from FY ${carryForwardYear}.`);
      }
      setShowCreateDialog(false);
      setActiveTab('assessments');
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  // ── Item editor handlers ─────────────────────
  const handleAddItem = async () => {
    if (!selectedAssessment) return;
    setLoading(true); clearMessages();
    try {
      await addAssessmentItem(selectedAssessment.AssessmentId, token, itemForm);
      setSuccess('Item added.');
      setShowItemForm(false);
      setItemForm({ Description: '', Quantity: 1, Unit: 'Unit', Priority: 'Normal', ProcurementType: 'Goods' });
      // Reload assessment detail
      const data = await fetchAssessmentDetail(selectedAssessment.AssessmentId, token);
      setSelectedAssessment(data);
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  const handleUpdateItem = async () => {
    if (!selectedAssessment || !editingItem) return;
    setLoading(true); clearMessages();
    try {
      await updateAssessmentItem(selectedAssessment.AssessmentId, editingItem.ItemId, token, itemForm);
      setSuccess('Item updated.');
      setShowItemForm(false);
      setEditingItem(null);
      setItemForm({ Description: '', Quantity: 1, Unit: 'Unit', Priority: 'Normal', ProcurementType: 'Goods' });
      const data = await fetchAssessmentDetail(selectedAssessment.AssessmentId, token);
      setSelectedAssessment(data);
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!selectedAssessment || !confirm('Delete this item?')) return;
    setLoading(true); clearMessages();
    try {
      await deleteAssessmentItem(selectedAssessment.AssessmentId, itemId, token);
      setSuccess('Item deleted.');
      const data = await fetchAssessmentDetail(selectedAssessment.AssessmentId, token);
      setSelectedAssessment(data);
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  const handleEditItem = (item: NeedsAssessmentItem) => {
    setEditingItem(item);
    setItemForm({ Description: item.Description, Quantity: item.Quantity, Unit: item.Unit, Priority: item.Priority, ProcurementType: item.ProcurementType });
    setShowItemForm(true);
  };

  const handleCarryForward = async () => {
    if (!selectedAssessment) return;
    setLoading(true); clearMessages();
    try {
      const result = await carryForwardNeeds(selectedAssessment.AssessmentId, token, carryForwardYear);
      setSuccess(result.Message);
      const data = await fetchAssessmentDetail(selectedAssessment.AssessmentId, token);
      setSelectedAssessment(data);
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  const handleAssessmentDecision = async (decision: 'Endorsed' | 'Rejected' | 'Returned') => {
    if (!selectedAssessment) return;
    setLoading(true); clearMessages();
    try {
      await submitAssessmentDecision(selectedAssessment.AssessmentId, token, decision);
      setSuccess(`Assessment ${decision.toLowerCase()}.`);
      setView('list');
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  const handleConvertToPlan = async () => {
    if (!selectedAssessment) return;
    setLoading(true); clearMessages();
    try {
      const result = await convertAssessmentToPlan(selectedAssessment.AssessmentId, token);
      setSuccess(`Assessment converted to procurement plan. Plan ID: ${result.PlanId}`);
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

  const canEdit = () => hasPermission('needs.create') && (isCreating || selectedCollection?.Status === 'Draft' || selectedCollection?.Status === 'Returned');
  const canSubmit = () => hasPermission('needs.submit') && selectedCollection && (selectedCollection.Status === 'Draft' || selectedCollection.Status === 'Returned');
  const canDelete = () => hasPermission('needs.delete');
  const canCarryForward = () => hasPermission('needs.carry_forward');
  const canViewItem = () => hasPermission('needs.view') || hasPermission('needs.view.all');

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
                          {canEdit() && <td><button className="text-red-400 hover:text-red-600" onClick={() => removeItem(idx)} aria-label="Remove item"><Trash2 size={14} /></button></td>}
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
    const rawItems = selectedAssessment.Items ?? [];
    const assessmentItems = rawItems.map(item => ({
      ...item,
      SourceUnits: Array.isArray(item.SourceUnits) ? item.SourceUnits
        : typeof item.SourceUnits === 'string' ? (() => { try { return JSON.parse(item.SourceUnits); } catch { return []; } })()
        : []
    }));
    const isDraft = selectedAssessment.Status === 'Draft';
    return (
      <section className="app-module">
        <header className="app-module__header">
          <div className="app-module__title-group">
            <button className="app-btn app-btn--secondary app-btn--sm mb-4" onClick={() => { setView('list'); setSelectedAssessment(null); setShowItemForm(false); setEditingItem(null); clearMessages(); }}>
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
          {isDraft && hasPermission('needs.endorse') && (
            <div className="app-card__footer" style={{ flexDirection: 'row', gap: '0.75rem' }}>
              <button className="app-btn app-btn--success" onClick={() => handleAssessmentDecision('Endorsed')} disabled={loading}><CheckCircle className="app-btn__icon" /> Endorse Assessment</button>
              <button className="app-btn app-btn--danger" onClick={() => handleAssessmentDecision('Rejected')} disabled={loading}><XCircle className="app-btn__icon" /> Reject</button>
              <button className="app-btn app-btn--secondary" onClick={() => handleAssessmentDecision('Returned')} disabled={loading}><RotateCcw className="app-btn__icon" /> Return</button>
            </div>
          )}
          {selectedAssessment.Status === 'Endorsed' && hasPermission('needs.consolidate') && (
            <div className="app-card__footer" style={{ flexDirection: 'row', gap: '0.75rem' }}>
              <button className="app-btn app-btn--primary" onClick={handleConvertToPlan} disabled={loading}>
                <ClipboardList className="app-btn__icon" /> Convert to Procurement Plan
              </button>
            </div>
          )}
        </div>

        {/* Carry Forward Section */}
        {isDraft && canCarryForward() && (
          <div className="app-card mb-4">
            <div className="app-card__header"><h3 className="app-card__title">Carry Forward Needs</h3></div>
            <div className="p-4 flex items-center gap-3">
              <span className="text-sm text-slate-600">Import submitted needs from:</span>
              <select className="app-form__select app-form__select--sm" value={carryForwardYear} onChange={e => setCarryForwardYear(Number(e.target.value))}>
                {[...Array(5)].map((_, i) => { const y = new Date().getFullYear() - 1 - i; return <option key={y} value={y}>{y}</option>; })}
              </select>
              <button className="app-btn app-btn--secondary app-btn--sm" onClick={handleCarryForward} disabled={loading}>
                <RotateCcw size={14} className="mr-1" /> Carry Forward
              </button>
            </div>
          </div>
        )}

        {/* Items Section */}
        <div className="app-card">
          <div className="app-card__header">
            <h3 className="app-card__title">Items ({assessmentItems.length})</h3>
            {isDraft && (
              <div className="flex gap-2">
                <button className="app-btn app-btn--primary app-btn--sm" onClick={() => { setEditingItem(null); setItemForm({ Description: '', Quantity: 1, Unit: 'Unit', Priority: 'Normal', ProcurementType: 'Goods' }); setShowItemForm(true); }}>
                  <Plus size={14} className="mr-1" /> Add Item
                </button>
              </div>
            )}
          </div>

          {/* Item Form */}
          {showItemForm && (
            <div className="p-4 bg-slate-50 border-b border-slate-200">
              <h4 className="font-medium text-sm text-slate-700 mb-3">{editingItem ? 'Edit Item' : 'Add New Item'}</h4>
              <div className="grid grid-cols-5 gap-3">
                <input className="app-form__input app-form__input--sm col-span-2" placeholder="Description" value={itemForm.Description} onChange={e => setItemForm({ ...itemForm, Description: e.target.value })} />
                <input type="number" className="app-form__input app-form__input--sm" placeholder="Qty" value={itemForm.Quantity} onChange={e => setItemForm({ ...itemForm, Quantity: Number(e.target.value) })} />
                <input className="app-form__input app-form__input--sm" placeholder="Unit" value={itemForm.Unit} onChange={e => setItemForm({ ...itemForm, Unit: e.target.value })} />
                <select className="app-form__select app-form__select--sm" value={itemForm.Priority} onChange={e => setItemForm({ ...itemForm, Priority: e.target.value })}>
                  <option value="Normal">Normal</option><option value="Urgent">Urgent</option><option value="Strategic">Strategic</option>
                </select>
                <select className="app-form__select app-form__select--sm" value={itemForm.ProcurementType} onChange={e => setItemForm({ ...itemForm, ProcurementType: e.target.value })}>
                  <option value="Goods">Goods</option><option value="Works">Works</option><option value="Services">Services</option>
                </select>
              </div>
              <div className="flex gap-2 mt-3">
                <button className="app-btn app-btn--primary app-btn--sm" onClick={editingItem ? handleUpdateItem : handleAddItem} disabled={loading || !itemForm.Description.trim()}>
                  {loading ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />} {editingItem ? 'Update' : 'Add'}
                </button>
                <button className="app-btn app-btn--secondary app-btn--sm" onClick={() => { setShowItemForm(false); setEditingItem(null); }}>Cancel</button>
              </div>
            </div>
          )}

          <div className="app-table-wrapper">
            <table className="app-table">
              <thead>
                <tr><th>Description</th><th>Type</th><th>Unit</th><th className="app-table__cell--numeric">Qty</th><th>Priority</th><th>Source Units</th>{isDraft && <th style={{ width: '80px' }}>Actions</th>}</tr>
              </thead>
              <tbody>
                {assessmentItems.map((item: NeedsAssessmentItem) => (
                  <tr key={item.ItemId}>
                    <td className="font-medium text-slate-800">{item.Description}</td>
                    <td><span className="app-badge">{item.ProcurementType}</span></td>
                    <td className="text-slate-600 text-xs">{item.Unit}</td>
                    <td className="app-table__cell--numeric font-semibold text-emerald-700">{item.Quantity}</td>
                    <td><span className={`text-[10px] px-1.5 rounded-full ${item.Priority?.includes('Urgent') ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'}`}>{item.Priority}</span></td>
                    <td className="text-xs text-slate-500">{item.SourceUnits?.map((s: { unitId: string; unitName: string }) => s.unitName).join(', ') || '—'}</td>
                    {isDraft && (
                      <td>
                        <div className="flex gap-1">
                          <button className="text-blue-500 hover:text-blue-700" onClick={() => handleEditItem(item)} aria-label="Edit item"><FileText size={14} /></button>
                          <button className="text-red-400 hover:text-red-600" onClick={() => handleDeleteItem(item.ItemId)} aria-label="Delete item"><Trash2 size={14} /></button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
                {!assessmentItems.length && <tr><td colSpan={isDraft ? 7 : 6} className="py-8 text-center text-slate-400 italic">No items yet. Add items manually or carry forward from a previous year.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    );
  }

  // ── List view ────────────────────────────────
  const analysisSubTabs: { key: AnalysisView; label: string; icon: React.ReactNode }[] = [
    { key: 'overview', label: 'Overview', icon: <BarChart3 size={14} /> },
    { key: 'category', label: 'Category', icon: <PieChart size={14} /> },
    { key: 'units', label: 'By Unit', icon: <Users size={14} /> },
    { key: 'weighted', label: 'Weighted', icon: <TrendingUp size={14} /> },
    { key: 'similar', label: 'Duplicates', icon: <Copy size={14} /> },
    { key: 'plan-gap', label: 'Plan Gap', icon: <GitCompare size={14} /> },
    { key: 'thresholds', label: 'Thresholds', icon: <AlertTriangle size={14} /> },
    { key: 'non-submissions', label: 'Non-Submit', icon: <UserX size={14} /> },
  ];

  return (
    <section className="app-module">
      <header className="app-module__header">
        <div className="app-module__title-group">
          <h2 className="app-module__title">{module.title}</h2>
          <p className="app-module__description">{module.description}</p>
        </div>
        {activeTab === 'collections' && (
          <div className="app-module__actions">
            <button className="app-btn app-btn--primary" onClick={handleCreateCollection} disabled={!canEdit()}><Plus size={18} className="mr-2" /> New Collection</button>
          </div>
        )}
        {activeTab === 'assessments' && hasPermission('needs.consolidate') && (
          <div className="app-module__actions">
            <button className="app-btn app-btn--primary" onClick={handleOpenCreateDialog} disabled={loading}><ClipboardList size={18} className="mr-2" /> Create Assessment</button>
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
          <div className="app-stat-card app-stat-card--success"><div className="app-stat-card__value">{statusCounts.endorsed}</div><div className="app-stat-card__label">Endorsed</div></div>
        </div>
      )}

      {/* Main Tabs */}
      <div className="app-tabs" style={{ marginTop: '1.5rem' }}>
        <button className={`app-tab ${activeTab === 'collections' ? 'app-tab--active' : ''}`} onClick={() => { setActiveTab('collections'); setSearchQuery(''); }}>
          <FileText className="app-tab__icon" /> Collections
        </button>
        <button className={`app-tab ${activeTab === 'analysis' ? 'app-tab--active' : ''}`} onClick={() => { setActiveTab('analysis'); setAnalysisView('overview'); setSearchQuery(''); }}>
          <BarChart3 className="app-tab__icon" /> Analysis
        </button>
        <button className={`app-tab ${activeTab === 'assessments' ? 'app-tab--active' : ''}`} onClick={() => { setActiveTab('assessments'); setSearchQuery(''); }}>
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

      {/* Analysis sub-tabs */}
      {activeTab === 'analysis' && (
        <div className="flex gap-1 mt-3 flex-wrap">
          {analysisSubTabs.map(st => (
            <button key={st.key}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${analysisView === st.key ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              onClick={() => setAnalysisView(st.key)}>
              {st.icon} {st.label}
            </button>
          ))}
        </div>
      )}

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
                        {c.Status === 'Draft' && canDelete() && <button className="app-btn app-btn--danger app-btn--sm" onClick={() => handleDeleteCollection(c.CollectionId)} aria-label="Delete collection"><Trash2 size={12} /></button>}
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
        <AnalysisContent
          view={analysisView}
          analysis={analysis}
          categoryData={categoryData}
          unitData={unitData}
          weightedData={weightedData}
          similarData={similarData}
          planGapData={planGapData}
          thresholdData={thresholdData}
          nonSubData={nonSubData}
          analysisYear={analysisYear}
          searchQuery={searchQuery}
          thresholdUnitPrice={thresholdUnitPrice}
          onSetThresholdPrice={setThresholdUnitPrice}
          onReloadThresholds={loadThresholds}
        />
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

      {/* Create Assessment Dialog */}
      {showCreateDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowCreateDialog(false)}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <h3 className="text-lg font-bold text-slate-800 mb-4">Create Assessment</h3>
              <div className="space-y-4">
                <div>
                  <label className="app-form-label">Creation Method</label>
                  <div className="flex gap-2">
                    <button className={`flex-1 px-3 py-2 rounded text-sm font-medium border ${createMode === 'analysis' ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`} onClick={() => setCreateMode('analysis')}>From Analysis</button>
                    <button className={`flex-1 px-3 py-2 rounded text-sm font-medium border ${createMode === 'manual' ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`} onClick={() => setCreateMode('manual')}>Blank (Manual)</button>
                    <button className={`flex-1 px-3 py-2 rounded text-sm font-medium border ${createMode === 'carry-forward' ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`} onClick={() => setCreateMode('carry-forward')}>Carry Forward</button>
                  </div>
                </div>
                <div>
                  <label className="app-form-label">Target Fiscal Year</label>
                  <select className="app-form__select" value={createYear} onChange={e => setCreateYear(Number(e.target.value))}>
                    {[...Array(6)].map((_, i) => { const y = new Date().getFullYear() + i; return <option key={y} value={y}>{y}</option>; })}
                  </select>
                </div>
                {createMode === 'carry-forward' && (
                  <div>
                    <label className="app-form-label">Carry Forward From Year</label>
                    <select className="app-form__select" value={carryForwardYear} onChange={e => setCarryForwardYear(Number(e.target.value))}>
                      {[...Array(5)].map((_, i) => { const y = new Date().getFullYear() - 1 - i; return <option key={y} value={y}>{y}</option>; })}
                    </select>
                  </div>
                )}
                <div className="bg-slate-50 rounded p-3 text-sm text-slate-600">
                  {createMode === 'analysis' && <p>Consolidates all submitted needs for FY {createYear} into a single assessment.</p>}
                  {createMode === 'manual' && <p>Creates an empty assessment for FY {createYear}. You can add items manually afterwards.</p>}
                  {createMode === 'carry-forward' && <p>Creates an assessment for FY {createYear} and imports submitted needs from FY {carryForwardYear}.</p>}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 p-4 border-t border-slate-200">
              <button className="app-btn app-btn--secondary" onClick={() => setShowCreateDialog(false)}>Cancel</button>
              <button className="app-btn app-btn--primary" onClick={handleConfirmCreate} disabled={loading}>
                {loading ? <Loader2 className="animate-spin mr-2" size={16} /> : <ClipboardList size={16} className="mr-2" />}
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

// ── Analysis Content Sub-Component ─────────────
interface AnalysisContentProps {
  view: AnalysisView;
  analysis: NeedsAnalysisResult[];
  categoryData: NeedsCategoryBreakdown[];
  unitData: NeedsUnitStats[];
  weightedData: NeedsWeightedResult[];
  similarData: NeedsSimilarGroup[];
  planGapData: NeedsPlanGap[];
  thresholdData: NeedsThresholdFlag[];
  nonSubData: NeedsNonSubmission[];
  analysisYear: number;
  searchQuery: string;
  thresholdUnitPrice: number;
  onSetThresholdPrice: (v: number) => void;
  onReloadThresholds: () => void;
}

const AnalysisContent: React.FC<AnalysisContentProps> = ({
  view, analysis, categoryData, unitData, weightedData, similarData,
  planGapData, thresholdData, nonSubData, analysisYear, searchQuery,
  thresholdUnitPrice, onSetThresholdPrice, onReloadThresholds,
}) => {
  const fmt = (n: number) => n.toLocaleString('en-NG');
  const fmtCurrency = (n: number) => n.toLocaleString('en-NG', { style: 'currency', currency: 'NGN' });

  if (view === 'overview') {
    return (
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
                    <td className="app-table__cell--numeric font-semibold text-emerald-700">{fmt(r.total_quantity)}</td>
                    <td><div className="flex flex-wrap gap-1">{r.priority_summary.split(', ').map((p: string) => (<span key={p} className={`text-[10px] px-1.5 rounded-full ${p === 'Urgent' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'}`}>{p}</span>))}</div></td>
                    <td className="text-xs text-slate-500"><Building2 size={12} className="inline mr-1" />{r.occurrence_count} unit(s)</td>
                  </tr>
                ))}
                {!analysis.length && <tr><td colSpan={6} className="py-12 text-center text-slate-400">No analysis data for {analysisYear}.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </>
    );
  }

  if (view === 'category') {
    return (
      <>
        <div className="app-stats-row" style={{ marginTop: '1rem', display: 'grid', gridTemplateColumns: `repeat(${Math.min(categoryData.length, 4)}, 1fr)`, gap: '1rem' }}>
          {categoryData.map(c => (
            <div key={c.procurement_type} className="app-stat-card">
              <div className="app-stat-card__value">{fmt(c.total_quantity)}</div>
              <div className="app-stat-card__label">{c.procurement_type}</div>
            </div>
          ))}
        </div>
        <div className="app-card" style={{ marginTop: '1rem' }}>
          <div className="app-card__header"><h3 className="app-card__title">Category Breakdown — FY {analysisYear}</h3></div>
          <div className="app-table-wrapper">
            <table className="app-table">
              <thead><tr><th>Procurement Type</th><th className="app-table__cell--numeric">Items</th><th className="app-table__cell--numeric">Total Qty</th><th className="app-table__cell--numeric">Collections</th><th className="app-table__cell--numeric">Units</th></tr></thead>
              <tbody>
                {categoryData.map(c => (
                  <tr key={c.procurement_type}>
                    <td className="font-medium"><span className="app-badge">{c.procurement_type}</span></td>
                    <td className="app-table__cell--numeric">{c.item_count}</td>
                    <td className="app-table__cell--numeric font-semibold text-emerald-700">{fmt(c.total_quantity)}</td>
                    <td className="app-table__cell--numeric">{c.total_collections}</td>
                    <td className="app-table__cell--numeric">{c.unique_units}</td>
                  </tr>
                ))}
                {!categoryData.length && <tr><td colSpan={5} className="py-8 text-center text-slate-400">No data.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </>
    );
  }

  if (view === 'units') {
    return (
      <div className="app-card" style={{ marginTop: '1rem' }}>
        <div className="app-card__header"><h3 className="app-card__title">Unit Submission Status — FY {analysisYear}</h3></div>
        <div className="app-table-wrapper">
          <table className="app-table">
            <thead><tr><th>Unit</th><th className="app-table__cell--numeric">Items</th><th className="app-table__cell--numeric">Total Qty</th><th>Status</th><th>Submitted</th></tr></thead>
            <tbody>
              {unitData.filter(u => !searchQuery.trim() || u.unit_name.toLowerCase().includes(searchQuery.toLowerCase())).map(u => (
                <tr key={u.unit_id}>
                  <td className="font-medium text-slate-800">{u.unit_name}</td>
                  <td className="app-table__cell--numeric">{u.item_count}</td>
                  <td className="app-table__cell--numeric font-semibold text-emerald-700">{fmt(u.total_quantity)}</td>
                  <td>
                    <span className={`app-badge ${u.collection_status === 'Submitted' ? 'bg-blue-100 text-blue-700' : u.collection_status === 'Draft' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
                      {u.collection_status || 'Not Started'}
                    </span>
                  </td>
                  <td className="text-xs text-slate-500">{u.submitted_at ? formatDateTimeShort(u.submitted_at) : '—'}</td>
                </tr>
              ))}
              {!unitData.length && <tr><td colSpan={5} className="py-8 text-center text-slate-400">No unit data.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (view === 'weighted') {
    return (
      <>
        <div className="app-stats-row" style={{ marginTop: '1rem', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
          <div className="app-stat-card"><div className="app-stat-card__value">{weightedData.length}</div><div className="app-stat-card__label">Unique Items</div></div>
          <div className="app-stat-card app-stat-card--info"><div className="app-stat-card__value">{weightedData[0]?.weighted_score ? fmt(weightedData[0].weighted_score) : '0'}</div><div className="app-stat-card__label">Top Score</div></div>
          <div className="app-stat-card"><div className="app-stat-card__value">{weightedData.reduce((s, r) => s + r.occurrence_count, 0)}</div><div className="app-stat-card__label">Total Sources</div></div>
        </div>
        <div className="app-card" style={{ marginTop: '1rem' }}>
          <div className="app-card__header"><h3 className="app-card__title">Priority-Weighted Ranking (Urgent=3x, Strategic=2.5x, Normal=2x, Low=1x)</h3></div>
          <div className="app-table-wrapper">
            <table className="app-table">
              <thead><tr><th>#</th><th>Description</th><th>Type</th><th className="app-table__cell--numeric">Qty</th><th className="app-table__cell--numeric">Weighted Score</th><th>Priority</th><th>Sources</th></tr></thead>
              <tbody>
                {weightedData.filter(r => !searchQuery.trim() || r.item_description.toLowerCase().includes(searchQuery.toLowerCase())).map((r, idx) => (
                  <tr key={idx}>
                    <td className="text-slate-400 text-xs">{idx + 1}</td>
                    <td className="font-medium text-slate-800">{r.item_description}</td>
                    <td><span className="app-badge">{r.procurement_type}</span></td>
                    <td className="app-table__cell--numeric">{fmt(r.total_quantity)}</td>
                    <td className="app-table__cell--numeric font-bold text-emerald-700">{fmt(r.weighted_score)}</td>
                    <td><div className="flex flex-wrap gap-1">{r.priority_summary.split(', ').map((p: string) => (<span key={p} className={`text-[10px] px-1.5 rounded-full ${p === 'Urgent' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'}`}>{p}</span>))}</div></td>
                    <td className="text-xs text-slate-500">{r.occurrence_count} unit(s)</td>
                  </tr>
                ))}
                {!weightedData.length && <tr><td colSpan={7} className="py-8 text-center text-slate-400">No weighted data.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </>
    );
  }

  if (view === 'similar') {
    return (
      <div className="app-card" style={{ marginTop: '1rem' }}>
        <div className="app-card__header"><h3 className="app-card__title">Potential Duplicate Items — FY {analysisYear}</h3></div>
        <div className="app-table-wrapper">
          <table className="app-table">
            <thead><tr><th>Group</th><th>Descriptions</th><th>Type</th><th className="app-table__cell--numeric">Combined Qty</th><th className="app-table__cell--numeric">Sources</th><th>Suggestion</th></tr></thead>
            <tbody>
              {similarData.filter(g => !searchQuery.trim() || g.descriptions.some(d => d.toLowerCase().includes(searchQuery.toLowerCase()))).map(g => (
                <tr key={g.group_id}>
                  <td className="text-slate-400 text-xs">{g.group_id}</td>
                  <td className="text-xs">{g.descriptions.map((d, i) => <div key={i} className="font-medium text-slate-800">{d}</div>)}</td>
                  <td><span className="app-badge">{g.procurement_type}</span></td>
                  <td className="app-table__cell--numeric font-semibold text-emerald-700">{fmt(g.combined_quantity)}</td>
                  <td className="app-table__cell--numeric">{g.occurrence_count}</td>
                  <td className="text-xs text-amber-700">{g.suggestion}</td>
                </tr>
              ))}
              {!similarData.length && <tr><td colSpan={6} className="py-8 text-center text-slate-400">No similar items detected.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (view === 'plan-gap') {
    const inPlan = planGapData.filter(p => p.in_plan);
    const notInPlan = planGapData.filter(p => !p.in_plan);
    return (
      <>
        <div className="app-stats-row" style={{ marginTop: '1rem', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
          <div className="app-stat-card"><div className="app-stat-card__value">{planGapData.length}</div><div className="app-stat-card__label">Total Items</div></div>
          <div className="app-stat-card"><div className="app-stat-card__value text-emerald-700">{inPlan.length}</div><div className="app-stat-card__label">In Plan</div></div>
          <div className="app-stat-card app-stat-card--info"><div className="app-stat-card__value text-amber-700">{notInPlan.length}</div><div className="app-stat-card__label">Not In Plan</div></div>
        </div>
        <div className="app-card" style={{ marginTop: '1rem' }}>
          <div className="app-card__header"><h3 className="app-card__title">Procurement Plan Gap Analysis — FY {analysisYear}</h3></div>
          <div className="app-table-wrapper">
            <table className="app-table">
              <thead><tr><th>Item</th><th>Type</th><th className="app-table__cell--numeric">Qty</th><th>In Plan?</th><th>Plan Description</th><th className="app-table__cell--numeric">Est. Amount</th></tr></thead>
              <tbody>
                {planGapData.filter(r => !searchQuery.trim() || r.item_description.toLowerCase().includes(searchQuery.toLowerCase())).map((r, idx) => (
                  <tr key={idx}>
                    <td className="font-medium text-slate-800">{r.item_description}</td>
                    <td><span className="app-badge">{r.procurement_type}</span></td>
                    <td className="app-table__cell--numeric">{fmt(r.total_quantity)}</td>
                    <td>{r.in_plan ? <span className="app-badge bg-emerald-100 text-emerald-700">Yes</span> : <span className="app-badge bg-amber-100 text-amber-700">No</span>}</td>
                    <td className="text-xs text-slate-600">{r.plan_description || '—'}</td>
                    <td className="app-table__cell--numeric text-xs">{r.plan_estimated_amount ? fmtCurrency(r.plan_estimated_amount) : '—'}</td>
                  </tr>
                ))}
                {!planGapData.length && <tr><td colSpan={6} className="py-8 text-center text-slate-400">No plan gap data.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </>
    );
  }

  if (view === 'thresholds') {
    return (
      <>
        <div className="app-card" style={{ marginTop: '1rem' }}>
          <div className="app-card__header">
            <h3 className="app-card__title">Threshold Analysis — FY {analysisYear}</h3>
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-500">Est. Unit Price (₦):</label>
              <input type="number" className="app-form__input app-form__input--sm" style={{ width: 120 }} value={thresholdUnitPrice || ''} onChange={e => onSetThresholdPrice(Number(e.target.value))} placeholder="0" />
              <button className="app-btn app-btn--secondary app-btn--sm" onClick={onReloadThresholds}>Refresh</button>
            </div>
          </div>
          <div className="app-table-wrapper">
            <table className="app-table">
              <thead><tr><th>Item</th><th>Type</th><th className="app-table__cell--numeric">Qty</th><th className="app-table__cell--numeric">Est. Value</th><th>Route</th><th>Board</th><th>BPP</th></tr></thead>
              <tbody>
                {thresholdData.filter(r => !searchQuery.trim() || r.item_description.toLowerCase().includes(searchQuery.toLowerCase())).map((r, idx) => (
                  <tr key={idx}>
                    <td className="font-medium text-slate-800">{r.item_description}</td>
                    <td><span className="app-badge">{r.procurement_type}</span></td>
                    <td className="app-table__cell--numeric">{fmt(r.total_quantity)}</td>
                    <td className="app-table__cell--numeric font-semibold text-emerald-700">{fmtCurrency(r.estimated_total_value)}</td>
                    <td className="text-xs text-slate-600">{r.threshold_route || '—'}</td>
                    <td>{r.requires_board ? <CheckCircle size={14} className="text-amber-600" /> : '—'}</td>
                    <td>{r.requires_bpp ? <CheckCircle size={14} className="text-blue-600" /> : '—'}</td>
                  </tr>
                ))}
                {!thresholdData.length && <tr><td colSpan={7} className="py-8 text-center text-slate-400">No threshold data. Enter an estimated unit price to calculate.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </>
    );
  }

  if (view === 'non-submissions') {
    const submitted = nonSubData.filter(n => n.has_submission);
    const drafts = nonSubData.filter(n => n.has_draft && !n.has_submission);
    const notStarted = nonSubData.filter(n => !n.has_draft && !n.has_submission);
    return (
      <>
        <div className="app-stats-row" style={{ marginTop: '1rem', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
          <div className="app-stat-card"><div className="app-stat-card__value">{submitted.length}</div><div className="app-stat-card__label">Submitted</div></div>
          <div className="app-stat-card app-stat-card--info"><div className="app-stat-card__value">{drafts.length}</div><div className="app-stat-card__label">Draft Only</div></div>
          <div className="app-stat-card"><div className="app-stat-card__value text-red-600">{notStarted.length}</div><div className="app-stat-card__label">Not Started</div></div>
        </div>
        <div className="app-card" style={{ marginTop: '1rem' }}>
          <div className="app-card__header"><h3 className="app-card__title">Non-Submission Tracker — FY {analysisYear}</h3></div>
          <div className="app-table-wrapper">
            <table className="app-table">
              <thead><tr><th>Unit</th><th>Code</th><th>Status</th><th>Last Updated</th></tr></thead>
              <tbody>
                {nonSubData.filter(n => !searchQuery.trim() || n.unit_name.toLowerCase().includes(searchQuery.toLowerCase())).map(n => (
                  <tr key={n.unit_id}>
                    <td className="font-medium text-slate-800">{n.unit_name}</td>
                    <td className="text-xs text-slate-500">{n.unit_code}</td>
                    <td>
                      <span className={`app-badge ${n.submission_status === 'Submitted' ? 'bg-emerald-100 text-emerald-700' : n.submission_status === 'Draft' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                        {n.submission_status}
                      </span>
                    </td>
                    <td className="text-xs text-slate-500">{n.last_updated ? formatDateTimeShort(n.last_updated) : '—'}</td>
                  </tr>
                ))}
                {!nonSubData.length && <tr><td colSpan={4} className="py-8 text-center text-slate-400">No units found.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </>
    );
  }

  return null;
};
