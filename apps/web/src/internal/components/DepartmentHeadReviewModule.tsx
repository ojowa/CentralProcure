'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { InternalModule, RequisitionDetail, RequisitionSummary, RequisitionLineItem } from '../types/internal';
import { fetchRequisitions, fetchRequisitionDetail, submitDepartmentHeadReview } from '../services/requisitionService';
import { formatCurrency, formatDate, formatDateTimeShort } from '../utils/procureUtils';

interface Props {
  module: InternalModule;
  token: string | null;
  role?: string | null;
  userEmail?: string | null;
}

export const DepartmentHeadReviewModule: React.FC<Props> = ({ module, token, userEmail }) => {
  const router = useRouter();
  const [requisitions, setRequisitions] = useState<RequisitionSummary[]>([]);
  const [selectedRequisition, setSelectedRequisition] = useState<RequisitionDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Review form state
  const [reviewDecision, setReviewDecision] = useState<'endorse' | 'return' | 'reject'>('endorse');
  const [reviewNotes, setReviewNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('Submitted');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (token) {
      loadRequisitions();
    }
  }, [token, statusFilter]);

  const loadRequisitions = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetchRequisitions(token, {
        status: statusFilter,
        sortBy: 'created_at',
        sortDir: 'desc'
      });
      setRequisitions(response.Items || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load requisitions');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectRequisition = async (req: RequisitionSummary) => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const detail = await fetchRequisitionDetail(token, req.RequisitionId);
      setSelectedRequisition(detail);
      setReviewDecision('endorse');
      setReviewNotes('');
    } catch (err: any) {
      setError(err.message || 'Failed to load requisition details');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitReview = async () => {
    if (!token || !selectedRequisition) return;
    setIsSubmitting(true);
    setError(null);
    setFeedback(null);
    try {
      await submitDepartmentHeadReview(token, selectedRequisition.RequisitionId, {
        Decision: reviewDecision,
        Notes: reviewNotes.trim()
      });
      setFeedback(`Requisition ${reviewDecision === 'endorse' ? 'endorsed' : reviewDecision === 'return' ? 'returned' : 'rejected'} successfully.`);
      setSelectedRequisition(null);
      await loadRequisitions();
    } catch (err: any) {
      setError(err.message || 'Failed to submit review');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredRequisitions = useMemo(() => {
    if (!searchQuery.trim()) return requisitions;
    const query = searchQuery.toLowerCase();
    return requisitions.filter(
      (r) =>
        r.Title.toLowerCase().includes(query) ||
        r.Department.toLowerCase().includes(query) ||
        r.Status.toLowerCase().includes(query)
    );
  }, [requisitions, searchQuery]);

  const statusCounts = useMemo(() => {
    return {
      submitted: requisitions.filter((r) => r.Status === 'Submitted').length,
      underReview: requisitions.filter((r) => r.Status === 'Under Review').length,
      total: requisitions.length
    };
  }, [requisitions]);

  return (
    <section className="app-module">
      {/* Header */}
      <header className="app-module__header">
        <div className="app-module__title-group">
          <h2 className="app-module__title">{module.title}</h2>
          <p className="app-module__description">{module.description}</p>
        </div>
      </header>

      {/* Alerts */}
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

      {/* Stats */}
      <div className="app-stats-grid">
        <div className="app-stat-card app-stat-card--info">
          <div className="app-stat-card__value">{statusCounts.total}</div>
          <div className="app-stat-card__label">Total Pending</div>
        </div>
        <div className="app-stat-card">
          <div className="app-stat-card__value">{statusCounts.submitted}</div>
          <div className="app-stat-card__label">Awaiting Endorsement</div>
        </div>
        <div className="app-stat-card app-stat-card--warning">
          <div className="app-stat-card__value">{statusCounts.underReview}</div>
          <div className="app-stat-card__label">Under Review</div>
        </div>
      </div>

      {/* Main Content */}
      <div className="dh-layout">
        {/* Queue Panel */}
        <div className="dh-queue-panel">
          <div className="app-card">
            <div className="app-card__header">
              <div className="app-section-title">
                <span className="app-section-title__icon">📋</span>
                <h3 className="app-section-title__text">Review Queue</h3>
                <span className="app-section-title__count">{filteredRequisitions.length}</span>
              </div>
            </div>

            {/* Filters */}
            <div className="dh-filters">
              <div className="app-search">
                <span className="app-search__icon">🔍</span>
                <input
                  className="app-search__input"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search requisitions..."
                />
              </div>
              <select
                className="plan-input"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="Submitted">Submitted</option>
                <option value="Under Review">Under Review</option>
                <option value="Draft">Draft</option>
                <option value="">All Statuses</option>
              </select>
            </div>

            {/* Queue List */}
            <div className="dh-queue-list">
              {loading && !requisitions.length ? (
                <div className="app-empty-state">
                  <span className="app-empty-state__icon">⏳</span>
                  <p>Loading requisitions...</p>
                </div>
              ) : filteredRequisitions.length === 0 ? (
                <div className="app-empty-state">
                  <span className="app-empty-state__icon">📭</span>
                  <p>No requisitions awaiting review</p>
                </div>
              ) : (
                filteredRequisitions.map((req) => (
                  <button
                    key={req.RequisitionId}
                    className={`dh-queue-item ${selectedRequisition?.RequisitionId === req.RequisitionId ? 'dh-queue-item--active' : ''}`}
                    onClick={() => handleSelectRequisition(req)}
                  >
                    <div className="dh-queue-item__header">
                      <h4 className="dh-queue-item__title">{req.Title}</h4>
                      <span className={`app-badge app-badge--${req.Status.toLowerCase().replace(' ', '-')}`}>
                        {req.Status}
                      </span>
                    </div>
                    <div className="dh-queue-item__meta">
                      <span>{req.Department}</span>
                      <span>•</span>
                      <span>{formatDate(req.RequiredBy)}</span>
                    </div>
                    <div className="dh-queue-item__footer">
                      <span className="dh-queue-item__amount">{formatCurrency(req.TotalEstimate)}</span>
                      <span className="dh-queue-item__date">{formatDateTimeShort(req.CreatedAt)}</span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Detail Panel */}
        <div className="dh-detail-panel">
          {selectedRequisition ? (
            <div className="app-card app-card--highlight">
              <div className="app-card__header">
                <div className="app-section-title">
                  <span className="app-section-title__icon">📄</span>
                  <h3 className="app-section-title__text">Review Requisition</h3>
                </div>
              </div>

              {/* Requisition Info */}
              <div className="dh-req-info">
                <h4 className="dh-req-info__title">{selectedRequisition.Title}</h4>
                <div className="dh-req-info__grid">
                  <div className="dh-req-info__item">
                    <span className="dh-req-info__label">Department</span>
                    <span className="dh-req-info__value">{selectedRequisition.Department}</span>
                  </div>
                  <div className="dh-req-info__item">
                    <span className="dh-req-info__label">Requested By</span>
                    <span className="dh-req-info__value">{formatDate(selectedRequisition.RequiredBy)}</span>
                  </div>
                  <div className="dh-req-info__item">
                    <span className="dh-req-info__label">Total Estimate</span>
                    <span className="dh-req-info__value dh-req-info__value--highlight">
                      {formatCurrency(selectedRequisition.TotalEstimate)}
                    </span>
                  </div>
                  <div className="dh-req-info__item">
                    <span className="dh-req-info__label">Status</span>
                    <span className="dh-req-info__value">
                      <span className={`app-badge app-badge--${selectedRequisition.Status.toLowerCase().replace(' ', '-')}`}>
                        {selectedRequisition.Status}
                      </span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Line Items */}
              {selectedRequisition.LineItems && selectedRequisition.LineItems.length > 0 && (
                <div className="dh-line-items">
                  <h5 className="dh-section-title">Line Items</h5>
                  <div className="app-table-wrapper">
                    <table className="app-table app-table--compact">
                      <thead>
                        <tr>
                          <th>Description</th>
                          <th className="app-table__cell--numeric">Qty</th>
                          <th className="app-table__cell--numeric">Unit Price</th>
                          <th className="app-table__cell--numeric">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedRequisition.LineItems.map((item: RequisitionLineItem, idx: number) => (
                          <tr key={idx}>
                            <td className="app-table__cell">{item.Description}</td>
                            <td className="app-table__cell app-table__cell--numeric">{item.Quantity}</td>
                            <td className="app-table__cell app-table__cell--numeric">
                              {formatCurrency(item.UnitCost)}
                            </td>
                            <td className="app-table__cell app-table__cell--numeric">
                              {formatCurrency(item.Quantity * item.UnitCost)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Review Form */}
              <div className="dh-review-form">
                <h5 className="dh-section-title">Department Head Decision</h5>

                <div className="dh-decision-options">
                  <label className={`dh-decision-option ${reviewDecision === 'endorse' ? 'dh-decision-option--selected' : ''}`}>
                    <input
                      type="radio"
                      name="decision"
                      value="endorse"
                      checked={reviewDecision === 'endorse'}
                      onChange={() => setReviewDecision('endorse')}
                    />
                    <span className="dh-decision-option__icon">✓</span>
                    <span className="dh-decision-option__label">Endorse</span>
                    <span className="dh-decision-option__desc">Forward to Planning Committee</span>
                  </label>

                  <label className={`dh-decision-option ${reviewDecision === 'return' ? 'dh-decision-option--selected' : ''}`}>
                    <input
                      type="radio"
                      name="decision"
                      value="return"
                      checked={reviewDecision === 'return'}
                      onChange={() => setReviewDecision('return')}
                    />
                    <span className="dh-decision-option__icon">↩</span>
                    <span className="dh-decision-option__label">Return</span>
                    <span className="dh-decision-option__desc">Send back for corrections</span>
                  </label>

                  <label className={`dh-decision-option ${reviewDecision === 'reject' ? 'dh-decision-option--selected' : ''}`}>
                    <input
                      type="radio"
                      name="decision"
                      value="reject"
                      checked={reviewDecision === 'reject'}
                      onChange={() => setReviewDecision('reject')}
                    />
                    <span className="dh-decision-option__icon">✕</span>
                    <span className="dh-decision-option__label">Reject</span>
                    <span className="dh-decision-option__desc">Decline this request</span>
                  </label>
                </div>

                <div className="app-form-group">
                  <label className="app-form-label" htmlFor="review-notes">
                    Review Notes
                  </label>
                  <textarea
                    id="review-notes"
                    className="app-textarea"
                    rows={4}
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    placeholder="Add your review comments, required corrections, or rejection rationale..."
                  />
                </div>

                <div className="app-card__footer">
                  <div className="app-action-group">
                    <button
                      type="button"
                      className={`app-btn app-btn--lg ${reviewDecision === 'endorse' ? 'app-btn--success' : reviewDecision === 'reject' ? 'app-btn--danger' : 'app-btn--warning'}`}
                      disabled={isSubmitting}
                      onClick={handleSubmitReview}
                    >
                      {isSubmitting ? 'Submitting...' : reviewDecision === 'endorse' ? 'Endorse & Forward' : reviewDecision === 'return' ? 'Return for Correction' : 'Reject Requisition'}
                    </button>
                    <button
                      type="button"
                      className="app-btn app-btn--secondary app-btn--lg"
                      onClick={() => setSelectedRequisition(null)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="app-card app-card--placeholder">
              <div className="app-placeholder">
                <span className="app-placeholder__icon">👆</span>
                <h4 className="app-placeholder__title">Select a Requisition</h4>
                <p className="app-placeholder__text">
                  Choose a requisition from the queue to review and endorse
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default DepartmentHeadReviewModule;
