'use client';

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import type { InternalModule, RoleKey } from '../types/internal';
import {
  fetchCollections,
  fetchCollectionDetail,
  createCollection,
  updateCollection,
  submitCollection,
  deleteCollection,
  type NeedsCollectionSummary,
  type NeedsCollectionDetail,
  type NeedsCollectionItem,
} from '../services/needsCollectionService';
import { send } from '../services/moduleService.shared';
import { serviceBaseUrls } from '../services/moduleService';
import { formatDateTimeShort } from '../utils/procureUtils';
import {
  Plus, ArrowLeft, Save, Send, Trash2,
  Search, Package, Loader2
} from 'lucide-react';

interface NeedsSubmissionModuleProps {
  module: InternalModule;
  token: string;
  role?: RoleKey | null;
}

type View = 'list' | 'detail';

export const NeedsSubmissionModule: React.FC<NeedsSubmissionModuleProps> = ({ module, token }) => {
  const searchParams = useSearchParams();
  const [view, setViewState] = useState<View>(
    (searchParams.get('view') as View) || 'list'
  );
  const setView = (v: View) => {
    setViewState(v);
    const params = new URLSearchParams(window.location.search);
    params.set('view', v);
    window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}`);
  };
  const [collections, setCollections] = useState<NeedsCollectionSummary[]>([]);
  const [selected, setSelected] = useState<NeedsCollectionDetail | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [unitId, setUnitId] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const [formTitle, setFormTitle] = useState('');
  const [formFiscalYear, setFormFiscalYear] = useState(new Date().getFullYear());
  const [formRemarks, setFormRemarks] = useState('');
  const [formItems, setFormItems] = useState<NeedsCollectionItem[]>([]);

  const clearMessages = useCallback(() => { setError(null); setSuccess(null); }, []);

  const loadCollections = useCallback(async () => {
    setLoading(true); clearMessages();
    try {
      const data = await fetchCollections(token);
      setCollections(data.Items);
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  }, [token, clearMessages]);

  useEffect(() => { if (view === 'list') loadCollections(); }, [view, loadCollections]);
  useEffect(() => { if (success) { const t = setTimeout(() => setSuccess(null), 3000); return () => clearTimeout(t); } }, [success]);

  useEffect(() => {
    if (!token) return;
    send<{ UnitId?: string }>(serviceBaseUrls.identity, '/api/Auth/internal/profile', token, { method: 'GET' })
      .then((profile) => { if (profile.UnitId) setUnitId(profile.UnitId); })
      .catch(() => {});
  }, [token]);

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return collections;
    const q = searchQuery.toLowerCase();
    return collections.filter(c => c.Title.toLowerCase().includes(q) || c.Status.toLowerCase().includes(q));
  }, [collections, searchQuery]);

  const statusCounts = useMemo(() => ({
    total: collections.length,
    draft: collections.filter(c => c.Status === 'Draft').length,
    submitted: collections.filter(c => c.Status === 'Submitted').length,
    endorsed: collections.filter(c => c.Status === 'Endorsed').length,
  }), [collections]);

  const handleSelect = async (id: string) => {
    setLoading(true); clearMessages();
    try {
      const data = await fetchCollectionDetail(id, token);
      setSelected(data);
      setFormTitle(data.Title);
      setFormFiscalYear(data.FiscalYear);
      setFormRemarks(data.Remarks || '');
      setFormItems(data.Items);
      setView('detail');
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  const handleCreate = () => {
    setIsCreating(true); setSelected(null);
    setFormTitle(''); setFormFiscalYear(new Date().getFullYear()); setFormRemarks(''); setFormItems([]);
    setView('detail');
  };

  const handleSave = async () => {
    if (!formTitle.trim()) { setError('Title is required.'); return; }
    setLoading(true); clearMessages();
    try {
      const payload = { Title: formTitle, FiscalYear: formFiscalYear, Remarks: formRemarks, Items: [...formItems], UnitId: unitId || undefined };
      if (selected) {
        await updateCollection(selected.CollectionId, token, payload);
        setSuccess('Collection updated.');
      } else {
        await createCollection(token, payload);
        setSuccess('Collection created.');
        setIsCreating(false);
      }
      setView('list');
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  const handleSubmit = async () => {
    if (!selected) return;
    if (!formItems.length) { setError('Add at least one item before submitting.'); return; }
    setLoading(true); clearMessages();
    try {
      await submitCollection(selected.CollectionId, token);
      setSuccess('Needs submitted for review.');
      setView('list');
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this draft submission?')) return;
    setLoading(true); clearMessages();
    try {
      await deleteCollection(id, token);
      setSuccess('Deleted.');
      loadCollections();
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  const addItem = () => setFormItems([...formItems, { Description: '', Quantity: 1, Unit: 'Unit', Priority: 'Normal', ProcurementType: 'Goods' }]);
  const removeItem = (i: number) => setFormItems(formItems.filter((_, idx) => idx !== i));
  const updateItem = (i: number, field: keyof NeedsCollectionItem, value: any) => {
    const next = [...formItems]; (next[i] as any)[field] = value; setFormItems(next);
  };

  const canEdit = isCreating || selected?.Status === 'Draft' || selected?.Status === 'Returned';
  const canSubmit = selected && (selected.Status === 'Draft' || selected.Status === 'Returned') && formItems.length > 0;

  const statusBadge = (s: string) => {
    const map: Record<string, string> = {
      Draft: 'bg-slate-100 text-slate-700', Submitted: 'bg-blue-100 text-blue-700',
      Endorsed: 'bg-emerald-100 text-emerald-700 font-bold', Rejected: 'bg-red-100 text-red-700',
      Returned: 'bg-amber-100 text-amber-700',
    };
    return `app-badge ${map[s] || ''}`;
  };

  // ── Detail View ─────────────────────────────
  if (view === 'detail') {
    return (
      <section className="app-module">
        <header className="app-module__header">
          <div className="app-module__title-group">
            <button className="app-btn app-btn--secondary app-btn--sm mb-4" onClick={() => { setView('list'); setIsCreating(false); setSelected(null); clearMessages(); }}>
              <ArrowLeft size={16} className="mr-2" /> Back
            </button>
            <h2 className="app-module__title">{isCreating ? 'New Needs Submission' : `Submission: ${selected?.Title}`}</h2>
          </div>
        </header>
        {error && <div className="app-alert app-alert--error mb-4">{error}</div>}
        {success && <div className="app-alert app-alert--success mb-4">{success}</div>}
        <div className="dh-layout dh-layout--sidebar-narrow">
          <div className="dh-queue-panel">
            <div className="app-card">
              <div className="app-form-grid p-6">
                <div className="app-form-group col-span-2">
                  <label className="app-form-label">Title *</label>
                  <input className="app-form__input" value={formTitle} onChange={e => setFormTitle(e.target.value)} placeholder="e.g. FY 2026 Office Supplies Need" disabled={!canEdit} />
                </div>
                <div className="app-form-group">
                  <label className="app-form-label">Fiscal Year</label>
                  <select className="app-form__select" value={formFiscalYear} onChange={e => setFormFiscalYear(Number(e.target.value))} disabled={!canEdit}>
                    {[0, 1, 2].map(o => { const y = new Date().getFullYear() + o; return <option key={y} value={y}>{y}</option>; })}
                  </select>
                </div>
                <div className="app-form-group col-span-3">
                  <label className="app-form-label">Remarks</label>
                  <textarea className="app-form__input" rows={2} value={formRemarks} onChange={e => setFormRemarks(e.target.value)} placeholder="Additional context..." disabled={!canEdit} />
                </div>
              </div>
            </div>
            {/* Items Card */}
            <div className="app-card" style={{ marginTop: '1rem' }}>
              <div className="app-card__header">
                <h3 className="app-card__title flex items-center gap-2"><Package size={18} className="text-emerald-600" /> Items ({formItems.length})</h3>
                {canEdit && <button className="app-btn app-btn--primary app-btn--sm" onClick={addItem}><Plus size={14} className="mr-1" /> Add Item</button>}
              </div>
              <div className="app-table-wrapper">
                <table className="app-table">
                  <thead>
                    <tr>
                      <th style={{ width: '36px' }}>#</th>
                      <th>Description</th>
                      <th style={{ width: '130px' }}>Type</th>
                      <th style={{ width: '90px' }}>Qty</th>
                      <th style={{ width: '90px' }}>Unit</th>
                      <th style={{ width: '130px' }}>Priority</th>
                      {canEdit && <th style={{ width: '40px' }}></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {formItems.map((item, idx) => (
                      <tr key={idx}>
                        <td className="text-xs text-slate-400 font-mono text-center">{idx + 1}</td>
                        <td><input className="app-form__input app-form__input--sm" value={item.Description} onChange={e => updateItem(idx, 'Description', e.target.value)} disabled={!canEdit} placeholder="Item description" /></td>
                        <td>
                          <select className="app-form__select app-form__select--sm" value={item.ProcurementType} onChange={e => updateItem(idx, 'ProcurementType', e.target.value)} disabled={!canEdit}>
                            <option value="Goods">Goods</option><option value="Works">Works</option><option value="Services">Services</option>
                          </select>
                        </td>
                        <td><input type="number" className="app-form__input app-form__input--sm" value={item.Quantity} onChange={e => updateItem(idx, 'Quantity', Number(e.target.value))} disabled={!canEdit} min={1} style={{ textAlign: 'center', fontWeight: 600 }} /></td>
                        <td><input className="app-form__input app-form__input--sm" value={item.Unit} onChange={e => updateItem(idx, 'Unit', e.target.value)} disabled={!canEdit} placeholder="Pcs" style={{ textAlign: 'center' }} /></td>
                        <td>
                          <select className="app-form__select app-form__select--sm" value={item.Priority} onChange={e => updateItem(idx, 'Priority', e.target.value)} disabled={!canEdit}>
                            <option value="Normal">Normal</option><option value="Urgent">Urgent</option><option value="Strategic">Strategic</option>
                          </select>
                        </td>
                        {canEdit && <td><button className="text-red-400 hover:text-red-600" onClick={() => removeItem(idx)} aria-label="Remove"><Trash2 size={14} /></button></td>}
                      </tr>
                    ))}
                    {!formItems.length && (
                      <tr>
                        <td colSpan={canEdit ? 7 : 6} className="py-10 text-center">
                          <Package size={32} className="mx-auto text-slate-300 mb-2" />
                          <p className="text-slate-400 italic">No items yet.</p>
                          {canEdit && <p className="text-xs text-slate-400 mt-1">Click "Add Item" to start adding procurement needs.</p>}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          <div className="dh-detail-panel">
            <div className="app-card app-card--sticky" style={{ padding: '16px' }}>
              <h3 className="text-sm font-bold text-slate-700 mb-3">{isCreating ? 'New Submission' : 'Status'}</h3>
              <div className="space-y-2 text-xs mb-4">
                {selected ? (
                  <>
                    <div className="flex justify-between items-center"><span className="text-slate-500">Status</span><span className={statusBadge(selected.Status)}>{selected.Status}</span></div>
                    <div className="flex justify-between items-center"><span className="text-slate-500">Unit</span><span className="font-medium text-slate-700">{selected.UnitName}</span></div>
                    <div className="flex justify-between items-center"><span className="text-slate-500">Year</span><span className="font-medium text-slate-700">{selected.FiscalYear}</span></div>
                    <div className="flex justify-between items-center"><span className="text-slate-500">Items</span><span className="font-semibold text-emerald-700">{formItems.length}</span></div>
                    {selected.SubmittedAt && <div className="flex justify-between items-center"><span className="text-slate-500">Submitted</span><span className="text-slate-600">{formatDateTimeShort(selected.SubmittedAt)}</span></div>}
                  </>
                ) : (
                  <>
                    <div className="flex justify-between items-center"><span className="text-slate-500">Status</span><span className={statusBadge('Draft')}>Draft</span></div>
                    <div className="flex justify-between items-center"><span className="text-slate-500">Year</span><span className="font-medium text-slate-700">{formFiscalYear}</span></div>
                    <div className="flex justify-between items-center"><span className="text-slate-500">Items</span><span className="font-semibold text-emerald-700">{formItems.length}</span></div>
                  </>
                )}
              </div>
              <div className="space-y-2">
                {canSubmit && <button className="app-btn app-btn--success app-btn--sm w-full" onClick={handleSubmit} disabled={loading}>{loading ? <Loader2 className="animate-spin" size={14} /> : <Send size={14} />} Submit</button>}
                {canEdit && <button className="app-btn app-btn--secondary app-btn--sm w-full" onClick={handleSave} disabled={loading}><Save size={14} /> {isCreating ? 'Create Draft' : 'Save Draft'}</button>}
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  // ── List View ───────────────────────────────
  return (
    <section className="app-module">
      <header className="app-module__header">
        <div className="app-module__title-group">
          <h2 className="app-module__title">{module.title}</h2>
          <p className="app-module__description">Submit procurement needs for your unit. Submitted needs are reviewed and consolidated by procurement staff.</p>
        </div>
        <div className="app-module__actions">
          <button className="app-btn app-btn--primary" onClick={handleCreate}><Plus size={18} className="mr-2" /> New Submission</button>
        </div>
      </header>

      {error && <div className="app-alert app-alert--error mb-4">{error}</div>}
      {success && <div className="app-alert app-alert--success mb-4">{success}</div>}

      <div className="app-stats-row">
        <div className="app-stat-card"><div className="app-stat-card__value">{statusCounts.total}</div><div className="app-stat-card__label">Total</div></div>
        <div className="app-stat-card"><div className="app-stat-card__value">{statusCounts.draft}</div><div className="app-stat-card__label">Draft</div></div>
        <div className="app-stat-card app-stat-card--info"><div className="app-stat-card__value">{statusCounts.submitted}</div><div className="app-stat-card__label">Submitted</div></div>
        <div className="app-stat-card app-stat-card--success"><div className="app-stat-card__value">{statusCounts.endorsed}</div><div className="app-stat-card__label">Endorsed</div></div>
      </div>

      <div className="app-search-bar" style={{ marginTop: '1rem' }}>
        <div className="app-search" style={{ flex: 1 }}>
          <Search className="app-search__icon" />
          <input className="app-search__input" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search submissions..." />
        </div>
      </div>

      {loading ? (
        <div className="app-empty-state"><Loader2 className="animate-spin" /><p>Loading...</p></div>
      ) : (
        <div className="app-card" style={{ marginTop: '1rem' }}>
          <div className="app-table-wrapper">
            <table className="app-table">
              <thead><tr><th>Title</th><th>Year</th><th>Items</th><th>Status</th><th>Created</th><th>Actions</th></tr></thead>
              <tbody>
                {filtered.map(c => (
                  <tr key={c.CollectionId}>
                    <td><div className="app-table__title">{c.Title}</div></td>
                    <td>{c.FiscalYear}</td>
                    <td>{c.ItemCount}</td>
                    <td><span className={statusBadge(c.Status)}>{c.Status}</span></td>
                    <td><div className="app-table__meta">{formatDateTimeShort(c.CreatedAt)}</div></td>
                    <td>
                      <div className="flex gap-1">
                        <button className="app-btn app-btn--secondary app-btn--sm" onClick={() => handleSelect(c.CollectionId)}>View</button>
                        {c.Status === 'Draft' && <button className="app-btn app-btn--danger app-btn--sm" onClick={() => handleDelete(c.CollectionId)} aria-label="Delete"><Trash2 size={12} /></button>}
                      </div>
                    </td>
                  </tr>
                ))}
                {!filtered.length && <tr><td colSpan={6} className="py-8 text-center text-slate-400">No submissions yet. Click "New Submission" to get started.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
};
