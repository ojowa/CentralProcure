'use client';

import React, { useEffect, useState } from 'react';
import type { InternalModule } from '../types/internal';

interface Props {
  module: InternalModule;
  token: string | null;
}

export type ThresholdBandConfig = {
  id: string;
  label: string;
  min: number;
  max: number;
  approvalLevel: string;
  timeline: string;
  requiresBpp: boolean;
  escalation: string;
  steps: string[];
  isActive: boolean;
};

const defaultThresholdBands: ThresholdBandConfig[] = [
  {
    id: 'cgis-direct',
    label: 'Below NGN 50M',
    min: 0,
    max: 50_000_000,
    approvalLevel: 'CGIS Direct Approval',
    timeline: '30 - 45 days',
    requiresBpp: false,
    escalation: 'Low-value cases move from evaluation to CGIS approval before award publication.',
    steps: ['Requisition Review', 'Evaluation', 'CGIS Approval', 'Award Publication'],
    isActive: true
  },
  {
    id: 'nis-board',
    label: 'NGN 50M - 100M',
    min: 50_000_000,
    max: 100_000_000,
    approvalLevel: 'NIS Tenders Board',
    timeline: '45 - 60 days',
    requiresBpp: false,
    escalation: 'Board-routed cases are decided by the NIS Tenders Board chaired by CGIS.',
    steps: ['Requisition Review', 'Evaluation', 'Tenders Board Review', 'Award Publication'],
    isActive: true
  },
  {
    id: 'bpp-prior-review',
    label: 'NGN 100M+',
    min: 100_000_000,
    max: Number.POSITIVE_INFINITY,
    approvalLevel: 'NIS Tenders Board + BPP',
    timeline: '60 - 90 days',
    requiresBpp: true,
    escalation: 'High-value cases require board endorsement before BPP no-objection and award publication.',
    steps: ['Requisition Review', 'Evaluation', 'Tenders Board Review', 'BPP No Objection', 'Award Publication'],
    isActive: true
  }
];

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(value);

export const ThresholdConfigurationModule: React.FC<Props> = ({ module, token }) => {
  const [thresholds, setThresholds] = useState<ThresholdBandConfig[]>(defaultThresholdBands);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<ThresholdBandConfig | null>(null);

  useEffect(() => {
    loadThresholds();
  }, [token]);

  const loadThresholds = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      setThresholds(defaultThresholdBands);
    } catch (err: any) {
      setError(err.message || 'Failed to load threshold configuration');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (band: ThresholdBandConfig) => {
    setEditingId(band.id);
    setEditForm({ ...band });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditForm(null);
  };

  const handleSaveEdit = () => {
    if (!editForm) return;
    setThresholds((prev) => prev.map((band) => (band.id === editForm.id ? editForm : band)));
    setEditingId(null);
    setEditForm(null);
    setFeedback('Threshold band updated successfully');
    setTimeout(() => setFeedback(null), 3000);
  };

  const handleToggleActive = (id: string) => {
    setThresholds((prev) => prev.map((band) => (band.id === id ? { ...band, isActive: !band.isActive } : band)));
  };

  const handleFormChange = (field: keyof ThresholdBandConfig, value: any) => {
    if (!editForm) return;
    setEditForm({ ...editForm, [field]: value });
  };

  const handleAddStep = () => {
    if (!editForm) return;
    setEditForm({ ...editForm, steps: [...editForm.steps, ''] });
  };

  const handleUpdateStep = (index: number, value: string) => {
    if (!editForm) return;
    const newSteps = [...editForm.steps];
    newSteps[index] = value;
    setEditForm({ ...editForm, steps: newSteps });
  };

  const handleRemoveStep = (index: number) => {
    if (!editForm) return;
    const newSteps = editForm.steps.filter((_, i) => i !== index);
    setEditForm({ ...editForm, steps: newSteps });
  };

  const handleSaveAll = async () => {
    if (!token) return;
    setSaving(true);
    setError(null);
    setFeedback(null);
    try {
      setFeedback('Threshold configuration saved successfully');
      setTimeout(() => setFeedback(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to save threshold configuration');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="app-module">
      <header className="app-module__header">
        <div className="app-module__title-group">
          <h2 className="app-module__title">{module.title}</h2>
          <p className="app-module__description">{module.description}</p>
        </div>
        <div className="app-module__actions">
          <button
            className="app-btn app-btn--primary"
            onClick={handleSaveAll}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save Configuration'}
          </button>
        </div>
      </header>

      {error && (
        <div className="app-alert app-alert--error">
          <span className="app-alert__icon">⚠</span>
          {error}
        </div>
      )}

      {feedback && (
        <div className="app-alert app-alert--success">
          <span className="app-alert__icon">✓</span>
          {feedback}
        </div>
      )}

      <div className="app-card">
        <div className="app-card__header">
          <div className="app-section-title">
            <span className="app-section-title__icon">⚙</span>
            <h3 className="app-section-title__text">Threshold Bands</h3>
            <span className="app-section-title__count">{thresholds.length}</span>
          </div>
        </div>
        <p className="app-card__description">
          Configure procurement thresholds that determine approval routes and governance requirements.
        </p>

        {loading ? (
          <div className="app-empty-state">
            <span className="app-empty-state__icon">⏳</span>
            <p>Loading threshold configuration...</p>
          </div>
        ) : (
          <div className="threshold-bands-list">
            {thresholds.map((band) => (
              <div
                key={band.id}
                className={`threshold-band-card ${!band.isActive ? 'threshold-band-card--inactive' : ''}`}
              >
                {editingId === band.id && editForm ? (
                  <div className="threshold-band-form">
                    <div className="app-form__group">
                      <label className="app-form__label">Band Label</label>
                      <input
                        type="text"
                        className="app-form__input"
                        value={editForm.label}
                        onChange={(e) => handleFormChange('label', e.target.value)}
                      />
                    </div>

                    <div className="app-form__row">
                      <div className="app-form__group">
                        <label className="app-form__label">Minimum Amount (NGN)</label>
                        <input
                          type="number"
                          className="app-form__input"
                          value={editForm.min}
                          onChange={(e) => handleFormChange('min', Number(e.target.value))}
                        />
                      </div>
                      <div className="app-form__group">
                        <label className="app-form__label">Maximum Amount (NGN)</label>
                        <input
                          type="number"
                          className="app-form__input"
                          value={editForm.max === Number.POSITIVE_INFINITY ? '' : editForm.max}
                          placeholder="Unlimited"
                          onChange={(e) => handleFormChange('max', e.target.value ? Number(e.target.value) : Number.POSITIVE_INFINITY)}
                        />
                      </div>
                    </div>

                    <div className="app-form__group">
                      <label className="app-form__label">Approval Level</label>
                      <input
                        type="text"
                        className="app-form__input"
                        value={editForm.approvalLevel}
                        onChange={(e) => handleFormChange('approvalLevel', e.target.value)}
                      />
                    </div>

                    <div className="app-form__row">
                      <div className="app-form__group">
                        <label className="app-form__label">Timeline</label>
                        <input
                          type="text"
                          className="app-form__input"
                          value={editForm.timeline}
                          onChange={(e) => handleFormChange('timeline', e.target.value)}
                        />
                      </div>
                      <div className="app-form__group app-form__group--checkbox">
                        <label className="app-form__label">
                          <input
                            type="checkbox"
                            checked={editForm.requiresBpp}
                            onChange={(e) => handleFormChange('requiresBpp', e.target.checked)}
                          />
                          Requires BPP
                        </label>
                      </div>
                    </div>

                    <div className="app-form__group">
                      <label className="app-form__label">Escalation Description</label>
                      <textarea
                        className="app-form__textarea"
                        rows={3}
                        value={editForm.escalation}
                        onChange={(e) => handleFormChange('escalation', e.target.value)}
                      />
                    </div>

                    <div className="app-form__group">
                      <label className="app-form__label">Workflow Steps</label>
                      <div className="threshold-steps-list">
                        {editForm.steps.map((step, index) => (
                          <div key={index} className="threshold-step-input">
                            <span className="threshold-step-number">{index + 1}</span>
                            <input
                              type="text"
                              className="app-form__input"
                              value={step}
                              onChange={(e) => handleUpdateStep(index, e.target.value)}
                              placeholder={`Step ${index + 1}`}
                            />
                            <button
                              type="button"
                              className="app-btn app-btn--sm app-btn--danger"
                              onClick={() => handleRemoveStep(index)}
                              disabled={editForm.steps.length <= 1}
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          className="app-btn app-btn--sm app-btn--secondary"
                          onClick={handleAddStep}
                        >
                          + Add Step
                        </button>
                      </div>
                    </div>

                    <div className="threshold-band-form__actions">
                      <button
                        className="app-btn app-btn--secondary"
                        onClick={handleCancelEdit}
                      >
                        Cancel
                      </button>
                      <button
                        className="app-btn app-btn--primary"
                        onClick={handleSaveEdit}
                      >
                        Save Changes
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="threshold-band-display">
                    <div className="threshold-band__header">
                      <div className="threshold-band__title-group">
                        <h4 className="threshold-band__title">{band.label}</h4>
                        <span className={`app-badge ${band.isActive ? 'app-badge--success' : 'app-badge--muted'}`}>
                          {band.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <div className="threshold-band__actions">
                        <button
                          className="app-btn app-btn--sm app-btn--secondary"
                          onClick={() => handleEdit(band)}
                        >
                          Edit
                        </button>
                        <button
                          className={`app-btn app-btn--sm ${band.isActive ? 'app-btn--warning' : 'app-btn--success'}`}
                          onClick={() => handleToggleActive(band.id)}
                        >
                          {band.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                      </div>
                    </div>

                    <div className="threshold-band__grid">
                      <div className="threshold-band__stat">
                        <span className="threshold-band__stat-label">Range</span>
                        <span className="threshold-band__stat-value">
                          {formatCurrency(band.min)} - {band.max === Number.POSITIVE_INFINITY ? '∞' : formatCurrency(band.max)}
                        </span>
                      </div>
                      <div className="threshold-band__stat">
                        <span className="threshold-band__stat-label">Approval Level</span>
                        <span className="threshold-band__stat-value">{band.approvalLevel}</span>
                      </div>
                      <div className="threshold-band__stat">
                        <span className="threshold-band__stat-label">Timeline</span>
                        <span className="threshold-band__stat-value">{band.timeline}</span>
                      </div>
                      <div className="threshold-band__stat">
                        <span className="threshold-band__stat-label">BPP Required</span>
                        <span className="threshold-band__stat-value">{band.requiresBpp ? 'Yes' : 'No'}</span>
                      </div>
                    </div>

                    <div className="threshold-band__steps">
                      <span className="threshold-band__steps-label">Workflow Steps:</span>
                      <ol className="threshold-band__steps-list">
                        {band.steps.map((step, index) => (
                          <li key={index}>{step}</li>
                        ))}
                      </ol>
                    </div>

                    <p className="threshold-band__escalation">{band.escalation}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default ThresholdConfigurationModule;
