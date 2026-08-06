'use client';

import React, { useEffect, useMemo, useState } from 'react';
import type {
  InternalModule,
  WorkflowConfigurationGovernanceBody,
  WorkflowConfigurationThreshold
} from '../../types/internal';
import {
  createWorkflowThreshold,
  deleteWorkflowThreshold,
  fetchWorkflowConfiguration,
  updateWorkflowThreshold
} from '../../services/workflowConfigurationService';

interface Props {
  module: InternalModule;
  token: string | null;
}

type ThresholdFilter = 'All' | 'Goods' | 'Works' | 'Services';

type ThresholdFormState = {
  procurementType: string;
  minAmount: string;
  maxAmount: string;
  approvalRoute: string;
  approvalAuthorityCode: string;
  approvalAuthorityLabel: string;
  governanceBodyId: string;
  requiresCgisApproval: boolean;
  requiresBoard: boolean;
  requiresBpp: boolean;
  status: string;
  notes: string;
};

const filters: ThresholdFilter[] = ['All', 'Goods', 'Works', 'Services'];

const emptyForm: ThresholdFormState = {
  procurementType: 'Goods',
  minAmount: '0',
  maxAmount: '',
  approvalRoute: '',
  approvalAuthorityCode: '',
  approvalAuthorityLabel: '',
  governanceBodyId: '',
  requiresCgisApproval: true,
  requiresBoard: false,
  requiresBpp: false,
  status: 'Active',
  notes: ''
};

const formatCurrency = (value: number | null | undefined) =>
  value == null
    ? 'and above'
    : new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(value);

const toFormState = (threshold: WorkflowConfigurationThreshold): ThresholdFormState => ({
  procurementType: threshold.ProcurementType || 'Goods',
  minAmount: String(threshold.MinAmount),
  maxAmount: threshold.MaxAmount == null ? '' : String(threshold.MaxAmount),
  approvalRoute: threshold.ApprovalRoute,
  approvalAuthorityCode: threshold.ApprovalAuthorityCode,
  approvalAuthorityLabel: threshold.ApprovalAuthorityLabel,
  governanceBodyId: threshold.GovernanceBodyId || '',
  requiresCgisApproval: threshold.RequiresCgisApproval,
  requiresBoard: threshold.RequiresBoard,
  requiresBpp: threshold.RequiresBpp,
  status: threshold.Status,
  notes: threshold.Notes || ''
});

export const ThresholdConfigurationModule: React.FC<Props> = ({ module, token }) => {
  const [thresholds, setThresholds] = useState<WorkflowConfigurationThreshold[]>([]);
  const [governanceBodies, setGovernanceBodies] = useState<WorkflowConfigurationGovernanceBody[]>([]);
  const [selectedThresholdId, setSelectedThresholdId] = useState('');
  const [filter, setFilter] = useState<ThresholdFilter>('All');
  const [form, setForm] = useState<ThresholdFormState>(emptyForm);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadThresholds = async () => {
    if (!token) {
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const config = await fetchWorkflowConfiguration(token);
      setThresholds(config.Thresholds || []);
      setGovernanceBodies(config.GovernanceBodies || []);
      if (!selectedThresholdId && config.Thresholds.length) {
        const first = config.Thresholds[0];
        setSelectedThresholdId(first.ThresholdId);
        setForm(toFormState(first));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load threshold configuration.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadThresholds();
  }, [token]);

  const filteredThresholds = useMemo(() => {
    return thresholds.filter((threshold) =>
      filter === 'All' ? true : (threshold.ProcurementType || '').toLowerCase() === filter.toLowerCase()
    );
  }, [filter, thresholds]);

  const selectedThreshold = useMemo(
    () => thresholds.find((threshold) => threshold.ThresholdId === selectedThresholdId) ?? null,
    [selectedThresholdId, thresholds]
  );

  const handleSelect = (threshold: WorkflowConfigurationThreshold) => {
    setSelectedThresholdId(threshold.ThresholdId);
    setForm(toFormState(threshold));
    setMessage(null);
    setError(null);
  };

  const handleChange = <K extends keyof ThresholdFormState>(key: K, value: ThresholdFormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const normalizePayload = () => ({
    ProcurementType: form.procurementType.trim() || null,
    MinAmount: Number(form.minAmount || '0'),
    MaxAmount: form.maxAmount.trim() ? Number(form.maxAmount) : null,
    ApprovalRoute: form.approvalRoute.trim(),
    ApprovalAuthorityCode: form.approvalAuthorityCode.trim(),
    ApprovalAuthorityLabel: form.approvalAuthorityLabel.trim(),
    GovernanceBodyId: form.requiresBoard ? form.governanceBodyId || null : null,
    RequiresCgisApproval: form.requiresCgisApproval,
    RequiresBoard: form.requiresBoard,
    RequiresBpp: form.requiresBpp,
    Status: form.status,
    Notes: form.notes.trim() || null
  });

  const handleSave = async () => {
    if (!token || !selectedThreshold) {
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const updated = await updateWorkflowThreshold(token, selectedThreshold.ThresholdId, normalizePayload());
      setThresholds((current) =>
        current.map((threshold) => (threshold.ThresholdId === updated.ThresholdId ? updated : threshold))
      );
      setForm(toFormState(updated));
      setMessage('Threshold updated successfully.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update threshold.');
    } finally {
      setSaving(false);
    }
  };

  const handleCreate = async () => {
    if (!token) {
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const created = await createWorkflowThreshold(token, normalizePayload());
      setThresholds((current) => [created, ...current]);
      setSelectedThresholdId(created.ThresholdId);
      setForm(toFormState(created));
      setFilter((current) => (current === 'All' ? current : (created.ProcurementType as ThresholdFilter) || current));
      setMessage('Threshold created successfully.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create threshold.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!token || !selectedThreshold) {
      return;
    }

    if (!window.confirm(`Delete threshold ${selectedThreshold.ApprovalAuthorityLabel} for ${selectedThreshold.ProcurementType || 'All'}?`)) {
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await deleteWorkflowThreshold(token, selectedThreshold.ThresholdId);
      const next = thresholds.filter((threshold) => threshold.ThresholdId !== selectedThreshold.ThresholdId);
      setThresholds(next);
      if (next.length) {
        setSelectedThresholdId(next[0].ThresholdId);
        setForm(toFormState(next[0]));
      } else {
        setSelectedThresholdId('');
        setForm(emptyForm);
      }
      setMessage('Threshold deleted successfully.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete threshold.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="admin-hub">
      <div className="admin-hero">
        <div>
          <div className="admin-kicker">System Administration</div>
          <h2>{module.title}</h2>
          <p>{module.description}</p>
          <div className="admin-tags">
            <span className="admin-tag">{thresholds.length} threshold bands</span>
            <span className="admin-tag">{thresholds.filter((item) => item.RequiresBpp).length} BPP bands</span>
            <span className="admin-tag">{thresholds.filter((item) => item.RequiresCgisApproval).length} CGIS bands</span>
          </div>
        </div>
        <button type="button" className="workflow-config-refresh" onClick={() => void loadThresholds()} disabled={loading || !token}>
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {error ? <div className="portal-alert">{error}</div> : null}
      {message ? <div className="plan-success">{message}</div> : null}

      <div className="workflow-config-tabs">
        {filters.map((item) => (
          <button key={item} type="button" className={filter === item ? 'active' : ''} onClick={() => setFilter(item)}>
            {item}
          </button>
        ))}
      </div>

      <div className="admin-grid" style={{ marginTop: '24px' }}>
        <article className="admin-card admin-card--wide">
          <h3>Threshold Bands</h3>
          <div className="portal-table-container">
          <table className="plan-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Band</th>
                <th>Authority</th>
                <th>Route</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredThresholds.map((threshold) => (
                <tr
                  key={threshold.ThresholdId}
                  className={selectedThresholdId === threshold.ThresholdId ? 'plan-row--selected' : undefined}
                  onClick={() => handleSelect(threshold)}
                >
                  <td>{threshold.ProcurementType || 'All'}</td>
                  <td>{formatCurrency(threshold.MinAmount)} - {formatCurrency(threshold.MaxAmount)}</td>
                  <td>{threshold.ApprovalAuthorityLabel}</td>
                  <td>{threshold.ApprovalRoute}</td>
                  <td>{threshold.Status}</td>
                </tr>
              ))}
              {!filteredThresholds.length ? (
                <tr>
                  <td colSpan={5} className="plan-empty">No thresholds found for {filter}.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
          </div>
        </article>

        <article className="admin-card admin-card--mid">
          <h3>{selectedThreshold ? 'Edit Threshold' : 'Create Threshold'}</h3>
          <div className="plan-form-grid">
            <label className="plan-field">
              <span>Procurement Type</span>
              <select className="plan-select" value={form.procurementType} onChange={(e) => handleChange('procurementType', e.target.value)}>
                <option value="Goods">Goods</option>
                <option value="Works">Works</option>
                <option value="Services">Services</option>
              </select>
            </label>
            <label className="plan-field">
              <span>Min Amount</span>
              <input className="plan-input" type="number" min="0" value={form.minAmount} onChange={(e) => handleChange('minAmount', e.target.value)} />
            </label>
            <label className="plan-field">
              <span>Max Amount</span>
              <input className="plan-input" type="number" min="0" placeholder="Leave blank for and above" value={form.maxAmount} onChange={(e) => handleChange('maxAmount', e.target.value)} />
            </label>
            <label className="plan-field">
              <span>Approval Route</span>
              <input className="plan-input" value={form.approvalRoute} onChange={(e) => handleChange('approvalRoute', e.target.value)} />
            </label>
            <label className="plan-field">
              <span>Authority Code</span>
              <input className="plan-input" value={form.approvalAuthorityCode} onChange={(e) => handleChange('approvalAuthorityCode', e.target.value)} />
            </label>
            <label className="plan-field">
              <span>Authority Label</span>
              <input className="plan-input" value={form.approvalAuthorityLabel} onChange={(e) => handleChange('approvalAuthorityLabel', e.target.value)} />
            </label>
            <label className="plan-field">
              <span>Governance Body</span>
              <select
                className="plan-select"
                value={form.governanceBodyId}
                disabled={!form.requiresBoard}
                onChange={(e) => handleChange('governanceBodyId', e.target.value)}
              >
                <option value="">Direct executive route</option>
                {governanceBodies.map((body) => (
                  <option key={body.BodyId} value={body.BodyId}>{body.BodyName}</option>
                ))}
              </select>
            </label>
            <label className="plan-field">
              <span>Status</span>
              <select className="plan-select" value={form.status} onChange={(e) => handleChange('status', e.target.value)}>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </label>
            <label className="plan-field plan-field--checkbox">
              <input
                type="checkbox"
                checked={form.requiresCgisApproval}
                onChange={(e) => {
                  handleChange('requiresCgisApproval', e.target.checked);
                  if (e.target.checked) {
                    handleChange('requiresBoard', false);
                    handleChange('governanceBodyId', '');
                  }
                }}
              />
              <span>Requires CGIS Approval</span>
            </label>
            <label className="plan-field plan-field--checkbox">
              <input
                type="checkbox"
                checked={form.requiresBoard}
                onChange={(e) => {
                  handleChange('requiresBoard', e.target.checked);
                  if (e.target.checked) {
                    handleChange('requiresCgisApproval', false);
                  } else {
                    handleChange('governanceBodyId', '');
                  }
                }}
              />
              <span>Requires Board</span>
            </label>
            <label className="plan-field plan-field--checkbox">
              <input type="checkbox" checked={form.requiresBpp} onChange={(e) => handleChange('requiresBpp', e.target.checked)} />
              <span>Requires BPP</span>
            </label>
            <label className="plan-field plan-field--span">
              <span>Notes</span>
              <textarea className="plan-textarea" rows={4} value={form.notes} onChange={(e) => handleChange('notes', e.target.value)} />
            </label>
          </div>

          <div className="plan-actions">
            <button type="button" className="plan-button" onClick={() => void handleSave()} disabled={saving || !selectedThreshold}>
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
            <button type="button" className="plan-button plan-button--secondary" onClick={() => { setSelectedThresholdId(''); setForm(emptyForm); }}>
              New Draft
            </button>
            <button type="button" className="plan-button plan-button--secondary" onClick={() => void handleCreate()} disabled={saving}>
              Create New
            </button>
            <button type="button" className="plan-button plan-button--danger" onClick={() => void handleDelete()} disabled={saving || !selectedThreshold}>
              Delete
            </button>
          </div>
        </article>
      </div>
    </section>
  );
};

export default ThresholdConfigurationModule;
